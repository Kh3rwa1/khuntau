// Kinetic typography + finishing layers for the trailer, drawn on a 1920x1080 2D canvas over each 3D frame.
(() => {
  const W = 1920, H = 1080;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const E = {
    out: t => 1 - Math.pow(1 - clamp(t, 0, 1), 3),
    outExpo: t => { t = clamp(t, 0, 1); return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); },
    inOut: t => { t = clamp(t, 0, 1); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    in: t => { t = clamp(t, 0, 1); return t * t * t; },
    back: t => { t = clamp(t, 0, 1); const c = 2.2; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  };

  // grain texture used inside the letters (makes the type feel printed / dusty, not digital)
  const grain = document.createElement('canvas'); grain.width = grain.height = 512;
  { const g = grain.getContext('2d'), id = g.createImageData(512, 512);
    for (let i = 0; i < id.data.length; i += 4) { const v = Math.random(); const dark = v < 0.5; id.data[i] = dark ? 60 : 255; id.data[i + 1] = dark ? 30 : 236; id.data[i + 2] = dark ? 10 : 200; id.data[i + 3] = Math.random() < 0.22 ? (dark ? 120 : 70) : 0; }
    g.putImageData(id, 0, 0); }

  // textured glyph cache
  const cache = new Map();
  function glyph(ch, font, size, style) {
    const key = ch + '|' + font + '|' + size + '|' + style;
    if (cache.has(key)) return cache.get(key);
    const m = document.createElement('canvas').getContext('2d'); m.font = `${font.replace('SIZE', size)}`;
    const w = Math.ceil(m.measureText(ch).width) || 1, pad = Math.ceil(size * 0.35);
    const c = document.createElement('canvas'); c.width = w + pad * 2; c.height = Math.ceil(size * 1.5) + pad; const x = c.getContext('2d');
    x.font = m.font; x.textBaseline = 'alphabetic';
    const base = pad * 0.5 + size * 1.08;
    const gr = x.createLinearGradient(0, base - size, 0, base + size * 0.15);
    if (style === 'gold') { gr.addColorStop(0, '#fff7e6'); gr.addColorStop(0.55, '#ffd58a'); gr.addColorStop(1, '#e8902e'); }
    else if (style === 'ember') { gr.addColorStop(0, '#ffe0b0'); gr.addColorStop(1, '#ff7a2a'); }
    else { gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#efe3cc'); }
    x.fillStyle = gr; x.fillText(ch, pad, base);
    x.globalCompositeOperation = 'source-atop'; x.drawImage(grain, Math.random() * -200, Math.random() * -200);
    const o = { c, w, pad, base }; cache.set(key, o); return o;
  }
  function layout(text, font, size, tracking) {
    const m = document.createElement('canvas').getContext('2d'); m.font = font.replace('SIZE', size);
    const xs = []; let x = 0;
    for (const ch of text) { xs.push(x); x += (ch === ' ' ? Math.max(m.measureText(ch).width, size * 0.38) : m.measureText(ch).width) + tracking * size; }
    return { xs, width: x - tracking * size };
  }

  // one animated word/line. a = { text, font, size, x, y, align, t, start, dur, mode, style, tracking, glow }
  function line(ctx, a) {
    const lt = a.t - a.start; if (lt < 0 || lt > a.dur) return;
    const size = a.size, tracking = a.tracking ?? 0.04, font = a.font, style = a.style || 'gold';
    const L = layout(a.text, font, size, tracking);
    const chars = [...a.text], n = chars.length;
    const ox = a.align === 'left' ? a.x : a.align === 'right' ? a.x - L.width : a.x - L.width / 2;
    const outLen = a.outLen ?? 0.35, outT = clamp((lt - (a.dur - outLen)) / outLen, 0, 1);
    const push = 1 + lt * (a.push ?? 0.03); // slow continuous push-in, like the camera is moving through the type
    ctx.save();
    ctx.translate(a.x, a.y); ctx.scale(push, push); ctx.translate(-a.x, -a.y);
    if (a.mode === 'slam') {
      // whole word punches in from big, with shake + chromatic split
      const p = E.outExpo(lt / 0.22), sc = lerp(2.4, 1, p), shake = lt < 0.25 ? (1 - lt / 0.25) * 18 : 0;
      const sx = (Math.random() - .5) * shake, sy = (Math.random() - .5) * shake;
      ctx.translate(a.x + sx, a.y + sy); ctx.scale(sc * (1 + outT * 1.8), sc * (1 + outT * 1.8)); ctx.translate(-a.x, -a.y);
      const alpha = clamp(lt / 0.06, 0, 1) * (1 - outT);
      const split = lt < 0.35 ? (1 - lt / 0.35) * 14 : 1.5;
      for (const [dx, tint] of [[-split, 'r'], [split, 'c'], [0, '']]) {
        ctx.save(); ctx.globalAlpha = alpha * (tint ? 0.55 : 1);
        if (tint) ctx.globalCompositeOperation = 'lighter';
        ctx.shadowColor = tint ? 'transparent' : (a.glow || 'rgba(255,130,40,0.65)'); ctx.shadowBlur = tint ? 0 : 38;
        chars.forEach((ch, i) => { const g = glyph(ch, font, size, tint === 'r' ? 'ember' : style); ctx.drawImage(g.c, ox + L.xs[i] - g.pad + dx, a.y - g.base); });
        ctx.restore();
      }
      if (outT > 0) { ctx.filter = 'none'; }
    } else {
      // letters rise in one by one out of a blur, then drift apart and dissolve
      const st = a.stagger ?? 0.04;
      chars.forEach((ch, i) => {
        if (ch === ' ') return;
        const li = lt - i * st, p = E.outExpo(li / 0.55);
        if (li < 0) return;
        const g = glyph(ch, font, size, style);
        const spread = outT * (i - n / 2) * size * 0.12;
        const yoff = (1 - p) * size * 0.55 - outT * size * 0.08;
        const blur = (1 - p) * 16 + outT * 14;
        const sc = lerp(1.35, 1, p);
        ctx.save();
        ctx.globalAlpha = p * (1 - E.in(outT));
        ctx.filter = blur > 0.5 ? `blur(${blur.toFixed(1)}px)` : 'none';
        ctx.shadowColor = a.glow || 'rgba(255,140,40,0.55)'; ctx.shadowBlur = 30;
        const cx = ox + L.xs[i] + g.w / 2 + spread, cy = a.y + yoff;
        ctx.translate(cx, cy); ctx.scale(sc, sc); ctx.translate(-cx, -cy);
        ctx.drawImage(g.c, ox + L.xs[i] - g.pad + spread, a.y - g.base + yoff);
        ctx.restore();
      });
      // light sweep across the word
      if (a.sweep !== false) {
        const sp = (lt - 0.35) / 0.9;
        if (sp > 0 && sp < 1 && outT === 0) {
          const bx = ox + lerp(-0.2, 1.2, sp) * L.width;
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5 * Math.sin(sp * Math.PI);
          const gr = ctx.createLinearGradient(bx - size * 0.6, 0, bx + size * 0.6, 0);
          gr.addColorStop(0, 'rgba(255,220,160,0)'); gr.addColorStop(0.5, 'rgba(255,230,180,0.9)'); gr.addColorStop(1, 'rgba(255,220,160,0)');
          ctx.beginPath(); ctx.rect(ox, a.y - size * 1.0, L.width, size * 1.15); ctx.clip();
          ctx.fillStyle = gr; ctx.font = font.replace('SIZE', size);
          ctx.letterSpacing = (tracking * size) + 'px'; ctx.fillText(a.text, ox, a.y); ctx.restore();
        }
      }
    }
    ctx.restore();
  }
  // small caps line that tracks in
  function sub(ctx, a) {
    const lt = a.t - a.start; if (lt < 0 || lt > a.dur) return;
    const p = E.outExpo(lt / 0.7), outT = clamp((lt - (a.dur - 0.3)) / 0.3, 0, 1);
    ctx.save(); ctx.globalAlpha = p * (1 - outT);
    ctx.font = `800 ${a.size}px "Baloo 2", system-ui, sans-serif`; ctx.letterSpacing = (lerp(0.9, 0.32, p) * a.size) + 'px';
    ctx.textAlign = a.align || 'center'; ctx.fillStyle = a.color || '#f6eedd';
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 18;
    ctx.fillText(a.text, a.x, a.y); ctx.restore();
  }
  function rule(ctx, x, y, w, t, start, dur) { // thin accent line drawing out from the centre
    const lt = t - start; if (lt < 0 || lt > dur) return;
    const p = E.outExpo(lt / 0.6), outT = clamp((lt - (dur - 0.3)) / 0.3, 0, 1);
    ctx.save(); ctx.globalAlpha = 1 - outT; ctx.fillStyle = '#ffb347'; ctx.shadowColor = 'rgba(255,140,40,.8)'; ctx.shadowBlur = 16;
    ctx.fillRect(x - w * p / 2, y, w * p, 3); ctx.restore();
  }

  // finishing layers
  function letterbox(ctx, amount) { if (amount <= 0) return; const h = 138 * amount; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, h); ctx.fillRect(0, H - h, W, h); }
  const vig = (() => { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); const g = x.createRadialGradient(W / 2, H * 0.52, H * 0.35, W / 2, H / 2, H * 1.05); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(10,4,0,0.62)'); x.fillStyle = g; x.fillRect(0, 0, W, H); return c; })();
  function vignette(ctx) { ctx.drawImage(vig, 0, 0); }
  function leak(ctx, t, strength = 1) { // warm light leak drifting across the frame
    const x = W * (0.15 + 0.7 * ((Math.sin(t * 0.35) + 1) / 2)), y = H * 0.18;
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.28 * strength;
    const g = ctx.createRadialGradient(x, y, 0, x, y, W * 0.55); g.addColorStop(0, 'rgba(255,170,90,0.9)'); g.addColorStop(0.5, 'rgba(255,120,50,0.25)'); g.addColorStop(1, 'rgba(255,100,40,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
  }
  function fade(ctx, a, color = '#000') { if (a <= 0) return; ctx.save(); ctx.globalAlpha = clamp(a, 0, 1); ctx.fillStyle = color; ctx.fillRect(0, 0, W, H); ctx.restore(); }
  function flash(ctx, t, at, len = 0.12, color = 'rgba(255,240,215,1)') { const k = 1 - clamp((t - at) / len, 0, 1); if (t < at || k <= 0) return; ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = k * 0.9; ctx.fillStyle = color; ctx.fillRect(0, 0, W, H); ctx.restore(); }

  window.__OV = { line, sub, rule, letterbox, vignette, leak, fade, flash, E, clamp, lerp, W, H,
    BIG: '400 SIZEpx "Rubik Dirt", "Baloo 2", sans-serif', BOLD: '800 SIZEpx "Baloo 2", system-ui, sans-serif' };
})();
