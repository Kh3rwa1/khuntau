// A budget-phone stand-in: CPU throttled 6x, phone viewport, automatic quality ON (no ?q=). It can't tell how a
// Galaxy A34 feels, but it proves the safety net works: the game turns its quality down by itself when frames are
// slow, remembers it for the next launch, and the story still loads, walks and plays. Also checks the ?fps meter.
import puppeteer from 'puppeteer';
import { check, finish, realErrors, SW } from './check.mjs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ protocolTimeout: 240000, args: [...SW, '--no-sandbox', '--mute-audio'] });
const page = await browser.newPage(), logs = []; page.on('pageerror', e => logs.push(e.message));
await page.emulate({ viewport: { width: 390, height: 780, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-A346E) Mobile' });
const cdp = await page.createCDPSession(); await cdp.send('Emulation.setCPUThrottlingRate', { rate: process.env.CI ? 1 : 6 }); // CI's software rendering is already slower than any phone
await page.evaluateOnNewDocument(() => { localStorage.removeItem('khuntau-perf'); localStorage.setItem('khuntau-story', JSON.stringify({ ch: 5, done: 1, painted: [1, 1, 1], chosen: 1, oiled: 1, garland: 1 })); });
await page.goto('http://127.0.0.1:8791/?debug&fps', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__k && __k.perf, { timeout: 120000, polling: 50 });
const s0 = await page.evaluate(() => __k.perf.stage); // fresh phone, nothing saved: the starting stage for its class
check(await page.waitForFunction(() => !document.getElementById('storyBtn').disabled, { timeout: 180000 }).then(() => true, () => false), 'slow phone: game finishes loading');
await page.evaluate(() => document.getElementById('storyBtn').click()); await sleep(4000);
await page.evaluate(() => { const d = __k.story.debug; d.S.dlg = null; document.getElementById('dlg').hidden = true; });
await page.waitForFunction((s0) => __k.perf.stage > s0, { timeout: 90000, polling: 1000 }, s0).catch(() => {});
const s1 = await page.evaluate(() => ({ stage: __k.perf.stage, thin: __k.perf.thin, ratio: __k.renderer.getPixelRatio() }));
check(s1.stage > s0, `quality steps itself down on a slow phone (stage ${s0} -> ${s1.stage}, pixel ratio ${s1.ratio.toFixed(2)})`);
check(!!(await page.evaluate(() => localStorage.getItem('khuntau-perf'))), 'the chosen quality is remembered for the next launch');
const p0 = await page.evaluate(() => [__k.game.p.pos.x, __k.game.p.pos.z]);
await page.keyboard.down('KeyW'); await sleep(4000); await page.keyboard.up('KeyW');
const p1 = await page.evaluate(() => [__k.game.p.pos.x, __k.game.p.pos.z]);
check(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) > 1.5, 'slow phone: the player still walks');
check(/fps · worst .* ms · q\d/.test(await page.$eval('#fpsMeter', e => e.textContent)), '?fps shows a live meter');
await page.screenshot({ path: 'tests/out/slowphone.jpg', type: 'jpeg', quality: 70 });
{ const e = realErrors(logs); check(!e.length, 'no page errors' + (e.length ? ': ' + e.slice(0, 4).join(' | ') : '')); }
await finish(browser);
