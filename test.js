'use strict';
const G = require('./game'), assert = require('assert');
const run = (g, sec, ev = []) => { for (let i = 0; i < Math.round(sec * 60); i++) G.step(g, 1 / 60, ev); return ev; };
let g = G.createGame(); G.startMatch(g);
run(g, 1); assert.equal(g.phase, 'ready'); assert.equal(g.timeLeft, g.settings.timeLimit);
G.setPaddle(g, 0, 400); assert.equal(g.paddles[0], 400);          // 待機中も動かせる
G.setPaddle(g, 0, -999); assert.equal(g.paddles[0], g.settings.barH / 2);   // 範囲外に出ない
run(g, 5); assert.equal(g.phase, 'ready'); assert.equal(g.timeLeft, g.settings.timeLimit);   // クリックするまで始まらない
G.serveBall(g, []); run(g, 1); assert.equal(g.phase, 'playing'); assert(g.timeLeft < g.settings.timeLimit);
// 極端な速度でもすり抜けず、止まらない
g = G.createGame({ ballSpeed: 1e6, mult: false }); g.phase = 'playing'; g.timeLeft = 99;
g.balls = [{ id: 1, x: 500, y: 300, vx: -1e6, vy: 0 }]; let ev = [];
G.step(g, 1 / 60, ev);
assert(ev.filter(e => e.t === 'hit').length >= 2 && g.balls.length === 1 && g.balls[0].x > 0 && g.balls[0].x < G.W);
// 外すと得点・失点側が次の発射側
g = G.createGame({ mult: false }); g.phase = 'playing'; g.timeLeft = 99; g.paddles = [50, 50];
g.balls = [{ id: 1, x: 200, y: 400, vx: -2000, vy: 0 }]; ev = run(g, 0.5);
assert.deepEqual(g.scores, [0, 1]); assert.equal(g.lastLoser, 0); assert.equal(g.phase, 'ready'); assert.equal(g.serve, 0);
// 増殖: 当たれば必ず増え、1個ずつ間隔を空けて出る
g = G.createGame({ multCount: 3, mult: true, accel: 0 }); g.phase = 'playing'; g.timeLeft = 99; g.paddles = [300, 300];
g.balls = [{ id: 1, x: 70, y: 300, vx: -300, vy: 0 }]; ev = []; let prev = 1, maxJump = 0, total = 0;
for (let i = 0; i < 90; i++) { G.step(g, 1 / 60, ev); maxJump = Math.max(maxJump, g.balls.length - prev); prev = g.balls.length; }
assert(ev.some(e => e.t === 'mult' && e.n === 3)); assert.equal(g.balls.length, 4); assert(maxJump <= 1);
// 指数的でも上限で止まる
g = G.createGame({ multMode: 'exponential', multCount: 5, accel: 0, ballSpeed: 600 }); g.phase = 'playing'; g.timeLeft = 99; g.paddles = [300, 300];
g.balls = [{ id: 1, x: 500, y: 300, vx: -600, vy: 0 }];
for (let i = 0; i < 1200; i++) { G.step(g, 1 / 60, []); g.paddles = [g.balls[0] ? g.balls[0].y : 300, 300]; if (g.phase !== 'playing') break; }
assert(g.balls.length + g.queue.length <= 150);
// 再開しても得点保持、時間初期化、発射側維持
g = G.createGame(); g.scores = [3, 2]; g.lastLoser = 1; g.phase = 'ended'; g.timeLeft = 0; G.startMatch(g);
assert.deepEqual(g.scores, [3, 2]); assert.equal(g.serve, 1); assert.equal(g.timeLeft, 120); assert.equal(g.phase, 'ready');
// ラウンド制は再開後の「今回の得点」で判定
g = G.createGame({ mode: 'rounds', target: 2, mult: false }); g.scores = [5, 0]; g.lastLoser = 1; G.startMatch(g);
G.serveBall(g, []); g.queue = []; assert.equal(g.phase, 'playing'); g.balls = [{ id: 9, x: 900, y: 300, vx: 2000, vy: 0 }]; g.paddles[1] = 50;
run(g, 0.3); assert.equal(g.scores[0], 6);
// オーナーによる強制終了
g = G.createGame(); G.startMatch(g); g.scores = [1, 0]; ev = []; G.endMatch(g, ev);
assert.equal(g.phase, 'ended'); assert.equal(g.result.winner, 0); assert(ev.some(e => e.t === 'end'));
G.endMatch(g, ev); assert.equal(ev.length, 1);   // 終了後は何も起きない
// 発射位置: 失点した側（右）のバーの先端から、相手（左）へ向かう
g = G.createGame({ accel: 0 }); g.lastLoser = 1; G.startMatch(g); g.paddles[1] = 200; assert.equal(g.serve, 1);
assert(G.snapshot(g).sv === 1); G.serveBall(g, []); G.step(g, 1 / 60, []);
assert.equal(g.balls.length, 1); assert(g.balls[0].x > 900 && g.balls[0].vx < 0 && Math.abs(g.balls[0].y - 200) < 20);
assert.equal(G.serveBall(g, []), false);   // 二重発射しない
// バーの側面（上下）に当たっても反射する
g = G.createGame({ mult: false, accel: 0 }); g.phase = 'playing'; g.timeLeft = 99; g.paddles = [300, 300];
g.balls = [{ id: 1, x: 40, y: 230, vx: 0, vy: 500 }]; ev = []; G.step(g, 1 / 60, ev);
assert(ev.some(e => e.t === 'hit') && g.balls[0].vy < 0 && g.balls[0].y < 236);
// バーが弾を飛び越えるように動いても貫通しない
g = G.createGame({ mult: false, accel: 0 }); g.phase = 'playing'; g.timeLeft = 99; g.paddles = [300, 300]; g.pp = [300, 300];
g.balls = [{ id: 1, x: 40, y: 330, vx: 1, vy: 0 }]; G.setPaddle(g, 0, 450); ev = []; G.step(g, 1 / 60, ev);
assert(ev.some(e => e.t === 'hit') && g.balls[0].vy < 0 && g.balls[0].y <= 386);
// ランダム総当たり: バーが毎フレーム飛び回り高速弾が飛んでも、弾がバーの内部に残らない
g = G.createGame({ mult: false, accel: 0 }); g.timeLeft = 1e9; let inside = 0;
for (let n = 0; n < 5000; n++) {
  g.phase = 'playing'; g.queue = [];
  if (!g.balls.length) g.balls = [{ id: n, x: 500, y: 100 + Math.random() * 400, vx: (Math.random() < .5 ? -1 : 1) * (300 + Math.random() * 4000), vy: (Math.random() - .5) * 3000 }];
  G.setPaddle(g, 0, Math.random() * 600); G.setPaddle(g, 1, Math.random() * 600); G.step(g, 1 / 60, []);
  for (const b of g.balls) for (let i = 0; i < 2; i++) { const [x0, x1, y0, y1] = G.box(g, i); if (b.x > x0 + 1e-6 && b.x < x1 - 1e-6 && b.y > y0 + 1e-6 && b.y < y1 - 1e-6) inside++; }
}
assert.equal(inside, 0);
// 設定値の検証
const s = G.sanitize({ ballSpeed: 1e9, accel: 1e7, ballCount: 'x', barH: 99999, mode: 'bad' }, G.DEFAULTS);
assert.equal(s.ballSpeed, 1e9); assert.equal(s.accel, 1e7); assert.equal(s.ballCount, 1); assert.equal(s.barH, 600); assert.equal(s.mode, 'time');
console.log('ALL TESTS PASSED');
