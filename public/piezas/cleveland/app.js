import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';
import * as CW from './caminata.js';

const BASE = 'https://rosettaquantum.com/v1';
const API = BASE + '/challenges/cleveland-2026-07';
const $ = (id) => document.getElementById(id);
const v3 = (hex) => new THREE.Vector3(((hex>>16)&255)/255, ((hex>>8)&255)/255, (hex&255)/255);

// ── las cuatro direcciones ───────────────────────────────────────────────────
// Mismo dato y misma cámara en las cuatro. Lo que cambia es material, paleta y pase.
const LOOKS = [
  {
    id: 'cristal', rot: 'CRISTAL', sub: 'interferencia · vidrio y luz interior',
    paleta: [0x35e8ff, 0xff4fd8, 0x120a26],
    fondoAlto: 0x1b1038, fondoBajo: 0x05030e, niebla: 0x0d0722,
    exposicion: 1.9, bloomF: 1.35, bloomU: 0.34, contorno: 0.25, tinta: 0x1a1030,
    gradSombra: 0x0a0620, gradLuz: 0xf0e8ff, gradMezcla: 0.22, vineta: 0.42, grano: 0.016,
    rampa: [0x101a3a, 0x2f7ad6, 0x9df6ff], acento: 0xff4fd8,
    material: (c) => new THREE.MeshStandardMaterial({ color: c, metalness: 0.25, roughness: 0.22, emissive: 0x0a1428, emissiveIntensity: 0.9 }),
    luces: [[0xa8d8ff, 2.2, 1, 1.1, 1.2], [0xff5fd0, 1.25, -1.3, -0.5, -0.9]], ambiente: 0.75,
  },
  {
    id: 'tinta', rot: 'TINTA', sub: 'lámina impresa · fondo papel, un neón',
    paleta: [0xff2d55, 0x1b1b1f, 0xf2ece0],
    fondoAlto: 0xf4efe4, fondoBajo: 0xe2d8c6, niebla: 0xece4d6,
    exposicion: 1.35, bloomF: 0.10, bloomU: 0.90, contorno: 1.6, tinta: 0x14141a,
    gradSombra: 0x2a2822, gradLuz: 0xfffaf0, gradMezcla: 0.16, vineta: 0.20, grano: 0.030,
    rampa: [0x2b2f2a, 0xd83a5e, 0xff9db0], acento: 0xff2d55,
    material: (c) => new THREE.MeshToonMaterial({ color: c }),
    luces: [[0xffffff, 2.4, 1, 1.3, 1.0], [0xffd9c2, 0.7, -1, -0.4, -0.8]], ambiente: 1.5,
  },
  {
    id: 'plasma', rot: 'PLASMA', sub: 'campo de energía · emisión y niebla',
    paleta: [0xff2d9b, 0xffd166, 0x1a0530],
    fondoAlto: 0x2a0a44, fondoBajo: 0x050a1c, niebla: 0x180633,
    exposicion: 2.1, bloomF: 1.9, bloomU: 0.24, contorno: 0.0, tinta: 0x1a0530,
    gradSombra: 0x140428, gradLuz: 0xfff0d8, gradMezcla: 0.26, vineta: 0.50, grano: 0.020,
    rampa: [0x2a0b3e, 0xc42a7a, 0xffe08a], acento: 0xffd166,
    material: (c) => new THREE.MeshBasicMaterial({ color: c }),
    luces: [[0xffffff, 1.0, 1, 1, 1]], ambiente: 1.0,
  },
  {
    id: 'instrumento', rot: 'INSTRUMENTO', sub: 'precisión · retícula y línea luminosa',
    paleta: [0x7cf8ff, 0xc9a24d, 0x04070a],
    fondoAlto: 0x0a1620, fondoBajo: 0x03070c, niebla: 0x061019,
    exposicion: 1.6, bloomF: 0.75, bloomU: 0.52, contorno: 1.1, tinta: 0x020508,
    gradSombra: 0x02060a, gradLuz: 0xdff6ff, gradMezcla: 0.20, vineta: 0.38, grano: 0.014,
    rampa: [0x0b2430, 0x2b93ad, 0x9ff6ff], acento: 0xc9a24d,
    material: (c) => new THREE.MeshToonMaterial({ color: c }),
    luces: [[0xdff6ff, 2.0, 1, 1.1, 1.3], [0x2b93ad, 0.9, -1, -0.6, -1]], ambiente: 1.1,
  },
];

