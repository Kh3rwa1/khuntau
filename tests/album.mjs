// The album (public/album.js): the five festival day cards, the keepsake for keeping all five, and the ten things to
// find, as painted stamps. A kept day must bring its card with a Share button; a find must drop its stamp in; the
// album must open from the home screen and the pause menu, in English and Hindi, on a phone, in landscape and on a laptop.
//   node tests/album.mjs     (static server on 8791)
import puppeteer from 'puppeteer';
import fs from 'fs'; fs.mkdirSync('tests/out', { recursive: true });
import { check, finish, realErrors, SW } from './check.mjs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ protocolTimeout: 180000, args: [...SW, '--no-sandbox', '--mute-audio'] });
const logs = [];
const PHONE = 'Mozilla/5.0 (Linux; Android 13; SM-A346E) Mobile', DESK = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130 Safari/537.36';
async function open({ w = 390, h = 780, save = {}, lang = 'en', name = 'Asha', query = 'debug&fest&q=low' } = {}) {
  const ctx = await browser.createBrowserContext(), page = await ctx.newPage(); page.setDefaultNavigationTimeout(90000); page.on('pageerror', e => logs.push(e.message));
  const phone = w < 1000; await page.emulate({ viewport: { width: w, height: h, deviceScaleFactor: 1, isMobile: phone, hasTouch: phone }, userAgent: phone ? PHONE : DESK });
  await page.evaluateOnNewDocument((save, lang, name) => { localStorage.setItem('khuntau-seen-tips', '1'); localStorage.setItem('khuntau-story', JSON.stringify(save)); localStorage.setItem('khuntau-lang', lang); if (name) localStorage.setItem('khuntau-name', name);
    // the share sheet and the step counter, caught for the checks below
    navigator.canShare = () => true; navigator.share = async (d) => { window.__shared = { files: (d.files || []).map(f => ({ name: f.name, type: f.type, size: f.size })), text: d.text || '' }; };
    navigator.sendBeacon = (u, b) => { (b && b.text ? b.text() : Promise.resolve(String(b))).then(t => (window.__beacons = window.__beacons || []).push(u + ' ' + t)); return true; }; }, save, lang, name);
  await page.goto('http://127.0.0.1:8791/?' + query, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__k && __k.album && document.getElementById('startBtn').dataset.village === 'ready', { timeout: 90000 });
  const ev = (f, ...a) => page.evaluate(f, ...a), until = (f, ms = 30000, ...a) => page.waitForFunction(f, { timeout: ms, polling: 60 }, ...a).then(() => true, () => false);
  const shown = (sel) => ev((sel) => { const e = document.querySelector(sel); if (!e || e.hidden) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).display !== 'none'; }, sel);
  const inside = (sel) => ev((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 && r.width > 20; }, sel);
  const village = async () => { await ev(() => document.getElementById('startBtn').click()); await until(() => __k.game.mode === 'story');
    if (await until(() => { const c = document.getElementById('dayCard'); return c && !c.hidden && c.classList.contains('show'); }, 6000)) { await ev(() => document.getElementById('dayCard').click()); await sleep(600); }
    await sleep(900); await ev(() => { const d = __k.story.debug; d.S.dlg = null; document.getElementById('dlg').hidden = true; d.S.mode = 'walk'; d.S.lock = 0; }); };
  return { page, ctx, ev, until, shown, inside, village };
}
const today = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };

