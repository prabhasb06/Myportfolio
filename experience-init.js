// Decide before paint; the portfolio stays usable if enhancement never loads.
(() => {
  const root = document.documentElement;
  try {
    const home = /\/(?:index\.html)?$/.test(location.pathname);
    const refreshing = performance.getEntriesByType('navigation')[0]?.type === 'reload';
    // Refresh always replays the entrance, including from a section anchor.
    if (!home || (location.hash && !refreshing)) return;
    root.dataset.entry = 'booting';
    window.setTimeout(() => {
      if (root.dataset.entry !== 'booting') return;
      root.dataset.entry = 'entered';
      window.dispatchEvent(new Event('portfolio:enter'));
    }, 5000);
  } catch { /* Enhancement unavailable: go straight to the portfolio. */ }
})();
