/* ============================================================
   复古音乐播放器
   - 默认读取 localStorage 中的歌曲配置（用户后续可在控制台设置）
   - 控制台设置方法：
       localStorage.setItem('bgm', JSON.stringify({ src: '你的mp3地址', name: '歌名 - 艺人' }))
   ============================================================ */

(function () {
  const btn = document.getElementById('music-toggle');
  const nameEl = document.getElementById('music-name');
  const audio = document.getElementById('bgm');
  if (!btn || !audio) return;

  // 默认示例：可换成你自己的 mp3 URL 或 assets/audio/xxx.mp3
  const DEFAULT = {
    src: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_4cb1c7c9c7.mp3?filename=lofi-cozy-night-11041.mp3',
    name: 'lofi · cozy night',
  };

  function loadConfig() {
    try {
      const saved = JSON.parse(localStorage.getItem('bgm') || 'null');
      return saved || DEFAULT;
    } catch {
      return DEFAULT;
    }
  }

  const cfg = loadConfig();
  audio.src = cfg.src;
  nameEl.textContent = cfg.name;

  let playing = false;
  btn.addEventListener('click', async () => {
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
      // 自动播放被浏览器拦截时，给出友好提示
      nameEl.textContent = '— click again —';
      console.warn('BGM play failed:', e);
    }
  });

  audio.addEventListener('ended', () => { playing = false; btn.textContent = '▶'; });
})();