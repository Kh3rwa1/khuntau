// Hul (hul/index.html, its own site): the stealth archery game. Run against the built site:
//   node tools/hul-build.mjs && ROOT=hul/dist PORT=8792 node tests/serve.mjs &  then  npm run test:hul   (or pass another base URL)
// Boots on a phone (portrait + landscape) and a laptop, then plays:
// real mouse holds and releases shoot arrows; real touch hold-drag-release on BOW shoots; E does the takedown and burns the store.
// Aiming is chosen by turning the camera toward a soldier (a helper, like a player's eye); everything else goes through the controls.
// Rule checks that need a set-up state (patrol at the village gate, standing behind a soldier, at the store) are labelled "set-up".
import puppeteer from 'puppeteer';
import { check, finish, realErrors, SW } from './check.mjs';
import fs from 'fs'; fs.mkdirSync('tests/out', { recursive: true }); // a fresh checkout has no tests/out (gitignored)
const BASE = process.argv[2] || 'http://127.0.0.1:8792';
const browser = await puppeteer.launch({ protocolTimeout: 180000, args: [...SW, '--no-sandbox', '--mute-audio'] });
const sleep = ms => new Promise(r => setTimeout(r, ms));
// wait in game time: a software-rendered runner draws a few frames a second and the game caps each frame's step
const gwait = async (page, sec) => { const t0 = await page.evaluate(() => __h.G.t); await page.waitForFunction((t0, sec) => __h.G.t - t0 >= sec || __h.G.mode !== 'play', { timeout: 120000, polling: 50 }, t0, sec); };
async function open(w, h, touch, q = '') {
  const page = await browser.newPage(); await page.setViewport({ width: w, height: h, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 });
  const logs = []; page.on('pageerror', e => logs.push('pageerror ' + e.message)); page.on('console', m => { if (m.type() === 'error') logs.push(m.text()); });
  await page.goto(BASE + '/?debug&nolock' + q, { waitUntil: 'load' });
  await page.waitForFunction(() => !document.getElementById('play').disabled, { timeout: 90000 });
  return { page, logs };
}
const state = page => page.evaluate(() => { const h = __h, p = h.player; return { mode: h.G.mode, stage: h.G.stage, arrows: p.arrows, hp: p.hp, st: p.st, ...h.G.stats, left: h.enemies.filter(e => (e.role === 'redcoat' || e.role === 'sepoy') && !e.sentry && !e.dead).length, obj: document.getElementById('objT').textContent, calls: h.renderer.info.render.calls }; });
// turn the camera so the crosshair sits on the nearest living soldier's head (repeat: the camera moves with the yaw)
const aimAt = (page, role = 'soldier') => page.evaluate(async (role) => { const h = __h; let tgt = null;
  for (let k = 0; k < 6; k++) { const c = h.camera.position, list = h.enemies.filter(e => !e.dead && !e.gone && (role === 'porter' ? e.role === 'porter' : e.role !== 'porter') && !e.sentry);
    list.sort((a, b) => a.pos.distanceTo(h.player.pos) - b.pos.distanceTo(h.player.pos)); tgt = list[0]; if (!tgt) return null;
    const hd = tgt.b[role === 'porter' ? 'Torso' : 'Head'].getWorldPosition(c.clone()); if (role !== 'porter') hd.y += 0.08; const d = hd.sub(c); h.cam.yaw = Math.atan2(-d.x, -d.z); h.cam.pitch = -Math.atan2(d.y, Math.hypot(d.x, d.z));
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); }
  return tgt.id; }, role);

