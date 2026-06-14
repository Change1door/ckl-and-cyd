/* ============================================================
   流星光标 + 拖尾粒子
   - 跟随鼠标的粉色光晕
   - 每次 mousemove 在尾部随机甩出星星/蝴蝶
   ============================================================ */

(function () {
  const cursor = document.getElementById('cursor');
  if (!cursor) return;

  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let cursorX = mouseX;
  let cursorY = mouseY;

  const EMOJIS = ['✦', '✧', '⋆', '♡', '⭐', '🦋'];

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;

    // 1/6 概率甩出一颗星星
    if (Math.random() < 0.18) spawnStar(mouseX, mouseY);
  });

  document.addEventListener('mousedown', (e) => {
    // 点击时弹跳 emoji
    for (let i = 0; i < 4; i++) {
      setTimeout(() => spawnStar(e.clientX + (Math.random() - 0.5) * 30,
                                e.clientY + (Math.random() - 0.5) * 30), i * 60);
    }
  });

  function spawnStar(x, y) {
    const el = document.createElement('div');
    el.className = 'cursor-star';
    el.textContent = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.color = `hsl(${Math.random() * 60 + 280}, 70%, 70%)`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }

  function tick() {
    // 弹簧跟随（带轻微延迟，模拟拖尾）
    cursorX += (mouseX - cursorX) * 0.25;
    cursorY += (mouseY - cursorY) * 0.25;
    cursor.style.left = cursorX + 'px';
    cursor.style.top = cursorY + 'px';
    requestAnimationFrame(tick);
  }
  tick();

  // 隐藏原生光标（在可交互元素上）
  document.querySelectorAll('a, button, .retro-btn').forEach((el) => {
    el.addEventListener('mouseenter', () => cursor.style.opacity = '0.4');
    el.addEventListener('mouseleave', () => cursor.style.opacity = '1');
  });
})();