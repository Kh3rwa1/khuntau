// node tools/og.mjs   (with node tests/serve.mjs running, for the game's fonts)
// Draws public/og.jpg, the 1200x630 link preview: the painting of the Khuntau on a Santal wall
// (design/murals/og-art.jpg, made from Dulor's photos) with the title on its plain left third.
import puppeteer from 'puppeteer';
import fs from 'fs';
const art = 'data:image/jpeg;base64,' + fs.readFileSync('design/murals/og-art.jpg').toString('base64');
const html = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/fonts/fonts.css">
<style>@font-face{font-family:'Rubik Dirt';src:url(/fonts/rubik-dirt-latin.woff2) format('woff2')} /* the game registers this one from JS */
html,body{margin:0;width:1200px;height:630px;overflow:hidden;background:#2c2e30}
.bg{position:absolute;inset:0;background:url(${art}) center/cover no-repeat}
.t{position:absolute;left:78px;top:118px;width:380px;color:#f6eedd}
.ol{font:600 34px 'Noto Sans Ol Chiki';color:#ffb347;letter-spacing:.04em}
h1{margin:6px 0 0;font:104px/1 'Rubik Dirt';color:#f6eedd;text-shadow:0 6px 0 #b5462a}
.a{margin-top:34px;font:800 31px/1.2 'Baloo 2'}.b{margin-top:14px;font:500 23px/1.3 'Baloo 2';opacity:.85}</style></head>
<body><div class="bg"></div><div class="t"><div class="ol" lang="sat">ᱥᱚᱦᱨᱟᱭ</div><h1>Sohrai</h1>
<div class="a">Snatch the pitha.<br>Dodge the bull.</div><div class="b">The Santal festival game ·<br>play free with friends</div></div></body></html>`;
const b = await puppeteer.launch({ args: ['--no-sandbox'] }), p = await b.newPage();
await p.setViewport({ width: 1200, height: 630 });
await p.goto('http://127.0.0.1:8791/fonts/fonts.css'); // same origin as the fonts, or they are blocked
await p.setContent(html, { waitUntil: 'networkidle0' });
await p.evaluate(() => document.fonts.load("104px 'Rubik Dirt'").then(() => document.fonts.ready));
await p.screenshot({ path: 'public/og.jpg', type: 'jpeg', quality: 86 });
await b.close(); console.log('public/og.jpg', fs.statSync('public/og.jpg').size, 'bytes');