// ---------- laptop ----------
{
  const { page, logs } = await open(1280, 720, false);
  await page.screenshot({ path: 'tests/out/hul-lap-title.jpg', quality: 75 });
  await page.click('#play'); await sleep(1500);
  let s = await state(page);
  check(s.mode === 'play' && s.stage === 1 && s.left === 5 && s.arrows === 12, `laptop: game starts (5 soldiers, 12 arrows): ${JSON.stringify({ mode: s.mode, left: s.left, arrows: s.arrows })}`);
  check(await page.evaluate(() => __h.player.crouch && __h.BUSHES.some(b => Math.hypot(b.x - __h.player.pos.x, b.z - __h.player.pos.z) < b.r * 0.9)), 'starts crouched inside a bush');
  check(await page.evaluate(() => { const p = __h.player, f = p.bone('FootL').getWorldPosition(p.pos.clone()); return Math.abs(f.y - p.pos.y) < 0.12; }), 'crouched: feet on the ground, not sunk or floating');
  check(await page.evaluate(() => getComputedStyle(document.getElementById('eye')).borderColor) !== '', 'detection eye shown');
  await page.screenshot({ path: 'tests/out/hul-lap-start.jpg', quality: 75 });
  // walk with real keys: W moves her toward where the camera looks
  const p0 = await page.evaluate(() => __h.player.pos.toArray());
  await page.keyboard.down('KeyW'); await gwait(page, 0.9); await page.keyboard.up('KeyW');
  const p1 = await page.evaluate(() => __h.player.pos.toArray());
  check(Math.hypot(p1[0] - p0[0], p1[2] - p0[2]) > 0.6, `W walks (${Math.hypot(p1[0] - p0[0], p1[2] - p0[2]).toFixed(2)} m)`);
  // a short tap does not loose an arrow (too little draw)
  await page.mouse.move(640, 360); await page.mouse.down(); await sleep(120); await page.mouse.up(); await sleep(200);
  s = await state(page); check(s.shots === 0 && s.arrows === 12, 'a quick click is not a shot (draw too short)');
  // shoot soldiers: hold to draw, release
  let shots = 0; await page.evaluate(() => { __h.G.god = true; }); // set-up: the test aims but does not roll or hide, so musket hits are switched off here
  for (let k = 0; k < 16 && (await state(page)).left > 0 && (await state(page)).mode === 'play'; k++) {
    // like a player: wait for a clear line to him (no trunk in between) before drawing
    let clear = false; for (let w = 0; w < 30 && !clear; w++) { if (!(await aimAt(page))) break; clear = await page.evaluate(() => { const r = __h.aimProbe(); return r === 'redcoat' || r === 'sepoy'; }); if (!clear) { if (w % 3 === 2) { await page.keyboard.down('KeyW'); await gwait(page, 1.0); await page.keyboard.up('KeyW'); } else await gwait(page, 0.8); } } // no clear line: wait, then walk toward him like a player would
    if (!clear) break;
    await page.mouse.down(); await sleep(150); if (k === 0) await page.screenshot({ path: 'tests/out/hul-lap-draw0.jpg', quality: 75 });
    await gwait(page, 0.75); await aimAt(page); if (k === 0) { await page.screenshot({ path: 'tests/out/hul-lap-aim.jpg', quality: 75 }); check(await page.evaluate(() => document.getElementById('xh').classList.contains('on')), 'crosshair turns red on a soldier'); }
    await page.mouse.up(); shots++; await gwait(page, 1.4);
    if (k === 0) { s = await state(page); check(s.shots === 1 && s.arrows === 11, `release shoots one arrow (${s.shots} shot, ${s.arrows} left)`);  await page.screenshot({ path: 'tests/out/hul-lap-hit.jpg', quality: 75 }); }
  }
  s = await state(page);
  check(s.hits / s.shots >= 0.7, `aimed arrows on a clear line mostly hit (${s.hits}/${s.shots}; the bow sways, so not all)`);
  await page.evaluate(() => { __h.G.god = false; });
  if (s.left) console.log('mode', s.mode, 'hp', s.hp, 'arrow log', JSON.stringify(await page.evaluate(() => __h.G.log)));
  check(s.left === 0, `the patrol is stopped by arrows (${s.left} left after ${shots} shots, ${s.hits} hits, ${s.heads} head shots)`);
  check(s.stage === 2 && /store/i.test(s.obj), `objective moves to the store: "${s.obj}"`);
  check(s.calls < 70, `draw calls in play: ${s.calls} (< 70)`);
  await page.screenshot({ path: 'tests/out/hul-lap-stage2.jpg', quality: 75 });
  // arrows lying around are picked up by walking over them
  const before = s.arrows; const got = await page.evaluate(async () => { const h = __h; const st = h.player; return st.arrows; });
  // the store: set-up (walk there is long), then hold E
  await page.evaluate(() => { const h = __h, p = h.player; for (const e of h.enemies) if (e.sentry) h.kill(e); p.pos.set(h.STORE.x, 0, h.STORE.z + 3.2); p.pos.y = h.H(p.pos.x, p.pos.z); });
  await sleep(300);
  check(await page.evaluate(() => __h.actOption()?.kind) === 'burn', 'at the store the action is BURN');
  await page.keyboard.down('KeyE'); await gwait(page, 0.6); s = await state(page); check(s.mode === 'play', 'burning takes a held E, not a tap');
  await gwait(page, 1.4); await page.keyboard.up('KeyE'); await sleep(300);
  s = await state(page); check(s.mode === 'end' && s.stage === 3, `holding E burns the store and wins (${s.mode}, stage ${s.stage})`);
  await sleep(3200);
  check(await page.evaluate(() => !document.getElementById('endScr').hidden && /Hul/.test(document.getElementById('endH').textContent)), 'win screen with stats');
  await page.screenshot({ path: 'tests/out/hul-lap-win.jpg', quality: 75 });
  // play again resets everything
  await page.evaluate(() => { document.getElementById('endScr').hidden = false; }); await page.click('#again'); await sleep(800); s = await state(page);
  check(s.mode === 'play' && s.left === 5 && s.arrows === 12 && s.shots === 0 && s.hp === 100, 'play again: fresh patrol, arrows, health, stats');
  check(await page.evaluate(() => __h.enemies.length) === 9, 'no leftover people after restart (7 in the column + 2 sentries)');
  // a porter hit by an arrow runs home; it costs score, and he is not killed
  await page.evaluate(() => { const h = __h, p = h.player, e = h.enemies.find(x => x.role === 'porter'); p.pos.set(e.pos.x + 7, 0, e.pos.z + 3); p.pos.y = h.H(p.pos.x, p.pos.z); });
  await gwait(page, 0.2); for (let w = 0; w < 10; w++) { await aimAt(page, 'porter'); if (await page.evaluate(() => __h.aimProbe() === 'porter')) break; await gwait(page, 0.5); } await page.mouse.down(); await gwait(page, 0.75); await aimAt(page, 'porter'); await page.mouse.up(); await gwait(page, 1.2);
  s = await state(page); check(s.porterHit === 1 && s.hits === 0, `an arrow at a porter: counted as a porter hit, not a kill (${s.porterHit}, hits ${s.hits})`);
  check(await page.evaluate(() => __h.enemies.some(e => e.role === 'porter' && (e.fleeing || e.gone))), 'the porter who was hit runs for home');
  // set-up: stand behind a marching soldier; E is a silent takedown
  const take = await page.evaluate(async () => { const h = __h, e = h.enemies.find(x => x.role === 'redcoat' && !x.sentry), p = h.player;
    p.pos.set(e.pos.x - Math.sin(e.head) * 1.3, 0, e.pos.z - Math.cos(e.head) * 1.3); p.pos.y = h.H(p.pos.x, p.pos.z); p.crouch = true; await new Promise(r => setTimeout(r, 120)); return h.actOption()?.kind; });
  check(take === 'takedown', `behind an unaware soldier the action is TAKEDOWN (${take})`);
  await page.keyboard.press('KeyE'); await gwait(page, 0.9); s = await state(page);
  check(s.takedowns === 1 && s.left === 4, `E: tangi takedown (${s.takedowns} takedowns, ${s.left} left)`);
  // pause on Escape freezes the game; resume continues
  await page.keyboard.press('Escape'); await sleep(200); const t0 = await page.evaluate(() => __h.G.t); await sleep(600);
  check(await page.evaluate(t0 => __h.G.mode === 'pause' && __h.G.t === t0, t0), 'Escape pauses (time stops)');
  await page.click('#resume'); await sleep(300); check(await page.evaluate(() => __h.G.mode) === 'play', 'resume');
  // set-up: the patrol reaches the village gate -> lost
  await page.evaluate(() => { const h = __h; for (const e of h.enemies) if (!e.dead && !e.sentry && e.role !== 'porter') { e.state = 'march'; e.sus = 0; e.s = h.GOAL_S + 0.05; } });
  await gwait(page, 1); s = await state(page); check(s.mode === 'end', 'a soldier at the village gate ends the round');
  await sleep(2600); check(await page.evaluate(() => /village/.test(document.getElementById('endH').textContent)), 'lose screen says they reached the village');
  check(realErrors(logs).length === 0, 'laptop: no page errors ' + realErrors(logs).join(' | '));
  await page.close();
}

