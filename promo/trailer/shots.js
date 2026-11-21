// Trailer shot list. Each shot: frames, speed(t) for slow motion, setup(), update(t) to place camera and drive the action
// before the game steps, and draw(ctx, t) for overlays after the 3D frame is in. Runs inside the game page.
(() => {
  const T = __T, THREE = T.THREE, O = __OV, E = O.E, clamp = O.clamp, lerp = O.lerp;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const tmp = new THREE.Vector3();
  function cam(pos, look, fov) { T.camera.position.copy(pos); T.camera.lookAt(look); if (fov && Math.abs(T.camera.fov - fov) > 0.01) { T.camera.fov = fov; T.camera.updateProjectionMatrix(); } }
  function bullPose(x, z, yaw, anim, o) { const b = T.game.b; b.state = 'trailer'; b.pos.set(x, 0, z); b.yaw = yaw; if (anim) T.bull.play(anim, o); }
  function plPose(x, z, yaw, anim, o) { const p = T.game.p; p.state = 'trailer'; p.pos.set(x, 0, z); p.yaw = yaw; if (anim) T.player.play(anim, o); }
  const yawTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);
  function reset() {
    const g = T.game; g.mode = 'play'; g.online = false; g.menuOpen = false; g.spectator = false;
    Object.assign(g.p, { invuln: 0, teaseCd: 0, rollCd: 0, t: 0, teaseT: -9 }); g.p.vel.set(0, 0, 0);
    g.charges = 5; g.pithaReady = true; g.pithaTimer = 0; T.pitha.visible = true; T.pitha.scale.setScalar(1);
    g.combo = 0; g.score = 0; g.b.hitDone = true; g.b.dur = 999; g.b.t = 0; T.arrow.material.opacity = 0; g.shake = 0;
    Object.assign(T.input, { x: 0, y: 0, roll: false, grab: false, tease: false }); for (const k in T.keys) T.keys[k] = false;
    for (const c of T.crowd) { c.wrap.position.copy(c.home); c.wrap.rotation.y = c.homeYaw; c.busy = false; c.goingHome = false; c.play('Idle', { fade: 0 }); }
    T.party.partner = null; T.party.phase = 'none';
    T.player.wrap.visible = true; T.player.wrap.position.y = 0;
    T.camLock = true;
  }
  const keepSafe = () => { const b = T.game.b; b.hitDone = true; };
  let extras = [];
  function clearExtras() { for (const e of extras) { T.scene.remove(e.wrap); } extras = []; if (T.player.youTag) { T.player.wrap.remove(T.player.youTag); T.player.youTag = null; } }

  const logo = new Image(); logo.src = '/tumdah.png';
  function tumdah(c, t, start, dur, x, y, h, label) { // badge + wordmark lockup
    const lt = t - start; if (lt < 0 || lt > dur) return; const p = E.outExpo(lt / 0.7), o = 1 - clamp((lt - (dur - 0.4)) / 0.4, 0, 1);
    c.save(); c.globalAlpha = p * o; c.translate(0, (1 - p) * 18);
    c.font = '800 ' + Math.round(h * 0.3) + 'px "Baloo 2", system-ui, sans-serif'; c.letterSpacing = Math.round(h * 0.12) + 'px'; c.textBaseline = 'middle';
    const lw = c.measureText(label).width, ww = (c.font = '800 ' + Math.round(h * 0.62) + 'px "Baloo 2", system-ui, sans-serif', c.letterSpacing = Math.round(h * 0.06) + 'px', c.measureText('TUMDAH').width);
    const total = lw + h * 0.35 + h * 1.15 + h * 0.3 + ww; let cx = x - total / 2;
    c.font = '800 ' + Math.round(h * 0.3) + 'px "Baloo 2", system-ui, sans-serif'; c.letterSpacing = Math.round(h * 0.12) + 'px'; c.fillStyle = 'rgba(246,238,221,.85)'; c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 14; c.fillText(label, cx, y); cx += lw + h * 0.35;
    const r = h * 0.575; c.shadowBlur = 24; c.shadowColor = 'rgba(40,180,90,.55)'; c.fillStyle = '#f6eedd'; c.beginPath(); c.arc(cx + r, y, r, 0, 7); c.fill(); c.shadowBlur = 0;
    if (logo.complete && logo.naturalWidth) { const lh = r * 1.3, lww = lh * logo.naturalWidth / logo.naturalHeight; c.drawImage(logo, cx + r - lww / 2, y - lh / 2 + r * 0.04, lww, lh); }
    cx += r * 2 + h * 0.3; c.font = '800 ' + Math.round(h * 0.62) + 'px "Baloo 2", system-ui, sans-serif'; c.letterSpacing = Math.round(h * 0.06) + 'px'; c.fillStyle = '#ffffff'; c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 16; c.fillText('TUMDAH', cx, y + h * 0.04);
    c.restore(); }
  const F = s => Math.round(s * 30);
  const BIG = O.BIG, BOLD = O.BOLD, W = O.W, H = O.H;
  const shots = [];

  // S1 — establishing crane over the village at golden hour
  shots.push({ id: 'S1', frames: F(5.5), setup() { reset(); bullPose(2.3, -1.5, -2.2, 'Idle'); plPose(-9.5, -7, 0.9, 'Idle'); __dof(30, 0, 0); },
    update(t) { const k = E.inOut(t / 5.5), th = lerp(-1.95, -1.55, k), r = lerp(42, 19, k); cam(V(Math.cos(th) * r, lerp(15, 4.6, k), Math.sin(th) * r), V(0, lerp(0.2, 1.1, k), 0), 34); },
    draw(c, t) { O.leak(c, t, 1.2); tumdah(c, t, 0.35, 2.0, W / 2, H * 0.5, 96, 'A GAME BY'); O.line(c, { text: 'EVERY HARVEST', font: BIG, size: 150, x: W / 2, y: H * 0.8, t, start: 2.2, dur: 3.1, tracking: 0.06 }); O.letterbox(c, 1); O.fade(c, 1 - t / 0.9); } });

  // S2 — the drum troupe, low tracking shot
  shots.push({ id: 'S2', frames: F(3.5), setup() { reset(); bullPose(2.3, -1.5, -2.2, 'Idle'); },
    update(t) { const d = T.drummers[1].wrap.position, f = d.clone().normalize(), side = V(-f.z, 0, f.x), k = t / 3.5;
      const p = d.clone().addScaledVector(f, -3.0).addScaledVector(side, lerp(1.9, -0.6, k)); p.y = lerp(0.85, 1.05, k);
      cam(p, V(d.x - f.x * 0.4, 1.0, d.z - f.z * 0.4), 32); __dof(p.distanceTo(d), 0.014, 0.012); },
    draw(c, t) { O.line(c, { text: 'THE DRUMS BEGIN', font: BIG, size: 104, x: 150, y: H * 0.78, align: 'left', t, start: 0.25, dur: 3.2, tracking: 0.05 }); O.letterbox(c, 1); } });

  // S3 — the bull tied to the khunt, slow low orbit
  shots.push({ id: 'S3', frames: F(4.0), setup() { reset(); __dof(4, 0.009, 0.012); },
    update(t) { const B = V(-1.9, 0, -2.6), k = E.inOut(t / 4), ph = lerp(-1.75, -2.35, k);
      const C = V(B.x + Math.cos(ph) * 7.2, lerp(0.6, 0.9, k), B.z + Math.sin(ph) * 7.2);
      bullPose(B.x, B.z, yawTo(B, C) + 0.35 * Math.sin(t * 0.8), t > 2.6 ? 'Idle_Headlow' : 'Idle_2', { ts: 0.9 });
      cam(C, V(B.x, 1.25, B.z), 30); __dof(C.distanceTo(B) - 0.4, 0.009, 0.012); },
    draw(c, t) { O.line(c, { text: 'SOHRAI', font: BIG, size: 210, x: W / 2, y: H * 0.5, t, start: 0.3, dur: 3.6, tracking: 0.12, push: 0.025 });
      O.sub(c, { text: 'ONE BULL  ·  ONE KHUNT', size: 30, x: W / 2, y: H * 0.5 + 78, t, start: 1.1, dur: 2.8 }); O.letterbox(c, 1); } });

  // S4 — up the post to the pitha
  shots.push({ id: 'S4', frames: F(3.0), setup() { reset(); bullPose(2.6, 2.4, -2.4, 'Idle'); },
    update(t) { const k = E.inOut(t / 3), ph = lerp(-2.05, -2.35, k), rr = lerp(1.6, 1.25, k);
      const C = V(Math.cos(ph) * rr, lerp(0.9, 2.35, k), Math.sin(ph) * rr), L = T.pitha.getWorldPosition(tmp).clone();
      cam(C, V(L.x * k, lerp(1.2, L.y, k), L.z * k), 30); __dof(C.distanceTo(L), 0.012, 0.012); },
    draw(c, t) { O.leak(c, t + 2, 1); O.line(c, { text: 'THE PITHA', font: BIG, size: 128, x: W - 150, y: H * 0.74, align: 'right', t, start: 0.9, dur: 2.1, tracking: 0.05 }); O.letterbox(c, 1); } });

  // S5 — over the shoulder: walking into the ring
  shots.push({ id: 'S5', frames: F(3.0), setup() { reset(); bullPose(-2.0, -2.4, 0, 'Idle'); },
    update(t) { const k = t / 3, P = V(lerp(-6.4, -4.7, k), 0, lerp(-7.5, -5.6, k)), B = V(-2.0, 0, -2.4);
      plPose(P.x, P.z, yawTo(P, B), 'Walk', { ts: 0.9 });
      bullPose(B.x, B.z, yawTo(B, P), t > 1.7 ? 'Idle_Headlow' : 'Idle', { ts: 1.3 });
      const back = P.clone().sub(B).setY(0).normalize(), right = V(back.z, 0, -back.x);
      const C = P.clone().addScaledVector(back, 1.7).addScaledVector(right, 0.62); C.y = 1.55;
      cam(C, V(B.x, 1.0, B.z), 33); __dof(C.distanceTo(B), 0.008, 0.01); },
    draw(c, t) { O.line(c, { text: 'ONLY THE BRAVE', font: BIG, size: 120, x: W / 2, y: H * 0.5, t, start: 0.9, dur: 2.05, tracking: 0.06 }); O.letterbox(c, 1); O.fade(c, (t - 2.75) / 0.25); } });

  // S5b — a beat of black before the drop
  shots.push({ id: 'S5b', frames: F(0.4), noRender: true, setup() {}, update() {}, draw(c) { c.fillStyle = '#000'; c.fillRect(0, 0, W, H); } });

  // S6 — wave the hide; the bull answers
  shots.push({ id: 'S6', frames: F(2.4), setup() { reset(); T.game.b.state = 'watch'; T.game.b.pos.set(-1.1, 0, -1.3); T.game.b.yaw = -2.4; T.game.p.state = 'free'; T.game.p.pos.set(-4.1, 0, -4.9); T.game.p.yaw = 0.7; T.player.play('Idle', { fade: 0 }); __dof(4, 0.008, 0.01); },
    update(t) { keepSafe(); if (Math.abs(t - 0.2) < 0.02) T.input.tease = true;
      const P = T.game.p.pos, B = T.game.b.pos, d = B.clone().sub(P).setY(0).normalize(), perp = V(-d.z, 0, d.x);
      const C = P.clone().addScaledVector(d, 0.9).addScaledVector(perp, 3.4 + t * 0.15); C.y = 1.25 - t * 0.08;
      cam(C, P.clone().addScaledVector(d, 1.4).setY(1.15), 34); __dof(C.distanceTo(P), 0.008, 0.01); },
    draw(c, t) { O.flash(c, t, 0, 0.18); O.line(c, { text: 'WAVE THE HIDE', font: BIG, size: 150, x: W / 2, y: H * 0.86, t, start: 0.05, dur: 2.3, mode: 'slam', tracking: 0.04, outLen: 0.18 }); } });

  // S7 — the charge, with a slow-motion dodge
  const S7 = { P: V(-3.7, 0, -4.4), B: V(-0.95, 0, -1.05), rolled: false, slowAt: -1 };
  shots.push({ id: 'S7', frames: F(3.2),
    speed(t) { if (S7.slowAt < 0) return 1; const u = t - S7.slowAt; return u < 0 ? 1 : u < 1.1 ? 0.22 : u < 1.4 ? lerp(0.22, 1, (u - 1.1) / 0.3) : 1; },
    setup() { reset(); S7.rolled = false; S7.slowAt = -1; const g = T.game, b = g.b;
      g.p.state = 'free'; g.p.pos.copy(S7.P); g.p.yaw = yawTo(S7.P, S7.B); T.player.play('Idle', { fade: 0 });
      b.pos.copy(S7.B); b.yaw = yawTo(S7.B, S7.P); T.setBull('watch', 999); __dof(5, 0.006, 0.01); },
    update(t) { const g = T.game, b = g.b, p = g.p;
      if (t >= 0.3 && b.state === 'watch') { b.dir.copy(S7.P).sub(b.pos).setY(0).normalize(); b.yaw = Math.atan2(b.dir.x, b.dir.z); b.speed = 12; b.dist = 8.5; b.hoof = 0; b.minD = 99; b.provoked = false; T.setBull('charge', 3); }
      keepSafe();
      const dist = b.pos.distanceTo(p.pos);
      if (b.state === 'charge' && S7.slowAt < 0 && dist < 3.3) S7.slowAt = t;
      if (b.state === 'charge' && !S7.rolled && dist < 2.0) { S7.rolled = true; const side = V(-b.dir.z, 0, b.dir.x); p.yaw = Math.atan2(side.x, side.z); p.state = 'free'; T.input.roll = true; }
      const back = S7.P.clone().sub(S7.B).setY(0).normalize(), side = V(-back.z, 0, back.x);
      const C = S7.P.clone().addScaledVector(back, 4.2).addScaledVector(side, -3.4); C.y = 0.8;
      const look = b.pos.clone().lerp(p.pos, 0.35).setY(0.95);
      cam(C, look, 34); __dof(C.distanceTo(p.pos), 0.006, 0.01); },
    draw(c, t) { O.flash(c, t, 0, 0.12); O.line(c, { text: 'DODGE THE CHARGE', font: BIG, size: 140, x: W / 2, y: H * 0.2 + 70, t, start: 0.05, dur: 3.0, mode: 'slam', tracking: 0.04, outLen: 0.18 }); } });

  // S8 — the grab
  shots.push({ id: 'S8', frames: F(2.6), speed(t) { const p = T.game.p; return p.state === 'grab' && p.t > 0.28 && p.t < 0.62 ? 0.35 : 1; },
    setup() { reset(); bullPose(-3.2, 3.6, 2.4, 'Idle_HitReact1', { once: true }); const g = T.game; g.p.state = 'free'; g.p.pos.set(-0.75, 0, -0.85); g.p.yaw = yawTo(g.p.pos, V(0, 0, 0)); T.player.play('Idle', { fade: 0 }); },
    update(t) { const p = T.game.p; if (Math.abs(t - 0.25) < 0.02 && p.state === 'free') T.input.grab = true;
      if (p.state === 'grab' && p.t >= 0.9) T.celebrate('victory', () => T.game.p.pos, true);
      const C = V(-3.9, 0.85, -3.1); cam(C, V(-0.3, lerp(1.2, 1.45, clamp(t / 2.6, 0, 1)), -0.3), 34); __dof(C.distanceTo(p.pos), 0.009, 0.012); },
    draw(c, t) { O.line(c, { text: 'SNATCH THE PITHA', font: BIG, size: 136, x: W / 2, y: H * 0.86, t, start: 0.05, dur: 2.5, mode: 'slam', tracking: 0.04, outLen: 0.18 }); } });

  // S9 — the high-five
  shots.push({ id: 'S9', frames: F(2.6), setup() { reset(); bullPose(1.8, 2.0, 2.4, 'Idle');
      let best = null, bd = 1e9; for (const cr of T.crowd) if (cr.kind !== 'man') { const d = cr.home.distanceTo(V(-8, 0, -8)); if (d < bd) { bd = d; best = cr; } }
      const toward = best.home.clone().setY(0).normalize(); const P = best.home.clone().addScaledVector(toward, -2.6);
      plPose(P.x, P.z, yawTo(P, best.home), 'Idle', { fade: 0 }); this.P = P; this.home = best.home.clone();
      const mid = P.clone().lerp(this.home, 0.45), f = this.home.clone().sub(P).setY(0).normalize(), side = V(-f.z, 0, f.x);
      this.C = mid.clone().addScaledVector(side, -5.6).setY(1.35); cam(this.C, mid.clone().setY(1.1), 33); this.mid = mid;
      T.game.p.state = 'free'; },
    update(t) { if (Math.abs(t - 0.12) < 0.02) T.celebrate('hifive', () => T.game.p.pos, true);
      cam(this.C.clone().addScaledVector(V(0, 0, 0), 0), this.mid.clone().setY(1.1), lerp(33, 30, t / 2.6)); __dof(this.C.distanceTo(this.mid), 0.008, 0.01); },
    draw(c, t) { O.sub(c, { text: 'COMBOS  ·  RANKS  ·  BRAGGING RIGHTS', size: 34, x: W / 2, y: H * 0.88, t, start: 0.4, dur: 2.15, color: '#ffd58a' }); } });

  // S10 — play with friends
  shots.push({ id: 'S10', frames: F(4.0), setup() { reset(); clearExtras();
      const mk = (kind, name, col, x, z) => { const a = T.actor(T.loaded[kind], 1.72, true); T.tint(a, { Skin: 0x6b4126, Shirt: col, Pants: 0x3b3a36, Hair: 0x15100c }); T.shadows(a); T.giveHide(a); a.wrap.add(T.nameTag(name, '#' + col.toString(16).padStart(6, '0'))); a.wrap.position.set(x, 0, z); T.scene.add(a.wrap); a.play('Idle', { fade: 0 }); a.name = name; extras.push(a); return a; };
      this.sona = mk('woman', 'Sona', 0x3d8bd9, 4.6, -3.2); this.birsa = mk('man', 'Birsa', 0x4caf50, -4.4, 3.4);
      T.player.youTag = T.nameTag('You', '#e8b33c'); T.player.wrap.add(T.player.youTag);
      plPose(-3.6, -4.6, 0.6, 'Idle', { fade: 0 }); bullPose(-1.0, -2.4, 0, 'Idle'); __dof(9, 0.004, 0.008); },
    update(t, dt) { const S = this.sona, Bi = this.birsa, B = T.game.b.pos;
      S.wrap.rotation.y = yawTo(S.wrap.position, B);
      if (t > 0.35 && !S.waved) { S.waved = true; S.play('SwordSlash', { once: true, ts: 1.5, fade: 0.08 }); S.flap = 1.1; }
      // bull swings round to the hide, head low
      const yawS = yawTo(B, S.wrap.position); const by = T.game.b.yaw + Math.atan2(Math.sin(yawS - T.game.b.yaw), Math.cos(yawS - T.game.b.yaw)) * Math.min(1, dt * 3);
      bullPose(lerp(-1.0, 0.6, E.inOut((t - 0.9) / 1.6)), lerp(-2.4, -2.8, E.inOut((t - 0.9) / 1.6)), by, t > 0.7 ? (t > 1.0 && t < 2.6 ? 'Walk' : 'Idle_Headlow') : 'Idle', { ts: 1.2 });
      // you and Birsa race for the post
      const k = E.inOut((t - 0.6) / 2.6), P = V(lerp(-3.6, -1.0, k), 0, lerp(-4.6, -0.9, k));
      plPose(P.x, P.z, yawTo(P, V(0, 0, 0)), t > 0.6 && t < 3.2 ? 'Run' : 'Idle', { ts: 1.0 });
      const kb = E.inOut((t - 0.8) / 2.6); Bi.wrap.position.set(lerp(-4.4, -1.1, kb), 0, lerp(3.4, 0.9, kb)); Bi.wrap.rotation.y = yawTo(Bi.wrap.position, V(0, 0, 0)); Bi.play(t > 0.8 && t < 3.4 ? 'Run' : 'Idle', { fade: 0.15 });
      for (const a of extras) { a.mixer.update(dt); T.flapHide(a, dt); }
      const k2 = E.inOut(t / 4), C = V(lerp(-11.5, -9.5, k2), lerp(5.6, 4.2, k2), lerp(-1.5, -0.2, k2)); cam(C, V(0, 0.9, -0.4), 36); __dof(C.length(), 0.004, 0.008); },
    draw(c, t) { O.line(c, { text: 'PLAY WITH FRIENDS', font: BIG, size: 124, x: W / 2, y: H * 0.2 + 40, t, start: 0.2, dur: 3.7, tracking: 0.05 });
      O.sub(c, { text: 'LIVE VOICE CHAT  ·  UP TO 6 PLAYERS', size: 32, x: W / 2, y: H * 0.2 + 108, t, start: 1.0, dur: 2.9 }); },
    teardown() { clearExtras(); } });

  // S11 — the bull slams the post; you dance
  const S11 = { hit: false, hitAt: -1 };
  shots.push({ id: 'S11', frames: F(2.8),
    speed(t) { if (S11.hitAt < 0) return 1; const u = t - S11.hitAt; return u < -0 ? 1 : u < 0.45 ? 0.3 : 1; },
    setup() { reset(); S11.hit = false; S11.hitAt = -1; const g = T.game, b = g.b; g.p.state = 'free'; g.p.pos.set(0.2, 0, 2.1); g.p.yaw = Math.PI; T.player.play('Idle', { fade: 0 });
      b.pos.set(0, 0, -4.6); b.yaw = 0; T.setBull('watch', 999); __dof(5, 0.007, 0.01); },
    update(t) { const g = T.game, b = g.b;
      if (t >= 0.15 && b.state === 'watch' && !S11.started) { S11.started = true; b.dir.set(0, 0, 1); b.yaw = 0; b.speed = 12.5; b.dist = 8; b.hoof = 0; b.minD = 99; T.setBull('charge', 3); }
      keepSafe();
      if (b.state === 'stunned' && S11.hitAt < 0) { S11.hitAt = t; }
      if (S11.hitAt > 0 && t - S11.hitAt > 0.5 && g.p.state === 'free' && !S11.danced) { S11.danced = true; T.celebrate('dance', () => T.game.p.pos, true); }
      const sh = S11.hitAt > 0 ? Math.max(0, 1 - (t - S11.hitAt) / 0.5) * 0.12 : 0;
      const C = V(-4.6 + (Math.random() - .5) * sh, 0.7 + (Math.random() - .5) * sh, -0.6); cam(C, V(0, 1.0, 0.5), 38); __dof(4.7, 0.006, 0.01); },
    draw(c, t) { O.line(c, { text: 'BEAT THEIR SCORE', font: BIG, size: 132, x: W / 2, y: H * 0.86, t, start: 0.2, dur: 2.55, tracking: 0.05 }); if (S11.hitAt > 0) O.flash(c, t, S11.hitAt, 0.15); } });
  S11.started = false; S11.danced = false;
  const s11 = shots[shots.length - 1], s11setup = s11.setup; s11.setup = function () { S11.started = false; S11.danced = false; s11setup.call(this); };

  // S12 — title card over a hero still
  shots.push({ id: 'S12', frames: F(7.0), noRender: true,
    setup() { reset(); T.noRender = false; bullPose(-0.95, -1.2, -2.2, 'Idle_Headlow'); plPose(-4.2, -5.3, yawTo(V(-4.2, 0, -5.3), V(-0.9, 0, -1.2)), 'Idle', { fade: 0 });
      // one beautiful backlit frame: low, into the sun, silhouettes against the sky
      cam(V(-7.8, 0.5, -10.2), V(0, 1.7, 0), 34); __dof(9, 0.006, 0.01); T.post.bloom.strength = 0.55;
      __step(1000 / 30); __step(1000 / 30); this.still = document.createElement('canvas'); this.still.width = 1920; this.still.height = 1080; this.still.getContext('2d').drawImage(T.renderer.domElement, 0, 0, 1920, 1080); T.post.bloom.strength = 0.32; },
    update() {},
    draw(c, t) {
      const s = 1.04 + t * 0.012; c.save(); c.translate(W / 2, H / 2); c.scale(s, s); c.translate(-W / 2, -H / 2); c.filter = `blur(${lerp(0, 3, clamp((t - 0.4) / 1.5, 0, 1)).toFixed(1)}px) brightness(${lerp(1, 0.55, clamp((t - 0.4) / 1.5, 0, 1))})`; c.drawImage(this.still, 0, 0); c.restore(); c.filter = 'none';
      O.leak(c, t, 1.1);
      c.save(); c.globalAlpha = E.out((t - 0.35) / 0.8); c.font = '600 46px "Noto Sans Ol Chiki", sans-serif'; c.textAlign = 'center'; c.fillStyle = '#ffb347'; c.letterSpacing = '10px'; c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 20; c.fillText('ᱠᱷᱩᱱᱴᱟᱣ', W / 2, H * 0.3); c.restore();
      O.line(c, { text: 'KHUNTAU', font: BIG, size: 270, x: W / 2, y: H * 0.53, t, start: 0.6, dur: 6.4, tracking: 0.08, stagger: 0.07, push: 0.008, outLen: 0.5, sweep: true });
      O.rule(c, W / 2, H * 0.53 + 46, 520, t, 1.5, 5.5);
      O.sub(c, { text: 'THE SOHRAI BULL GAME', size: 40, x: W / 2, y: H * 0.53 + 110, t, start: 1.6, dur: 5.4 });
      O.sub(c, { text: 'PLAY FREE  ·  IN YOUR BROWSER', size: 34, x: W / 2, y: H * 0.79, t, start: 3.3, dur: 3.7, color: '#ffd58a' });
      O.sub(c, { text: 'khuntau.dulalkisku0.workers.dev', size: 30, x: W / 2, y: H * 0.79 + 52, t, start: 3.8, dur: 3.2 });
      tumdah(c, t, 2.4, 4.6, W / 2, H * 0.095 + 20, 62, 'POWERED BY');
      O.fade(c, (t - 6.4) / 0.6);
    } });

  window.__SHOTS = shots;
  window.__runShot = function (i) { const s = shots[i]; s.t = 0; s.setup(); return s.frames; };
  window.__frame = function (i, f, render) {
    const s = shots[i], t = f / 30, spd = s.speed ? s.speed(t) : 1, dt = spd / 30;
    s.update(t, dt);
    T.noRender = !render || !!s.noRender;
    if (!s.noRender) { __step(dt * 1000); __motes(T.game.t); }
    if (!render) return null;
    const c = T.octx; c.save(); c.filter = 'none'; c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    if (!s.noRender) { c.imageSmoothingQuality = 'high'; c.drawImage(T.renderer.domElement, 0, 0, 1920, 1080); } else { c.fillStyle = '#000'; c.fillRect(0, 0, 1920, 1080); }
    c.restore();
    s.draw(c, t); O.vignette(c);
    return T.out.toDataURL('image/jpeg', 0.92);
  };
  window.__endShot = function (i) { const s = shots[i]; if (s.teardown) s.teardown(); };
})();
