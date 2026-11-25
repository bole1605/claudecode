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
  assert.deepStrictEqual(K.payTotals(sales), { bar: 700, paypal: 300, tip: 300 });
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
t('PDF ist gültig aufgebaut', () => {
  const u = K.makePdf([{ t: 'Test (1) \\ ä', b: true }, { t: '3,00 €' }]), s = Buffer.from(u).toString('latin1');
  assert.ok(s.startsWith('%PDF-1.4') && s.trimEnd().endsWith('%%EOF'));
  const sx = +s.match(/startxref\n(\d+)/)[1]; assert.ok(s.slice(sx).startsWith('xref'));
  const entries = s.slice(sx).split('\n').slice(3, 9);
  entries.forEach((e, i) => assert.ok(s.slice(+e.slice(0, 10)).startsWith(`${i + 1} 0 obj`), 'xref ' + (i + 1)));
  const len = +s.match(/\/Length (\d+)/)[1], body = s.match(/stream\n([\s\S]*?)\nendstream/)[1]; assert.strictEqual(body.length, len);
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
