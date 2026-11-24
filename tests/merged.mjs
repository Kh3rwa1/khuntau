// One game: a brand-new player taps PLAY, lands in the village, walks to the khunt and plays a normal scored round
// (score on the board, XP, village prompt), then goes back to the village with the story quest where it was.
// Also: a challenge link goes straight to the ring, and a Hindi player's village round is in Hindi.
//   node tests/merged.mjs                         (static server on 8791; board check skipped)
//   node tests/merged.mjs http://127.0.0.1:8787   (wrangler dev --local; the score must reach the board)
import puppeteer from 'puppeteer';
import fs from 'fs'; fs.mkdirSync('tests/out', { recursive: true });
import { check, finish, realErrors, SW } from './check.mjs';
const BASE = process.argv[2] || 'http://127.0.0.1:8791', API = BASE.includes('8787');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ protocolTimeout: 180000, args: [...SW, '--no-sandbox', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
async function phone(lang) {
  const ctx = await browser.createBrowserContext(), page = await ctx.newPage(), logs = []; page.on('pageerror', e => logs.push(e.message));
  await page.emulate({ viewport: { width: 390, height: 780, deviceScaleFactor: 1, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-A346E) Mobile' });
  await page.evaluateOnNewDocument((lang) => { localStorage.setItem('khuntau-name', 'First Timer'); if (lang) localStorage.setItem('khuntau-lang', lang); }, lang);
  return { ctx, page, logs, ev: (f, ...a) => page.evaluate(f, ...a), until: (f, ms = 15000, ...a) => page.waitForFunction(f, { timeout: ms, polling: 50 }, ...a).then(() => true, () => false) };
}
const act = (P) => P.ev(() => document.getElementById('actBtn').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));

// 1. brand-new player: PLAY -> village -> out of the house -> khunt -> scored round -> back to the village
{ const P = phone(); const { page, ev, until } = await P;
  await page.goto(BASE + '/?debug&q=low', { waitUntil: 'domcontentloaded' });
  check(await until(() => !document.getElementById('startBtn').disabled, 90000), 'PLAY unlocks');
  check(await ev(() => !document.getElementById('quickBtn').hidden), 'a quick-round link is offered under PLAY');
  await until(() => document.getElementById('startBtn').dataset.village === 'ready', 60000);
  await ev(() => document.getElementById('startBtn').click());
  check(await until(() => __k.game.mode === 'story' && __k.story.debug.S.inside), 'PLAY opens the village (a new player wakes in the house)');
  // Gogo is a woman and dressed as one: a sari (skirt, border, pallu) in her own colours over a blouse; the worker
  // women have no hard hats; the men have no sari. The skirt hangs below her waist and reaches her ankles in Idle.
  check(await ev(() => { const g = __k.crowd.find(c => c.kind === 'woman'), w = __k.crowd.find(c => c.kind === 'worker'), m = __k.crowd.find(c => c.kind === 'man'), col = g.body.geometry.attributes.color;
    const hex = (a, k) => { const p = a.mats[k].part, c = a.body.geometry.attributes.color; return [0, 1, 2].map(j => c.getComponent(p.start, j).toFixed(3)).join(); };
    return ['Sari', 'SariBorder', 'Pallu'].every(k => g.mats[k] && g.mats[k].part.count > 20) && hex(g, 'Sari') !== hex(g, 'SariBorder') && hex(g, 'Shirt') === hex(g, 'SariBorder')
      && !!w.mats.Sari && !w.mats.Hat && !m.mats.Sari && !!col; }), 'Gogo wears a sari in her own colours; worker women have no hard hats; men no sari');
  { const r = await ev(() => { const g = __k.crowd.find(c => c.kind === 'woman'), T = __k.THREE, b = g.body, p = g.mats.Sari.part; g.play('Idle', { fade: 0 }); g.mixer.update(0.5); g.wrap.updateMatrixWorld(true); b.skeleton.update();
    const v = new T.Vector3(); let lo = Infinity, hi = -Infinity; for (let i = p.start; i < p.start + p.count; i++) { b.getVertexPosition(i, v); b.localToWorld(v); lo = Math.min(lo, v.y); hi = Math.max(hi, v.y); }
    const y0 = g.wrap.position.y, hips = g.root.getObjectByName('Hips').getWorldPosition(new T.Vector3()).y - y0; return { lo: lo - y0, hi: hi - y0, hips }; });
    check(r.lo < 0.25 && r.hi > r.hips - 0.05 && r.hi < r.hips + 0.35, `her skirt runs from the waist down to the ankles (${r.lo.toFixed(2)} to ${r.hi.toFixed(2)} m, hips at ${r.hips.toFixed(2)})`); }
  // Gogo's wake-up lines arrive a moment later: tap through them like a player
  await until(() => !!__k.story.debug.S.dlg, 5000);
  for (let i = 0; i < 8 && await ev(() => !!__k.story.debug.S.dlg); i++) { await ev(() => document.getElementById('dlg').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))); await sleep(350); }
  // rest on the khatia: you lie on it, head on the pillow, then get up again
  await ev(() => { const d = __k.story.debug, w = d.W.inside.bed; __k.game.p.pos.set(w.x + 0.2, w.y, w.z + 1.05); d.S.near = null; });
  await sleep(700); check(await ev(() => !__k.story.debug.S.near), 'by the khatia before the handi: nothing is offered yet (a new player\'s first orange button was REST)');
  await ev(() => { __k.story.debug.save.ch = 1; }); // as if the handi were drunk: the bed is offered (put back below, this player's quest must stay at the handi)
  check(await until(() => { const n = __k.story.debug.S.near; return n && n.label === 'REST'; }), 'by the khatia: REST');
  await act(await P);
  check(await until(() => { const r = __k.story.debug.S.rest, q = __k.player.wrap.quaternion, a = __k.story.debug.W.inside.restAt, w = __k.player.wrap.position;
    return r && r.t > 0.5 && Math.abs(q.w - 1) > 0.2 && Math.hypot(w.x - a.x, w.z - a.z) < 0.05 && w.y > a.y + 0.4; }, 6000), 'resting: lying flat on the khatia');
  await page.screenshot({ path: 'tests/out/merged-0-rest.jpg', type: 'jpeg', quality: 70 });
  check(await until(() => !__k.story.debug.S.rest && Math.abs(__k.player.wrap.rotation.x) < 0.01 && Math.abs(__k.player.wrap.rotation.z) < 0.01, 12000), 'then you get up and stand again');
  await ev(() => { __k.story.debug.save.ch = 0; __k.story.debug.S.objKey = ''; });
  await ev(() => { const d = __k.story.debug, w = d.W.inside.door; __k.game.p.pos.set(w.x, w.y, w.z); d.S.near = null; });
  check(await until(() => { const n = __k.story.debug.S.near; return n && n.label === 'GO OUT'; }), 'the door says GO OUT'); await act(await P);
  await until(() => !__k.story.debug.S.inside, 8000);
  await ev(() => { __k.game.p.pos.set(0, 0, 9.5); __k.story.debug.S.near = null; });
  check(await until(() => { const n = __k.story.debug.S.near; return n && n.label === 'RING'; }), 'at the khunt a new player can play a round (no story gate)');
  await page.screenshot({ path: 'tests/out/merged-1-khunt.jpg', type: 'jpeg', quality: 70 });
  await act(await P);
  check(await until(() => __k.game.mode === 'play' && __k.game.villageRun && !__k.game.storyRun), 'the khunt starts a normal scored round');
  await ev(() => { __k.game.score = 3; __k.game.pitha = 1; __k.gameOver(); });
  check(await until(() => !document.getElementById('overScreen').hidden, 8000), 'game over shows the results');
  check(await ev(() => document.getElementById('menuBtn').textContent === 'Back to village' && !document.getElementById('shareScoreBtn').hidden), 'results offer Share and Back to village');
  check(await ev(() => !document.getElementById('vilAsk').hidden), 'and ask to play for your village');
  if (API) check(await until(() => __k.boardData && __k.boardData.me && __k.boardData.me.p === 3, 10000), 'the round from the village reached the daily board');
  await page.screenshot({ path: 'tests/out/merged-2-over.jpg', type: 'jpeg', quality: 70 });
  await ev(() => document.getElementById('menuBtn').click());
  check(await until(() => __k.game.mode === 'story' && __k.story.active() && !__k.game.villageRun, 8000), 'Back to village returns to the village');
  check(await ev(() => __k.story.debug.save.ch === 0 && /handi/i.test(document.getElementById('objText').textContent)), 'the story quest is where it was (drink the handi)');
  await page.screenshot({ path: 'tests/out/merged-3-back.jpg', type: 'jpeg', quality: 70 });
  const e = realErrors((await P).logs); check(!e.length, 'no page errors' + (e.length ? ': ' + e.slice(0, 3).join(' | ') : ''));
  await (await P).ctx.close(); }

