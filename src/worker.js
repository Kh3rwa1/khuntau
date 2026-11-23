import { DurableObject } from "cloudflare:workers";

// Khuntau online: one Durable Object per room code runs the bull and keeps score.
// Players move on their own screens and report positions; the room decides grabs.

const ARENA_R = 11.5, ROPE_L = 6.2, GRAB_R = 1.45;
const TICK_MS = 50; // sim at 20 Hz, snapshots at 10 Hz
const ROUND_SECS = 120, MAX_PLAYERS = 6;
const COLORS = ["#e8b33c", "#d9472b", "#3d8bd9", "#4caf50", "#b05cd6", "#f2f2f2"];
const SHIRT_COLORS = ["#ffb347", "#3f8a4f", "#c8372d", "#2f5fa8", "#e8b33c"];
const ANIMS = new Set(["Idle", "Walk", "Run", "Roll", "Jump", "RecieveHit", "Death", "Victory", "Defeat", "SwordSlash", "Shoot_OneHanded", "PickUp", "SitDown", "StandUp", "Punch", "Walk_Carry", "Run_Carry"]);
const VILLAGE_R = 31; // friends walking the village together between rounds (v: 1 outside, 2 inside the house)

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const wrapAng = (d) => Math.atan2(Math.sin(d), Math.cos(d));
const turnTo = (cur, target, rate, dt) => cur + clamp(wrapAng(target - cur), -rate * dt, rate * dt);
const BULL_STATES = ["watch", "windup", "charge", "stunned", "recover"];
const now = () => Date.now();

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const m = url.pathname.match(/^\/ws\/([A-Z0-9]{4,6})$/);
    if (m) {
      if (request.headers.get("Upgrade") !== "websocket") return new Response("Expected websocket", { status: 426 });
      return env.ROOMS.getByName(m[1]).fetch(request);
    }
    // asking to join a room from the home screen list: the list never reveals room codes, so look the room up first
    const k = url.pathname.match(/^\/ws\/knock\/([a-z0-9]{8,16})$/);
    if (k) {
      if (request.headers.get("Upgrade") !== "websocket") return new Response("Expected websocket", { status: 426 });
      const r = await env.BOARD.getByName("global").fetch(new Request("https://board/internal/resolve?id=" + k[1]));
      if (!r.ok) return new Response("Room is gone", { status: 404 });
      const h = new Headers(request.headers); h.set("x-knock", "1");
      return env.ROOMS.getByName((await r.json()).code).fetch(new Request(request, { headers: h }));
    }
    if (url.pathname === "/turn") return turnServers(env);
    if (url.pathname.startsWith("/api/")) return env.BOARD.getByName("global").fetch(request);
    return new Response("Not found", { status: 404 });
  },
  // every evening (18:00 India time) remind players who have not played today
  async scheduled(event, env, ctx) {
    ctx.waitUntil(env.BOARD.getByName("global").fetch(new Request("https://board/internal/push", { method: "POST" })));
  },
};

