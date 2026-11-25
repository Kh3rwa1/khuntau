// The home screen must not move while it loads: an early tap has to land on the row it was aimed at.
// Records the tops of the home screen's buttons and rows every 50 ms and on every frame drawn, from the first paint
// until 4 s after the village is ready, and fails if any of them moves more than 1 px.
// "slow" holds the late files back one after another (the game's main script, each font, story.js, album.js, talk.js):
// what a slow phone connection does, and what puts every late arrival after the first paint whatever the machine.
// Beyond a new player at four screen sizes: a returning player whose next festival day has opened (Hindi, a best score,
// a village), a finished festival, a day already kept, a challenge link, a room link, a phone that starts offline,
// a tap on PLAY before the village is ready, and an open room arriving late from the server. Then the rows are given
// the longest lines the server can send, to see that none wraps.
// It fails on the code from before 25 Nov in every one of its loads.
//   node tests/homeshift.mjs                         static server (tests/serve.mjs): every case
//   node tests/homeshift.mjs http://127.0.0.1:8787   against wrangler, where the board, the village talk and the villages
//                                                    answer: the cases those answers can change
//   V=1 ONLY=phone node tests/homeshift.mjs          print every move with its time; only the runs whose name has "phone"
//   P=1 node tests/homeshift.mjs                     one page at a time (two by default: the suite is long enough)
import puppeteer from 'puppeteer';
import fs from 'fs'; import { check, finish, SW } from './check.mjs'; fs.mkdirSync('tests/out', { recursive: true });
const BASE = process.argv[2] || 'http://127.0.0.1:8791', ONLINE = !!process.argv[2], V = !!process.env.V, ONLY = process.env.ONLY || '', P = +process.env.P || 2;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ protocolTimeout: 180000, args: [...SW, '--no-sandbox', '--mute-audio'] });
const ROWS = ['startBtn', 'langRow', 'quickBtn', 'animalBtn', 'boardBtn', 'villageBtn', 'albumBtn']; // the rows a thumb goes for
const ALSO = ['playSub', 'dayOl', 'bestLine', 'challenge', 'today', 'talkBtn', 'remindBtn', 'friendsBtn', 'onlineBox', 'rooms', 'keepBtn', 'creditsBtn']; // and everything round them
const SIZES = { phone: [390, 780, true], small: [360, 640, true], landscape: [780, 390, true], laptop: [1280, 720, false] };
// held back by this many ms after the page asks for them
const SLOW = [[/three\.module/, 500], [/baloo-2-latin\.woff2/, 900], [/rubik-dirt-latin\.woff2/, 1200], [/story\.js/, 1300], [/noto-sans-ol-chiki-ol-chiki/, 1700], [/rubik-dirt-latin-ext/, 2100], [/album\.js/, 2500], [/talk\.js/, 2900]];

function probe(ids) {
  const H = window.__hs = { rows: [], paint: null, ready: null }; let last = '';
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) if (e.name === 'first-paint' && H.paint === null) H.paint = e.startTime; }).observe({ type: 'paint', buffered: true }); } catch (e) {}
  const take = () => { const home = document.getElementById('startScreen'); if (!home) return; const o = {};
    for (const id of ids) { const el = document.getElementById(id), r = el && el.getBoundingClientRect(); o[id] = r && (r.width || r.height) ? [Math.round(r.top * 10) / 10, Math.round(r.height * 10) / 10, getComputedStyle(el).visibility !== 'hidden' ? 1 : 0] : null; }
    const b = document.getElementById('startBtn'); if (H.ready === null && b && b.dataset.village === 'ready') H.ready = performance.now();
    const s = JSON.stringify(o) + home.hidden; H.n = (H.n || 0) + 1; H.t = Math.round(performance.now()); if (s === last) return; last = s; H.rows.push([H.t, o, home.hidden]); }; // only changes are kept
  setInterval(take, 50); (function frame() { take(); requestAnimationFrame(frame); })();
}
// a player who has been here before: day 2 of the festival was kept on an earlier day, so day 3 opens now
const BACK = (lang) => `(() => { const S = (k, v) => localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
  S('khuntau-best', '14'); S('khuntau-name', 'Mina'); S('khuntau-seen-tips', '1'); ${lang ? `S('khuntau-lang', '${lang}');` : ''}
  S('khuntau-meta', { pid: 'homeshift0tester1', xp: 460, streak: 3, bestStreak: 5, lastDay: '', day: '', cnt: {}, done: {}, shirt: 1, vil: { d: 'Dumka', v: 'Tumdah' } });
  S('khuntau-story', { ch: 2, w: 1, kh: 1, painted: [1, 1, 1], chosen: 1, oiled: 1, alpana: 1, seen: { nest: 1, cat: 1 }, fest: FEST }); })()`;
