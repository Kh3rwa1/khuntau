// Village talk: one public chat for everyone who plays. Messages stay for three days, so it is never an empty room:
// you arrive to what people said earlier and can answer; when two people are on together it is live.
//   - home screen: a row with who is here and the newest message (#talkBtn in index.html)
//   - in the village: a button under the pause button, the talking place by the log seat (TALK, wired in story.js),
//     and what people say shown as a bubble over that place, or as a line at the top when it is out of sight
//   - quick phrases travel as a key and are shown in each reader's language (QUICK below; keys = CHAT_QUICK in worker.js)
// Server: /api/here (heartbeat), /api/chat (read, say), /api/chat/report in src/worker.js. With no server (offline,
// the packed app without network) nothing of this shows. Everything is built here, so it costs nothing before PLAY.
const QUICK = {
  en: { johar: 'Johar!', who: 'Anyone here?', round: 'Who wants a round at the khunt?', khunt: 'Come to the khunt!', nice: 'Well played!', where: 'Which village are you from?', thanks: 'Thank you!', bye: 'See you tomorrow!' },
  hi: { johar: 'जोहार!', who: 'कोई है यहाँ?', round: 'खूँटे पर एक राउंड कौन खेलेगा?', khunt: 'खूँटे पर आओ!', nice: 'बहुत बढ़िया खेला!', where: 'आप किस गाँव से हैं?', thanks: 'धन्यवाद!', bye: 'कल मिलते हैं!' },
};
const STR = {
  en: { title: 'Village talk', here: '# here now', today: '# came today', open: 'Talk', homeEmpty: 'say Johar to the village', rules: 'Everyone who plays can read this. Be kind. No phone numbers or links. Messages fade after 3 days.',
    empty: 'Nobody has spoken yet. Say Johar!', ph: 'Say something…', name: 'Your name', send: 'Send', report: 'Report', hide: 'Hide this person', reported: 'Reported. You will not see it again.', hidden: 'You will not see this person again.',
    now: 'now', min: '# min', hr: '# h', day: '# d', close: 'Close', more: 'More', needName: 'Add your name first.',
    e_link: 'Links cannot be sent here.', e_number: 'Phone numbers cannot be sent here.', e_contact: 'No handles or other apps here. Talk in the village.', e_words: 'Keep it kind. That was not sent.',
    e_slow: 'A little slower: wait a few seconds.', e_dup: 'You just said that.', e_muted: 'You cannot post here.', e_net: 'Could not send. Check your internet.' },
  hi: { title: 'गाँव की बातचीत', here: 'अभी # लोग यहाँ', today: 'आज # लोग आए', open: 'बात करो', homeEmpty: 'गाँव को जोहार कहो', rules: 'हर खिलाड़ी इसे पढ़ सकता है। प्यार से बोलो। फ़ोन नंबर या लिंक नहीं। संदेश 3 दिन बाद मिट जाते हैं।',
    empty: 'अभी तक कोई नहीं बोला। जोहार कहो!', ph: 'कुछ कहो…', name: 'आपका नाम', send: 'भेजो', report: 'शिकायत', hide: 'इस व्यक्ति को छिपाओ', reported: 'शिकायत दर्ज। अब यह आपको नहीं दिखेगा।', hidden: 'अब यह व्यक्ति आपको नहीं दिखेगा।',
    now: 'अभी', min: '# मिनट', hr: '# घंटे', day: '# दिन', close: 'बंद करो', more: 'और', needName: 'पहले अपना नाम लिखो।',
    e_link: 'यहाँ लिंक नहीं भेज सकते।', e_number: 'यहाँ फ़ोन नंबर नहीं भेज सकते।', e_contact: 'यहाँ दूसरे ऐप या हैंडल नहीं। गाँव में ही बात करो।', e_words: 'प्यार से बोलो। वह संदेश नहीं भेजा गया।',
    e_slow: 'थोड़ा धीरे: कुछ सेकंड रुको।', e_dup: 'यह आपने अभी कहा।', e_muted: 'आप यहाँ नहीं लिख सकते।', e_net: 'भेज नहीं पाए। इंटरनेट देखो।' },
};
const CSS = `
#talkBtn .talk-dot, .talk-count i { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #6fcf6a; margin-right: 6px; vertical-align: 1px; }
#talkBtn span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#talkHud { position: fixed; z-index: 5; top: calc(58px + env(safe-area-inset-top, 0px)); right: calc(12px + env(safe-area-inset-right, 0px)); }
#talkHud[hidden] { display: none; }
#talkHud.new::after { content: ""; position: absolute; top: -3px; right: -3px; width: 11px; height: 11px; border-radius: 50%; background: #ffb347; border: 2px solid #24130c; }
#talk { position: fixed; inset: 0; z-index: 12; background: rgba(10, 6, 4, .5); display: flex; align-items: flex-end; justify-content: center; }
#talk[hidden], #talkToast[hidden], #talkBubble[hidden] { display: none; }
.talk-sheet { width: min(560px, 100%); max-height: min(78vh, 640px); display: flex; flex-direction: column; gap: 8px; box-sizing: border-box; margin-bottom: var(--kb, 0px); padding: 12px 14px calc(10px + env(safe-area-inset-bottom, 0px));
  background: #24130c; color: var(--paste, #f6eedd); border: 1px solid rgba(255, 179, 71, .4); border-bottom: 0; border-radius: 18px 18px 0 0; font-family: var(--font-ui, sans-serif); -webkit-user-select: text; user-select: text; }
@media (min-width: 900px) and (min-height: 600px) { #talk { align-items: center; } .talk-sheet { border-bottom: 1px solid rgba(255, 179, 71, .4); border-radius: 18px; } }
.talk-head { display: flex; align-items: baseline; gap: 10px; }
.talk-head b { font-family: var(--font-display, inherit); font-size: 22px; color: #ffb347; line-height: 1; }
.talk-count { flex: 1; font-size: 13px; opacity: .85; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.talk-x { all: unset; cursor: pointer; width: 34px; height: 34px; margin: -6px -6px -6px 0; display: grid; place-items: center; font-size: 24px; line-height: 1; border-radius: 10px; }
.talk-list { list-style: none; margin: 0; padding: 0; flex: 1; min-height: 90px; overflow-y: auto; touch-action: pan-y; -webkit-overflow-scrolling: touch; display: flex; flex-direction: column; gap: 8px; }
.talk-list li { background: rgba(246, 238, 221, .07); border-radius: 12px; padding: 6px 10px 7px; }
.talk-list li.me { background: rgba(255, 179, 71, .16); align-self: flex-end; max-width: 92%; }
.talk-list li.talk-note { background: none; padding: 0 2px; font-size: 12.5px; opacity: .7; } /* not .note: that is the drum game's falling note */
.talk-meta { display: flex; align-items: baseline; gap: 8px; font-size: 12.5px; }
.talk-meta b { color: #ffb347; font-size: 14px; }
.talk-meta small { opacity: .7; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.talk-meta time { margin-left: auto; opacity: .6; white-space: nowrap; }
.talk-more { all: unset; cursor: pointer; padding: 0 4px; font-size: 18px; line-height: 1; opacity: .7; }
.talk-list p { margin: 2px 0 0; font-size: 16px; line-height: 1.3; overflow-wrap: anywhere; }
.talk-act { display: flex; gap: 14px; margin-top: 6px; }
.talk-act button { all: unset; cursor: pointer; font-size: 13px; color: #ffb347; text-decoration: underline; text-underline-offset: 3px; }
.talk-quick { display: flex; gap: 8px; overflow-x: auto; touch-action: pan-x; scrollbar-width: none; flex: none; padding-bottom: 2px; }
.talk-quick::-webkit-scrollbar { display: none; }
.talk-quick button { all: unset; cursor: pointer; flex: none; font-size: 14px; padding: 6px 12px; border-radius: 999px; border: 1px solid rgba(255, 179, 71, .5); white-space: nowrap; }
.talk-err { font-size: 13.5px; color: #ffb347; min-height: 1.2em; }
.talk-err.quiet { color: inherit; opacity: .7; font-size: 12.5px; line-height: 1.3; }
.talk-form { display: flex; gap: 8px; flex: none; }
.talk-form input { flex: 1; min-width: 0; font: inherit; font-size: 16px; color: inherit; background: rgba(246, 238, 221, .1); border: 1px solid rgba(246, 238, 221, .22); border-radius: 12px; padding: 9px 12px; outline: none; }
.talk-form input.talk-name { flex: 0 0 34%; }
.talk-form input:focus { border-color: #ffb347; }
.talk-form button { all: unset; cursor: pointer; flex: none; padding: 9px 16px; border-radius: 12px; background: #ffb347; color: #24130c; font-weight: 800; font-size: 15px; }
.talk-form button[disabled] { opacity: .5; }
@media (max-height: 460px) { .talk-sheet { max-height: 96vh; gap: 5px; padding-top: 8px; } .talk-head b { font-size: 18px; } .talk-list { min-height: 56px; } }
#talkToast, #talkBubble { position: fixed; z-index: 6; max-width: min(72vw, 340px); box-sizing: border-box; padding: 7px 12px 8px; border-radius: 14px; background: rgba(246, 238, 221, .96); color: #24130c; font: 600 14.5px/1.3 var(--font-ui, sans-serif);
  box-shadow: 0 6px 18px rgba(0, 0, 0, .4); cursor: pointer; overflow-wrap: anywhere; opacity: 0; transition: opacity .3s; }
#talkToast.show, #talkBubble.show { opacity: 1; }
#talkToast { top: calc(58px + env(safe-area-inset-top, 0px)); left: calc(12px + env(safe-area-inset-left, 0px)); }
#talkBubble { left: 0; top: 0; transform: translate(-50%, -100%); }
#talkBubble::after { content: ""; position: absolute; left: 50%; bottom: -7px; margin-left: -7px; border: 7px solid transparent; border-top-color: rgba(246, 238, 221, .96); border-bottom: 0; }
#talkToast b, #talkBubble b { color: #9a3d1c; }
#talkToast small, #talkBubble small { opacity: .65; font-weight: 500; }
@media (prefers-reduced-motion: reduce) { #talkToast, #talkBubble { transition: none; } }
`;

