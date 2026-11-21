// Two real phones (two isolated browser contexts) through the real Worker:
// host creates a room, guest finds it in "Playing now", asks to join, host accepts, host starts, both play.
// Needs: npx wrangler dev --local --port 8787 --ip 127.0.0.1    then: node tests/online-ui.mjs
import puppeteer from 'puppeteer';
import fs from 'fs'; fs.mkdirSync('tests/out', { recursive: true });
import { check, finish, realErrors } from './check.mjs';
const BASE = process.argv[2] || 'http://127.0.0.1:8787';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ protocolTimeout: 180000, args: ['--no-sandbox', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
async function phone(tag, name) {
  const ctx = await browser.createBrowserContext(), page = await ctx.newPage(), logs = [];
  page.on('pageerror', e => logs.push(e.message)); page.on('console', m => { if (m.type() === 'error') logs.push(m.text()); });
  await page.emulate({ viewport: { width: 390, height: 780, deviceScaleFactor: 1, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-A346E) Mobile' });
  await page.evaluateOnNewDocument((n) => { localStorage.setItem('khuntau-name', n); localStorage.setItem('khuntau-tutorial', '1'); }, name);
  await page.goto(BASE + '/?debug&q=low', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !document.getElementById('createBtn').disabled, { timeout: 90000 });
  const shot = n => page.screenshot({ path: `tests/out/net-${tag}-${n}.jpg`, type: 'jpeg', quality: 70 });
  return { page, logs, shot, ev: (f, ...a) => page.evaluate(f, ...a), click: id => page.evaluate(id => document.getElementById(id).click(), id) };
}
const A = await phone('host', 'Asha'), B = await phone('guest', 'Biru');
await A.click('friendsBtn'); await sleep(300);
await A.ev(() => { document.getElementById('nameIn').value = 'Asha'; }); await A.click('createBtn');
await A.page.waitForFunction(() => !document.getElementById('lobbyScreen').hidden, { timeout: 15000 }).catch(() => {});
const code = await A.ev(() => document.getElementById('roomCode').textContent.trim());
check(/^[A-Z0-9]{4}$/.test(code), `host made room ${code} and sees the lobby`); await A.shot('1-lobby');
// guest: the room shows up on the home screen
await B.ev(() => { document.getElementById('nameIn').value = 'Biru'; });
const seen = await B.page.waitForFunction(() => [...document.querySelectorAll('#roomList li')].some(li => /Asha's room/.test(li.textContent)), { timeout: 20000 }).then(() => true, () => false);
check(seen, 'guest sees "Asha\'s room" in Playing now'); await B.shot('1-list');
await B.ev(() => [...document.querySelectorAll('#roomList li')].find(li => /Asha's room/.test(li.textContent)).querySelector('button').click());
const asked = await A.page.waitForFunction(() => !document.getElementById('knockBar').hidden && /Biru wants to join/.test(document.getElementById('knockText').textContent), { timeout: 10000 }).then(() => true, () => false);
check(asked, 'host sees "Biru wants to join"'); await A.shot('2-knock');
await A.click('knockYes');
const inB = await B.page.waitForFunction((c) => !document.getElementById('lobbyScreen').hidden && document.getElementById('roomCode').textContent.trim() === c, { timeout: 15000 }, code).then(() => true, () => false);
check(inB, 'accepted guest lands in the same lobby');
await A.page.waitForFunction(() => __k.net.roster && __k.net.roster.length === 2, { timeout: 8000 }).catch(() => {});
check(await A.ev(() => __k.net.roster && __k.net.roster.length) === 2, 'host lobby lists 2 players'); await B.shot('2-lobby');
check(await B.ev(() => document.getElementById('hostStartBtn').hidden), 'guest has no start button');
await A.click('hostStartBtn');
const both = await Promise.all([A, B].map(P => P.page.waitForFunction(() => __k.game.mode === 'play', { timeout: 15000 }).then(() => true, () => false)));
check(both.every(Boolean), 'host starts: both phones are in the ring');
await sleep(2500); await A.shot('3-play'); await B.shot('3-play');
// the guest sees the host's character, positioned from the network
const remote = await B.ev(() => { const n = __k.net; return n && n.others ? Object.keys(n.others).length : (n && n.remotes ? n.remotes.size : -1); });
check(remote >= 1, `guest's game shows the other player (${remote})`);
for (const P of [A, B]) { const e = realErrors(P.logs); check(!e.length, 'no page errors' + (e.length ? ': ' + e.slice(0, 4).join(' | ') : '')); }
await finish(browser);
