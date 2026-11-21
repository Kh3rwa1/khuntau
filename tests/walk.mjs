// Walking feel: hold the stick straight at a goal and see if the player slides around people or gets stuck.
// Run with tests/serve.mjs up: node tests/walk.mjs   (prints one line per route, exits 1 if any route fails)
import puppeteer from 'puppeteer';
import fs from 'fs'; fs.mkdirSync('tests/out', { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ protocolTimeout: 180000, args: [...(process.env.SWGL ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : []), '--no-sandbox', '--mute-audio'] });
const page = await browser.newPage(); const logs = [];
page.on('pageerror', e => logs.push('PAGEERROR ' + e.message));
await page.emulate({ viewport: { width: 390, height: 780, deviceScaleFactor: 1, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-A346E) Mobile' });
await page.evaluateOnNewDocument(() => { localStorage.setItem('khuntau-story', JSON.stringify({ ch: 5, done: 1, painted: [1, 1, 1], chosen: 1, oiled: 1, garland: 1 })); });
await page.goto('http://127.0.0.1:8791/?debug&q=low', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => document.getElementById('startBtn').dataset.village === 'ready', { timeout: 90000 });
await page.evaluate(() => document.getElementById('startBtn').click()); await sleep(2500);
await page.evaluate(() => { const d = __k.story.debug; d.S.dlg = null; document.getElementById('dlg').hidden = true; });

// Steer like a player: stick held toward the goal, relative to the camera, every frame.
await page.evaluate(() => {
  const k = window.__k, I = k.input, st = window.__steer = { goal: null };
  Object.defineProperty(I, 'x', { get: () => st.x || 0, set() {}, configurable: true });
  Object.defineProperty(I, 'y', { get: () => st.y || 0, set() {}, configurable: true });
  const T = k.THREE, f = new T.Vector3(), r = new T.Vector3(), d = new T.Vector3(), UP = new T.Vector3(0, 1, 0);
  (function loop() {
    const p = k.game.p.pos;
    if (st.goal) {
      d.set(st.goal[0] - p.x, 0, st.goal[1] - p.z);
      if (d.length() < 0.7) { st.x = st.y = 0; st.done = true; }
      else { d.normalize(); f.copy(p).sub(k.camera.position).setY(0).normalize(); r.crossVectors(f, UP).normalize(); st.x = d.dot(r); st.y = -d.dot(f); }
    } else st.x = st.y = 0;
    requestAnimationFrame(loop);
  })();
});

async function route(name, from, to, label, limit = 14) {
  await page.evaluate((from) => { const s = __steer; s.goal = null; s.done = false; __k.game.p.pos.set(from[0], 0, from[1]); __k.story.debug.snapCam(); }, from);
  await sleep(300);
  await page.evaluate((to, label) => { __steer.goal = to; __steer.label = label || null; }, to, label);
  const t0 = Date.now(); let last = await page.evaluate(() => [__k.game.p.pos.x, __k.game.p.pos.z]), stuck = 0, worst = 0, done = false;
  while ((Date.now() - t0) / 1000 < limit) {
    await sleep(250);
    const s = await page.evaluate(() => { const n = __k.story.debug.S.near; return { p: [__k.game.p.pos.x, __k.game.p.pos.z], done: __steer.done || (!!__steer.label && !!n && n.label === __steer.label) }; });
    if (s.done) { done = true; break; }
    const moved = Math.hypot(s.p[0] - last[0], s.p[1] - last[1]); last = s.p;
    if (moved < 0.25) { stuck += 0.25; worst = Math.max(worst, stuck); } else stuck = 0;  // < 1 m/s counts as stuck
  }
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  await page.evaluate(() => { __steer.goal = null; });
  const ok = done && worst < 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: ${done ? 'arrived' : 'never arrived'} in ${secs}s, longest stall ${worst.toFixed(2)}s`);
  if (!ok) await page.screenshot({ path: `tests/out/walk-${name}.jpg`, type: 'jpeg', quality: 70 });
  return ok;
}

// Geometry of the village, read from the game
const G = await page.evaluate(() => {
  const d = __k.story.debug, ds = d.W.drumStand;
  const dancers = __k.crowd.filter(c => c.sBase).map(c => [c.sBase.x, c.sBase.z]);
  const mid = dancers[Math.floor(dancers.length / 2)];
  const mj = __k.crowd.find(c => !c.sBase && c.wrap.position.distanceTo(d.W.majhiPos) < 0.1);
  return { ds: [ds.x, ds.z], dancers, mid, mj: [d.W.majhiPos.x, d.W.majhiPos.z] };
});
const away = (p, k) => { const m = Math.hypot(p[0], p[1]); return [p[0] * (m + k) / m, p[1] * (m + k) / m]; };
let pass = true;
// 1. straight at the dancer line from the village centre side, to the drum behind it (done when BEAT shows;
//    the drum stand itself is inside the drum's collider)
pass &= await route('through-dancers', away(G.mid, -5), G.ds, 'BEAT');
// 2. straight at the dancer line, aiming between two dancers
{ const a = G.dancers[1], b = G.dancers[2], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; pass &= await route('between-dancers', away(m, -4), away(m, 3)); }
// 3. head-on into one dancer: should slide around, not stop
{ const a = G.dancers[0]; pass &= await route('headon-dancer', away(a, -4), away(a, 3)); }
// 4. head-on into the Majhi
{ const m = G.mj, c = [m[0] * 0.8, m[1] * 0.8], dx = m[0] - c[0], dz = m[1] - c[1]; pass &= await route('headon-majhi', c, [m[0] + dx, m[1] + dz]); }
// 5. slow phone: hidden dancers must not be invisible walls
await page.evaluate(() => { __k.perf.thin = true; }); await sleep(300);
{ const a = G.dancers[4] || G.dancers.at(-1); pass &= await route('thin-hidden-dancer', away(a, -4), away(a, 3)); }
await page.evaluate(() => { __k.perf.thin = false; });
console.log(logs.slice(0, 5).join('\n') || 'no errors');
await browser.close();
process.exit(pass ? 0 : 1);
