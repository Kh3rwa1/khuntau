// Small things to find in the village and the journal that lists them (pause menu). Walk close and each is noted once.
//   node tests/finds.mjs     (static server on 8791)
import puppeteer from 'puppeteer';
import fs from 'fs'; fs.mkdirSync('tests/out', { recursive: true });
import { check, finish, realErrors, SW } from './check.mjs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ protocolTimeout: 180000, args: [...SW, '--no-sandbox', '--mute-audio'] });
const page = await browser.newPage(), logs = []; page.on('pageerror', e => logs.push(e.message));
await page.emulate({ viewport: { width: 390, height: 780, deviceScaleFactor: 1, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-A346E) Mobile' });
await page.evaluateOnNewDocument(() => { localStorage.setItem('khuntau-seen-tips', '1'); localStorage.setItem('khuntau-story', JSON.stringify({ ch: 3, painted: [1, 1, 1], chosen: 1, oiled: 1, garland: 1 })); });
await page.goto('http://127.0.0.1:8791/?debug&q=mid', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => document.getElementById('startBtn').dataset.village === 'ready', { timeout: 90000 });
const ev = (f, ...a) => page.evaluate(f, ...a);
const until = (f, ms = 30000, ...a) => page.waitForFunction(f, { timeout: ms, polling: 50 }, ...a).then(() => true, () => false);
await ev(() => document.getElementById('startBtn').click()); await until(() => __k.game.mode === 'story'); await sleep(2500);
await ev(() => { const d = __k.story.debug; d.S.dlg = null; document.getElementById('dlg').hidden = true; });
const list = await ev(() => __k.story.debug.SIGHTS.map(s => s[0]));
check(list.length === 10, `ten things to find (${list.join(', ')})`);
check(await ev(() => { const W = __k.story.debug.W; return ['nest', 'kite', 'tortoise', 'cat', 'toy', 'hive'].every(k => W.finds && W.finds[k] && Math.hypot(W.finds[k].x, W.finds[k].z) < 31); }), 'the six new ones stand inside the village you can walk');
check(await ev(() => Object.keys(__k.story.debug.save.seen || {}).length === 0), 'nothing is seen before you have walked');
const xp0 = await ev(() => __k.meta ? __k.meta.xp : 0);
// walk up to each static find
for (const id of ['tortoise', 'cat', 'toy', 'kite', 'hive', 'nest']) {
  await ev((id) => { const d = __k.story.debug, q = d.W.finds[id]; d.S.mode = 'walk'; __k.game.p.pos.set(q.x + 0.9, 0, q.z + 0.6); d.S.camYaw = Math.atan2(-0.9, -0.6); d.snapCam(); }, id);
  const ok = await until((id) => (__k.story.debug.save.seen || {})[id] === 1, 8000, id);
  if (id === 'tortoise' || id === 'cat' || id === 'toy') { await sleep(500); await page.screenshot({ path: `tests/out/find-${id}.jpg`, type: 'jpeg', quality: 78 }); }
  check(ok, `walking up to it notes the ${id}`);
}
// the ones that were already living here
await ev(() => { const st = __k.story.debug, d = st.sightAt('dogs')[0]; __k.game.p.pos.set(d.x + 1, 0, d.z + 0.5); });
check(await until(() => (__k.story.debug.save.seen || {}).dogs === 1, 8000), 'the sleeping dogs count');
await ev(() => { const c = __k.market.couple; __k.game.p.pos.set(c.x - c.out[0] * 9, 0, c.z - c.out[1] * 9); }); await sleep(900);
check(await ev(() => !(__k.story.debug.save.seen || {}).couple), 'hearing the couple from a distance is not finding them');
await ev(() => { const c = __k.market.couple; __k.game.p.pos.set(c.x - c.out[0] * 3, 0, c.z - c.out[1] * 3); });
check(await until(() => (__k.story.debug.save.seen || {}).couple === 1, 12000), 'catching the couple is');
await ev(() => { const s = __k.market.spot; __k.game.p.pos.set(s[0] + 2, 0, s[1] + 2); });
check(await until(() => (__k.story.debug.save.seen || {}).stall === 1, 8000), 'the pork stall counts');
await ev(() => { window.__follow = setInterval(() => { const p = __k.market.carrier && __k.market.carrier.a.wrap.position; if (p) __k.game.p.pos.set(p.x + 1.2, 0, p.z + 0.8); }, 100); });
const all = await until(() => Object.keys(__k.story.debug.save.seen || {}).length === 10, 15000); await ev(() => clearInterval(window.__follow));
check(all, 'the water carrier is the tenth');
check(await ev((x) => !__k.meta || __k.meta.xp >= x + 50, xp0), 'each find pays, and all ten pay a little more');
// nothing is noted twice, and it survives a save
check(await ev(() => JSON.parse(localStorage.getItem('khuntau-story')).seen && Object.keys(JSON.parse(localStorage.getItem('khuntau-story')).seen).length === 10), 'the journal is saved with your progress');
// the journal in the pause menu
await ev(() => { __k.game.p.pos.set(0, 0, 14); }); await sleep(300); await page.keyboard.press('Escape');
await until(() => !document.getElementById('pauseScreen').hidden, 5000);
check(await ev(() => !document.getElementById('seenBtn').hidden && /10\/10/.test(document.getElementById('seenBtn').textContent) && document.getElementById('seenList').hidden), 'the pause menu shows how many you have seen');
await ev(() => document.getElementById('seenBtn').click());
check(await ev(() => !document.getElementById('seenList').hidden && document.querySelectorAll('#seenList li').length === 10), 'and lists them');
await page.screenshot({ path: 'tests/out/find-journal.jpg', type: 'jpeg', quality: 78 });
// with some still unfound, the list gives clues, not names
await ev(() => { const d = __k.story.debug; delete d.save.seen.nest; delete d.save.seen.cat; d.seenUi(); });
check(await ev(() => [...document.querySelectorAll('#seenList li.no')].length === 2 && [...document.querySelectorAll('#seenList li.no')].every(li => li.textContent.startsWith('?') && !/nest|cat/i.test(li.textContent))), 'unfound ones show a clue, not their name');
check(realErrors(logs).length === 0, 'no page errors ' + realErrors(logs).join(' | ').slice(0, 300));
await finish(browser);
