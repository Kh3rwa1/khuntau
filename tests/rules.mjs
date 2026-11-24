// What makes one round differ from the next (solo scored rounds only): each animal's temper, the beginner's warning
// hit, walking out with what you have, the festival day's rule and what today's village activities give you.
// Online rounds and the story's finale must be untouched, and a plain brown-bull round must be the old game.
//   node tests/rules.mjs     (static server on 8791)
import puppeteer from 'puppeteer';
import fs from 'fs'; fs.mkdirSync('tests/out', { recursive: true });
import { check, finish, realErrors, SW } from './check.mjs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ protocolTimeout: 180000, args: [...SW, '--no-sandbox', '--mute-audio'] });
const logs = [];
async function open(query, vp = { width: 390, height: 780 }, store = {}) {
  const page = await browser.newPage(); page.on('pageerror', e => logs.push(e.message));
  await page.emulate({ viewport: { ...vp, deviceScaleFactor: 1, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-A346E) Mobile' });
  await page.evaluateOnNewDocument((st) => { localStorage.setItem('khuntau-seen-tips', '1'); localStorage.setItem('khuntau-name', 'Rules Test'); for (const k in st) localStorage.setItem(k, st[k]); }, store);
  await page.goto('http://127.0.0.1:8791/?' + query, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.getElementById('startBtn').dataset.village === 'ready', { timeout: 90000 });
  const ev = (f, ...a) => page.evaluate(f, ...a);
  const until = (f, ms = 30000, ...a) => page.waitForFunction(f, { timeout: ms, polling: 50 }, ...a).then(() => true, () => false);
  return { page, ev, until };
}
const quick = async (P) => { await P.ev(() => document.getElementById('quickBtn').click()); await P.until(() => __k.game.mode === 'play'); await P.ev(() => { __k.hs.next = 999; }); };
// how long his next warning lasts and how fast he then comes, with the player out of harm's way
const charge = (P) => P.ev(async () => { const g = __k.game; g.p.invuln = 999; g.p.state = 'free'; g.p.pos.set(0, 0, 6); g.b.pos.set(0, 0, -4); g.b.feinted = true; g.b.state = 'watch'; g.b.t = 99;
  for (let i = 0; i < 4000 && g.b.state !== 'windup'; i++) await new Promise(r => setTimeout(r, 15)); const wind = g.b.dur; /* generous waits: on CI's software renderer game time crawls */
  for (let i = 0; i < 8000 && g.b.state !== 'charge'; i++) await new Promise(r => setTimeout(r, 15)); return { wind, speed: g.b.speed, state: g.b.state }; });

{ // ---- the rules themselves, with the old tests' settings (?debug: no festival days, no beginner's warning)
  const P = await open('debug&q=low', undefined, { 'khuntau-played': '1' });
  check(await P.ev(() => __k.stageOf(2) === 1 && __k.stageOf(3) === 2 && __k.stageOf(8) === 3 && __k.stageOf(14) === 4 && __k.stageOf(22) === 5), 'the stages come sooner: 3, 8, 14 and 22 points');
  check(await P.ev(() => __k.ANIMALS.every(a => a.temper && a.temper.tag) && Object.entries(__k.ANIMALS[0].temper).every(([k, v]) => typeof v !== 'number' || v === (k === 'feint' ? 0 : 1))), 'every animal has a temper, and the brown bull is the plain one');
  await quick(P);
  const brown = await charge(P);
  check(Math.abs(brown.wind - 1.25) < 0.01 && Math.abs(brown.speed - 8.5 * 0.82) < 0.05, `a brown-bull round is the old game (first warning ${brown.wind.toFixed(2)} s, speed ${brown.speed.toFixed(2)})`);
  // online and the story finale ignore tempers, day rules and help
  check(await P.ev(() => { const g = __k.game, keep = g.mod; g.mod = __k.buildMod({ day: 3, fish: 1 }); g.online = true; const a = __k.mod().lamps === 3 && __k.temper().wind === 1; g.online = false; g.storyRun = true; const b = __k.mod().lamps === 3 && !__k.soloRun(); g.storyRun = false; const c = __k.mod().lamps === 5; g.mod = keep; return a && b && c; }), 'online rounds and the story finale ignore all of it');
  // tempers
  await P.ev(() => document.getElementById('pauseBtn') && 0); await P.page.keyboard.press('Escape'); await sleep(300); await P.ev(() => { const b = document.getElementById('quitBtn'); b && b.click(); }); await sleep(600);
  await P.ev(() => __k.setAnimal('white')); await sleep(400); await quick(P);
  const white = await charge(P);
  check(white.wind < brown.wind * 0.9 && white.speed > brown.speed * 1.05, `the white bull is quick: shorter warning (${white.wind.toFixed(2)} s), faster charge (${white.speed.toFixed(2)})`);
  check(await P.ev(() => /White bull · Quick/.test(document.getElementById('animalName').textContent)), 'the home screen names the temper');
  await P.page.keyboard.press('Escape'); await sleep(300); await P.ev(() => { const b = document.getElementById('quitBtn'); b && b.click(); }); await sleep(600);
  await P.ev(() => __k.setAnimal('redcow')); await P.until(() => __k.animal && true, 3000); await sleep(2500); await quick(P);
  const sly = await P.ev(async () => { Math.__r = Math.random; Math.random = () => 0.01; const g = __k.game; g.p.invuln = 999; g.charges = 1; g.feints = 0; g.b.feinted = false; g.p.pos.set(0, 0, 6); g.b.pos.set(0, 0, -4); g.b.state = 'watch'; g.b.t = 99;
    for (let i = 0; i < 8000 && !g.feints; i++) { g.p.invuln = 999; await new Promise(r => setTimeout(r, 15)); } Math.random = Math.__r; /* up to two minutes: a 1.25 s warning can take that long at 1-3 fps */ return { feints: g.feints || 0, stage: g.stage || 1 }; });
  check(sly.feints >= 1 && sly.stage === 1, 'the red cow is sly: she feints in stage 1, before any other animal would');
  await P.page.keyboard.press('Escape'); await sleep(300); await P.ev(() => { const b = document.getElementById('quitBtn'); b && b.click(); }); await sleep(600);
  await P.ev(() => __k.setAnimal('brown')); await sleep(600);

  // the day's rule and today's help
  const m = await P.ev(() => { const a = __k.buildMod({ day: 3, fish: 1, arch: 1, drum: 1, jale: 1 }), b = __k.buildMod({ day: 0 }), c = __k.buildMod({ day: 2 }); return { a, b, c }; });
  check(m.a.lamps === 5 && m.a.calm === 4 && m.a.handi === 5 && Math.abs(m.a.wind - 0.85) < 1e-6 && Math.abs(m.a.roll - 0.8) < 1e-6 && m.a.notes.length === 5, `a day's rule and the four kinds of help add up (${m.a.lamps} lamps, ${m.a.notes.length} lines)`);
  check(m.b.lamps === 3 && m.b.calm === 2 && m.b.handi === 12 && m.b.notes.length === 0 && m.c.handi === 5 && m.c.handiGap === 0.6, 'no day and no help is the old round; day 2 brings the handi early');
  // a round from the village with a fish in the basket: four lamps
  await P.ev(() => document.getElementById('startBtn').click()); await P.until(() => __k.game.mode === 'story');
  await sleep(1500);
  await P.ev(() => { const d = __k.story.debug; d.S.dlg = null; document.getElementById('dlg').hidden = true; d.today().fish = 1; d.villageRound(); });
  check(await P.until(() => __k.game.mode === 'play' && __k.game.villageRun && __k.game.lives === 4 && document.querySelectorAll('#lamps svg').length === 4, 15000), 'fishing today gives a fourth lamp in a round started at the khunt');
  check(await P.ev(() => __k.mod().notes.length === 1 && /fished/.test(__k.mod().notes[0])), 'and the round says why');
  // the handi refills up to the fourth lamp, not the third
  check(await P.ev(() => { const g = __k.game; g.lives = 3; return __k.mod().lamps === 4; }), 'the fourth lamp can be refilled');

  // walking out
  await P.ev(() => { __k.hs.next = 999; const g = __k.game; g.lives = 3; g.p.invuln = 999; g.b.state = 'watch'; g.b.t = 0; g.b.dur = 99; });
  check(await P.ev(() => document.getElementById('leaveBtn').hidden), 'no LEAVE before you have anything to lose');
  await P.ev(() => { __k.game.t = 80; __k.award(5, 'test'); });
  check(await P.ev(() => !document.getElementById('leaveBtn').hidden), 'LEAVE appears once you hold 3 points');
  await P.page.screenshot({ path: 'tests/out/rules-leave-portrait.jpg', type: 'jpeg', quality: 72 });
  const box = await P.ev(() => { const r = (id) => { const b = document.getElementById(id).getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom]; }; const l = r('leaveBtn'), over = (a, b) => a[0] < b[2] - 1 && b[0] < a[2] - 1 && a[1] < b[3] - 1 && b[1] < a[3] - 1; return { l, hit: ['hideBtn', 'rollBtn', 'grabBtn'].filter(id => over(l, r(id))), inside: l[0] >= 0 && l[2] <= innerWidth && l[3] <= innerHeight }; });
  check(box.hit.length === 0 && box.inside, 'LEAVE covers none of HIDE, ROLL or GRAB and sits on the screen');
  await P.ev(() => { const g = __k.game; g.b.state = 'windup'; g.b.t = 0; g.b.dur = 99; __k.leaveRing(); });
  check(await P.ev(() => __k.game.mode === 'play' && !__k.game.left), 'he will not let you walk out while he is coming');
  await P.ev(() => { const g = __k.game; g.b.state = 'watch'; g.b.t = 0; g.b.dur = 99; });
  const before = await P.ev(() => ({ score: __k.game.score, lives: __k.game.lives }));
  await P.ev(() => document.getElementById('leaveBtn').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true })));
  const want = before.score + before.lives * 3 + Math.round(before.score * 0.15);
  check(await P.until(() => __k.game.mode === 'over' && __k.game.left, 8000) && await P.ev((w) => __k.game.score === w, want), `walking out ends the round and every lamp still lit pays (${before.score} + ${want - before.score} = ${want})`);
  check(await P.until(() => !document.getElementById('overScreen').hidden && /walking out/.test(document.getElementById('overLine').textContent), 8000), 'the result says what walking out paid');
  await P.page.screenshot({ path: 'tests/out/rules-walked-out.jpg', type: 'jpeg', quality: 72 });
  // a score that came too fast is never sent: the bonus is cut to what the server will accept
  await P.ev(() => document.getElementById('againBtn').click()); await P.until(() => __k.game.mode === 'play');
  const fast = await P.ev(() => { __k.hs.next = 999; const g = __k.game; g.p.invuln = 999; g.b.state = 'watch'; g.b.t = 0; g.b.dur = 99; g.t = 2; __k.award(4, 'test'); g.t = 2; __k.leaveRing(); return { score: g.score, cap: Math.floor(3 + 2 * 1.2) }; });
  check(fast.score <= Math.max(4, fast.cap), `the bonus never pushes a score past what the server accepts (${fast.score})`);
  await P.page.close();
}
{ // ---- landscape phone: the button still fits
  const P = await open('debug&q=low', { width: 780, height: 390 }, { 'khuntau-played': '1' });
  await quick(P); await P.ev(() => { const g = __k.game; g.p.invuln = 999; g.b.state = 'watch'; g.b.t = 0; g.b.dur = 99; g.t = 80; __k.award(5, 'test'); });
  await P.page.screenshot({ path: 'tests/out/rules-leave-landscape.jpg', type: 'jpeg', quality: 72 });
  const box = await P.ev(() => { const r = (id) => { const b = document.getElementById(id).getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom]; }; const l = r('leaveBtn'), over = (a, b) => a[0] < b[2] - 1 && b[0] < a[2] - 1 && a[1] < b[3] - 1 && b[1] < a[3] - 1; return { hit: ['hideBtn', 'rollBtn', 'grabBtn', 'pauseBtn'].filter(id => document.getElementById(id) && over(l, r(id))), inside: l[0] >= 0 && l[1] >= 0 && l[2] <= innerWidth && l[3] <= innerHeight }; });
  check(box.hit.length === 0 && box.inside, 'landscape: LEAVE fits and covers no other button');
  await P.page.close();
}
{ // ---- a real new player (no ?debug shortcuts for the warning hit): the first hit costs no lamp, the second does
  const P = await open('debug&mercy&q=low');
  await quick(P);
  await P.ev(() => { const g = __k.game; g.b.state = 'watch'; g.b.t = 0; g.b.dur = 99; g.b.dir.set(0, 0, 1); g.p.invuln = 0; __k.hitPlayer(); });
  check(await P.ev(() => __k.game.lives === 3 && __k.game.mercyUsed && __k.game.p.state === 'hit'), 'a new player\'s first hit is a warning: knocked back, no lamp lost');
  await P.ev(() => { __k.game.p.invuln = 0; __k.hitPlayer(); });
  check(await P.ev(() => __k.game.lives === 2), 'the second hit costs a lamp');
  await P.page.close();
  const V = await open('debug&mercy&q=low', undefined, { 'khuntau-rounds': '9', 'khuntau-played': '1' });
  await quick(V); await V.ev(() => { const g = __k.game; g.b.state = 'watch'; g.b.t = 0; g.b.dur = 99; g.b.dir.set(0, 0, 1); g.p.invuln = 0; __k.hitPlayer(); });
  check(await V.ev(() => __k.game.lives === 2), 'someone with rounds behind them gets no warning');
  await V.page.close();
}
check(realErrors(logs).length === 0, 'no page errors ' + realErrors(logs).join(' | ').slice(0, 300));
await finish(browser);
