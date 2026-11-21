// Tiny assert helper for the puppeteer tests: every check prints, and the run exits 1 if any failed.
const fails = [];
export function check(ok, msg) {
  console.log((ok ? 'ok   ' : 'FAIL ') + msg);
  if (!ok) fails.push(msg);
  return ok;
}
// Page errors that come from the headless environment, not the game.
export const realErrors = logs => logs.filter(l => !/404|GPU|WebGL|ERR_FAILED|GroupMarker|swiftshader|Failed to load resource/i.test(l));
export async function finish(browser) {
  if (browser) await browser.close();
  if (fails.length) { console.log(`\n${fails.length} check(s) failed:\n- ` + fails.join('\n- ')); process.exit(1); }
  process.exit(0);
}
// Hindi mode: record any English words that appear in the story UI. Call before page.goto; read with latinSeen(page).
export async function watchLatin(page) {
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('khuntau-lang', 'hi');
    window.__latin = new Set();
    const ok = /^(XP|E|Q|WASD|Space|Johar|Khuntau|Sohrai|OK)$/; // key names and brand words // brand/proper words allowed in any language
    const scan = (el) => { if (!document.documentElement.classList.contains('story-on') && !(window.__k && __k.game.storyRun && __k.game.mode === 'play')) return;
      for (const id of ['hideBtn', 'rollBtn', 'grabBtn', 'toast', 'pop', 'hint', 'dlg', 'objText', 'actBtn', 'prompt', 'tapHint', 'tapScore', 'judgeT', 'judgeU', 'pick', 'pads', 'beatCount', 'tapQuit']) {
        const e = document.getElementById(id); if (!e || e.hidden || getComputedStyle(e).display === 'none') continue;
        const words = (e.innerText || '').match(/[A-Za-z][A-Za-z']{2,}/g) || [];
        for (const w of words) if (!ok.test(w)) window.__latin.add(id + ': ' + e.innerText.replace(/\s+/g, ' ').trim().slice(0, 90));
      } };
    addEventListener('DOMContentLoaded', () => new MutationObserver(() => scan()).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['hidden', 'class'] }));
  });
}
export const latinSeen = (page) => page.evaluate(() => [...window.__latin]);
// Chrome flags for machines without a GPU (CI): SWGL=1 renders WebGL in software.
export const SW = process.env.SWGL ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [];
// Archery like a player: drag on the screen to put the crosshair on (tu, tv) metres from the bull, wait for the sway
// to bring it close, let go. Real pointer events on #tapzone. Returns the aim error at release, in metres.
export function dragShoot(page, tu = 0, tv = 0, tol = 0.08) {
  return page.evaluate((tu, tv, tol) => new Promise((done, fail) => {
    const a = __k.story.debug.arch, z = document.getElementById('tapzone'), x0 = innerWidth * 0.5, y0 = innerHeight * 0.75;
    const fire = (type, x, y) => z.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch', clientX: x, clientY: y, isPrimary: true }));
    const start = performance.now();
    (function ready() { if (a.fly || a.wait > 0) return requestAnimationFrame(ready);
      fire('pointerdown', x0, y0); const ppm = a.ppm; fire('pointermove', x0 + (tu - a.u) * ppm, y0 - (tv - a.v) * ppm);
      (function hold() { const e = Math.hypot(a.u + a.su - tu, a.v + a.sv - tv);
        if (e < tol || performance.now() - start > 6000) { const n = a.n; fire('pointerup', x0, y0); (function shot() { a.n > n ? done(e) : requestAnimationFrame(shot); })(); } else requestAnimationFrame(hold); })();
    })();
  }), tu, tv, tol);
}
