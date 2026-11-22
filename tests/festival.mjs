// The five days of Sohrai: each day has its part, and the next opens on the next calendar day. Days are moved on here by
// back-dating the saved "finished on" date. Runs with ?debug&fest (plain ?debug keeps the festival off for older tests).
//   node tests/festival.mjs     (static server on 8791)
import puppeteer from 'puppeteer';
import fs from 'fs'; fs.mkdirSync('tests/out', { recursive: true });
import { check, finish, realErrors, SW } from './check.mjs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ protocolTimeout: 180000, args: [...SW, '--no-sandbox', '--mute-audio'] });
const page = await browser.newPage(), logs = []; page.on('pageerror', e => logs.push(e.message));
await page.emulate({ viewport: { width: 390, height: 780, deviceScaleFactor: 1, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-A346E) Mobile' });
await page.evaluateOnNewDocument(() => { localStorage.setItem('khuntau-name', 'Fest Test'); });
await page.goto('http://127.0.0.1:8791/?debug&fest&q=low', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => document.getElementById('startBtn').dataset.village === 'ready', { timeout: 90000 });
const ev = (f, ...a) => page.evaluate(f, ...a);
const until = (f, ms = 20000, ...a) => page.waitForFunction(f, { timeout: ms, polling: 50 }, ...a).then(() => true, () => false);
const obj = () => page.$eval('#objText', e => e.textContent);
const nearLabels = async (x, z, want) => { await ev((x, z) => { const d = __k.story.debug; d.S.dlg = null; document.getElementById('dlg').hidden = true; __k.game.p.pos.set(x, 0, z); }, x, z); /* slow runners draw a frame or two a second: wait for the button, do not sleep */
  if (want) await page.waitForFunction((w) => { const n = __k.story.debug.S.near; return !!n && n.label === w; }, { timeout: 20000, polling: 100 }, want).catch(() => {}); else await sleep(1500); return ev(() => { const n = __k.story.debug.S.near; return n ? n.label : ''; }); };
const tomorrow = () => ev(() => { const d = __k.story.debug; d.fest.on = '2000-1-1'; d.festDay(); d.S.objKey = ''; });
check(/Day 1 of 5: Um Hilok/.test(await page.$eval('#startBtn', e => e.textContent + ' ' + (document.getElementById('playSub') || {}).textContent)), 'home: a new player starts on Sohrai Day 1 of 5 (Um Hilok)');
await ev(() => document.getElementById('startBtn').click()); await until(() => __k.game.mode === 'story');
await ev(() => { const d = __k.story.debug; d.S.dlg = null; document.getElementById('dlg').hidden = true; });
check(await ev(() => __k.story.debug.GATED && __k.story.debug.fest.day === 1 && !__k.story.debug.festWaiting()), 'the festival is on: day 1, open');
// day 1 (Um Hilok): wake, paint, choose the animal and oil its horns. Oiling closes the day.
await ev(() => { const d = __k.story.debug; d.S.inside = false; d.W.room.visible = false; d.save.painted = [1, 1, 1]; d.setChapter(2); });
check(await ev(() => !__k.story.debug.festWaiting()), 'painting the wall does not end day 1: the cattle are still to be oiled');
const g = await ev(() => { const s = __k.story.debug.W.gStand; return [s.x, s.z]; });
check((await nearLabels(g[0], g[1], 'CHOOSE')) === 'CHOOSE', 'day 1: the cattle shed offers CHOOSE');
await ev(() => { const d = __k.story.debug; d.save.chosen = 1; d.save.oiled = 1; d.persist(); d.festCheck(); });
check(await ev(() => __k.story.debug.festWaiting() && __k.story.debug.fest.day === 1), 'day 1 ends when the horns are oiled');
check(await until(() => /Day 1 done/.test(document.getElementById('stageBanner').textContent) && document.getElementById('stageBanner').classList.contains('show'), 8000), 'a banner says Day 1 is done and Dakay Din opens tomorrow');
await page.screenshot({ path: 'tests/out/fest-1-done.jpg', type: 'jpeg', quality: 70 });
check(/Day 2 \(Dakay Din\) opens tomorrow/.test(await obj()), `the objective says so (${await obj()})`);
// free world: the garland (a day 3 thing) is offered today, but the Majhi or an elder scolds you first, then lets you
check((await nearLabels(g[0], g[1], 'GARLAND')) === 'GARLAND', 'nothing is locked: the garland is offered on day 1');
await ev(() => document.getElementById('actBtn').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
check(await until(() => !document.getElementById('dlg').hidden && /^(Majhi|Elder)$/.test(document.getElementById('dlgWho').textContent) && /Today is Um Hilok/.test(document.getElementById('dlgText').textContent) && /belongs to Khuntau, day 3/.test(document.getElementById('dlgText').textContent), 8000), `doing it on the wrong day gets you scolded (${await page.$eval('#dlgWho', e => e.textContent)}: ${await page.$eval('#dlgText', e => e.textContent)})`);
await page.screenshot({ path: 'tests/out/fest-scold.jpg', type: 'jpeg', quality: 70 });
check(await ev(() => __k.story.debug.save.garland !== 1), 'the garland waits until he has finished speaking');
for (let i = 0; i < 3 && !(await ev(() => document.getElementById('dlg').hidden)); i++) { await sleep(400); await ev(() => document.getElementById('dlg').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))); await page.keyboard.press('Enter'); }
check(await until(() => __k.story.debug.save.garland === 1, 8000), 'then you may do it anyway');
check(await ev(() => { let ran = 0; __k.story.debug.rebuke(3, 'the garland', () => { ran = 1; }); return ran === 1 && document.getElementById('dlg').hidden; }), 'the same thing is not scolded twice in a day');
check(await ev(() => { const d = __k.story.debug; return d.fest.day === 1 && d.festWaiting() && d.fest.reb === 1; }), 'and it does not move the festival on: still day 1');
check(['RING'].includes(await nearLabels(0, 6, 'RING')), 'the khunt is still open for a scored round while you wait');
// day 2 (Dakay Din): the alpana before the door
await sleep(6000); await ev(() => { const d = __k.story.debug; d.S.dlg = null; d.S.focus = null; document.getElementById('dlg').hidden = true; }); /* let the garland's shot and the Majhi's words finish */
await tomorrow(); await sleep(400);
check(await ev(() => __k.story.debug.fest.day === 2 && !__k.story.debug.festWaiting()) && /Dakay Din: draw the alpana/.test(await obj()), `the next calendar day opens Day 2 (${await obj()})`);
await page.waitForFunction(() => document.getElementById('objText').textContent.includes('alpana'));
check(await ev(async () => { const d = __k.story.debug; /* walk to the objective marker */ const m = d.W.marker.position; __k.game.p.pos.set(m.x, 0, m.z); await new Promise(r => setTimeout(r, 600)); return [d.S.near && d.S.near.label, d.S.mode, !!d.S.dlg, d.save.ch].join(' '); }).then(v => (console.log('   near/mode/dlg/ch:', v), v.startsWith('DRAW'))), 'at your door the button says DRAW');
await ev(() => document.getElementById('actBtn').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
check(await until(() => __k.story.debug.save.alpana === 1 && __k.story.debug.W.alpana && __k.story.debug.W.alpana.visible && __k.story.debug.W.alpana.material.opacity > 0.9, 10000), 'the alpana is drawn on the ground in white and stays');
await sleep(600); await page.screenshot({ path: 'tests/out/fest-2-alpana.jpg', type: 'jpeg', quality: 70 });
check(await ev(() => __k.story.debug.festWaiting() && __k.story.debug.fest.day === 2), 'day 2 ends with the alpana');
// day 3 (Khuntau): garland, tamak, the bull
await tomorrow();
check(await ev(() => { let ran = 0; __k.story.debug.rebuke(3, 'the Khuntau drumming', () => { ran = 1; }); return ran === 1 && document.getElementById('dlg').hidden; }), 'Day 3: Khuntau things are not scolded on Khuntau day');
await ev(() => { const d = __k.story.debug; d.setChapter(3); });
const dr = await ev(() => { const s = __k.story.debug.W.drumStand; return [s.x, s.z]; });
await nearLabels(dr[0], dr[1], 'BEAT'); check(await ev(() => { const n = __k.story.debug.S.near; return !!n && n.label === 'BEAT' && !/freely/i.test(n.text); }), 'Day 3: the tamak plays the story chart');
await ev(() => { const d = __k.story.debug; d.setChapter(4); });
check((await nearLabels(0, 6, 'START')) === 'START', 'Day 3: the khunt offers the Khuntau finale');
await ev(() => { const d = __k.story.debug; d.save.done = 1; d.setChapter(5); });
check(await ev(() => __k.story.debug.festWaiting() && __k.story.debug.fest.day === 3), 'day 3 ends with the Khuntau won');
await tomorrow(); await sleep(400);
check(/Day 4, Jale/.test(await obj()), `Day 4 sends you to the Sarpa enej (${await obj()})`);
await ev(() => { const d = __k.story.debug, t = d.today(); t.jv = [1, 1, 1]; t.jale = 1; d.persist(); d.festCheck(); });
check(await ev(() => __k.story.debug.festWaiting() && __k.story.debug.fest.day === 4), 'day 4 ends when all three houses are sung');
await tomorrow(); await sleep(400);
check(/Day 5, Hako Katkom/.test(await obj()), `Day 5 sends you fishing (${await obj()})`);
const xp0 = await ev(() => __k.meta.xp);
await ev(() => { const d = __k.story.debug, t = d.today(); t.fish = 1; d.persist(); d.festCheck(); });
check(await ev(() => __k.story.debug.fest.fin === 1), 'day 5 done: the festival is complete');
check(await until(() => /Sohrai complete/.test(document.getElementById('stageBanner').textContent), 8000) && await until((x) => __k.meta.xp >= x + 100, 8000, xp0), 'a banner and +100 XP for living all five days');
await page.screenshot({ path: 'tests/out/fest-5-complete.jpg', type: 'jpeg', quality: 70 });
await sleep(300); check(/Today:|All done today/.test(await obj()), `afterwards the daily round is back (${await obj()})`);
// it is remembered
check(await ev(() => { const s = JSON.parse(localStorage.getItem('khuntau-story')); return s.fest && s.fest.fin === 1 && s.fest.day === 5; }), 'the festival progress is saved on the phone');
check(!realErrors(logs).length, 'no page errors ' + realErrors(logs).join(' | ')); await finish(browser);
