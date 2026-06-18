/* ============================================================
   about 页逻辑 (SPA 模式)
   - 共享照片墙 (Supabase gallery 表 + Storage photos bucket, base64 兜底)
   - 共享计划/已完成 (Supabase todos 表)
   - 暴露 window.AboutPage.init() / teardown()
   ============================================================ */

(function () {
  let gallery, planList, doneList, planInput, planAddBtn;
  let photoModal, photoModalClose, photoModalCancel, photoForm, statusEl;
  let todosCache = [];
  let bound = false;

  const supabase = window.__sb;
  if (!supabase) console.warn('about.js: window.__sb not available');

  const SEED_TODOS = [
    { text: '去冰岛看极光', done: false },
    { text: '坐一次横跨西伯利亚的火车', done: false },
    { text: '在清迈学做泰国菜', done: false },
    { text: '在巴塞罗那海边看日出', done: true },
  ];

  function bindDom() {
    gallery = document.getElementById('gallery');
    planList = document.getElementById('plan-list');
    doneList = document.getElementById('done-list');
    planInput = document.getElementById('plan-input');
    planAddBtn = document.getElementById('plan-add-btn');
    photoModal = document.getElementById('add-photo-modal');
    photoModalClose = document.getElementById('add-photo-close');
    photoModalCancel = document.getElementById('add-photo-cancel');
    photoForm = document.getElementById('add-photo-form');
    statusEl = document.getElementById('gallery-upload-status');
  }

  function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /* ===== Photos ===== */
  async function loadPhotos() {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('gallery')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { console.error('loadPhotos error:', error); renderGallery([]); return; }
    renderGallery(data || []);
  }

  function renderGallery(photos) {
    if (!gallery) return;
    gallery.innerHTML = '';
    photos.forEach((p) => {
      const fig = document.createElement('figure');
      fig.className = 'gallery-item';
      const url = p.url || p.photo_url;
      fig.innerHTML = `
        <button class="gallery-delete" data-id="${p.id}" data-url="${url}" title="删除">×</button>
        <img src="${url}" alt="${p.city || ''}" loading="lazy">
        <div class="gallery-caption">${p.city || '?'} · ${p.year || '?'}</div>
      `;
      gallery.appendChild(fig);
    });
    const add = document.createElement('figure');
    add.className = 'gallery-item gallery-add';
    add.id = 'gallery-add';
    gallery.appendChild(add);
    bindGallery();
  }

  function bindGallery() {
    if (!gallery) return;
    gallery.querySelectorAll('.gallery-delete').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const url = btn.dataset.url || '';
        if (!confirm('删除这张照片？')) return;
        const { error } = await supabase.from('gallery').delete().eq('id', id);
        if (error) { alert('删除失败: ' + error.message); return; }
        if (url && url.includes('/storage/v1/object/public/photos/')) {
          const path = url.split('/storage/v1/object/public/photos/')[1];
          if (path) supabase.storage.from('photos').remove([path]).catch(() => {});
        }
        await loadPhotos();
      });
    });
  }

  function openPhotoModal() {
    if (!photoModal) return;
    photoModal.hidden = false;
    if (photoForm) photoForm.reset();
    if (statusEl) statusEl.textContent = '';
  }
  function closePhotoModal() { if (photoModal) photoModal.hidden = true; }

  async function handlePhotoSubmit(e) {
    e.preventDefault();
    if (!supabase) return;
    const fd = new FormData(photoForm);
    const city = fd.get('city').trim();
    const year = fd.get('year').toString().trim();
    const file = fd.get('file');
    if (!city || !year) { alert('请填写城市和年份'); return; }

    let photoUrl = null;
    if (file && file.size) {
      statusEl.textContent = '上传中...';
      const safeName = (file.name || 'photo').replace(/[^\w.\-]+/g, '_').slice(0, 60);
      const filePath = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(filePath, file, { contentType: file.type || 'image/jpeg', upsert: false });
      if (uploadError) {
        console.warn('storage upload failed, fallback to base64:', uploadError);
        statusEl.textContent = 'Storage 上传失败，改用 base64 兜底...';
        try { photoUrl = await fileToDataURL(file); }
        catch (e2) { statusEl.textContent = '读取图片失败: ' + (e2.message || e2); return; }
      } else {
        const { data: urlData } = supabase.storage.from('photos').getPublicUrl(filePath);
        photoUrl = urlData.publicUrl;
      }
    } else {
      const seed = encodeURIComponent(city + year + Math.random().toString(36).slice(2, 6));
      photoUrl = `https://picsum.photos/seed/${seed}/400/300`;
    }

    statusEl.textContent = '保存中...';
    const { error: insertError } = await supabase
      .from('gallery')
      .insert({ city, year, url: photoUrl, note: null });
    if (insertError) { statusEl.textContent = '保存失败: ' + insertError.message; return; }

    statusEl.textContent = '已保存 ✓';
    await loadPhotos();
    closePhotoModal();
  }

  /* ===== Todos ===== */
  async function loadTodos() {
    if (!supabase) return;
    try {
      const { data, error } = await supabase.from('todos').select('*').order('created_at', { ascending: true });
      if (error) { console.warn('loadTodos error:', error); todosCache = []; }
      else todosCache = data || [];
      if (todosCache.length === 0) {
        const { error: seedErr } = await supabase.from('todos').insert(SEED_TODOS);
        if (!seedErr) todosCache = SEED_TODOS.map((t) => ({ id: 'seed-' + t.text, ...t }));
      }
    } catch (e) { console.warn('loadTodos failed:', e); todosCache = []; }
  }

  async function renderTodos() {
    await loadTodos();
    if (!planList || !doneList) return;
    const plans = todosCache.filter((t) => !t.done);
    const done = todosCache.filter((t) => t.done);
    planList.innerHTML = '';
    doneList.innerHTML = '';
    plans.forEach((item) => planList.appendChild(createTodoItem(item, false)));
    done.forEach((item) => doneList.appendChild(createTodoItem(item, true)));
  }

  function createTodoItem(item, isCompleted) {
    const li = document.createElement('li');
    li.className = 'todo-item appear';
    li.dataset.id = item.id;
    const check = document.createElement('button');
    check.className = 'todo-check';
    check.setAttribute('type', 'button');
    check.innerHTML = `
      <svg viewBox="0 0 24 22" xmlns="http://www.w3.org/2000/svg">
        <path class="heart-outline" d="M12 20.5S1.5 14 1.5 7.5C1.5 4.5 4 2 7 2c2 0 3.5 1 5 3 1.5-2 3-3 5-3 3 0 5.5 2.5 5.5 5.5 0 6.5-10.5 13-10.5 13z"/>
        <path class="check-mark" d="M7 11l3 3 7-7"/>
      </svg>`;
    check.addEventListener('click', () => toggleTodo(item.id));
    const span = document.createElement('span');
    span.className = 'todo-text';
    span.textContent = item.text;
    const del = document.createElement('button');
    del.className = 'todo-delete';
    del.textContent = '×';
    del.setAttribute('type', 'button');
    del.addEventListener('click', () => deleteTodo(item.id));
    if (item.done) li.classList.add('done');
    li.appendChild(check);
    li.appendChild(span);
    li.appendChild(del);
    return li;
  }

  async function toggleTodo(id) {
    const li = planList && planList.querySelector(`[data-id="${id}"]`);
    if (li) {
      li.classList.add('done');
      setTimeout(() => { li.classList.add('flying'); setTimeout(() => renderTodos(), 500); }, 600);
    }
    const { error } = await supabase.from('todos').update({ done: true }).eq('id', id);
    if (error) { console.warn('toggleTodo error:', error); renderTodos(); }
  }

  async function deleteTodo(id) {
    const item = todosCache.find((x) => x.id === id);
    if (!item) return;
    if (!confirm(`删除「${item.text}」？`)) return;
    const el = document.querySelector(`[data-id="${id}"]`);
    if (el) el.remove();
    const { error } = await supabase.from('todos').delete().eq('id', id);
    if (error) { console.warn('deleteTodo error:', error); renderTodos(); }
    else todosCache = todosCache.filter((t) => t.id !== id);
  }

  async function addPlan() {
    const text = planInput.value.trim();
    if (!text) return;
    planInput.value = '';
    const { data, error } = await supabase.from('todos').insert({ text, done: false }).select();
    if (error) { console.warn('addPlan error:', error); planInput.value = text; return; }
    if (data && data[0]) {
      todosCache.push(data[0]);
      planList.appendChild(createTodoItem(data[0], false));
    }
  }

  function bindEventsOnce() {
    if (bound) return;
    bound = true;
    photoModalClose && photoModalClose.addEventListener('click', closePhotoModal);
    photoModalCancel && photoModalCancel.addEventListener('click', closePhotoModal);
    photoModal && photoModal.addEventListener('click', (e) => { if (e.target === photoModal) closePhotoModal(); });
    photoForm && photoForm.addEventListener('submit', handlePhotoSubmit);
    planAddBtn && planAddBtn.addEventListener('click', addPlan);
    planInput && planInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addPlan(); });
    // 浮动 add photo 按钮 (about 路由 init 时显示, teardown 时隐藏)
    const floatingAdd = document.getElementById('floating-add-photo');
    floatingAdd && floatingAdd.addEventListener('click', openPhotoModal);
    // 照片墙里的 + 号 (动态创建在 #gallery 末尾)
    document.addEventListener('click', (e) => {
      if (e.target && e.target.id === 'gallery-add') {
        e.preventDefault(); e.stopPropagation();
        openPhotoModal();
      }
    });
  }

  window.AboutPage = {
    init() {
      bindDom();
      bindEventsOnce();
      // 显示浮动按钮
      const fab = document.getElementById('floating-add-photo');
      if (fab) fab.hidden = false;
      // 重新拉数据
      renderTodos();
      loadPhotos();
    },
    teardown() {
      // 关闭 modal + 隐藏浮动按钮
      closePhotoModal();
      const fab = document.getElementById('floating-add-photo');
      if (fab) fab.hidden = true;
    }
  };
})();
