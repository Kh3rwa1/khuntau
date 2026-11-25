// node promo/posters/gen.mjs        (with node tests/serve.mjs running: the game's fonts and paintings come from it)
// Draws the WhatsApp status posters for Sohrai: 1080x1920 (9:16), each in English and in Hindi, into promo/posters/out/.
// Nothing here is new art: every picture is one of the paintings the game already carries, made from Dulor's photos of a
// painted Santal house (public/art/). The frame is that house's wall, drawn as the game draws it (houseWallTex in
// public/index.html): lime wash on top, the charcoal band edged with pink scallops, red ochre at the foot.
// Words are set here, never by an image tool. Ol Chiki only for names Dulor has confirmed (the title, the five days).
// Hindi is set in Baloo 2's Devanagari cut (fonts/baloo-2-devanagari.woff2, SIL Open Font License; the game itself
// leaves Hindi to the phone's font).
import puppeteer from 'puppeteer';
import fs from 'fs';
const OUT = 'promo/posters/out', SITE = 'khuntau.dulalkisku0.workers.dev';
fs.mkdirSync(OUT, { recursive: true });
const deva = 'data:font/woff2;base64,' + fs.readFileSync('promo/posters/fonts/baloo-2-devanagari.woff2').toString('base64');
const DAYS = [['Um Hilok', 'उम हिलोक', 'ᱩᱢ ᱦᱤᱞᱚᱜ'], ['Dakay Din', 'दाकाय दिन', 'ᱫᱟᱠᱟᱭ ᱫᱤᱱ'], ['Khuntau', 'खुंटाउ', 'ᱠᱷᱩᱱᱴᱟᱣ'], ['Jale', 'जाले', 'ᱡᱟᱞᱮ'], ['Hako Katkom', 'हाको काटकोम', 'ᱦᱟᱠᱚ ᱠᱟᱴᱠᱚᱢ']];

// what each poster says. head: the big line; sub: one or two plain lines; art: how the painting sits (see CSS below).
const POSTERS = [
  { id: '1-khuntau', art: 'card', img: '/art/card.webp',
    en: { head: 'Can you snatch the pitha?', sub: 'The bull is tied to the post. The pitha is on it.<br>You have three lamps.' },
    hi: { head: 'पीठा छीन सकते हो?', sub: 'बैल खूँटे से बँधा है। पीठा उसी खूँटे पर है।<br>तुम्हारे पास तीन दीये हैं।' } },
  { id: '2-five-days', art: 'days',
    en: { head: 'Five days. One festival.', sub: 'Keep all five days of Sohrai in your own village.' },
    hi: { head: 'पाँच दिन। एक पर्व।', sub: 'सोहराय के पाँचों दिन अपने गाँव में मनाओ।' } },
  { id: '3-village', art: 'scene', img: '/art/complete.webp', py: -212, // py: which rows of the painting show in the frame
    en: { head: 'Play for your village', sub: 'Every pitha you snatch counts for your village.<br>Which village leads today?' },
    hi: { head: 'अपने गाँव के लिए खेलो', sub: 'तुम्हारा हर पीठा गाँव के नाम।<br>आज कौन सा गाँव सबसे आगे है?' } },
  { id: '4-johar', art: 'scene', img: '/art/day4.webp', py: -372, greet: true,
    en: { head: 'Sohrai Johar!', sub: 'Play Sohrai, the game of<br>the Santal harvest festival.' },
    hi: { head: 'सोहराय जोहार!', sub: 'सोहराय खेलो: संताल फसल पर्व का खेल।' } },
];
const FOOT = { en: ['Free · plays in your browser · nothing to download', 'Play at'], hi: ['मुफ़्त · ब्राउज़र में चलता है · डाउनलोड नहीं', 'यहाँ खेलो'] };

