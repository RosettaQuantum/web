import * as THREE from '../vendor/three.module.js';
import { OrbitControls } from '../vendor/OrbitControls.js';

// E.ON · el paisaje de decisiones, y los disparos reales de una QPU encima.
//
// Instancia K=10 de case118: es la única donde las tres capas son el MISMO problema —
// los coeficientes publicados, el espectro de las 1024 configuraciones, y una corrida
// en hardware de IBM. Los dos archivos se verifican contra el hash de su propio nombre.
const RAW = 'https://raw.githubusercontent.com/RosettaQuantum/evidence/main';
const ESPECTRO = `${RAW}/data/2026/08/01_qubo_eon_case118_K10@e853c094.json`;
const DISPAROS = `${RAW}/data/2026/08/07_resultado_crudo@d6dc5402.json`;
const $ = (id) => document.getElementById(id);
const v3 = (h) => new THREE.Vector3(((h>>16)&255)/255, ((h>>8)&255)/255, (h&255)/255);

const estado = { orbitando: true, ang: 0, lluvia: 0.45, datos: null };

const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);
const escena = new THREE.Scene();
escena.fog = new THREE.FogExp2(0x0a0906, 0.0055);
const camara = new THREE.PerspectiveCamera(42, 1, 0.5, 900);
const controles = new OrbitControls(camara, renderer.domElement);
controles.enableDamping = true; controles.dampingFactor = 0.07;
escena.add(new THREE.AmbientLight(0xffffff, 1.1));
const key = new THREE.DirectionalLight(0xfff0d8, 2.2); key.position.set(1, 1.4, 0.9); escena.add(key);
const fill = new THREE.DirectionalLight(0x88b4ff, 0.9); fill.position.set(-1.1, -0.4, -1); escena.add(fill);

