// The home screen must not move once it is drawn. On 25 Nov it jumped five times while loading (the UI font arriving,
// the loading bar going, the line under PLAY and the day's name appearing, the talk and album rows appearing, the
// Ol Chiki font arriving), so a thumb on its way to a row landed on its neighbour.
// Everything that arrives late is made to arrive late here: fonts, story.js, album.js and every server answer are held
// back, so the test sees the screen before and after each of them, whatever the speed of the machine.
//   node tests/homeshift.mjs     (static server on 8791; the server's answers are stood in for here)
import puppeteer from 'puppeteer';
import fs from 'fs'; fs.mkdirSync('tests/out', { recursive: true });
import { check, finish, realErrors, SW } from './check.mjs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ protocolTimeout: 180000, args: [...SW, '--no-sandbox', '--mute-audio'] });
const logs = [];
const WATCH = ['h1', '.tag', '#startBtn', '#playSub', '#langRow', '#dayOl', '#quickBtn', '#today', '#talkBtn', '#animalBtn', '#boardBtn', '#villageBtn', '#albumBtn', '#friendsBtn', '#keepBtn', '#creditsBtn'];
const LONG = 'Karandih Bada Tola'; // a village name of ordinary length: its standing line is far longer than a row
const ANSWERS = { // what the Worker would say, each a little later than the page expects
  '/api/here': [1500, { on: 1, now: 4, today: 31, last: 9, p: { id: 9, n: 'Sorek3y', a: 'abcdefghij', k: 'round', t: 0 } }],
  '/api/vboard': [1100, { today: { me: { rank: 2, p: 61, n: 5, above: { v: 'Baripada Majhi Tola', p: 74 } }, top: [] }, fest: 3 }],
  '/api/board': [900, { top: [{ n: 'Paritosh Hembr', p: 42 }], total: 9 }],
};
async function run(tag, { w, h, store = {}, lang = 'en' }) {
  const ctx = await browser.createBrowserContext(), page = await ctx.newPage(), phone = w < 1000; page.setDefaultNavigationTimeout(90000); page.on('pageerror', e => logs.push(tag + ': ' + e.message));
  await page.emulate({ viewport: { width: w, height: h, deviceScaleFactor: 1, isMobile: phone, hasTouch: phone }, userAgent: phone ? 'Mozilla/5.0 (Linux; Android 13; SM-A346E) Mobile' : 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130 Safari/537.36' });
  await page.setRequestInterception(true);
  page.on('request', (r) => { const u = new URL(r.url()), a = ANSWERS[u.pathname];
    if (a) { setTimeout(() => r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(a[1]) }).catch(() => {}), a[0]); return; }
    const wait = /\.woff2$/.test(u.pathname) ? 1300 : /\/(story|album|talk)\.js$/.test(u.pathname) ? 700 : 0; // late, as on a phone connection
    if (wait) setTimeout(() => r.continue().catch(() => {}), wait); else r.continue().catch(() => {}); });
  await page.evaluateOnNewDocument((store, lang, WATCH) => { localStorage.setItem('khuntau-seen-tips', '1'); localStorage.setItem('khuntau-lang', lang); for (const k in store) localStorage.setItem(k, store[k]);
    window.__hs = { first: null, worst: {}, events: [], fonts: 0, n: 0 };
    const snap = () => { const o = {}; for (const s of WATCH) { const e = document.querySelector(s); if (!e) continue; const r = e.getBoundingClientRect(); o[s] = e.hidden || r.height === 0 ? null : [r.top, r.height]; } return o; };
    const tick = () => { const H = window.__hs, o = snap(); H.n++; if (!H.first) { H.first = o; return; }
      for (const s in o) { const a = H.first[s], c = o[s]; if (!a && !c) continue; const d = !a || !c ? 999 : Math.max(Math.abs(c[0] - a[0]), Math.abs(c[1] - a[1])); if (d > (H.worst[s] || 0)) { H.worst[s] = d; if (d > 1) H.events.push([Math.round(performance.now()), s, a && a.map(Math.round).join('+'), c && c.map(Math.round).join('+')]); } } };
    addEventListener('DOMContentLoaded', () => { tick(); const loop = () => { tick(); requestAnimationFrame(loop); }; requestAnimationFrame(loop); document.fonts.addEventListener('loadingdone', () => { window.__hs.fonts++; }); }); }, store, lang, WATCH);
  await page.goto('http://127.0.0.1:8791/?debug&fest&q=low', { waitUntil: 'domcontentloaded' }); // &fest: the festival as players have it, so the day's name is there to arrive
  await page.waitForFunction(() => document.getElementById('startBtn').dataset.village === 'ready', { timeout: 120000 });
  await page.waitForFunction(() => { const t = document.getElementById('talkBtn'); return !t.hidden && t.style.visibility !== 'hidden' && /here now|अभी/.test(t.textContent); }, { timeout: 20000 }).catch(() => {});
  await sleep(2500);
  const r = await page.evaluate(() => { const H = window.__hs, vis = (id) => { const e = document.getElementById(id); return !e.hidden && e.style.visibility !== 'hidden' && e.getBoundingClientRect().height > 8; };
    return { worst: H.worst, events: H.events.slice(0, 6), frames: H.n, fonts: H.fonts, baloo: document.fonts.check('13px "Baloo 2"'), late: { talk: vis('talkBtn') && /Sorek3y/.test(document.getElementById('talkBtn').textContent), album: vis('albumBtn') && /\d/.test(document.getElementById('albumBtn').textContent), sub: document.getElementById('playSub').textContent.length > 8, bar: document.getElementById('loadBar').hidden, day: document.getElementById('dayOl').textContent.length, village: document.getElementById('villageLine').textContent, board: document.getElementById('boardLine').textContent },
      first: Object.fromEntries(Object.entries(H.first).map(([k, v]) => [k, v && v.map(Math.round).join('+')])) }; });
  await page.screenshot({ path: `tests/out/homeshift-${tag}.jpg`, type: 'jpeg', quality: 76 });
  await ctx.close(); return r;
}
const worstOf = (r) => { const e = Object.entries(r.worst).sort((a, b) => b[1] - a[1])[0] || ['', 0]; return { sel: e[0], px: Math.round(e[1] * 10) / 10 }; };
const say = (r) => r.events.length ? ' - ' + r.events.map(e => `${e[1]} ${e[2]}→${e[3]} at ${e[0]} ms`).join('; ') : '';

