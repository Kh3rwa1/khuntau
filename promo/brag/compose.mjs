// Puts the filmed shots on Dulor's music: cuts on its beat grid, the words, the taps, the game's own sounds under
// the music, then brag.mp4 + brag.jpg (the poster, also frame 0) + share-copy.txt in brag-output/.
//   node promo/brag/compose.mjs [stills 3.0,9.5,...]   (stills: only those seconds, to check the layout)
import puppeteer from 'puppeteer';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const ROOT = process.cwd(), OUT = 'brag-output', WORK = `${OUT}/work`, FPS = 30;
const BPM = 76.62, B = 60 / BPM, BAR = 4 * B, MUSIC_IN = 61.16, BARS = 7;
const N = Math.round(BARS * BAR * FPS); // 658 frames, 21.93 s: seven bars of the track
const fr = s => Math.round(s * FPS), at = (bar, beat = 0) => (bar * 4 + beat) * B; // seconds of bar n (0-based), beat k
const meta = id => JSON.parse(fs.readFileSync(`${WORK}/frames/${id}/meta.json`, 'utf8'));
const M = Object.fromEntries(['S1', 'S2', 'S34', 'S5', 'S6', 'S7', 'S8', 'S9'].map(id => [id, meta(id)]));
const ev = (id, name) => { const v = M[id].events[name]; if (v == null) throw new Error(`${id}: no event ${name}`); return v; };
const evp = (id, prefix) => Object.entries(M[id].events).filter(([k]) => k.startsWith(prefix)).map(([, v]) => v).sort((a, b) => a - b);

// ---- the cut list: every scene starts on a beat; an in-point puts the shot's key moment where the music wants it ----
const scenes = [];
const cut = (shot, f0, f1, inPt, o = {}) => { const last = M[shot].frames - 1; inPt = Math.max(0, Math.min(inPt, last - (f1 - f0) + 1)); scenes.push({ shot, f0, f1, in: inPt, last, ...o }); return inPt; };
const F = b => fr(at(0, b)); // frame of beat b counted from the start
// bar 1: the bull's face fills the lens on the bar line
cut('S1', 0, F(4), ev('S1', 'charge') + 19 - F(4), { punch: false });
// bar 2: the crane over the ring
cut('S2', F(4), F(8), 4);
// bars 3-4, one take: HIDE is tapped in bar 3, he slams the post on the downbeat of bar 4, GRAB, the golden snatch
const inR = cut('S34', F(8), F(16), ev('S34', 'bonk') - (F(12) - F(8)));
// bars 5-6: the village, a cut every two beats
const hits = evp('S5', 'hit-T'); cut('S5', F(16), F(18), hits.find(h => h >= 20) ?? 24);
cut('S6', F(18), F(20), ev('S6', 'release') - 4);
cut('S7', F(20), F(22), ev('S7', 'land') - 14);
const cuts = evp('S8', 'cut-'); cut('S8', F(22), F(24), (cuts[1] ?? 20) - 2);
// bar 7: the crane up over the village, the title, the end
cut('S9', F(24), N, 6);
for (const s of scenes) if (['S5', 'S6', 'S7', 'S8', 'S9'].includes(s.shot) && !(M[s.shot].fixedHud)) s.patch = true; // filmed before the objective arrow was hidden with display: none
const sceneOf = shot => scenes.find(s => s.shot === shot);
const videoFrame = (shot, clipFrame) => { const s = sceneOf(shot); return s.f0 + (clipFrame - s.in); }; // where a clip moment lands
const bonkF = videoFrame('S34', ev('S34', 'bonk')), snatchF = videoFrame('S34', ev('S34', 'snatch'));

