'use strict';
let FG = '#fff';
const lum = h => { const n = parseInt(h.slice(1), 16); return (.299 * (n >> 16) + .587 * (n >> 8 & 255) + .114 * (n & 255)) / 255; };
const S = io(), $ = i => document.getElementById(i), W = 1000, H = 600;
const tk = localStorage.tk || (localStorage.tk = Math.random().toString(36).slice(2) + Date.now().toString(36));
let room = null, me = 0, view = 'home', st = null, stAt = 0, myY = 300, fx = localStorage.fx || 'high', cat = 0, sent = 0, keys = {}, last = 0, shake = 0, hudKey = '';
const SHP = [['round', '角丸'], ['rect', '四角'], ['capsule', 'カプセル'], ['diamond', 'ひし形'], ['double', '二重']];
const SEL = { multMode: [['linear', '通常（毎回 +N 個）'], ['exponential', '指数的（弾数 ×(N+1)）']], mode: [['time', '制限時間制'], ['rounds', 'ラウンド・ポイント制']] };
const SCHEMA = [
  ['弾', [['ballSpeed', '弾の初速'], ['accel', '弾の加速度（毎秒）'], ['ballSize', '弾の大きさ'], ['ballCount', '初期の弾の数']]],
  ['増殖', [['mult', 'バーに当たったら増殖', 'b'], ['multMode', '増殖方法', 's'], ['multCount', '増える数 N'], ['multInterval', '出現間隔（ミリ秒）']]],
  ['バー', [['barW', 'バーの幅'], ['barH', 'バーの高さ']]],
  ['試合', [['mode', '試合形式', 's'], ['timeLimit', '制限時間（秒）'], ['target', '目標ラウンド数（先取点）']]],
  ['プレイヤー', null]];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
$('name').value = localStorage.name || ''; $('fxsel').value = fx;
$('fxsel').onchange = e => { fx = e.target.value; localStorage.fx = fx; };
const nm = () => { localStorage.name = $('name').value; return $('name').value || 'PLAYER'; };
$('create').onclick = () => S.emit('create', { name: nm(), token: tk });
$('join').onclick = () => S.emit('join', { id: $('rid').value, name: nm(), token: tk });
$('endbtn').onclick = () => { if (confirm('試合を終了しますか？（現在の得点で勝敗が決まります）')) S.emit('endmatch'); };
$('start').onclick = () => S.emit('start');
$('rst').onclick = () => { if (confirm('【注意】両プレイヤーの得点が 0 - 0 に戻ります。この操作は元に戻せません。\n\n得点をリセットしますか？')) S.emit('reset'); };
const doLeave = () => { if (confirm(me === 0 ? '退室するとルームが閉じられます。退室しますか？' : '退室しますか？（試合から抜けます）')) { S.emit('leave'); room = null; st = null; view = 'home'; show(); } };
$('leave').onclick = doLeave; $('gleave').onclick = doLeave;
$('copy').onclick = async () => { const t = $('roomid').value; try { await navigator.clipboard.writeText(t); } catch { $('roomid').select(); document.execCommand('copy'); }
  $('copy').textContent = 'コピーしました ✓'; setTimeout(() => $('copy').textContent = 'コピー', 1500); };
$('roomid').onclick = e => e.target.select();
S.on('err', m => { $('err').textContent = m; if (view !== 'home') alert(m); });
S.on('joined', d => { me = d.idx; $('err').textContent = ''; });
S.on('closed', () => { alert('オーナーが退室したためルームが閉じられました'); room = null; view = 'home'; show(); });
S.on('connect', () => { if (room) S.emit('join', { id: room.id, name: nm(), token: tk }); });   // 再接続
S.on('room', r => {
  room = r; if (r.phase === 'lobby') { st = null; hudKey = ''; }
  if (r.phase === 'ready' || r.phase === 'playing') view = 'game';
  else if (r.phase === 'lobby' || view === 'home') view = 'lobby';
  show(); renderLobby(); renderEnd();
});
S.on('state', d => { st = d; stAt = performance.now(); d.ev.forEach(onEv); });
$('panel').addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.p !== undefined) { const o = {}; document.querySelectorAll('#panel [data-p]').forEach(x => o[x.dataset.p] = x.value); S.emit('profile', o); }
  else if (t.dataset.k) S.emit('settings', { [t.dataset.k]: t.type === 'checkbox' ? t.checked : t.type === 'number' ? Number(t.value) : t.value });
});
$('panel').addEventListener('focusout', () => setTimeout(renderLobby, 80));

