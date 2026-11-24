// Outside house walls follow Dulor's photos of a Santal house (24 Nov): white lime on top, a charcoal-black painted
// band in the middle edged with pink scallops, red ochre at the foot. Checks the bands' colours, both borders, the
// texture's seam (it repeats every 2.5 m), that the story's wall motifs sit inside the black band, and that the inside
// of the house kept its own wall; the murals on the other houses; dialogue portraits; the painted share card.
// Screenshots: walls-phone*.jpg, walls-laptop.jpg.
//   node tests/walls.mjs     (static server on 8791)
import puppeteer from 'puppeteer';
import fs from 'fs'; fs.mkdirSync('tests/out', { recursive: true });
import { check, finish, realErrors, SW } from './check.mjs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ protocolTimeout: 180000, args: [...SW, '--no-sandbox', '--mute-audio'] });
const logs = [];

async function open(view, mobile) {
  const page = await browser.newPage(); page.on('pageerror', e => logs.push(e.message));
  if (mobile) await page.emulate({ viewport: { width: 390, height: 780, deviceScaleFactor: 1, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-A346E) Mobile' });
  else await page.setViewport(view);
  await page.evaluateOnNewDocument(() => { localStorage.setItem('khuntau-name', 'Wall Test'); localStorage.setItem('khuntau-story', JSON.stringify({ ch: 5, done: 1, painted: [1, 1, 1], chosen: 1, oiled: 1, garland: 1 })); });
  await page.goto('http://127.0.0.1:8791/?debug' + (mobile ? '' : '&q=low'), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.getElementById('startBtn').dataset.village === 'ready', { timeout: 90000 });
  await page.evaluate(() => document.getElementById('startBtn').click());
  await page.waitForFunction(() => __k.game.mode === 'story' && !__k.story.debug.S.inside, { timeout: 20000 });
  await page.evaluate(() => { const d = __k.story.debug; d.S.dlg = null; document.getElementById('dlg').hidden = true; });
  return page;
}
// stand `dist` m in front of a house (or off to one side), facing it, camera trailing behind, and let it settle
const faceHouse = (page, i, dist, side = 0) => page.evaluate(async (i, dist, side) => {
  const h = __k.houses[i], d = __k.story.debug, fx = Math.sin(h.rot), fz = Math.cos(h.rot);
  __k.game.p.pos.set(h.x + fx * (h.d / 2 + dist) + fz * side, 0, h.z + fz * (h.d / 2 + dist) - fx * side);
  __k.game.p.yaw = h.rot + Math.PI; d.S.camYaw = h.rot; /* camYaw points from you to the camera */ d.S.lookT = performance.now() / 1000 + 99; d.snapCam();
  for (let k = 0; k < 6; k++) await new Promise(r => requestAnimationFrame(r));
}, i, dist, side);

const page = await open(null, true);

// 1. the texture itself: three bands, two pink borders, a seamless repeat
const t = await page.evaluate(() => {
  const img = __k.wallMat.map.image, w = img.width, h = img.height, x2 = img.getContext('2d'), Y = m => Math.round((1 - m / 2.6) * h);
  const px = (x, y) => { const d = x2.getImageData(Math.max(0, x - 2), Math.max(0, y - 2), 5, 5).data; let r = 0, g = 0, b = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; } const n = d.length / 4; return [r / n, g / n, b / n]; };
  const at = m => [40, 170, 300, 460].map(x => px(x, Y(m)));
  const pinkRow = (y0, y1) => { const d = x2.getImageData(0, y0, w, y1 - y0).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 175 && d[i] - d[i + 1] > 30 && d[i + 2] > 110 && d[i + 2] < 215) n++; return n / (d.length / 4); };
  const cls = ([r, g, b]) => r > 170 && g > 160 && b > 150 ? 'W' : r < 90 && g < 90 && b < 90 ? 'K' : r > 130 && r - b > 60 ? 'O' : '?';
  // the last column and the first one stand side by side when the texture repeats: compare those (1 px wide, 3 tall)
  const col = (x, y) => { const d = x2.getImageData(x, y - 1, 1, 3).data; return [0, 1, 2].map(k => (d[k] + d[4 + k] + d[8 + k]) / 3); };
  let seam = 0; for (let y = 2; y < h - 2; y += 2) if (cls(col(0, y)) !== cls(col(w - 1, y))) seam++;
  return { w, h, white: at(2.35), black: at(1.4), ochre: at(0.4), pinkTop: pinkRow(Y(2.06) - 2, Y(2.06) + 18), pinkBot: pinkRow(Y(0.74) - 24, Y(0.74) + 2), pinkMid: pinkRow(Y(1.6), Y(1.2)), seam: seam / ((h - 4) / 2) };
});
const all = (arr, f) => arr.every(f), fmt = a => a.map(c => c.map(v => v | 0).join(',')).join(' ');
check(all(t.white, ([r, g, b]) => r > 180 && g > 170 && b > 160), `top of the wall is white lime (${fmt(t.white)})`);
check(all(t.black, ([r, g, b]) => r < 80 && g < 80 && b < 80), `middle of the wall is the charcoal band (${fmt(t.black)})`);
check(all(t.ochre, ([r, g, b]) => r > 140 && r - b > 60 && g < 140), `foot of the wall is red ochre (${fmt(t.ochre)})`);
check(t.pinkTop > 0.25 && t.pinkBot > 0.25, `pink scalloped borders at the top and bottom of the band (${(t.pinkTop * 100) | 0}%, ${(t.pinkBot * 100) | 0}% pink)`);
check(t.pinkMid < 0.01, `no pink in the middle of the band, where the motifs go (${(t.pinkMid * 100).toFixed(1)}%)`);
check(t.seam < 0.04, `the left and right edges match, so the 2.5 m repeat shows no seam (${(t.seam * 100).toFixed(1)}% rows differ)`);

