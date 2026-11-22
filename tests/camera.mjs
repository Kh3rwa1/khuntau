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
{ const e = realErrors(logs); check(!e.length, 'no page errors' + (e.length ? ': ' + e.slice(0, 3).join(' | ') : '')); }
await finish(browser);