function show() {
  for (const s of ['home', 'lobby', 'game']) $(s).classList.toggle('on', s === view);
  if (!room) return;
  const mp = room.players[me] || room.players[0], light = lum(mp.bg) > .55, R = document.documentElement.style; FG = light ? '#000' : '#fff';   // 背景の明るさで文字色を白/黒に
  R.setProperty('--bg', mp.bg); R.setProperty('--ac', mp.accent); R.setProperty('--fg', FG);
  R.setProperty('--pn', light ? 'rgba(255,255,255,.55)' : 'rgba(0,0,0,.35)'); R.setProperty('--sf', light ? 'rgba(0,0,0,.06)' : 'rgba(255,255,255,.08)');
  R.setProperty('--ln', light ? 'rgba(0,0,0,.06)' : 'rgba(255,255,255,.03)'); R.setProperty('--oa', lum(mp.accent) > .55 ? '#000' : '#fff');
}
function pf(pl, mine) {
  const d = mine ? '' : 'disabled', a = mine ? ' data-p=' : ' data-x=';
  return `<label class="f"><span>名前</span><input${a}name value="${esc(pl.name)}" maxlength="12" ${d}></label>
<label class="f"><span>背景色</span><input type="color"${a}bg value="${pl.bg}" ${d}></label>
<label class="f"><span>アクセントカラー</span><input type="color"${a}accent value="${pl.accent}" ${d}></label>
<label class="f"><span>バーの形状</span><select${a}shape ${d}>${SHP.map(o => `<option value="${o[0]}" ${o[0] === pl.shape ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></label>`;
}
function renderLobby() {
  if (!room || view === 'home') return;
  $('roomid').value = room.id;
  $('pst').innerHTML = [0, 1].map(i => { const p = room.players[i]; return p ? `<span style="border-bottom:3px solid ${p.accent}">${p.connected ? '●' : '○切断中'} ${esc(p.name)}${i ? '' : '（オーナー）'}</span>` : '<span style="opacity:.6">○ 相手を待っています…</span>'; }).join('　');
  $('nav').innerHTML = SCHEMA.map((c, i) => `<button class="${i === cat ? 'on' : ''}" data-c="${i}">${c[0]}</button>`).join('');
  $('nav').querySelectorAll('button').forEach(b => b.onclick = () => { cat = +b.dataset.c; renderLobby(); });
  const ed = room.phase === 'lobby' || room.phase === 'ended', own = me === 0 && ed;
  const full = room.players.length === 2 && room.players.every(p => p.connected);
  $('start').textContent = me !== 0 ? 'オーナーの開始待ち' : room.phase === 'ended' ? '再開（得点は保持）' : 'ゲーム開始';
  $('start').disabled = !(me === 0 && ed && full); $('rst').disabled = !(me === 0 && ed); $('rst').style.display = me === 0 ? '' : 'none';
  const p = $('panel'); if (p.contains(document.activeElement)) return;
  const [name, fs] = SCHEMA[cat]; let h = '';
  if (fs) {
    h = `<h2>${name}${own ? '' : '（閲覧のみ・変更はオーナー）'}</h2>`;
    for (const [k, l, t] of fs) {
      const v = room.settings[k], d = own ? '' : 'disabled';
      h += `<label class="f"><span>${l}</span>` + (t === 'b' ? `<input type="checkbox" data-k="${k}" ${v ? 'checked' : ''} ${d}>` :
        t === 's' ? `<select data-k="${k}" ${d}>${SEL[k].map(o => `<option value="${o[0]}" ${o[0] === v ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>` :
          `<input type="number" step="any" data-k="${k}" value="${v}" ${d}>`) + '</label>';
    }
  } else {
    h = '<h2>プレイヤー設定</h2>';
    room.players.forEach((pl, i) => { h += `<div class="pc" style="border-color:${pl.accent}"><b>${esc(pl.name)}${i === me ? '（あなた）' : ''}</b>${pf(pl, i === me && ed)}</div>`; });
  }
  p.innerHTML = h;
}
function renderEnd() {
  const e = $('endcard'), on = room && room.phase === 'ended' && view === 'game';
  e.style.display = on ? 'flex' : 'none'; if (!on) return;
  const w = room.result ? room.result.winner : -1;
  e.innerHTML = `<div>${w < 0 ? 'DRAW' : esc(room.players[w].name) + ' WIN!'}</div><div>${room.scores[0]} - ${room.scores[1]}</div><button id="back">設定・再開画面へ</button>`;
  $('back').onclick = () => { view = 'lobby'; show(); renderLobby(); renderEnd(); };
}
// ---------- 入力 ----------
const cv = $('cv'), c = cv.getContext('2d');
const inUI = e => e.target.closest && e.target.closest('button,select,input,#endcard');
const mv = e => { if (view !== 'game' || inUI(e)) return false; const r = cv.getBoundingClientRect(); myY = (e.clientY - r.top) / r.height * H; return true; };
addEventListener('pointermove', mv);   // 画面のどこでも追従（キャンバスの外でも）
addEventListener('pointerdown', e => { if (mv(e)) trySrv(); });
function trySrv() { if (st && st.ph === 'ready' && st.sv === me) S.emit('serve'); }
const kn = e => e.key.length === 1 ? e.key.toLowerCase() : e.key;
addEventListener('keydown', e => { if (view === 'game' && (e.key === ' ' || e.key === 'Enter')) { trySrv(); e.preventDefault(); } if (view === 'game' && ['w', 's', 'ArrowUp', 'ArrowDown'].includes(kn(e))) { keys[kn(e)] = 1; e.preventDefault(); } });
addEventListener('keyup', e => delete keys[kn(e)]);
// ---------- 演出 ----------
const fxc = $('fxc'), fc = fxc.getContext('2d'); let P = [], R = [];
const K = { high: 1, low: .35, off: 0 };
const rs = () => { fxc.width = innerWidth; fxc.height = innerHeight; }; addEventListener('resize', rs); rs();
const sp = (x, y) => { const r = cv.getBoundingClientRect(); return [r.left + x / W * r.width, r.top + y / H * r.height]; };
function burst(x, y, col, n, v = 300) {
  n = Math.round(n * K[fx]); const [a, b] = sp(x, y);
  for (let i = 0; i < n && P.length < 1500; i++) { const an = Math.random() * 6.283, s = Math.random() * v + v * .2; P.push({ x: a, y: b, vx: Math.cos(an) * s, vy: Math.sin(an) * s, l: 1, c: col, s: 2 + Math.random() * 3 }); }
}
function ring(x, y, col) { if (!K[fx]) return; const [a, b] = sp(x, y); R.push({ x: a, y: b, r: 10, l: 1, c: col }); }
function flash(col, a) {
  if (!K[fx]) return; const f = $('flash'); f.style.background = `radial-gradient(circle,${col},transparent 80%)`;
  f.animate([{ opacity: a * K[fx] }, { opacity: 0 }], { duration: 650 });
}
function banner(t, col) {
  if (!K[fx]) return; const b = $('banner'); b.textContent = t; b.style.color = col;
  b.animate([{ opacity: 0, transform: 'translate(-50%,-50%) scale(.5)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1.1)', offset: .3 }, { opacity: 0, transform: 'translate(-50%,-50%) scale(1.7)' }], { duration: 1000 });
}
function onEv(e) {
  if (!room) return; const ac = i => room.players[i].accent;
  if (e.t === 'hit') burst(e.side === 0 ? 40 : 960, e.y, ac(e.side), 14);
  else if (e.t === 'spawn') burst(e.x, e.y, FG, 8, 160);
  else if (e.t === 'mult') { ring(e.x, e.y, ac(e.side)); burst(e.x, e.y, ac(e.side), 50, 450); flash(ac(e.side), .3); banner('+' + e.n, ac(e.side)); }
  else if (e.t === 'score') {
    flash(ac(e.side), .75); shake = 16; ring(e.side === 0 ? 1000 : 0, e.y, ac(e.side)); banner('POINT!', ac(e.side));
    for (let i = 0; i < 8; i++) burst(Math.random() * W, Math.random() * H, ac(e.side), 40, 500);
  } else if (e.t === 'go') { flash(FG, .5); banner('GO!', FG); }
  else if (e.t === 'round') banner('NEXT ROUND', ac(0));
  else if (e.t === 'end') {
    const col = e.winner < 0 ? FG : ac(e.winner); flash(col, .9); banner(e.winner < 0 ? 'DRAW' : 'FINISH!', col);
    for (let i = 0; i < 14; i++) setTimeout(() => { burst(Math.random() * W, Math.random() * H, i % 2 ? ac(0) : ac(1), 90, 600); ring(Math.random() * W, Math.random() * H, col); }, i * 150);
  }
}
function drawFx(dt) {
  fc.clearRect(0, 0, fxc.width, fxc.height); fc.globalCompositeOperation = 'lighter';
  P = P.filter(p => (p.l -= dt * .9) > 0);
  for (const p of P) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 200 * dt; fc.globalAlpha = p.l; fc.fillStyle = p.c; fc.beginPath(); fc.arc(p.x, p.y, p.s, 0, 6.283); fc.fill(); }
  R = R.filter(r => (r.l -= dt * 1.5) > 0);
  for (const r of R) { r.r += dt * 1400; fc.globalAlpha = r.l; fc.strokeStyle = r.c; fc.lineWidth = 6; fc.beginPath(); fc.arc(r.x, r.y, r.r, 0, 6.283); fc.stroke(); }
  fc.globalAlpha = 1;
}
// ---------- 描画 ----------
function bar(x, y, w, h, sh, col) {
  c.save(); c.fillStyle = col; c.shadowColor = col; c.shadowBlur = 18; c.beginPath(); const t = y - h / 2;
  if (sh === 'rect') c.rect(x, t, w, h);
  else if (sh === 'capsule') c.roundRect(x, t, w, h, w / 2);
  else if (sh === 'diamond') { c.moveTo(x + w / 2, t); c.lineTo(x + w, y); c.lineTo(x + w / 2, t + h); c.lineTo(x, y); c.closePath(); }
  else if (sh === 'double') { c.roundRect(x, t, w * .4, h, 2); c.roundRect(x + w * .6, t, w * .4, h, 2); }
  else c.roundRect(x, t, w, h, Math.min(6, w / 2));
  c.fill(); c.restore();
}
// 受信と受信の間の弾位置の予測。壁・バーで折り返して描画上のすり抜けを防ぐ
function pred(b, t, s, pd) {
  const r = s.ballSize, h = s.barH / 2 + r, xl = 30 + s.barW + r, xr = W - 30 - s.barW - r, H2 = H - 2 * r;
  let x = b[0] + b[2] * t, y = b[1] + b[3] * t, yy = (y - r) % (2 * H2); if (yy < 0) yy += 2 * H2; y = (yy > H2 ? 2 * H2 - yy : yy) + r;
  if (b[2] < 0 && b[0] >= xl && x < xl && Math.abs(y - pd[0]) <= h) x = 2 * xl - x;
  else if (b[2] > 0 && b[0] <= xr && x > xr && Math.abs(y - pd[1]) <= h) x = 2 * xr - x;
  return [x, y];
}
function draw() {
  const s = room.settings, pl = room.players, mp = pl[me], hh = s.barH / 2;
  myY = Math.max(hh, Math.min(H - hh, myY));
  const pdl = [0, 1].map(i => i === me ? myY : st ? st.pd[i] : 300);
  c.textAlign = 'center'; c.fillStyle = mp.bg; c.fillRect(0, 0, W, H);
  c.fillStyle = pl[0].accent + '14'; c.fillRect(0, 0, W / 2, H);
  if (pl[1]) { c.fillStyle = pl[1].accent + '14'; c.fillRect(W / 2, 0, W / 2, H); }
  c.strokeStyle = mp.accent + '66'; c.setLineDash([14, 12]); c.lineWidth = 3; c.beginPath(); c.moveTo(W / 2, 0); c.lineTo(W / 2, H); c.stroke(); c.setLineDash([]);
  const sc = st ? st.sc : room.scores;
  c.font = 'bold 150px system-ui'; c.globalAlpha = .12; c.fillStyle = pl[0].accent; c.fillText(sc[0], W * .25, 300);
  if (pl[1]) { c.fillStyle = pl[1].accent; c.fillText(sc[1], W * .75, 300); } c.globalAlpha = 1;
  for (let i = 0; i < 2; i++) if (pl[i]) bar(i ? W - 30 - s.barW : 30, pdl[i], s.barW, s.barH, pl[i].shape, pl[i].accent);
  if (st) {
    const t = Math.min(.1, (performance.now() - stAt) / 1000);
    c.save(); c.fillStyle = FG; c.shadowColor = FG; c.shadowBlur = 16;
    for (const b of st.b) { const [x, y] = pred(b, t, s, pdl); c.beginPath(); c.arc(x, y, s.ballSize, 0, 6.283); c.fill(); } c.restore();
    if (st.ph === 'ready') {   // 発射待ち: 弾を発射側のバー先端に表示
      const i = st.sv, r = s.ballSize, x = i ? W - 30 - s.barW - r : 30 + s.barW + r, y = pdl[i];
      c.save(); c.fillStyle = FG; c.shadowColor = pl[i].accent; c.shadowBlur = 28; c.beginPath(); c.arc(x, y, r, 0, 6.283); c.fill(); c.restore();
      c.fillStyle = FG; c.font = 'bold 20px system-ui'; if (s.ballCount > 1) c.fillText('×' + s.ballCount, x, y - r - 10);
      c.save(); c.shadowColor = mp.bg; c.shadowBlur = 8; c.fillStyle = pl[i].accent; c.font = 'bold 34px system-ui';
      c.fillText(i === me ? 'クリック / タップ / スペースで発射！' : pl[i].name + ' の発射を待っています…', W / 2, H / 2 + 12);
      c.fillStyle = FG; c.font = '20px system-ui'; c.globalAlpha = .7; c.fillText('発射前もバーを動かせます', W / 2, H / 2 + 48); c.restore();
    }
    if (st.q) { c.font = '20px system-ui'; c.fillStyle = FG; c.globalAlpha = .6; c.fillText('出現待ち ' + st.q, W / 2, H - 14); c.globalAlpha = 1; }
  }
  if (pl.some(p => !p.connected) || pl.length < 2) { c.fillStyle = '#000b'; c.fillRect(0, 0, W, H); c.fillStyle = '#fff'; c.font = 'bold 44px system-ui'; c.fillText('相手の接続待ち…', W / 2, H / 2); }
}
function hud() {
  const pl = room.players, sc = st ? st.sc : room.scores, s = room.settings;
  const tl = st ? Math.max(0, Math.ceil(st.tl)) : s.timeLimit, mid = s.mode === 'time' ? `⏱ ${Math.floor(tl / 60)}:${String(tl % 60).padStart(2, '0')}` : `先取 +${s.target}点`;
  const k = [sc, mid, pl.map(p => p.name)].join('|'); if (k === hudKey) return; hudKey = k;
  $('hud').innerHTML = `<span style="border-bottom:3px solid ${pl[0].accent}">${esc(pl[0].name)} <b>${sc[0]}</b></span><span>${mid}</span><span style="border-bottom:3px solid ${pl[1] ? pl[1].accent : 'transparent'}"><b>${sc[1]}</b> ${pl[1] ? esc(pl[1].name) : ''}</span>`;
}
function loop(now) {
  requestAnimationFrame(loop); const dt = Math.min(.05, (now - last) / 1000); last = now;
  drawFx(dt);
  if (view !== 'game' || !room) return;
  if (keys.w || keys.ArrowUp) myY -= 650 * dt; if (keys.s || keys.ArrowDown) myY += 650 * dt;
  $('endbtn').style.display = me === 0 && room.phase !== 'ended' ? '' : 'none';
  draw(); hud();
  cv.style.transform = shake > .5 ? `translate(${(Math.random() - .5) * shake}px,${(Math.random() - .5) * shake}px)` : ''; shake *= .88;
  if (now - sent > 16) { sent = now; S.volatile.emit('paddle', myY); }   // ラウンド前の待機中も送信
}
requestAnimationFrame(loop);
