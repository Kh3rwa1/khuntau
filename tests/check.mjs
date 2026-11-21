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
