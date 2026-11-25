// The shots of the /brag promo. Each sets the game up through window.__k, then film.mjs steps it 1/30 s a frame.
// at(ctx, i) runs before frame i and may return an event name, recorded in meta.json with its frame number, so
// compose.mjs can put that moment exactly on a beat of the music. Shots run in this order in one browser.

async function until(ctx, cond, max = 300, arg) { // step the game without filming until cond() holds
  for (let i = 0; i < max; i++) { if (await ctx.ev(cond, arg)) return true; await ctx.step(-1); }
  return false;
}
const ui = (ctx, cls) => ctx.ev(cls => { const h = document.documentElement; h.classList.remove('film-clean', 'film-ring', 'film-pads'); h.classList.add('film-nobars', ...cls); }, cls);
const rects = (ctx, ids) => ctx.ev(ids => Object.fromEntries(ids.map(id => { const e = document.getElementById(id); if (!e) return [id, null]; const r = e.getBoundingClientRect(); return [id, [r.x + r.width / 2, r.y + r.height / 2, r.width / 2]]; })), ids);

async function toRing(ctx) {
  if (await ctx.ev(() => __k.game.mode) !== 'play') {
    await ctx.ev(() => document.getElementById('quickBtn').click());
    await until(ctx, () => __k.game.mode === 'play', 400);
  }
  for (let i = 0; i < 10; i++) await ctx.step(-1);
}
async function toVillage(ctx) {
  if (await ctx.ev(() => __k.game.mode) === 'story') return;
  await ctx.ev(() => document.getElementById('quitBtn').click());
  await until(ctx, () => __k.game.mode === 'menu', 300);
  await ctx.ev(() => document.getElementById('startBtn').click());
  await until(ctx, () => __k.game.mode === 'story', 400);
  for (let i = 0; i < 60; i++) { await ctx.ev(() => { const d = __k.story.debug; d.S.dlg = null; }); await ctx.step(-1); }
  await ctx.ev(() => { const d = __k.story.debug; d.S.dlg = null; d.S.mode = 'walk'; const t = d.today(); t.drum = 1; });
}
// put the player at a village spot and start what is offered there (label = the action button's word)
async function act(ctx, pos, label) {
  await ctx.ev(p => { const d = __k.story.debug; __k.game.p.pos.set(p[0], 0, p[1]); d.S.dlg = null; d.S.mode = 'walk'; d.snapCam(); }, pos);
  const ok = await until(ctx, l => { const n = __k.story.debug.S.near; return n && n.label === l; }, 60, label);
  if (!ok) throw new Error('nothing to ' + label + ' here');
  await ctx.ev(() => { __k.story.debug.S.act = true; });
  for (let i = 0; i < 3; i++) await ctx.step(-1);
}
const sunAxis = `const s = __k.sun.position, a = Math.atan2(s.x, s.z), sx = Math.sin(a), sz = Math.cos(a), px = -sz, pz = sx;`;
const ease = 'const e = t => t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t);';
const S8_SIDE = Number(process.env.S8_SIDE || 1), S8_H = Number(process.env.S8_H || 1.45); // the reaping camera: which side of the player, how high (2.15 on side 1 put it inside a tree)

