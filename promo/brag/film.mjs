// Films the real game for the /brag promo, frame by frame on a virtual clock: every frame is exactly 1/30 s of game
// time however long the software renderer takes to draw it. Phone shape (1080x1920), full quality, the game's own
// files from tests/serve.mjs (port 8791).
//   node promo/brag/film.mjs probe            one frame of each shot, timed
//   node promo/brag/film.mjs shot S1 [S2 ...] render those shots to brag-output/work/frames/<id>/0001.jpg ...
// The shots are set up through the game's debug hooks (?debug: window.__k); nothing in the game is changed.
import puppeteer from 'puppeteer';
import fs from 'fs';
import { SHOTS } from './shots.mjs';

// a phone-sized screen (540x960 CSS px at 2x = a 1080x1920 picture): the game's buttons come out at their real size
const [VW, VH, DPR] = (process.env.VIEW || '540x960@2').split(/[x@]/).map(Number), OUT = 'brag-output/work/frames';
const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function open() {
  const browser = await puppeteer.launch({ protocolTimeout: 1200000, args: ['--no-sandbox', '--mute-audio', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage(); page.logs = [];
  page.on('pageerror', e => page.logs.push('PAGEERROR ' + e.message));
  await page.emulate({ viewport: { width: VW, height: VH, deviceScaleFactor: DPR, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-A346E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36' });
  await page.evaluateOnNewDocument(() => {
    // a returning player who has lived the whole festival: no lessons, no dialogue, English, the brown bull
    try {
      localStorage.setItem('khuntau-seen-tips', '1'); localStorage.setItem('khuntau-lang', 'en'); localStorage.setItem('khuntau-coach', '1');
      localStorage.setItem('khuntau-story', JSON.stringify({ ch: 5, w: 1, kh: 1, painted: [1, 1, 1], chosen: 1, oiled: 1, garland: 1, alpana: 1 }));
      localStorage.setItem('khuntau-name', 'Player');
    } catch (e) {}
    // virtual clock: performance.now and requestAnimationFrame belong to us once __virt() is called
    let vt = 0, virtual = false; const realNow = performance.now.bind(performance), realRAF = window.requestAnimationFrame.bind(window); let cbs = [];
    performance.now = () => (virtual ? vt : realNow());
    window.requestAnimationFrame = f => { if (virtual) { cbs.push(f); return cbs.length; } return realRAF(f); };
    window.__virt = () => { vt = realNow(); virtual = true; };
    window.__step = ms => { vt += ms; const run = cbs; cbs = []; for (const f of run) { try { f(vt); } catch (e) { console.error(e); } } };
  });
  await page.goto('http://127.0.0.1:8791/?debug&q=high', { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window.__k && document.getElementById('startBtn').dataset.village === 'ready', { timeout: 300000 });
  await page.waitForFunction(() => __k.murals, { timeout: 120000 }).catch(() => {});
  await page.evaluate(async () => { try { await document.fonts.ready; await Promise.all([document.fonts.load('100px "Rubik Dirt"'), document.fonts.load('800 40px "Baloo 2"')]); } catch (e) {} });
  // what the camera keeps of the phone screen: film-clean nothing, film-ring the round's buttons, lamps and score,
  // film-pads the drum pads. The game's own messages never: the video has its own words.
  const hud = '.hud, #controls, #pauseBtn, #muteBtn, #fsBtn, #micBtn, #talkHud, #hudStory, #hudScore, #pads, #tapzone, #reticle, #joyGhost, #leaveBtn';
  const sel = (cls, list) => list.split(', ').map(x => `html.${cls} ${x}`).join(', ');
  await page.addStyleTag({ content: `
    #toast, #hint, #pop, #stageBanner, #prompt, #tapHint, #dayCard, #dlg, #talkToast, #talkBubble, #rivalChip, #fpsMeter, .judge, #stamp, .stamp, #albStamp { display: none !important; }
    ${sel('film-clean', hud)} { display: none !important; }
    ${sel('film-ring', '#pauseBtn, #muteBtn, #fsBtn, #micBtn, #talkHud, #hudStory, #joyGhost, #leaveBtn, #pads')} { display: none !important; }
    ${sel('film-pads', '#controls, #pauseBtn, #muteBtn, #fsBtn, #micBtn, #talkHud, #hudStory, #hudScore, #joyGhost, #tapzone, #reticle')} { display: none !important; } /* display, not visibility: a child with visibility: visible (the objective arrow) shows through a hidden parent */
    html.film-nobars div[style*="background:#000"], html.film-nobars div[style*="background: rgb(0, 0, 0)"] { display: none !important; } /* the cinematic letterbox bars (Chrome rewrites #000 as rgb) */
    #padDone { visibility: hidden !important; }` });
  // a shot may set window.__cam(camera, t) to place the camera itself; it runs just before the game draws
  await page.evaluate(() => {
    const k = __k, R = k.renderer, orig = R.render.bind(R); window.__ft = 0;
    R.render = (s, c) => { if (c === k.camera && window.__cam) { window.__cam(c, window.__ft); c.updateMatrixWorld(); c.updateProjectionMatrix(); } return orig(s, c); };
    __virt();
  });
  await sleep(300);
  return { browser, page };
}

// one frame: advance the game 1/30 s, then photograph the page (the 3D view and whatever UI the shot keeps)
async function frame(page, n, file) {
  await page.evaluate(n => { window.__ft = n / 30; __step(1000 / 30); }, n);
  if (file) await page.screenshot({ path: file, type: 'jpeg', quality: 92 });
}

async function run(page, shot, { probe = false } = {}) {
  await page.evaluate(() => { window.__cam = null; document.documentElement.classList.add('film-clean', 'film-nobars'); });
  const ctx = { page, step: n => frame(page, n), ev: (f, ...a) => page.evaluate(f, ...a) };
  await shot.setup(ctx);
  const dir = `${OUT}/${shot.id}`; fs.mkdirSync(dir, { recursive: true });
  // PICK=0,30,60 films the shot only as far as the last of those frames and saves just those (for checking timing)
  const pick = process.env.PICK ? new Set(process.env.PICK.split(',').map(Number)) : null;
  const n = pick ? Math.max(...pick) + 1 : probe ? 1 : shot.frames, t0 = Date.now(), meta = { id: shot.id, frames: n, dpr: DPR, events: {} }; // dpr: button positions are in CSS px
  for (let i = 0; i < n; i++) {
    if (shot.at) { const ev = await shot.at(ctx, i); if (ev) { meta.events[ev] = i; if (pick) console.log('  event', ev, 'at frame', i); } }
    await frame(page, i, pick && !pick.has(i) ? null : `${dir}/${pick ? 'pick-' : ''}${String(i + 1).padStart(4, '0')}.jpg`);
    if (!probe && i % 30 === 29) process.stdout.write(`  ${shot.id} ${i + 1}/${n}  ${((Date.now() - t0) / (i + 1) / 1000).toFixed(2)} s/frame\n`);
  }
  if (shot.after) Object.assign(meta, await shot.after(ctx));
  if (!probe && !pick) fs.writeFileSync(`${dir}/meta.json`, JSON.stringify(meta, null, 1));
  if (page.logs.length) { console.log('PAGE:', page.logs.join('\n')); page.logs.length = 0; }
  return (Date.now() - t0) / n;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const mode = process.argv[2] || 'probe', want = process.argv.slice(3);
  const { browser, page } = await open();
  for (const shot of SHOTS.filter(s => !want.length || want.includes(s.id))) {
    const ms = await run(page, shot, { probe: mode === 'probe' });
    console.log(shot.id, mode === 'probe' ? 'probe' : `${shot.frames} frames`, (ms / 1000).toFixed(2), 's/frame');
  }
  await browser.close();
}
