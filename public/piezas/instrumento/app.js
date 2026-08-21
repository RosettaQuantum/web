import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';

const API   = 'https://rosettaquantum.com/v1/challenges/cleveland-2026-07';
const DIAG  = 'https://rosettaquantum.com/v1/archive/RQ-EXP-CLEV-BLIND-001';
const $ = (id) => document.getElementById(id);

const CAMPOS = {
  ctqw: { rot: 'Caminata cuántica', sub: 'CTQW · el propagador que se mide', sellado: true },
  diff: { rot: 'Difusión clásica',  sub: 'el campeón contra el que compite', sellado: true },
  prox: { rot: 'Cercanía a la fuente', sub: '−distancia, calculada aquí desde las coordenadas selladas', sellado: false },
};
const MODOS = [
  { id: 'ctqw',   rot: 'Caminata cuántica',      sub: 'CTQW · el propagador que se mide' },
  { id: 'diff',   rot: 'Difusión clásica',       sub: 'el campeón contra el que compite' },
  { id: 'ab',     rot: 'Cuántica vs. clásica',   sub: 'misma molécula, misma cámara' },
  { id: 'abdist', rot: 'Cuántica vs. cercanía',  sub: 'lo que el archivo dice que está midiendo' },
];
const VISTAS = { ab: ['ctqw', 'diff'], abdist: ['ctqw', 'prox'] };
const CAPAS = [
  { id: 'fuente',    rot: 'Fuente',           sub: 'residuos por donde entra la señal', on: true },
  { id: 'predichos', rot: 'Sitios predichos', sub: 'salida del cálculo, sin validar',   on: true },
  { id: 'conocidos', rot: 'Sitios conocidos', sub: 'del fármaco; nunca entran al cálculo', on: true },
  { id: 'esqueleto', rot: 'Esqueleto',        sub: 'traza de la cadena principal',      on: true },
];

const estado = { datos: null, diag: null, clave: null, modo: 'ctqw', capas: {}, umbral: 0, corriendo: false, prox: null };
// Dos giros independientes: uno alrededor del eje vertical, otro del horizontal.
const GIROS = [
  { id: 'y', rot: 'Giro horizontal', sub: 'vuelta completa sobre el eje vertical', vel: 0.30 },
  { id: 'x', rot: 'Giro vertical',   sub: 'vuelta completa sobre el eje horizontal', vel: 0.22 },
];
const giro = { y: { on: false, ang: 0 }, x: { on: false, ang: 0 } };
CAPAS.forEach(c => estado.capas[c.id] = c.on);

const main = document.querySelector('main');
const renderer = new THREE.WebGLRenderer({ antialias: false });   // el contorno lo pone el pase, no el MSAA
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0x0a1a1e, 1);
main.appendChild(renderer.domElement);