export function initTalk(C) {
  const { $, meta, track } = C, doc = document;
  const T = { on: false, now: 0, today: 0, msgs: [], last: 0, newest: null, seen: 0, hide: new Set(), open: false, poll: 0, near: false, spoke: 0, queue: [], showing: null, busy: false, loaded: false };
  try { const s = JSON.parse(localStorage.getItem('khuntau-talk') || '{}'); T.seen = s.seen | 0; T.spoken = !!s.spoken; for (const a of s.hide || []) T.hide.add(a); } catch (e) {}
  const keep = () => { try { localStorage.setItem('khuntau-talk', JSON.stringify({ seen: T.seen, spoken: T.spoken ? 1 : 0, hide: [...T.hide].slice(-200) })); } catch (e) {} };
  const lang = () => { let l = 'en'; try { l = localStorage.getItem('khuntau-lang') || 'en'; } catch (e) {} return STR[l] ? l : 'en'; };
  const t = (k, n) => { const s = STR[lang()][k] || STR.en[k] || ''; return n == null ? s : s.replace('#', n); };
  const said = m => m.q ? (QUICK[lang()][m.q] || QUICK.en[m.q] || '') : (m.x || '');
  const ago = at => { const s = Math.max(0, Date.now() - at) / 1000; return s < 90 ? t('now') : s < 5400 ? t('min', Math.round(s / 60)) : s < 129600 ? t('hr', Math.round(s / 3600)) : t('day', Math.round(s / 86400)); };
  const visible = m => !T.hide.has(m.a) && said(m);
  const el = (tag, cls, text) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const name = () => { try { return (localStorage.getItem('khuntau-name') || '').trim(); } catch (e) { return ''; } };

  /* ---------- what it is made of ---------- */
  doc.head.appendChild(el('style', null, CSS));
  const hud = el('button', 'icon-btn'); hud.id = 'talkHud'; hud.type = 'button'; hud.hidden = true;
  hud.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-7l-5 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/></svg>';
  const box = el('div'); box.id = 'talk'; box.hidden = true; box.setAttribute('role', 'dialog');
  const sheet = el('div', 'talk-sheet'), head = el('div', 'talk-head'), title = el('b'), count = el('span', 'talk-count'), x = el('button', 'talk-x', '×'); x.type = 'button';
  const list = el('ul', 'talk-list'), quick = el('div', 'talk-quick'), err = el('div', 'talk-err'), form = el('form', 'talk-form');
  const nameIn = el('input', 'talk-name'), input = el('input', 'talk-in'), send = el('button', null); send.type = 'submit';
  nameIn.maxLength = 14; nameIn.autocomplete = 'nickname'; input.maxLength = 120; input.autocomplete = 'off'; input.setAttribute('enterkeyhint', 'send');
  head.append(title, count, x); form.append(nameIn, input, send); sheet.append(head, list, quick, err, form); box.append(sheet);
  const toast = el('div'); toast.id = 'talkToast'; toast.hidden = true; const bubble = el('div'); bubble.id = 'talkBubble'; bubble.hidden = true;
  doc.body.append(hud, box, toast, bubble);
  const row = $('talkBtn');

  /* ---------- talking to the server ---------- */
  const api = async (path, body) => { const r = await fetch(path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}); let d = null; try { d = await r.json(); } catch (e) {} return { s: r.status, d: d || {} }; };
  const take = d => { // counts and any new messages from a reply
    if (typeof d.now === 'number') { T.now = d.now; T.today = d.today; }
    let fresh = [];
    if (Array.isArray(d.msgs) && d.msgs.length) { const have = new Set(T.msgs.map(m => m.id)); fresh = d.msgs.filter(m => !have.has(m.id)); T.msgs = T.msgs.concat(fresh).sort((a, b) => a.id - b.id).slice(-80); }
    if (T.msgs.length) T.last = Math.max(T.last, T.msgs[T.msgs.length - 1].id);
    const shown = T.msgs.filter(visible); if (shown.length) T.newest = shown[shown.length - 1];
    return fresh;
  };
  async function beat() { // every half minute: am I here, who else is, is there anything new
    if (doc.hidden || !meta.pid) return;
    let r; try { r = await api('/api/here?pid=' + meta.pid); } catch (e) { return; }
    if (r.s !== 200) { if (r.s === 404 || r.d.on === 0) setOn(false); return; }
    setOn(r.d.on === 1); if (!T.on) return;
    T.now = r.d.now; T.today = r.d.today; if (r.d.p && !T.hide.has(r.d.p.a) && (!T.newest || r.d.p.id > T.newest.id)) T.newest = r.d.p;
    if (r.d.last > T.last && (T.open || roaming() || !T.loaded)) await pull();
    paint();
  }
  async function pull() { // messages after the newest one I have
    let r; try { r = await api('/api/chat?pid=' + meta.pid + '&after=' + T.last); } catch (e) { return; }
    if (r.s !== 200) return; const first = !T.loaded; T.loaded = true;
    const fresh = take(r.d).filter(m => !m.me && visible(m));
    if (T.open) { render(); markSeen(); } else if (!first && roaming()) for (const m of fresh.slice(-2)) T.queue.push(m); // said while you are in the village: shown as it comes
    paint();
  }
  function setOn(on) { if (T.on === on) return; T.on = on; if (!on) { close(); hud.hidden = true; if (row) row.hidden = true; } paint(); }

  /* ---------- home row, button, counts ---------- */
  const countText = () => T.now > 1 ? t('here', T.now) : t('today', Math.max(1, T.today));
  function paint() {
    if (row) { row.hidden = !T.on; if (T.on) { const s = row.querySelector('span'), u = row.querySelector('u'), m = T.newest; s.textContent = '';
      const dot = el('i', 'talk-dot'); s.append(dot, countText() + ' · ' + (m ? m.n + ': ' + said(m) : t('homeEmpty'))); u.textContent = t('open'); } }
    hud.classList.toggle('new', !!T.newest && T.newest.id > T.seen && !T.newest.me);
    hud.setAttribute('aria-label', t('title')); hud.title = t('title');
    if (T.open) { count.textContent = ''; count.append(el('i'), countText() + (T.now > 1 ? ' · ' + t('today', T.today) : '')); }
  }
  const markSeen = () => { if (T.last > T.seen) { T.seen = T.last; keep(); } hud.classList.remove('new'); };

  /* ---------- the panel ---------- */
  function render() {
    const atEnd = list.scrollHeight - list.scrollTop - list.clientHeight < 60; list.textContent = '';
    list.append(el('li', 'talk-note', t('rules')));
    const shown = T.msgs.filter(visible); if (!shown.length) list.append(el('li', 'talk-note', t('empty')));
    for (const m of shown) {
      const li = el('li', m.me ? 'me' : ''), meta2 = el('div', 'talk-meta'); li.dataset.id = m.id;
      meta2.append(el('b', null, m.n)); if (m.v) meta2.append(el('small', null, m.v)); meta2.append(el('time', null, ago(m.at)));
      li.append(meta2, el('p', null, said(m)));
      if (!m.me) { const more = el('button', 'talk-more', '⋯'); more.type = 'button'; more.setAttribute('aria-label', t('more')); meta2.append(more);
        const act = el('div', 'talk-act'), rep = el('button', null, t('report')), hid = el('button', null, t('hide')); rep.type = hid.type = 'button'; act.hidden = true; act.append(rep, hid); li.append(act);
        more.onclick = () => { act.hidden = !act.hidden; };
        rep.onclick = async () => { T.msgs = T.msgs.filter(o => o.id !== m.id); render(); note(t('reported')); track('talk.report'); try { await api('/api/chat/report', { pid: meta.pid, id: m.id }); } catch (e) {} fixNewest(); };
        hid.onclick = () => { T.hide.add(m.a); keep(); render(); note(t('hidden')); fixNewest(); }; }
      list.append(li);
    }
    if (atEnd || !render.done) list.scrollTop = list.scrollHeight; render.done = true;
    if (!err.dataset.msg) note(''); // the rules line follows what is in view
  }
  const fixNewest = () => { const shown = T.msgs.filter(visible); T.newest = shown.length ? shown[shown.length - 1] : null; paint(); };
  // until you have spoken once, the rules stand where errors go, unless the copy at the top of the list is in view anyway
  const note = s => { const top = list.querySelector('.talk-note'), inView = !!top && list.scrollTop < top.offsetHeight; err.textContent = s || (T.spoken || inView ? '' : t('rules')); err.classList.toggle('quiet', !s); err.dataset.msg = s ? '1' : ''; };
  function labels() {
    title.textContent = t('title'); x.setAttribute('aria-label', t('close')); box.setAttribute('aria-label', t('title')); input.placeholder = t('ph'); nameIn.placeholder = t('name'); send.textContent = t('send');
    quick.textContent = ''; for (const k of Object.keys(QUICK.en)) { const b = el('button', null, QUICK[lang()][k] || QUICK.en[k]); b.type = 'button'; b.dataset.q = k; b.onclick = () => say({ q: k }); quick.append(b); }
    nameIn.hidden = !!name();
  }
  function open(from) {
    if (!T.on || T.open) return; T.open = true; box.hidden = false; render.done = false; labels(); note(''); render(); paint(); markSeen(); hideSay();
    track('talk.open'); if (from === 'spot') track('talk.spot');
    pull(); clearInterval(T.poll); T.poll = setInterval(() => { if (!doc.hidden) pull(); }, 5000);
  }
  function close() { if (!T.open) return; T.open = false; box.hidden = true; clearInterval(T.poll); input.blur(); sheet.style.removeProperty('--kb'); sheet.style.removeProperty('max-height'); }
  async function say(what) {
    if (T.busy) return; let nm = name();
    if (!nm) { nm = nameIn.value.replace(/[^\p{L}\p{N} ._-]/gu, '').trim().slice(0, 14); if (!nm) { note(t('needName')); nameIn.hidden = false; nameIn.focus(); return; } try { localStorage.setItem('khuntau-name', nm); } catch (e) {} if (C.named) C.named(nm); nameIn.hidden = true; }
    const body = { pid: meta.pid, name: nm, after: T.last, ...what }; if (!what.q && !String(what.text || '').trim()) return;
    T.busy = true; send.disabled = true; note('');
    let r; try { r = await api('/api/chat', body); } catch (e) { r = { s: 0, d: {} }; }
    T.busy = false; send.disabled = false;
    if (r.s === 200) { if (!what.q) input.value = ''; T.loaded = true; if (!T.spoken) { T.spoken = true; keep(); note(''); } take(r.d); render(); list.scrollTop = list.scrollHeight; markSeen(); paint(); track(what.q ? 'talk.quick' : 'talk.say'); }
    else note(t('e_' + (r.d.err || (r.s === 429 ? 'slow' : 'net'))) || t('e_net'));
  }
  form.addEventListener('submit', e => { e.preventDefault(); say({ text: input.value }); });
  x.onclick = close; box.addEventListener('pointerdown', e => { if (e.target === box) close(); });
  hud.onclick = () => open('hud'); if (row) row.onclick = () => open('home');
  // while it is open the game does not hear the keyboard (typing W must not walk); Escape closes it
  addEventListener('keydown', e => { if (!T.open) return; if (e.key === 'Escape') { close(); e.preventDefault(); } e.stopPropagation(); }, true);
  // phones: keep the input above the on-screen keyboard
  if (window.visualViewport) { const vv = window.visualViewport, fit = () => { if (!T.open) return; const kb = Math.max(0, innerHeight - vv.height - vv.offsetTop);
      sheet.style.setProperty('--kb', kb + 'px'); if (kb > 60) sheet.style.maxHeight = Math.max(200, vv.height - 8) + 'px'; else sheet.style.removeProperty('max-height'); };
    vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit); }

  /* ---------- in the village: the talking place speaks ---------- */
  const story = () => C.story && C.story();
  const outdoors = () => C.game.mode === 'story' && C.game.p.pos.y > -10;
  const roaming = () => { const s = story(), card = doc.getElementById('dayCard'); return !!(s && s.active() && s.wantsControls() && C.game.mode === 'story' && !(card && !card.hidden)); }; // free to walk: nobody talking, no day card up
  const spotDist = () => { const p = C.game.p.pos, s = C.spot; return s ? Math.hypot(p.x - s.x, p.z - s.z) : 1e9; };
  function fill(node, m) { node.textContent = ''; node.append(el('b', null, m.n), el('small', null, ' · ' + ago(m.at)), doc.createElement('br'), said(m)); }
  function hideSay() { T.showing = null; for (const n of [toast, bubble]) { n.classList.remove('show'); n.hidden = true; } }
  function showSay(m) { // over the talking place when it is in view and near, else a line at the top
    const where = outdoors() && spotDist() < 30 && C.project && C.project(C.spot.x, 2.5, C.spot.z) ? bubble : toast; hideSay();
    fill(where, m); where.hidden = false; requestAnimationFrame(() => where.classList.add('show')); T.showing = { node: where, until: performance.now() + 6500 }; T.spoke = performance.now();
    if (where === bubble) { place(); if (C.sfx && C.sfx.chatter && spotDist() < 16) C.sfx.chatter(0.6); }
    track('talk.bubble');
  }
  function place() { if (!T.showing || T.showing.node !== bubble) return; const p = C.project && C.project(C.spot.x, 2.5, C.spot.z);
    if (!p || !outdoors()) { bubble.style.visibility = 'hidden'; T.showing.until = Math.min(T.showing.until, performance.now() + 400); } else { /* looked away: let it go */ bubble.style.visibility = ''; bubble.style.left = clampN(p.x, 90, innerWidth - 90) + 'px'; bubble.style.top = Math.max(70, p.y) + 'px'; }
    requestAnimationFrame(place); }
  const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
  toast.onclick = bubble.onclick = () => { hideSay(); open('bubble'); };
  setInterval(() => { // twice a second: the button, the queue of things just said, and walking up to the talking place
    const s = story(), inVillage = !!(T.on && s && s.active() && C.game.mode === 'story');
    hud.hidden = !(inVillage && s.wantsControls()) || T.open;
    if (T.showing && (performance.now() > T.showing.until || !inVillage || T.open)) hideSay();
    if (!inVillage || T.open) { T.near = false; return; }
    if (!T.loaded && !T.pulling) { T.pulling = true; pull().finally(() => { T.pulling = false; }); }
    const near = outdoors() && spotDist() < 8;
    if (near && !T.near && !T.showing && T.newest && !T.newest.me && roaming() && (T.heard !== T.newest.id || performance.now() - T.spoke > 45000)) { T.heard = T.newest.id; showSay(T.newest); } // walking up: hear the last thing said
    T.near = near && roaming(); // not while someone is talking to you: the bubble waits and comes up when you are free
    if (!T.showing && T.queue.length && roaming() && performance.now() - T.spoke > 1500) showSay(T.queue.shift());
  }, 500);

  setTimeout(beat, 1200); setInterval(beat, 30000);
  doc.addEventListener('visibilitychange', () => { if (!doc.hidden) beat(); });
  return { open, close, beat, pull, say, state: T, isOpen: () => T.open, refresh: () => { if (T.open) { labels(); render(); } paint(); } };
}
