// Stills for trying camera placements quickly: node promo/brag/look.mjs <name> '<js returning [[label, setupJs], ...]>'
import { open } from './film.mjs';
import fs from 'fs';
const [name, listJs] = process.argv.slice(2);
const { browser, page } = await open();
const pre = process.env.PRE; // optional JS run once first (e.g. start the ring)
if (pre) await page.evaluate(new Function('return (async () => {' + pre + '})()'));
for (let i = 0; i < (+process.env.WARM || 40); i++) await page.evaluate(() => __step(1000 / 30));
const list = await page.evaluate(new Function('return ' + listJs));
fs.mkdirSync('brag-output/work/look', { recursive: true });
for (const [label, js] of list) {
  await page.evaluate(new Function(js)); for (let i = 0; i < (+process.env.N || 3); i++) await page.evaluate(() => __step(1000 / 30));
  await page.screenshot({ path: `brag-output/work/look/${name}-${label}.jpg`, type: 'jpeg', quality: 80 }); console.log(label);
}
console.log(JSON.stringify(await page.evaluate(() => { const s = __k.sun.position; return { sun: [s.x, s.y, s.z].map(v => +v.toFixed(1)), az: +Math.atan2(s.x, s.z).toFixed(2) }; })));
if (page.logs.length) console.log(page.logs.join('\n'));
await browser.close();
