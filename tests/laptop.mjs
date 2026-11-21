import puppeteer from 'puppeteer';
import fs from 'fs'; import { check, finish } from './check.mjs'; fs.mkdirSync('tests/out', { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ protocolTimeout: 180000, args: [...(process.env.SWGL ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : []), '--no-sandbox', '--mute-audio'] });
const page = await browser.newPage(); const logs = []; page.on('pageerror', e => logs.push(e.message));
await page.setViewport({ width: 1280, height: 720 });
await page.goto('http://127.0.0.1:8791/?debug', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !document.getElementById('storyBtn').disabled, { timeout: 90000 });
await page.click('#storyBtn'); await sleep(2500);
await page.keyboard.press('Enter'); await sleep(500); await page.keyboard.press('Enter'); await sleep(800); await page.screenshot({ path: 'tests/out/lap-1.jpg', type: 'jpeg', quality: 70 });
await page.evaluate(() => { const h = __k.story.debug.W.inside.handi; __k.game.p.pos.set(h.x, h.y, h.z + 0.8); }); await sleep(1000);
{ const b = await page.evaluate(() => { const b = document.getElementById('actBtn'), r = b.getBoundingClientRect(); return { d: getComputedStyle(b).display, t: b.textContent, w: r.width, x: r.right, y: r.bottom }; }); check(b.d !== 'none' && b.t === 'DRINK' && b.w >= 60 && b.x <= 1280 && b.y <= 720, `laptop: big DRINK button on screen (${b.t}, ${Math.round(b.w)}px)`); }
await page.screenshot({ path: 'tests/out/lap-2.jpg', type: 'jpeg', quality: 70 });
const r = await page.evaluate(() => { const b = document.getElementById('actBtn').getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; });
await page.mouse.click(r[0], r[1]); await sleep(2500);
check(await page.evaluate(() => __k.story.debug.save.ch) === 1, 'laptop: clicking the button drinks (chapter 1)'); check(!logs.length, 'laptop: no page errors ' + logs.join(' | '));
await finish(browser);
