// The first minute of a new player, on a phone, with real touches. A player asked in the village talk "how do you
// play?" (24 Nov): the one line about walking showed under the day card and Gogo's words and was gone four seconds
// after; the orange button's first offer was REST; and the first ring round flashed eight timed lines in twenty
// seconds while the bull was already charging. Now every lesson waits for the player:
//   house: how to walk (held until walked, with a ghost stick), the button lights only for the handi, then where the bull is;
//   ring:  walk, HIDE, ROLL, GRAB, one at a time, the bull waiting, no lamp lost until the first pitha.
//   node tests/firstminute.mjs      (static server on 8791; ?debug&fest&mercy&coach = what real players get)
// One game is open at a time (each section closes its own): seven left open at once starved GitHub's runner, and the
// later sections timed out. Waits that depend on the bull are long and count game time: on a runner drawing a few
// frames a second, game time crawls.
import puppeteer from 'puppeteer';
import fs from 'fs'; fs.mkdirSync('tests/out', { recursive: true });
import { check, finish, realErrors, SW } from './check.mjs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ protocolTimeout: 240000, args: [...SW, '--no-sandbox', '--mute-audio'] });
const logs = [], URL0 = 'http://127.0.0.1:8791/?debug&fest&mercy&coach&q=low', SLOW = 90000;
const PLAYED = { ch: 1, w: 1, kh: 1, painted: [0, 0, 0] }; // past the house, never in the ring

