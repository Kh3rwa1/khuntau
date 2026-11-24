// Online mode against the real Worker and Durable Objects, run locally:
//   npx wrangler dev --local --port 8787 --ip 127.0.0.1    (no Cloudflare login needed)
//   node tests/online.mjs [base]                          (default http://127.0.0.1:8787)
// Covers score tickets (valid, replayed, forged, too fast), save codes, push subscription checks,
// rooms (join, roster, start, grab, handi, hits, round over, scores to the board) and ask-to-join; the village talk
// (say, read, what is refused, quick phrases, reports, limits).
import { check, finish } from './check.mjs';
const BASE = process.argv[2] || 'http://127.0.0.1:8787', WS = BASE.replace(/^http/, 'ws');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rid = () => Math.random().toString(36).slice(2, 14).padEnd(12, 'x');
const j = async (path, body) => { const r = await fetch(BASE + path, body ? { method: 'POST', body: JSON.stringify(body) } : {}); let d = null; try { d = await r.clone().json(); } catch { d = await r.text(); } return { s: r.status, d }; };

// ---------- daily board and tickets ----------
const pid = rid();
{ const r = await j('/api/board'); check(r.s === 200 && Array.isArray(r.d.top), 'board answers'); }
{ const r = await j('/api/run?pid=bad'); check(r.s === 400, 'ticket refused for a bad player id'); }
const t1 = (await j('/api/run?pid=' + pid)).d.tok;
check(typeof t1 === 'string' && t1.split('.').length === 3, 'run ticket issued');
{ const r = await j('/api/score', { pid, name: 'Tester', pts: 3, lvl: 2, tok: t1 }); check(r.s === 200 && r.d.me && r.d.me.p === 3, 'score with a valid ticket is accepted'); }
{ const r = await j('/api/score', { pid, name: 'Tester', pts: 3, lvl: 2, tok: t1 }); check(r.s === 403, 'same ticket twice is refused'); }
{ const t = (await j('/api/run?pid=' + pid)).d.tok, p = t.split('.'); const r = await j('/api/score', { pid, name: 'X', pts: 2, tok: p[0] + '.' + p[1] + '.AAAAAAAAAAAAAAAAAAAAAA' }); check(r.s === 403, 'forged ticket is refused'); }
{ const t = (await j('/api/run?pid=' + pid)).d.tok; const r = await j('/api/score', { pid, name: 'X', pts: 80, tok: t }); check(r.s === 403, '80 points in 0 seconds is refused'); }
{ const other = rid(), t = (await j('/api/run?pid=' + pid)).d.tok; const r = await j('/api/score', { pid: other, name: 'X', pts: 1, tok: t }); check(r.s === 403, "another player's ticket is refused"); }
{ const r = await j('/api/score', { pid, name: 'X', pts: 9999, tok: 'a.b.c' }); check(r.s === 400, 'absurd score is refused'); }

// ---------- save codes ----------
{ const r = await j('/api/save', { pid, data: { lvl: 4, xp: 120 } }); check(r.s === 200 && /^[A-Z2-9]{6}$/.test(r.d.code), 'progress saved, code issued');
  const back = await j('/api/restore', { code: r.d.code.toLowerCase() }); check(back.s === 200 && back.d.pid === pid && back.d.data.xp === 120, 'code restores the progress (any case)');
  const again = await j('/api/save', { pid, data: { lvl: 5 } }); check(again.d.code === r.d.code, 'saving again keeps the same code'); }
{ const r = await j('/api/restore', { code: 'ZZZZZZ' }); check(r.s === 404, 'unknown code: 404'); }
{ const r = await j('/api/save', { pid, data: { x: 'y'.repeat(3000) } }); check(r.s === 413, 'oversized save refused'); }
{ const r = await j('/api/push/sub', { pid, endpoint: 'https://evil.example.com/x' }); check(r.s === 400, 'push to a non-push host refused'); }

// ---------- the village keeps the festival together ----------
{ const ft = 'Fest' + Math.random().toString(36).slice(2, 7).replace(/[0-9]/g, 'q'), p1 = rid(), p2 = rid(), lone = rid();
  await j('/api/village', { pid: p1, name: ft, dist: 'Dumka' }); await j('/api/village', { pid: p2, name: ft, dist: 'Dumka' });
  const a = await j('/api/fest', { pid: p1, d: 1 }), a2 = await j('/api/fest', { pid: p1, d: 1 }), b = await j('/api/fest', { pid: p2, d: 3 });
  check(a.s === 200 && a.d.n === 1 && a2.d.n === 1 && b.d.n === 2, `finishing a festival day counts once a day per player for their village (${a.d.n}, ${a2.d.n}, ${b.d.n})`);
  check((await j('/api/vboard?pid=' + p1)).d.fest === 2, 'the village board tells you how many kept the festival today');
  check((await j('/api/fest', { pid: lone, d: 2 })).d.n === 0, 'a player with no village is accepted and counts for none');
  check((await j('/api/fest', { pid: p1, d: 9 })).s === 400 && (await j('/api/fest', { pid: 'x', d: 1 })).s === 400, 'bad day or bad player id refused'); }