{ // ---- a player on the first day: an empty album, a find, the day kept, the card shared ----
  const P = await open({ save: { ch: 2, w: 1, kh: 1, painted: [1, 1, 1], chosen: 1 } }), { page, ev, until } = P;
  check(await ev(() => { const b = document.getElementById('albumBtn'); return !b.hidden && /Album: 0 of 16/.test(b.textContent); }), 'home: the album row says 0 of 16');
  await page.tap('#albumBtn');
  check(await P.shown('#album') && await ev(() => document.querySelectorAll('#album .alb-day').length === 6 && document.querySelectorAll('#album .alb-find').length === 10), 'it opens: five days, the keepsake and ten things to find');
  check(await ev(() => [...document.querySelectorAll('#album .alb-card')].every(c => c.classList.contains('no') && c.disabled) && [...document.querySelectorAll('#album .alb-card i')].every(i => getComputedStyle(i).backgroundImage === 'none')), 'nothing kept yet: every card is empty, no painting is given away');
  check(await ev(() => [...document.querySelectorAll('#album .alb-find small')].every(s => s.textContent.length > 8) && !/nest|kite|tortoise|honey/i.test(document.querySelector('#album .alb-finds').textContent)), 'the things to find show clues, not their names');
  await page.screenshot({ path: 'tests/out/album-empty.jpg', type: 'jpeg', quality: 78 });
  await ev(() => document.querySelector('#album .alb-day').click()); await sleep(200);
  check(!(await P.shown('#albView')), 'an empty card does not open');
  await page.tap('#album .alb-x'); check(!(await P.shown('#album')), 'the cross closes it');

  await P.village();
  // a find drops its stamp in
  await ev(() => { const d = __k.story.debug, q = d.W.finds.tortoise; __k.game.p.pos.set(q.x + 0.9, 0, q.z + 0.6); d.S.camYaw = Math.atan2(-0.9, -0.6); d.snapCam(); });
  check(await until(() => (__k.story.debug.save.seen || {}).tortoise === 1, 8000) && await until(() => document.getElementById('albStamp').classList.contains('show'), 4000), 'seeing the tortoise slides its stamp in');
  await sleep(700);
  const st = await ev(() => { const s = document.getElementById('albStamp'), r = s.getBoundingClientRect(), hit = (id) => { const e = document.getElementById(id); if (!e || e.hidden) return false; const q = e.getBoundingClientRect(); return q.width > 0 && r.left < q.right - 1 && q.left < r.right - 1 && r.top < q.bottom - 1 && q.top < r.bottom - 1; };
    return { text: s.textContent, on: r.left >= 0 && r.right <= innerWidth && r.top >= 0, covers: ['pauseBtn', 'muteBtn', 'talkHud', 'actBtn', 'objective', 'hudStory'].filter(hit), pic: getComputedStyle(s.querySelector('i')).backgroundImage }; });
  check(/tortoise/i.test(st.text) && /1\/10/.test(st.text) && st.on && st.covers.length === 0 && /finds\.webp/.test(st.pic), `the stamp names it, counts 1/10, and sits clear of the buttons (${st.text})` + (st.covers.length ? ' - on ' + st.covers : ''));
  await page.screenshot({ path: 'tests/out/album-stamp.jpg', type: 'jpeg', quality: 78 });
  check(await ev(async () => { const i = new Image(); i.src = 'art/finds.webp'; await i.decode(); return i.naturalWidth === 1600 && i.naturalHeight === 640; }), 'the stamp sheet is ten squares (1600x640)');
  await page.tap('#albStamp');
  check(await P.shown('#album') && await ev(() => __k.game.menuOpen && document.querySelector('#album .alb-find.new') && /tortoise/i.test(document.querySelector('#album .alb-find.new').textContent)), 'tapping the stamp pauses and opens the album on the new stamp');
  check(await ev(() => /1 of 16/.test(document.querySelector('#album .alb-top span').textContent) && document.querySelectorAll('#album .alb-find:not(.no)').length === 1), 'one of sixteen');
  // keys must not reach the game while the album is up
  const p0 = await ev(() => [__k.game.p.pos.x, __k.game.p.pos.z]); await page.keyboard.down('w'); await sleep(500); await page.keyboard.up('w');
  await page.keyboard.press('Escape'); await sleep(250);
  check(!(await P.shown('#album')) && await ev(() => !document.getElementById('pauseScreen').hidden), 'Escape closes the album and leaves the pause menu');
  await ev(() => document.getElementById('resumeBtn').click()); await sleep(300);
  check(await ev((p0) => Math.hypot(__k.game.p.pos.x - p0[0], __k.game.p.pos.z - p0[1]) < 0.05, p0), 'W pressed over the album did not walk you');

  // the day's part is done: after the banner, the day's card, yours to keep and share
  await ev(() => { const d = __k.story.debug; __k.game.p.pos.set(0, 0, 14); d.save.oiled = 1; d.persist(); d.festCheck(); });
  check(await ev(() => __k.story.debug.festWaiting()), 'oiling the horns keeps Um Hilok');
  check(!(await P.shown('#albView')), 'the card does not jump in over the banner');
  check(await until(() => { const v = document.getElementById('albView'); return v && !v.hidden; }, 14000), 'then the day\'s card comes up by itself');
  await until(() => document.querySelector('#albView img').src.startsWith('blob:'), 15000);
  const kv = await ev(() => ({ head: document.querySelector('#albView em').textContent, title: document.querySelector('#albView b').textContent, sub: document.querySelector('#albView p').textContent, share: document.querySelector('#albView .btn').textContent, go: document.querySelector('#albView .linkbtn').textContent }));
  check(/Added to your album/.test(kv.head) && /Day 1: Um Hilok/.test(kv.title) && /Day 2 \(Dakay Din\) opens tomorrow/.test(kv.sub) && kv.share === 'Share' && kv.go === 'Continue', `it says what it is and what opens tomorrow (${kv.title} / ${kv.sub})`);
  check(await P.inside('#albView img') && await P.inside('#albView .btn') && await P.inside('#albView .linkbtn'), 'card, Share and Continue all fit on the phone');
  await sleep(400); await page.screenshot({ path: 'tests/out/album-kept-day1.jpg', type: 'jpeg', quality: 80 });
  const card = await ev(async () => { const c = await __k.album.compose('day', 1), bm = await createImageBitmap(c.blob); const r = new FileReader(), url = await new Promise(res => { r.onload = () => res(r.result); r.readAsDataURL(c.blob); }); return { w: bm.width, h: bm.height, painted: c.painted, kb: Math.round(c.blob.size / 1024), url }; });
  fs.writeFileSync('tests/out/album-card-day1.jpg', Buffer.from(card.url.split(',')[1], 'base64'));
  check(card.w === 1080 && card.h === 1350 && card.painted && card.kb > 60 && card.kb < 900, `the card is a 1080x1350 picture of the day's painting (${card.kb} KB)`);
  await page.tap('#albView .btn'); await until(() => !!window.__shared, 8000);
  const sh = await ev(() => window.__shared || {});
  check(sh.files && sh.files.length === 1 && sh.files[0].name === 'sohrai-day1.jpg' && sh.files[0].type === 'image/jpeg' && sh.files[0].size > 60000, 'Share hands the phone the picture');
  check(/Um Hilok/.test(sh.text) && /day 1 of Sohrai/.test(sh.text) && /\/\?k=1$/.test(sh.text), `with words and a link that says where it came from (${(sh.text || '').slice(-70)})`);
  await page.tap('#albView .linkbtn'); await sleep(300);
  check(!(await P.shown('#albView')) && await ev(() => __k.story.wantsControls()), 'Continue: back in the village with your hands free');
  await sleep(2500); check(!(await P.shown('#albView')), 'and the card does not come back');

  // the pause menu's journal button opens the album
  await page.keyboard.press('Escape'); await until(() => !document.getElementById('pauseScreen').hidden, 5000);
  check(await ev(() => !document.getElementById('seenBtn').hidden && /1\/10/.test(document.getElementById('seenBtn').textContent)), 'pause menu: seen 1/10');
  await ev(() => document.getElementById('seenBtn').click()); await sleep(300);
  check(await P.shown('#album') && await ev(() => /2 of 16/.test(document.querySelector('#album .alb-top span').textContent) && !document.querySelector('#album .alb-day').classList.contains('no') && /day1\.webp/.test(getComputedStyle(document.querySelector('#album .alb-day i')).backgroundImage)), 'it opens the album: Um Hilok is in it, 2 of 16');
  await page.screenshot({ path: 'tests/out/album-two.jpg', type: 'jpeg', quality: 78 });
  await ev(() => document.querySelector('#album .alb-day').click()); await until(() => document.querySelector('#albView img').src.startsWith('blob:'), 15000);
  check(await ev(() => document.querySelector('#albView em').textContent === '' && document.querySelector('#albView .linkbtn').textContent === 'Close' && !document.querySelector('#albView .btn').hidden), 'a kept day opens again from the album, with Share');
  await page.keyboard.press('Escape'); await sleep(200); check(!(await P.shown('#albView')) && await P.shown('#album'), 'Escape closes the card first, the album stays');
  await ev(() => document.querySelector('#album .alb-find:not(.no)').click()); await sleep(300);
  check(await P.shown('#albView .albv-pic.sq') && await ev(() => document.querySelector('#albView .btn').hidden && /tortoise/i.test(document.querySelector('#albView b').textContent)) && await P.inside('#albView .albv-pic.sq'), 'a stamp opens large, with its name');
  await page.screenshot({ path: 'tests/out/album-find.jpg', type: 'jpeg', quality: 78 });
  await page.tap('#albView .linkbtn'); await page.tap('#album .alb-x'); await ev(() => document.getElementById('quitBtn').click()); await until(() => __k.game.mode === 'menu', 8000);
  check(await ev(() => /Album: 2 of 16/.test(document.getElementById('albumBtn').textContent)), 'back on the home screen the row has counted both');
  await P.ctx.close();
}

