'use strict';
// Preise in Cent, damit nie Rundungsfehler entstehen.
const DEFAULT_STANDS = [
  { id: 'crepes', label: 'Crêpes', groups: [
    { name: 'Crêpes', color: '#FF9F0A', items: [
      { id: 'c-zimt',   name: 'Zimt und Zucker', price: 300 },
      { id: 'c-apfel',  name: 'Apfelmus', price: 350 },
      { id: 'c-nutella', name: 'Nutella', price: 400 },
      { id: 'c-nutbana', name: 'Nutella Banane', price: 450 },
      { id: 'c-kaese',  name: 'Käse', price: 350 },
      { id: 'c-kraeuter', name: 'Käse mit Kräutern / Röstzwiebeln', price: 400 },
      { id: 'c-schinken', name: 'Käse mit Schinken', price: 450 },
    ]},
  ]},
  { id: 'burger', label: 'Burger & Spezi', groups: [
    { name: 'Maultaschenburger', color: '#34C759', items: [
      { id: 'b-maul', name: 'Maultaschen auf karamellisierten Zwiebeln', sub: 'Vegi- oder Fleischfüllung', price: 600 },
      { id: 'b-spezial', name: 'Glabbicher Weihnachtsmarkt Spezial-Maultaschenburger', price: 750 },
    ]},
    { name: 'Getränke', color: '#30B0C7', items: [
      { id: 'g-spezi', name: 'Paulaner Spezi', sub: '0,5 l', price: 300 },
    ]},
  ]},
  { id: 'karten', label: 'Karten', groups: [
    { name: 'Handgemachte Weihnachtskarten', color: '#FF3B30', items: [
      { id: 'k-1', name: 'Eine Karte', price: 300 },
      { id: 'k-2', name: 'Zwei Karten', price: 500 },
    ]},
  ]},
];
const KEY = 'kasse-v2';
const $ = s => document.querySelector(s);
const euro = c => (c / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
const items = s => s.groups.flatMap(g => g.items);

const defVat = id => (id === 'g-spezi' || id.startsWith('k-')) ? 19 : 7;
const clone = o => JSON.parse(JSON.stringify(o));
const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const PALETTE = ['#FF9F0A', '#34C759', '#30B0C7', '#FF3B30', '#AF52DE', '#5856D6', '#FF2D55', '#007AFF'];

let state = { stand: DEFAULT_STANDS[0].id, cart: {}, sales: [], seq: 0, pw: null, backup: null, migrated: false, catalog: null, vat: { on: false }, paypal: '', receipt: { on: true, name: '', addr: '', tax: '', foot: 'Vielen Dank für Ihren Einkauf!' } };
try { Object.assign(state, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) {}
let STANDS, ALL = {};
function setCatalog(c) {
  STANDS = state.catalog = c;
  STANDS.forEach(s => s.groups.forEach((g, i) => { if (!g.id) g.id = s.id + '-g' + i; g.items.forEach(it => { if (typeof it.vat !== 'number') it.vat = defVat(it.id); }); }));
  ALL = {};
  STANDS.forEach(s => s.groups.forEach(g => g.items.forEach(it => { ALL[it.id] = { ...it, stand: s.id }; })));
  if (!STANDS.some(s => s.id === state.stand)) state.stand = STANDS[0].id;
}
setCatalog(Array.isArray(state.catalog) && state.catalog.length ? state.catalog : clone(DEFAULT_STANDS));
let editing = false;
if (state.paypal) state.paypal = normalizeLink(state.paypal); // alte, fehlerhaft gespeicherte Links reparieren
// MwSt.: Preise sind Bruttopreise. Vorschlagswerte (bitte prüfen!): Speisen 7 %, Getränke und Karten 19 %. Je Produkt änderbar.
const vatOf = (info, id) => info && info[id] && typeof info[id].vat === 'number' ? info[id].vat : (ALL[id] ? ALL[id].vat : 7);
const vatPart = (gross, r) => Math.round(gross * r / (100 + r));
const pct = r => String(r).replace('.', ',') + ' %';
const vatText = gr => { const e = Object.entries(gr).sort((a, b) => a[0] - b[0]); const v = e.reduce((s, [r, g]) => s + vatPart(g, +r), 0), g = e.reduce((s, [, x]) => s + x, 0);
  return { vat: v, net: g - v, text: `Netto ${euro(g - v)} · ` + e.map(([r, x]) => `MwSt ${pct(r)}: ${euro(vatPart(x, +r))}`).join(' · ') }; };
// PayPal-Link bereinigen: doppeltes https://, fehlendes https://, Text um den Link herum, Leerzeichen
function normalizeLink(raw) {
  let s = String(raw || '').trim();
  const m = s.match(/https?:\/\/\S+/i);
  if (m) s = m[0];
  s = s.replace(/^(https?:\/\/)+https?:?\/\//i, 'https://');
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s.replace(/^\/+/, '');
  try { const u = new URL(s); return /^https?:$/.test(u.protocol) && u.hostname.includes('.') ? u.href : ''; } catch (e) { return ''; }
}
const snap = lines => Object.fromEntries(Object.keys(lines).filter(id => ALL[id]).map(id => [id, { name: ALL[id].name, price: ALL[id].price, vat: ALL[id].vat }]));
const labelOf = id => { const s = STANDS.find(x => x.id === id); if (s) return s.label; const k = state.sales.find(x => x.stand === id); return (k && k.sl) || 'Gelöschte Seite'; };
const itemName = (s, id) => (s.info && s.info[id] ? s.info[id].name : ALL[id] ? ALL[id].name : 'Gelöschter Artikel');
// Übernahme der Zähler aus der Vorgängerversion (v1: nur Zähler, keine Buchungen)
if (!state.migrated) {
  try {
    const old = JSON.parse(localStorage.getItem('kasse-v1'));
    const by = {};
    for (const [id, n] of Object.entries((old && old.counts) || {})) if (n > 0 && ALL[id]) (by[ALL[id].stand] = by[ALL[id].stand] || {})[id] = n;
    for (const [st, lines] of Object.entries(by)) {
      const total = Object.entries(lines).reduce((a, [id, n]) => a + ALL[id].price * n, 0);
      state.sales.push({ n: ++state.seq, t: Date.now(), stand: st, sl: labelOf(st), lines, info: snap(lines), total, given: total, change: 0, void: false, note: 'Übernommen aus Vorversion' });
    }
  } catch (e) {}
  state.migrated = true;
}
const hash = location.hash.slice(1);
if (STANDS.some(s => s.id === hash)) state.stand = hash;
if (!STANDS.some(s => s.id === state.stand)) state.stand = STANDS[0].id;

const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} };
const stand = () => STANDS.find(s => s.id === state.stand);
const cart = () => state.cart[state.stand] || (state.cart[state.stand] = {});
const cartTotal = () => Object.entries(cart()).reduce((a, [id, n]) => a + (ALL[id] ? ALL[id].price * n : 0), 0);
const buzz = () => { try { navigator.vibrate && navigator.vibrate(8); } catch (e) {} };

function sold() { // verbuchte (nicht stornierte) Verkäufe; Preise/Namen stammen aus dem Bon-Zeitpunkt
  const perS = {}, revS = {}, rev = {}, cnt = {}, gr = {}, grS = {};
  for (const s of state.sales) if (!s.void) {
    rev[s.stand] = (rev[s.stand] || 0) + s.total;
    const P = perS[s.stand] = perS[s.stand] || {}, R = revS[s.stand] = revS[s.stand] || {};
    for (const [id, n] of Object.entries(s.lines)) {
      const pr = s.info && s.info[id] ? s.info[id].price : ALL[id] ? ALL[id].price : 0;
      P[id] = (P[id] || 0) + n; R[id] = (R[id] || 0) + n * pr; cnt[s.stand] = (cnt[s.stand] || 0) + n;
      const v = vatOf(s.info, id); gr[v] = (gr[v] || 0) + n * pr; (grS[s.stand] = grS[s.stand] || {})[v] = ((grS[s.stand] || {})[v] || 0) + n * pr;
    }
  }
  return { perS, revS, rev, cnt, gr, grS };
}

function cartAdd(id, d) {
  const c = cart();
  c[id] = (c[id] || 0) + d;
  if (c[id] <= 0) delete c[id];
  save(); update();
}

function build() {
  document.body.classList.toggle('editing', editing);
  $('#tabs').innerHTML = STANDS.map(s =>
    `<button role="tab" data-stand="${s.id}" aria-selected="${s.id === state.stand}">${esc(s.label)}</button>`).join('')
    + (editing ? '<button data-addstand aria-label="Seite hinzufügen">＋</button>' : '');
  const s = stand();
  $('#title').textContent = s.label;
  $('#edit-bar').hidden = !editing;
  if (editing) return buildEdit();
  $('#main').innerHTML = s.groups.map(g => `
    <section class="group" style="--accent:${g.color}">
      <h2>${esc(g.name)}</h2>
      <div class="grid n${g.items.length}">${g.items.map(it => `
        <div class="tile-wrap">
          <button class="tile" data-add="${it.id}" aria-label="${esc(it.name)} zum Bon hinzufügen">
            <span class="badge" data-count="${it.id}">0</span>
            <span class="name">${esc(it.name)}</span>
            ${it.sub ? `<span class="sub">${esc(it.sub)}</span>` : ''}
            <span class="price">${euro(it.price)}</span>
            <span class="rev" data-sold="${it.id}"></span>
          </button>
          <button class="minus" data-sub="${it.id}" aria-label="${esc(it.name)} vom Bon entfernen">−</button>
        </div>`).join('')}
      </div>
    </section>`).join('') || '<p class="empty">Diese Seite hat noch keine Produkte. Bearbeitungsmodus: Titel 5× antippen → Verwaltung.</p>';
  update();
}

function buildEdit() {
  const s = stand();
  $('#edit-bar').innerHTML = `<span class="eb-t">Bearbeitungsmodus · Seite „${esc(s.label)}“</span><span class="eb-a">
    <button class="btn" data-renamestand>Seite umbenennen</button><button class="btn destructive" data-delstand>Seite löschen</button>
    <button class="btn primary" data-editdone>Fertig</button></span>`;
  $('#main').innerHTML = s.groups.map((g, i) => `
    <section class="group" style="--accent:${g.color}">
      <div class="g-head"><h2>${esc(g.name)}</h2><span class="g-actions">
        <button class="btn sm" data-gup="${g.id}" ${i === 0 ? 'disabled' : ''} aria-label="Nach oben">↑</button>
        <button class="btn sm" data-gdown="${g.id}" ${i === s.groups.length - 1 ? 'disabled' : ''} aria-label="Nach unten">↓</button>
        <button class="btn sm" data-gren="${g.id}">Umbenennen</button>
        <button class="btn sm destructive" data-gdel="${g.id}">Löschen</button></span></div>
      <div class="grid">${g.items.map(it => `
        <div class="tile-wrap"><button class="tile edit" data-edit="${it.id}">
          <span class="pencil">✎</span><span class="name">${esc(it.name)}</span>
          ${it.sub ? `<span class="sub">${esc(it.sub)}</span>` : ''}<span class="price">${euro(it.price)}</span></button></div>`).join('')}
        <div class="tile-wrap"><button class="tile add-tile" data-newitem="${g.id}">＋ Produkt</button></div>
      </div>
    </section>`).join('') + '<button class="btn wide" data-newgroup>＋ Unterkategorie hinzufügen</button>';
}

function update() {
  if (editing) return;
  const s = stand(), c = cart(), { perS } = sold(), per = perS[state.stand] || {};
  for (const it of items(s)) {
    const n = c[it.id] || 0;
    const b = document.querySelector(`[data-count="${it.id}"]`);
    b.textContent = n; b.closest('.tile').classList.toggle('has', n > 0);
    document.querySelector(`[data-sold="${it.id}"]`).textContent = per[it.id] ? `verkauft: ${per[it.id]}` : '';
    document.querySelector(`[data-sub="${it.id}"]`).disabled = !n;
  }
  const lines = items(s).filter(it => c[it.id]);
  $('#bon-lines').innerHTML = lines.length ? lines.map(it => `
    <li><span class="bl-n">${c[it.id]}×</span><span class="bl-name">${esc(it.name)}</span>
    <span class="bl-sum">${euro(c[it.id] * it.price)}</span>
    <button class="bl-minus" data-sub="${it.id}" aria-label="${esc(it.name)} entfernen">−</button></li>`).join('')
    : '<li class="empty">Kachel antippen, um einen Artikel hinzuzufügen</li>';
  const t = cartTotal();
  $('#bon-sum').textContent = euro(t);
  const bg = {}; for (const [id, n] of Object.entries(c)) if (ALL[id]) bg[ALL[id].vat] = (bg[ALL[id].vat] || 0) + n * ALL[id].price;
  $('#bon-vat').innerHTML = state.vat.on && t ? Object.entries(bg).sort((x, y) => x[0] - y[0]).map(([r, g]) => `<div><span>darin MwSt ${pct(r)}</span><span>${euro(vatPart(g, +r))}</span></div>`).join('') : '';
  $('#pay').disabled = $('#clear').disabled = t === 0;
  $('#pay').textContent = t ? `Bezahlen · ${euro(t)}` : 'Bezahlen';
}

// --- Schnelles Tippen: Artikel landet schon beim Aufsetzen des Fingers auf dem Bon
document.addEventListener('pointerdown', e => {
  if (e.button > 0) return;
  const t = e.target.closest('[data-add]'); if (!t) return;
  cartAdd(t.dataset.add, 1); buzz();
  const b = t.querySelector('.badge'); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
});

// --- Bezahlen / Wechselgeld
let given = '', method = 'bar';
const parse = s => { if (!s) return null; const v = parseFloat(s.replace(',', '.')); return isNaN(v) ? null : Math.round(v * 100); };
function paypalUrl(total) {
  try {
    const u = new URL(normalizeLink(state.paypal)), seg = u.pathname.split('/').filter(Boolean);
    if (/(^|\.)paypal\.me$/i.test(u.hostname) && seg.length === 1) return `${u.origin}/${seg[0]}/${(total / 100).toFixed(2)}EUR`; // Betrag wird eingetragen
    return u.href;
  } catch (e) { return ''; }
}
function qrSvg(url) { try { const qr = qrcode(0, 'M'); qr.addData(url); qr.make(); return qr.createSvgTag({ scalable: true, margin: 2 }); } catch (e) { return ''; } }
function payUpdate() {
  const total = cartTotal(), g = parse(given), ch = $('#p-change'), pp = method === 'paypal';
  $('#p-total').textContent = euro(total);
  document.querySelectorAll('#p-method button').forEach(b => b.setAttribute('aria-selected', b.dataset.method === method));
  ['#p-cash', '#p-given-l', '#p-given', '#p-change'].forEach(s => $(s).hidden = pp);
  $('#p-qr').hidden = !pp;
  $('#p-ok').textContent = pp ? 'PayPal-Zahlung erhalten · Verbuchen' : 'Verbuchen';
  if (pp) {
    const url = state.paypal ? paypalUrl(total) : '';
    const svg = url ? qrSvg(url) : '';
    $('#p-qr-img').innerHTML = svg || '<p class="err">Kein gültiger PayPal-Link hinterlegt.<br>Bitte in der Verwaltung festlegen.</p>';
    $('#p-ok').disabled = false; return;
  }
  $('#p-given').textContent = given ? given + ' €' : '–';
  ch.className = 'change';
  if (g === null) ch.innerHTML = '<span class="cap">Rückgeld</span><b>–</b>';
  else if (g >= total) { ch.classList.add('ok'); ch.innerHTML = `<span class="cap">Rückgeld</span><b>${euro(g - total)}</b>`; }
  else { ch.classList.add('short'); ch.innerHTML = `<span class="cap">Es fehlen</span><b>${euro(total - g)}</b>`; }
  $('#p-ok').disabled = g === null || g < total;
}
function openPay() { if (!cartTotal()) return; given = ''; method = 'bar'; payUpdate(); $('#pay-dlg').showModal(); }
function key(k) {
  if (k === 'back') given = given.slice(0, -1);
  else if (k === ',') { if (!given.includes(',')) given = (given || '0') + ','; }
  else {
    const dec = given.split(',')[1];
    if (dec !== undefined && dec.length >= 2) return;
    if (given.replace(',', '').length >= 7) return;
    given = given === '0' ? k : given + k;
  }
  payUpdate();
}
function book() {
  const total = cartTotal(), pp = method === 'paypal', g = pp ? total : parse(given); if (g === null || g < total) return;
  state.sales.push({ method, n: ++state.seq, t: Date.now(), stand: state.stand, sl: stand().label, lines: { ...cart() }, info: snap(cart()), total, given: g, change: g - total, void: false });
  state.cart[state.stand] = {}; save(); update(); $('#pay-dlg').close(); buzz(); showToast(state.sales[state.sales.length - 1]);
}

// --- Bestätigungsdialog
function ask(title, text, ok) {
  return new Promise(res => {
    $('#c-title').textContent = title; $('#c-text').textContent = text; $('#c-ok').textContent = ok;
    const d = $('#confirm'); d.returnValue = ''; d.showModal();
    d.addEventListener('close', () => res(d.returnValue === 'ok'), { once: true });
  });
}

// --- Passwort
async function hashPw(s) {
  const data = new TextEncoder().encode('kasse|' + s);
  if (window.crypto && crypto.subtle) { const h = await crypto.subtle.digest('SHA-256', data); return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join(''); }
  let h = 5381; for (const c of s) h = ((h << 5) + h + c.charCodeAt(0)) | 0; return 'x' + h;
}
let pwMode = null;
function pwDialog(mode) {
  pwMode = mode;
  $('#pw-title').textContent = mode === 'enter' ? 'Passwort eingeben' : mode === 'set' ? 'Passwort festlegen' : 'Neues Passwort';
  $('#pw-text').textContent = mode === 'enter' ? 'Die Verwaltung ist geschützt.' : 'Mindestens 4 Zeichen (Buchstaben und Zahlen möglich). Bitte gut merken – ohne Passwort gibt es keinen Zugang zu Storno und Zurücksetzen.';
  $('#pw-input').value = ''; $('#pw-err').textContent = '';
  $('#pw-dlg').showModal(); setTimeout(() => $('#pw-input').focus(), 50);
}
$('#pw-form').addEventListener('submit', async e => {
  e.preventDefault();
  const v = $('#pw-input').value;
  if (pwMode === 'enter') {
    if (await hashPw(v) === state.pw) { $('#pw-dlg').close(); showAdmin(); }
    else { $('#pw-err').textContent = 'Falsches Passwort'; $('#pw-input').value = ''; }
  } else {
    if (v.length < 4) { $('#pw-err').textContent = 'Mindestens 4 Zeichen'; return; }
    state.pw = await hashPw(v); save(); $('#pw-dlg').close();
    if (pwMode === 'set') showAdmin();
  }
});
$('#pw-cancel').addEventListener('click', () => $('#pw-dlg').close());

// --- Verwaltung (extra Seite): Buchungen, Storno, Speichern
function openAdmin() { hold = null; buzz(); pwDialog(state.pw ? 'enter' : 'set'); }
function showAdmin() { renderAdmin(); $('#admin').hidden = false; document.body.classList.add('noscroll'); }
function hideAdminKeep() { $('#admin').hidden = true; document.body.classList.remove('noscroll'); }
function hideAdmin() { hideAdminKeep(); build(); }
const fmtTS = t => new Date(t).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
const fmtT = t => new Date(t).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const lineText = s => Object.entries(s.lines).map(([id, n]) => `${n}× ${itemName(s, id)}`).join(', ');
const standIds = () => { const ids = STANDS.map(s => s.id); state.sales.forEach(s => { if (!ids.includes(s.stand)) ids.push(s.stand); }); return ids; };
const payTotals = () => state.sales.reduce((o, s) => { if (!s.void) o[s.method === 'paypal' ? 'paypal' : 'bar'] += s.total; return o; }, { bar: 0, paypal: 0 });
function renderAdmin() {
  const { rev, cnt, gr, grS } = sold();
  $('#vat-toggle').checked = state.vat.on;
  $('#rc-toggle').checked = state.receipt.on;
  $('#paypal-state').textContent = state.paypal ? `Hinterlegt: ${state.paypal}` : 'Noch kein Link hinterlegt.';
  $('#paypal-off').hidden = !state.paypal;
  const pv = state.paypal ? paypalUrl(1000) : '';
  $('#paypal-preview').innerHTML = pv ? `<div class="pv">${qrSvg(pv)}</div><small class="muted">Vorschau des QR-Codes (Beispiel 10,00 €):<br>${esc(pv)}<br>Scanne ihn einmal mit dem Handy und prüfe den Empfänger.</small>` : '';
  $('#vat-summary').hidden = !state.vat.on;
  if (state.vat.on) {
    const rates = Object.keys(gr).sort((x, y) => x - y), T = vatText(gr);
    $('#vat-summary').innerHTML = '<h3>Mehrwertsteuer (enthalten in den Bruttopreisen)</h3>' + (rates.length ? rates.map(r => `<div class="sum-row vat"><span>Satz ${pct(r)}</span><span>Brutto ${euro(gr[r])} · Netto ${euro(gr[r] - vatPart(gr[r], +r))}</span><b>${euro(vatPart(gr[r], +r))}</b></div>`).join('') + `<div class="sum-row total"><span>Gesamt MwSt</span><span>Brutto ${euro(Object.values(gr).reduce((s, x) => s + x, 0))} · Netto ${euro(T.net)}</span><b>${euro(T.vat)}</b></div>` : '<p class="empty">Noch keine Verkäufe.</p>');
  }
  const pay = payTotals();
  $('#admin-summary').innerHTML = '<h3>Zwischenstand dieses Geräts</h3>' + standIds().map(id => {
    const k = state.sales.filter(x => x.stand === id), g = k.filter(x => !x.void).length, v = k.length - g;
    return `<div class="sum-row"><span>${esc(labelOf(id))}</span><span>${g} ${g === 1 ? 'Buchung' : 'Buchungen'} · ${cnt[id] || 0} Artikel${v ? ` · ${v} storniert` : ''}</span><b>${euro(rev[id] || 0)}</b></div>${state.vat.on && grS[id] ? `<div class="vat-sub">${vatText(grS[id]).text}</div>` : ''}`;
  }).join('') + `<div class="sum-row total"><span>Gesamt</span><span>Bar ${euro(pay.bar)} · PayPal ${euro(pay.paypal)}</span><b>${euro(Object.values(rev).reduce((a, b) => a + b, 0))}</b></div>`;
  $('#restore').hidden = !state.backup;
  const saleVat = s => { const g = {}; for (const [id, n] of Object.entries(s.lines)) { const pr = s.info && s.info[id] ? s.info[id].price : ALL[id] ? ALL[id].price : 0, r = vatOf(s.info, id); g[r] = (g[r] || 0) + n * pr; } return vatText(g).vat; };
  const list = [...state.sales].reverse();
  $('#sales-list').innerHTML = list.length ? list.map(s => `
    <div class="sale${s.void ? ' void' : ''}">
      <div class="sale-main">
        <div class="sale-head"><b>#${s.n}</b> · ${fmtTS(s.t)} · ${esc(labelOf(s.stand))}${s.method === 'paypal' ? ' · <span class="tag pp">PayPal</span>' : ''}${s.void ? ' · <span class="tag">storniert</span>' : ''}</div>
        <div class="sale-lines">${esc(lineText(s))}</div>
        <div class="sale-pay">${s.note ? esc(s.note) : s.method === 'paypal' ? 'Bezahlt mit PayPal' : `Gegeben ${euro(s.given)} · Rückgeld ${euro(s.change)}`}${state.vat.on ? ` · MwSt ${euro(saleVat(s))}` : ''}</div>
      </div>
      <b class="sale-sum">${euro(s.total)}</b>
      <div class="sale-btns">${state.receipt.on ? `<button class="btn" data-pdf="${s.n}">PDF</button><button class="btn" data-print="${s.n}">Drucken</button>` : ''}
      <button class="btn ${s.void ? '' : 'destructive'}" data-void="${s.n}">${s.void ? 'Storno aufheben' : 'Stornieren'}</button></div>
    </div>`).join('') : '<p class="empty">Noch keine Buchungen.</p>';
}

// --- Speichern: CSV-Datei (iPad: „In Dateien sichern“ / Teilen-Menü, Android: Download)
async function exportFile() {
  const d = new Date(), p = n => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  const q = v => `"${String(v).replace(/"/g, '""')}"`, num = c => (c / 100).toFixed(2).replace('.', ','), row = a => a.map(q).join(';');
  const { perS, revS, rev, gr, grS } = sold(), V = state.vat.on;
  const rows = [row(['Stand', 'Produkt', 'Einzelpreis (€)', 'Anzahl', 'Umsatz (€)'].concat(V ? ['MwSt-Satz', 'MwSt (€)'] : []))];
  let all = 0;
  for (const sid of standIds()) {
    const cat = STANDS.find(s => s.id === sid), seen = new Set();
    const add = (id, name, price, r) => { seen.add(id); const g = (revS[sid] || {})[id] || 0; rows.push(row([labelOf(sid), name, price === null ? '' : num(price), (perS[sid] || {})[id] || 0, num(g)].concat(V ? [pct(r), num(vatPart(g, r))] : []))); };
    if (cat) items(cat).forEach(it => add(it.id, it.name + (it.sub ? ` (${it.sub})` : ''), it.price, it.vat));
    for (const id of Object.keys(perS[sid] || {})) if (!seen.has(id)) {
      const k = state.sales.find(x => x.stand === sid && x.info && x.info[id]);
      add(id, (k ? k.info[id].name : 'Gelöschter Artikel') + ' (nicht mehr im Sortiment)', k ? k.info[id].price : null, vatOf(k && k.info, id));
    }
    rows.push(row([labelOf(sid), 'SUMME', '', '', num(rev[sid] || 0)].concat(V ? ['', num(vatText(grS[sid] || {}).vat)] : []))); all += rev[sid] || 0;
  }
  rows.push(row(['', 'GESAMT (dieses Gerät)', '', '', num(all)]), row(['', 'davon Bar', '', '', num(payTotals().bar)]), row(['', 'davon PayPal', '', '', num(payTotals().paypal)]), row(['Stand der Daten', stamp]));
  if (V) { rows.push('', row(['Mehrwertsteuer', 'Satz', 'Brutto (€)', 'Netto (€)', 'MwSt (€)'])); for (const r of Object.keys(gr).sort((x, y) => x - y)) rows.push(row(['', pct(r), num(gr[r]), num(gr[r] - vatPart(gr[r], +r)), num(vatPart(gr[r], +r))])); const T = vatText(gr); rows.push(row(['', 'GESAMT', num(all), num(T.net), num(T.vat)])); }
  rows.push('', row(['Bon-Nr.', 'Zeit', 'Stand', 'Artikel', 'Summe (€)', 'Gegeben (€)', 'Rückgeld (€)', 'Status', 'Zahlart'].concat(V ? ['MwSt (€)'] : [])));
  for (const s of state.sales) rows.push(row([s.n, fmtTS(s.t), labelOf(s.stand), lineText(s), num(s.total), num(s.given), num(s.change), s.void ? 'storniert' : 'gültig', s.method === 'paypal' ? 'PayPal' : 'Bar'].concat(V ? [num((() => { const g = {}; for (const [id, n] of Object.entries(s.lines)) { const pr = s.info && s.info[id] ? s.info[id].price : ALL[id] ? ALL[id].price : 0, r = vatOf(s.info, id); g[r] = (g[r] || 0) + n * pr; } return vatText(g).vat; })())] : [])));
  const name = `kasse-${stamp.replace(' ', '-').replace(':', '')}.csv`;
  const file = new File(['\ufeff' + rows.join('\r\n')], name, { type: 'text/csv' });
  try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Kasse' }); return; } }
  catch (err) { if (err.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// --- Bearbeitungsmodus: Produkte, Unterkategorien und Seiten
function promptText(title, value = '', placeholder = '') {
  return new Promise(res => {
    $('#t-title').textContent = title; $('#t-input').value = value; $('#t-input').placeholder = placeholder; $('#t-err').textContent = '';
    const d = $('#text-dlg'); d.returnValue = ''; d.showModal(); setTimeout(() => $('#t-input').focus(), 50);
    const f = $('#text-form'), done = ok => { f.onsubmit = null; $('#t-cancel').onclick = null; d.close(); res(ok ? $('#t-input').value.trim() : null); };
    f.onsubmit = e => { e.preventDefault(); if (!$('#t-input').value.trim()) { $('#t-err').textContent = 'Bitte einen Namen eingeben'; return; } done(true); };
    $('#t-cancel').onclick = () => done(false);
  });
}
const findGroup = id => stand().groups.find(g => g.id === id);
const commit = () => { setCatalog(STANDS); save(); build(); };
let editItemId = null, editGroupId = null;
function openItem(id, gid) {
  editItemId = id; editGroupId = gid;
  const it = id ? ALL[id] : { name: '', sub: '', price: 0, vat: 7 };
  $('#i-vat').value = String(it.vat);
  const g = id ? stand().groups.find(x => x.items.some(i => i.id === id)) : findGroup(gid);
  $('#i-title').textContent = id ? 'Produkt bearbeiten' : 'Neues Produkt';
  $('#i-name').value = it.name; $('#i-sub').value = it.sub || '';
  $('#i-price').value = id ? (it.price / 100).toFixed(2).replace('.', ',') : '';
  $('#i-group').innerHTML = stand().groups.map(x => `<option value="${x.id}" ${g && x.id === g.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
  $('#i-del').hidden = !id; $('#i-err').textContent = '';
  $('#item-dlg').showModal(); if (!id) setTimeout(() => $('#i-name').focus(), 50);
}
$('#item-form').addEventListener('submit', e => {
  e.preventDefault();
  const name = $('#i-name').value.trim(), sub = $('#i-sub').value.trim(), price = parse($('#i-price').value.trim()), gid = $('#i-group').value, vat = +$('#i-vat').value;
  if (!name) { $('#i-err').textContent = 'Bitte einen Namen eingeben'; return; }
  if (price === null || price < 0) { $('#i-err').textContent = 'Bitte einen Preis eingeben, z. B. 3,50'; return; }
  const target = findGroup(gid);
  if (editItemId) {
    const from = stand().groups.find(x => x.items.some(i => i.id === editItemId)), it = from.items.find(i => i.id === editItemId);
    Object.assign(it, { name, price, vat }); if (sub) it.sub = sub; else delete it.sub;
    if (from !== target) { from.items.splice(from.items.indexOf(it), 1); target.items.push(it); }
  } else target.items.push(sub ? { id: uid('i'), name, sub, price, vat } : { id: uid('i'), name, price, vat });
  $('#item-dlg').close(); commit();
});
$('#i-cancel').addEventListener('click', () => $('#item-dlg').close());
$('#i-del').addEventListener('click', async () => {
  const it = ALL[editItemId];
  if (!await ask('Produkt löschen?', `„${it.name}“ wird aus dem Sortiment entfernt. Bereits verbuchte Verkäufe bleiben erhalten.`, 'Löschen')) return;
  stand().groups.forEach(g => { g.items = g.items.filter(i => i.id !== editItemId); });
  Object.values(state.cart).forEach(c => delete c[editItemId]);
  $('#item-dlg').close(); commit();
});

async function editAction(t) {
  const d = t.dataset, s = stand();
  if (d.edit) openItem(d.edit);
  else if (d.newitem) openItem(null, d.newitem);
  else if (d.newgroup !== undefined) {
    const n = await promptText('Neue Unterkategorie'); if (!n) return;
    s.groups.push({ id: uid('g'), name: n, color: PALETTE[STANDS.reduce((a, x) => a + x.groups.length, 0) % PALETTE.length], items: [] }); commit();
  }
  else if (d.gren) { const g = findGroup(d.gren), n = await promptText('Unterkategorie umbenennen', g.name); if (n) { g.name = n; commit(); } }
  else if (d.gdel) {
    const g = findGroup(d.gdel);
    if (await ask('Unterkategorie löschen?', `„${g.name}“ mit ${g.items.length} Produkt(en) wird entfernt. Bereits verbuchte Verkäufe bleiben erhalten.`, 'Löschen')) {
      g.items.forEach(i => Object.values(state.cart).forEach(c => delete c[i.id])); s.groups = s.groups.filter(x => x !== g); commit();
    }
  }
  else if (d.gup || d.gdown) {
    const i = s.groups.findIndex(g => g.id === (d.gup || d.gdown)), j = d.gup ? i - 1 : i + 1;
    if (j >= 0 && j < s.groups.length) { [s.groups[i], s.groups[j]] = [s.groups[j], s.groups[i]]; commit(); }
  }
  else if (d.addstand !== undefined) {
    const n = await promptText('Neue Seite'); if (!n) return;
    const ns = { id: uid('s'), label: n, groups: [] }; STANDS.push(ns); state.stand = ns.id; history.replaceState(null, '', '#' + ns.id); commit();
  }
  else if (d.renamestand !== undefined) { const n = await promptText('Seite umbenennen', s.label); if (n) { s.label = n; commit(); } }
  else if (d.delstand !== undefined) {
    if (STANDS.length < 2) { await ask('Nicht möglich', 'Die letzte Seite kann nicht gelöscht werden.', 'OK'); return; }
    if (await ask('Seite löschen?', `„${s.label}“ mit allen Produkten wird entfernt. Bereits verbuchte Verkäufe bleiben in der Verwaltung erhalten.`, 'Löschen')) {
      delete state.cart[s.id]; STANDS.splice(STANDS.indexOf(s), 1); state.stand = STANDS[0].id; history.replaceState(null, '', '#' + state.stand); commit();
    }
  }
  else if (d.editdone !== undefined) { editing = false; build(); }
}

// --- Klicks
document.addEventListener('click', async e => {
  const t = e.target.closest('button'); if (!t) return;
  const D = t.dataset;
  if (D.edit || D.newitem || D.newgroup !== undefined || D.gren || D.gdel || D.gup || D.gdown || D.addstand !== undefined || D.renamestand !== undefined || D.delstand !== undefined || D.editdone !== undefined) return editAction(t);
  if (t.id === 'vat-toggle' || t.id === 'rc-toggle') return;
  if (D.pdf) { sharePdf(+D.pdf); return; }
  if (D.print) { printBon(+D.print); return; }
  if (t.id === 'toast-x') { $('#toast').hidden = true; return; }
  if (t.id === 'rc-head') { openReceiptHead(); return; }
  if (D.method) { method = D.method; payUpdate(); return; }
  if (t.id === 'paypal-link') {
    const n = await promptText('PayPal-Link einfügen', state.paypal || '', 'https://paypal.me/DeinName');
    if (n) { const u = normalizeLink(n); if (u) { state.paypal = u; save(); renderAdmin(); } else await ask('Link nicht erkannt', 'Bitte den Link so einfügen, wie ihn PayPal anzeigt, z. B. https://paypal.me/DeinName', 'OK'); }
    return;
  }
  if (t.id === 'paypal-off') { state.paypal = ''; save(); renderAdmin(); return; }
  if (t.id === 'edit-mode') { hideAdminKeep(); editing = true; build(); return; }
  if (t.id === 'defaults') {
    if (await ask('Sortiment zurücksetzen?', 'Alle eigenen Seiten, Kategorien und Produkte werden durch das ursprüngliche Sortiment ersetzt. Bereits verbuchte Verkäufe bleiben erhalten.', 'Zurücksetzen')) { state.cart = {}; setCatalog(clone(DEFAULT_STANDS)); save(); build(); renderAdmin(); }
    return;
  }
  if (t.dataset.add) { if (e.detail === 0) cartAdd(t.dataset.add, 1); } // nur Tastatur; Touch läuft über pointerdown
  else if (t.dataset.sub) cartAdd(t.dataset.sub, -1);
  else if (t.dataset.stand) { state.stand = t.dataset.stand; save(); history.replaceState(null, '', '#' + state.stand); build(); }
  else if (t.id === 'pay') openPay();
  else if (t.id === 'clear') { state.cart[state.stand] = {}; save(); update(); }
  else if (t.dataset.key) key(t.dataset.key);
  else if (t.dataset.quick) { given = t.dataset.quick === 'total' ? (cartTotal() / 100).toFixed(2).replace('.', ',').replace(/,00$/, '') : t.dataset.quick; payUpdate(); }
  else if (t.id === 'p-ok') book();
  else if (t.id === 'p-cancel') $('#pay-dlg').close();
  else if (t.id === 'admin-close') hideAdmin();
  else if (t.id === 'save') exportFile();
  else if (t.id === 'pw-change') pwDialog('change');
  else if (t.dataset.void) {
    const s = state.sales.find(x => x.n === +t.dataset.void); if (!s) return;
    const ok = await ask(s.void ? 'Storno aufheben?' : `Bon #${s.n} stornieren?`, `${lineText(s)} · ${euro(s.total)}`, s.void ? 'Aufheben' : 'Stornieren');
    if (ok) { s.void = !s.void; save(); renderAdmin(); }
  }
  else if (t.id === 'wipe') {
    if (await ask('Alle Buchungen löschen?', `${state.sales.length} Buchungen werden von diesem Gerät gelöscht. Sie werden vorher intern gesichert und lassen sich wiederherstellen. Tipp: erst „Zahlen speichern“.`, 'Löschen')) {
      state.backup = { sales: state.sales, seq: state.seq }; state.sales = []; state.seq = 0; save(); renderAdmin();
    }
  }
  else if (t.id === 'restore' && state.backup) { state.sales = state.backup.sales; state.seq = state.backup.seq; state.backup = null; save(); renderAdmin(); }
});
$('#pay-dlg').addEventListener('cancel', () => {}); // Esc schließt wie Abbrechen

// --- Bons: Zeitstempel, PDF und Druck
const WIN = { '€': 0x80, '‚': 0x82, '„': 0x84, '…': 0x85, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '–': 0x96, '—': 0x97 };
const enc = s => [...s.replace(/ | /g, ' ')].map(c => WIN[c] !== undefined ? String.fromCharCode(WIN[c]) : c.charCodeAt(0) < 256 ? c : '?').join('');
function wrapText(t, n) {
  const out = []; let cur = '';
  for (let w of String(t).split(/\s+/).filter(Boolean)) {
    while (w.length > n) { if (cur) { out.push(cur); cur = ''; } out.push(w.slice(0, n)); w = w.slice(n); }
    if (!cur) cur = w; else if ((cur + ' ' + w).length <= n) cur += ' ' + w; else { out.push(cur); cur = w; }
  }
  if (cur) out.push(cur); return out.length ? out : [''];
}
const money = c => euro(c).replace(/ | /g, ' ');
function receiptLines(s) {
  const N = 36, L = [], R = state.receipt;
  const l = (t, b) => L.push({ t, b: !!b });
  const c = (t, b) => l(' '.repeat(Math.max(0, Math.floor((N - t.length) / 2))) + t, b);
  const hr = ch => l((ch || '-').repeat(N));
  const lr = (left, right, b) => { const w = wrapText(left, Math.max(8, N - right.length - 1)); w.forEach((x, i) => l(i === w.length - 1 ? x.padEnd(N - right.length) + right : x, b)); };
  if (R.name) wrapText(R.name, N).forEach(x => c(x, true));
  String(R.addr || '').split(/\n|;/).map(x => x.trim()).filter(Boolean).forEach(x => wrapText(x, N).forEach(y => c(y)));
  if (R.tax) c(R.tax);
  if (R.name || R.addr || R.tax) hr();
  if (s.void) { c('*** STORNIERT ***', true); }
  c('BON NR. ' + String(s.n).padStart(4, '0'), true);
  const d = new Date(s.t);
  l('Datum:  ' + d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }));
  l('Uhrzeit: ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  l('Stand:  ' + labelOf(s.stand));
  hr();
  const g = {};
  for (const [id, n] of Object.entries(s.lines)) {
    const pr = s.info && s.info[id] ? s.info[id].price : ALL[id] ? ALL[id].price : 0, r = vatOf(s.info, id);
    lr(`${n}x ${itemName(s, id)}`, money(n * pr));
    if (n > 1) l(`   à ${money(pr)}`);
    g[r] = (g[r] || 0) + n * pr;
  }
  hr(); lr('SUMME', money(s.total), true);
  if (s.method === 'paypal') lr('Bezahlt mit PayPal', money(s.total));
  else if (!s.note) { lr('Bar gegeben', money(s.given)); lr('Rückgeld', money(s.change)); }
  if (state.vat.on) {
    hr(); l('Enthaltene MwSt.:'); const T = vatText(g);
    Object.entries(g).sort((x, y) => x[0] - y[0]).forEach(([r, x]) => lr(`  MwSt ${pct(r)} (brutto ${money(x)})`, money(vatPart(x, +r))));
    lr('  Netto gesamt', money(T.net));
  }
  hr(); l('Gedruckt: ' + new Date().toLocaleString('de-DE'));
  if (R.foot) { l(''); wrapText(R.foot, N).forEach(x => c(x)); }
  if (s.void) { l(''); c('*** STORNIERT ***', true); }
  return L;
}
function makePdf(lines) {
  const FS = 9, LH = 12.5, M = 14, W = 227, H = Math.max(120, lines.length * LH + 2 * M);
  const esc2 = s => s.replace(/[\\()]/g, m => '\\' + m);
  const content = lines.map((l, i) => `BT /${l.b ? 'F2' : 'F1'} ${FS} Tf ${M} ${(H - M - FS - i * LH).toFixed(2)} Td (${esc2(enc(l.t))}) Tj ET`).join('\n');
  let out = '%PDF-1.4\n'; const offs = [];
  const add = (n, body) => { offs[n] = out.length; out += `${n} 0 obj\n${body}\nendobj\n`; };
  add(1, '<< /Type /Catalog /Pages 2 0 R >>'); add(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  add(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H.toFixed(2)}] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>`);
  add(4, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  add(5, '<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>');
  add(6, '<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>');
  const x = out.length;
  out += 'xref\n0 7\n0000000000 65535 f \n' + [1, 2, 3, 4, 5, 6].map(n => String(offs[n]).padStart(10, '0') + ' 00000 n \n').join('') + `trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;
  const u = new Uint8Array(out.length); for (let i = 0; i < out.length; i++) u[i] = out.charCodeAt(i) & 255; return u;
}
async function sharePdf(n) {
  const s = state.sales.find(x => x.n === n); if (!s) return;
  const d = new Date(s.t), p = k => String(k).padStart(2, '0');
  const name = `bon-${String(n).padStart(4, '0')}-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.pdf`;
  const file = new File([makePdf(receiptLines(s))], name, { type: 'application/pdf' });
  try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: `Bon ${n}` }); return; } }
  catch (err) { if (err.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 8000);
}
function printBon(n) {
  const s = state.sales.find(x => x.n === n); if (!s) return;
  $('#print-area').textContent = receiptLines(s).map(l => l.t).join('\n');
  window.print();
}
let toastTimer = null;
function showToast(s) {
  if (!state.receipt.on || !s) return;
  $('#toast').innerHTML = `<span>Bon #${s.n} gebucht · ${new Date(s.t).toLocaleTimeString('de-DE')}</span><button data-pdf="${s.n}">PDF</button><button data-print="${s.n}">Drucken</button><button id="toast-x" aria-label="Schließen">✕</button>`;
  $('#toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 12000);
}
function openReceiptHead() {
  const R = state.receipt;
  $('#r-name').value = R.name; $('#r-addr').value = R.addr; $('#r-tax').value = R.tax; $('#r-foot').value = R.foot;
  $('#rc-dlg').showModal();
}
$('#rc-form').addEventListener('submit', e => {
  e.preventDefault();
  Object.assign(state.receipt, { name: $('#r-name').value.trim(), addr: $('#r-addr').value.trim(), tax: $('#r-tax').value.trim(), foot: $('#r-foot').value.trim() });
  save(); $('#rc-dlg').close();
});
$('#r-cancel').addEventListener('click', () => $('#rc-dlg').close());
$('#rc-toggle').addEventListener('change', e => { state.receipt.on = e.target.checked; save(); renderAdmin(); });

$('#vat-toggle').addEventListener('change', e => { state.vat.on = e.target.checked; save(); renderAdmin(); });

// --- Versteckter Zugang: Titel 1,5 s halten oder 5× schnell antippen
let hold = null;
const cancelHold = () => { clearTimeout(hold); hold = null; };
$('#title').addEventListener('pointerdown', () => { cancelHold(); hold = setTimeout(openAdmin, 1500); });
['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => $('#title').addEventListener(ev, cancelHold));
$('#title').addEventListener('contextmenu', e => e.preventDefault());
let taps = [];
$('#title').addEventListener('pointerdown', () => { const n = Date.now(); taps = taps.filter(x => n - x < 2500); taps.push(n); if (taps.length >= 5) { taps = []; cancelHold(); openAdmin(); } });

build();
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(r => r.update()).catch(() => {});
  let had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (had && !document.querySelector('dialog[open]') && $('#admin').hidden) location.reload(); had = true; });
}
