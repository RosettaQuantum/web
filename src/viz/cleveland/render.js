// ------------------------------------------------------------------ idioma
// El idioma sale de <html lang>. Las dos caras se mantienen juntas o ninguna:
// una pagina bilingue con media tabla en el otro idioma miente por omision y no
// se nota revisando la otra mitad.
const L = (document.documentElement.lang || 'es').slice(0,2) === 'en' ? 'en' : 'es';
const T = {
 es:{
  residuos:'residuos', percentiles:'percentiles',
  ventaja:(n,pos)=>`ventaja cuántica sobre difusión clásica, promediada sobre las ${n} celdas de la rejilla congelada. Positiva en ${pos}/${n}. Contra el null de bolsillos contiguos:`,
  signif:'significativa', noSignif:'no significativa',
  nullTit:'Contra el null correcto',
  thMetodo:'método', thObs:'obs', thNull:'null', thZi:'z ingenuo', thZr:'z real', thP:'p',
  nullNota:'"z ingenuo" supone residuos independientes, que es lo que hace implícitamente la literatura. "z real" compara contra bolsillos <i>contiguos</i> del mismo tamaño. La diferencia entre ambas columnas es el tamaño del espejismo.',
  ruidoTit:'Resiliencia al ruido',
  thCanal:'canal', thMagnitud:'magnitud', thPercentil:'percentil',
  desfase:'desfase cuántico', coords:'coordenadas', aristasPerdidas:'contactos perdidos',
  ruidoNota:'El ranking aguanta el ruido <i>cuántico</i> mucho mejor que el ruido <i>estructural</i>. El cuello de botella no es el hardware: es la estructura de entrada.',
  escalaTit:'Escalabilidad por grano grueso',
  thBloque:'bloque', thSuper:'super-nodos', thAcel:'aceleración',
  costoTit:'Costo de circuito medido',
  cQubits:'qubits (codificación binaria)', cAristas:'aristas del grafo', cGrado:'grado máximo',
  cColor:'clases de color (capas por paso)', cTrotter:'pasos de Trotter para rango fiel',
  cProf:'profundidad total (capas 2q)',
  costoNota:'La profundidad se midió, no se citó: es el número de pasos de Trotter con el que el <i>ranking</i> converge (Spearman &ge; 0.99), no el estado.',
  sitiosTit:n=>`Top-${n} ${n===1?'sitio predicho':'sitios predichos'} (caminata cuántica)`,
  thResiduos:'residuos',
  // ETIQUETAS DE HONESTIDAD — aprobadas por Nicholas el 9-ago-2026
  predichoAviso:'<b>Predicho por caminata cuántica — no validado experimentalmente.</b> Es una hipótesis notarizada, no un hallazgo confirmado en laboratorio.',
  topNAviso:n=>`Se muestran los ${n} que superan el umbral, no un top-5 fijo.`,
  sinVerdad:'sin sitio alostérico conocido',
  sinVerdadNota:'<b>Sin sitio alostérico conocido publicado: acá no hay contra qué comparar.</b> El reto declara que esta diana se evalúa por consenso entre equipos. Esta predicción queda sellada y fechada <b>antes</b> de que ese consenso exista.',
 },
 en:{
  residuos:'residues', percentiles:'percentiles',
  ventaja:(n,pos)=>`quantum advantage over classical diffusion, averaged over the ${n} cells of the frozen grid. Positive in ${pos}/${n}. Against the contiguous-pocket null:`,
  signif:'significant', noSignif:'not significant',
  nullTit:'Against the correct null',
  thMetodo:'method', thObs:'obs', thNull:'null', thZi:'naive z', thZr:'real z', thP:'p',
  nullNota:'"Naive z" assumes independent residues, which is what the literature implicitly does. "Real z" compares against <i>contiguous</i> pockets of the same size. The gap between the two columns is the size of the mirage.',
  ruidoTit:'Noise resilience',
  thCanal:'channel', thMagnitud:'magnitude', thPercentil:'percentile',
  desfase:'quantum dephasing', coords:'coordinates', aristasPerdidas:'lost contacts',
  ruidoNota:'The ranking withstands <i>quantum</i> noise far better than <i>structural</i> noise. The bottleneck is not the hardware: it is the input structure.',
  escalaTit:'Scalability by coarse graining',
  thBloque:'block', thSuper:'super-nodes', thAcel:'speed-up',
  costoTit:'Measured circuit cost',
  cQubits:'qubits (binary encoding)', cAristas:'graph edges', cGrado:'maximum degree',
  cColor:'colour classes (layers per step)', cTrotter:'Trotter steps for a faithful ranking',
  cProf:'total depth (2q layers)',
  costoNota:'The depth was measured, not cited: it is the number of Trotter steps at which the <i>ranking</i> converges (Spearman &ge; 0.99), not the state.',
  sitiosTit:n=>`Top-${n} predicted ${n===1?'site':'sites'} (quantum walk)`,
  thResiduos:'residues',
  predichoAviso:'<b>Predicted by quantum walk — not experimentally validated.</b> This is a notarised hypothesis, not a finding confirmed in a laboratory.',
  topNAviso:n=>`Showing the ${n} above threshold, not a fixed top-5.`,
  sinVerdad:'no known allosteric site',
  sinVerdadNota:'<b>No published known allosteric site: there is nothing here to compare against.</b> The challenge states that this target is evaluated by consensus among teams. This prediction is sealed and dated <b>before</b> that consensus exists.',
 },
}[L];

