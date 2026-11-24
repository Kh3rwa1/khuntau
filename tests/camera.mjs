// The village camera never ends up with a house, straw stack or tree between it and you. Walking out of a door toward
// the ring, the trailing camera used to land beyond the house with the whole house filling the screen.
// Checked geometrically (house boxes up to the roof ridge, prop circles), independently of the game's own test, at
// every door and at every straw stack, with the camera trailing toward the obstacle. Also: straw stacks are solid.
//   node tests/camera.mjs     (static server on 8791)
import puppeteer from 'puppeteer';
import fs from 'fs'; fs.mkdirSync('tests/out', { recursive: true });
import { check, finish, realErrors, SW } from './check.mjs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ protocolTimeout: 180000, args: [...SW, '--no-sandbox', '--mute-audio'] });
const page = await browser.newPage(), logs = []; page.on('pageerror', e => logs.push(e.message));
await page.emulate({ viewport: { width: 390, height: 780, deviceScaleFactor: 1, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-A346E) Mobile' });
await page.evaluateOnNewDocument(() => { localStorage.setItem('khuntau-name', 'Cam Test'); localStorage.setItem('khuntau-story', JSON.stringify({ ch: 5, done: 1, painted: [1, 1, 1], chosen: 1, oiled: 1, garland: 1 })); });
await page.goto('http://127.0.0.1:8791/?debug&q=low', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => document.getElementById('startBtn').dataset.village === 'ready', { timeout: 90000 });
await page.evaluate(() => document.getElementById('startBtn').click());
await page.waitForFunction(() => __k.game.mode === 'story' && !__k.story.debug.S.inside, { timeout: 20000 });
await page.waitForFunction(() => __k.life, { timeout: 30000 });
await page.evaluate(() => { const d = __k.story.debug; d.S.dlg = null; document.getElementById('dlg').hidden = true; });
// place the player, aim the camera's trailing direction at (tx, tz), let it settle, then test the line head -> camera
const blocked = (px, pz, tx, tz) => page.evaluate(async (px, pz, tx, tz) => {
  const d = __k.story.debug, p = __k.game.p.pos; p.set(px, 0, pz); d.S.camYaw = Math.atan2(tx - px, tz - pz); d.S.lookT = performance.now() / 1000 + 99; d.snapCam();
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const c = __k.camera.position, hits = [];
  for (let i = 2; i <= 9; i++) { const t = i / 10, x = px + (c.x - px) * t, y = 1.4 + (c.y - 1.4) * t, z = pz + (c.z - pz) * t;
    for (const h of __k.houses) { const cs = Math.cos(h.rot), sn = Math.sin(h.rot), dx = x - h.x, dz = z - h.z; const lx = Math.abs(dx * cs - dz * sn), lz = Math.abs(dx * sn + dz * cs);
      const k = y < 2.6 ? 1 : Math.max(0, (4.7 - y) / 2.1) * 1.19; if (y < 4.7 && lx < h.w / 2 * k && lz < h.d / 2 * k) hits.push('house'); }
    for (const o of __k.villageProps) { const dd = Math.hypot(x - o.x, z - o.z); if ((dd < o.r && y < (o.top ?? 2.2)) || (o.cr && y > o.cy && dd < o.cr - 0.3)) hits.push('prop'); } }
  return { hits: [...new Set(hits)], cam: [c.x, c.y, c.z].map(v => +v.toFixed(2)), dist: Math.hypot(c.x - px, c.z - pz) };
}, px, pz, tx, tz);
// 1. at every door, walking out toward the ring with the camera trailing toward the house
const houses = await page.evaluate(() => __k.houses.map(h => ({ x: h.x, z: h.z, rot: h.rot, d: h.d })));
let bad = [];
for (const [i, h] of houses.entries()) { const dx = Math.sin(h.rot), dz = Math.cos(h.rot), px = h.x + dx * (h.d / 2 + 1.2), pz = h.z + dz * (h.d / 2 + 1.2);
  const r = await blocked(px, pz, h.x, h.z); if (r.hits.length) bad.push(`house ${i}: ${r.hits} cam ${r.cam}`);
  if (i === 0) await page.screenshot({ path: 'tests/out/cam-door.jpg', type: 'jpeg', quality: 70 }); }
check(!bad.length, 'leaving any door, no house stands between you and the camera' + (bad.length ? ': ' + bad.join('; ') : ''));
// 2. beside every straw stack, camera trailing toward it; and stacks are solid
const stacks = await page.evaluate(() => __k.villageProps.filter(o => o.top === 2.9));
check(stacks.length >= 3, `straw stacks are in the collision list (${stacks.length})`);
bad = [];
for (const [i, s] of stacks.entries()) { const a = Math.atan2(s.z, s.x), px = s.x - Math.cos(a) * 1.6, pz = s.z - Math.sin(a) * 1.6; const r = await blocked(px, pz, s.x, s.z); if (r.hits.includes('prop')) bad.push(`stack ${i} cam ${r.cam}`); }
check(!bad.length, 'next to a straw stack, it never blocks the camera' + (bad.length ? ': ' + bad.join('; ') : ''));
if (stacks.length) { const s = stacks[0];
  const end = await page.evaluate(async (s) => { const d = __k.story.debug, p = __k.game.p.pos, a = Math.atan2(s.z, s.x); p.set(s.x - Math.cos(a) * 2, 0, s.z - Math.sin(a) * 2); d.S.camYaw = Math.atan2(-Math.cos(a), -Math.sin(a)); d.snapCam();
    __k.input.y = -1; __k.input.x = 0; await new Promise(r => setTimeout(r, 1600)); __k.input.y = 0; return Math.hypot(p.x - s.x, p.z - s.z); }, s);
  check(end > 0.8, `walking into a straw stack stops at its edge (${end.toFixed(2)} m from its centre)`); }
// 3. the akhra tree no longer hangs over the path to the next house
check(await page.evaluate(() => { const t = __k.story.debug.W.akhraProps.tree; return __k.houses.every(h => { const dx = Math.sin(h.rot), dz = Math.cos(h.rot), door = [h.x + dx * (h.d / 2 + 0.8), h.z + dz * (h.d / 2 + 0.8)], L = Math.hypot(...door), ux = door[0] / L, uz = door[1] / L;
  const along = t.x * ux + t.z * uz; if (along < 13 || along > L) return true; return Math.abs(t.x * uz - t.z * ux) > 2.6; }); }), 'the akhra tree stands clear of every path to a door');
// roads and yards are one textured mesh; yard things, log seats and the sleeping dogs are solid; the dogs breathe
check(await page.evaluate(() => { let n = 0; __k.scene.traverse(o => { if (o.isMesh && o.material && o.material.map && o.material.map.image && o.material.map.image.width === 512 && o.material.map.image.height === 1024) n++; }); return n === 1; }), 'all roads and swept yards are a single draw');
check(await page.evaluate(() => { const v = __k.villageProps; return v.filter(o => o.top === 0.6).length >= 2 && v.filter(o => o.top === 1.6).length >= 2 && v.filter(o => o.top === 0.5).length >= 6; }), 'yard stoves and mortars, log seats and the dogs are solid');
{ const r = await page.evaluate(async () => { const m = new __k.THREE.Matrix4(), v = new __k.THREE.Vector3(); let lo = 9, hi = 0; for (let i = 0; i < 300 && (i < 30 || hi - lo <= 0.02); i++) { __k.life.dogs.getMatrixAt(0, m); const y = v.setFromMatrixScale(m).y; lo = Math.min(lo, y); hi = Math.max(hi, y); await new Promise(r => setTimeout(r, 100)); } return { lo, hi }; });
  check(r.hi - r.lo > 0.02, `the dogs asleep in the square breathe (scale ${r.lo.toFixed(3)} to ${r.hi.toFixed(3)} over 3 s or until a breath shows, up to 30 s on slow runners) `); }
// the pork stall behind house 7: people gathered, the butcher chopping, the scale tipping, the cleaver heard near it
{ const m = await page.evaluate(() => { const M = __k.market, h = __k.houses[7], f = [Math.sin(h.rot), Math.cos(h.rot)], behind = (x, z) => (x - h.x) * f[0] + (z - h.z) * f[1] < 0;
    return { n: M.people.length, behind: M.people.every(a => behind(a.wrap.position.x, a.wrap.position.z)), butcher: M.people.some(a => a.role === 'butcher' && a.curName === 'SwordSlash'), z0: M.scale.rotation.z }; });
  check(m.n >= 4 && m.behind, `a pork stall in house 7's backyard with people gathered (${m.n})`);
  { const r = await page.evaluate(async () => { const M = __k.market, b = M.people.find(a => a.role === 'butcher'), buyers = M.people.filter(a => a.role === 'buyer'), seen = new Set(), p0 = buyers.map(a => a.wrap.position.clone()); let moved = 0;
      __k.game.p.pos.set(M.spot[0] + 3, 0, M.spot[1] + 3); b.tm = 0; b.chops = Math.max(1, b.chops); /* start a burst now */
      /* poll until a chop and a pause have both been seen and a buyer has moved: game time crawls on a software-GL runner */
      const movedNow = () => { let m = 0; buyers.forEach((a, i) => { m = Math.max(m, a.wrap.position.distanceTo(p0[i])); }); return m; };
      let fy0 = 9, fy1 = -9, odd = false; const fv = new __k.THREE.Vector3();
      for (let i = 0; i < 600 && (!(seen.has('chop') && seen.has('rest')) || movedNow() <= 0.15 || i < 90 || fy1 <= 1.15 || fy0 >= 0.85); i++) { /* also until the arm has been seen up and down: starting on the tail of a chop, his 2.5-5 s rest could outlast the 9 s on a slow runner */ seen.add(b.ph >= 0 ? 'chop' : 'rest'); b.root.getObjectByName('FistR').getWorldPosition(fv); fy0 = Math.min(fy0, fv.y); fy1 = Math.max(fy1, fv.y);
        if (M.people.some(a => a.curName === 'SwordSlash' || a.curName === 'PickUp')) odd = true; await new Promise(r => setTimeout(r, 100)); }
      buyers.forEach((a, i) => { moved = Math.max(moved, a.wrap.position.distanceTo(p0[i])); });
      const dancersNear = (__k.story.debug.W.sarpa || []).some(a => a.wrap.visible && Math.hypot(a.wrap.position.x - M.spot[0], a.wrap.position.z - M.spot[1]) < 9);
      return { chop: seen.has('chop'), pause: seen.has('rest'), moved, dancersNear, fy0, fy1, odd, pig: !!M.pig, hits: b.hits || 0 }; });
    check(r.chop && r.pause, 'the butcher chops in bursts with pauses (not a steady drum beat)');
    check(r.fy1 > 1.15 && r.fy0 < 0.85 && r.hits > 0, `the cleaver rises over his head and comes down into the meat (fist ${r.fy0.toFixed(2)} to ${r.fy1.toFixed(2)} m, ${r.hits} chops landed)`);
    check(!r.odd, 'nobody at the stall swings a sword or stoops to the floor (stock clips replaced by posed arms)');
    check(r.pig, 'the singed pig lies on banana leaves beside the block');
    check(r.moved > 0.15, `buyers wait like people: shifting, wandering a step, stepping up to the table (moved ${r.moved.toFixed(2)} m)`);
    check(!r.dancersNear, 'nobody dances at the meat sale (the Sarpa enej stop moved off house 7)'); }
  /* game time crawls on a software-GL runner (1-3 fps, dt capped): poll with a long timeout instead of one sample after a fixed sleep */
  await page.evaluate(() => { window.__sfxLog.length = 0; const M = __k.market, d = __k.story.debug, b = M.people.find(a => a.role === 'butcher'); __k.game.p.pos.set(M.spot[0] + 2.5, 0, M.spot[1] + 2.5); d.snapCam(); b.tm = 0; b.chops = Math.max(1, b.chops); window.__zr = [9, -9]; });
  const until = (fn) => page.waitForFunction(fn, { timeout: 40000, polling: 150 }).then(() => true, () => false);
  const tips = await until(() => { const z = __k.market.scale.rotation.z, r = window.__zr; r[0] = Math.min(r[0], z); r[1] = Math.max(r[1], z); return r[1] - r[0] > 0.005; });
  check(tips, `the balance scale tips as things are weighed (beam ${(await page.evaluate(() => window.__zr[0])).toFixed(3)} to ${(await page.evaluate(() => window.__zr[1])).toFixed(3)})`);
  const heard = await until(() => window.__sfxLog.includes('chop') && window.__sfxLog.includes('chatter'));
  check(heard, `near the stall you hear the cleaver and people talking (${await page.evaluate(() => [...new Set(window.__sfxLog)].join(' '))})`); }
// the Sarpa enej: the women walk bent forward, clapping all the time, toward the road and back, again and again
{ const r = await page.evaluate(async () => { const hs = __k.houses[2], f = hs.d / 2 + 1.1, T = __k.THREE, d = __k.story.debug; const st = new T.Vector3(hs.x + Math.sin(hs.rot) * f, 0, hs.z + Math.cos(hs.rot) * f);
    __k.game.p.pos.copy(st).add(new T.Vector3(Math.sin(hs.rot) * 1.2, 0, Math.cos(hs.rot) * 1.2)); d.snapCam(); window.__sfxLog.length = 0;
    const toRing = new T.Vector3(-st.x, 0, -st.z).normalize(), a = () => (d.W.sarpa || [])[0]; let lo = 99, hi = -99, hmin = 9, hmax = 0, bend = 0, vis = false;
    const L = new T.Vector3(), R = new T.Vector3(), H = new T.Vector3(), P = new T.Vector3();
    for (let i = 0; i < 400 && (i < 60 || hi - lo < 1.5 || hmax - hmin < 0.08); i++) { const w = a(); if (w && w.wrap.visible) { vis = true; w.root.updateMatrixWorld(true);
        const along = w.wrap.position.clone().sub(st).dot(toRing); lo = Math.min(lo, along); hi = Math.max(hi, along);
        w.root.getObjectByName('FistL').getWorldPosition(L); w.root.getObjectByName('FistR').getWorldPosition(R); const gap = L.distanceTo(R); hmin = Math.min(hmin, gap); hmax = Math.max(hmax, gap);
        w.root.getObjectByName('Head').getWorldPosition(H); w.root.getObjectByName('Hips').getWorldPosition(P); const fwd = new T.Vector3(Math.sin(w.wrap.rotation.y), 0, Math.cos(w.wrap.rotation.y)); bend = Math.max(bend, H.clone().sub(P).dot(fwd)); }
      await new Promise(r => setTimeout(r, 100)); }
    return { vis, travel: hi - lo, hmin, hmax, bend, claps: window.__sfxLog.filter(n => n === 'clapHand').length }; });
  check(r.vis && r.travel > 1.5, `the Sarpa enej line walks toward the road and back (${r.travel.toFixed(1)} m back and forth)`);
  check(r.bend > 0.12, `the women dance bent forward (head ${r.bend.toFixed(2)} m ahead of the hips)`);
  check(r.hmax - r.hmin > 0.08 && r.claps > 2, `they clap all the time (hands ${r.hmin.toFixed(2)}-${r.hmax.toFixed(2)} m apart, ${r.claps} claps heard)`); }
// the village couple behind the tree at the paddy's edge: close together until you come, then apart and pretending
{ const gap = () => page.evaluate(() => { const c = __k.market.couple; return c.boy.wrap.position.distanceTo(c.girl.wrap.position); });
  await page.evaluate(() => { const c = __k.market.couple; __k.game.p.pos.set(c.x * 0.5, 0, c.z * 0.5); __k.story.debug.snapCam(); c.away = 9; c.k = 0; }); await sleep(600);
  const g0 = await gap(), where = await page.evaluate(() => { const c = __k.market.couple; return { r: Math.hypot(c.x, c.z), field: __k.paddyFields.plots.some(p => { const a = Math.atan2(c.z, c.x); return p.gold && a > p.a0 && a < p.a1 && p.r0 < 45; }) }; });
  check(g0 < 0.75 && where.r > 28 && where.r < 30.5, `a couple stands close together at the village edge (${g0.toFixed(2)} m apart, ${where.r.toFixed(1)} m out)`);
  // their talk (Dulor's recording): silent far away, heard when you creep close, louder the closer you are
  const talk = () => page.evaluate(() => { const t = __k.coupleTalk; return { v: t.v, playing: !!t.el && !t.el.paused, at: t.el ? t.el.currentTime : 0 }; });
  await page.evaluate(() => { const c = __k.market.couple; __k.game.p.pos.set(c.x - c.out[0] * 20, 0, c.z - c.out[1] * 20); }); await sleep(900); const far = await talk();
  await page.evaluate(() => { const c = __k.market.couple; __k.game.p.pos.set(c.x - c.out[0] * 9.5, 0, c.z - c.out[1] * 9.5); });
  await page.waitForFunction(() => { const t = __k.coupleTalk; return t.el && !t.el.paused && t.el.currentTime > 0.3; }, { timeout: 30000, polling: 100 }).catch(() => {}); const mid = await talk();
  await page.evaluate(() => { const c = __k.market.couple; __k.game.p.pos.set(c.x - c.out[0] * 7, 0, c.z - c.out[1] * 7); }); await sleep(700); const close = await talk();
  // from your own yard and doorstep, nothing: it used to carry there
  const home = await page.evaluate(async () => { const c = __k.market.couple, h = __k.houses[0], r = Math.hypot(h.x, h.z), out = []; for (const k of [0.62, 0.72, 0.82]) { __k.game.p.pos.set(h.x * k, 0, h.z * k); await new Promise(r => setTimeout(r, 500)); out.push(__k.coupleTalk.v); } return out; });
  check(home.every(v => v === 0), `no talk is heard from your own yard or doorstep (${home.join(', ')})`);
  check(far.v === 0 && !far.playing && mid.playing && mid.v > 0.05 && close.v > mid.v + 0.1, `the couple's talk is heard only close by, louder the nearer you are (20 m: ${far.v.toFixed(2)}, 9.5 m: ${mid.v.toFixed(2)}, 7 m: ${close.v.toFixed(2)})`);
  await page.evaluate(() => { window.__sfxLog.length = 0; const c = __k.market.couple; __k.game.p.pos.set(c.x - c.out[0] * 3, 0, c.z - c.out[1] * 3); __k.story.debug.snapCam(); });
  const apart = await page.waitForFunction(() => { const c = __k.market.couple; return c.boy.wrap.position.distanceTo(c.girl.wrap.position) > 1.7; }, { timeout: 30000, polling: 100 }).then(() => true, () => false);
  check(apart && await page.evaluate(() => window.__sfxLog.includes('cough')), `when you walk up they jump apart with a cough (${(await gap()).toFixed(2)} m)`);
  check(await page.evaluate(() => { const b = __k.audio.buf; return !!(b['cough-m'] && b['cough-f']) && b['cough-m'].duration > 0.5 && b['cough-f'].duration > 0.5; }), 'the coughs are real recordings, loaded and ready (his and hers)');
  await sleep(700); { const t = await talk(); check(t.v === 0 && !t.playing, 'caught, their talk stops dead'); }
  await page.screenshot({ path: 'tests/out/cam-couple.jpg', type: 'jpeg', quality: 70 });
  await page.evaluate(() => { __k.game.p.pos.set(0, 0, 13); __k.story.debug.snapCam(); });
  check(await page.waitForFunction(() => { const c = __k.market.couple; return c.boy.wrap.position.distanceTo(c.girl.wrap.position) < 0.75; }, { timeout: 60000, polling: 200 }).then(() => true, () => false), 'and drift back together once you have gone'); }
// the water carrier walks her route between the pump and house 3, the pot riding on her head
{ const pos = () => page.evaluate(() => { const W = __k.market.carrier, p = W.a.wrap.position, h = W.head.getWorldPosition(new __k.THREE.Vector3()); return { x: p.x, z: p.z, pot: W.pot.position.distanceTo(h) }; });
  await page.evaluate(() => { const W = __k.market.carrier; W.wait = 0; __k.game.p.pos.set(W.a.wrap.position.x + 4, 0, W.a.wrap.position.z + 4); __k.story.debug.snapCam(); });
  const a = await pos();
  await page.waitForFunction((x, z) => { const p = __k.market.carrier.a.wrap.position; return Math.hypot(p.x - x, p.z - z) > 0.5; }, { timeout: 40000, polling: 200 }, a.x, a.z).catch(() => {}); /* slow runners: wait for her to cover the distance */
  const b = await pos();
  check(Math.hypot(b.x - a.x, b.z - a.z) > 0.5 && b.pot < 0.45, `a woman carries a water pot on her head between the pump and a house (walked ${Math.hypot(b.x - a.x, b.z - a.z).toFixed(1)} m, pot ${b.pot.toFixed(2)} m above her head)`); }
// paddy fields round half the village: plots with bunds, about half ripe and standing, the rest cut with sheaves
{ const f = await page.evaluate(() => { const P = __k.paddyFields.plots; let arc = 0; const seen = new Set(); for (const p of P) { const k = p.a0.toFixed(3); if (p.r0 === 36 && !seen.has(k)) { seen.add(k); arc += p.a1 - p.a0; } }
    return { n: P.length, gold: P.filter(p => p.gold).length / P.length, share: arc / (Math.PI * 2), tufts: __k.paddyFields.tufts ? __k.paddyFields.tufts.count : 0, outside: P.every(p => p.r0 >= 36) }; });
  check(f.n > 60 && f.share > 0.45 && f.share < 0.6 && f.outside, `paddy fields cover half the land round the village (${Math.round(f.share * 100)}%, ${f.n} plots, all outside the walkable village)`);
  check(f.gold > 0.35 && f.gold < 0.75 && f.tufts > 300, `some plots stand ripe and golden, the rest are cut (${Math.round(f.gold * 100)}% golden, ${f.tufts} standing clumps)`); }
// the music: Dulor's Khuntau BGM plays in the village (and the ring); the old ring track is gone
check(await page.evaluate(() => /khuntau\.mp3$/.test(__k.music.game.src) && __k.music.cur === 'game'), 'the village plays the Khuntau BGM');
// reduced motion: no cinematic shots at all
{ const pg2 = await browser.newPage(); await pg2.emulate({ viewport: { width: 390, height: 780, deviceScaleFactor: 1, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (Linux; Android 13) Mobile' });
  await pg2.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]); await pg2.evaluateOnNewDocument(() => localStorage.setItem('khuntau-played', '1'));
  await pg2.goto('http://127.0.0.1:8791/?debug&q=low', { waitUntil: 'domcontentloaded' }); await pg2.waitForFunction(() => document.getElementById('startBtn').dataset.village === 'ready', { timeout: 90000 });
  await pg2.evaluate(() => document.getElementById('quickBtn').click()); await pg2.waitForFunction(() => __k.game.mode === 'play');
  await pg2.evaluate(() => { __k.hs.next = 999; __k.game.p.pos.set(0.4, 0, 1.0); __k.game.p.state = 'free'; __k.input.grab = true; window.__shot = 0; (function f() { if (__k.cine.shot) window.__shot = 1; if (__k.game.mode === 'play') requestAnimationFrame(f); })(); });
  await pg2.waitForFunction(() => __k.game.pitha === 1, { timeout: 5000 }).catch(() => {}); await sleep(800);
  check(await pg2.evaluate(() => __k.game.pitha === 1 && window.__shot === 0), 'with reduced motion on, a snatch plays no cinematic shot'); await pg2.close(); }
{ const e = realErrors(logs); check(!e.length, 'no page errors' + (e.length ? ': ' + e.slice(0, 3).join(' | ') : '')); }
await finish(browser);
