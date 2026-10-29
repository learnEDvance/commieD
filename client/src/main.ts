import { MsgType, SnapshotMsg } from '@co-up/shared';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
function resize() { canvas.width = innerWidth; canvas.height = innerHeight; }
addEventListener('resize', resize); resize();

const ws = new WebSocket(`ws://${location.hostname}:8080/ws`);
ws.onopen = () => ws.send(JSON.stringify({ t: MsgType.JOIN, name: 'p' }));

let snap: SnapshotMsg | null = null;
ws.onmessage = (e) => { try { const m = JSON.parse(e.data); if (m.t === MsgType.SNAPSHOT) snap = m; } catch {} };

const keys = new Set<string>();
addEventListener('keydown', e => keys.add(e.code));
addEventListener('keyup', e => keys.delete(e.code));

const cam = { x: 0, y: 0 };
let mx=0,my=0,shoot=false;
addEventListener('mousemove', e => { mx = e.clientX - innerWidth/2; my = e.clientY - innerHeight/2; });
addEventListener('mousedown', () => shoot = true);
addEventListener('mouseup', () => shoot = false);

let myId: string | null = null;
ws.addEventListener('message', (e) => {
  try {
    const m = JSON.parse(e.data);
    if (m.t === MsgType.EVENT && m.kind === 'joined') myId = m.id;
  } catch {}
});

function loop() {
  // input
  let ix=0,iy=0;
  if (keys.has('KeyW')||keys.has('ArrowUp')) iy -= 1;
  if (keys.has('KeyS')||keys.has('ArrowDown')) iy += 1;
  if (keys.has('KeyA')||keys.has('ArrowLeft')) ix -= 1;
  if (keys.has('KeyD')||keys.has('ArrowRight')) ix += 1;
  const len = Math.hypot(ix,iy)||1; ix/=len; iy/=len;
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ t: 1, seq: 0, mx: ix, my: iy, shoot, dash: keys.has('ShiftLeft')||keys.has('ShiftRight'), use: keys.has('Space') }));
  }
  // render
  ctx.fillStyle = '#0b0b0b';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  if (snap && myId) {
    const me = snap.players.find(p=>p.id===myId);
    if (me) { cam.x += (me.x - canvas.width/2 - cam.x)*0.1; cam.y += (me.y - canvas.height/2 - cam.y)*0.1; }
  }
  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  if (snap) {
    // connections
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 2;
    for (const t of snap.teams) {
      for (const [a,b] of t.connections||[]) {
        const pa=snap.players.find(p=>p.id===a), pb=snap.players.find(p=>p.id===b);
        if (pa&&pb){ ctx.beginPath(); ctx.moveTo(pa.x,pa.y); ctx.lineTo(pb.x,pb.y); ctx.stroke(); }
      }
    }
    // items triangles
    for (const it of snap.items) {
      ctx.fillStyle = '#ff66ff';
      ctx.beginPath(); ctx.moveTo(it.x,it.y-6); ctx.lineTo(it.x-6,it.y+6); ctx.lineTo(it.x+6,it.y+6); ctx.closePath(); ctx.fill();
    }
    // bullets
    ctx.fillStyle = '#ffff00';
    for (const b of snap.bullets) { ctx.beginPath(); ctx.arc(b.x,b.y,2,0,Math.PI*2); ctx.fill(); }
    // players
    for (const p of snap.players) {
      ctx.fillStyle = p.shieldLeft>0?'#88ffff':'#fff';
      ctx.beginPath(); ctx.arc(p.x,p.y,7,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#fff'; ctx.font='10px sans-serif'; ctx.fillText(p.name, p.x-10, p.y-10);
    }
  }
  ctx.restore();
  requestAnimationFrame(loop);
}
loop();
