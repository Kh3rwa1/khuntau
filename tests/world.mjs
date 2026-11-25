// The land and what you do on it (25 Nov): garden fences and the goda's wall are solid, a jump clears a garden fence
// (and only a garden fence), the walkable land reaches 46 m with solid trees, stacks and scarecrows, small things far
// away are not drawn, and the sickle cuts grass and paddy (sheaves, a reaped plot).
//   node tests/world.mjs     (static server on 8791)
import puppeteer from 'puppeteer';
import fs from 'fs'; fs.mkdirSync('tests/out', { recursive: true });
import { check, finish, realErrors, SW } from './check.mjs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ protocolTimeout: 240000, args: [...SW, '--no-sandbox', '--mute-audio'] });
const logs = [];
async function boot({ w = 390, h = 780, touch = true, q = 'low', lang = 'en' } = {}) {
  const page = await browser.newPage(); page.on('pageerror', e => logs.push(e.message));
  if (touch) await page.emulate({ viewport: { width: w, height: h, deviceScaleFactor: 1, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-A346E) Mobile' }); else await page.setViewport({ width: w, height: h });
  await page.evaluateOnNewDocument((lang) => { localStorage.setItem('khuntau-seen-tips', '1'); localStorage.setItem('khuntau-lang', lang); localStorage.setItem('khuntau-story', JSON.stringify({ ch: 3, w: 1, kh: 1, painted: [1, 1, 1], chosen: 1, oiled: 1, garland: 1 })); }, lang);
  await page.goto('http://127.0.0.1:8791/?debug&q=' + q, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.getElementById('startBtn').dataset.village === 'ready', { timeout: 120000 });
  const ev = (f, ...a) => page.evaluate(f, ...a), until = (f, ms = 30000, ...a) => page.waitForFunction(f, { timeout: ms, polling: 50 }, ...a).then(() => true, () => false);
  await ev(() => document.getElementById('startBtn').click()); await until(() => __k.game.mode === 'story'); await sleep(2500);
  await ev(() => { const d = __k.story.debug; d.S.dlg = null; document.getElementById('dlg').hidden = true; d.S.mode = 'walk'; });
  // steer like a player: the stick held toward a goal, relative to the camera, every frame
  await ev(() => { const k = window.__k, I = k.input, st = window.__steer = { goal: null };
    Object.defineProperty(I, 'x', { get: () => st.x || 0, set() {}, configurable: true }); Object.defineProperty(I, 'y', { get: () => st.y || 0, set() {}, configurable: true });
    const T = k.THREE, f = new T.Vector3(), r = new T.Vector3(), d = new T.Vector3(), UP = new T.Vector3(0, 1, 0);
    (function loop() { const p = k.game.p.pos; if (st.goal) { d.set(st.goal[0] - p.x, 0, st.goal[1] - p.z); if (d.length() < 0.25) { st.x = st.y = 0; } else { d.normalize(); f.copy(p).sub(k.camera.position).setY(0).normalize(); r.crossVectors(f, UP).normalize(); st.x = d.dot(r); st.y = -d.dot(f); } } else st.x = st.y = 0; requestAnimationFrame(loop); })();
    // where a point is relative to a fence: + on the garden's side, - outside
    window.__gardens = () => { const F = k.story.debug.fences().filter(f => f.garden != null), by = {}; for (const f of F) (by[f.garden] = by[f.garden] || []).push(f);
      return Object.entries(by).map(([g, segs]) => { let cx = 0, cz = 0; for (const s of segs) { cx += (s.ax + s.bx) / 2; cz += (s.az + s.bz) / 2; } cx /= segs.length; cz /= segs.length; /* the middle of the three sides lies inside */
        return { g: +g, cx, cz, segs: segs.map(s => { const dx = s.bx - s.ax, dz = s.bz - s.az, len = Math.hypot(dx, dz); let nx = -dz / len, nz = dx / len; if ((cx - s.ax) * nx + (cz - s.az) * nz < 0) { nx = -nx; nz = -nz; } return { ...s, nx, nz, len, mx: (s.ax + s.bx) / 2, mz: (s.az + s.bz) / 2 }; }) }; }); };
    window.__side = (s, p) => (p.x - s.ax) * s.nx + (p.z - s.az) * s.nz; });
  const place = (x, z, yaw) => ev((x, z, yaw) => { const d = __k.story.debug, p = __k.game.p; __steer.goal = null; p.pos.set(x, 0, z); p.vel.set(0, 0, 0); if (yaw != null) { p.yaw = yaw; d.S.camYaw = yaw + Math.PI; } d.collide(p.pos); d.snapCam(); }, x, z, yaw);
  return { page, ev, until, place };
}

/* ---------- phone: fences, jump, the land, the sickle ---------- */
{ const { page, ev, until, place } = await boot();
  const G = await ev(() => __gardens().map(g => ({ g: g.g, n: g.segs.length })));
  check(G.length === 4 && G.every(g => g.n === 3), `four kitchen gardens, each fenced on three sides (${JSON.stringify(G)})`);
  check(await ev(() => __k.story.debug.fences().filter(f => f.goda).length === 2), 'the goda has its wattle wall and its side rail as walls');

  // 1. Walk at every fence from outside, stick held: you never get in
  { const res = await ev(async () => { const out = []; const d = __k.story.debug, p = __k.game.p;
      for (const g of __gardens()) for (const s of g.segs) { p.pos.set(s.mx - s.nx * 1.6, 0, s.mz - s.nz * 1.6); p.vel.set(0, 0, 0); d.collide(p.pos); d.snapCam(); __steer.goal = [s.mx + s.nx * 2.2, s.mz + s.nz * 2.2];
        let max = -9; const t0 = performance.now(); while (performance.now() - t0 < 1500) { await new Promise(r => requestAnimationFrame(r)); max = Math.max(max, __side(s, p.pos)); } __steer.goal = null; out.push(Math.round(max * 100) / 100); }
      return out; });
    check(res.length === 12 && res.every(v => v < -0.2 && v > -0.6), `walking at each of the 12 fence sides stops you at the rails (nearest you got, in m, minus = outside: ${res.join(' ')})`); }

  // 2. One long step (a slow frame) cannot carry you through
  { const res = await ev(() => { const d = __k.story.debug, p = __k.game.p, out = [];
      for (const g of __gardens()) { const s = g.segs[0]; p.pos.set(s.mx - s.nx * 0.6, 0, s.mz - s.nz * 0.6); d.collide(p.pos); p.pos.set(s.mx + s.nx * 1.6, 0, s.mz + s.nz * 1.6); d.collide(p.pos); out.push(Math.round(__side(s, p.pos) * 100) / 100); }
      return out; });
    check(res.every(v => v < -0.2), `a 2.2 m step in one frame is put back outside (${res.join(' ')})`); }

  // 3. The JUMP button: there in the village, a real tap lifts you, no second jump in the air
  check(await ev(() => { const b = document.getElementById('jumpBtn'), r = b.getBoundingClientRect(), a = document.getElementById('actBtn').getBoundingClientRect(); return !b.hidden && r.width > 60 && r.right <= innerWidth && r.bottom <= innerHeight && (r.right <= a.left || r.bottom <= a.top) && b.textContent === 'JUMP'; }), 'JUMP is on the screen beside the action button, covering nothing');
  await place(0, 14, 0);
  await ev(() => { window.__hop = (async () => { const S = __k.story.debug.S; let max = 0, t0 = 0, air = 0, again = false; const end = performance.now() + 4000; // watching from before the tap
    while (performance.now() < end) { await new Promise(r => requestAnimationFrame(r)); const n = performance.now(); if (S.jy > 0) { if (!t0) t0 = n; air = n - t0; max = Math.max(max, S.jy); if (!again && S.jy > 0.5) { again = true; S.jumpAsk = true; } } else if (t0 && n - t0 > air + 500) break; }
    return { max: Math.round(max * 100) / 100, air: Math.round(air), jy: S.jy }; })(); });
  await page.tap('#jumpBtn'); const hop = await ev(() => window.__hop);
  check(hop.max > 0.65 && hop.max < 1.0 && hop.air > 450 && hop.air < 1000 && hop.jy === 0, `a tap on JUMP: up ${hop.max} m, ${hop.air} ms in the air, down again, and a tap in mid-air does not jump twice`);
  check(await ev(() => window.__sfxLog.includes('hop')), 'the jump is heard');

  // 4. A running jump clears a garden fence, and gets you out again
  { const res = await ev(async () => { const out = [], d = __k.story.debug, p = __k.game.p, S = d.S;
      for (const g of __gardens()) { const s = g.segs[0]; // the back fence of each garden
        const run = async (from, to, sign) => { p.pos.set(from[0], 0, from[1]); p.vel.set(0, 0, 0); d.collide(p.pos); d.snapCam(); __steer.goal = to; let jumped = false; const t0 = performance.now();
          while (performance.now() - t0 < 2600) { await new Promise(r => requestAnimationFrame(r)); const k = __side(s, p.pos) * sign; if (!jumped && k > -1.25) { jumped = true; document.getElementById('jumpBtn').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true })); } if (k > 0.6 && !(S.jy > 0)) break; } __steer.goal = null; return __side(s, p.pos); };
        const inn = await run([s.mx - s.nx * 3.2, s.mz - s.nz * 3.2], [s.mx + s.nx * 1.5, s.mz + s.nz * 1.5], 1), outt = await run([s.mx + s.nx * 1.9, s.mz + s.nz * 1.9], [s.mx - s.nx * 3, s.mz - s.nz * 3], -1); // the garden is small: a short run-up from inside
        out.push([Math.round(inn * 100) / 100, Math.round(outt * 100) / 100]); }
      return out; });
    check(res.every(([a, b]) => a > 0.3 && b < -0.3), `a running jump lands you in each garden, and another takes you out (side after jumping in / out: ${res.map(r => r.join('/')).join(' ')})`); }
  await page.screenshot({ path: 'tests/out/world-garden.jpg', type: 'jpeg', quality: 75 });

  // 5. The goda's wall is no garden fence: a running jump does not clear it
  { const v = await ev(async () => { const d = __k.story.debug, p = __k.game.p, f = d.fences().find(f => f.goda), dx = f.bx - f.ax, dz = f.bz - f.az, len = Math.hypot(dx, dz), mx = (f.ax + f.bx) / 2, mz = (f.az + f.bz) / 2; let nx = -dz / len, nz = dx / len; const G = d.W.gStand || { x: mx, z: mz };
      if ((d.W.gohal ? 0 : 0) || ((G.x - mx) * nx + (G.z - mz) * nz) > 0) { nx = -nx; nz = -nz; } /* n points away from where the animal stands: outside */
      const s = { ax: f.ax, az: f.az, nx: -nx, nz: -nz }; p.pos.set(mx + nx * 3, 0, mz + nz * 3); p.vel.set(0, 0, 0); d.collide(p.pos); d.snapCam(); __steer.goal = [mx - nx * 2, mz - nz * 2]; let jumped = false, max = -9; const t0 = performance.now();
      while (performance.now() - t0 < 2200) { await new Promise(r => requestAnimationFrame(r)); const k = __side(s, p.pos); max = Math.max(max, k); if (!jumped && k > -1.25) { jumped = true; d.S.jumpAsk = true; } } __steer.goal = null; return Math.round(max * 100) / 100; });
    check(v < -0.2, `the goda's wattle wall cannot be jumped (nearest ${v} m, minus = outside)`); }

  // 6. No JUMP indoors, none while somebody speaks
  await ev(() => { const d = __k.story.debug; d.S.jumpAsk = false; d.say && 0; });
  check(await ev(async () => { const d = __k.story.debug; d.S.dlg = { lines: [], i: 0 }; d.S.jumpAsk = true; await new Promise(r => setTimeout(r, 300)); const up = d.S.jy > 0, hid = document.getElementById('jumpBtn').hidden; d.S.dlg = null; d.S.jumpAsk = false; await new Promise(r => setTimeout(r, 200)); return !up && hid && !document.getElementById('jumpBtn').hidden; }), 'while somebody speaks there is no jumping and no JUMP button; after, it is back');

  // 7. The land: 46 m, said once at the edge
  check(await ev(() => __k.story.debug.VILLAGE_R === 46), 'the walkable land reaches 46 m (it was 30.5)');
  { const a = await ev(() => { const P = __k.paddyFields.plots.filter(p => p.r0 === 36); for (let a = 0; a < 6.28; a += 0.05) { if (!P.some(p => { let x = a; while (x < p.a0 - 0.1) x += 6.2832; while (x > p.a0 + 6.2832) x -= 6.2832; return x <= p.a1 + 0.1; })) return a; } return 0; }); // a direction with grass, not paddy
    await place(Math.cos(a) * 41, Math.sin(a) * 41, Math.atan2(Math.cos(a), Math.sin(a))); await ev((a) => { __steer.goal = [Math.cos(a) * 60, Math.sin(a) * 60]; }, a);
    await until(() => Math.hypot(__k.game.p.pos.x, __k.game.p.pos.z) > 45.9, 6000); await sleep(700);
    const e = await ev(() => ({ r: Math.hypot(__k.game.p.pos.x, __k.game.p.pos.z), hint: document.getElementById('hint').textContent, shown: document.getElementById('hint').classList.contains('show') })); await ev(() => { __steer.goal = null; });
    check(e.r > 45.9 && e.r <= 46.01 && /as far as the village land goes/.test(e.hint), `walking out, you stop at 46 m and are told so (r ${e.r.toFixed(2)}, '${e.hint}')`);
    await page.screenshot({ path: 'tests/out/world-edge.jpg', type: 'jpeg', quality: 75 }); }

  // 8. Out there: trees, paddy stacks and scarecrows are solid
  { const res = await ev(async () => { const d = __k.story.debug, p = __k.game.p, out = {}; const P = __k.villageProps, pick = { tree: P.find(o => o.tree && Math.hypot(o.x, o.z) > 33 && Math.hypot(o.x, o.z) < 44), crow: P.find(o => o.crow), stack: P.find(o => o.top === 2.7 && Math.hypot(o.x, o.z) < 45) };
      for (const [name, o] of Object.entries(pick)) { if (!o) { out[name] = null; continue; } const a = Math.atan2(o.z, o.x); p.pos.set(o.x - Math.cos(a) * (o.r + 1.6), 0, o.z - Math.sin(a) * (o.r + 1.6)); p.vel.set(0, 0, 0); d.collide(p.pos); d.snapCam(); __steer.goal = [o.x, o.z]; let min = 9; const t0 = performance.now();
        while (performance.now() - t0 < 1300) { await new Promise(r => requestAnimationFrame(r)); min = Math.min(min, Math.hypot(p.pos.x - o.x, p.pos.z - o.z)); } __steer.goal = null; out[name] = [Math.round(min * 100) / 100, o.r]; }
      out.crows = P.filter(o => o.crow).map(o => { const r = Math.hypot(o.x, o.z), a = Math.atan2(o.z, o.x), pl = __k.paddyFields.plots.find(p => p.crow && Math.hypot(p.crow[0] - o.x, p.crow[1] - o.z) < 0.01); return !!pl && pl.gold && pl.r0 === 36 && r > 36 && r < 45; }); return out; });
    check(res.tree && res.tree[0] >= res.tree[1], `an outer tree is solid (nearest ${res.tree && res.tree[0]} m to its middle)`);
    check(res.crows.length === 3 && res.crows.every(Boolean) && res.crow[0] >= res.crow[1], `three scarecrows, each in a ripe plot you can reach, and solid (nearest ${res.crow[0]} m)`);
    check(res.stack === null || res.stack[0] >= res.stack[1], `a big paddy stack on the walkable land is solid (${res.stack ? 'nearest ' + res.stack[0] + ' m' : 'none stands there this time'})`); }

  // 9. From the far edge the whole village is in view: small far things are left out, the view stays inside the budget
  { await place(Math.cos(0.643) * 45.8, Math.sin(0.643) * 45.8, Math.atan2(-Math.cos(0.643), -Math.sin(0.643))); await sleep(1400);
    const far = await ev(() => ({ calls: __k.renderer.info.render.calls, off: __k.farCull.off, list: __k.farCull.list.length }));
    check(far.calls <= 80 && far.off >= 8, `the village seen from its far edge: ${far.calls} draw calls (limit 80; 88 before small far things were left out), ${far.off} of ${far.list} small things not drawn`);
    await page.screenshot({ path: 'tests/out/world-far.jpg', type: 'jpeg', quality: 75 });
    await place(0, 12, Math.PI); await sleep(1200);
    const near = await ev(() => { const c = __k.camera.position; return __k.farCull.list.filter(o => o.layers.mask === 0).map(o => { const e = o.matrixWorld.elements; return Math.hypot(e[12] - c.x, e[13] - c.y, e[14] - c.z); }).filter(d => d < 12).length; });
    check(near === 0, `nothing within 12 m of the camera is left out (${near})`); }

  // 10. The sickle on grass: a calm green CUT, the clumps in front of you go down
  { const g = await ev(() => { const k = __k, pl = k.cutWorld.plants, P = k.villageProps; // a clump with nothing else to do near it, away from the paddy
      const c = pl.find(q => !q.kind && Math.hypot(q.x, q.z) > 31 && Math.hypot(q.x, q.z) < 34.5 && !P.some(o => Math.hypot(o.x - q.x, o.z - q.z) < 4) && Math.hypot(q.x - k.market.couple.x, q.z - k.market.couple.z) > 9); return c ? [c.x, c.z] : null; });
    check(!!g, 'there is grass on the new land'); const a = Math.atan2(g[1], g[0]);
    await place(g[0] - Math.cos(a) * 0.7, g[1] - Math.sin(a) * 0.7, Math.atan2(Math.cos(a), Math.sin(a))); await sleep(500);
    const b0 = await ev(() => { const b = document.getElementById('actBtn'), cs = getComputedStyle(b); return { t: b.textContent, soft: b.classList.contains('soft'), off: b.classList.contains('off'), anim: cs.animationName, bg: cs.backgroundColor, near: __k.story.debug.S.near && __k.story.debug.S.near.text }; });
    check(b0.t === 'CUT' && b0.soft && !b0.off && b0.anim === 'none' && b0.near === 'Cut the grass', `on grass the button offers CUT, green and still (${JSON.stringify(b0)})`);
    const n0 = await ev(() => __k.cutWorld.plants.filter(q => q.cut).length); await ev(() => { window.__sfxLog.length = 0; }); await page.tap('#actBtn'); await sleep(900);
    const r = await ev((g) => { const k = __k, c = k.cutWorld.plants.find(q => q.x === g[0] && q.z === g[1]), m = new k.THREE.Matrix4(), s = new k.THREE.Vector3(); k.cutWorld.grass.getMatrixAt(c.i, m); s.setFromMatrixScale(m); return { cut: k.cutWorld.plants.filter(q => q.cut).length, mine: c.cut, sy: s.y / c.sy, snd: window.__sfxLog.includes('sickle'), clip: k.player.curName, sickle: !!k.story.debug.W.sickle }; }, g);
    check(r.cut > n0 && r.mine && r.sy < 0.3 && r.snd && r.sickle, `a tap cuts it: ${r.cut - n0} clump(s) down to ${(r.sy * 100).toFixed(0)}% of their height, the sickle is heard`);
    await page.screenshot({ path: 'tests/out/world-grass.jpg', type: 'jpeg', quality: 75 }); }

  // 11. Paddy: CUT says paddy, six tufts make a sheaf, sheaves count for the day and pay a little
  { const xp0 = await ev(() => (__k.meta ? __k.meta.xp : 0)), calls0 = await ev(() => __k.renderer.info.render.calls);
    const pl = await ev(() => { const P = __k.paddyFields.plots, i = P.findIndex(p => p.gold && p.r0 === 36 && !p.crow), p = P[i], a = (p.a0 + p.a1) / 2; return { i, a, r0: p.r0, n: p.n }; });
    await place(Math.cos(pl.a) * (pl.r0 + 0.2), Math.sin(pl.a) * (pl.r0 + 0.2), Math.atan2(Math.cos(pl.a), Math.sin(pl.a))); await sleep(500);
    const b1 = await ev(() => ({ t: document.getElementById('actBtn').textContent, near: __k.story.debug.S.near && __k.story.debug.S.near.text }));
    check(b1.t === 'CUT' && b1.near === 'Cut the paddy', `at a ripe plot the button offers to cut the paddy (${JSON.stringify(b1)})`);
    let sheaves = 0; for (let i = 0; i < 26 && sheaves < 5; i++) { await page.tap('#actBtn'); await sleep(620); // a stroke, a step along the rows, a stroke: up one row and back down the next
      await ev((pl, i) => { const p = __k.game.p, row = Math.floor((i + 1) / 5), col = (i + 1) % 5, r = pl.r0 + 0.2 + (row % 2 ? 4 - col : col) * 1.4, a = pl.a + row * 2.2 / pl.r0; p.pos.set(Math.cos(a) * r, 0, Math.sin(a) * r); p.vel.set(0, 0, 0); }, pl, i); await sleep(200); sheaves = await ev(() => (__k.cutWorld.sheaves ? __k.cutWorld.sheaves.count : 0)); }
    await sleep(1500);
    const r = await ev((pl) => { const k = __k, td = k.story.debug.today(); return { reap: td.reap, sheaves: k.cutWorld.sheaves ? k.cutWorld.sheaves.count : 0, cut: k.cutWorld.plants.filter(q => q.kind && q.cut).length, plotCut: k.paddyFields.plots[pl.i].cut, xp: k.meta ? k.meta.xp : 0, hint: document.getElementById('hint').textContent, pop: document.getElementById('pop') ? document.getElementById('pop').textContent : '' }; }, pl);
    const per = await ev(() => __k.story.debug.SHEAF); check(r.sheaves >= 5 && r.cut === r.reap && Math.floor(r.reap / per) === r.sheaves, `reaping: ${r.reap} tufts cut make ${r.sheaves} sheaves (${per} tufts to a sheaf at this quality), laid behind you`);
    check(r.xp >= xp0 + 5 + 10, `sheaves pay: +1 XP each and +10 for the fifth (${xp0} -> ${r.xp})`);
    check(/Five sheaves|good load/.test(r.pop) || /Sheaves cut today: \d/.test(r.hint), `you are told the count and praised at five ('${r.hint}' / '${r.pop.trim().slice(0, 40)}')`);
    await ev(() => { const d = __k.story.debug; d.S.camYaw += 0.6; d.snapCam(); }); await sleep(500); await page.screenshot({ path: 'tests/out/world-paddy.jpg', type: 'jpeg', quality: 75 });
    const calls1 = await ev(() => __k.renderer.info.render.calls); check(await ev(() => __k.cutWorld.sheaves.isInstancedMesh), `the sheaves are one instanced draw (view ${calls0} -> ${calls1} calls)`);
    // the rest of the plot: cut all but what stands round you, then the last strokes by hand turn it to stubble
    const done = await ev(async (pl) => { const k = __k, P = k.paddyFields.plots[pl.i], d = k.story.debug, p = k.game.p; const left = () => k.cutWorld.plants.filter(q => q.kind && q.plot === pl.i && !q.cut);
      // a plot counts as reaped at 85% cut: leave a patch a little bigger than the last 15% standing in one corner
      const L0 = left(), T = L0[0], keep = L0.slice().sort((u, v) => Math.hypot(u.x - T.x, u.z - T.z) - Math.hypot(v.x - T.x, v.z - T.z)).slice(0, Math.ceil(P.n * 0.15) + 4); for (const q of L0) if (!keep.includes(q)) k.cutWorld.cut(q.x, q.z, 0.05); const before = { gold: P.gold, reaped: !!P.reaped, left: left().length, of: P.n };
      const uv = k.paddyFields.mesh.geometry.attributes.uv, u0 = uv.getX(P.vert);
      for (let i = 0; i < 14 && !P.reaped; i++) { const q = left()[0]; if (!q) break; const a = Math.atan2(q.z, q.x); p.pos.set(q.x - Math.cos(a) * 0.75, 0, q.z - Math.sin(a) * 0.75); p.yaw = Math.atan2(Math.cos(a), Math.sin(a)); p.vel.set(0, 0, 0); await new Promise(r => setTimeout(r, 250)); d.S.act = true; await new Promise(r => setTimeout(r, 800)); }
      await new Promise(r => setTimeout(r, 1500)); return { before, gold: P.gold, reaped: !!P.reaped, u0, u1: uv.getX(P.vert), hint: document.getElementById('hint').textContent, left: left().length }; }, pl);
    check(!done.before.reaped && done.before.gold && done.reaped && !done.gold && done.u0 < 0.5 && done.u1 >= 0.5, `a plot with its paddy cut turns to stubble on the ground too (${JSON.stringify(done.before)} -> reaped ${done.reaped}, ground ${done.u0} -> ${done.u1})`);
    check(/plot is reaped/.test(done.hint), `and you are told ('${done.hint}')`); }

  // 12. CUT never takes the place of something else to do, and there is no sickle indoors
  { await place(0, 0, 0); await ev(() => { const d = __k.story.debug, W = d.W; __k.game.p.pos.set(0, 0, 2.2); }); await sleep(600);
    const k = await ev(() => document.getElementById('actBtn').textContent); check(k !== 'CUT' && k !== '·', `at the khunt the button offers the round, not the sickle ('${k}')`); }
  check(realErrors(logs).length === 0, 'no page errors on the phone ' + realErrors(logs).join(' | '));
  await page.close(); }

