, ST=__RQ_STATS__;
const keys=Object.keys(DATA);
const sel=document.getElementById('t');
keys.forEach(k=>{const o=document.createElement('option');o.value=k;o.textContent=DATA[k].label;sel.appendChild(o)});
let cur=keys[0], mode='ctqw', showSite=true, showPred=true, spin=true;
let rx=0.3, ry=0.6, drag=null, zoom=1;

const cv=document.getElementById('c'), cx=cv.getContext('2d');
function ramp(v){ // 0..1 -> color
 const s=[[43,31,82],[43,110,168],[37,165,138],[168,201,58],[249,224,75]];
 const x=Math.max(0,Math.min(1,v))*(s.length-1), i=Math.floor(x), f=x-i;
 const a=s[i], b=s[Math.min(i+1,s.length-1)];
 return `rgb(${a[0]+(b[0]-a[0])*f|0},${a[1]+(b[1]-a[1])*f|0},${a[2]+(b[2]-a[2])*f|0})`;
}
function ranks(v,distal){ // percentil dentro de los distales
 const idx=[];for(let i=0;i<v.length;i++)if(distal[i])idx.push(i);
 idx.sort((a,b)=>v[b]-v[a]);
 const r=new Array(v.length).fill(null);
 idx.forEach((id,k)=>r[id]=1-k/Math.max(idx.length-1,1));
 return r;
}
function draw(){
 const D=DATA[cur], N=D.n, W=cv.width=cv.clientWidth*devicePixelRatio,
       H=cv.height=cv.clientHeight*devicePixelRatio;
 cx.clearRect(0,0,W,H);
 const co=D.coords, v=D[mode==='ctqw'?'ctqw':'diff'], pr=ranks(v,D.distal);
 let cxm=0,cym=0,czm=0; for(const p of co){cxm+=p[0];cym+=p[1];czm+=p[2]}
 cxm/=N;cym/=N;czm/=N;
 const ca=Math.cos(rx),sa=Math.sin(rx),cb=Math.cos(ry),sb=Math.sin(ry);
 const pts=[];let rad=1;
 for(let i=0;i<N;i++){
  let x=co[i][0]-cxm,y=co[i][1]-cym,z=co[i][2]-czm;
  let y2=y*ca-z*sa, z2=y*sa+z*ca;
  let x2=x*cb+z2*sb, z3=-x*sb+z2*cb;
  pts.push([x2,y2,z3]); rad=Math.max(rad,Math.hypot(x2,y2));
 }
 const S=Math.min(W,H)/(2.35*rad)*zoom, ox=W/2, oy=H/2;
 const site=new Set(D.allo), src=new Set(D.src);
 const pred=new Set(); if(showPred) D.sites.forEach(s=>s.residues.forEach(r=>{
   const j=D.resnum.indexOf(r[1]); if(j>=0)pred.add(j)}));
 const ord=pts.map((p,i)=>i).sort((a,b)=>pts[a][2]-pts[b][2]);
 // traza de la cadena, segmento a segmento con profundidad
 const K=Math.max(1.0,Math.min(2.6,900/N));
 cx.lineCap='round';
 for(let i=1;i<N;i++){
  const a=pts[i-1],b=pts[i];
  if(Math.hypot(co[i][0]-co[i-1][0],co[i][1]-co[i-1][1],co[i][2]-co[i-1][2])>4.6)continue;
  const dep=((a[2]+b[2])/2/rad+1)/2;
  cx.globalAlpha=0.10+0.34*dep;
  cx.strokeStyle='#9fb4cc';
  cx.lineWidth=(1.0+2.2*dep)*K*devicePixelRatio;
  cx.beginPath();cx.moveTo(ox+a[0]*S,oy-a[1]*S);cx.lineTo(ox+b[0]*S,oy-b[1]*S);cx.stroke();
 }
 for(const i of ord){
  const p=pts[i], X=ox+p[0]*S, Y=oy-p[1]*S;
  const dep=(p[2]/rad+1)/2;
  let r=2.9*K*devicePixelRatio*(0.62+0.55*dep), col;
  if(src.has(i)){col='#97a4b2'; r*=1.3}
  else if(pr[i]===null){col='#5d6b7d'}
  else {col=ramp(pr[i]); if(pred.has(i))r*=1.55}
  cx.globalAlpha=0.42+0.58*dep;
  cx.beginPath();cx.arc(X,Y,r,0,7);cx.fillStyle=col;cx.fill();
  if(pred.has(i)&&!src.has(i)){
   cx.globalAlpha=0.30+0.35*dep;cx.lineWidth=1.1*devicePixelRatio;cx.strokeStyle='#f9e04b';
   cx.beginPath();cx.arc(X,Y,r+1.4*devicePixelRatio,0,7);cx.stroke();
  }
  if(showSite&&site.has(i)){
   cx.globalAlpha=0.55+0.45*dep;cx.lineWidth=1.9*devicePixelRatio;cx.strokeStyle='#e5484d';
   cx.beginPath();cx.arc(X,Y,r+2.6*K*devicePixelRatio,0,7);cx.stroke();
  }
 }
 cx.globalAlpha=1;
}
function panel(){
 const D=DATA[cur], S=ST[cur]||{}, h=[];
 h.push(`<h2>${D.label} · ${D.n} residuos</h2>`);
 if(S.pair){
  const p=S.pair, cls=p.delta>0?'pos':'neg';
  h.push(`<div class="big ${cls}">${p.delta>0?'+':''}${p.delta} <span class="mu" style="font-size:13px;font-weight:400">percentiles</span></div>
   <div class="note">ventaja cuántica sobre difusión clásica, promediada sobre las ${p.n} celdas
   de la rejilla congelada. Positiva en ${p.pos}/${p.n}. Contra el null de bolsillos contiguos:
   z = ${p.z}, p = ${p.p} &rarr; <b>${p.p<0.05?'significativa':'no significativa'}</b>.</div>`);
 }
 if(S.null){
  h.push('<h2>Contra el null correcto</h2><table><tr><th>método</th><th>obs</th><th>null</th><th>z ingenuo</th><th>z real</th><th>p</th></tr>');
  for(const m in S.null){const x=S.null[m];
   h.push(`<tr><td>${m}</td><td>${x.percentil_observado}</td><td>${x.null_media}&plusmn;${x.null_sd}</td>
   <td class="mu">${x.z_aparente_si_iid}</td><td>${x.z_real_contiguo}</td><td>${x.p_mejor_que_azar}</td></tr>`)}
  h.push('</table><div class="note">"z ingenuo" supone residuos independientes, que es lo que hace implícitamente la literatura. "z real" compara contra bolsillos <i>contiguos</i> del mismo tamaño. La diferencia entre ambas columnas es el tamaño del espejismo.</div>');
 }
 if(S.req){
  const R=S.req;
  h.push('<h2>Resiliencia al ruido</h2><table><tr><th>canal</th><th>magnitud</th><th>Spearman</th><th>percentil</th></tr>');
  R.desfase_hardware.forEach(x=>h.push(`<tr><td>desfase cuántico</td><td>&gamma;=${x.gamma}</td><td>${x.spearman_vs_ideal}</td><td>${x.percentil}</td></tr>`));
  R.ruido_coordenadas.forEach(x=>h.push(`<tr><td>coordenadas</td><td>&sigma;=${x.sigma_A} A</td><td>${x.spearman_medio}</td><td>${x.percentil_medio}</td></tr>`));
  R.perdida_aristas.forEach(x=>h.push(`<tr><td>contactos perdidos</td><td>${(x.p*100).toFixed(0)}%</td><td>${x.spearman_medio}</td><td>${x.percentil_medio}</td></tr>`));
  h.push('</table><div class="note">El ranking aguanta el ruido <i>cuántico</i> mucho mejor que el ruido <i>estructural</i>. El cuello de botella no es el hardware: es la estructura de entrada.</div>');
  h.push('<h2>Escalabilidad por grano grueso</h2><table><tr><th>bloque</th><th>super-nodos</th><th>percentil</th><th>aceleración</th></tr>');
  R.coarse_graining.forEach(x=>h.push(`<tr><td>${x.bloque}</td><td>${x.n_supernodos}</td><td>${x.percentil}</td><td>${x.aceleracion}&times;</td></tr>`));
  h.push('</table>');
  const c=R.circuito;
  h.push(`<h2>Costo de circuito medido</h2><table>
   <tr><td>qubits (codificación binaria)</td><td>${c.qubits_codificacion_binaria}</td></tr>
   <tr><td>aristas del grafo</td><td>${c.aristas}</td></tr>
   <tr><td>grado máximo</td><td>${c.grado_maximo}</td></tr>
   <tr><td>clases de color (capas por paso)</td><td>${c.clases_de_color}</td></tr>
   <tr><td>pasos de Trotter para rango fiel</td><td>${c.r_para_spearman_099}</td></tr>
   <tr><td>profundidad total (capas 2q)</td><td>${c.profundidad_total_2q}</td></tr>
   </table><div class="note">La profundidad se midio, no se cito: es el número de pasos de Trotter
   con el que el <i>ranking</i> converge (Spearman &ge; 0.99), no el estado.</div>`);
 }
 h.push('<h2>Top-5 sitios predichos (caminata cuántica)</h2><table><tr><th>#</th><th>residuos</th><th>n</th></tr>');
 D.sites.forEach((s,i)=>h.push(`<tr><td>${i+1}</td><td class="mu">${s.residues.slice(0,6).map(r=>r[1]).join(', ')}${s.residues.length>6?'…':''}</td><td>${s.n_residues}</td></tr>`));
 h.push('</table>');
 if(!D.allo.length) h.push('<div class="note"><span class="pill">sin verdad de referencia</span>El reto declara que esta diana se evalúa por consenso entre equipos. Esta predicción queda sellada y fechada <b>antes</b> de que ese consenso exista.</div>');
 document.getElementById('p').innerHTML=h.join('');
}
sel.onchange=e=>{cur=e.target.value;panel();draw()};
function tog(id,f){const b=document.getElementById(id);b.onclick=()=>{f();draw();
  b.classList.toggle('on')}}
document.getElementById('mq').onclick=()=>{mode='ctqw';
 document.getElementById('mq').classList.add('on');document.getElementById('md').classList.remove('on');draw()};
document.getElementById('md').onclick=()=>{mode='diff';
 document.getElementById('md').classList.add('on');document.getElementById('mq').classList.remove('on');draw()};
tog('ms',()=>showSite=!showSite); tog('mp',()=>showPred=!showPred);
tog('spin',()=>spin=!spin);
cv.onmousedown=e=>drag=[e.clientX,e.clientY];
addEventListener('mouseup',()=>drag=null);
addEventListener('mousemove',e=>{if(!drag)return;
 ry+=(e.clientX-drag[0])*0.008; rx+=(e.clientY-drag[1])*0.008; drag=[e.clientX,e.clientY]; draw()});
cv.onwheel=e=>{e.preventDefault();zoom*=e.deltaY>0?0.92:1.08;draw()};
addEventListener('resize',draw);
(function loop(){ if(spin&&!drag){ry+=0.0035;draw()} requestAnimationFrame(loop)})();
panel();draw();
