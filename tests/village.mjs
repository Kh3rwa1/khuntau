// Village vs village in the browser, against the real Worker (wrangler dev --local on 8787):
// choose a village from the home screen, see it on the home line and in the board's Villages tab, get asked after
// a first scoring round, and share text that names the village and the one to pass. Phone, laptop and landscape.
import puppeteer from 'puppeteer';
import fs from 'fs'; fs.mkdirSync('tests/out', { recursive: true });
import { check, finish, realErrors, SW } from './check.mjs';
const BASE = process.argv[2] || 'http://127.0.0.1:8787';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rid = () => Math.random().toString(36).slice(2, 14).padEnd(12, 'x');
const post = (p, b) => fetch(BASE + p, { method: 'POST', body: JSON.stringify(b) }).then(r => r.json());
const score = async (pid, pts) => { const t = (await (await fetch(BASE + '/api/run?pid=' + pid)).json()).tok; return post('/api/score', { pid, name: 'V', pts, tok: t }); };
const tag = 'Vt' + Math.random().toString(36).slice(2, 7).replace(/[0-9]/g, 'k');
// a rival village above ours with 3 players, so the share text has someone to pass
for (let i = 0; i < 3; i++) { const p = rid(); await post('/api/village', { pid: p, name: `${tag} Upper`, dist: 'Godda' }); await score(p, 3); }
const browser = await puppeteer.launch({ args: [...SW, '--no-sandbox', '--mute-audio'] });
async function run(W, H, t, mobile) {
  const ctx = await browser.createBrowserContext(), page = await ctx.newPage(), logs = []; page.on('pageerror', e => logs.push(e.message));
  if (mobile) await page.emulate({ viewport: { width: W, height: H, deviceScaleFactor: 1, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-A346E) Mobile' }); else await page.setViewport({ width: W, height: H });
  await page.evaluateOnNewDocument(() => { localStorage.setItem('khuntau-played', '1'); localStorage.setItem('khuntau-name', 'Tester');
    navigator.canShare = () => false; navigator.share = (d) => { window.__shared = d; return Promise.resolve(); }; });
  await page.goto(BASE + '/?debug&q=low', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.getElementById('startBtn').dataset.village === 'ready', { timeout: 90000 });
  const shot = n => page.screenshot({ path: `tests/out/vil-${t}-${n}.jpg`, type: 'jpeg', quality: 72 });
  check(/Play for your village/.test(await page.$eval('#villageLine', e => e.textContent)), `${t}: home invites you to play for your village`);
  // a scoring round asks for the village
  await page.evaluate(() => document.getElementById('quickBtn').click()); await page.waitForFunction(() => __k.game.mode === 'play');
  await page.evaluate(() => { __k.game.score = 4; __k.game.pitha = 1; __k.gameOver(); });
  check(await page.waitForFunction(() => !document.getElementById('vilAsk').hidden && !document.getElementById('overScreen').hidden, { timeout: 8000 }).then(() => true, () => false), `${t}: after a scoring round you are asked to play for your village`);
  await shot('1-ask');
  await page.evaluate(() => document.getElementById('vilAsk').click()); await sleep(400);
  await page.select('#vilDist', 'Godda'); await page.waitForFunction((v) => [...document.querySelectorAll('#vilList option')].some(o => o.value === v), { timeout: 10000 }, `${tag} Upper`).catch(() => {}); /* the list comes from the server: wait for it instead of a fixed half second */
  const sug = await page.$$eval('#vilList option', o => o.map(x => x.value));
  check(sug.includes(`${tag} Upper`), `${t}: villages already playing in the district are suggested`);
  await page.type('#vilName', `${tag} Home`); await shot('2-form');
  await page.evaluate(() => document.getElementById('vilSave').click());
  check(await page.waitForFunction(() => document.getElementById('villageScreen').hidden && !document.getElementById('overScreen').hidden, { timeout: 8000 }).then(() => true, () => false), `${t}: saving goes back to the results`);
  check(await page.evaluate(() => __k.meta.vil && __k.meta.vil.d === 'Godda'), `${t}: the village is kept with your progress`);
  // two friends join, and we score: our village is on the board, below Upper
  const me = await page.evaluate(() => __k.meta.pid);
  for (let i = 0; i < 2; i++) { const p = rid(); await post('/api/village', { pid: p, name: `${tag.toLowerCase()} home`, dist: 'Godda' }); await score(p, 1); }
  await score(me, 1);
  await page.evaluate(() => document.getElementById('menuBtn').click()); await sleep(600);
  await page.evaluate(() => __k.loadVillages && __k.loadVillages());
  await page.waitForFunction((n) => /#\d+ today/.test(document.getElementById('villageLine').textContent), { timeout: 12000 }, tag).catch(() => {});
  const line = await page.$eval('#villageLine', e => e.textContent);
  check(new RegExp(`${tag} Home is #\\d+ today`).test(line), `${t}: home shows the village rank (${line})`); await shot('3-home');
  await page.evaluate(() => document.getElementById('boardBtn').click()); await sleep(400); await page.evaluate(() => document.getElementById('tabVil').click());
  check(await page.waitForFunction((n) => [...document.querySelectorAll('#boardList li')].some(li => li.className === 'me' && li.textContent.includes(n + ' Home')), { timeout: 8000 }, tag).then(() => true, () => false), `${t}: Villages tab lists your village, highlighted`);
  await shot('4-tab');
  // share names our village and the one above
  await page.evaluate(() => document.getElementById('boardClose').click());
  await page.evaluate(() => { __k.game.score = 4; }); await page.evaluate(() => document.getElementById('shareScoreBtn').click()); await page.waitForFunction(() => !!window.__shared, { timeout: 8000 }).catch(() => {});
  const sh = await page.evaluate(() => window.__shared && window.__shared.text || '');
  const above = ((await (await fetch(BASE + '/api/vboard?pid=' + me)).json()).today.me || {}).above; // the village right above ours on today's board
  if (!(above && sh.includes(`Help us pass ${above.v}!`))) console.log('  share text was:', sh, '| above:', JSON.stringify(above));
  check(sh.includes(`${tag} Home (Godda)`) && !!above && sh.includes(`Help us pass ${above.v}!`), `${t}: share text names your village and the one right above it (${above && above.v})`);
  { const e = realErrors(logs); check(!e.length, `${t}: no page errors` + (e.length ? ': ' + e.slice(0, 3).join(' | ') : '')); }
  await ctx.close();
}
await run(390, 780, 'p', true);
await run(1280, 720, 'd', false);
await run(780, 390, 'l', true);
await finish(browser);