// ---------- village vs village ----------
const vtag = 'Test' + Math.random().toString(36).slice(2, 7).replace(/[0-9]/g, 'q'); // a fresh village name per run
const play = async (p, pts = 3) => { const t = (await j('/api/run?pid=' + p)).d.tok; return (await j('/api/score', { pid: p, name: 'V', pts, tok: t })).s; };
const setV = (p, name, dist = 'Dumka') => j('/api/village', { pid: p, name, dist });
{ const vp = Array.from({ length: 12 }, rid), spell = [`${vtag} Tola`, `${vtag.toLowerCase()}tola`, `  ${vtag.toUpperCase()}   TOLA!!`];
  const first = await setV(vp[0], spell[0]); check(first.s === 200 && first.d.v === `${vtag} Tola` && first.d.from === 'today', 'set a village: it counts from today');
  for (let i = 1; i < 12; i++) await setV(vp[i], spell[i % 3]);
  const sug = await j('/api/villages?dist=Dumka'); check((sug.d.villages || []).some(v => v.v === `${vtag} Tola` && v.n === 12), 'spelling variants join one village (12 players), shown with its first spelling');
  const two = [rid(), rid()]; for (const p of two) { await setV(p, `${vtag} Small`); await play(p); }
  await play(vp[0]); await play(vp[1]);
  let vb = (await j('/api/vboard?pid=' + vp[0])).d;
  check(!vb.today.top.some(v => v.v === `${vtag} Tola`) && vb.today.me && vb.today.me.n === 2 && vb.today.me.rank === 0, 'a village with only 2 players is not on the board yet (but its players see their count)');
  for (let i = 2; i < 12; i++) await play(vp[i]);
  await new Promise(r => setTimeout(r, 31000)); // the village table is cached for 30 s
  vb = (await j('/api/vboard?pid=' + vp[0])).d; const row = vb.today.top.find(v => v.v === `${vtag} Tola`);
  check(!!row && row.n === 12 && row.p === 30, `village score is the best 10 players (12 played x 3 points -> ${row && row.p})`);
  check(vb.today.me && vb.today.me.rank >= 1 && vb.mine && vb.mine.d === 'Dumka', 'players see their village rank');
  check(!vb.today.top.some(v => v.v === `${vtag} Small`), 'two-player village stays off the board');
  const mv = await setV(vp[0], `${vtag} Other`); check(mv.d.from === 'tomorrow', 'changing village waits until tomorrow');
  await play(vp[0], 3); check(((await j('/api/vboard?pid=' + vp[0])).d.mine || {}).v === `${vtag} Tola`, "today's points still go to today's village");
  const bad = await setV(rid(), '<script>x</script>'); check(bad.s === 200 && bad.d.v === 'script x script', 'village names are cleaned to letters and spaces');
  check((await setV(rid(), '!!')).s === 400, 'empty village names are refused');
  check((await setV(rid(), 'आमगाछी', 'Dumka')).d.v === 'आमगाछी' && (await setV(rid(), 'ᱟᱢᱜᱟᱪᱷᱤ', 'Dumka')).d.v === 'ᱟᱢᱜᱟᱪᱷᱤ', 'Devanagari and Ol Chiki village names work');
  globalThis.__vtag = vtag; }

// ---------- anonymous step counts ----------
{ const r = await fetch(BASE + '/api/ev', { method: 'POST', body: JSON.stringify({ k: ['open', 'play', 'evil<script>', 'open', 'ch.5'] }) }); check(r.status === 204, 'step counts accepted');
  const st = (await j('/api/stats?days=1')).d.days, today = Object.keys(st)[0], t = st[today] || {};
  check(t.open >= 1 && t.play >= 1 && t['ch.5'] >= 1, 'counts appear in /api/stats');
  check(!Object.keys(t).some(k => /evil|script/.test(k)), 'unknown step names are dropped');
  const before = t.open; await fetch(BASE + '/api/ev', { method: 'POST', body: JSON.stringify({ k: ['open', 'open', 'open'] }) });
  check(((await j('/api/stats?days=1')).d.days[today] || {}).open === before + 1, 'a step repeated in one batch counts once'); }