// ── pase de look, en ámbar ─────────────────────────────────────────────────
const quadGeo = new THREE.PlaneGeometry(2, 2);
const camQuad = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const VERT = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`;
const pasada = (f, u) => { const e = new THREE.Scene();
  e.add(new THREE.Mesh(quadGeo, new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: f, uniforms: u, depthTest: false, depthWrite: false }))); return e; };
const opc = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
const rtColor = new THREE.WebGLRenderTarget(1, 1, opc);
const rtA = new THREE.WebGLRenderTarget(1, 1, opc), rtB = new THREE.WebGLRenderTarget(1, 1, opc);
const uBorron = { tCol: { value: null }, dir: { value: new THREE.Vector2() } };
const eBorron = pasada(`
  uniform sampler2D tCol; uniform vec2 dir; varying vec2 vUv;
  void main(){ vec3 s = texture2D(tCol,vUv).rgb*0.227027;
    s += (texture2D(tCol,vUv+dir*1.3846).rgb + texture2D(tCol,vUv-dir*1.3846).rgb)*0.3162162;
    s += (texture2D(tCol,vUv+dir*3.2307).rgb + texture2D(tCol,vUv-dir*3.2307).rgb)*0.0702702;
    gl_FragColor = vec4(s,1.); }`, uBorron);
const uFin = { tCol:{value:null}, tBorroso:{value:null}, tProf:{value:null}, res:{value:new THREE.Vector2()},
  cerca:{value:0.5}, lejos:{value:900}, foco:{value:120}, rango:{value:160}, tiempo:{value:0} };
const eFin = pasada(`
  uniform sampler2D tCol, tBorroso, tProf; uniform vec2 res;
  uniform float cerca, lejos, foco, rango, tiempo; varying vec2 vUv;
  float zLin(vec2 uv){ float d=texture2D(tProf,uv).x, z=d*2.-1.; return (2.*cerca*lejos)/(lejos+cerca-z*(lejos-cerca)); }
  float lum(vec3 c){ return dot(c, vec3(0.2126,0.7152,0.0722)); }
  float ruido(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
  void main(){
    vec2 px = 1.0/res, q = vUv-0.5;
    vec3 col = texture2D(tCol,vUv).rgb, bor = texture2D(tBorroso,vUv).rgb;
    float z = zLin(vUv);
    col = mix(col, bor, clamp(abs(z-foco)/rango,0.,1.)*0.40);
    col += bor * smoothstep(0.36,0.76,lum(bor)) * 1.15;
    col *= 1.8;
    col = col/(col+vec3(0.92))*1.52;
    col = pow(clamp(col,0.,1.), vec3(0.88));
    col = mix(col, mix(vec3(0.028,0.022,0.013), vec3(1.00,0.96,0.88), col), 0.22);
    col = (col-0.44)*1.20 + 0.47;
    float esFondo = step(lejos*0.85, z);
    vec3 fondo = mix(vec3(0.018,0.015,0.010), vec3(0.052,0.040,0.024), smoothstep(0.,1.,vUv.y));
    fondo += vec3(0.032,0.024,0.011) * (1.0 - clamp(length(q)*1.5,0.,1.));
    col = mix(col, fondo, esFondo);
    col *= 1.0 - dot(q,q)*0.40;
    col += (ruido(vUv*res+tiempo)-0.5)*0.022;
    gl_FragColor = vec4(max(col,vec3(0.)),1.0);
  }`, uFin);

function ajustar() {
  const w = innerWidth, h = innerHeight, dpr = renderer.getPixelRatio();
  if (renderer.domElement.clientWidth === w && renderer.domElement.clientHeight === h) return;
  renderer.setSize(w, h);
  camara.aspect = w/h; camara.updateProjectionMatrix();
  const W = Math.max(2, Math.floor(w*dpr)), H = Math.max(2, Math.floor(h*dpr));
  if (rtColor.depthTexture) rtColor.depthTexture.dispose();
  const prof = new THREE.DepthTexture(W, H); prof.type = THREE.UnsignedIntType;
  rtColor.depthTexture = prof;
  rtColor.setSize(W, H); rtA.setSize(W>>2, H>>2); rtB.setSize(W>>2, H>>2);
  uFin.res.value.set(W, H);
}

// ── el paisaje ─────────────────────────────────────────────────────────────
// Cada configuración es un punto. La posición horizontal es la proyección del
// hipercubo de 10 dimensiones sobre el plano: sumar un vector fijo por cada
// refuerzo encendido. Vecinos de Hamming quedan vecinos. La altura es el valor.
const K = 10, RADIO = 62, ALTO = 46;
const dirs = Array.from({ length: K }, (_, i) => {
  const a = (i/K)*Math.PI*2;
  return new THREE.Vector2(Math.cos(a)*RADIO/3.2, Math.sin(a)*RADIO/3.2);
});
const posDe = (n, valores, min, span) => {
  const p = new THREE.Vector3(0, 0, 0);
  for (let i = 0; i < K; i++) if ((n >> (K-1-i)) & 1) { p.x += dirs[i].x; p.z += dirs[i].y; }
  p.y = -ALTO * (1 - (valores[n] - min)/span);        // el óptimo es el fondo del valle
  return p;
};

let mallaP = null, mallaD = null, pos = [];

function construir(esp, tiros) {
  const valores = esp.espectro_crudo.valores;
  const min = Math.min(...valores), max = Math.max(...valores), span = max - min || 1;
  pos = valores.map((_, n) => posDe(n, valores, min, span));

  // las 1024 configuraciones
  const bajo = new THREE.Color(0x3a2a12), medio = new THREE.Color(0xc98a22), alto = new THREE.Color(0xffe4a8);
  mallaP = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8),
    new THREE.MeshStandardMaterial({ metalness: 0.3, roughness: 0.35, emissive: 0x1a1206, emissiveIntensity: 0.5 }), valores.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Vector3(), c = new THREE.Color();
  valores.forEach((v, n) => {
    const t = 1 - (v - min)/span;                      // 1 = mejor
    const r = 0.30 + 1.5*t*t;
    m.compose(pos[n], q, e.set(r, r, r));
    mallaP.setMatrixAt(n, m);
    c.copy(bajo).lerp(medio, Math.min(1, t*1.6));
    if (t > 0.62) c.lerp(alto, (t-0.62)/0.38);
    mallaP.setColorAt(n, c);
  });
  escena.add(mallaP);

  // aristas de Hamming: la vecindad por la que se mueve la búsqueda
  const pts = [];
  for (let n = 0; n < valores.length; n++)
    for (let b = 0; b < K; b++) { const v = n ^ (1 << b); if (v > n) pts.push(pos[n], pos[v]); }
  escena.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color: 0x4a3a1c, transparent: true, opacity: 0.13 })));

  // el óptimo exacto
  const opt = esp.optimo_exacto;
  const anillo = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.22, 10, 44),
    new THREE.MeshBasicMaterial({ color: 0xffe4a8 }));
  anillo.position.copy(pos[opt.indice]); anillo.userData.mira = true;
  escena.add(anillo);

  // los 8192 disparos de la QPU, como columnas sobre su configuración
  const cadenas = Object.entries(tiros.counts_crudos);
  const maxC = Math.max(...cadenas.map(([, c]) => c));
  mallaD = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.34, 0.34, 1, 6),
    new THREE.MeshBasicMaterial({ color: 0x7fe3ff, transparent: true, opacity: 0.62 }), cadenas.length);
  mallaD.userData = { cadenas, maxC };
  escena.add(mallaD);

  return { valores, min, max, opt, cadenas: cadenas.length, disparos: tiros.shots_recibidos, maxC };
}

function lluvia(t) {                                   // 0..1, la caída de los disparos
  const { cadenas, maxC } = mallaD.userData;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Vector3(), v = new THREE.Vector3();
  cadenas.forEach(([cad, n], i) => {
    const idx = parseInt(cad, 2);
    const h = (0.6 + 16 * (n/maxC)) * t;
    v.copy(pos[idx] || new THREE.Vector3()).y += h/2;
    m.compose(v, q, e.set(1, Math.max(0.001, h), 1));
    mallaD.setMatrixAt(i, m);
  });
  mallaD.instanceMatrix.needsUpdate = true;
}

function bucle() {
  requestAnimationFrame(bucle);
  ajustar();
  if (estado.orbitando) {
    estado.ang += 0.0024;
    const R = 150;
    camara.position.set(Math.cos(estado.ang)*R, 62 + Math.sin(estado.ang*0.6)*18, Math.sin(estado.ang)*R*0.9);
    controles.target.set(0, -ALTO*0.45, 0);
  }
  controles.update();
  escena.children.forEach(o => { if (o.userData.mira) o.quaternion.copy(camara.quaternion); });
  if (mallaD && estado.lluvia < 1) { estado.lluvia = Math.min(1, estado.lluvia + 0.010); lluvia(estado.lluvia); }

  renderer.setRenderTarget(rtColor); renderer.render(escena, camara);
  uBorron.tCol.value = rtColor.texture; uBorron.dir.value.set(1/rtA.width, 0);
  renderer.setRenderTarget(rtA); renderer.render(eBorron, camQuad);
  uBorron.tCol.value = rtA.texture; uBorron.dir.value.set(0, 1/rtB.height);
  renderer.setRenderTarget(rtB); renderer.render(eBorron, camQuad);
  uFin.tCol.value = rtColor.texture; uFin.tBorroso.value = rtB.texture; uFin.tProf.value = rtColor.depthTexture;
  uFin.cerca.value = camara.near; uFin.lejos.value = camara.far;
  const dist = camara.position.distanceTo(controles.target);
  uFin.foco.value = dist; uFin.rango.value = Math.max(60, dist*0.95);
  uFin.tiempo.value = performance.now()/1000;
  renderer.setRenderTarget(null); renderer.render(eFin, camQuad);
}

async function sha256(t) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}

renderer.domElement.addEventListener('pointerdown', () => { estado.orbitando = false; });
$('orbita').onclick = () => { estado.orbitando = !estado.orbitando; };
$('relluvia').onclick = () => { estado.lluvia = 0; };

(async () => {
  try {
    const [re, rd] = await Promise.all([fetch(ESPECTRO), fetch(DISPAROS)]);
    if (!re.ok) throw new Error('espectro → HTTP ' + re.status);
    if (!rd.ok) throw new Error('disparos → HTTP ' + rd.status);
    const te = await re.text(), td = await rd.text();
    // Cada archivo lleva su hash en el nombre: se comprueba aquí y no se cree.
    const he = await sha256(te), hd = await sha256(td);
    if (!he.startsWith('e853c094')) throw new Error('el espectro no calza con el hash de su nombre');
    if (!hd.startsWith('d6dc5402')) throw new Error('los disparos no calzan con el hash de su nombre');

    const esp = JSON.parse(te), tiros = JSON.parse(td);
    ajustar();
    const info = construir(esp, tiros);
    estado.datos = { esp, tiros, info };

    $('cargando').remove();
    $('lema').innerHTML = `Cada punto es una de las <b>1.024</b> formas de elegir entre
      <b>${esp.problema.K} refuerzos</b> posibles para la red. La altura es el <b>valor del objetivo</b>:
      mezcla la congestión que queda, el costo de construir y una penalidad por no gastar exactamente
      el presupuesto de ${esp.problema.k_budget}. Cuanto más bajo, mejor la decisión — el fondo del valle
      es la mejor de las 1.024.<br><br>
      <span style="color:#8a8270">Las columnas celestes son <b>${info.disparos.toLocaleString('es')} disparos reales</b>
      en la computadora cuántica ibm_marrakesh — ${info.cadenas} cadenas distintas. Cuanto más alta la
      columna, más veces salió esa respuesta.</span>`;
    $('cifras').innerHTML = `
      <div class="cifra">${info.opt.valor.toFixed(0)}<small>mejor valor de las 1.024</small></div>
      <div class="cifra" style="margin-top:14px">${info.cadenas}<small>cadenas distintas medidas</small></div>
      <div class="cifra" style="margin-top:14px">${info.maxC}<small>veces la más repetida</small></div>`;
    $('veredicto').innerHTML = `<b>hardware, no simulación</b><br>
      ibm_marrakesh · trabajo ${tiros.job_id}<br>
      <span style="color:#6b6455">El paisaje se calcula con los coeficientes publicados; los disparos son medidos.</span>`;
    $('proc').innerHTML = `Espectro <code>01_qubo_eon_case118_K10@e853c094</code> ·
      disparos <code>07_resultado_crudo@d6dc5402</code><br>
      sha256 recomputado en este navegador: <b style="color:#ffb648">${he.slice(0,12)}…</b> y
      <b style="color:#ffb648">${hd.slice(0,12)}…</b> — cada archivo calza con el hash de su propio nombre.<br>
      <span>Instancia K=10 de case118. El sello grande (K=14) es otra instancia y no se mezcla.
      El valor del objetivo NO es la congestión: la incluye junto al costo y la penalidad, así que no se
      compara con los ${esp.red.congestion_base_dc.toFixed(0)} de congestión base de la red.</span>`;
    $('pie').textContent = `case118 K=${esp.problema.K} · presupuesto ${esp.problema.k_budget} · ${esp.red.n_bus} barras`;
    bucle();
  } catch (e) {
    $('cargando').innerHTML = `no se pudo abrir la pieza: ${e.message}<br>(se dice, no se maqueta)`;
  }
})();
