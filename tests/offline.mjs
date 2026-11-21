// Offline play and updates through the real service worker.
// Serves a temp copy of public/ on 8792, lets the service worker install, then really stops the server
// (puppeteer's offline switch doesn't reach service workers) and checks the game still boots, story mode
// starts and the cow (loaded only when picked) still loads. Then it "deploys" a new story.js and checks a
// returning player gets it on the next load, not the stale cached copy. Run: node tests/offline.mjs
import puppeteer from 'puppeteer';
import http from 'http'; import fs from 'fs'; import os from 'os'; import path from 'path';
import { check, finish, realErrors, SW } from './check.mjs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'khuntau-off-')); fs.cpSync('public', root, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.mp3': 'audio/mpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/json', '.jpg': 'image/jpeg' };
let server;
const up = () => new Promise(res => { server = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split('?')[0]); if (u === '/') u = '/index.html'; const f = path.join(root, u);
  if (u.startsWith('/api') || !f.startsWith(root) || !fs.existsSync(f)) { r.writeHead(404); return r.end('no'); }
  r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-cache' }); fs.createReadStream(f).pipe(r); }).listen(8792, '127.0.0.1', res); });
const down = () => new Promise(res => { server.closeAllConnections(); server.close(res); });
await up();
const browser = await puppeteer.launch({ protocolTimeout: 180000, args: [...SW, '--no-sandbox', '--mute-audio'] });
const page = await browser.newPage(), logs = []; page.on('pageerror', e => logs.push(e.message));
await page.emulate({ viewport: { width: 390, height: 780, deviceScaleFactor: 1, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-A346E) Mobile' });
const URL = 'http://127.0.0.1:8792/?debug&q=low';
const boot = () => page.waitForFunction(() => !document.getElementById('storyBtn').disabled, { timeout: 90000 }).then(() => true, () => false);
await page.goto(URL, { waitUntil: 'domcontentloaded' }); await boot();
// first visit: wait until the service worker has saved everything and controls the page
await page.evaluate(() => navigator.serviceWorker.ready);
await page.waitForFunction(async () => { const ks = await caches.keys(); if (!ks.length) return false; const c = await caches.open(ks[0]); return (await c.keys()).length >= 36; }, { timeout: 60000, polling: 500 });
await page.reload({ waitUntil: 'domcontentloaded' }); await boot();
check(await page.evaluate(() => !!navigator.serviceWorker.controller), 'service worker controls the game after the first visit');
check(await page.evaluate(async () => { const c = await caches.open((await caches.keys())[0]); return !!(await c.match('/models/cow.json')) && !!(await c.match('/story.js')); }), 'cow model and story saved for offline');

// really offline
await down();
await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
check(await boot(), 'offline: game boots from the phone');
await page.evaluate(() => document.getElementById('storyBtn').click()); await sleep(3000);
check(await page.evaluate(() => __k.game.mode === 'story' && !!__k.story), 'offline: story mode starts (story.js from the saved copy)');
check(await page.evaluate(async () => (await __k.setAnimal('redcow')).id === 'redcow'), 'offline: picking the cow loads its model (setAnimal keeps the old animal if the load fails)');
await page.screenshot({ path: 'tests/out/offline-story.jpg', type: 'jpeg', quality: 70 });

// a deploy: new story.js on the server, same service worker. Next load must run the new code.
fs.appendFileSync(path.join(root, 'story.js'), '\nwindow.__deployStamp = 2;\n');
await up();
await page.goto(URL, { waitUntil: 'domcontentloaded' }); await boot();
await page.evaluate(() => document.getElementById('storyBtn').click()); await sleep(2500);
check(await page.evaluate(() => window.__deployStamp === 2), 'after a deploy, a returning phone runs the new story.js on its next load');
{ const e = realErrors(logs); check(!e.length, 'no page errors' + (e.length ? ': ' + e.slice(0, 4).join(' | ') : '')); }
await down(); fs.rmSync(root, { recursive: true, force: true });
await finish(browser);