const day = (f) => (src) => src.replace('FEST', f);
const CASES = [ // name, size, slow, options
  ['phone', 'phone', false, { online: true }], ['phone-slow', 'phone', true, { first: true, online: true }], ['small-slow', 'small', true, {}], ['landscape-slow', 'landscape', true, {}],
  ['laptop', 'laptop', false, {}], ['laptop-slow', 'laptop', true, { first: true, online: true }],
  ['back-phone', 'phone', true, { before: day("{ day: 2, on: '2020-1-1', fin: 0, seen: 2 }")(BACK('hi')), want: { dayOl: 1, bestLine: 1 }, long: true, online: true }],
  ['back-laptop', 'laptop', true, { before: day("{ day: 2, on: '2020-1-1', fin: 0, seen: 2 }")(BACK('')), want: { dayOl: 1, bestLine: 1 }, long: true }],
  ['festival-over-phone', 'phone', true, { before: day("{ day: 5, on: '2020-1-1', fin: 1, seen: 5 }")(BACK('')), want: { dayOl: 0 } }],
  ['day-kept-phone', 'phone', true, { before: day("{ day: 2, on: ((d) => d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate())(new Date()), fin: 0, seen: 2 }")(BACK('')), want: { dayOl: 0 } }],
  ['challenge-phone', 'phone', true, { url: '/?q=low&beat=14&from=Gouri', want: { challenge: 1, quickBtn: 0 } }],
  ['room-link-laptop', 'laptop', true, { url: '/?q=low&room=ABCD', want: { onlineBox: 1 } }],
  ['offline-phone', 'phone', true, { before: "Object.defineProperty(Navigator.prototype, 'onLine', { get: () => false })", want: { friendsBtn: 0, boardBtn: 0, talkBtn: 0 } }],
  ['early-tap-phone', 'phone', true, { tap: true }],
  // an open room arrives 3 s after it was asked for. On a phone it comes in under "Play with friends": only the two small links under it may move
  ['open-room-phone', 'phone', true, { rooms: true, want: { rooms: 1 }, may: ['keepBtn', 'creditsBtn'] }], ['open-room-laptop', 'laptop', true, { rooms: true, want: { rooms: 1 } }],
];

