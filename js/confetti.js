/* ============================================================
   飘落 Emoji / 符号粒子
   - 在画布上持续生成缓慢下落的装饰元素
   - 点击页面任何位置追加一次「弹跳 +1 Emoji」
   ============================================================ */

(function () {
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let W = (canvas.width = window.innerWidth);
  let H = (canvas.height = window.innerHeight);

  window.addEventListener('resize', () => {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  });

  const EMOJIS = ['🦋', '✿', '♡', '★', '✦', '❀', '🌸', '☁️', '🌷'];

  class Particle {
    constructor(opts = {}) {
      this.x = opts.x ?? Math.random() * W;
      this.y = opts.y ?? -20;
      this.size = opts.size ?? 14 + Math.random() * 14;
      this.speedY = opts.speedY ?? 0.4 + Math.random() * 0.9;
      this.speedX = (Math.random() - 0.5) * 0.6;
      this.rot = Math.random() * Math.PI * 2;
      this.rotSpeed = (Math.random() - 0.5) * 0.03;
      this.opacity = opts.opacity ?? 0.4 + Math.random() * 0.4;
      this.char = opts.char ?? EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
      this.color = opts.color;
    }
    update() {
      this.y += this.speedY;
      this.x += this.speedX;
      this.rot += this.rotSpeed;
      // 飘到屏幕下方就重置到顶部
      if (this.y > H + 20) {
        this.y = -20;
        this.x = Math.random() * W;
      }
    }
    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rot);
      ctx.globalAlpha = this.opacity;
      ctx.font = `${this.size}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // 软阴影
      ctx.shadowColor = 'rgba(179, 153, 255, 0.5)';
      ctx.shadowBlur = 8;
      ctx.fillText(this.char, 0, 0);
      ctx.restore();
    }
  }

  const particles = [];
  const COUNT = 28;

  for (let i = 0; i < COUNT; i++) {
    particles.push(new Particle({ y: Math.random() * H }));
  }

  function loop() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach((p) => { p.update(); p.draw(ctx); });
    requestAnimationFrame(loop);
  }
  loop();

  // 点击弹跳 emoji（+1 效果）
  document.addEventListener('click', (e) => {
    // 不要在按钮/链接上触发（避免和按钮反馈冲突）
    if (e.target.closest('a, button')) return;
    const el = document.createElement('div');
    el.className = 'pop-emoji';
    el.textContent = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
    el.style.left = e.clientX + 'px';
    el.style.top = (e.clientY - 10) + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1200);
  });
})();