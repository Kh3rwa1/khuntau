import puppeteer from '/home/user/khuntau/node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js';
// the mark: a garlanded Sohrai bull (oiled red horns, vermilion on the forehead) inside a ring of rice-paste alpana
const marigolds = () => { let s = ''; const cols = ['#ffb21c', '#ff8a1c', '#ffd23c'];
  for (let i = 0; i <= 14; i++) { const a = -1.32 + i * (2.64 / 14), x = 512 + 262 * Math.sin(a), y = 618 + 215 * Math.cos(a), r = 33 - Math.abs(i - 7) * 0.6;
    s += `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><circle r="${r}" fill="${cols[i % 3]}"/>` + [0, 1, 2, 3, 4, 5, 6, 7].map(k => `<circle cx="${(Math.cos(k * 0.785) * r * 0.55).toFixed(1)}" cy="${(Math.sin(k * 0.785) * r * 0.55).toFixed(1)}" r="${(r * 0.36).toFixed(1)}" fill="${cols[(i + 1) % 3]}" opacity=".85"/>`).join('') + `<circle r="${(r * 0.28).toFixed(1)}" fill="#c8551a"/></g>`; } return s; };
const ring = () => { let s = '<circle cx="512" cy="512" r="452" fill="none" stroke="#f6eedd" stroke-width="9" opacity=".92"/><circle cx="512" cy="512" r="474" fill="none" stroke="#f6eedd" stroke-width="3" stroke-dasharray="14 16" opacity=".7"/>';
  for (let i = 0; i < 28; i++) { const a = i / 28 * 360; s += `<g transform="rotate(${a} 512 512)"><ellipse cx="512" cy="100" rx="17" ry="30" fill="none" stroke="#f6eedd" stroke-width="5" opacity=".85"/><circle cx="512" cy="152" r="5" fill="#f6eedd" opacity=".8"/></g>`; } return s; };
const bull = `
  <g>${marigolds()}</g>
  <!-- horns: oiled red, swept out and up -->
  <g fill="#c8301c" stroke="#7a1a10" stroke-width="6" stroke-linejoin="round">
    <path d="M430 392 C330 386 236 318 232 176 C282 280 352 322 462 344 Z"/>
    <path d="M594 392 C694 386 788 318 792 176 C742 280 672 322 562 344 Z"/></g>
  <path d="M300 250 C296 300 330 348 420 372" fill="none" stroke="#ff7a52" stroke-width="9" stroke-linecap="round" opacity=".7"/>
  <path d="M724 250 C728 300 694 348 604 372" fill="none" stroke="#ff7a52" stroke-width="9" stroke-linecap="round" opacity=".7"/>
  <!-- ears -->
  <g><ellipse cx="318" cy="470" rx="82" ry="40" transform="rotate(-18 318 470)" fill="#efe4cc" stroke="#3a2418" stroke-width="6"/><ellipse cx="318" cy="472" rx="48" ry="19" transform="rotate(-18 318 472)" fill="#d99a84"/>
     <ellipse cx="706" cy="470" rx="82" ry="40" transform="rotate(18 706 470)" fill="#efe4cc" stroke="#3a2418" stroke-width="6"/><ellipse cx="706" cy="472" rx="48" ry="19" transform="rotate(18 706 472)" fill="#d99a84"/></g>
  <!-- head -->
  <path d="M512 338 C640 338 700 420 690 520 C680 630 628 700 606 742 C580 800 444 800 418 742 C396 700 344 630 334 520 C324 420 384 338 512 338 Z" fill="#f6eedd" stroke="#3a2418" stroke-width="7"/>
  <path d="M512 352 C418 356 356 420 350 520 C352 596 388 660 420 716 C392 640 380 560 392 470 C402 410 450 366 512 352 Z" fill="#e3d5b8" opacity=".75"/>
  <!-- forelock hump shadow and vermilion -->
  <circle cx="512" cy="446" r="34" fill="#d8301c"/><circle cx="502" cy="436" r="10" fill="#ff7a5c" opacity=".7"/>
  <!-- eyes -->
  <g><ellipse cx="424" cy="548" rx="27" ry="33" fill="#1a110c"/><circle cx="415" cy="536" r="9" fill="#fff" opacity=".9"/>
     <ellipse cx="600" cy="548" rx="27" ry="33" fill="#1a110c"/><circle cx="591" cy="536" r="9" fill="#fff" opacity=".9"/>
     <path d="M384 498 C410 476 444 478 462 496" fill="none" stroke="#3a2418" stroke-width="9" stroke-linecap="round"/><path d="M640 498 C614 476 580 478 562 496" fill="none" stroke="#3a2418" stroke-width="9" stroke-linecap="round"/></g>
  <!-- muzzle -->
  <ellipse cx="512" cy="724" rx="106" ry="68" fill="#4a3228" stroke="#2a1810" stroke-width="6"/>
  <ellipse cx="474" cy="716" rx="15" ry="21" fill="#170e0a"/><ellipse cx="550" cy="716" rx="15" ry="21" fill="#170e0a"/>
  <path d="M470 762 C498 776 526 776 554 762" fill="none" stroke="#170e0a" stroke-width="7" stroke-linecap="round"/>`;
