'use strict';
const G = require('./game'), assert = require('assert');
const run = (g, sec, ev = []) => { for (let i = 0; i < Math.round(sec * 60); i++) G.step(g, 1 / 60, ev); return ev; };
let g = G.createGame(); G.startMatch(g);
run(g, 1); assert.equal(g.phase, 'ready'); assert.equal(g.timeLeft, g.settings.timeLimit);
G.setPaddle(g, 0, 400); assert.equal(g.paddles[0], 400);          // 待機中も動かせる
G.setPaddle(g, 0, -999); assert.equal(g.paddles[0], g.settings.barH / 2);   // 範囲外に出ない
run(g, 3); assert.equal(g.phase, 'playing'); assert(g.timeLeft < g.settings.timeLimit);
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
run(g, 3.1); assert.equal(g.phase, 'playing'); g.balls = [{ id: 9, x: 900, y: 300, vx: 2000, vy: 0 }]; g.paddles[1] = 50;
run(g, 0.3); assert.equal(g.scores[0], 6);
// 設定値の検証
const s = G.sanitize({ ballSpeed: 1e9, accel: 1e7, ballCount: 'x', barH: 99999, mode: 'bad' }, G.DEFAULTS);
assert.equal(s.ballSpeed, 1e9); assert.equal(s.accel, 1e7); assert.equal(s.ballCount, 1); assert.equal(s.barH, 600); assert.equal(s.mode, 'time');
console.log('ALL TESTS PASSED');
