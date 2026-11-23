import puppeteer from 'puppeteer';
import { check, finish, realErrors, watchLatin, latinSeen, dragShoot } from './check.mjs';
const HI = !!process.env.HI;
import fs from 'fs'; fs.mkdirSync('tests/out', { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ protocolTimeout: 180000, args: [...(process.env.SWGL ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : []), '--no-sandbox', '--mute-audio'] });
const page = await browser.newPage(); const logs = [];
page.on('console', m => { if (m.type() === 'error') logs.push(m.text()); }); page.on('pageerror', e => logs.push('PAGEERROR ' + e.message + (e.stack || '').split('\n').slice(0, 3).join(' | ')));
await page.emulate({ viewport: { width: 390, height: 780, deviceScaleFactor: 1, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (Linux; Android 13) Mobile' });
await page.evaluateOnNewDocument(() => { if (!localStorage.getItem('khuntau-story')) localStorage.setItem('khuntau-story', JSON.stringify({ ch: 5, done: 1, painted: [1, 1, 1], chosen: 1, oiled: 1, garland: 1 })); });
if (HI) await watchLatin(page); // HI=1: the daily round in Hindi, no English may show
await page.goto('http://127.0.0.1:8791/?debug&q=low', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => document.getElementById('startBtn').dataset.village === 'ready', { timeout: 90000 });
const shot = n => page.screenshot({ path: `tests/out/a-${n}.jpg`, type: 'jpeg', quality: 72 });
const ev = (f, ...a) => page.evaluate(f, ...a);
const near = async (l) => { await page.evaluate(() => { __k.story.debug.S.near = null; }); return page.waitForFunction((l) => { const n = __k.story.debug.S.near; return n && n.label === l; }, { timeout: 40000 }, l); }; // never trust a prompt from before a teleport
const act = () => ev(() => document.getElementById('actBtn').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true })));
const tap = () => ev(() => document.getElementById('tapzone').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true })));
const mode = (m) => page.waitForFunction((m) => __k.story.debug.S.mode === m, { timeout: 60000 }, m);
console.log('label', await page.$eval('#playSub', e => e.textContent));
await ev(() => document.getElementById('startBtn').click()); await sleep(2500); console.log('obj', await page.$eval('#objText', e => e.textContent));
// archery
await ev(() => { __k.game.p.pos.set(Math.cos(0.35 + 0.698132 * 1.5) * 18.5, 0, Math.sin(0.35 + 0.698132 * 1.5) * 18.5); }); await near('SHOOT'); await shot('01-arch-near'); await act(); await mode('aim'); await sleep(1500); await shot('02-aim');
// drag-to-aim with real pointer events: four aimed at the bull, one deliberately wide
const aims = [[0, 0], [0.1, -0.1], [1.25, 0.2], [0, 0], [0, 0.05]];
check(await ev(() => { const W = __k.story.debug.W, b = W.bow.position, p = __k.game.p.pos; return W.bow.visible && W.nocked.visible && b.y > 0.9 && Math.hypot(b.x - p.x, b.z - p.z) < 1.2 && __k.player.curName === 'Shoot_OneHanded'; }), 'archery: a bow in hand, held up with an arrow on the string');
await ev(() => { window.__cineSeen = 0; (function f() { const d = __k.story.debug; if (d.arch.cine && __k.camera.fov < 62 * 0.9) window.__cineSeen = 1; if (d.S.mode === 'aim') requestAnimationFrame(f); })(); });
for (let n = 0; n < 5; n++) { const err = await dragShoot(page, aims[n][0], aims[n][1]); if (n === 0) { await sleep(150); await shot('03-arrow'); } check(err < 0.12, `arrow ${n + 1}: crosshair dragged onto its mark (${err.toFixed(2)} m)`); await page.waitForFunction(() => !__k.story.debug.arch.fly, { timeout: 10000 }); await sleep(100); }
check(await ev(() => window.__cineSeen === 1), 'archery: the camera rides the arrow and zooms on the impact');
check(await ev(() => { const W = __k.story.debug.W, a = W.arrows.slice(0, 5); return a.every(x => x.visible) && a.filter(x => x.position.y < 0.5).length === 1; }), 'every arrow stays where it went: four in the target, the miss stuck in the ground');
check(await ev(() => __k.story.debug.arch.hits) === 4, `aimed arrows hit, the wide one misses (${await ev(() => __k.story.debug.arch.hits)}/5)`);
await mode('walk'); check(await ev(() => !__k.story.debug.W.bow.visible && !__k.story.debug.W.nocked.visible), 'the bow is put away after the contest'); check(await ev(() => __k.story.debug.arch.hits) >= 3 && await ev(() => __k.story.debug.save.td.arch) === 1, 'archery: 3+ hits counts for the day'); await shot('04-arch-done');
// fishing
await ev(() => { window.__fishCine = 0; (function f() { if (__k.story.debug.arch.cine && __k.story.debug.S.mode === 'fish') window.__fishCine++; requestAnimationFrame(f); })(); });
await ev(() => { const a = 0.35 + 0.698132 * 4.5; __k.game.p.pos.set(Math.cos(a) * 20.7, 0, Math.sin(a) * 20.7); }); await near('FISH'); await act(); await mode('fish'); await sleep(1500); await shot('05-fish');
check(await ev(() => { const W = __k.story.debug.W, p = __k.game.p.pos, tip = W.rodTip.getWorldPosition(new __k.THREE.Vector3()), fw = [Math.sin(__k.game.p.yaw), Math.cos(__k.game.p.yaw)];
  return W.rod.visible && tip.y > 1.6 && (tip.x - p.x) * fw[0] + (tip.z - p.z) * fw[1] > 0.3; }), 'fishing: a bamboo rod in hand, raised out over the water');
{ const d0 = await ev(() => { const m = new __k.THREE.Matrix4(); __k.story.debug.W.ducks.getMatrixAt(0, m); return [m.elements[12], m.elements[14]]; }); await sleep(600);
  const d1 = await ev(() => { const m = new __k.THREE.Matrix4(); __k.story.debug.W.ducks.getMatrixAt(0, m); return [m.elements[12], m.elements[14]]; });
  check(Math.hypot(d1[0] - d0[0], d1[1] - d0[1]) > 0.02, 'ducks paddle round the pond'); }