export const SHOTS = [
  { // 1 HOOK: point of view. The bull winds up and charges straight at you; the sun is behind you
    id: 'S1', frames: 120,
    async setup(ctx) {
      await toRing(ctx); await ui(ctx, ['film-clean']);
      await ctx.ev(new Function(sunAxis + ease + `
        const g = __k.game, cx = sx * 5.8 + px * 0.25, cz = sz * 5.8 + pz * 0.25, bx = -sx * 1.4 + px * 1.75, bz = -sz * 1.4 + pz * 1.75;
        g.p.pos.set(cx, 0, cz); g.p.state = 'free'; g.p.yaw = Math.atan2(bx - cx, bz - cz); g.b.pos.set(bx, 0, bz); g.b.yaw = Math.atan2(cx - bx, cz - bz); g.b.state = 'watch'; g.b.t = 0; g.lives = 3;
        const lx = bx * 0.5 + cx * 0.42 - px * 0.5, lz = bz * 0.5 + cz * 0.42 - pz * 0.5;
        window.__cam = (c, t) => { __k.player.root.visible = false; const k = e(t / 3.2); c.fov = 50 - 4 * k; c.position.set(cx - sx * 0.3 * k, 1.32, cz - sz * 0.3 * k); c.lookAt(lx, 1.3, lz); };`));
    },
    async at(ctx, i) { if (i === 36) { await ctx.ev(() => { __k.input.tease = true; }); return 'tease'; }
      const s = await ctx.ev(() => __k.game.b.state); if (s === 'charge' && !this.c) { this.c = 1; return 'charge'; } },
  },
  { // 2 REVEAL: crane up over the ring from the sun's side: the khunt and its pitha, the bull on his rope, the village
    id: 'S2', frames: 110,
    async setup(ctx) {
      await toRing(ctx); await ui(ctx, ['film-clean']);
      await ctx.ev(new Function(sunAxis + ease + `
        const g = __k.game; g.b.pos.set(-sx * 3.2 - px * 1.5, 0, -sz * 3.2 - pz * 1.5); g.b.state = 'watch'; g.b.t = 0; g.p.pos.set(-sx * 6.5 + px * 2, 0, -sz * 6.5 + pz * 2); g.p.state = 'free';
        window.__cam = (c, t) => { __k.player.root.visible = true; const k = e(t / 3.4), a0 = Math.atan2(sx, sz) - 0.42 + 0.3 * k, r = 9 + 7.5 * k;
          c.fov = 52; c.position.set(Math.sin(a0) * r, 1.1 + 7.2 * k, Math.cos(a0) * r); c.lookAt(0, 1.9 - 0.7 * k, 0); };`));
      for (let i = 0; i < 4; i++) await ctx.step(-1);
    },
  },
  { // 3+4 THE ROUND, one take on the phone screen: tap HIDE, he charges and slams the post, step in, tap GRAB, golden pitha
    id: 'S34', frames: 250,
    async setup(ctx) {
      await toRing(ctx); await ui(ctx, ['film-ring']); // each shot opens its own place: filmed alone, this one stayed on the home screen
      // How the round is really won: stand just off his line beside the post. With the post straight between you he walks
      // round it and comes from the side (take 3: horned, no pitha); 0.8 m off the line he runs at you and the post stops him.
      // His horns reach 1 m ahead of his body and he covers about 0.23 m a frame, so you stand 1.8 m past the post along his
      // line (2 m from it) and step into the dotted ring once he is stunned.
      await ctx.ev(new Function(sunAxis + `
        const g = __k.game; window.__cam = null; __k.player.root.visible = true; __k.setGold(true);
        const dx = -sx * 0.6 + px * 0.8, dz = -sz * 0.6 + pz * 0.8, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, wx = uz, wz = -ux;
        g.b.pos.set(ux * 3.6 + wx * 0.8, 0, uz * 3.6 + wz * 0.8); g.b.yaw = Math.atan2(-ux, -uz); g.b.state = 'watch'; g.b.t = 0;
        g.p.pos.set(-ux * 1.8 + wx * 0.8, 0, -uz * 1.8 + wz * 0.8); g.p.state = 'free'; g.p.yaw = Math.atan2(ux, uz); g.lives = 3; g.pitha = 0;
        window.__hold = { b: g.b.pos.clone(), by: g.b.yaw, p: g.p.pos.clone(), py: g.p.yaw };`));
      for (let i = 0; i < 20; i++) await ctx.step(-1);
      this.btn = await rects(ctx, ['hideBtn', 'rollBtn', 'grabBtn']);
    },
    async at(ctx, i) {
      // until the bait he stands still where he was put: left alone he charges on his own, from wherever he wandered (take 2)
      if (i < 45) await ctx.ev(() => { const g = __k.game, h = window.__hold; g.b.state = 'watch'; g.b.t = 0; g.b.pos.copy(h.b); g.b.yaw = h.by; g.p.pos.copy(h.p); g.p.yaw = h.py; g.p.vel.set(0, 0, 0); g.lives = 3; });
      if (i === 45) { await ctx.ev(() => { __k.input.tease = true; }); return 'tap-hide'; } // late enough that the slam on the post can sit on a bar line with the tap still in the scene
      const s = await ctx.ev(() => ({ b: __k.game.b.state, n: __k.game.pitha, lives: __k.game.lives, r: __k.game.p.pos.length() }));
      if (s.lives < 3 && !this.hit) { this.hit = 1; return 'HORNED'; }
      if (s.b === 'charge' && !this.c) { this.c = 1; return 'charge'; }
      if ((s.b === 'stunned' || s.b === 'recover') && !this.st) { this.st = i; return 'bonk'; }
      if (this.st && !this.walked && i >= this.st + 2) { // the stick toward the post (the keys nearest its direction on screen) until inside the dotted ring
        const keys = await ctx.ev(() => { const k = __k, p = k.game.p.pos, c = k.camera.position, T = k.THREE;
          const d = new T.Vector3(-p.x, 0, -p.z).normalize(), f = new T.Vector3(p.x - c.x, 0, p.z - c.z).normalize(), r = new T.Vector3().crossVectors(f, new T.Vector3(0, 1, 0)).normalize();
          const y = -d.dot(f), x = d.dot(r), out = []; if (x > 0.38) out.push('KeyD'); if (x < -0.38) out.push('KeyA'); if (y > 0.38) out.push('KeyS'); if (y < -0.38) out.push('KeyW'); return out; });
        const up = s.r < 1.3;
        await ctx.ev(([codes, up]) => { for (const code of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) dispatchEvent(new KeyboardEvent(up || !codes.includes(code) ? 'keyup' : 'keydown', { code })); }, [keys, up]);
        if (up) { this.walked = i; return 'in-ring'; }
      }
      if (this.walked && i === this.walked + 1) { // the game's own slow-motion close-up of the snatch is kept, but seen from the side away from the
        // bull: from where the game put it, his body filled the frame and hid the pitha (take 4). A hard cut into it, then it drifts up.
        await ctx.ev(() => { const c = __k.cine; let cur = c.shot;
          Object.defineProperty(c, 'shot', { configurable: true, get() { return cur; }, set(v) {
            if (v && !v.mine) { const p = __k.game.p.pos, b = __k.game.b.pos, L0 = Math.hypot(p.x, p.z), ux = p.x / L0, uz = p.z / L0, mx = p.x * 0.5, mz = p.z * 0.5;
              const h = document.documentElement; h.classList.remove('film-ring'); h.classList.add('film-clean'); // the buttons go on the shot's first frame (one frame of them showed: take 5)
              let nx = uz, nz = -ux; if ((b.x - mx) * nx + (b.z - mz) * nz > 0) { nx = -nx; nz = -nz; }
              const cx = mx + nx * 4.1 - ux * 1.1, cz = mz + nz * 4.1 - uz * 1.1; let first = true; v.mine = true;
              v.at = (t, P, L) => { P.set(cx, 1.25 + t * 0.2, cz); L.set(mx * 0.7, 1.8, mz * 0.7); const r = { zoom: 0.95, snap: first ? 0 : 0.0004 }; first = false; return r; }; } // snap 0 = a true cut: the game's smoothing is 1 - snap^dt, and on a shot's first frame dt is tiny
            cur = v; } });
          __k.input.grab = true; });
        return 'tap-grab'; }
      if (s.n >= 1 && !this.got) { this.got = 1; await ui(ctx, ['film-clean']); return 'snatch'; }
    },
    async after() { return { buttons: this.btn }; },
  },
  { // 5 VILLAGE: beat the tamak; the pads are on screen, the dancers answer every hit
    id: 'S5', frames: 75,
    async setup(ctx) {
      await toVillage(ctx); await ui(ctx, ['film-pads']);
      const at = await ctx.ev(() => { const s = __k.story.debug.W.drumStand; return [s.x, s.z]; });
      await act(ctx, at, 'BEAT'); await ctx.ev(() => { window.__cam = null; });
      for (let i = 0; i < 30; i++) await ctx.step(-1);
      this.btn = await rects(ctx, ['padT', 'padU']);
    },
    async at(ctx, i) { const k = i % 24; if (k === 0 || k === 12 || k === 18) { const lane = k === 0 ? 'T' : 'U'; await ctx.ev(l => __k.story.debug.strike(l), lane); return 'hit-' + lane + '-' + i; } },
    async after() { return { buttons: this.btn }; },
  },
  { // 6 VILLAGE: draw the bow; the camera rides the arrow into the banana-trunk target
    id: 'S6', frames: 110,
    async setup(ctx) {
      await toVillage(ctx); await ui(ctx, ['film-clean']);
      await ctx.ev(() => { const d = __k.story.debug; if (d.S.mode === 'drum') d.drum.done = true; d.S.mode = 'walk'; document.getElementById('pads').hidden = true; });
      for (let i = 0; i < 4; i++) await ctx.step(-1);
      const a = 0.35 + 0.698132 * 1.5; await act(ctx, [Math.cos(a) * 18.5, Math.sin(a) * 18.5], 'SHOOT');
      for (let i = 0; i < 30; i++) await ctx.step(-1);
    },
    async at(ctx, i) {
      if (i === 18) { await ctx.ev(() => { const a = __k.story.debug.arch, z = document.getElementById('tapzone'), f = (t, x, y) => z.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, pointerId: 5, pointerType: 'touch', clientX: x, clientY: y, isPrimary: true }));
        a.u = 0; a.v = 0; a.held = 0; f('pointerdown', 540, 1500); f('pointermove', 541, 1500); a.u = 0; a.v = 0; }); return 'draw'; }
      if (i === 34) { await ctx.ev(() => { const a = __k.story.debug.arch, z = document.getElementById('tapzone'); a.u = 0; a.v = 0; z.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 5, pointerType: 'touch', clientX: 541, clientY: 1500, isPrimary: true })); }); return 'release'; }
    },
  },
  { // 7 VILLAGE: catch a fish; it leaps out of the pond in slow motion
    id: 'S7', frames: 120,
    async setup(ctx) {
      await toVillage(ctx); await ui(ctx, ['film-clean']);
      await ctx.ev(() => { document.getElementById('tapQuit').click(); });
      for (let i = 0; i < 20; i++) await ctx.step(-1);
      const a = 0.35 + 0.698132 * 4.5; await act(ctx, [Math.cos(a) * 20.7, Math.sin(a) * 20.7], 'FISH');
      for (let i = 0; i < 30; i++) await ctx.step(-1);
    },
    async at(ctx, i) {
      if (i === 6) { await ctx.ev(() => { __k.story.debug.S.tap = true; }); return 'cast'; }
      if (i === 8) await ctx.ev(() => { __k.story.debug.fish.bite = 0.9; });
      const st = await ctx.ev(() => __k.story.debug.fish.st);
      if (st === 'bite' && !this.b) { this.b = i; return 'bite'; }
      if (this.b && i === this.b + 5) { await ctx.ev(() => { __k.story.debug.S.tap = true; }); return 'land'; }
    },
  },
  { // 8 VILLAGE: reap the golden paddy with the sickle; a scarecrow stands in the plot behind
    id: 'S8', frames: 80,
    async setup(ctx) {
      await toVillage(ctx); await ui(ctx, ['film-clean']);
      await ctx.ev(() => { document.getElementById('tapQuit').click(); });
      for (let i = 0; i < 20; i++) await ctx.step(-1);
      await ctx.ev(new Function(sunAxis + ease + `
        const P = __k.paddyFields.plots.filter(p => p.crow), want = Math.atan2(-sz, -sx); let best = P[0], bd = 9;
        for (const p of P) { let d = (p.a0 + p.a1) / 2 - want; d = Math.abs(Math.atan2(Math.sin(d), Math.cos(d))); if (d < bd) { bd = d; best = p; } }
        const am = (best.a0 + best.a1) / 2 + 0.035, ox = Math.cos(am), oz = Math.sin(am), r = best.r0 + 0.35, tx = -oz, tz = ox;
        // he works the first row of the plot, turned a little out into it; the camera stands on the grass inside the plot's
        // edge, three-quarter in front of him, so no paddy is between it and him and the sun (behind the village) is at its back.
        // (Takes 2-3: cameras out in the plot saw stalks, a head, a tree trunk; and stepping 0.45 m between strokes was a jump cut)
        const fx = tx * 0.92 + ox * 0.39, fz = tz * 0.92 + oz * 0.39;
        const d = __k.story.debug, p = __k.game.p; p.pos.set(ox * r, 0, oz * r); p.yaw = Math.atan2(fx, fz); d.S.mode = 'walk'; d.S.dlg = null;
        window.__y0 = p.yaw;
        const Q = { x: ox * r, z: oz * r }, cx = Q.x - ox * 2.7 + tx * 2.3 * ${S8_SIDE}, cz = Q.z - oz * 2.7 + tz * 2.3 * ${S8_SIDE};
        window.__s8 = { fy: Math.atan2(fx, fz), tx, tz }; const sm = { x: Q.x, z: Q.z };
        window.__cam = (c, t) => { const pp = __k.game.p.pos; sm.x += (pp.x - sm.x) * 0.1; sm.z += (pp.z - sm.z) * 0.1; /* follows him along the row, smoothly: he moves in short steps */
          const mx = (sm.x - Q.x) * 0.55, mz = (sm.z - Q.z) * 0.55; c.fov = 44; c.position.set(cx + mx, ${S8_H}, cz + mz); c.lookAt(sm.x + ox * 0.7, 0.85, sm.z + oz * 0.7); };`));
      for (let i = 0; i < 6; i++) await ctx.step(-1);
    },
    async at(ctx, i) { // a stroke, then a short step along the row, as you really reap: one stroke cuts all within reach (standing still gave two strokes, then nothing)
      const k = i % 20;
      if (k < 2) await ctx.ev(() => { const p = __k.game.p, s = window.__s8; let d = s.fy - 0.14 - p.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); p.yaw += d * 0.5; }); // turn back toward the paddy after the step
      if (k >= 2 && k < 16) await ctx.ev(k => { const p = __k.game.p, s = window.__s8; p.yaw = s.fy + (k - 9) * 0.02; if (k === 2) __k.story.debug.S.act = true; }, k);
      if (k >= 16) { // the stick along the row (the keys nearest that direction on screen), three frames, then let go
        await ctx.ev(up => { const k = __k, p = k.game.p.pos, c = k.camera.position, T = k.THREE, s = window.__s8, codes = [];
          const d = new T.Vector3(s.tx, 0, s.tz), f = new T.Vector3(p.x - c.x, 0, p.z - c.z).normalize(), r = new T.Vector3().crossVectors(f, new T.Vector3(0, 1, 0)).normalize(), y = -d.dot(f), x = d.dot(r);
          if (x > 0.38) codes.push('KeyD'); if (x < -0.38) codes.push('KeyA'); if (y > 0.38) codes.push('KeyS'); if (y < -0.38) codes.push('KeyW');
          for (const code of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) dispatchEvent(new KeyboardEvent(up || !codes.includes(code) ? 'keyup' : 'keydown', { code })); }, k === 19);
      }
      if (k === 2) return 'cut-' + i;
    },
  },
  { // 9 OUTRO: back at the khunt. A low camera from the sun's side looks up at the bull and the post with its
    // pitha, the sky above left for the title. (A crane over the paddy ran into a tree: 25 Nov, first take.)
    id: 'S9', frames: 110,
    async setup(ctx) {
      await toRing(ctx); await ui(ctx, ['film-clean']);
      // the bull stands three-quarter to the lens beside the khunt, held there every frame: left in 'watch' he turns to
      // face the player, which put his rump to the camera (take 1). Low camera on the sun's side, slow push in; sky above for the words
      await ctx.ev(new Function(sunAxis + ease + `
        const g = __k.game; __k.setGold(false);
        const bx = px * 2.3 + sx * 0.9, bz = pz * 2.3 + sz * 0.9, dx = sx - px * 0.9, dz = sz - pz * 0.9;
        g.b.pos.set(bx, 0, bz); g.b.yaw = Math.atan2(dx, dz); g.b.state = 'watch'; g.b.t = 0;
        g.p.pos.set(-px * 2.0 - sx * 0.6, 0, -pz * 2.0 - sz * 0.6); g.p.state = 'free'; g.p.yaw = Math.atan2(px, pz);
        window.__hold = { b: g.b.pos.clone(), by: g.b.yaw, p: g.p.pos.clone(), py: g.p.yaw };
        window.__cam = (c, t) => { __k.player.root.visible = true; const k = e(t / 3.6), a0 = Math.atan2(sx, sz) + 0.16 - 0.1 * k, r = 10.2 - 1.0 * k;
          c.fov = 48; c.position.set(Math.sin(a0) * r, 0.85 + 0.15 * k, Math.cos(a0) * r); c.lookAt(px * 1.5, 2.5, pz * 1.5); };`));
      for (let i = 0; i < 6; i++) await ctx.step(-1);
    },
    async at(ctx) { await ctx.ev(() => { const g = __k.game, h = window.__hold; g.b.state = 'watch'; g.b.t = 0; g.b.pos.copy(h.b); g.b.yaw = h.by; g.p.pos.copy(h.p); g.p.yaw = h.py; g.p.vel.set(0, 0, 0); }); },
  },
];
