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
await page.waitForFunction(() => document.getElementById('startBtn').dataset.village === 'ready', { timeout: 90000 });
const ev = (f, ...a) => page.evaluate(f, ...a);
const until = (f, ms = 15000, ...a) => page.waitForFunction(f, { timeout: ms, polling: 50 }, ...a).then(() => true, () => false);
const shot = n => page.screenshot({ path: `tests/out/ring-${n}.jpg`, type: 'jpeg', quality: 70 });
await ev(() => document.getElementById('quickBtn').click());
check(await until(() => __k.game.mode === 'play'), 'START puts you in the ring');
check(await ev(() => __k.game.lives === 3 && document.querySelectorAll('#lamps svg:not(.out)').length === 3), 'three lit lamps at the start');
await ev(() => { __k.hs.next = 999; }); // keep the handi for its own check
// accessories ride their bones: while running, the gamchha's end keeps its distance to the Torso bone while the bone moves
{ const probe = () => ev(() => { const T = __k.THREE, m = __k.player.body, part = __k.player.mats.Gamchha && __k.player.mats.Gamchha.part; if (!part) return null; __k.player.wrap.updateMatrixWorld(true); m.skeleton.update(); // every bone fresh: on a slow runner no frame may have run since the mixer step
    const v = new T.Vector3(); m.getVertexPosition(part.start + part.count - 1, v); m.localToWorld(v); const b = m.skeleton.bones.find(x => x.name === 'Torso').getWorldPosition(new T.Vector3()); return { d: v.distanceTo(b), b: b.toArray() }; });
  // the animation is stepped here, not by waiting: a GPU-less CI runner may draw no frame at all in 170 ms
  await ev(() => { __k.player.play('Run', { fade: 0 }); __k.player.mixer.update(0.25); }); const a1 = await probe(); await ev(() => __k.player.mixer.update(0.17)); const a2 = await probe();
  check(!!a1 && Math.abs(a1.d - a2.d) < 0.01 && Math.hypot(a1.b[0] - a2.b[0], a1.b[1] - a2.b[1], a1.b[2] - a2.b[2]) > 0.002, `accessories move with the body (gamchha ${a1 && a1.d.toFixed(3)} then ${a2 && a2.d.toFixed(3)} m from the torso; torso moved ${a1 && a2 && Math.hypot(a1.b[0] - a2.b[0], a1.b[1] - a2.b[1], a1.b[2] - a2.b[2]).toFixed(3)} m)`);
  await ev(() => { __k.player.play('Idle'); }); }

// the bull's own details: vermilion once decorated, eyes redden with fury, dust on the hooves after charges, tail stays sane
{ const hex = (k) => ev((k) => { const m = __k.bull.mats[k], c = __k.bull.body.geometry.attributes.color; return m && m.part ? [0, 1, 2].map(j => c.getComponent(m.part.start, j)) : null; }, k);
  const s0 = await hex('Sindur'), e0 = await hex('Eye_White'), h0 = await hex('Hooves');
  check(!!s0 && s0[0] > 0.4 && s0[1] < 0.1 && s0[0] > s0[1] * 5, 'the decorated bull has a vermilion mark on his forehead');
  await ev(() => { __k.game.score = 30; __k.game.charges = 9; }); await sleep(400);
  const e1 = await hex('Eye_White'), h1 = await hex('Hooves');
  check(e1[1] < e0[1] - 0.15, 'his eyes redden as his fury rises');
  check(Math.abs(h1[0] - h0[0]) + Math.abs(h1[1] - h0[1]) > 0.1, 'his hooves gather dust after charges');
  await ev(() => { __k.game.score = 0; __k.game.charges = 0; });
  await sleep(1500); check(await ev(() => [1, 2, 3, 4, 5].every(i => { const b = __k.bull.root.getObjectByName('Tail' + i); return !b || (Math.abs(b.rotation.x) < 3.2 && Math.abs(b.rotation.z) < 3.2); })), 'the tail swishes without winding up'); }
