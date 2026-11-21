// usage: node comp.mjs preview 4.5,8.5,...   |   node comp.mjs render out.mp4
import fs from 'fs'; import { spawn } from 'child_process';
import puppeteer from 'puppeteer';
const [mode, arg] = process.argv.slice(2);
const browser = await puppeteer.launch({ protocolTimeout: 600000, args: ['--no-sandbox', '--window-size=1920,1080'] });
const page = await browser.newPage(); const logs = [];
page.on('console', m => { if (m.type() === 'error') logs.push(m.text()); }); page.on('pageerror', e => logs.push('PAGEERROR ' + e.message));
await page.setViewport({ width: 1920, height: 1080 });
await page.goto('http://127.0.0.1:8790/comp.html', { waitUntil: 'networkidle0' });
await page.evaluate(async () => { await document.fonts.ready; await Promise.all([document.fonts.load('100px "Rubik Dirt"'), document.fonts.load('800 40px "Baloo 2"', 'खेल में असली'), document.fonts.load('600 40px "Noto Sans Ol Chiki"')]); });
for (const f of ['overlay.js', 'comp.js']) await page.addScriptTag({ path: './' + f });
const n = await page.evaluate(() => __comp.frames);
const flush = () => { if (logs.length) { console.log(logs.join('\n')); logs.length = 0; } };
if (mode === 'preview') {
  fs.mkdirSync('./frames', { recursive: true });
  for (const t of arg.split(',').map(Number)) {
    const j = await page.evaluate(i => __comp.frame(i), Math.round(t * 30));
    const out = `./frames/rc-${t.toFixed(1)}.jpg`; fs.writeFileSync(out, Buffer.from(j.split(',')[1], 'base64')); console.log(out);
  }
} else {
  const out = arg, tmp = out.replace(/\.mp4$/, '.part.mp4'), t0 = Date.now();
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', '-',
    '-vf', 'noise=alls=5:allf=t+u,format=yuv420p', '-c:v', 'libx264', '-crf', '17', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-r', '30', tmp], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let i = 0; i < n; i++) {
    const j = await page.evaluate(i => __comp.frame(i), i);
    if (!ff.stdin.write(Buffer.from(j.split(',')[1], 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 150 === 0) { console.log('frame', i, '/', n, ((Date.now() - t0) / 1000 | 0) + 's'); flush(); }
  }
  ff.stdin.end(); const code = await new Promise(r => ff.on('close', r));
  if (code === 0) fs.renameSync(tmp, out); console.log('done', code);
}
flush(); await browser.close();