// 2. the story's three wall motifs sit inside the black band; the inside of the house has its own wall
const s = await page.evaluate(() => {
  const d = __k.story.debug, spots = d.W.spots.map(p => { const g = p.outline.geometry.parameters; return [p.outline.position.y - g.height / 2, p.outline.position.y + g.height / 2]; });
  const inMaps = []; d.W.room.traverse(o => { if (o.material && o.material.map) inMaps.push(o.material.map.image); });
  return { spots, inside: inMaps.length, insideShared: inMaps.includes(__k.wallMat.map.image) };
});
check(s.spots.length === 3 && s.spots.every(([a, b]) => a >= 0.74 && b <= 2.06), `the three wall motifs fit inside the black band 0.74-2.06 m (${s.spots.map(([a, b]) => a.toFixed(2) + '-' + b.toFixed(2)).join(', ')})`);
check(s.inside > 0 && !s.insideShared, 'the inside of the house keeps its own wall texture');

// 3. painted figures on the other houses' bands: one mesh, in the clear part of the band, clear of the door, never
//    the same panel twice in a row, lit like the wall so the panel's background melts into the band
const loaded = await page.waitForFunction(() => __k.murals, { timeout: 30000 }).then(() => true, () => false);
check(loaded, 'the house murals load');
if (loaded) {
  const m = await page.evaluate(() => { const M = __k.murals, fx = M.mesh.material.userData.fx || {}, wfx = __k.wallMat.userData.fx || {};
    return { slots: M.slots, cells: M.cells, houses: __k.houses.map(h => h.w), oneMesh: M.mesh.isMesh && !M.mesh.isInstancedMesh,
      litLikeWall: fx.eave === wfx.eave && fx.ao === wfx.ao && M.mesh.receiveShadow, inScene: !!M.mesh.parent }; });
  const sl = m.slots, bad = [];
  for (const p of sl) { if (p.house === 0) bad.push('on your own house');
    if (p.y - p.h / 2 < 0.86 || p.y + p.h / 2 > 1.96) bad.push(`house ${p.house}: outside the band's clear part`);
    if (Math.abs(p.lx) - p.w / 2 < 0.7) bad.push(`house ${p.house}: over the door`);
    if (Math.abs(p.lx) + p.w / 2 > m.houses[p.house] / 2 - 0.15) bad.push(`house ${p.house}: off the wall`); }
  check(m.oneMesh && m.inScene && sl.length >= 14, `murals: ${sl.length} panels on houses 1-8 in one mesh (one draw), ${m.cells} different paintings`);
  check(!bad.length, 'every panel sits in the band between its borders, clear of the door, on the wall' + (bad.length ? ': ' + [...new Set(bad)].join('; ') : ''));
  check(sl.every((p, i) => !i || p.cell !== sl[i - 1].cell || p.flip !== sl[i - 1].flip), 'no two panels in a row are the same painting the same way round');
  check(m.litLikeWall, 'murals are shaded and shadowed exactly like the wall (their background melts into the band)');
  const shown = new Set(sl.map(p => p.cell));
  check(shown.size === m.cells, `every painting is on some wall (${shown.size} of ${m.cells})`);
  // your own house: the three motifs you paint are the photo-based paintings, and none covers the side wall's window
  await page.waitForFunction(() => __k.story.debug.W.spots.every(s => s.art.userData.cell), { timeout: 10000 }).catch(() => {});
  const mo = await page.evaluate(() => { const nMotif = __k.murals.all.filter(c => c.use === 'motif').length;
    return { nMotif, spots: __k.story.debug.W.spots.map(s => ({ cell: s.art.userData.cell || null, side: Math.abs(s.art.rotation.y) > 0.1,
      z: s.art.position.z, w: s.art.geometry.parameters ? s.art.geometry.parameters.width : 0, lit: !!(s.art.material.userData.fx || {}).eave })) }; });
  const want = Math.min(3, mo.nMotif);
  check(mo.spots.filter(s => s.cell && s.lit).length >= want, `your house's wall motifs are the paintings, lit like the wall (${mo.spots.map(s => s.cell || 'clip art').join(', ')})`);
  const side = mo.spots.filter(s => s.side);
  check(side.every(s => Math.abs(s.z) - s.w / 2 > 0.33), `the side-wall motif stays clear of the window (${side.map(s => (Math.abs(s.z) - s.w / 2).toFixed(2) + ' m from its middle').join(', ')})`);
}

