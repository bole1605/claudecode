'use strict';
const { parse, vatPart, normalizeLink, migrateCatalog, enc, wrapText, makePdf } = Kasse; // Rechenlogik: siehe logic.js (getestet)
// Preise in Cent, damit nie Rundungsfehler entstehen.
const DEFAULT_STANDS = [
  { id: 'crepes', label: 'Crêpes', groups: [
    { name: 'Crêpes', color: Kasse.COLORS.lila, items: [
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
    { name: 'Maultaschenburger', color: Kasse.COLORS.grau, items: [
      { id: 'b-maul-v', name: 'Maultaschen auf karamellisierten Zwiebeln – Vegi', sub: 'Vegetarische Füllung', price: 600 },
      { id: 'b-maul-f', name: 'Maultaschen auf karamellisierten Zwiebeln – Fleisch', sub: 'Fleischfüllung', price: 600 },
      { id: 'b-spezial-v', name: 'Glabbicher Weihnachtsmarkt Spezial-Maultaschenburger – Vegi', sub: 'Vegetarische Füllung', price: 750 },
      { id: 'b-spezial-f', name: 'Glabbicher Weihnachtsmarkt Spezial-Maultaschenburger – Fleisch', sub: 'Fleischfüllung', price: 750 },
    ]},
    { name: 'Getränke', color: Kasse.COLORS.flieder, items: [
      { id: 'g-spezi', name: 'Paulaner Spezi', sub: '0,5 l', price: 300, autoAdd: 'g-pfand' },
      { id: 'g-pfand', name: 'Pfand', sub: 'pro Flasche', price: 200, kind: 'pfand' },
      { id: 'g-pfand-rueck', name: 'Pfand zurück', sub: 'wird ausgezahlt', price: -200, kind: 'pfand' },
    ]},
  ]},
  { id: 'karten', label: 'Karten', groups: [
    { name: 'Handgemachte Weihnachtskarten', color: Kasse.COLORS.dunkelgrau, items: [
      { id: 'k-1', name: 'Eine Karte', price: 300 },
      { id: 'k-2', name: 'Zwei Karten', price: 500 },
    ]},
  ]},
];
const VERSION = 33;
// Fokus ins erste Feld – aber nur, wenn die Eingabe nicht schon in einem anderen Feld des Fensters begonnen hat
const focusFirst = sel => setTimeout(() => { const el = document.querySelector(sel), d = el.closest('dialog'); if (!d.contains(document.activeElement) || document.activeElement === d) el.focus(); }, 50);
// Test- und Live-Version liegen auf derselben Domain: getrennter Speicher, damit sich die Daten nie vermischen
const IS_TEST = /\/kasse-test\//.test(location.pathname);
const KEY = IS_TEST ? 'kasse-test-v2' : 'kasse-v2';
const $ = s => document.querySelector(s);
const priceTxt = c => c === 0 ? 'Gratis' : euro(c);
const euro = c => (c / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
const items = s => s.groups.flatMap(g => g.items);

const defVat = id => (id === 'g-spezi' || id.startsWith('k-') || id.startsWith('g-pfand')) ? 19 : 7;
const isPfand = id => id.startsWith('g-pfand');
const clone = o => JSON.parse(JSON.stringify(o));
const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const PALETTE = Kasse.PALETTE;   // Logo-Farben; kein Rot: Rot ist für Löschen/Storno/Minus reserviert

const RC_DEFAULT = { name: 'Evangelische Kirchengemeinde Kleinglattbach', addr: 'Kirchstraße 15; 71665 Vaihingen an der Enz', foot: 'Vielen Dank, Guten Appetit & frohe Weihnachten!' };
let state = { design: { theme: 'standard', mode: 'auto', accent: null, logo: 'low', snow: true }, mig23: false, sound: { on: true, vol: 'mid', tones: { booked: true, ready: false }, pick: { booked: 'horn', ready: 'hell' } }, kitchen: { on: true }, orderNo: { day: '', seq: {} }, orderMode: 'manual', orderOff: {}, exp: [], moves: [], counts: [], lock: null, mig20: false, share: { on: true }, lastBackup: null, mig17: false, rec: null, stand: DEFAULT_STANDS[0].id, cart: {}, sales: [], seq: 0, pw: null, backup: null, migrated: false, catalog: null, vat: { on: false }, tip: { on: true }, cash: { start: 0, at: null }, ppMode: null, paypal: '', receipt: { on: true, name: RC_DEFAULT.name, addr: RC_DEFAULT.addr, tax: '', foot: RC_DEFAULT.foot } };
try { Object.assign(state, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) {}
let STANDS, ALL = {};
function setCatalog(c) {
  STANDS = state.catalog = c;
  STANDS.forEach(s => s.groups.forEach((g, i) => { if (!g.id) g.id = s.id + '-g' + i; g.items.forEach(it => { if (typeof it.vat !== 'number') it.vat = defVat(it.id); }); }));
  ALL = {};
  STANDS.forEach(s => s.groups.forEach(g => g.items.forEach(it => { ALL[it.id] = { ...it, stand: s.id }; })));
  if (!STANDS.some(s => s.id === state.stand)) state.stand = STANDS[0].id;
  if (state.lock && !STANDS.some(s => s.id === state.lock)) state.lock = null;   // gesperrter Stand wurde gelöscht
  if (state.lock) state.stand = state.lock;
}
if (Array.isArray(state.catalog) && state.catalog.length && !state.mig17) migrateCatalog(state.catalog);
state.mig17 = true;
if (!state.mig20) { (state.catalog || []).forEach(s => s.groups.forEach(g => { if (/^#(FF3B30|FF2D55)$/i.test(g.color)) g.color = '#5856D6'; })); state.mig20 = true; }
if (!state.mig23) { (state.catalog || []).forEach(s => s.groups.forEach(g => { g.color = Kasse.migrateColor(g.color); })); state.mig23 = true; }   // bisherige Standardfarben -> Logo-Farben (eigene Farben bleiben)
setCatalog(Array.isArray(state.catalog) && state.catalog.length ? state.catalog : clone(DEFAULT_STANDS));
// Bon-Kopf: Vorgaben übernehmen, solange nichts Eigenes eingetragen ist
if (!state.receipt.name && !state.receipt.addr) { state.receipt.name = RC_DEFAULT.name; state.receipt.addr = RC_DEFAULT.addr; }
if (!state.receipt.foot || state.receipt.foot === 'Vielen Dank für Ihren Einkauf!') state.receipt.foot = RC_DEFAULT.foot;
if (!state.ppMode) state.ppMode = state.ppAmount === false ? 'none' : 'amount'; // Standard: dokumentiertes Format ohne Währungskürzel
let editing = false;
if (state.paypal) state.paypal = normalizeLink(state.paypal); // alte, fehlerhaft gespeicherte Links reparieren
// MwSt.: Preise sind Bruttopreise. Vorschlagswerte (bitte prüfen!): Speisen 7 %, Getränke und Karten 19 %. Je Produkt änderbar.
const vatOf = (info, id) => info && info[id] && typeof info[id].vat === 'number' ? info[id].vat : (ALL[id] ? ALL[id].vat : 7);
const pct = r => String(r).replace('.', ',') + ' %';
const vatText = gr => { const e = Object.entries(gr).sort((a, b) => a[0] - b[0]); const v = e.reduce((s, [r, g]) => s + vatPart(g, +r), 0), g = e.reduce((s, [, x]) => s + x, 0);
  return { vat: v, net: g - v, text: `Netto ${euro(g - v)} · ` + e.map(([r, x]) => `MwSt ${pct(r)}: ${euro(vatPart(x, +r))}`).join(' · ') }; };
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
if (STANDS.some(s => s.id === hash) && !state.lock) state.stand = hash;
if (!STANDS.some(s => s.id === state.stand)) state.stand = STANDS[0].id;

Sound.setup(state.sound);
Theme.apply(state.design);
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} };

// --- Bestellungen für die Küchenanzeige (zweites Fenster: display.html) ---------------------------------------------------
const ORD_KEY = KEY + '-orders';
const orderChan = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(ORD_KEY) : null;
const readOrders = () => { try { const o = JSON.parse(localStorage.getItem(ORD_KEY)); return o && Array.isArray(o.orders) ? o : { orders: [] }; } catch (e) { return { orders: [] }; } };
function writeOrders(o) {
  const cut = Date.now() - 24 * 3600e3; o.orders = o.orders.filter(x => x.t > cut).slice(-300);
  try { localStorage.setItem(ORD_KEY, JSON.stringify(o)); } catch (e) {}
  if (orderChan) orderChan.postMessage('changed'); kitchenBadge();
}
const standPrefix = s => s.prefix || Kasse.defaultPrefix(s.id, s.label);
const today = () => { const d = new Date(), p = k => String(k).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
function orderFromSale(s) {
  const items = Object.entries(s.lines).filter(([id, n]) => n > 0 && !isPfand(id)).map(([id, n]) => [itemName(s, id), n]);
  const st = STANDS.find(x => x.id === s.stand);
  return { no: s.on, n: s.n, st: s.stand, sl: labelOf(s.stand), col: st && st.groups[0] ? st.groups[0].color : Kasse.COLORS.lila, t: s.t, items, status: 'open' };
}
let manualNo = null;   // von Hand eingegebene Nummer des Märkchens (wird beim Verbuchen verbraucht)
const hasOrderItems = () => Object.entries(cart()).some(([id, n]) => n > 0 && !isPfand(id));
const normNo = v => String(v).replace(/^0+(?=\d)/, '');
const noTaken = v => readOrders().orders.some(o => o.status !== 'done' && normNo(o.no) === normNo(v));   // offen oder fertig, noch nicht abgeholt
let nv = '';
function numUpdate() {
  const taken = nv && noTaken(nv);
  $('#n-val').textContent = nv || '–';
  $('#n-err').textContent = taken ? 'Diese Nummer ist noch in Gebrauch (offen oder abholbereit).' : '';
  const zero = !!nv && /^0+$/.test(nv);
  if (zero) $('#n-err').textContent = 'Die Nummer 0 ist gesperrt.';
  $('#n-ok').disabled = !nv || taken || zero;
}
function numOpen() { nv = ''; numUpdate(); $('#num-dlg').showModal(); }
function numKey(k) { if (k === 'back') nv = nv.slice(0, -1); else if (nv.length < 4) nv += k; numUpdate(); }
function assignOrder(s) {   // Bestellnummer vergeben (nur für echte Bestellungen, nicht für Spenden oder reine Pfand-Rückgabe)
  if (s.donation || (state.orderOff || {})[s.stand] || !Object.entries(s.lines).some(([id, n]) => n > 0 && !isPfand(id))) return;
  const st = STANDS.find(x => x.id === s.stand) || { id: s.stand, label: s.sl };
  if (state.orderMode === 'manual' && manualNo) { s.on = manualNo; manualNo = null; }
  else { const r = Kasse.nextOrder(state.orderNo, s.stand, standPrefix(st), today()); state.orderNo = r.st; s.on = r.no; }
  if (state.kitchen.on) { const o = readOrders(); o.orders.push(orderFromSale(s)); writeOrders(o); }
}
function syncOrder(s) {     // Storno / Storno aufheben
  if (!s.on) return;
  const o = readOrders(), i = o.orders.findIndex(x => x.no === s.on && x.n === s.n);
  if (s.void) { if (i >= 0) o.orders.splice(i, 1); } else if (i < 0 && state.kitchen.on) o.orders.push(orderFromSale(s));
  writeOrders(o);
}
const openOrders = () => readOrders().orders.filter(x => x.status === 'open').length;
// --- Bestellungen auf der Kasse selbst (Touch): offene Bestellungen "Fertig" melden, fertige als abgeholt abhaken
let asideTab = 'bon', ordUndo = [];
const ordMins = t => Math.max(0, Math.floor((Date.now() - t) / 60000));
function renderOrders() {
  const pane = $('#ord-pane'); if (!pane || pane.hidden) return;
  const all = readOrders().orders.filter(o => !state.lock || o.st === state.lock).sort((x, y) => x.t - y.t);
  const open = all.filter(o => o.status === 'open'), ready = all.filter(o => o.status === 'ready');
  $('#ord-open').innerHTML = open.length ? open.map(o => `<div class="ord" style="--c:${esc(o.col || '#A10DBC')}"><div class="ord-h"><b>${esc(o.no)}</b><span>${esc(o.sl)}</span><time>${ordMins(o.t)} min</time></div>
    <div class="ord-i">${o.items.map(([n, q]) => `${q}× ${esc(n)}`).join(', ')}</div><button class="btn primary" data-ord-done="${esc(o.no + '|' + o.n)}">Fertig</button></div>`).join('') : '<p class="muted">Keine offenen Bestellungen</p>';
  $('#ord-ready-h').hidden = !ready.length;
  $('#ord-ready').innerHTML = ready.map(o => `<button class="rd" style="--c:${esc(o.col || '#909090')}" data-ord-pick="${esc(o.no + '|' + o.n)}">${esc(o.no)} <small>abgeholt</small></button>`).join('');
  $('#ord-undo').disabled = !ordUndo.length;
}
function setAsideTab(t) {
  asideTab = t; $('#bon-pane').hidden = t !== 'bon'; $('#ord-pane').hidden = t !== 'ord';
  document.querySelectorAll('#aside-tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === t))); renderOrders();
}
function setOrdStatus(id, status, remember) {
  const o = readOrders(), x = o.orders.find(y => y.no + '|' + y.n === id); if (!x) return;
  if (remember) ordUndo.push({ id, prev: x.status });
  x.status = status; writeOrders(o); if (status === 'ready') { knownReady.add(x.no); Sound.play('ready'); } renderOrders();
}
setInterval(renderOrders, 20000);
function kitchenBadge() {
  const b2 = $('#k-count2'); if (b2) { b2.textContent = openOrders(); b2.hidden = !openOrders(); }
  const b = $('#k-count'), btn = $('#kitchen-open'); if (!b || !btn) return;
  const n = openOrders(); b.textContent = n; b.hidden = !n; btn.hidden = !state.kitchen.on;
}
let knownReady = new Set(readOrders().orders.filter(x => x.status === 'ready').map(x => x.no));
function ordersChanged() {
  kitchenBadge(); renderOrders();
  const rd = readOrders().orders.filter(x => x.status === 'ready').map(x => x.no);
  if (rd.some(no => !knownReady.has(no))) Sound.play('ready');   // Küche meldet: Bestellung fertig
  knownReady = new Set(rd);
}
if (orderChan) orderChan.onmessage = ordersChanged;
window.addEventListener('storage', e => { if (e.key === ORD_KEY) ordersChanged(); });
const kitchenUrl = embed => location.origin + location.pathname.replace(/[^/]*$/, '') + 'display.html' + (embed ? '?embed=1' : '') + '#' + (state.lock || 'all');   // alle Sparten, außer das Gerät ist auf einen Stand festgelegt
const monitorUrl = () => kitchenUrl(false).replace('display.html', 'display.html?view=1');   // Monitor: nur anzeigen, kein Bedienen
const standalone = () => (window.navigator.standalone === true) || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
function monitorOpen() {
  if (standalone()) { document.querySelector('#monitor-url').value = monitorUrl(); document.querySelector('#monitor-dlg').showModal(); return; }   // als App auf dem Home-Bildschirm würde ein neues Fenster die Kasse ersetzen
  window.open(monitorUrl(), 'kasse-display', 'popup=yes,width=1100,height=760');
}
function kitchenOpen() { $('#k-frame').src = kitchenUrl(true); $('#kitchen-ov').hidden = false; document.body.classList.add('noscroll'); }
function kitchenClose() { $('#kitchen-ov').hidden = true; $('#k-frame').src = 'about:blank'; document.body.classList.remove('noscroll'); kitchenBadge(); }

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
      P[id] = (P[id] || 0) + n; R[id] = (R[id] || 0) + n * pr; if (!isPfand(id)) cnt[s.stand] = (cnt[s.stand] || 0) + n;
      const v = vatOf(s.info, id); gr[v] = (gr[v] || 0) + n * pr; (grS[s.stand] = grS[s.stand] || {})[v] = ((grS[s.stand] || {})[v] || 0) + n * pr;
    }
  }
  return { perS, revS, rev, cnt, gr, grS };
}

function cartAdd(id, d) {
  const c = cart();
  c[id] = (c[id] || 0) + d;
  if (c[id] <= 0) delete c[id];
  const link = ALL[id] && ALL[id].autoAdd;   // z. B. Spezi → Pfand automatisch mit auf den Bon
  if (link && ALL[link]) {
    if (d > 0) c[link] = (c[link] || 0) + d;
    else if (c[link] > 0) { c[link] += d; if (c[link] <= 0) delete c[link]; }
  }
  save(); update();
}

function build() {
  document.body.classList.toggle('editing', editing);
  $('#tabs').hidden = !!state.lock && !editing;   // Gerät ist auf einen Stand festgelegt: keine Reiter
  $('#tabs').innerHTML = STANDS.map(s =>
    `<button role="tab" data-stand="${s.id}" aria-selected="${s.id === state.stand}">${esc(s.label)}</button>`).join('')
    + (editing ? '<button data-addstand aria-label="Seite hinzufügen">＋</button>' : '');
  const s = stand();
  $('#title').textContent = s.label;
  $('#edit-bar').hidden = !editing;
  if (editing) return buildEdit();
  $('#main').innerHTML = s.groups.map(g => `
    <section class="group" style="--accent:${g.color};--on:${Kasse.textOn(g.color)}">
      <h2>${esc(g.name)}</h2>
      <div class="grid n${g.items.length}">${g.items.map(it => `
        <div class="tile-wrap">
          <button class="tile" data-add="${it.id}" aria-label="${esc(it.name)} zum Bon hinzufügen">
            <span class="badge" data-count="${it.id}">0</span>
            <span class="name">${esc(it.name)}</span>
            ${it.sub ? `<span class="sub">${esc(it.sub)}</span>` : ''}
            <span class="price">${priceTxt(it.price)}</span>
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
    <button class="btn" data-prefix>Kürzel „${esc(standPrefix(s))}“</button><button class="btn" data-renamestand>Seite umbenennen</button><button class="btn destructive" data-delstand>Seite löschen</button>
    <button class="btn primary" data-editdone>Fertig</button></span>`;
  $('#main').innerHTML = s.groups.map((g, i) => `
    <section class="group" style="--accent:${g.color};--on:${Kasse.textOn(g.color)}">
      <div class="g-head"><h2>${esc(g.name)}</h2><span class="g-actions">
        <button class="btn sm" data-gup="${g.id}" ${i === 0 ? 'disabled' : ''} aria-label="Nach oben">↑</button>
        <button class="btn sm" data-gdown="${g.id}" ${i === s.groups.length - 1 ? 'disabled' : ''} aria-label="Nach unten">↓</button>
        <button class="btn sm" data-gren="${g.id}">Umbenennen</button>
        <button class="btn sm destructive" data-gdel="${g.id}">Löschen</button></span></div>
      <div class="grid">${g.items.map(it => `
        <div class="tile-wrap"><button class="tile edit" data-edit="${it.id}">
          <span class="pencil">✎</span><span class="name">${esc(it.name)}</span>
          ${it.sub ? `<span class="sub">${esc(it.sub)}</span>` : ''}<span class="price">${priceTxt(it.price)}</span></button></div>`).join('')}
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
    <span class="bl-sum">${priceTxt(c[it.id] * it.price)}</span>
    <button class="bl-minus" data-sub="${it.id}" aria-label="${esc(it.name)} entfernen">−</button></li>`).join('')
    : '<li class="empty">Kachel antippen, um einen Artikel hinzuzufügen</li>';
  const t = cartTotal();
  $('#bon-sum').textContent = euro(t);
  const bg = {}; for (const [id, n] of Object.entries(c)) if (ALL[id]) bg[ALL[id].vat] = (bg[ALL[id].vat] || 0) + n * ALL[id].price;
  $('#bon-vat').innerHTML = state.vat.on && t ? Object.entries(bg).sort((x, y) => x[0] - y[0]).map(([r, g]) => `<div><span>darin MwSt ${pct(r)}</span><span>${euro(vatPart(g, +r))}</span></div>`).join('') : '';
  const empty = !Object.keys(c).length;
  $('#pay').disabled = $('#clear').disabled = empty;
  $('#pay').textContent = empty ? 'Bezahlen' : t < 0 ? `Auszahlen · ${euro(-t)}` : t === 0 ? 'Verbuchen · 0,00 €' : `Bezahlen · ${euro(t)}`;
}

// --- Schnelles Tippen: Artikel landet schon beim Aufsetzen des Fingers auf dem Bon
function addTile(t) {
  cartAdd(t.dataset.add, 1); buzz();
  const b = t.querySelector('.badge'); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
}
// Passt die Seite auf den Bildschirm, zählt schon das Berühren (schnellste Variante).
// Muss die Seite gescrollt werden, zählt erst das Loslassen – und nur, wenn der Finger nicht gewandert ist (Wischen = kein Verkauf).
const scrollable = () => { const m = $('#main'); return m.scrollHeight > m.clientHeight + 2; };
let pending = null;
document.addEventListener('pointerdown', () => Sound.unlock(), { passive: true });   // Töne brauchen eine Berührung, bevor sie spielen dürfen
document.addEventListener('pointerdown', e => {
  if (e.button > 0) return;
  const t = e.target.closest('[data-add]'); if (!t) return;
  if (!scrollable()) addTile(t); else pending = { t, x: e.clientX, y: e.clientY, id: e.pointerId };
});
document.addEventListener('pointerup', e => {
  if (pending && pending.id === e.pointerId && Math.hypot(e.clientX - pending.x, e.clientY - pending.y) < 10) addTile(pending.t);
  pending = null;
});
document.addEventListener('pointercancel', () => { pending = null; });

// --- Bezahlen / Wechselgeld
let given = '', tip = '', target = 'given', method = 'bar';
// Inhalt des QR-Codes (state.ppMode): 'amount' | 'amountEur' | 'none' – siehe logic.js
const ppEmbeds = () => Kasse.ppEmbeds(state.paypal, state.ppMode);
const paypalUrl = total => Kasse.paypalUrl(state.paypal, state.ppMode, total);
// QR als Bild (GIF-Data-URL) statt SVG: sieht auf allen Browsern gleich aus, auch auf älteren iPads
function qrImg(url, target, level) {
  try {
    const qr = qrcode(0, level || 'M'); qr.addData(url); qr.make();
    const n = qr.getModuleCount(), cell = Math.max(3, Math.floor(target / (n + 8))), size = (n + 8) * cell;
    return `<img class="qr" alt="QR-Code" src="${qr.createDataURL(cell, cell * 4)}" width="${size}" height="${size}">`;
  } catch (e) { return ''; }
}
function qrSvg(url) { try { const qr = qrcode(0, 'M'); qr.addData(url); qr.make(); return qr.createSvgTag({ scalable: true, margin: 2 }); } catch (e) { return ''; } }
function payUpdate() {
  const total = cartTotal(), g = parse(given), ch = $('#p-change'), pp = method === 'paypal', T = state.tip.on;
  const tp = Math.max(0, parse(tip) || 0);
  $('#p-total').textContent = euro(total);
  const settle = total <= 0;   // nur Pfand-Rückgabe o. Ä.: nichts zu kassieren, ggf. auszahlen
  $('#p-method').hidden = settle;
  if (settle) {
    ['#p-cash', '#p-given-b', '#p-tip-b', '#p-qr'].forEach(s => $(s).hidden = true);
    ch.hidden = false; ch.className = 'change ok';
    ch.innerHTML = `<span class="cap">${total < 0 ? 'Auszahlen' : 'Nichts zu zahlen'}</span><b>${euro(-total)}</b>`;
    $('#p-ok').textContent = total < 0 ? 'Ausgezahlt · Verbuchen' : 'Verbuchen'; $('#p-ok').disabled = false; return;
  }
  document.querySelectorAll('#p-method button').forEach(b => b.setAttribute('aria-selected', b.dataset.method === method));
  ['#p-cash', '#p-given-b', '#p-change'].forEach(s => $(s).hidden = pp);
  $('#p-cash').hidden = pp;
  $('#p-tip-b').hidden = pp || !T; $('#p-tipq').hidden = !T;
  $('#p-qr').hidden = !pp;
  $('#p-ok').textContent = pp ? 'PayPal-Zahlung erhalten · Verbuchen' : 'Verbuchen';
  if (pp) {
    const url = state.paypal ? paypalUrl(total) : '';
    const img = url ? qrImg(url, 300) : '';
    const note = ppEmbeds() ? `Betrag im Link: <b>${euro(total)}</b>` : `<b>Bitte im PayPal-Fenster ${euro(total)} eingeben</b>`;
    $('#p-qr-img').innerHTML = img ? img + `<div class="qr-amount">${note}</div><small class="muted qr-url">${esc(url)}</small>`
      : `<p class="err">${state.paypal ? 'Der QR-Code konnte nicht erzeugt werden (Link zu lang oder ungültig).' : 'Kein PayPal-Link hinterlegt.'}<br>Bitte in der Verwaltung unter „PayPal-Link festlegen“ prüfen.</p>`;
    $('#p-ok').disabled = false; return;
  }
  document.querySelectorAll('.pay-field').forEach(b => b.classList.toggle('active', b.dataset.target === target));
  $('#p-given').textContent = given ? given + ' €' : '–';
  $('#p-tip').textContent = tip ? tip + ' €' : '–';
  ch.className = 'change';
  const cp = Kasse.calcPay(total, given, tip, T), need = cp.need;
  if (g === null) ch.innerHTML = '<span class="cap">Rückgeld</span><b>–</b>';
  else if (g >= need) { ch.classList.add('ok'); ch.innerHTML = `<span class="cap">Rückgeld${T && tp ? ' (nach Spende)' : ''}</span><b>${euro(g - need)}</b>`; }
  else { ch.classList.add('short'); ch.innerHTML = `<span class="cap">Es fehlen</span><b>${euro(need - g)}</b>`; }
  $('#p-ok').disabled = !cp.ok;
}
function openPay() { if (!Object.keys(cart()).length) return; manualNo = null; given = ''; tip = ''; target = 'given'; method = 'bar'; payUpdate(); $('#pay-dlg').showModal(); }
const fmtIn = c => (c / 100).toFixed(2).replace('.', ',').replace(/,00$/, '');
function key(k) {
  let v = target === 'tip' ? tip : given;
  if (k === 'back') v = v.slice(0, -1);
  else if (k === ',') { if (!v.includes(',')) v = (v || '0') + ','; }
  else {
    const dec = v.split(',')[1];
    if (dec !== undefined && dec.length >= 2) return;
    if (v.replace(',', '').length >= 7) return;
    v = v === '0' ? k : v + k;
  }
  if (target === 'tip') tip = v; else given = v;
  payUpdate();
}
function finishSale(sale, o) {   // Buchung speichern, Bestellnummer vergeben, Ton, Bon-Hinweis
  o = o || {};
  state.sales.push(sale); assignOrder(sale);
  if (o.clear) state.cart[state.stand] = {};
  save(); update(); $('#pay-dlg').close(); buzz(); Sound.play(o.sound || 'booked'); afterBook(sale);
}
function book() {
  if (state.orderMode === 'manual' && hasOrderItems() && !state.orderOff[state.stand] && !manualNo) { numOpen(); return; }   // erst die Nummer des Märkchens erfragen
  const total = cartTotal();
  if (total <= 0) { // Auszahlung (z. B. Pfand zurück) oder 0 €: bar, nichts einzunehmen
    finishSale({ method: 'bar', n: ++state.seq, t: Date.now(), stand: state.stand, sl: stand().label, lines: { ...cart() }, info: snap(cart()), total, given: 0, tip: 0, change: -total, payout: total < 0, void: false }, { clear: true }); return;
  }
  const pp = method === 'paypal', cp = Kasse.calcPay(total, given, tip, state.tip.on), tp = pp ? 0 : cp.tp, g = pp ? total : cp.g; if (!pp && !cp.ok) return;
  finishSale({ method, n: ++state.seq, t: Date.now(), stand: state.stand, sl: stand().label, lines: { ...cart() }, info: snap(cart()), total, given: g, tip: tp, change: g - total - tp, void: false }, { clear: true });
}

// --- Spende ohne Einkauf
let donAmt = '', donMethod = 'bar';
function typeKey(v, k) {
  if (k === 'back') return v.slice(0, -1);
  if (k === ',') return v.includes(',') ? v : (v || '0') + ',';
  const dec = v.split(',')[1]; if (dec !== undefined && dec.length >= 2) return v;
  if (v.replace(',', '').length >= 7) return v;
  return v === '0' ? k : v + k;
}
function donOpen() { donAmt = ''; donMethod = 'bar'; donUpdate(); $('#don-dlg').showModal(); }
function donUpdate() {
  const a = parse(donAmt) || 0, pp = donMethod === 'paypal';
  $('#d-amt').textContent = donAmt ? donAmt + ' €' : '–';
  document.querySelectorAll('#d-method button').forEach(b => b.setAttribute('aria-selected', b.dataset.dmethod === donMethod));
  $('#d-qr').hidden = !pp || a <= 0;
  if (pp && a > 0) {
    const url = state.paypal ? paypalUrl(a) : '', img = url ? qrImg(url, 260) : '';
    $('#d-qr-img').innerHTML = img ? img + `<small class="muted qr-url">${esc(url)}</small>` : '<p class="err">Kein PayPal-Link hinterlegt (Verwaltung).</p>';
  }
  $('#d-ok').disabled = !(a > 0); $('#d-ok').textContent = pp ? 'PayPal-Spende erhalten · Verbuchen' : 'Spende verbuchen';
}
function donBook() {
  const a = parse(donAmt); if (!(a > 0)) return;
  finishSale({ method: donMethod, n: ++state.seq, t: Date.now(), stand: state.stand, sl: stand().label, lines: {}, info: {}, total: 0, given: a, tip: a, change: 0, donation: true, void: false }, { sound: 'booked' });
  $('#don-dlg').close();
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
const recCode = () => { const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', r = crypto.getRandomValues(new Uint8Array(8)); return [...r].map(x => c[x % c.length]).join('').replace(/(.{4})/, '$1-'); };
function pwDialog(mode) {
  pwMode = mode;
  const enter = mode === 'enter';
  $('#pw-title').textContent = enter ? 'Passwort eingeben' : mode === 'change' ? 'Neues Passwort' : 'Passwort festlegen';
  $('#pw-text').textContent = enter ? 'Das Passwort gilt nur für dieses Gerät.' : 'Dieses Gerät hat noch kein eigenes Passwort bzw. du vergibst ein neues. Mindestens 4 Zeichen (Buchstaben und Zahlen möglich). Zur Sicherheit zweimal eingeben.';
  $('#pw-input').value = ''; $('#pw-input2').value = ''; $('#pw-err').textContent = '';
  $('#pw-input2').hidden = enter; $('#pw-forgot').hidden = !enter || !state.rec;
  $('#pw-show').checked = false; setPwVisible(false);
  $('#pw-dlg').showModal(); focusFirst('#pw-input');
}
function setPwVisible(on) { ['#pw-input', '#pw-input2'].forEach(s => $(s).classList.toggle('secret', !on)); }
$('#pw-show').addEventListener('change', e => setPwVisible(e.target.checked));
$('#pw-forgot').addEventListener('click', async () => {
  $('#pw-dlg').close();
  const c = await promptText('Wiederherstellungscode eingeben', '', 'XXXX-XXXX');
  if (c && state.rec && await hashPw('rec|' + c.toUpperCase().replace(/[^A-Z0-9]/g, '')) === state.rec) pwDialog('recover');
  else if (c) { await ask('Code falsch', 'Der Wiederherstellungscode stimmt nicht.', 'OK'); pwDialog('enter'); }
});
$('#pw-form').addEventListener('submit', async e => {
  e.preventDefault();
  const v = $('#pw-input').value.trim();
  if (pwMode === 'enter') {
    if (await hashPw(v) === state.pw) { $('#pw-dlg').close(); showAdmin(); }
    else { $('#pw-err').textContent = 'Falsches Passwort. Das Passwort gilt nur für dieses Gerät.'; $('#pw-input').value = ''; }
  } else {
    if (v.length < 4) { $('#pw-err').textContent = 'Mindestens 4 Zeichen'; return; }
    if (v !== $('#pw-input2').value.trim()) { $('#pw-err').textContent = 'Die beiden Eingaben stimmen nicht überein'; return; }
    state.pw = await hashPw(v);
    const code = recCode(); state.rec = await hashPw('rec|' + code.replace('-', '')); save(); $('#pw-dlg').close();
    await ask('Wiederherstellungscode', `Bitte notieren (nicht auf dem Gerät): ${code} – Damit kannst du ein vergessenes Passwort neu setzen, ohne Daten zu verlieren.`, 'Notiert');
    if (pwMode !== 'change') showAdmin();
  }
});
$('#pw-cancel').addEventListener('click', () => $('#pw-dlg').close());

// --- Verwaltung (extra Seite): Buchungen, Storno, Speichern
function openAdmin() { hold = null; buzz(); pwDialog(state.pw ? 'enter' : 'set'); }
function showAdmin() { $('#toast').hidden = true; renderAdmin(); $('#admin').hidden = false; document.body.classList.add('noscroll'); }
function hideAdminKeep() { $('#admin').hidden = true; document.body.classList.remove('noscroll'); }
function hideAdmin() { hideAdminKeep(); build(); }
const fmtTS = t => new Date(t).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
const fmtT = t => new Date(t).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const lineText = s => s.donation ? 'Spende (ohne Einkauf)' : Object.entries(s.lines).map(([id, n]) => `${n}× ${itemName(s, id)}`).join(', ');
const standIds = () => { const ids = STANDS.map(s => s.id); state.sales.forEach(s => { if (!ids.includes(s.stand)) ids.push(s.stand); }); return ids; };
// Kassenstand (Bargeld): Anfangsbestand + bar bezahlte Beträge + Spenden; PayPal und stornierte Buchungen ändern ihn nicht
const cashSeries = () => Kasse.cashSeries(state.sales, state.cash.start, state.moves);
const payTotals = () => Kasse.payTotals(state.sales);
function renderAdmin() {
  const { rev, cnt, gr, grS } = sold();
  $('#vat-toggle').checked = state.vat.on;
  $('#rc-toggle').checked = state.receipt.on;
  $('#lock-select').innerHTML = '<option value="">Alle Seiten (Reiter sichtbar)</option>' + STANDS.map(s => `<option value="${s.id}">Nur „${esc(s.label)}“</option>`).join(''); $('#lock-select').value = state.lock || '';
  { const D = Theme.resolve(state.design);
    $('#d-theme').value = D.theme; $('#d-mode').value = D.mode; $('#d-logo').value = D.logo; $('#d-snow').checked = D.snow; $('#d-snow-row').hidden = D.theme !== 'xmas';
    $('#d-swatches').innerHTML = `<button class="sw auto" data-acc="" aria-pressed="${!D.accent}">Automatisch</button>` + Theme.SWATCHES.map(s => `<button class="sw" style="background:${s.c}" data-acc="${s.c}" aria-label="${s.n}" aria-pressed="${(D.accent || '').toUpperCase() === s.c}"></button>`).join('')
      + `<input type="color" id="d-custom" value="${D.accent || '#A10DBC'}" aria-label="Eigene Farbe wählen">`; }
  $('#sound-toggle').checked = state.sound.on;
  ['booked', 'ready'].forEach(n => { const sel = $('#sound-pick-' + n); if (!sel.options.length) sel.innerHTML = Sound.library.map(x => `<option value="${x.id}">${esc(x.name)}</option>`).join(''); sel.value = Sound.pickOf(n); }); $('#sound-booked').checked = Sound.toneOn('booked'); $('#sound-ready').checked = Sound.toneOn('ready'); $('#sound-vol').value = state.sound.vol; $('#kitchen-toggle').checked = state.kitchen.on;
  { const on = state.orderNo && state.orderNo.day === today() ? state.orderNo.seq : {};
    $('#order-mode').value = state.orderMode;
    $('#ord-stands').innerHTML = STANDS.map(s => `<label class="switch-row" style="margin-top:12px"><span><b>${esc(s.label)}</b><small>Bestellnummer, Bestellstatus und Küche für diese Sparte</small></span><input type="checkbox" role="switch" data-ordstand="${esc(s.id)}"${state.orderOff[s.id] ? '' : ' checked'}></label>`).join('');
    $('#ord-state').textContent = state.orderMode === 'manual' ? 'Die Nummer des Märkchens wird beim Verbuchen von Hand eingegeben.' : 'Nächste Bestellnummern: ' + STANDS.map(s => standPrefix(s) + ((on[s.id] || 0) + 1)).join(' · ') + ' (zählt jeden Tag neu)'; }
  $('#share-toggle').checked = state.share.on; $('#share-toggle').disabled = !state.receipt.on;
  $('#tip-toggle').checked = state.tip.on;
  $('#paypal-state').textContent = state.paypal ? `Hinterlegt: ${state.paypal}` : 'Noch kein Link hinterlegt.';
  $('#paypal-off').hidden = !state.paypal;
  $('#pp-mode').value = state.ppMode;
  const pv = state.paypal ? paypalUrl(1000) : '';
  $('#paypal-preview').innerHTML = pv ? `<div class="pv">${qrImg(pv, 200)}</div><small class="muted">Vorschau des QR-Codes (Beispiel 10,00 €):<br>${esc(pv)}<br>Scanne ihn einmal mit dem Handy und prüfe den Empfänger.</small><a class="btn" href="${esc(pv)}" target="_blank" rel="noopener">Link zum Testen öffnen</a>` : '';
  $('#vat-summary').hidden = !state.vat.on;
  if (state.vat.on) {
    const rates = Object.keys(gr).sort((x, y) => x - y), T = vatText(gr);
    $('#vat-summary').innerHTML = '<h3>Mehrwertsteuer (enthalten in den Bruttopreisen)</h3>' + (rates.length ? rates.map(r => `<div class="sum-row vat"><span>Satz ${pct(r)}</span><span>Brutto ${euro(gr[r])} · Netto ${euro(gr[r] - vatPart(gr[r], +r))}</span><b>${euro(vatPart(gr[r], +r))}</b></div>`).join('') + `<div class="sum-row total"><span>Gesamt MwSt</span><span>Brutto ${euro(Object.values(gr).reduce((s, x) => s + x, 0))} · Netto ${euro(T.net)}</span><b>${euro(T.vat)}</b></div>` : '<p class="empty">Noch keine Verkäufe.</p>');
  }
  const pay = payTotals(), cs = cashSeries();
  const lastC = state.counts[state.counts.length - 1];
  const diffTxt = d => d === 0 ? 'Kasse stimmt' : d > 0 ? `Überschuss ${euro(d)}` : `Fehlbetrag ${euro(-d)}`;
  $('#cash-card').innerHTML = `<h3>Kassenstand (Bargeld)</h3>
    <div class="sum-row"><span>Anfangsbestand</span><span>${state.cash.at ? 'festgelegt am ' + fmtTS(state.cash.at) : 'noch nicht festgelegt'}</span><b>${euro(state.cash.start)}</b></div>
    <div class="sum-row"><span>+ Barverkäufe</span><span></span><b>${euro(cs.sales)}</b></div>
    <div class="sum-row"><span>+ Spenden</span><span></span><b>${euro(cs.tips)}</b></div>
    <div class="sum-row"><span>+ Einlagen</span><span></span><b>${euro(cs.ein)}</b></div>
    <div class="sum-row"><span>− Entnahmen</span><span></span><b>${euro(cs.ent ? -cs.ent : 0)}</b></div>
    <div class="sum-row total"><span>Aktuell in der Kasse</span><span>PayPal ist nicht enthalten</span><b>${euro(cs.bal)}</b></div>
    ${state.moves.length ? '<div class="mv-list">' + [...state.moves].reverse().map(x => `<div class="mv${x.void ? ' void' : ''}"><span>${fmtTS(x.t)} · ${x.amt > 0 ? 'Einlage' : 'Entnahme'}${x.note ? ' · ' + esc(x.note) : ''}${x.void ? ' · <span class="tag">storniert</span>' : ''}</span><b>${euro(x.amt)}</b><button class="btn sm ${x.void ? '' : 'destructive'}" data-mvvoid="${x.id}">${x.void ? 'Aufheben' : 'Stornieren'}</button></div>`).join('') + '</div>' : ''}
    ${lastC ? `<div class="cs-last">Letzter Kassensturz: ${fmtTS(lastC.t)} · gezählt ${euro(lastC.ist)} · Soll ${euro(lastC.soll)} · <b class="${lastC.diff === 0 ? 'ok' : 'bad'}">${diffTxt(lastC.diff)}</b></div>` : ''}
    <div class="actions-card" style="padding:0;margin-top:12px">
      <button class="btn primary" id="cs-open">Kassensturz …</button>
      <button class="btn" id="mv-open">Einlage / Entnahme …</button>
      <button class="btn" id="rep-pdf">Kassenbericht (PDF)</button>
      <button class="btn" id="rep-print">Kassenbericht drucken</button>
      <button class="btn" id="cash-start">Anfangsbestand festlegen</button>
    </div>
    ${state.counts.length ? '<div class="cs-hist"><h3>Kassensturz-Protokoll</h3>' + [...state.counts].reverse().map(c => `<div class="mv"><span>${fmtTS(c.t)}${c.note ? ' · ' + esc(c.note) : ''} · gezählt ${euro(c.ist)} · Soll ${euro(c.soll)} · <b class="${c.diff === 0 ? 'ok' : 'bad'}">${diffTxt(c.diff)}</b></span><button class="btn sm" data-rep="${c.id}">Bericht</button></div>`).join('') + '</div>' : ''}`;
  $('#admin-summary').innerHTML = '<h3>Zwischenstand dieses Geräts</h3>' + standIds().map(id => {
    const k = state.sales.filter(x => x.stand === id), g = k.filter(x => !x.void).length, v = k.length - g;
    return `<div class="sum-row"><span>${esc(labelOf(id))}</span><span>${g} ${g === 1 ? 'Buchung' : 'Buchungen'} · ${cnt[id] || 0} Artikel${v ? ` · ${v} storniert` : ''}</span><b>${euro(rev[id] || 0)}</b></div>${state.vat.on && grS[id] ? `<div class="vat-sub">${vatText(grS[id]).text}</div>` : ''}`;
  }).join('') + `<div class="sum-row total"><span>Gesamt</span><span>Bar ${euro(pay.bar)} · PayPal ${euro(pay.paypal)}${pay.tip ? ` · Spenden ${euro(pay.tip)} (nicht enthalten)` : ''}</span><b>${euro(Object.values(rev).reduce((a, b) => a + b, 0))}</b></div>`;
  { const E = state.exp.filter(x => !x.void), eTot = E.reduce((a, x) => a + x.amt, 0), rTot = Object.values(rev).reduce((a, b) => a + b, 0), res = rTot - eTot;
    const sumE = id => E.filter(x => (x.stand || '') === id).reduce((a, x) => a + x.amt, 0), general = sumE('');
    $('#exp-card').innerHTML = `<h3>Ausgaben und Ergebnis</h3>
      <div class="sum-row"><span>Einnahmen</span><span>ohne Spenden, ohne Storno</span><b>${euro(rTot)}</b></div>
      <div class="sum-row"><span>− Ausgaben</span><span>${E.length} ${E.length === 1 ? 'Posten' : 'Posten'}</span><b>${euro(eTot ? -eTot : 0)}</b></div>
      <div class="sum-row total"><span>${res >= 0 ? 'Gewinn' : 'Verlust'}</span><span>Einnahmen − Ausgaben${pay.tip ? ` · mit Spenden ${euro(res + pay.tip)}` : ''}</span><b class="${res >= 0 ? 'ok' : 'bad'}">${euro(res)}</b></div>
      ${E.some(x => x.stand) ? '<div class="exp-by">' + standIds().map(id => `<div class="sum-row"><span>${esc(labelOf(id))}</span><span>${euro(rev[id] || 0)} − ${euro(sumE(id))}</span><b>${euro((rev[id] || 0) - sumE(id))}</b></div>`).join('') + (general ? `<div class="sum-row"><span>Allgemein</span><span>keiner Sparte zugeordnet</span><b>${euro(-general)}</b></div>` : '') + '</div>' : ''}
      ${state.exp.length ? '<div class="mv-list">' + [...state.exp].reverse().map(x => `<div class="mv${x.void ? ' void' : ''}"><span>${fmtTS(x.t)} · ${esc(x.note)} · ${x.stand ? esc(labelOf(x.stand)) : 'Allgemein'}${x.cash ? ' · aus der Kasse' : ''}${x.void ? ' · <span class="tag">storniert</span>' : ''}</span><b>${euro(x.amt)}</b><button class="btn sm ${x.void ? '' : 'destructive'}" data-expvoid="${x.id}">${x.void ? 'Aufheben' : 'Stornieren'}</button></div>`).join('') + '</div>' : ''}
      <div class="actions-card" style="padding:0;margin-top:12px"><button class="btn primary" id="exp-open">Ausgabe erfassen …</button></div>`; }
  $('#restore').hidden = !state.backup;
  const lb = state.lastBackup, since = state.sales.filter(s => s.t > (lb || 0)).length;
  $('#backup-status').textContent = lb ? `Letzte Sicherung: ${fmtTS(lb)} · seitdem ${since} neue ${since === 1 ? 'Buchung' : 'Buchungen'}` : `Noch keine Sicherung erstellt (${state.sales.length} Buchungen auf diesem Gerät).`;
  storageInfo().then(t => { $('#storage-info').textContent = t; });
  const saleVat = s => { const g = {}; for (const [id, n] of Object.entries(s.lines)) { const pr = s.info && s.info[id] ? s.info[id].price : ALL[id] ? ALL[id].price : 0, r = vatOf(s.info, id); g[r] = (g[r] || 0) + n * pr; } return vatText(g).vat; };
  const list = [...state.sales].reverse();
  $('#sales-list').innerHTML = list.length ? list.map(s => `
    <div class="sale${s.void ? ' void' : ''}">
      <div class="sale-main">
        <div class="sale-head"><b>#${s.n}</b>${s.on ? ' · <b class="ono sm">' + esc(s.on) + '</b>' : ''} · ${fmtTS(s.t)} · ${esc(labelOf(s.stand))}${s.donation ? ' · <span class="tag pp">Spende</span>' : ''}${s.method === 'paypal' ? ' · <span class="tag pp">PayPal</span>' : ''}${s.void ? ' · <span class="tag">storniert</span>' : ''}</div>
        <div class="sale-lines">${esc(lineText(s))}</div>
        <div class="sale-cash">${s.void ? 'storniert – Kassenstand unverändert' : s.method === 'paypal' ? 'PayPal – Kassenstand unverändert' : `Kasse ${s.total + (s.tip || 0) < 0 ? '−' : '+'}${euro(Math.abs(s.total + (s.tip || 0)))}`} → <b>${euro(cs.m[s.n])}</b></div>
        <div class="sale-pay">${s.note ? esc(s.note) : s.donation ? `Spende ${euro(s.tip)} (${s.method === 'paypal' ? 'PayPal' : 'bar'})` : s.method === 'paypal' ? 'Bezahlt mit PayPal' : s.payout ? `Ausgezahlt ${euro(-s.total)}` : `Gegeben ${euro(s.given)}${s.tip ? ` · Spende ${euro(s.tip)}` : ''} · Rückgeld ${euro(s.change)}`}${state.vat.on ? ` · MwSt ${euro(saleVat(s))}` : ''}</div>
      </div>
      <b class="sale-sum">${euro(s.total)}</b>
      <div class="sale-btns">${state.receipt.on ? `<button class="btn" data-share="${s.n}">QR / Mail</button><button class="btn" data-pdf="${s.n}">PDF</button><button class="btn" data-print="${s.n}">Drucken</button>` : ''}
      <button class="btn ${s.void ? '' : 'destructive'}" data-void="${s.n}">${s.void ? 'Storno aufheben' : 'Stornieren'}</button></div>
    </div>`).join('') : '<p class="empty">Noch keine Buchungen.</p>';
}

// --- Datensicherung (Datei zum Wiederherstellen)
const BACKUP_KEYS = ['design', 'catalog', 'sales', 'seq', 'vat', 'tip', 'cash', 'moves', 'counts', 'receipt', 'paypal', 'ppMode', 'exp', 'orderOff'];
async function deliver(file, title) {
  try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title }); return true; } }
  catch (err) { if (err.name === 'AbortError') return false; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 8000); return true;
}
async function backupSave() {
  const data = {}; BACKUP_KEYS.forEach(k => { data[k] = state[k]; });
  const d = new Date(), p = k => String(k).padStart(2, '0');
  const name = `kasse-sicherung-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`;
  const file = new File([JSON.stringify({ app: 'kasse', version: VERSION, savedAt: Date.now(), data })], name, { type: 'application/json' });
  if (await deliver(file, 'Kasse Sicherung')) { state.lastBackup = Date.now(); save(); renderAdmin(); }
}
async function backupRestore(file) {
  let b;
  try { b = JSON.parse(await file.text()); } catch (e) { b = null; }
  if (!b || b.app !== 'kasse' || !b.data || !Array.isArray(b.data.sales) || !Array.isArray(b.data.catalog)) { await ask('Keine gültige Sicherung', 'Diese Datei ist keine Kasse-Sicherung (.json).', 'OK'); return; }
  const ok = await ask('Sicherung wiederherstellen?', `Sicherung vom ${fmtTS(b.savedAt)} mit ${b.data.sales.length} Buchungen. Die aktuellen Daten dieses Geräts (${state.sales.length} Buchungen) werden ersetzt. Das Passwort bleibt unverändert.`, 'Wiederherstellen');
  if (!ok) return;
  BACKUP_KEYS.forEach(k => { if (b.data[k] !== undefined) state[k] = b.data[k]; });
  state.cart = {}; migrateCatalog(state.catalog); state.mig17 = true; setCatalog(state.catalog);
  save(); build(); renderAdmin();
}
async function storageInfo() {
  try { const p = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : null; return p === null ? '' : p ? 'Dauerhafter Speicher: ja' : 'Dauerhafter Speicher: nicht zugesagt (Daten bitte regelmäßig sichern)'; } catch (e) { return ''; }
}

// --- Speichern: CSV-Datei (iPad: „In Dateien sichern“ / Teilen-Menü, Android: Download)
async function exportFile() {
  const d = new Date(), p = n => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  const q = v => `"${String(v).replace(/"/g, '""')}"`, num = c => (c / 100).toFixed(2).replace('.', ','), row = a => a.map(q).join(';');
  const { perS, revS, rev, gr, grS } = sold(), V = state.vat.on, cs = cashSeries();
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
  rows.push(row(['', 'GESAMT (dieses Gerät)', '', '', num(all)]), row(['', 'davon Bar', '', '', num(payTotals().bar)]), row(['', 'davon PayPal', '', '', num(payTotals().paypal)]), row(['', 'Spenden gesamt (nicht im Umsatz)', '', '', num(payTotals().tip)]), row(['', 'Kassenstand Anfang (Bargeld)', '', '', num(state.cash.start)]), row(['', 'Kassenstand aktuell (Bargeld, ohne PayPal)', '', '', num(cs.bal)]), row(['Stand der Daten', stamp]));
  if (V) { rows.push('', row(['Mehrwertsteuer', 'Satz', 'Brutto (€)', 'Netto (€)', 'MwSt (€)'])); for (const r of Object.keys(gr).sort((x, y) => x - y)) rows.push(row(['', pct(r), num(gr[r]), num(gr[r] - vatPart(gr[r], +r)), num(vatPart(gr[r], +r))])); const T = vatText(gr); rows.push(row(['', 'GESAMT', num(all), num(T.net), num(T.vat)])); }
  rows.push('', row(['Bon-Nr.', 'Zeit', 'Stand', 'Artikel', 'Summe (€)', 'Gegeben (€)', 'Rückgeld (€)', 'Status', 'Zahlart', 'Spende (€)', 'Kassenstand danach (€)'].concat(V ? ['MwSt (€)'] : [])));
  for (const s of state.sales) rows.push(row([s.n, fmtTS(s.t), labelOf(s.stand), lineText(s), num(s.total), num(s.given), num(s.change), s.void ? 'storniert' : 'gültig', s.method === 'paypal' ? 'PayPal' : 'Bar', num(s.tip || 0), num(cs.m[s.n])].concat(V ? [num((() => { const g = {}; for (const [id, n] of Object.entries(s.lines)) { const pr = s.info && s.info[id] ? s.info[id].price : ALL[id] ? ALL[id].price : 0, r = vatOf(s.info, id); g[r] = (g[r] || 0) + n * pr; } return vatText(g).vat; })())] : [])));
  if (state.exp.length) {
    rows.push('', row(['Ausgaben', 'Zeit', 'Bezeichnung', 'Betrag (€)', 'Status', 'Sparte', 'Aus der Kasse']));
    state.exp.forEach(x => rows.push(row(['', fmtTS(x.t), x.note, num(x.amt), x.void ? 'storniert' : 'gültig', x.stand ? labelOf(x.stand) : 'Allgemein', x.cash ? 'ja' : 'nein'])));
    rows.push(row(['', 'Ausgaben gesamt', '', num(state.exp.filter(x => !x.void).reduce((a, x) => a + x.amt, 0))]));
  }
  if (state.moves.length || state.counts.length) {
    rows.push('', row(['Kasse: Einlagen/Entnahmen', 'Zeit', 'Bemerkung', 'Betrag (€)', 'Status']));
    state.moves.forEach(x => rows.push(row(['', fmtTS(x.t), x.note || '', num(x.amt), x.void ? 'storniert' : 'gültig'])));
    rows.push(row(['', 'Einlagen gesamt', '', num(cs.ein)]), row(['', 'Entnahmen gesamt', '', num(-cs.ent)]));
    rows.push('', row(['Kassensturz', 'Zeit', 'Soll (€)', 'Gezählt (€)', 'Differenz (€)', 'Bemerkung']));
    state.counts.forEach(c => rows.push(row(['', fmtTS(c.t), num(c.soll), num(c.ist), num(c.diff), c.note || ''])));
  }
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
    const d = $('#text-dlg'); d.returnValue = ''; d.showModal(); focusFirst('#t-input');
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
  const pf = ALL['g-pfand'] && id !== 'g-pfand' && id !== 'g-pfand-rueck';
  $('#i-auto-l').hidden = !pf; $('#i-auto').value = pf && it.autoAdd ? it.autoAdd : '';
  const g = id ? stand().groups.find(x => x.items.some(i => i.id === id)) : findGroup(gid);
  $('#i-title').textContent = id ? 'Produkt bearbeiten' : 'Neues Produkt';
  $('#i-name').value = it.name; $('#i-sub').value = it.sub || '';
  $('#i-price').value = id ? (Math.abs(it.price) / 100).toFixed(2).replace('.', ',') : '';
  $('#i-group').innerHTML = stand().groups.map(x => `<option value="${x.id}" ${g && x.id === g.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
  $('#i-del').hidden = !id; $('#i-err').textContent = '';
  $('#item-dlg').showModal(); if (!id) focusFirst('#i-name');
}
$('#item-form').addEventListener('submit', e => {
  e.preventDefault();
  const name = $('#i-name').value.trim(), sub = $('#i-sub').value.trim(), price = parse($('#i-price').value.trim()), gid = $('#i-group').value, vat = +$('#i-vat').value, auto = $('#i-auto').value;
  if (!name) { $('#i-err').textContent = 'Bitte einen Namen eingeben'; return; }
  if (price === null || price < 0) { $('#i-err').textContent = 'Bitte einen Preis eingeben, z. B. 3,50'; return; }
  const target = findGroup(gid);
  if (editItemId) {
    const from = stand().groups.find(x => x.items.some(i => i.id === editItemId)), it = from.items.find(i => i.id === editItemId);
    Object.assign(it, { name, price: editItemId === 'g-pfand-rueck' ? -Math.abs(price) : price, vat }); if (sub) it.sub = sub; else delete it.sub;
    if (auto) it.autoAdd = auto; else delete it.autoAdd;
    if (editItemId === 'g-pfand') STANDS.forEach(s => s.groups.forEach(g => g.items.forEach(i => { if (i.id === 'g-pfand-rueck') i.price = -price; }))); // Rückgabe = Pfand
    if (from !== target) { from.items.splice(from.items.indexOf(it), 1); target.items.push(it); }
  } else { const n = { id: uid('i'), name, price, vat }; if (sub) n.sub = sub; if (auto) n.autoAdd = auto; target.items.push(n); }
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
  else if (d.prefix !== undefined) { const n = (await promptText('Kürzel für Bestellnummern (1 bis 3 Zeichen, z. B. C)', standPrefix(s)) || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3); if (n) { s.prefix = n; commit(); } }
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
  if (D.prefix !== undefined || D.edit || D.newitem || D.newgroup !== undefined || D.gren || D.gdel || D.gup || D.gdown || D.addstand !== undefined || D.renamestand !== undefined || D.delstand !== undefined || D.editdone !== undefined) return editAction(t);
  if (t.id === 'pp-amount') return;
  if (t.id === 'share-toggle') return;
  if (D.share) { const s = state.sales.find(x => x.n === +D.share); if (s) showShare(s); return; }
  if (t.id === 'sh-done') { $('#sh-mail').value = ''; $('#share-dlg').close(); return; }
  if (t.id === 'sh-send') { sendMail(); return; }
  if (t.id === 'vat-toggle' || t.id === 'rc-toggle' || t.id === 'tip-toggle') return;
  if (D.pdf) { sharePdf(+D.pdf); return; }
  if (D.print) { printBon(+D.print); return; }
  if (t.id === 'toast-x') { $('#toast').hidden = true; return; }
  if (t.id === 'rc-head') { openReceiptHead(); return; }
  if (D.acc !== undefined) { setDesign({ accent: D.acc || null }); return; }
  if (t.id === 'd-reset') { state.design = { ...Theme.DEFAULT }; save(); Theme.apply(state.design); renderAdmin(); return; }
  if (t.id === 'donate') { donOpen(); return; }
  if (t.id === 'd-cancel') { $('#don-dlg').close(); return; }
  if (t.id === 'd-ok') { donBook(); return; }
  if (D.dmethod) { donMethod = D.dmethod; donUpdate(); return; }
  if (D.dkey) { donAmt = typeKey(donAmt, D.dkey); donUpdate(); return; }
  if (D.dq) { donAmt = D.dq; donUpdate(); return; }
  if (t.id === 'kitchen-open') { kitchenOpen(); return; }
  if (t.id === 'kitchen-close') { kitchenClose(); return; }
  if (t.dataset.tab) { setAsideTab(t.dataset.tab); return; }
  if (t.dataset.ordDone) { setOrdStatus(t.dataset.ordDone, 'ready', true); return; }
  if (t.dataset.ordPick) { setOrdStatus(t.dataset.ordPick, 'done', true); return; }
  if (t.id === 'ord-undo') { const u = ordUndo.pop(); if (u) setOrdStatus(u.id, u.prev, false); return; }
  if (t.id === 'kitchen-window') { monitorOpen(); return; }
  if (t.id === 'monitor-copy') { const inp = document.querySelector('#monitor-url'); inp.select(); try { navigator.clipboard.writeText(inp.value); } catch (e) {} return; }
  if (t.id === 'monitor-close') { document.querySelector('#monitor-dlg').close(); return; }
  if (t.id === 'sound-test') { Sound.unlock(); Sound.play('booked', true); return; }
  if (t.id === 'sound-test-ready') { Sound.unlock(); Sound.play('ready', true); return; }
  if (t.id === 'sound-toggle' || t.id === 'sound-booked' || t.id === 'sound-ready' || t.id === 'kitchen-toggle') return;
  if (t.id === 'ord-reset') { if (await ask('Bestellnummern zurücksetzen?', 'Alle Sparten beginnen wieder bei 1 (zum Beispiel C1, B1, K1). Schon vergebene Nummern auf Bons bleiben unverändert.', 'Zurücksetzen')) { state.orderNo = { day: '', seq: {} }; save(); renderAdmin(); } return; }
  if (t.id === 'ord-clear') { if (await ask('Küchenanzeige leeren?', 'Alle offenen und fertigen Bestellungen verschwinden aus der Küchenanzeige. Die Buchungen bleiben erhalten.', 'Leeren')) { writeOrders({ orders: [] }); renderAdmin(); } return; }
  if (t.id === 'cs-open') { csOpen(); return; }
  if (t.id === 'cs-save') { csSave(); return; }
  if (t.id === 'cs-cancel' || t.id === 'cs-done') { $('#cs-dlg').close(); return; }
  if (D.csm) { const i = document.querySelector(`#cs-grid input[data-d="${D.d}"]`); i.value = Math.max(0, (Math.floor(+i.value) || 0) + (+D.csm)); csUpdate(); return; }
  if (t.id === 'cs-pdf') { reportPdf(csSaved && csSaved.id); return; }
  if (t.id === 'cs-print') { reportPrint(csSaved && csSaved.id); return; }
  if (t.id === 'rep-pdf') { reportPdf(); return; }
  if (t.id === 'rep-print') { reportPrint(); return; }
  if (D.rep) { reportPdf(D.rep); return; }
  if (t.id === 'exp-open') { expOpen(); return; }
  if (t.id === 'exp-cancel') { $('#exp-dlg').close(); return; }
  if (D.expvoid) { const x = state.exp.find(m => m.id === D.expvoid); if (!x) return;
    if (await ask(x.void ? 'Storno aufheben?' : 'Ausgabe stornieren?', `${fmtTS(x.t)} · ${x.note} · ${euro(x.amt)}`, x.void ? 'Aufheben' : 'Stornieren')) { x.void = !x.void; state.moves.filter(m => m.expId === x.id).forEach(m => { m.void = x.void; }); save(); renderAdmin(); }
    return; }
  if (t.id === 'mv-open') { mvOpen(); return; }
  if (t.id === 'mv-cancel') { $('#mv-dlg').close(); return; }
  if (D.kind) { mvKind = D.kind; mvSeg(); return; }
  if (D.mvvoid) { const x = state.moves.find(m => m.id === D.mvvoid); if (!x) return;
    if (await ask(x.void ? 'Storno aufheben?' : 'Einlage/Entnahme stornieren?', `${fmtTS(x.t)} · ${euro(x.amt)}${x.note ? ' · ' + x.note : ''}`, x.void ? 'Aufheben' : 'Stornieren')) { x.void = !x.void; save(); renderAdmin(); }
    return; }
  if (t.id === 'cash-start') {
    const n = await promptText('Anfangsbestand der Kasse in €', state.cash.at ? fmtIn(state.cash.start) : '', 'z. B. 100');
    if (n !== null) { const c = parse(n.replace(/[^\d,.]/g, '')); if (c === null || c < 0) await ask('Ungültiger Betrag', 'Bitte einen Betrag wie 100 oder 85,50 eingeben.', 'OK'); else { state.cash = { start: c, at: Date.now() }; save(); renderAdmin(); } }
    return;
  }
  if (D.target) { target = D.target; payUpdate(); return; }
  if (D.tipq) {
    const g = parse(given), total = cartTotal();
    tip = D.tipq === 'none' ? '' : D.tipq === 'rest' ? (g !== null && g > total ? fmtIn(g - total) : '') : fmtIn(Math.max(0, parse(tip) || 0) + (+D.tipq)); // +0,50 / +1 / +2 addieren sich
    payUpdate(); return;
  }
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
  else if (t.dataset.sub) { cartAdd(t.dataset.sub, -1); }
  else if (t.dataset.stand) { if (state.lock && !editing) return; state.stand = t.dataset.stand; save(); history.replaceState(null, '', '#' + state.stand); build(); }
  else if (t.id === 'pay') openPay();
  else if (t.id === 'clear') { state.cart[state.stand] = {}; save(); update(); }
  else if (t.dataset.key) key(t.dataset.key);
  else if (t.dataset.quick) { target = 'given'; given = t.dataset.quick === 'total' ? (cartTotal() / 100).toFixed(2).replace('.', ',').replace(/,00$/, '') : t.dataset.quick; payUpdate(); }
  else if (t.dataset.nkey) numKey(t.dataset.nkey);
  else if (t.id === 'n-ok') { manualNo = normNo(nv); $('#num-dlg').close(); book(); }
  else if (t.id === 'n-cancel') { $('#num-dlg').close(); }
  else if (t.id === 'p-ok') book();
  else if (t.id === 'p-cancel') $('#pay-dlg').close();
  else if (t.id === 'admin-close') hideAdmin();
  else if (t.id === 'save') exportFile();
  else if (t.id === 'backup-save') backupSave();
  else if (t.id === 'backup-restore') $('#restore-file').click();
  else if (t.id === 'pw-change') pwDialog('change');
  else if (t.dataset.void) {
    const s = state.sales.find(x => x.n === +t.dataset.void); if (!s) return;
    const ok = await ask(s.void ? 'Storno aufheben?' : `Bon #${s.n} stornieren?`, `${lineText(s)} · ${euro(s.total)}`, s.void ? 'Aufheben' : 'Stornieren');
    if (ok) { s.void = !s.void; syncOrder(s); save(); renderAdmin(); }
  }
  else if (t.id === 'wipe') {
    if (await ask('Alle Buchungen löschen?', `${state.sales.length} Buchungen werden von diesem Gerät gelöscht. Sie werden vorher intern gesichert und lassen sich wiederherstellen. Tipp: erst „Zahlen speichern“.`, 'Löschen')) {
      state.backup = { sales: state.sales, seq: state.seq }; state.sales = []; state.seq = 0; save(); renderAdmin();
    }
  }
  else if (t.id === 'restore' && state.backup) { state.sales = state.backup.sales; state.seq = state.backup.seq; state.backup = null; save(); renderAdmin(); }
});
$('#pay-dlg').addEventListener('cancel', () => {}); // Esc schließt wie Abbrechen

// --- Kassensturz, Einlagen/Entnahmen und Kassenbericht
const denLabel = d => d >= 100 ? `${d / 100} €` : `${d} Cent`;
function csSum() { const c = {}; document.querySelectorAll('#cs-grid input').forEach(i => { const n = Math.max(0, Math.floor(+i.value) || 0); if (n) c[i.dataset.d] = n; }); return c; }
function csUpdate() {
  const counts = csSum(), ist = Kasse.countTotal(counts), soll = cashSeries().bal, diff = ist - soll;
  document.querySelectorAll('#cs-grid input').forEach(i => { $(`[data-s="${i.dataset.d}"]`).textContent = euro((+i.dataset.d) * Math.max(0, Math.floor(+i.value) || 0)); });
  $('#cs-ist').textContent = euro(ist); $('#cs-soll').textContent = euro(soll);
  const el = $('#cs-diff'); el.className = diff === 0 ? 'ok' : 'bad';
  el.textContent = diff === 0 ? 'Kasse stimmt' : diff > 0 ? `Überschuss ${euro(diff)}` : `Fehlbetrag ${euro(-diff)}`;
}
function csOpen() {
  const row = d => `<div class="cs-row"><span class="cs-l">${denLabel(d)}</span><button class="btn sm" data-csm="-1" data-d="${d}" aria-label="weniger">−</button><input type="number" inputmode="numeric" min="0" value="0" data-d="${d}" aria-label="Anzahl ${denLabel(d)}"><button class="btn sm" data-csm="1" data-d="${d}" aria-label="mehr">+</button><span class="cs-s" data-s="${d}">0,00 €</span></div>`;
  const D = Kasse.DENOMS;
  $('#cs-grid').innerHTML = `<div><h3>Scheine</h3>${D.filter(d => d >= 500).map(row).join('')}</div><div><h3>Münzen</h3>${D.filter(d => d < 500).map(row).join('')}</div>`;
  $('#cs-note').value = ''; $('#cs-before').hidden = false; $('#cs-after').hidden = true; csUpdate();
  if (!$('#cs-dlg').open) $('#cs-dlg').showModal();
}
let csSaved = null;
function csSave() {
  const counts = csSum(), ist = Kasse.countTotal(counts), soll = cashSeries().bal;
  csSaved = { id: uid('c'), t: Date.now(), soll, ist, diff: ist - soll, denoms: counts, note: $('#cs-note').value.trim() };
  state.counts.push(csSaved); save(); renderAdmin();
  $('#cs-before').hidden = true; $('#cs-after').hidden = false;
  $('#cs-result').innerHTML = `Kassensturz gespeichert: gezählt <b>${euro(ist)}</b> · Soll <b>${euro(soll)}</b> · <b class="${csSaved.diff === 0 ? 'ok' : 'bad'}">${csSaved.diff === 0 ? 'Kasse stimmt' : csSaved.diff > 0 ? 'Überschuss ' + euro(csSaved.diff) : 'Fehlbetrag ' + euro(-csSaved.diff)}</b>`;
}
function expOpen() {
  $('#exp-amt').value = ''; $('#exp-note').value = ''; $('#exp-cash').checked = false; $('#exp-err').textContent = '';
  $('#exp-stand').innerHTML = '<option value="">Allgemein (keiner Sparte zugeordnet)</option>' + STANDS.map(s => `<option value="${esc(s.id)}">${esc(s.label)}</option>`).join('');
  $('#exp-dlg').showModal();
}
$('#exp-form').addEventListener('submit', e => {
  e.preventDefault();
  const amt = parse($('#exp-amt').value.trim()), note = $('#exp-note').value.trim();
  if (amt === null || amt <= 0) { $('#exp-err').textContent = 'Bitte einen Betrag eingeben, z. B. 24,90'; return; }
  if (!note) { $('#exp-err').textContent = 'Bitte eine Bezeichnung eingeben, z. B. „Einkauf Metro“'; return; }
  const x = { id: uid('e'), t: Date.now(), amt, note, stand: $('#exp-stand').value || null, cash: $('#exp-cash').checked, void: false };
  state.exp.push(x);
  if (x.cash) state.moves.push({ id: uid('m'), t: x.t, amt: -amt, note: 'Ausgabe: ' + note, expId: x.id });   // aus der Kasse bezahlt: mindert den Kassenstand
  save(); $('#exp-dlg').close(); renderAdmin();
});
let mvKind = 'ein';
function mvOpen() { mvKind = 'ein'; $('#mv-amt').value = ''; $('#mv-note').value = ''; $('#mv-err').textContent = ''; mvSeg(); $('#mv-dlg').showModal(); }
function mvSeg() { document.querySelectorAll('#mv-seg button').forEach(b => b.setAttribute('aria-selected', b.dataset.kind === mvKind)); }
$('#mv-form').addEventListener('submit', e => {
  e.preventDefault();
  const amt = parse($('#mv-amt').value.trim());
  if (amt === null || amt <= 0) { $('#mv-err').textContent = 'Bitte einen Betrag eingeben, z. B. 50'; return; }
  state.moves.push({ id: uid('m'), t: Date.now(), amt: mvKind === 'ein' ? amt : -amt, note: $('#mv-note').value.trim() });
  save(); $('#mv-dlg').close(); renderAdmin();
});
function reportLines(c) {
  const N = 80, L = [], R = state.receipt, cs = cashSeries(), { rev, cnt, gr } = sold(), pay = payTotals();
  const l = (t, b) => L.push({ t, b: !!b }), hr = () => l('-'.repeat(N));
  const cen = (t, b) => l(' '.repeat(Math.max(0, Math.floor((N - t.length) / 2))) + t, b);
  const lr = (a, b, bold) => { const left = a.length > N - b.length - 1 ? a.slice(0, N - b.length - 2) + '…' : a; l(left.padEnd(N - b.length) + b, bold); };
  const diffTxt = d => d === 0 ? 'Kasse stimmt' : d > 0 ? 'Überschuss' : 'Fehlbetrag';
  cen('KASSENBERICHT', true);
  if (R.name) wrapText(R.name, N).forEach(x => cen(x, true));
  String(R.addr || '').split(/\n|;/).map(x => x.trim()).filter(Boolean).forEach(x => cen(x));
  if (R.tax) cen(R.tax);
  hr();
  l('Erstellt:   ' + new Date().toLocaleString('de-DE'));
  l('Gerät:      ' + (state.lock ? labelOf(state.lock) : 'alle Stände') + (IS_TEST ? '  (TESTVERSION)' : ''));
  const valid = state.sales.filter(s => !s.void), voids = state.sales.filter(s => s.void);
  l('Zeitraum:   ' + (state.sales.length ? fmtTS(state.sales[0].t) + ' bis ' + fmtTS(state.sales[state.sales.length - 1].t) : 'noch keine Buchungen'));
  l(`Buchungen:  ${valid.length} gültig, ${voids.length} storniert`);
  hr(); l('BARGELD', true);
  lr('Anfangsbestand', money(state.cash.start));
  lr('+ Barverkäufe (brutto)', money(cs.sales)); lr('+ Spenden (nicht im Umsatz)', money(cs.tips));
  lr('+ Einlagen', money(cs.ein)); lr('- Entnahmen', money(cs.ent ? -cs.ent : 0));
  lr('= Soll-Bestand (rechnerisch)', money(cs.bal), true);
  hr(); l('KASSENSTURZ', true);
  if (c) {
    l('Datum:      ' + fmtTS(c.t) + (c.note ? '  (' + c.note + ')' : ''));
    lr('Soll-Bestand zum Zeitpunkt', money(c.soll)); lr('Gezählter Bestand', money(c.ist));
    lr(`Differenz (${diffTxt(c.diff)})`, money(c.diff), true);
    l(''); l('Zählprotokoll:');
    Kasse.DENOMS.filter(d => c.denoms[d]).forEach(d => lr(`  ${c.denoms[d]} x ${denLabel(d)}`, money(d * c.denoms[d])));
    lr('  Summe', money(c.ist), true);
  } else l('Es wurde noch kein Kassensturz durchgeführt.');
  if (state.counts.length > 1) { l(''); l('Alle Kassenstürze:'); state.counts.forEach(x => lr('  ' + fmtTS(x.t) + ' gezählt ' + money(x.ist), 'Diff. ' + money(x.diff))); }
  if (state.moves.length) { l(''); l('Einlagen und Entnahmen:'); state.moves.forEach(x => lr('  ' + fmtTS(x.t) + ' ' + (x.note || (x.amt > 0 ? 'Einlage' : 'Entnahme')) + (x.void ? ' (storniert)' : ''), money(x.amt))); }
  hr(); l('UMSÄTZE (brutto, ohne Storno)', true);
  standIds().forEach(id => { const k = valid.filter(x => x.stand === id).length; lr(`${labelOf(id)}: ${k} ${k === 1 ? 'Buchung' : 'Buchungen'}, ${cnt[id] || 0} Artikel`, money(rev[id] || 0)); });
  lr('Gesamt', money(Object.values(rev).reduce((x, y) => x + y, 0)), true);
  if (state.exp.some(x => !x.void)) {
    const E = state.exp.filter(x => !x.void), et = E.reduce((a, x) => a + x.amt, 0), rt = Object.values(rev).reduce((x, y) => x + y, 0);
    l(''); l('AUSGABEN', true);
    E.forEach(x => lr('  ' + fmtTS(x.t) + ' ' + x.note + (x.stand ? ' (' + labelOf(x.stand) + ')' : ''), money(-x.amt)));
    lr('Ausgaben gesamt', money(-et), true); lr(rt - et >= 0 ? 'Gewinn (Einnahmen − Ausgaben)' : 'Verlust (Einnahmen − Ausgaben)', money(rt - et), true);
  }
  lr('  davon bar bezahlt', money(pay.bar)); lr('  davon PayPal (nicht im Bargeld)', money(pay.paypal));
  if (state.vat.on) { l(''); l('Enthaltene Mehrwertsteuer:'); Object.keys(gr).sort((x, y) => x - y).forEach(r => lr(`  Satz ${pct(r)}  (brutto ${money(gr[r])})`, money(vatPart(gr[r], +r)))); }
  hr(); l('HINWEISE', true);
  lr(`Stornierte Buchungen: ${voids.length}`, money(voids.reduce((x, s) => x + s.total, 0)));
  lr(`Spenden ohne Einkauf: ${pay.don}`, money(pay.donSum));
  const po = valid.filter(s => s.payout); lr(`Pfand-Auszahlungen: ${po.length}`, money(po.reduce((x, s) => x + s.total, 0)));
  l(''); l(''); l('Kassierer/in: ________________________   Geprüft: ________________________');
  l(''); l('Datum, Unterschrift');
  return L;
}
async function reportPdf(id) {
  const c = id ? state.counts.find(x => x.id === id) : state.counts[state.counts.length - 1];
  const d = new Date(), p = k => String(k).padStart(2, '0');
  const file = new File([Kasse.makePdf(reportLines(c), { w: 595.28, h: 841.89, m: 36, fs: 10, lh: 12.5 })], `kassenbericht-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.pdf`, { type: 'application/pdf' });
  await deliver(file, 'Kassenbericht');
}
function reportPrint(id) {
  const c = id ? state.counts.find(x => x.id === id) : state.counts[state.counts.length - 1];
  $('#print-area').textContent = reportLines(c).map(x => x.t).join('\n'); $('#print-area').classList.add('rep');
  window.print(); setTimeout(() => $('#print-area').classList.remove('rep'), 500);
}

// --- Bons: Zeitstempel, PDF und Druck
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
  if (s.on) c('BESTELLNUMMER ' + s.on, true);
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
  if (s.donation) { lr('Spende (ohne Einkauf)', money(s.tip)); }
  hr(); lr('SUMME', money(s.donation ? s.tip : s.total), true);
  if (s.donation) lr(s.method === 'paypal' ? 'Bezahlt mit PayPal' : 'Bar gegeben', money(s.given));
  else if (s.method === 'paypal') lr('Bezahlt mit PayPal', money(s.total));
  else if (s.payout) lr('Ausgezahlt', money(-s.total));
  else if (s.total === 0) { /* nichts zu zahlen */ }
  else if (!s.note) { lr('Bar gegeben', money(s.given)); if (s.tip) lr('Spende', money(s.tip)); lr('Rückgeld', money(s.change)); }
  if (state.vat.on && Object.keys(g).length) {
    hr(); l('Enthaltene MwSt.:'); const T = vatText(g);
    Object.entries(g).sort((x, y) => x[0] - y[0]).forEach(([r, x]) => lr(`  MwSt ${pct(r)} (brutto ${money(x)})`, money(vatPart(x, +r))));
    lr('  Netto gesamt', money(T.net));
  }
  hr(); l('Gedruckt: ' + new Date().toLocaleString('de-DE'));
  if (R.foot) { l(''); wrapText(R.foot, N).forEach(x => c(x)); }
  if (s.void) { l(''); c('*** STORNIERT ***', true); }
  return L;
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
// --- Bon für Kunden: QR-Code zur Online-Ansicht (bon.html) und E-Mail über das Mail-Programm des Tablets
function bonPayload(s) {
  const R = state.receipt;
  if (s.donation) return { v: 1, n: s.n, t: s.t, s: labelOf(s.stand), m: s.method === 'paypal' ? 'p' : 'b', tot: s.tip, giv: s.given, tip: 0, chg: 0, po: 0, x: 0, o: '', L: [['Spende (ohne Einkauf)', 1, s.tip, 0]], h: [R.name, R.addr, R.tax, R.foot] };
  return { v: 1, n: s.n, t: s.t, o: s.on || '', s: labelOf(s.stand), m: s.method === 'paypal' ? 'p' : 'b', tot: s.total, giv: s.given, tip: s.tip || 0, chg: s.change, po: s.payout ? 1 : 0, x: state.vat.on ? 1 : 0,
    L: Object.entries(s.lines).map(([id, n]) => [itemName(s, id), n, s.info && s.info[id] ? s.info[id].price : ALL[id] ? ALL[id].price : 0, vatOf(s.info, id)]),
    h: [R.name, R.addr, R.tax, R.foot] };
}
async function bonLink(s) { return location.origin + location.pathname.replace(/[^/]*$/, '') + 'bon.html#' + await Kasse.bonEncode(bonPayload(s)); }
let shareSale = null, shareLink = '';
async function showShare(s) {
  shareSale = s; $('#toast').hidden = true;
  $('#sh-title').textContent = `Bon #${s.n} · ${euro(s.donation ? s.tip : s.total)}`; $('#sh-ono').textContent = s.on ? 'Bestellnummer ' + s.on : (s.donation ? 'Spende – vielen Dank!' : ''); $('#sh-ono').hidden = !$('#sh-ono').textContent; $('#sh-mail').value = ''; $('#sh-err').textContent = '';
  $('#sh-pdf').dataset.pdf = s.n; $('#sh-print').dataset.print = s.n;
  $('#sh-qr').innerHTML = '<p class="muted">QR-Code wird erstellt …</p>';
  if (!$('#share-dlg').open) $('#share-dlg').showModal();
  try { shareLink = await bonLink(s); const img = qrImg(shareLink, 340, 'L'); $('#sh-qr').innerHTML = img || '<p class="err">QR-Code konnte nicht erzeugt werden.</p>'; }
  catch (e) { shareLink = ''; $('#sh-qr').innerHTML = '<p class="err">QR-Code konnte nicht erzeugt werden.</p>'; }
}
function mailFor(s, to) {
  const text = receiptLines(s).map(l => l.t).join('\n');
  const body = text + (shareLink && shareLink.length < 1200 ? `\n\nBon online ansehen:\n${shareLink}` : '');
  return Kasse.mailtoUrl(to, `Ihr Bon Nr. ${String(s.n).padStart(4, '0')} – ${RC_DEFAULT.name}`, body);
}
function sendMail() {
  const to = $('#sh-mail').value.trim();
  if (!Kasse.isEmail(to)) { $('#sh-err').textContent = 'Bitte eine gültige E-Mail-Adresse eingeben'; return; }
  const a = document.createElement('a'); a.href = mailFor(shareSale, to); document.body.appendChild(a); a.click(); a.remove();   // öffnet das Mail-Programm mit fertigem Entwurf
}
$('#share-dlg').addEventListener('close', () => { $('#sh-mail').value = ''; });                                       // E-Mail-Adressen werden nie gespeichert
function afterBook(s) { if (state.receipt.on && state.share.on) showShare(s); else showToast(s); kitchenBadge(); }
let toastTimer = null;
function showToast(s) {
  if (!s || !(state.receipt.on || s.on)) return;
  const btns = state.receipt.on ? `<button data-share="${s.n}">QR / Mail</button><button data-pdf="${s.n}">PDF</button><button data-print="${s.n}">Drucken</button>` : '';
  $('#toast').innerHTML = `${s.on ? `<b class="ono">${esc(s.on)}</b>` : ''}<span>${s.donation ? 'Spende' : 'Bon'} #${s.n} gebucht · ${new Date(s.t).toLocaleTimeString('de-DE')}</span>${btns}<button id="toast-x" aria-label="Schließen">✕</button>`;
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
$('#pp-mode').addEventListener('change', e => { state.ppMode = e.target.value; save(); renderAdmin(); });
$('#tip-toggle').addEventListener('change', e => { state.tip.on = e.target.checked; save(); renderAdmin(); });
$('#lock-select').addEventListener('change', e => { state.lock = e.target.value || null; if (state.lock) state.stand = state.lock; save(); renderAdmin(); });
function setDesign(p) { state.design = Object.assign({}, Theme.resolve(state.design), p); save(); Theme.apply(state.design); renderAdmin(); }
$('#d-theme').addEventListener('change', e => setDesign({ theme: e.target.value }));
$('#d-mode').addEventListener('change', e => setDesign({ mode: e.target.value }));
$('#d-logo').addEventListener('change', e => setDesign({ logo: e.target.value }));
$('#d-snow').addEventListener('change', e => setDesign({ snow: e.target.checked }));
$('#d-swatches').addEventListener('change', e => { if (e.target.id === 'd-custom') setDesign({ accent: e.target.value }); });
$('#sound-toggle').addEventListener('change', e => { state.sound.on = e.target.checked; Sound.setup(state.sound); save(); });
$('#sound-vol').addEventListener('change', e => { state.sound.vol = e.target.value; Sound.setup(state.sound); save(); Sound.unlock(); Sound.play('booked'); });
$('#ord-stands').addEventListener('change', e => { const id = e.target.dataset.ordstand; if (!id) return; if (e.target.checked) delete state.orderOff[id]; else state.orderOff[id] = true; save(); renderAdmin(); });
$('#order-mode').addEventListener('change', e => { state.orderMode = e.target.value; save(); renderAdmin(); });
['booked', 'ready'].forEach(n => $('#sound-pick-' + n).addEventListener('change', e => { state.sound.pick = Object.assign({}, state.sound.pick, { [n]: e.target.value }); Sound.setup(state.sound); save(); Sound.unlock(); Sound.preview(e.target.value); }));
$('#sound-booked').addEventListener('change', e => { state.sound.tones = Object.assign({}, state.sound.tones, { booked: e.target.checked }); Sound.setup(state.sound); save(); });
$('#sound-ready').addEventListener('change', e => { state.sound.tones = Object.assign({}, state.sound.tones, { ready: e.target.checked }); Sound.setup(state.sound); save(); });
$('#kitchen-toggle').addEventListener('change', e => { state.kitchen.on = e.target.checked; save(); kitchenBadge(); renderAdmin(); });
$('#share-toggle').addEventListener('change', e => { state.share.on = e.target.checked; save(); renderAdmin(); });
$('#rc-toggle').addEventListener('change', e => { state.receipt.on = e.target.checked; save(); renderAdmin(); });

$('#vat-toggle').addEventListener('change', e => { state.vat.on = e.target.checked; save(); renderAdmin(); });

$('#restore-file').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) backupRestore(f); });

$('#cs-grid').addEventListener('input', csUpdate);

// --- Versteckter Zugang: Titel 1,5 s halten oder 5× schnell antippen
let hold = null;
const cancelHold = () => { clearTimeout(hold); hold = null; };
$('#title').addEventListener('pointerdown', () => { cancelHold(); hold = setTimeout(openAdmin, 1500); });
['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => $('#title').addEventListener(ev, cancelHold));
$('#title').addEventListener('contextmenu', e => e.preventDefault());
let taps = [];
$('#title').addEventListener('pointerdown', () => { const n = Date.now(); taps = taps.filter(x => n - x < 2500); taps.push(n); if (taps.length >= 5) { taps = []; cancelHold(); openAdmin(); } });

kitchenBadge();
if (IS_TEST) { document.body.classList.add('is-test'); document.title = 'Kasse TEST'; }
try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}   // iPadOS/Android sollen die Daten nicht von selbst löschen
let wakeLock = null;                                                                                    // Bildschirm bleibt während des Verkaufs an
async function keepAwake() { try { if ('wakeLock' in navigator && document.visibilityState === 'visible' && (!wakeLock || wakeLock.released)) wakeLock = await navigator.wakeLock.request('screen'); } catch (e) {} }
document.addEventListener('visibilitychange', keepAwake); document.addEventListener('pointerdown', keepAwake, { passive: true }); keepAwake();
build();
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(r => r.update()).catch(() => {});
  let had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (had && !document.querySelector('dialog[open]') && $('#admin').hidden) location.reload(); had = true; });
}

// Sehr alte iPads (vor iPadOS 15.4) kennen <dialog> nicht: Hinweis statt stiller Fehler
if (!window.HTMLDialogElement || !HTMLDialogElement.prototype.showModal) document.body.insertAdjacentHTML('afterbegin', '<div style="background:#FF3B30;color:#fff;padding:12px 16px;font-weight:600">Dieses Gerät ist zu alt (iPadOS bzw. Browser 15.4 oder neuer nötig). Bezahlen und Verwaltung funktionieren hier nicht.</div>');
