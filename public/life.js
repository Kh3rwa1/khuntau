// Village life: chickens, goats, birds, butterflies, cooking smoke and straw stacks.
// Everything is built from simple shapes (no downloads) and drawn as one instanced mesh per kind, so the whole
// set costs about six draw calls. Counts scale with QUALITY; smoke and butterflies switch off on slow phones.
// Loaded with import() after the villagers, like story.js; gets what it needs as one object C.
export function initLife(C) {
  const { THREE, scene, game, houses, QUALITY, perf, Mat, mergeGeometries, bakeStatic } = C;
  const rand = (a, b) => a + Math.random() * (b - a), V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const RING = 12.6, VILLAGE = 29.5; // animals stay off the ring and inside the village
  const n = (lo, mid, hi) => [lo, mid, hi][QUALITY];

  // ---- helpers: a low-poly part with one colour baked into its vertices, then all parts merged ----
  const part = (geo, color, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) => {
    const g = geo.toNonIndexed ? geo.toNonIndexed() : geo; g.scale(sx, sy, sz); g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); g.translate(x, y, z);
    const c = new THREE.Color(color), a = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3)); for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k);
    return g;
  };
  const build = (parts) => { const g = mergeGeometries(parts, false); parts.forEach(p => p.dispose()); return g; };
  const vmat = Mat({ vertexColors: true, roughness: 1, flatShading: true });
  const herd = (geo, count, tints) => {
    const m = new THREE.InstancedMesh(geo, vmat, count); m.frustumCulled = false; m.castShadow = false; m.receiveShadow = false;
    for (let i = 0; i < count; i++) m.setColorAt(i, new THREE.Color(tints[i % tints.length]));
    scene.add(m); return m;
  };
  // is this spot free (not in a house, the ring, or outside the village)?
  const free = (x, z, pad = 1.2) => {
    const r = Math.hypot(x, z); if (r < RING || r > VILLAGE) return false;
    for (const h of houses) { const c = Math.cos(h.rot), s = Math.sin(h.rot), dx = x - h.x, dz = z - h.z, lx = dx * c - dz * s, lz = dx * s + dz * c;
      if (Math.abs(lx) < h.w / 2 + pad && Math.abs(lz) < h.d / 2 + pad) return false; }
    for (const o of C.props || []) if (Math.hypot(x - o.x, z - o.z) < o.r + pad * 0.6) return false; // pump, cart, clothesline, trees
    return true;
  };
  const spot = (pad) => { for (let k = 0; k < 40; k++) { const a = rand(0, Math.PI * 2), r = rand(RING + 0.5, VILLAGE - 0.5), x = Math.cos(a) * r, z = Math.sin(a) * r; if (free(x, z, pad)) return V(x, 0, z); } return V(0, 0, 20); };
  const near = (p, d, pad) => { for (let k = 0; k < 20; k++) { const x = p.x + rand(-d, d), z = p.z + rand(-d, d); if (free(x, z, pad)) return V(x, 0, z); } return spot(pad); };
  // a point in front of a house (the door side faces the ring): lx across the front, lz out from the wall
  const yard = (h, lx, lz) => { const c = Math.cos(h.rot), s = Math.sin(h.rot), z = h.d / 2 + lz; return V(h.x + lx * c + z * s, 0, h.z - lx * s + z * c); };
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S3 = V(), P3 = V(), E = new THREE.Euler();

  /* ---------- chickens: wander, peck, scatter from people and the bull ---------- */
  const chickGeo = build([
    part(new THREE.SphereGeometry(0.16, 7, 5), 0xffffff, 0, 0.2, 0, 1, 0.85, 1.25),          // body (tinted per bird)
    part(new THREE.ConeGeometry(0.09, 0.2, 5), 0xffffff, 0, 0.3, -0.2, 1, 1, 1, -0.9),         // tail
    part(new THREE.SphereGeometry(0.075, 6, 5), 0xffffff, 0, 0.36, 0.17),                     // head
    part(new THREE.BoxGeometry(0.025, 0.06, 0.08), 0xd8352a, 0, 0.44, 0.17),                  // comb
    part(new THREE.ConeGeometry(0.025, 0.07, 4), 0xf2b134, 0, 0.35, 0.26, 1, 1, 1, Math.PI / 2), // beak
    part(new THREE.CylinderGeometry(0.012, 0.012, 0.12, 4), 0xf2b134, -0.05, 0.06, 0.02),      // legs
    part(new THREE.CylinderGeometry(0.012, 0.012, 0.12, 4), 0xf2b134, 0.05, 0.06, 0.02),
  ]);
  const nChick = n(6, 10, 14);
  const chicks = herd(chickGeo, nChick, [0xf4efe4, 0xa0522d, 0x6b3a1e, 0xf4efe4, 0x2b2420, 0xd39b5a]);
  const flock = [];
  { const home = houses.slice(0, 5).map(h => yard(h, rand(-1.5, 1.5), 3.2)); // they keep to the front yards, where you walk
    for (let i = 0; i < nChick; i++) { const p = near(home[i % home.length], 2.5, 1.0); flock.push({ home: p.clone(), p, t: near(p, 3, 1.0), yaw: rand(0, 6.28), st: 'peck', w: rand(0.5, 3), bob: rand(0, 6) }); } }

  /* ---------- goats: graze slowly near the houses ---------- */
  const goatGeo = build([
    part(new THREE.BoxGeometry(0.34, 0.3, 0.62), 0xffffff, 0, 0.5, 0),                       // body (tinted)
    part(new THREE.BoxGeometry(0.2, 0.22, 0.28), 0xffffff, 0, 0.68, 0.38, 1, 1, 1, 0.35),      // head
    part(new THREE.ConeGeometry(0.03, 0.18, 4), 0x3a3028, -0.06, 0.86, 0.32, 1, 1, 1, -0.5),   // horns
    part(new THREE.ConeGeometry(0.03, 0.18, 4), 0x3a3028, 0.06, 0.86, 0.32, 1, 1, 1, -0.5),
    part(new THREE.BoxGeometry(0.05, 0.12, 0.04), 0xe8dcc6, 0, 0.5, 0.52),                      // beard
    ...[[-0.11, 0.22], [0.11, 0.22], [-0.11, -0.22], [0.11, -0.22]].map(([x, z]) => part(new THREE.CylinderGeometry(0.035, 0.03, 0.36, 5), 0x3a3028, x, 0.18, z)), // legs
    part(new THREE.ConeGeometry(0.04, 0.12, 4), 0xffffff, 0, 0.66, -0.33, 1, 1, 1, -1.1),      // tail
  ]);
  const nGoat = n(3, 5, 7);
  const goats = herd(goatGeo, nGoat, [0x4a3a2e, 0xf1ead9, 0x8a5a2b, 0x2a2420, 0xbfa27a]);
  const herdG = []; for (let i = 0; i < nGoat; i++) { const p = spot(1.4); herdG.push({ p, t: near(p, 4, 1.4), yaw: rand(0, 6.28), w: rand(1, 6), graze: rand(0, 6) }); }

  /* ---------- birds circling high over the village ---------- */
  const birdGeo = build([
    part(new THREE.BoxGeometry(0.5, 0.02, 0.12), 0x2a2420, -0.24, 0, 0, 1, 1, 1, 0, 0, 0.25),
    part(new THREE.BoxGeometry(0.5, 0.02, 0.12), 0x2a2420, 0.24, 0, 0, 1, 1, 1, 0, 0, -0.25),
    part(new THREE.BoxGeometry(0.06, 0.05, 0.22), 0x2a2420, 0, 0, 0.02),
  ]);
  const nBird = n(4, 7, 10);
  const birds = herd(birdGeo, nBird, [0xffffff]);
  const sky = []; for (let i = 0; i < nBird; i++) sky.push({ cx: rand(-15, 15), cz: rand(-15, 15), r: rand(8, 22), h: rand(14, 24), a: rand(0, 6.28), s: rand(0.12, 0.3) * (Math.random() < 0.5 ? -1 : 1), f: rand(0, 6) });

  /* ---------- butterflies near the grass (not on budget phones) ---------- */
  const nFly = QUALITY === 0 ? 0 : n(0, 6, 10);
  const flyGeo = build([part(new THREE.PlaneGeometry(0.09, 0.07), 0xffffff, -0.045, 0, 0, 1, 1, 1, -Math.PI / 2), part(new THREE.PlaneGeometry(0.09, 0.07), 0xffffff, 0.045, 0, 0, 1, 1, 1, -Math.PI / 2)]);
  const flies = nFly ? herd(flyGeo, nFly, [0xffc23a, 0xf4efe4, 0xff8a1c, 0x9dd6ff]) : null; if (flies) flies.material = Mat({ vertexColors: true, side: THREE.DoubleSide, roughness: 1 });
  const flutter = []; for (let i = 0; i < nFly; i++) { const p = spot(0.6); flutter.push({ c: p, a: rand(0, 6.28), s: rand(0.6, 1.2), f: rand(0, 6), h: rand(0.3, 0.9) }); }

  /* ---------- cooking smoke from a few houses (one Points draw) ---------- */
  const SMOKE_HOUSES = houses.slice(0, n(3, 4, 5)), PER = 12;
  const sTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 2, 32, 32, 30); g.addColorStop(0, 'rgba(235,230,222,.55)'); g.addColorStop(1, 'rgba(235,230,222,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const sPos = new Float32Array(SMOKE_HOUSES.length * PER * 3), puffs = [];
  SMOKE_HOUSES.forEach((h, k) => { const c = Math.cos(h.rot), s = Math.sin(h.rot), ox = h.w * 0.25, oz = -h.d * 0.2; // a little off the ridge, toward the back
    const base = V(h.x + ox * c + oz * s, 4.2, h.z - ox * s + oz * c);
    for (let i = 0; i < PER; i++) puffs.push({ base, life: i / PER, k: puffs.length }); });
  const sGeo = new THREE.BufferGeometry(); sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  const smoke = new THREE.Points(sGeo, new THREE.PointsMaterial({ size: 2.4, map: sTex, transparent: true, depthWrite: false, sizeAttenuation: true, opacity: 0.8 }));
  smoke.frustumCulled = false; scene.add(smoke);

  /* ---------- paddy-straw stacks beside some houses (baked into one mesh) ---------- */
  { const straw = Mat({ color: 0xcaa858, roughness: 1, flatShading: true }), list = [];
    houses.slice(1, 1 + n(3, 5, 7)).forEach((h, i) => { const c = Math.cos(h.rot), s = Math.sin(h.rot), lx = (i % 2 ? -1 : 1) * (h.w / 2 + 1.4), lz = -h.d * 0.15;
      const x = h.x + lx * c + lz * s, z = h.z - lx * s + lz * c; if (Math.hypot(x, z) < RING + 1) return;
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.85, 1.3, 9), straw); body.position.set(x, 0.65, z);
      const top = new THREE.Mesh(new THREE.ConeGeometry(0.95, 1.1, 9), straw); top.position.set(x, 1.85, z);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.6, 5), straw); pole.position.set(x, 2.6, z);
      [body, top, pole].forEach(m => { scene.add(m); list.push(m); }); if (C.props) C.props.push({ x, z, r: 0.85, top: 2.9 }); }); // solid, and the camera keeps out of it
    if (list.length) bakeStatic(list); }

  /* ---------- front yards: clay pots by the door, a rope cot, firewood (baked: one draw per material) ---------- */
  { const clay = Mat({ color: 0xa4552c, roughness: 0.9, flatShading: true }), wood = Mat({ color: 0x6a5541, roughness: 1, flatShading: true }), rope = Mat({ color: 0xd9c48f, roughness: 1 });
    const pots = [], woods = [], ropes = [], add = (list, geo, mat, p, y, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(p.x, y, p.z); m.rotation.set(0, ry, rz); scene.add(m); list.push(m); };
    houses.slice(0, n(4, 6, 9)).forEach((h, i) => {
      // two pots beside the door
      for (const [lx, sc] of [[1.0, 1], [1.35, 0.75]]) { const p = yard(h, lx, 0.45); add(pots, new THREE.SphereGeometry(0.26 * sc, 9, 7), clay, p, 0.24 * sc); add(pots, new THREE.CylinderGeometry(0.12 * sc, 0.16 * sc, 0.12 * sc, 9), clay, p, 0.5 * sc); }
      if (i % 2 === 0) { // a khatia (rope cot) in the yard
        const p = yard(h, -1.7, 1.3), ry = h.rot + 0.3;
        add(ropes, new THREE.BoxGeometry(0.9, 0.04, 1.8), rope, p, 0.42, ry);
        const c = Math.cos(ry), s = Math.sin(ry);
        for (const [a, b] of [[-0.42, -0.85], [0.42, -0.85], [-0.42, 0.85], [0.42, 0.85]]) add(woods, new THREE.CylinderGeometry(0.04, 0.05, 0.42, 5), wood, V(p.x + a * c + b * s, 0, p.z - a * s + b * c), 0.21);
      } else { // a firewood pile against the wall
        const p = yard(h, -1.6, 0.5);
        for (let k = 0; k < 7; k++) add(woods, new THREE.CylinderGeometry(0.06, 0.06, 1.1, 5), wood, V(p.x + (k % 3 - 1) * 0.14, 0, p.z), 0.08 + Math.floor(k / 3) * 0.12, h.rot, Math.PI / 2);
      }
    });
    for (const l of [pots, woods, ropes]) if (l.length) bakeStatic(l); }

  /* ---------- ring effects, triggered from the game: hoof prints, breath, marigold petals ---------- */
  // hoof prints in the dust: a pool of flat marks that sink back into the ground (one draw)
  const PRINTS = n(24, 36, 48), printGeo = new THREE.CircleGeometry(0.17, 7).rotateX(-Math.PI / 2); printGeo.scale(1, 1, 1.35);
  const prints = new THREE.InstancedMesh(printGeo, new THREE.MeshBasicMaterial({ color: 0x2e1a0e, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }), PRINTS);
  prints.frustumCulled = false; prints.renderOrder = 1; scene.add(prints); const pr = []; let prI = 0;
  for (let i = 0; i < PRINTS; i++) { pr.push({ age: 99, x: 0, z: 0, yaw: 0 }); prints.setMatrixAt(i, M.makeScale(0, 0, 0)); }
  // breath: little white puffs from the bull's nose (one Points draw)
  const BR = 24, bPos = new Float32Array(BR * 3), br = []; for (let i = 0; i < BR; i++) br.push({ age: 99, p: V(), v: V() });
  const bGeo = new THREE.BufferGeometry(); bGeo.setAttribute('position', new THREE.BufferAttribute(bPos, 3));
  const breath = new THREE.Points(bGeo, new THREE.PointsMaterial({ size: 1.0, map: sTex, transparent: true, depthWrite: false, opacity: 1 })); breath.frustumCulled = false; scene.add(breath); let brI = 0;
  // marigold petals that rain down when a pitha is snatched (one draw)
  const PET = n(40, 60, 80), petGeo = build([part(new THREE.PlaneGeometry(0.15, 0.1), 0xffffff)]);
  const petals = new THREE.InstancedMesh(petGeo, Mat({ vertexColors: true, side: THREE.DoubleSide, roughness: 1, emissive: 0x2a1400 }), PET); petals.frustumCulled = false; scene.add(petals);
  const pe = []; for (let i = 0; i < PET; i++) { pe.push({ age: 99, p: V(), v: V(), r: V(), w: V() }); petals.setColorAt(i, new THREE.Color([0xff8a1c, 0xffc21c, 0xffa21c][i % 3])); petals.setMatrixAt(i, M.makeScale(0, 0, 0)); }
  function fx(kind, pos, dir) {
    if (kind === 'hoof') { // two prints, side by side, along the charge
      for (const side of [-1, 1]) { const q = pr[prI]; prI = (prI + 1) % PRINTS; q.age = 0; q.yaw = Math.atan2(dir.x, dir.z); q.x = pos.x + dir.z * 0.22 * side; q.z = pos.z - dir.x * 0.22 * side; }
    } else if (kind === 'breath') { // a short double puff from the nostrils
      for (let k = 0; k < 4; k++) { const q = br[brI]; brI = (brI + 1) % BR; q.age = -k * 0.05; q.p.copy(pos); q.v.set(dir.x * 1.3 + rand(-0.2, 0.2), rand(-0.05, 0.2), dir.z * 1.3 + rand(-0.2, 0.2)); }
    } else if (kind === 'petals' && !perf.thin) {
      for (let i = 0; i < PET; i++) { const q = pe[i]; q.age = -rand(0, 0.5); q.p.set(pos.x + rand(-1.6, 1.6), rand(2.6, 4.2), pos.z + rand(-1.6, 1.6)); q.v.set(rand(-0.4, 0.4), rand(-0.6, -0.2), rand(-0.4, 0.4)); q.r.set(rand(0, 6), rand(0, 6), rand(0, 6)); q.w.set(rand(-6, 6), rand(-6, 6), rand(-6, 6)); }
    }
  }
  function fxUpdate(dt) {
    let any = false;
    for (let i = 0; i < PRINTS; i++) { const q = pr[i]; if (q.age > 12) continue; q.age += dt; any = true; const k = q.age < 7 ? 1 : Math.max(0, 1 - (q.age - 7) / 5);
      E.set(0, q.yaw, 0); Q.setFromEuler(E); M.compose(P3.set(q.x, 0.03, q.z), Q, S3.set(k, 1, k)); prints.setMatrixAt(i, M); }
    if (any) prints.instanceMatrix.needsUpdate = true; prints.visible = any; // nothing to draw: no draw call
    for (let i = 0; i < BR; i++) { const q = br[i], j = i * 3; q.age += dt; if (q.age < 0 || q.age > 0.7) { bPos[j + 1] = -99; continue; } q.p.addScaledVector(q.v, dt); bPos[j] = q.p.x; bPos[j + 1] = q.p.y + q.age * 0.25; bPos[j + 2] = q.p.z; }
    bGeo.attributes.position.needsUpdate = true; breath.visible = br.some(q => q.age >= 0 && q.age <= 0.7);
    let pany = false;
    for (let i = 0; i < PET; i++) { const q = pe[i]; if (q.age > 3.5) continue; q.age += dt; pany = true; if (q.age < 0) { petals.setMatrixAt(i, M.makeScale(0, 0, 0)); continue; }
      q.v.x += Math.sin(t * 3 + i) * 0.6 * dt; q.p.addScaledVector(q.v, dt); if (q.p.y < 0.02) { q.p.y = 0.02; q.v.set(0, 0, 0); q.w.multiplyScalar(0.9); }
      q.r.addScaledVector(q.w, dt); E.set(q.r.x, q.r.y, q.r.z); Q.setFromEuler(E); const k = q.age > 2.8 ? Math.max(0, 1 - (q.age - 2.8) / 0.7) : 1;
      M.compose(q.p, Q, S3.set(k, k, k)); petals.setMatrixAt(i, M); }
    if (pany) petals.instanceMatrix.needsUpdate = true; petals.visible = pany;
  }

  /* ---------- every frame ---------- */
  const threats = () => [game.p.pos, game.b.pos];
  function step(a, speed, dt) { const dx = a.t.x - a.p.x, dz = a.t.z - a.p.z, d = Math.hypot(dx, dz); if (d < 0.08) return true; const k = Math.min(1, speed * dt / d); const nx = a.p.x + dx * k, nz = a.p.z + dz * k; if (free(nx, nz, 0.6)) { a.p.x = nx; a.p.z = nz; } else a.t = near(a.p, 2, 1.0); a.yaw = Math.atan2(dx, dz); return false; }
  let t = 0;
  /* ---------- two village dogs asleep in the square: breathing, and one lifts a little when you come close ---------- */
  const DOG_GAPS = [[0.78, 17.6, 0.6], [5.2, 16.6, -1.2]], dogPos = [];
  const dogs = (() => { const sand = 0xb08a55;
    const g = build([part(new THREE.SphereGeometry(0.32, 8, 6).scale(0.75, 0.5, 1.35).translate(0, 0.17, 0), sand), part(new THREE.SphereGeometry(0.15, 8, 6).scale(1, 0.85, 1.25).translate(0.08, 0.13, 0.44), sand),
      part(new THREE.ConeGeometry(0.05, 0.1, 4).translate(0.02, 0.24, 0.42), 0x6a4a2c), part(new THREE.ConeGeometry(0.05, 0.1, 4).translate(0.16, 0.24, 0.42), 0x6a4a2c), part(new THREE.SphereGeometry(0.04, 5, 4).translate(0.1, 0.12, 0.6), 0x1a1410),
      part(new THREE.TorusGeometry(0.18, 0.035, 4, 10, Math.PI * 1.1).rotateX(Math.PI / 2).translate(-0.05, 0.08, -0.32), sand), part(new THREE.BoxGeometry(0.1, 0.06, 0.32).translate(0.12, 0.04, 0.42), sand)]);
    const m = herd(g, 2, [0xffffff, 0x8a7a68]);
    DOG_GAPS.forEach(([gi, r, ry], i) => { const a = 0.35 + (2 * Math.PI / 9) * gi; dogPos.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, ry, lift: 0 }); if (C.props) C.props.push({ x: dogPos[i].x, z: dogPos[i].z, r: 0.5, top: 0.5 }); });
    return m; })();
  function dogsUpdate(dt) { const p = game.p.pos;
    dogPos.forEach((d, i) => { const near = Math.hypot(p.x - d.x, p.z - d.z) < 2.6; if (near && !d.near && C.sfx) C.sfx.huff(0.8); d.near = near; d.lift += ((near ? 1 : 0) - d.lift) * Math.min(1, dt * 3);
      if (C.sfx) { const v = C.sfx.near(d, 3.5); if (v > 0 && !near && (d.sn = (d.sn ?? rand(0, 3)) - dt) < 0) { d.sn = 3.4; C.sfx.snore(v * 0.45); } } /* dogs snore too */
      const br = 1 + Math.sin(t * 1.6 + i * 2) * 0.035; E.set(0, d.ry, 0); Q.setFromEuler(E); M.compose(P3.set(d.x, 0, d.z), Q, S3.set(1.2, (br + d.lift * 0.35) * 1.2, 1.2)); dogs.setMatrixAt(i, M); });
    dogs.instanceMatrix.needsUpdate = true; }
  function update(dt) {
    dt = Math.min(dt, 0.1); t += dt; const thin = perf.thin;
    fxUpdate(dt); dogsUpdate(dt);
    // chickens
    const th = threats();
    flock.forEach((c, i) => {
      let scare = null; for (const q of th) { const d = Math.hypot(c.p.x - q.x, c.p.z - q.z); if (d < 2.2) scare = q; }
      if (scare && c.st !== 'run' && C.sfx && C.sfx.gate('flutter', 0.5)) C.sfx.flutter(Math.max(0.3, C.sfx.near(c.p, 9))); /* wings and a squawk */
      if (scare) { c.st = 'run'; const a = Math.atan2(c.p.x - scare.x, c.p.z - scare.z) + rand(-0.5, 0.5); c.t = near(V(c.p.x + Math.sin(a) * 3, 0, c.p.z + Math.cos(a) * 3), 0.6, 1.0); c.w = 0.8; }
      if (c.st === 'run') { if (step(c, 3.6, dt) || (c.w -= dt) < 0) { c.st = 'peck'; c.w = rand(0.6, 2.5); } }
      else if (c.st === 'walk') { if (step(c, 0.7, dt)) { c.st = 'peck'; c.w = rand(0.8, 3); } }
      else if ((c.w -= dt) < 0) { c.st = 'walk'; c.t = near(c.home, 2.5, 1.0); }
      const peck = c.st === 'peck' ? Math.max(0, Math.sin(t * 9 + c.bob)) * 0.5 : 0, hop = c.st === 'run' ? Math.abs(Math.sin(t * 22 + i)) * 0.06 : c.st === 'walk' ? Math.abs(Math.sin(t * 10 + i)) * 0.02 : 0;
      E.set(peck, c.yaw, 0); Q.setFromEuler(E); M.compose(P3.set(c.p.x, hop, c.p.z), Q, S3.set(1.3, 1.3, 1.3)); chicks.setMatrixAt(i, M);
    });
    chicks.instanceMatrix.needsUpdate = true;
    if (C.sfx && Math.random() < dt * 0.5) { const c = flock[(Math.random() * flock.length) | 0], v = c ? C.sfx.near(c.p, 8) : 0; if (v > 0.05) C.sfx.cluck(v); } /* clucking when you are near */
    // goats
    herdG.forEach((g, i) => { if ((g.w -= dt) < 0) { if (step(g, 0.35, dt)) { g.w = rand(3, 9); g.t = near(g.p, 4, 1.4); } }
      const head = g.w > 0 ? Math.max(0, Math.sin(t * 1.3 + g.graze)) * 0.35 : 0;
      E.set(head * 0.6, g.yaw, 0); Q.setFromEuler(E); M.compose(P3.set(g.p.x, 0, g.p.z), Q, S3.set(1, 1, 1)); goats.setMatrixAt(i, M); });
    goats.instanceMatrix.needsUpdate = true;
    if (C.sfx && Math.random() < dt * 0.08) { const g = herdG[(Math.random() * herdG.length) | 0], v = g ? C.sfx.near(g.p, 10) : 0; if (v > 0.05) C.sfx.bleat(v); } /* now and then a goat bleats */
    // birds
    sky.forEach((b, i) => { b.a += b.s * dt; const x = b.cx + Math.cos(b.a) * b.r, z = b.cz + Math.sin(b.a) * b.r, flap = 0.35 + 0.65 * Math.abs(Math.sin(t * 7 + b.f));
      E.set(0, Math.atan2(-Math.sin(b.a) * Math.sign(b.s), Math.cos(b.a) * Math.sign(b.s)), Math.sin(t * 0.7 + b.f) * 0.2); Q.setFromEuler(E); M.compose(P3.set(x, b.h + Math.sin(t + b.f) * 0.6, z), Q, S3.set(1, flap, 1)); birds.setMatrixAt(i, M); });
    birds.instanceMatrix.needsUpdate = true;
    // butterflies
    if (flies) { flies.visible = !thin; if (!thin) { flutter.forEach((f, i) => { f.a += f.s * dt; const x = f.c.x + Math.cos(f.a) * 1.2 + Math.sin(t * 1.7 + f.f) * 0.3, z = f.c.z + Math.sin(f.a * 1.3) * 1.2, y = f.h + Math.sin(t * 3 + f.f) * 0.2;
      E.set(0, f.a, 0); Q.setFromEuler(E); M.compose(P3.set(x, y, z), Q, S3.set(0.2 + 0.8 * Math.abs(Math.sin(t * 16 + f.f)), 1, 1)); flies.setMatrixAt(i, M); }); flies.instanceMatrix.needsUpdate = true; } }
    // smoke
    smoke.visible = !thin; if (!thin) { for (const s of puffs) { s.life += dt * 0.09; if (s.life > 1) s.life -= 1; const l = s.life, i = s.k * 3;
      sPos[i] = s.base.x + Math.sin(l * 5 + s.k) * 0.25 + l * 1.4; sPos[i + 1] = s.base.y + l * 4.5; sPos[i + 2] = s.base.z + l * 0.6; }
      sGeo.attributes.position.needsUpdate = true; smoke.material.opacity = 0.75; }
  }
  update(0);
  const active = () => ({ prints: prints.visible, breath: breath.visible, petals: petals.visible });
  return { update, fx, active, dogs, counts: { chickens: nChick, goats: nGoat, birds: nBird, butterflies: nFly, smoke: puffs.length } };
}
