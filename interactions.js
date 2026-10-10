// Shared mouse, keyboard, and touch feedback, without a permanent animation loop.
(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const surfaces = document.querySelectorAll('.project-card,.roadmap__item--link,.approach__principle,.preview-console__visual');
  const bounds = new WeakMap();
  const pending = new Map();
  let frame = 0;
  const paint = () => {
    frame = 0;
    for (const [surface, point] of pending) {
      surface.style.setProperty('--touch-x', `${point.x}%`);
      surface.style.setProperty('--touch-y', `${point.y}%`);
    }
    pending.clear();
  };
  const update = (surface, event) => {
    const cached = bounds.get(surface);
    if (!cached) return;
    const box = cached.rect;
    const left = box.left + cached.scrollX - window.scrollX;
    const top = box.top + cached.scrollY - window.scrollY;
    pending.set(surface, {
      x: Math.max(0, Math.min(100, (event.clientX - left) / box.width * 100)),
      y: Math.max(0, Math.min(100, (event.clientY - top) / box.height * 100))
    });
    if (!frame) frame = requestAnimationFrame(paint);
  };
  const timers = new WeakMap();
  for (const surface of surfaces) {
    surface.classList.add('motion-surface');
    surface.addEventListener('pointerenter', event => {
      bounds.set(surface, {rect:surface.getBoundingClientRect(),scrollX:window.scrollX,scrollY:window.scrollY});
      if (event.pointerType !== 'touch') surface.classList.add('is-interacting');
      update(surface, event);
    });
    surface.addEventListener('pointermove', event => {
      if (event.pointerType !== 'touch' || surface.classList.contains('is-pressed')) update(surface, event);
    }, { passive: true });
    surface.addEventListener('pointerdown', event => {
      clearTimeout(timers.get(surface));
      bounds.set(surface, {rect:surface.getBoundingClientRect(),scrollX:window.scrollX,scrollY:window.scrollY});
      surface.classList.add('is-interacting', 'is-pressed');
      update(surface, event);
    }, { passive: true });
    const release = event => {
      surface.classList.remove('is-pressed');
      if (event.pointerType === 'touch') {
        timers.set(surface, setTimeout(() => surface.classList.remove('is-interacting'), 380));
      }
    };
    surface.addEventListener('pointerup', release);
    surface.addEventListener('pointercancel', () => surface.classList.remove('is-pressed', 'is-interacting'));
    surface.addEventListener('pointerleave', event => {
      surface.classList.remove('is-pressed');
      clearTimeout(timers.get(surface));
      if (event.pointerType === 'touch') timers.set(surface, setTimeout(() => surface.classList.remove('is-interacting'), 380));
      else surface.classList.remove('is-interacting');
    });
  }
  const controls = document.querySelectorAll('a,button,summary');
  for (const control of controls) {
    control.addEventListener('pointerdown', () => control.classList.add('is-pressed'), { passive: true });
    const release = () => control.classList.remove('is-pressed');
    control.addEventListener('pointerup', release);
    control.addEventListener('pointercancel', release);
    control.addEventListener('pointerleave', release);
  }
  document.querySelectorAll('details').forEach(details => details.addEventListener('toggle', () => {
    if (!details.open || reduced.matches) return;
    const content = details.querySelector('.project-notes__content,.principle-note__body');
    content?.animate?.([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}], {duration:420,easing:'cubic-bezier(.22,1,.36,1)'});
  }));
  const entries = document.querySelectorAll('.preview-copy,.preview-console,.preview-project-nav');
  if (!reduced.matches && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(items => {
      for (const item of items) if (item.isIntersecting) {
        item.target.classList.add('motion-in');
        observer.unobserve(item.target);
      }
    }, {threshold:.12});
    entries.forEach(entry => observer.observe(entry));
  }
  const releaseAll = () => {
    surfaces.forEach(surface => { surface.classList.remove('is-interacting','is-pressed'); clearTimeout(timers.get(surface)); });
    controls.forEach(control => control.classList.remove('is-pressed'));
    pending.clear();
    cancelAnimationFrame(frame);
    frame = 0;
  };
  const hero = document.querySelector('.hero');
  if (hero && 'IntersectionObserver' in window) {
    const ambientObserver = new IntersectionObserver(items => {
      hero.classList.toggle('is-in-view', items[0].isIntersecting);
    });
    ambientObserver.observe(hero);
  }
  window.addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', () => {
    document.documentElement.classList.toggle('document-paused', document.hidden);
    if (document.hidden) releaseAll();
  });
})();