// 2. a challenge link skips the village: PLAY goes straight into the ring
{ const P = await phone(); const { page, ev, until } = P;
  await page.goto(BASE + '/?debug&q=low&beat=9&from=Gouri', { waitUntil: 'domcontentloaded' });
  await until(() => !document.getElementById('startBtn').disabled, 90000);
  await ev(() => document.getElementById('startBtn').click());
  check(await until(() => __k.game.mode === 'play' && !__k.game.villageRun, 8000), 'a challenge link: PLAY goes straight to the ring');
  await P.ctx.close(); }

// 3. Hindi: a round started in the village speaks Hindi (buttons and lines)
{ const P = await phone('hi'); const { page, ev, until } = P;
  await page.evaluateOnNewDocument(() => localStorage.setItem('khuntau-story', JSON.stringify({ ch: 5, done: 1, painted: [1, 1, 1], chosen: 1, oiled: 1, garland: 1 })));
  await page.goto(BASE + '/?debug&q=low', { waitUntil: 'domcontentloaded' });
  await until(() => document.getElementById('startBtn').dataset.village === 'ready', 90000);
  await ev(() => document.getElementById('startBtn').click()); await until(() => __k.game.mode === 'story');
  await ev(() => { const d = __k.story.debug; d.S.dlg = null; document.getElementById('dlg').hidden = true; __k.game.p.pos.set(0, 0, 9.5); d.S.near = null; });
  await until(() => { const n = __k.story.debug.S.near; return n && n.label === 'RING'; });
  check(await ev(() => document.getElementById('actBtn').textContent === 'खेलो'), 'Hindi: the khunt button reads खेलो');
  await act(P); await until(() => __k.game.mode === 'play');
  check(await ev(() => document.getElementById('rollBtn').textContent === 'लुढ़को' && document.getElementById('grabBtn').textContent === 'झपटो'), 'Hindi: ring buttons in a village round are Hindi');
  await P.ctx.close(); }
await finish(browser);
