/* ==========================================================================
   Barber Prestige — interactions
   - Une seule boucle requestAnimationFrame, mise en veille dès que rien ne bouge.
   - Interpolations indépendantes du taux de rafraîchissement (60 / 120 / 144 Hz).
   - Lectures de layout mises en cache (resize), écritures limitées à transform.
   ========================================================================== */
(() => {
  'use strict';

  const doc = document.documentElement;
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  // Amortissement exponentiel : même rendu quel que soit le nombre d'images/seconde
  const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const SDA = !!(window.CSS && CSS.supports && CSS.supports('animation-timeline: view()'));

  /* ---------- Boucle d'animation unique ---------- */
  const tasks = new Set();
  let rafId = 0;
  let last = 0;
  function frame(t) {
    const dt = clamp((t - last) / 1000, 0, 1 / 20);
    last = t;
    for (const task of tasks) if (!task(dt)) tasks.delete(task);
    rafId = tasks.size ? requestAnimationFrame(frame) : 0;
  }
  // Une tâche renvoie true tant qu'elle doit continuer à tourner
  function wake(task) {
    tasks.add(task);
    if (!rafId) { last = performance.now(); rafId = requestAnimationFrame(frame); }
  }

  /* ---------- Découpage des titres en mots ---------- */
  function splitWords(el) {
    let i = 0;
    const walk = (node) => {
      for (const child of Array.from(node.childNodes)) {
        if (child.nodeType === Node.TEXT_NODE) {
          const frag = document.createDocumentFragment();
          // On ne coupe pas sur les espaces insécables (typographie française)
          for (const part of child.textContent.split(/([ \t\n\r]+)/)) {
            if (!part) continue;
            if (/^[ \t\n\r]+$/.test(part)) { frag.append(' '); continue; }
            const w = document.createElement('span');
            const inner = document.createElement('span');
            w.className = 'w';
            inner.className = 'w__i';
            inner.style.setProperty('--wi', i++);
            inner.textContent = part;
            w.append(inner);
            frag.append(w);
          }
          child.replaceWith(frag);
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          walk(child);
        }
      }
    };
    walk(el);
  }
  $$('[data-split]').forEach(splitWords);

  /* ---------- Compteurs ---------- */
  function countUp(el) {
    const end = parseFloat(el.dataset.count);
    const decimals = parseInt(el.dataset.decimals || '0', 10);
    const fmt = (v) => v.toFixed(decimals).replace('.', ',');
    if (reduce.matches) { el.textContent = fmt(end); return; }
    const duration = 1.8;
    let t = 0;
    el.textContent = fmt(0);
    wake((dt) => {
      t += dt;
      const k = Math.min(t / duration, 1);
      const eased = k === 1 ? 1 : 1 - Math.pow(2, -10 * k);
      el.textContent = fmt(end * eased);
      return k < 1;
    });
  }

  /* ---------- Révélations au scroll ---------- */
  doc.classList.add('io');
  const revealIO = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const el = entry.target;
      el.classList.add('is-in');
      revealIO.unobserve(el);
      if (el.hasAttribute('data-count')) countUp(el);
      $$('[data-count]', el).forEach(countUp);
    }
  }, { rootMargin: '0px 0px -12% 0px' });
  $$('[data-reveal], [data-split]').forEach((el) => revealIO.observe(el));
  // Compteurs isolés (hors d'un bloc révélé)
  $$('[data-count]').forEach((el) => { if (!el.closest('[data-reveal]')) revealIO.observe(el); });

  /* ---------- Horaires & statut ouvert / fermé (heure de Paris) ---------- */
  const HOURS = { 1: [600, 1200], 2: [600, 1200], 3: [600, 1200], 4: [600, 1200], 5: [600, 1200], 6: [600, 1200] };
  const DAY_NAMES = ['', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
  const WEEKDAY = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  const fmtHour = (m) => `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, '0') : ''}`;

  function parisNow() {
    const parts = {};
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Paris', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
    }).formatToParts(new Date()).forEach((p) => { parts[p.type] = p.value; });
    return { day: WEEKDAY[parts.weekday], min: (parseInt(parts.hour, 10) % 24) * 60 + parseInt(parts.minute, 10) };
  }

  function computeStatus() {
    const { day, min } = parisNow();
    const today = HOURS[day];
    let open = false;
    let text;
    if (today && min >= today[0] && min < today[1]) {
      open = true;
      text = `Ouvert · ferme à ${fmtHour(today[1])}`;
    } else if (today && min < today[0]) {
      text = `Fermé · ouvre à ${fmtHour(today[0])}`;
    } else {
      for (let i = 1; i <= 7; i++) {
        const d = ((day - 1 + i) % 7) + 1;
        if (HOURS[d]) { text = `Fermé · ouvre ${i === 1 ? 'demain' : DAY_NAMES[d]} à ${fmtHour(HOURS[d][0])}`; break; }
      }
    }
    return { day, open, text };
  }

  function renderStatus() {
    let s;
    try { s = computeStatus(); } catch (e) { return; }
    $$('[data-status]').forEach((el) => {
      el.classList.toggle('is-open', s.open);
      const t = $('[data-status-text]', el);
      if (t) t.textContent = s.text;
    });
    $$('.hours__table tr').forEach((tr) => tr.classList.toggle('is-today', +tr.dataset.day === s.day));
  }
  renderStatus();
  setInterval(renderStatus, 60 * 1000);

  $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });

  /* ---------- Navigation, dock mobile, progression ---------- */
  const nav = $('[data-nav]');
  const dock = $('[data-dock]');
  const progress = $('.progress');
  const footer = $('.foot');
  let footerVisible = false;
  let menuOpen = false;
  let lastY = window.scrollY;
  let docMax = 1;

  new IntersectionObserver(([e]) => { footerVisible = e.isIntersecting; onScroll(); }).observe(footer);

  /* ---------- Prestations : défilement horizontal épinglé ---------- */
  const hsSec = $('[data-hs]');
  const hsTrack = $('[data-hs-track]', hsSec);
  const hsBar = $('[data-hs-bar]', hsSec);
  const hsCount = $('[data-hs-count]', hsSec);
  const hsQuery = matchMedia('(min-width: 900px) and (min-height: 680px)');
  const SERVICES = 7;
  let hsOn = false;
  let hsTop = 0;
  let hsDist = 0;
  let lastCount = 1;

  function setCount(p) {
    const n = clamp(Math.round(p * (SERVICES - 1)) + 1, 1, SERVICES);
    if (n !== lastCount) { lastCount = n; hsCount.textContent = String(n).padStart(2, '0'); }
  }

  function measure() {
    hsOn = hsQuery.matches && !reduce.matches;
    hsSec.classList.toggle('hs', hsOn);
    if (hsOn) {
      const pin = hsTrack.parentElement;
      hsDist = Math.max(0, hsTrack.offsetWidth - pin.clientWidth);
      hsSec.style.setProperty('--dist', `${hsDist}px`);
      hsTop = hsSec.getBoundingClientRect().top + window.scrollY;
    } else {
      hsSec.style.removeProperty('--dist');
      hsTrack.style.transform = '';
      hsBar.style.transform = '';
    }
    docMax = Math.max(1, doc.scrollHeight - window.innerHeight);
    onScroll();
  }

  function scrollTask() {
    const y = window.scrollY;
    const delta = y - lastY;

    nav.classList.toggle('is-scrolled', y > 24);
    if (!menuOpen && Math.abs(delta) > 4) nav.classList.toggle('is-hidden', delta > 0 && y > 480);
    dock.classList.toggle('is-on', y > window.innerHeight * 0.6 && !footerVisible);

    if (hsOn && hsDist > 0) {
      const p = clamp((y - hsTop) / hsDist, 0, 1);
      if (!SDA) {
        hsTrack.style.transform = `translate3d(${(-p * hsDist).toFixed(2)}px,0,0)`;
        hsBar.style.transform = `scaleX(${p.toFixed(4)})`;
      }
      setCount(p);
    }
    if (!SDA) progress.style.transform = `scaleX(${clamp(y / docMax, 0, 1).toFixed(4)})`;

    lastY = y;
    return false;
  }
  function onScroll() { wake(scrollTask); }
  addEventListener('scroll', onScroll, { passive: true });

  // Mobile : carrousel natif (scroll-snap), on synchronise juste la barre
  function trackTask() {
    const max = hsTrack.scrollWidth - hsTrack.clientWidth;
    const p = max > 0 ? hsTrack.scrollLeft / max : 0;
    hsBar.style.transform = `scaleX(${p.toFixed(4)})`;
    setCount(p);
    return false;
  }
  hsTrack.addEventListener('scroll', () => { if (!hsOn) wake(trackTask); }, { passive: true });

  let resizeQueued = false;
  function queueMeasure() {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(() => { resizeQueued = false; measure(); });
  }
  addEventListener('resize', queueMeasure, { passive: true });
  hsQuery.addEventListener('change', queueMeasure);
  reduce.addEventListener('change', queueMeasure);
  if ('ResizeObserver' in window) new ResizeObserver(queueMeasure).observe(document.body);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(queueMeasure);
  measure();

  /* ---------- Menu mobile ---------- */
  const burger = $('[data-burger]');
  const menu = $('[data-menu]');
  function setMenu(open) {
    menuOpen = open;
    doc.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
    menu.inert = !open;
    if (open) nav.classList.remove('is-hidden');
  }
  burger.addEventListener('click', () => setMenu(!menuOpen));
  $$('a', menu).forEach((a) => a.addEventListener('click', () => setMenu(false)));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && menuOpen) { setMenu(false); burger.focus(); } });
  matchMedia('(min-width: 900px)').addEventListener('change', (e) => { if (e.matches && menuOpen) setMenu(false); });

  /* ---------- Carte Google (chargée au clic : RGPD + performance) ---------- */
  $$('[data-map-load]').forEach((btn) => btn.addEventListener('click', () => {
    const box = btn.closest('[data-map]');
    const iframe = document.createElement('iframe');
    iframe.src = box.dataset.src;
    iframe.title = "Carte : Barber Prestige, 3 Place Dupont-de-l'Eure, Évreux";
    iframe.loading = 'lazy';
    iframe.referrerPolicy = 'no-referrer-when-downgrade';
    iframe.allowFullscreen = true;
    iframe.addEventListener('load', () => box.classList.add('is-loaded'), { once: true });
    box.append(iframe);
    btn.disabled = true;
  }, { once: true }));

  /* ---------- Effets souris (desktop uniquement) ---------- */
  if (!finePointer.matches || reduce.matches) return;
  doc.classList.add('has-cursor');

  // Curseur annexe
  const cursor = $('.cursor');
  cursor.classList.add('is-off'); // invisible jusqu'au premier mouvement
  let mx = -100;
  let my = -100;
  let cx = mx;
  let cy = my;
  let cursorStarted = false;
  function cursorTask(dt) {
    cx = damp(cx, mx, 16, dt);
    cy = damp(cy, my, 16, dt);
    cursor.style.transform = `translate3d(${cx.toFixed(2)}px,${cy.toFixed(2)}px,0)`;
    return Math.abs(mx - cx) + Math.abs(my - cy) > 0.1;
  }
  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    mx = e.clientX;
    my = e.clientY;
    if (!cursorStarted) { cursorStarted = true; cx = mx; cy = my; }
    cursor.classList.remove('is-off');
    wake(cursorTask);
    if (heroVisible) { hx = mx / innerWidth; hy = my / innerHeight; wake(heroTask); }
  }, { passive: true });
  document.addEventListener('pointerover', (e) => {
    cursor.classList.toggle('is-hover', !!e.target.closest('a, button, [data-tilt]'));
  });
  addEventListener('pointerout', (e) => { if (!e.relatedTarget) cursor.classList.add('is-off'); });
  addEventListener('pointerdown', () => cursor.classList.add('is-down'));
  addEventListener('pointerup', () => cursor.classList.remove('is-down'));

  // Hero : halo lumineux + profondeur de l'enseigne
  const hero = $('.hero');
  const spot = $('[data-spot]');
  const layers = $$('[data-depth]', hero).map((el) => ({ el, depth: parseFloat(el.dataset.depth) }));
  let heroVisible = true;
  let heroW = hero.offsetWidth;
  let heroH = hero.offsetHeight;
  let hx = 0.7;
  let hy = 0.45;
  let sx = hx;
  let sy = hy;
  new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; }).observe(hero);
  addEventListener('resize', () => { heroW = hero.offsetWidth; heroH = hero.offsetHeight; }, { passive: true });
  function heroTask(dt) {
    sx = damp(sx, hx, 3.2, dt);
    sy = damp(sy, hy, 3.2, dt);
    spot.style.transform = `translate3d(${(sx * heroW).toFixed(1)}px,${(sy * heroH).toFixed(1)}px,0)`;
    const dx = sx - 0.5;
    const dy = sy - 0.5;
    for (const { el, depth } of layers) {
      el.style.transform = `translate3d(${(-dx * depth * 26).toFixed(2)}px,${(-dy * depth * 20).toFixed(2)}px,0)`;
    }
    return Math.abs(hx - sx) + Math.abs(hy - sy) > 0.0005;
  }

  // Boutons magnétiques
  $$('[data-magnetic]').forEach((el) => {
    let rect = null;
    let x = 0;
    let y = 0;
    let tx = 0;
    let ty = 0;
    const task = (dt) => {
      x = damp(x, tx, 12, dt);
      y = damp(y, ty, 12, dt);
      const moving = Math.abs(tx - x) + Math.abs(ty - y) > 0.05;
      el.style.transform = !moving && tx === 0 && ty === 0 ? '' : `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0)`;
      return moving;
    };
    el.addEventListener('pointerenter', () => { rect = el.getBoundingClientRect(); });
    el.addEventListener('pointermove', (e) => {
      if (!rect) rect = el.getBoundingClientRect();
      tx = (e.clientX - rect.left - rect.width / 2) * 0.28;
      ty = (e.clientY - rect.top - rect.height / 2) * 0.38;
      wake(task);
    });
    el.addEventListener('pointerleave', () => { rect = null; tx = 0; ty = 0; wake(task); });
  });

  // Cartes prestations : inclinaison 3D + reflet
  $$('[data-tilt]').forEach((card) => {
    const host = card.parentElement;
    const glare = $('.svc__glare', card);
    let rx = 0;
    let ry = 0;
    let trx = 0;
    let try_ = 0;
    let gx = 0;
    let gy = 0;
    const task = (dt) => {
      rx = damp(rx, trx, 9, dt);
      ry = damp(ry, try_, 9, dt);
      const moving = Math.abs(trx - rx) + Math.abs(try_ - ry) > 0.01;
      card.style.transform = !moving && trx === 0 && try_ === 0
        ? ''
        : `perspective(1100px) rotateX(${rx.toFixed(3)}deg) rotateY(${ry.toFixed(3)}deg)`;
      if (glare) glare.style.transform = `translate3d(${gx.toFixed(1)}px,${gy.toFixed(1)}px,0)`;
      return moving;
    };
    card.addEventListener('pointermove', (e) => {
      const r = host.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      trx = (0.5 - py) * 8;
      try_ = (px - 0.5) * 10;
      gx = e.clientX - r.left;
      gy = e.clientY - r.top;
      wake(task);
    });
    card.addEventListener('pointerleave', () => { trx = 0; try_ = 0; wake(task); });
  });
})();
