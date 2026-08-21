import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';

// El artefacto que el sello RQ-EXP-EON-CASE118-001 nombra por hash. Se baja tal cual,
// se recomputa su sha256 en el navegador y se compara contra el que declara el sello:
// si no calza, la pieza no se dibuja y lo dice.
const SELLO = 'https://rosettaquantum.com/v1/archive/RQ-EXP-EON-CASE118-001';
const ARTEFACTO = 'https://raw.githubusercontent.com/RosettaQuantum/evidence/main/resultados_eon/eon_case118@a3340c06.json';
const $ = (id) => document.getElementById(id);

const SOLVERS = [
  { id: 'exact',     rot: 'Óptimo exacto',  sub: 'el árbitro, por fuerza bruta' },
  { id: 'classical', rot: 'CP-SAT',         sub: 'el campeón clásico' },
  { id: 'quantum',   rot: 'QAOA',           sub: 'el brazo cuántico' },
];
const estado = { art: null, sello: null, solver: 'exact', orbitando: true, ang: 0, mezcla: {} };

const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);
const escena = new THREE.Scene();
escena.fog = new THREE.FogExp2(0x0a0906, 0.0065);
const camara = new THREE.PerspectiveCamera(40, 1, 0.5, 900);
const controles = new OrbitControls(camara, renderer.domElement);
controles.enableDamping = true; controles.dampingFactor = 0.07;

escena.add(new THREE.AmbientLight(0xffffff, 1.05));
const key = new THREE.DirectionalLight(0xfff0d8, 2.4); key.position.set(1, 1.3, 1.1); escena.add(key);
const fill = new THREE.DirectionalLight(0x88b4ff, 1.0); fill.position.set(-1.2, -0.5, -0.9); escena.add(fill);

