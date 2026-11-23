// Every moment makes its sound: steps, a snore on the khatia, munching, the door, chickens fluttering, the bow's creak
// and twang, a miss thudding into the dirt, the float's plop, a landed fish's splash, a roll, the hide's flap, and
// slow motion muffling everything with a whoomp. Checked by name through the debug sound log (sounds are synthesized,
// so this proves they fire; how they sound needs ears).
//   node tests/sound.mjs     (static server on 8791)
import puppeteer from 'puppeteer';
import { check, finish, realErrors, SW, dragShoot } from './check.mjs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ protocolTimeout: 180000, args: [...SW, '--no-sandbox', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
async function phone(story) {
  const page = await browser.newPage(), logs = []; page.on('pageerror', e => logs.push(e.message));
  await page.emulate({ viewport: { width: 390, height: 780, deviceScaleFactor: 1, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-A346E) Mobile' });
  await page.evaluateOnNewDocument((st) => { localStorage.setItem('khuntau-name', 'Sound Test'); localStorage.setItem('khuntau-played', '1'); if (st) localStorage.setItem('khuntau-story', JSON.stringify(st)); }, story);
  await page.goto('http://127.0.0.1:8791/?debug&q=low', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.getElementById('startBtn').dataset.village === 'ready', { timeout: 90000 });
  return { page, logs, ev: (f, ...a) => page.evaluate(f, ...a), until: (f, ms = 15000, ...a) => page.waitForFunction(f, { timeout: ms, polling: 50 }, ...a).then(() => true, () => false) };
}
const heard = (P, name, ms = 15000) => /* returns as soon as it fires; long timeouts are for slow CI runners where game time crawls */ P.until((n) => (window.__sfxLog || []).includes(n), ms, name);
const clear = (P) => P.ev(() => { window.__sfxLog.length = 0; });
const act = (P) => P.ev(() => document.getElementById('actBtn').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
const near = (P, l) => P.until((l) => { const n = __k.story.debug.S.near; return n && n.label === l; }, 15000, l);

// 1. the village: steps, the house (rest -> snore, eat -> munch, door), chickens
{ const P = await phone({ ch: 5, done: 1, painted: [1, 1, 1], chosen: 1, oiled: 1, garland: 1 });
  await P.ev(() => document.getElementById('startBtn').click()); await P.until(() => __k.game.mode === 'story');
  await P.ev(() => { const d = __k.story.debug; d.S.dlg = null; document.getElementById('dlg').hidden = true; });
  check(await P.ev(() => !!__k.audio.ctx && !!__k.audio.lp), 'the sound graph is up (with the slow-motion filter)');
  await clear(P); await P.ev(() => { __k.game.p.pos.set(0, 0, 15); }); await P.page.keyboard.down('KeyW'); const stepped = await heard(P, 'step', 25000); await P.page.keyboard.up('KeyW'); /* hold W until a step lands: steps come per metre walked in game time */
  check(stepped, 'walking makes footsteps');
  { const m = await P.ev(() => ({ bed: __k.MUSIC_VOL.game, village: __k.BED.village, ring: __k.BED.ring, micro: __k.audio.microBus.gain.value, intro: __k.MUSIC_VOL.intro }));
    check(m.bed === m.village && m.village <= 0.08 && m.ring <= 0.12 && m.intro <= 0.5 && m.micro >= 2, `the music is a quiet bed (village ${m.village}, ring ${m.ring}, home ${m.intro}) and the everyday sounds are lifted over it (x${m.micro.toFixed(1)})`); }
  await clear(P); await P.ev(() => { const d = __k.story.debug; __k.game.p.pos.copy(d.W.drumStand); }); check(await heard(P, 'chatter', 30000), 'people at the akhra talk among themselves');
  // into the house
  await P.ev(() => { const d = __k.story.debug, D = d.W.doorOut || null; });
  await P.ev(() => { const d = __k.story.debug; __k.game.p.pos.copy(d.W.inside.door); d.S.inside = true; d.W.room.visible = true; d.S.near = null; });
  await near(P, 'GO OUT'); await clear(P); await act(P); check(await heard(P, 'door'), 'the door creaks');
  await sleep(1200);
  await P.ev(() => { const d = __k.story.debug; d.S.inside = true; d.W.room.visible = true; const w = d.W.inside.bed; __k.game.p.pos.set(w.x + 0.2, w.y, w.z + 1.05); d.S.near = null; });
  await near(P, 'REST'); await clear(P); await act(P); check(await heard(P, 'snore', 25000), 'lying on the khatia, you snore');
  await P.until(() => !__k.story.debug.S.rest, 12000);
  await P.ev(() => { const d = __k.story.debug, w = d.W.inside.pitha; __k.game.p.pos.set(w.x, w.y, w.z + 0.6); d.S.near = null; });
  if (await near(P, 'EAT')) { await clear(P); await act(P); check(await heard(P, 'munch'), 'eating a pitha, you munch'); }
  else check(false, 'found the pitha plate');
  // chickens scatter with a flutter when you run at them
  await P.ev(() => { const d = __k.story.debug; d.S.inside = false; d.W.room.visible = false; });
  await clear(P);
  const hit = await P.ev(async () => { const hs = __k.houses.slice(0, 5); for (const h of hs) { const z = h.d / 2 + 3.2, x = h.x + z * Math.sin(h.rot), y = h.z + z * Math.cos(h.rot); __k.game.p.pos.set(x, 0, y); for (let i = 0; i < 30; i++) { await new Promise(r => setTimeout(r, 100)); if (window.__sfxLog.includes('flutter')) return true; } } return false; });
  check(hit, 'chickens flutter and squawk when they scatter');
  { const e = realErrors(P.logs); check(!e.length, 'village: no page errors' + (e.length ? ': ' + e.slice(0, 3).join(' | ') : '')); }
  await P.page.close(); }

// 2. archery and fishing
{ const P = await phone({ ch: 5, done: 1, painted: [1, 1, 1], chosen: 1, oiled: 1, garland: 1 });
  await P.ev(() => document.getElementById('startBtn').click()); await P.until(() => __k.game.mode === 'story');
  await P.ev(() => { const d = __k.story.debug; d.S.dlg = null; document.getElementById('dlg').hidden = true; const a = 0.35 + 0.698132 * 1.5; __k.game.p.pos.set(Math.cos(a) * 18.5, 0, Math.sin(a) * 18.5); d.S.near = null; });
  await near(P, 'SHOOT'); await act(P); await P.until(() => __k.story.debug.S.mode === 'aim');
  await clear(P); await dragShoot(P.page, 0, 0); check(await heard(P, 'creak') && await heard(P, 'twang'), 'the bowstring creaks as you draw and twangs on release');
  await clear(P); await dragShoot(P.page, 1.6, 0.9, 0.2); check(await heard(P, 'thud', 15000), 'a miss thuds into the dirt');
  await P.ev(() => document.getElementById('tapQuit').click()); await sleep(800);
  await P.ev(() => { const d = __k.story.debug; d.S.mode = 'walk'; d.S.focus = null; const a = 0.35 + 0.698132 * 4.5; __k.game.p.pos.set(Math.cos(a) * 20.7, 0, Math.sin(a) * 20.7); d.S.near = null; });
  if (await near(P, 'FISH')) { await act(P); await P.until(() => __k.story.debug.S.mode === 'fish'); await sleep(600);
    await clear(P); await P.ev(() => { __k.story.debug.S.tap = true; }); check(await heard(P, 'plop'), 'the float plops into the water');
    await P.until(() => __k.story.debug.fish.st === 'bite', 8000); await P.ev(() => { __k.story.debug.S.tap = true; }); check(await heard(P, 'splash'), 'a landed fish splashes'); }
  else check(false, 'reached the fishing stand');
  { const e = realErrors(P.logs); check(!e.length, 'archery/fishing: no page errors' + (e.length ? ': ' + e.slice(0, 3).join(' | ') : '')); }
  await P.page.close(); }

// 3. the ring: roll, the hide, steps, and slow motion muffling everything
{ const P = await phone();
  await P.ev(() => document.getElementById('quickBtn').click()); await P.until(() => __k.game.mode === 'play'); await sleep(800);
  await clear(P); await P.ev(() => { __k.hs.next = 999; __k.game.p.pos.set(4, 0, 4); __k.game.p.state = 'free'; __k.input.roll = true; }); check(await heard(P, 'roll'), 'a roll thuds and swishes');
  await sleep(700); await clear(P); await P.ev(() => { __k.game.p.state = 'free'; __k.game.p.teaseCd = 0; __k.input.tease = true; }); check(await heard(P, 'flap'), 'waving the hide flaps');
  await sleep(800); await clear(P); await P.page.keyboard.down('KeyW'); { const ran = await heard(P, 'step', 25000); await P.page.keyboard.up('KeyW'); check(ran, 'running in the ring makes footsteps'); }
  await clear(P); check(await heard(P, 'chatter', 30000) && await P.ev(() => __k.MUSIC_VOL.game === __k.BED.ring), 'the ring crowd talks, over a quiet music bed');
  await P.until(() => __k.game.p.state === 'free', 6000); await P.ev(() => { __k.game.slow = 0; }); await sleep(400); await clear(P); /* no slow motion left over from an earlier near miss */ await P.ev(() => { const g = __k.game; window.__lp = 99999; g.b.state = 'recover'; g.b.t = 0; g.b.pos.set(0, 0, -5); g.pithaReady = true; g.p.invuln = 0; g.p.pos.set(0.4, 0, 1.0); g.p.state = 'free'; __k.input.grab = true; /* the hide provoked him earlier: calm the scene first */ (function f() { if (__k.audio.lp) window.__lp = Math.min(window.__lp, __k.audio.lp.frequency.value); if (__k.game.mode === 'play') requestAnimationFrame(f); })(); });
  check(await heard(P, 'slowmo', 15000), 'slow motion starts with a whoomp');
  await sleep(600); check(await P.ev(() => window.__lp < 2500), `and muffles everything while it lasts (low-pass down to ${await P.ev(() => Math.round(window.__lp))} Hz)`);
  { const e = realErrors(P.logs); check(!e.length, 'ring: no page errors' + (e.length ? ': ' + e.slice(0, 3).join(' | ') : '')); }
  await P.page.close(); }
await finish(browser);
