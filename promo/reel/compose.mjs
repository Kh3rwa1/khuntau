// The 40 s Hinglish story reel: the brag cut's real game footage, the five day paintings and Gogo's portrait, a Hinglish
// voice (Kokoro, open source: promo/reel/vo.py) over Dulor's Khuntau track, ending on the official Google Play badge.
//   python3 promo/reel/vo.py hm_psi 1.1                  the voice, one wav per line (brag-output/reel/vo/hm_psi/)
//   node promo/reel/compose.mjs [stills 3.0,9.5,...]      the reel (brag-output/reel/sohrai-reel.mp4 + .jpg), or stills
// Needs the shots in brag-output/work/frames (node promo/brag/film.mjs shot S1 S2 S34 S5 S6 S7 S8 V1 S9).
import puppeteer from 'puppeteer';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const ROOT = process.cwd(), OUT = 'brag-output/reel', WORK = 'brag-output/work', FPS = 30, VOICE = process.env.VOICE || 'hm_psi';
const BPM = 76.62, B = 60 / BPM, MUSIC_IN = 61.16, BEATS = 52; // thirteen bars of the track from its section lift
const N = Math.round(BEATS * B * FPS); // 1222 frames, 40.7 s
const F = b => Math.round(b * B * FPS), T_ = b => b * B; // frame / second of beat b
const meta = id => JSON.parse(fs.readFileSync(`${WORK}/frames/${id}/meta.json`, 'utf8'));
const M = Object.fromEntries(['S1', 'S2', 'S34', 'S5', 'S6', 'S7', 'S8', 'V1', 'S9'].map(id => [id, meta(id)]));
const ev = (id, name) => { const v = M[id].events[name]; if (v == null) throw new Error(`${id}: no event ${name}`); return v; };
const evp = (id, prefix) => Object.entries(M[id].events).filter(([k]) => k.startsWith(prefix)).map(([, v]) => v).sort((a, b) => a - b);
const PASTE = '#f6eedd', SAFFRON = '#ffb347', INK = '#140a06';
const RD = px => `${px}px "Rubik Dirt"`, BL = px => `800 ${px}px "Baloo 2"`, OL = px => `700 ${px}px "Noto Sans Ol Chiki"`;

// ---- the cut list: every scene starts on a beat ----
const scenes = [];
const cut = (shot, b0, b1, inPt, o = {}) => { const f0 = F(b0), f1 = F(b1), last = M[shot].frames - 1; inPt = Math.max(0, Math.min(inPt, last - (f1 - f0) + 1)); scenes.push({ shot, f0, f1, in: inPt, last, ...o }); return inPt; };
const art = (src, b0, b1, o = {}) => scenes.push({ shot: 'art', img: `/public/art/${src}`, f0: F(b0), f1: F(b1), in: 0, last: 0, ...o });
cut('S1', 0, 4, ev('S1', 'charge') + 19 - F(4), { punch: false }); // bar 1: he charges into the lens on the bar line
cut('S2', 4, 8, 4); // bar 2: the crane over the khunt
art('day1.webp', 8, 10, { z0: 1.05, z1: 1.15, dy: -0.02 }); // bar 3: Gogo (her portrait on the first painting), then out of the door
cut('V1', 10, 12, 28);
['day2', 'day3', 'day4'].forEach((d, i) => art(`${d}.webp`, 12 + i, 13 + i, { z0: 1.0, z1: 1.06 })); // bars 4-5: the other days (day 1 was behind Gogo)
art('day5.webp', 15, 17, { z0: 1.0, z1: 1.08 }); art('complete.webp', 17, 20, { z0: 1.02, z1: 1.12 });
const hits = evp('S5', 'hit-T'); cut('S5', 20, 22, hits.find(h => h >= 20) ?? 24); // bars 6-7: the village, a cut every two beats
cut('S6', 22, 24, ev('S6', 'release') - 4);
cut('S7', 24, 26, ev('S7', 'land') - 17);
const cuts = evp('S8', 'cut-'); cut('S8', 26, 28, (cuts[1] ?? 20) - 2);
cut('S34', 28, 40, ev('S34', 'bonk') - (F(32) - F(28))); // bars 8-10, one take: he slams the post on the downbeat of bar 9
cut('S9', 40, BEATS, 6); // bars 11-13: the end card
for (const s of scenes) if (['S5', 'S6', 'S7'].includes(s.shot)) s.patch = true;
const sceneOf = shot => scenes.find(s => s.shot === shot);
const vt = (shot, clipFrame) => { const s = sceneOf(shot); return (s.f0 + (clipFrame - s.in)) / FPS; }; // video second of a clip moment