const bg = `<defs><radialGradient id="g" cx="50%" cy="46%" r="70%"><stop offset="0" stop-color="#7a2e16"/><stop offset=".55" stop-color="#3c170c"/><stop offset="1" stop-color="#1c0b06"/></radialGradient></defs><rect width="1024" height="1024" fill="url(#g)"/>`;
const icon = (scale, withRing) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${bg}${withRing ? ring() : ''}<g transform="translate(512 512) scale(${scale}) translate(-512 -530)">${bull}</g></svg>`;
const splash = (w, h) => { const s = Math.min(w, h), m = s * 0.62;
  return `<div style="width:${w}px;height:${h}px;background:radial-gradient(ellipse at 50% 42%,#7a2e16 0%,#3c170c 48%,#1c0b06 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:'Baloo 2',sans-serif;color:#f6eedd;overflow:hidden;position:relative">
    <svg viewBox="0 0 1024 1024" style="width:${m}px;height:${m}px">${ring()}<g transform="translate(512 512) scale(.78) translate(-512 -530)">${bull}</g></svg>
    <div style="font-family:'Noto Sans Ol Chiki',sans-serif;color:#ffb347;font-size:${s * 0.05}px;letter-spacing:${s * 0.006}px;margin-top:${s * 0.03}px">ᱥᱚᱦᱨᱟᱭ</div>
    <div style="font-family:'Rubik Dirt',sans-serif;font-size:${s * 0.2}px;line-height:1;text-shadow:0 ${s * 0.008}px 0 #b5462a">Sohrai</div>
    <div style="font-size:${s * 0.042}px;font-weight:700;margin-top:${s * 0.02}px;opacity:.92">The Santal festival game</div></div>`; };
const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage();
const shot = async (html, w, h, out) => { await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 }); await page.goto('http://127.0.0.1:8791/stats.html', { waitUntil: 'domcontentloaded' });
  await page.evaluate((html) => { document.head.innerHTML = '<link rel="stylesheet" href="/fonts/fonts.css"><style>@font-face{font-family:"Rubik Dirt";src:url(/fonts/rubik-dirt-latin.woff2) format("woff2")}html,body{margin:0;background:#1c0b06}svg{display:block}</style>'; document.body.innerHTML = html; }, html);
  await page.evaluate(async () => { await Promise.all(['150px "Rubik Dirt"', '40px "Baloo 2"', '700 40px "Baloo 2"', '30px "Noto Sans Ol Chiki"'].map(f => document.fonts.load(f, 'Sohrai ᱥᱚᱦᱨᱟᱭ'))); await document.fonts.ready; }); await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: out, type: 'png', clip: { x: 0, y: 0, width: w, height: h } }); };
const sized = (svg, n) => `<div style="width:${n}px;height:${n}px">${svg.replace('<svg ', `<svg width="${n}" height="${n}" `)}</div>`;
await shot(sized(icon(0.86, true), 1024), 1024, 1024, 'icon-1024.png');
await shot(sized(icon(0.86, true), 512), 512, 512, 'icon-512.png');
await shot(sized(icon(0.86, true), 192), 192, 192, 'icon-192.png');
await shot(sized(icon(0.7, false), 512), 512, 512, 'icon-maskable-512.png');
await shot(splash(1080, 1920), 1080, 1920, 'splash-portrait-1080x1920.png');
await shot(splash(1920, 1080), 1920, 1080, 'splash-landscape-1920x1080.png');
await shot(splash(1024, 500), 1024, 500, 'play-feature-1024x500.png');
await browser.close(); console.log('done');
