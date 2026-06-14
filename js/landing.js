/* ============================================================
   Landing 页逻辑
   - 进度条从 0% 跑到 100%
   - 小男孩小女孩手拉手随进度前进
   - ENTER → about.html
   - OR?   → map.html
   ============================================================ */

(function () {
  const bar = document.getElementById('progress-bar');
  const percent = document.getElementById('percent');
  const enterBtn = document.getElementById('enter-btn');
  const orBtn = document.getElementById('or-btn');
  const couple = document.getElementById('couple');
  const track = couple && couple.parentElement; // .pixel-people__track

  if (!bar) return;

  let p = 0;
  let started = false;

  function start() {
    if (started) return;
    started = true;
    couple && couple.classList.add('walking');

    const interval = setInterval(() => {
      p += Math.random() * 6 + 2;
      if (p >= 100) {
        p = 100;
        clearInterval(interval);
        couple && couple.classList.remove('walking');
        // 加载完成，小人到达终点
        [enterBtn, orBtn].forEach((b) => b && b.classList.add('is-ready'));
      }
      bar.style.width = p + '%';
      percent.textContent = Math.floor(p) + '%';

      // 移动小人：根据进度位置
      if (track && couple) {
        const max = track.clientWidth - couple.offsetWidth;
        const x = Math.max(0, Math.min(max, (p / 100) * max));
        couple.style.transform = `translateX(${x}px)`;
      }
    }, 120);
  }

  // 等字体加载完（影响轨道宽度）再启动
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(start);
  } else {
    setTimeout(start, 200);
  }

  // 即使按钮没出现也能点（防止 progress 卡住）
  setTimeout(start, 800);

  enterBtn && enterBtn.addEventListener('click', () => {
    document.body.style.transition = 'opacity 0.5s';
    document.body.style.opacity = '0';
    setTimeout(() => location.href = 'about.html', 480);
  });

  orBtn && orBtn.addEventListener('click', () => {
    document.body.style.transition = 'opacity 0.5s';
    document.body.style.opacity = '0';
    setTimeout(() => location.href = 'map.html', 480);
  });
})();