// ST se declara aparte: antes venia pegado a DATA en la misma sentencia y al
// insertar el diccionario entre los dos, el ", ST=" quedaba huerfano.
let ST=__RQ_STATS__;
// El rotulo sigue al idioma de la pagina; si falta la cara EN se cae al ES antes
// que mostrar vacio.
function rotulo(D){ return (L==='en' && D.label_en) ? D.label_en : D.label; }

function arrancar(){
const keys=Object.keys(DATA);
const sel=document.getElementById('t');
keys.forEach(k=>{const o=document.createElement('option');o.value=k;o.textContent=rotulo(DATA[k]);sel.appendChild(o)});
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
 h.push(`<h2>${rotulo(D)} · ${D.n} ${T.residuos}</h2>`);
 if(S.pair){
  const p=S.pair, cls=p.delta>0?'pos':'neg';
  h.push(`<div class="big ${cls}">${p.delta>0?'+':''}${p.delta} <span class="mu" style="font-size:13px;font-weight:400">${T.percentiles}</span></div>
   <div class="note">${T.ventaja(p.n,p.pos)}
   z = ${p.z}, p = ${p.p} &rarr; <b>${p.p<0.05?T.signif:T.noSignif}</b>.</div>`);
 }
 if(S.null){
  h.push(`<h2>${T.nullTit}</h2><table><tr><th>${T.thMetodo}</th><th>${T.thObs}</th><th>${T.thNull}</th><th>${T.thZi}</th><th>${T.thZr}</th><th>${T.thP}</th></tr>`);
  for(const m in S.null){const x=S.null[m];
   h.push(`<tr><td>${m}</td><td>${x.percentil_observado}</td><td>${x.null_media}&plusmn;${x.null_sd}</td>
   <td class="mu">${x.z_aparente_si_iid}</td><td>${x.z_real_contiguo}</td><td>${x.p_mejor_que_azar}</td></tr>`)}
  h.push(`</table><div class="note">${T.nullNota}</div>`);
 }
 if(S.req){
  const R=S.req;
  h.push(`<h2>${T.ruidoTit}</h2><table><tr><th>${T.thCanal}</th><th>${T.thMagnitud}</th><th>Spearman</th><th>${T.thPercentil}</th></tr>`);
  R.desfase_hardware.forEach(x=>h.push(`<tr><td>${T.desfase}</td><td>&gamma;=${x.gamma}</td><td>${x.spearman_vs_ideal}</td><td>${x.percentil}</td></tr>`));
  R.ruido_coordenadas.forEach(x=>h.push(`<tr><td>${T.coords}</td><td>&sigma;=${x.sigma_A} A</td><td>${x.spearman_medio}</td><td>${x.percentil_medio}</td></tr>`));
  R.perdida_aristas.forEach(x=>h.push(`<tr><td>${T.aristasPerdidas}</td><td>${(x.p*100).toFixed(0)}%</td><td>${x.spearman_medio}</td><td>${x.percentil_medio}</td></tr>`));
  h.push(`</table><div class="note">${T.ruidoNota}</div>`);
  h.push(`<h2>${T.escalaTit}</h2><table><tr><th>${T.thBloque}</th><th>${T.thSuper}</th><th>${T.thPercentil}</th><th>${T.thAcel}</th></tr>`);
  R.coarse_graining.forEach(x=>h.push(`<tr><td>${x.bloque}</td><td>${x.n_supernodos}</td><td>${x.percentil}</td><td>${x.aceleracion}&times;</td></tr>`));
  h.push('</table>');
  const c=R.circuito;
  h.push(`<h2>${T.costoTit}</h2><table>
   <tr><td>${T.cQubits}</td><td>${c.qubits_codificacion_binaria}</td></tr>
   <tr><td>${T.cAristas}</td><td>${c.aristas}</td></tr>
   <tr><td>${T.cGrado}</td><td>${c.grado_maximo}</td></tr>
   <tr><td>${T.cColor}</td><td>${c.clases_de_color}</td></tr>
   <tr><td>${T.cTrotter}</td><td>${c.r_para_spearman_099}</td></tr>
   <tr><td>${T.cProf}</td><td>${c.profundidad_total_2q}</td></tr>
   </table><div class="note">${T.costoNota}</div>`);
 }
 // El encabezado decia "Top-5" siempre, y KRAS G12C trae 2. Ahora el numero sale
 // del dato y la nota lo explica: alcance declarado = alcance real.
 h.push(`<h2>${T.sitiosTit(D.sites.length)}</h2>`);
 h.push(`<div class="aviso">${T.predichoAviso} ${T.topNAviso(D.sites.length)}</div>`);
 h.push(`<table><tr><th>#</th><th>${T.thResiduos}</th><th>n</th></tr>`);
 D.sites.forEach((s,i)=>h.push(`<tr><td>${i+1}</td><td class="mu">${s.residues.slice(0,6).map(r=>r[1]).join(', ')}${s.residues.length>6?'…':''}</td><td>${s.n_residues}</td></tr>`));
 h.push('</table>');
 if(!D.allo.length) h.push(`<div class="aviso"><span class="pill">${T.sinVerdad}</span>${T.sinVerdadNota}</div>`);
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
} // fin arrancar()

