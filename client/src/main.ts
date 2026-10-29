import { MsgType } from '@co-up/shared';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
function resize(){ canvas.width=innerWidth; canvas.height=innerHeight; }
addEventListener('resize',resize); resize();

const ws = new WebSocket(`ws://${location.hostname}:8080/ws`);
ws.onopen = ()=> ws.send(JSON.stringify({ t: MsgType.JOIN, name: 'p' }));

let snap: any = null;
let myId: string|null = null;
ws.onmessage = (e)=>{
  try {
    const m = JSON.parse(e.data);
    if (m.t === MsgType.SNAPSHOT) snap = m;
    if (m.t === MsgType.EVENT && m.kind === 'joined') myId = m.id;
  } catch{}
};

const keys = new Set<string>();
addEventListener('keydown',e=>keys.add(e.code));
addEventListener('keyup',e=>keys.delete(e.code));
let mxv=0,myv=0;
addEventListener('mousemove',e=>{ mxv = e.clientX-innerWidth/2; myv = e.clientY-innerHeight/2; });

const cam = {x:0,y:0};
function loop(){
  let ix=0,iy=0;
  if(keys.has('KeyW')||keys.has('ArrowUp')) iy-=1;
  if(keys.has('KeyS')||keys.has('ArrowDown')) iy+=1;
  if(keys.has('KeyA')||keys.has('ArrowLeft')) ix-=1;
  if(keys.has('KeyD')||keys.has('ArrowRight')) ix+=1;
  const l=Math.hypot(ix,iy)||1; ix/=l; iy/=l;
  if(ws.readyState===WebSocket.OPEN) ws.send(JSON.stringify({t:1,seq:0,mx:ix,my:iy}));
  ctx.fillStyle='#000000'; ctx.fillRect(0,0,canvas.width,canvas.height);
  if(snap && myId){
    const me = snap.players.find((p:any)=>p.id===myId);
    if(me){ cam.x = me.x - canvas.width/2; cam.y = me.y - canvas.height/2; }
  }
  ctx.save(); ctx.translate(-cam.x,-cam.y);
  if(snap){
    ctx.fillStyle='#808080'; ctx.strokeStyle='#000000'; ctx.lineWidth=2;
    for(const w of snap.walls){ ctx.fillRect(w.x,w.y,w.w,w.h); ctx.strokeRect(w.x,w.y,w.w,w.h); }
    for(const p of snap.players){
      const isMe = p.id===myId;
      ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.angle||0);
      ctx.fillStyle = isMe ? '#00ff00' : '#ffffff';
      ctx.beginPath();
      ctx.moveTo(10,0);
      ctx.lineTo(-6,-5);
      ctx.lineTo(-3,0);
      ctx.lineTo(-6,5);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle='#000'; ctx.stroke();
      ctx.restore();
    }
  }
  ctx.restore();
  requestAnimationFrame(loop);
}
loop();
