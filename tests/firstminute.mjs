// The first minute of a new player, on a phone, with real touches. A player asked in the village talk "how do you
// play?" (24 Nov): the one line about walking showed under the day card and Gogo's words and was gone four seconds
// after; the orange button's first offer was REST; and the first ring round flashed eight timed lines in twenty
// seconds while the bull was already charging. Now every lesson waits for the player:
//   house: how to walk (held until walked, with a ghost stick), the button lights only for the handi, then where the bull is;
//   ring:  walk, HIDE, ROLL, GRAB, one at a time, the bull waiting, no lamp lost until the first pitha.
//   node tests/firstminute.mjs      (static server on 8791; ?debug&fest&mercy&coach = what real players get)
import puppeteer from 'puppeteer';
import fs from 'fs'; fs.mkdirSync('tests/out', { recursive: true });
import { check, finish, realErrors, SW } from './check.mjs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ protocolTimeout: 240000, args: [...SW, '--no-sandbox', '--mute-audio'] });
const logs = [], URL0 = 'http://127.0.0.1:8791/?debug&fest&mercy&coach&q=low';

async function open({ lang = '', story = null, phone = true, pre = null } = {}) {
  const ctx = await browser.createBrowserContext(), page = await ctx.newPage(); page.on('pageerror', e => logs.push(e.message));
  if (phone) await page.emulate({ viewport: { width: 390, height: 780, deviceScaleFactor: 1, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-A346E) Mobile' }); else await page.setViewport({ width: 1280, height: 720 });
  await page.evaluateOnNewDocument((lang, story, pre) => { if (lang) localStorage.setItem('khuntau-lang', lang); if (story) localStorage.setItem('khuntau-story', JSON.stringify(story)); if (pre) for (const k in pre) localStorage.setItem(k, pre[k]); }, lang, story, pre);
  await page.goto(URL0, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.getElementById('startBtn').dataset.village === 'ready', { timeout: 90000 });
  const P = { page, ev: (f, ...a) => page.evaluate(f, ...a), until: (f, ms = 15000, ...a) => page.waitForFunction(f, { timeout: ms, polling: 80 }, ...a).then(() => true, () => false) };
  P.shown = id => P.ev(id => { const e = document.getElementById(id); return !!e && !e.hidden && getComputedStyle(e).display !== 'none' && (id !== 'hint' || e.classList.contains('show')) && (id !== 'joyGhost' || e.classList.contains('show')); }, id);
  P.hint = () => P.ev(() => { const h = document.getElementById('hint'); return h.classList.contains('show') ? h.textContent : ''; });
  // a real thumb on the left side of the screen, pushed up and held
  P.drag = async (ms, dx = 0, dy = -70) => { const x = 90, y = 600; await page.touchscreen.touchStart(x, y); await sleep(60); await page.touchscreen.touchMove(x + dx, y + dy); await sleep(ms); await page.touchscreen.touchEnd(); };
  P.passCardAndGogo = async () => { await P.until(() => { const c = document.getElementById('dayCard'); return c && !c.hidden && c.classList.contains('show'); }, 20000); const under = { hint: await P.shown('hint'), ghost: await P.shown('joyGhost') };
    await page.tap('#dayCard'); await sleep(1100); under.hint2 = await P.shown('hint');
    for (let i = 0; i < 6 && await P.ev(() => !document.getElementById('dlg').hidden); i++) { await page.tap('#dlg'); await sleep(850); } return under; };
  return P;
}

// ================= the house =================
const A = await open();
check(await A.ev(() => { const r = document.getElementById('langRow'), on = r.querySelector('button.on'); return r.offsetHeight > 0 && on && on.dataset.l === 'en' && r.querySelectorAll('button').length >= 2; }), 'home: the language is offered under PLAY, English marked');
await A.page.screenshot({ path: 'tests/out/fm-home.jpg', type: 'jpeg', quality: 72 });
await A.page.tap('#startBtn');
const under = await A.passCardAndGogo();
check(!under.hint && !under.ghost && !under.hint2, 'no lesson is spent under the day card or under Gogo\'s words');
check(await A.until(() => document.getElementById('hint').classList.contains('show') && /Drag the left side to walk/.test(document.getElementById('hint').textContent), 6000) && await A.shown('joyGhost'), 'free in the house: how to walk comes up, with a ghost stick where the thumb goes');
check(await A.ev(() => { const g = document.getElementById('joyGhost').getBoundingClientRect(), h = document.getElementById('hint').getBoundingClientRect(), a = document.getElementById('actBtn').getBoundingClientRect(); const hit = (p, q) => p.left < q.right && q.left < p.right && p.top < q.bottom && q.top < p.bottom; return !hit(g, h) && !hit(g, a) && g.left >= 0 && g.bottom <= innerHeight; }), 'the ghost stick does not sit on the words or on the orange button');
await sleep(600); await A.page.screenshot({ path: 'tests/out/fm-house.jpg', type: 'jpeg', quality: 72 });
await sleep(6500);
check(/Drag the left side to walk/.test(await A.hint()) && await A.shown('joyGhost'), 'seven seconds later, not having moved, it is still there (it was gone after four)');
check(await A.ev(() => { const b = document.getElementById('actBtn'); return b.classList.contains('off') && !__k.story.debug.S.near; }), 'waking by the bed, the orange button offers nothing yet (it said REST)');
const p0 = await A.ev(() => [__k.game.p.pos.x, __k.game.p.pos.z]);
await A.drag(1500, 70, 0); // to the right, into the room (straight ahead of where you wake is the bed)
check(await A.until((p0) => Math.hypot(__k.game.p.pos.x - p0[0], __k.game.p.pos.z - p0[1]) > 0.8, 4000, p0), 'a thumb dragged on the left side walks you');
check(await A.until(() => !document.getElementById('hint').classList.contains('show') && !document.getElementById('joyGhost').classList.contains('show'), 6000) && await A.ev(() => __k.story.debug.save.w === 1), 'having walked, the lesson and the ghost stick go, and it is remembered');
await A.ev(() => { const I = __k.story.debug.W.inside; __k.game.p.pos.set(I.handi.x + 0.6, __k.game.p.pos.y, I.handi.z + 0.6); });
check(await A.until(() => { const b = document.getElementById('actBtn'); return b.textContent === 'DRINK' && b.classList.contains('coach-on'); }, 6000), 'at the handi the orange button lights up as DRINK, with a pulsing ring');
await A.page.screenshot({ path: 'tests/out/fm-drink.jpg', type: 'jpeg', quality: 72 });
await A.page.tap('#actBtn'); await A.until(() => __k.story.debug.save.ch >= 1, 12000);
for (let i = 0; i < 6 && await A.ev(() => !document.getElementById('dlg').hidden); i++) { await A.page.tap('#dlg'); await sleep(850); }
await A.ev(() => { const I = __k.story.debug.W.inside; __k.game.p.pos.set(I.bed.x + 0.5, __k.game.p.pos.y, I.bed.z + 0.9); });
check(await A.until(() => { const n = __k.story.debug.S.near; return !!n && (n.label === 'REST' || n.label === 'EAT'); }, 6000) && await A.ev(() => !document.getElementById('actBtn').classList.contains('coach-on')), 'after the handi the bed and the pitha are offered again, without the ring');
await A.ev(() => { const I = __k.story.debug.W.inside; __k.game.p.pos.set(I.door.x - 0.3, __k.game.p.pos.y, I.door.z); });
await A.until(() => { const n = __k.story.debug.S.near; return !!n && n.label === 'GO OUT'; }, 6000); await A.page.tap('#actBtn');
check(await A.until(() => !__k.story.debug.S.inside && /bull waits at the khunt in the middle/.test(document.getElementById('hint').textContent) && document.getElementById('hint').classList.contains('show'), 9000), 'stepping out for the first time, you are told where the bull is');
await A.page.screenshot({ path: 'tests/out/fm-out.jpg', type: 'jpeg', quality: 72 });

// ================= the first round =================
await sleep(600); await A.ev(() => { __k.game.p.pos.set(0.6, 0, 2.2); });
await A.until(() => { const n = __k.story.debug.S.near; return !!n && n.label === 'RING'; }, 8000); await A.page.tap('#actBtn');
check(await A.until(() => __k.game.mode === 'play' && !!__k.game.coach && __k.game.coach.step === 1, 15000), 'the first round at the khunt is a taught round');
check(/Drag the left side of the screen to walk/.test(await A.hint()) && await A.shown('joyGhost') && await A.ev(() => ['hideBtn', 'rollBtn', 'grabBtn'].every(id => document.getElementById(id).classList.contains('coach-dim'))), 'lesson 1: walk. One line, the ghost stick, the three buttons stepped back');
await sleep(400); await A.page.screenshot({ path: 'tests/out/fm-ring-1.jpg', type: 'jpeg', quality: 72 });
const calm = await A.ev(async () => { const seen = new Set(), t0 = performance.now(); while (performance.now() - t0 < 8000) { seen.add(__k.game.b.state); await new Promise(r => setTimeout(r, 100)); } return [...seen]; });
check(calm.every(s => s === 'watch') && /Drag the left side of the screen to walk/.test(await A.hint()), `for eight seconds of doing nothing the bull only watches and the line stays (${calm})`);
await A.drag(1800);
check(await A.until(() => __k.game.coach && __k.game.coach.step === 2, 6000) && /Tap HIDE/.test(await A.hint()), 'having walked: lesson 2, tap HIDE');
check(await A.ev(() => document.getElementById('hideBtn').classList.contains('coach-on') && !document.getElementById('hideBtn').classList.contains('coach-dim') && document.getElementById('rollBtn').classList.contains('coach-dim') && document.getElementById('grabBtn').classList.contains('coach-dim')) && !(await A.shown('joyGhost')), 'HIDE has the pulsing ring, the other two stay back, the ghost stick is gone');
await A.page.screenshot({ path: 'tests/out/fm-ring-2.jpg', type: 'jpeg', quality: 72 });
const faceOff = () => { const g = __k.game; g.p.pos.set(-4.5, 0, 2); g.b.pos.set(4.5, 0, 2); g.b.state = 'watch'; g.b.t = 0; }; // a clear run at you, inside the rope's reach: the dodge is a real one
await A.ev(faceOff); await sleep(300);
await A.page.tap('#hideBtn');
check(await A.until(() => __k.game.coach && __k.game.coach.step === 3, 4000) && /when he runs at you, tap ROLL/.test(await A.hint()) && await A.ev(() => document.getElementById('rollBtn').classList.contains('coach-on')), 'HIDE tapped: lesson 3, wait, then ROLL when he runs at you; ROLL has the ring');
check(await A.until(() => __k.game.b.state === 'windup' || __k.game.b.state === 'charge', 6000), 'and now he comes: the hide brought him');
// the moment he runs the line says so, and ROLL tapped on its own (no thumb on the stick) jumps aside, out of his line.
// A recorder in the page notes what the line said while he ran and which way the roll went at its first frame (a moment
// later he has run past, and 'toward him' means nothing).
await A.ev(() => { const g = __k.game; window.__rec = { now: false, roll: null }; (function f() { const h = document.getElementById('hint'); if (g.b.state === 'charge' && h.classList.contains('show') && /ROLL now!/.test(h.textContent)) window.__rec.now = true;
  if (!window.__rec.roll && g.p.state === 'roll') { const tx = g.b.pos.x - g.p.pos.x, tz = g.b.pos.z - g.p.pos.z, n = Math.hypot(tx, tz) || 1; window.__rec.roll = { toward: +((g.p.rollDir.x * tx + g.p.rollDir.z * tz) / n).toFixed(2), dist: +n.toFixed(1) }; }
  if (g.mode === 'play' && !(window.__rec.roll && window.__rec.now)) requestAnimationFrame(f); })(); });
await A.until(() => __k.game.b.state === 'charge', 8000); await A.page.tap('#rollBtn');
const roll = await A.ev(async () => { for (let i = 0; i < 80 && !window.__rec.roll; i++) await new Promise(r => setTimeout(r, 25)); return { rolling: !!window.__rec.roll, now: window.__rec.now, ...(window.__rec.roll || { toward: 9 }) }; });
check(roll.now, 'as he starts to run the line changes to: ROLL now!');
check(roll.rolling && Math.abs(roll.toward) < 0.35, `ROLL alone jumps aside, across his line, not at him (${roll.toward} toward him, from ${roll.dist} m; it was 1.0)`);
check(await A.until(() => __k.game.coach && __k.game.coach.step === 4, 8000) && /dizzy! Run to the post and tap GRAB/.test(await A.hint()) && await A.ev(() => document.getElementById('grabBtn').classList.contains('coach-on') && __k.game.lives === 3), 'dodged: lesson 4, he is dizzy, run to the post and GRAB');
await A.page.screenshot({ path: 'tests/out/fm-ring-4.jpg', type: 'jpeg', quality: 72 });
const dizzy = await A.ev(async () => { const t0 = performance.now(); let ok = true; while (performance.now() - t0 < 4500) { if (!['stunned', 'recover'].includes(__k.game.b.state)) ok = false; await new Promise(r => setTimeout(r, 100)); } return ok; });
check(dizzy, 'he stays dizzy while you fetch it (four and a half seconds and counting; a normal stun is one to two)');
await A.ev(() => { __k.game.p.pos.set(0.5, 0, 0.9); __k.game.p.state = 'free'; }); await sleep(250); await A.page.tap('#grabBtn');
check(await A.until(() => __k.game.pitha >= 1 && !__k.game.coach, 8000), 'the first pitha ends the lessons');
check(await A.ev(() => localStorage.getItem('khuntau-coach') === '1' && __k.coachDone && ['hideBtn', 'rollBtn', 'grabBtn'].every(id => !document.getElementById(id).classList.contains('coach-dim') && !document.getElementById(id).classList.contains('coach-on')) && __k.game.lives === 3), 'it is remembered, the buttons are all back, and no lamp was lost on the way');
check(await A.until(() => /Snatch as many pitha as you can/.test(document.getElementById('hint').textContent) && document.getElementById('hint').classList.contains('show'), 8000), 'and the game says what it is: snatch as many as you can, each lamp is a life');

// the next round is a real round: no lessons, he comes on his own
await A.ev(() => { __k.game.lives = 0; __k.gameOver(); });
await A.until(() => __k.game.mode === 'over', 8000); await sleep(600);
await A.ev(() => __k.startGame()); await A.until(() => __k.game.mode === 'play', 8000);
check(await A.ev(() => !__k.game.coach) && await A.until(() => ['windup', 'charge'].includes(__k.game.b.state), 20000), 'the next round has no lessons: he charges without being asked');

// ================= a hit while being taught costs nothing =================
const B = await open({ story: { ch: 1, w: 1, kh: 1, painted: [0, 0, 0] } });
await B.ev(() => document.getElementById('quickBtn').click()); await B.until(() => __k.game.mode === 'play' && !!__k.game.coach, 15000);
await B.ev(() => { const g = __k.game; g.p.pos.set(-4.5, 0, 2); g.b.pos.set(4.5, 0, 2); g.b.state = 'watch'; g.b.t = 0; __k.coachStep(2); }); await sleep(300); await B.page.tap('#hideBtn');
check(await B.until(() => __k.game.coach && __k.game.coach.step === 2 && /He got you, but it does not count yet/.test(document.getElementById('hint').textContent), 15000) && await B.ev(() => __k.game.lives === 3 && document.getElementById('hideBtn').classList.contains('coach-on')), 'standing still, he knocks you over: no lamp lost, and the lesson goes back to HIDE');

{ const C2 = await open({ story: { ch: 1, w: 1, kh: 1, painted: [0, 0, 0] } }); await C2.ev(() => document.getElementById('quickBtn').click()); await C2.until(() => __k.game.mode === 'play' && !!__k.game.coach, 15000);
  await C2.ev(() => { const g = __k.game; g.p.pos.set(0, 0, 4.4); g.b.pos.set(0, 0, -4); g.b.state = 'watch'; g.b.t = 0; __k.coachStep(2); }); await sleep(300); await C2.page.tap('#hideBtn');
  check(await C2.until(() => __k.game.coach && __k.game.coach.step === 4 && __k.game.b.state === 'stunned', 15000) && await C2.ev(() => __k.game.lives === 3), 'with the post between you he slams into it: that brings lesson 4 as well'); }

// ================= Hindi, and a laptop =================
const H = await open({ lang: 'hi', story: { ch: 1, w: 1, kh: 1, painted: [0, 0, 0] } });
check(await H.ev(() => document.querySelector('#langRow button.on').dataset.l === 'hi'), 'home: a Hindi player sees हिन्दी marked');
await H.ev(() => document.getElementById('quickBtn').click()); await H.until(() => __k.game.mode === 'play' && !!__k.game.coach, 15000);
const hi1 = await H.hint(); await H.ev(() => __k.coachStep(2)); const hi2 = await H.hint(), btn = await H.ev(() => document.getElementById('hideBtn').textContent);
check(!/[A-Za-z]{3,}/.test(hi1 + hi2 + btn) && /खाल/.test(hi2) && btn === 'खाल', `Hindi: the lessons and the buttons are in Hindi, also in a quick round from the home screen (${hi1} / ${hi2})`);
await H.page.screenshot({ path: 'tests/out/fm-ring-hindi.jpg', type: 'jpeg', quality: 72 });
const T = await open(); // choosing the language on the home screen
await T.page.tap('#langRow button[data-l="hi"]'); await T.page.tap('#startBtn'); await T.until(() => { const c = document.getElementById('dayCard'); return c && !c.hidden && c.classList.contains('show'); }, 20000);
check(await T.ev(() => localStorage.getItem('khuntau-lang') === 'hi' && /सोहराय का दिन/.test(document.getElementById('dayCard').textContent)), 'tapping हिन्दी on the home screen puts the game in Hindi from the first card');
const Lp = await open({ phone: false, story: { ch: 1, w: 1, kh: 1, painted: [0, 0, 0] } });
await Lp.ev(() => document.getElementById('quickBtn').click()); await Lp.until(() => __k.game.mode === 'play' && !!__k.game.coach, 15000);
check(/Walk with WASD or the arrow keys/.test(await Lp.hint()) && !(await Lp.shown('joyGhost')), 'laptop: the lesson names the keys and shows no ghost stick');

// ================= someone who already plays is not taught again =================
const R = await open({ story: { ch: 5, done: 1, painted: [1, 1, 1], chosen: 1, oiled: 1, garland: 1 }, pre: { 'khuntau-coach': '1' } });
await R.page.tap('#startBtn'); await R.until(() => __k.game.mode === 'story', 20000); await R.ev(() => { const c = document.getElementById('dayCard'); if (c && !c.hidden) c.click(); }); await sleep(3500);
check(!(await R.shown('joyGhost')) && !/Drag the left side to walk/.test(await R.hint()), 'a returning player gets no walking lesson on entering the village');

check(!realErrors(logs).length, 'no page errors' + (realErrors(logs).length ? ': ' + realErrors(logs).slice(0, 3).join(' | ') : ''));
await finish(browser);