// ── pase de look (el mismo lenguaje que CRISTAL, en ámbar) ──────────────────
const quadGeo = new THREE.PlaneGeometry(2, 2);
const camQuad = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const VERT = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`;
const pasada = (frag, u) => { const e = new THREE.Scene();
  e.add(new THREE.Mesh(quadGeo, new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms: u, depthTest: false, depthWrite: false }))); return e; };
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
  cerca:{value:0.5}, lejos:{value:900}, foco:{value:90}, rango:{value:120}, tiempo:{value:0} };
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
    col = mix(col, bor, clamp(abs(z-foco)/rango,0.,1.)*0.45);
    col += bor * smoothstep(0.40,0.80,lum(bor)) * 1.05;
    float d=0.;
    d=max(d,abs(zLin(vUv+vec2(px.x,0.))-z)); d=max(d,abs(zLin(vUv-vec2(px.x,0.))-z));
    d=max(d,abs(zLin(vUv+vec2(0.,px.y))-z)); d=max(d,abs(zLin(vUv-vec2(0.,px.y))-z));
    col = mix(col, vec3(0.012,0.010,0.006), smoothstep(0.10,0.55,d/max(z*0.02,0.05))*0.85);
    col *= 1.75;
    col = col/(col+vec3(0.92))*1.52;
    col = pow(clamp(col,0.,1.), vec3(0.88));
    col = mix(col, mix(vec3(0.030,0.024,0.014), vec3(1.00,0.96,0.88), col), 0.22);
    col = (col-0.44)*1.20 + 0.47;
    float fondoP = step(lejos*0.85, z);
    vec3 fondo = mix(vec3(0.020,0.017,0.011), vec3(0.055,0.043,0.026), smoothstep(0.,1.,vUv.y));
    fondo += vec3(0.035,0.026,0.012) * (1.0 - clamp(length(q)*1.5,0.,1.));
    col = mix(col, fondo, fondoP);
    col *= 1.0 - dot(q,q)*0.42;
    col += (ruido(vUv*res+tiempo)-0.5)*0.024;
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

// ── el mundo: dos anillos, uno de líneas y otro de barras ───────────────────
// El ángulo es el ÍNDICE que declara el sello, no la geografía: la topología de la
// red no está publicada, así que no se dibuja un mapa que no tenemos.
const R_LINEA = 46, R_BUS = 27;
const candidatos = [];

const enAnillo = (i, n, r, y = 0) => {
  const a = (i / n) * Math.PI * 2 - Math.PI / 2;
  return new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
};

function anilloDeFondo(n, r, tam, color) {
  const g = new THREE.InstancedMesh(new THREE.SphereGeometry(tam, 10, 8),
    new THREE.MeshLambertMaterial({ color }), n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < n; i++) m.compose(enAnillo(i, n, r), q, e), g.setMatrixAt(i, m);
  escena.add(g);
  return g;
}

function construir(art) {
  const nL = art.params.n_lines, nB = art.params.n_buses;
  anilloDeFondo(nL, R_LINEA, 0.30, 0x4a3d22);     // las 173 líneas existentes
  anilloDeFondo(nB, R_BUS, 0.42, 0x3b4a5c);       // las 118 barras

  art.grid_physics.candidates.forEach((c, i) => {
    const g = new THREE.Group();
    if (c.type === 'parallel') {                   // refuerzo de una línea que ya existe
      const p = enAnillo(c.detail[0], nL, R_LINEA);
      const torre = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 7, 12),
        new THREE.MeshStandardMaterial({ color: 0x8a6f38, metalness: 0.35, roughness: 0.35, emissive: 0x241a08 }));
      torre.position.copy(p).setY(3.5);
      g.add(torre);
      g.userData.foco = p.clone().setY(3.5);
    } else {                                       // línea nueva entre dos barras
      const a = enAnillo(c.detail[0], nB, R_BUS), b = enAnillo(c.detail[1], nB, R_BUS);
      const medio = a.clone().add(b).multiplyScalar(0.5).setY(11);
      const curva = new THREE.QuadraticBezierCurve3(a, medio, b);
      const tubo = new THREE.Mesh(new THREE.TubeGeometry(curva, 40, 0.34, 8, false),
        new THREE.MeshStandardMaterial({ color: 0x8a6f38, metalness: 0.35, roughness: 0.35, emissive: 0x241a08 }));
      g.add(tubo);
      g.userData.foco = medio.clone();
    }
    g.userData.cand = c; g.userData.i = i;
    escena.add(g);
    candidatos.push(g);
  });
}

// ── selección: qué eligió cada solucionador ─────────────────────────────────
const APAGADO = new THREE.Color(0x6b5730), ENCENDIDO = new THREE.Color(0xffb648);
function pintarSeleccion(suave) {
  const x = estado.art[estado.solver].x;
  candidatos.forEach((g, i) => {
    const meta = estado.mezcla[i] === undefined ? 0 : estado.mezcla[i];
    const objetivo = x[i] ? 1 : 0;
    const t = suave ? meta + (objetivo - meta) * 0.10 : objetivo;
    estado.mezcla[i] = t;
    g.traverse(o => {
      if (!o.isMesh) return;
      o.material.color.copy(APAGADO).lerp(ENCENDIDO, t);
      o.material.emissive.setRGB(0.14 * t + 0.02, 0.10 * t + 0.015, 0.03 * t + 0.008);
      o.material.emissiveIntensity = 0.6 + 1.6 * t;
    });
    g.scale.setScalar(1 + 0.22 * t);
  });
}

// ── interfaz ────────────────────────────────────────────────────────────────
function pintarHUD() {
  const a = estado.art, s = a[estado.solver];
  const base = a.grid_physics.base_congestion_dc;
  const caida = (1 - s.value / base) * 100;
  $('lema').innerHTML = `La red tiene <b>${a.params.n_buses} barras</b> y <b>${a.params.n_lines} líneas</b>.
    Hay <b>${a.params.n_candidates} refuerzos posibles</b> y presupuesto para <b>${a.params.k_budget}</b>.
    Elegir bien baja la congestión; elegir mal, casi nada.<br><br>
    <span style="color:#6b6455">El ángulo de cada marca es su índice en el sello, no su lugar en el mapa:
    la topología de la red no está publicada y no se dibuja lo que no se tiene.</span>`;
  $('cifras').innerHTML = `
    <div class="cifra">${s.value.toFixed(0)}<small>congestión resultante · desde ${base.toFixed(0)}</small></div>
    <div class="cifra" style="margin-top:14px">${caida.toFixed(1)}%<small>de caída</small></div>
    <div class="cifra" style="margin-top:14px">${s.runtime_s.toFixed(3)} s<small>en encontrarlo</small></div>`;
  const v = a.verdict;
  $('veredicto').innerHTML = `<b>${v.outcome}</b><br>
    QAOA quedó ${v.quantum_gap_pct}% peor en valor y tardó
    ${(a.quantum.runtime_s / a.classical.runtime_s).toFixed(0)}× más que CP-SAT.<br>
    <span style="color:#6b6455">El óptimo exacto es el árbitro, no un competidor.</span>`;
  $('pie').textContent = `${a.instance} · ${estado.solver} · elige ${s.n_selected} de ${a.params.n_candidates}`;
  [...$('solvers').children].forEach((b, i) => b.setAttribute('aria-pressed', String(SOLVERS[i].id === estado.solver)));
}

function pintarProcedencia(ok, hash) {
  $('proc').innerHTML = `Sello <b style="color:#9a9382">RQ-EXP-EON-CASE118-001</b> ·
    artefacto <code>eon_case118@a3340c06.json</code><br>
    sha256 recomputado en este navegador: <b style="color:${ok ? '#ffb648' : '#ff5c5c'}">${hash}</b>
    ${ok ? '— calza con el que declara el sello' : '— NO CALZA con el sello'}<br>
    <span>El flujo AC no convergió en esta corrida: el sello lo declara y aquí se repite en vez de callarlo.</span>`;
}

// ── arranque ────────────────────────────────────────────────────────────────
async function sha256(texto) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}

function bucle() {
  requestAnimationFrame(bucle);
  ajustar();
  if (estado.orbitando) {
    estado.ang += 0.0026;
    const R = 118;
    camara.position.set(Math.cos(estado.ang) * R, 46 + Math.sin(estado.ang * 0.6) * 16, Math.sin(estado.ang) * R * 0.92);
    controles.target.set(0, 4, 0);
  }
  controles.update();
  pintarSeleccion(true);

  renderer.setRenderTarget(rtColor); renderer.render(escena, camara);
  uBorron.tCol.value = rtColor.texture; uBorron.dir.value.set(1 / rtA.width, 0);
  renderer.setRenderTarget(rtA); renderer.render(eBorron, camQuad);
  uBorron.tCol.value = rtA.texture; uBorron.dir.value.set(0, 1 / rtB.height);
  renderer.setRenderTarget(rtB); renderer.render(eBorron, camQuad);
  uFin.tCol.value = rtColor.texture; uFin.tBorroso.value = rtB.texture; uFin.tProf.value = rtColor.depthTexture;
  uFin.cerca.value = camara.near; uFin.lejos.value = camara.far;
  const dist = camara.position.distanceTo(controles.target);
  uFin.foco.value = dist; uFin.rango.value = Math.max(40, dist * 0.9);
  uFin.tiempo.value = performance.now() / 1000;
  renderer.setRenderTarget(null); renderer.render(eFin, camQuad);
}

renderer.domElement.addEventListener('pointerdown', () => { estado.orbitando = false; });
$('orbita').onclick = () => { estado.orbitando = !estado.orbitando; };

(async () => {
  try {
    const [rs, ra] = await Promise.all([fetch(SELLO), fetch(ARTEFACTO)]);
    if (!rs.ok) throw new Error('sello → HTTP ' + rs.status);
    if (!ra.ok) throw new Error('artefacto → HTTP ' + ra.status);
    const sello = await rs.json();
    const crudo = await ra.text();
    const hash = await sha256(crudo);
    const declarado = sello.archivo_sellado.w6.que.artefacto.sha256.replace(/^sha256:/, '');
    if (hash !== declarado) throw new Error(`el artefacto no calza con el sello (${hash.slice(0,12)}… ≠ ${declarado.slice(0,12)}…)`);

    estado.sello = sello;
    estado.art = JSON.parse(crudo);
    $('cargando').remove();
    ajustar();
    construir(estado.art);
    pintarSeleccion(false);

    SOLVERS.forEach(s => {
      const b = document.createElement('button');
      b.innerHTML = s.rot;
      b.title = s.sub;
      b.onclick = () => { estado.solver = s.id; pintarHUD(); };
      $('solvers').appendChild(b);
    });
    pintarHUD();
    pintarProcedencia(true, hash.slice(0, 16) + '…');
    bucle();
  } catch (e) {
    $('cargando').innerHTML = `no se pudo abrir la pieza: ${e.message}<br>(se dice, no se maqueta)`;
  }
})();