// ---- the voice: each line at its cue, never on top of the one before ----
const VOF = JSON.parse(fs.readFileSync(process.env.VO || 'promo/reel/vo.json', 'utf8')), VO = VOF.lines, NAME = VOF.name ? `sohrai-reel-${VOF.name}` : 'sohrai-reel'; // VO=promo/reel/vo_en.json: the English reel
const dur = f => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());
const bonkT = vt('S34', ev('S34', 'bonk')), snatchT = vt('S34', ev('S34', 'snatch')), hideT = vt('S34', ev('S34', 'tap-hide')), grabT = vt('S34', ev('S34', 'tap-grab'));
const CUE = { start: 0.15, crane: T_(4) + 0.55, gogo: T_(8) + 0.2, days: T_(12) + 0.1, drum: T_(20) + 0.08, bow: T_(22) + 0.08, fish: T_(24) + 0.08, reap: T_(26) + 0.08,
  round: T_(26) + 1.1 /* leads into the ring: a J-cut over the last of the paddy */, hide: hideT - 0.3 /* 'show it' comes just before the tap */, bonk: bonkT + 0.1, grab: bonkT + 0.15, cheer: snatchT + 1.6, end: T_(40) + 0.15, end2: T_(40) + 2.9, end3: T_(40) + 5.6 };
const vo = []; let free = 0;
for (const ln of VO) { if (ln.skip) continue;
  if (ln.capOnly) { const at = Math.max(CUE[ln.at], free + 0.08); vo.push({ ...ln, file: null, sec: at, end: at + 1.4 }); continue; } // a caption with no voice: takes no time from the next line
  const file = `${OUT}/vo/${VOICE}/${ln.id}.wav`, d = dur(file) / (ln.tempo || 1), at = Math.max(CUE[ln.at], free + 0.08); vo.push({ ...ln, file, sec: at, end: at + d }); free = at + d; }
const over = vo.filter(v => v.end > N / FPS - 0.3); if (over.length) throw new Error('voice runs past the end: ' + over.map(v => v.id));

// ---- the words: captions follow the voice (Rubik Dirt, the game's textured face); the end card names the Play badge ----
const words = [], bands = [], cards = [], taps = [];
const say = (text, t0, t1, y, px, o = {}) => words.push({ text, t0, t1, x: 540, y, font: RD(px), kind: 'slam', rot: -0.02, ...o });
const line = (text, t0, t1, y, font, o = {}) => words.push({ text, t0, t1, x: 540, y, font, kind: 'rise', ...o });
const capY = { l1: 600, l2: 620, l3: 1330, l4: 1260, l6a: 600, l6b: 640, l6d: 620, l7: 600 }; // over the paintings the words sit low, clear of the faces
const hot = { l2: 1, l5a: 1, l5b: 1, l5c: 1, l5d: 1, l6d: 1, l7: 1 };
const next = (i) => (vo[i + 1] ? vo[i + 1].sec : N / FPS);
vo.forEach((v, i) => { if (!v.cap) return;
  const t1 = Math.min(next(i) - 0.06, v.end + 0.9), y = capY[v.id] ?? (v.id.startsWith('l5') ? 560 : 600), px = v.id === 'l7' ? 190 : v.id.startsWith('l5') ? 120 : 104;
  bands.push({ t0: v.sec - 0.1, t1, y0: y - 260, y1: y + 260, a: 0.34 });
  say(v.cap, v.sec, t1, y, px, hot[v.id] ? { color: SAFFRON, shadowColor: '#7a2a14' } : {}); });