{ // ---- Hindi, the last day: keeping Hako Katkom brings the keepsake for all five ----
  const P = await open({ lang: 'hi', name: 'आशा', save: { ch: 5, w: 1, kh: 1, done: 1, painted: [1, 1, 1], chosen: 1, oiled: 1, alpana: 1, garland: 1, fest: { day: 5, on: '', fin: 0, seen: 5 }, seen: { nest: 1, kite: 1, tortoise: 1, cat: 1, toy: 1, hive: 1, couple: 1, dogs: 1, carrier: 1 } } }), { page, ev, until } = P;
  check(await ev(() => /एल्बम: 16 में से 13/.test(document.getElementById('albumBtn').textContent)), 'Hindi home row: 13 of 16');
  await P.village();
  await ev(() => { const d = __k.story.debug, t = d.today(); __k.game.p.pos.set(0, 0, 14); t.fish = 1; d.persist(); d.festCheck(); });
  check(await until(() => { const v = document.getElementById('albView'); return v && !v.hidden; }, 16000) && await until(() => document.querySelector('#albView img').src.startsWith('blob:'), 15000), 'the fifth day kept: a card comes up');
  const kv = await ev(() => ({ head: document.querySelector('#albView em').textContent, title: document.querySelector('#albView b').textContent, all: document.getElementById('albView').textContent, art: document.querySelector('#albView img').style.backgroundImage }));
  check(/सोहराय पूरा/.test(kv.title) && /complete\.webp/.test(kv.art), `it is the keepsake for all five (${kv.title})`);
  check(!/[A-Za-z]{3,}/.test(kv.all), 'no English on it: ' + (kv.all.match(/[A-Za-z]{3,}/g) || []).join(' '));
  await sleep(400); await page.screenshot({ path: 'tests/out/album-complete-hi.jpg', type: 'jpeg', quality: 80 });
  const card = await ev(async () => { const c = await __k.album.compose('fin', 5), bm = await createImageBitmap(c.blob); const r = new FileReader(), url = await new Promise(res => { r.onload = () => res(r.result); r.readAsDataURL(c.blob); }); return { w: bm.width, h: bm.height, painted: c.painted, url }; });
  fs.writeFileSync('tests/out/album-card-complete-hi.jpg', Buffer.from(card.url.split(',')[1], 'base64'));
  check(card.w === 1080 && card.h === 1350 && card.painted, 'the keepsake card is drawn on its painting');
  await page.tap('#albView .btn'); await until(() => !!window.__shared, 8000); const sh = await ev(() => window.__shared || {});
  check(sh.files && sh.files[0] && sh.files[0].name === 'sohrai-complete.jpg' && /पाँचों दिन/.test(sh.text) && /\/\?k=all$/.test(sh.text), 'shared in Hindi, with the link');
  await page.tap('#albView .linkbtn'); await sleep(300);
  await page.keyboard.press('Escape'); await until(() => !document.getElementById('pauseScreen').hidden, 5000); await ev(() => document.getElementById('seenBtn').click()); await sleep(300);
  const al = await ev(() => ({ text: document.getElementById('album').textContent, days: document.querySelectorAll('#album .alb-day:not(.no)').length, finds: document.querySelectorAll('#album .alb-find:not(.no)').length, count: document.querySelector('#album .alb-top span').textContent }));
  check(al.days === 6 && al.finds === 9 && /16 में से 15/.test(al.count), `the album: all five days and the keepsake, nine of ten things (${al.count})`);
  check(!/[A-Za-z]{3,}/.test(al.text), 'the album is all Hindi: ' + (al.text.match(/[A-Za-z]{3,}/g) || []).join(' '));
  await page.screenshot({ path: 'tests/out/album-hi.jpg', type: 'jpeg', quality: 78 });
  await P.ctx.close();
}

