'use strict';
// Design der Kasse: Thema (Logo-Lila, Weihnachten, Klassisch), Hell/Dunkel, Farbe der Knöpfe, Logo im Hintergrund, Schnee.
// Alle Farben werden hier berechnet (Theme.vars) und als CSS-Variablen gesetzt; die Seite (styles.css) benutzt nur die Variablen.
(function (root, factory) {
  const K = typeof module === 'object' && module.exports ? require('./logic.js') : root.Kasse;
  if (typeof module === 'object' && module.exports) module.exports = factory(K, null); else root.Theme = factory(K, root);
})(typeof self !== 'undefined' ? self : this, function (K, win) {
  const BASE = {
    light: { '--bg': '#F2F2F7', '--card': '#FFFFFF', '--label': '#000000', '--label2': 'rgba(60,60,67,.6)', '--sep': 'rgba(60,60,67,.18)', '--fill': 'rgba(120,120,128,.12)', '--red': '#FF3B30', '--ok': '#248A3D', '--pp': '#003087' },
    dark:  { '--bg': '#000000', '--card': '#1C1C1E', '--label': '#FFFFFF', '--label2': 'rgba(235,235,245,.6)', '--sep': 'rgba(84,84,88,.6)', '--fill': 'rgba(120,120,128,.24)', '--red': '#FF453A', '--ok': '#30D158', '--pp': '#7CB8FF' }
  };
  const THEMES = {
    standard: { name: 'Logo-Lila', light: { brand: '#A10DBC', text: '#A10DBC' }, dark: { brand: '#B52FCB', text: '#DE96EE' } },
    classic:  { name: 'Klassisch (Blau)', light: { brand: '#007AFF', text: '#007AFF', ink: '#FFFFFF' }, dark: { brand: '#0A84FF', text: '#0A84FF', ink: '#FFFFFF' } },   // wie bisher: weiße Schrift auf Apple-Blau
    xmas:     { name: 'Weihnachten', xmas: true,
      light: { brand: '#17703F', text: '#17703F', v: { '--bg': '#F7F0E3', '--card': '#FFFDF8', '--fill': 'rgba(27,127,75,.10)', '--sep': 'rgba(70,55,30,.20)', '--label2': 'rgba(60,50,30,.65)' } },
      dark:  { brand: '#2A9D62', text: '#7FDDA9', v: { '--bg': '#000000', '--card': '#1C1C1E', '--fill': 'rgba(120,120,128,.24)', '--sep': 'rgba(84,84,88,.6)', '--label2': 'rgba(235,235,245,.6)' } } }
  };
  // Kachelfarben im Weihnachtsdesign: Rot, Grün, Gold, Tannengrün (hell/dunkel jeweils mit gut lesbarem Zähler)
  const XMAS_TILES = { light: ['#B3261E', '#1B7F4B', '#D4A017', '#0F4D2E'], dark: ['#E5493F', '#3DBB77', '#F2C14E', '#6FBF8E'] };
  const SWATCHES = [{ n: 'Lila', c: '#A10DBC' }, { n: 'Blau', c: '#007AFF' }, { n: 'Grün', c: '#1B7F4B' }, { n: 'Türkis', c: '#0E8F9C' }, { n: 'Orange', c: '#D9730D' }];
  const LOGO_OP = { off: 0, low: 0.07, mid: 0.14 };
  const DEFAULT = { theme: 'standard', mode: 'auto', accent: null, logo: 'low', snow: true };

  const hex = (r, g, b) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase();
  const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => { const x = rgb(a), y = rgb(b); return hex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t); };
  const validHex = s => /^#[0-9a-fA-F]{6}$/.test(String(s || ''));

  // Text in der Knopffarbe muss auf dem Untergrund lesbar sein: abdunkeln (hell) bzw. aufhellen (dunkel), bis der Kontrast reicht
  function readable(col, bg, toward) { let c = col; for (let i = 0; i < 20 && K.contrast(c, bg) < 4.5; i++) c = mix(c, toward, 0.08); return c; }

  function resolve(d) { return Object.assign({}, DEFAULT, d || {}); }
  function scheme(d, systemDark) { const m = resolve(d).mode; return m === 'dark' ? 'dark' : m === 'light' ? 'light' : (systemDark ? 'dark' : 'light'); }

  function vars(design, sch) {
    const d = resolve(design), t = THEMES[d.theme] || THEMES.standard, s = sch === 'dark' ? 'dark' : 'light', p = t[s];
    const v = Object.assign({}, BASE[s], p.v || {});
    let brand = p.brand, text = p.text;
    if (validHex(d.accent)) {   // eigene Farbe der Knöpfe
      const a = d.accent.toUpperCase();
      brand = s === 'dark' ? (K.luminance(a) < 0.18 ? mix(a, '#FFFFFF', 0.25) : a) : a;
      text = s === 'dark' ? readable(a, v['--card'], '#FFFFFF') : readable(a, '#FFFFFF', '#000000');
    }
    v['--brand'] = brand; v['--brand-text'] = text; v['--brand-ink'] = !validHex(d.accent) && p.ink ? p.ink : K.textOn(brand);
    const tiles = XMAS_TILES[s];
    tiles.forEach((c, i) => { v['--x' + (i + 1)] = c; v['--x' + (i + 1) + '-on'] = K.textOn(c); });
    v['--logo-op'] = String(LOGO_OP[d.logo] != null ? LOGO_OP[d.logo] : LOGO_OP.low);
    return v;
  }

  // ---- Browser: Variablen setzen, Klassen, Logo-Hintergrund, Girlande, Schnee --------------------------------------------
  let snowOn = false, raf = 0, cv = null, flakes = [];
  function stopSnow() { snowOn = false; if (raf) win.cancelAnimationFrame(raf); raf = 0; if (cv) { cv.remove(); cv = null; } }
  function startSnow() {
    if (snowOn || !win.document.body) return;
    if (win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches) return;   // Bewegung reduzieren: kein Schnee
    snowOn = true; cv = win.document.createElement('canvas'); cv.id = 'snow'; cv.setAttribute('aria-hidden', 'true');
    win.document.body.appendChild(cv);
    const ctx = cv.getContext('2d'); let W = 0, H = 0;
    const size = () => { const r = win.devicePixelRatio > 1 ? 1.5 : 1; W = cv.width = Math.round(win.innerWidth * r); H = cv.height = Math.round(win.innerHeight * r); cv.style.width = '100%'; cv.style.height = '100%'; };
    size(); win.addEventListener('resize', size);
    flakes = Array.from({ length: 46 }, () => ({ x: Math.random() * 2000, y: Math.random() * 1200, r: 1.5 + Math.random() * 3, v: 0.4 + Math.random() * 0.9, d: Math.random() * 6.28 }));
    const tick = () => {
      if (!snowOn) return; raf = win.requestAnimationFrame(tick);
      if (win.document.hidden) return;
      ctx.clearRect(0, 0, W, H); ctx.fillStyle = 'rgba(255,255,255,.9)';
      const light = win.document.documentElement.dataset.scheme === 'light'; ctx.strokeStyle = 'rgba(110,140,170,.55)'; ctx.lineWidth = 1;   // auf hellem Grund mit zartem Rand
      for (const f of flakes) {
        f.y += f.v; f.d += 0.01; f.x += Math.sin(f.d) * 0.4;
        if (f.y > H + 6) { f.y = -6; f.x = Math.random() * W; } if (f.x > W + 6) f.x = -6; if (f.x < -6) f.x = W + 6;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.283); ctx.fill(); if (light) ctx.stroke();
      }
    };
    tick();
  }

  function apply(design) {
    if (!win || !win.document) return;
    const d = resolve(design), de = win.document.documentElement, sysDark = !!(win.matchMedia && win.matchMedia('(prefers-color-scheme: dark)').matches);
    const sch = scheme(d, sysDark), v = vars(d, sch), t = THEMES[d.theme] || THEMES.standard;
    de.dataset.scheme = sch; de.dataset.theme = t.xmas ? 'xmas' : d.theme; de.style.colorScheme = sch;
    for (const k in v) de.style.setProperty(k, v[k]);
    win.document.querySelectorAll('meta[name=theme-color]').forEach((m, i) => { if (i) m.remove(); else { m.removeAttribute('media'); m.setAttribute('content', v['--bg']); } });
    const b = win.document.body;
    if (b) { b.classList.toggle('theme-xmas', !!t.xmas); }
    if (t.xmas && d.snow && !de.hasAttribute('data-nosnow')) startSnow(); else stopSnow();   // Küchenanzeige: data-nosnow
  }
  // Wechsel des Systemmodus (Automatik) mitverfolgen
  function watch(getDesign) {
    if (!win || !win.matchMedia) return;
    const mq = win.matchMedia('(prefers-color-scheme: dark)'), f = () => apply(getDesign());
    if (mq.addEventListener) mq.addEventListener('change', f); else if (mq.addListener) mq.addListener(f);
  }
  // Früh beim Laden (vor dem ersten Zeichnen): Design aus dem Speicher der Kasse lesen
  function boot() {
    if (!win) return;
    const KEY = /\/kasse-test\//.test(win.location.pathname) ? 'kasse-test-v2' : 'kasse-v2';
    let d = null; try { d = (JSON.parse(win.localStorage.getItem(KEY)) || {}).design; } catch (e) {}
    apply(d); watch(() => { try { return (JSON.parse(win.localStorage.getItem(KEY)) || {}).design; } catch (e) { return null; } });
  }
  if (win) { boot(); if (win.document.readyState === 'loading') win.document.addEventListener('DOMContentLoaded', () => { const d = (() => { try { return (JSON.parse(win.localStorage.getItem(/\/kasse-test\//.test(win.location.pathname) ? 'kasse-test-v2' : 'kasse-v2')) || {}).design; } catch (e) { return null; } })(); apply(d); }); }

  return { THEMES, SWATCHES, XMAS_TILES, DEFAULT, LOGO_OP, resolve, scheme, vars, apply, mix, readable, validHex };
});