for (let n = 0; n < 3; n++) { await page.waitForFunction(() => __k.story.debug.fish.st === 'idle', { timeout: 60000 }); await tap(); await page.waitForFunction(() => __k.story.debug.fish.st === 'bite', { timeout: 60000, polling: 'raf' }); if (n === 0) { await shot('06-bite');
    check(await ev(() => { const W = __k.story.debug.W, f = W.float.position, l = W.line.geometry.attributes.position, tip = W.rodTip.getWorldPosition(new __k.THREE.Vector3());
      return W.line.visible && Math.hypot(l.getX(9) - f.x, l.getZ(9) - f.z) < 0.05 && Math.hypot(l.getX(0) - tip.x, l.getZ(0) - tip.z) < 0.05 && W.ripples.some(q => q.t < 1.6); }), 'fishing: the line runs from the rod tip to the float, and the water ripples'); } await tap(); await sleep(300); if (n === 0) await shot('07-catch'); }
check(await ev(() => window.__fishCine > 0), 'fishing: landing a fish gets a slow-motion shot');
await mode('walk'); await page.waitForFunction(() => __k.story.debug.W.catchIM.count >= 3, { timeout: 30000 }).catch(() => {}); check(await ev(() => { const d = __k.story.debug, W = d.W; return W.catchIM.visible && W.catchIM.count === Math.min(6, d.save.td.fishN) && d.save.td.fishN >= 3 && Math.hypot(W.basket.x - __k.game.p.pos.x, W.basket.z - __k.game.p.pos.z) < 2; }), 'fishing: the fish you land lie in the basket beside you, and stay for the day'); await shot('05b-basket');
await mode('walk'); check(await ev(() => __k.story.debug.fish.got) >= 3 && await ev(() => __k.story.debug.save.td.fish) === 1, 'fishing: 3 fish counts for the day');
// three houses
for (let h = 0; h < 3; h++) { const j = await ev((h) => { const hs = __k.houses[[2, 5, 8][h]], f = hs.d / 2 + 1.1; const p = [hs.x + Math.sin(hs.rot) * f, hs.z + Math.cos(hs.rot) * f]; __k.game.p.pos.set(p[0], 0, p[1]); return p; }, h);
  await near('SING'); if (h === 0) await shot('08-door'); await act(); await mode('echo'); await page.waitForFunction(() => __k.story.debug.echo.ph === 'input', { timeout: 60000 }); if (h === 0) await shot('09-echo');
  const seq = await ev(() => __k.story.debug.echo.seq); for (const l of seq) { await ev((l) => __k.story.debug.strike(l), l); await sleep(250); } await mode('walk'); await sleep(400); }
check(await ev(() => { const t = __k.story.debug.save.td; return t.jale === 1 && t.jv.every(v => v === 1); }), 'singing at all 3 houses counts for the day'); check((HI ? /तामाक/ : /tamak/).test(await page.$eval('#objText', e => e.textContent)), 'objective moves on to the tamak'); await shot('10-after');
// Hindi
await page.keyboard.press('Escape'); await sleep(400); if (!HI) await ev(() => document.getElementById('langBtn').click()); await shot('11-pause'); await ev(() => document.getElementById('resumeBtn').click()); await sleep(600);
check(/[\u0900-\u097F]/.test(await page.$eval('#objText', e => e.textContent)), 'Hindi: objective is in Devanagari'); await ev(() => __k.story.debug.say([['x', 'y']])); await ev(() => { const d = __k.story.debug; d.S.dlg = null; document.getElementById('dlg').hidden = true; });
await ev(() => { const h = __k.houses[0]; __k.game.p.pos.set(h.x + Math.sin(h.rot) * (h.d / 2 + 1), 0, h.z + Math.cos(h.rot) * (h.d / 2 + 1)); }); await near('ENTER'); await shot('12-hindi'); check(await page.$eval('#actBtn', e => e.textContent) === 'अंदर', 'Hindi: action button reads अंदर');
// quit: horns back to normal, menu label
await page.keyboard.press('Escape'); await sleep(300); await ev(() => document.getElementById('quitBtn').click()); await sleep(800); check(await ev(() => __k.game.mode) === 'menu' && /3\/4/.test(await page.$eval('#playSub', e => e.textContent)), 'quit returns to menu showing 3/4 done today');
if (HI) { const l = await latinSeen(page); check(!l.length, 'Hindi: no English on screen' + (l.length ? ':\n    ' + l.join('\n    ') : '')); }
{ const e = realErrors(logs); check(!e.length, 'no page errors' + (e.length ? ': ' + e.slice(0, 5).join(' | ') : '')); }
await finish(browser);
