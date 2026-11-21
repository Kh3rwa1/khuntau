// "Real Khuntau vs the game": cuts the real footage, retimes it, and draws game-style graphics over it.
(() => {
  const O = __OV, E = O.E, clamp = O.clamp, lerp = O.lerp, W = 1920, H = 1080;
  const cv = document.getElementById('c'), c = cv.getContext('2d');
  const DEV = '800 SIZEpx "Baloo 2", sans-serif', BIG = O.BIG;
  const cache = new Map();
  const img = (url) => { let p = cache.get(url); if (!p) { p = new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; }); cache.set(url, p); if (cache.size > 60) cache.delete(cache.keys().next().value); } return p; };
  const real = (s) => `/realhq/${String(Math.max(1, Math.min(1900, Math.round(s * 120) + 1))).padStart(5, '0')}.jpg`;
  const gameF = (clip, s) => `/gamef/${clip}_${String(Math.max(1, Math.round(s * 30) + 1)).padStart(4, '0')}.jpg`;
  const endF = (s) => `/endf/${String(Math.max(1, Math.round(s * 30) + 1)).padStart(4, '0')}.jpg`;
  const seg = (a, b, f) => ({ a, b, f });

  // ---------- timeline: [start, end) in output seconds -> what to show ----------
  const S = [
    seg(0.0, 1.6, u => ({ src: real(0.10), zoom: 1.08, dark: 0.55, blur: 6 })),
    seg(1.6, 2.3, u => ({ src: real(lerp(0.10, 0.50, u)), zoom: lerp(1.0, 1.08, u), fx: [0.45, 0.42] })),
    seg(2.3, 4.0, u => ({ src: real(lerp(0.50, 0.72, E.out(u))), zoom: lerp(1.08, 1.55, E.inOut(u)), fx: [0.42, 0.40], slow: 1 })),
    seg(4.0, 5.6, u => ({ src: real(0.72), zoom: 1.55 + u * 0.06, fx: [0.42, 0.40], freeze: 1 })),
    seg(5.6, 6.4, u => ({ src: real(lerp(0.72, 1.25, u)), zoom: lerp(1.5, 1.05, E.out(u)), fx: [0.42, 0.45] })),
    seg(6.4, 7.2, u => ({ src: real(lerp(1.25, 0.15, u)), zoom: 1.04, rewind: 1 })),
    seg(7.2, 10.0, u => ({ src: real(lerp(3.10, 4.35, u)), zoom: lerp(1.12, 1.3, u), fx: [0.45, 0.42], replay: 1 })),
    seg(10.0, 11.4, u => ({ src: real(lerp(4.35, 7.25, u)), zoom: 1.06, fx: [0.4, 0.55] })),
    seg(11.4, 13.4, u => ({ src: real(lerp(7.40, 8.90, u)), zoom: lerp(1.05, 1.15, u), fx: [0.5, 0.45] })),
    seg(13.4, 15.6, u => ({ src: real(lerp(8.90, 9.45, u)), zoom: lerp(1.15, 1.32, E.inOut(u)), fx: [0.52, 0.45], slow: 1 })),
    seg(15.6, 16.6, u => ({ src: real(lerp(9.45, 10.25, u)), zoom: lerp(1.25, 1.05, E.out(u)), fx: [0.5, 0.45] })),
    seg(16.6, 19.4, u => ({ src: real(lerp(10.30, 13.10, u)), zoom: lerp(1.25, 1.45, u), fx: [0.62, 0.5] })),
    seg(19.4, 22.0, u => ({ black: 1 })),
    seg(22.0, 25.2, u => ({ src: gameF('N7', u * 3.2), game: 1 })),
    seg(25.2, 27.8, u => ({ src: gameF('N8', u * 2.6), game: 1 })),
    seg(27.8, 29.4, u => ({ src: gameF('N11', u * 1.6), game: 1 })),
    seg(29.4, 36.0, u => ({ src: endF(u * 6.6), end: 1 })),
  ];
  const DUR = 36.0;

  // ---------- small drawing helpers ----------
  function rr(x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); }
  function chip(x, y, w, h, alpha = 1) { c.save(); c.globalAlpha = alpha; rr(x, y, w, h, h / 2); c.fillStyle = 'rgba(20,10,6,0.62)'; c.fill(); c.strokeStyle = 'rgba(255,179,71,0.55)'; c.lineWidth = 2; c.stroke(); c.restore(); }
  function txt(s, x, y, size, color = '#fff', align = 'left', font = '800 SIZEpx "Baloo 2", sans-serif', alpha = 1, spacing = 0) {
    c.save(); c.globalAlpha = alpha; c.font = font.replace('SIZE', size); c.fillStyle = color; c.textAlign = align; c.textBaseline = 'middle'; c.letterSpacing = spacing + 'px';
    c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 10; c.fillText(s, x, y); c.restore(); }
  function diya(x, y, s, lit, t) { // the game's life lamp
    c.save(); c.translate(x, y); c.scale(s, s);
    c.fillStyle = lit ? '#8a4a24' : '#3a2a22'; c.beginPath(); c.ellipse(0, 6, 20, 9, 0, 0, Math.PI); c.fill(); c.fillRect(-20, 4, 40, 3);
    if (lit) { const f = 1 + Math.sin(t * 22) * 0.08; c.fillStyle = '#ffb347'; c.shadowColor = '#ff8a2a'; c.shadowBlur = 18;
      c.beginPath(); c.moveTo(0, -24 * f); c.quadraticCurveTo(10, -6, 0, 3); c.quadraticCurveTo(-10, -6, 0, -24 * f); c.fill();
      c.fillStyle = '#fff3c4'; c.beginPath(); c.ellipse(0, -5, 3, 6, 0, 0, Math.PI * 2); c.fill(); }
    else { c.strokeStyle = 'rgba(200,200,200,.5)'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(6, -10, 0, -20); c.stroke(); }
    c.restore(); }
  function hud(t, lives, score, label, alpha = 1) {
    chip(40, 34, 236, 64, alpha); for (let i = 0; i < 3; i++) diya(90 + i * 66, 68, 1.05, i < lives, t + i);
    chip(W - 300, 34, 260, 64, alpha); txt('SCORE', W - 270, 66, 22, 'rgba(255,255,255,.75)', 'left', undefined, alpha, 3); txt(String(score), W - 70, 67, 40, '#ffb347', 'right', BIG, alpha);
    if (label) { chip(W / 2 - 190, 34, 380, 64, alpha); txt(label, W / 2, 67, 26, '#fff', 'center', undefined, alpha, 4); }
  }
  function stamp(t, at, text, color, x, y, size, rot = -0.12) { // big rubber-stamp slam
    const u = t - at; if (u < 0) return; const p = E.outExpo(u / 0.18), s = lerp(2.6, 1, p);
    c.save(); c.translate(x + (u < 0.25 ? (Math.random() - .5) * 16 * (1 - u / 0.25) : 0), y); c.rotate(rot); c.scale(s, s); c.globalAlpha = clamp(u / 0.05, 0, 1);
    c.font = BIG.replace('SIZE', size); c.textAlign = 'center'; c.textBaseline = 'middle'; const w = c.measureText(text).width + 70;
    c.lineWidth = 10; c.strokeStyle = color; rr(-w / 2, -size * 0.62, w, size * 1.24, 18); c.stroke();
    c.fillStyle = color; c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = 20; c.fillText(text, 0, 6); c.restore(); }
  function pop(t, at, big, small, x, y, color = '#ffb347') { // game score pop: number flies up and fades
    const u = t - at; if (u < 0 || u > 1.6) return; const p = E.back(u / 0.35), a = 1 - E.in(clamp((u - 1.1) / 0.5, 0, 1));
    c.save(); c.globalAlpha = a; c.translate(x, y - u * 50); c.scale(p, p); txt(big, 0, 0, 120, color, 'center', BIG); if (small) txt(small, 0, 78, 40, '#fff', 'center'); c.restore(); }
  function scanlines(a) { c.save(); c.globalAlpha = a; c.fillStyle = '#000'; for (let y = 0; y < H; y += 4) c.fillRect(0, y, W, 2); c.restore(); }
  function rgbSplit(img, off) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.35; c.drawImage(img, -off, 0, W, H); c.drawImage(img, off, 0, W, H); c.restore(); }
  function sliceGlitch(n, amp) { const im = c.getImageData(0, 0, W, H); for (let i = 0; i < n; i++) { const y = Math.random() * H | 0, h = 10 + Math.random() * 60 | 0, dx = (Math.random() - .5) * amp | 0; c.putImageData(im, dx, 0, 0, y, W, h); } }
  function button(x, y, r, label, on, t) { c.save(); const pr = on ? 1 + Math.sin(t * 14) * 0.06 : 1; c.translate(x, y); c.scale(pr, pr);
    c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fillStyle = on ? 'rgba(255,179,71,0.9)' : 'rgba(20,10,6,0.55)'; c.fill(); c.lineWidth = 4; c.strokeStyle = on ? '#fff' : 'rgba(255,255,255,.5)'; c.stroke();
    txt(label, 0, 2, r * 0.42, on ? '#2a1408' : '#fff', 'center'); c.restore(); }

  const CUTS = [1.6, 5.6, 7.2, 11.4, 15.6, 16.6, 25.2, 27.8];
  const FLARES = [0.15, 4.02, 13.9, 22.0, 29.45];
  function flare(t, at) { const u = t - at; if (u < 0 || u > 0.7) return; const a = (1 - u / 0.7) * Math.min(1, u / 0.04);
    c.save(); c.globalCompositeOperation = 'screen'; c.globalAlpha = a; const y = H * 0.47;
    const g = c.createLinearGradient(0, 0, W, 0); g.addColorStop(0, 'rgba(80,140,255,0)'); g.addColorStop(0.5, 'rgba(190,220,255,0.9)'); g.addColorStop(1, 'rgba(80,140,255,0)');
    c.fillStyle = g; c.fillRect(0, y - 3, W, 6); c.globalAlpha = a * 0.5; c.fillRect(0, y - 16, W, 32);
    const r = c.createRadialGradient(W / 2, y, 0, W / 2, y, 260); r.addColorStop(0, 'rgba(255,240,220,0.8)'); r.addColorStop(1, 'rgba(255,200,150,0)'); c.globalAlpha = a * 0.6; c.fillStyle = r; c.fillRect(0, y - 260, W, 520);
    c.restore(); }
  async function frame(i) {
    const t = i / 30, s = S.find(x => t >= x.a && t < x.b) || S[S.length - 1], u = (t - s.a) / (s.b - s.a), v = s.f(u);
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.filter = 'none'; c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.fillStyle = '#000'; c.fillRect(0, 0, W, H); c.restore();
    let im = null;
    if (v.src) {
      im = await img(v.src);
      const z = v.zoom || 1, fx = v.fx ? v.fx[0] * W : W / 2, fy = v.fx ? v.fx[1] * H : H / 2;
      let sx = 0, sy = 0; if (v.shake) { sx = (Math.random() - .5) * v.shake; sy = (Math.random() - .5) * v.shake; }
      c.save();
      c.filter = v.end || v.game ? 'none' : `contrast(1.12) saturate(${v.freeze ? 0.35 : 1.08}) brightness(${v.dark ? 1 - v.dark : 1.02})${v.blur ? ` blur(${v.blur}px)` : ''}`;
      c.translate(fx + sx, fy + sy); c.scale(z, z); c.translate(-fx, -fy); c.drawImage(im, 0, 0, W, H); c.restore();
      if (!v.end) { // halation: soft glow of the highlights, the "shot on film" look
        c.save(); c.globalCompositeOperation = 'screen'; c.globalAlpha = v.game ? 0.1 : 0.1; c.filter = 'blur(24px) brightness(1.15)'; c.drawImage(cv, 0, 0); c.restore(); }
      for (const b of CUTS) { const d = Math.abs(t - b); if (d < 0.1) { const k = 1 - d / 0.1, dir = t < b ? 1 : -1; // whip-pan smear across each cut
        c.save(); for (let j = 1; j <= 6; j++) { c.globalAlpha = 0.16 * k; c.drawImage(cv, dir * j * 46 * k, 0); } c.restore(); O.flash(c, t, b - 0.02, 0.1, 'rgba(255,245,230,0.55)'); } }
      if (!v.end && !v.dark) { O.leak(c, t, v.game ? 0.25 : 0.28);
        const g = c.createLinearGradient(0, 0, 0, 190); g.addColorStop(0, 'rgba(0,0,0,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, W, 190); }
    }
    for (const at of FLARES) flare(t, at);
    // --- per-moment graphics ---
    if (t < 1.6) { // intro: game-style level banner over the real field
      O.letterbox(c, 1);
      O.line(c, { text: 'REAL LIFE', font: BIG, size: 220, x: W / 2, y: H * 0.5, t, start: 0.15, dur: 1.45, mode: 'slam', tracking: 0.06, outLen: 0.2 });
      O.sub(c, { text: 'LEVEL 1  ·  KHUNTAU', size: 38, x: W / 2, y: H * 0.5 + 120, t, start: 0.35, dur: 1.25 });
      O.flash(c, t, 0.15, 0.2);
    }
    if (t >= 1.6 && t < 19.4) {
      const lives = t >= 4.0 ? (t >= 10.0 ? 0 : 2) : 3, score = t >= 13.9 ? 2 : 0;
      hud(t, t >= 10.0 && t < 11.4 ? 0 : (t >= 11.4 ? 3 : lives), score, t >= 11.4 ? 'PLAYER 2' : 'PLAYER 1', E.out((t - 1.6) / 0.3));
    }
    if (s.f === S[2].f) { c.save(); c.globalAlpha = 0.18; c.fillStyle = '#fff'; c.fillRect(0, 0, W, H); c.restore(); txt('◀◀  SLOW MOTION', 60, H - 70, 30, 'rgba(255,255,255,.85)', 'left', undefined, 1, 4); }
    if (t >= 4.0 && t < 5.6) { // freeze: the classic "you're out" moment
      c.save(); c.fillStyle = 'rgba(120,0,0,0.25)'; c.fillRect(0, 0, W, H); c.restore(); O.vignette(c);
      stamp(t, 4.05, 'OUT!', '#ff3b30', W / 2, H * 0.48, 230);
      pop(t, 4.25, '-1', 'LIFE LOST', 200, 250, '#ff6b5e');
      O.flash(c, t, 4.0, 0.15);
    }
    if (t >= 5.6 && t < 6.4) txt('...BOOM.', W - 80, H - 90, 64, '#fff', 'right', BIG, E.out((t - 6.0) / 0.2));
    if (t >= 6.4 && t < 7.2) { scanlines(0.35); if (im) rgbSplit(im, 10); sliceGlitch(6, 120); txt('◀◀  REWIND', 70, 210, 64, '#fff', 'left', BIG); txt('PLAY', W - 90, H - 80, 36, 'rgba(255,255,255,.7)', 'right'); }
    if (t >= 7.2 && t < 10.0) { // instant replay with stat cards
      c.save(); c.fillStyle = 'rgba(255,40,40,0.95)'; rr(60, H - 150, 330, 76, 12); c.fill(); c.restore(); txt('● INSTANT REPLAY', 225, H - 111, 32, '#fff', 'center');
      const cards = [[7.6, 'AIR TIME', '0.8 s', '#fff'], [8.2, 'STYLE', '10/10', '#ffb347'], [8.9, 'LANDING', '0/10', '#ff5a4e']];
      cards.forEach(([at, k, val, col], j) => { const p = E.outExpo((t - at) / 0.4); if (t < at) return; const x = lerp(W + 40, W - 420, p), y = 170 + j * 128;
        c.save(); rr(x, y, 380, 108, 16); c.fillStyle = 'rgba(20,10,6,0.72)'; c.fill(); c.strokeStyle = col; c.lineWidth = 3; c.stroke(); c.restore();
        txt(k, x + 26, y + 34, 26, 'rgba(255,255,255,.75)', 'left', undefined, 1, 4); txt(val, x + 354, y + 66, 62, col, 'right', BIG); });
    }
    if (t >= 10.0 && t < 11.4) { // respawn that never comes
      const p = clamp((t - 10.05) / 1.05, 0, 0.99), fail = t > 11.05;
      c.save(); c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(0, 0, W, H); c.restore();
      txt(fail ? 'RESPAWN FAILED' : 'RESPAWNING…', W / 2, H * 0.44, 76, fail ? '#ff5a4e' : '#fff', 'center', BIG);
      c.save(); rr(W / 2 - 360, H * 0.53, 720, 30, 15); c.fillStyle = 'rgba(255,255,255,.15)'; c.fill(); rr(W / 2 - 360, H * 0.53, 720 * p, 30, 15); c.fillStyle = fail ? '#ff5a4e' : '#ffb347'; c.fill(); c.restore();
      txt(fail ? 'THERE ARE NO RESPAWNS IN REAL LIFE' : Math.round(p * 100) + '%', W / 2, H * 0.53 + 72, 34, '#fff', 'center', undefined, 1, fail ? 4 : 0);
    }
    if (t >= 11.4 && t < 15.6) { // player 2 with the game's touch buttons
      if (t < 12.6) O.line(c, { text: 'PLAYER 2', font: BIG, size: 150, x: W / 2, y: H * 0.42, t, start: 11.45, dur: 1.15, mode: 'slam', tracking: 0.05, outLen: 0.2 });
      button(W - 330, H - 150, 70, 'HIDE', t > 12.2 && t < 13.4, t); button(W - 150, H - 230, 70, 'ROLL', t >= 13.4 && t < 14.4, t); button(W - 150, H - 70 - 10, 62, 'GRAB', false, t);
      if (t >= 12.2 && t < 13.4) txt('WAVE THE HIDE  ▸', W - 420, H - 150, 30, '#ffb347', 'right', undefined, 1, 3);
    }
    if (t >= 13.4 && t < 15.6) { c.save(); c.globalAlpha = 0.14; c.fillStyle = '#fff'; c.fillRect(0, 0, W, H); c.restore(); txt('◀◀  SLOW MOTION', 60, H - 70, 30, 'rgba(255,255,255,.85)', 'left', undefined, 1, 4);
      pop(t, 13.9, '+2', 'DARING DODGE!', W * 0.24, H * 0.36); O.flash(c, t, 13.9, 0.12); }
    if (t >= 16.6 && t < 19.4) { // the chase that never ends
      { const g = c.createLinearGradient(0, H * 0.62, 0, H); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.7)'); c.fillStyle = g; c.fillRect(0, H * 0.62, W, H * 0.38); }
      O.line(c, { text: 'THE BULL IS STILL COMING', font: BIG, size: 104, x: W / 2, y: H * 0.86, t, start: 16.8, dur: 2.5, tracking: 0.03, stagger: 0.035 });
      const sec = Math.floor((t - 16.6) * 14); txt('CHASE  00:' + String(Math.min(59, 3 + sec)).padStart(2, '0'), W / 2, 180, 40, '#fff', 'center', undefined, 1, 6);
      txt('▶▶ ×2', W - 80, H - 70, 34, 'rgba(255,255,255,.8)', 'right');
    }
    if (t >= 19.4 && t < 22.0) { // real life vs the game
      c.fillStyle = '#0b0705'; c.fillRect(0, 0, W, H);
      if (t < 20.7) { O.line(c, { text: 'REAL LIFE', font: BIG, size: 170, x: W / 2, y: H * 0.45, t, start: 19.45, dur: 1.25, tracking: 0.05, stagger: 0.05, style: 'white' });
        O.sub(c, { text: '1 LIFE  ·  0 RESPAWNS', size: 40, x: W / 2, y: H * 0.45 + 100, t, start: 19.7, dur: 1.0, color: '#ff8a7a' }); }
      else { O.line(c, { text: 'IN THE GAME', font: BIG, size: 170, x: W / 2, y: H * 0.40, t, start: 20.7, dur: 1.3, tracking: 0.05, stagger: 0.05 });
        O.sub(c, { text: '3 LIVES  ·  ENDLESS RESPAWNS', size: 36, x: W / 2, y: H * 0.40 + 96, t, start: 20.9, dur: 1.1, color: '#ffd58a' });
        for (let k = 0; k < 3; k++) { const p = E.back(clamp((t - 21.0 - k * 0.12) / 0.3, 0, 1)); if (p > 0) diya(W / 2 - 110 + k * 110, H * 0.66, 2.2 * p, true, t + k); }
        O.leak(c, t, 0.8); }
      O.flash(c, t, 20.7, 0.12); if (t > 21.85) O.flash(c, t, 21.85, 0.3, 'rgba(255,230,190,1)');
    }
    if (v.game) { // the game: same HUD, now you win
      const gs = t < 25.2 ? 0 : t < 26.1 ? 2 : t < 27.8 ? 10 : 12;
      hud(t, 3, gs, 'IN THE GAME', 1);
      if (t >= 22.0 && t < 22.9) O.line(c, { text: 'YOUR TURN', font: BIG, size: 140, x: W / 2, y: H * 0.24, t, start: 22.02, dur: 0.85, mode: 'slam', tracking: 0.05, outLen: 0.2 });
      pop(t, 23.4, '+2', 'DARING DODGE!', W * 0.6, H * 0.38);
      pop(t, 25.9, '+8', 'GOLDEN PITHA!', W * 0.5, H * 0.32, '#ffd24a');
      pop(t, 28.2, 'BONK!', 'THE BULL HIT THE KHUNT', W * 0.55, H * 0.35, '#fff');
      if (t > 21.98 && t < 22.3) sliceGlitch(5, 140);
    }
    if (s === S[S.length - 1] && t > 35.4) O.fade(c, (t - 35.4) / 0.6);
    if (!v.end) O.vignette(c);
    return cv.toDataURL('image/jpeg', 0.92);
  }
  window.__comp = { frame, frames: Math.round(DUR * 30) };
})();
