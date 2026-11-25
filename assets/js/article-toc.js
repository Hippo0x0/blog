(() => {
  const setup = () => {
    const nav = document.getElementById('toc');
    if (!nav) return;
    const resetAtTop = () => {
      if (window.matchMedia('(min-width: 1200px)').matches && window.scrollY < 100) nav.scrollTop = 0;
    };
    new MutationObserver(resetAtTop).observe(nav, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    window.addEventListener('load', resetAtTop, { once: true });
    window.addEventListener('scroll', resetAtTop, { passive: true });
    resetAtTop();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup, { once: true });
  else setup();
})();