// ---------- phone, portrait and landscape ----------
for (const [w, h, tag] of [[390, 800, 'p'], [800, 390, 'l']]) {
  const { page, logs } = await open(w, h, true);
  await page.screenshot({ path: `tests/out/hul-${tag}-title.jpg`, quality: 75 });
  await page.tap('#play'); await sleep(1500);
  await page.screenshot({ path: `tests/out/hul-${tag}-start.jpg`, quality: 75 });
  // nothing overlaps: buttons, bars, weapon slots, objective
  const boxes = await page.evaluate(() => Object.fromEntries(['bFire', 'bAct', 'bCrouch', 'bRoll', 'weap', 'vit', 'obj', 'pause'].map(id => { const r = document.getElementById(id).getBoundingClientRect(); return [id, [r.left, r.top, r.right, r.bottom]]; })));
  const ov = []; const ids = Object.keys(boxes); for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) { const a = boxes[ids[i]], b = boxes[ids[j]]; if (a[0] < b[2] - 2 && b[0] < a[2] - 2 && a[1] < b[3] - 2 && b[1] < a[3] - 2) ov.push(ids[i] + '/' + ids[j]); }
  check(ov.length === 0, `${tag}: controls and HUD do not overlap ${ov.join(' ')}`);
  check(Object.values(boxes).every(b => b[0] >= 0 && b[1] >= 0 && b[2] <= w + 1 && b[3] <= h + 1), `${tag}: everything on screen`);
  // stick: touch the left side and drag up -> she moves
  const p0 = await page.evaluate(() => __h.player.pos.toArray());
  const cdp = await page.createCDPSession();
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id })) });
  await touch('touchStart', [[w * 0.2, h * 0.75, 1]]); for (let k = 1; k <= 6; k++) { await touch('touchMove', [[w * 0.2, h * 0.75 - k * 8, 1]]); await sleep(40); } await gwait(page, 0.9); await touch('touchEnd', []);
  const p1 = await page.evaluate(() => __h.player.pos.toArray());
  check(Math.hypot(p1[0] - p0[0], p1[2] - p0[2]) > 0.5, `${tag}: the stick walks (${Math.hypot(p1[0] - p0[0], p1[2] - p0[2]).toFixed(2)} m)`);
  // right side drag turns the camera
  const y0 = await page.evaluate(() => __h.cam.yaw);
  await touch('touchStart', [[w * 0.6, h * 0.35, 2]]); for (let k = 1; k <= 5; k++) { await touch('touchMove', [[w * 0.6 + k * 12, h * 0.35, 2]]); await sleep(30); } await touch('touchEnd', []);
  check(Math.abs((await page.evaluate(() => __h.cam.yaw)) - y0) > 0.1, `${tag}: dragging the right side turns the view`);
  // BOW: hold, drag (aims), let go = shot
  await aimAt(page); const b = boxes.bFire, bx = (b[0] + b[2]) / 2, by = (b[1] + b[3]) / 2;
  await touch('touchStart', [[bx, by, 3]]); await gwait(page, 0.2);
  const aiming = await page.evaluate(() => __h.player.aiming); const yawA = await page.evaluate(() => __h.cam.yaw);
  await touch('touchMove', [[bx - 10, by, 3]]); await sleep(60); await touch('touchMove', [[bx - 20, by, 3]]); await sleep(60);
  const yawB = await page.evaluate(() => __h.cam.yaw);
  await page.screenshot({ path: `tests/out/hul-${tag}-aim.jpg`, quality: 75 });
  await gwait(page, 0.6); await touch('touchEnd', []); await sleep(300);
  const s = await state(page);
  check(aiming, `${tag}: holding BOW draws the bow`); check(Math.abs(yawB - yawA) > 0.02, `${tag}: dragging the held BOW moves the aim`);
  check(s.shots === 1 && s.arrows === 11, `${tag}: letting go of BOW shoots (${s.shots} shots, ${s.arrows} arrows)`);
  // weapon switch by tapping the tangi slot; BOW button becomes TANGI
  await page.tap('#sAxe'); await sleep(150);
  check(await page.evaluate(() => __h.player.weapon === 'tangi' && document.getElementById('bFire').textContent === 'TANGI'), `${tag}: tapping the tangi slot switches weapon`);
  await page.tap('#bRoll'); await sleep(100); check(await page.evaluate(() => __h.player.roll > 0), `${tag}: ROLL rolls`);
  await sleep(900);
  check(realErrors(logs).length === 0, `${tag}: no page errors ` + realErrors(logs).join(' | '));
  await page.close();
}
await finish(browser);
