(() => {
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const entrance = document.getElementById('site-entrance');
  let finishTimer = 0;
  let heroStartTimer = 0;
  let entering = false;
  let committed = false;
  let settlingTimer = 0;
  let lightFrame = 0;
  const stopEntranceWork = () => {
    clearTimeout(settlingTimer);
    cancelAnimationFrame(lightFrame);
    lightFrame = 0;
  };

  const startHero = () => {
    if (committed) return;
    committed = true;
    root.dataset.entry = 'entered';
    window.dispatchEvent(new Event('portfolio:enter'));
  };
  const finishEntry = (focusHero = true) => {
    stopEntranceWork();
    clearTimeout(finishTimer);
    clearTimeout(heroStartTimer);
    startHero();
    if (entrance?.open) entrance.close();
    if (focusHero) document.getElementById('hero-title')?.focus({preventScroll: true});
    entrance?.remove();
  };
  const enter = (skip = false) => {
    if (entering) return;
    entering = true;
    stopEntranceWork();
    // A refreshed entrance always opens onto the hero, rather than a restored scroll position.
    window.scrollTo({top: 0, left: 0, behavior: 'instant'});
    entrance?.classList.remove('is-light-pass', 'is-engaged');
    if (skip || reduced.matches) { finishEntry(); return; }
    root.dataset.entry = 'leaving';
    entrance.classList.add('is-leaving');
    // Start the hero under the translucent last half of the veil transition.
    heroStartTimer = setTimeout(startHero, 520);
    // A timer backs up animationend; a failed animation cannot strand the visitor.
    finishTimer = setTimeout(finishEntry, 1050);
  };

  if (entrance && root.dataset.entry === 'booting') {
    try {
      const svg = entrance.querySelector('.entry-field');
      // Vector letterforms stay independent of font loading. Twelve paths batch
      // the stick detail; there is no per-stroke JavaScript animation loop.
      const signature = 'M790 620V250H914C1006 250 1060 297 1060 369C1060 446 1004 489 914 489H850V620Z M850 309V431H912C970 431 999 408 999 370C999 330 970 309 912 309Z M1090 620V250H1205C1284 250 1327 288 1327 347C1327 388 1308 418 1273 432C1317 446 1342 477 1342 521C1342 584 1295 620 1213 620Z M1150 309V407H1200C1245 407 1268 390 1268 356C1268 325 1245 309 1200 309Z M1150 463V561H1206C1257 561 1281 545 1281 511C1281 479 1257 463 1206 463Z';
      const bands = [];
      for (let band = 0; band < 12; band++) {
        let d = '';
        for (let column = 0; column < 4; column++) {
          for (let row = 0; row < 34; row++) {
            const x = 780 + band * 48 + column * 12;
            const y = 239 + row * 12;
            const angle = -.35 + Math.sin(row / 7 + band / 3) * .35;
            d += `M${x.toFixed(1)} ${y}l${(Math.cos(angle)*6).toFixed(1)} ${(Math.sin(angle)*6).toFixed(1)} `;
          }
        }
        bands.push(`<path class="entry-band" d="${d}" style="--delay:${.2 + band*.035}s;--from-x:${(band-5.5)*10}px;--from-y:${Math.sin(band*2)*65}px;--from-r:${(band-5.5)*2}deg"/>`);
      }
      const currents = Array.from({length:9}, (_, i) => `<path class="entry-current" pathLength="1" style="--delay:${.1+i*.06}s" d="M${590+i*12} 850 C${630+i*12} 650 ${1430-i*25} ${720-i*16} ${1370-i*14} 390 S${1020-i*20} ${105+i*10} ${670+i*18} 85"/>`).join('');
      svg.innerHTML = `<defs><linearGradient id="entry-metal" x1="0" y1="1" x2="1" y2="0"><stop stop-color="#855b48"/><stop offset=".45" stop-color="#dcaa81"/><stop offset=".72" stop-color="#fff0da"/><stop offset="1" stop-color="#a97554"/></linearGradient><clipPath id="entry-signature"><path d="${signature}" fill-rule="evenodd" clip-rule="evenodd"/></clipPath><linearGradient id="entry-pass"><stop stop-color="#fff0dc" stop-opacity="0"/><stop offset=".5" stop-color="#fff0dc" stop-opacity=".75"/><stop offset="1" stop-color="#fff0dc" stop-opacity="0"/></linearGradient></defs><g class="entry-currents">${currents}</g><path class="entry-outline" pathLength="1" d="${signature}"/><g clip-path="url(#entry-signature)" class="entry-mark"><path class="entry-metal-base" d="${signature}" fill-rule="evenodd"/>${bands.join('')}<g class="entry-glints"><rect class="entry-glint" x="640" y="210" width="200" height="440" fill="url(#entry-pass)"/><rect class="entry-glint entry-glint--second" x="640" y="210" width="200" height="440" fill="url(#entry-pass)"/></g></g><g class="entry-contours">${[0,1,2].map(i=>`<path class="entry-contour" pathLength="1" d="${signature}" style="--phase:${i*-3}s"/>`).join('')}</g>`;
      let lightX = 75, lightY = 45;
      entrance.addEventListener('pointermove', event => {
        if (entering || document.hidden || reduced.matches) return;
        lightX = Math.max(0, Math.min(100, event.clientX / innerWidth * 100));
        lightY = Math.max(0, Math.min(100, event.clientY / innerHeight * 100));
        if (!lightFrame) lightFrame = requestAnimationFrame(() => {
          lightFrame = 0;
          entrance.style.setProperty('--light-x', `${lightX}%`);
          entrance.style.setProperty('--light-y', `${lightY}%`);
        });
      }, {passive:true});
      const entryButton = entrance.querySelector('[data-enter]');
      entryButton.addEventListener('click', () => enter());
      entryButton.addEventListener('pointerenter', () => entrance.classList.add('is-engaged'));
      entryButton.addEventListener('pointerleave', () => entrance.classList.remove('is-engaged'));
      entryButton.addEventListener('pointerdown', () => entrance.classList.add('is-engaged'));
      entryButton.addEventListener('pointerup', () => entrance.classList.remove('is-engaged'));
      entryButton.addEventListener('pointercancel', () => entrance.classList.remove('is-engaged'));
      entryButton.addEventListener('focus', () => entrance.classList.add('is-focused'));
      entryButton.addEventListener('blur', () => entrance.classList.remove('is-focused'));
      entrance.querySelector('[data-skip]').addEventListener('click', () => enter(true));
      entrance.addEventListener('cancel', event => { event.preventDefault(); enter(true); });
      entrance.addEventListener('close', () => { if (!committed) finishEntry(false); });
      entrance.addEventListener('animationend', event => {
        if (event.target === entrance && event.animationName === 'entry-dissolve') finishEntry();
      });
      entrance.showModal();
      root.dataset.entry = 'waiting';
      settlingTimer = setTimeout(() => { entrance.dataset.phase = 'settled'; }, reduced.matches ? 0 : 3000);
    } catch { finishEntry(false); }
  } else {
    entrance?.remove();
  }
  document.addEventListener('visibilitychange', () => {
    entrance?.classList.toggle('entry-paused', document.hidden);
    if (document.hidden) { cancelAnimationFrame(lightFrame); lightFrame = 0; }
    if (document.hidden && entering) finishEntry(false);
  });
  reduced.addEventListener('change', () => {
    cancelAnimationFrame(lightFrame); lightFrame = 0;
    if (reduced.matches && entering) finishEntry();
  });

  const cursor = document.createElement('div');
  cursor.className = 'portfolio-cursor';
  cursor.setAttribute('aria-hidden', 'true');
  cursor.innerHTML = '<span class="portfolio-cursor__point"><i class="cursor-point"></i></span><span class="portfolio-cursor__trail"><span class="portfolio-cursor__shape"></span><span class="portfolio-cursor__label"></span></span>';
  document.body.append(cursor);
  const point = cursor.querySelector('.portfolio-cursor__point');
  const trail = cursor.querySelector('.portfolio-cursor__trail');
  const label = cursor.querySelector('.portfolio-cursor__label');
  const shape = cursor.querySelector('.portfolio-cursor__shape');
  let clickAnimation = null;
  let targetX = 0, targetY = 0, followX = 0, followY = 0;
  let frame = 0, previousTime = 0, visible = false;
  const hide = () => {
    visible = false;
    cursor.classList.remove('is-visible', 'is-down');
    clickAnimation?.cancel();
    root.classList.remove('cursor-active');
    cancelAnimationFrame(frame);
    frame = previousTime = 0;
  };
  const paintTrail = time => {
    frame = 0;
    if (!visible || document.hidden) return;
    const delta = previousTime ? Math.min(32, time - previousTime) : 16;
    previousTime = time;
    const mix = reduced.matches ? 1 : 1 - Math.exp(-delta / 24);
    followX += (targetX - followX) * mix;
    followY += (targetY - followY) * mix;
    if (Math.abs(targetX - followX) + Math.abs(targetY - followY) < .15) {
      followX = targetX; followY = targetY; previousTime = 0;
    } else frame = requestAnimationFrame(paintTrail);
    trail.style.transform = `translate3d(${followX}px,${followY}px,0)`;
  };
  const update = event => {
    if (event.pointerType !== 'mouse' || document.hidden) { hide(); return; }
    const element = event.target instanceof Element ? event.target : null;
    const control = element?.closest('a,button,summary,[role="button"]');
    const nativeText = element?.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],p,h1,h2,h3,h4');
    if ((!control && nativeText) || document.getSelection()?.type === 'Range') { hide(); return; }
    const parent = element?.closest('dialog[open]') || document.body;
    if (cursor.parentElement !== parent) parent.append(cursor);
    targetX = event.clientX; targetY = event.clientY;
    point.style.transform = `translate3d(${targetX}px,${targetY}px,0)`;
    if (!visible) { followX = targetX; followY = targetY; }
    // A fast crossing never creates a long cursor trail.
    const distance = Math.hypot(targetX-followX, targetY-followY);
    if (distance > 10) {
      followX = targetX + (followX-targetX)*10/distance;
      followY = targetY + (followY-targetY)*10/distance;
    }
    visible = true;
    cursor.classList.add('is-visible');
    root.classList.add('cursor-active');
    if (control) cursor.dataset.interactive = 'true';
    else delete cursor.dataset.interactive;
    cursor.dataset.side = targetX > innerWidth - 110 ? 'left' : 'right';
    cursor.dataset.vertical = targetY > innerHeight - 50 ? 'above' : 'below';
    let action = '';
    if (control?.hasAttribute('data-enter')) action = 'Enter';
    else if (control?.hasAttribute('data-interface')) action = 'View';
    else if (control?.matches('.project-card')) action = control.getAttribute('href')?.startsWith('preview-') ? 'Explore' : 'View';
    else if (control?.matches('summary,.preview-console__explore')) action = 'Explore';
    else if (control?.matches('.roadmap__item--link')) action = 'Explore';
    if (action) cursor.dataset.action = action;
    else delete cursor.dataset.action;
    if (label.textContent !== action) label.textContent = action;
    if (!frame) frame = requestAnimationFrame(paintTrail);
  };
  document.addEventListener('pointermove', update, {passive: true});
  document.addEventListener('pointerover', update, {passive: true});
  document.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse') hide();
    else if (visible) cursor.classList.add('is-down');
  }, {passive: true});
  document.addEventListener('pointerup', () => {
    const pressed = cursor.classList.contains('is-down');
    cursor.classList.remove('is-down');
    if (pressed && visible && !reduced.matches && typeof shape.animate === 'function') {
      clickAnimation?.cancel();
      clickAnimation = shape.animate([
        {scale: '.86', opacity: .65},
        {scale: '1.12', opacity: 1, offset: .42},
        {scale: '1', opacity: 1}
      ], {duration: 280, easing: 'cubic-bezier(.22,1,.36,1)'});
    }
  });
  document.addEventListener('pointercancel', hide);
  document.addEventListener('close', () => { hide(); document.body.append(cursor); }, true);
  document.addEventListener('pointerout', event => { if (!event.relatedTarget) hide(); });
  document.addEventListener('keydown', hide);
  document.addEventListener('selectionchange', () => { if (document.getSelection()?.type === 'Range') hide(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) hide(); });
  window.addEventListener('blur', hide);
  window.addEventListener('portfolio:enter', () => { hide(); document.body.append(cursor); });
})();
