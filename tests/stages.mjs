// Ring stages (solo): every few pitha the bull learns a move. Stage 2 feints, stage 3 may charge twice, stage 4 bends
// his charge toward you; each stage is announced with a banner and a handi; the story finale and stage 1 are unchanged.
//   node tests/stages.mjs     (static server on 8791)
import puppeteer from 'puppeteer';
import fs from 'fs'; fs.mkdirSync('tests/out', { recursive: true });
import { check, finish, realErrors, SW } from './check.mjs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ protocolTimeout: 180000, args: [...SW, '--no-sandbox', '--mute-audio'] });
const page = await browser.newPage(), logs = []; page.on('pageerror', e => logs.push(e.message));
await page.emulate({ viewport: { width: 390, height: 780, deviceScaleFactor: 1, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-A346E) Mobile' });
await page.evaluateOnNewDocument(() => { localStorage.setItem('khuntau-played', '1'); localStorage.setItem('khuntau-name', 'Stage Test'); });
await page.goto('http://127.0.0.1:8791/?debug&q=low', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => document.getElementById('startBtn').dataset.village === 'ready', { timeout: 90000 });
const ev = (f, ...a) => page.evaluate(f, ...a);
const until = (f, ms = 30000, ...a) => page.waitForFunction(f, { timeout: ms, polling: 50 }, ...a).then(() => true, () => false);
await ev(() => document.getElementById('quickBtn').click()); await until(() => __k.game.mode === 'play');
// the player cannot be hurt and the handi stays out of the way while we watch the bull
const safe = () => ev(() => { const g = __k.game; g.p.invuln = 999; g.p.state = 'free'; });
await ev(() => { __k.hs.next = 999; window.__rnd = Math.random; }); await safe();
check(await ev(() => __k.stageOf(0) === 1 && __k.stageOf(5) === 2 && __k.stageOf(10) === 3 && __k.stageOf(16) === 4 && __k.stageOf(24) === 5 && (__k.game.stage || 1) === 1), 'stages are reached by 5, 10, 16 and 24 pitha points');
// stage 1: no feint even when the dice say yes
await ev(() => { Math.random = () => 0.01; const g = __k.game; g.charges = 2; g.feints = 0; g.p.pos.set(0, 0, 5); g.b.pos.set(0, 0, -4); g.b.state = 'watch'; g.b.t = 9; });
await until(() => __k.game.b.state === 'charge'); check(await ev(() => (__k.game.feints || 0) === 0), 'stage 1: the bull never feints');
// reach stage 2: banner, handi thrown in
await ev(() => { Math.random = window.__rnd; }); await until(() => __k.game.b.state === 'watch' || __k.game.b.state === 'stunned' || __k.game.b.state === 'recover');
await ev(() => { __k.hs.next = 30; __k.award(5, 'test'); });
check(await until(() => document.getElementById('stageBanner').classList.contains('show') && /Stage 2/.test(document.getElementById('stageBanner').textContent), 8000), 'reaching 5 points announces Stage 2 with a banner');
await sleep(300); await page.screenshot({ path: 'tests/out/stage-2.jpg', type: 'jpeg', quality: 70 });
check(await ev(() => __k.game.stage === 2 && (__k.hs.on || __k.hs.next <= 1.3)), 'and a handi is thrown in for the brave');
// stage 2: the feint (a second, short windup before the real charge)
await safe(); await ev(() => { __k.hs.next = 999; Math.random = () => 0.01; const g = __k.game; g.feints = 0; g.p.pos.set(0, 0, 5); g.b.pos.set(0, 0, -4); g.b.state = 'watch'; g.b.t = 9; g.b.feinted = false; g.b.again = false; });
check(await until(() => __k.game.feints === 1 && __k.game.b.state === 'windup'), 'stage 2: he feints (lunges, stops, winds up again)');
check(await until(() => __k.game.b.state === 'charge', 8000) && await ev(() => __k.game.feints === 1), 'then the real charge comes (one feint, not a loop)');
// stage 3: twice
await ev(() => { Math.random = window.__rnd; __k.award(5, 'test'); }); await until(() => __k.game.stage === 3, 8000);
await safe(); await ev(() => { Math.random = () => 0.01; const g = __k.game; g.doubles = 0; g.p.pos.set(4, 0, 3); g.b.pos.set(-3, 0, -3); g.b.state = 'watch'; g.b.t = 9; g.b.feinted = true; g.b.again = false; });
check(await until(() => __k.game.doubles === 1), 'stage 3: after a missed charge he wheels round and comes straight back');
check(await ev(async () => { const g = __k.game; for (let i = 0; i < 800 && (g.b.state === 'windup' || g.b.state === 'charge'); i++) await new Promise(r => setTimeout(r, 15)); return g.doubles === 1 && ['stunned', 'recover', 'watch'].includes(g.b.state); }), 'only once: the second charge ends normally');
// stage 4: the hunter bends his charge toward you
await ev(() => { Math.random = window.__rnd; __k.award(6, 'test'); }); await until(() => __k.game.stage === 4, 8000);
await safe(); const bend = await ev(async () => { Math.random = () => 0.99; const g = __k.game; g.p.pos.set(0, 0, 5.5); g.b.pos.set(0, 0, -5.5); g.b.state = 'watch'; g.b.t = 9; g.b.feinted = true; g.b.again = true;
  for (let i = 0; i < 400 && g.b.state !== 'charge'; i++) await new Promise(r => setTimeout(r, 25)); const d0 = Math.atan2(g.b.dir.x, g.b.dir.z); g.p.pos.set(4.5, 0, 3); g.p.vel.set(0, 0, 0);
  let turned = 0; for (let i = 0; i < 40 && g.b.state === 'charge'; i++) { await new Promise(r => setTimeout(r, 25)); turned = Math.max(turned, Math.atan2(g.b.dir.x, g.b.dir.z) - d0); } return turned; });
check(bend > 0.08, `stage 4: his charge bends toward you after you sidestep (${bend.toFixed(2)} rad)`);
// game over tells you how far you got
await ev(() => { Math.random = window.__rnd; const g = __k.game; g.p.invuln = 0; g.lives = 1; __k.hs.next = 999; });
await ev(() => __k.gameOver ? __k.gameOver() : null);
check(await until(() => __k.game.mode === 'over' && /stage 4/i.test(document.getElementById('overLine').textContent), 20000), `the results say which stage you reached (${await page.$eval('#overLine', e => e.textContent)})`);
// a new round starts back at stage 1
await until(() => !document.getElementById('overScreen').hidden && !document.getElementById('againBtn').disabled, 15000); await ev(() => document.getElementById('againBtn').click()); await until(() => __k.game.mode === 'play', 10000);
check(await ev(() => (__k.game.stage || 1) === 1), 'a new round starts at stage 1');
check(!realErrors(logs).length, 'no page errors ' + realErrors(logs).join(' | ')); await finish(browser);
