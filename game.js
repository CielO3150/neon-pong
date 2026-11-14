'use strict';
// ゲーム計算（サーバー専用・副作用なし）。test.js で単体テスト可能。
const W = 1000, H = 600, PAD = 30, MAX_BALLS = 150, MAX_EV = 64;
const SHAPES = ['round', 'rect', 'capsule', 'diamond', 'double'];
const DEFAULTS = { ballSpeed: 420, accel: 25, ballSize: 10, ballCount: 1, mult: true, multCount: 1,
  multMode: 'linear', multInterval: 150, barW: 14, barH: 110, mode: 'time', timeLimit: 120, target: 5 };
// [最小, 最大, 整数か]  弾速・加速度は上限なし
const LIM = { ballSpeed: [1, Infinity], accel: [0, Infinity], ballSize: [3, 60], ballCount: [1, 50, 1],
  multCount: [1, 20, 1], multInterval: [30, 5000], barW: [6, 60], barH: [30, H], timeLimit: [10, 3600], target: [1, 99, 1] };

function sanitize(p, cur) {
  const s = { ...cur };
  if (!p || typeof p !== 'object') return s;
  for (const k in LIM) {
    if (k in p) {
      const v = Number(p[k]);
      if (Number.isFinite(v)) { const [a, b, i] = LIM[k]; s[k] = Math.min(b, Math.max(a, i ? Math.round(v) : v)); }
    }
  }
  if (typeof p.mult === 'boolean') s.mult = p.mult;
  if (['linear', 'exponential'].includes(p.multMode)) s.multMode = p.multMode;
  if (['time', 'rounds'].includes(p.mode)) s.mode = p.mode;
  return s;
}
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function createGame(settings) {
  return { phase: 'lobby', settings: { ...DEFAULTS, ...settings }, paddles: [H / 2, H / 2], scores: [0, 0],
    base: [0, 0], balls: [], queue: [], spawnT: 0, timeLeft: 0, countdown: 0, serve: 0, lastLoser: null,
    hits: 0, result: null, nid: 1 };
}
function setPaddle(g, i, y) {
  if (!Number.isFinite(y)) return;
  const h = g.settings.barH / 2;
  g.paddles[i] = clamp(y, h, H - h);
}
function clampPaddles(g) { setPaddle(g, 0, g.paddles[0]); setPaddle(g, 1, g.paddles[1]); }
function beginRound(g) { g.phase = 'ready'; g.countdown = 0; g.balls = []; g.queue = []; g.spawnT = 0; }
function resetScores(g) { g.scores = [0, 0]; g.base = [0, 0]; g.lastLoser = null; }
// 再開: 得点は保持。時間・ラウンド情報だけ初期化。発射側は直前の失点側（初回はオーナー=0）
function startMatch(g) {
  g.base = g.scores.slice(); g.timeLeft = g.settings.timeLimit; g.result = null; g.hits = 0;
  g.serve = g.lastLoser == null ? 0 : g.lastLoser;
  beginRound(g);
}
// 初期の弾も1個ずつ順番に出す（同時出現しない）
function launch(g) {
  const s = g.settings, dir = g.serve === 0 ? 1 : -1;
  for (let i = 0; i < s.ballCount; i++) {
    const a = (Math.random() - 0.5) * 0.8;
    g.queue.push({ srv: g.serve, vx: Math.cos(a) * s.ballSpeed * dir, vy: Math.sin(a) * s.ballSpeed });  // 発射側のバーから出す
  }
  g.spawnT = 0;
}
// 発射側プレイヤーのクリックで開始（サーバーが発射側かどうかを検証してから呼ぶ）
function serveBall(g, ev) {
  if (g.phase !== 'ready') return false;
  g.phase = 'playing'; launch(g); ev.push({ t: 'go' }); return true;
}
function hit(g, b, side, ev) {
  const s = g.settings; g.hits++;
  ev.push({ t: 'hit', x: b.x, y: b.y, side });
  if (!s.mult) return;
  let n = s.multMode === 'exponential' ? g.balls.length * s.multCount : s.multCount;
  n = Math.min(n, MAX_BALLS - g.balls.length - g.queue.length);
  if (n <= 0) return;
  const sp = Math.hypot(b.vx, b.vy), an = Math.atan2(b.vy, b.vx);
  for (let i = 0; i < n; i++) {
    const a = an + (Math.random() - 0.5) * 1.2;
    g.queue.push({ x: b.x, y: b.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp });
  }
  ev.push({ t: 'mult', x: b.x, y: b.y, n, side });
}
// 連続衝突判定: 1フレームを「次に起きる出来事」まで進める→処理→残り時間でまた進める
function moveBall(g, b, dt, ev) {
  const s = g.settings, r = s.ballSize, h = s.barH / 2 + r;
  const xl = PAD + s.barW + r, xr = W - PAD - s.barW - r;
  let rem = dt;
  for (let n = 0; n < MAX_EV && rem > 1e-9 && !b.dead; n++) {
    let t = rem, k = null;
    if (b.vy < 0) { const tw = (b.y - r) / -b.vy; if (tw < t) { t = tw; k = 'w'; } }
    else if (b.vy > 0) { const tw = (H - r - b.y) / b.vy; if (tw < t) { t = tw; k = 'w'; } }
    if (b.vx < 0) {
      if (b.x >= xl - 1e-6) { const tp = (b.x - xl) / -b.vx;
        if (tp < t && Math.abs(b.y + b.vy * tp - g.paddles[0]) <= h) { t = tp; k = 'p0'; } }
      const tg = (b.x + r) / -b.vx; if (tg < t) { t = tg; k = 'g0'; }
    } else if (b.vx > 0) {
      if (b.x <= xr + 1e-6) { const tp = (xr - b.x) / b.vx;
        if (tp < t && Math.abs(b.y + b.vy * tp - g.paddles[1]) <= h) { t = tp; k = 'p1'; } }
      const tg = (W + r - b.x) / b.vx; if (tg < t) { t = tg; k = 'g1'; }
    }
    if (t < 0) t = 0;
    b.x += b.vx * t; b.y += b.vy * t; rem -= t;
    if (k === 'w') { b.vy = -b.vy; b.y = clamp(b.y, r, H - r); }
    else if (k === 'p0' || k === 'p1') {
      const i = k === 'p0' ? 0 : 1, sp = Math.hypot(b.vx, b.vy);
      const off = clamp((b.y - g.paddles[i]) / h, -1, 1);
      b.vy = sp * off * 0.75;
      b.vx = Math.sqrt(Math.max(0, sp * sp - b.vy * b.vy)) * (i === 0 ? 1 : -1);
      b.x = i === 0 ? xl : xr;
      hit(g, b, i, ev);
    } else if (k === 'g0' || k === 'g1') {
      const scorer = k === 'g0' ? 1 : 0;
      b.dead = true; g.scores[scorer]++; g.lastLoser = 1 - scorer; g.serve = 1 - scorer;
      ev.push({ t: 'score', side: scorer, y: b.y });
    }
  }
  if (!Number.isFinite(b.x) || !Number.isFinite(b.y)) b.dead = true;
}
function finish(g, ev) {
  const d0 = g.scores[0] - g.base[0], d1 = g.scores[1] - g.base[1];
  g.phase = 'ended'; g.balls = []; g.queue = [];
  g.result = { winner: d0 > d1 ? 0 : d1 > d0 ? 1 : -1 };
  ev.push({ t: 'end', winner: g.result.winner });
}
// オーナーによる強制終了。現在の今回得点で勝敗を決める（同点は引き分け）
function endMatch(g, ev) { if (g.phase === 'ready' || g.phase === 'playing') finish(g, ev); }
function step(g, dt, ev) {
  const s = g.settings;
  if (g.phase !== 'playing') return;   // 発射待ち中は時間を進めない（バーは動かせる）
  if (s.mode === 'time') g.timeLeft -= dt;   // 弾が出てからだけ減る
  if (g.queue.length) {
    g.spawnT -= dt;
    if (g.spawnT <= 0 && g.balls.length < MAX_BALLS) {
      const q = g.queue.shift();
      if (q.srv !== undefined) { q.x = q.srv ? W - PAD - s.barW - s.ballSize : PAD + s.barW + s.ballSize; q.y = g.paddles[q.srv]; delete q.srv; }
      g.balls.push({ id: g.nid++, ...q });
      g.spawnT = s.multInterval / 1000; ev.push({ t: 'spawn', x: q.x, y: q.y });
    }
  } else g.spawnT = 0;
  for (const b of g.balls) {
    if (b.dead) continue;
    if (s.accel > 0) { const sp = Math.hypot(b.vx, b.vy) || 1, k = (sp + s.accel * dt) / sp; b.vx *= k; b.vy *= k; }
    moveBall(g, b, dt, ev);
  }
  g.balls = g.balls.filter(b => !b.dead);
  if (s.mode === 'rounds' && (g.scores[0] - g.base[0] >= s.target || g.scores[1] - g.base[1] >= s.target)) return finish(g, ev);
  if (s.mode === 'time' && g.timeLeft <= 0) { g.timeLeft = 0; return finish(g, ev); }
  if (!g.balls.length && !g.queue.length) { beginRound(g); ev.push({ t: 'round' }); }
}
const r1 = v => Math.round(v * 10) / 10;
function snapshot(g) {
  return { ph: g.phase, sv: g.serve, tl: r1(g.timeLeft), sc: g.scores, pd: g.paddles.map(r1),
    b: g.balls.map(b => [r1(b.x), r1(b.y), r1(b.vx), r1(b.vy)]), q: g.queue.length };
}
module.exports = { W, H, PAD, SHAPES, DEFAULTS, sanitize, createGame, setPaddle, clampPaddles, startMatch, resetScores, step, snapshot, endMatch, serveBall };