// ---------- abuse limits (per IP; Cloudflare sets cf-connecting-ip, the local run trusts the header) ----------
const jip = async (ip, path, body) => (await fetch(BASE + path, { method: 'POST', headers: { 'cf-connecting-ip': ip }, body: JSON.stringify(body) })).status;
{ const ip = '10.9.' + (Math.random() * 250 | 0) + '.1'; let last = 0; for (let i = 0; i < 45; i++) last = await jip(ip, '/api/restore', { code: 'QQQQQQ' });
  check(last === 429, 'one address guessing codes gets slowed down');
  check(await jip('10.8.0.' + (Math.random() * 250 | 0), '/api/restore', { code: 'QQQQQQ' }) === 404, 'other players can still restore while one address is blocked'); }
{ const ip = '10.7.' + (Math.random() * 250 | 0) + '.1'; const st = []; for (let i = 0; i < 34; i++) st.push(await jip(ip, '/api/save', { pid: rid(), data: { a: 1 } }));
  const first = st.indexOf(429); check(first >= 30 && first <= 31, `one address inventing new player ids is capped after 30 a minute (room for carrier NAT); first 429 at ${first + 1}`); }

// ---------- village talk: one public chat for everyone ----------
{ const ipA = '10.7.0.' + (1 + Math.floor(Math.random() * 250)); // its own IP, so the limits above and below do not mix
  const cj = async (path, body, ip = ipA) => { const r = await fetch(BASE + path, { ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}), headers: { 'cf-connecting-ip': ip } }); let d = null; try { d = await r.clone().json(); } catch { d = await r.text(); } return { s: r.status, d }; };
  const a = rid(), b = rid(), c = rid();
  const h0 = await cj('/api/here?pid=' + a); check(h0.s === 200 && h0.d.on === 1 && h0.d.now >= 1 && h0.d.today >= 1, 'talk: a heartbeat counts you as here');
  await cj('/api/here?pid=' + b); const h1 = await cj('/api/here?pid=' + a); check(h1.d.now >= 2 && h1.d.today >= 2, `talk: two players are here now (${h1.d.now} now, ${h1.d.today} today)`);
  check((await cj('/api/here?pid=bad')).s === 400 && (await cj('/api/chat', { pid: 'bad', text: 'hi' })).s === 400, 'talk: a bad player id is refused');
  const base = h1.d.last, say = (pid, body) => cj('/api/chat', { pid, name: 'Mina', after: base, ...body }), last = r => (r.d.msgs || []).at(-1) || {};
  const word = 'johar ' + Math.random().toString(36).slice(2, 8);
  const s1 = await say(a, { text: '  ' + word + ' \n  ok ' }); check(s1.s === 200 && last(s1).x === word + ' ok' && last(s1).me === 1 && last(s1).n === 'Mina', 'talk: a typed message is kept on one line, trimmed, and comes back as mine');
  const id1 = last(s1).id;
  const r1 = await cj('/api/chat?pid=' + b + '&after=' + base), m1 = r1.d.msgs.find(m => m.id === id1);
  check(!!m1 && !m1.me && typeof m1.a === 'string' && m1.a.length === 10 && Math.abs(m1.at - Date.now()) < 60000, 'talk: another player reads it, with an author tag and a time, not as theirs');
  check(!JSON.stringify(r1.d).includes(a), "talk: readers never get the author's player id");
  { const h = await cj('/api/here?pid=' + c); check(h.d.last === id1 && h.d.p && h.d.p.x === word + ' ok', 'talk: the heartbeat carries the newest message for the home screen'); }
  check((await say(a, { text: 'again so soon' })).s === 429, 'talk: a second message within three seconds is refused');
  await sleep(3100);
  check((await say(a, { text: word + ' ok' })).d.err === 'dup', 'talk: saying the same thing again is refused');
  // what may not be sent (each from a fresh player, so only the rule under test can refuse it)
  const bad = [['see http://x.y/z', 'link'], ['go to www.khel now', 'link'], ['my site khel.com', 'link'], ['call 98765 43210', 'number'], ['नंबर ९८७६५४३२१०', 'number'], ['add me @mina', 'contact'], ['come on whatsapp', 'contact'],
    ['you b!tch', 'words'], ['fuuuuck this', 'words'], ['MADARCHOD', 'words'], ['तू चूतिया है', 'words'], ['   ', 'empty']];
  const wrong = []; for (const [t, why] of bad) { const r = await say(rid(), { text: t }); if (r.s !== 400 || r.d.err !== why) wrong.push(`${t} -> ${r.s} ${r.d && r.d.err}`); }
  check(!wrong.length, 'talk: links, phone numbers, handles and abuse are refused, each with its reason' + (wrong.length ? ': ' + wrong.join('; ') : ''));
  const fine = ['wait.me too', 'I scored 25 then 30', 'grape juice in Sussex', 'ganda khel mat khelo', 'जोहार! कौन खेलेगा?', 'ᱡᱚᱦᱟᱨ', 'class of 2026'];
  const refused = []; for (const t of fine) { const r = await say(rid(), { text: t }); if (r.s !== 200 || last(r).x !== t) refused.push(`${t} -> ${r.s} ${r.d && r.d.err}`); }
  check(!refused.length, 'talk: ordinary lines in English, Hindi and Ol Chiki go through unchanged' + (refused.length ? ': ' + refused.join('; ') : ''));
  { const r = await say(rid(), { text: 'x'.repeat(200) }); check(r.s === 200 && last(r).x.length === 120, 'talk: a long message is cut to 120 characters'); }
  { const r = await cj('/api/chat', { pid: rid(), name: 'chutiya', text: 'hello there ' + word }); check(r.s === 200 && last(r).n === 'Player', 'talk: an abusive name is shown as Player'); }
  // quick phrases travel as a key
  const q1 = await say(b, { q: 'johar' }); check(q1.s === 200 && last(q1).q === 'johar' && last(q1).x === undefined, 'talk: a quick phrase is stored as its key');
  check((await say(rid(), { q: 'not-a-phrase' })).d.err === 'empty', 'talk: an unknown phrase key with no text is refused');
  await sleep(3100); check((await say(b, { q: 'johar' })).d.err === 'dup', 'talk: the same quick phrase straight away is refused');
  // reports: you cannot report yourself; one report hides it for the reporter, two hide it for everyone
  check((await cj('/api/chat/report', { pid: a, id: id1 })).d.err === 'own', 'talk: you cannot report your own message');
  const rp1 = await cj('/api/chat/report', { pid: b, id: id1 }); check(rp1.s === 200 && rp1.d.hidden === 0, 'talk: one report does not hide a message for everyone');
  check(!(await cj('/api/chat?pid=' + b + '&after=' + base)).d.msgs.some(m => m.id === id1) && (await cj('/api/chat?pid=' + c + '&after=' + base)).d.msgs.some(m => m.id === id1), 'talk: but the reporter no longer sees it, others still do');
  await cj('/api/chat/report', { pid: b, id: id1 }); // the same player again does not count twice
  check((await cj('/api/chat?pid=' + c + '&after=' + base)).d.msgs.some(m => m.id === id1), 'talk: the same player reporting twice counts once');
  const rp2 = await cj('/api/chat/report', { pid: c, id: id1 }); check(rp2.d.hidden === 1 && !(await cj('/api/chat?pid=' + rid() + '&after=' + base)).d.msgs.some(m => m.id === id1), 'talk: a second player reporting hides it for everyone');
  check((await cj('/api/chat/report', { pid: c, id: 999999999 })).s === 404, 'talk: reporting a message that is gone: 404');
  // limits: many phones share one address on Indian mobile networks, so the per-address limit is roomy (forty a minute)
  { const ipB = '10.8.0.' + (1 + Math.floor(Math.random() * 250)); let stopped = 0; for (let i = 0; i < 45; i++) { const r = await cj('/api/chat', { pid: rid(), name: 'N', text: 'line ' + i + ' ' + word }, ipB); if (r.s === 429) { stopped = i; break; } }
    check(stopped >= 38 && stopped <= 41, `talk: one address is held to about forty messages a minute (stopped at ${stopped})`); }
}

