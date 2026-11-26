'use strict';
// Ablauf-Tests im Browser (Chromium) gegen kasse oder kasse-test. Start: node tests/e2e.js [kasse-test|kasse]
const http = require('http'), fs = require('fs'), path = require('path'), assert = require('assert');
const { chromium } = require('playwright'); const jsQR = require('jsqr'); const { PNG } = require('pngjs');
const dir = process.argv[2] || 'kasse-test', root = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(root, p); if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end('nf'); }
  r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(f).pipe(r);
});
let fails = 0, count = 0;
const has = f => fs.existsSync(path.join(root, dir, f));
const feat = s => fs.readFileSync(path.join(root, dir, 'app.js'), 'utf8').includes(s);   // Funktion im Code vorhanden? (Tests für neue Funktionen laufen erst, wenn die Version sie hat)   // neue Funktionen werden erst geprüft, wenn sie in der Version vorhanden sind (Live-Version später)
async function test(name, fn) {
  count++; const errs = [];
  try { await fn(errs); if (errs.length) throw new Error('Fehler auf der Seite: ' + errs.join(' | ')); console.log('ok  ' + name); }
  catch (e) { fails++; console.log('FEHLER  ' + name + '\n        ' + String(e.message || e).split('\n').slice(0, 14).join('\n        ')); }
}
(async () => {
  await new Promise(r => server.listen(0, r));
  const base = `http://localhost:${server.address().port}/${dir}/index.html`;
  const browser = await chromium.launch();
  const open = async (errs, hash = '#burger', opts = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 1180, height: 900 }, acceptDownloads: true, serviceWorkers: opts.sw ? 'allow' : 'block', ...opts.ctx });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.addInitScript(({ k, v }) => { if (!localStorage.getItem(k)) localStorage.setItem(k, v); }, { k: dir === 'kasse-test' ? 'kasse-test-v2' : 'kasse-v2', v: JSON.stringify({ share: { on: !!opts.share }, orderMode: 'auto', ...(opts.seed || {}) }) });   // Bon-QR nur in den Tests, die ihn prüfen
    await p.goto(base + hash); p.ctx = ctx; return p;
  };
  const tap = async (p, id) => { const s = `[data-add=${id}]`; await p.dispatchEvent(s, 'pointerdown', { button: 0, clientX: 5, clientY: 5 }); await p.dispatchEvent(s, 'pointerup', { button: 0, clientX: 5, clientY: 5 }); };
  const pay = async (p, a) => { await p.click('#pay'); if (a) await a(); await p.click('#p-ok'); };
  const admin = async (p, first) => {
    for (let i = 0; i < 5; i++) await p.dispatchEvent('#title', 'pointerdown', { button: 0 });
    await p.waitForSelector('#pw-dlg[open]'); await p.fill('#pw-input', 'Kasse24');
    if (first) { await p.fill('#pw-input2', 'Kasse24'); await p.press('#pw-input2', 'Enter'); await p.waitForSelector('#confirm[open]'); await p.click('#c-ok'); } else await p.press('#pw-input', 'Enter');
    await p.waitForSelector('#admin:not([hidden])');
  };
  const txt = async (p, s) => (await p.textContent(s)).replace(/\s+/g, ' ').trim();
  const dl = async (p, sel) => { const [d] = await Promise.all([p.waitForEvent('download'), p.click(sel)]); return fs.readFileSync(await d.path()); };

  await test('Start: drei Seiten, Version, Testbanner nur in kasse-test', async errs => {
    const p = await open(errs, '');
    assert.deepStrictEqual(await p.$$eval('#tabs button', e => e.map(x => x.textContent)), ['Crêpes', 'Burger & Spezi', 'Karten']);
    const v = (fs.readFileSync(path.join(root, dir, 'index.html'), 'utf8').match(/class="ver">v(\d+)</) || [])[1];
    assert.strictEqual(await txt(p, '.ver'), 'v' + v);
    assert.strictEqual(await p.evaluate(() => document.body.classList.contains('is-test')), dir === 'kasse-test');
    await p.ctx.close();
  });

  await test('Offline-Betrieb: nach dem ersten Laden startet die App ohne Netz', async errs => {
    const p = await open(errs, '#crepes', { sw: true });
    await p.evaluate(() => navigator.serviceWorker.ready); await p.reload(); await p.waitForTimeout(500);
    assert.ok(await p.evaluate(() => !!navigator.serviceWorker.controller), 'Service Worker steuert die Seite nicht');
    await p.ctx.setOffline(true); await p.reload();
    assert.ok((await p.$$('[data-add]')).length >= 7, 'Kacheln fehlen offline');
    await tap(p, 'c-nutella'); assert.ok((await txt(p, '#bon-lines')).includes('Nutella'));
    await p.ctx.close();
  });

  await test('Test- und Live-Version teilen keinen Speicher', async errs => {
    const p = await open(errs); const k = await p.evaluate(() => KEY); assert.strictEqual(k, dir === 'kasse-test' ? 'kasse-test-v2' : 'kasse-v2'); await p.ctx.close();
  });

  await test('Burger gibt es als Vegi und Fleisch', async errs => {
    const p = await open(errs); const n = await p.$$eval('[data-add] .name', e => e.map(x => x.textContent));
    assert.ok(n.some(x => /Maultaschen.*– Vegi/.test(x)) && n.some(x => /Maultaschen.*– Fleisch/.test(x)) && n.some(x => /Spezial.*– Vegi/.test(x)) && n.some(x => /Spezial.*– Fleisch/.test(x)));
    await tap(p, 'b-maul-v'); await tap(p, 'b-maul-f'); assert.ok(/Vegi/.test(await txt(p, '#bon-lines')) && /Fleisch/.test(await txt(p, '#bon-lines')));
    await p.ctx.close();
  });

  await test('Bar bezahlen mit Spende (addiert sich) und Rückgeld', async errs => {
    const p = await open(errs); await tap(p, 'b-maul-v'); await p.click('#pay'); await p.click('[data-quick="10"]');
    await p.click('[data-tipq="100"]'); await p.click('[data-tipq="100"]'); assert.strictEqual(await txt(p, '#p-tip'), '2 €');
    assert.ok((await txt(p, '#p-change')).includes('2,00 €'), await txt(p, '#p-change'));   // 10 - 6 - 2
    await p.click('#p-ok'); const s = await p.evaluate(() => state.sales[0]);
    assert.deepStrictEqual([s.total, s.given, s.tip, s.change], [600, 1000, 200, 200]); await p.ctx.close();
  });

  await test('Zu wenig Geld: Verbuchen gesperrt', async errs => {
    const p = await open(errs); await tap(p, 'b-maul-v'); await p.click('#pay'); await p.click('[data-quick="5"]');
    assert.ok(await p.isDisabled('#p-ok')); assert.ok(/Es fehlen\s*1,00/.test(await txt(p, '#p-change')), await txt(p, '#p-change')); await p.ctx.close();
  });

  await test('Spezi bringt Pfand mit; Pfand zurück zahlt aus', async errs => {
    const p = await open(errs); await tap(p, 'g-spezi'); assert.strictEqual(await txt(p, '#bon-sum'), '5,00 €');
    await p.click('#bon-lines [data-sub=g-spezi]'); assert.ok(/Kachel antippen/.test(await txt(p, '#bon-lines')));
    await tap(p, 'g-pfand-rueck'); await p.click('#pay'); assert.ok((await txt(p, '#p-change')).includes('Auszahlen')); await p.click('#p-ok');
    const s = await p.evaluate(() => state.sales[0]); assert.deepStrictEqual([s.total, s.payout, s.change], [-200, true, 200]); await p.ctx.close();
  });

  await test('PayPal: QR-Code ist scanbar und enthält den Betrag', async errs => {
    const p = await open(errs, '#burger', { seed: { paypal: 'https://https://paypal.me/KGKleinglattbach' } });
    await tap(p, 'b-spezial-f'); await p.click('#pay'); await p.click('[data-method=paypal]');
    const read = async () => { const png = PNG.sync.read(await p.locator('#p-qr-img img').screenshot()); const r = jsQR(new Uint8ClampedArray(png.data), png.width, png.height); return r && r.data; };
    assert.strictEqual(await read(), 'https://paypal.me/KGKleinglattbach/7.50');
    await p.evaluate(() => { state.ppMode = 'none'; payUpdate(); }); assert.strictEqual(await read(), 'https://paypal.me/KGKleinglattbach');
    await p.evaluate(() => { state.ppMode = 'amountEur'; payUpdate(); }); assert.strictEqual(await read(), 'https://paypal.me/KGKleinglattbach/7.50EUR');
    await p.click('#p-ok'); assert.strictEqual(await p.evaluate(() => state.sales[0].method), 'paypal'); await p.ctx.close();
  });

  await test('Verwaltung: Passwort, Storno, Kassenstand, Zahlarten', async errs => {
    const p = await open(errs);
    for (let i = 0; i < 5; i++) await p.dispatchEvent('#title', 'pointerdown', { button: 0 });
    await p.fill('#pw-input', 'Kasse24'); await p.fill('#pw-input2', 'Kasse25'); await p.press('#pw-input2', 'Enter');
    assert.ok((await txt(p, '#pw-err')).includes('stimmen nicht überein')); await p.fill('#pw-input2', 'Kasse24'); await p.press('#pw-input2', 'Enter');
    await p.waitForSelector('#confirm[open]'); assert.ok(/[A-Z2-9]{4}-[A-Z2-9]{4}/.test(await txt(p, '#c-text'))); await p.click('#c-ok'); await p.waitForSelector('#admin:not([hidden])');
    await p.click('#cash-start'); await p.fill('#t-input', '100'); await p.press('#t-input', 'Enter'); await p.waitForTimeout(150); await p.click('#admin-close');
    await tap(p, 'b-maul-v'); await pay(p, async () => { await p.click('[data-quick="10"]'); await p.click('[data-tipq="100"]'); });   // bar +7
    await tap(p, 'g-spezi'); await pay(p, async () => { await p.click('[data-method=paypal]'); });                                       // PayPal
    await tap(p, 'b-spezial-v'); await pay(p, async () => { await p.click('[data-quick="10"]'); });                                      // bar +7,50, wird storniert
    for (let i = 0; i < 5; i++) await p.dispatchEvent('#title', 'pointerdown', { button: 0 });
    await p.fill('#pw-input', 'falsch'); await p.press('#pw-input', 'Enter'); assert.ok((await txt(p, '#pw-err')).includes('Falsches Passwort'));
    await p.fill('#pw-input', 'Kasse24'); await p.press('#pw-input', 'Enter'); await p.waitForSelector('#admin:not([hidden])');
    await p.click('[data-void="3"]'); await p.click('#c-ok'); await p.waitForTimeout(150);
    const cash = await txt(p, '#cash-card'); assert.ok(cash.includes('100,00 €') && cash.includes('Aktuell in der Kasse') && cash.includes('107,00 €'), cash);
    const sum = await txt(p, '#admin-summary'); assert.ok(sum.includes('Bar 6,00 €') && sum.includes('PayPal 5,00 €') && sum.includes('Spenden 1,00 €'), sum);
    const csv = (await dl(p, '#save')).toString('utf8'); assert.ok(csv.includes('"Kassenstand aktuell (Bargeld, ohne PayPal)";"";"";"107,00"') && csv.includes('"storniert";"Bar"'));
    await p.ctx.close();
  });

  await test('Bon: PDF mit Zeitstempel, Kopf und Spende', async errs => {
    const p = await open(errs); await tap(p, 'b-maul-f'); await pay(p, async () => { await p.click('[data-quick="10"]'); await p.click('[data-tipq="50"]'); });
    const pdf = await dl(p, '#toast [data-pdf]'); const s = pdf.toString('latin1');
    assert.ok(s.startsWith('%PDF-1.4') && s.includes('Kirchengemeinde') && s.includes('Fleisch') && s.includes('Spende') && /\d\d:\d\d:\d\d/.test(s), 'PDF-Inhalt');
    await p.ctx.close();
  });

  await test('Sicherung speichern und wiederherstellen', async errs => {
    const p = await open(errs); await tap(p, 'b-maul-v'); await pay(p, async () => { await p.click('[data-quick="10"]'); });
    await admin(p, true); const file = await dl(p, '#backup-save'); const j = JSON.parse(file.toString('utf8'));
    assert.ok(j.app === 'kasse' && j.data.sales.length === 1 && !('pw' in j.data), 'Sicherung unvollständig'); assert.ok((await txt(p, '#backup-status')).includes('Letzte Sicherung'));
    await p.click('#wipe'); await p.click('#c-ok'); await p.waitForTimeout(150); assert.strictEqual(await p.evaluate(() => state.sales.length), 0);
    const tmp = path.join(require('os').tmpdir(), 'kasse-sicherung-test.json'); fs.writeFileSync(tmp, file);
    await p.setInputFiles('#restore-file', tmp); await p.waitForSelector('#confirm[open]'); await p.click('#c-ok'); await p.waitForTimeout(200);
    assert.strictEqual(await p.evaluate(() => state.sales.length), 1); assert.ok((await txt(p, '#sales-list')).includes('Maultaschen')); await p.ctx.close();
  });

  await test('Bearbeitungsmodus: Produkt anlegen, Preis ändern, löschen; alte Buchungen bleiben lesbar', async errs => {
    const p = await open(errs); await tap(p, 'g-spezi'); await pay(p, async () => { await p.click('[data-quick="10"]'); });
    await admin(p, true); await p.click('#edit-mode'); const gid = (await p.$$eval('[data-newitem]', e => e.map(x => x.dataset.newitem)))[1];
    await p.click(`[data-newitem="${gid}"]`); await p.fill('#i-name', 'Apfelschorle'); await p.fill('#i-price', '2,5'); await p.click('#item-form button[type=submit]');
    await p.click('[data-edit=g-spezi]'); await p.fill('#i-price', '3,50'); await p.click('#item-form button[type=submit]');
    assert.deepStrictEqual(await p.evaluate(() => [ALL['g-spezi'].price, stand().groups.flatMap(g => g.items).some(i => i.name === 'Apfelschorle')]), [350, true]);
    await p.click('[data-edit=g-spezi]'); await p.click('#i-del'); await p.click('#c-ok'); await p.waitForTimeout(150); await p.click('[data-editdone]');
    assert.ok(!(await p.$$eval('[data-add] .name', e => e.map(x => x.textContent))).includes('Paulaner Spezi'));
    await admin(p, false); assert.ok((await txt(p, '#sales-list')).includes('Paulaner Spezi') && (await txt(p, '#sales-list')).includes('5,00 €')); await p.ctx.close();
  });

  await test('Umstellung eines alten gespeicherten Sortiments', async errs => {
    const old = { stand: 'burger', catalog: [{ id: 'burger', label: 'Burger & Spezi', groups: [
      { id: 'g1', name: 'Burger', color: '#34C759', items: [{ id: 'b-maul', name: 'Maultaschen auf karamellisierten Zwiebeln', price: 650, vat: 7 }] },
      { id: 'g2', name: 'Getränke', color: '#30B0C7', items: [{ id: 'g-spezi', name: 'Spezi', price: 300, vat: 19 }] }] }],
      sales: [{ n: 1, t: 1, stand: 'burger', sl: 'Burger & Spezi', lines: { 'b-maul': 2 }, info: { 'b-maul': { name: 'Maultaschen auf karamellisierten Zwiebeln', price: 650, vat: 7 } }, total: 1300, given: 1300, change: 0, void: false }], seq: 1 };
    const p = await open(errs, '#burger', { seed: old });
    assert.deepStrictEqual(await p.evaluate(() => stand().groups.flatMap(g => g.items.map(i => i.id + ':' + i.price))), ['b-maul-v:650', 'b-maul-f:650', 'g-spezi:300', 'g-pfand:200', 'g-pfand-rueck:-200']);
    assert.strictEqual(await p.evaluate(() => lineText(state.sales[0])), '2× Maultaschen auf karamellisierten Zwiebeln'); await p.ctx.close();
  });

  await test('MwSt.-Rechner: Bon und Verwaltung', async errs => {
    const p = await open(errs); await tap(p, 'b-maul-v'); await tap(p, 'g-spezi'); await p.evaluate(() => { state.vat.on = true; update(); });
    const bon = await txt(p, '#bon-vat'); assert.ok(bon.includes('MwSt 7 %0,39 €') && bon.includes('MwSt 19 %'), bon); await p.ctx.close();
  });

  if (has('bon.html')) await test('Bon-QR: öffnet nach dem Verbuchen und führt zur Online-Ansicht des Bons', async errs => {
    const p = await open(errs, '#burger', { share: true });
    await tap(p, 'b-maul-v'); await tap(p, 'b-maul-v'); await tap(p, 'g-spezi');
    await p.click('#pay'); await p.click('[data-quick="20"]'); await p.click('[data-tipq="50"]'); await p.click('#p-ok');
    await p.waitForSelector('#share-dlg[open] #sh-qr img.qr');
    assert.ok((await txt(p, '#sh-title')).includes('Bon #1'));
    const png = PNG.sync.read(await p.locator('#sh-qr img').screenshot());
    const r = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
    assert.ok(r && r.data.startsWith(new URL(base).origin + '/' + dir + '/bon.html#'), 'QR-Inhalt: ' + (r && r.data));
    const v = await p.ctx.newPage(); v.on('pageerror', x => errs.push(x.message));
    await v.goto(r.data); await v.waitForSelector('.bon');
    const t = await txt(v, '.bon');
    for (const x of ['Evangelische Kirchengemeinde Kleinglattbach', 'BON NR. 0001', '2× Maultaschen auf karamellisierten Zwiebeln – Vegi', '12,00 €', '1× Paulaner Spezi'])
      assert.ok(t.includes(x), x + ' fehlt: ' + t);
    for (const re of [/SUMME\s*17,00 €/, /Spende\s*0,50 €/, /Rückgeld\s*2,50 €/]) assert.ok(re.test(t), re + ' fehlt: ' + t);
    await p.click('#sh-done');
    assert.ok(!(await p.evaluate(() => document.querySelector('#share-dlg').open)));
    await p.ctx.close();
  });

  if (has('bon.html')) await test('Bon-QR aus: Bon wird trotzdem erzeugt und lässt sich per Taste öffnen', async errs => {
    const p = await open(errs);
    await tap(p, 'g-spezi'); await p.click('#pay'); await p.click('[data-quick="10"]'); await p.click('#p-ok');
    await p.waitForSelector('#toast:not([hidden])');
    assert.ok(!(await p.evaluate(() => document.querySelector('#share-dlg').open)), 'Dialog darf nicht von selbst aufgehen');
    for (const b of ['QR / Mail', 'PDF', 'Drucken']) assert.ok((await txt(p, '#toast')).includes(b), b);
    await p.click('#toast [data-share]'); await p.waitForSelector('#share-dlg[open] #sh-qr img.qr'); await p.click('#sh-done');
    await admin(p, true);
    assert.strictEqual(await p.isChecked('#share-toggle'), false);
    assert.ok((await p.$$('#sales-list [data-share]')).length === 1 && (await p.$$('#sales-list [data-pdf]')).length === 1);
    await p.click('.switch-row:has(#share-toggle)');
    assert.strictEqual(await p.evaluate(() => state.share.on), true);
    await p.click('#admin-close'); await tap(p, 'g-spezi'); await p.click('#pay'); await p.click('[data-quick="10"]'); await p.click('#p-ok');
    await p.waitForSelector('#share-dlg[open]');
    await p.ctx.close();
  });

  if (has('bon.html')) await test('Bon per E-Mail: Adresse wird geprüft, Entwurf enthält den Bon, nichts wird gespeichert', async errs => {
    const p = await open(errs, '#burger', { share: true });
    await tap(p, 'b-spezial-f'); await p.click('#pay'); await p.click('[data-quick="10"]'); await p.click('#p-ok');
    await p.waitForSelector('#sh-qr img.qr');
    await p.fill('#sh-mail', 'abc'); await p.click('#sh-send');
    assert.ok((await txt(p, '#sh-err')).includes('gültige'));
    const m = await p.evaluate(() => mailFor(shareSale, 'kunde@example.de'));
    const d = decodeURIComponent(m);
    assert.ok(m.startsWith('mailto:kunde@example.de?subject=') && d.includes('SUMME') && d.includes('Spezial-Maultaschenburger') && d.includes('bon.html#'), m.slice(0, 200));
    await p.fill('#sh-mail', 'kunde@example.de'); await p.click('#sh-done');
    assert.strictEqual(await p.inputValue('#sh-mail'), '');
    assert.ok(!(await p.evaluate(() => JSON.stringify(localStorage))).includes('kunde@example.de'), 'E-Mail-Adresse darf nicht gespeichert werden');
    const v = await p.ctx.newPage(); await v.goto(base.replace('index.html', 'bon.html') + '#kaputt');
    assert.ok((await txt(v, 'body')).includes('ungültig'));
    await p.ctx.close();
  });

  if (feat('mig20')) await test('Design: Zähler erst ab 1, Preis kräftig, Farbe mit Kontrast, Karten nicht mehr rot', async errs => {
    const p = await open(errs);
    assert.strictEqual(await p.evaluate(() => getComputedStyle(document.querySelector('[data-count="b-maul-v"]')).display), 'none');
    await tap(p, 'b-maul-v');
    const st = await p.evaluate(() => { const b = document.querySelector('[data-count="b-maul-v"]'), pr = document.querySelector('[data-add="b-maul-v"] .price');
      return { disp: getComputedStyle(b).display, bg: getComputedStyle(b).backgroundColor, fg: getComputedStyle(b).color, price: getComputedStyle(pr).color, label: getComputedStyle(document.body).color }; });
    assert.strictEqual(st.disp, 'grid'); assert.strictEqual(st.bg, feat('mig23') ? 'rgb(144, 144, 144)' : 'rgb(52, 199, 89)'); assert.strictEqual(st.fg, 'rgb(0, 0, 0)');   // Logo-Grau mit schwarzer Zahl
    assert.strictEqual(st.price, st.label, 'Preis nicht in Kategorie-Farbe');
    const cat = await p.evaluate(() => STANDS.find(s => s.id === 'karten').groups[0].color); assert.strictEqual(cat, feat('mig23') ? '#6E6E73' : '#5856D6');
    await p.ctx.close();
  });

  if (feat('mig20')) await test('Rote Kategorie aus altem Sortiment wird zu Dunkelgrau (Logo-Farben)', async errs => {
    const p = await open(errs, '#karten', { seed: { mig17: true, stand: 'karten', catalog: [{ id: 'karten', label: 'Karten', groups: [{ id: 'k1', name: 'Karten', color: '#FF3B30', items: [{ id: 'k-1', name: 'Eine Karte', price: 300, vat: 19 }] }] }] } });
    assert.strictEqual(await p.evaluate(() => STANDS[0].groups[0].color), feat('mig23') ? '#6E6E73' : '#5856D6'); await p.ctx.close();
  });

  if (feat('mig20')) await test('Gerät auf einen Stand festlegen: keine Reiter, Link und Neustart ändern nichts', async errs => {
    const p = await open(errs, '#burger'); await admin(p, true);
    await p.selectOption('#lock-select', 'karten'); await p.click('#admin-close');
    assert.strictEqual(await p.isHidden('#tabs'), true); assert.strictEqual(await txt(p, '#title'), 'Karten');
    assert.ok((await p.$$eval('[data-add] .name', e => e.map(x => x.textContent))).includes('Eine Karte'));
    await p.evaluate(() => { location.hash = '#crepes'; }); await p.reload(); assert.strictEqual(await txt(p, '#title'), 'Karten');   // Link ändert nichts
    await admin(p, false); await p.click('#edit-mode'); assert.strictEqual(await p.isVisible('#tabs'), true, 'im Bearbeitungsmodus sind die Reiter da'); await p.click('[data-editdone]');
    await admin(p, false); await p.selectOption('#lock-select', ''); await p.click('#admin-close'); assert.strictEqual(await p.isVisible('#tabs'), true);
    await p.ctx.close();
  });

  if (feat('mig20')) await test('Wischen zählt nicht als Verkauf, wenn die Seite gescrollt werden muss', async errs => {
    const p = await open(errs); const s = '[data-add=b-maul-v]', n = () => p.evaluate(() => (cart()['b-maul-v'] || 0));
    await p.evaluate(() => { $('#main').style.maxHeight = '260px'; $('#main').style.overflow = 'auto'; });   // Seite länger als der Bildschirm
    assert.strictEqual(await p.evaluate(() => scrollable()), true);
    await p.dispatchEvent(s, 'pointerdown', { button: 0, clientX: 10, clientY: 10, pointerId: 3 }); assert.strictEqual(await n(), 0, 'Berühren allein zählt nicht');
    await p.dispatchEvent(s, 'pointerup', { button: 0, clientX: 12, clientY: 11, pointerId: 3 }); assert.strictEqual(await n(), 1, 'Tippen zählt beim Loslassen');
    await p.dispatchEvent(s, 'pointerdown', { button: 0, clientX: 10, clientY: 10, pointerId: 4 }); await p.dispatchEvent(s, 'pointerup', { button: 0, clientX: 10, clientY: 90, pointerId: 4 }); assert.strictEqual(await n(), 1, 'Wischen zählt nicht');
    await p.dispatchEvent(s, 'pointerdown', { button: 0, clientX: 10, clientY: 10, pointerId: 5 }); await p.dispatchEvent(s, 'pointercancel', { pointerId: 5 }); await p.dispatchEvent(s, 'pointerup', { button: 0, clientX: 10, clientY: 10, pointerId: 5 }); assert.strictEqual(await n(), 1, 'Abbruch (Scrollen) zählt nicht');
    await p.evaluate(() => { $('#main').style.maxHeight = ''; $('#main').style.overflow = ''; }); await p.setViewportSize({ width: 1180, height: 1800 });   // passt auf den Bildschirm: Berühren zählt sofort
    assert.strictEqual(await p.evaluate(() => scrollable()), false);
    await p.dispatchEvent(s, 'pointerdown', { button: 0, clientX: 10, clientY: 10, pointerId: 6 }); assert.strictEqual(await n(), 2, 'ohne Scrollen zählt schon das Berühren');
    await p.ctx.close();
  });

  if (feat('cs-open')) await test('Kassensturz und Kassenbericht: Einlage/Entnahme, Zählen, Differenz, PDF', async errs => {
    const p = await open(errs);
    await admin(p, true);
    await p.click('#cash-start'); await p.fill('#t-input', '100'); await p.press('#t-input', 'Enter'); await p.waitForTimeout(150);
    await p.click('#admin-close'); await tap(p, 'b-maul-v'); await pay(p, async () => { await p.click('[data-quick="10"]'); });          // +6 -> 106
    await admin(p, false);
    const bal = async () => (await txt(p, '#cash-card')).match(/Aktuell in der Kasse.*?([\d.]+,\d\d) €/)[1];
    assert.strictEqual(await bal(), '106,00');
    await p.click('#mv-open'); await p.fill('#mv-amt', '20'); await p.fill('#mv-note', 'Wechselgeld'); await p.click('#mv-form button[type=submit]'); assert.strictEqual(await bal(), '126,00');
    await p.click('#mv-open'); await p.click('#mv-seg [data-kind=ent]'); await p.fill('#mv-amt', '50'); await p.fill('#mv-note', 'zur Bank'); await p.click('#mv-form button[type=submit]'); assert.strictEqual(await bal(), '76,00');
    await p.click('#mv-open'); await p.fill('#mv-amt', 'abc'); await p.click('#mv-form button[type=submit]'); assert.ok((await txt(p, '#mv-err')).includes('Betrag')); await p.click('#mv-cancel');
    // Storno einer Entnahme -> wieder 126
    await p.click('[data-mvvoid]:near(:text("zur Bank"))').catch(async () => { await p.locator('.mv', { hasText: 'zur Bank' }).locator('[data-mvvoid]').click(); }); await p.click('#c-ok'); await p.waitForTimeout(150); assert.strictEqual(await bal(), '126,00');
    await p.locator('.mv', { hasText: 'zur Bank' }).locator('[data-mvvoid]').click(); await p.click('#c-ok'); await p.waitForTimeout(150); assert.strictEqual(await bal(), '76,00');   // Storno aufgehoben
    // Kassensturz: 50 + 20 + 5 + 1 = 76 -> stimmt
    await p.click('#cs-open'); await p.waitForSelector('#cs-dlg[open] .cs-row');
    for (const [d, n] of [[5000, 1], [2000, 1], [500, 1], [100, 1]]) await p.fill(`#cs-grid input[data-d="${d}"]`, String(n));
    assert.strictEqual(await txt(p, '#cs-ist'), '76,00 €'); assert.strictEqual(await txt(p, '#cs-soll'), '76,00 €'); assert.strictEqual(await txt(p, '#cs-diff'), 'Kasse stimmt');
    await p.click('[data-csm="-1"][data-d="100"]'); assert.ok((await txt(p, '#cs-diff')).includes('Fehlbetrag 1,00 €'), await txt(p, '#cs-diff'));
    await p.click('[data-csm="1"][data-d="100"]'); await p.click('[data-csm="1"][data-d="50"]'); assert.ok((await txt(p, '#cs-diff')).includes('Überschuss 0,50 €'));
    await p.click('[data-csm="-1"][data-d="50"]'); await p.fill('#cs-note', 'Mittag'); await p.click('#cs-save');
    assert.ok((await txt(p, '#cs-result')).includes('Kasse stimmt'));
    const pdf = (await dl(p, '#cs-pdf')).toString('latin1');
    for (const x of ['KASSENBERICHT', 'Evangelische Kirchengemeinde Kleinglattbach', 'Anfangsbestand', 'Soll-Bestand', 'Gezaehlter Bestand'.replace('ae', '\xe4'), 'Zählprotokoll'.replace('ä', '\xe4'), '1 x 50 \x80', 'Kassierer/in', 'Mittag', 'Einlagen und Entnahmen', 'Wechselgeld'])
      assert.ok(pdf.includes(x), 'Bericht ohne: ' + x);
    assert.ok(pdf.includes('Differenz \\(Kasse stimmt\\)'), 'Differenz-Zeile');   // im PDF sind Klammern mit Backslash maskiert
    await p.click('#cs-done');
    assert.ok((await txt(p, '#cash-card')).includes('Letzter Kassensturz') && (await txt(p, '#cash-card')).includes('Kasse stimmt') && (await p.$$('[data-rep]')).length === 1);
    // zweiter Kassensturz mit Fehlbetrag, älteren Bericht wieder öffnen
    await p.click('#cs-open'); await p.fill('#cs-grid input[data-d="5000"]', '1'); await p.fill('#cs-grid input[data-d="2000"]', '1'); await p.click('#cs-save');
    assert.ok((await txt(p, '#cs-result')).includes('Fehlbetrag 6,00 €')); await p.click('#cs-done');
    assert.strictEqual((await p.$$('[data-rep]')).length, 2);
    const old = (await dl(p, '#cash-card [data-rep]:last-of-type')).toString('latin1'); assert.ok(old.includes('KASSENBERICHT') && old.includes('Alle Kassenst'.replace('ü', '\xfc')), 'Verlauf der Kassenstürze fehlt');
    const csv = (await dl(p, '#save')).toString('utf8'); assert.ok(csv.includes('Einlagen gesamt') && csv.includes('Entnahmen gesamt') && csv.includes('"Kassensturz";"Zeit"') && csv.includes('Wechselgeld') && /"gültig"/.test(csv));
    const b = JSON.parse((await dl(p, '#backup-save')).toString('utf8')); assert.ok(b.data.moves.length === 2 && b.data.counts.length === 2, 'Sicherung ohne Kassensturz/Bewegungen');
    await p.ctx.close();
  });

  if (feat('display.html') || has('display.html')) await test('Bestellnummern je Sparte und Küchenanzeige in einem zweiten Fenster', async errs => {
    const p = await open(errs, '#crepes');
    await p.evaluate(() => { window.__s = []; const o = Sound.play; Sound.play = n => { __s.push(n); o.call(Sound, n); }; });
    await tap(p, 'c-nutella'); await tap(p, 'c-kaese');
    await p.click('#pay'); await p.click('[data-quick="20"]'); await p.click('#p-ok');
    assert.strictEqual(await p.evaluate(() => state.sales[0].on), 'C1');
    assert.ok((await txt(p, '#toast')).includes('C1'), 'Bestellnummer im Hinweis');
    await tap(p, 'c-zimt'); await p.click('#pay'); await p.click('[data-quick="5"]'); await p.click('#p-ok');
    assert.strictEqual(await p.evaluate(() => state.sales[1].on), 'C2');
    await p.click('[data-stand=burger]'); await tap(p, 'b-maul-f'); await p.click('#pay'); await p.click('[data-quick="10"]'); await p.click('#p-ok');
    assert.strictEqual(await p.evaluate(() => state.sales[2].on), 'B1');                                   // jede Sparte zählt für sich
    assert.deepStrictEqual(await p.evaluate(F => __s.filter(x => F || x === 'tick' || x === 'booked'), feat('ord-pane')), feat('ord-pane') ? ['booked', 'booked', 'booked'] : ['tick', 'tick', 'booked', 'tick', 'booked', 'tick', 'booked'], 'Töne beim Verbuchen');
    assert.strictEqual(await txt(p, '#k-count'), '3');
    // zweites Fenster (gleicher Browser) mit der Küchenanzeige für Crêpes
    const k = await p.ctx.newPage(); k.on('pageerror', x => errs.push(x.message));
    await k.goto(base.replace('index.html', 'display.html') + '#crepes'); await k.waitForSelector('.tk');
    let t = await txt(k, '#open'); assert.ok(t.includes('C1') && t.includes('C2') && !t.includes('B1'), 'Filter Crêpes: ' + t);
    assert.ok(/1×\s*Nutella/.test(t) && /1×\s*Käse/.test(t) && /1×\s*Zimt und Zucker/.test(t), t);
    await k.click('[data-f=all]'); assert.ok((await txt(k, '#open')).includes('B1'), 'Alle Sparten');
    assert.ok((await txt(k, '#open')).includes('Fleisch'), 'Sorte steht in der Bestellung');
    // Küche meldet fertig -> Kasse bekommt Ton und Zähler sinkt
    await k.click('[data-done^="C1|"]'); await p.waitForFunction(() => document.querySelector('#k-count').textContent === '2');
    assert.ok((await p.evaluate(() => __s)).includes('ready'), 'Ton „fertig“ in der Kasse');
    assert.ok((await txt(k, '#ready')).includes('C1') && !(await txt(k, '#open')).includes('C1'));
    await k.click('#undo'); assert.ok((await txt(k, '#open')).includes('C1'), 'Rückgängig');
    // Storno in der Kasse nimmt die Bestellung aus der Anzeige
    await admin(p, true); await p.click('[data-void="2"]'); await p.click('#c-ok'); await p.waitForTimeout(200);
    await k.waitForFunction(() => !document.querySelector('#open').textContent.includes('C2'));
    await p.ctx.close();
  });

  if (feat('display.html') || has('display.html')) await test('Kürzel der Sparte ändern, Nummern pro Tag neu, zurücksetzen', async errs => {
    const p = await open(errs, '#karten'); await admin(p, true); await p.click('#edit-mode');
    await p.click('[data-prefix]'); await p.fill('#t-input', 'x1'); await p.press('#t-input', 'Enter'); await p.waitForTimeout(150); await p.click('[data-editdone]');
    await tap(p, 'k-1'); await p.click('#pay'); await p.click('[data-quick="5"]'); await p.click('#p-ok'); assert.strictEqual(await p.evaluate(() => state.sales[0].on), 'X11');
    await p.evaluate(() => { state.orderNo.day = '2000-01-01'; });                                              // „gestern“
    await tap(p, 'k-1'); await p.click('#pay'); await p.click('[data-quick="5"]'); await p.click('#p-ok'); assert.strictEqual(await p.evaluate(() => state.sales[1].on), 'X11', 'neuer Tag beginnt wieder bei 1');
    await admin(p, false); assert.ok((await txt(p, '#ord-state')).includes('X12'));
    await p.click('#ord-reset'); await p.click('#c-ok'); await p.waitForTimeout(150); assert.ok((await txt(p, '#ord-state')).includes('X11'));
    await p.ctx.close();
  });

  if (feat('donate')) await test('Spende ohne Einkauf: bar und PayPal, Kassenstand, Bon, Bericht', async errs => {
    const p = await open(errs, '#burger', { seed: { paypal: 'https://paypal.me/KGKleinglattbach' } });
    await p.click('#donate'); await p.waitForSelector('#don-dlg[open]'); assert.ok(await p.isDisabled('#d-ok'));
    await p.click('[data-dq="5"]'); assert.strictEqual(await txt(p, '#d-amt'), '5 €'); await p.click('#d-ok');
    let s = await p.evaluate(() => state.sales[0]);
    assert.deepStrictEqual([s.donation, s.method, s.total, s.tip, s.given, s.on], [true, 'bar', 0, 500, 500, undefined]);
    await p.click('#donate'); await p.click('[data-dmethod=paypal]');
    for (const k of ['7', ',', '5']) await p.click(`[data-dkey="${k}"]`);
    assert.strictEqual(await txt(p, '#d-amt'), '7,5 €'); assert.ok((await txt(p, '#d-qr')).includes('paypal.me/KGKleinglattbach/7.50'), await txt(p, '#d-qr'));
    await p.click('#d-ok');
    s = await p.evaluate(() => state.sales[1]); assert.deepStrictEqual([s.donation, s.method, s.tip], [true, 'paypal', 750]);
    assert.strictEqual(await p.evaluate(() => readOrders().orders.length), 0, 'Spenden erscheinen nicht in der Küche');
    const lines = await p.evaluate(() => receiptLines(state.sales[0]).map(l => l.t).join('\n')); assert.ok(/Spende \(ohne Einkauf\)\s+5,00/.test(lines) && /SUMME\s+5,00/.test(lines), lines);
    await admin(p, true);
    const cash = await txt(p, '#cash-card'); assert.ok(cash.includes('+ Spenden0,00') === false && /Spenden.*5,00 €/.test(cash) && /Aktuell in der Kasse.*5,00 €/.test(cash), cash);   // PayPal-Spende ändert den Bargeldbestand nicht
    const sum = await txt(p, '#admin-summary'); assert.ok(/Bar 0,00 € · PayPal 7,50 € · Spenden 12,50 €/.test(sum), sum);
    assert.ok((await txt(p, '#sales-list')).includes('Spende (ohne Einkauf)'));
    await p.click('[data-void="1"]'); await p.click('#c-ok'); await p.waitForTimeout(150); assert.ok(/Aktuell in der Kasse.*0,00 €/.test(await txt(p, '#cash-card')), 'Storno der Spende');
    const rep = await p.evaluate(() => reportLines(null).map(l => l.t).join('\n')); assert.ok(/Spenden ohne Einkauf: 1\s+7,50/.test(rep), rep);   // die stornierte Spende zählt nicht
    await p.ctx.close();
  });

  if (feat('Leo B.') || has('display.html')) await test('Logo (hell/dunkel) und Fußzeile', async errs => {
    const p = await open(errs);
    assert.ok((await txt(p, '.foot')).includes(feat('sound-booked') ? 'Copyright by Leo B. und Pascal B. - 2026' : 'coded by Leo B. - 2026'));
    const vis = sel => p.evaluate(s => { const i = document.querySelector(s); return !!i && getComputedStyle(i).display !== 'none' && i.complete && i.naturalWidth > 100 && i.getBoundingClientRect().height >= 40; }, sel);
    assert.ok(await vis('.top .logo.l') && !(await p.evaluate(() => getComputedStyle(document.querySelector('.top .logo.d')).display !== 'none')), 'Hell: schwarze Variante');
    assert.strictEqual(await p.evaluate(() => document.querySelector('.top .logo.l').getAttribute('src')), 'icons/jugend-hell.png');
    const dark = await p.ctx.newPage(); await dark.emulateMedia({ colorScheme: 'dark' }); await dark.goto(base);
    assert.ok(await dark.evaluate(() => getComputedStyle(document.querySelector('.top .logo.d')).display !== 'none' && getComputedStyle(document.querySelector('.top .logo.l')).display === 'none'), 'Dunkel: weiße Variante');
    await p.ctx.close();
  });

  if (feat('sound-toggle')) await test('Töne: Einstellungen, ein/aus, Lautstärke, jeder Ton lässt sich spielen', async errs => {
    const p = await open(errs); await admin(p, true);
    assert.strictEqual(await p.isChecked('#sound-toggle'), true); assert.strictEqual(await p.inputValue('#sound-vol'), 'mid');
    for (const n of await p.evaluate(() => Sound.names)) await p.evaluate(x => Sound.play(x), n);   // kein Fehler
    if (feat('ord-pane')) assert.deepStrictEqual((await p.evaluate(() => Sound.names)).sort(), ['booked', 'ready'], 'nur zwei Töne');
    await p.selectOption('#sound-vol', 'high'); assert.deepStrictEqual(await p.evaluate(() => [Sound.config.vol, state.sound.vol]), ['high', 'high']);
    await p.evaluate(() => { window.__o = 0; const f = AudioContext.prototype.createOscillator; AudioContext.prototype.createOscillator = function () { window.__o++; return f.call(this); }; });
    await p.evaluate(() => Sound.play('booked')); assert.strictEqual(await p.evaluate(() => window.__o), 3, '„booked“ besteht aus drei Tönen');
    await p.evaluate(() => { window.__o = 0; });
    await p.click('.switch-row:has(#sound-toggle)'); assert.deepStrictEqual(await p.evaluate(() => [Sound.config.on, state.sound.on]), [false, false]);
    await p.evaluate(() => Sound.play('booked')); assert.strictEqual(await p.evaluate(() => window.__o), 0, 'bei „aus“ wird nichts gespielt');
    await p.ctx.close();
  });

  if (feat('mig23')) await test('Bisherige Standardfarben werden zu Logo-Farben, eigene Farben bleiben', async errs => {
    const p = await open(errs, '#burger', { seed: { mig17: true, mig20: true, catalog: [{ id: 'burger', label: 'Burger & Spezi', groups: [
      { id: 'a', name: 'Burger', color: '#34C759', items: [{ id: 'b-x', name: 'X', price: 100, vat: 7 }] },
      { id: 'b', name: 'Getränke', color: '#30B0C7', items: [] }, { id: 'c', name: 'Eigene', color: '#123456', items: [] }, { id: 'd', name: 'Crêpes', color: '#ff9f0a', items: [] }] }] } });
    assert.deepStrictEqual(await p.evaluate(() => STANDS[0].groups.map(g => g.color)), ['#909090', '#CB7ADA', '#123456', '#A10DBC']);
    await p.reload(); assert.deepStrictEqual(await p.evaluate(() => STANDS[0].groups.map(g => g.color)), ['#909090', '#CB7ADA', '#123456', '#A10DBC'], 'läuft nur einmal');
    await p.ctx.close();
  });

  if (has('theme.js')) await test('Design: Standard in Logo-Lila, Knöpfe, Logo im Hintergrund', async errs => {
    const p = await open(errs, '#burger');
    const st = await p.evaluate(() => { const b = getComputedStyle(document.querySelector('#pay')), r = getComputedStyle(document.documentElement), wm = getComputedStyle(document.querySelector('#wm'));
      return { scheme: document.documentElement.dataset.scheme, theme: document.documentElement.dataset.theme, brand: r.getPropertyValue('--brand').trim(), ink: r.getPropertyValue('--brand-ink').trim(), wmOp: wm.opacity, wmImg: wm.backgroundImage }; });
    assert.deepStrictEqual([st.scheme, st.theme, st.brand, st.ink], ['light', 'standard', '#A10DBC', '#ffffff']);
    assert.ok(st.wmImg.includes('jugend-hell.png') && Math.abs(+st.wmOp - 0.07) < 0.001, JSON.stringify(st));
    await tap(p, 'b-maul-v'); assert.strictEqual(await p.evaluate(() => getComputedStyle(document.querySelector('#pay')).backgroundColor), 'rgb(161, 13, 188)', 'Bezahlen-Knopf in Logo-Lila');
    await p.ctx.close();
  });

  if (has('theme.js')) await test('Design einstellen: Thema, hell/dunkel, Knopffarbe, Logo, Zurücksetzen, bleibt nach Neustart', async errs => {
    const p = await open(errs); await admin(p, true);
    const css = n => p.evaluate(n => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), n);
    await p.selectOption('#d-theme', 'classic'); assert.strictEqual(await css('--brand'), '#007AFF');
    await p.click('[data-acc="#1B7F4B"]'); assert.strictEqual(await css('--brand'), '#1B7F4B'); assert.strictEqual(await p.getAttribute('[data-acc="#1B7F4B"]', 'aria-pressed'), 'true');
    await p.fill('#d-custom', '#d9730d'); await p.waitForTimeout(150); assert.strictEqual(await css('--brand'), '#D9730D', 'eigene Farbe');
    await p.click('[data-acc=""]'); assert.strictEqual(await css('--brand'), '#007AFF', 'Automatisch = Farbe des Themas');
    await p.selectOption('#d-mode', 'dark'); assert.deepStrictEqual(await p.evaluate(() => [document.documentElement.dataset.scheme, getComputedStyle(document.body).backgroundColor]), ['dark', 'rgb(0, 0, 0)']);
    await p.selectOption('#d-mode', 'auto'); assert.strictEqual(await p.evaluate(() => document.documentElement.dataset.scheme), 'light');
    await p.selectOption('#d-logo', 'off'); assert.strictEqual(await p.evaluate(() => getComputedStyle(document.querySelector('#wm')).opacity), '0');
    await p.selectOption('#d-logo', 'mid'); assert.strictEqual(await p.evaluate(() => getComputedStyle(document.querySelector('#wm')).opacity), '0.14');
    await p.selectOption('#d-theme', 'standard'); await p.selectOption('#d-mode', 'dark');
    await p.reload(); assert.deepStrictEqual(await p.evaluate(() => [document.documentElement.dataset.scheme, getComputedStyle(document.documentElement).getPropertyValue('--brand').trim(), state.design.logo]), ['dark', '#B52FCB', 'mid'], 'Design bleibt nach dem Neustart');
    await admin(p, false); await p.click('#d-reset');
    assert.deepStrictEqual(await p.evaluate(() => [document.documentElement.dataset.scheme, state.design.logo, state.design.theme]), ['light', 'low', 'standard']);
    // „Immer hell“ gilt auch, wenn das Tablet dunkel ist
    const d = await p.ctx.newPage(); await d.emulateMedia({ colorScheme: 'dark' }); await d.goto(base);
    assert.strictEqual(await d.evaluate(() => document.documentElement.dataset.scheme), 'dark', 'Automatisch folgt dem Tablet');
    await d.evaluate(() => { state.design.mode = 'light'; save(); Theme.apply(state.design); }); assert.strictEqual(await d.evaluate(() => document.documentElement.dataset.scheme), 'light');
    await p.ctx.close();
  });

  if (has('theme.js')) await test('Weihnachtsdesign: Farben, Lichterkette, Mütze, Schnee ein/aus, Küchenanzeige übernimmt es', async errs => {
    const p = await open(errs, '#burger'); await admin(p, true);
    await p.selectOption('#d-theme', 'xmas'); assert.strictEqual(await p.isVisible('#d-snow-row'), true);
    const x = await p.evaluate(() => { const r = getComputedStyle(document.documentElement), t = getComputedStyle(document.querySelector('.top'), '::before');
      return { cls: document.body.classList.contains('theme-xmas'), brand: r.getPropertyValue('--brand').trim(), bg: r.getPropertyValue('--bg').trim(), garland: t.content, snow: !!document.querySelector('#snow') }; });
    assert.deepStrictEqual([x.cls, x.brand, x.bg, x.snow], [true, '#17703F', '#F7F0E3', true]); assert.ok(x.garland !== 'none', 'Lichterkette');
    await p.click('#admin-close');
    const acc = await p.evaluate(() => [...document.querySelectorAll('.group')].map(g => getComputedStyle(g).getPropertyValue('--accent').trim()));
    assert.deepStrictEqual(acc, ['#B3261E', '#1B7F4B'], 'Kachelfarben Rot und Grün');
    await tap(p, 'b-maul-v'); assert.strictEqual(await p.evaluate(() => getComputedStyle(document.querySelector('[data-count="b-maul-v"]')).backgroundColor), 'rgb(179, 38, 30)', 'Zähler in Weihnachtsrot');
    assert.strictEqual(await p.evaluate(() => getComputedStyle(document.querySelector('#snow')).pointerEvents), 'none', 'Schnee blockiert keine Berührung');
    // die Berührung geht durch den Schnee hindurch
    await tap(p, 'b-maul-f'); assert.strictEqual(await p.evaluate(() => cart()['b-maul-f']), 1);
    await admin(p, false); await p.click('.switch-row:has(#d-snow)'); assert.strictEqual(await p.evaluate(() => !!document.querySelector('#snow')), false, 'Schnee aus');
    await p.click('.switch-row:has(#d-snow)'); assert.strictEqual(await p.evaluate(() => !!document.querySelector('#snow')), true, 'Schnee wieder an');
    await p.selectOption('#d-theme', 'standard'); assert.deepStrictEqual(await p.evaluate(() => [document.body.classList.contains('theme-xmas'), !!document.querySelector('#snow')]), [false, false]);
    // Küchenanzeige im Weihnachtsdesign
    await p.selectOption('#d-theme', 'xmas');
    const k = await p.ctx.newPage(); await k.goto(base.replace('index.html', 'display.html') + '#all');
    assert.deepStrictEqual(await k.evaluate(() => [document.documentElement.dataset.theme, getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()]), ['xmas', '#F7F0E3']);
    await p.ctx.close();
  });

  if (feat('ord-pane')) await test('Bestellungen in der Kasse: Fertig/abgeholt per Touch, Ton nur bei fertig, Monitor-Ansicht ohne Bedienung', async errs => {
    const p = await open(errs, '#crepes');
    await p.evaluate(() => { window.__s = []; const o = Sound.play; Sound.play = n => { __s.push(n); o.call(Sound, n); }; });
    await tap(p, 'c-nutella'); await tap(p, 'c-kaese'); await p.click('#pay'); await p.click('[data-quick="20"]'); await p.click('#p-ok'); await p.click('#toast-x').catch(() => {});
    await p.click('[data-tab=ord]'); assert.strictEqual(await p.isVisible('#ord-pane'), true); assert.strictEqual(await p.isVisible('#pay'), false);
    assert.strictEqual(await p.locator('#ord-open .ord').count(), 1); assert.ok((await txt(p, '#ord-open')).includes('C1'));
    await p.click('[data-ord-done]'); assert.strictEqual(await p.evaluate(() => readOrders().orders[0].status), 'ready');
    assert.deepStrictEqual(await p.evaluate(() => __s), ['booked', 'ready'], 'zwei Töne: verbucht, fertig');
    await p.click('[data-ord-pick]'); assert.strictEqual(await p.evaluate(() => readOrders().orders[0].status), 'done');
    await p.click('#ord-undo'); assert.strictEqual(await p.evaluate(() => readOrders().orders[0].status), 'ready');
    await p.click('[data-tab=bon]'); assert.strictEqual(await p.isVisible('#pay'), true);
    // Monitor-Ansicht: keine Bedienelemente, kein Zurück-Link; normale Ansicht hat den Link zur Kasse
    const k = await p.ctx.newPage(); await k.goto(base.replace('index.html', 'display.html') + '?view=1#all');
    await tap(p, 'c-zimt'); await p.click('#pay'); await p.click('[data-quick="5"]'); await p.click('#p-ok');
    await k.waitForSelector('.tk');
    assert.deepStrictEqual(await k.evaluate(() => ['.done', '#undo', '#back'].map(s => { const e = document.querySelector(s); return !e || getComputedStyle(e).display === 'none' || e.hidden; })), [true, true, true], 'Monitor ohne Bedienelemente');
    const k2 = await p.ctx.newPage(); await k2.goto(base.replace('index.html', 'display.html') + '#all');
    assert.strictEqual(await k2.isVisible('#back'), true, 'Link zurück zur Kasse');
    await p.ctx.close();
  });

  if (feat('order-mode')) await test('Bestellnummer von Hand (Märkchen): Eingabe beim Verbuchen, doppelte Nummer gesperrt, Nummer in Küche und Buchung', async errs => {
    const p = await open(errs, '#crepes', { seed: { orderMode: 'manual' } });
    const book = async (ids, no) => { for (const i of ids) await tap(p, i); await p.click('#pay'); await p.click('[data-quick="20"]'); await p.click('#p-ok');
      await p.waitForSelector('#num-dlg[open]'); assert.strictEqual(await p.isDisabled('#n-ok'), true, 'ohne Nummer nicht verbuchbar');
      for (const d of no) await p.click(`[data-nkey="${d}"]`); };
    await book(['c-nutella'], '07'); assert.strictEqual(await txt(p, '#n-val'), '07'); await p.click('#n-ok');
    assert.strictEqual(await p.evaluate(() => state.sales[0].on), '7', 'Nummer ohne führende Null');
    assert.strictEqual(await p.evaluate(() => readOrders().orders[0].no), '7');
    assert.ok((await txt(p, '#toast')).includes('7'), 'Nummer im Hinweis'); await p.click('#toast-x').catch(() => {});
    await book(['c-kaese'], '7'); assert.strictEqual(await p.isDisabled('#n-ok'), true, 'Nummer noch in Gebrauch'); assert.ok((await txt(p, '#n-err')).includes('in Gebrauch'));
    await p.click('[data-nkey=back]'); await p.click('[data-nkey="8"]'); assert.strictEqual(await p.isDisabled('#n-ok'), false); await p.click('#n-ok');
    assert.strictEqual(await p.evaluate(() => state.sales.map(x => x.on).join()), '7,8');
    // abgeholt gibt die Nummer wieder frei
    await p.evaluate(() => { const o = readOrders(); o.orders[0].status = 'done'; writeOrders(o); }); await p.click('#toast-x').catch(() => {});
    await book(['c-zimt'], '7'); assert.strictEqual(await p.isDisabled('#n-ok'), false, 'abgeholte Nummer wieder frei'); await p.click('#n-ok');
    // Spende braucht keine Nummer; Zurück bricht die Eingabe ab
    await p.click('#toast-x').catch(() => {}); await tap(p, 'c-zimt'); await p.click('#pay'); await p.click('[data-quick="20"]'); await p.click('#p-ok'); await p.waitForSelector('#num-dlg[open]');
    await p.click('#n-cancel'); assert.strictEqual(await p.evaluate(() => state.sales.length), 3, 'abgebrochen: nicht verbucht');
    await p.ctx.close();
  });

  if (feat('sound-booked')) await test('Töne einzeln schaltbar (Abholbereit ab Werk aus), Nummer 0 gesperrt, Schneehaufen und Weihnachtsmarkt nur im Weihnachtsdesign', async errs => {
    const p = await open(errs, '#crepes');
    await p.evaluate(() => { window.__o = 0; const f = AudioContext.prototype.createOscillator; AudioContext.prototype.createOscillator = function () { window.__o++; return f.call(this); }; });
    await p.evaluate(() => Sound.play('ready')); assert.strictEqual(await p.evaluate(() => window.__o), 0, 'Abholbereit ist ab Werk aus');
    await p.evaluate(() => Sound.play('booked')); assert.strictEqual(await p.evaluate(() => window.__o), 3, 'Schiffshorn spielt');
    await admin(p, true); assert.deepStrictEqual(await p.evaluate(() => [document.querySelector('#sound-booked').checked, document.querySelector('#sound-ready').checked]), [true, false]);
    await p.click('.switch-row:has(#sound-ready)'); await p.click('.switch-row:has(#sound-booked)');
    assert.deepStrictEqual(await p.evaluate(() => [state.sound.tones.booked, state.sound.tones.ready]), [false, true]);
    await p.evaluate(() => { window.__o = 0; Sound.play('booked'); }); assert.strictEqual(await p.evaluate(() => window.__o), 0, 'Verbucht ausgeschaltet');
    await p.evaluate(() => Sound.play('ready')); assert.ok(await p.evaluate(() => window.__o) > 0, 'Abholbereit eingeschaltet');
    await p.reload(); assert.deepStrictEqual(await p.evaluate(() => [Sound.toneOn('booked'), Sound.toneOn('ready')]), [false, true], 'bleibt nach dem Neustart');
    // Schneehaufen / Weihnachtsmarkt
    const vis = () => p.evaluate(() => getComputedStyle(document.querySelector('#xmas-scene')).display);
    await p.evaluate(() => { state.design.theme = 'standard'; save(); Theme.apply(state.design); }); assert.strictEqual(await vis(), 'none');
    for (const mode of ['light', 'dark']) { await p.evaluate(m => { state.design.theme = 'xmas'; state.design.mode = m; save(); Theme.apply(state.design); }, mode); assert.strictEqual(await vis(), 'block', 'Szene im Weihnachtsdesign (' + mode + ')'); }
    assert.strictEqual(await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()), '#000000', 'Dunkelmodus: schwarz statt grün');
    // Nummer 0 sperren
    await p.evaluate(() => { state.orderMode = 'manual'; save(); });
    await tap(p, 'c-nutella'); await p.click('#pay'); await p.click('[data-quick="20"]'); await p.click('#p-ok'); await p.waitForSelector('#num-dlg[open]');
    await p.click('[data-nkey="0"]'); assert.strictEqual(await p.isDisabled('#n-ok'), true, '0 gesperrt'); assert.ok((await txt(p, '#n-err')).includes('0 ist gesperrt'));
    await p.click('[data-nkey="0"]'); assert.strictEqual(await p.isDisabled('#n-ok'), true, '00 gesperrt');
    await p.click('[data-nkey="5"]'); assert.strictEqual(await p.isDisabled('#n-ok'), false, '005 erlaubt (= 5)');
    await p.ctx.close();
  });

  if (feat('orderOff')) await test('Bestellprozess je Sparte abschaltbar, Gratis-Produkte verbuchen', async errs => {
    const cat = [{ id: 'a', label: 'Ohne Status', groups: [{ id: 'ga', name: 'Gratis', color: '#A10DBC', items: [{ id: 'a-free', name: 'Probierhäppchen', price: 0, vat: 7 }, { id: 'a-paid', name: 'Tasse', price: 300, vat: 7 }] }] },
      { id: 'b', label: 'Mit Status', groups: [{ id: 'gb', name: 'Essen', color: '#A10DBC', items: [{ id: 'b-1', name: 'Crêpe', price: 300, vat: 7 }] }] }];
    const p = await open(errs, '#a', { seed: { mig17: true, mig20: true, mig23: true, stand: 'a', catalog: cat, orderMode: 'manual', orderOff: { a: true } } });
    assert.strictEqual(await txt(p, '[data-add=a-free] .price'), 'Gratis', 'Gratis statt 0,00 €');
    await tap(p, 'a-free'); assert.ok((await txt(p, '#bon-lines')).includes('Gratis'));
    await p.click('#pay'); assert.ok((await txt(p, '#p-change')).includes('Nichts zu zahlen')); await p.click('#p-ok');
    assert.deepStrictEqual(await p.evaluate(() => [state.sales.length, state.sales[0].total, state.sales[0].on || null, readOrders().orders.length]), [1, 0, null, 0], 'gratis verbucht, ohne Nummer und ohne Küche');
    await tap(p, 'a-free'); await tap(p, 'a-paid'); await p.click('#pay'); await p.click('[data-quick="5"]'); await p.click('#p-ok');
    assert.deepStrictEqual(await p.evaluate(() => [state.sales[1].total, document.querySelector('#num-dlg').open]), [300, false], 'Sparte ohne Bestellprozess: keine Nummernabfrage');
    await p.click('[data-stand=b]'); await tap(p, 'b-1'); await p.click('#pay'); await p.click('[data-quick="5"]'); await p.click('#p-ok');
    assert.strictEqual(await p.evaluate(() => document.querySelector('#num-dlg').open), true, 'andere Sparte fragt weiter nach der Nummer');
    await p.click('[data-nkey="4"]'); await p.click('#n-ok'); assert.deepStrictEqual(await p.evaluate(() => [state.sales[2].on, readOrders().orders.length]), ['4', 1]);
    await admin(p, true); assert.deepStrictEqual(await p.evaluate(() => [...document.querySelectorAll('[data-ordstand]')].map(x => x.checked)), [false, true]);
    await p.click('.switch-row:has([data-ordstand=a])'); assert.deepStrictEqual(await p.evaluate(() => state.orderOff), {}, 'wieder eingeschaltet');
    await p.ctx.close();
  });

  if (feat('exp-open')) await test('Ausgaben: erfassen, gegenrechnen, aus der Kasse, stornieren, Bericht und Datei', async errs => {
    const p = await open(errs, '#crepes');
    await tap(p, 'c-nutella'); await p.click('#pay'); await p.click('[data-quick="5"]'); await p.click('#p-ok');
    await p.evaluate(() => { state.orderMode = 'auto'; });
    await admin(p, true); assert.ok((await txt(p, '#exp-card')).includes('Gewinn'));
    await p.click('#exp-open'); await p.fill('#exp-amt', '0'); await p.click('#exp-form button[type=submit]'); assert.ok((await txt(p, '#exp-err')).includes('Betrag'));
    await p.fill('#exp-amt', '1,50'); await p.click('#exp-form button[type=submit]'); assert.ok((await txt(p, '#exp-err')).includes('Bezeichnung'));
    await p.fill('#exp-note', 'Einkauf Nutella'); await p.selectOption('#exp-stand', 'crepes'); await p.click('.switch-row:has(#exp-cash)'); await p.click('#exp-form button[type=submit]');
    assert.deepStrictEqual(await p.evaluate(() => [state.exp.length, state.exp[0].amt, state.exp[0].cash, state.moves.length, state.moves[0].amt]), [1, 150, true, 1, -150], 'Ausgabe und Entnahme');
    let c = await txt(p, '#exp-card'); assert.ok(c.includes('2,50') && c.includes('Gewinn') && c.includes('Einkauf Nutella') && c.includes('Crêpes'), c);   // 4,00 − 1,50
    await p.click('#exp-open'); await p.fill('#exp-amt', '10'); await p.fill('#exp-note', 'Miete Stand'); await p.click('#exp-form button[type=submit]');
    c = await txt(p, '#exp-card'); assert.ok(c.includes('Verlust') && c.includes('Allgemein'), c);
    // stornieren: Ausgabe und die zugehörige Entnahme
    const id1 = await p.evaluate(() => state.exp[0].id); await p.click(`[data-expvoid="${id1}"]`); await p.waitForSelector('#confirm[open]'); await p.click('#c-ok');
    assert.strictEqual(await p.evaluate(() => state.exp[0].void), true);
    assert.strictEqual(await p.evaluate(() => state.moves.every(m => m.void === state.exp.find(x => x.id === m.expId).void)), true, 'Entnahme folgt der Ausgabe');
    const csv = (await dl(p, '#save')).toString('utf8'); assert.ok(csv.includes('Ausgaben') && csv.includes('Einkauf Nutella'), 'Datei enthält Ausgaben');
    assert.ok(await p.evaluate(() => reportLines(null).some(x => x.t.includes('AUSGABEN'))), 'Kassenbericht enthält Ausgaben');
    await p.ctx.close();
  });

  if (feat('embed=1')) await test('Küche (Überlagerung): alle Sparten, nichts abgeschnitten, auch im Weihnachtsdesign, ohne doppelten Titel', async errs => {
    const p = await open(errs, '#burger', { seed: { design: { theme: 'xmas', snow: true, mode: 'auto', accent: null, logo: 'low' } } });
    const book = async (ids, q) => { for (const i of ids) await tap(p, i); await p.click('#pay'); await p.click(`[data-quick="${q}"]`); await p.click('#p-ok'); await p.click('#toast-x').catch(() => {}); };
    await book(['b-spezial-f', 'b-spezial-v', 'b-spezial-v'], '50');                                  // Burger: lange Namen
    await p.click('[data-stand=crepes]'); await book(['c-kraeuter', 'c-kaese'], '20'); await p.click('[data-stand=burger]');   // Crêpes gebucht, Burger-Seite gewählt
    await p.click('#kitchen-open'); await p.waitForSelector('#kitchen-ov:not([hidden])');
    let f; for (let i = 0; i < 40 && !f; i++) { f = p.frames().find(x => x.url().includes('display.html')); if (!f) await p.waitForTimeout(100); }
    await f.waitForSelector('.tk');
    const m = await f.evaluate(() => ({ chip: document.querySelector('.chip[aria-pressed=true]').textContent, nos: [...document.querySelectorAll('.tk .no')].map(x => x.textContent),
      mainH: document.querySelector('main').clientHeight, snow: !!document.querySelector('#snow'), h1: getComputedStyle(document.querySelector('h1')).display,
      clipped: [...document.querySelectorAll('.tk li span')].filter(s => s.scrollWidth > s.clientWidth + 1).length, ticketsCut: [...document.querySelectorAll('.tk')].filter(t => t.scrollHeight > t.clientHeight + 1).length }));
    assert.deepStrictEqual([m.chip, m.nos], ['Alle', ['B1', 'C1']], 'Standard: alle Sparten sichtbar');
    assert.ok(m.mainH > 250, 'Anzeige nicht zusammengedrückt: ' + m.mainH); assert.strictEqual(m.snow, false, 'kein Schnee in der Küche'); assert.strictEqual(m.h1, 'none', 'Titel steht schon im Rahmen');
    assert.deepStrictEqual([m.clipped, m.ticketsCut], [0, 0], 'Text abgeschnitten');
    const hd = await p.evaluate(() => document.querySelector('#kitchen-ov .top').getBoundingClientRect().top); if (dir === 'kasse-test') assert.ok(hd >= 26, 'Kopfzeile unter dem Testbalken: ' + hd);
    await p.click('#kitchen-close');
    await p.evaluate(() => { state.lock = 'crepes'; save(); });                                          // Gerät fest auf Crêpes: nur diese Sparte
    await p.click('#kitchen-open'); f = null; for (let i = 0; i < 40 && !f; i++) { f = p.frames().find(x => x.url().includes('display.html')); if (!f) await p.waitForTimeout(100); }
    await f.waitForFunction(() => document.querySelector('.chip[aria-pressed=true]') && document.querySelector('.chip[aria-pressed=true]').textContent === 'Crêpes');
    assert.deepStrictEqual(await f.evaluate(() => [...document.querySelectorAll('.tk .no')].map(x => x.textContent)), ['C1']);
    await p.ctx.close();
  });

  await browser.close(); server.close();
  console.log(`\n${count - fails} von ${count} Ablauf-Tests bestanden (${dir})`); process.exit(fails ? 1 : 0);
})();