{ // a new player on a phone: the case that was measured jumping
  const r = await run('phone', { w: 390, h: 780 }), wst = worstOf(r);
  check(r.frames > 60 && r.fonts >= 1 && r.baloo, `the screen was watched from its first paint, and the fonts arrived after it (${r.frames} frames, ${r.fonts} font loads)`);
  check(r.late.talk && r.late.album && r.late.sub && r.late.bar && r.late.day > 3, `everything that arrives late did arrive: the line under PLAY, the day's name, the talk row, the album row; the loading bar went` + (r.late.talk && r.late.album && r.late.sub && r.late.bar && r.late.day > 3 ? '' : ' ' + JSON.stringify(r.late)));
  check(wst.px <= 1, `phone, new player: nothing moved or changed height by more than 1 px while it loaded (worst ${wst.px} px, ${wst.sel})` + say(r));
  check(r.first['#talkBtn'] && r.first['#albumBtn'] && r.first['#dayOl'] && r.first['#playSub'], 'the talk row, the album row, the day\'s name and the line under PLAY have their place from the first paint');
  check(/Paritosh Hembr leads today/.test(r.late.board), `the board line took its late words without moving anything (${r.late.board})`);
}
{ // a returning player with a village, in Hindi: best score line, streak, a standing far longer than its row
  const r = await run('phone-village-hi', { w: 390, h: 780, lang: 'hi', store: { 'khuntau-meta': JSON.stringify({ pid: 'homeshifttest00001', xp: 420, streak: 3, vil: { d: 'East Singhbhum', v: LONG, k: 'east singhbhum|karandih bada tola' } }), 'khuntau-best': '31', 'khuntau-name': 'Asha' } }), wst = worstOf(r);
  check(r.late.village.includes(LONG) && /to pass Baripada/.test(r.late.village) && r.late.village.length > 60, `a village's standing arrived: ${r.late.village.length} letters (${r.late.village.slice(0, 48)}...)`);
  check(wst.px <= 1, `phone, returning player with a village, Hindi: nothing moved by more than 1 px (worst ${wst.px} px, ${wst.sel})` + say(r));
}
for (const [tag, w, h] of [['small-phone', 360, 640], ['landscape', 780, 390], ['laptop', 1280, 720], ['monitor', 1440, 900]]) {
  const r = await run(tag, { w, h }), wst = worstOf(r);
  check(r.late.talk && r.late.album && wst.px <= 1, `${tag} ${w}x${h}: nothing moved by more than 1 px (worst ${wst.px} px, ${wst.sel})` + say(r));
}
check(realErrors(logs).length === 0, 'no page errors ' + realErrors(logs).join(' | ').slice(0, 300));
await finish(browser);
