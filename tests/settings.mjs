// The pause menu as a settings card (25 Nov): look speed, sound and music sliders that do what they say and are
// remembered, how-to-play for the place you paused in, Hindi, and photo mode (the world stands still, the camera is
// yours, the picture comes framed like a Santal wall).
//   node tests/settings.mjs     (static server on 8791)
import puppeteer from 'puppeteer';
import fs from 'fs'; fs.mkdirSync('tests/out', { recursive: true });
import { check, finish, realErrors, SW } from './check.mjs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ protocolTimeout: 240000, args: [...SW, '--no-sandbox', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
const logs = [];
async function boot({ w = 390, h = 780, touch = true, lang = 'en', set = null, tag = '' } = {}) {
  const page = await browser.newPage(); page.on('pageerror', e => logs.push(tag + ': ' + e.message));
  if (touch) await page.emulate({ viewport: { width: w, height: h, deviceScaleFactor: 1, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-A346E) Mobile' }); else await page.setViewport({ width: w, height: h });
  await page.evaluateOnNewDocument((lang, set) => { if (!sessionStorage.getItem('t-once')) { sessionStorage.setItem('t-once', '1'); localStorage.setItem('khuntau-seen-tips', '1'); localStorage.setItem('khuntau-lang', lang); localStorage.setItem('khuntau-story', JSON.stringify({ ch: 3, w: 1, kh: 1, painted: [1, 1, 1], chosen: 1, oiled: 1, garland: 1 })); if (set) localStorage.setItem('khuntau-set', set); } }, lang, set);
  const ev = (f, ...a) => page.evaluate(f, ...a), until = (f, ms = 30000, ...a) => page.waitForFunction(f, { timeout: ms, polling: 50 }, ...a).then(() => true, () => false);
  const load = async () => { await page.goto('http://127.0.0.1:8791/?debug&q=low', { waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => document.getElementById('startBtn').dataset.village === 'ready', { timeout: 120000 }); };
  const village = async () => { await ev(() => document.getElementById('startBtn').click()); await until(() => __k.game.mode === 'story'); await sleep(2300); await ev(() => { const d = __k.story.debug; d.S.dlg = null; document.getElementById('dlg').hidden = true; d.S.mode = 'walk'; __k.game.p.pos.set(0, 0, 14); d.S.camYaw = 0; d.snapCam(); }); await sleep(500); };
  const pause = async () => { await ev(() => document.getElementById('pauseBtn').click()); await until(() => !document.getElementById('pauseScreen').hidden, 5000); await sleep(250); };
  const slide = (id, v) => ev((id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, id, v);
  // a real finger (or the mouse) dragged across the right half of the screen
  const drag = async (dx, dy = 0) => { const x0 = w * 0.7, y0 = h * 0.42; if (touch) { const cdp = await page.target().createCDPSession(), tp = (t, x, y) => cdp.send('Input.dispatchTouchEvent', { type: t, touchPoints: t === 'touchEnd' ? [] : [{ x, y, id: 3 }] }); await tp('touchStart', x0, y0); for (let i = 1; i <= 10; i++) { await tp('touchMove', x0 + dx * i / 10, y0 + dy * i / 10); await sleep(20); } await tp('touchEnd'); await cdp.detach(); }
    else { await page.mouse.move(x0, y0); await page.mouse.down(); for (let i = 1; i <= 10; i++) { await page.mouse.move(x0 + dx * i / 10, y0 + dy * i / 10); await sleep(20); } await page.mouse.up(); } await sleep(150); };
  await load();
  return { page, ev, until, load, village, pause, slide, drag, w, h };
}
const card = (ev) => ev(() => { const c = document.querySelector('.pcard').getBoundingClientRect(), o = document.getElementById('pauseScreen'), vis = id => { const e = document.getElementById(id); return !!e && !e.hidden && e.offsetParent !== null; };
  const rows = [...document.querySelectorAll('#setBox .set')].filter(e => !e.hidden).map(e => e.getBoundingClientRect()), ok = rows.every(r => r.left >= c.left - 1 && r.right <= c.right + 1);
  return { left: Math.round(c.left), right: Math.round(c.right), top: Math.round(c.top), bottom: Math.round(c.bottom), vw: innerWidth, vh: innerHeight, scroll: o.scrollHeight - o.clientHeight, rows: rows.length, rowsIn: ok, resume: vis('resumeBtn'), quit: vis('quitBtn'), look: vis('setLook'), snd: vis('setSnd'), mus: vis('setMus'), how: vis('howBtn'), photo: vis('photoBtn'), seen: vis('seenBtn'), lang: vis('langBtn'), thumb: document.getElementById('setLook').getBoundingClientRect().height }; });

/* ---------- phone: the card, the sliders, how to play, photo ---------- */
{ const P = await boot({ tag: 'phone' }), { page, ev, until } = P;
  await P.village(); await P.pause();
  const c = await card(ev);
  check(c.left >= 0 && c.right <= c.vw && c.top >= 0 && (c.bottom <= c.vh || c.scroll > 0) && c.rowsIn, `phone: the card is on the screen (${c.left}..${c.right} of ${c.vw}, ${c.top}..${c.bottom} of ${c.vh})`);
  check(c.resume && c.quit && c.look && c.snd && c.mus && c.how && c.photo && c.seen && c.lang && c.rows >= 4, `it has Resume, Photo, the things seen, How to play, look speed, sound, music, language, Quit (${JSON.stringify(c)})`);
  check(c.thumb >= 30, `the sliders are tall enough for a thumb (${c.thumb} px)`);
  const def = await ev(() => ({ look: __k.SET.look, snd: __k.SET.snd, mus: __k.SET.mus, v: [document.getElementById('setLookV').textContent, document.getElementById('setSndV').textContent, document.getElementById('setMusV').textContent], mid: +document.getElementById('setLook').value }));
  check(def.look === 1 && def.snd === 1 && def.mus === 1 && def.v.join() === '100%,100%,100%' && def.mid === 0, `a new player starts at 100% everywhere, look speed in the middle of its track (${JSON.stringify(def)})`);
  await page.screenshot({ path: 'tests/out/set-phone.jpg', type: 'jpeg', quality: 78 });
  // how to play: the village's lines, for touch
  await page.tap('#howBtn'); await sleep(200);
  const how = await ev(() => ({ shown: !document.getElementById('howList').hidden, n: document.querySelectorAll('#howList li').length, t: document.getElementById('howList').textContent }));
  check(how.shown && how.n >= 4 && /JUMP/.test(how.t) && /cut grass and paddy/.test(how.t) && !/WASD|Space/.test(how.t), `How to play opens with the village's buttons, in touch words (${how.n} lines)`);
  await page.screenshot({ path: 'tests/out/set-phone-how.jpg', type: 'jpeg', quality: 78 }); await page.tap('#howBtn');

  // look speed: the same drag turns the camera further
  await ev(() => document.getElementById('resumeBtn').click()); await sleep(400);
  const turn = async () => { const a = await ev(() => __k.story.debug.S.camYaw); await P.drag(-80); return Math.abs(await ev(() => __k.story.debug.S.camYaw) - a); };
  const t1 = await turn(); await P.pause(); await P.slide('setLook', 10); const s1 = await ev(() => ({ look: __k.SET.look, txt: document.getElementById('setLookV').textContent, saved: JSON.parse(localStorage.getItem('khuntau-set')).look }));
  await ev(() => document.getElementById('resumeBtn').click()); await sleep(400); const t2 = await turn();
  await P.pause(); await P.slide('setLook', -10); const s0 = await ev(() => __k.SET.look); await ev(() => document.getElementById('resumeBtn').click()); await sleep(400); const t3 = await turn();
  await P.pause(); await P.slide('setLook', 0); await ev(() => document.getElementById('resumeBtn').click()); await sleep(300); // back to 100% for what follows
  check(s1.look === 2.5 && s1.txt === '250%' && s1.saved === 2.5 && s0 === 0.4, `the look slider runs from 40% to 250% and is saved (${JSON.stringify(s1)}, low end ${s0})`);
  check(t1 > 0.3 && Math.abs(t2 / t1 - 2.5) < 0.15 && Math.abs(t3 / t1 - 0.4) < 0.05, `village camera: an 80 px drag turns ${t1.toFixed(2)} rad at 100%, ${t2.toFixed(2)} at 250%, ${t3.toFixed(2)} at 40%`);

  // sound and music
  await P.pause(); await ev(() => __k.audio.ctx || document.getElementById('muteBtn'));
  const au = await ev(async () => { const k = __k, out = {}; const set = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
    out.ctx = !!k.audio.ctx; out.m100 = k.audio.master ? k.audio.master.gain.value : null; set('setSnd', 50); out.m50 = k.audio.master ? k.audio.master.gain.value : null; out.s50 = k.SET.snd; out.t50 = document.getElementById('setSndV').textContent;
    set('setSnd', 0); out.m0 = k.audio.master ? k.audio.master.gain.value : null; set('setSnd', 100);
    document.getElementById('muteBtn').click(); out.muted = k.audio.muted; out.mm = k.audio.master ? k.audio.master.gain.value : null; document.getElementById('pauseScreen').hidden = false; set('setSnd', 60); out.unmuted = !k.audio.muted; out.m60 = k.audio.master ? k.audio.master.gain.value : null; set('setSnd', 100);
    const bed = k.BED.village; set('setMus', 200); out.mus2 = k.SET.mus; out.vol2 = k.MUSIC_VOL.game; out.bed = bed; set('setMus', 0); out.mus0 = k.SET.mus; set('setMus', 100); out.saved = JSON.parse(localStorage.getItem('khuntau-set')); return out; });
  check(au.ctx && Math.abs(au.m100 - 0.8) < 1e-6 && Math.abs(au.m50 - 0.4) < 1e-6 && au.m0 === 0 && au.t50 === '50%', `sound: the slider is the overall volume (master ${au.m100} at 100%, ${au.m50} at 50%, ${au.m0} at 0)`);
  check(au.muted && au.mm === 0 && au.unmuted && Math.abs(au.m60 - 0.48) < 1e-6, 'sound: muted with the speaker button, moving the slider up unmutes');
  check(au.mus2 === 2 && au.mus0 === 0 && au.vol2 === au.bed && au.saved.snd === 1 && au.saved.mus === 1, `music: its own level, 0 to 200%, on top of the bed the game sets (the bed itself stays ${au.bed})`);
  check(await ev(async () => { const k = __k, set = (v) => { const el = document.getElementById('setMus'); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }; if (!k.music.game._g) return 'no gain node';
    set(200); await new Promise(r => setTimeout(r, 700)); const hi = k.music.game._g.gain.value; set(0); await new Promise(r => setTimeout(r, 700)); const lo = k.music.game._g.gain.value; set(100); return hi > k.BED.village * 1.6 && lo < 0.004 ? true : `hi ${hi} lo ${lo}`; }) === true, 'music: the track itself gets louder and falls silent with the slider');

  // photo mode
  check(await ev(() => !document.getElementById('photoBtn').hidden), 'photo: the pause menu offers it');
  const marker0 = await ev(() => __k.story.debug.W.marker.visible);
  await page.tap('#photoBtn'); check(await until(() => __k.photo && __k.photo.isOpen(), 15000), 'photo: opens'); await sleep(600);
  const ph0 = await ev(() => { const hid = id => { const e = document.getElementById(id); return !e || e.hidden || getComputedStyle(e).visibility === 'hidden' || e.offsetParent === null; }; const w = document.querySelector('#photoUi .pf-win').getBoundingClientRect(), b = document.querySelector('#photoUi .pf-band').getBoundingClientRect(), s = document.getElementById('photoShot').getBoundingClientRect();
    return { hud: ['hudStory', 'pauseBtn', 'muteBtn', 'actBtn', 'jumpBtn', 'talkHud', 'pauseScreen', 'hint'].filter(id => !hid(id)), mode: __k.game.mode, win: [Math.round(w.left), Math.round(w.top), Math.round(w.width), Math.round(w.height)], inView: w.left >= 0 && w.right <= innerWidth && w.top >= 0 && b.bottom < s.top, ratio: w.width / (w.height + b.height), marker: __k.story.debug.W.marker.visible, yaw: __k.photo.state.yaw, want: __k.photo.state.want }; });
  check(ph0.hud.length === 0 && ph0.mode === 'paused' && !ph0.marker, `photo: the world stands still and nothing of the game's buttons or the objective beam is left on screen (${ph0.hud.join(' ') || 'none'})`);
  check(ph0.inView && Math.abs(ph0.ratio - 1080 / 1350) < 0.01, `photo: the window and its band are on the screen above the shutter, in the picture's own 4:5 shape (${ph0.win})`);
  await P.drag(-110, 30); const ph1 = await ev(() => ({ yaw: __k.photo.state.yaw, pitch: __k.photo.state.pitch }));
  check(Math.abs(ph1.yaw - ph0.yaw) > 0.5, `photo: a drag swings the camera round you (${ph0.yaw.toFixed(2)} -> ${ph1.yaw.toFixed(2)})`);
  // all the way round, next to a house: the camera never ends up inside a wall
  const clear = await ev(async () => { const k = __k, st = k.photo.state, h = k.houses[2], hr = Math.hypot(h.x, h.z); let bad = 0, n = 0; k.photo.close(); k.game.p.pos.set(h.x * (hr - h.d / 2 - 1.6) / hr, 0, h.z * (hr - h.d / 2 - 1.6) / hr); document.getElementById('pauseScreen').hidden = false; k.openPhoto(); await new Promise(r => setTimeout(r, 400)); st.want = 9;
    for (let a = 0; a < 6.28; a += 0.26) { st.yaw = a; await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); n++; if (!k.story.sight(st.target, k.camera.position)) bad++; } return { bad, n, open: k.photo.isOpen() }; });
  check(clear.open && clear.bad === 0, `photo: turned all the way round beside a house, the camera is never behind a wall (${clear.bad} of ${clear.n} directions blocked)`);
  await ev(() => { __k.photo.state.yaw = Math.atan2(-__k.game.p.pos.x, -__k.game.p.pos.z) + 0.5; __k.photo.state.want = 7; __k.photo.state.pitch = 0.28; }); await sleep(300);
  await page.screenshot({ path: 'tests/out/set-photo-phone.jpg', type: 'jpeg', quality: 78 });
  await page.tap('#photoShot'); check(await until(() => !document.getElementById('photoPrev').hidden && document.getElementById('photoImg').naturalWidth > 0, 15000), 'photo: the shutter brings the picture up');
  const shot = await ev(async () => { const s = __k.photo.state.shot, img = document.getElementById('photoImg'), c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const px = (x, y) => [...g.getImageData(x, y, 1, 1).data].slice(0, 3), near = (p, q, t = 26) => p.every((v, i) => Math.abs(v - q[i]) <= t);
    // the photo is a picture of the game (not one flat colour), the band is charcoal, the foot red ochre
    const samp = []; for (let i = 0; i < 40; i++) samp.push(px(40 + i * 25, 200 + (i * 37) % 900)); const mean = [0, 1, 2].map(j => samp.reduce((a, p) => a + p[j], 0) / samp.length), spread = samp.reduce((a, p) => a + Math.abs(p[0] - mean[0]) + Math.abs(p[1] - mean[1]) + Math.abs(p[2] - mean[2]), 0) / samp.length;
    const buf = await s.blob.arrayBuffer(); let bin = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 8192) bin += String.fromCharCode(...u.subarray(i, i + 8192));
    return { w: c.width, h: c.height, kb: Math.round(s.blob.size / 1024), spread: Math.round(spread), band: near(px(700, 1350 - 174 + 60), [43, 39, 36]), foot: near(px(540, 1344), [162, 58, 34]), b64: btoa(bin), share: document.getElementById('photoShare').textContent, again: document.getElementById('photoAgain').textContent }; });
  fs.writeFileSync('tests/out/set-photo-card.jpg', Buffer.from(shot.b64, 'base64'));
  check(shot.w === 1080 && shot.h === 1350 && shot.kb > 40 && shot.kb < 900, `photo: a 1080 x 1350 picture, ${shot.kb} KB`);
  check(shot.spread > 12 && shot.band && shot.foot, `photo: the game is in it (colour spread ${shot.spread}), framed with the charcoal band and the red ochre foot of a Santal wall`);
  check(/Share|Save/.test(shot.share) && shot.again === 'Another', `photo: Share or Save, and Another ('${shot.share}', '${shot.again}')`);
  await page.screenshot({ path: 'tests/out/set-photo-preview.jpg', type: 'jpeg', quality: 78 });
  // Android back / Escape: first the picture, then photo mode, then the menu is back; Resume plays on
  const b1 = await ev(() => window.__appBack()), p1 = await ev(() => ({ prev: !document.getElementById('photoPrev').hidden, on: __k.photo.isOpen() })), b2 = await ev(() => window.__appBack()); await sleep(200);
  const p2 = await ev(() => ({ on: __k.photo.isOpen(), pause: !document.getElementById('pauseScreen').hidden, cls: document.documentElement.classList.contains('photo-on'), marker: __k.story.debug.W.marker.visible, mode: __k.game.mode }));
  check(b1 && !p1.prev && p1.on && b2 && !p2.on && p2.pause && !p2.cls && p2.marker === marker0 && p2.mode === 'paused', `photo: back closes the picture, then photo mode; the menu returns, the buttons and the beam too (${JSON.stringify(p2)})`);
  await ev(() => document.getElementById('resumeBtn').click()); await sleep(500);
  check(await ev(() => __k.game.mode === 'story' && document.getElementById('pauseScreen').hidden && getComputedStyle(document.getElementById('hudStory')).visibility !== 'hidden'), 'Resume: the game goes on, its buttons are back');

  // archery: the crosshair follows the same setting
  { await ev(() => { const a = 0.35 + 0.698132 * 1.5; __k.game.p.pos.set(Math.cos(a) * 18.5, 0, Math.sin(a) * 18.5); }); const got = await until(() => document.getElementById('actBtn').textContent === 'SHOOT', 8000); if (got) { await page.tap('#actBtn'); await until(() => __k.story.debug.S.mode === 'aim', 8000); await sleep(1600); }
    const pull = () => ev(() => { const a = __k.story.debug.arch, z = document.getElementById('tapzone'), fire = (t, x, y) => z.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, pointerId: 9, pointerType: 'touch', clientX: x, clientY: y, isPrimary: true }));
      a.u = 0; a.v = 0; fire('pointerdown', 200, 500); const u0 = a.u; fire('pointermove', 240, 500); const du = a.u - u0; fire('pointercancel', 240, 500); return du * a.ppm; });
    const a1 = got ? await pull() : 0; await ev(() => { __k.SET.look = 2.5; }); const a2 = got ? await pull() : 0; await ev(() => { __k.SET.look = 1; });
    check(got && Math.abs(a1 - 40) < 2 && Math.abs(a2 - 100) < 4, `archery: a 40 px drag moves the crosshair ${a1.toFixed(0)} px at 100% and ${a2.toFixed(0)} px at 250%`);
    await ev(() => document.getElementById('tapQuit').click()); await sleep(600); }

  // remembered after a reload
  await P.pause(); await P.slide('setLook', 5); await P.slide('setSnd', 70); await P.slide('setMus', 150); await P.load();
  const re = await ev(() => ({ ...__k.SET })); check(Math.abs(re.look - 1.6) < 0.06 && re.snd === 0.7 && re.mus === 1.5, `the settings are remembered after a reload (${JSON.stringify(re)})`);
  await ev(() => localStorage.setItem('khuntau-set', '{"look":99,"snd":"x","mus":-4}')); await P.load();
  const bad = await ev(() => ({ ...__k.SET })); check(bad.look === 1 && bad.snd === 1 && bad.mus === 1, 'a broken saved setting falls back to 100%');
  await ev(() => localStorage.removeItem('khuntau-set'));

  // the ring: its own how-to, the camera drag follows the look speed, photo there too
  await P.load(); await ev(() => document.getElementById('quickBtn').click()); await until(() => __k.game.mode === 'play'); await sleep(1500);
  const rturn = async () => { const a = await ev(() => __k.view.yaw || 0); await P.drag(-80); return Math.abs((await ev(() => __k.view.yaw || 0)) - a); };
  const r1 = await rturn(); await P.pause(); const rc = await card(ev); await page.tap('#howBtn'); const rh = await ev(() => document.getElementById('howList').textContent); await page.screenshot({ path: 'tests/out/set-ring.jpg', type: 'jpeg', quality: 78 });
  await P.slide('setLook', 10); await ev(() => document.getElementById('resumeBtn').click()); await sleep(300); const r2 = await rturn();
  check(/HIDE/.test(rh) && /ROLL/.test(rh) && /GRAB/.test(rh) && /LEAVE/.test(rh) && !/JUMP/.test(rh), 'ring: How to play lists HIDE, ROLL, GRAB, LEAVE');
  check(rc.photo && !rc.seen && !rc.lang && rc.left >= 0 && rc.right <= rc.vw, `ring: the card offers Photo; no language or things-seen row there (${JSON.stringify({ photo: rc.photo, seen: rc.seen, lang: rc.lang })})`);
  check(r1 > 0.3 && Math.abs(r2 / r1 - 2.5) < 0.15, `ring camera: the same drag turns ${r1.toFixed(2)} rad at 100% and ${r2.toFixed(2)} at 250%`);
  await P.pause(); await P.slide('setLook', 0); await page.tap('#photoBtn'); await until(() => __k.photo && __k.photo.isOpen(), 15000); await sleep(500); await page.screenshot({ path: 'tests/out/set-photo-ring.jpg', type: 'jpeg', quality: 78 });
  check(await ev(() => __k.photo.isOpen() && __k.game.mode === 'paused'), 'ring: photo mode opens on a frozen round'); await ev(() => { __k.photo.close(); document.getElementById('quitBtn').click(); }); await sleep(500);
  check(await ev(() => __k.game.mode === 'menu' && !document.documentElement.classList.contains('photo-on')), 'Quit from the menu after a photo: home screen, nothing left hidden');
  await page.close(); }

