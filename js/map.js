/* ============================================================
   地图页：圆形卡通地球 + equirectangular 投影 + 城市 pin
   - SVG 地图用 equirectangular 投影，被圆形 .map-round 裁切
   - pin 按经纬度 + 墨卡托 y 映射到圆形区域内的百分比
   - 小王子飞机沿着地球外围轨道飞行
   ============================================================ */

(function () {
  const mapEl = document.getElementById('globe');
  const pinsHost = document.getElementById('city-pins');
  const cityList = document.getElementById('city-list');
  const popover = document.getElementById('popover');
  const popoverBody = document.getElementById('popover-body');
  const popoverClose = document.getElementById('popover-close');
  const popoverAddPhoto = document.getElementById('popover-add-photo');
  const popoverDelete = document.getElementById('popover-delete');
  const addBtn = document.getElementById('add-city-btn');
  const addCityModal = document.getElementById('add-city-modal');
  const addCityClose = document.getElementById('add-city-close');
  const addCityCancel = document.getElementById('add-city-cancel');
  const addCityForm = document.getElementById('add-city-form');
  const addPhotoModal = document.getElementById('map-add-photo-modal');
  const addPhotoClose = document.getElementById('map-add-photo-close');
  const addPhotoCancel = document.getElementById('map-add-photo-cancel');
  const addPhotoForm = document.getElementById('map-add-photo-form');
  const addPhotoCityName = document.getElementById('map-add-photo-city');
  const statusEl = document.getElementById('map-add-photo-status');
  const addCityStatusEl = document.getElementById('add-city-status');

  if (!mapEl || !pinsHost || typeof window.geo === 'undefined') return;

  const W = 1000, H = 500;
  const project = window.geo.equirectangular(W, H);

  /* ===== 数据 ===== */
  const STORAGE_KEY = 'travel-trips-v1';
  let allTrips = [];
  let userTrips = [];
  let photoIndex = {};
  let currentTrip = null;

  function loadTrips() {
    return fetch('data/trips.json')
      .then((r) => r.ok ? r.json() : FALLBACK)
      .catch(() => FALLBACK)
      .then((base) => {
        try { userTrips = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { userTrips = []; }
        allTrips = base.concat(userTrips);
        allTrips.forEach((t) => { const k = tripKey(t); if (!(k in photoIndex)) photoIndex[k] = 0; });
        return allTrips;
      });
  }

  function persistUserTrips() { localStorage.setItem(STORAGE_KEY, JSON.stringify(userTrips)); }
  function tripKey(t) { return t.city + '|' + t.lat + '|' + t.lng; }
  function isUserTrip(t) { return userTrips.indexOf(t) !== -1; }

  const FALLBACK = [
    { city: '上海', lat: 31.23, lng: 121.47, date: '2024-04', photos: [{ url: 'https://picsum.photos/seed/sh/600/400', note: '外滩的风永远很清醒。' }] },
  ];

  const PIN_EMOJIS = ['⭐', '♡', '✿', '★', '🌸'];

  /* ===== Supabase 共享照片 (复用 shell 里的 client) ===== */
  const supabase = window.__sb;
  if (!supabase) console.warn('map.js: window.__sb not available');

  function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // 上传文件到 Supabase Storage, 失败自动降级到 base64
  // 流程: 压缩 → 上传 (Storage) → 失败回退 base64
  // 返回 { url, via: 'storage' | 'base64', path, originalSize, compressedSize }
  async function uploadImage(file) {
    // 1. 上传前压缩 (5MB → ~400KB, 大幅提速)
    let toUpload = file;
    let originalSize = file.size;
    let compressedSize = file.size;
    try {
      if (window.compressImage) {
        const compressed = await window.compressImage(file);
        if (compressed && compressed.size) {
          toUpload = compressed;
          compressedSize = compressed.size;
        }
      }
    } catch (e) { console.warn('compress failed, use original:', e); }

    // 2. 上传 (Storage 优先, 失败降级 base64)
    const safeName = (toUpload.name || 'photo').replace(/[^\w.\-]+/g, '_').slice(0, 60);
    const filePath = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from('photos')
      .upload(filePath, toUpload, { contentType: toUpload.type || 'image/jpeg', upsert: false });
    if (!uploadError) {
      const { data: urlData } = supabase.storage.from('photos').getPublicUrl(filePath);
      return { url: urlData.publicUrl, via: 'storage', path: filePath, originalSize, compressedSize };
    }
    console.warn('storage upload failed, fallback to base64:', uploadError);
    const dataUrl = await fileToDataURL(file);  // 兜底用原图
    return { url: dataUrl, via: 'base64', path: null, originalSize, compressedSize: dataUrl.length };
  }

  // 缓存：所有共享相册记录。启动 + 弹窗打开 + 上传成功后 refetch。
  let sharedPhotos = [];

  async function loadSharedPhotos() {
    try {
      const { data, error } = await supabase
        .from('gallery')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) { console.warn('loadSharedPhotos error:', error); sharedPhotos = []; return; }
      sharedPhotos = data || [];
    } catch (e) {
      console.warn('loadSharedPhotos failed:', e);
      sharedPhotos = [];
    }
  }

  // 把共享照片合并进 trip.photos (in-memory only, 不写 localStorage)
  // 用 _sharedId 标记 Supabase 行, 防止重复 append
  function applySharedPhotosToTrip(trip) {
    const existingIds = new Set((trip.photos || []).map((p) => p._sharedId).filter(Boolean));
    const fresh = sharedPhotos.filter((p) => p.city === trip.city && !existingIds.has(p.id));
    if (!fresh.length) return;
    const tagged = fresh.map((p) => ({ url: p.url, note: p.note || p.year || '', _sharedId: p.id }));
    trip.photos = (trip.photos || []).concat(tagged);
  }

  /* ===== 世界地图 ===== */
  function loadWorld() {
    const sources = ['data/world.geojson', 'https://cdn.jsdelivr.net/gh/datasets/geo-countries@master/data/countries.geojson'];
    function tryNext(i) {
      if (i >= sources.length) return Promise.resolve();
      return fetch(sources[i])
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (!data || data.type !== 'FeatureCollection' || !data.features) return tryNext(i + 1);
          window.__countries = data.features;
          drawWorld(data.features);
        })
        .catch(() => tryNext(i + 1));
    }
    return tryNext(0);
  }

  function drawWorld(features) {
    // continents
    const gCont = document.getElementById('continents');
    gCont.innerHTML = '';
    const dStr = window.geo.pathGeneric(project)({ type: 'FeatureCollection', features });
    if (dStr) {
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', dStr);
      p.setAttribute('class', 'continent');
      gCont.appendChild(p);
    }
    // graticule
    const gGrid = document.getElementById('graticule');
    gGrid.innerHTML = '';
    const gridFc = window.geo.graticuleFlat([30, 30]);
    const gStr = window.geo.pathGeneric(project)(gridFc);
    if (gStr) {
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', gStr);
      gGrid.appendChild(p);
    }
  }

  /* ===== 经纬度 → 百分比 =====
     equirectangular 直接线性映射（儿童画笔触风格，不做墨卡托修正） */
  function projectToPercent(lat, lng) {
    const xPct = ((lng + 180) / 360) * 100;
    const yPct = ((90 - lat) / 180) * 100;
    return { xPct, yPct };
  }

  const pins = [];
  function addPin(trip) {
    const el = document.createElement('div');
    el.className = 'city-pin';
    el.innerHTML = `<div class="city-pin__inner"><span>${PIN_EMOJIS[pins.length % PIN_EMOJIS.length]}</span></div>`;
    const proj = projectToPercent(trip.lat, trip.lng);
    el.style.setProperty('--x', proj.xPct + '%');
    el.style.setProperty('--y', proj.yPct + '%');
    el.addEventListener('click', (e) => { e.stopPropagation(); openPopover(trip, el); });
    pinsHost.appendChild(el);
    pins.push({ el, trip });
  }

  function addListItem(trip) {
    if (!cityList) return;
    const li = document.createElement('li');
    li.innerHTML = `${trip.city} <span>${trip.date || ''}</span>`;
    li.addEventListener('click', () => {
      const pin = pins.find((p) => p.trip === trip);
      if (pin) openPopover(trip, pin.el);
    });
    cityList.appendChild(li);
  }

  /* ===== 弹窗 ===== */
  function renderPopoverBody(trip) {
    const key = tripKey(trip);
    const idx = photoIndex[key] || 0;
    const photo = (trip.photos && trip.photos[idx]) || { url: '', note: '(no photo)' };
    const total = (trip.photos || []).length;
    const dots = total > 1
      ? `<div class="photo-carousel__dots">${Array.from({ length: total }, (_, i) => `<span class="photo-carousel__dot ${i === idx ? 'active' : ''}" data-i="${i}"></span>`).join('')}</div>`
      : '';
    const nav = total > 1
      ? `<button class="photo-carousel__nav photo-carousel__nav--prev" data-dir="-1" type="button">‹</button><button class="photo-carousel__nav photo-carousel__nav--next" data-dir="1" type="button">›</button>`
      : '';
    const delBtn = photo._sharedId
      ? `<button class="photo-carousel__delete" data-shared-id="${photo._sharedId}" data-shared-url="${(photo.url || '').replace(/"/g, '&quot;')}" type="button" title="删除">×</button>`
      : '';
    return `
      <div class="city-popup">
        <h3>♡ ${trip.city}</h3><div class="city-popup__date">${trip.date || ''}</div>
        <div class="photo-carousel" id="photo-carousel">
          <div class="photo-carousel__img-wrap">
            <img class="photo-carousel__img" src="${photo.url}" alt="${trip.city}" loading="lazy" onerror="this.src='https://picsum.photos/seed/${encodeURIComponent(trip.city)}/600/400'">
            ${delBtn}
          </div>
          ${nav}${dots}
        </div>
        <p>${photo.note || ''}</p>
        ${total > 1 ? `<div style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--ink-soft); text-align: right;">${idx + 1} / ${total}</div>` : ''}
      </div>`;
  }

  function openPopover(trip, pinEl) {
    currentTrip = trip;
    photoIndex[tripKey(trip)] = 0;
    popoverBody.innerHTML = renderPopoverBody(trip);
    popover.hidden = false;
    positionPopover(pinEl);
    bindCarouselEvents();
    // 后台 refetch 共享照片, 拉到了就重渲染 (用 currentTrip 守卫防止 stale)
    loadSharedPhotos().then(() => {
      const before = (trip.photos || []).length;
      applySharedPhotosToTrip(trip);
      const after = (trip.photos || []).length;
      if (after > before && currentTrip === trip) {
        popoverBody.innerHTML = renderPopoverBody(trip);
        bindCarouselEvents();
      }
    });
  }

  function positionPopover(pinEl) {
    const rect = pinEl.getBoundingClientRect();
    const popRect = popover.getBoundingClientRect();
    const popH = popRect.height || 360, popW = popRect.width || 300;
    let top = rect.top - 6, transform = 'translate(-50%, -100%)';
    if (top - popH < 80) { top = rect.bottom + 6; transform = 'translate(-50%, 0%)'; }
    let left = rect.left + rect.width / 2;
    const halfW = popW / 2, margin = 12;
    if (left - halfW < margin) left = halfW + margin;
    if (left + halfW > window.innerWidth - margin) left = window.innerWidth - halfW - margin;
    popover.style.left = left + 'px';
    popover.style.top = top + 'px';
    popover.style.transform = transform;
  }

  function bindCarouselEvents() {
    const carousel = document.getElementById('photo-carousel');
    if (!carousel) return;
    carousel.querySelectorAll('.photo-carousel__nav').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!currentTrip) return;
        const key = tripKey(currentTrip);
        const total = (currentTrip.photos || []).length;
        if (total <= 1) return;
        let idx = photoIndex[key] + parseInt(btn.dataset.dir, 10);
        if (idx < 0) idx = total - 1;
        if (idx >= total) idx = 0;
        photoIndex[key] = idx;
        popoverBody.innerHTML = renderPopoverBody(currentTrip);
        bindCarouselEvents();
      });
    });
    carousel.querySelectorAll('.photo-carousel__dot').forEach((dot) => {
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!currentTrip) return;
        photoIndex[tripKey(currentTrip)] = parseInt(dot.dataset.i, 10);
        popoverBody.innerHTML = renderPopoverBody(currentTrip);
        bindCarouselEvents();
      });
    });
    // 共享照片的删除按钮
    carousel.querySelectorAll('.photo-carousel__delete').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!currentTrip) return;
        const id = btn.dataset.sharedId;
        const url = btn.dataset.sharedUrl || '';
        if (!id) return;
        if (!confirm('删除这张照片？')) return;
        const { error } = await supabase.from('gallery').delete().eq('id', id);
        if (error) { alert('删除失败: ' + error.message); return; }
        // 同步删除 Storage 文件 (失败忽略, 不阻塞)
        if (url && url.includes('/storage/v1/object/public/photos/')) {
          const path = url.split('/storage/v1/object/public/photos/')[1];
          if (path) supabase.storage.from('photos').remove([path]).catch(() => {});
        }
        await loadSharedPhotos();
        const key = tripKey(currentTrip);
        currentTrip.photos = (currentTrip.photos || []).filter((p) => p._sharedId !== id);
        photoIndex[key] = Math.min(photoIndex[key] || 0, Math.max(0, (currentTrip.photos || []).length - 1));
        popoverBody.innerHTML = renderPopoverBody(currentTrip);
        bindCarouselEvents();
      });
    });
  }

  function closePopover() { popover.hidden = true; currentTrip = null; }
  popoverClose && popoverClose.addEventListener('click', closePopover);

  /* ===== 弹窗内按钮 ===== */
  popoverAddPhoto && popoverAddPhoto.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!currentTrip) return;
    openAddPhotoModal(currentTrip);
  });
  popoverDelete && popoverDelete.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!currentTrip) return;
    const trip = currentTrip;
    if (!confirm(`确定要删除「${trip.city}」这个地点吗？`)) return;
    deleteTrip(trip);
  });

  function deleteTrip(trip) {
    const idx = userTrips.indexOf(trip);
    if (idx !== -1) { userTrips.splice(idx, 1); persistUserTrips(); }
    const i = allTrips.indexOf(trip);
    if (i !== -1) allTrips.splice(i, 1);
    const p = pins.find((pp) => pp.trip === trip);
    if (p) { p.el.remove(); const pi = pins.indexOf(p); if (pi !== -1) pins.splice(pi, 1); }
    cityList.querySelectorAll('li').forEach((li) => { if (li.textContent.startsWith(trip.city)) li.remove(); });
    closePopover();
  }

  /* ===== Modal ===== */
  function openAddCityModal() {
    addCityForm.reset();
    if (addCityStatusEl) addCityStatusEl.textContent = '';
    const sb = addCityForm.querySelector('button[type="submit"]');
    if (sb) sb.disabled = false;
    addCityModal.hidden = false;
  }
  function closeAddCityModal() {
    addCityModal.hidden = true;
    if (addCityStatusEl) addCityStatusEl.textContent = '';
    const sb = addCityForm.querySelector('button[type="submit"]');
    if (sb) sb.disabled = false;
  }
  addBtn && addBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); openAddCityModal(); });
  // 浮动 add city 按钮 (手机上没侧栏也能用)
  const floatingAddCity = document.getElementById('floating-add-city');
  floatingAddCity && floatingAddCity.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); openAddCityModal(); });
  addCityClose && addCityClose.addEventListener('click', closeAddCityModal);
  addCityCancel && addCityCancel.addEventListener('click', closeAddCityModal);
  addCityModal && addCityModal.addEventListener('click', (e) => { if (e.target === addCityModal) closeAddCityModal(); });
  addCityForm && addCityForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(addCityForm);
    const city = fd.get('city').trim(), lng = parseFloat(fd.get('lng')), lat = parseFloat(fd.get('lat'));
    const date = fd.get('date').trim() || '';
    const file = fd.get('file');
    const note = (fd.get('note') || '').toString().trim();
    if (!city || isNaN(lng) || isNaN(lat)) { addCityStatusEl.textContent = '请填写城市名和经纬度'; return; }
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) { addCityStatusEl.textContent = '经纬度超出范围'; return; }
    const submitBtn = addCityForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    addCityStatusEl.textContent = '上传中...';
    let coverUrl;
    if (file && file.size) {
      try {
        const result = await uploadImage(file);
        coverUrl = result.url;
        const ratio = result.compressedSize && result.originalSize
          ? ((result.compressedSize / result.originalSize) * 100).toFixed(0)
          : null;
        if (result.via === 'base64') {
          addCityStatusEl.textContent = ratio ? `已压缩 (${ratio}%) · base64 兜底中...` : 'Storage 失败, base64 兜底中...';
        } else {
          addCityStatusEl.textContent = ratio ? `已压缩 (${ratio}%) · 保存中...` : '保存中...';
        }
      } catch (err) {
        addCityStatusEl.textContent = '读取图片失败';
        submitBtn.disabled = false;
        return;
      }
    } else {
      // 留空 → 自动配图
      const seed = encodeURIComponent(city + Math.random().toString(36).slice(2, 6));
      coverUrl = `https://picsum.photos/seed/${seed}/600/400`;
      addCityStatusEl.textContent = '保存中...';
    }
    // 写入 Supabase gallery (city=..., year=..., url=..., note=...) — 这样其他人在地图上选同一个城市时, 第一张能看到这张封面
    const year = (date && date.slice(0, 4)) || String(new Date().getFullYear());
    const { error: insertError } = await supabase
      .from('gallery')
      .insert({ city, year, url: coverUrl, note: note || '' });
    if (insertError) {
      addCityStatusEl.textContent = '保存失败: ' + insertError.message;
      submitBtn.disabled = false;
      return;
    }
    // 本地也要加 pin（不需要 localStorage 持久化，因为 Supabase 是源头）
    const trip = { city, lng, lat, date, photos: [{ url: coverUrl, note }] };
    allTrips.push(trip);
    photoIndex[tripKey(trip)] = 0;
    addPin(trip); addListItem(trip);
    // 重新拉共享照片, 把刚加的封面作为共享照片也合并进来（这样打开弹窗时会显示）
    await loadSharedPhotos();
    applySharedPhotosToTrip(trip);
    addCityStatusEl.textContent = '已保存 ✓';
    submitBtn.disabled = false;
    closeAddCityModal();
  });

  function openAddPhotoModal(trip) {
    addPhotoCityName.textContent = trip.city;
    addPhotoModal.dataset.tripCity = trip.city;
    addPhotoForm.reset();
    if (statusEl) statusEl.textContent = '';
    const sb = addPhotoForm.querySelector('button[type="submit"]');
    if (sb) sb.disabled = false;
    addPhotoModal.hidden = false;
  }
  function closeAddPhotoModal() {
    addPhotoModal.hidden = true;
    if (statusEl) statusEl.textContent = '';
    const sb = addPhotoForm.querySelector('button[type="submit"]');
    if (sb) sb.disabled = false;
  }
  addPhotoClose && addPhotoClose.addEventListener('click', closeAddPhotoModal);
  addPhotoCancel && addPhotoCancel.addEventListener('click', closeAddPhotoModal);
  addPhotoModal && addPhotoModal.addEventListener('click', (e) => { if (e.target === addPhotoModal) closeAddPhotoModal(); });
  addPhotoForm && addPhotoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const cityName = addPhotoModal.dataset.tripCity;
    const trip = allTrips.find((t) => t.city === cityName);
    if (!trip) { closeAddPhotoModal(); return; }
    const fd = new FormData(addPhotoForm);
    const file = fd.get('file');
    const note = (fd.get('note') || '').toString().trim();
    if (!file || !file.size || !note) {
      statusEl.textContent = '请选择图片并填写描述';
      return;
    }
    const submitBtn = addPhotoForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    let photoUrl;
    try {
      const result = await uploadImage(file);
      photoUrl = result.url;
      // 状态文案带压缩率
      if (result.compressedSize && result.originalSize) {
        const ratio = ((result.compressedSize / result.originalSize) * 100).toFixed(0);
        statusEl.textContent = result.via === 'base64'
          ? `已压缩 (${ratio}%) · base64 兜底中...`
          : `已压缩 (${ratio}%) · 保存中...`;
      } else {
        statusEl.textContent = result.via === 'base64' ? 'Storage 失败, 已用 base64 兜底...' : '保存中...';
      }
    } catch (err) {
      statusEl.textContent = '读取图片失败';
      submitBtn.disabled = false;
      return;
    }
    const year = (trip.date && trip.date.slice(0, 4)) || String(new Date().getFullYear());
    const { data: insertData, error: insertError } = await supabase
      .from('gallery')
      .insert({ city: trip.city, year, url: photoUrl, note })
      .select()
      .single();
    if (insertError) {
      statusEl.textContent = '保存失败: ' + insertError.message;
      submitBtn.disabled = false;
      return;
    }

    // 立即可见: 直接 push 到 trip.photos, 重渲染当前 popover
    const newPhoto = {
      id: insertData.id,
      city: trip.city,
      year,
      url: photoUrl,
      note,
      _sharedId: insertData.id
    };
    trip.photos = trip.photos || [];
    trip.photos.push(newPhoto);
    photoIndex[tripKey(trip)] = trip.photos.length - 1;
    popoverBody.innerHTML = renderPopoverBody(trip);
    bindCarouselEvents();
    statusEl.textContent = '已保存 ✓';
    submitBtn.disabled = false;
    closeAddPhotoModal();
    // 后台 refetch, 保持 sharedPhotos 缓存最新 (别人上传时也能合并)
    setTimeout(() => loadSharedPhotos(), 0);
  });

  /* ===== 全局 (仅在 map 路由生效) ===== */
  function isMapRoute() { return document.body.dataset.route === 'map'; }

  document.addEventListener('click', (e) => {
    if (!isMapRoute()) return;
    if (e.target.closest('.popover') || e.target.closest('.city-pin') || e.target.closest('.city-sidebar') || e.target.closest('.modal') || e.target.closest('.popover-host')) return;
    closePopover();
  });

  document.addEventListener('keydown', (e) => {
    if (!isMapRoute()) return;
    if (e.target.matches('input, textarea')) return;
    if (e.key === 'Escape') { closePopover(); closeAddCityModal(); closeAddPhotoModal(); }
    else if (e.key === 'n' || e.key === 'N') openAddCityModal();
    else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !popover.hidden && currentTrip) {
      const total = (currentTrip.photos || []).length;
      if (total > 1) {
        const key = tripKey(currentTrip);
        photoIndex[key] = e.key === 'ArrowLeft'
          ? (photoIndex[key] - 1 + total) % total
          : (photoIndex[key] + 1) % total;
        popoverBody.innerHTML = renderPopoverBody(currentTrip);
        bindCarouselEvents();
      }
    }
  });

  /* ===== 小王子开飞机，沿地图缓慢飞行 ===== */
  const plane = document.querySelector('.prince-plane');
  let planeRafId = null;
  if (plane && mapEl) {
    let angle = 0;
    const mapRect = () => mapEl.getBoundingClientRect();
    function animatePlane() {
      const r = mapRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const pw = plane.offsetWidth;
      const ph = plane.offsetHeight;
      const rx = r.width / 2 + pw * 0.4;
      const ry = r.height / 2 + ph * 0.4;
      angle += 0.0015;
      const x = cx + rx * Math.cos(angle) - pw / 2;
      const y = cy + ry * Math.sin(angle) - ph / 2;
      plane.style.left = x + 'px';
      plane.style.top = y + 'px';
      plane.style.transform = `rotate(${angle * 180 / Math.PI + 90}deg)`;
      planeRafId = requestAnimationFrame(animatePlane);
    }
  }
  function startPlane() { if (plane && planeRafId === null) planeRafId = requestAnimationFrame(animatePlane); }
  function stopPlane() { if (planeRafId !== null) { cancelAnimationFrame(planeRafId); planeRafId = null; } }

  /* ===== 公开 API (router 调用) ===== */
  window.MapPage = {
    init() {
      // 重置: 清掉旧 pins 和 SVG layers
      const gCont = document.getElementById('continents');
      const gGrid = document.getElementById('graticule');
      if (gCont) gCont.innerHTML = '';
      if (gGrid) gGrid.innerHTML = '';
      const cl = document.getElementById('city-list');
      if (cl) cl.innerHTML = '';
      const pinsHost = document.getElementById('city-pins');
      if (pinsHost) pinsHost.innerHTML = '';
      allTrips = [];
      userTrips = [];
      photoIndex = {};
      currentTrip = null;
      // 显示浮动 add city 按钮
      const fab = document.getElementById('floating-add-city');
      if (fab) fab.hidden = false;
      // 加载世界地图 + 数据 + 飞机
      loadWorld();
      Promise.all([loadTrips(), loadSharedPhotos()]).then(([trips]) => {
        trips.forEach((trip) => { addPin(trip); addListItem(trip); });
        allTrips.forEach(applySharedPhotosToTrip);
      });
      startPlane();
    },
    teardown() {
      stopPlane();
      // 关闭 popover 和 modals
      if (popover) popover.hidden = true;
      if (addCityModal) addCityModal.hidden = true;
      if (addPhotoModal) addPhotoModal.hidden = true;
      currentTrip = null;
      // 隐藏浮动 add city
      const fab = document.getElementById('floating-add-city');
      if (fab) fab.hidden = true;
    }
  };
})();