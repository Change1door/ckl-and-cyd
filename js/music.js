/* ============================================================
   复古音乐播放器 (SPA 模式: 跨页不中断)
   - 3 首歌硬编码 (Supabase Storage 公开 URL), 所有访问者共享
   - 上一首 / 播放暂停 / 下一首
   - 选曲索引 + 播放状态存 localStorage
   - 切歌时保持播放状态
   - 跨 hash 路由切换不重新初始化 (幂等)
   ============================================================ */

(function () {
  if (window.__musicInited) return;
  window.__musicInited = true;

  const prevBtn = document.getElementById('music-prev');
  const toggleBtn = document.getElementById('music-toggle');
  const nextBtn = document.getElementById('music-next');
  const nameEl = document.getElementById('music-name');
  const audio = document.getElementById('bgm');
  if (!toggleBtn || !audio) return;

  // 歌单 (3 首, 顺序可调)
  const PLAYLIST = [
    { name: '春潮 · bo peep / 抛海 / 發條', src: 'https://nnjzxuuzbzvgchjrnwpr.supabase.co/storage/v1/object/public/audio/chun-chao.mp3' },
    { name: '星期天逛公园 · ERIOE / 卫彬月', src: 'https://nnjzxuuzbzvgchjrnwpr.supabase.co/storage/v1/object/public/audio/xing-qi-tian.mp3' },
    { name: '我想 我们应该坐在一起发呆 · bo peep', src: 'https://nnjzxuuzbzvgchjrnwpr.supabase.co/storage/v1/object/public/audio/fa-dai.mp3' },
  ];

  const IDX_KEY = 'bgm-idx-v1';
  const PLAY_KEY = 'bgm-playing-v1';

  function loadIndex() {
    const v = parseInt(localStorage.getItem(IDX_KEY) || '0', 10);
    return isNaN(v) || v < 0 || v >= PLAYLIST.length ? 0 : v;
  }
  function saveIndex(i) { localStorage.setItem(IDX_KEY, String(i)); }
  function loadWasPlaying() { return localStorage.getItem(PLAY_KEY) === '1'; }
  function saveWasPlaying(p) { localStorage.setItem(PLAY_KEY, p ? '1' : '0'); }

  let idx = loadIndex();
  let playing = false;

  function paint() {
    const track = PLAYLIST[idx];
    if (nameEl) nameEl.textContent = track.name;
    audio.src = track.src;
    audio.load();
  }

  function updateToggleBtn() {
    toggleBtn.textContent = playing ? '❚❚' : '▶';
  }

  async function play() {
    try {
      await audio.play();
      playing = true;
      updateToggleBtn();
      saveWasPlaying(true);
    } catch (e) {
      // 浏览器拦截自动播放 (例如 iOS Safari 严格策略) - 等用户再次点击
      playing = false;
      updateToggleBtn();
      saveWasPlaying(false);
      if (nameEl) nameEl.textContent = '— click ▶ to start —';
    }
  }
  function pause() {
    audio.pause();
    playing = false;
    updateToggleBtn();
    saveWasPlaying(false);
  }

  // 切歌: 保留当前播放状态
  async function selectIndex(newIdx) {
    if (newIdx < 0) newIdx = PLAYLIST.length - 1;
    if (newIdx >= PLAYLIST.length) newIdx = 0;
    idx = newIdx;
    saveIndex(idx);
    const wasPlaying = playing;
    paint();
    if (wasPlaying) await play();
  }

  // 初始化
  paint();
  updateToggleBtn();

  // 事件
  toggleBtn.addEventListener('click', () => { playing ? pause() : play(); });
  prevBtn && prevBtn.addEventListener('click', () => selectIndex(idx - 1));
  nextBtn && nextBtn.addEventListener('click', () => selectIndex(idx + 1));

  audio.addEventListener('ended', () => {
    // 单曲循环 + 自动播下一首 (但 audio.loop 已设, ended 只在 loop=false 时触发; 兜底)
    selectIndex(idx + 1);
    play();
  });
  audio.addEventListener('play', () => { playing = true; updateToggleBtn(); saveWasPlaying(true); });
  audio.addEventListener('pause', () => { playing = false; updateToggleBtn(); saveWasPlaying(false); });
})();