// ── pase de look: contorno, desenfoque, resplandor y gradación ───────────────
// Escrito a mano (sin EffectComposer) para que el A/B por tijera siga funcionando:
// las dos vistas caen en el mismo búfer y el pase corre una sola vez sobre el cuadro.
const quadGeo = new THREE.PlaneGeometry(2, 2);
const camQuad = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const VERT = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`;
function pasada(frag, uniforms) {
  const e = new THREE.Scene();
  e.add(new THREE.Mesh(quadGeo, new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false })));
  return e;
}
const opcRT = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
const rtColor = new THREE.WebGLRenderTarget(1, 1, opcRT);
rtColor.depthTexture = new THREE.DepthTexture(1, 1);
rtColor.depthTexture.type = THREE.UnsignedIntType;
const rtA = new THREE.WebGLRenderTarget(1, 1, opcRT);
const rtB = new THREE.WebGLRenderTarget(1, 1, opcRT);

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
  tCol: { value: null }, tBorroso: { value: null }, tProf: { value: null },
  res: { value: new THREE.Vector2() }, cerca: { value: 0.1 }, lejos: { value: 4000 },
  foco: { value: 60 }, rango: { value: 90 }, tiempo: { value: 0 }, corte: { value: -1.0 },
  exposicion: { value: 1.55 },
  // OJO: van como Vector3 y no como Color. THREE.Color convierte el hex de sRGB a lineal,
  // y este pase escribe crudo a pantalla: pasados como Color salen casi negros.
  fondoAlto: { value: new THREE.Vector3(0.055, 0.141, 0.161) },   // #0E2429 petróleo, arriba
  fondoBajo: { value: new THREE.Vector3(0.028, 0.071, 0.086) },   // #071216 más hondo, abajo
};
const eFin = pasada(`
  uniform sampler2D tCol, tBorroso, tProf;
  uniform vec2 res; uniform float cerca, lejos, foco, rango, tiempo, corte, exposicion;
  uniform vec3 fondoAlto, fondoBajo;
  varying vec2 vUv;
  float zLineal(vec2 uv){
    float d = texture2D(tProf, uv).x;
    float z = d*2.0-1.0;
    return (2.0*cerca*lejos)/(lejos+cerca-z*(lejos-cerca));
  }
  float lum(vec3 c){ return dot(c, vec3(0.2126,0.7152,0.0722)); }
  float ruido(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
  void main(){
    vec2 px = 1.0/res;
    vec3 col = texture2D(tCol, vUv).rgb;
    vec3 bor = texture2D(tBorroso, vUv).rgb;
    float z = zLineal(vUv);

    // profundidad de campo
    col = mix(col, bor, clamp(abs(z-foco)/rango, 0.0, 1.0)*0.45);
    // resplandor sobre lo que ya era brillante
    col += bor * smoothstep(0.62, 0.95, lum(bor)) * 0.45;

    // contorno de tinta por salto de profundidad; se corta en la costura del A/B
    float lejosDeCostura = (corte < 0.0) ? 1.0 : step(0.004, abs(vUv.x - corte));
    float d = 0.0;
    d = max(d, abs(zLineal(vUv+vec2(px.x,0.))-z));
    d = max(d, abs(zLineal(vUv-vec2(px.x,0.))-z));
    d = max(d, abs(zLineal(vUv+vec2(0.,px.y))-z));
    d = max(d, abs(zLineal(vUv-vec2(0.,px.y))-z));
    float borde = smoothstep(0.10, 0.55, d/max(z*0.02,0.05)) * lejosDeCostura;
    col = mix(col, vec3(0.008,0.015,0.011), borde*0.9);

    vec2 q = vUv-0.5;
    float esFondo = step(lejos*0.85, z);

    // exposición, curva de tono y gradación de la casa
    col *= exposicion;
    col = col/(col+vec3(0.92)) * 1.52;
    col = pow(clamp(col,0.0,1.0), vec3(0.86));
    vec3 grad = mix(vec3(0.014,0.028,0.021), vec3(0.96,1.00,0.93), col);
    col = mix(col, grad, 0.18);
    col = (col-0.44)*1.22 + 0.48;               // contraste, sin hundir el medio
    col = max(col, vec3(0.0));

    // el fondo se pinta al final, con su propio degradado: así el color es exactamente
    // el elegido y no lo que quede de pasar el negro del clear por la curva de tono.
    vec3 fondo = mix(fondoBajo, fondoAlto, smoothstep(0.0, 1.0, vUv.y));
    fondo += vec3(0.020,0.036,0.030) * (1.0 - clamp(length(q)*1.5, 0.0, 1.0));
    col = mix(col, fondo, esFondo);

    col *= 1.0 - dot(q,q)*0.36;
    col += (ruido(vUv*res + tiempo)-0.5)*0.022;

    // la costura del A/B, dibujada a propósito
    if (corte > 0.0) col = mix(col, vec3(0.14,0.19,0.15), step(abs(vUv.x-corte), px.x*1.2));
    gl_FragColor = vec4(col, 1.0);
  }`, uFin);

// Un solo lugar que ajusta lienzo y búferes: tenerlos en dos condiciones distintas
// dejó el lienzo en 600x300 con los búferes correctos, y el cuadro salía recortado.
function ajustar() {
  const w = main.clientWidth, h = main.clientHeight;
  if (w < 2 || h < 2) return;
  if (renderer.domElement.clientWidth === w && renderer.domElement.clientHeight === h) return;
  renderer.setSize(w, h);
  redimensionarPost(w, h);
}

function redimensionarPost(w, h) {
  const dpr = renderer.getPixelRatio();
  const W = Math.max(2, Math.floor(w*dpr)), H = Math.max(2, Math.floor(h*dpr));
  // setSize NO redimensiona la textura de profundidad (sólo las de color): se rehace a mano,
  // si no el búfer queda incompleto y el cuadro sale negro sin un solo error en rojo.
  if (rtColor.depthTexture) rtColor.depthTexture.dispose();
  const prof = new THREE.DepthTexture(W, H);
  prof.type = THREE.UnsignedIntType;
  rtColor.depthTexture = prof;
  rtColor.setSize(W, H);
  rtA.setSize(Math.max(2, W>>2), Math.max(2, H>>2));
  rtB.setSize(Math.max(2, W>>2), Math.max(2, H>>2));
  uFin.res.value.set(W, H);
}

// rampa de tres escalones: sombreado plano, no degradado
const escalones = new Uint8Array([ 96,96,96,255,  168,168,168,255,  238,238,238,255 ]);
const RAMPA_TOON = new THREE.DataTexture(escalones, 3, 1, THREE.RGBAFormat);
RAMPA_TOON.minFilter = RAMPA_TOON.magFilter = THREE.NearestFilter;
RAMPA_TOON.needsUpdate = true;

const camara = new THREE.PerspectiveCamera(42, 1, 0.1, 4000);
const controles = new OrbitControls(camara, renderer.domElement);
controles.enableDamping = true; controles.dampingFactor = 0.08;

const escenas = { ctqw: null, diff: null, prox: null };
const raycaster = new THREE.Raycaster();
const puntero = new THREE.Vector2();

const RAMPA = [new THREE.Color(0x184a30), new THREE.Color(0x2ea55d), new THREE.Color(0x9dffc6)];
const RAMPA_ORO = [new THREE.Color(0x4a3512), new THREE.Color(0xb08a2c), new THREE.Color(0xffdf9a)];
const APAGADO = new THREE.Color(0x1e2a22);
function rampa(t, oro, destino) {
  const R = oro ? RAMPA_ORO : RAMPA;
  const c = destino || new THREE.Color();
  if (t < 0.5) c.copy(R[0]).lerp(R[1], t / 0.5);
  else c.copy(R[1]).lerp(R[2], (t - 0.5) / 0.5);
  return c;
}
function percentiles(v) {
  const orden = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]);
  const p = new Array(v.length);
  orden.forEach(([, i], k) => { p[i] = v.length > 1 ? k / (v.length - 1) : 0; });
  return p;
}
// Distancia en ángstrom al residuo fuente más cercano. Sale de las coordenadas
// selladas, pero el cálculo lo hace esta página: por eso va en oro y lo declara.
function distanciaAFuente(d) {
  return d.coords.map(([x, y, z]) => {
    let m = Infinity;
    for (const i of d.src) {
      const [a, b, c] = d.coords[i];
      const q = (x - a) ** 2 + (y - b) ** 2 + (z - c) ** 2;
      if (q < m) m = q;
    }
    return Math.sqrt(m);
  });
}

function construirEscena(d, valores, oro) {
  const escena = new THREE.Scene();
  escena.add(new THREE.AmbientLight(0xffffff, 1.60));
  const luz = new THREE.DirectionalLight(0xffffff, 2.10); luz.position.set(1, 1.2, 1.4); escena.add(luz);
  const relleno = new THREE.DirectionalLight(0xbfe8ff, 0.85); relleno.position.set(-1.2, -0.6, -1); escena.add(relleno);
  // Todo cuelga de un pivote: girar el contenido y no la cámara deja los dos ejes
  // libres para dar la vuelta entera, sin el tope de polo que impone OrbitControls.
  const pivote = new THREE.Group(); pivote.name = 'pivote';
  pivote.rotation.order = 'YXZ';
  escena.add(pivote);
  const agregar = (o) => pivote.add(o);

  const malla = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1, 16, 12), new THREE.MeshToonMaterial({ gradientMap: RAMPA_TOON }), d.n);
  malla.name = 'residuos';
  malla.userData = { p: percentiles(valores), oro: !!oro };
  agregar(malla);

  const traza = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(d.coords.map(([x, y, z]) => new THREE.Vector3(x, y, z))),
    new THREE.LineBasicMaterial({ color: 0x3a4c3c }));
  traza.name = 'esqueleto'; agregar(traza);

  const fuente = new THREE.Group(); fuente.name = 'fuente';
  d.src.forEach(i => {
    const a = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.13, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0xeaf3e6, transparent: true, opacity: 0.62 }));
    a.position.fromArray(d.coords[i]); fuente.add(a);
  });
  agregar(fuente);

  const conocidos = new THREE.Group(); conocidos.name = 'conocidos';
  d.allo.forEach(i => {
    const o = new THREE.Mesh(new THREE.OctahedronGeometry(2.0),
      new THREE.MeshBasicMaterial({ color: 0x2c8c80, wireframe: true, transparent: true, opacity: 0.85 }));
    o.position.fromArray(d.coords[i]); conocidos.add(o);
  });
  agregar(conocidos);

  const predichos = new THREE.Group(); predichos.name = 'predichos';
  d.sites.forEach(s => {
    const r = 3.4 + 1.1 * Math.cbrt(s.n_residues);
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1),
      new THREE.MeshBasicMaterial({ color: 0xc9a24d, wireframe: true, transparent: true, opacity: 0.8 }));
    b.position.fromArray(s.centroid); predichos.add(b);
  });
  agregar(predichos);

  aplicarUmbral(escena, d, 0);
  return escena;
}

// El barrido NO es tiempo: enciende los residuos por orden de valor, que es
// exactamente el ranking con el que se mide. Todo sale del dato sellado.
function aplicarUmbral(escena, d, u) {
  const malla = escena.getObjectByName('residuos');
  const { p, oro } = malla.userData;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), e = new THREE.Vector3();
  const c = new THREE.Color();
  for (let i = 0; i < d.n; i++) {
    const vivo = p[i] >= u;
    const r = vivo ? 0.5 + 0.95 * p[i] : 0.32;
    v.fromArray(d.coords[i]);
    m.compose(v, q, e.set(r, r, r));
    malla.setMatrixAt(i, m);
    malla.setColorAt(i, vivo ? rampa(p[i], oro, c) : c.copy(APAGADO));
  }
  malla.instanceMatrix.needsUpdate = true;
  malla.instanceColor.needsUpdate = true;
}

function encuadrar(d) {
  const caja = new THREE.Box3();
  d.coords.forEach(([x, y, z]) => caja.expandByPoint(new THREE.Vector3(x, y, z)));
  const esfera = caja.getBoundingSphere(new THREE.Sphere());
  const centro = esfera.center.clone(), radio = esfera.radius;
  controles.target.copy(centro);
  camara.position.copy(centro).add(new THREE.Vector3(radio * 1.35, radio * 0.55, radio * 1.75));
  camara.near = radio / 100; camara.far = radio * 40; camara.updateProjectionMatrix();
  Object.values(escenas).forEach(s => { if (s) s.fog = new THREE.Fog(0x0a1a1e, radio * 1.4, radio * 5); });
  controles.update();
}

function visibilidad() {
  Object.values(escenas).forEach(e => {
    if (!e) return;
    ['fuente', 'predichos', 'conocidos', 'esqueleto'].forEach(n => {
      const o = e.getObjectByName(n); if (o) o.visible = estado.capas[n];
    });
  });
}

function vistasDe(w) {
  const par = VISTAS[estado.modo];
  return par ? [[par[0], 0, w / 2], [par[1], w / 2, w / 2]] : [[estado.modo, 0, w]];
}

function dibujar() {
  ajustar();
  const w = main.clientWidth, h = main.clientHeight;
  controles.update();
  if (estado.corriendo) {
    estado.umbral -= 0.25;                       // de 100 (sólo el pico) a 0 (todos)
    if (estado.umbral < -12) estado.umbral = 100;
    aplicarBarrido();
  }
  const dt = 1/60;
  GIROS.forEach(g => { if (giro[g.id].on) giro[g.id].ang += g.vel * dt; });
  Object.values(escenas).forEach(e => {
    if (!e) return;
    const p = e.getObjectByName('pivote');
    if (p) { p.rotation.y = giro.y.ang; p.rotation.x = giro.x.ang; }
    const f = e.getObjectByName('fuente');
    if (f && p) {
      const inverso = p.getWorldQuaternion(new THREE.Quaternion()).invert();
      f.children.forEach(o => o.quaternion.copy(inverso).multiply(camara.quaternion));
    }
  });
  // setViewport/setScissor van en píxeles CSS: three los multiplica por el pixelRatio,
  // también cuando el destino es un búfer. Pasarlos ya multiplicados deja el cuadro en negro.
  renderer.setRenderTarget(rtColor);
  renderer.setScissorTest(true);
  vistasDe(w).forEach(([campo, x, ancho]) => {
    camara.aspect = ancho / h; camara.updateProjectionMatrix();
    renderer.setViewport(x, 0, ancho, h);
    renderer.setScissor(x, 0, ancho, h);
    if (escenas[campo]) renderer.render(escenas[campo], camara);
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
  uFin.foco.value = dist; uFin.rango.value = Math.max(18, dist*0.85);
  uFin.tiempo.value = performance.now()/1000;
  uFin.corte.value = VISTAS[estado.modo] ? 0.5 : -1.0;
  renderer.setRenderTarget(null);
  renderer.render(eFin, camQuad);
  requestAnimationFrame(dibujar);
}

function aplicarBarrido() {
  const d = estado.datos.proteinas[estado.clave].datos;
  const u = Math.min(100, Math.max(0, estado.umbral));
  Object.values(escenas).forEach(e => e && aplicarUmbral(e, d, u / 100));
  $('umbral').value = String(Math.round(u));
  $('umbral-txt').textContent = u <= 0 ? 'todos los residuos' : `sólo el ${100 - Math.round(u)}% más alto`;
}

function botones(cont, items, activo, onclick) {
  cont.innerHTML = '';
  items.forEach(it => {
    const b = document.createElement('button');
    b.innerHTML = `${it.rot}<small>${it.sub}</small>`;
    b.setAttribute('aria-pressed', String(activo(it)));
    b.onclick = () => onclick(it);
    cont.appendChild(b);
  });
}

function etiquetasVista() {
  const cont = $('etiquetas'); cont.innerHTML = '';
  const poner = (campo, izq) => {
    const c = CAMPOS[campo], d = document.createElement('div');
    d.className = 'vp-rot' + (c.sellado ? '' : ' calculado');
    d.style.left = izq;
    d.innerHTML = `<b>${c.rot}</b>${c.sub}`;
    cont.appendChild(d);
  };
  const par = VISTAS[estado.modo];
  if (par) { poner(par[0], '18px'); poner(par[1], 'calc(50% + 18px)'); }
  else poner(estado.modo, '18px');
}

function pintarPanel() {
  const P = estado.datos.proteinas[estado.clave];
  const nulo = (P.estadistica || {}).null || {};
  const par = (P.estadistica || {}).pair;
  let html = `<div class="t">Percentil del sitio conocido, por propagador</div>
    <table><tr><td class="k"></td><td class="v">percentil</td><td class="v">z real</td></tr>
    ${Object.entries(nulo).map(([k, v]) =>
      `<tr><td class="k" style="${k === 'ctqw' ? 'color:var(--verde)' : ''}">${k}</td>
       <td class="v">${v.percentil_observado}</td><td class="v">${v.z_real_contiguo}</td></tr>`).join('')}</table>`;
  if (par) html += `<div class="t" style="margin-top:9px">Par CTQW − difusión</div>
    <table>${Object.entries(par).map(([k, v]) => `<tr><td class="k">${k}</td><td class="v">${v}</td></tr>`).join('')}</table>`;
  html += `<div style="color:var(--tenue);margin-top:8px;font-size:11px">Nombres y valores tal cual salen del archivo sellado.</div>`;
  $('stats').innerHTML = html;

  $('aviso').innerHTML = `<div class="t">Aviso del archivo</div>${estado.datos.aviso}`;
  $('procedencia').innerHTML = `<div class="t">Procedencia</div>
    <div class="proc">sha256 ${P.sha256}</div>
    <div class="proc" style="margin-top:4px">${estado.datos.como_verificar}</div>
    <div class="proc" style="margin-top:4px">pre-registro <b style="color:var(--oro)">${estado.datos.pre_registro}</b> ·
      receta ${estado.datos.recipe_id} · <a href="${API}" target="_blank">estos datos, en crudo</a></div>`;
  pintarDiagnostico(P);
}

function pintarDiagnostico(P) {
  const caja = $('diagnostico');
  if (estado.diag === 'error') {
    caja.innerHTML = `<div class="t">Diagnóstico</div>
      <div style="color:var(--oro)">No se pudo leer ${DIAG}. No se muestra nada en su lugar.</div>`;
    return;
  }
  if (!estado.diag) { caja.innerHTML = '<div class="t">Diagnóstico</div>pidiendo…'; return; }
  const D = estado.diag;
  const b = D.blancos.find(x => x.pdb === P.pdb);
  caja.innerHTML = `<div class="t">Por qué se enciende alrededor de la fuente</div>
    <div style="color:#d8c48c;margin-bottom:7px">${D.hallazgo}</div>
    ${b ? `<table>
      <tr><td class="k">Spearman(score, distancia) · distales</td><td class="v" style="color:var(--oro)">${b.spearman_score_vs_dist_fuente_distales}</td></tr>
      <tr><td class="k">… sobre todos los residuos</td><td class="v" style="color:var(--oro)">${b.spearman_score_vs_dist_fuente_todos}</td></tr>
      <tr><td class="k">distancia a la fuente, mediana</td><td class="v">${b.dist_fuente_A.mediana} Å</td></tr>
      </table>` : `<div style="color:var(--oro)">Este blanco no está en el diagnóstico sellado.</div>`}
    <div style="color:var(--tenue);margin-top:7px;font-size:11px">${D.resumen}</div>
    <div class="proc" style="margin-top:6px">${D.id} · ${D.hash}<br>
      se verifica con <a href="${DIAG}/raw" target="_blank">/v1/archive/${D.id}/raw</a>, no con esta lectura.</div>`;
}

function cargarProteina(clave) {
  estado.clave = clave;
  const d = estado.datos.proteinas[clave].datos;
  estado.prox = distanciaAFuente(d);
  escenas.ctqw = construirEscena(d, d.ctqw);
  escenas.diff = construirEscena(d, d.diff);
  escenas.prox = construirEscena(d, estado.prox.map(x => -x), true);
  visibilidad(); encuadrar(d); aplicarBarrido();
  pintarUI(); pintarPanel();
}

function pintarUI() {
  const props = Object.entries(estado.datos.proteinas).map(([k, v]) => ({
    id: k, rot: v.label, sub: `${v.n_residuos} residuos · ${v.sitios_predichos} sitios predichos`,
  }));
  botones($('proteinas'), props, it => it.id === estado.clave, it => cargarProteina(it.id));
  botones($('modos'), MODOS, it => it.id === estado.modo, it => { estado.modo = it.id; pintarUI(); });
  botones($('capas'), CAPAS, it => estado.capas[it.id], it => {
    estado.capas[it.id] = !estado.capas[it.id]; visibilidad(); pintarUI();
  });
  botones($('giros'), GIROS, it => giro[it.id].on, it => { giro[it.id].on = !giro[it.id].on; pintarUI(); });
  etiquetasVista();
}

renderer.domElement.addEventListener('pointermove', (ev) => {
  const r = renderer.domElement.getBoundingClientRect();
  const x = ev.clientX - r.left, y = ev.clientY - r.top;
  const par = VISTAS[estado.modo];
  const ancho = par ? r.width / 2 : r.width;
  const derecha = par && x > r.width / 2;
  const off = derecha ? r.width / 2 : 0;
  const campo = par ? (derecha ? par[1] : par[0]) : estado.modo;
  puntero.x = ((x - off) / ancho) * 2 - 1;
  puntero.y = -(y / r.height) * 2 + 1;
  camara.aspect = ancho / r.height; camara.updateProjectionMatrix();
  raycaster.setFromCamera(puntero, camara);
  const malla = escenas[campo] && escenas[campo].getObjectByName('residuos');
  const hit = malla ? raycaster.intersectObject(malla) : [];
  const caja = $('residuo');
  if (hit.length) {
    const i = hit[0].instanceId;
    const d = estado.datos.proteinas[estado.clave].datos;
    caja.style.display = 'block';
    caja.style.left = Math.min(x + 14, r.width - 200) + 'px';
    caja.style.top = (y + 14) + 'px';
    caja.innerHTML = `<b>${d.chain[i]} ${d.resnum[i]}</b>${d.distal[i] ? ' · distal' : ''}<br>
      ctqw <b>${d.ctqw[i].toFixed(5)}</b><br>diff <b>${d.diff[i].toFixed(5)}</b><br>
      <span style="color:var(--oro)">a la fuente ${estado.prox[i].toFixed(1)} Å</span>`;
  } else caja.style.display = 'none';
});

$('umbral').addEventListener('input', (e) => {
  estado.corriendo = false; $('play').innerHTML = '&#9654; barrer';
  estado.umbral = Number(e.target.value); aplicarBarrido();
});
$('play').addEventListener('click', () => {
  estado.corriendo = !estado.corriendo;
  $('play').innerHTML = estado.corriendo ? '&#10074;&#10074; pausa' : '&#9654; barrer';
});

async function traerDiagnostico() {
  try {
    const r = await fetch(DIAG);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const a = await r.json();
    const dg = a.archivo_sellado.w6.porque.diagnostico_de_por_que_fallo;
    estado.diag = {
      id: a.id, hash: a.content_hash,
      hallazgo: dg.hallazgo,
      resumen: dg.medido_no_heredado._doc + ' ' + dg.resumen_medido,
      blancos: dg.medido_no_heredado.blancos,
    };
  } catch { estado.diag = 'error'; }
  if (estado.clave) pintarDiagnostico(estado.datos.proteinas[estado.clave]);
}

// Mando de look: se ajusta en vivo desde la consola y se copia al código.
window.rq = { camara, controles, escenas, estado, uFin, rtColor, rtA, rtB, main, ajustar };

(async () => {
  try {
    const r = await fetch(API);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    estado.datos = await r.json();
    $('cargando').remove();
    ajustar();
    cargarProteina(Object.keys(estado.datos.proteinas)[0]);
    traerDiagnostico();
    dibujar();
  } catch (e) {
    $('cargando').innerHTML = `no se pudo leer la API: ${e.message}<br>(y eso se dice, no se dibuja una maqueta)`;
  }
})();