async function run(name, [w, h, touch], slow, { url = '/?q=low', before = null, want = null, long = false, first = false, tap = false, rooms = false, may = [] } = {}) {
  const C = await browser.createBrowserContext(), page = await C.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.setViewport({ width: w, height: h, isMobile: touch, hasTouch: touch, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(probe, [...ROWS, ...ALSO]); if (before) await page.evaluateOnNewDocument(before);
  // PLAY the moment it lights up, before the village is ready (tapped from inside the page: from here it can come too late on a busy machine)
  if (tap) await page.evaluateOnNewDocument(() => { const t = setInterval(() => { const b = document.getElementById('startBtn'); if (!b || b.disabled) return; clearInterval(t); const early = b.dataset.village !== 'ready'; b.click(); window.__tapped = { early, text: b.textContent }; }, 15); });
  if (slow) { await page.setRequestInterception(true); page.on('request', q => { if (rooms && /\/api\/rooms/.test(q.url())) return void setTimeout(() => q.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ rooms: [{ id: 'ABCD', host: 'Mina', n: 2, phase: 'lobby' }, { id: 'EFGH', host: 'Sundarmani', n: 5, phase: 'play' }] }) }).catch(() => {}), 3000);
      const d = SLOW.find(([re]) => re.test(q.url())); d ? setTimeout(() => q.continue().catch(() => {}), d[1]) : q.continue().catch(() => {}); }); }
  const nav = page.goto(BASE + url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  if (first) { await page.waitForFunction(() => window.__hs && window.__hs.paint !== null, { timeout: 30000, polling: 30 }).catch(() => {}); await page.screenshot({ path: `tests/out/home-${name}-first.jpg`, type: 'jpeg', quality: 72 }).catch(() => {}); } // what a slow phone shows first
  await nav;
  let tapped = null;
  if (tap) { await page.waitForFunction(() => window.__tapped, { timeout: 120000, polling: 50 }); tapped = await page.evaluate(() => window.__tapped); await page.screenshot({ path: `tests/out/home-${name}.jpg`, type: 'jpeg', quality: 72 }).catch(() => {}); }
  await page.waitForFunction(() => window.__hs.ready !== null, { timeout: 120000, polling: 100 });
  await sleep(4000);
  if (!tap) await page.screenshot({ path: `tests/out/home-${name}.jpg`, type: 'jpeg', quality: 72 });
  const H = await page.evaluate(() => window.__hs);
  // the longest lines the server and the game can put in the rows: none may wrap and push the rows under it
  let grew = null;
  if (long) grew = await page.evaluate((ids) => { const tops = () => ids.map(id => { const e = document.getElementById(id), r = e.getBoundingClientRect(); return r.width || r.height ? Math.round(r.top * 10) / 10 : null; }), a = tops(), W = 'Wwwwwwwwwwwwww';
    document.getElementById('boardLine').textContent = `You are #128 of 1480 today · ${W} leads you by 112`; document.getElementById('villageLine').textContent = `${W} ${W} is #12 today · 118 to pass ${W} ${W} · 148 kept the festival today`;
    document.getElementById('lvlLine').textContent = 'Level 10 · Sohrai Legend of the whole district'; document.getElementById('streakLine').textContent = 'Day 365 streak · play to keep it';
    document.getElementById('animalName').textContent = 'White cow · Restless and more than that today'; document.getElementById('playSub').textContent = 'Into the village · Sohrai Day 5 of 5: Hako Katkom, and a long way round the pond';
    document.querySelector('#talkBtn span').textContent = `148 here now · ${W}: ` + 'johar '.repeat(30); document.getElementById('albumLine').textContent = 'एल्बम: 16 में से 13 और बहुत कुछ जो यहाँ एक पंक्ति में नहीं आता है';
    for (const li of document.querySelectorAll('#missions li')) li.firstChild.textContent = 'Play a round with friends from three other villages today';
    document.getElementById('bestLine').textContent = 'Best 999 · Sohrai Legend'; document.getElementById('startBtn').textContent = 'Opening the village…';
    const b = tops(); return ids.map((id, i) => [id, a[i], b[i]]).filter(q => q[1] !== null && Math.abs(q[1] - q[2]) > 1).map(q => `${q[0]} ${q[1]} -> ${q[2]}`); }, [...ROWS, ...ALSO]);
  if (long) await page.screenshot({ path: `tests/out/home-${name}-long.jpg`, type: 'jpeg', quality: 72 });
  await C.close();
  // Only changes were kept, so the layout that was painted first is the last one recorded up to the first paint: it is
  // the base everything after is held against. Without a paint time (a browser that does not report it): from the first look.
  let base = 0; if (H.paint !== null) H.rows.forEach((r, i) => { if (r[0] <= H.paint) base = i; });
  const rows = H.rows.slice(base).filter(r => !r[2]); // and only while the home screen is up
  const moved = [], also = [], log = [], seen = {}; let tracked = 0;
  for (const id of [...ROWS, ...ALSO]) { let first = null, lo = 0, hi = 0, prev;
    for (const [t, o] of rows) { const v = o[id]; if (!v) { if (prev) log.push(`${t} ms  ${id} gone`); prev = null; continue; }
      if (!prev) log.push(`${t} ms  ${id} ${first === null ? 'at' : 'back at'} ${v[0]} (h ${v[1]}${v[2] ? '' : ', unseen'})`);
      else if (Math.abs(v[0] - prev[0]) > 0.5 || Math.abs(v[1] - prev[1]) > 0.5 || v[2] !== prev[2]) log.push(`${t} ms  ${id} top ${prev[0]} -> ${v[0]}, h ${prev[1]} -> ${v[1]}${v[2] !== prev[2] ? v[2] ? ', seen' : ', unseen' : ''}`);
      if (first === null) first = lo = hi = v[0]; lo = Math.min(lo, v[0]); hi = Math.max(hi, v[0]); prev = v; }
    seen[id] = prev ? prev[2] : 0; if (first !== null && ROWS.includes(id)) tracked++; // at the end: 1 on screen, 0 not there (or its room kept, unseen)
    if (first !== null && hi - lo > 1 && !may.includes(id)) (ROWS.includes(id) ? moved : also).push(`${id} ${Math.round((hi - lo) * 10) / 10} px (${lo} to ${hi})`); }
  if (V) { log.sort((a, b) => parseInt(a) - parseInt(b)); console.log(`--- ${name}: first paint ${H.paint === null ? '?' : Math.round(H.paint)} ms, village ready ${Math.round(H.ready)} ms, ${H.n} looks, ${rows.length} different\n` + log.join('\n')); }
  return { moved, also, grew, seen, tapped, tracked, n: H.n, from: H.paint !== null ? H.paint : rows.length ? rows[0][0] : 0, to: H.t, paint: H.paint, ready: H.ready, errs };
}

