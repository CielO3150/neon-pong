'use strict';
// Unity用 WebSocket の電文形式:  イベント名|JSON
// Unity(JsonUtility)で読めるよう、配列の入れ子・null・文字列だけの値を避ける形に整える。
exports.encode = (ev, d) => {
  if (ev === 'state') d = { ...d, b: d.b.flat() };                                  // 弾を [x,y,vx,vy,x,y,...] の平らな配列に
  else if (ev === 'room') { const { result, ...r } = d; d = { ...r, winner: result ? result.winner : -2 }; }   // -2=未決着 -1=引き分け
  else if (ev === 'err') d = { m: d };
  return ev + '|' + JSON.stringify(d === undefined ? {} : d);
};
exports.decode = s => {
  const i = s.indexOf('|'); if (i < 1) return null;
  const t = s.slice(i + 1); let d;
  try { d = t ? JSON.parse(t) : undefined; } catch (e) { return null; }
  return { e: s.slice(0, i), d };
};
