// shared: launch the game in a browser with a virtual clock so every frame is exactly 1/30 s of game time
import puppeteer from 'puppeteer';
export async function boot(W = 1920, H = 1080) {
  const browser = await puppeteer.launch({ protocolTimeout: 600000, args: ['--no-sandbox', '--ignore-gpu-blocklist', `--window-size=${W},${H}`] });
  const page = await browser.newPage(); page.logs = [];
  page.on('console', m => { if (m.type() === 'error') page.logs.push(m.text()); }); page.on('pageerror', e => page.logs.push('PAGEERROR ' + e.message));
  await page.evaluateOnNewDocument(() => {
    let vt = 0, virtual = false; const realNow = performance.now.bind(performance);
    performance.now = () => virtual ? vt : realNow();
    const realRAF = window.requestAnimationFrame.bind(window); let cb = null;
    window.requestAnimationFrame = f => { if (virtual) { cb = f; return 1; } return realRAF(f); };
    window.__virt = () => { vt = realNow(); virtual = true; };
    window.__step = ms => { vt += ms; const f = cb; cb = null; if (f) f(vt); };
  });
  await page.setRequestInterception(true);
  const fs = await import('fs');
  page.on('request', req => { const u = req.url();
    if (u.startsWith('https://cdn.jsdelivr.net/npm/three@0.170.0/')) return req.respond({ status: 200, contentType: 'text/javascript', headers: { 'Access-Control-Allow-Origin': '*' }, body: fs.readFileSync('../../node_modules/three/' + u.slice(42)) });
    req.continue(); });
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  await page.goto('http://127.0.0.1:8790/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !document.getElementById('startBtn').disabled, { timeout: 120000 });
  await page.evaluate(async () => { try { await document.fonts.ready; await Promise.all([document.fonts.load('100px "Rubik Dirt"'), document.fonts.load('800 40px "Baloo 2"'), document.fonts.load('600 40px "Noto Sans Ol Chiki"')]); } catch (e) {} });
  await page.evaluate(() => { document.querySelectorAll('.overlay,.hud,#controls,#toast,#hint,#pop,#board').forEach(e => e.style.display = 'none'); __virt(); });
  await new Promise(r => setTimeout(r, 300));
  return { browser, page };
}
