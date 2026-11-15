'use strict';
const express = require('express'), http = require('http'), { Server } = require('socket.io'), { WebSocketServer } = require('ws');
const createLobby = require('./lobby'), wire = require('./wire');
const app = express(); app.use(express.static(__dirname + '/public'));
app.get('/health', (q, r) => r.send('ok'));
const srv = http.createServer(app), io = new Server(srv, { destroyUpgrade: false }), lobby = createLobby();

// ブラウザ版: Socket.IO
io.on('connection', raw => lobby.attach({ id: raw.id, data: {}, emit: (e, d) => raw.emit(e, d), on: (e, f) => raw.on(e, f) }));

// Unity版: 素のWebSocket（wss://<ホスト>/ws）
const wss = new WebSocketServer({ server: srv, path: '/ws' });
let wid = 0;
wss.on('connection', ws => {
  const h = {};
  lobby.attach({ id: 'ws' + (++wid), data: {}, on: (e, f) => { h[e] = f; },
    emit: (e, d) => { if (ws.readyState === 1) ws.send(wire.encode(e, d)); } });
  ws.on('message', m => { const x = wire.decode(String(m)); if (x && h[x.e]) h[x.e](x.d); });
  ws.on('close', () => { if (h.disconnect) h.disconnect(); });
  ws.on('error', () => {});
});
setInterval(() => wss.clients.forEach(c => { if (c.readyState === 1) c.ping(); }), 25000);   // 無通信での切断を防ぐ
setInterval(() => lobby.tick(), 1000 / 60);
const PORT = process.env.PORT || 3000;
srv.listen(PORT, () => console.log('NEON PONG listening on ' + PORT));
