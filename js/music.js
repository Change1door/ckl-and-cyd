/* ============================================================
   复古音乐播放器
   - 3 首歌硬编码 (Supabase Storage 公开 URL), 所有访问者共享
   - 上一首 / 播放暂停 / 下一首
   - 当前选曲索引存 localStorage, 下次打开恢复
   - 切换歌时保持播放状态 (正在播 → 切完继续播)
   ============================================================ */

(function () {
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

  function loadIndex() {
    const v = parseInt(localStorage.getItem(IDX_KEY) || '0', 10);
    return isNaN(v) || v < 0 || v >= PLAYLIST.length ? 0 : v;
  }
  function saveIndex(i) { localStorage.setItem(IDX_KEY, String(i)); }

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
    } catch (e) {
      // 浏览器拦截自动播放 (例如 iOS Safari 严格策略) - 等用户再次点击
      playing = false;
      updateToggleBtn();
      if (nameEl) nameEl.textContent = '— click ▶ to start —';
    }
  }
  function pause() {
    audio.pause();
    playing = false;
    updateToggleBtn();
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
  audio.addEventListener('play', () => { playing = true; updateToggleBtn(); });
  audio.addEventListener('pause', () => { playing = false; updateToggleBtn(); });
})();