// ---- the words: Rubik Dirt (the game's own textured title face) for what slams in, Baloo 2 for the lines ----
const RD = px => `${px}px "Rubik Dirt"`, BL = px => `800 ${px}px "Baloo 2"`, OL = px => `700 ${px}px "Noto Sans Ol Chiki"`;
const words = [], bands = [], taps = [];
const say = (text, t0, t1, x, y, font, o = {}) => words.push({ text, t0, t1, x, y, font, kind: 'slam', ...o });
const line = (text, t0, t1, x, y, font, o = {}) => words.push({ text, t0, t1, x, y, font, kind: 'rise', ...o });
const t = (bar, beat) => at(bar, beat);
// 1 hook
bands.push({ t0: 0, t1: t(1, 0) - 0.06, y0: 330, y1: 1080, a: 0.38 });
say('CAN YOU', 0.0, t(1, 0) - 0.08, 540, 520, RD(132), { rot: -0.03 });
say('SNATCH', B / 2, t(1, 0) - 0.08, 540, 690, RD(176), { rot: -0.03, color: SAFFRON, shadowColor: '#7a2a14' });
say('THE PITHA?', B, t(1, 0) - 0.08, 540, 860, RD(150), { rot: -0.03 });
// 2 reveal
bands.push({ t0: t(1, 0), t1: t(2, 0) - 0.06, y0: 420, y1: 1060, a: 0.36 });
line('ᱥᱚᱦᱨᱟᱭ', t(1, 0), t(2, 0) - 0.08, 540, 560, OL(64), { color: SAFFRON, shadow: false });
say('SOHRAI', t(1, 0), t(2, 0) - 0.08, 540, 740, RD(230), { rot: -0.02 });
line('The Santal harvest festival game', t(1, 1), t(2, 0) - 0.08, 540, 930, BL(58), { shadowColor: INK });
// 3-4 the round (the phone's own score and lamps sit at the top: the words stay below them)
bands.push({ t0: t(2, 0), t1: t(4, 0) - 0.06, y0: 360, y1: 860, a: 0.3 });
say('Bait the bull.', t(2, 0) + 0.05, (bonkF / FPS) - 0.04, 540, 600, RD(116), { rot: -0.02 });
say('Grab the pitha.', snatchF / FPS, t(4, 0) - 0.08, 540, 600, RD(116), { rot: -0.02, color: SAFFRON, shadowColor: '#7a2a14' });
// 5-6 the village
bands.push({ t0: t(4, 0), t1: t(6, 0) - 0.06, y0: 250, y1: 760, a: 0.34 });
line('A WHOLE SANTAL VILLAGE', t(4, 0), t(6, 0) - 0.08, 540, 380, BL(50), { color: SAFFRON, ls: 4, shadowColor: INK });
[['Beat the tamak', 0], ['Draw the bow', 2], ['Catch the fish', 4], ['Reap the paddy', 6]].forEach(([w, b]) => say(w, t(4, b), t(4, b + 2) - 0.07, 540, 520, RD(112), { rot: -0.02 }));
// 7 the end card (no credits: Dulor's rule)
bands.push({ t0: t(6, 0), t1: N / FPS + 1, y0: 430, y1: 1240, a: 0.4 });
line('ᱥᱚᱦᱨᱟᱭ', t(6, 0), 99, 540, 560, OL(64), { color: SAFFRON, shadow: false });
say('SOHRAI', t(6, 0), 99, 540, 745, RD(230), { rot: -0.02 });
line('Free on Google Play', t(6, 1), 99, 540, 960, BL(76), { color: SAFFRON, shadowColor: INK });
line('Works offline · English & Hindi', t(6, 1.5), 99, 540, 1060, BL(50), { shadowColor: INK });
// taps on the real buttons, from where the buttons were on the filmed screen
const px = (m, b) => b && b.map(v => v * (m.dpr || 1)); // button positions were taken in CSS px
const bt = Object.fromEntries(Object.entries(M.S34.buttons || {}).map(([k, v]) => [k, px(M.S34, v)])), pad = Object.fromEntries(Object.entries(M.S5.buttons || {}).map(([k, v]) => [k, px(M.S5, v)]));
if (bt.hideBtn) taps.push({ t: videoFrame('S34', ev('S34', 'tap-hide')) / FPS, x: bt.hideBtn[0], y: bt.hideBtn[1], r: bt.hideBtn[2] });
if (bt.grabBtn) taps.push({ t: videoFrame('S34', ev('S34', 'tap-grab')) / FPS, x: bt.grabBtn[0], y: bt.grabBtn[1], r: bt.grabBtn[2] });
for (const [k, v] of Object.entries(M.S5.events)) { const m = k.match(/^hit-([TU])-/); const b = pad[m ? (m[1] === 'T' ? 'padT' : 'padU') : '']; if (!m || !b) continue; const vf = videoFrame('S5', v); if (vf >= sceneOf('S5').f0 && vf < sceneOf('S5').f1) taps.push({ t: vf / FPS, x: b[0], y: b[1], r: b[2] * 0.8 }); }
const T = { scenes, words, bands, taps };