say('DHADAAM!', bonkT, bonkT + 0.5, 600, 170, { color: SAFFRON, shadowColor: '#7a2a14', rot: -0.06 });
// Gogo's portrait on the first painting, with her name
cards.push({ src: '/public/art/face-gogo.webp', t0: T_(8) + 0.05, t1: T_(10) - 0.05, x: 540, y: 690, w: 430, frame: true, rot: -0.025 });
line('Gogo · ᱜᱚᱜᱚ', T_(8) + 0.2, T_(10) - 0.06, 1075, BL(54), { color: SAFFRON, shadowColor: INK });
// the end card: title, 'available on Google Play', the official badge, what it is (no credits: Dulor's rule)
const E = T_(40);
bands.push({ t0: E, t1: N / FPS + 1, y0: 230, y1: 1130, a: 0.42 });
line('ᱥᱚᱦᱨᱟᱭ', E, 99, 330, OL(64), { color: SAFFRON, shadow: false });
say('SOHRAI', E, 99, 500, 210, {});
line(VOF.endLine || 'Ab Google Play pe available!', E + 0.35, 99, 680, BL(64), { color: SAFFRON, shadowColor: INK });
cards.push({ src: '/promo/reel/google-play-badge.png', t0: E + 0.75, t1: 99, x: 540, y: 845, w: 620 }); // the badge as Google gives it: not recoloured, not cropped
line('Free · Offline · English & Hindi', E + 1.3, 99, 1010, BL(46), { shadowColor: INK });
// taps on the real buttons
const px = (m, b) => b && b.map(v => v * (m.dpr || 1));
const bt = Object.fromEntries(Object.entries(M.S34.buttons || {}).map(([k, v]) => [k, px(M.S34, v)])), pad = Object.fromEntries(Object.entries(M.S5.buttons || {}).map(([k, v]) => [k, px(M.S5, v)]));
if (bt.hideBtn) taps.push({ t: hideT, x: bt.hideBtn[0], y: bt.hideBtn[1], r: bt.hideBtn[2] });
if (bt.grabBtn) taps.push({ t: grabT, x: bt.grabBtn[0], y: bt.grabBtn[1], r: bt.grabBtn[2] });
for (const [k, v] of Object.entries(M.S5.events)) { const m = k.match(/^hit-([TU])-/); const b = pad[m ? (m[1] === 'T' ? 'padT' : 'padU') : '']; if (!m || !b) continue; const s = sceneOf('S5'), f = s.f0 + (v - s.in); if (f >= s.f0 && f < s.f1) taps.push({ t: f / FPS, x: b[0], y: b[1], r: b[2] * 0.8 }); }
const TL = { scenes, words, bands, taps, cards };

// ---- the sound: the track (ducked under the voice), the game's own sounds on their moments ----
const S = (file, sec, db) => ({ file: `public/audio/${file}`, sec, db });
const sfx = [
  S('bellow.mp3', vt('S1', ev('S1', 'tease')) + 0.15, -9), S('gallop.mp3', vt('S1', ev('S1', 'charge')), -13), S('whoosh.mp3', T_(4) - 0.18, -12), S('cheer1.mp3', T_(4) + 0.3, -24),
  S('whoosh.mp3', hideT, -18), S('bonk.mp3', bonkT, -5), S('hit.mp3', bonkT, -13), S('bells.mp3', snatchT, -11), S('cheer2.mp3', snatchT + 0.05, -9), S('cheer1.mp3', CUE.cheer + 0.2, -14),
  S('r-twang.mp3', vt('S6', ev('S6', 'release')), -10), S('r-splash.mp3', vt('S7', ev('S7', 'land')), -10),
  ...evp('S8', 'cut-').map(c => vt('S8', c) + 5 / FPS).filter(s => s >= T_(26) && s < T_(28)).map(s => S('r-rustle.mp3', s, -17)),
].filter(s => s.sec >= 0 && s.sec < N / FPS);

