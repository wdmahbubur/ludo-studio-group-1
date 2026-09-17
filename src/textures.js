import { PLAYERS, TRACK, SAFE, LANES, YARDS } from './rules.js';
const THREE = globalThis.THREE;
export const THEMES = [
  { name: 'Porcelain', note: 'Soft color · glazed ceramic', background: '#f6f1e7', cell: '#fffdf6', ink: '#526078', line: '#d9d5cd', colors: ['#df7276','#62b69a','#eec45c','#76a4dc'], inner: '#fffdf5', frame: '#ede4d2' },
  { name: 'Midnight', note: 'Deep navy · jewel tones', background: '#223148', cell: '#e5eaf0', ink: '#33425c', line: '#b0bfd0', colors: ['#e86478','#46b79f','#e8b858','#588fda'], inner: '#dce4ec', frame: '#253249' },
  { name: 'Walnut', note: 'Warm grain · handcrafted feel', background: '#916445', cell: '#f4e3c5', ink: '#674b36', line: '#c4ab88', colors: ['#c4695c','#759b72','#d8aa54','#789bb6'], inner: '#f3dfbb', frame: '#76553e' }
];
function canvas(size) {
  const result = document.createElement('canvas'); result.width = result.height = size; return result;
}
function rounded(ctx, x,y,w,h,r, fill, stroke) {
  ctx.beginPath(); ctx.roundRect(x,y,w,h,r); if (fill) { ctx.fillStyle=fill;ctx.fill(); }
  if (stroke) { ctx.strokeStyle=stroke;ctx.stroke(); }
}
function star(ctx,x,y,r,color) {
  ctx.beginPath();
  for(let k=0;k<10;k++){const a=k*Math.PI/5-Math.PI/2;const d=k%2?r*.45:r;ctx.lineTo(x+Math.cos(a)*d,y+Math.sin(a)*d);}
  ctx.closePath();ctx.fillStyle=color;ctx.fill();
}
function randomGenerator(seed=71) {return () => {seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
function makeTexture(c, encoded=true) {
  const t=new THREE.CanvasTexture(c);
  t.encoding=encoded?THREE.sRGBEncoding:THREE.LinearEncoding;
  t.anisotropy=4;
  return t;
}
export function boardTexture(index) {
  const t=THEMES[index], c=canvas(1024), ctx=c.getContext('2d'), u=c.width/15;
  ctx.fillStyle=t.background;ctx.fillRect(0,0,c.width,c.height);
  const origins=[[0,0],[9,0],[9,9],[0,9]];
  origins.forEach(([x,y],p)=>{
    ctx.lineWidth=u*.018;
    rounded(ctx,(x+.12)*u,(y+.12)*u,5.76*u,5.76*u,u*.18,t.colors[p]);
    rounded(ctx,(x+.65)*u,(y+.65)*u,4.7*u,4.7*u,u*.28,t.inner);
    ctx.fillStyle=t.colors[p];ctx.font=`700 ${u*.18}px Arial`;ctx.textAlign='center';
    ctx.fillText(PLAYERS[p].name.toUpperCase(),(x+3)*u,(y+.43)*u);
    YARDS[p].forEach(([col,row],i)=>{
      ctx.beginPath();ctx.arc((col+.5)*u,(row+.5)*u,u*.55,0,Math.PI*2);
      ctx.fillStyle=t.colors[p];ctx.globalAlpha=.2;ctx.fill();ctx.globalAlpha=1;
      ctx.strokeStyle=t.colors[p];ctx.lineWidth=u*.045;ctx.stroke();
      ctx.fillStyle=t.colors[p];ctx.font=`600 ${u*.23}px Arial`;ctx.fillText(String(i+1),(col+.5)*u,(row+.58)*u);
    });
  });
  const cell=(x,y,color)=>{ctx.fillStyle=color;ctx.fillRect(x*u,y*u,u,u);ctx.strokeStyle=t.line;ctx.lineWidth=u*.025;ctx.strokeRect(x*u,y*u,u,u);};
  TRACK.forEach(([x,y],i)=>{
    const player=PLAYERS.findIndex(p=>p.start===i);
    cell(x,y,player>=0?t.colors[player]:t.cell);
    if(SAFE.has(i)) star(ctx,(x+.5)*u,(y+.5)*u,u*.22,player>=0?t.inner:t.ink);
  });
  LANES.forEach((lane,p)=>lane.forEach(([x,y])=>cell(x,y,t.colors[p])));
  const triangles=[[[6,6],[6,9]],[[6,6],[9,6]],[[9,6],[9,9]],[[6,9],[9,9]]];
  triangles.forEach((points,p)=>{ctx.beginPath();ctx.moveTo(7.5*u,7.5*u);points.forEach(([x,y])=>ctx.lineTo(x*u,y*u));ctx.closePath();ctx.fillStyle=t.colors[p];ctx.fill();});
  ctx.beginPath();ctx.arc(7.5*u,7.5*u,u*.28,0,Math.PI*2);ctx.fillStyle=t.inner;ctx.fill();star(ctx,7.5*u,7.5*u,u*.15,t.ink);
  [[.5,7.5,0],[7.5,.5,Math.PI/2],[14.5,7.5,Math.PI],[7.5,14.5,-Math.PI/2]].forEach(([x,y,a],p)=>{
    ctx.save();ctx.translate(x*u,y*u);ctx.rotate(a);ctx.beginPath();ctx.moveTo(-u*.13,-u*.18);ctx.lineTo(u*.10,0);ctx.lineTo(-u*.13,u*.18);ctx.strokeStyle=t.colors[p];ctx.lineWidth=u*.06;ctx.stroke();ctx.restore();
  });
  const rand=randomGenerator(38+index);
  if(index===2){
    ctx.globalAlpha=.07;ctx.strokeStyle='#502a10';
    for(let y=0;y<c.height;y+=4){ctx.beginPath();ctx.moveTo(0,y);for(let x=0;x<=c.width;x+=16)ctx.lineTo(x,y+Math.sin(x*.018+y*.016)*3);ctx.stroke();}ctx.globalAlpha=1;
  }
  for(let i=0;i<7000;i++){ctx.fillStyle=rand()>.5?'rgba(255,255,255,.045)':'rgba(50,40,30,.025)';ctx.fillRect(rand()*1024,rand()*1024,1.2,1.2);}
  ctx.strokeStyle=index===1?'#465873':'#a79982';ctx.lineWidth=5;ctx.strokeRect(2.5,2.5,1019,1019);
  return makeTexture(c,false);
}
export function surfaceTexture(kind='ceramic') {
  const c=canvas(256),ctx=c.getContext('2d'),rand=randomGenerator(20);
  ctx.fillStyle=kind==='wood'?'#d8b58c':kind==='felt'?'#eef0f5':'#f7f7f7';ctx.fillRect(0,0,256,256);
  if(kind==='wood'){
    for(let y=0;y<256;y+=2){ctx.strokeStyle=`rgba(91,55,31,${.035+rand()*.05})`;ctx.beginPath();ctx.moveTo(0,y);for(let x=0;x<=256;x+=8)ctx.lineTo(x,y+Math.sin(x*.025+y*.09)*3);ctx.stroke();}
  }else for(let i=0;i<4500;i++){ctx.fillStyle=rand()>.5?'rgba(255,255,255,.12)':'rgba(55,65,80,.04)';ctx.fillRect(rand()*256,rand()*256,1,1);}
  const tex=makeTexture(c);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;return tex;
}
export function diceTexture(value) {
  const c=canvas(256),ctx=c.getContext('2d');ctx.fillStyle='#fffdf6';ctx.fillRect(0,0,256,256);
  const gradient=ctx.createLinearGradient(0,0,256,256);gradient.addColorStop(0,'rgba(255,255,255,.7)');gradient.addColorStop(1,'rgba(208,196,170,.15)');ctx.fillStyle=gradient;ctx.fillRect(0,0,256,256);
  const layouts={1:[[0,0]],2:[[-1,-1],[1,1]],3:[[-1,-1],[0,0],[1,1]],4:[[-1,-1],[1,-1],[-1,1],[1,1]],5:[[-1,-1],[1,-1],[0,0],[-1,1],[1,1]],6:[[-1,-1],[1,-1],[-1,0],[1,0],[-1,1],[1,1]]};
  for(const [x,y] of layouts[value]){ctx.beginPath();ctx.arc(128+x*58,128+y*58,value===1?25:18,0,Math.PI*2);ctx.fillStyle=value===1?'#cf595e':'#263044';ctx.fill();ctx.beginPath();ctx.arc(125+x*58,125+y*58,6,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,.10)';ctx.fill();}
  return makeTexture(c);
}
export function numberTexture(value) {
  const c=canvas(128),ctx=c.getContext('2d');ctx.beginPath();ctx.arc(64,64,48,0,Math.PI*2);ctx.fillStyle='#fffaf0';ctx.fill();ctx.font='bold 65px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#283248';ctx.fillText(String(value),64,68);return makeTexture(c);
}