/* ---------- laptop: Space jumps, E cuts; Hindi ---------- */
{ const { page, ev, until, place } = await boot({ w: 1280, h: 720, touch: false, q: 'low', lang: 'hi' });
  check(await ev(() => getComputedStyle(document.getElementById('jumpBtn')).display === 'none'), 'laptop: no JUMP button on the screen');
  await place(0, 14, 0); await page.keyboard.press('Space');
  check(await until(() => __k.story.debug.S.jy > 0.3, 2000), 'laptop: Space jumps'); await until(() => !(__k.story.debug.S.jy > 0), 3000);
  const g = await ev(() => { const k = __k, c = k.cutWorld.plants.find(q => !q.kind && !q.cut && Math.hypot(q.x, q.z) > 31 && Math.hypot(q.x, q.z) < 34.5 && !k.villageProps.some(o => Math.hypot(o.x - q.x, o.z - q.z) < 4) && Math.hypot(q.x - k.market.couple.x, q.z - k.market.couple.z) > 9); return [c.x, c.z]; }), a = Math.atan2(g[1], g[0]);
  await place(g[0] - Math.cos(a) * 0.7, g[1] - Math.sin(a) * 0.7, Math.atan2(Math.cos(a), Math.sin(a))); await sleep(500);
  const hi = await ev(() => ({ b: document.getElementById('actBtn').textContent, p: document.getElementById('prompt').textContent }));
  check(hi.b === 'काटो' && /घास काटो/.test(hi.p) && !/[A-Za-z]{3,}/.test(hi.b + hi.p.replace(/^E/, '')), `Hindi: the button and its line are in Hindi ('${hi.b}', '${hi.p}')`);
  const n0 = await ev(() => __k.cutWorld.plants.filter(q => q.cut).length); await page.keyboard.press('KeyE'); await sleep(900);
  check(await ev((n0) => __k.cutWorld.plants.filter(q => q.cut).length > n0, n0), 'laptop: E cuts');
  await page.screenshot({ path: 'tests/out/world-laptop.jpg', type: 'jpeg', quality: 75 });
  check(realErrors(logs).length === 0, 'no page errors on the laptop ' + realErrors(logs).join(' | '));
  await page.close(); }
await finish(browser);