// ---- the sound: the track from the section lift, the game's own recorded sounds under it, on its beats ----
const S = (file, sec, db, o = {}) => ({ file: `public/audio/${file}`, sec, db, ...o });
const sfx = [
  S('bellow.mp3', videoFrame('S1', ev('S1', 'tease')) / FPS + 0.15, -9),
  S('gallop.mp3', videoFrame('S1', ev('S1', 'charge')) / FPS, -13),
  S('whoosh.mp3', at(1, 0) - 0.18, -12),
  S('cheer1.mp3', at(1, 0) + 0.3, -22),
  S('whoosh.mp3', videoFrame('S34', ev('S34', 'tap-hide')) / FPS, -18),
  S('bonk.mp3', bonkF / FPS, -5), S('hit.mp3', bonkF / FPS, -13),
  S('bells.mp3', snatchF / FPS, -11), S('cheer2.mp3', snatchF / FPS + 0.05, -9),
  S('r-twang.mp3', videoFrame('S6', ev('S6', 'release')) / FPS, -10),
  S('r-splash.mp3', videoFrame('S7', ev('S7', 'land')) / FPS, -10),
  ...evp('S8', 'cut-').map(c => videoFrame('S8', c) + 5).filter(vf => vf >= sceneOf('S8').f0 && vf < sceneOf('S8').f1).map(vf => S('r-rustle.mp3', vf / FPS, -17)),
].filter(s => s.sec >= 0 && s.sec < N / FPS);

async function main() {
  const stills = process.argv[2] === 'stills' ? (process.argv[3] || '').split(',').map(Number) : null;
  fs.writeFileSync(`${WORK}/timeline.json`, JSON.stringify({ N, scenes, words, taps, sfx }, null, 1));
  console.log('cuts:', scenes.map(s => `${s.shot}@${(s.f0 / FPS).toFixed(2)}s in ${s.in}`).join('  '), '| slam', (bonkF / FPS).toFixed(2), 's, snatch', (snatchF / FPS).toFixed(2), 's');
  const server = http.createServer((q, r) => { const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'content-type': p.endsWith('.html') ? 'text/html' : p.endsWith('.woff2') ? 'font/woff2' : p.endsWith('.jpg') ? 'image/jpeg' : 'application/octet-stream' }); fs.createReadStream(p).pipe(r); }).listen(8792);
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] }), page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1920 }); await page.goto('http://127.0.0.1:8792/promo/brag/compose.html');
  if (!(await page.evaluate(() => window.ready()))) throw new Error('fonts did not load');
  const dir = stills ? `${WORK}/stills` : `${WORK}/out`; fs.mkdirSync(dir, { recursive: true });
  const list = stills ? stills.map(s => Math.min(N - 1, Math.round(s * FPS))) : [...Array(N).keys()];
  for (const f of list) {
    const d = await page.evaluate((f, T) => window.frame(f, T), f, T);
    fs.writeFileSync(stills ? `${dir}/t${(f / FPS).toFixed(2)}.jpg` : `${dir}/${String(f).padStart(4, '0')}.jpg`, Buffer.from(d.split(',')[1], 'base64'));
    if (!stills && f % 100 === 99) console.log('  frame', f + 1, '/', N);
  }
  await browser.close(); server.close();
  if (stills) return console.log('stills in', dir);
  // the poster: the end card fully settled (title, Google Play line, offline line all in); it is also frame 0
  const posterF = N - 12; fs.copyFileSync(`${dir}/${String(posterF).padStart(4, '0')}.jpg`, `${OUT}/brag.jpg`); fs.copyFileSync(`${OUT}/brag.jpg`, `${dir}/0000.jpg`);
  // sound
  const dur = N / FPS, inputs = ['-ss', String(MUSIC_IN), '-t', String(dur + 0.5), '-i', 'promo/trailer/music/sohrai.mp3'], chains = [];
  sfx.forEach((s, i) => { inputs.push('-i', s.file); chains.push(`[${i + 1}:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=${s.db}dB,aecho=0.8:0.5:60:0.18,adelay=${Math.round(s.sec * 1000)}|${Math.round(s.sec * 1000)}[s${i}]`); });
  const fc = [`[0:a]aformat=sample_rates=48000:channel_layouts=stereo,afade=t=in:d=0.02,afade=t=out:st=${(dur - 1.3).toFixed(2)}:d=1.3[m]`, ...chains,
    `[m]${sfx.map((_, i) => `[s${i}]`).join('')}amix=inputs=${sfx.length + 1}:normalize=0:duration=first,atrim=0:${dur.toFixed(3)},loudnorm=I=-14:TP=-1.5:LRA=9[a]`].join(';');
  execFileSync('ffmpeg', ['-y', '-v', 'error', ...inputs, '-filter_complex', fc, '-map', '[a]', '-ar', '48000', `${WORK}/mix.wav`]);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-framerate', String(FPS), '-i', `${dir}/%04d.jpg`, '-i', `${WORK}/mix.wav`, '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(FPS),
    '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', `${OUT}/brag.mp4`]);
  console.log('wrote', `${OUT}/brag.mp4`, `${OUT}/brag.jpg`);
}
main().catch(e => { console.error(e); process.exit(1); });
