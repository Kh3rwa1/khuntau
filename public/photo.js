// Photo mode (25 Nov): from the pause menu. The world stands still, every button goes, you swing the camera round
// yourself and take a picture. What you see in the window is what you get: the shot sits in a frame painted like a
// Santal house wall (charcoal band, pink scallops, red ochre foot) with the game's name, to share or to save.
// Loaded the first time Photo is tapped. Builds its own DOM and styles; draws nothing in the 3D scene.
export function initPhoto(C) {
  const { $, THREE, camera, renderer, game, draw, track } = C, doc = document, tr = s => C.tr(s);
  const P = { on: false, yaw: 0, pitch: 0.3, dist: 6, want: 6, target: new THREE.Vector3(), id: null, x: 0, y: 0, id2: null, x2: 0, y2: 0, d0: 1, z0: 6, shot: null, busy: false };
  const css = doc.createElement('style'); css.textContent = `
html.photo-on body > *:not(#stage):not(#photoUi):not(#photoPrev) { visibility: hidden !important; }
#photoUi { position: fixed; inset: 0; z-index: 30; touch-action: none; cursor: grab; }
#photoUi .pf { position: absolute; left: 50%; top: 46%; transform: translate(-50%, -50%); width: var(--pw); pointer-events: none; }
#photoUi .pf-win { height: var(--ph); box-shadow: 0 0 0 200vmax rgba(8, 5, 4, .7); outline: 3px solid #f6eedd; }
#photoUi .pf-band { position: relative; height: var(--pb); background: radial-gradient(circle at 50% 0, #e58fa3 46%, transparent 49%) 0 0 / calc(var(--pb) * .3) calc(var(--pb) * .15) repeat-x, #2b2724; border-bottom: calc(var(--pb) * .14) solid #a23a22; outline: 3px solid #f6eedd; display: flex; align-items: flex-end; justify-content: space-between; padding: 0 calc(var(--pb) * .23) calc(var(--pb) * .05); box-sizing: border-box; color: #f6eedd; white-space: nowrap; overflow: hidden; }
#photoUi .pf-band b { display: block; font: 400 calc(var(--pb) * .4)/1 "Rubik Dirt", "Baloo 2", sans-serif; text-shadow: 0 2px 0 #b5462a; }
#photoUi .pf-band i { display: block; font: 600 calc(var(--pb) * .19)/1.1 "Noto Sans Ol Chiki", sans-serif; color: #ffb347; font-style: normal; }
#photoUi .pf-band u { font: 800 calc(var(--pb) * .15)/1 "Baloo 2", sans-serif; text-decoration: none; opacity: .9; padding-bottom: calc(var(--pb) * .12); }
#photoUi .pf-tip { position: absolute; left: 0; right: 0; top: calc(14px + env(safe-area-inset-top, 0px)); text-align: center; font: 700 14px/20px "Baloo 2", system-ui, sans-serif; color: #f6eedd; text-shadow: 0 1px 4px #000; pointer-events: none; transition: opacity .6s; margin: 0; padding: 0 12px; }
#photoUi .pf-bar { position: absolute; left: 0; right: 0; bottom: calc(18px + env(safe-area-inset-bottom, 0px)); display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; padding: 0 18px; pointer-events: none; }
#photoUi .pf-bar button { pointer-events: auto; cursor: pointer; }
#photoBack { justify-self: start; font: 800 15px/20px "Baloo 2", system-ui, sans-serif; color: #f6eedd; background: rgba(20, 10, 6, .62); border: 1px solid rgba(246, 238, 221, .3); border-radius: 999px; padding: 10px 18px; }
#photoShot { width: 68px; height: 68px; border-radius: 50%; border: 5px solid #f6eedd; background: #ffb347; box-shadow: 0 0 0 3px rgba(20, 10, 6, .6), 0 6px 16px rgba(0, 0, 0, .5); }
#photoShot:active { transform: scale(.93); }
#photoUi .pf-flash { position: absolute; inset: 0; background: #fff; opacity: 0; pointer-events: none; transition: opacity .35s; }
#photoPrev { z-index: 31; background: rgba(12, 8, 6, .86); }
#photoPrev .card { gap: 12px; width: min(420px, 100%); }
#photoPrev img { display: block; max-width: 100%; max-height: calc(100vh - 210px); max-height: calc(100dvh - 210px); border-radius: 10px; box-shadow: 0 12px 36px rgba(0, 0, 0, .6); background: #2b2724; }
#photoPrev .pp-row { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
#photoPrev .btn { min-width: 0; padding: 12px 22px; font-size: 17px; }
#photoPrev .fine { min-height: 18px; opacity: .8; }
@media (orientation: landscape) and (max-height: 540px) { #photoPrev .card { width: min(760px, 100%); grid-template-columns: auto 1fr; align-items: center; } #photoPrev img { max-height: calc(100vh - 40px); max-height: calc(100dvh - 40px); grid-row: 1 / span 2; } #photoPrev .pp-row { flex-direction: column; } }
`; doc.head.appendChild(css);
  const ui = doc.createElement('div'); ui.id = 'photoUi'; ui.hidden = true;
  ui.innerHTML = '<div class="pf"><div class="pf-win"></div><div class="pf-band"><span><i>ᱥᱚᱦᱨᱟᱭ</i><b>Sohrai</b></span><u></u></div></div><p class="pf-tip"></p><div class="pf-bar"><button id="photoBack" type="button"></button><button id="photoShot" type="button"></button><span></span></div><div class="pf-flash"></div>';
  doc.body.appendChild(ui);
  const prev = doc.createElement('div'); prev.id = 'photoPrev'; prev.className = 'overlay'; prev.hidden = true;
  prev.innerHTML = '<div class="card"><img id="photoImg" alt=""><div class="pp-row"><button class="btn" id="photoShare" type="button"></button><button class="btn ghost" id="photoAgain" type="button"></button></div><p class="fine" id="photoNote"></p></div>';
  doc.body.appendChild(prev);
  const q = s => ui.querySelector(s), tip = q('.pf-tip'), flash = q('.pf-flash'), frame = q('.pf');

  // The window: 1080 x 1176 of a 1080 x 1350 card when the screen is upright, 1350 x 930 of 1350 x 1080 when it lies on its side
  const shape = () => (innerWidth >= innerHeight * 1.05 ? { W: 1350, H: 1080, B: 150 } : { W: 1080, H: 1350, B: 174 });
  function layout() { const s = shape(), availW = innerWidth - 28, availH = innerHeight - 150, k = Math.min(availW / s.W, availH / s.H);
    frame.style.setProperty('--pw', Math.floor(s.W * k) + 'px'); frame.style.setProperty('--ph', Math.floor((s.H - s.B) * k) + 'px'); frame.style.setProperty('--pb', Math.floor(s.B * k) + 'px'); }
  function text() { const touch = C.isTouch; q('.pf-band u').textContent = location.host; tip.textContent = tr(touch ? 'Drag to turn the camera, pinch to zoom' : 'Drag to turn the camera, wheel to zoom'); $('photoBack').textContent = tr('Back'); $('photoShot').setAttribute('aria-label', tr('Take the photo'));
    $('photoShare').textContent = tr(canFile() || !navigator.share && !window.SohraiApp ? (navigator.share ? 'Share' : 'Save') : 'Share'); $('photoAgain').textContent = tr('Another'); }
  const canFile = () => { try { return !!(navigator.canShare && navigator.canShare({ files: [new File([new Blob(['x'])], 'x.jpg', { type: 'image/jpeg' })] })); } catch (e) { return false; } };

  // the camera: round the player, never under the ground, pulled in when a house, a stack or a tree is in the way
  const t1 = new THREE.Vector3();
  function place() { const cp = Math.cos(P.pitch), dir = t1.set(Math.sin(P.yaw) * cp, Math.sin(P.pitch), Math.cos(P.yaw) * cp); let d = P.want;
    if (C.sight) for (; d > 1.3; d -= 0.4) { const c = { x: P.target.x + dir.x * d, y: P.target.y + dir.y * d, z: P.target.z + dir.z * d }; if (C.sight(P.target, c)) break; }
    P.dist = d; camera.position.set(P.target.x + dir.x * d, Math.max(P.floor + 0.3, P.target.y + dir.y * d), P.target.z + dir.z * d); camera.lookAt(P.target); }
  function open() { if (P.on) return; const f = C.focus(); P.floor = f.y; P.target.set(f.x, f.y + 1.05, f.z); const d = t1.copy(camera.position).sub(P.target), len = d.length() || 6;
    P.inside = !!C.inside(); P.max = P.inside ? 3.4 : 13; P.want = Math.min(P.max, Math.max(1.8, len)); P.yaw = Math.atan2(d.x, d.z); P.pitch = Math.min(1.25, Math.max(0.04, Math.asin(Math.max(-1, Math.min(1, d.y / len)))));
    P.on = true; P.id = P.id2 = null; if (C.hide) C.hide(true); doc.documentElement.classList.add('photo-on'); layout(); text(); ui.hidden = false; prev.hidden = true; tip.style.opacity = 1; clearTimeout(P.tipT); P.tipT = setTimeout(() => { tip.style.opacity = 0; }, 4200); track('photo.open'); }
  function close() { if (!P.on) return; P.on = false; if (C.hide) C.hide(false); ui.hidden = true; prev.hidden = true; doc.documentElement.classList.remove('photo-on'); if (P.shot) { URL.revokeObjectURL(P.shot.url); P.shot = null; } if (C.closed) C.closed(); }
  const cam = () => { if (P.on) place(); }; // every frame while it is open (the game is paused; index.html calls this before it draws)

  ui.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; try { ui.setPointerCapture(e.pointerId); } catch (er) {}
    if (P.id === null) { P.id = e.pointerId; P.x = e.clientX; P.y = e.clientY; } else if (P.id2 === null) { P.id2 = e.pointerId; P.x2 = e.clientX; P.y2 = e.clientY; P.d0 = Math.hypot(P.x2 - P.x, P.y2 - P.y) || 1; P.z0 = P.want; } });
  ui.addEventListener('pointermove', e => { const k = C.sens ? C.sens() : 1;
    if (e.pointerId === P.id2) { P.x2 = e.clientX; P.y2 = e.clientY; }
    else if (e.pointerId === P.id) { if (P.id2 === null) { P.yaw -= (e.clientX - P.x) * 0.0075 * k; P.pitch = Math.min(1.25, Math.max(0.04, P.pitch + (e.clientY - P.y) * 0.005 * k)); } P.x = e.clientX; P.y = e.clientY; }
    else return;
    if (P.id2 !== null) P.want = Math.min(P.max, Math.max(1.8, P.z0 * P.d0 / (Math.hypot(P.x2 - P.x, P.y2 - P.y) || 1))); });
  const up = e => { if (e.pointerId === P.id) { P.id = P.id2; P.x = P.x2; P.y = P.y2; P.id2 = null; } else if (e.pointerId === P.id2) P.id2 = null; };
  ui.addEventListener('pointerup', up); ui.addEventListener('pointercancel', up);
  ui.addEventListener('wheel', e => { P.want = Math.min(P.max, Math.max(1.8, P.want * (e.deltaY > 0 ? 1.1 : 0.91))); }, { passive: true });
  addEventListener('resize', () => { if (P.on) layout(); });

  // The picture: the frame is drawn at once, the part of the game's canvas seen through the window is copied into it
  async function compose() { const s = shape(), cv = renderer.domElement, win = q('.pf-win').getBoundingClientRect(), kx = cv.width / cv.clientWidth, ky = cv.height / cv.clientHeight;
    place(); draw(); // the frame just drawn is still in the canvas for the copy below (the same trick as the score card's)
    const c = doc.createElement('canvas'); c.width = s.W; c.height = s.H; const g = c.getContext('2d'), ph = s.H - s.B;
    g.fillStyle = '#2b2724'; g.fillRect(0, 0, s.W, s.H); g.imageSmoothingQuality = 'high';
    g.drawImage(cv, win.left * kx, win.top * ky, win.width * kx, win.height * ky, 0, 0, s.W, ph);
    try { await Promise.all([doc.fonts.load('72px "Rubik Dirt"'), doc.fonts.load('800 30px "Baloo 2"'), doc.fonts.load('600 40px "Noto Sans Ol Chiki"', 'ᱥᱚᱦᱨᱟᱭ')]); } catch (e) {}
    const y0 = ph, B = s.B; g.fillStyle = '#2b2724'; g.fillRect(0, y0, s.W, B);
    g.fillStyle = '#e58fa3'; const r = B * 0.14, step = B * 0.3; for (let x = step / 2; x < s.W + step; x += step) { g.beginPath(); g.arc(x, y0, r, 0, Math.PI); g.fill(); } // the scalloped edge of the black band
    g.strokeStyle = '#f6eedd'; g.lineWidth = 3; g.beginPath(); for (let x = 0; x <= s.W; x += 6) { const y = y0 + r + 9 + Math.sin(x / step * Math.PI * 2) * 3; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); // the white wave under it
    g.fillStyle = '#a23a22'; g.fillRect(0, s.H - B * 0.14, s.W, B * 0.14); // red ochre at the foot
    // the name on the left (Ol Chiki above it, as on the home screen), where to play on the right, shrunk to the room that is left
    g.textBaseline = 'alphabetic'; g.textAlign = 'left';
    g.font = `600 ${Math.round(B * 0.19)}px "Noto Sans Ol Chiki", sans-serif`; g.fillStyle = '#ffb347'; g.fillText('ᱥᱚᱦᱨᱟᱭ', 42, y0 + B * 0.42);
    g.font = `${Math.round(B * 0.4)}px "Rubik Dirt", "Baloo 2", sans-serif`; const baseY = y0 + B * 0.8; g.fillStyle = '#b5462a'; g.fillText('Sohrai', 40, baseY + 4); g.fillStyle = '#f6eedd'; g.fillText('Sohrai', 40, baseY);
    const left = 40 + g.measureText('Sohrai').width + 36, room = s.W - 40 - left, fit = (t, font, size) => { do { g.font = font.replace('#', size); if (g.measureText(t).width <= room) break; size -= 2; } while (size > 14); };
    g.textAlign = 'right'; fit(location.host, '800 #px "Baloo 2", sans-serif', Math.round(B * 0.2)); g.fillStyle = '#f6eedd'; g.fillText(location.host, s.W - 40, y0 + B * 0.55);
    const tag = C.lang() === 'hi' ? 'संताल पर्व का मुफ़्त खेल' : 'A free game about the Santal harvest festival'; fit(tag, '700 #px "Baloo 2", sans-serif', Math.round(B * 0.155)); g.fillStyle = 'rgba(246,238,221,.78)'; g.fillText(tag, s.W - 40, y0 + B * 0.77);
    const blob = await new Promise(res => c.toBlob(res, 'image/jpeg', 0.9)); return { blob, url: URL.createObjectURL(blob), w: s.W, h: s.H }; }
  async function shoot() { if (!P.on || P.busy) return; P.busy = true; try { if (C.click) C.click(); flash.style.transition = 'none'; flash.style.opacity = 0.85; const shot = await compose(); requestAnimationFrame(() => { flash.style.transition = ''; flash.style.opacity = 0; });
      if (P.shot) URL.revokeObjectURL(P.shot.url); P.shot = shot; $('photoImg').src = shot.url; $('photoNote').textContent = ''; text(); prev.hidden = false; track('photo.shot'); } catch (e) { console.error(e); flash.style.opacity = 0; } P.busy = false; }
  async function share() { const s = P.shot; if (!s) return; track('photo.share'); const link = location.origin + '/?src=photo', hi = C.lang() === 'hi';
    const txt = hi ? `मेरे गाँव से एक फ़ोटो। सोहराय: संताल पर्व का मुफ़्त खेल। ${link}` : `A photo from my village. Sohrai, a free game about the Santal harvest festival: ${link}`;
    try { const file = new File([s.blob], 'sohrai-photo.jpg', { type: 'image/jpeg' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text: txt, title: 'Sohrai' }); return; }
      if (window.SohraiApp && window.SohraiApp.share) { window.SohraiApp.share(txt); $('photoNote').textContent = tr('To keep the picture, take a screenshot of it'); return; } // the Android app shares text only
      const a = doc.createElement('a'); a.href = s.url; a.download = file.name; doc.body.appendChild(a); a.click(); a.remove(); $('photoNote').textContent = tr('Saved to your downloads');
    } catch (e) { if (!(e && e.name === 'AbortError')) $('photoNote').textContent = tr('Could not share it. Take a screenshot instead'); } }
  $('photoBack').addEventListener('click', close); $('photoShot').addEventListener('click', shoot); $('photoShare').addEventListener('click', share);
  $('photoAgain').addEventListener('click', () => { prev.hidden = true; });
  prev.addEventListener('click', e => { if (e.target === prev) prev.hidden = true; });
  return { open, close, cam, shoot, compose, isOpen: () => P.on, back: () => { if (!P.on) return false; if (!prev.hidden) prev.hidden = true; else close(); return true; }, state: P };
}
