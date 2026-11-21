// chess.xcf.ai — Cloudflare Worker + one Durable Object per online game room.
import { newGame, play, resign } from '../public/engine.js';

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const m = url.pathname.match(/^\/ws\/([A-Z0-9]{4,8})$/);
    if (m) {
      if (req.headers.get('Upgrade') !== 'websocket') return new Response('Expected WebSocket', { status: 426 });
      return env.ROOMS.get(env.ROOMS.idFromName(m[1])).fetch(req);
    }
    if (url.pathname === '/api/room') {
      const code = Array.from(crypto.getRandomValues(new Uint8Array(5)), b => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');
      return Response.json({ code });
    }
    if (url.pathname === '/' || url.pathname.startsWith('/r/')) url.pathname = '/index.html';
    return env.ASSETS.fetch(new Request(url, req));
  },
};

export class ChessRoom {
  constructor(state) {
    this.state = state;
    this.sockets = new Map(); // ws -> { token, color: 'w' | 'b' | null }
    this.loaded = state.blockConcurrencyWhile(async () => { this.room = (await state.storage.get('room')) || null; });
  }

  async fetch() {
    await this.loaded;
    const [client, server] = Object.values(new WebSocketPair());
    server.accept();
    this.sockets.set(server, { token: null, color: null });
    server.addEventListener('message', e => this.onMessage(server, e.data).catch(err => this.send(server, { type: 'error', message: String(err.message || err) })));
    const drop = () => { this.sockets.delete(server); this.broadcast(); };
    server.addEventListener('close', drop);
    server.addEventListener('error', drop);
    return new Response(null, { status: 101, webSocket: client });
  }

  send(ws, msg) { try { ws.send(JSON.stringify(msg)); } catch {} }

  broadcast() {
    if (!this.room) return;
    const online = { w: false, b: false };
    for (const s of this.sockets.values()) if (s.color) online[s.color] = true;
    for (const [ws, s] of this.sockets) this.send(ws, { type: 'state', game: this.room.game, you: s.color, online });
  }

  async save() { await this.state.storage.put('room', this.room); }

  async onMessage(ws, raw) {
    const msg = JSON.parse(raw), me = this.sockets.get(ws);
    if (msg.type === 'join') {
      me.token = String(msg.token || '').slice(0, 64);
      if (!this.room) this.room = { game: newGame(), players: { w: null, b: null } };
      const p = this.room.players;
      if (p.w === me.token) me.color = 'w';
      else if (p.b === me.token) me.color = 'b';
      else if (!p.w) { p.w = me.token; me.color = 'w'; }
      else if (!p.b) { p.b = me.token; me.color = 'b'; }
      else me.color = null; // spectator
      await this.save();
      return this.broadcast();
    }
    if (!this.room || !me.color) return this.send(ws, { type: 'error', message: 'You are watching this game' });
    const g = this.room.game;
    if (msg.type === 'resign') resign(g, me.color);
    else if (msg.type === 'rematch') {
      if (!g.over) return;
      this.room.game = newGame();
      const p = this.room.players; [p.w, p.b] = [p.b, p.w];
      for (const s of this.sockets.values()) if (s.color) s.color = s.token === p.w ? 'w' : 'b';
    } else if (msg.type === 'move') {
      if (g.turn !== me.color) return this.send(ws, { type: 'error', message: 'Not your turn' });
      const r = play(g, msg.from | 0, msg.to | 0, String(msg.promo || 'q'));
      if (!r.ok) return this.send(ws, { type: 'error', message: r.reason });
    }
    await this.save();
    this.broadcast();
  }
}
