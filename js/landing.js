/* ============================================================
   Landing 页逻辑 (SPA 模式)
   - 进度条从 0% 跑到 100%
   - 小男孩小女孩手拉手随进度前进
   - ENTER → #about (hash 路由, 不重载页面, 音乐不中断)
   - OR?   → #map
   - 暴露 window.LandingPage.init() 供 router 调用
   ============================================================ */

(function () {
  let p = 0;
  let started = false;
  let bar, percent, enterBtn, orBtn, couple, track;

  function bindDom() {
    bar = document.getElementById('progress-bar');
    percent = document.getElementById('percent');
    enterBtn = document.getElementById('enter-btn');
    orBtn = document.getElementById('or-btn');
    couple = document.getElementById('couple');
    track = couple && couple.parentElement;
  }

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
        [enterBtn, orBtn].forEach((b) => b && b.classList.add('is-ready'));
      }
      bar.style.width = p + '%';
      percent.textContent = Math.floor(p) + '%';

      if (track && couple) {
        const max = track.clientWidth - couple.offsetWidth;
        const x = Math.max(0, Math.min(max, (p / 100) * max));
        couple.style.transform = `translateX(${x}px)`;
      }
    }, 120);
  }

  function go(hash) {
    document.body.style.transition = 'opacity 0.5s';
    document.body.style.opacity = '0';
    setTimeout(() => { location.hash = hash; }, 480);
  }

  // 公开 API: router 调用 init() 切回 home 时触发
  window.LandingPage = {
    init() {
      bindDom();
      if (!bar) return;
      // 重置进度
      p = 0;
      started = false;
      bar.style.width = '0%';
      percent.textContent = '0%';
      couple && couple.classList.remove('walking');
      couple && (couple.style.transform = 'translateX(0)');
      [enterBtn, orBtn].forEach((b) => b && b.classList.remove('is-ready'));
      document.body.style.opacity = '1';
      document.body.style.transition = '';

      // 重绑事件 (idempotent: 简单用 onclick 替换, 避免重复 bind)
      enterBtn && (enterBtn.onclick = () => go('#about'));
      orBtn && (orBtn.onclick = () => go('#map'));

      // 启动动画
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(start);
      } else {
        setTimeout(start, 200);
      }
      setTimeout(start, 800);
    }
  };
})();
