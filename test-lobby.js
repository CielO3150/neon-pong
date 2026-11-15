'use strict';
// 通信を使わず、偽の接続でルーム管理の流れを検証する
const assert = require('assert'), createLobby = require('./lobby'), wire = require('./wire');
function fake(id) { const h = {}, log = []; return { id, data: {}, log, on: (e, f) => { h[e] = f; }, emit: (e, d) => log.push([e, d]), fire: (e, d) => h[e] && h[e](d),
  last: e => { for (let i = log.length - 1; i >= 0; i--) if (log[i][0] === e) return log[i][1]; } }; }
const L = createLobby(), A = fake('a'), B = fake('b'), C = fake('c');
[A, B, C].forEach(s => L.attach(s));
A.fire('create', { name: 'alice', token: 'ta' }); const id = A.last('joined').id; assert(id && A.last('joined').idx === 0);
B.fire('join', { id: id.toLowerCase(), name: 'bob', token: 'tb' }); assert.equal(B.last('joined').idx, 1);
C.fire('join', { id, name: 'cat', token: 'tc' }); assert.equal(C.last('err'), 'ルームは満員です');
B.fire('settings', { ballSpeed: 999 }); assert(B.last('err') && A.last('room').settings.ballSpeed !== 999);   // 非オーナーは変更不可
A.fire('settings', { ballSpeed: 900, accel: 1e7 }); assert.equal(B.last('room').settings.ballSpeed, 900); assert.equal(B.last('room').settings.accel, 1e7); A.fire('settings', { accel: 25 });
B.fire('profile', { bg: '#ffffff', shape: 'diamond', name: 'bobby' }); assert.equal(A.last('room').players[1].shape, 'diamond');
B.fire('start'); assert.equal(A.last('room').phase, 'lobby');                // 非オーナーは開始不可
A.fire('start'); assert.equal(A.last('room').phase, 'ready');
for (let i = 0; i < 5; i++) L.tick(); assert.equal(A.last('state').ph, 'ready'); assert.equal(A.last('state').sv, 0);
B.fire('serve'); L.tick(); assert.equal(A.last('state').ph, 'ready');         // 発射側以外は発射できない
A.fire('serve'); L.tick(); L.tick(); assert.equal(B.last('state').ph, 'playing');
A.fire('paddle', 9999); L.tick(); assert(A.last('state').pd[0] <= 600);
B.fire('endmatch'); assert(['ready', 'playing'].includes(A.last('room').phase));            // 非オーナーは終了不可
A.fire('endmatch'); assert.equal(A.last('room').phase, 'ended'); assert.equal(A.last('room').result.winner, -1);
// 切断→同じtokenで再接続
B.fire('disconnect'); assert.equal(A.last('room').players[1].connected, false);
const B2 = fake('b2'); L.attach(B2); B2.fire('join', { id, name: 'bobby', token: 'tb' });
assert.equal(B2.last('joined').idx, 1); assert.equal(A.last('room').players[1].connected, true);
// 非オーナー退室→席が空く、オーナー退室→ルーム終了
B2.fire('leave'); assert.equal(A.last('room').players.length, 1); assert.equal(A.last('room').phase, 'lobby');
A.fire('leave'); assert.equal(L.rooms.size, 0);
// Unity用の電文
const room = wire.encode('room', { id: 'X', result: null, players: [] }); assert.equal(room.split('|')[0], 'room'); assert.equal(JSON.parse(room.split('|')[1]).winner, -2);
const stt = JSON.parse(wire.encode('state', { b: [[1, 2, 3, 4], [5, 6, 7, 8]], ev: [] }).split('|')[1]); assert.deepEqual(stt.b, [1, 2, 3, 4, 5, 6, 7, 8]);
assert.deepEqual(wire.decode('settings|{"barW":20}'), { e: 'settings', d: { barW: 20 } }); assert.deepEqual(wire.decode('start|{}'), { e: 'start', d: {} });
assert.equal(wire.decode('paddle|123.4').d, 123.4); assert.equal(wire.decode('garbage'), null);
console.log('LOBBY TESTS PASSED');
