// Santali plumbing, without inventing Santali: a temp copy of the game gets clearly fake marker text ("[sat] ...")
// through tools/santali-import.mjs, then the language button must cycle English -> Hindi -> Santali -> English,
// the dialogue and action button must show the marker text, and Santali text must use the Ol Chiki font.
// The real game ships no Santali until a Santali speaker fills design/santali-strings.csv.
import puppeteer from 'puppeteer';
import http from 'http'; import fs from 'fs'; import os from 'os'; import path from 'path'; import { execFileSync } from 'child_process';
import { check, finish, realErrors, SW } from './check.mjs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'khuntau-sat-')); fs.cpSync('public', root, { recursive: true });
const sheet = fs.readFileSync('design/santali-strings.csv', 'utf8').replace(/\r/g, '').split('\n').map((l, i) => {
  if (i === 0 || !l) return l; if (/^ui,ENTER,/.test(l) || /^dialogue\.wake\.\d,/.test(l)) return l.replace(/,$/, ',[sat] ' + (l.match(/^[^,]+,("[^"]*"|[^,]*)/)[1].replace(/"/g, '').slice(0, 12))); return l; }).join('\n');
fs.writeFileSync(path.join(root, 'sheet.csv'), sheet);
console.log(execFileSync('node', ['tools/santali-import.mjs', path.join(root, 'sheet.csv'), path.join(root, 'story.js')]).toString().trim());
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.mp3': 'audio/mpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/json' };
const server = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split('?')[0]); if (u === '/') u = '/index.html'; const f = path.join(root, u);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }).listen(8793, '127.0.0.1');
const browser = await puppeteer.launch({ args: [...SW, '--no-sandbox', '--mute-audio'] });
const page = await browser.newPage(), logs = []; page.on('pageerror', e => logs.push(e.message));
await page.emulate({ viewport: { width: 390, height: 780, deviceScaleFactor: 1, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (Linux; Android 13) Mobile' });
await page.evaluateOnNewDocument(() => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', 1); localStorage.setItem('khuntau-story', JSON.stringify({ ch: 5, done: 1, painted: [1, 1, 1], chosen: 1, oiled: 1, garland: 1 })); localStorage.removeItem('khuntau-lang'); } });
await page.goto('http://127.0.0.1:8793/?debug&q=low', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => document.getElementById('startBtn').dataset.village === 'ready', { timeout: 90000 });
await page.evaluate(() => document.getElementById('startBtn').click()); await sleep(2500);
const btn = () => page.$eval('#langBtn', e => e.textContent);
check(await btn() === 'हिन्दी', 'English first; the button offers Hindi');
const lang = async () => { await page.keyboard.press('Escape'); await sleep(300); await page.evaluate(() => document.getElementById('langBtn').click()); await page.evaluate(() => document.getElementById('resumeBtn').click()); await sleep(400); };
await lang(); check(await btn() === 'Santali', 'in Hindi, the button offers Santali (because there is Santali text)');
await lang(); check(await page.evaluate(() => document.documentElement.classList.contains('lang-sat')), 'Santali selected');
await page.evaluate(() => __k.story.debug.say([['x', 'y']])); await page.evaluate(() => { const d = __k.story.debug; d.S.dlg = null; document.getElementById('dlg').hidden = true; });
await page.evaluate(() => { const h = __k.houses[0]; __k.game.p.pos.set(h.x + Math.sin(h.rot) * (h.d / 2 + 1), 0, h.z + Math.cos(h.rot) * (h.d / 2 + 1)); });
await page.waitForFunction(() => { const n = __k.story.debug.S.near; return n && n.label === 'ENTER'; }, { timeout: 20000 });
await sleep(300);
check(/^\[sat\]/.test(await page.$eval('#actBtn', e => e.textContent)), 'Santali text from the sheet shows on the action button');
check(/Ol Chiki/.test(await page.$eval('#actBtn', e => getComputedStyle(e).fontFamily)), 'Santali text uses the Ol Chiki font');
check(!!(await page.evaluate(() => localStorage.getItem('khuntau-lang') === 'sat')), 'the choice is remembered');
await lang(); check(await btn() === 'हिन्दी' && !(await page.evaluate(() => document.documentElement.classList.contains('lang-sat'))), 'Santali -> English closes the loop');
{ const e = realErrors(logs); check(!e.length, 'no page errors' + (e.length ? ': ' + e.join(' | ') : '')); }
server.close(); fs.rmSync(root, { recursive: true, force: true });
await finish(browser);
