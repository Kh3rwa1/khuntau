import puppeteer from 'puppeteer';
import fs from 'fs'; import { check, finish, realErrors } from './check.mjs'; fs.mkdirSync('tests/out', { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const [W, Hh, tag] = [+process.argv[2] || 390, +process.argv[3] || 780, process.argv[4] || 'p'];
const browser = await puppeteer.launch({ protocolTimeout: 180000, args: [...(process.env.SWGL ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : []), '--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
const page = await browser.newPage(); const logs = [];
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); }); page.on('pageerror', e => logs.push('PAGEERROR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
await page.emulate({ viewport: { width: W, height: Hh, deviceScaleFactor: 1, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-A346E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36' });
await page.goto('http://127.0.0.1:8791/?debug&q=low', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !document.getElementById('storyBtn').disabled, { timeout: 90000 });
const shot = async n => { await page.screenshot({ path: `tests/out/${tag}-${n}.jpg`, type: 'jpeg', quality: 72 }); };
const ev = f => page.evaluate(f);
const st = () => ev(() => { const s = __k.story.debug; return { ch: s.save.ch, mode: s.S.mode, inside: s.S.inside, near: s.S.near && s.S.near.label, dlg: !!s.S.dlg, pos: [__k.game.p.pos.x, __k.game.p.pos.y, __k.game.p.pos.z].map(v => +v.toFixed(1)), gm: __k.game.mode }; });
const tapDlg = async () => { for (let i = 0; i < 8; i++) { if (!(await ev(() => !!__k.story.debug.S.dlg))) break; await ev(() => document.getElementById('dlg').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }))); await sleep(350); } };
const act = () => ev(() => document.getElementById('actBtn').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true })));
const goto = (x, y, z) => page.evaluate((x, y, z) => { __k.game.p.pos.set(x, y, z); }, x, y, z);
await shot('00-home');
await page.tap('#storyBtn'); await sleep(1800); await shot('01-wake'); { const s = await st(); check(s.inside && s.ch === 0 && s.gm === 'story', 'story starts inside the house, chapter 0'); }
await tapDlg(); await sleep(300);
const I = await ev(() => { const w = __k.story.debug.W.inside; return { h: [w.handi.x, w.handi.y, w.handi.z], d: [w.door.x, w.door.y, w.door.z] }; });
await goto(I.h[0] + 0.3, I.h[1], I.h[2] + 0.9); await sleep(500); await shot('02-handi'); console.log('at handi', await st());
await act(); await sleep(2300); await shot('03-drank'); await tapDlg(); check((await st()).ch === 1, 'drinking the handi finishes chapter 1');
await goto(I.d[0], I.d[1], I.d[2]); await sleep(400); console.log('door', await st()); await act(); await sleep(1300); await shot('04-outside'); check(!(await st()).inside, 'door takes you outside');
const nearL = (l, ms = 40000) => page.waitForFunction((l) => { const n = __k.story.debug.S.near; return n && n.label === l; }, { timeout: ms }, l);
for (let i = 0; i < 3; i++) { const s = await ev(() => { const d = __k.story.debug; const i = d.save.painted.indexOf(0); const p = d.W.spots[i].stand; return [p.x, p.z]; }); await goto(s[0], 0, s[1]); await nearL('PAINT'); await act(); await sleep(1500); if (i === 1) await shot('05-paint'); }
await page.waitForFunction(() => !!__k.story.debug.S.dlg, { timeout: 40000 }); await shot('06-painted'); await tapDlg(); check((await st()).ch === 2, 'three motifs painted: chapter 2');
const g = await ev(() => { const p = __k.story.debug.W.gStand; return [p.x, p.z]; }); await goto(g[0], 0, g[1]); await nearL('CHOOSE'); await sleep(1500); await shot('07-gohal'); console.log('gohal', await st());
await act(); await sleep(1500); await shot('08-pick');
for (let i = 0; i < 3; i++) { await page.tap('#pickNext'); await sleep(i === 2 ? 2500 : 700); } await shot('09-pick-cow'); console.log('animal', await ev(() => document.getElementById('pickName').textContent));
const near = (l, ms = 30000) => page.waitForFunction((l) => { const n = __k.story.debug.S.near; return n && n.label === l; }, { timeout: ms }, l);
const chIs = (n, ms = 40000) => page.waitForFunction((n) => __k.story.debug.save.ch === n && !__k.story.debug.S.dlg === false || __k.story.debug.save.ch === n, { timeout: ms }, n);
await page.tap('#pickOk'); await sleep(600); await tapDlg(); await near('OIL'); await act(); await near('GARLAND'); await shot('10-oiled'); await act();
await page.waitForFunction(() => !!__k.story.debug.S.dlg, { timeout: 30000 }); await shot('10b-garland'); await tapDlg(); await chIs(3); await sleep(2500); check((await st()).ch === 3, 'animal chosen, oiled, garlanded: chapter 3');
const a = await ev(() => { const p = __k.story.debug.W.drumStand; return [p.x, p.z]; }); await goto(a[0] + 0.6, 0, a[1] + 0.6); await near('BEAT'); await shot('11-akhra'); await act(); await sleep(700);
const notes = await ev(() => __k.story.debug.drum.notes.map(n => [n.lane, n.time - performance.now() / 1000]));
const t0 = Date.now(); let shotDone = false;
for (const [lane, dt] of notes) { const wait = dt * 1000 - (Date.now() - t0); if (wait > 0) await sleep(wait); await ev(lane === 'T' ? () => __k.story.debug.strike('T') : () => __k.story.debug.strike('U')); if (!shotDone && dt > 5) { shotDone = true; await shot('12-drum'); } }
{ const h = await ev(() => __k.story.debug.drum.hits), e = await ev(() => __k.story.energy()); check(h >= notes.length * 0.8, `drum: ${h}/${notes.length} on-time hits register`); check(e > 0.8, `drum: dancers dance (energy ${e.toFixed(2)})`); }
await page.waitForFunction(() => !!__k.story.debug.S.dlg, { timeout: 60000 }); await shot('13-drumwin'); await tapDlg(); check((await st()).ch === 4, 'drum won: chapter 4');
await goto(0, 0, 9.5); await near('START'); await shot('14-ring'); await act(); await page.waitForFunction(() => __k.game.mode === 'play', { timeout: 30000 }); await sleep(2500); await shot('15-ringrun'); check((await st()).gm === 'play', 'ring finale starts');
await ev(() => { __k.game.pitha = 3; }); await page.waitForFunction(() => __k.game.mode === 'story' && !!__k.story.debug.S.dlg, { timeout: 60000 }); await sleep(600); await shot('16-ending'); check((await st()).ch === 5, '3 pitha win the story: chapter 5'); await tapDlg(); await sleep(1500); await shot('17-free'); check((await st()).gm === 'story', 'back in the village after the ending');
const a2 = await ev(() => { const p = __k.story.debug.W.drumStand; return [p.x, p.z]; }); await goto(a2[0] + 0.6, 0, a2[1] + 0.6); await near('BEAT'); await act(); await sleep(500);
for (let i = 0; i < 14; i++) { await ev(i % 3 ? () => __k.story.debug.strike('U') : () => __k.story.debug.strike('T')); await sleep(300); } await shot('18-freedrum'); { const e = await ev(() => __k.story.energy()); check(e > 0.3, `free drumming gets the village dancing (energy ${e.toFixed(2)})`); }
{ const e = realErrors(logs); check(!e.length, 'no page errors' + (e.length ? ': ' + e.slice(0, 5).join(' | ') : '')); }
await finish(browser);
