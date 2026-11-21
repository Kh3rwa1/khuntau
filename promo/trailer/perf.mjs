import fs from 'fs'; import { boot } from './boot.mjs';
const { browser, page } = await boot(1280, 720);
await page.evaluate(() => { const T = __T; T.game.mode = 'play'; T.camLock = true; T.camera.position.set(6, 2.5, 9); T.camera.lookAt(0, 1.2, 0); });
const t0 = Date.now(); let jpg;
for (let i = 0; i < 10; i++) jpg = await page.evaluate(() => { __step(1000 / 30); return __T.renderer.domElement.toDataURL('image/jpeg', 0.92); });
console.log('ms/frame at', await page.evaluate(() => __T.renderer.domElement.width + 'x' + __T.renderer.domElement.height), (Date.now() - t0) / 10);
fs.writeFileSync('./frames/perf.jpg', Buffer.from(jpg.split(',')[1], 'base64'));
console.log(page.logs.join('\n') || 'no errors'); await browser.close();
