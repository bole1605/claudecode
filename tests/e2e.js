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
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.addInitScript(({ k, v }) => { if (!localStorage.getItem(k)) localStorage.setItem(k, v); }, { k: dir === 'kasse-test' ? 'kasse-test-v2' : 'kasse-v2', v: JSON.stringify({ share: { on: !!opts.share }, ...(opts.seed || {}) }) });   // Bon-QR nur in den Tests, die ihn prüfen
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
    assert.strictEqual(st.disp, 'grid'); assert.strictEqual(st.bg, 'rgb(52, 199, 89)'); assert.strictEqual(st.fg, 'rgb(0, 0, 0)');
    assert.strictEqual(st.price, st.label, 'Preis nicht in Kategorie-Farbe');
    const cat = await p.evaluate(() => STANDS.find(s => s.id === 'karten').groups[0].color); assert.strictEqual(cat, '#5856D6');
    await p.ctx.close();
  });

  if (feat('mig20')) await test('Rote Kategorie aus altem Sortiment wird zu Indigo', async errs => {
    const p = await open(errs, '#karten', { seed: { mig17: true, stand: 'karten', catalog: [{ id: 'karten', label: 'Karten', groups: [{ id: 'k1', name: 'Karten', color: '#FF3B30', items: [{ id: 'k-1', name: 'Eine Karte', price: 300, vat: 19 }] }] }] } });
    assert.strictEqual(await p.evaluate(() => STANDS[0].groups[0].color), '#5856D6'); await p.ctx.close();
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

  await browser.close(); server.close();
  console.log(`\n${count - fails} von ${count} Ablauf-Tests bestanden (${dir})`); process.exit(fails ? 1 : 0);
})();