for (const [w, h, tag] of [[780, 390, 'landscape'], [1280, 720, 'laptop'], [360, 640, 'small phone']]) { // ---- other screens ----
  const P = await open({ w, h, save: { ch: 3, w: 1, kh: 1, painted: [1, 1, 1], chosen: 1, oiled: 1, alpana: 1, fest: { day: 2, on: today(), fin: 0, seen: 2 }, seen: { nest: 1, cat: 1, carrier: 1, couple: 1, stall: 1 } } }), { page, ev, until } = P;
  await ev(() => document.getElementById('albumBtn').click()); await sleep(300);
  const g = await ev(() => { const a = document.getElementById('album'), cards = [...a.querySelectorAll('.alb-card')].map(c => c.getBoundingClientRect()); return { wide: a.scrollWidth <= a.clientWidth + 1, in: cards.every(r => r.left >= 0 && r.right <= innerWidth + 1), min: Math.round(Math.min(...cards.map(r => r.width))), n: cards.length }; });
  check(g.wide && g.in && g.n === 16 && g.min >= 84, `${tag}: sixteen cards, none off the side, none tiny (narrowest ${g.min} px)`);
  await page.screenshot({ path: `tests/out/album-${tag.replace(' ', '-')}.jpg`, type: 'jpeg', quality: 78 });
  await ev(() => document.querySelectorAll('#album .alb-day')[1].click()); await until(() => document.querySelector('#albView img').src.startsWith('blob:'), 15000);
  check(await P.inside('#albView img') && await P.inside('#albView .btn') && await P.inside('#albView .linkbtn'), `${tag}: the card, Share and Close fit the screen`);
  await page.screenshot({ path: `tests/out/album-${tag.replace(' ', '-')}-card.jpg`, type: 'jpeg', quality: 78 });
  if (w > 1000) { await page.keyboard.press('Enter'); await sleep(200); await page.keyboard.press('Escape'); await sleep(150); await page.keyboard.press('Escape'); await sleep(250);
    check(!(await P.shown('#album')) && await ev(() => __k.game.mode === 'menu'), 'laptop: Enter over the album does not start the game; Escape twice closes card and album'); }
  await P.ctx.close();
}

