// usage: node capture.mjs preview S3:2.0,S7:1.6 ...   |  node capture.mjs render [S1,S2,...]
import fs from 'fs'; import { spawn } from 'child_process'; import { boot } from './boot.mjs';
const CLIPS = process.env.CLIPS || './clips/';
const mode = process.argv[2] || 'preview', arg = process.argv[3] || '';
const { browser, page } = await boot(1280, 720);
if (process.env.MAP) await page.addScriptTag({ path: './' + process.env.MAP });
await page.evaluate(() => Promise.all([document.fonts.load('700 120px "Noto Sans Ol Chiki"', 'ᱠᱷᱩᱱᱴᱟᱣ'), document.fonts.load('800 120px "Baloo 2"', 'हिन्दी खूँटा')]));
for (const f of ['look.js', 'overlay.js']) await page.addScriptTag({ path: './' + f });
await page.evaluate(() => __look());
if (process.env.DAY) { await page.addScriptTag({ path: './day.js' }); await page.evaluate(() => __day()); }
if (process.env.NIGHT) { await page.addScriptTag({ path: './night.js' }); await page.evaluate(() => __night()); }
await page.addScriptTag({ path: './' + (process.env.SHOTS || 'shots.js') });
const ids = await page.evaluate(() => __SHOTS.map(s => s.id));
fs.mkdirSync('./frames', { recursive: true }); fs.mkdirSync('./clips', { recursive: true });
const errs = () => { if (page.logs.length) { console.log('PAGE:', page.logs.join('\n')); page.logs.length = 0; } };

if (mode === 'preview') {
  const want = {}; for (const p of arg.split(',')) { const [id, t] = p.split(':'); (want[id] ||= []).push(+t); }
  for (const id of Object.keys(want)) {
    const i = ids.indexOf(id), n = await page.evaluate(i => __runShot(i), i);
    const targets = want[id].map(t => Math.min(n - 1, Math.round(t * 30))), last = Math.max(...targets);
    for (let f = 0; f <= last; f++) {
      const j = await page.evaluate((i, f, r) => __frame(i, f, r), i, f, targets.includes(f));
      if (j) { const out = `./frames/pv-${id}-${(f / 30).toFixed(1)}.jpg`; fs.writeFileSync(out, Buffer.from(j.split(',')[1], 'base64')); console.log(out); }
    }
    await page.evaluate(i => __endShot(i), i); errs();
  }
} else {
  const list = arg ? arg.split(',') : ids;
  for (const id of list) {
    const i = ids.indexOf(id), n = await page.evaluate(i => __runShot(i), i), t0 = Date.now();
    const tmp = `${CLIPS}${id}.part.mp4`, out = `${CLIPS}${id}.mp4`;
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', '-',
      '-vf', 'eq=contrast=1.06:saturation=1.08,colorbalance=rs=-0.03:bs=0.04:rh=0.05:bh=-0.04,noise=alls=6:allf=t+u,format=yuv420p',
      '-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-r', '30', tmp], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let f = 0; f < n; f++) {
      const j = await page.evaluate((i, f) => __frame(i, f, true), i, f);
      const buf = Buffer.from(j.split(',')[1], 'base64'); if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    }
    ff.stdin.end(); const code = await new Promise(r => ff.on('close', r));
    await page.evaluate(i => __endShot(i), i); errs();
    if (code === 0) fs.renameSync(tmp, out);
    console.log(id, n, 'frames', ((Date.now() - t0) / 1000) | 0, 's', code === 0 ? 'ok' : 'FAILED');
  }
}
errs(); await browser.close();