async function main() {
  const stills = process.argv[2] === 'stills' ? (process.argv[3] || '').split(',').map(Number) : null;
  fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(`${OUT}/timeline.json`, JSON.stringify({ N, scenes, vo, words, sfx }, null, 1));
  console.log('voice:', vo.map(v => `${v.id}@${v.sec.toFixed(2)}-${v.end.toFixed(2)}`).join(' '));
  console.log('bonk', bonkT.toFixed(2), 'snatch', snatchT.toFixed(2), 'end card', E.toFixed(2), 'length', (N / FPS).toFixed(2));
  const server = http.createServer((q, r) => { const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); }
    const ty = { '.html': 'text/html', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }[path.extname(p)] || 'application/octet-stream'; r.writeHead(200, { 'content-type': ty }); fs.createReadStream(p).pipe(r); }).listen(8793);
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] }), page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1920 }); await page.goto('http://127.0.0.1:8793/promo/reel/reel.html');
  if (!(await page.evaluate(() => window.ready()))) throw new Error('fonts did not load');
  const dir = stills ? `${OUT}/stills` : `${OUT}/frames`; fs.mkdirSync(dir, { recursive: true });
  const list = stills ? stills.map(s => Math.min(N - 1, Math.round(s * FPS))) : process.env.ENCODE_ONLY ? [] : [...Array(N).keys()];
  for (const f of list) {
    const d = await page.evaluate((f, T) => window.frame(f, T), f, TL);
    fs.writeFileSync(stills ? `${dir}/t${(f / FPS).toFixed(2)}.jpg` : `${dir}/${String(f).padStart(4, '0')}.jpg`, Buffer.from(d.split(',')[1], 'base64'));
    if (!stills && f % 200 === 199) console.log('  frame', f + 1, '/', N);
  }
  await browser.close(); server.close();
  if (stills) return console.log('stills in', dir);
  const posterF = N - 15; fs.copyFileSync(`${dir}/${String(posterF).padStart(4, '0')}.jpg`, `${OUT}/${NAME}.jpg`); fs.copyFileSync(`${OUT}/${NAME}.jpg`, `${dir}/0000.jpg`); // the poster (end card with the badge) is also frame 0
  const D = N / FPS, inputs = ['-ss', String(MUSIC_IN), '-t', String(D + 0.5), '-i', 'promo/trailer/music/sohrai.mp3'], ch = [];
  const said = vo.filter(v => v.file);
  said.forEach((v, i) => { inputs.push('-i', v.file); ch.push(`[${i + 1}:a]aformat=sample_rates=48000:channel_layouts=stereo,${v.tempo ? `atempo=${v.tempo},` : ''}volume=4dB,adelay=${Math.round(v.sec * 1000)}|${Math.round(v.sec * 1000)}[v${i}]`); });
  const o = said.length + 1;
  sfx.forEach((s, i) => { inputs.push('-i', s.file); ch.push(`[${o + i}:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=${s.db}dB,adelay=${Math.round(s.sec * 1000)}|${Math.round(s.sec * 1000)}[s${i}]`); });
  const fc = [...ch,
    `${said.map((_, i) => `[v${i}]`).join('')}amix=inputs=${said.length}:normalize=0:duration=longest,apad=whole_dur=${D.toFixed(3)},asplit=2[voice][key]`,
    `[0:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=-3dB,afade=t=in:d=0.02,afade=t=out:st=${(D - 1.6).toFixed(2)}:d=1.6[m0]`,
    `[m0][key]sidechaincompress=threshold=0.03:ratio=6:attack=15:release=350[m]`, // the music steps back while the voice speaks
    `[m][voice]${sfx.map((_, i) => `[s${i}]`).join('')}amix=inputs=${sfx.length + 2}:normalize=0:duration=first,atrim=0:${D.toFixed(3)},loudnorm=I=-14:TP=-1.5:LRA=11[a]`].join(';');
  execFileSync('ffmpeg', ['-y', '-v', 'error', ...inputs, '-filter_complex', fc, '-map', '[a]', '-ar', '48000', `${OUT}/mix.wav`]);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-framerate', String(FPS), '-i', `${dir}/%04d.jpg`, '-i', `${OUT}/mix.wav`, '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-maxrate', '5200k', '-bufsize', '10400k',
    '-pix_fmt', 'yuv420p', '-r', String(FPS), '-frames:v', String(N), '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', `${OUT}/${NAME}.mp4`]); // about 27 MB: quality for Instagram and YouTube (WhatsApp re-encodes whatever it gets)
  console.log('wrote', `${OUT}/${NAME}.mp4`, `${OUT}/${NAME}.jpg`);
}
main().catch(e => { console.error(e); process.exit(1); });