// ---------- rooms ----------
const code = 'T' + Math.random().toString(36).slice(2, 6).toUpperCase().replace(/[^A-Z0-9]/g, 'Q');
function player(name, url = `${WS}/ws/${code}`) {
  const ws = new WebSocket(url), P = { ws, msgs: [], snap: null, id: 0, roster: null, name };
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.t === 's') P.snap = m; else { P.msgs.push(m); if (m.t === 'welcome') P.id = m.id; if (m.t === 'roster') P.roster = m; } };
  P.send = o => ws.send(JSON.stringify(o));
  P.wait = async (f, ms = 5000) => { const t = Date.now(); for (;;) { const m = P.msgs.find(f); if (m) return m; if (Date.now() - t > ms) return null; await sleep(40); } };
  P.open = new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  return P;
}
const A = player('Asha'), B = player('Biru');
await Promise.all([A.open, B.open]);
await setV(pid, `${vtag} Room`);
A.send({ t: 'hello', name: 'Asha<script>' }); B.send({ t: 'hello', name: 'Biru' });
A.send({ t: 'me', pid, lvl: 3 }); B.send({ t: 'me', pid: rid(), lvl: 1 });
await sleep(400);
check(A.roster && A.roster.players.length === 2 && A.roster.host === A.id, 'two players in the room, first is host');
check(A.roster && A.roster.players.some(p => p.name === 'Ashascript'), 'names are cleaned of markup');
await sleep(300);
const list = await j('/api/rooms'); const listed = (list.d.rooms || []).find(r => r.host === 'Ashascript');
check(!!listed && listed.n === 2 && !JSON.stringify(list.d).includes(code), 'room is in "Playing now" without revealing its code');

