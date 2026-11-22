import puppeteer from 'puppeteer';
import fs from 'fs'; import { check, finish } from './check.mjs';
// Draw-call budget per view at q=low (a budget phone dies on draw calls, not triangles). Raise only on purpose.
const BUDGET = { ring: 56, yard: 38, akhra: 80, edge: 64, gohal: 52, pond: 64, stall: 84 }; // stall: the whole village seen from its outskirts, the busiest view
const within = (name, i) => check(i.calls <= BUDGET[name], `${name}: ${i.calls} draw calls (budget ${BUDGET[name]}), ${i.tris} triangles`); fs.mkdirSync('tests/out', { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ protocolTimeout: 180000, args: [...(process.env.SWGL ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : []), '--no-sandbox', '--mute-audio'] });
const page = await browser.newPage(); const logs = []; page.on('pageerror', e => logs.push(e.message));
await page.emulate({ viewport: { width: 390, height: 780, deviceScaleFactor: 1, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (Linux; Android 13) Mobile' });
await page.evaluateOnNewDocument(() => { localStorage.setItem('khuntau-story', JSON.stringify({ ch: 3, painted: [1, 1, 1], chosen: 1, oiled: 1, garland: 1 })); });
await page.goto('http://127.0.0.1:8791/?debug&q=low', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => document.getElementById('startBtn').dataset.village === 'ready', { timeout: 90000 });
const info = () => page.evaluate(() => ({ calls: __k.renderer.info.render.calls, tris: __k.renderer.info.render.triangles }));
await page.evaluate(() => document.getElementById('quickBtn').click()); await sleep(3000); within('ring', await info());
// the worst moment, not a quiet frame: a snatch throws sparks, a charge throws dust (each puff was its own draw)
await page.evaluate(() => { const g = __k.game; window.__peak = 0; window.__live = { dust: 0, spark: 0 };
  (function f() { window.__peak = Math.max(window.__peak, __k.renderer.info.render.calls); window.__live.dust = Math.max(window.__live.dust, __k.dustPool.live); window.__live.spark = Math.max(window.__live.spark, __k.sparkPool.live); if (g.mode === 'play') requestAnimationFrame(f); })();
  g.p.pos.set(0, 0, 1.0); g.p.state = 'free'; __k.input.grab = true; });
check(await page.waitForFunction(() => __k.game.pitha === 1, { timeout: 6000 }).then(() => true, () => false), 'peak run: the snatch happened');
await page.waitForFunction(() => __k.game.p.state === 'free', { timeout: 6000 }).catch(() => {});
await page.evaluate(() => { const g = __k.game; g.p.pos.set(3.5, 0, 3.5); g.b.pos.set(3.2, 0, -0.6); g.b.state = 'watch'; g.b.t = 0; __k.input.tease = true; });
check(await page.waitForFunction(() => __k.game.b.state === 'charge', { timeout: 15000 }).then(() => true, () => false), 'peak run: the bull charged');
await sleep(1500);
{ const peak = await page.evaluate(() => window.__peak), live = await page.evaluate(() => window.__live);
  check(live.dust > 3 && live.spark > 3, `peak run: dust (${live.dust}) and sparks (${live.spark}) were in the air`);
  check(peak <= BUDGET.ring, `ring at its busiest: ${peak} draw calls at the peak (budget ${BUDGET.ring})`); }
check(await page.evaluate(() => { let s = 0; __k.scene.traverse(o => { if (o.isSprite) s++; }); return s <= 3 && __k.flames.im.count === 30 && __k.dustPool.im.isInstancedMesh; }), 'diya flames, dust and sparks are batched (no per-puff sprites)');
await page.keyboard.press('Escape'); await sleep(300); await page.evaluate(() => document.getElementById('quitBtn').click()); await sleep(600);
await page.evaluate(() => document.getElementById('startBtn').click()); await sleep(3000); within('yard', await info()); await page.screenshot({ path: 'tests/out/c-yard.jpg', type: 'jpeg', quality: 70 });
await page.evaluate(() => { const d = __k.story.debug; __k.game.p.pos.copy(d.W.drumStand); d.S.camYaw = Math.atan2(d.W.drumStand.x, d.W.drumStand.z); d.snapCam(); }); await sleep(1500); within('akhra', await info());
await page.evaluate(() => { const d = __k.story.debug; __k.game.p.pos.set(0, 0, 13); d.S.camYaw = 0; d.snapCam(); }); await sleep(1500); within('edge', await info());
await page.evaluate(() => { const d = __k.story.debug, g = d.W.gStand; __k.game.p.pos.copy(g); d.S.camYaw = Math.atan2(g.x, g.z); d.snapCam(); }); await sleep(1500); within('gohal', await info()); await page.screenshot({ path: 'tests/out/c-gohal.jpg', type: 'jpeg', quality: 70 });
await page.evaluate(() => { const d = __k.story.debug, a = 0.35 + 0.698132 * 4.5; __k.game.p.pos.set(Math.cos(a) * 20.7, 0, Math.sin(a) * 20.7); d.S.camYaw = a; d.snapCam(); }); await sleep(1500); within('pond', await info()); await page.screenshot({ path: 'tests/out/c-pond.jpg', type: 'jpeg', quality: 70 });
await page.evaluate(() => { const d = __k.story.debug, M = __k.market, [x, z] = M.B(0.4, 2.6 + 2.4); __k.game.p.pos.set(x, 0, z); d.S.camYaw = M.rot + Math.PI; d.snapCam(); /* behind the stall looking back at it and the house (the old spot was inside the house) */ }); await sleep(1500); within('stall', await info()); await page.screenshot({ path: 'tests/out/c-stall.jpg', type: 'jpeg', quality: 70 });
check(!logs.length, 'no page errors ' + logs.join(' | ')); await finish(browser);