/* ---------- the card on a small phone, a phone on its side, a laptop; Hindi ---------- */
for (const [tag, o] of [['small', { w: 360, h: 640 }], ['land', { w: 780, h: 390 }], ['laptop', { w: 1280, h: 720, touch: false }], ['hindi', { w: 390, h: 780, lang: 'hi' }]]) {
  const P = await boot({ ...o, tag }), { page, ev, until } = P; await P.village(); await P.pause();
  const c = await card(ev);
  check(c.left >= 0 && c.right <= c.vw && c.top >= 0 && c.rowsIn && c.resume && c.look && c.quit && (c.bottom <= c.vh || c.scroll > 0), `${tag}: the card fits the screen's width and can be reached to its foot (${c.left}..${c.right} of ${c.vw}, ${c.top}..${c.bottom} of ${c.vh}${c.scroll > 0 ? ', scrolls ' + c.scroll + ' px' : ''})`);
  if (tag === 'land') check(await ev(() => { const a = document.querySelector('.pc-a').getBoundingClientRect(), s = document.querySelector('.pc-s').getBoundingClientRect(); return s.left >= a.right - 2 && Math.abs(s.top - a.top) < 40; }), 'land: two columns, the settings beside Resume');
  if (tag === 'laptop') { await ev(() => document.getElementById('howBtn').click()); const t = await ev(() => document.getElementById('howList').textContent); check(/WASD/.test(t) && /Space: jump/.test(t) && !/Pinch/.test(t), 'laptop: How to play speaks of keys and the mouse');
    await ev(() => { document.getElementById('setLook').focus(); }); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); check(await ev(() => __k.SET.look > 1 && !document.getElementById('pauseScreen').hidden), 'laptop: the arrow keys move a slider that has the focus');
    await page.keyboard.press('Escape'); await sleep(300); check(await ev(() => document.getElementById('pauseScreen').hidden && __k.game.mode === 'story'), 'laptop: Escape closes the menu even with a slider in focus');
    await P.pause(); await ev(() => document.getElementById('photoBtn').click()); await until(() => __k.photo && __k.photo.isOpen(), 15000); await sleep(400);
    const z0 = await ev(() => __k.photo.state.want); await page.mouse.move(640, 300); await page.mouse.wheel({ deltaY: -400 }); await sleep(200); const z1 = await ev(() => __k.photo.state.want); await P.drag(-120); const sh = await ev(() => { const w = document.querySelector('#photoUi .pf-win').getBoundingClientRect(), b = document.querySelector('#photoUi .pf-band').getBoundingClientRect(); return w.width / (w.height + b.height); });
    check(z1 < z0 && Math.abs(sh - 1350 / 1080) < 0.02, `laptop: the wheel zooms the photo camera (${z0.toFixed(1)} -> ${z1.toFixed(1)} m), the picture lies on its side (5:4)`);
    await page.screenshot({ path: 'tests/out/set-photo-laptop.jpg', type: 'jpeg', quality: 78 }); await page.keyboard.press('Escape'); await sleep(200); check(await ev(() => !__k.photo.isOpen() && !document.getElementById('pauseScreen').hidden), 'laptop: Escape leaves photo mode for the menu'); }
  if (tag === 'hindi') { await page.tap('#howBtn'); await sleep(150); const t = await ev(() => { const c = document.querySelector('.pcard').cloneNode(true); c.querySelector('#langBtn').remove(); /* it names the language it switches to, in that language */ document.body.appendChild(c); const t = c.innerText.replace(/[\d%:/]+/g, ' '); c.remove(); return t; });
    check(!/[A-Za-z]{3,}/.test(t), 'Hindi: the whole card is in Hindi: ' + (t.match(/[A-Za-z]{3,}/g) || []).join(' '));
    await page.tap('#howBtn'); await page.tap('#photoBtn'); await until(() => __k.photo && __k.photo.isOpen(), 15000); await sleep(400);
    const pt = await ev(() => document.querySelector('#photoUi .pf-tip').textContent + ' ' + document.getElementById('photoBack').textContent); check(!/[A-Za-z]{3,}/.test(pt), `Hindi: photo mode's words too ('${pt}')`); await ev(() => __k.photo.close());
    await page.tap('#langBtn'); await sleep(200); check(await ev(() => document.getElementById('resumeBtn').textContent === 'Resume' && document.getElementById('setLookL').textContent === 'Look speed'), 'the language button turns the card back to English at once'); }
  await page.screenshot({ path: `tests/out/set-${tag}.jpg`, type: 'jpeg', quality: 78 });
  await page.close(); }
check(realErrors(logs).length === 0, 'no page errors ' + realErrors(logs).join(' | '));
await finish(browser);
