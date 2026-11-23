// The shared village: two friends in a room walk the village together. Each sees the other (position, name tag, indoors
// hidden), hears the other's drum, and the host starts the khunt round for both from the village.
// Needs: npx wrangler dev --local --port 8787 --ip 127.0.0.1    then: node tests/shared.mjs
import puppeteer from 'puppeteer';
import fs from 'fs'; fs.mkdirSync('tests/out', { recursive: true });
import { check, finish, realErrors, SW } from './check.mjs';
const BASE = process.argv[2] || 'http://127.0.0.1:8787';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ protocolTimeout: 180000, args: [...SW, '--no-sandbox', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
async function phone(tag, name) {
  const ctx = await browser.createBrowserContext(), page = await ctx.newPage(), logs = [];
  page.on('pageerror', e => logs.push(e.message));
  await page.emulate({ viewport: { width: 390, height: 780, deviceScaleFactor: 1, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-A346E) Mobile' });
  await page.evaluateOnNewDocument((n) => { localStorage.setItem('khuntau-name', n); localStorage.setItem('khuntau-tutorial', '1'); localStorage.setItem('khuntau-story', JSON.stringify({ ch: 5, done: 1, painted: [1, 1, 1], chosen: 1, oiled: 1, garland: 1 })); }, name);
  await page.goto(BASE + '/?debug&q=low', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !document.getElementById('createBtn').disabled && document.getElementById('startBtn').dataset.village === 'ready', { timeout: 120000 });
  const until = (f, ms = 20000, ...a) => page.waitForFunction(f, { timeout: ms, polling: 100 }, ...a).then(() => true, () => false);
  return { page, logs, until, shot: n => page.screenshot({ path: `tests/out/shared-${tag}-${n}.jpg`, type: 'jpeg', quality: 70 }), ev: (f, ...a) => page.evaluate(f, ...a), click: id => page.evaluate(id => document.getElementById(id).click(), id) };
}
const A = await phone('host', 'Asha'), B = await phone('guest', 'Biru');
await A.click('friendsBtn'); await sleep(300); await A.ev(() => { document.getElementById('nameIn').value = 'Asha'; }); await A.click('createBtn');
await A.until(() => !document.getElementById('lobbyScreen').hidden);
const code = await A.ev(() => document.getElementById('roomCode').textContent.trim());
await B.ev(() => { document.getElementById('nameIn').value = 'Biru'; });
await B.until(() => [...document.querySelectorAll('#roomList li')].some(li => /Asha's room/.test(li.textContent)), 30000);
await B.ev(() => [...document.querySelectorAll('#roomList li')].find(li => /Asha's room/.test(li.textContent)).querySelector('button').click());
await A.until(() => !document.getElementById('knockBar').hidden, 15000); await A.click('knockYes');
check(await B.until(() => !document.getElementById('lobbyScreen').hidden && __k.net.roster && __k.net.roster.length === 2, 30000), `two friends are in room ${code}`);
check(await A.ev(() => !document.getElementById('walkBtn').hidden), 'the lobby offers "Walk in the village together"');
// both walk into the village
await A.click('walkBtn'); await B.click('walkBtn');
{ const a = await A.until(() => __k.game.mode === 'story' && __k.net.village), b = await B.until(() => __k.game.mode === 'story' && __k.net.village); const st = P => P.ev(() => [__k.game.mode, __k.net.village, !!__k.story, !!__k.net.ws, __k.game.online].join('/'));
  check(a && b, `both are in the village, still connected to the room (${await st(A)} | ${await st(B)})`); }
for (const P of [A, B]) await P.ev(() => { const d = __k.story.debug; d.S.dlg = null; document.getElementById('dlg').hidden = true; d.S.inside = false; d.W.room.visible = false; });
// B walks to a spot; A sees B there
await A.ev(() => { __k.game.p.pos.set(2, 0, 16); __k.story.debug.snapCam(); }); await B.ev(() => { __k.game.p.pos.set(-3, 0, 20); });
const seenAt = await A.until(() => { const r = [...__k.net.remotes.values()][0]; return r && r.a.wrap.visible && Math.hypot(r.a.wrap.position.x + 3, r.a.wrap.position.z - 20) < 0.6; });
check(await A.ev(() => document.getElementById('villageScreen') ? document.getElementById('villageScreen').hidden : [...document.querySelectorAll('.overlay')].every(o => o.hidden)), 'no menu is left open over the village');
check(seenAt, 'the host sees the friend standing where the friend is (beyond the ring, in the village)');
check(await A.ev(() => { const r = [...__k.net.remotes.values()][0]; return !!r.tag && r.tag.visible !== false && r.name === 'Biru'; }), 'with the name over their head');
await A.ev(() => { const r = [...__k.net.remotes.values()][0], p = r.a.wrap.position, d = __k.story.debug; __k.game.p.pos.set(p.x + 2.2, 0, p.z + 2.2); d.S.camYaw = Math.atan2(2.2, 2.2); d.snapCam(); }); await sleep(1200); await A.shot('1-friend');
// B moves: A sees them walk
await B.ev(() => { __k.game.p.pos.set(6, 0, 22); });
check(await A.until(() => { const r = [...__k.net.remotes.values()][0]; return Math.hypot(r.a.wrap.position.x - 6, r.a.wrap.position.z - 22) < 0.6; }), 'when the friend moves, you see it');
// B goes indoors: hidden for A
await B.ev(() => { __k.story.debug.S.inside = true; });
check(await A.until(() => { const r = [...__k.net.remotes.values()][0]; return !r.a.wrap.visible; }), 'a friend who goes into the house is not drawn outside');
await B.ev(() => { __k.story.debug.S.inside = false; }); await A.until(() => [...__k.net.remotes.values()][0].a.wrap.visible);
// B drums: A hears it
await A.ev(() => { window.__sfxLog.length = 0; window.__e0 = __k.story.energy(); const d = __k.story.debug; __k.game.p.pos.copy(d.W.drumStand); });
await B.ev(() => { const d = __k.story.debug; __k.game.p.pos.copy(d.W.drumStand); document.getElementById('actBtn').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); });
await B.until(() => __k.story.debug.S.mode === 'drum', 15000);
await B.ev(async () => { for (let i = 0; i < 6; i++) { __k.story.debug.strike(i % 2 ? 'T' : 'U'); await new Promise(r => setTimeout(r, 200)); } });
check(await A.until(() => (__k.story.debug.dance.peer || 0) >= 3, 10000), "the friend's drumming reaches you (the dancers pick it up)");
// the host starts the khunt round from the village: both land in the ring
await B.ev(() => { document.getElementById('padDone') && document.getElementById('padDone').click(); });
await A.ev(() => { __k.game.p.pos.set(0, 0, 6); }); await A.until(() => { const n = __k.story.debug.S.near; return n && n.label === 'RING'; }, 15000);
await A.ev(() => document.getElementById('actBtn').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
const both = await Promise.all([A, B].map(P => P.until(() => __k.game.mode === 'play' && __k.game.online, 20000)));
check(both[0] && both[1], 'the host starts the khunt round from the village and both friends are in the ring');
check(await B.ev(() => !document.documentElement.classList.contains('story-on') && !__k.net.village), 'the village screen is put away for the round');
await B.shot('2-ring');
for (const P of [A, B]) { const e = realErrors(P.logs); check(!e.length, 'no page errors ' + e.join(' | ')); }
await finish(browser);