const todo = CASES.filter(([name, , , opt]) => (!ONLY || name.includes(ONLY)) && (!ONLINE || opt.online)), done = []; let next = 0;
await Promise.all(Array.from({ length: Math.min(P, todo.length) }, async () => { while (next < todo.length) { const i = next++, [name, size, slow, opt] = todo[i]; done[i] = await run(name, SIZES[size], slow, opt).catch(e => ({ fail: String(e && e.message || e) })); } }));
check(todo.length > 0, `${todo.length} loads of the home screen` + (ONLINE ? ' against the Worker' : ''));
todo.forEach(([name, size, slow, opt], i) => { const r = done[i], dims = SIZES[size].slice(0, 2).join('x');
  if (r.fail) return void check(false, `${name}: the home screen loaded and the village got ready: ${r.fail}`);
  check(r.n > 20 && r.tracked >= 5 && r.to - r.from > 4000 && r.to - r.ready > 3500, `${name}: watched ${r.tracked} of the ${ROWS.length} rows from ${r.paint === null ? 'the first layout' : 'the first paint'} (${Math.round(r.from)} ms) until ${((r.to - r.ready) / 1000).toFixed(1)} s after the village was ready (${r.n} looks)`);
  check(!r.moved.length, `${name} (${dims}): none of the rows a thumb goes for moves more than 1 px while the home screen loads` + (r.moved.length ? ': ' + r.moved.join(', ') : ''));
  check(!r.also.length, `${name}: nothing round them moves either` + (r.also.length ? ': ' + r.also.join(', ') : ''));
  if (opt.want) { const bad = Object.entries(opt.want).filter(([id, on]) => !!r.seen[id] !== !!on).map(([id, on]) => `${id} should ${on ? '' : 'not '}be seen`); check(!bad.length, `${name}: the rows that belong to this player are the ones on screen (${Object.entries(opt.want).map(([id, on]) => (on ? '' : 'no ') + id).join(', ')})` + (bad.length ? ': ' + bad.join(', ') : '')); }
  if (opt.long) check(r.grew && !r.grew.length, `${name}: the longest lines (board place, village, talk, level, missions, Hindi album) are cut, not wrapped: no row moves` + (r.grew && r.grew.length ? ': ' + r.grew.join(', ') : ''));
  if (opt.tap) check(r.tapped && r.tapped.early && /Opening/.test(r.tapped.text), `${name}: PLAY was tapped before the village was ready (button said "${r.tapped && r.tapped.text}")`);
  const errs = r.errs.filter(e => !/404|Failed to load|net::|fetch/i.test(e)); check(!errs.length, `${name}: no page errors ` + errs.join(' | ')); });
await finish(browser);
