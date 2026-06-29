/* ============================================================
   SPA 路由 (hash-based, 无 pushState, 兼容 GitHub Pages)
   - 路由表: home / about / map
   - 每个路由有 title / nav / init / teardown
   - 全局拦截 <a href="#xxx"> 防止页面重载
   - 启动: DOMContentLoaded 时设默认 hash + 调初始路由
   ============================================================ */

(function () {
  const ROUTES = {
    home: {
      title: '♡ Travel Diary',
      nav: [{ href: '#about', label: 'about' }, { href: '#map', label: 'map' }],
      page: 'LandingPage'
    },
    about: {
      title: '♡ Our Story Begins',
      nav: [{ href: '#home', label: 'home' }, { href: '#map', label: 'map' }],
      page: 'AboutPage'
    },
    map: {
      title: '♡ Travel Map',
      nav: [{ href: '#home', label: 'home' }, { href: '#about', label: 'about' }],
      page: 'MapPage'
    }
  };
  const DEFAULT_ROUTE = 'home';
  let current = null;

  function parseHash() {
    const h = (location.hash || '').replace(/^#/, '').toLowerCase();
    return ROUTES[h] ? h : DEFAULT_ROUTE;
  }

  function applyHeader(routeId) {
    const cfg = ROUTES[routeId];
    const titleEl = document.getElementById('app-header-title');
    const navEl = document.getElementById('app-header-nav');
    if (titleEl) titleEl.textContent = cfg.title;
    if (navEl) navEl.innerHTML = cfg.nav.map(l => `<a href="${l.href}">${l.label}</a>`).join('');
    const header = document.getElementById('app-header');
    if (header) header.hidden = (routeId === 'home');
  }

  function showFloatingButtons(routeId) {
    const cityBtn = document.getElementById('floating-add-city');
    const photoBtn = document.getElementById('floating-add-photo');
    if (cityBtn) {
      cityBtn.hidden = (routeId !== 'map');
      cityBtn.style.display = (routeId === 'map') ? 'inline-flex' : 'none';
    }
    if (photoBtn) {
      photoBtn.hidden = (routeId !== 'about');
      photoBtn.style.display = (routeId === 'about') ? 'inline-flex' : 'none';
    }
    console.log('[router] showFloatingButtons', routeId, 'city:', cityBtn && cityBtn.style.display, 'photo:', photoBtn && photoBtn.style.display);
  }

  function setRoute(routeId) {
    if (routeId === current && window[ROUTES[routeId].page] && window[ROUTES[routeId].page].__initialized) {
      return;
    }
    // 暴力兜底: 路由切换时, 强制关闭所有 modal 和 popover (inline style, 不靠 [hidden] 属性)
    document.querySelectorAll('.modal').forEach(el => {
      el.hidden = true;
      el.style.display = 'none';
    });
    const popover = document.getElementById('popover');
    if (popover) {
      popover.hidden = true;
      popover.style.display = 'none';
    }
    // teardown old (only if it was actually initialized)
    if (current && ROUTES[current] && window[ROUTES[current].page] && window[ROUTES[current].page].__initialized) {
      const oldMod = window[ROUTES[current].page];
      if (typeof oldMod.teardown === 'function') {
        try { oldMod.teardown(); } catch (e) { console.warn('teardown error:', e); }
      }
      oldMod.__initialized = false;
    }
    // swap visible section
    document.querySelectorAll('main#app-main > .route').forEach(sec => {
      sec.hidden = (sec.dataset.route !== routeId);
    });
    document.body.dataset.route = routeId;
    applyHeader(routeId);
    showFloatingButtons(routeId);
    // init new (with retry: if page module not loaded yet, wait one tick)
    function tryInit(attempt) {
      const newMod = window[ROUTES[routeId].page];
      if (newMod && typeof newMod.init === 'function') {
        try {
          newMod.init();
          newMod.__initialized = true;
        } catch (e) {
          // 显示完整错误 (含 stack trace, 不只是 e.message)
          console.error('[router] ' + ROUTES[routeId].page + '.init() threw:', e);
          console.error('[router] stack:', e.stack);
        }
        current = routeId;
      } else if (attempt < 50) {
        setTimeout(() => tryInit(attempt + 1), 10);
      } else {
        console.error('Page module not loaded after 500ms:', ROUTES[routeId].page);
        current = routeId;
      }
    }
    tryInit(0);
  }

  // 全局拦截 <a href="#xxx">
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    const target = a.getAttribute('href').slice(1).toLowerCase();
    if (ROUTES[target]) {
      e.preventDefault();
      if (location.hash !== '#' + target) location.hash = '#' + target;
      else setRoute(target);
    }
  });

  window.addEventListener('hashchange', () => setRoute(parseHash()));

  // 启动
  document.addEventListener('DOMContentLoaded', () => {
    if (!location.hash) location.hash = '#' + DEFAULT_ROUTE;
    else setRoute(parseHash());
  });
})();