// 4. portraits over the dialogue box for Gogo, the Majhi and the Elder (and none for anyone else); the share card
//    drawn on the painting of the Khuntau, title above the painted strip and score below it
const faces = [];
for (const who of ['Gogo', 'Majhi', 'Elder', 'Someone']) {
  await page.evaluate(w => __k.story.debug.say([[w, 'Johar! The bull is ready.']]), who); await sleep(500);
  faces.push(await page.evaluate(() => { const f = document.getElementById('dlgFace'), b = f.getBoundingClientRect();
    return { shown: !f.hidden && b.width > 40, img: (getComputedStyle(f).backgroundImage.match(/face-(\w+)/) || [])[1], top: b.top, w: b.width }; }));
}
await page.screenshot({ path: 'tests/out/walls-phone-portrait.jpg', type: 'jpeg', quality: 75 }).catch(() => {});
check(['gogo', 'majhi', 'elder'].every((n, i) => faces[i].shown && faces[i].img === n) && !faces[3].shown,
  `dialogue portraits: Gogo, Majhi, Elder each show their own painting, nobody else gets one (${faces.map(f => f.shown ? f.img : '-').join(', ')})`);
check(faces.slice(0, 3).every(f => f.top >= 0), 'the portraits are fully on screen');
await page.evaluate(() => { __k.story.debug.S.dlg = null; document.getElementById('dlg').hidden = true; });
const card = await page.evaluate(async () => { const bl = await __k.scoreCard(27, 'Khunt Hero'), im = await createImageBitmap(bl), c = new OffscreenCanvas(im.width, im.height), x = c.getContext('2d'); x.drawImage(im, 0, 0);
  const at = (px, py) => Array.from(x.getImageData(px, py, 1, 1).data.slice(0, 3)); // the painted bull's white body sits in the middle strip
  let white = 0; for (let yy = 560; yy < 800; yy += 8) for (let xx = 380; xx < 700; xx += 8) { const [r, g, b] = at(xx, yy); if (r > 200 && g > 200 && b > 200) white++; }
  return { w: im.width, h: im.height, white, art: (await fetch('art/card.webp')).ok }; });
check(card.w === 1080 && card.h === 1350 && card.art && card.white > 40, `share card: 1080x1350 on the Khuntau painting (${card.white} white bull pixels in the strip)`);

// 5. look at it: the home house with its painted motifs, a painted neighbour, one from an angle, and on a laptop
await faceHouse(page, 1, 5); await sleep(300);
await page.screenshot({ path: 'tests/out/walls-phone-murals.jpg', type: 'jpeg', quality: 75 });
await faceHouse(page, 0, 4.5); await sleep(300);
await page.screenshot({ path: 'tests/out/walls-phone-motifs.jpg', type: 'jpeg', quality: 75 });
await faceHouse(page, 2, 6, 3); await sleep(300);
await page.screenshot({ path: 'tests/out/walls-phone.jpg', type: 'jpeg', quality: 75 });
const lap = await open({ width: 1280, height: 720 }, false);
await faceHouse(lap, 4, 7, 2); await sleep(300);
await lap.screenshot({ path: 'tests/out/walls-laptop.jpg', type: 'jpeg', quality: 75 });

check(!realErrors(logs).length, 'no page errors' + (realErrors(logs).length ? ': ' + realErrors(logs).slice(0, 3).join(' | ') : ''));
await finish(browser);