const page = (P, lang) => { const T = P[lang], hi = lang === 'hi';
  const days = DAYS.map((d, i) => `<figure class="d d${i + 1}"><img src="/art/day${i + 1}.webp"><figcaption><i lang="sat">${d[2]}</i><b>${hi ? d[1] : d[0]}</b></figcaption></figure>`).join('');
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><link rel="stylesheet" href="/fonts/fonts.css"><style>
@font-face{font-family:'Rubik Dirt';src:url(/fonts/rubik-dirt-latin.woff2) format('woff2')} /* the game registers this one from JS */
@font-face{font-family:'Baloo Deva';src:url(${deva}) format('woff2');font-weight:400 800}
html,body{margin:0;width:1080px;height:1920px;overflow:hidden;background:#2c2e30;color:#f6eedd;font-family:'Baloo 2','Baloo Deva',sans-serif}
canvas{position:absolute;inset:0}
/* WhatsApp lays its own bars over a status: the name at the top, the reply field at the foot. Nothing that must be read
   sits in the top 190 px or the bottom 160 px: the lime wash and the foot of the ochre are left to them. */
.frame{position:absolute;left:0;right:0;top:196px;height:1346px;overflow:hidden}   /* the charcoal band, inside its borders: the painting's faded edge must not lie on the scallops */
.art{position:absolute;left:0;top:-16px;width:1080px;-webkit-mask-image:linear-gradient(to bottom,transparent 0,#000 6%,#000 90%,transparent 100%)}
.pic{position:absolute;left:60px;top:468px;width:960px;height:790px;box-sizing:border-box;border-radius:24px;border:5px solid #eaa2a6;background-color:#2c2e30;background-repeat:no-repeat;background-size:960px auto;box-shadow:0 14px 40px rgba(0,0,0,.55)}
.top{position:absolute;left:0;right:0;top:200px;text-align:center}
.ol{font:600 50px/1.2 'Noto Sans Ol Chiki';color:#ffb347;letter-spacing:.06em}
h1{margin:0;font:400 172px/.95 'Rubik Dirt';color:#f6eedd;text-shadow:0 8px 0 #b5462a,0 18px 44px rgba(0,0,0,.65)}
.days h1{font-size:150px}
.greet h1{font-size:120px;line-height:1.22} .greet.hi h1{font:800 126px/1.3 'Baloo Deva';text-shadow:0 6px 0 #b5462a,0 14px 40px rgba(0,0,0,.65)}
.say{position:absolute;left:54px;right:54px;text-align:center}
.head{font:400 80px/1.06 'Rubik Dirt';color:#ffb347;text-shadow:0 5px 0 #7a2a14,0 10px 30px rgba(0,0,0,.7)}
.hi .head{font:800 84px/1.2 'Baloo Deva'}
.sub{margin-top:18px;font:700 40px/1.32 'Baloo 2','Baloo Deva';color:#f6eedd;text-shadow:0 3px 14px rgba(0,0,0,.85)}
.hi .sub{font-weight:600;font-size:42px;line-height:1.42}
.card .say{top:1176px} .scene .say{top:1292px} .days .say{top:420px} .greet .say{top:1300px}
.days .head{font-size:72px;white-space:nowrap} .days.hi .head{font-size:78px}
.greet .sub{font-size:46px;line-height:1.36} .greet .pic{height:850px} .greet .say{top:1356px} /* a greeting has one line under it: the picture takes the room */
.tiles{position:absolute;left:0;right:0;top:640px;display:grid;grid-template-columns:repeat(6,1fr);gap:22px 22px;padding:0 54px}
.d{margin:0;grid-column:span 2} .d1,.d2{grid-column:span 3}
.d img{display:block;width:100%;aspect-ratio:4/3.5;object-fit:cover;object-position:50% 52%;border-radius:16px;border:4px solid #eaa2a6;box-sizing:border-box;box-shadow:0 10px 30px rgba(0,0,0,.5)}
.d1 img,.d2 img{aspect-ratio:4/3.3}
.d figcaption{margin-top:6px;text-align:center;line-height:1.1}
.d i{display:block;font:600 27px/1.25 'Noto Sans Ol Chiki';color:#ffb347;font-style:normal;letter-spacing:.04em}
.d b{display:block;font:800 33px/1.2 'Baloo 2','Baloo Deva'}
.foot{position:absolute;left:0;right:0;top:1640px;text-align:center;color:#fbf3e4}
.foot span{display:block;font:700 30px/1.3 'Baloo 2','Baloo Deva';opacity:.92}
.foot b{display:block;margin-top:2px;font:800 46px/1.2 'Baloo 2','Baloo Deva';letter-spacing:.01em}
</style></head><body class="${P.art} ${lang} ${P.greet ? 'greet' : ''}"><canvas id="wall" width="1080" height="1920"></canvas>
${P.art === 'card' ? `<div class="frame"><img class="art" src="${P.img}"></div>` : P.img ? `<div class="pic" style="background-image:url(${P.img});background-position:0 ${P.py}px"></div><img src="${P.img}" hidden>` : `<div class="tiles">${days}</div>`}
<div class="top"><div class="ol" lang="sat">ᱥᱚᱦᱨᱟᱭ</div>${P.greet ? `<h1>${T.head}</h1>` : '<h1>Sohrai</h1>'}</div>
<div class="say">${P.greet ? '' : `<div class="head">${T.head}</div>`}<div class="sub">${T.sub}</div></div>
<div class="foot"><span>${FOOT[lang][0]}</span><b>${SITE}</b></div>
<script>
// the wall: as houseWallTex in the game, at poster size
(() => { const c = document.getElementById('wall').getContext('2d'), w = 1080, h = 1920, yTop = 150, yBot = 1606;
  const wob = (x, k) => Math.sin(x / w * 6.283 * 3 + k) * 3 + Math.sin(x / w * 6.283 * 7 + k * 2.3) * 1.8; // hand-painted edges
  const band = (y0, y1, col, k0, k1) => { c.fillStyle = col; c.beginPath(); c.moveTo(0, y0 + wob(0, k0)); for (let x = 0; x <= w; x += 8) c.lineTo(x, y0 + wob(x, k0)); for (let x = w; x >= 0; x -= 8) c.lineTo(x, y1 + wob(x, k1)); c.closePath(); c.fill(); };
  c.fillStyle = '#e8e3d8'; c.fillRect(0, 0, w, h); band(yBot, h + 8, '#bd5630', 2.1, 0); band(yTop, yBot, '#2c2e30', 0.7, 2.1);
  const pink = '#eaa2a6', white = '#f1ece2', R = 17, STEP = 40;
  { const s0 = yBot - 36; band(s0, yBot + 2, pink, 4.0, 2.1); c.strokeStyle = white; c.lineWidth = 4.5; c.beginPath(); // foot: a pink strip, a white wave, scallops rising into the black
    for (let x = 0; x <= w; x += 3) { const y = s0 + 19 + Math.sin(x / STEP * 3.1416) * 7 + wob(x, 4.0) * 0.5; x ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke();
    for (let x = STEP / 2; x < w; x += STEP) { const y = s0 + wob(x, 4.0); c.fillStyle = pink; c.beginPath(); c.arc(x, y + 2, R, Math.PI, 0); c.fill(); c.strokeStyle = white; c.lineWidth = 3.5; c.beginPath(); c.arc(x, y + 2, R, Math.PI, 0); c.stroke(); c.fillStyle = white; c.beginPath(); c.arc(x, y - 5, 3.8, 0, 7); c.fill(); } }
  { const t1 = yTop + 27; band(yTop - 2, t1, pink, 0.7, 5.2); // top: a narrower strip with white dots, scallops hanging from it
    for (let x = STEP / 2; x < w; x += STEP) { const y = t1 + wob(x, 5.2); c.fillStyle = pink; c.beginPath(); c.arc(x, y - 2, R, 0, Math.PI); c.fill(); c.strokeStyle = white; c.lineWidth = 3.5; c.beginPath(); c.arc(x, y - 2, R, 0, Math.PI); c.stroke();
      c.fillStyle = white; c.beginPath(); c.arc(x, y + 5, 3.8, 0, 7); c.fill(); c.beginPath(); c.arc(x + STEP / 2, yTop + 12 + wob(x, 0.7), 3.4, 0, 7); c.fill(); } }
  let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647; // brush grit, the same on every run
  for (let i = 0; i < 26000; i++) { const x = rnd() * w, y = rnd() * h, a = rnd(); c.fillStyle = a < .5 ? 'rgba(0,0,0,' + (0.03 + a * 0.08) + ')' : 'rgba(255,255,255,' + (0.015 + (a - .5) * 0.05) + ')'; c.fillRect(x, y, 1 + rnd() * 3.2, 1 + rnd() * 1.6); }
  const g = c.createLinearGradient(0, h - 150, 0, h); g.addColorStop(0, 'rgba(60,20,8,0)'); g.addColorStop(1, 'rgba(60,20,8,.5)'); c.fillStyle = g; c.fillRect(0, h - 150, w, 150); // the foot darkened by rain
})();
</script></body></html>`; };

const b = await puppeteer.launch({ args: ['--no-sandbox'] }), p = await b.newPage();
await p.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
await p.goto('http://127.0.0.1:8791/fonts/fonts.css'); // same origin as the fonts and the paintings
for (const P of POSTERS) for (const lang of ['en', 'hi']) {
  await p.setContent(page(P, lang), { waitUntil: 'load', timeout: 60000 });
  await p.waitForFunction(() => [...document.images].every(i => i.complete), { timeout: 30000 });
  await p.evaluate(() => Promise.all([document.fonts.load("100px 'Rubik Dirt'"), document.fonts.load("800 60px 'Baloo Deva'", 'सोहराय'), document.fonts.load("600 40px 'Baloo Deva'", 'सोहराय'), document.fonts.load("600 40px 'Noto Sans Ol Chiki'", 'ᱥᱚᱦᱨᱟᱭ'), document.fonts.load("800 40px 'Baloo 2'")]).then(() => document.fonts.ready));
  const bad = await p.evaluate(() => [...document.images].filter(i => !i.complete || !i.naturalWidth).map(i => i.src));
  if (bad.length) { console.error('a painting did not load:', bad.join(', ')); process.exit(1); }
  const file = `${OUT}/sohrai-${P.id}-${lang}.jpg`;
  await p.screenshot({ path: file, type: 'jpeg', quality: 90 });
  console.log(file, Math.round(fs.statSync(file).size / 1024) + ' KB');
}
await b.close();