// the rope: slack lies in the dust when he stands near the post, straight when he leans away at the end of it
{ await ev(() => { const b = __k.game.b; window.__bs = { state: b.state, t: b.t, pos: b.pos.clone(), yaw: b.yaw }; });
  const rope = (x, z, yaw) => ev(async (x, z, yaw) => { const g = __k.game; g.b.state = 'recover'; g.b.t = -99; g.b.pos.set(x, 0, z); g.b.yaw = yaw; await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const r = __k.rope, a = r.geometry.attributes.position, v = new __k.THREE.Vector3(); r.updateMatrixWorld(true); let lo = 9; for (let i = 0; i < a.count; i++) { v.fromBufferAttribute(a, i).applyMatrix4(r.matrixWorld); lo = Math.min(lo, v.y); } return { sag: r.userData.sag, lo }; }, x, z, yaw);
  const s = await rope(-2.5, -1.5, Math.PI / 2), t = await rope(-6.2, 0, -Math.PI / 2);
  check(s.sag > 0.5 && s.lo > -0.01 && s.lo < 0.1, `slack rope hangs into the dust, never through it (sag ${s.sag.toFixed(2)}, lowest ${s.lo.toFixed(2)} m)`);
  check(t.sag < 0.05, `the rope goes straight when he pulls on it (sag ${t.sag.toFixed(2)})`);
  // the snap twang, stepped at 120 Hz (an A34 can run that fast): pulled from slack to taut at charge speed it must fire
  check(await ev(() => { const r = __k.rope, dt = 1 / 120; r.userData.len = 0; let fired = 0, L = 5.2; __k.bendRope(L, 0.75, 1.18, dt);
    while (L < 6.95) { L += 6 * dt; __k.bendRope(L, 0.75, 1.18, dt); if (r.userData.twang > 0.95) fired++; } const slow = []; r.userData.twang = 0; r.userData.len = 0; L = 5.2;
    while (L < 6.95) { L += 0.5 * dt; __k.bendRope(L, 0.75, 1.18, dt); slow.push(r.userData.twang); } return fired >= 1 && Math.max(...slow) === 0; }), 'the rope twangs when snapped tight at 120 Hz, not when he leans on it slowly');
  // budget phones: whichever spectators survive thinning (the lowest indices) stand where the camera looks
  check(await ev(() => __k.QUALITY !== 0 || __k.crowd.slice(0, 3).every(c => { const a = Math.atan2(c.home.z, c.home.x); return Math.abs(a + Math.PI / 2) < 0.9; })), 'a thinned crowd stays in the middle of the view');
  await ev(() => { const b = __k.game.b, o = window.__bs; b.state = o.state; b.t = o.t; b.pos.copy(o.pos); b.yaw = o.yaw; }); }
// grab at the post
await ev(() => { __k.game.p.pos.set(0, 0, 1.0); __k.game.p.state = 'free'; __k.input.grab = true; });
check(await until(() => __k.game.pitha === 1 && __k.game.score > 0, 4000), 'GRAB at the post takes a pitha and scores');
check(await until(() => __k.life && __k.life.active().petals, 2000), 'marigold petals rain on a snatch');
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
check(await until(() => __k.life && __k.game.b.state === 'windup' && __k.life.active().breath, 12000), 'the bull snorts: breath puffs while he winds up');
check(await until(() => __k.crowd.some(c => c.curName === 'RecieveHit'), 2000), 'the crowd flinches when he winds up');
check(await ev(() => { const b = __k.game.b.pos; return __k.crowd.filter(c => !c.busy && c.homeYaw !== undefined).every(c => { const d = c.wrap.rotation.y - c.homeYaw, off = Math.atan2(Math.sin(d), Math.cos(d)); return Math.abs(off) <= 1.06; })
  && __k.crowd.filter(c => !c.busy && c.homeYaw !== undefined).some(c => { const want = Math.atan2(b.x - c.wrap.position.x, b.z - c.wrap.position.z), d = c.wrap.rotation.y - c.homeYaw, w2 = want - c.homeYaw; return Math.abs(Math.atan2(Math.sin(d), Math.cos(d))) > 0.05 && Math.sign(Math.atan2(Math.sin(d), Math.cos(d))) === Math.sign(Math.atan2(Math.sin(w2), Math.cos(w2))); }); }), 'spectators turn to watch the bull, never more than 60 degrees from their spot');
const charged = await until(() => __k.game.b.state === 'charge', 12000);
await until(() => __k.game.b.state !== 'charge', 6000); await sleep(300);
check(charged && await ev(() => window.__rolled > 0), 'the bull charged and the player rolled');
check(await ev(() => __k.life.active().prints), 'the charge leaves hoof prints in the dust');
check(await ev((n) => __k.game.lives === n, before), 'a well-timed ROLL dodges the charge');
await ev(() => { window.__rolled = 99; }); // switch the perfect dodger off, or on a slow runner it keeps rolling out of the hits below

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
