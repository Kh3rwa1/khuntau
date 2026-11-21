import puppeteer from 'puppeteer';
import fs from 'fs'; import { check, finish, realErrors } from './check.mjs'; fs.mkdirSync('tests/out', { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ protocolTimeout: 180000, args: [...(process.env.SWGL ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : []), '--no-sandbox', '--mute-audio'] });
async function run(W, H, tag, mobile, ch) {
  const page = await browser.newPage(); const logs = [];
  page.on('console', m => { if (m.type() === 'error') logs.push(m.text()); }); page.on('pageerror', e => logs.push('PAGEERROR ' + e.message + (e.stack || '').split('\n').slice(0, 3).join(' | ')));
  if (mobile) await page.emulate({ viewport: { width: W, height: H, deviceScaleFactor: 1, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36' }); else await page.setViewport({ width: W, height: H });
  await page.evaluateOnNewDocument((ch) => { localStorage.setItem('khuntau-story', JSON.stringify({ ch, painted: ch > 1 ? [1, 1, 1] : [1, 0, 0], chosen: ch > 2 ? 1 : 0, oiled: ch > 2 ? 1 : 0, garland: ch > 2 ? 1 : 0 })); }, ch);
  await page.goto('http://127.0.0.1:8791/?debug' + (mobile ? '&q=low' : ''), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !document.getElementById('storyBtn').disabled, { timeout: 90000 });
  const shot = n => page.screenshot({ path: `tests/out/${tag}-${n}.jpg`, type: 'jpeg', quality: 72 });
  const pos = () => page.evaluate(() => [__k.game.p.pos.x, __k.game.p.pos.z].map(v => +v.toFixed(1)));
  console.log(tag, 'label:', await page.$eval('#storyBtn', e => e.textContent));
  await page.evaluate(() => document.getElementById('storyBtn').click()); await sleep(2500); await shot('a-start');
  const p0 = await pos(); await page.keyboard.down('KeyW'); await sleep(5000); const p1 = await pos(); await shot('b-walk'); 
  await page.keyboard.up('KeyW'); await page.keyboard.down('KeyD'); await sleep(3000); await page.keyboard.up('KeyD'); const p2 = await pos(); await shot('c-turn');
  console.log(tag, 'walk', p0, p1, p2, 'fps', await page.evaluate(() => (__k.perf.fps || 0).toFixed(0)));
  // walk back into the house wall: must not pass through
  const h = await page.evaluate(() => { const h = __k.houses[0]; __k.game.p.pos.set(h.x * 0.7, 0, h.z * 0.7); return [h.x, h.z]; });
  await page.evaluate(() => { const d = __k.story.debug; d.S.camYaw = Math.atan2(-__k.houses[0].x, -__k.houses[0].z); d.S.lookT = performance.now() / 1000 + 99; d.snapCam(); });
  await page.keyboard.down('KeyW'); await sleep(6000); await page.keyboard.up('KeyW'); const p3 = await pos();
  const inside = await page.evaluate(() => { const h = __k.houses[0], p = __k.game.p.pos, c = Math.cos(h.rot), s = Math.sin(h.rot), dx = p.x - h.x, dz = p.z - h.z; return Math.abs(dx * c - dz * s) < h.w / 2 && Math.abs(dx * s + dz * c) < h.d / 2; });
  check(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) > 1.5, `${tag}: holding W walks the player`);
  check(!inside, `${tag}: walking into a house wall does not pass through it`); await shot('d-wall');
  // go indoors: stand in the yard facing the door and walk to it
  await page.evaluate(() => { const d = __k.story.debug, h = __k.houses[0], f = h.d / 2 + 4.4; __k.game.p.pos.set(h.x + Math.sin(h.rot) * f, 0, h.z + Math.cos(h.rot) * f); d.S.camYaw = h.rot; d.S.lookT = performance.now() / 1000 + 99; d.snapCam(); });
  await page.keyboard.down('KeyW');
  // let go of W the moment ENTER shows, like a player reaching the door (a fast machine would otherwise walk on past it)
  const gotDoor = await page.waitForFunction(() => { const n = __k.story.debug.S.near; if (n && n.label === 'ENTER') { dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' })); return true; } return false; }, { timeout: 8000, polling: 'raf' }).then(() => true, () => false);
  await page.keyboard.up('KeyW'); await page.evaluate(() => { __k.story.debug.S.lookT = -9; });
  check(gotDoor, `${tag}: walking to the door shows ENTER`);
  check(await page.evaluate(() => { const n = __k.story.debug.S.near; return !!n && n.label === 'ENTER'; }), `${tag}: still at the door after letting go`);
  await page.keyboard.press('KeyE');
  check(await page.waitForFunction(() => __k.story.debug.S.inside, { timeout: 8000 }).then(() => true, () => false), `${tag}: E at the door goes inside`); await sleep(1200); await shot('e-inside');
  const pin = await pos();
  await page.keyboard.down('KeyA'); await sleep(2500); await page.keyboard.up('KeyA'); await shot('f-inside-walk'); { const q = await pos(); check(Math.hypot(q[0] - pin[0], q[1] - pin[1]) > 1, `${tag}: can walk inside the house`); }
  // pause and quit to menu
  await page.keyboard.press('Escape'); await sleep(500); await shot('g-pause'); await page.evaluate(() => document.getElementById('quitBtn').click()); await sleep(900);
  check(await page.evaluate(() => __k.game.mode) === 'menu' && await page.evaluate(() => !document.getElementById('startScreen').hidden), `${tag}: quit from pause returns to the menu`);
  // normal game still starts, with another animal
  await page.evaluate(() => document.getElementById('animalBtn').click()); await sleep(600); await page.evaluate(() => document.getElementById('startBtn').click()); await sleep(2500); await shot('h-ring');
  check(await page.evaluate(() => __k.game.mode) === 'play', `${tag}: ring game starts after story`); check(await page.evaluate(() => __k.crowd.every(c => c.wrap.position.distanceTo(c.home) < 0.01)), `${tag}: villagers back home for the ring`);
  { const e = realErrors(logs); check(!e.length, `${tag}: no page errors` + (e.length ? ': ' + e.slice(0, 5).join(' | ') : '')); }
  await page.close();
}
await run(780, 390, 'l', true, 1);
await run(390, 780, 'q', true, 4);
await run(1280, 720, 'd', false, 3);
await finish(browser);
