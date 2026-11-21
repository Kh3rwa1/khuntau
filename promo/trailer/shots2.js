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
    T.camLock = true; T.camera.up.set(0, 1, 0);
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
  const DEV = '800 SIZEpx "Baloo 2", sans-serif';
  const beats = (t, list, len = 0.28) => { let v = 0; for (const b of list) if (t >= b) v = Math.max(v, Math.pow(1 - Math.min(1, (t - b) / len), 1.6)); return v; };
  const say = (c, t, text, size, x, y, start, dur, o = {}) => O.line(c, Object.assign({ text, font: DEV, size, x, y, t, start, dur, tracking: 0, stagger: 0.12 }, o));

  // N1 — cold open: darkness, drum hits, each one flashes the bull out of the night
  const N1beats = [0.45, 1.25, 2.05, 2.6, 3.15, 3.7];
  shots.push({ id: 'N1', frames: F(4.6), setup() { reset(); __dof(3.2, 0.012, 0.012); T.drummers.forEach(d => d.wrap.visible = true); },
    update(t) { const B = V(3.0, 0, 1.2), C = V(B.x + 2.3, lerp(0.55, 0.7, t / 4.6), B.z + 2.8);
      bullPose(B.x, B.z, yawTo(B, C) + 0.25, t > 2.2 ? 'Idle_Headlow' : 'Idle_2', { ts: 0.85 });
      cam(C, V(B.x - 0.2, 1.15, B.z), 26 - t * 0.6); __dof(C.distanceTo(B) - 0.6, 0.014, 0.014); },
    draw(c, t) { const lit = Math.max(beats(t, N1beats, 0.42) * 0.9, O.E.inOut((t - 3.9) / 0.7));
      O.fade(c, 1 - lit); if (t > 0.45) O.flash(c, t, N1beats.find(b => b <= t && t - b < 0.06) ?? -9, 0.06, 'rgba(255,170,90,0.5)');
      say(c, t, 'हर साल...', 64, W / 2, H * 0.83, 0.5, 1.9, { style: 'white' }); say(c, t, 'एक दिन', 168, W / 2, H * 0.57, 2.55, 2.05, { push: 0.04 }); O.letterbox(c, 1); } });

  // N2 — drone straight down, spiralling into the ring as the village gathers
  shots.push({ id: 'N2', frames: F(4.8), setup() { reset(); bullPose(-1.6, -2.2, 0.6, 'Idle'); plPose(-5.6, 6.8, Math.PI * 0.9, 'Idle', { fade: 0 }); __dof(20, 0, 0);
      T.crowd.forEach((cr, i) => setTimeout(() => {}, 0)); },
    update(t) { const k = O.E.inOut(t / 4.8), th = 0.4 + k * 1.5, h = lerp(30, 9.5, k), rr = lerp(2.5, 6.5, k);
      T.camera.up.set(Math.cos(th + 2.1), 0, Math.sin(th + 2.1));
      cam(V(Math.cos(th) * rr, h, Math.sin(th) * rr), V(0, 0, 0), 46); T.camera.up.set(0, 1, 0);
      if (t > 2.4) for (const [i, cr] of T.crowd.entries()) if (!cr.cheer && t > 2.4 + i * 0.08) { cr.cheer = 1; cr.play('Victory', { once: true, fade: 0.2 }); } },
    draw(c, t) { O.leak(c, t, 0.6); say(c, t, 'पूरा गाँव', 170, W / 2, H * 0.56, 1.1, 3.6); O.letterbox(c, 1); },
    teardown() { T.crowd.forEach(cr => cr.cheer = 0); } });

  // N3 — eye to eye with the bull, a slow push in
  shots.push({ id: 'N3', frames: F(3.5), setup() { reset(); },
    update(t) { const B = V(-1.2, 0, -1.8), k = O.E.inOut(t / 3.5), ph = lerp(-2.25, -2.5, k), d = lerp(5.0, 4.1, k);
      const C = V(B.x + Math.cos(ph) * d, 1.12, B.z + Math.sin(ph) * d);
      bullPose(B.x, B.z, yawTo(B, C) - 0.15, t > 1.9 ? 'Idle_Headlow' : 'Idle', { ts: 0.8 });
      cam(C, V(B.x - 0.3, 0.95, B.z - 0.3), 30); __dof(C.distanceTo(B) - 1.15, 0.012, 0.014); },
    draw(c, t) { say(c, t, 'एक बैल', 150, W - 180, H * 0.78, 0.4, 3.0, { align: 'right' }); O.letterbox(c, 1); } });

  // N4 — under the pitha, looking up at it against the night sky
  shots.push({ id: 'N4', frames: F(3.3), setup() { reset(); bullPose(2.6, 2.4, -2.4, 'Idle'); T.post.bloom.strength = 0.8; },
    update(t) { const k = O.E.inOut(t / 3.3), ph = lerp(-1.2, -0.5, k), L = T.pitha.getWorldPosition(tmp).clone();
      const C = V(Math.cos(ph) * 2.0, lerp(0.7, 1.0, k), 0.32 + Math.sin(ph) * 2.0);
      cam(C, V(L.x, L.y + 0.25, L.z), 34); __dof(C.distanceTo(L), 0.012, 0.012); },
    draw(c, t) { say(c, t, 'पीठा', 200, W / 2, H * 0.8, 0.9, 2.35, { push: 0.04 }); O.letterbox(c, 1); },
    teardown() { T.post.bloom.strength = 0.28; } });

  // N5 — the hide in your hand, the bull lowers his head: who dares?
  shots.push({ id: 'N5', frames: F(2.8), setup() { reset(); },
    update(t) { const P = V(-3.9, 0, -4.6), B = V(-1.5, 0, -2.0), k = t / 2.8;
      plPose(P.x, P.z, yawTo(P, B), 'Idle', { fade: 0 }); bullPose(B.x, B.z, yawTo(B, P), t > 0.8 ? 'Idle_Headlow' : 'Idle', { ts: 1.4 });
      const back = P.clone().sub(B).setY(0).normalize(), right = V(back.z, 0, -back.x);
      const C = P.clone().addScaledVector(back, lerp(1.25, 0.9, k)).addScaledVector(right, 0.45); C.y = lerp(1.35, 1.25, k);
      cam(C, V(B.x, 1.0, B.z), lerp(36, 30, k)); __dof(C.distanceTo(B), 0.012, 0.012); },
    draw(c, t) { say(c, t, 'हिम्मत किसमें है?', 128, W / 2, H * 0.5, 0.55, 2.15); O.letterbox(c, 1); O.fade(c, (t - 2.5) / 0.3); } });

  shots.push({ id: 'N5b', frames: F(0.4), noRender: true, setup() {}, update() {}, draw(c) { c.fillStyle = '#000'; c.fillRect(0, 0, W, H); } });

  // N6 — the drop: the hide waves, seen from the bull's side
  shots.push({ id: 'N6', frames: F(2.4), setup() { reset(); T.game.b.state = 'watch'; T.game.b.pos.set(-1.1, 0, -1.3); T.game.b.yaw = -2.4; T.game.p.state = 'free'; T.game.p.pos.set(-4.1, 0, -4.9); T.game.p.yaw = 0.7; T.player.play('Idle', { fade: 0 }); },
    update(t) { keepSafe(); if (Math.abs(t - 0.15) < 0.02) T.input.tease = true;
      const P = T.game.p.pos, B = T.game.b.pos, d = P.clone().sub(B).setY(0).normalize(), perp = V(-d.z, 0, d.x);
      const C = B.clone().addScaledVector(d, 1.0).addScaledVector(perp, 1.5 + t * 0.2); C.y = 0.75;
      cam(C, P.clone().setY(1.2), 32); __dof(C.distanceTo(P), 0.009, 0.01); },
    draw(c, t) { O.flash(c, t, 0, 0.2); say(c, t, 'खाल लहराओ!', 150, W / 2, H * 0.86, 0.05, 2.3, { mode: 'slam', outLen: 0.18 }); } });

  // N7 — on the ground in the bull's path: he thunders over the lens, slow motion, the roll
  const N7 = { P: V(-3.7, 0, -4.4), B: V(-0.95, 0, -1.05), rolled: false, slowAt: -1 };
  shots.push({ id: 'N7', frames: F(3.2),
    speed(t) { if (N7.slowAt < 0) return 1; const u = t - N7.slowAt; return u < 0 ? 1 : u < 1.2 ? 0.2 : u < 1.5 ? lerp(0.2, 1, (u - 1.2) / 0.3) : 1; },
    setup() { reset(); N7.rolled = false; N7.slowAt = -1; const g = T.game, b = g.b;
      g.p.state = 'free'; g.p.pos.copy(N7.P); g.p.yaw = yawTo(N7.P, N7.B); T.player.play('Idle', { fade: 0 });
      b.pos.copy(N7.B); b.yaw = yawTo(N7.B, N7.P); T.setBull('watch', 999); },
    update(t) { const g = T.game, b = g.b, p = g.p;
      if (t >= 0.25 && b.state === 'watch') { b.dir.copy(N7.P).sub(b.pos).setY(0).normalize(); b.yaw = Math.atan2(b.dir.x, b.dir.z); b.speed = 12; b.dist = 8.5; b.hoof = 0; b.minD = 99; b.provoked = false; T.setBull('charge', 3); }
      keepSafe();
      const dist = b.pos.distanceTo(p.pos);
      if (b.state === 'charge' && N7.slowAt < 0 && dist < 3.0) N7.slowAt = t;
      if (b.state === 'charge' && !N7.rolled && dist < 1.9) { N7.rolled = true; const side = V(-b.dir.z, 0, b.dir.x); p.yaw = Math.atan2(side.x, side.z); p.state = 'free'; T.input.roll = true; }
      const dir = N7.P.clone().sub(N7.B).setY(0).normalize(), side = V(-dir.z, 0, dir.x);
      const C = N7.B.clone().lerp(N7.P, 0.62).addScaledVector(side, 0.65); C.y = 0.28;
      cam(C, b.pos.clone().setY(0.9 + Math.max(0, 2.2 - b.pos.distanceTo(C)) * 0.35), 38); __dof(C.distanceTo(b.pos), 0.008, 0.012);
      if (N7.slowAt > 0 && t - N7.slowAt < 0.5) { const sh = (0.5 - (t - N7.slowAt)) * 0.05; T.camera.position.x += (Math.random() - .5) * sh; T.camera.position.y += (Math.random() - .5) * sh; } },
    draw(c, t) { O.flash(c, t, 0, 0.12); say(c, t, 'बचो!', 210, W / 2, H * 0.28 + 60, 0.05, 3.0, { mode: 'slam', outLen: 0.18 }); if (N7.slowAt > 0) O.flash(c, t, N7.slowAt, 0.18, 'rgba(255,200,150,0.6)'); } });

  // N8 — the grab, the camera circling in slow motion
  shots.push({ id: 'N8', frames: F(2.6), speed(t) { const p = T.game.p; return p.state === 'grab' && p.t > 0.25 && p.t < 0.7 ? 0.3 : 1; },
    setup() { reset(); bullPose(-3.2, 3.6, 2.4, 'Idle_HitReact1', { once: true }); const g = T.game; g.p.state = 'free'; g.p.pos.set(-0.75, 0, -0.85); g.p.yaw = yawTo(g.p.pos, V(0, 0, 0)); T.player.play('Idle', { fade: 0 }); this.a = -2.6; },
    update(t, dt) { const p = T.game.p; if (Math.abs(t - 0.2) < 0.02 && p.state === 'free') T.input.grab = true;
      if (p.state === 'grab' && p.t >= 0.9) T.celebrate('victory', () => T.game.p.pos, true);
      this.a += dt * 0.9; const C = V(Math.cos(this.a) * 3.1, 1.0, Math.sin(this.a) * 3.1);
      cam(C, V(-0.35, 1.45, -0.4), 36); __dof(C.distanceTo(p.pos), 0.009, 0.012); },
    draw(c, t) { say(c, t, 'छीन लो!', 170, W / 2, H * 0.86, 0.05, 2.5, { mode: 'slam', outLen: 0.18 }); } });

  // N9 — the drums answer and the whole village jumps
  shots.push({ id: 'N9', frames: F(2.8), setup() { reset(); bullPose(1.8, 2.0, 2.4, 'Idle'); },
    update(t) { const d = T.drummers[1].wrap.position, f = d.clone().normalize(), side = V(-f.z, 0, f.x), k = t / 2.8;
      const p = d.clone().addScaledVector(f, -4.0).addScaledVector(side, lerp(-1.8, 1.6, k)); p.y = lerp(2.2, 1.3, k);
      cam(p, V(d.x - f.x * 0.6, 1.05, d.z - f.z * 0.6), 34); __dof(p.distanceTo(d), 0.012, 0.012);
      for (const [i, cr] of T.crowd.entries()) if (!cr.cheer && t > 0.2 + i * 0.07) { cr.cheer = 1; cr.play('Victory', { once: true, fade: 0.15 }); } },
    draw(c, t) { O.sub(c, { text: 'कॉम्बो  ·  रैंक  ·  रोज़ का लीडरबोर्ड', deva: true, size: 40, x: W / 2, y: H * 0.88, t, start: 0.35, dur: 2.35, color: '#ffd58a' }); },
    teardown() { T.crowd.forEach(cr => cr.cheer = 0); } });
  // N10 — bring your friends
  shots.push({ id: 'N10', frames: F(3.2), setup() { reset(); clearExtras();
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
    draw(c, t) { O.line(c, { text: 'दोस्तों को बुलाओ', font: DEV, size: 118, x: W / 2, y: H * 0.2 + 40, t, start: 0.15, dur: 3.0, tracking: 0, stagger: 0.12 });
      O.sub(c, { text: 'लाइव वॉइस चैट  ·  6 खिलाड़ी तक', deva: true, size: 34, x: W / 2, y: H * 0.2 + 112, t, start: 0.8, dur: 2.35 }); },
    teardown() { clearExtras(); } });


  // N11 — the bull hits the khunt in slow motion; only one will win
  const N11 = { hitAt: -1, started: false };
  shots.push({ id: 'N11', frames: F(3.4),
    speed(t) { if (N11.hitAt < 0) return 1; const u = t - N11.hitAt; return u < 0.6 ? 0.25 : 1; },
    setup() { reset(); N11.hitAt = -1; N11.started = false; const g = T.game, b = g.b; g.p.state = 'free'; g.p.pos.set(2.6, 0, 3.2); g.p.yaw = Math.PI; T.player.play('Idle', { fade: 0 });
      b.pos.set(0, 0, -4.6); b.yaw = 0; T.setBull('watch', 999); },
    update(t) { const g = T.game, b = g.b;
      if (t >= 0.1 && b.state === 'watch' && !N11.started) { N11.started = true; b.dir.set(0, 0, 1); b.yaw = 0; b.speed = 12.5; b.dist = 8; b.hoof = 0; b.minD = 99; T.setBull('charge', 3); }
      keepSafe(); if (b.state === 'stunned' && N11.hitAt < 0) N11.hitAt = t;
      const u = N11.hitAt > 0 ? O.E.inOut((t - N11.hitAt - 0.5) / 1.8) : 0;
      const C = V(-3.2, lerp(0.45, 0.6, u), -2.4), look = V(0, lerp(1.0, 5.5, u), lerp(-0.8, 3, u));
      const sh = N11.hitAt > 0 ? Math.max(0, 1 - (t - N11.hitAt) / 0.5) * 0.1 : 0;
      cam(C.add(V((Math.random() - .5) * sh, (Math.random() - .5) * sh, 0)), look, 34); __dof(3.6, 0.008, 0.01); },
    draw(c, t) { if (N11.hitAt > 0) O.flash(c, t, N11.hitAt, 0.2); say(c, t, 'सिर्फ़ एक जीतेगा', 140, W / 2, H * 0.5, 1.4, 1.95); O.fade(c, (t - 3.05) / 0.35); } });

  // N12 — title over a torch-lit night still
  shots.push({ id: 'N12', frames: F(7.0), noRender: true,
    setup() { reset(); T.noRender = false; bullPose(-0.95, -1.2, -2.2 + Math.PI, 'Idle_Headlow'); plPose(-3.4, -4.4, yawTo(V(-3.4, 0, -4.4), V(-0.9, 0, -1.2)), 'Idle', { fade: 0 });
      cam(V(-6.2, 0.55, -6.6), V(1.5, 1.8, 1.8), 38); __dof(8.5, 0.006, 0.01); T.post.bloom.strength = 0.4;
      __step(1000 / 30); __motes(5); __step(1000 / 30); this.still = document.createElement('canvas'); this.still.width = 1920; this.still.height = 1080; this.still.getContext('2d').drawImage(T.renderer.domElement, 0, 0, 1920, 1080); T.post.bloom.strength = 0.28; },
    update() {},
    draw(c, t) {
      const s = 1.04 + t * 0.012; c.save(); c.translate(W / 2, H / 2); c.scale(s, s); c.translate(-W / 2, -H / 2); c.filter = `blur(${lerp(0, 3, clamp((t - 0.4) / 1.5, 0, 1)).toFixed(1)}px) brightness(${lerp(1, 0.6, clamp((t - 0.4) / 1.5, 0, 1))})`; c.drawImage(this.still, 0, 0); c.restore(); c.filter = 'none';
      O.leak(c, t, 0.8); O.flash(c, t, 0.55, 0.25, 'rgba(255,190,120,0.7)');
      c.save(); c.globalAlpha = O.E.out((t - 0.35) / 0.8); c.font = '600 46px "Noto Sans Ol Chiki", sans-serif'; c.textAlign = 'center'; c.fillStyle = '#ffb347'; c.letterSpacing = '10px'; c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 20; c.fillText('ᱠᱷᱩᱱᱴᱟᱣ', W / 2, H * 0.3); c.restore();
      O.line(c, { text: 'KHUNTAU', font: BIG, size: 270, x: W / 2, y: H * 0.53, t, start: 0.55, dur: 6.45, mode: 'slam', tracking: 0.08, outLen: 0.5 });
      O.rule(c, W / 2, H * 0.53 + 46, 520, t, 1.5, 5.5);
      O.sub(c, { text: 'सोहराय का बैल खेल', deva: true, size: 44, x: W / 2, y: H * 0.53 + 112, t, start: 1.4, dur: 5.6 });
      O.sub(c, { text: 'अभी खेलो  ·  मुफ़्त', deva: true, size: 40, x: W / 2, y: H * 0.79, t, start: 4.9, dur: 2.1, color: '#ffd58a' });
      O.sub(c, { text: 'khuntau.dulalkisku0.workers.dev', size: 30, x: W / 2, y: H * 0.79 + 56, t, start: 5.1, dur: 1.9 });
      tumdah(c, t, 2.2, 4.8, W / 2, H * 0.095 + 20, 62, 'POWERED BY');
      O.fade(c, (t - 6.45) / 0.55);
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