// ask to join from the home screen
if (listed) {
  const K = player('Kanu', `${WS}/ws/knock/${listed.id}?name=Kanu`); await K.open;
  const kn = await A.wait(m => m.t === 'knock'); check(!!kn && kn.name === 'Kanu', 'host is asked "Kanu wants to join"');
  if (kn) A.send({ t: 'admit', kid: kn.kid, ok: true });
  const ad = await K.wait(m => m.t === 'admit'); check(!!ad && ad.code === code, 'accepted knocker gets the room code');
  const K2 = player('Moni', `${WS}/ws/knock/${listed.id}?name=Moni`); await K2.open;
  const kn2 = await A.wait(m => m.t === 'knock' && m.name === 'Moni'); if (kn2) A.send({ t: 'admit', kid: kn2.kid, ok: false });
  check(!!(await K2.wait(m => m.t === 'denied')), 'refused knocker is told no');
}
{ const B2 = player('Sneak'); await B2.open; B2.send({ t: 'start' }); await sleep(300); check(!B2.msgs.some(m => m.t === 'ev' && m.e === 'start'), 'only the host can start'); B2.ws.close(); await sleep(300); }

// round
A.send({ t: 'start' });
const st = await A.wait(m => m.t === 'ev' && m.e === 'start'); check(!!st && st.spawn.length === 2, 'host starts the round for both');
const keep = setInterval(() => { for (const P of [A, B]) P.send({ t: 'p', x: P.x ?? 0.5, z: P.z ?? 8, yaw: 0, a: 'Idle', st: 'free' }); }, 100);
A.x = 0.5; A.z = 0.4; await sleep(300); A.send({ t: 'grab' });
const g = await B.wait(m => m.t === 'ev' && m.e === 'grab'); check(!!g && g.id === A.id && g.score === 1, 'grab at the post scores, and the other player sees it');
B.x = 7; B.z = 0; await sleep(200); B.send({ t: 'grab' }); await sleep(300);
check(!B.msgs.some(m => m.t === 'ev' && m.e === 'grab' && m.id === B.id), 'grab far from the post is ignored');
// handi turns up after ~12 s; walk onto it
const hs = await (async () => { const t = Date.now(); while (Date.now() - t < 16000) { if (A.snap && A.snap.h) return A.snap.h; await sleep(100); } return null; })();
check(!!hs, 'a handi pot appears during the round');
if (hs) { B.send({ t: 'hit' }); await sleep(150); B.x = hs[0]; B.z = hs[1];
  const h = await A.wait(m => m.t === 'ev' && m.e === 'handi', 3000); check(!!h && h.id === B.id && h.lives === 3, 'walking onto the handi gives a life back, everyone sees it'); }
// both lose all lives: round over, results, room score goes to the board
for (let i = 0; i < 3; i++) { A.send({ t: 'hit' }); B.send({ t: 'hit' }); await sleep(80); }
const ov = await A.wait(m => m.t === 'ev' && m.e === 'over', 4000);
check(!!ov && ov.why === 'horned' && ov.results[0].id === A.id, 'all lamps out ends the round; Asha (1 pitha) is first');
clearInterval(keep); await sleep(400);
{ const r = await j('/api/board?pid=' + pid); check(r.d.me && r.d.me.p >= 3, 'room result reached the daily board'); }
{ const r = await j('/api/vboard?pid=' + pid); check(r.d.mine && r.d.mine.v === `${vtag} Room` && r.d.today.me && r.d.today.me.p >= 1, "room scores count for the player's village"); }
// room full at 6
const extra = []; for (let i = 0; i < 4; i++) { const P = player('P' + i); extra.push(P); await P.open; }
await sleep(300); const F = player('Seventh'); await F.open; await sleep(400);
check(F.msgs.some(m => m.t === 'full'), 'seventh player is told the room is full');
for (const P of [A, B, F, ...extra]) try { P.ws.close(); } catch {}
await sleep(300);
await finish();
