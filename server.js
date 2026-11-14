'use strict';
const express = require('express'), http = require('http'), { Server } = require('socket.io'), G = require('./game');
const app = express(); app.use(express.static(__dirname + '/public'));
const srv = http.createServer(app), io = new Server(srv);
const rooms = new Map();
const hex = c => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);
const editable = r => r.g.phase === 'lobby' || r.g.phase === 'ended';
const pub = r => ({ id: r.id, phase: r.g.phase, settings: r.g.settings, scores: r.g.scores, base: r.g.base, result: r.g.result,
  players: r.players.map(p => ({ name: p.name, connected: p.connected, bg: p.bg, accent: p.accent, shape: p.shape })) });
const emitRoom = r => io.to(r.id).emit('room', pub(r));
const cleanName = n => String(n || '').replace(/[<>&"]/g, '').trim().slice(0, 12) || 'PLAYER';
const newPlayer = (tk, name, i) => ({ tk, name: cleanName(name), sid: null, connected: true,
  bg: i ? '#1a0a2e' : '#06142e', accent: i ? '#ff3da6' : '#00e5ff', shape: 'round' });
function genId() { const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s; do { s = ''; for (let i = 0; i < 5; i++) s += c[Math.floor(Math.random() * c.length)]; } while (rooms.has(s)); return s; }

function leave(sock) {
  const { room: r, idx } = sock.data; if (!r) return;
  sock.leave(r.id); sock.data = {};
  if (idx === 0) { io.to(r.id).emit('closed'); io.in(r.id).socketsLeave(r.id); rooms.delete(r.id); return; }
  r.players.splice(idx, 1); r.g = G.createGame(r.g.settings); r.ev = []; emitRoom(r);
}
function enter(sock, r, idx, p) {
  p.sid = sock.id; p.connected = true; sock.join(r.id); sock.data = { room: r, idx };
  sock.emit('joined', { idx, id: r.id }); emitRoom(r);
}
io.on('connection', sock => {
  sock.data = {};
  sock.on('create', d => {
    leave(sock); d = d || {};
    const r = { id: genId(), players: [newPlayer(String(d.token), d.name, 0)], g: G.createGame(), ev: [], idle: Date.now() };
    rooms.set(r.id, r); enter(sock, r, 0, r.players[0]);
  });
  sock.on('join', d => {
    d = d || {}; const r = rooms.get(String(d.id || '').toUpperCase().trim());
    if (!r) return sock.emit('err', 'ルームが見つかりません');
    const tk = String(d.token); let idx = r.players.findIndex(p => p.tk === tk);
    if (idx < 0) {
      if (r.players.length >= 2) return sock.emit('err', 'ルームは満員です');
      leave(sock); r.players.push(newPlayer(tk, d.name, 1)); idx = 1;
    }
    enter(sock, r, idx, r.players[idx]);   // 同じtokenなら再接続として復帰
  });
  sock.on('leave', () => leave(sock));
  sock.on('profile', d => {
    const { room: r, idx } = sock.data; if (!r || !editable(r) || !d) return;
    const p = r.players[idx];
    if (d.name !== undefined) p.name = cleanName(d.name);
    if (hex(d.bg)) p.bg = d.bg; if (hex(d.accent)) p.accent = d.accent;
    if (G.SHAPES.includes(d.shape)) p.shape = d.shape;
    emitRoom(r);
  });
  sock.on('settings', d => {   // オーナーのみ（サーバー側で検証）
    const { room: r, idx } = sock.data; if (!r || idx !== 0 || !editable(r)) return sock.emit('err', '設定を変更できるのはオーナーだけです');
    r.g.settings = G.sanitize(d, r.g.settings); G.clampPaddles(r.g); emitRoom(r);
  });
  sock.on('reset', () => { const { room: r, idx } = sock.data; if (r && idx === 0 && editable(r)) { G.resetScores(r.g); emitRoom(r); } });
  sock.on('start', () => {
    const { room: r, idx } = sock.data;
    if (!r || idx !== 0 || !editable(r)) return;
    if (r.players.length < 2 || !r.players.every(p => p.connected)) return sock.emit('err', '相手が揃っていません');
    r.ev = []; G.startMatch(r.g); emitRoom(r);
  });
  sock.on('serve', () => {   // 発射できるのは「発射側」のプレイヤーだけ
    const { room: r, idx } = sock.data;
    if (r && r.g.phase === 'ready' && idx === r.g.serve && r.players.length === 2 && r.players.every(p => p.connected)) G.serveBall(r.g, r.ev);
  });
  sock.on('endmatch', () => {   // オーナーのみ。進行中の試合を終了
    const { room: r, idx } = sock.data;
    if (!r || idx !== 0 || (r.g.phase !== 'ready' && r.g.phase !== 'playing')) return;
    G.endMatch(r.g, r.ev); io.to(r.id).emit('state', { ...G.snapshot(r.g), ev: r.ev }); r.ev = []; emitRoom(r);
  });
  sock.on('paddle', y => { const { room: r, idx } = sock.data; if (r && typeof y === 'number') G.setPaddle(r.g, idx, y); });
  sock.on('disconnect', () => {
    const { room: r, idx } = sock.data; if (!r || !r.players[idx] || r.players[idx].sid !== sock.id) return;
    r.players[idx].connected = false; r.idle = Date.now(); emitRoom(r);
  });
});
let last = Date.now(), tick = 0;
setInterval(() => {
  const now = Date.now(), dt = Math.min(0.05, (now - last) / 1000); last = now; tick++;
  for (const r of rooms.values()) {
    const g = r.g, both = r.players.length === 2 && r.players.every(p => p.connected);
    if (both && (g.phase === 'ready' || g.phase === 'playing')) {
      G.step(g, dt, r.ev); if (r.ev.length > 40) r.ev = r.ev.slice(-40);
      const ended = g.phase === 'ended';
      if (ended || tick % 2 === 0) { io.to(r.id).emit('state', { ...G.snapshot(g), ev: r.ev }); r.ev = []; }
      if (ended) emitRoom(r);
    } else if (!r.players.some(p => p.connected) && now - r.idle > 600000) rooms.delete(r.id);
  }
}, 1000 / 60);
const PORT = process.env.PORT || 3000;
srv.listen(PORT, () => console.log('NEON PONG listening on ' + PORT));
