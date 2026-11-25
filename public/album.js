// The album: what a player has kept and seen. The five festival days (their paintings), the keepsake for keeping all
// five, and the ten things to find in the village (painted stamps). It opens from the home screen and the pause menu;
// finishing a festival day shows that day's card with a Share button; a find drops its stamp in.
// Loaded after the game boots; builds its own DOM and styles (like talk.js). Nothing is drawn in the 3D scene.
// The paintings were made from Dulor's photos of a painted Santal house (design/album/, tools/album.py).
export function initAlbum(C) {
  const doc = document, $ = C.$, FINDS = 'art/finds.webp', COLS = 5, ROWS = 2;
  const el = (tag, cls, text) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const STR = {
    en: { album: 'Album', of: (a, b) => `${a} of ${b}`, days: 'The five days of Sohrai', seen: 'Seen in the village', day: n => 'Day ' + n, notyet: 'Not kept yet',
      fin: 'Sohrai complete', finClue: 'Keep all five days', share: 'Share', go: 'Continue', close: 'Close', added: 'Added to your album', inAlbum: 'In your album',
      kept: (who, day) => who ? `${who} kept ${day}` : `I kept ${day}`, keptAll: who => who ? `${who} kept all five days` : 'I kept all five days',
      sub: n => `Day ${n} of Sohrai, the Santal harvest festival`, subAll: 'Sohrai, the Santal harvest festival', free: 'Play free:',
      text: (day, n, link) => `I kept ${day}, day ${n} of Sohrai, the Santal harvest festival. Come and keep it in your village too: ${link}`,
      textAll: link => `I kept all five days of Sohrai, the Santal harvest festival. Johar! Come and keep it too: ${link}`,
      saved: 'Card saved. Attach it to your WhatsApp message.', line: (a, b) => `Album: ${a} of ${b}`, open: 'Open', five: 'all five days' },
    hi: { album: 'एल्बम', of: (a, b) => `${b} में से ${a}`, days: 'सोहराय के पाँच दिन', seen: 'गाँव में देखा', day: n => 'दिन ' + n, notyet: 'अभी बाकी है',
      fin: 'सोहराय पूरा', finClue: 'पाँचों दिन मनाओ', share: 'शेयर करो', go: 'आगे बढ़ो', close: 'बंद करो', added: 'तुम्हारे एल्बम में जुड़ गया', inAlbum: 'तुम्हारे एल्बम में',
      kept: (who, day) => who ? `${who} ने ${day} मनाया` : `मैंने ${day} मनाया`, keptAll: who => who ? `${who} ने पाँचों दिन मनाए` : 'मैंने पाँचों दिन मनाए',
      sub: n => `सोहराय का दिन ${n} · संताल फसल पर्व`, subAll: 'सोहराय · संताल फसल पर्व', free: 'मुफ़्त खेलो:',
      text: (day, n, link) => `मैंने ${day} मनाया, सोहराय का दिन ${n}। तुम भी अपने गाँव में मनाओ: ${link}`,
      textAll: link => `मैंने सोहराय के पाँचों दिन मनाए। जोहार! तुम भी मनाओ: ${link}`,
      saved: 'कार्ड सेव हो गया। इसे अपने WhatsApp संदेश में जोड़ो।', line: (a, b) => `एल्बम: ${b} में से ${a}`, open: 'खोलो', five: 'पाँचों दिन' },
  };
  const lang = () => { const s = C.story(); return s && s.lang && s.lang() === 'hi' ? 'hi' : 'en'; }; // Santali falls back to English until a speaker gives the words
  const t = k => STR[lang()][k];
  const data = () => { const s = C.story(); return s && s.albumData ? s.albumData() : { days: [], sights: [], fin: false }; };
  const who = () => { let n = ''; try { n = (localStorage.getItem('khuntau-name') || '').trim(); } catch (e) {} return n.slice(0, 14); };

  const css = el('style'); css.textContent = `
#album { position: fixed; inset: 0; z-index: 20; background: #120a06; overflow-y: auto; touch-action: pan-y; -webkit-overflow-scrolling: touch; overscroll-behavior: contain;
  padding: calc(12px + env(safe-area-inset-top, 0px)) max(14px, env(safe-area-inset-right, 0px)) calc(24px + env(safe-area-inset-bottom, 0px)) max(14px, env(safe-area-inset-left, 0px)); box-sizing: border-box; }
#album[hidden], #albView[hidden], #albStamp[hidden] { display: none; }
.alb-in { width: min(720px, 100%); margin: 0 auto; display: grid; gap: 12px; }
.alb-top { display: flex; align-items: center; gap: 10px; position: sticky; top: calc(-12px - env(safe-area-inset-top, 0px)); padding: calc(10px + env(safe-area-inset-top, 0px)) 0 8px; margin-top: calc(-10px - env(safe-area-inset-top, 0px)); background: #120a06; z-index: 1; }
.alb-top h2 { margin: 0; font: 400 clamp(26px, 7vw, 34px) var(--font-display); color: var(--saffron); text-shadow: 0 2px 0 #7a2a14; }
.alb-top span { font-weight: 800; font-size: 14px; opacity: .8; margin-right: auto; padding-top: 6px; }
.alb-x { all: unset; cursor: pointer; width: 42px; height: 42px; display: grid; place-items: center; border-radius: 12px; background: rgba(246, 238, 221, .12); font-size: 22px; font-weight: 800; }
.alb-x:focus-visible, .alb-card:focus-visible { outline: 3px solid var(--saffron); outline-offset: 2px; }
#album h3 { margin: 4px 0 0; font: 800 15px var(--font-ui); letter-spacing: .08em; text-transform: uppercase; opacity: .85; display: flex; justify-content: space-between; }
.alb-days { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.alb-finds { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
@media (min-width: 700px) { .alb-days { grid-template-columns: repeat(6, 1fr); } .alb-finds { grid-template-columns: repeat(5, 1fr); } }
@media (orientation: landscape) and (max-height: 520px) { .alb-days { grid-template-columns: repeat(6, 1fr); } .alb-finds { grid-template-columns: repeat(5, 1fr); } }
.alb-card { all: unset; cursor: pointer; display: grid; gap: 4px; text-align: center; min-width: 0; }
.alb-card i { display: block; border-radius: 10px; border: 2px solid #eaa2a6; background: #2c2e30 center / cover no-repeat; box-shadow: 0 4px 14px rgba(0, 0, 0, .5); position: relative; overflow: hidden; }
.alb-day i { aspect-ratio: .8; } .alb-find i { aspect-ratio: 1; background-size: ${COLS * 100}% ${ROWS * 100}%; }
.alb-card.no { cursor: default; } .alb-card.no i { border-color: rgba(246, 238, 221, .22); border-style: dashed; box-shadow: none; background-image: none !important; }
.alb-card.no i::after { content: "?"; position: absolute; inset: 0; display: grid; place-items: center; font: 400 clamp(26px, 9vw, 44px) var(--font-display); color: rgba(246, 238, 221, .28); }
.alb-day.no i::after { content: attr(data-n); }
.alb-card b { font-size: 13px; font-weight: 800; line-height: 1.15; overflow-wrap: anywhere; }
.alb-card small { font-size: 11px; line-height: 1.2; opacity: .62; } .alb-card small[lang=sat] { font-family: var(--font-olchiki); opacity: .8; }
.alb-card.no b { opacity: .6; } .alb-card.no small { font-style: italic; }
.alb-card.new i { animation: albNew 1.2s ease-out 2; } @keyframes albNew { 0% { box-shadow: 0 0 0 0 rgba(255, 179, 71, .9); } 100% { box-shadow: 0 0 0 16px rgba(255, 179, 71, 0); } }
#albView { position: fixed; inset: 0; z-index: 21; background: #0d0704; display: grid; place-items: center; align-content: center; gap: 10px; overflow-y: auto; touch-action: pan-y;
  padding: calc(12px + env(safe-area-inset-top, 0px)) 16px calc(14px + env(safe-area-inset-bottom, 0px)); box-sizing: border-box; text-align: center; }
#albView em { font-style: normal; font-weight: 800; font-size: 13px; letter-spacing: .14em; text-transform: uppercase; color: var(--saffron); min-height: 1em; }
#albView .albv-pic { width: min(86vw, calc(62vh * .8), 420px); aspect-ratio: .8; border-radius: 14px; border: 2px solid #eaa2a6; background: #2c2e30 center / cover no-repeat; box-shadow: 0 10px 40px rgba(0, 0, 0, .6); display: block; object-fit: cover; }
#albView .albv-pic.sq { width: min(78vw, 56vh, 380px); aspect-ratio: 1; background-size: ${COLS * 100}% ${ROWS * 100}%; }
#albView b { font: 400 clamp(20px, 5.6vw, 28px) var(--font-display); color: var(--paste); max-width: min(92vw, 460px); }
#albView p { margin: 0; max-width: min(92vw, 460px); font-weight: 700; font-size: 14px; opacity: .85; min-height: 1em; }
#albView .albv-btns { display: grid; gap: 4px; justify-items: center; }
@media (orientation: landscape) and (max-height: 520px) { #albView { grid-template-columns: auto minmax(180px, 300px); column-gap: 18px; } #albView .albv-pic { grid-row: 1 / span 5; width: auto; height: min(86vh, 380px); } #albView .albv-pic.sq { height: min(80vh, 320px); width: auto; } }
#albStamp { all: unset; position: fixed; z-index: 8; left: calc(12px + env(safe-area-inset-left, 0px)); top: calc(62px + env(safe-area-inset-top, 0px)); display: flex; align-items: center; gap: 9px; cursor: pointer;
  background: rgba(20, 10, 6, .9); border: 1px solid rgba(234, 162, 166, .7); border-radius: 14px; padding: 6px 12px 6px 6px; max-width: min(74vw, 320px); transform: translateX(-120%); transition: transform .45s cubic-bezier(.2, 1.2, .4, 1); box-sizing: border-box; }
#albStamp.show { transform: none; }
#albStamp i { flex: none; width: 56px; height: 56px; border-radius: 9px; background: #2c2e30 no-repeat; background-size: ${COLS * 100}% ${ROWS * 100}%; }
#albStamp b { display: block; font-size: 13px; font-weight: 800; line-height: 1.15; } #albStamp small { display: block; font-size: 11px; opacity: .7; }
`; doc.head.appendChild(css);

  const root = el('div'); root.id = 'album'; root.hidden = true; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true');
  const inner = el('div', 'alb-in'), top = el('div', 'alb-top'), h2 = el('h2'), cnt = el('span'), x = el('button', 'alb-x', '✕'); x.type = 'button';
  const hDays = el('h3'), gDays = el('div', 'alb-days'), hFinds = el('h3'), gFinds = el('div', 'alb-finds');
  top.append(h2, cnt, x); inner.append(top, hDays, gDays, hFinds, gFinds); root.appendChild(inner); doc.body.appendChild(root);
  const view = el('div'); view.id = 'albView'; view.hidden = true; view.setAttribute('role', 'dialog'); view.setAttribute('aria-modal', 'true');
  const vHead = el('em'), vImg = el('img', 'albv-pic'), vSq = el('i', 'albv-pic sq'), vTitle = el('b'), vSub = el('p'), vBtns = el('div', 'albv-btns'), vShare = el('button', 'btn'), vClose = el('button', 'linkbtn'), vNote = el('p', 'fine');
  vImg.alt = ''; vShare.type = vClose.type = 'button'; vBtns.append(vShare, vClose); view.append(vHead, vImg, vSq, vTitle, vSub, vBtns, vNote); doc.body.appendChild(view);
  const stampEl = el('button'); stampEl.id = 'albStamp'; stampEl.type = 'button'; stampEl.hidden = true; const sPic = el('i'), sTxt = el('div'), sName = el('b'), sSub = el('small'); sTxt.append(sName, sSub); stampEl.append(sPic, sTxt); doc.body.appendChild(stampEl);

  const A = { open: false, view: null, fresh: null, urls: {}, stampT: 0 };
  const cell = (i) => `${(i % COLS) * (100 / (COLS - 1))}% ${Math.floor(i / COLS) * (100 / (ROWS - 1))}%`;
  const count = () => { const d = data(); return { have: d.days.filter(q => q.done).length + (d.fin ? 1 : 0) + d.sights.filter(q => q.seen).length, all: d.days.length + 1 + d.sights.length }; };
  function refresh() { const b = $('albumBtn'); if (!b) return; const c = count(); if (!c.all || c.all < 2) { b.hidden = true; return; } b.hidden = false; $('albumLine').textContent = t('line')(c.have, c.all); b.querySelector('u').textContent = t('open'); }

  function paint() {
    const d = data(), c = count(); h2.textContent = t('album'); cnt.textContent = t('of')(c.have, c.all); x.setAttribute('aria-label', t('close'));
    hDays.textContent = t('days'); gDays.textContent = '';
    for (const q of d.days) { const b = el('button', 'alb-card alb-day' + (q.done ? '' : ' no') + (A.fresh === 'd' + q.n ? ' new' : '')), pic = el('i'); b.type = 'button'; b.dataset.d = q.n; pic.dataset.n = q.n;
      if (q.done) pic.style.backgroundImage = `url(art/day${q.n}.webp)`; const ol = el('small', '', q.ol); ol.lang = 'sat';
      b.append(pic, el('b', '', q.name), q.done ? ol : el('small', '', t('notyet'))); if (!q.done) b.disabled = true; gDays.appendChild(b); }
    { const b = el('button', 'alb-card alb-day' + (d.fin ? '' : ' no') + (A.fresh === 'fin' ? ' new' : '')), pic = el('i'); b.type = 'button'; b.dataset.d = 'fin'; pic.dataset.n = '★';
      if (d.fin) pic.style.backgroundImage = 'url(art/complete.webp)'; b.append(pic, el('b', '', t('fin')), el('small', '', d.fin ? t('five') : t('finClue'))); if (!d.fin) b.disabled = true; gDays.appendChild(b); }
    const seen = d.sights.filter(q => q.seen).length; hFinds.textContent = ''; hFinds.append(el('span', '', t('seen')), el('span', '', seen + '/' + d.sights.length)); gFinds.textContent = '';
    d.sights.forEach((q, i) => { const b = el('button', 'alb-card alb-find' + (q.seen ? '' : ' no') + (A.fresh === q.id ? ' new' : '')), pic = el('i'); b.type = 'button'; b.dataset.id = q.id;
      if (q.seen) { pic.style.backgroundImage = `url(${FINDS})`; pic.style.backgroundPosition = cell(i); } b.append(pic, q.seen ? el('b', '', q.name) : el('small', '', q.clue)); if (!q.seen) b.disabled = true; gFinds.appendChild(b); });
  }
  function open(from) { if (A.open) return; A.open = true; paint(); root.hidden = false; root.scrollTop = 0; C.track('album.open'); if (from) A.from = from; x.focus({ preventScroll: true }); }
  function close() { if (A.view) return closeView(); if (!A.open) return; A.open = false; root.hidden = true; A.fresh = null; refresh(); }

  // The card that is shared: the day's painting, its name on the plain wall at the top, who kept it and where to play
  // at the foot. Drawn on a canvas so what is seen is what is sent.
  async function compose(kind, n) {
    const d = data(), W = 1080, H = 1350, hi = lang() === 'hi', day = kind === 'fin' ? null : d.days[n - 1], key = kind + n + lang() + who(); if (A.urls[key]) return A.urls[key];
    const c = doc.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    try { await Promise.all([doc.fonts.load('96px "Rubik Dirt"'), doc.fonts.load('800 40px "Baloo 2"'), doc.fonts.load('600 40px "Noto Sans Ol Chiki"', 'ᱥᱚᱦᱨᱟᱭ')]); } catch (e) {}
    g.fillStyle = '#2c2e30'; g.fillRect(0, 0, W, H);
    const art = new Image(); art.src = kind === 'fin' ? 'art/complete.webp' : `art/day${n}.webp`; const ok = await art.decode().then(() => true, () => false);
    if (ok) { const s = Math.max(W / art.width, H / art.height); g.drawImage(art, (W - art.width * s) / 2, (H - art.height * s) / 2, art.width * s, art.height * s); }
    const topFade = g.createLinearGradient(0, 0, 0, 330); topFade.addColorStop(0, 'rgba(24,14,10,.86)'); topFade.addColorStop(.7, 'rgba(24,14,10,.5)'); topFade.addColorStop(1, 'rgba(24,14,10,0)'); g.fillStyle = topFade; g.fillRect(0, 0, W, 330);
    const foot = g.createLinearGradient(0, 1090, 0, H); foot.addColorStop(0, 'rgba(20,10,6,0)'); foot.addColorStop(.42, 'rgba(20,10,6,.86)'); foot.addColorStop(1, 'rgba(20,10,6,.96)'); g.fillStyle = foot; g.fillRect(0, 1090, W, H - 1090); // a short band: the painting's foot (the alpana, the fish) stays in the light
    const fit = (text, font, size, max) => { do { g.font = font.replace('#', size); if (g.measureText(text).width <= max) break; size -= 4; } while (size > 24); };
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.fillStyle = '#ffb347'; g.font = '600 46px "Noto Sans Ol Chiki", sans-serif'; g.fillText(kind === 'fin' ? 'ᱥᱚᱦᱨᱟᱭ' : day.ol, W / 2, 92);
    const title = kind === 'fin' ? t('fin') : day.name; fit(title, hi ? '800 #px "Baloo 2", sans-serif' : '#px "Rubik Dirt", "Baloo 2", sans-serif', hi ? 104 : 112, W - 120);
    g.fillStyle = '#7a2a14'; g.fillText(title, W / 2, 207); g.fillStyle = '#f6eedd'; g.fillText(title, W / 2, 200);
    g.font = '800 36px "Baloo 2", sans-serif'; g.fillStyle = 'rgba(246,238,221,.92)'; g.fillText(kind === 'fin' ? t('subAll') : t('sub')(n), W / 2, 258);
    const line = kind === 'fin' ? t('keptAll')(who()) : t('kept')(who(), day.name); fit(line, '800 #px "Baloo 2", sans-serif', 58, W - 110); g.fillStyle = '#ffb347'; g.fillText(line, W / 2, 1248);
    g.font = '700 32px "Baloo 2", sans-serif'; g.fillStyle = 'rgba(246,238,221,.9)'; g.fillText(t('free') + ' ' + location.host, W / 2, 1306);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', .9)); return (A.urls[key] = { blob, url: URL.createObjectURL(blob), painted: ok });
  }
  async function show(kind, n, fresh) { // kind: 'day' | 'fin' | 'find'
    const d = data(); A.view = { kind, n, fresh: !!fresh }; vNote.textContent = ''; vHead.textContent = fresh ? t('added') : ''; vClose.textContent = fresh ? t('go') : t('close'); vShare.textContent = t('share');
    if (kind === 'find') { const i = d.sights.findIndex(q => q.id === n), q = d.sights[i]; if (!q) { A.view = null; return; } vImg.hidden = true; vSq.hidden = false; vSq.style.backgroundImage = `url(${FINDS})`; vSq.style.backgroundPosition = cell(i);
      vTitle.textContent = q.name; vSub.textContent = t('seen') + ' · ' + d.sights.filter(s => s.seen).length + '/' + d.sights.length; vShare.hidden = true; view.hidden = false; vClose.focus({ preventScroll: true }); return; }
    vSq.hidden = true; vImg.hidden = false; vShare.hidden = false; vImg.removeAttribute('src'); vImg.style.backgroundImage = `url(${kind === 'fin' ? 'art/complete.webp' : `art/day${n}.webp`})`;
    vTitle.textContent = kind === 'fin' ? t('fin') : t('day')(n) + ': ' + d.days[n - 1].name; vSub.textContent = kind === 'fin' ? '' : (fresh && d.days[n - 1].next) || d.days[n - 1].task || '';
    view.hidden = false; vShare.focus({ preventScroll: true }); C.track(fresh ? 'keep.show' : 'album.view');
    const card = await compose(kind, n).catch(() => null); if (card && A.view && A.view.kind === kind && A.view.n === n) vImg.src = card.url; }
  function closeView() { if (!A.view) return; const v = A.view; A.view = null; view.hidden = true; if (A.open) paint(); refresh(); if (v.fresh && C.resume) C.resume(); }
  async function share() { const v = A.view; if (!v || v.kind === 'find') return; C.track('keep.share'); const d = data(), link = location.origin + '/?k=' + (v.kind === 'fin' ? 'all' : v.n);
    const text = v.kind === 'fin' ? t('textAll')(link) : t('text')(d.days[v.n - 1].name, v.n, link);
    try { const card = await compose(v.kind, v.n), file = new File([card.blob], v.kind === 'fin' ? 'sohrai-complete.jpg' : `sohrai-day${v.n}.jpg`, { type: 'image/jpeg' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text, title: 'Sohrai' }); return; }
      if (navigator.share) { await navigator.share({ text, title: 'Sohrai' }); return; }
      const a = doc.createElement('a'); a.href = card.url; a.download = file.name; a.click(); window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener'); vNote.textContent = t('saved');
    } catch (e) { if (e && e.name === 'AbortError') return; window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener'); } }

  // a festival day has just been kept: its card, with Share. The fifth day brings the keepsake for all five.
  function keep(n) { const d = data(); if (!d.days[n - 1]) return false; A.fresh = n >= 5 && d.fin ? 'fin' : 'd' + n; show(n >= 5 && d.fin ? 'fin' : 'day', n, true); refresh(); return true; }
  // a thing has just been seen in the village: its stamp slides in for a moment; a tap opens the album on it
  function stamp(id) { const d = data(), i = d.sights.findIndex(q => q.id === id); if (i < 0) return; const img = new Image(); img.src = FINDS; // starts the download; the stamp shows the plain card until it is in
    sPic.style.backgroundImage = `url(${FINDS})`; sPic.style.backgroundPosition = cell(i); sName.textContent = d.sights[i].name; sSub.textContent = t('inAlbum') + ' · ' + d.sights.filter(q => q.seen).length + '/' + d.sights.length;
    A.fresh = id; stampEl.hidden = false; void stampEl.offsetWidth; stampEl.classList.add('show'); clearTimeout(A.stampT); A.stampT = setTimeout(() => { stampEl.classList.remove('show'); setTimeout(() => { if (!stampEl.classList.contains('show')) stampEl.hidden = true; }, 500); }, 4200); refresh(); }

  for (const e of [root, view, stampEl]) e.addEventListener('pointerdown', ev => ev.stopPropagation()); // or a drag here swings the camera behind
  x.addEventListener('click', close); vClose.addEventListener('click', closeView); vShare.addEventListener('click', share);
  view.addEventListener('click', e => { if (e.target === view) closeView(); });
  stampEl.addEventListener('click', () => { stampEl.classList.remove('show'); stampEl.hidden = true; if (C.pause) C.pause(); open('stamp'); });
  root.addEventListener('click', e => { const b = e.target.closest('.alb-card'); if (!b || b.disabled) return; if (b.dataset.id) show('find', b.dataset.id); else if (b.dataset.d === 'fin') show('fin', 5); else show('day', +b.dataset.d); });
  // the game must not walk, roll or pause from keys pressed while the album is up
  addEventListener('keydown', e => { if (!A.open && !A.view) return; if (e.key === 'Escape') { close(); e.preventDefault(); } e.stopPropagation(); }, true);
  addEventListener('keyup', e => { if (A.open || A.view) e.stopPropagation(); }, true);
  if ($('albumBtn')) $('albumBtn').addEventListener('click', () => open('home'));
  refresh();
  return { open, close, keep, stamp, count, refresh, compose, isOpen: () => A.open || !!A.view, state: () => A };
}
