import puppeteer from 'puppeteer';
import fs from 'fs'; fs.mkdirSync('tests/out', { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ protocolTimeout: 180000, args: [...(process.env.SWGL ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : []), '--no-sandbox', '--mute-audio'] });
const page = await browser.newPage(); const logs = [];
page.on('console', m => { if (m.type() === 'error') logs.push(m.text()); }); page.on('pageerror', e => logs.push('PAGEERROR ' + e.message + (e.stack || '').split('\n').slice(0, 3).join(' | ')));
await page.emulate({ viewport: { width: 390, height: 780, deviceScaleFactor: 1, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (Linux; Android 13) Mobile' });
await page.evaluateOnNewDocument(() => { if (!localStorage.getItem('khuntau-story')) localStorage.setItem('khuntau-story', JSON.stringify({ ch: 5, done: 1, painted: [1, 1, 1], chosen: 1, oiled: 1, garland: 1 })); });
await page.goto('http://127.0.0.1:8791/?debug&q=low', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !document.getElementById('storyBtn').disabled, { timeout: 90000 });
const shot = n => page.screenshot({ path: `tests/out/a-${n}.jpg`, type: 'jpeg', quality: 72 });
const ev = (f, ...a) => page.evaluate(f, ...a);
const near = (l) => page.waitForFunction((l) => { const n = __k.story.debug.S.near; return n && n.label === l; }, { timeout: 40000 }, l);
const act = () => ev(() => document.getElementById('actBtn').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true })));
const tap = () => ev(() => document.getElementById('tapzone').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true })));
const mode = (m) => page.waitForFunction((m) => __k.story.debug.S.mode === m, { timeout: 60000 }, m);
console.log('label', await page.$eval('#storyBtn', e => e.textContent));
await ev(() => document.getElementById('storyBtn').click()); await sleep(2500); console.log('obj', await page.$eval('#objText', e => e.textContent));
// archery
await ev(() => { const o = __k.story.debug.S; }); 
const pts = await ev(() => { const d = __k.story.debug; return null; });
await ev(() => { __k.game.p.pos.set(Math.cos(0.35 + 0.698132 * 1.5) * 18.5, 0, Math.sin(0.35 + 0.698132 * 1.5) * 18.5); }); await near('SHOOT'); await shot('01-arch-near'); await act(); await mode('aim'); await sleep(1500); await shot('02-aim');
for (let n = 0; n < 5; n++) { await page.waitForFunction(() => { const a = __k.story.debug.arch; const x = parseFloat(document.getElementById('aimMark').style.left); return !a.fly && a.wait <= 0 && Math.abs(x - 50) < 5; }, { timeout: 60000, polling: 'raf' }); await tap(); if (n === 2) { await sleep(400); await shot('03-arrow'); } await sleep(300); }
await mode('walk'); console.log('arch hits', await ev(() => __k.story.debug.arch.hits), 'td', JSON.stringify(await ev(() => __k.story.debug.save.td))); await shot('04-arch-done');
// fishing
await ev(() => { const a = 0.35 + 0.698132 * 4.5; __k.game.p.pos.set(Math.cos(a) * 20.7, 0, Math.sin(a) * 20.7); }); await near('FISH'); await act(); await mode('fish'); await sleep(1500); await shot('05-fish');
for (let n = 0; n < 3; n++) { await page.waitForFunction(() => __k.story.debug.fish.st === 'idle', { timeout: 60000 }); await tap(); await page.waitForFunction(() => __k.story.debug.fish.st === 'bite', { timeout: 60000, polling: 'raf' }); if (n === 0) await shot('06-bite'); await tap(); await sleep(300); if (n === 0) await shot('07-catch'); }
await mode('walk'); console.log('fish got', await ev(() => __k.story.debug.fish.got), 'td', JSON.stringify(await ev(() => __k.story.debug.save.td)));
// three houses
for (let h = 0; h < 3; h++) { const j = await ev((h) => { const hs = __k.houses[[2, 5, 7][h]], f = hs.d / 2 + 1.1; const p = [hs.x + Math.sin(hs.rot) * f, hs.z + Math.cos(hs.rot) * f]; __k.game.p.pos.set(p[0], 0, p[1]); return p; }, h);
  await near('SING'); if (h === 0) await shot('08-door'); await act(); await mode('echo'); await page.waitForFunction(() => __k.story.debug.echo.ph === 'input', { timeout: 60000 }); if (h === 0) await shot('09-echo');
  const seq = await ev(() => __k.story.debug.echo.seq); for (const l of seq) { await ev((l) => __k.story.debug.strike(l), l); await sleep(250); } await mode('walk'); await sleep(400); }
console.log('td', JSON.stringify(await ev(() => __k.story.debug.save.td)), 'obj', await page.$eval('#objText', e => e.textContent)); await shot('10-after');
// Hindi
await page.keyboard.press('Escape'); await sleep(400); await ev(() => document.getElementById('langBtn').click()); await shot('11-pause'); await ev(() => document.getElementById('resumeBtn').click()); await sleep(600);
console.log('hi obj', await page.$eval('#objText', e => e.textContent)); await ev(() => __k.story.debug.say([['x', 'y']])); await ev(() => { const d = __k.story.debug; d.S.dlg = null; document.getElementById('dlg').hidden = true; });
await ev(() => { const h = __k.houses[0]; __k.game.p.pos.set(h.x + Math.sin(h.rot) * (h.d / 2 + 1), 0, h.z + Math.cos(h.rot) * (h.d / 2 + 1)); }); await near('ENTER'); await shot('12-hindi'); console.log('btn', await page.$eval('#actBtn', e => e.textContent));
// quit: horns back to normal, menu label
await page.keyboard.press('Escape'); await sleep(300); await ev(() => document.getElementById('quitBtn').click()); await sleep(800); console.log('label', await page.$eval('#storyBtn', e => e.textContent), '| xp notes ok | mode', await ev(() => __k.game.mode));
console.log(logs.filter(l => !/404|GPU|WebGL|ERR_FAILED|GroupMarker/i.test(l)).slice(0, 10).join('\n') || 'no errors');
await browser.close();