{ // ---- someone opens a shared card's link: it is counted ----
  const P = await open({ query: 'debug&fest&q=low&k=3', save: {} });
  await P.ev(() => dispatchEvent(new Event('pagehide'))); await sleep(400);
  check(await P.ev(() => (window.__beacons || []).some(b => /\/api\/ev/.test(b) && /"keep\.open"/.test(b))), 'a visit through a shared card is counted (keep.open)');
  await P.ctx.close();
}
{ // ---- album.js could not be fetched (a bad connection on the first visit): the game must not care ----
  const ctx = await browser.createBrowserContext(), page = await ctx.newPage(); page.on('pageerror', e => logs.push(e.message));
  await page.emulate({ viewport: { width: 390, height: 780, deviceScaleFactor: 1, isMobile: true, hasTouch: true }, userAgent: PHONE });
  await page.evaluateOnNewDocument(() => { localStorage.setItem('khuntau-seen-tips', '1'); localStorage.setItem('khuntau-story', JSON.stringify({ ch: 3, w: 1, kh: 1, painted: [1, 1, 1], chosen: 1, oiled: 1, seen: { nest: 1, cat: 1 } })); });
  await page.setRequestInterception(true); page.on('request', r => /\/album\.js/.test(r.url()) ? r.abort() : r.continue());
  await page.goto('http://127.0.0.1:8791/?debug&q=low', { waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => window.__k && document.getElementById('startBtn').dataset.village === 'ready', { timeout: 90000 });
  const ev = (f, ...a) => page.evaluate(f, ...a);
  check(await ev(() => !__k.album && document.getElementById('albumBtn').hidden), 'without album.js: no album row on the home screen');
  await ev(() => document.getElementById('startBtn').click()); await page.waitForFunction(() => __k.game.mode === 'story', { timeout: 30000 }); await sleep(2200);
  await ev(() => { const d = __k.story.debug; d.S.dlg = null; document.getElementById('dlg').hidden = true; d.S.mode = 'walk'; const q = d.W.finds.tortoise; __k.game.p.pos.set(q.x + 0.9, 0, q.z + 0.6); });
  check(await page.waitForFunction(() => (__k.story.debug.save.seen || {}).tortoise === 1, { timeout: 8000 }).then(() => true, () => false), 'a find is still noted');
  await ev(() => { __k.game.p.pos.set(0, 0, 14); }); await sleep(300); await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.getElementById('pauseScreen').hidden, { timeout: 5000 });
  await ev(() => document.getElementById('seenBtn').click());
  check(await ev(() => !document.getElementById('seenList').hidden && document.querySelectorAll('#seenList li').length === 10 && document.querySelectorAll('#seenList li.no').length === 7), 'and the pause menu lists what you have seen as text, as before');
  await ctx.close();
}
check(realErrors(logs).length === 0, 'no page errors ' + realErrors(logs).join(' | ').slice(0, 300));
await finish(browser);
