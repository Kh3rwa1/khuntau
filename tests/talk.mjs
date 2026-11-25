// Village talk in the game itself, with two phones against the real Worker (npx wrangler dev --local --port 8787):
// the home row, saying something, the other phone reading it at home and hearing it at the talking place in the
// village, quick phrases in the reader's language, refusals, report and hide, typing never walks you, Hindi, laptop.
//   node tests/talk.mjs [base]      (default http://127.0.0.1:8787)
import puppeteer from 'puppeteer';
import fs from 'fs'; fs.mkdirSync('tests/out', { recursive: true });
import { check, finish, realErrors, SW } from './check.mjs';
const BASE = process.argv[2] || 'http://127.0.0.1:8787';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ protocolTimeout: 180000, args: [...SW, '--no-sandbox', '--mute-audio'] });
const logs = [], word = 'johar-' + Math.random().toString(36).slice(2, 7), SOR = 'Sor' + Math.random().toString(36).slice(2, 6); // names and words of this run only: the local server keeps earlier runs' messages

async function phone(name, { lang = 'en', view = null, story = true } = {}) {
  const ctx = await browser.createBrowserContext(), page = await ctx.newPage(); page.on('pageerror', e => logs.push(name + ': ' + e.message));
  if (view) await page.setViewport(view); else await page.emulate({ viewport: { width: 390, height: 780, deviceScaleFactor: 1, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-A346E) Mobile' });
  await page.evaluateOnNewDocument((name, lang, story) => { if (name) localStorage.setItem('khuntau-name', name); localStorage.setItem('khuntau-lang', lang);
    if (story) localStorage.setItem('khuntau-story', JSON.stringify({ ch: 5, done: 1, painted: [1, 1, 1], chosen: 1, oiled: 1, garland: 1 })); }, name, lang, story);
  await page.goto(BASE + '/?debug&q=low', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.getElementById('startBtn').dataset.village === 'ready', { timeout: 90000 });
  await page.waitForFunction(() => window.__k && __k.talk && __k.talk.state.on, { timeout: 30000 });
  const P = { page, ev: (f, ...a) => page.evaluate(f, ...a), until: (f, ms = 15000, ...a) => page.waitForFunction(f, { timeout: ms, polling: 100 }, ...a).then(() => true, () => false) };
  P.village = async () => { await P.ev(() => document.getElementById('startBtn').click()); await P.until(() => __k.game.mode === 'story' && !__k.story.debug.S.inside, 30000);
    await P.ev(() => { const d = __k.story.debug; d.S.dlg = null; document.getElementById('dlg').hidden = true; const c = document.getElementById('dayCard'); if (c) c.click(); }); };
  P.type = async (text) => { await page.click('#talk .talk-in'); await page.keyboard.type(text, { delay: 8 }); await page.keyboard.press('Enter'); };
  return P;
}

// ---- phone A: the home row, the panel, saying something ----
const A = await phone('');
// the row is never shown with empty counts first: the first words it ever shows are already the real ones
{ const C = await browser.createBrowserContext(), pg = await C.newPage(); await pg.evaluateOnNewDocument(() => { window.__rowFirst = null; addEventListener('DOMContentLoaded', () => { const row = document.getElementById('talkBtn');
    // seen = not hidden and not kept invisible (since 25 Nov the row's place is held from the start, so the rows below never jump)
    const below = () => Math.round(document.getElementById('animalBtn').getBoundingClientRect().top - row.getBoundingClientRect().top); // the next row, measured from the talk row: fonts and the day's name move the whole panel while it loads, that is another matter
    new MutationObserver(() => { if (!row.hidden && row.style.visibility === 'hidden') window.__heldUnseen = true; if (window.__belowFirst === undefined && !row.hidden) window.__belowFirst = below(); if (!row.hidden && row.style.visibility !== 'hidden' && window.__rowFirst === null) { window.__rowFirst = row.textContent; window.__belowThen = below(); } }).observe(row, { attributes: true, childList: true, subtree: true, characterData: true }); }); });
  await pg.setViewport({ width: 390, height: 780, isMobile: true, hasTouch: true });
  await pg.goto(BASE + '/?debug&q=low', { waitUntil: 'domcontentloaded' }); await pg.waitForFunction(() => window.__rowFirst !== null, { timeout: 90000 });
  const first = await pg.evaluate(() => window.__rowFirst), real = await pg.evaluate(async () => (await (await fetch('/api/here?pid=' + __k.meta.pid)).json()));
  check(real.p ? first.includes(real.p.n + ':') : true, `home: the row's first words already carry the newest message (${first.slice(0, 60)})`);
  await sleep(600); const jump = await pg.evaluate(() => ({ place: window.__heldUnseen === true, held: window.__belowFirst, filled: window.__belowThen, now: Math.round(document.getElementById('animalBtn').getBoundingClientRect().top - document.getElementById('talkBtn').getBoundingClientRect().top) }));
  check(jump.place && jump.held > 10 && Math.abs(jump.held - jump.filled) <= 1 && Math.abs(jump.filled - jump.now) <= 1, `home: the talk row keeps its place from the start, so the row under it does not jump when it fills in (${jump.held} px below it held, ${jump.filled} filled, ${jump.now} after; on the live site it appeared late and pushed the rows down 30 px)`); await C.close(); }
check(await A.until(() => !document.getElementById('talkBtn').hidden && /came today|here now/.test(document.getElementById('talkBtn').textContent)), `home: the talk row shows who is here (${await A.ev(() => document.getElementById('talkBtn').textContent)})`);
await A.ev(() => document.getElementById('talkBtn').click());
check(await A.until(() => !document.getElementById('talk').hidden) && /Be kind/.test(await A.ev(() => document.querySelector('#talk .talk-list').textContent)), 'home: tapping it opens the panel, with the rules at the top');
check(await A.ev(() => !document.querySelector('#talk .talk-name').hidden), 'a player with no name is asked for one');
{ const n = await A.ev(() => [...document.querySelectorAll('#talk .talk-sheet *')].filter(e => !e.children.length && /Be kind/.test(e.textContent) && e.getBoundingClientRect().height > 0 && (() => { const r = e.getBoundingClientRect(), l = document.querySelector('.talk-list').getBoundingClientRect(); return !e.closest('.talk-list') || (r.bottom > l.top && r.top < l.bottom); })()).length);
  check(n === 1, `the rules are on screen once, not twice (${n})`); }
await A.type('hello without a name');
check(/name first/i.test(await A.ev(() => document.querySelector('#talk .talk-err').textContent)) && !(await A.ev(() => document.querySelector('#talk li.me'))), 'nothing is sent until there is a name');
await A.page.type('#talk .talk-name', 'Mina'); await A.ev(() => { document.querySelector('#talk .talk-in').value = ''; });
await A.type(word + ' from Dumka');
check(await A.until((w) => [...document.querySelectorAll('#talk li.me p')].some(p => p.textContent === w + ' from Dumka'), 8000, word), 'saying something: it appears as mine');
check(await A.ev(() => localStorage.getItem('khuntau-name') === 'Mina' && document.querySelector('#talk .talk-in').value === '' && document.querySelector('#talk .talk-name').hidden), 'the name is kept and the box is cleared');
await sleep(3200); await A.type('call me 98765 43210');
check(await A.until(() => /Phone numbers/.test(document.querySelector('#talk .talk-err').textContent), 6000) && (await A.ev(() => document.querySelector('#talk .talk-in').value)) === 'call me 98765 43210', 'a phone number is refused with the reason, and the text stays to be fixed');
await A.page.screenshot({ path: 'tests/out/talk-phone-panel.jpg', type: 'jpeg', quality: 75 });
await A.page.keyboard.press('Escape');
check(await A.ev(() => document.getElementById('talk').hidden) && await A.ev(() => !document.getElementById('startScreen').hidden), 'Escape closes the panel and nothing else');
check(await A.until((w) => document.getElementById('talkBtn').textContent.includes('Mina: ' + w), 6000, word), 'home: the row now shows the newest message');
await A.page.screenshot({ path: 'tests/out/talk-phone-home.jpg', type: 'jpeg', quality: 75 });

// ---- phone B (Hindi): reads it at home, hears it at the talking place, answers with a quick phrase ----
const B = await phone(SOR, { lang: 'hi' });
check(await B.until((w) => document.getElementById('talkBtn').textContent.includes('Mina: ' + w), 10000, word), "home on another phone: the row shows Mina's message");
check(/बात करो/.test(await B.ev(() => document.getElementById('talkBtn').textContent)), 'Hindi: the home row is in Hindi');
await B.village();
// your door is a few steps from the talking place: the last thing said comes up over it as you step out
const said = (w) => { const n = [document.getElementById('talkToast'), document.getElementById('talkBubble')].find(n => !n.hidden && n.classList.contains('show')); return !!n && n.textContent.includes('Mina') && n.textContent.includes(w) && n.id; };
check(await B.until(said, 10000, word), 'village: stepping out, the last thing said comes up on screen');
await sleep(400); await B.page.screenshot({ path: 'tests/out/talk-phone-arrive.jpg', type: 'jpeg', quality: 75 });
// facing the talking place it is a bubble over it; with your back to it, a line at the top of the screen
await sleep(7000); await B.ev(() => { const s = __k.talkSpot, d = __k.story.debug, out = [Math.cos(s.a), Math.sin(s.a)], st = __k.talk.state; __k.game.p.pos.set(s.x - out[0] * 4.5, 0, s.z - out[1] * 4.5); d.S.camYaw = Math.atan2(-out[0], -out[1]); d.S.lookT = performance.now() / 1000 + 99; d.snapCam(); st.heard = 0; st.near = false; st.spoke = 0; });
check(await B.until((w) => { const b = document.getElementById('talkBubble'), r = b.getBoundingClientRect(); return !b.hidden && b.classList.contains('show') && b.style.visibility !== 'hidden' && b.textContent.includes(w) && r.left >= 0 && r.right <= innerWidth && r.top >= 0; }, 10000, word), 'facing the talking place, it is a bubble over the log seat, inside the screen');
await sleep(400); await B.page.screenshot({ path: 'tests/out/talk-phone-bubble.jpg', type: 'jpeg', quality: 75 });
check(await B.until(() => !document.getElementById('talkHud').hidden && document.getElementById('talkHud').classList.contains('new')), 'village: the talk button is there, with a dot for what you have not read');
const walked = await B.ev(async () => { const s = __k.talkSpot, p = __k.game.p.pos, x0 = p.x, z0 = p.z; document.getElementById('talkHud').click(); await new Promise(r => setTimeout(r, 400));
  const i = document.querySelector('#talk .talk-in'); i.focus(); return { open: !document.getElementById('talk').hidden, x0, z0 }; });
await B.page.keyboard.type('wwwwaaaasss ddd eee', { delay: 30 }); await sleep(400);
check(walked.open && await B.ev((w) => { const p = __k.game.p.pos; return Math.hypot(p.x - w.x0, p.z - w.z0) < 0.05 && document.querySelector('#talk .talk-in').value === 'wwwwaaaasss ddd eee' && __k.game.mode === 'story'; }, walked), 'typing W, A, S, D, E in the box types: you do not walk or act');
check(/Mina/.test(await B.ev(() => document.querySelector('#talk .talk-list').textContent)) && /गाँव की बातचीत/.test(await B.ev(() => document.querySelector('#talk .talk-head b').textContent)), 'village: the panel lists the message; its labels are in Hindi');
await B.page.screenshot({ path: 'tests/out/talk-phone-hindi.jpg', type: 'jpeg', quality: 75 });
await B.ev(() => { document.querySelector('#talk .talk-in').value = ''; document.querySelector('#talk .talk-x').click(); });
check(await B.ev(() => !document.getElementById('talkHud').classList.contains('new')), 'reading it clears the dot');
// walk up to the talking place: the button offers TALK
await B.ev(() => { const s = __k.talkSpot, d = __k.story.debug, out = [Math.cos(s.a), Math.sin(s.a)]; __k.game.p.pos.set(s.x - out[0] * 1.6, 0, s.z - out[1] * 1.6); d.S.camYaw = Math.atan2(-out[0], -out[1]); d.S.lookT = performance.now() / 1000 + 99; d.snapCam(); });
check(await B.until(() => { const n = __k.story.debug.S.near; return !!n && n.label === 'TALK'; }, 8000) && /बात करो/.test(await B.ev(() => document.getElementById('actBtn').textContent)), 'at the talking place the action button offers TALK (in Hindi)');
await B.ev(() => { __k.story.debug.S.near.go(); });
check(await B.until(() => !document.getElementById('talk').hidden), 'TALK opens the panel');
await B.ev(() => document.querySelector('#talk .talk-quick button[data-q="johar"]').click());
check(await B.until(() => [...document.querySelectorAll('#talk li.me p')].some(p => p.textContent === 'जोहार!'), 8000), 'a quick phrase is one tap');

// ---- phone A in the village: hears the answer as it comes, in A's language ----
await A.village(); await A.ev(() => __k.talk.pull()); await sleep(300);
await sleep(3200); await B.ev(() => document.querySelector('#talk .talk-quick button[data-q="round"]').click()); await sleep(600);
await A.ev(() => __k.talk.beat());
check(await A.until((w) => { const n = [document.getElementById('talkToast'), document.getElementById('talkBubble')].find(n => !n.hidden); return !!n && n.textContent.includes(w) && /Who wants a round at the khunt\?/.test(n.textContent); }, 10000, SOR), "the other phone's quick phrase arrives in the village, in the reader's own language");
await A.page.screenshot({ path: 'tests/out/talk-phone-live.jpg', type: 'jpeg', quality: 75 });

// ---- report and hide ----
await A.ev(() => document.getElementById('talkHud').click()); await A.until(() => !document.getElementById('talk').hidden);
const n0 = await A.ev(() => document.querySelectorAll('#talk li:not(.me):not(.talk-note)').length);
await A.ev(() => { const li = [...document.querySelectorAll('#talk li:not(.me):not(.talk-note)')].pop(); li.querySelector('.talk-more').click(); li.querySelector('.talk-act button').click(); });
check(await A.until((n) => document.querySelectorAll('#talk li:not(.me):not(.talk-note)').length === n - 1, 5000, n0) && /Reported/.test(await A.ev(() => document.querySelector('#talk .talk-err').textContent)), 'Report: the message goes at once and says so');
await A.ev((w) => { const li = [...document.querySelectorAll('#talk li:not(.me):not(.talk-note)')].find(l => l.textContent.includes(w)); if (li) { li.querySelector('.talk-more').click(); li.querySelectorAll('.talk-act button')[1].click(); } }, SOR);
check(await A.until((w) => ![...document.querySelectorAll('#talk li')].some(l => l.textContent.includes(w)), 5000, SOR) && await A.ev(() => JSON.parse(localStorage.getItem('khuntau-talk')).hide.length === 1), 'Hide this person: all their messages go, and it is remembered');
await A.ev(() => document.querySelector('#talk .talk-x').click());

// ---- the panel in landscape and on a laptop ----
const Lp = await phone('Laptop', { view: { width: 1280, height: 720 } });
await Lp.ev(() => document.getElementById('talkBtn').click()); await Lp.until(() => !document.getElementById('talk').hidden); await sleep(400);
const fit = await Lp.ev(() => { const r = document.querySelector('.talk-sheet').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.width <= 560; });
check(fit, 'laptop: the panel is a centred box inside the window'); await Lp.page.screenshot({ path: 'tests/out/talk-laptop.jpg', type: 'jpeg', quality: 75 });
await B.page.setViewport({ width: 780, height: 390, isMobile: true, hasTouch: true }); await sleep(500);
const fitL = await B.ev(() => { const r = document.querySelector('.talk-sheet').getBoundingClientRect(), f = document.querySelector('.talk-form').getBoundingClientRect(), l = document.querySelector('.talk-list').getBoundingClientRect(); return { ok: r.top >= 0 && f.bottom <= innerHeight && l.height >= 50, top: r.top, list: l.height }; });
check(fitL.ok, `phone on its side: the panel fits, with room to read (list ${Math.round(fitL.list)} px)`); await B.page.screenshot({ path: 'tests/out/talk-phone-landscape.jpg', type: 'jpeg', quality: 75 });

check(!realErrors(logs).length, 'no page errors' + (realErrors(logs).length ? ': ' + realErrors(logs).slice(0, 3).join(' | ') : ''));
await finish(browser);