// Voice relay: hands players short-lived Cloudflare TURN credentials so calls connect across
// different networks (Wi-Fi to mobile data, 4G to 4G). Needs two secrets: TURN_KEY_ID, TURN_KEY_API_TOKEN.
let turnCache = { at: 0, body: null };
async function turnServers(env) {
  const headers = { "content-type": "application/json", "cache-control": "no-store" };
  if (!env.TURN_KEY_ID || !env.TURN_KEY_API_TOKEN) return new Response(JSON.stringify({ iceServers: [], relay: false }), { headers });
  if (turnCache.body && Date.now() - turnCache.at < 30 * 60 * 1000) return new Response(turnCache.body, { headers });
  try {
    const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${env.TURN_KEY_ID}/credentials/generate-ice-servers`, {
      method: "POST", headers: { authorization: `Bearer ${env.TURN_KEY_API_TOKEN}`, "content-type": "application/json" }, body: JSON.stringify({ ttl: 14400 }),
    });
    if (!r.ok) return new Response(JSON.stringify({ iceServers: [], relay: false, error: r.status }), { headers });
    const j = await r.json();
    const iceServers = (j.iceServers || []).map(s => ({ ...s, urls: [].concat(s.urls).filter(u => !/:53(\?|$)/.test(u)) })); // port 53 times out in browsers
    turnCache = { at: Date.now(), body: JSON.stringify({ iceServers, relay: true }) };
    return new Response(turnCache.body, { headers });
  } catch (e) { return new Response(JSON.stringify({ iceServers: [], relay: false }), { headers }); }
}

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.players = new Map(); // id -> player
    this.nextId = 1;
    this.hostId = null;
    this.phase = "lobby";
    this.timer = null;
    this.tickN = 0;
    this.knocks = new Map(); this.nextKid = 1; this.open = true; this.code = null;
    this.resetRound();
  }

  resetRound() {
    this.bull = { x: 0, z: -3.5, yaw: 0, state: "watch", t: 0, dur: 2.5, dx: 0, dz: 1, dist: 0, speed: 0, target: null, circle: 1 };
    this.pithaReady = true; this.pithaTimer = 0; this.total = 0; this.timeLeft = ROUND_SECS;
    this.handi = { on: false, x: 0, z: 0, life: 0, next: 12 };
  }

  async fetch(request) {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    const url = new URL(request.url);
    if (request.headers.get("x-knock")) { this.knock(server, url.searchParams.get("name")); return new Response(null, { status: 101, webSocket: client }); }
    const cm = url.pathname.match(/^\/ws\/([A-Z0-9]{4,6})$/); if (cm) this.code = cm[1];
    if (this.players.size >= MAX_PLAYERS) {
      server.send(JSON.stringify({ t: "full" }));
      server.close(1000, "Room full");
      return new Response(null, { status: 101, webSocket: client });
    }
    const id = this.nextId++;
    const used = new Set([...this.players.values()].map(p => p.col));
    const col = COLORS.find(c => !used.has(c)) || COLORS[id % COLORS.length];
    const p = { id, ws: server, name: "Player " + id, col, x: rand(-3, 3), z: 8, yaw: Math.PI, a: "Idle", st: "free", lives: 3, score: 0, alive: this.phase !== "play", inRound: false, seen: Date.now() };
    this.players.set(id, p);
    if (this.hostId === null) this.hostId = id;
    server.addEventListener("message", (ev) => this.onMessage(p, ev.data));
    const bye = () => this.leave(p);
    server.addEventListener("close", bye);
    server.addEventListener("error", bye);
    this.send(p, { t: "welcome", id, col, phase: this.phase });
    this.broadcastRoster();
    if (!this.timer) this.timer = setInterval(() => this.tick(), TICK_MS);
    return new Response(null, { status: 101, webSocket: client });
  }

  // someone on the home screen asks to join; the host says yes or no
  knock(ws, rawName) {
    const say = (o) => { try { ws.send(JSON.stringify(o)); ws.close(1000, "done"); } catch {} };
    const host = this.players.get(this.hostId);
    if (!host || this.open === false) return say({ t: "denied", why: "closed" });
    if (this.players.size >= MAX_PLAYERS) return say({ t: "denied", why: "full" });
    if (this.knocks.size >= 4) return say({ t: "denied", why: "busy" });
    const kid = this.nextKid++, name = String(rawName || "").replace(/[^\p{L}\p{N} ._-]/gu, "").trim().slice(0, 14) || "Someone";
    this.knocks.set(kid, { ws, name, at: Date.now() });
    const gone = () => { if (this.knocks.delete(kid)) { const h = this.players.get(this.hostId); if (h) this.send(h, { t: "knockGone", kid }); } };
    ws.addEventListener("close", gone); ws.addEventListener("error", gone);
    this.send(host, { t: "knock", kid, name });
  }
  answerKnock(kid, ok, why) {
    const k = this.knocks.get(kid); if (!k) return; this.knocks.delete(kid);
    const full = this.players.size >= MAX_PLAYERS;
    try { k.ws.send(JSON.stringify(ok && !full ? { t: "admit", code: this.code } : { t: "denied", why: full ? "full" : why || "no" })); k.ws.close(1000, "done"); } catch {}
  }
  // tell the home-screen list about this room (who hosts, how many, whether it takes requests)
  report() {
    if (!this.code) return; const host = this.players.get(this.hostId);
    const body = JSON.stringify({ code: this.code, host: host ? host.name : "", n: this.players.size, phase: this.phase, open: this.open !== false && !!host });
    if (body === this.lastReport && Date.now() - this.lastReportAt < 10000) return; // chatty clients can't hammer the board
    this.lastReport = body; this.lastReportAt = Date.now();
    this.ctx.waitUntil(this.env.BOARD.getByName("global").fetch(new Request("https://board/internal/room", { method: "POST", body })).catch(() => {}));
  }

  leave(p) {
    if (!this.players.has(p.id)) return;
    this.players.delete(p.id);
    if (this.hostId === p.id) { this.hostId = this.players.size ? this.players.keys().next().value : null; for (const kid of [...this.knocks.keys()]) this.answerKnock(kid, false, "closed"); }
    if (this.bull.target === p.id) this.bull.target = null;
    this.broadcastRoster();
    if (this.phase === "play" && this.players.size) this.checkEnd(); // the last one standing left: end the round for everyone
    if (this.players.size === 0) { clearInterval(this.timer); this.timer = null; this.phase = "lobby"; this.resetRound(); this.open = true; this.report(); }
  }

  onMessage(p, raw) {
    let m; try { m = JSON.parse(raw); } catch { return; }
    p.seen = Date.now();
    switch (m.t) {
      case "hello":
        p.name = String(m.name || "").replace(/[^\p{L}\p{N} ._-]/gu, "").trim().slice(0, 14) || p.name;
        this.broadcastRoster();
        break;
      case "p":
        p.lastP = Date.now();
        if (typeof m.x === "number" && typeof m.z === "number") {
          p.v = this.phase === "play" ? 0 : (m.v | 0) & 3;
          const lim = p.v ? VILLAGE_R : ARENA_R, r = Math.hypot(m.x, m.z), k = r > lim ? lim / r : 1;
          p.x = m.x * k; p.z = m.z * k;
        }
        if (typeof m.yaw === "number") p.yaw = m.yaw;
        if (ANIMS.has(m.a)) p.a = m.a;
        if (typeof m.st === "string") p.st = m.st.slice(0, 8);
        break;
      case "open": if (p.id === this.hostId) { this.open = !!m.on; this.broadcastRoster(); } break;
      case "admit": if (p.id === this.hostId) this.answerKnock(m.kid | 0, !!m.ok, "no"); break;
      case "me": { // who this player is on the daily board, and the shirt they unlocked
        if (typeof m.pid === "string" && /^[a-z0-9]{10,24}$/.test(m.pid)) p.pid = m.pid;
        p.lvl = clamp(Math.floor(Number(m.lvl)) || 1, 1, 99);
        if (SHIRT_COLORS.includes(m.col) && p.col !== m.col && ![...this.players.values()].some(q => q !== p && q.col === m.col)) { p.col = m.col; this.broadcastRoster(); } // first come, first served, so every player stays tellable apart
        break;
      }
      case "start":
        if (p.id === this.hostId && this.phase !== "play") this.startRound();
        break;
      case "grab":
        if (this.phase === "play" && p.alive && this.pithaReady && Math.hypot(p.x, p.z) < GRAB_R + 0.8) {
          const st0 = this.stage(); this.pithaReady = false; this.pithaTimer = 0; p.score++; this.total++;
          if (this.stage() > st0) { this.broadcast({ t: "ev", e: "stage", n: this.stage() }); if (!this.handi.on) this.handi.next = Math.min(this.handi.next, 1.5); } // announced to the room, with a handi thrown in
          const kinds = ["hifive", "hifive", "hifive", "dance", "dance", "victory"];
          this.broadcast({ t: "ev", e: "grab", id: p.id, score: p.score, kind: kinds[Math.floor(Math.random() * kinds.length)] });
        }
        break;
      case "hit":
        if (this.phase === "play" && p.alive) {
          p.lives--; if (p.lives <= 0) { p.lives = 0; p.alive = false; }
          this.broadcast({ t: "ev", e: "hit", id: p.id, lives: p.lives });
          this.checkEnd();
        }
        break;
      case "handi": {
        const h = this.handi;
        const hx = typeof m.x === "number" ? m.x : p.x, hz = typeof m.z === "number" ? m.z : p.z; // where the client says it is, if that is close to where we last saw it
        if (this.phase === "play" && p.alive && p.inRound && h.on && Math.hypot(hx - p.x, hz - p.z) < 4 && Math.hypot(hx - h.x, hz - h.z) < 2.0) this.drinkHandi(p);
        break;
      }
      case "vev": { // something a friend does in the shared village (a drum hit, a clap): relayed to the others, lightly rate-limited
        const now = Date.now(); if (this.phase === "play" || !p.v || now - (p.vevAt || 0) < 70) break; p.vevAt = now;
        this.broadcast({ t: "ev", e: "v", id: p.id, k: String(m.k || "").replace(/[^a-z]/g, "").slice(0, 8), n: Math.max(0, Math.min(9, m.n | 0)) });
        break; }
      case "tease":
        if (this.phase === "play" && p.alive && p.inRound && now() - (p.teaseAt || 0) > 1000) {
          p.teaseAt = now();
          const b = this.bull;
          b.target = p.id; // the bull locks onto whoever waved the hide
          if (b.state === "watch") b.t = Math.max(b.t, b.dur - 0.15);
          this.broadcast({ t: "ev", e: "tease", id: p.id });
        }
        break;
      case "voice":
        p.voice = !!m.on; this.broadcastRoster();
        break;
      case "rtc": { // relay voice-call setup between two players who both turned voice on
        const to = this.players.get(m.to);
        if (to && to !== p && p.voice && to.voice && raw.length < 20000) this.send(to, { t: "rtc", from: p.id, d: m.d });
        break;
      }
      case "ping":
        this.send(p, { t: "pong", c: m.c });
        break;
    }
  }

  startRound() {
    this.resetRound(); this.phase = "play";
    let i = 0; const n = this.players.size;
    for (const p of this.players.values()) {
      const a = Math.PI / 2 + (i - (n - 1) / 2) * 0.5; i++;
      Object.assign(p, { lives: 3, score: 0, alive: true, inRound: true, lastP: Date.now(), x: Math.cos(a) * 8, z: Math.sin(a) * 8, v: 0 });
    }
    this.broadcast({ t: "ev", e: "start", spawn: [...this.players.values()].map(p => [p.id, +p.x.toFixed(2), +p.z.toFixed(2)]) });
    this.broadcastRoster();
  }

  checkEnd() {
    const inRound = [...this.players.values()].filter(p => p.inRound);
    // a player whose game stopped sending (locked phone, closed tab) doesn't keep the round alive
    const t = Date.now(), alive = inRound.filter(p => p.alive && t - (p.lastP || t) < 8000);
    if (this.timeLeft <= 0 || alive.length === 0) this.endRound(this.timeLeft <= 0 ? "time" : "horned");
  }

  endRound(why) {
    this.phase = "over";
    const results = [...this.players.values()].filter(p => p.inRound)
      .sort((a, b) => b.score - a.score || b.lives - a.lives)
      .map(p => ({ id: p.id, name: p.name, col: p.col, score: p.score, lives: p.lives }));
    // rounds are refereed by this room, so these scores go to the daily board as trusted
    const rows = [...this.players.values()].filter(p => p.inRound && p.pid && p.score > 0).map(p => ({ pid: p.pid, name: p.name, pts: p.score, lvl: p.lvl || 1 }));
    if (rows.length) this.ctx.waitUntil(this.env.BOARD.getByName("global").fetch(new Request("https://board/internal/scores", { method: "POST", body: JSON.stringify(rows) })).catch(() => {}));
    for (const p of this.players.values()) p.inRound = false;
    this.broadcast({ t: "ev", e: "over", why, results });
    this.broadcastRoster();
  }

  drinkHandi(p) {
    const h = this.handi; h.on = false; h.next = 14 + Math.random() * 6;
    const full = p.lives >= 3; if (full) p.score++; else p.lives++;
    this.broadcast({ t: "ev", e: "handi", id: p.id, full, x: h.x, z: h.z, lives: p.lives });
  }

  tick() {
    const dt = TICK_MS / 1000;
    // drop silent connections
    const now = Date.now();
    for (const p of this.players.values()) if (now - p.seen > 90000) { try { p.ws.close(1000, "idle"); } catch {} this.leave(p); }
    if (this.phase === "play") {
      this.timeLeft -= dt;
      if (!this.pithaReady) { this.pithaTimer += dt; if (this.pithaTimer > 1.1) this.pithaReady = true; }
      const h = this.handi; // a pot of handi appears now and then; whoever reaches it first gets a life back
      if (!h.on) { h.next -= dt; if (h.next <= 0) { const a = Math.random() * 6.283, r = 3.2 + Math.random() * 6.3; Object.assign(h, { on: true, life: 12, x: +(Math.cos(a) * r).toFixed(2), z: +(Math.sin(a) * r).toFixed(2) }); } }
      else {
        h.life -= dt; if (h.life <= 0) { h.on = false; h.next = 14 + Math.random() * 6; }
        // the server also spots a pickup by itself, so a lost or late message can't make the pot undrinkable
        else for (const p of this.players.values()) if (p.alive && p.inRound && Math.hypot(p.x - h.x, p.z - h.z) < 1.4) { this.drinkHandi(p); break; }
      }
      this.updateBull(dt);
      if (this.timeLeft <= 0 || (this.endT = (this.endT || 0) + dt) > 1) { this.endT = 0; this.checkEnd(); }
    } else {
      // idle bull grazes in the lobby
      this.bull.yaw += dt * 0.15; this.bull.state = "watch";
    }
    this.tickN++;
    if (this.tickN % 300 === 0) { this.report(); const t = Date.now(); for (const [kid, k] of this.knocks) if (t - k.at > 30000) this.answerKnock(kid, false, "noanswer"); }
    this.broadcastSnapshot(); // 20 Hz snapshots, each stamped with server time
  }

  difficulty() { return clamp(this.total / 12, 0, 1); }
  // Ring stages in online rounds too (the room's pitha together): 2 the feint, 3 twice, 4 the hunter, 5 all of it more often
  stage() { const t = this.total; return t >= 24 ? 5 : t >= 16 ? 4 : t >= 10 ? 3 : t >= 5 ? 2 : 1; }
  againMaybe() { const b = this.bull, st = this.stage(); if (st < 3 || b.again || Math.random() > (st >= 5 ? 0.6 : 0.45)) { b.again = false; return; }
    b.again = true; b.feinted = true; this.setBull("windup", 0.55); this.broadcast({ t: "ev", e: "snort" }); }

  pickTarget() {
    const alive = [...this.players.values()].filter(p => p.alive && p.inRound);
    if (!alive.length) return null;
    const b = this.bull;
    // whoever is at the post first; otherwise nearest, with a little randomness so nobody is safe
    const atPost = alive.filter(p => Math.hypot(p.x, p.z) < GRAB_R + 0.4);
    if (atPost.length) return atPost[Math.floor(Math.random() * atPost.length)];
    alive.sort((a, c) => Math.hypot(a.x - b.x, a.z - b.z) - Math.hypot(c.x - b.x, c.z - b.z));
    return Math.random() < 0.7 || alive.length === 1 ? alive[0] : alive[1 + Math.floor(Math.random() * (alive.length - 1))];
  }

  setBull(state, dur) { Object.assign(this.bull, { state, t: 0, dur }); }

  updateBull(dt) {
    const b = this.bull, d = this.difficulty();
    b.t += dt;
    let tp = b.target ? this.players.get(b.target) : null;
    if (!tp || !tp.alive || !tp.inRound) { tp = this.pickTarget(); b.target = tp ? tp.id : null; }
    if (!tp) { this.setBull("watch", 1); return; }
    const tx = tp.x - b.x, tz = tp.z - b.z, distP = Math.hypot(tx, tz), yawToP = Math.atan2(tx, tz);
    // post between bull and target?
    const bpx = -b.x, bpz = -b.z, along = (bpx * tx + bpz * tz) / Math.max(distP, 1e-3);
    const perp = Math.sqrt(Math.max(bpx * bpx + bpz * bpz - along * along, 0));
    const blocked = along > 0.5 && along < distP - 0.3 && perp < 0.75;

    switch (b.state) {
      case "watch": {
        if (blocked) {
          const ang = Math.atan2(b.z, b.x) + b.circle * dt * 0.9;
          const r = clamp(Math.hypot(b.x, b.z), 2.2, ROPE_L - 0.4);
          const nx = Math.cos(ang) * r, nz = Math.sin(ang) * r;
          b.yaw = turnTo(b.yaw, Math.atan2(nx - b.x, nz - b.z), 6, dt);
          b.x = nx; b.z = nz; b.walking = true;
          if (b.t > 2.4) { b.circle *= -1; b.t = 0; }
        } else {
          b.walking = false;
          b.yaw = turnTo(b.yaw, yawToP, 3.2, dt);
          const urgent = Math.hypot(tp.x, tp.z) < GRAB_R + 0.2;
          if (b.t > (urgent ? b.dur * 0.35 : b.dur)) { this.setBull("windup", lerp(1.05, 0.5, d)); b.again = false; this.broadcast({ t: "ev", e: "snort" }); }
        }
        break;
      }
      case "windup": {
        b.yaw = turnTo(b.yaw, yawToP, 4.5, dt);
        if (b.t > b.dur && !b.feinted && this.stage() >= 2 && Math.random() < (this.stage() >= 5 ? 0.5 : 0.35)) { // the feint: half a lunge, a stop, a short second windup
          b.feinted = true; b.x += Math.sin(b.yaw) * 0.7; b.z += Math.cos(b.yaw) * 0.7; this.setBull("windup", 0.45 + Math.random() * 0.25); this.broadcast({ t: "ev", e: "snort" });
        } else if (b.t > b.dur) {
          b.feinted = false;
          const l = Math.hypot(tx, tz) || 1; b.dx = tx / l; b.dz = tz / l; b.yaw = Math.atan2(b.dx, b.dz);
          b.speed = lerp(8.5, 13, d); b.dist = Math.max(distP + 2.5, 5);
          this.setBull("charge", 3);
        }
        break;
      }
      case "charge": {
        if (this.stage() >= 4 && distP > 1.6) { const ny = turnTo(Math.atan2(b.dx, b.dz), yawToP, this.stage() >= 5 ? 1.0 : 0.75, dt); b.dx = Math.sin(ny); b.dz = Math.cos(ny); b.yaw = ny; } // the hunter bends his charge
        const step = b.speed * dt; b.x += b.dx * step; b.z += b.dz * step; b.dist -= step;
        const r = Math.hypot(b.x, b.z);
        if (r < 1.0) { const k = 1.0 / r; b.x *= k; b.z *= k; this.setBull("stunned", lerp(1.8, 1.1, d)); this.broadcast({ t: "ev", e: "bonk" }); }
        else if (r > ROPE_L) { const k = ROPE_L / r; b.x *= k; b.z *= k; this.setBull("stunned", lerp(1.5, 0.85, d)); this.broadcast({ t: "ev", e: "snap" }); this.againMaybe(); }
        else if (b.dist <= 0) { this.setBull("recover", lerp(1.7, 0.85, d)); this.againMaybe(); }
        break;
      }
      case "stunned":
      case "recover":
        if (b.t > b.dur) { this.setBull("watch", lerp(1.2, 0.55, d) * rand(0.8, 1.2)); b.target = null; }
        break;
    }
    const r = Math.hypot(b.x, b.z);
    if (r < 1.0 && r > 0) { b.x /= r; b.z /= r; }
    if (r > ROPE_L) { b.x *= ROPE_L / r; b.z *= ROPE_L / r; }
  }

  broadcastSnapshot() {
    const b = this.bull;
    const st = b.state === "watch" && b.walking ? 5 : BULL_STATES.indexOf(b.state);
    this.broadcast({
      t: "s", ts: Date.now() - (this.t0 || (this.t0 = Date.now())), ph: this.phase, h: this.phase === "play" && this.handi && this.handi.on ? [this.handi.x, this.handi.z] : 0, tl: Math.max(0, Math.ceil(this.timeLeft)), pr: this.pithaReady ? 1 : 0, d: +this.difficulty().toFixed(2),
      b: [+b.x.toFixed(2), +b.z.toFixed(2), +b.yaw.toFixed(3), st, b.target || 0],
      ps: [...this.players.values()].map(p => [p.id, +p.x.toFixed(2), +p.z.toFixed(2), +p.yaw.toFixed(2), p.a, p.lives, p.score, p.alive ? 1 : 0, p.inRound ? 1 : 0, p.v || 0]),
    });
  }

  broadcastRoster() {
    this.report();
    this.broadcast({ t: "roster", host: this.hostId, phase: this.phase, open: this.open !== false, players: [...this.players.values()].map(p => ({ id: p.id, name: p.name, col: p.col, inRound: p.inRound, voice: !!p.voice })) });
  }

  send(p, msg) { try { p.ws.send(JSON.stringify(msg)); } catch {} }
  broadcast(msg) { const s = JSON.stringify(msg); for (const p of this.players.values()) { try { p.ws.send(s); } catch {} } }
}


// Daily leaderboard: one global object. Scores are kept per day (India time) so the board is fresh every morning.
const istDay = (offsetDays = 0) => new Date(Date.now() + 5.5 * 3600e3 + offsetDays * 86400e3).toISOString().slice(0, 10);
const cleanName = (n) => String(n || "").replace(/[^\p{L}\p{N} ._-]/gu, "").trim().slice(0, 14) || "Player";
// villages: names in any script (Latin, Devanagari, Ol Chiki, Bengali, Odia...), letters and spaces only, 2-24 characters
const cleanVillage = (n) => { const v = String(n || "").normalize("NFKC").replace(/[^\p{L}\p{M} ]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 24); return v.length >= 2 ? v : ""; };
// one key per village and district, so "Sido Kanhu Tola" and "sidokanhu  tola" are the same team
const villageKey = (name, dist) => { const a = name.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{M}]/gu, ""), b = dist.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{M}]/gu, ""); return a && b ? a + "|" + b : ""; };
// villages taken off the board (abusive or joke names). Add the key (villageKey(name, district)) and deploy.
const HIDDEN_VILLAGES = new Set([]);
// districts offered in the game's list (kept in step with DISTRICTS in index.html); anything else is a typed "other" district
const DISTRICTS = new Set(["Bokaro", "Chatra", "Deoghar", "Dhanbad", "Dumka", "East Singhbhum", "Garhwa", "Giridih", "Godda", "Gumla", "Hazaribagh", "Jamtara", "Khunti", "Koderma", "Latehar", "Lohardaga", "Pakur", "Palamu", "Ramgarh", "Ranchi", "Sahibganj", "Seraikela Kharsawan", "Simdega", "West Singhbhum",
  "Bankura", "Birbhum", "Purulia", "Jhargram", "Paschim Medinipur", "Paschim Bardhaman", "Purba Bardhaman", "Dakshin Dinajpur", "Uttar Dinajpur", "Malda", "Hooghly", "Murshidabad",
  "Mayurbhanj", "Balasore", "Keonjhar", "Sundargarh", "Banka", "Bhagalpur", "Jamui", "Katihar", "Purnia", "Kokrajhar", "Chirang", "Udalguri", "Sonitpur"]);
// the only step names the counter accepts (anything else is dropped)
const EV_KEY = /^(duet|village\.shared|rebuke|stage\.[2-5]|fest\.[1-5]|open|open\.(challenge|room|app|new|return)|ret\.(d1|d2_3|d7)|ready\.(lt3|3_6|6_10|10_20|gt20)|play|play\.(khunt|quick|link)|village|story|round_end|score\.(0|1_4|5_14|15_29|30p)|share\.(score|room)|room\.(create|join|ask)|online\.play|ch\.[1-5]|daily\.(arch|fish|jale|drum)|vil\.(set|tab|ask)|share\.vil)$/;
const okPid = (v) => typeof v === "string" && /^[a-z0-9]{10,24}$/.test(v);
const b64u = (u8) => btoa(String.fromCharCode(...u8)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
// reminders may only be sent to real browser push services
const okPushHost = (ep) => { try { const u = new URL(ep); return u.protocol === "https:" && /(^|\.)(fcm\.googleapis\.com|push\.services\.mozilla\.com|push\.apple\.com|notify\.windows\.com)$/.test(u.hostname); } catch { return false; } };
export class Board extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.hits = new Map(); // pid -> recent write times (simple flood guard)
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS daily (day TEXT NOT NULL, pid TEXT NOT NULL, name TEXT NOT NULL, pts INTEGER NOT NULL, lvl INTEGER NOT NULL DEFAULT 1, at INTEGER NOT NULL, PRIMARY KEY (day, pid))");
      this.ctx.storage.sql.exec("CREATE INDEX IF NOT EXISTS daily_rank ON daily (day, pts DESC, at ASC)");
      this.ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS used (tok TEXT PRIMARY KEY, at INTEGER NOT NULL)");
      this.ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS saves (pid TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, data TEXT NOT NULL, at INTEGER NOT NULL)");
      this.ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS subs (endpoint TEXT PRIMARY KEY, pid TEXT NOT NULL, played TEXT NOT NULL, sent TEXT NOT NULL, at INTEGER NOT NULL)");
      // villages: a player's village (a change waits until the next day), the first spelling of each village, and each player's best per day for their village
      this.ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS pvil (pid TEXT PRIMARY KEY, vkey TEXT NOT NULL, since TEXT NOT NULL, nxt TEXT, nxt_since TEXT, at INTEGER NOT NULL)");
      this.ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS vnames (vkey TEXT PRIMARY KEY, vname TEXT NOT NULL, dist TEXT NOT NULL, at INTEGER NOT NULL)");
      this.ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS vday (day TEXT NOT NULL, pid TEXT NOT NULL, vkey TEXT NOT NULL, pts INTEGER NOT NULL, PRIMARY KEY (day, pid))");
      this.ctx.storage.sql.exec("CREATE INDEX IF NOT EXISTS vday_v ON vday (day, vkey)");
      this.ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS stats (day TEXT NOT NULL, k TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (day, k))");
      this.ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS vfest (day TEXT NOT NULL, pid TEXT NOT NULL, vkey TEXT NOT NULL, d INTEGER NOT NULL, PRIMARY KEY (day, pid))"); // who kept a day of the festival today, by village
      this.ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS alltime (pid TEXT PRIMARY KEY, name TEXT NOT NULL, pts INTEGER NOT NULL, lvl INTEGER NOT NULL DEFAULT 1, at INTEGER NOT NULL)");
    });
  }
  // ---- helpers ----
  json(obj, status = 200) { return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } }); }
  flood(key, max) {
    const t = Date.now(), a = (this.hits.get(key) || []).filter(x => t - x < 60000); if (a.length >= max) return true; a.push(t); this.hits.set(key, a);
    if (this.hits.size > 5000) for (const [k, v] of this.hits) if (t - v[v.length - 1] > 60000) this.hits.delete(k); // drop stale keys only, so a flood of new ids can't reset everyone's limits
    return false;
  }
  async secret() { if (!this._sec) { let v = await this.ctx.storage.get("hmac"); if (!v) { v = b64u(crypto.getRandomValues(new Uint8Array(32))); await this.ctx.storage.put("hmac", v); } this._sec = await crypto.subtle.importKey("raw", unb64u(v), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); } return this._sec; }
  async sign(text) { return b64u(new Uint8Array(await crypto.subtle.sign("HMAC", await this.secret(), new TextEncoder().encode(text)))).slice(0, 22); }
  saveScore(pid, name, pts, lvl) {
    const sql = this.ctx.storage.sql, t = Date.now(), day = istDay();
    sql.exec("INSERT INTO daily (day, pid, name, pts, lvl, at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(day, pid) DO UPDATE SET name = excluded.name, lvl = excluded.lvl, at = CASE WHEN excluded.pts > daily.pts THEN excluded.at ELSE daily.at END, pts = MAX(daily.pts, excluded.pts)", day, pid, name, pts, lvl, t);
    sql.exec("INSERT INTO alltime (pid, name, pts, lvl, at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(pid) DO UPDATE SET name = excluded.name, lvl = excluded.lvl, at = CASE WHEN excluded.pts > alltime.pts THEN excluded.at ELSE alltime.at END, pts = MAX(alltime.pts, excluded.pts)", pid, name, pts, lvl, t);
    sql.exec("UPDATE subs SET played = ? WHERE pid = ?", day, pid);
    const vk = this.villageOf(pid); // room and solo scores both count for the player's village
    if (vk) sql.exec("INSERT INTO vday (day, pid, vkey, pts) VALUES (?, ?, ?, ?) ON CONFLICT(day, pid) DO UPDATE SET pts = MAX(vday.pts, excluded.pts), vkey = excluded.vkey", day, pid, vk, pts);
    if (Math.random() < 0.02) { sql.exec("DELETE FROM vday WHERE day < ?", istDay(-8)); sql.exec("DELETE FROM daily WHERE day < ?", istDay(-8)); sql.exec("DELETE FROM used WHERE at < ?", t - 3 * 3600e3); }
  }
  // the village a player plays for today (a change made yesterday becomes active today)
  villageOf(pid) {
    const sql = this.ctx.storage.sql, day = istDay(), r = sql.exec("SELECT vkey, nxt, nxt_since FROM pvil WHERE pid = ?", pid).toArray()[0];
    if (!r) return null;
    if (r.nxt && r.nxt_since <= day) { sql.exec("UPDATE pvil SET vkey = nxt, since = nxt_since, nxt = NULL, nxt_since = NULL WHERE pid = ?", pid); return r.nxt; }
    return r.vkey;
  }
  // village table for a period: score = sum of the 10 best players' daily bests; shown only with 3+ different players
  vtable(fromDay) {
    const t = Date.now(); this._vt ||= {}; const c = this._vt[fromDay]; if (c && t - c.at < 30000) return c.rows;
    const rows = this.ctx.storage.sql.exec(`WITH r AS (SELECT day, vkey, pid, pts, ROW_NUMBER() OVER (PARTITION BY day, vkey ORDER BY pts DESC) rn FROM vday WHERE day >= ?)
      SELECT r.vkey, SUM(CASE WHEN rn <= 10 THEN pts ELSE 0 END) AS s, COUNT(DISTINCT pid) AS n, v.vname, v.dist FROM r JOIN vnames v ON v.vkey = r.vkey
      GROUP BY r.vkey ORDER BY s DESC`, fromDay).toArray().filter(x => !HIDDEN_VILLAGES.has(x.vkey));
    this._vt[fromDay] = { at: t, rows }; return rows;
  }
  vboard(pid) {
    const mine = okPid(pid) ? this.villageOf(pid) : null, out = {};
    for (const [k, from] of [["today", istDay()], ["week", istDay(-6)]]) {
      const all = this.vtable(from), shown = all.filter(x => x.n >= 3 && x.vkey !== mine);
      const row = (x) => ({ v: x.vname, d: x.dist, p: x.s, n: x.n, me: x.vkey === mine ? 1 : 0 });
      // the player's own village is always fresh (the top list may be up to 30 s old)
      const me = mine ? this.ctx.storage.sql.exec(`WITH r AS (SELECT day, pid, pts, ROW_NUMBER() OVER (PARTITION BY day ORDER BY pts DESC) rn FROM vday WHERE day >= ? AND vkey = ?)
        SELECT ? AS vkey, COALESCE(SUM(CASE WHEN rn <= 10 THEN pts ELSE 0 END), 0) AS s, COUNT(DISTINCT pid) AS n, v.vname, v.dist FROM vnames v LEFT JOIN r ON 1 WHERE v.vkey = ?`, from, mine, mine, mine).toArray()[0] : null;
      if (me && me.n >= 3 && !HIDDEN_VILLAGES.has(mine)) { const i = shown.findIndex(x => x.s < me.s); shown.splice(i < 0 ? shown.length : i, 0, me); }
      const rank = me ? shown.indexOf(me) + 1 : 0, above = rank > 1 ? shown[rank - 2] : null;
      out[k] = { top: shown.slice(0, 20).map(row), total: shown.length, me: me ? { ...row(me), rank, above: above ? row(above) : null } : null };
    }
    if (mine) { const n = this.ctx.storage.sql.exec("SELECT vname, dist FROM vnames WHERE vkey = ?", mine).toArray()[0]; if (n) out.mine = { v: n.vname, d: n.dist };
      out.fest = this.ctx.storage.sql.exec("SELECT COUNT(*) AS n FROM vfest WHERE day = ? AND vkey = ?", istDay(), mine).toArray()[0].n; }
    return out;
  }
  board(pid) {
    const sql = this.ctx.storage.sql, day = istDay(), yd = istDay(-1);
    const row = (r) => ({ n: r.name, p: r.pts, l: r.lvl, me: okPid(pid) && r.pid === pid ? 1 : 0 });
    const top = sql.exec("SELECT pid, name, pts, lvl FROM daily WHERE day = ? ORDER BY pts DESC, at ASC LIMIT 20", day).toArray().map(row);
    const total = sql.exec("SELECT COUNT(*) AS c FROM daily WHERE day = ?", day).one().c;
    let me = null;
    if (okPid(pid)) {
      const mine = sql.exec("SELECT pts, at FROM daily WHERE day = ? AND pid = ?", day, pid).toArray()[0];
      if (mine) {
        const rank = sql.exec("SELECT COUNT(*) AS c FROM daily WHERE day = ? AND (pts > ? OR (pts = ? AND at < ?))", day, mine.pts, mine.pts, mine.at).one().c + 1;
        const ahead = sql.exec("SELECT name, pts FROM daily WHERE day = ? AND (pts > ? OR (pts = ? AND at < ?)) ORDER BY pts ASC, at DESC LIMIT 1", day, mine.pts, mine.pts, mine.at).toArray()[0];
        me = { p: mine.pts, rank, ahead: ahead ? { n: ahead.name, p: ahead.pts } : null };
      }
    }
    const y = sql.exec("SELECT name, pts FROM daily WHERE day = ? ORDER BY pts DESC, at ASC LIMIT 1", yd).toArray()[0];
    const all = sql.exec("SELECT pid, name, pts, lvl FROM alltime ORDER BY pts DESC, at ASC LIMIT 10").toArray().map(row);
    return { day, top, total, me, yday: y ? { n: y.name, p: y.pts } : null, all };
  }

  async fetch(request) {
    const url = new URL(request.url), sql = this.ctx.storage.sql, path = url.pathname;
    const ip = request.headers.get("cf-connecting-ip") || "local"; // set by Cloudflare on every request. Per-IP limits stay roomy: Indian mobile carriers put many phones behind one IP
    let m = {};
    if (request.method === "POST") { const txt = await request.text(); if (txt.length > 6000) return new Response("too big", { status: 413 }); try { m = txt ? JSON.parse(txt) : {}; } catch { return new Response("bad json", { status: 400 }); } }

    // only reachable from inside the Worker (rooms and the daily timer), never from the internet
    if (path === "/internal/scores") { for (const r of Array.isArray(m) ? m.slice(0, 8) : []) if (okPid(r.pid) && r.pts > 0 && r.pts <= 300) this.saveScore(r.pid, cleanName(r.name), Math.floor(r.pts), clamp(Math.floor(r.lvl) || 1, 1, 99)); return this.json({ ok: 1 }); }
    if (path === "/internal/room") { // rooms check in every 15 seconds; the list lives in memory only
      if (!this.rooms) this.rooms = new Map();
      const code = String(m.code || ""); let e = [...this.rooms.values()].find(r => r.code === code);
      if (!m.n) { if (e) this.rooms.delete(e.id); return this.json({ ok: 1 }); }
      if (!e) { e = { id: b64u(crypto.getRandomValues(new Uint8Array(8))).toLowerCase().replace(/[^a-z0-9]/g, "x"), code }; this.rooms.set(e.id, e); }
      Object.assign(e, { host: cleanName(m.host), n: m.n | 0, phase: m.phase === "play" ? "play" : "lobby", open: !!m.open, at: Date.now() });
      return this.json({ ok: 1 });
    }
    if (path === "/internal/resolve") { const e = this.rooms && this.rooms.get(url.searchParams.get("id")); return e && e.open && Date.now() - e.at < 45000 ? this.json({ code: e.code }) : new Response("gone", { status: 404 }); }
    if (path === "/api/rooms") {
      const t = Date.now(), list = []; if (this.rooms) for (const [id, e] of this.rooms) { if (t - e.at > 45000) { this.rooms.delete(id); continue; } if (e.open && e.n < 6) list.push({ id, host: e.host, n: e.n, phase: e.phase }); }
      list.sort((a, b) => (a.phase === "play") - (b.phase === "play") || b.n - a.n);
      return this.json({ rooms: list.slice(0, 8) });
    }
    if (path === "/internal/push") { await this.ctx.storage.setAlarm(Date.now() + 1000); return this.json({ ok: 1 }); }

    if (path === "/api/board") return this.json(this.board(url.searchParams.get("pid")));

    // villages: set yours, find existing ones in a district (so spellings don't split a village), see the village board
    if (path === "/api/village" && request.method === "POST") {
      if (!okPid(m.pid)) return new Response("bad pid", { status: 400 });
      if (this.flood("vs" + m.pid, 6) || this.flood("vs" + ip, 40)) return new Response("slow down", { status: 429 });
      const name = cleanVillage(m.name), dist = DISTRICTS.has(m.dist) ? m.dist : cleanVillage(m.dist);
      if (!name || !dist) return new Response("bad village", { status: 400 });
      const vk = villageKey(name, dist), t = Date.now(), day = istDay();
      if (!vk || HIDDEN_VILLAGES.has(vk)) return new Response("bad village", { status: 400 });
      sql.exec("INSERT INTO vnames (vkey, vname, dist, at) VALUES (?, ?, ?, ?) ON CONFLICT(vkey) DO NOTHING", vk, name, dist, t);
      const cur = this.villageOf(m.pid); let from = "today";
      if (!cur) sql.exec("INSERT INTO pvil (pid, vkey, since, at) VALUES (?, ?, ?, ?)", m.pid, vk, day, t);
      else if (cur === vk) { sql.exec("UPDATE pvil SET nxt = NULL, nxt_since = NULL WHERE pid = ?", m.pid); }
      else { sql.exec("UPDATE pvil SET nxt = ?, nxt_since = ?, at = ? WHERE pid = ?", vk, istDay(1), t, m.pid); from = "tomorrow"; } // today's points stay with today's village
      const n = sql.exec("SELECT vname, dist FROM vnames WHERE vkey = ?", vk).toArray()[0];
      return this.json({ v: n.vname, d: n.dist, from });
    }
    if (path === "/api/villages") {
      const dist = String(url.searchParams.get("dist") || "").slice(0, 40);
      const rows = sql.exec("SELECT v.vkey, v.vname, COUNT(p.pid) AS n FROM vnames v LEFT JOIN pvil p ON p.vkey = v.vkey WHERE v.dist = ? GROUP BY v.vkey ORDER BY n DESC, v.at ASC LIMIT 40", dist).toArray();
      return this.json({ villages: rows.filter(r => !HIDDEN_VILLAGES.has(r.vkey) && r.n > 0).map(r => ({ v: r.vname, n: r.n })) });
    }
    if (path === "/api/vboard") return this.json(this.vboard(url.searchParams.get("pid")));
    if (path === "/api/fest" && request.method === "POST") { // a player finished today's part of the festival: counted once a day for their village
      const d = m && (m.d | 0); if (!m || !okPid(m.pid) || !(d >= 1 && d <= 5)) return new Response("bad", { status: 400 });
      if (this.flood("f" + ip, 40)) return new Response("slow down", { status: 429 });
      const vk = this.villageOf(m.pid) || "", day = istDay(); sql.exec("INSERT OR REPLACE INTO vfest (day, pid, vkey, d) VALUES (?, ?, ?, ?)", day, m.pid, vk, d);
      return this.json({ ok: 1, n: vk ? sql.exec("SELECT COUNT(*) AS n FROM vfest WHERE day = ? AND vkey = ?", day, vk).toArray()[0].n : 0 });
    }

    // anonymous step counts (no ids): the game sends which steps happened this visit; one row per day and step
    if (path === "/api/ev" && request.method === "POST") {
      if (this.flood("e" + ip, 40)) return new Response("slow down", { status: 429 });
      const keys = [...new Set(Array.isArray(m.k) ? m.k : [])].filter(k => typeof k === "string" && EV_KEY.test(k)).slice(0, 30), day = istDay();
      for (const k of keys) sql.exec("INSERT INTO stats (day, k, n) VALUES (?, ?, 1) ON CONFLICT(day, k) DO UPDATE SET n = n + 1", day, k);
      if (Math.random() < 0.01) sql.exec("DELETE FROM stats WHERE day < ?", istDay(-120));
      return new Response(null, { status: 204 });
    }
    if (path === "/api/stats") {
      const days = clamp(parseInt(url.searchParams.get("days"), 10) || 14, 1, 90);
      const rows = sql.exec("SELECT day, k, n FROM stats WHERE day >= ? ORDER BY day DESC", istDay(-(days - 1))).toArray();
      const out = {}; for (const r of rows) (out[r.day] ||= {})[r.k] = r.n;
      return this.json({ days: out });
    }

    // a solo run starts by asking for a ticket; the score is only accepted with that ticket, once, and only if
    // enough time has passed to have earned it. This stops typed-in scores; it cannot stop a patient cheat.
    if (path === "/api/run") { const pid = url.searchParams.get("pid"); if (!okPid(pid)) return new Response("bad pid", { status: 400 }); if (this.flood("r" + pid, 30)) return new Response("slow down", { status: 429 });
      const body = Date.now().toString(36) + "." + b64u(crypto.getRandomValues(new Uint8Array(6))); return this.json({ tok: body + "." + await this.sign(pid + "." + body) }); }
    if (path === "/api/score") {
      if (request.method !== "POST") return new Response("POST only", { status: 405 });
      const pid = m.pid, pts = Math.floor(Number(m.pts)), lvl = clamp(Math.floor(Number(m.lvl)) || 1, 1, 99);
      if (!okPid(pid) || !(pts >= 0 && pts <= 300)) return new Response("bad score", { status: 400 });
      if (this.flood("s" + pid, 20)) return new Response("slow down", { status: 429 });
      const parts = String(m.tok || "").split("."), body = parts[0] + "." + parts[1], t0 = parseInt(parts[0], 36), secs = (Date.now() - t0) / 1000;
      if (parts.length !== 3 || parts[2] !== await this.sign(pid + "." + body)) return new Response("no ticket", { status: 403 });
      if (!(secs >= 0 && secs < 7200) || pts > 3 + secs * 1.2) return new Response("too fast", { status: 403 });
      if (sql.exec("SELECT 1 FROM used WHERE tok = ?", body).toArray().length) return new Response("ticket used", { status: 403 });
      sql.exec("INSERT INTO used (tok, at) VALUES (?, ?)", body, Date.now());
      this.saveScore(pid, cleanName(m.name), pts, lvl);
      return this.json(this.board(pid));
    }

    // keep progress: the phone uploads its progress and gets a short code that restores it on any phone
    if (path === "/api/save" && request.method === "POST") {
      if (!okPid(m.pid) || typeof m.data !== "object" || !m.data) return new Response("bad save", { status: 400 });
      if (this.flood("v" + m.pid, 20)) return new Response("slow down", { status: 429 });
      const data = JSON.stringify(m.data); if (data.length > 2500) return new Response("too big", { status: 413 });
      let code = sql.exec("SELECT code FROM saves WHERE pid = ?", m.pid).toArray()[0]?.code;
      if (!code && (this.flood("vn" + ip, 30) || this.flood("vn", 600))) return new Response("slow down", { status: 429 });
      if (!code) { const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; do { code = Array.from(crypto.getRandomValues(new Uint8Array(6)), b => A[b % 32]).join(""); } while (sql.exec("SELECT 1 FROM saves WHERE code = ?", code).toArray().length); }
      sql.exec("INSERT INTO saves (pid, code, data, at) VALUES (?, ?, ?, ?) ON CONFLICT(pid) DO UPDATE SET data = excluded.data, at = excluded.at", m.pid, code, data, Date.now());
      return this.json({ code });
    }
    if (path === "/api/restore" && request.method === "POST") {
      if (this.flood("restore" + ip, 20) || this.flood("restore", 600)) return new Response("slow down", { status: 429 });
      const code = String(m.code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      const r = sql.exec("SELECT pid, data FROM saves WHERE code = ?", code).toArray()[0];
      if (!r) return new Response("no such code", { status: 404 });
      return this.json({ pid: r.pid, data: JSON.parse(r.data) });
    }

    // daily reminders (web push)
    if (path === "/api/push/key") return this.json({ key: (await this.vapid()).pub });
    if (path === "/api/push/sub" && request.method === "POST") {
      const ep = String(m.endpoint || "");
      if (!okPid(m.pid) || !okPushHost(ep) || ep.length > 700) return new Response("bad subscription", { status: 400 });
      if (this.flood("p" + m.pid, 10) || this.flood("pn" + ip, 30) || this.flood("pn", 600)) return new Response("slow down", { status: 429 });
      if (m.off) sql.exec("DELETE FROM subs WHERE endpoint = ?", ep);
      else sql.exec("INSERT INTO subs (endpoint, pid, played, sent, at) VALUES (?, ?, ?, '', ?) ON CONFLICT(endpoint) DO UPDATE SET pid = excluded.pid", ep, m.pid, istDay(), Date.now());
      return this.json({ ok: 1 });
    }
    return new Response("Not found", { status: 404 });
  }

  // VAPID identity for push, made once and kept inside this object
  async vapid() {
    if (this._vapid) return this._vapid;
    let v = await this.ctx.storage.get("vapid");
    if (!v) { const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
      v = { jwk: await crypto.subtle.exportKey("jwk", kp.privateKey), pub: b64u(new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey))) }; await this.ctx.storage.put("vapid", v); }
    const key = await crypto.subtle.importKey("jwk", v.jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
    return (this._vapid = { key, pub: v.pub });
  }
  async vapidHeader(endpoint) {
    const v = await this.vapid(), enc = (o) => b64u(new TextEncoder().encode(JSON.stringify(o)));
    const head = enc({ typ: "JWT", alg: "ES256" }) + "." + enc({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: "https://khuntau.dulalkisku0.workers.dev" });
    const sig = b64u(new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, v.key, new TextEncoder().encode(head))));
    return `vapid t=${head}.${sig}, k=${v.pub}`;
  }
  // sends in small batches so it stays inside the free plan's limits; players who already played today are skipped
  async alarm() {
    const sql = this.ctx.storage.sql, day = istDay();
    const batch = sql.exec("SELECT endpoint FROM subs WHERE sent != ? AND played != ? LIMIT 40", day, day).toArray();
    for (const { endpoint } of batch) {
      sql.exec("UPDATE subs SET sent = ? WHERE endpoint = ?", day, endpoint);
      try {
        const r = await fetch(endpoint, { method: "POST", headers: { authorization: await this.vapidHeader(endpoint), ttl: "21600", urgency: "normal", "content-length": "0" } });
        if (r.status === 404 || r.status === 410) sql.exec("DELETE FROM subs WHERE endpoint = ?", endpoint); // the player turned reminders off or uninstalled
      } catch (e) {}
    }
    if (batch.length === 40) await this.ctx.storage.setAlarm(Date.now() + 2000);
  }
}
