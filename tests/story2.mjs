import puppeteer from 'puppeteer';
import fs from 'fs'; fs.mkdirSync('tests/out', { recursive: true });
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
  console.log(tag, 'house at', h.map(v => +v.toFixed(1)), 'player', p3, 'inside wall?', inside); await shot('d-wall');
  // go indoors
  await page.evaluate(() => { const d = __k.story.debug; d.S.lookT = -9; }); 
  await page.waitForFunction(() => { const n = __k.story.debug.S.near; return n && n.label === 'ENTER'; }, { timeout: 20000 }).catch(() => console.log(tag, 'no ENTER prompt near door'));
  await page.keyboard.press('KeyE'); await sleep(2500); await shot('e-inside');
  await page.keyboard.down('KeyA'); await sleep(2500); await page.keyboard.up('KeyA'); await shot('f-inside-walk'); console.log(tag, 'inside pos', await page.evaluate(() => [__k.game.p.pos.x, __k.game.p.pos.z].map(v => +v.toFixed(1))));
  // pause and quit to menu
  await page.keyboard.press('Escape'); await sleep(500); await shot('g-pause'); await page.evaluate(() => document.getElementById('quitBtn').click()); await sleep(900);
  console.log(tag, 'after quit mode', await page.evaluate(() => __k.game.mode), 'menu visible', await page.evaluate(() => !document.getElementById('startScreen').hidden), 'label', await page.$eval('#storyBtn', e => e.textContent));
  // normal game still starts, with another animal
  await page.evaluate(() => document.getElementById('animalBtn').click()); await sleep(600); await page.evaluate(() => document.getElementById('startBtn').click()); await sleep(2500); await shot('h-ring');
  console.log(tag, 'ring mode', await page.evaluate(() => __k.game.mode), 'animal', await page.$eval('#animalName', e => e.textContent), 'crowd home?', await page.evaluate(() => __k.crowd.every(c => c.wrap.position.distanceTo(c.home) < 0.01)));
  console.log(tag, logs.filter(l => !/404|GPU|WebGL|ERR_FAILED|GroupMarker/i.test(l)).slice(0, 8).join('\n') || 'no errors');
  await page.close();
}
await run(780, 390, 'l', true, 1);
await run(390, 780, 'q', true, 4);
await run(1280, 720, 'd', false, 3);
await browser.close();
