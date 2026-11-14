const socket = io();
const $ = id => document.getElementById(id);
const lobby = $("lobby"), game = $("game"), canvas = $("arena"), ctx = canvas.getContext("2d");
let myIndex = 0, state = null, joined = false, lastMove = 0, pointerY = 260;

function message(t){ $("lobbyMessage").textContent = t; }
function enterGame(data){
  myIndex = data.index; joined = true;
  $("activeCode").textContent = data.code;
  lobby.classList.add("hidden"); game.classList.remove("hidden");
  $("overlay").textContent = myIndex === 0 ? "対戦相手を待っています…" : "";
  $("playerLabels").textContent = `${$("playerName").value || "YOU"}　VS　OPPONENT`;
}
$("createBtn").onclick = () => socket.emit("createRoom",{name:$("playerName").value});
$("joinBtn").onclick = () => socket.emit("joinRoom",{code:$("roomCode").value,name:$("playerName").value});
$("copyBtn").onclick = async () => {
  try { await navigator.clipboard.writeText($("activeCode").textContent); $("copyBtn").textContent="コピーしました"; }
  catch { $("copyBtn").textContent="コード: "+$("activeCode").textContent; }
};
$("leaveBtn").onclick = () => location.reload();
socket.on("joined", enterGame);
socket.on("errorMessage", message);
socket.on("state", s => {
  state = s;
  $("score").textContent = `${s.score[myIndex]} : ${s.score[1-myIndex]}`;
  $("status").textContent = s.players.length < 2 ? "対戦相手を待っています" : "ONLINE MATCH";
  if(s.players.length === 2 && s.ball.vx !== 0) $("overlay").textContent = "";
  else if(s.players.length < 2) $("overlay").textContent = "対戦相手を待っています…";
  else if(s.countdown > 0) $("overlay").textContent = "NEXT ROUND";
  else $("overlay").textContent = "タップ / SPACE でスタート";
});
socket.on("opponentLeft", () => {
  $("overlay").textContent = "相手が退出しました";
  $("status").textContent = "対戦相手が退出";
});
socket.on("connect_error", () => message("サーバーに接続できません。時間をおいて再読み込みしてください。"));

function sendMove(y){
  if(!joined) return;
  const now = performance.now();
  if(now-lastMove > 25){ socket.emit("move", y); lastMove=now; }
}
function canvasY(clientY){
  const r=canvas.getBoundingClientRect();
  return (clientY-r.top)*canvas.height/r.height;
}
canvas.addEventListener("pointermove", e => sendMove(canvasY(e.clientY)));
canvas.addEventListener("pointerdown", e => { sendMove(canvasY(e.clientY)); socket.emit("launch"); });
window.addEventListener("keydown", e => {
  if(e.code==="Space"){e.preventDefault();socket.emit("launch");}
  if(e.code==="ArrowUp"||e.code==="ArrowDown"){
    e.preventDefault(); pointerY += e.code==="ArrowUp"?-28:28; sendMove(pointerY);
  }
});

function draw(){
  const w=canvas.width,h=canvas.height;
  ctx.clearRect(0,0,w,h);
  const grad=ctx.createLinearGradient(0,0,w,h);grad.addColorStop(0,"#0c1b31");grad.addColorStop(1,"#071222");ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);
  ctx.strokeStyle="#263b59";ctx.setLineDash([9,12]);ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(w/2,0);ctx.lineTo(w/2,h);ctx.stroke();ctx.setLineDash([]);
  // subtle court markings
  ctx.strokeStyle="#1c304b";ctx.lineWidth=2;ctx.strokeRect(16,16,w-32,h-32);
  if(state){
    const ys=state.paddles;
    drawPaddle(34,ys[0],"#55e6dc");drawPaddle(w-34,ys[1],"#ff668d");
    const b=state.ball;
    ctx.shadowBlur=22;ctx.shadowColor="#fff";ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(b.x,b.y,11,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    if(state.players.length===2){
      ctx.fillStyle="#7188a8";ctx.font="12px sans-serif";ctx.textAlign="center";
      ctx.fillText(state.players[0].name,w*.25,30);ctx.fillText(state.players[1].name,w*.75,30);
    }
  } else {
    ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(w/2,h/2,11,0,Math.PI*2);ctx.fill();
  }
  requestAnimationFrame(draw);
}
function drawPaddle(x,y,color){
  ctx.shadowBlur=18;ctx.shadowColor=color;ctx.fillStyle=color;
  ctx.beginPath();ctx.roundRect(x-7,y-50,14,100,7);ctx.fill();ctx.shadowBlur=0;
}
draw();
