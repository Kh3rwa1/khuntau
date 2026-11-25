// The look on a mid phone (the A34's tier): golden-hour light with shadows that follow you round the village, edge
// smoothing on, smooth trees, a rim-lit zebu bull (hump, dewlap, upswept horns) that keeps its size, and the budget
// path (q=low) still building the same bull without errors.
// Also: contact shading in the materials (step 3), screen effects on mid phones that auto-quality drops first (step 4),
// people with smaller heads and smooth shading (step 5).
//   node tests/look.mjs     (static server on 8791)
import puppeteer from 'puppeteer';
import fs from 'fs'; fs.mkdirSync('tests/out', { recursive: true });
import { check, finish, realErrors, SW } from './check.mjs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ protocolTimeout: 180000, args: [...SW, '--no-sandbox', '--mute-audio'] });
async function open(q) {
  const page = await browser.newPage(), logs = []; page.on('pageerror', e => logs.push(e.message)); page.on('console', m => { if (m.type() === 'error') logs.push(m.text()); });
  await page.emulate({ viewport: { width: 390, height: 780, deviceScaleFactor: 1, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-A346E) Mobile' });
  await page.evaluateOnNewDocument(() => { localStorage.setItem('khuntau-name', 'Look Test'); localStorage.setItem('khuntau-animal', 'brown'); localStorage.setItem('khuntau-story', JSON.stringify({ ch: 5, done: 1, painted: [1, 1, 1], chosen: 1, oiled: 1, garland: 1 })); });
  await page.goto(`http://127.0.0.1:8791/?debug&q=${q}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.getElementById('startBtn').dataset.village === 'ready', { timeout: 120000 });
  return { page, logs };
}
// what the bull's reshaping did, read from its bind-pose geometry
const bullShape = (page) => page.evaluate(() => { let r = null; __k.bull.root.traverse(o => { if (!o.isSkinnedMesh || r) return; const g = o.geometry, p = g.attributes.position, n = g.attributes.normal, parts = g.userData.parts;
  const main = parts.find(q => q.name === 'Main'), horns = parts.find(q => q.name === 'Horns'); let hump = -9, back = -9, tip = 0, tipY = -9, baseY = 9, low = 9;
  for (let i = main.start; i < main.start + main.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); if (Math.abs(x) < 0.12) { if (Math.abs(z - 0.22) < 0.06) hump = Math.max(hump, y); if (Math.abs(z + 0.4) < 0.08) back = Math.max(back, y); if (Math.abs(z - 0.45) < 0.06) low = Math.min(low, y); } }
  for (let i = horns.start; i < horns.start + horns.count; i++) { const ax = Math.abs(p.getX(i)); if (ax > tip) { tip = ax; tipY = p.getY(i); } if (ax < 0.1) baseY = Math.min(baseY, p.getY(i)); }
  // smooth shading: neighbouring corners at one point share a normal (flat shading gives each face its own)
  const seen = new Map(); let pairs = 0, same = 0;
  for (let i = main.start; i < main.start + main.count; i++) { const k = [p.getX(i), p.getY(i), p.getZ(i)].map(v => Math.round(v * 2000)).join(','); const j = seen.get(k); if (j === undefined) { seen.set(k, i); continue; } pairs++; if (n.getX(i) * n.getX(j) + n.getY(i) * n.getY(j) + n.getZ(i) * n.getZ(j) > 0.999) same++; }
  const wb = new __k.THREE.Box3().setFromObject(__k.bull.root, true), id = localStorage.getItem('khuntau-animal') || 'brown';
  r = { zebu: !!__k.loaded.bull.userData.zebu, hump, back, low, tip, tipY, baseY, smooth: pairs ? same / pairs : 0, worldH: wb.max.y - wb.min.y, h: (__k.ANIMALS.find(a => a.id === id) || __k.ANIMALS[0]).h }; }); return r; });

// ---------- mid phone ----------
{ const { page, logs } = await open('mid');
  const gl = await page.evaluate(() => ({ aa: __k.renderer.getContext().getContextAttributes().antialias, shadows: __k.renderer.shadowMap.enabled && __k.sun.castShadow, q: __k.QUALITY }));
  check(gl.q === 1 && gl.aa, `mid phones get edge smoothing (MSAA ${gl.aa}, quality ${gl.q})`);
  const sky = await page.evaluate(() => ({ clouds: !!__k.sky.material.uniforms.clouds.value, fog: __k.scene.fog.color.getHexString(), sun: __k.sun.color.getHexString(), elev: Math.asin(__k.sun.position.clone().sub(__k.sun.target.position).normalize().y) * 180 / Math.PI }));
  check(sky.clouds && sky.elev > 15 && sky.elev < 28, `a low golden-hour sun (${sky.elev.toFixed(0)} deg) and clouds in the sky`);
  { const c = sky.fog, r = parseInt(c.slice(0, 2), 16), b = parseInt(c.slice(4, 6), 16), s = sky.sun, sr = parseInt(s.slice(0, 2), 16), sb = parseInt(s.slice(4, 6), 16);
    check(r > b + 30 && sr > sb + 60, `warm haze (#${c}) and a warm sun (#${s}), not grey noon`); }
  await page.evaluate(() => document.getElementById('startBtn').click());
  await page.waitForFunction(() => __k.game.mode === 'story' && !__k.story.debug.S.inside && __k.life, { timeout: 30000 });
  await page.evaluate(() => { const d = __k.story.debug; d.S.dlg = null; document.getElementById('dlg').hidden = true; });
  check(gl.shadows, 'real-time shadows are on at mid quality');
  // the shadow box follows the camera into the village (it used to sit on the ring, leaving the houses unshadowed)
  const far = await page.evaluate(async () => { const h = __k.houses[4], d = __k.story.debug; __k.game.p.pos.set(h.x * 0.8, 0, h.z * 0.8); d.snapCam(); await new Promise(r => setTimeout(r, 1500));
    const t = __k.sun.target.position; return { d: Math.hypot(t.x - __k.game.p.pos.x, t.z - __k.game.p.pos.z), fromRing: Math.hypot(t.x, t.z) }; });
  check(far.d < 18 && far.fromRing > 5, /* the old fixed box sat at 0; how far out it lands depends on which way the camera faces */ `the shadows follow you into the village (shadow centre ${far.d.toFixed(1)} m from you, ${far.fromRing.toFixed(1)} m from the ring)`);
  await page.screenshot({ path: 'tests/out/look-village.jpg', type: 'jpeg', quality: 70 });
  check(await page.evaluate(() => { let ok = false; __k.scene.traverse(o => { if (o.isMesh && o.material && o.material.vertexColors && o.geometry.attributes.position.count > 40000 && !o.material.flatShading && o.castShadow) ok = true; }); return ok; }), 'trees are smooth-shaded and cast shadows on mid phones');
  check(await page.evaluate(() => __k.charMat.userData.fx.rim === true), 'people and animals have the warm rim light');
  // step 3: contact shading baked into the materials (works without real-time shadows)
  const ao = await page.evaluate(() => ({ wall: __k.wallMat.userData.fx, roof: __k.thatchMat.userData.fx, people: __k.charMat.userData.fx }));
  check(ao.wall.ao > 0 && ao.wall.eave && ao.roof.under && ao.people.ao > ao.wall.ao, `walls darken at the ground and under the eaves, roof undersides are shaded, feet darken less than walls (${JSON.stringify(ao)})`);
  // step 4: screen effects on a mid phone, the first thing auto-quality drops, back when it recovers
  const fx = await page.evaluate(async () => { const r = { built: !!__k.fx, on: __k.fx && __k.fx.on }; const frame = () => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(() => res(__k.renderer.info.render.calls)))), calls = async () => { let m = 1e9; for (let i = 0; i < 8; i++) m = Math.min(m, await frame()); return m; }; /* the quietest of eight frames: a chicken or a dust puff coming into view moved a single reading by one and failed this on CI */
    r.callsOn = await calls(); __k.applyStage(1); r.offAt1 = !__k.fx.on; r.callsOff = await calls(); __k.applyStage(0); r.backAt0 = __k.fx.on; return r; });
  check(fx.built && fx.on, 'mid phones get the screen effects (glow, grade, vignette)');
  check(fx.offAt1 && fx.backAt0 && fx.callsOn - fx.callsOff >= 3, `auto-quality drops them first and brings them back (${fx.callsOn} draws with, ${fx.callsOff} without)`);
  // step 5: people with smaller heads and smooth shading, bodies unchanged
  const ppl = await page.evaluate(() => { const out = {}; for (const k of ['man', 'woman', 'worker']) { const g = __k.loaded[k]; let m; g.scene.traverse(o => { if (o.isSkinnedMesh && !m) m = o; });
      const geo = m.geometry, p = geo.attributes.position, n = geo.attributes.normal, bones = m.skeleton.bones, hi = bones.findIndex(b => b.name === 'Head');
      const piv = new __k.THREE.Vector3().applyMatrix4(m.skeleton.boneInverses[hi].clone().invert()); let top = -9, bot = 9; for (let i = 0; i < p.count; i++) { top = Math.max(top, p.getY(i)); bot = Math.min(bot, p.getY(i)); }
      const seen = new Map(); let pairs = 0, same = 0; for (let i = 0; i < p.count; i++) { const kk = [p.getX(i), p.getY(i), p.getZ(i)].map(v => Math.round(v * 2000)).join(','); const j = seen.get(kk); if (j === undefined) { seen.set(kk, i); continue; } pairs++; if (n.getX(i) * n.getX(j) + n.getY(i) * n.getY(j) + n.getZ(i) * n.getZ(j) > 0.999) same++; }
      out[k] = { person: !!g.userData.person, head: (top - piv.y) / (top - bot), smooth: same / pairs }; } return out; });
  check(await page.evaluate(() => ['man', 'woman', 'worker'].every(k => __k.loaded[k].userData.faces) && (() => { const b = __k.player.body.geometry, f = b.userData.parts.find(p => p.name === 'Face'), c = b.attributes.color; let dark = 0, white = 0; for (let i = f.start; i < f.start + f.count; i++) (c.getX(i) < 0.3 ? dark++ : white++); return dark > 60 && white > 40; })()), 'faces have dark brows and irises in white eyes (not four white slits)');
  for (const [k, v] of Object.entries(ppl)) check(v.person && v.head < 0.325 && v.smooth > 0.5, `${k}: a smaller head (${Math.round(v.head * 100)}% of the height, was about 34%) and smooth shading (${Math.round(v.smooth * 100)}% shared normals)`);
  const b = await bullShape(page);
  check(b.zebu && b.hump > b.back + 0.1, `the bull has a zebu hump over the shoulders (top ${b.hump.toFixed(2)} vs back ${b.back.toFixed(2)})`);
  check(b.low < 0.03, `a dewlap hangs under his neck (lowest ${b.low.toFixed(2)}; the plain model's neck was at 0.09)`);
  check(b.tip > 0.36 && b.tipY > b.baseY + 0.12, `his horns sweep out and up (tip ${b.tip.toFixed(2)} out, ${(b.tipY - b.baseY).toFixed(2)} above the base)`);
  check(b.smooth > 0.6, `smooth shading on his body (${Math.round(b.smooth * 100)}% of shared corners share a normal)`);
  check(b.worldH > b.h * 1.06, `his size was measured before reshaping, so the hump and horns add to him instead of shrinking his body (${b.worldH.toFixed(2)} m tall with horns, body sized for ${b.h} m)`);
  // the cow: a small hump, same treatment
  await page.evaluate(() => __k.setAnimal('redcow')); await page.waitForFunction(() => __k.loaded.cow, { timeout: 30000 }).catch(() => {});
  const cow = await page.evaluate(() => { const g = __k.loaded.cow; return { has: !!g, z: !!(g && g.userData.zebu) }; });
  check(cow.has && cow.z, 'the cow is reshaped too (small hump)');
  // the camera is yours: drag the right side to swing and tilt (village), pinch/wheel to zoom
  const drag = async (x0, y0, dx, dy) => { await page.mouse.move(x0, y0); await page.mouse.down(); for (let i = 1; i <= 8; i++) await page.mouse.move(x0 + dx * i / 8, y0 + dy * i / 8); await page.mouse.up(); await sleep(400); };
  await page.evaluate(() => { const d = __k.story.debug; __k.game.p.pos.set(0, 0, 13); d.S.camYaw = 0; d.S.camPitch = undefined; d.snapCam(); }); await sleep(800);
  const v0 = await page.evaluate(() => ({ yaw: __k.story.debug.S.camYaw, cy: __k.camera.position.y }));
  await drag(320, 380, -90, 0); await drag(320, 300, 0, -120);
  const v1 = await page.evaluate(() => ({ yaw: __k.story.debug.S.camYaw, pitch: __k.story.debug.S.camPitch, cy: __k.camera.position.y }));
  check(Math.abs(v1.yaw - v0.yaw) > 0.4 && v1.pitch < 0.2 && v1.cy < v0.cy - 0.3, `village: dragging the right side swings the camera round (${(v1.yaw - v0.yaw).toFixed(2)} rad) and tilts it down to eye level (height ${v0.cy.toFixed(1)} -> ${v1.cy.toFixed(1)} m)`);
  await page.evaluate(() => { for (let i = 0; i < 4; i++) window.dispatchEvent(new WheelEvent('wheel', { deltaY: 120 })); }); await sleep(200); /* dispatched directly: an emulated touch phone may not route mouse.wheel */
  check(await page.evaluate(() => __k.story.debug.S.camZoom > 1.05), 'village: the wheel (pinch on phones) zooms out');
  { const g = await page.evaluate(() => { let r = null; __k.scene.traverse(o => { if (o.isInstancedMesh && o.userData.grass) r = { n: o.count, bump: !!__k.scene.children.find(c => c.isMesh && c.material && c.material.bumpMap) }; }); return r; });
    check(await page.evaluate(() => { let n = 0, c = 0; __k.scene.traverse(o => { if (o.isInstancedMesh && o.userData.leaves) { n++; c += o.count; } }); return n >= 1 && c > 1500; }), 'tree canopies wear leaf sprays (instanced cards), not bare green balls');
    check(g && g.n > 1800 && g.bump, `the village green has real grass blades (${g && g.n} clumps, one draw) and the ground has relief for the low sun`); }
  check(!logs.some(l => /Shader Error|Program Info Log|VALIDATE_STATUS/i.test(l)), 'every shader compiles (contact shading, rim, screen effects)');
  check(!realErrors(logs).length, 'mid: no page errors ' + realErrors(logs).join(' | ')); await page.close(); }
// ?nofx turns the screen effects off on a phone where they cause trouble
{ const page = await browser.newPage(); await page.emulate({ viewport: { width: 390, height: 780, deviceScaleFactor: 1, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-A346E) Mobile' });
  await page.goto('http://127.0.0.1:8791/?debug&q=mid&nofx', { waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => window.__k && __k.renderer, { timeout: 60000 });
  check(await page.evaluate(() => __k.fx === null), '?nofx turns the screen effects off'); await page.close(); }

// ---------- budget phone ----------
{ const { page, logs } = await open('low');
  const r = await page.evaluate(() => ({ aa: __k.renderer.getContext().getContextAttributes().antialias, shadows: __k.sun.castShadow, lambert: __k.charMat.type }));
  check(!r.aa && !r.shadows && r.lambert === 'MeshLambertMaterial' && await page.evaluate(() => __k.fx === null), `budget phones keep the cheap path (no MSAA, no shadows, no screen effects, ${r.lambert})`);
  check(await page.evaluate(() => __k.wallMat.userData.fx.eave && __k.charMat.userData.fx.ao > 0), 'budget phones still get the contact shading (it needs no shadows)');
  check(await page.evaluate(() => { let n = -1; __k.scene.traverse(o => { if (o.isInstancedMesh && o.userData.grass) n = o.count; }); return n > 100 && n <= 560; }), 'budget phones get a thin scatter of grass, not the full field'); // 450 until the land grew to 46 m (25 Nov)
  const b = await bullShape(page);
  check(b.zebu && b.hump > b.back + 0.1, `budget phones get the same zebu bull (${b.zebu}, hump ${b.hump.toFixed(2)} vs ${b.back.toFixed(2)})`);
  await page.evaluate(() => document.getElementById('quickBtn').click()); await sleep(3000);
  await page.screenshot({ path: 'tests/out/look-ring-low.jpg', type: 'jpeg', quality: 70 });
  // ring: drag the right side to look round; the stick still moves you camera-relative
  { await page.evaluate(() => { __k.hs.next = 999; const g = __k.game; g.p.pos.set(0, 0, 4); g.p.state = 'free'; g.b.state = 'watch'; }); await sleep(600);
    const drag = async (x0, y0, dx, dy) => { await page.mouse.move(x0, y0); await page.mouse.down(); for (let i = 1; i <= 8; i++) await page.mouse.move(x0 + dx * i / 8, y0 + dy * i / 8); await page.mouse.up(); await sleep(500); };
    await drag(330, 250, -110, 60);
    const r = await page.evaluate(() => ({ yaw: __k.view.yaw, pitch: __k.view.pitch }));
    check(Math.abs(r.yaw) > 0.5 && r.pitch > 0.5, `ring: dragging the right side swings (${r.yaw.toFixed(2)} rad) and tilts (${r.pitch.toFixed(2)}) the camera`);
    await sleep(1200);
    const mv = await page.evaluate(async () => { const g = __k.game, f = new __k.THREE.Vector3(); __k.camera.getWorldDirection(f); f.y = 0; f.normalize(); const p0 = g.p.pos.clone();
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' })); await new Promise(r => setTimeout(r, 700)); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
      const d = g.p.pos.clone().sub(p0); d.y = 0; return { along: d.dot(f), len: d.length() }; });
    check(mv.len > 0.3 && mv.along > mv.len * 0.7, `ring: forward on the stick still goes the way the camera looks (${mv.along.toFixed(2)} of ${mv.len.toFixed(2)} m)`); }
  // quality comes back: a phone that holds full speed climbs a stage; old saves (no v2) are ignored at launch
  { const q = await page.evaluate(() => { __k.applyStage(2); __k.stepUp(); const a = __k.perf.stage, saved = JSON.parse(localStorage.getItem('khuntau-perf')); __k.stepDown(); return { a, saved, noUp: __k.perf.noUp }; });
    check(q.a === 1 && q.saved.v === 2 && q.saved.stage === 1, `a phone at full speed gets a stage back and remembers it (${JSON.stringify(q.saved)})`);
    check(q.noUp, 'if it cannot hold the better stage it drops back and stays put for the session'); }
  check(!realErrors(logs).length, 'low: no page errors ' + realErrors(logs).join(' | ')); await page.close(); }
await finish(browser);