// ---------------------------------------------------------------- datos por API
// Los 100 KB de datos NO viajan horneados en el HTML: la pagina pesa ~12 KB y los
// pide a /v1/challenges/{corrida}. Asi el dato se cachea aparte, se puede leer sin
// parsear una pagina, y publicar un challenge nuevo es un INSERT.
(async function(){
  const cont = document.getElementById('p');
  const corrida = document.body.dataset.corrida || 'cleveland-2026-07';
  const esES = L === 'es';
  cont.innerHTML = `<div class="note">${esES?'Cargando la corrida…':'Loading the run…'}</div>`;
  try {
    const r = await fetch('/v1/challenges/' + corrida);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    // Se reconstruyen las dos formas que el render ya sabe leer, sin tocar su logica.
    for (const [k, p] of Object.entries(j.proteinas)) {
      DATA[k] = p.datos; DATA[k].label_en = p.label_en; ST[k] = p.estadistica || {};
    }
    if (!Object.keys(DATA).length) throw new Error('la corrida no trae proteinas');
    arrancar();
  } catch (e) {
    // Un fallo mudo aca seria una pagina que dice tener la corrida y no la tiene.
    cont.innerHTML = `<div class="aviso"><b>${esES?'No se pudo cargar la corrida.':'The run could not be loaded.'}</b> ` +
      `${esES?'Los datos siguen disponibles en':'The data is still available at'} ` +
      `<a href="/v1/challenges/${corrida}" style="color:var(--ac)">/v1/challenges/${corrida}</a>. ` +
      `<span class="mu">(${e.message})</span></div>`;
  }
})();