async function open({ lang = '', story = null, phone = true, pre = null } = {}) {
  const ctx = await browser.createBrowserContext(), page = await ctx.newPage(); page.setDefaultNavigationTimeout(90000); page.on('pageerror', e => logs.push(e.message));
  if (phone) await page.emulate({ viewport: { width: 390, height: 780, deviceScaleFactor: 1, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-A346E) Mobile' }); else await page.setViewport({ width: 1280, height: 720 });
  await page.evaluateOnNewDocument((lang, story, pre) => { if (lang) localStorage.setItem('khuntau-lang', lang); if (story) localStorage.setItem('khuntau-story', JSON.stringify(story)); if (pre) for (const k in pre) localStorage.setItem(k, pre[k]); }, lang, story, pre);
  await page.goto(URL0, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.getElementById('startBtn').dataset.village === 'ready', { timeout: 120000 });
  const P = { page, close: () => ctx.close(), ev: (f, ...a) => page.evaluate(f, ...a), until: (f, ms = 20000, ...a) => page.waitForFunction(f, { timeout: ms, polling: 80 }, ...a).then(() => true, () => false) };
  P.shown = id => P.ev(id => { const e = document.getElementById(id); return !!e && !e.hidden && getComputedStyle(e).display !== 'none' && (id !== 'hint' || e.classList.contains('show')) && (id !== 'joyGhost' || e.classList.contains('show')); }, id);
  P.hint = () => P.ev(() => { const h = document.getElementById('hint'); return h.classList.contains('show') ? h.textContent : ''; });
  // a real thumb on the left side of the screen, pushed one way and held until something is true (or for at most `max` ms)
  P.dragUntil = async (f, max = 30000, dx = 0, dy = -70, ...a) => { const x = 90, y = 600; await page.touchscreen.touchStart(x, y); await sleep(60); await page.touchscreen.touchMove(x + dx, y + dy);
    const ok = await P.until(f, max, ...a); await page.touchscreen.touchEnd(); return ok; };
  P.passCardAndGogo = async () => { await P.until(() => { const c = document.getElementById('dayCard'); return c && !c.hidden && c.classList.contains('show'); }, 40000); const under = { hint: await P.shown('hint'), ghost: await P.shown('joyGhost') };
    await page.tap('#dayCard'); await sleep(1100); under.hint2 = await P.shown('hint');
    for (let i = 0; i < 8 && await P.ev(() => !document.getElementById('dlg').hidden); i++) { await page.tap('#dlg'); await sleep(850); } return under; };
  // a taught quick round from the home screen
  P.quick = async () => { await P.ev(() => document.getElementById('quickBtn').click()); return P.until(() => __k.game.mode === 'play' && !!__k.game.coach, 40000); };
  return P;
}
// he has a clear run at you, inside the rope's reach / the post stands between you
const faceOff = () => { const g = __k.game; g.p.pos.set(-4.5, 0, 2); g.p.state = 'free'; g.p.invuln = 0; g.b.pos.set(4.5, 0, 2); g.b.state = 'watch'; g.b.t = 0; };
const postBetween = () => { const g = __k.game; g.p.pos.set(0, 0, 4.4); g.p.state = 'free'; g.p.invuln = 0; g.b.pos.set(0, 0, -4); g.b.state = 'watch'; g.b.t = 0; };

// ================= the house =================
const A = await open();
check(await A.ev(() => { const r = document.getElementById('langRow'), on = r.querySelector('button.on'); return r.offsetHeight > 0 && on && on.dataset.l === 'en' && r.querySelectorAll('button').length >= 2; }), 'home: the language is offered under PLAY, English marked');
await A.page.screenshot({ path: 'tests/out/fm-home.jpg', type: 'jpeg', quality: 72 });
await A.page.tap('#startBtn');
const under = await A.passCardAndGogo();
check(!under.hint && !under.ghost && !under.hint2, 'no lesson is spent under the day card or under Gogo\'s words');
check(await A.until(() => document.getElementById('hint').classList.contains('show') && /Drag the left side to walk/.test(document.getElementById('hint').textContent)) && await A.shown('joyGhost'), 'free in the house: how to walk comes up, with a ghost stick where the thumb goes');
check(await A.ev(() => { const g = document.getElementById('joyGhost').getBoundingClientRect(), h = document.getElementById('hint').getBoundingClientRect(), a = document.getElementById('actBtn').getBoundingClientRect(); const hit = (p, q) => p.left < q.right && q.left < p.right && p.top < q.bottom && q.top < p.bottom; return !hit(g, h) && !hit(g, a) && g.left >= 0 && g.bottom <= innerHeight; }), 'the ghost stick does not sit on the words or on the orange button');
await sleep(600); await A.page.screenshot({ path: 'tests/out/fm-house.jpg', type: 'jpeg', quality: 72 });
await sleep(6500);
check(/Drag the left side to walk/.test(await A.hint()) && await A.shown('joyGhost'), 'seven seconds later, not having moved, it is still there (it was gone after four)');
check(await A.ev(() => { const b = document.getElementById('actBtn'); return b.classList.contains('off') && !__k.story.debug.S.near; }), 'waking by the bed, the orange button offers nothing yet (it said REST)');
const p0 = await A.ev(() => [__k.game.p.pos.x, __k.game.p.pos.z]);
// to the right, into the room (straight ahead of where you wake is the bed), held until the lesson has seen enough
const walked = await A.dragUntil(() => __k.story.debug.save.w === 1, 40000, 70, 0);
check(await A.ev((p0) => Math.hypot(__k.game.p.pos.x - p0[0], __k.game.p.pos.z - p0[1]) > 0.8, p0), 'a thumb dragged on the left side walks you');
check(walked && await A.until(() => !document.getElementById('hint').classList.contains('show') && !document.getElementById('joyGhost').classList.contains('show')), 'having walked, the lesson and the ghost stick go, and it is remembered');
await A.ev(() => { const I = __k.story.debug.W.inside; __k.game.p.pos.set(I.handi.x + 0.6, __k.game.p.pos.y, I.handi.z + 0.6); });
check(await A.until(() => { const b = document.getElementById('actBtn'); return b.textContent === 'DRINK' && b.classList.contains('coach-on'); }), 'at the handi the orange button lights up as DRINK, with a pulsing ring');
await A.page.screenshot({ path: 'tests/out/fm-drink.jpg', type: 'jpeg', quality: 72 });
await A.page.tap('#actBtn'); await A.until(() => __k.story.debug.save.ch >= 1, 40000);
for (let i = 0; i < 8 && await A.ev(() => !document.getElementById('dlg').hidden); i++) { await A.page.tap('#dlg'); await sleep(850); }
await A.ev(() => { const I = __k.story.debug.W.inside; __k.game.p.pos.set(I.bed.x + 0.5, __k.game.p.pos.y, I.bed.z + 0.9); });
check(await A.until(() => { const n = __k.story.debug.S.near; return !!n && (n.label === 'REST' || n.label === 'EAT'); }) && await A.ev(() => !document.getElementById('actBtn').classList.contains('coach-on')), 'after the handi the bed and the pitha are offered again, without the ring');
await A.ev(() => { const I = __k.story.debug.W.inside; __k.game.p.pos.set(I.door.x - 0.3, __k.game.p.pos.y, I.door.z); });
await A.until(() => { const n = __k.story.debug.S.near; return !!n && n.label === 'GO OUT'; }); await A.page.tap('#actBtn');
check(await A.until(() => !__k.story.debug.S.inside && /bull waits at the khunt in the middle/.test(document.getElementById('hint').textContent) && document.getElementById('hint').classList.contains('show'), 30000), 'stepping out for the first time, you are told where the bull is');
await A.page.screenshot({ path: 'tests/out/fm-out.jpg', type: 'jpeg', quality: 72 });

// ================= the first round =================
await sleep(600); await A.ev(() => { __k.game.p.pos.set(0.6, 0, 2.2); });
await A.until(() => { const n = __k.story.debug.S.near; return !!n && n.label === 'RING'; }); await A.page.tap('#actBtn');
check(await A.until(() => __k.game.mode === 'play' && !!__k.game.coach && __k.game.coach.step === 1, 40000), 'the first round at the khunt is a taught round');
check(/Drag the left side of the screen to walk/.test(await A.hint()) && await A.shown('joyGhost') && await A.ev(() => ['hideBtn', 'rollBtn', 'grabBtn'].every(id => document.getElementById(id).classList.contains('coach-dim'))), 'lesson 1: walk. One line, the ghost stick, the three buttons stepped back');
await sleep(400); await A.page.screenshot({ path: 'tests/out/fm-ring-1.jpg', type: 'jpeg', quality: 72 });
// six seconds of game time (a normal round's first charge comes after about three), at most a minute of real time
const calm = await A.ev(async () => { const g = __k.game, seen = new Set(), t0 = g.t, r0 = performance.now(); while (g.t - t0 < 6 && performance.now() - r0 < 60000) { seen.add(g.b.state); await new Promise(r => setTimeout(r, 100)); } return { states: [...seen], secs: +(g.t - t0).toFixed(1) }; });
check(calm.states.every(s => s === 'watch') && calm.secs >= 5.9 && /Drag the left side of the screen to walk/.test(await A.hint()), `for ${calm.secs} s of doing nothing the bull only watches and the line stays (${calm.states})`);
check(await A.dragUntil(() => __k.game.coach && __k.game.coach.step === 2, 40000) && /Tap HIDE/.test(await A.hint()), 'having walked: lesson 2, tap HIDE');
check(await A.ev(() => document.getElementById('hideBtn').classList.contains('coach-on') && !document.getElementById('hideBtn').classList.contains('coach-dim') && document.getElementById('rollBtn').classList.contains('coach-dim') && document.getElementById('grabBtn').classList.contains('coach-dim')) && !(await A.shown('joyGhost')), 'HIDE has the pulsing ring, the other two stay back, the ghost stick is gone');
await A.page.screenshot({ path: 'tests/out/fm-ring-2.jpg', type: 'jpeg', quality: 72 });
await A.ev(faceOff); await sleep(300);
// A recorder in the page notes what the line said while he ran and which way the roll went at its first frame (a moment
// later he has run past, and 'toward him' means nothing).
await A.ev(() => { const g = __k.game; window.__rec = { now: false, roll: null }; (function f() { const h = document.getElementById('hint'); if (g.b.state === 'charge' && h.classList.contains('show') && /ROLL now!/.test(h.textContent)) window.__rec.now = true;
  if (!window.__rec.roll && g.p.state === 'roll') { const tx = g.b.pos.x - g.p.pos.x, tz = g.b.pos.z - g.p.pos.z, n = Math.hypot(tx, tz) || 1; window.__rec.roll = { toward: +((g.p.rollDir.x * tx + g.p.rollDir.z * tz) / n).toFixed(2), dist: +n.toFixed(1) }; }
  if (g.mode === 'play' && !(window.__rec.roll && window.__rec.now)) requestAnimationFrame(f); })(); });
await A.page.tap('#hideBtn');
check(await A.until(() => __k.game.coach && __k.game.coach.step === 3) && await A.ev(() => /when he runs at you, tap ROLL|ROLL now!/.test(document.getElementById('hint').textContent) && document.getElementById('rollBtn').classList.contains('coach-on')), 'HIDE tapped: lesson 3, wait, then ROLL when he runs at you; ROLL has the ring');
check(await A.until(() => __k.game.b.state === 'charge', SLOW), 'and now he comes: the hide brought him');
await A.page.tap('#rollBtn'); // ROLL on its own: no thumb on the stick
const roll = await A.ev(async () => { for (let i = 0; i < 400 && !window.__rec.roll && __k.game.coach && __k.game.coach.step === 3; i++) await new Promise(r => setTimeout(r, 25)); return { rolling: !!window.__rec.roll, now: window.__rec.now, ...(window.__rec.roll || { toward: 9 }) }; });
check(roll.now, 'as he starts to run the line changes to: ROLL now!');
check(roll.rolling && Math.abs(roll.toward) < 0.35, `ROLL alone jumps aside, across his line, not at him (${roll.toward} toward him, from ${roll.dist} m; it was 1.0)`);
check(await A.until(() => __k.game.coach && __k.game.coach.step === 4, SLOW) && /dizzy! Run to the post and tap GRAB/.test(await A.hint()) && await A.ev(() => document.getElementById('grabBtn').classList.contains('coach-on') && __k.game.lives === 3), 'dodged: lesson 4, he is dizzy, run to the post and GRAB');
await A.page.screenshot({ path: 'tests/out/fm-ring-4.jpg', type: 'jpeg', quality: 72 });
// by his own clock (game time): still down at 3.5 s, where a normal stun lasts one to two
const dizzy = await A.ev(async () => { const g = __k.game, r0 = performance.now(); while (performance.now() - r0 < 90000) { if (!['stunned', 'recover'].includes(g.b.state)) return { ok: false, t: +g.b.t.toFixed(1), state: g.b.state }; if (g.b.t > 3.5) return { ok: true, t: +g.b.t.toFixed(1) }; await new Promise(r => setTimeout(r, 100)); } return { ok: false, t: +g.b.t.toFixed(1), state: 'test timed out' }; });
check(dizzy.ok, `he stays dizzy while you fetch it (still down at ${dizzy.t} s of his own clock; a normal stun is one to two)` + (dizzy.ok ? '' : ` [${dizzy.state}]`));
await A.ev(() => { __k.game.p.pos.set(0.5, 0, 0.9); __k.game.p.state = 'free'; }); await sleep(250); await A.page.tap('#grabBtn');
check(await A.until(() => __k.game.pitha >= 1 && !__k.game.coach, SLOW), 'the first pitha ends the lessons');
check(await A.ev(() => localStorage.getItem('khuntau-coach') === '1' && __k.coachDone && ['hideBtn', 'rollBtn', 'grabBtn'].every(id => !document.getElementById(id).classList.contains('coach-dim') && !document.getElementById(id).classList.contains('coach-on')) && __k.game.lives === 3), 'it is remembered, the buttons are all back, and no lamp was lost on the way');
check(await A.until(() => /Snatch as many pitha as you can/.test(document.getElementById('hint').textContent) && document.getElementById('hint').classList.contains('show'), 30000), 'and the game says what it is: snatch as many as you can, each lamp is a life');
// the next round is a real round: no lessons, he comes on his own
await A.ev(() => { __k.game.lives = 0; __k.gameOver(); }); await A.until(() => __k.game.mode === 'over'); await sleep(600);
await A.ev(() => __k.startGame()); await A.until(() => __k.game.mode === 'play');
check(await A.ev(() => !__k.game.coach) && await A.until(() => ['windup', 'charge'].includes(__k.game.b.state), SLOW), 'the next round has no lessons: he charges without being asked');
await A.close();

// ================= being hit, and the post =================
const B = await open({ story: PLAYED });
await B.quick(); await B.ev(faceOff); await B.ev(() => __k.coachStep(2)); await sleep(300); await B.page.tap('#hideBtn');
check(await B.until(() => __k.game.coach && __k.game.coach.step === 2 && /He got you, but it does not count yet/.test(document.getElementById('hint').textContent), SLOW) && await B.ev(() => __k.game.lives === 3 && document.getElementById('hideBtn').classList.contains('coach-on')), 'standing still, he knocks you over: no lamp lost, and the lesson goes back to HIDE');
await B.until(() => __k.game.p.state === 'free' && __k.game.b.state === 'watch', SLOW); await B.ev(postBetween); await sleep(300); await B.page.tap('#hideBtn');
check(await B.until(() => __k.game.coach && __k.game.coach.step === 4 && __k.game.b.state === 'stunned', SLOW) && await B.ev(() => __k.game.lives === 3), 'with the post between you he slams into it: that brings lesson 4 as well');
await B.close();

// ================= Hindi, and a laptop =================
const H = await open({ lang: 'hi', story: PLAYED });
check(await H.ev(() => document.querySelector('#langRow button.on').dataset.l === 'hi'), 'home: a Hindi player sees हिन्दी marked');
await H.quick();
const hi1 = await H.hint(); await H.ev(() => __k.coachStep(2)); const hi2 = await H.hint(), btn = await H.ev(() => document.getElementById('hideBtn').textContent);
check(!/[A-Za-z]{3,}/.test(hi1 + hi2 + btn) && /खाल/.test(hi2) && btn === 'खाल', `Hindi: the lessons and the buttons are in Hindi, also in a quick round from the home screen (${hi1} / ${hi2})`);
await H.page.screenshot({ path: 'tests/out/fm-ring-hindi.jpg', type: 'jpeg', quality: 72 });
await H.close();
const T = await open(); // choosing the language on the home screen
await T.page.tap('#langRow button[data-l="hi"]'); await T.page.tap('#startBtn'); await T.until(() => { const c = document.getElementById('dayCard'); return c && !c.hidden && c.classList.contains('show'); }, 40000);
check(await T.ev(() => localStorage.getItem('khuntau-lang') === 'hi' && /सोहराय का दिन/.test(document.getElementById('dayCard').textContent)), 'tapping हिन्दी on the home screen puts the game in Hindi from the first card');
await T.close();
const Lp = await open({ phone: false, story: PLAYED });
await Lp.quick();
check(/Walk with WASD or the arrow keys/.test(await Lp.hint()) && !(await Lp.shown('joyGhost')), 'laptop: the lesson names the keys and shows no ghost stick');
await Lp.close();

// ================= someone who already plays is not taught again =================
const R = await open({ story: { ch: 5, done: 1, painted: [1, 1, 1], chosen: 1, oiled: 1, garland: 1 }, pre: { 'khuntau-coach': '1' } });
await R.page.tap('#startBtn'); await R.until(() => __k.game.mode === 'story', 40000); await R.ev(() => { const c = document.getElementById('dayCard'); if (c && !c.hidden) c.click(); }); await sleep(3500);
check(!(await R.shown('joyGhost')) && !/Drag the left side to walk/.test(await R.hint()), 'a returning player gets no walking lesson on entering the village');
await R.close();

check(!realErrors(logs).length, 'no page errors' + (realErrors(logs).length ? ': ' + realErrors(logs).slice(0, 3).join(' | ') : ''));
await finish(browser);
