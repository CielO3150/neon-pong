const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;
app.use(express.static("public"));

const rooms = new Map();
const W = 900, H = 520, PADDLE_H = 100, BALL_R = 11;

function makeRoom(code) {
  return {
    code, players: [], running: false, score: [0, 0],
    paddles: [H / 2, H / 2],
    ball: { x: W / 2, y: H / 2, vx: 0, vy: 0 },
    lastHit: -1, countdown: 0
  };
}
function resetBall(room, direction = Math.random() < .5 ? -1 : 1) {
  room.ball = { x: W / 2, y: H / 2, vx: direction * 5.2, vy: (Math.random() * 4 - 2) };
  room.lastHit = -1;
}
function publicState(room) {
  return {
    code: room.code, players: room.players.map(p => ({ name: p.name })),
    score: room.score, paddles: room.paddles, ball: room.ball,
    running: room.running, countdown: room.countdown
  };
}
function emitRoom(room) { io.to(room.code).emit("state", publicState(room)); }

io.on("connection", socket => {
  socket.on("createRoom", ({ name }) => {
    let code;
    do { code = Math.random().toString(36).slice(2, 6).toUpperCase(); } while (rooms.has(code));
    const room = makeRoom(code);
    room.players.push({ id: socket.id, name: cleanName(name) });
    rooms.set(code, room);
    socket.join(code); socket.data.room = code; socket.data.index = 0;
    socket.emit("joined", { code, index: 0 }); emitRoom(room);
  });

  socket.on("joinRoom", ({ code, name }) => {
    code = String(code || "").trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) return socket.emit("errorMessage", "そのルームコードは見つかりません。");
    if (room.players.length >= 2) return socket.emit("errorMessage", "このルームは満員です。");
    room.players.push({ id: socket.id, name: cleanName(name) });
    socket.join(code); socket.data.room = code; socket.data.index = 1;
    socket.emit("joined", { code, index: 1 });
    room.running = true; resetBall(room); emitRoom(room);
  });

  socket.on("move", y => {
    const room = rooms.get(socket.data.room);
    if (!room || !Number.isFinite(y)) return;
    const i = socket.data.index;
    room.paddles[i] = Math.max(PADDLE_H / 2 + 8, Math.min(H - PADDLE_H / 2 - 8, y));
  });

  socket.on("launch", () => {
    const room = rooms.get(socket.data.room);
    if (!room || room.players.length !== 2 || room.ball.vx !== 0) return;
    resetBall(room, Math.random() < .5 ? -1 : 1); emitRoom(room);
  });

  socket.on("disconnect", () => {
    const code = socket.data.room, room = rooms.get(code);
    if (!room) return;
    room.players = room.players.filter(p => p.id !== socket.id);
    io.to(code).emit("opponentLeft");
    rooms.delete(code);
  });
});

function cleanName(v) {
  const s = String(v || "Player").trim().slice(0, 14);
  return s || "Player";
}

setInterval(() => {
  for (const room of rooms.values()) {
    if (room.players.length !== 2) continue;
    const b = room.ball;
    if (b.vx === 0 && b.vy === 0) { emitRoom(room); continue; }
    b.x += b.vx; b.y += b.vy;
    if (b.y < BALL_R || b.y > H - BALL_R) b.vy *= -1;

    // Left and right paddles deflect the shared ball.
    if (b.vx < 0 && b.x - BALL_R <= 34 && Math.abs(b.y - room.paddles[0]) <= PADDLE_H / 2 + BALL_R) {
      b.x = 34 + BALL_R; b.vx = Math.min(8.5, Math.abs(b.vx) * 1.035);
      b.vy += (b.y - room.paddles[0]) * 0.075;
    } else if (b.vx > 0 && b.x + BALL_R >= W - 34 && Math.abs(b.y - room.paddles[1]) <= PADDLE_H / 2 + BALL_R) {
      b.x = W - 34 - BALL_R; b.vx = -Math.min(8.5, Math.abs(b.vx) * 1.035);
      b.vy += (b.y - room.paddles[1]) * 0.075;
    }

    if (b.x < -BALL_R) {
      room.score[1]++; resetBall(room, 1); room.ball.vx = 0; room.ball.vy = 0;
      room.running = false; room.countdown = 2;
    } else if (b.x > W + BALL_R) {
      room.score[0]++; resetBall(room, -1); room.ball.vx = 0; room.ball.vy = 0;
      room.running = false; room.countdown = 2;
    }
    if (room.countdown > 0) {
      room.countdown -= 1 / 30;
      if (room.countdown <= 0) { room.countdown = 0; room.running = true; resetBall(room); }
    }
    emitRoom(room);
  }
}, 1000 / 30);

server.listen(PORT, () => console.log(`Ricochet Duel listening on ${PORT}`));
