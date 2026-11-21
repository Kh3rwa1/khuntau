// Online mode against the real Worker and Durable Objects, run locally:
//   npx wrangler dev --local --port 8787 --ip 127.0.0.1    (no Cloudflare login needed)
//   node tests/online.mjs [base]                          (default http://127.0.0.1:8787)
// Covers score tickets (valid, replayed, forged, too fast), save codes, push subscription checks,
// rooms (join, roster, start, grab, handi, hits, round over, scores to the board) and ask-to-join.
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

// ---------- abuse limits (per IP; Cloudflare sets cf-connecting-ip, the local run trusts the header) ----------
const jip = async (ip, path, body) => (await fetch(BASE + path, { method: 'POST', headers: { 'cf-connecting-ip': ip }, body: JSON.stringify(body) })).status;
{ const ip = '10.9.' + (Math.random() * 250 | 0) + '.1'; let last = 0; for (let i = 0; i < 45; i++) last = await jip(ip, '/api/restore', { code: 'QQQQQQ' });
  check(last === 429, 'one address guessing codes gets slowed down');
  check(await jip('10.8.0.' + (Math.random() * 250 | 0), '/api/restore', { code: 'QQQQQQ' }) === 404, 'other players can still restore while one address is blocked'); }
{ const ip = '10.7.' + (Math.random() * 250 | 0) + '.1'; const st = []; for (let i = 0; i < 8; i++) st.push(await jip(ip, '/api/save', { pid: rid(), data: { a: 1 } }));
  check(st.slice(0, 6).every(x => x === 200) && st[7] === 429, 'one address inventing new player ids is capped'); }

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
// room full at 6
const extra = []; for (let i = 0; i < 4; i++) { const P = player('P' + i); extra.push(P); await P.open; }
await sleep(300); const F = player('Seventh'); await F.open; await sleep(400);
check(F.msgs.some(m => m.t === 'full'), 'seventh player is told the room is full');
for (const P of [A, B, F, ...extra]) try { P.ws.close(); } catch {}
await sleep(300);
await finish();
