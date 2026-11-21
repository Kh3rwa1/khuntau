// What a player sees when the server says "too many requests" (429): many Indian phones share one carrier IP,
// so a real player can hit a per-IP limit. Save code and restore must say "try again in a minute", not stay blank.
import puppeteer from 'puppeteer';
import { check, finish, realErrors } from './check.mjs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ protocolTimeout: 120000, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage(), logs = []; page.on('pageerror', e => logs.push(e.message));
await page.emulate({ viewport: { width: 390, height: 780, deviceScaleFactor: 1, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-A346E) Mobile' });
await page.setRequestInterception(true);
page.on('request', q => /\/api\/(save|restore)/.test(q.url()) ? q.respond({ status: 429, body: 'slow down' }) : q.continue());
await page.goto('http://127.0.0.1:8791/?debug&q=low', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !document.getElementById('storyBtn').disabled, { timeout: 90000 });
await page.evaluate(() => { __k.meta.code = ''; document.getElementById('keepBtn').click(); });
const busy = /Try again in a minute/;
check(await page.waitForFunction((re) => new RegExp(re).test(document.getElementById('keepNote').textContent), { timeout: 5000 }, busy.source).then(() => true, () => false), 'save code refused (429): the keep screen says try again in a minute');
await page.evaluate(() => { document.getElementById('restoreIn').value = 'ABCDEF'; document.getElementById('restoreBtn').click(); }); await sleep(800);
check(busy.test(await page.$eval('#keepNote', e => e.textContent)), 'restore refused (429): says try again in a minute');
await page.screenshot({ path: 'tests/out/busy-keep.jpg', type: 'jpeg', quality: 70 });
{ const e = realErrors(logs); check(!e.length, 'no page errors' + (e.length ? ': ' + e.join(' | ') : '')); }
await finish(browser);
