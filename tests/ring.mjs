// The ring game, solo, end to end: grab at the post, bait and get horned, roll out of a charge, handi gives a
// life back, last lamp out ends the run, and the score reaches the daily board.
//   node tests/ring.mjs                          (static server on 8791; board check skipped, /api is 404 there)
//   node tests/ring.mjs http://127.0.0.1:8787    (wrangler dev --local; the score must be accepted)
import puppeteer from 'puppeteer';
import fs from 'fs'; fs.mkdirSync('tests/out', { recursive: true });
import { check, finish, realErrors, SW } from './check.mjs';
const BASE = process.argv[2] || 'http://127.0.0.1:8791', API = BASE.includes('8787');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ protocolTimeout: 180000, args: [...SW, '--no-sandbox', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage(), logs = []; page.on('pageerror', e => logs.push(e.message));
await page.emulate({ viewport: { width: 390, height: 780, deviceScaleFactor: 1, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-A346E) Mobile' });
await page.evaluateOnNewDocument(() => { localStorage.setItem('khuntau-played', '1'); localStorage.setItem('khuntau-name', 'Ring Test'); });
await page.goto(BASE + '/?debug&q=low', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !document.getElementById('storyBtn').disabled, { timeout: 90000 });
const ev = (f, ...a) => page.evaluate(f, ...a);
const until = (f, ms = 15000, ...a) => page.waitForFunction(f, { timeout: ms, polling: 50 }, ...a).then(() => true, () => false);
const shot = n => page.screenshot({ path: `tests/out/ring-${n}.jpg`, type: 'jpeg', quality: 70 });
await ev(() => document.getElementById('startBtn').click());
check(await until(() => __k.game.mode === 'play'), 'START puts you in the ring');
check(await ev(() => __k.game.lives === 3 && document.querySelectorAll('#lamps svg:not(.out)').length === 3), 'three lit lamps at the start');
await ev(() => { __k.hs.next = 999; }); // keep the handi for its own check

// grab at the post
await ev(() => { __k.game.p.pos.set(0, 0, 1.0); __k.game.p.state = 'free'; __k.input.grab = true; });
check(await until(() => __k.game.pitha === 1 && __k.game.score > 0, 4000), 'GRAB at the post takes a pitha and scores');
await shot('1-grab');
await until(() => __k.game.p.state === 'free', 4000);
await ev(() => { __k.game.p.pos.set(0, 0, 1.0); __k.input.grab = true; }); await sleep(300);
check(await ev(() => __k.game.pitha === 1), 'no second pitha until the post refills');

// bait and stand still: horned (the bull is put on a clear line to the player, so the post can't make it circle first)
await ev(() => { const g = __k.game; g.p.pos.set(3.5, 0, 3.5); g.b.pos.set(3.2, 0, -0.6); g.p.state = 'free'; g.p.invuln = 0; g.b.state = 'watch'; g.b.t = 0; __k.input.tease = true; });
check(await until(() => __k.game.lives === 2, 10000), 'HIDE baits a charge; standing still costs a lamp');
await shot('2-hit');
await until(() => __k.game.p.state === 'free' && __k.game.p.invuln <= 0, 6000);

// bait and roll at the last moment: no lamp lost (a perfect player, run inside the page every frame)
const before = await ev(() => __k.game.lives);
await ev(() => { const g = __k.game; g.p.pos.set(-3.5, 0, 3.5); g.b.pos.set(-3.2, 0, -0.6); g.b.state = 'watch'; g.b.t = 0; window.__rolled = 0; __k.input.tease = true;
  (function dodge() { const p = g.p, b = g.b; if (b.state === 'charge' && p.state === 'free' && p.pos.distanceTo(b.pos) < 2.6) { __k.input.roll = true; window.__rolled++; } if (window.__rolled < 4 && g.mode === 'play') requestAnimationFrame(dodge); })(); });
const charged = await until(() => __k.game.b.state === 'charge', 12000);
await until(() => __k.game.b.state !== 'charge', 6000); await sleep(300);
check(charged && await ev(() => window.__rolled > 0), 'the bull charged and the player rolled');
check(await ev((n) => __k.game.lives === n, before), 'a well-timed ROLL dodges the charge');

// handi: a life back
await ev(() => { __k.game.p.pos.set(0, 0, 0.9); __k.game.b.state = 'recover'; __k.game.b.t = 0; __k.hs.next = 0; }); // at the post: a pot never spawns within reach, so it can't be drunk before we look
check(await until(() => __k.hs.on && __k.handi.visible, 3000), 'a handi pot appears');
await ev(() => { const h = __k.handi.position; __k.game.p.pos.set(h.x, 0, h.z); });
check(await until(() => __k.game.lives === 3, 3000), 'running over the handi gives a lamp back');
await shot('3-handi');

// last lamps out: game over screen with the score
for (let i = 0; i < 3; i++) {
  await until(() => __k.game.p.state === 'free' && __k.game.p.invuln <= 0, 6000);
  await ev(() => { const g = __k.game; g.p.pos.set(3.5, 0, -3.5); g.b.pos.set(3.2, 0, 0.6); g.b.state = 'watch'; g.b.t = 0; __k.input.tease = true; });
  await until((n) => __k.game.lives < n, 10000, 3 - i);
}
check(await until(() => __k.game.mode === 'over' && !document.getElementById('overScreen').hidden, 8000), 'losing the last lamp ends the run');
const score = await ev(() => __k.game.score); // near-miss rolls also score, so read it at the end
check(score > 0 && await ev((s) => document.getElementById('overScore').textContent.trim() === String(s), score), `game-over screen shows the score (${score})`);
check(await ev(() => document.querySelectorAll('#lamps svg.out').length === 3), 'all three lamps shown out');
await shot('4-over');
if (API) check(await until((s) => __k.boardData && __k.boardData.me && __k.boardData.me.p === s, 8000, score), 'the score is accepted by the daily board');
if (API) { // the anonymous step counter got this visit: opened, ready time, PLAY, a finished round, a score bucket
  await sleep(6500); const t = Object.values((await (await fetch(BASE + '/api/stats?days=1')).json()).days)[0] || {};
  check(t.open >= 1 && t.play >= 1 && t.round_end >= 1 && Object.keys(t).some(k => k.startsWith('ready.')) && Object.keys(t).some(k => k.startsWith('score.')), 'the game reports its steps to /api/stats'); }
await ev(() => document.getElementById('againBtn').click());
check(await until(() => __k.game.mode === 'play' && __k.game.lives === 3 && __k.game.score === 0), 'PLAY AGAIN starts a fresh run');
{ const e = realErrors(logs); check(!e.length, 'no page errors' + (e.length ? ': ' + e.slice(0, 4).join(' | ') : '')); }
await finish(browser);
