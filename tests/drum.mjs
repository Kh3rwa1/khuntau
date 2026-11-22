// Drum timing, judged by the clock rather than by feel: taps are fired from inside the page at exact offsets
// from each note (passing the tap time like a real touch event would), on a phone profile.
// Checks: late-but-inside-window taps count (the miss check used to ignore the touch offset), taps outside the
// window miss, and the drum learns a phone's steady lateness so the next chart judges those taps Perfect.
import puppeteer from 'puppeteer';
import { check, finish, realErrors, SW } from './check.mjs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ protocolTimeout: 180000, args: [...SW, '--no-sandbox', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage(), logs = []; page.on('pageerror', e => logs.push(e.message));
await page.emulate({ viewport: { width: 390, height: 780, deviceScaleFactor: 1, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-A346E) Mobile' });
await page.evaluateOnNewDocument(() => { localStorage.setItem('khuntau-story', JSON.stringify({ ch: 5, done: 1, painted: [1, 1, 1], chosen: 1, oiled: 1, garland: 1 })); localStorage.removeItem('khuntau-drumlag'); });
// pretend the phone's speaker lags 120 ms, and record every sound the game books on the audio clock
await page.evaluateOnNewDocument(() => {
  Object.defineProperty(AudioContext.prototype, 'outputLatency', { get: () => 0.12, configurable: true });
  Object.defineProperty(AudioContext.prototype, 'baseLatency', { get: () => 0, configurable: true });
  window.__srcs = [];
  const st = AudioBufferSourceNode.prototype.start, sp = AudioBufferSourceNode.prototype.stop;
  AudioBufferSourceNode.prototype.start = function (when = 0, ...r) { this.__e = { when, ct: this.context.currentTime, pn: performance.now() / 1000 }; window.__srcs.push(this.__e); return st.call(this, when, ...r); };
  AudioBufferSourceNode.prototype.stop = function (when = 0) { if (this.__e) this.__e.len = when - this.__e.when; return sp.call(this, when); };
});
await page.goto('http://127.0.0.1:8791/?debug&q=low', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => document.getElementById('startBtn').dataset.village === 'ready', { timeout: 90000 });
await page.evaluate(() => document.getElementById('startBtn').click()); await sleep(2500);
await page.evaluate(() => { const d = __k.story.debug; d.S.dlg = null; document.getElementById('dlg').hidden = true; });
// play one chart: delta(i) = seconds after (note time + touch lag) that the finger lands
async function chart(deltaSrc) {
  await page.evaluate(() => { const d = __k.story.debug; d.today().drum = 0; d.S.mode = 'walk'; __k.game.p.pos.copy(d.W.drumStand); });
  await page.waitForFunction(() => { const n = __k.story.debug.S.near; return n && n.label === 'BEAT'; }, { timeout: 20000 });
  await page.evaluate(() => document.getElementById('actBtn').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
  await page.waitForFunction(() => __k.story.debug.S.mode === 'drum' && __k.story.debug.drum.notes.length > 0, { timeout: 10000 });
  return page.evaluate((src) => new Promise(done => {
    const d = __k.story.debug, delta = eval(src), lag = 0.045, res = [];
    const judged = [];
    for (const id of ['judgeT', 'judgeU']) new MutationObserver(() => judged.push(document.getElementById(id).textContent)).observe(document.getElementById(id), { childList: true, characterData: true, subtree: true });
    d.drum.notes.forEach((n, i) => { if (delta(i) === null) return; const at = n.time + lag + d.calib() * 0 + delta(i); setTimeout(() => { d.strike(n.lane, at); res.push(n.state); }, (at - performance.now() / 1000) * 1000); });
    const iv = setInterval(() => { if (d.drum.done) { clearInterval(iv); setTimeout(() => done({ states: d.drum.notes.map(n => n.state), hits: d.drum.hits, n: d.drum.notes.length || res.length, calib: d.calib(), judged, sched: d.drum.sched }), 100); } }, 50);
  }), deltaSrc);
}
await page.evaluate(() => { window.__drumCine = 0; (function f() { if (__k.story.debug.arch.cine) window.__drumCine++; requestAnimationFrame(f); })(); });
await page.evaluate(() => { window.__srcs.length = 0; window.__dust = 0; (function f() { window.__dust = Math.max(window.__dust, __k.dustPool.live); requestAnimationFrame(f); })(); });
// 1. on time (relative to the touch lag): all hit, no learning drift
let r = await chart('(i) => 0');
// the beat clicks (0.03 s noise bursts) must be booked so they are HEARD on the beat: audio time = beat time - 120 ms speaker lag
{ const cl = await page.evaluate(() => { const t0 = __k.story.debug.drum.t0; return { t0, s: window.__srcs.filter(e => Math.abs((e.len ?? 0) - 0.05) < 0.002) }; });
  const errs = cl.s.map(e => { const heard = e.pn + (e.when - e.ct) + 0.12; const k = Math.round((heard - cl.t0) / 0.62); return Math.abs(heard - (cl.t0 + k * 0.62)); });
  check(cl.s.length >= 20, `count-in and beat clicks were scheduled on the audio clock (${cl.s.length})`);
  check(errs.length && Math.max(...errs) < 0.012, `every click is heard on its beat with a 120 ms speaker lag taken off (worst ${(Math.max(...errs) * 1000).toFixed(1)} ms)`);
  check(cl.s.every(e => e.when > e.ct + 0.01), 'clicks are booked ahead, never played late from the frame loop'); }
check(r.hits === r.n, `on-time taps all count (${r.hits}/${r.n})`);
check(await page.evaluate(() => window.__drumCine > 0), 'a won chart gets a tracking shot along the dancers');
check(await page.evaluate(() => window.__dust > 0), 'the dancers kick up dust when their feet land on the beat');
check(await page.evaluate(() => { const a = __k.story.debug.W.akhraProps; return !!a && ['bench', 'cot', 'tree'].every(k => __k.villageProps.some(o => Math.hypot(o.x - a[k].x, o.z - a[k].z) < 0.7)); }), 'the akhra bench, cot and tree are solid (in the collision list)');
check(Math.abs(r.calib) < 0.01, `on-time play leaves the timing alone (calib ${r.calib.toFixed(3)})`);
check(r.sched === 17, 'every beat click was booked on the audio clock');
await sleep(2200);
// 2. late but inside the window (+0.20 s): used to be marked Miss before the tap could land
r = await chart('(i) => 0.20');
check(r.hits === r.n, `taps 0.20 s late still count (${r.hits}/${r.n})`);
const learned = r.calib;
check(learned > 0.1 && learned <= 0.15, `steady lateness is learned (calib ${learned.toFixed(3)})`);
check(+(await page.evaluate(() => localStorage.getItem('khuntau-drumlag'))) === +learned.toFixed(3), 'learned timing is saved on the phone');
await sleep(2200);
// 3. after learning, the same late player is judged Perfect
r = await chart(`(i) => ${learned} + 0.0`);
check(r.hits === r.n && r.judged.filter(j => j === 'Perfect').length >= r.n * 0.8, `after learning, the same late taps are Perfect (${r.judged.filter(j => j === 'Perfect').length}/${r.n})`);
await sleep(2200);
// 4. one tap 0.4 s late for the first note: that note is a Miss (a later note may still catch it, which is fair)
r = await chart(`(i) => i === 0 ? ${learned} + 0.4 : null`);
check(r.states[0] === 2, 'a tap 0.4 s late does not count for the note it was meant for')
// 5. the real input path: pointerdown on the pads (no tap time passed in; evTime() reads the event)
await sleep(2200);
await page.evaluate(() => { const d = __k.story.debug; d.today().drum = 0; d.S.mode = 'walk'; __k.game.p.pos.copy(d.W.drumStand); });
await page.waitForFunction(() => { const n = __k.story.debug.S.near; return n && n.label === 'BEAT'; }, { timeout: 20000 });
await page.evaluate(() => document.getElementById('actBtn').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
await page.waitForFunction(() => __k.story.debug.S.mode === 'drum' && __k.story.debug.drum.notes.length > 0, { timeout: 10000 });
r = await page.evaluate(() => new Promise(done => {
  const d = __k.story.debug, lag = 0.045 + d.calib();
  d.drum.notes.forEach(n => setTimeout(() => document.getElementById(n.lane === 'T' ? 'padT' : 'padU').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'touch' })), (n.time + lag - performance.now() / 1000) * 1000));
  const iv = setInterval(() => { if (d.drum.done) { clearInterval(iv); done({ hits: d.drum.hits, n: d.drum.notes.length }); } }, 50);
}));
check(r.hits >= r.n * 0.9, `real pad taps (pointerdown -> evTime -> strike) register (${r.hits}/${r.n})`);
{ const e = realErrors(logs); check(!e.length, 'no page errors' + (e.length ? ': ' + e.slice(0, 4).join(' | ') : '')); }
await finish(browser);
