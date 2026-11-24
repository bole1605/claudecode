'use strict';
// Preise in Cent, damit nie Rundungsfehler entstehen.
const STANDS = [
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
const ALL = {};
STANDS.forEach(s => s.groups.forEach(g => g.items.forEach(it => { ALL[it.id] = { ...it, stand: s.id }; })));

const KEY = 'kasse-v2';
const $ = s => document.querySelector(s);
const euro = c => (c / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
const items = s => s.groups.flatMap(g => g.items);

let state = { stand: STANDS[0].id, cart: {}, sales: [], seq: 0, pw: null, backup: null, migrated: false };
try { Object.assign(state, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) {}
// Übernahme der Zähler aus der Vorgängerversion (v1: nur Zähler, keine Buchungen)
if (!state.migrated) {
  try {
    const old = JSON.parse(localStorage.getItem('kasse-v1'));
    const by = {};
    for (const [id, n] of Object.entries((old && old.counts) || {})) if (n > 0 && ALL[id]) (by[ALL[id].stand] = by[ALL[id].stand] || {})[id] = n;
    for (const [st, lines] of Object.entries(by)) {
      const total = Object.entries(lines).reduce((a, [id, n]) => a + ALL[id].price * n, 0);
      state.sales.push({ n: ++state.seq, t: Date.now(), stand: st, lines, total, given: total, change: 0, void: false, note: 'Übernommen aus Vorversion' });
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
const cartTotal = () => Object.entries(cart()).reduce((a, [id, n]) => a + ALL[id].price * n, 0);
const buzz = () => { try { navigator.vibrate && navigator.vibrate(8); } catch (e) {} };

function sold() { // verbuchte (nicht stornierte) Verkäufe je Artikel + Umsatz je Stand
  const per = {}, rev = {}, cnt = {};
  for (const s of state.sales) if (!s.void) {
    rev[s.stand] = (rev[s.stand] || 0) + s.total;
    for (const [id, n] of Object.entries(s.lines)) { per[id] = (per[id] || 0) + n; cnt[s.stand] = (cnt[s.stand] || 0) + n; }
  }
  return { per, rev, cnt };
}

function cartAdd(id, d) {
  const c = cart();
  c[id] = (c[id] || 0) + d;
  if (c[id] <= 0) delete c[id];
  save(); update();
}

function build() {
  $('#tabs').innerHTML = STANDS.map(s =>
    `<button role="tab" data-stand="${s.id}" aria-selected="${s.id === state.stand}">${s.label}</button>`).join('');
  const s = stand();
  $('#title').textContent = s.label;
  $('#main').innerHTML = s.groups.map(g => `
    <section class="group" style="--accent:${g.color}">
      <h2>${g.name}</h2>
      <div class="grid n${g.items.length}">${g.items.map(it => `
        <div class="tile-wrap">
          <button class="tile" data-add="${it.id}" aria-label="${it.name} zum Bon hinzufügen">
            <span class="badge" data-count="${it.id}">0</span>
            <span class="name">${it.name}</span>
            ${it.sub ? `<span class="sub">${it.sub}</span>` : ''}
            <span class="price">${euro(it.price)}</span>
            <span class="rev" data-sold="${it.id}"></span>
          </button>
          <button class="minus" data-sub="${it.id}" aria-label="${it.name} vom Bon entfernen">−</button>
        </div>`).join('')}
      </div>
    </section>`).join('');
  update();
}

function update() {
  const s = stand(), c = cart(), { per, rev, cnt } = sold();
  for (const it of items(s)) {
    const n = c[it.id] || 0;
    const b = document.querySelector(`[data-count="${it.id}"]`);
    b.textContent = n; b.closest('.tile').classList.toggle('has', n > 0);
    document.querySelector(`[data-sold="${it.id}"]`).textContent = per[it.id] ? `verkauft: ${per[it.id]}` : '';
    document.querySelector(`[data-sub="${it.id}"]`).disabled = !n;
  }
  const lines = items(s).filter(it => c[it.id]);
  $('#bon-lines').innerHTML = lines.length ? lines.map(it => `
    <li><span class="bl-n">${c[it.id]}×</span><span class="bl-name">${it.name}</span>
    <span class="bl-sum">${euro(c[it.id] * it.price)}</span>
    <button class="bl-minus" data-sub="${it.id}" aria-label="${it.name} entfernen">−</button></li>`).join('')
    : '<li class="empty">Kachel antippen, um einen Artikel hinzuzufügen</li>';
  const t = cartTotal();
  $('#bon-sum').textContent = euro(t);
  $('#pay').disabled = $('#clear').disabled = t === 0;
  $('#pay').textContent = t ? `Bezahlen · ${euro(t)}` : 'Bezahlen';
  $('#total').textContent = euro(rev[state.stand] || 0);
  const n = cnt[state.stand] || 0;
  $('#total-count').textContent = `${n} Artikel verkauft`;
}

// --- Schnelles Tippen: Artikel landet schon beim Aufsetzen des Fingers auf dem Bon
document.addEventListener('pointerdown', e => {
  if (e.button > 0) return;
  const t = e.target.closest('[data-add]'); if (!t) return;
  cartAdd(t.dataset.add, 1); buzz();
  const b = t.querySelector('.badge'); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
});

// --- Bezahlen / Wechselgeld
let given = '';
const parse = s => { if (!s) return null; const v = parseFloat(s.replace(',', '.')); return isNaN(v) ? null : Math.round(v * 100); };
function payUpdate() {
  const total = cartTotal(), g = parse(given), ch = $('#p-change');
  $('#p-total').textContent = euro(total);
  $('#p-given').textContent = given ? given + ' €' : '–';
  ch.className = 'change';
  if (g === null) ch.innerHTML = '<span class="cap">Rückgeld</span><b>–</b>';
  else if (g >= total) { ch.classList.add('ok'); ch.innerHTML = `<span class="cap">Rückgeld</span><b>${euro(g - total)}</b>`; }
  else { ch.classList.add('short'); ch.innerHTML = `<span class="cap">Es fehlen</span><b>${euro(total - g)}</b>`; }
  $('#p-ok').disabled = g === null || g < total;
}
function openPay() { if (!cartTotal()) return; given = ''; payUpdate(); $('#pay-dlg').showModal(); }
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
  const g = parse(given), total = cartTotal(); if (g === null || g < total) return;
  state.sales.push({ n: ++state.seq, t: Date.now(), stand: state.stand, lines: { ...cart() }, total, given: g, change: g - total, void: false });
  state.cart[state.stand] = {}; save(); update(); $('#pay-dlg').close(); buzz();
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
  $('#pw-text').textContent = mode === 'enter' ? 'Die Verwaltung ist geschützt.' : 'Mindestens 4 Zeichen. Bitte gut merken – ohne Passwort gibt es keinen Zugang zu Storno und Zurücksetzen.';
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
function hideAdmin() { $('#admin').hidden = true; document.body.classList.remove('noscroll'); update(); }
const fmtT = t => new Date(t).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const lineText = lines => Object.entries(lines).map(([id, n]) => `${n}× ${ALL[id].name}`).join(', ');
function renderAdmin() {
  const { rev, cnt } = sold();
  $('#admin-summary').innerHTML = '<h3>Zwischenstand dieses Geräts</h3>' + STANDS.map(s => {
    const k = state.sales.filter(x => x.stand === s.id);
    return `<div class="sum-row"><span>${s.label}</span><span>${k.filter(x => !x.void).length} ${k.filter(x => !x.void).length === 1 ? "Buchung" : "Buchungen"} · ${cnt[s.id] || 0} Artikel${k.some(x => x.void) ? ` · ${k.filter(x => x.void).length} storniert` : ''}</span><b>${euro(rev[s.id] || 0)}</b></div>`;
  }).join('') + `<div class="sum-row total"><span>Gesamt</span><span></span><b>${euro(Object.values(rev).reduce((a, b) => a + b, 0))}</b></div>`;
  $('#restore').hidden = !state.backup;
  const list = [...state.sales].reverse();
  $('#sales-list').innerHTML = list.length ? list.map(s => `
    <div class="sale${s.void ? ' void' : ''}">
      <div class="sale-main">
        <div class="sale-head"><b>#${s.n}</b> · ${fmtT(s.t)} · ${STANDS.find(x => x.id === s.stand).label}${s.void ? ' · <span class="tag">storniert</span>' : ''}</div>
        <div class="sale-lines">${lineText(s.lines)}</div>
        <div class="sale-pay">${s.note ? s.note : `Gegeben ${euro(s.given)} · Rückgeld ${euro(s.change)}`}</div>
      </div>
      <b class="sale-sum">${euro(s.total)}</b>
      <button class="btn ${s.void ? '' : 'destructive'}" data-void="${s.n}">${s.void ? 'Storno aufheben' : 'Stornieren'}</button>
    </div>`).join('') : '<p class="empty">Noch keine Buchungen.</p>';
}

// --- Speichern: CSV-Datei (iPad: „In Dateien sichern“ / Teilen-Menü, Android: Download)
async function exportFile() {
  const d = new Date(), p = n => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  const q = v => `"${String(v).replace(/"/g, '""')}"`, num = c => (c / 100).toFixed(2).replace('.', ','), row = a => a.map(q).join(';');
  const { per, rev } = sold();
  const rows = [row(['Stand', 'Produkt', 'Einzelpreis (€)', 'Anzahl', 'Umsatz (€)'])];
  let all = 0;
  for (const s of STANDS) {
    for (const it of items(s)) { const c = per[it.id] || 0; rows.push(row([s.label, it.name + (it.sub ? ` (${it.sub})` : ''), num(it.price), c, num(c * it.price)])); }
    rows.push(row([s.label, 'SUMME', '', '', num(rev[s.id] || 0)])); all += rev[s.id] || 0;
  }
  rows.push(row(['', 'GESAMT (dieses Gerät)', '', '', num(all)]), row(['Stand der Daten', stamp]), '',
    row(['Bon-Nr.', 'Zeit', 'Stand', 'Artikel', 'Summe (€)', 'Gegeben (€)', 'Rückgeld (€)', 'Status']));
  for (const s of state.sales) rows.push(row([s.n, fmtT(s.t), STANDS.find(x => x.id === s.stand).label, lineText(s.lines), num(s.total), num(s.given), num(s.change), s.void ? 'storniert' : 'gültig']));
  const name = `kasse-${stamp.replace(' ', '-').replace(':', '')}.csv`;
  const file = new File(['﻿' + rows.join('\r\n')], name, { type: 'text/csv' });
  try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Kasse' }); return; } }
  catch (err) { if (err.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// --- Klicks
document.addEventListener('click', async e => {
  const t = e.target.closest('button'); if (!t) return;
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
    const ok = await ask(s.void ? 'Storno aufheben?' : `Bon #${s.n} stornieren?`, `${lineText(s.lines)} · ${euro(s.total)}`, s.void ? 'Aufheben' : 'Stornieren');
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
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (had) location.reload(); had = true; });
}
