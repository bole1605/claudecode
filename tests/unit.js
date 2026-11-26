'use strict';
// Rechentests für kasse*/logic.js (ohne Browser). Start: node tests/unit.js [ordner]
const assert = require('assert'), path = require('path');
const dir = process.argv[2] || 'kasse-test';
const K = require(path.resolve(__dirname, '..', dir, 'logic.js'));
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok  ' + name); };

t('Beträge einlesen', () => {
  assert.strictEqual(K.parse('7,50'), 750); assert.strictEqual(K.parse('7.5'), 750); assert.strictEqual(K.parse('10'), 1000);
  assert.strictEqual(K.parse(''), null); assert.strictEqual(K.parse('abc'), null); assert.strictEqual(K.parse('0,1'), 10);
});
t('MwSt. aus Brutto', () => {
  assert.strictEqual(K.vatPart(600, 7), 39); assert.strictEqual(K.vatPart(300, 19), 48); assert.strictEqual(K.vatPart(0, 19), 0);
  assert.strictEqual(K.vatPart(-200, 19), -32);   // Pfand-Rückgabe: negativ
});
t('Wechselgeld und Spende', () => {
  let r = K.calcPay(300, '10', '', true); assert.deepStrictEqual([r.need, r.change, r.ok], [300, 700, true]);
  r = K.calcPay(300, '10', '2', true); assert.deepStrictEqual([r.need, r.change, r.ok], [500, 500, true]);
  r = K.calcPay(300, '5', '2,50', true); assert.deepStrictEqual([r.need, r.change, r.ok], [550, -50, false]);   // fehlen 0,50
  r = K.calcPay(300, '10', '2', false); assert.deepStrictEqual([r.tp, r.need, r.change], [0, 300, 700]);          // Spende aus
  r = K.calcPay(300, '', '', true); assert.deepStrictEqual([r.g, r.ok, r.change], [null, false, null]);
  r = K.calcPay(300, '3', '', true); assert.strictEqual(r.ok, true);                                              // passend
});
t('Kassenstand', () => {
  const sales = [
    { n: 1, total: 600, tip: 100 }, { n: 2, total: 300, method: 'paypal' },
    { n: 3, total: 750, void: true }, { n: 4, total: 300, tip: 200 }, { n: 5, total: -200 }];
  const c = K.cashSeries(sales, 10000);
  assert.deepStrictEqual([c.m[1], c.m[2], c.m[3], c.m[4], c.m[5], c.bal], [10700, 10700, 10700, 11200, 11000, 11000]);
  assert.deepStrictEqual([c.sales, c.tips], [700, 300]);
  assert.deepStrictEqual(K.payTotals(sales), { bar: 700, paypal: 300, tip: 300, don: 0, donSum: 0 });
});
t('PayPal-Link bereinigen', () => {
  const ok = { 'https://paypal.me/Anna': 'https://paypal.me/Anna', 'paypal.me/Anna': 'https://paypal.me/Anna', '  https://paypal.me/Anna/  ': 'https://paypal.me/Anna/',
    'https://https://paypal.me/Bob': 'https://paypal.me/Bob', 'https://https//paypal.me/Bob': 'https://paypal.me/Bob',
    'Mein Link: https://www.paypal.com/qrcodes/p2pqrc/ABC123 danke': 'https://www.paypal.com/qrcodes/p2pqrc/ABC123' };
  for (const [i, o] of Object.entries(ok)) assert.strictEqual(K.normalizeLink(i), o, i);
  for (const bad of ['', 'blabla', 'ftp://x.de', 'https://']) assert.strictEqual(K.normalizeLink(bad), '', bad);
});
t('PayPal-QR-Inhalt', () => {
  assert.strictEqual(K.paypalUrl('https://paypal.me/Anna', 'amount', 600), 'https://paypal.me/Anna/6');
  assert.strictEqual(K.paypalUrl('https://paypal.me/Anna', 'amount', 750), 'https://paypal.me/Anna/7.50');
  assert.strictEqual(K.paypalUrl('https://paypal.me/Anna', 'amountEur', 750), 'https://paypal.me/Anna/7.50EUR');
  assert.strictEqual(K.paypalUrl('https://paypal.me/Anna', 'none', 750), 'https://paypal.me/Anna');
  assert.strictEqual(K.paypalUrl('https://www.paypal.com/qrcodes/p2pqrc/X', 'amount', 750), 'https://www.paypal.com/qrcodes/p2pqrc/X');   // fremder Link bleibt unverändert
  assert.strictEqual(K.ppEmbeds('https://paypal.me/Anna', 'amount'), true); assert.strictEqual(K.ppEmbeds('https://paypal.me/Anna', 'none'), false);
  assert.strictEqual(K.paypalUrl('', 'amount', 750), '');
});
t('Textumbruch', () => {
  assert.deepStrictEqual(K.wrapText('Maultaschen auf karamellisierten Zwiebeln', 18), ['Maultaschen auf', 'karamellisierten', 'Zwiebeln']);
  assert.deepStrictEqual(K.wrapText('Donaudampfschifffahrtsgesellschaft', 10), ['Donaudampf', 'schifffahr', 'tsgesellsc', 'haft']);
  assert.deepStrictEqual(K.wrapText('', 10), ['']);
});
t('Zeichensatz fürs PDF', () => {
  assert.strictEqual(K.enc('3,00 €'), '3,00 \x80'); assert.strictEqual(K.enc('Süß – Pfand'), 'Süß \x96 Pfand'); assert.strictEqual(K.enc('a b'), 'a b'); assert.strictEqual(K.enc('日'), '?');
});
const pdfCheck = (u, pages) => {
  const s = Buffer.from(u).toString('latin1');
  assert.ok(s.startsWith('%PDF-1.4') && s.trimEnd().endsWith('%%EOF'));
  const sx = +s.match(/startxref\n(\d+)/)[1]; assert.ok(s.slice(sx).startsWith('xref'));
  const N = +s.slice(sx).match(/xref\n0 (\d+)/)[1], entries = s.slice(sx).split('\n').slice(3, 3 + N - 1);
  entries.forEach((e, i) => assert.ok(s.slice(+e.slice(0, 10)).startsWith(`${i + 1} 0 obj`), 'xref ' + (i + 1)));
  assert.strictEqual((s.match(/\/Type \/Page /g) || []).length, pages, 'Seitenzahl');
  for (const m of s.matchAll(/\/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/g)) assert.strictEqual(m[2].length, +m[1], 'Länge des Inhalts');
  return s;
};
t('PDF ist gültig aufgebaut (Bon, 1 Seite)', () => {
  const s = pdfCheck(K.makePdf([{ t: 'Test (1) \\ ä', b: true }, { t: '3,00 €' }]), 1);
  assert.ok(s.includes('Test \\(1\\) \\\\ \xe4'));
});
t('PDF: Kassenbericht auf A4 mit mehreren Seiten', () => {
  const lines = Array.from({ length: 130 }, (_, i) => ({ t: 'Zeile ' + i, b: i % 40 === 0 }));
  const s = pdfCheck(K.makePdf(lines, { w: 595.28, h: 841.89, m: 48, fs: 10, lh: 14 }), 3);   // 56 Zeilen pro Seite
  assert.ok(s.includes('/MediaBox [0 0 595.28 841.89]') && s.includes('Zeile 129'));
  pdfCheck(K.makePdf([], { w: 595.28, h: 841.89, m: 48 }), 1);   // leerer Bericht
});
t('Kassenstand mit Einlagen und Entnahmen (zeitlich geordnet, Storno)', () => {
  const sales = [{ n: 1, t: 10, total: 600, tip: 100 }, { n: 2, t: 30, total: 300 }, { n: 3, t: 40, total: 750, void: true }, { n: 4, t: 50, total: 300, method: 'paypal' }];
  const moves = [{ t: 20, amt: 2000 }, { t: 35, amt: -5000 }, { t: 45, amt: -100, void: true }];
  const c = K.cashSeries(sales, 10000, moves);
  assert.deepStrictEqual([c.m[1], c.m[2], c.m[3], c.m[4], c.bal], [10700, 13000, 8000, 8000, 8000]);
  assert.deepStrictEqual([c.sales, c.tips, c.ein, c.ent], [900, 100, 2000, 5000]);
  assert.strictEqual(K.cashSeries(sales, 10000).bal, 11000);   // ohne Bewegungen wie bisher
});
t('Kassensturz: Stückelung zählen', () => {
  assert.strictEqual(K.DENOMS.length, 15); assert.strictEqual(K.DENOMS[0], 50000); assert.strictEqual(K.DENOMS[14], 1);
  assert.strictEqual(K.countTotal({ 5000: 1, 2000: 1, 500: 1, 100: 1 }), 7600);
  assert.strictEqual(K.countTotal({ 200: 3, 10: '4', 1: 7 }), 647);           // 6,00 + 0,40 + 0,07
  assert.strictEqual(K.countTotal({ 100: -2, 200: 'x', 50: 1.9 }), 50);         // ungültige Eingaben zählen nicht
  assert.strictEqual(K.countTotal({}), 0); assert.strictEqual(K.countTotal(null), 0);
});
t('Sortiment-Umstellung (Burger, Pfand)', () => {
  const cat = [{ id: 'burger', groups: [{ id: 'g1', items: [{ id: 'b-maul', name: 'Maultaschen', price: 650, vat: 7 }, { id: 'b-spezial', name: 'Spezial', price: 750, vat: 7 }] }, { id: 'g2', items: [{ id: 'g-spezi', name: 'Spezi', price: 300 }] }] }];
  K.migrateCatalog(cat);
  const ids = cat[0].groups.flatMap(g => g.items.map(i => i.id));
  assert.deepStrictEqual(ids, ['b-maul-v', 'b-maul-f', 'b-spezial-v', 'b-spezial-f', 'g-spezi', 'g-pfand', 'g-pfand-rueck']);
  assert.strictEqual(cat[0].groups[0].items[0].price, 650);   // eigener Preis bleibt
  assert.strictEqual(cat[0].groups[1].items[0].autoAdd, 'g-pfand');
  const again = JSON.stringify(cat); K.migrateCatalog(cat); assert.strictEqual(JSON.stringify(cat), again);   // zweimal ausführen ändert nichts
});
t('Lesbarkeit: Schrift auf Kategorie-Farben', () => {
  if (!K.textOn) return;
  assert.ok(K.contrast('#000000', '#ffffff') > 20.9);
  assert.strictEqual(K.textOn('#FF9F0A'), '#000000'); assert.strictEqual(K.textOn('#5856D6'), '#ffffff'); assert.strictEqual(K.textOn('#A10DBC'), '#ffffff'); assert.strictEqual(K.textOn('#909090'), '#000000');
  for (const col of ['#A10DBC', '#909090', '#CB7ADA', '#6E6E73', '#FF9F0A', '#34C759', '#30B0C7', '#5856D6'])
    assert.ok(K.contrast(K.textOn(col), col) >= 4.5, col + ' ' + K.contrast(K.textOn(col), col).toFixed(2));   // WCAG AA für normalen Text
});
t('Bestellnummern je Sparte, pro Tag neu', () => {
  if (!K.nextOrder) return;
  let r = K.nextOrder(null, 'crepes', 'C', '2026-11-26'); assert.strictEqual(r.no, 'C1');
  r = K.nextOrder(r.st, 'crepes', 'C', '2026-11-26'); assert.strictEqual(r.no, 'C2');
  let b = K.nextOrder(r.st, 'burger', 'B', '2026-11-26'); assert.strictEqual(b.no, 'B1'); assert.strictEqual(K.nextOrder(b.st, 'crepes', 'C', '2026-11-26').no, 'C3');   // Sparten zählen getrennt
  assert.strictEqual(K.nextOrder(b.st, 'crepes', 'C', '2026-11-27').no, 'C1');   // neuer Tag: wieder bei 1
  assert.deepStrictEqual(r.st.seq, { crepes: 2 });   // Eingabe wird nicht verändert
  assert.deepStrictEqual([K.defaultPrefix('crepes', 'Crêpes'), K.defaultPrefix('burger', 'Burger & Spezi'), K.defaultPrefix('karten', 'Karten'), K.defaultPrefix('s123', 'Waffeln'), K.defaultPrefix('x', '')], ['C', 'B', 'K', 'W', 'X']);
});
t('Spende ohne Einkauf in den Summen (bar und PayPal)', () => {
  const s = [{ total: 600, tip: 0 }, { total: 0, tip: 500, donation: true }, { total: 0, tip: 300, donation: true, method: 'paypal' }, { total: 0, tip: 900, donation: true, void: true }, { total: 300, method: 'paypal' }];
  assert.deepStrictEqual(K.payTotals(s), { bar: 600, paypal: 600, tip: 800, don: 2, donSum: 800 });
  const c = K.cashSeries(s.map((x, i) => ({ ...x, n: i + 1, t: i })), 1000);
  assert.strictEqual(c.bal, 1000 + 600 + 500); assert.strictEqual(c.tips, 500);   // PayPal und Storno ändern den Bargeldbestand nicht
});
t('Kachelfarben aus dem Logo: lesbar auf hellem und dunklem Grund', () => {
  if (!K.COLORS) return;
  assert.deepStrictEqual(K.COLORS, { lila: '#A10DBC', grau: '#909090', flieder: '#CB7ADA', dunkelgrau: '#6E6E73' });
  assert.strictEqual(K.PALETTE.length, 4);
  for (const col of K.PALETTE) {
    assert.ok(K.contrast(K.textOn(col), col) >= 4.5, 'Schrift auf ' + col + ': ' + K.contrast(K.textOn(col), col).toFixed(2));        // Zähler auf der Kachel
    assert.ok(K.contrast(col, '#FFFFFF') >= 2.5 && K.contrast(col, '#1C1C1E') >= 2.5, 'Rand ' + col + ' hell/dunkel');                  // Kachelrand auf weißer bzw. dunkler Karte
  }
  assert.strictEqual(K.migrateColor('#ff9f0a'), '#A10DBC'); assert.strictEqual(K.migrateColor('#34C759'), '#909090');
  assert.strictEqual(K.migrateColor('#30B0C7'), '#CB7ADA'); assert.strictEqual(K.migrateColor('#5856D6'), '#6E6E73');
  assert.strictEqual(K.migrateColor('#123456'), '#123456'); assert.strictEqual(K.migrateColor(undefined), undefined);   // eigene Farben bleiben
});
t('Design: Farben der Themen sind lesbar (hell und dunkel)', () => {
  let T; try { T = require(require('path').resolve(__dirname, '..', dir, 'theme.js')); } catch (e) { return; }
  assert.deepStrictEqual(Object.keys(T.THEMES), ['standard', 'classic', 'xmas']);
  for (const th of Object.keys(T.THEMES)) for (const s of ['light', 'dark']) {
    const v = T.vars({ theme: th }, s), min = th === 'classic' ? 3.5 : 4.5;   // „Klassisch“ = Apple-Blau mit weißer Schrift, genau wie bisher (dort 3,65 bis 4,0)
    assert.ok(K.contrast(v['--brand-ink'], v['--brand']) >= min, `${th}/${s}: Schrift auf Knopf ${K.contrast(v['--brand-ink'], v['--brand']).toFixed(2)}`);
    assert.ok(K.contrast(v['--brand-text'], v['--card']) >= min, `${th}/${s}: Textknopf auf Karte`);
    assert.ok(K.contrast(v['--brand-text'], v['--bg']) >= (th === 'classic' ? 3.5 : 4.5), `${th}/${s}: Textknopf auf Hintergrund`);
    assert.ok(K.contrast(v['--label'], v['--bg']) >= 12 && K.contrast(v['--label'], v['--card']) >= 12, `${th}/${s}: Haupttext`);
  }
  // Weihnachten: Kachelfarben mit lesbarem Zähler und sichtbarem Rand
  for (const s of ['light', 'dark']) for (let i = 1; i <= 4; i++) {
    const v = T.vars({ theme: 'xmas' }, s), c = v['--x' + i], card = v['--card'];
    assert.ok(K.contrast(v['--x' + i + '-on'], c) >= 4.5, `Weihnachten ${s} Farbe ${i}: Zähler`);
    assert.ok(K.contrast(c, card) >= 2.0, `Weihnachten ${s} Farbe ${i}: Rand ${K.contrast(c, card).toFixed(2)}`);
  }
  // eigene Farbe der Knöpfe bleibt lesbar, egal was gewählt wird
  for (const acc of ['#FFFF00', '#000000', '#FF0000', '#123456', '#00FF7F', '#A10DBC', '#808080', '#FFFFFF'])
    for (const s of ['light', 'dark']) {
      const v = T.vars({ accent: acc }, s);
      assert.ok(K.contrast(v['--brand-ink'], v['--brand']) >= 4.5, `Eigene Farbe ${acc}/${s}: Schrift auf Knopf`);
      assert.ok(K.contrast(v['--brand-text'], v['--card']) >= 4.5, `Eigene Farbe ${acc}/${s}: Text auf Karte ${K.contrast(v['--brand-text'], v['--card']).toFixed(2)}`);
    }
  assert.strictEqual(T.vars({ accent: 'kein-hex' }, 'light')['--brand'], '#A10DBC');       // ungültige Farbe wird ignoriert
  assert.strictEqual(T.vars({ logo: 'off' }, 'light')['--logo-op'], '0'); assert.strictEqual(T.vars({ logo: 'mid' }, 'dark')['--logo-op'], '0.14');
  assert.strictEqual(T.scheme({ mode: 'auto' }, true), 'dark'); assert.strictEqual(T.scheme({ mode: 'light' }, true), 'light'); assert.strictEqual(T.scheme({ mode: 'dark' }, false), 'dark'); assert.strictEqual(T.scheme(null, false), 'light');
  assert.strictEqual(T.resolve({ theme: 'xmas' }).snow, true); assert.strictEqual(T.resolve(null).theme, 'standard');
});
(async () => {
  const sample = { v: 1, n: 7, t: 1764000000000, s: 'Burger & Spezi', m: 'b', tot: 1250, giv: 2000, tip: 150, chg: 600, po: 0, x: 1,
    L: [['Maultaschen auf karamellisierten Zwiebeln – Vegi', 2, 600, 7], ['Paulaner Spezi', 1, 300, 19], ['Käse, süß & "scharf" ü', 1, 50, 7]],
    h: ['Evangelische Kirchengemeinde Kleinglattbach', 'Kirchstraße 15; 71665 Vaihingen an der Enz', '', 'Vielen Dank!'] };
  const s = await K.bonEncode(sample);
  assert.deepStrictEqual(await K.bonDecode(s), sample);
  assert.ok(/^[pz][A-Za-z0-9_-]+$/.test(s), 'nur URL-sichere Zeichen');
  const big = { ...sample, L: Array.from({ length: 25 }, (_, i) => ['Artikel Nummer ' + i, 1 + (i % 3), 250 + i, 7]) };
  const bs = await K.bonEncode(big);
  assert.deepStrictEqual(await K.bonDecode(bs), big);
  assert.ok(bs.length < 1800, 'langer Bon bleibt als QR-Code lesbar: ' + bs.length);
  assert.ok(s.length < 700, 'normaler Bon ist kurz: ' + s.length);
  n++; console.log('ok  Bon-Link kodieren und lesen (' + s.length + ' bzw. ' + bs.length + ' Zeichen)');
  assert.ok(K.isEmail('kunde@example.de') && K.isEmail(' a.b+c@sub.example.com ') && !K.isEmail('abc') && !K.isEmail('a@b') && !K.isEmail('a b@c.de') && !K.isEmail('a@b.de, c@d.de') && !K.isEmail(''));
  const m = K.mailtoUrl('kunde@example.de', 'Ihr Bon – Nr. 1', 'Zeile 1\nSumme 3,00 €');
  assert.ok(m.startsWith('mailto:kunde@example.de?subject=Ihr%20Bon%20%E2%80%93%20Nr.%201&body=Zeile%201%0ASumme%203%2C00%20%E2%82%AC'), m);
  n++; console.log('ok  E-Mail-Adresse prüfen und mailto-Link bauen');
  console.log(`\n${n} Rechentests bestanden (${dir})`);
})().catch(e => { console.error('FEHLER', e.message); process.exit(1); });
