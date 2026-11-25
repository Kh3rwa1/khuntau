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

export const SHOTS = [
  { // 1 HOOK: point of view. The garlanded bull winds up and charges straight at you; the sun is behind you
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
  { // 3+4 THE ROUND, one take on the phone screen: tap HIDE, he charges and slams the post, tap GRAB, golden pitha
    id: 'S34', frames: 250,
    async setup(ctx) {
      await toRing(ctx); await ui(ctx, ['film-ring']); // each shot opens its own place: filmed alone, this one stayed on the home screen
      await ctx.ev(new Function(sunAxis + `
        const g = __k.game; window.__cam = null; __k.player.root.visible = true; __k.setGold(true);
        const dx = -sx * 0.6 + px * 0.8, dz = -sz * 0.6 + pz * 0.8, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L;
        g.b.pos.set(ux * 3.6, 0, uz * 3.6); g.b.yaw = Math.atan2(-ux, -uz); g.b.state = 'watch'; g.b.t = 0;
        g.p.pos.set(-ux * 1.38, 0, -uz * 1.38); /* inside the 1.45 m grab circle, but far enough that he hits the post before his horns reach you */ g.p.state = 'free'; g.p.yaw = Math.atan2(ux, uz); g.lives = 3; g.pitha = 0;
        window.__hold = { b: g.b.pos.clone(), by: g.b.yaw, p: g.p.pos.clone(), py: g.p.yaw };`));
      for (let i = 0; i < 20; i++) await ctx.step(-1);
      this.btn = await rects(ctx, ['hideBtn', 'rollBtn', 'grabBtn']);
    },
    async at(ctx, i) {
      // until the bait he stands still where he was put: left alone he charges on his own, from wherever he wandered (take 2)
      if (i < 45) await ctx.ev(() => { const g = __k.game, h = window.__hold; g.b.state = 'watch'; g.b.t = 0; g.b.pos.copy(h.b); g.b.yaw = h.by; g.p.pos.copy(h.p); g.p.yaw = h.py; g.p.vel.set(0, 0, 0); g.lives = 3; });
      if (i === 45) { await ctx.ev(() => { __k.input.tease = true; }); return 'tap-hide'; } // late enough that the slam on the post can sit on a bar line with the tap still in the scene
      const s = await ctx.ev(() => ({ b: __k.game.b.state, n: __k.game.pitha }));
      if (s.b === 'charge' && !this.c) { this.c = 1; return 'charge'; }
      if ((s.b === 'stunned' || s.b === 'recover') && !this.st) { this.st = i; return 'bonk'; }
      if (this.st && i === this.st + 10) { await ctx.ev(() => { __k.input.grab = true; }); return 'tap-grab'; }
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
        const am = (best.a0 + best.a1) / 2 + 0.035, ox = Math.cos(am), oz = Math.sin(am), r = best.r0 + 0.35;
        const d = __k.story.debug, p = __k.game.p; p.pos.set(ox * r, 0, oz * r); p.yaw = Math.atan2(ox, oz); d.S.mode = 'walk'; d.S.dlg = null;
        // from the player's side, a little ahead: the scarecrow stands in the plot beyond, the cut sheaves fall to the
        // other side, the low sun rakes across the paddy (a camera behind the player put the sheaves in front of the lens)
        const tx = -oz, tz = ox, cx = ox * (r + 0.7) + tx * 3.4, cz = oz * (r + 0.7) + tz * 3.4;
        window.__cam = (c, t) => { const k = e(t / 2.6); c.fov = 44; c.position.set(cx - ox * 0.3 * k, 1.35 - 0.1 * k, cz - oz * 0.3 * k); c.lookAt(ox * (r + 1.3) + tx * 0.2, 0.95, oz * (r + 1.3) + tz * 0.2); };`));
      for (let i = 0; i < 6; i++) await ctx.step(-1);
    },
    async at(ctx, i) { if (i % 16 === 4) { await ctx.ev(i => { const d = __k.story.debug, p = __k.game.p; if (i > 4) p.pos.set(p.pos.x + Math.sin(p.yaw) * 0.45, 0, p.pos.z + Math.cos(p.yaw) * 0.45); d.S.act = true; }, i); return 'cut-' + i; } },
  },
  { // 9 OUTRO: back at the khunt. A low camera from the sun's side looks up at the garlanded bull and the post with its
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
