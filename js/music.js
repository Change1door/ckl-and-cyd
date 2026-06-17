/* ============================================================
   复古音乐播放器
   - 默认无歌；点右下角 ▶ 弹文件选择，选本地 mp3 后自动播放
   - 选过的歌曲存到 localStorage（作为 DataURL，跨设备不共享）
   - 控制台清空歌曲：localStorage.removeItem('bgm')
   ============================================================ */

(function () {
  const btn = document.getElementById('music-toggle');
  const nameEl = document.getElementById('music-name');
  const audio = document.getElementById('bgm');
  if (!btn || !audio) return;

  const STORAGE_KEY = 'bgm';

  function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function loadConfig() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); }
    catch { return null; }
  }

  function saveConfig(cfg) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); } catch {}
  }

  // 启动时加载上次选的歌
  const cfg = loadConfig();
  if (cfg && cfg.src) {
    audio.src = cfg.src;
    if (nameEl) nameEl.textContent = cfg.name || '— ready —';
    btn.textContent = '▶';
  } else {
    if (nameEl) nameEl.textContent = '— pick a song —';
    btn.textContent = '♪';
  }

  let playing = false;
  let fileInput = null;

  // 点按钮: 没歌 → 弹文件选择; 有歌 → 播放/暂停
  btn.addEventListener('click', async () => {
    const cur = loadConfig();
    if (!cur || !cur.src) {
      // 第一次：选文件
      if (!fileInput) {
        fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'audio/*';
        fileInput.style.display = 'none';
        fileInput.addEventListener('change', async (e) => {
          const file = e.target.files && e.target.files[0];
          if (!file) return;
          if (nameEl) nameEl.textContent = '加载中...';
          try {
            const dataUrl = await fileToDataURL(file);
            saveConfig({ src: dataUrl, name: file.name });
            audio.src = dataUrl;
            await audio.play();
            playing = true;
            btn.textContent = '❚❚';
            if (nameEl) nameEl.textContent = file.name;
          } catch (err) {
            if (nameEl) nameEl.textContent = '加载失败: ' + (err && err.message || '');
          }
        });
        document.body.appendChild(fileInput);
      }
      fileInput.value = '';
      fileInput.click();
      return;
    }
    // 有歌: 播放/暂停
    try {
      if (!playing) {
        await audio.play();
        playing = true;
        btn.textContent = '❚❚';
      } else {
        audio.pause();
        playing = false;
        btn.textContent = '▶';
      }
    } catch (e) {
      if (nameEl) nameEl.textContent = '— click again —';
      console.warn('BGM play failed:', e);
    }
  });

  audio.addEventListener('ended', () => { playing = false; btn.textContent = '▶'; });
  audio.addEventListener('pause', () => { playing = false; btn.textContent = '▶'; });
  audio.addEventListener('play', () => { playing = true; btn.textContent = '❚❚'; });
})();