const estado = { datos: null, claves: [], iProt: 0, girando: true, ang: 0, solo: 'cristal', caminando: true, red: null, walk: null, prob: null, ajuste: null, radio: 60, orbita: 0 };
const escenas = [];

const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);
const camara = new THREE.PerspectiveCamera(40, 1, 0.1, 4000);
const controles = new OrbitControls(camara, renderer.domElement);
controles.enableDamping = true; controles.dampingFactor = 0.07;

// ── pase de look, con todos los mandos por cuadrante ─────────────────────────
const quadGeo = new THREE.PlaneGeometry(2, 2);
const camQuad = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const VERT = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`;
function pasada(frag, uniforms) {
  const e = new THREE.Scene();
  e.add(new THREE.Mesh(quadGeo, new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false })));
  return e;
}
const opc = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
const rtColor = new THREE.WebGLRenderTarget(1, 1, opc);
const rtA = new THREE.WebGLRenderTarget(1, 1, opc);
const rtB = new THREE.WebGLRenderTarget(1, 1, opc);

const uBorron = { tCol: { value: null }, dir: { value: new THREE.Vector2() } };
const eBorron = pasada(`
  uniform sampler2D tCol; uniform vec2 dir; varying vec2 vUv;
  void main(){
    vec3 s = texture2D(tCol,vUv).rgb * 0.2270270;
    s += (texture2D(tCol,vUv+dir*1.3846).rgb + texture2D(tCol,vUv-dir*1.3846).rgb) * 0.3162162;
    s += (texture2D(tCol,vUv+dir*3.2307).rgb + texture2D(tCol,vUv-dir*3.2307).rgb) * 0.0702702;
    gl_FragColor = vec4(s,1.);
  }`, uBorron);

const uFin = {
  tCol:{value:null}, tBorroso:{value:null}, tProf:{value:null},
  res:{value:new THREE.Vector2()}, cerca:{value:0.1}, lejos:{value:4000},
  foco:{value:60}, rango:{value:90}, tiempo:{value:0},
  exposicion:{value:1.6}, bloomF:{value:0.8}, bloomU:{value:0.5},
  contorno:{value:1.0}, tinta:{value:v3(0)},
  fondoAlto:{value:v3(0)}, fondoBajo:{value:v3(0)},
  gradSombra:{value:v3(0)}, gradLuz:{value:v3(0)}, gradMezcla:{value:0.2},
  vineta:{value:0.4}, grano:{value:0.02}, lavado:{value:0.0},
  caja:{value:new THREE.Vector4(0,0,1,1)},          // el cuadrante, en uv
};
const eFin = pasada(`
  uniform sampler2D tCol, tBorroso, tProf;
  uniform vec2 res; uniform float cerca, lejos, foco, rango, tiempo;
  uniform float exposicion, bloomF, bloomU, contorno, gradMezcla, vineta, grano, lavado;
  uniform vec3 tinta, fondoAlto, fondoBajo, gradSombra, gradLuz;
  uniform vec4 caja;
  varying vec2 vUv;
  float zLineal(vec2 uv){
    float d = texture2D(tProf, uv).x; float z = d*2.0-1.0;
    return (2.0*cerca*lejos)/(lejos+cerca-z*(lejos-cerca));
  }
  float lum(vec3 c){ return dot(c, vec3(0.2126,0.7152,0.0722)); }
  float ruido(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
  void main(){
    vec2 px = 1.0/res;
    vec3 col = texture2D(tCol, vUv).rgb;
    vec3 bor = texture2D(tBorroso, vUv).rgb;
    float z = zLineal(vUv);
    vec2 q = (vUv - caja.xy)/caja.zw - 0.5;          // coordenadas dentro del cuadrante
    float esFondo = step(lejos*0.85, z);

    col = mix(col, bor, clamp(abs(z-foco)/rango, 0.0, 1.0)*0.42);
    col += bor * smoothstep(bloomU, bloomU+0.30, lum(bor)) * bloomF;

    float d = 0.0;
    d = max(d, abs(zLineal(vUv+vec2(px.x,0.))-z));
    d = max(d, abs(zLineal(vUv-vec2(px.x,0.))-z));
    d = max(d, abs(zLineal(vUv+vec2(0.,px.y))-z));
    d = max(d, abs(zLineal(vUv-vec2(0.,px.y))-z));
    float borde = smoothstep(0.10, 0.55, d/max(z*0.02,0.05));
    col = mix(col, tinta, borde*contorno);

    col *= exposicion;
    col = col/(col+vec3(0.92)) * 1.52;
    col = pow(clamp(col,0.0,1.0), vec3(0.86));
    col = mix(col, mix(gradSombra, gradLuz, col), gradMezcla);
    col = (col-0.44)*1.22 + 0.48;
    col = max(col, vec3(0.0));

    vec3 fondo = mix(fondoBajo, fondoAlto, smoothstep(0.0,1.0,(vUv.y-caja.y)/caja.w));
    fondo += (fondoAlto-fondoBajo)*0.5 * (1.0 - clamp(length(q)*1.5, 0.0, 1.0));
    // lavado: el papel se ensombrece alrededor del objeto, y el objeto deja de flotar
    fondo *= 1.0 - lavado * (1.0 - smoothstep(0.10, 0.46, length(q)));
    col = mix(col, fondo, esFondo);

    col *= 1.0 - dot(q,q)*vineta;
    col += (ruido(vUv*res + tiempo)-0.5)*grano;
    gl_FragColor = vec4(col, 1.0);
  }`, uFin);

function redimensionar() {
  const w = innerWidth, h = innerHeight - 46, dpr = renderer.getPixelRatio();
  renderer.setSize(w, h);
  renderer.domElement.style.top = '0px';
  const W = Math.max(2, Math.floor(w*dpr)), H = Math.max(2, Math.floor(h*dpr));
  if (rtColor.depthTexture) rtColor.depthTexture.dispose();
  const prof = new THREE.DepthTexture(W, H); prof.type = THREE.UnsignedIntType;
  rtColor.depthTexture = prof;
  rtColor.setSize(W, H);
  rtA.setSize(Math.max(2, W>>2), Math.max(2, H>>2));
  rtB.setSize(Math.max(2, W>>2), Math.max(2, H>>2));
  uFin.res.value.set(W, H);
  camara.aspect = (w/2)/(h/2); camara.updateProjectionMatrix();
  colocarEtiquetas();
}
addEventListener('resize', redimensionar);

// ── la escena, cuatro veces ─────────────────────────────────────────────────
function rampaDe(look, t) {
  const a = new THREE.Color(look.rampa[0]), b = new THREE.Color(look.rampa[1]), c = new THREE.Color(look.rampa[2]);
  const r = new THREE.Color();
  return t < 0.5 ? r.copy(a).lerp(b, t/0.5) : r.copy(b).lerp(c, (t-0.5)/0.5);
}
function percentiles(v) {
  const o = v.map((x,i)=>[x,i]).sort((a,b)=>a[0]-b[0]); const p = new Array(v.length);
  o.forEach(([,i],k)=>{ p[i] = v.length>1 ? k/(v.length-1) : 0; });
  return p;
}

function construir(d, look) {
  const escena = new THREE.Scene();
  escena.fog = new THREE.FogExp2(look.niebla, 0.006);
  escena.add(new THREE.AmbientLight(0xffffff, look.ambiente));
  look.luces.forEach(([c, i, x, y, z]) => {
    const l = new THREE.DirectionalLight(c, i); l.position.set(x, y, z); escena.add(l);
  });
  const pivote = new THREE.Group(); pivote.name = 'pivote'; escena.add(pivote);

  const p = percentiles(d.ctqw);
  const malla = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 18, 14), look.material(0xffffff), d.n);
  const m = new THREE.Matrix4(), qq = new THREE.Quaternion(), e = new THREE.Vector3();
  for (let i = 0; i < d.n; i++) {
    const r = 0.55 + 1.0*p[i];
    m.compose(new THREE.Vector3().fromArray(d.coords[i]), qq, e.set(r,r,r));
    malla.setMatrixAt(i, m);
    malla.setColorAt(i, rampaDe(look, p[i]));
  }
  pivote.add(malla);

  pivote.add(new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(d.coords.map(c => new THREE.Vector3().fromArray(c))),
    new THREE.LineBasicMaterial({ color: look.paleta[1], transparent: true, opacity: 0.5 })));

  d.src.forEach(i => {
    const a = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.14, 8, 26),
      new THREE.MeshBasicMaterial({ color: look.acento }));
    a.position.fromArray(d.coords[i]); a.userData.mira = true; pivote.add(a);
  });
  d.sites.forEach(s => {
    const r = 3.2 + 1.0*Math.cbrt(s.n_residues);
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1),
      new THREE.MeshBasicMaterial({ color: look.acento, wireframe: true, transparent: true, opacity: 0.55 }));
    b.position.fromArray(s.centroid); pivote.add(b);
  });
  return escena;
}

function cargar(clave) {
  const d = estado.datos.proteinas[clave].datos;
  escenas.length = 0;
  LOOKS.forEach(l => escenas.push(construir(d, l)));
  const caja = new THREE.Box3();
  d.coords.forEach(c => caja.expandByPoint(new THREE.Vector3().fromArray(c)));
  const esf = caja.getBoundingSphere(new THREE.Sphere());
  controles.target.copy(esf.center);
  camara.position.copy(esf.center).add(new THREE.Vector3(esf.radius*1.2, esf.radius*0.5, esf.radius*1.8));
  camara.near = esf.radius/100; camara.far = esf.radius*40; camara.updateProjectionMatrix();
  escenas.forEach(s => s.fog.density = 0.9/(esf.radius*8));
  controles.update();
  estado.radio = esf.radius;
  estado.centro = esf.center.clone();
  $('pie').textContent = `${estado.datos.proteinas[clave].label} · ${d.n} residuos · dato en vivo`;
  prepararCaminata(clave, d);
}

async function prepararCaminata(clave, d) {
  estado.walk = null; estado.red = null; estado.ajuste = null;
  $('caminata').textContent = 'armando la caminata…';
  try {
    const pdb = estado.datos.proteinas[clave].pdb;
    const r = await fetch(`${BASE}/structures/${pdb}`);
    if (!r.ok) throw new Error('structures → HTTP ' + r.status);
    const estructura = await r.json();
    const par = CW.parametrosDeRed(estructura);
    if (!par) throw new Error('la estructura no declara corte y sigma; sin eso no se arma');
    const red = CW.construirRed(d.coords, par);

    // ¿Con qué Hamiltoniano reproduce el ranking sellado? Se prueban los dos y se
    // elige por coincidencia medida, no por preferencia.
    const ventana = [0.5, 8.0];
    const cand = [
      { rot: 'H = A (adyacencia)', lap: false, med: CW.promedioEnVentana(red, d.src, ventana, false) },
      { rot: 'H = L (laplaciano)', lap: true,  med: CW.promedioEnVentana(red, d.src, ventana, true) },
    ].map(c => ({ ...c, rho: CW.spearman(c.med, d.ctqw) }));
    cand.sort((a, b) => Math.abs(b.rho) - Math.abs(a.rho));
    const gana = cand[0];

    estado.red = red;
    estado.walk = CW.nuevoEstado(red, d.src);
    estado.lap = gana.lap;
    estado.prob = new Float64Array(red.n);
    estado.ajuste = { par, gana, otros: cand.slice(1), aristas: red.vec.reduce((s, l) => s + l.length, 0) / 2 };
    $('caminata').innerHTML = `<b style="color:#d5d8d2">caminata cuántica en vivo</b> · calculada aquí, no sellada ·
      red ${red.n} nodos / ${estado.ajuste.aristas} aristas, corte ${par.corte} Å ·
      ${gana.rot}, ρ de Spearman contra el valor sellado <b style="color:#d5d8d2">${gana.rho.toFixed(3)}</b>
      (${cand[1].rot}: ${cand[1].rho.toFixed(3)})`;
  } catch (e) {
    $('caminata').textContent = 'sin caminata: ' + e.message;
  }
}

// Reparto de la pantalla: una sola vista, o mosaico de todas.
function reparto() {
  const w = innerWidth, h = innerHeight - 46;
  if (estado.solo) {
    const l = LOOKS.find(x => x.id === estado.solo) || LOOKS[0];
    return [{ look: l, x: 0, yArriba: 0, an: w, al: h, uv: [0, 0, 1, 1] }];
  }
  const cols = LOOKS.length <= 4 ? 2 : 3, filas = Math.ceil(LOOKS.length / cols);
  return LOOKS.map((l, i) => {
    const c = i % cols, f = Math.floor(i / cols);
    const an = w/cols, al = h/filas;
    return { look: l, x: c*an, yArriba: f*al, an, al, uv: [c/cols, (filas-1-f)/filas, 1/cols, 1/filas] };
  });
}

function colocarEtiquetas() {
  const cont = $('etiquetas'); cont.innerHTML = '';
  reparto().forEach(({ look: l, x, yArriba }) => {
    const claro = (l.id === 'tinta' || l.id === 'oro');
    const d = document.createElement('div');
    d.className = 'cuadro';
    d.style.left = x + 'px';
    d.style.top = yArriba + 'px';
    d.style.color = claro ? '#1b1b1f' : '#d5d8d2';
    d.innerHTML = `<b>${l.rot}</b><i>${l.sub}</i>
      <div class="chips">${l.paleta.map(c => `<span class="chip" style="background:#${c.toString(16).padStart(6,'0')}"></span>`).join('')}</div>`;
    cont.appendChild(d);
  });
}

// La amplitud |psi|^2 manda color y tamaño. Se normaliza por el máximo del cuadro,
// porque lo que importa es dónde está la señal, no cuánta queda en total.
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Vector3(), _c = new THREE.Color();
function pintarAmplitud() {
  const p = estado.prob, n = p.length;
  let max = 0;
  for (let i = 0; i < n; i++) if (p[i] > max) max = p[i];
  if (max <= 0) return;
  const d = estado.datos.proteinas[estado.claves[estado.iProt]].datos;
  escenas.forEach((esc, li) => {
    const look = LOOKS[li];
    const malla = esc.getObjectByName('pivote').children.find(o => o.isInstancedMesh);
    if (!malla) return;
    for (let i = 0; i < n; i++) {
      const t = Math.sqrt(p[i] / max);                 // raíz: la cola baja se ve
      const r = 0.45 + 1.25 * t;
      _m.compose(_e.fromArray(d.coords[i]), _q, new THREE.Vector3(r, r, r));
      malla.setMatrixAt(i, _m);
      malla.setColorAt(i, rampaDe(look, t));
    }
    malla.instanceMatrix.needsUpdate = true;
    malla.instanceColor.needsUpdate = true;
  });
}

function bucle() {
  requestAnimationFrame(bucle);
  // Ahora orbitamos nosotros: la elipse la recorre la cámara y el objeto queda quieto,
  // que es como se mira una pieza y no como gira un motor de exposición.
  if (estado.girando && estado.centro) {
    estado.orbita += 0.0032;
    const R = estado.radio * 2.35, a = estado.orbita;
    camara.position.set(
      estado.centro.x + Math.cos(a) * R * 1.12,
      estado.centro.y + Math.sin(a * 0.5) * R * 0.30 + estado.radio * 0.35,
      estado.centro.z + Math.sin(a) * R * 0.86);
    controles.target.copy(estado.centro);
  }
  controles.update();

  if (estado.caminando && estado.walk && estado.red) {
    // A un cuarto de la velocidad anterior. El acumulador deja avanzar menos de un paso
    // por cuadro sin tocar dt, que es lo que mantiene estable el Runge-Kutta.
    estado.acumPasos = (estado.acumPasos || 0) + 0.75;
    while (estado.acumPasos >= 1) { CW.paso(estado.red, estado.walk, 0.01, estado.lap); estado.acumPasos -= 1; }
    if (estado.walk.t > 8.0) estado.walk = CW.nuevoEstado(estado.red, estado.datos.proteinas[estado.claves[estado.iProt]].datos.src);
    CW.probabilidad(estado.walk, estado.prob);
    pintarAmplitud();
    $('reloj').textContent = 't = ' + estado.walk.t.toFixed(2) + ' / ventana 0,5–8,0';
  }
  const w = innerWidth, h = innerHeight - 46;
  const vistas = reparto();
  escenas.forEach(s => {
    const p = s.getObjectByName('pivote');
    p && p.children.forEach(o => { if (o.userData.mira) o.quaternion.copy(camara.quaternion); });
  });

  renderer.setRenderTarget(rtColor);
  renderer.setScissorTest(true);
  vistas.forEach(({ look, x, yArriba, an, al }) => {
    const s = escenas[LOOKS.indexOf(look)];
    const y = h - yArriba - al;                 // el origen de gl está abajo
    camara.aspect = an/al; camara.updateProjectionMatrix();
    renderer.setViewport(x, y, an, al);
    renderer.setScissor(x, y, an, al);
    if (s) renderer.render(s, camara);
  });
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, w, h);

  uBorron.tCol.value = rtColor.texture;
  uBorron.dir.value.set(1/rtA.width, 0);
  renderer.setRenderTarget(rtA); renderer.render(eBorron, camQuad);
  uBorron.tCol.value = rtA.texture;
  uBorron.dir.value.set(0, 1/rtB.height);
  renderer.setRenderTarget(rtB); renderer.render(eBorron, camQuad);

  uFin.tCol.value = rtColor.texture;
  uFin.tBorroso.value = rtB.texture;
  uFin.tProf.value = rtColor.depthTexture;
  uFin.cerca.value = camara.near; uFin.lejos.value = camara.far;
  const dist = camara.position.distanceTo(controles.target);
  uFin.foco.value = dist; uFin.rango.value = Math.max(18, dist*0.9);
  uFin.tiempo.value = performance.now()/1000;

  renderer.setRenderTarget(null);
  renderer.setScissorTest(true);
  vistas.forEach(({ look: l, x, yArriba, an, al, uv }) => {
    const y = h - yArriba - al;
    renderer.setViewport(0, 0, w, h);
    renderer.setScissor(x, y, an, al);
    uFin.exposicion.value = l.exposicion;
    uFin.bloomF.value = l.bloomF; uFin.bloomU.value = l.bloomU;
    uFin.contorno.value = l.contorno; uFin.tinta.value.copy(v3(l.tinta));
    uFin.fondoAlto.value.copy(v3(l.fondoAlto)); uFin.fondoBajo.value.copy(v3(l.fondoBajo));
    uFin.gradSombra.value.copy(v3(l.gradSombra)); uFin.gradLuz.value.copy(v3(l.gradLuz));
    uFin.gradMezcla.value = l.gradMezcla; uFin.vineta.value = l.vineta; uFin.grano.value = l.grano;
    uFin.lavado.value = l.lavado || 0.0;
    uFin.caja.value.set(uv[0], uv[1], uv[2], uv[3]);
    renderer.render(eFin, camQuad);
  });
  renderer.setScissorTest(false);
}

function pintarBotones() {
  const c = $('vistas'); c.innerHTML = '';
  [...LOOKS.map(l => ({ id: l.id, rot: l.rot.split(' ')[0] })), { id: null, rot: 'TODAS' }].forEach(o => {
    const b = document.createElement('button');
    b.textContent = o.rot;
    if ((estado.solo || null) === o.id) b.style.borderColor = '#8a8a95';
    b.onclick = () => { estado.solo = o.id; pintarBotones(); colocarEtiquetas(); };
    c.appendChild(b);
  });
}
addEventListener('resize', colocarEtiquetas);

renderer.domElement.addEventListener('pointerdown', () => { estado.girando = false; });
$('girar').onclick = () => { estado.girando = !estado.girando; };
$('caminar').onclick = () => { estado.caminando = !estado.caminando; };
$('proteina').onclick = () => {
  estado.iProt = (estado.iProt + 1) % estado.claves.length;
  cargar(estado.claves[estado.iProt]);
};

window.rq = { LOOKS, uFin, camara, controles, estado, escenas };

(async () => {
  try {
    const r = await fetch(API); if (!r.ok) throw new Error('HTTP ' + r.status);
    estado.datos = await r.json();
    estado.claves = Object.keys(estado.datos.proteinas);
    $('cargando').remove();
    redimensionar();
    cargar(estado.claves[0]);
    pintarBotones();
    colocarEtiquetas();
    bucle();
  } catch (e) {
    $('cargando').innerHTML = `no se pudo leer la API: ${e.message}`;
  }
})();
