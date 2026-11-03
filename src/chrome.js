/* chrome.js: the page frame shared by the cockpits. The markup and classes are the ones shell.css styles.
   A page brings its own stage, readouts, source badges and sheets. */
(function (global) {
  'use strict';

  const ICON = {
    connect: '<path d="M8 8v8M16 8v8M5 11v2M19 11v2M12 4v16"/>',
    session: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
    signal: '<path d="M3 12h3l2-6 4 13 3-9 2 4h4"/>',
    about: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    route: '<path d="M6 21c0-5 4-5 6-9s2-6 1-9"/><path d="M18 21c0-4-2-5-3-8"/>',
    full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    play: '<path d="M7 5v14l11-7z"/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z"/><path d="M6.5 12.5h3l1.5-2.5 2 4 1.2-1.5h3.3"/>',
    crank: '<circle cx="7" cy="16" r="3.5"/><circle cx="17" cy="16" r="3.5"/><path d="m7 16 4-7h4l2 7M9 9h4M11 16l4-7"/>',
  };
  const svg = (name, cls) => `<svg viewBox="0 0 24 24" aria-hidden="true"${cls ? ` class="${cls}"` : ''}>${ICON[name]}</svg>`;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const closeBtn = (label) => `<button class="close" data-close aria-label="${label}">${svg('close')}</button>`;
  const sheet = (s) => `
      <dialog class="sheet${s.wide ? ' wide' : ''}" id="${s.id}-sheet" aria-labelledby="${s.id}-title" tabindex="-1">
        <div class="sheet-head"><h2 id="${s.id}-title">${esc(s.title)}</h2>${closeBtn(`Close ${s.label.toLowerCase()}`)}</div>
        ${s.intro ? `<p class="sheet-intro">${esc(s.intro)}</p>` : ''}
        ${s.html}
      </dialog>`;

  function mountChrome(cfg) {
    const scene = $('scene');
    document.body.dataset.app = cfg.id;

    scene.insertAdjacentHTML('beforeend', `
      <div class="vignette"></div>
      <header class="header chrome">
        <a class="brand" href="index.html" aria-label="${esc(cfg.name)}: back to the home page">${cfg.brand}<span>${esc(cfg.name)}</span></a>
        <div class="top-actions">
          <button class="top-action" id="demo-button">Try a demo</button>
          <button class="top-action icon" id="fs-button" aria-label="Full screen">${svg('full')}</button>
        </div>
      </header>
      ${cfg.modes ? `<nav class="mode-switch chrome" aria-label="${esc(cfg.modeLabel)}">${cfg.modes.map((m) => `<button data-mode="${m.id}" aria-pressed="${m.id === cfg.mode}">${esc(m.label)}</button>`).join('')}</nav>` : ''}
      <div class="intro">
        <p class="eyebrow" id="intro-eyebrow"></p>
        <h1 id="intro-title"></h1>
        <p id="intro-sub"></p>
      </div>
      ${cfg.stage || ''}
      <div id="toast" role="status"></div>
      <div id="sr-status" role="status" aria-live="polite" style="position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)"></div>
      <div class="dock-wrap">
        <div id="hud" class="chrome">${cfg.hud || ''}</div>
        ${cfg.beforeBadges || ''}
        <div class="badges">${cfg.badges}</div>
        <nav class="dock chrome" aria-label="Controls">
          ${cfg.sheets.filter((s) => s.id !== 'about').map((s) => `<button id="${s.id}-button" aria-haspopup="dialog" aria-expanded="false">${svg(s.icon)}<span>${esc(s.label)}</span></button>`).join('')}
          <div class="dock-divider"></div>
          <button id="about-button" aria-haspopup="dialog" aria-expanded="false">${svg('about')}<span>About</span></button>
        </nav>
        <p class="truth chrome" id="truth">${esc(cfg.truth)}</p>
        ${global.familyNav ? global.familyNav(cfg.id) : ''}
      </div>`);
    document.body.insertAdjacentHTML('beforeend', cfg.sheets.map(sheet).join(''));

    /* ---------- sheets ---------- */
    const openSheet = (name) => {
      const d = $(`${name}-sheet`);
      if (!d || d.open) return;
      if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
      d.focus({ preventScroll: true });
      const b = $(`${name}-button`); if (b) b.setAttribute('aria-expanded', 'true');
      if (cfg.onOpenSheet) cfg.onOpenSheet(name);
    };
    document.querySelectorAll('dialog.sheet').forEach((d) => {
      const name = d.id.replace('-sheet', '');
      d.addEventListener('close', () => { const b = $(`${name}-button`); if (b) { b.setAttribute('aria-expanded', 'false'); b.focus({ preventScroll: true }); } });
      d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
      d.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => d.close()));
    });
    cfg.sheets.forEach((s) => $(`${s.id}-button`).addEventListener('click', () => openSheet(s.id)));

    /* ---------- modes ---------- */
    let mode = cfg.mode;
    const modeButtons = [...document.querySelectorAll('.mode-switch button')];
    const setMode = (m) => {
      if (!modeButtons.some((b) => b.dataset.mode === m)) return;
      mode = m;
      modeButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
      const copy = cfg.intro[m];
      $('intro-eyebrow').textContent = copy.eyebrow; $('intro-title').textContent = copy.title; $('intro-sub').textContent = copy.subtitle;
      if (cfg.onMode) cfg.onMode(m);
    };
    modeButtons.forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
    if (!cfg.modes) { $('intro-eyebrow').textContent = cfg.intro.eyebrow; $('intro-title').textContent = cfg.intro.title; $('intro-sub').textContent = cfg.intro.subtitle; }

    /* ---------- small tools ---------- */
    const toast = (msg, ms) => { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), ms || 3200); };
    const syncRange = (r) => r.style.setProperty('--val', ((+r.value - +r.min) / (+r.max - +r.min)) * 100);
    document.querySelectorAll('.sheet input[type="range"], #hud input[type="range"]').forEach(syncRange);
    const glFail = (msg) => { const d = document.createElement('div'); d.id = 'gl-error'; d.setAttribute('role', 'alert'); d.textContent = msg; scene.appendChild(d); };
    const download = (blob, name) => { const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); };

    /* ---------- demo, full screen, keys, quiet chrome ---------- */
    $('demo-button').addEventListener('click', () => cfg.toggleDemo());
    const fullscreen = () => { if (document.fullscreenElement) document.exitFullscreen(); else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => toast('Full screen is not available here.')); };
    $('fs-button').addEventListener('click', fullscreen);
    // A mouse click should not leave a button holding the keyboard, or Space would press it again.
    // Keyboard presses report detail 0, so keyboard users keep their focus.
    addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('button'); if (b && e.detail > 0 && !b.closest('dialog')) b.blur(); });
    let hideChrome = false, lastMove = performance.now();
    const wake = () => { lastMove = performance.now(); if (!hideChrome) document.body.classList.remove('quiet'); };
    ['pointermove', 'pointerdown', 'keydown', 'touchstart'].forEach((ev) => addEventListener(ev, wake, { passive: true }));
    addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      if (e.target.closest && e.target.closest('input, select, textarea, dialog[open]')) return;
      const key = e.key.toLowerCase();
      if (key === 'c') openSheet('connect');
      else if (key === 'd') cfg.toggleDemo();
      else if (key === 'f') fullscreen();
      else if (key === 'h') { hideChrome = !hideChrome; document.body.classList.toggle('quiet', hideChrome); }
      else if (cfg.onKey) cfg.onKey(e, key);
    });
    const quietTick = (now, active) => { if (!hideChrome && active && now - lastMove > 9000 && !document.querySelector('dialog[open]')) document.body.classList.add('quiet'); };

    return { toast, openSheet, glFail, setMode, get mode() { return mode; }, syncRange, quietTick, download, svg, esc };
  }

  global.mountChrome = mountChrome;
})(window);
