'use strict';
// Reine Rechen- und Hilfsfunktionen der Kasse (ohne Bildschirm/Speicher). Werden von app.js benutzt und in tests/unit.js getestet.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.Kasse = factory();
})(typeof self !== 'undefined' ? self : this, function () {
const parse = s => { if (!s) return null; const v = parseFloat(s.replace(',', '.')); return isNaN(v) ? null : Math.round(v * 100); };
const vatPart = (gross, r) => Math.round(gross * r / (100 + r));
// PayPal-Link bereinigen: doppeltes https://, fehlendes https://, Text um den Link herum, Leerzeichen
function normalizeLink(raw) {
  let s = String(raw || '').trim();
  const m = s.match(/https?:\/\/\S+/i);
  if (m) s = m[0];
  s = s.replace(/^(https?:\/\/)+https?:?\/\//i, 'https://');
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s.replace(/^\/+/, '');
  try { const u = new URL(s); return /^https?:$/.test(u.protocol) && u.hostname.includes('.') ? u.href : ''; } catch (e) { return ''; }
}
// Einmalige Umstellung gespeicherter Sortimente: Burger in Vegi/Fleisch teilen, Spezi mit Pfand
function migrateCatalog(cat) {
  for (const s of cat) for (const g of s.groups) {
    const out = [];
    for (const it of g.items) {
      if (it.id === 'b-maul' || it.id === 'b-spezial') {
        const base = it.name.replace(/\s+[–-]\s+(Vegi|Fleisch)$/, '');
        out.push({ ...it, id: it.id + '-v', name: base + ' – Vegi', sub: 'Vegetarische Füllung' }, { ...it, id: it.id + '-f', name: base + ' – Fleisch', sub: 'Fleischfüllung' });
      } else out.push(it);
    }
    g.items = out;
    const sp = g.items.find(i => i.id === 'g-spezi');
    if (sp) {
      sp.autoAdd = 'g-pfand';
      const at = g.items.indexOf(sp) + 1, all = cat.flatMap(x => x.groups.flatMap(y => y.items.map(i => i.id)));
      if (!all.includes('g-pfand')) g.items.splice(at, 0, { id: 'g-pfand', name: 'Pfand', sub: 'pro Flasche', price: 200, kind: 'pfand' });
      if (!all.includes('g-pfand-rueck')) g.items.splice(g.items.findIndex(i => i.id === 'g-pfand') + 1, 0, { id: 'g-pfand-rueck', name: 'Pfand zurück', sub: 'wird ausgezahlt', price: -200, kind: 'pfand' });
    }
  }
}

// --- PayPal: Inhalt des QR-Codes ('amount' = paypal.me/Name/7.50, 'amountEur' = …/7.50EUR, 'none' = Link unverändert)
const isPaypalMe = u => /(^|\.)paypal\.me$/i.test(u.hostname) && u.pathname.split('/').filter(Boolean).length === 1;
function ppEmbeds(link, mode) { try { return mode !== 'none' && isPaypalMe(new URL(normalizeLink(link))); } catch (e) { return false; } }
function paypalUrl(link, mode, total) {
  try {
    const u = new URL(normalizeLink(link));
    if (ppEmbeds(link, mode)) {
      const name = u.pathname.split('/').filter(Boolean)[0], amt = total % 100 === 0 ? String(total / 100) : (total / 100).toFixed(2);
      return `${u.origin}/${name}/${amt}${mode === 'amountEur' ? 'EUR' : ''}`;
    }
    return u.href;
  } catch (e) { return ''; }
}

// --- Barzahlung: Gegeben, Spende, Rückgeld
function calcPay(total, givenStr, tipStr, tipOn) {
  const g = parse(givenStr), tp = tipOn ? Math.max(0, parse(tipStr) || 0) : 0, need = total + tp;
  return { g, tp, need, change: g === null ? null : g - need, ok: g !== null && g >= need };
}

// --- Kassenstand (Bargeld): Anfangsbestand + bar bezahlte Beträge + Spenden; PayPal und stornierte Buchungen ändern ihn nicht
function cashSeries(sales, start) {
  let bal = start, tot = 0, tips = 0; const m = {};
  for (const s of sales) {
    if (!s.void && s.method !== 'paypal') { bal += s.total + (s.tip || 0); tot += s.total; tips += s.tip || 0; }
    m[s.n] = bal;
  }
  return { m, bal, sales: tot, tips };
}
const payTotals = sales => sales.reduce((o, s) => { if (!s.void) { o[s.method === 'paypal' ? 'paypal' : 'bar'] += s.total; o.tip += s.tip || 0; } return o; }, { bar: 0, paypal: 0, tip: 0 });

// --- Bon als PDF (Courier, 80 mm breit)
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

// --- Bon als Link: Bon-Daten komprimiert im Teil nach dem „#“ (wird nie an einen Server geschickt)
const b64u = {
  enc: bytes => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
  dec: str => { str = str.replace(/-/g, '+').replace(/_/g, '/'); while (str.length % 4) str += '='; const s = atob(str), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
};
async function pipe(bytes, stream) { const w = stream.writable.getWriter(); w.write(bytes); w.close(); return new Uint8Array(await new Response(stream.readable).arrayBuffer()); }
async function bonEncode(obj) {
  const raw = new TextEncoder().encode(JSON.stringify(obj)), plain = 'p' + b64u.enc(raw);
  if (typeof CompressionStream === 'undefined') return plain;
  try { const z = 'z' + b64u.enc(await pipe(raw, new CompressionStream('deflate-raw'))); return z.length < plain.length ? z : plain; } catch (e) { return plain; }
}
async function bonDecode(str) {
  const bytes = b64u.dec(str.slice(1)), raw = str[0] === 'z' ? await pipe(bytes, new DecompressionStream('deflate-raw')) : bytes;
  return JSON.parse(new TextDecoder().decode(raw));
}
const isEmail = s => /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]{2,}$/.test(String(s || '').trim());
const mailtoUrl = (to, subject, body) => 'mailto:' + String(to).trim() + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);

// --- Lesbarkeit: Kontrast nach WCAG; textOn() wählt Schwarz oder Weiß, je nachdem, was auf der Farbe besser lesbar ist
function luminance(hex) {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrast(a, b) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
const textOn = hex => contrast('#000000', hex) >= contrast('#ffffff', hex) ? '#000000' : '#ffffff';

  return { luminance, contrast, textOn, bonEncode, bonDecode, isEmail, mailtoUrl, parse, vatPart, normalizeLink, migrateCatalog, ppEmbeds, paypalUrl, calcPay, cashSeries, payTotals, enc, wrapText, makePdf };
});
