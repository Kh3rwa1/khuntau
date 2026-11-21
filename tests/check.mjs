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
