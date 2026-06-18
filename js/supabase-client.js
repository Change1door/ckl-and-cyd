/* ============================================================
   共享 Supabase client
   - 在 shell 加载一次, 暴露 window.__sb
   - about / map 共享同一个 client
   ============================================================ */
(function () {
  if (window.__sb) return;
  if (typeof window.supabase === 'undefined') {
    console.warn('Supabase SDK not loaded');
    return;
  }
  window.__sb = window.supabase.createClient(
    'https://nnjzxuuzbzvgchjrnwpr.supabase.co',
    'sb_publishable_sSFlXrMxGaUyyBksp7sDuA_s9GU5BIi'
  );
})();
