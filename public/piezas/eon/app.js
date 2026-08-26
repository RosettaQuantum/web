import * as THREE from '../vendor/three.module.js';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { construirGrafo, tender } from './red.js';

// E.ON · la red de verdad, y las 8.192 respuestas de una computadora cuántica cayendo sobre ella.
//
// Tres archivos, los tres con su sha256 en el nombre, los tres recomputados aquí antes de
// dibujar nada. Si alguno no calza, no se dibuja y se dice.
const RAW = 'https://raw.githubusercontent.com/RosettaQuantum/evidence/main';
const FUENTES = [
  { clave: 'topo',     url: `${RAW}/data/2026/08/RED-case118-topologia@f35e5cf0.json`,   hash: 'f35e5cf0' },
  { clave: 'espectro', url: `${RAW}/data/2026/08/01_qubo_eon_case118_K10@e853c094.json`, hash: 'e853c094' },
  { clave: 'disparos', url: `${RAW}/data/2026/08/07_resultado_crudo@d6dc5402.json`,      hash: 'd6dc5402' },
];
const HERO = new URLSearchParams(location.search).has('hero');
const $ = (id) => document.getElementById(id);

const COL = { barra: 0xc0a874, linea: 0x8a7038, trafo: 0x49a6d4, cand: 0xffb648, elegido: 0xfff6dc, tiro: 0x7fe3ff };
const estado = { ang: 0, orbitando: !HERO, t: 0, calor: null, cursor: 0, listos: 0 };

const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, HERO ? 1.75 : 2));
document.body.appendChild(renderer.domElement);
const escena = new THREE.Scene();
escena.fog = new THREE.FogExp2(0x0a0906, 0.0032);
const camara = new THREE.PerspectiveCamera(38, 1, 1, 2000);
const controles = new OrbitControls(camara, renderer.domElement);
controles.enableDamping = true; controles.dampingFactor = 0.07; controles.enablePan = false;
escena.add(new THREE.AmbientLight(0xffffff, 1.15));
const key = new THREE.DirectionalLight(0xfff0d8, 2.0); key.position.set(1, 1.3, 0.9); escena.add(key);
const fill = new THREE.DirectionalLight(0x88b4ff, 0.85); fill.position.set(-1.1, -0.5, -1); escena.add(fill);

// ── pase de look ───────────────────────────────────────────────────────────
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
  cerca:{value:1}, lejos:{value:2000}, foco:{value:300}, rango:{value:400}, tiempo:{value:0} };
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
    col = mix(col, bor, clamp(abs(z-foco)/rango,0.,1.)*0.38);
    col += bor * smoothstep(0.30,0.72,lum(bor)) * 1.30;
    col *= 1.85;
    col = col/(col+vec3(0.92))*1.52;
    col = pow(clamp(col,0.,1.), vec3(0.88));
    col = mix(col, mix(vec3(0.026,0.021,0.013), vec3(1.00,0.96,0.88), col), 0.22);
    col = (col-0.44)*1.20 + 0.47;
    float esFondo = step(lejos*0.85, z);
    vec3 fondo = mix(vec3(0.016,0.013,0.009), vec3(0.050,0.038,0.023), smoothstep(0.,1.,vUv.y));
    fondo += vec3(0.030,0.022,0.010) * (1.0 - clamp(length(q)*1.5,0.,1.));
    col = mix(col, fondo, esFondo);
    col *= 1.0 - dot(q,q)*0.38;
    col += (ruido(vUv*res+tiempo)-0.5)*0.020;
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

// ── la red ─────────────────────────────────────────────────────────────────
let P = null, grafo = null, candAristas = [], mallaCand = null, geoCand = null, encuadre = 400;

function construirRed(topo, candidatos) {
  grafo = construirGrafo(topo);
  P = tender(grafo);
  // Distancia que mete la caja entera en cuadro, con aire. Así el encuadre del hero no
  // depende de un número a mano y sobrevive a que la red cambie.
  const media = Math.max(P.caja.x, P.caja.z) / 2;
  encuadre = (media / Math.tan(THREE.MathUtils.degToRad(camara.fov/2))) * 0.92;
  const v = (i) => new THREE.Vector3(P.px[i], P.py[i], P.pz[i]);

  // las barras
  const barras = new THREE.InstancedMesh(new THREE.SphereGeometry(1.6, 10, 8),
    new THREE.MeshStandardMaterial({ color: COL.barra, metalness: 0.3, roughness: 0.45, emissive: 0x2a1f0a }), grafo.n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Vector3(1,1,1);
  for (let i = 0; i < grafo.n; i++) { m.compose(v(i), q, e); barras.setMatrixAt(i, m); }
  escena.add(barras);

  // las 173 líneas y, distinguidos, los 13 transformadores
  const pl = [], pt = [];
  grafo.aristas.forEach(a => (a.trafo ? pt : pl).push(v(a.a), v(a.b)));
  escena.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pl),
    new THREE.LineBasicMaterial({ color: COL.linea, transparent: true, opacity: 0.75 })));
  escena.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pt),
    new THREE.LineBasicMaterial({ color: COL.trafo, transparent: true, opacity: 0.8 })));

  // los diez corredores candidatos, que son los que la máquina elige
  const porIdx = new Map(grafo.aristas.filter(a => a.idx !== null).map(a => [a.idx, a]));
  candAristas = candidatos.map((c) => {
    if (c.tipo === 'parallel') {
      const a = porIdx.get(c.detalle[0]);
      return { a: a.a, b: a.b, nueva: false, rot: `refuerzo de la línea ${c.detalle[0]}` };
    }
    return { a: grafo.indice.get(c.detalle[0]), b: grafo.indice.get(c.detalle[1]), nueva: true,
             rot: `línea nueva ${c.detalle[0]}–${c.detalle[1]}` };
  });
  const pos = new Float32Array(candAristas.length * 6);
  candAristas.forEach((c, i) => {
    pos.set([P.px[c.a], P.py[c.a], P.pz[c.a], P.px[c.b], P.py[c.b], P.pz[c.b]], i*6);
  });
  geoCand = new THREE.BufferGeometry();
  geoCand.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geoCand.setAttribute('color', new THREE.BufferAttribute(new Float32Array(candAristas.length*6), 3));
  mallaCand = new THREE.LineSegments(geoCand,
    new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95 }));
  escena.add(mallaCand);
  estado.calor = new Float64Array(candAristas.length);
  estado.brillo = new Float64Array(candAristas.length);
}

// Cada disparo del hardware es una cadena de 10 bits: qué corredores eligió la máquina
// esa vez. Se reproducen en orden, uno por cuadro: lo que se ve encenderse es lo que
// la computadora cuántica contestó, 8.192 veces.
let secuencia = [];
function prepararDisparos(tiros) {
  secuencia = [];
  for (const [cad, n] of Object.entries(tiros.counts_crudos)) {
    const bits = [];
    for (let i = 0; i < cad.length; i++) if (cad[i] === '1') bits.push(i);
    for (let k = 0; k < n; k++) secuencia.push(bits);
  }
  return secuencia.length;
}

const _c = new THREE.Color(), _cand = new THREE.Color(COL.cand), _eleg = new THREE.Color(COL.elegido);
function avanzar() {
  if (!secuencia.length) return;
  const bits = secuencia[estado.cursor % secuencia.length];
  estado.cursor++;
  for (const b of bits) { estado.brillo[b] = 1; estado.calor[b] += 1; }
  const maxCalor = Math.max(1, ...estado.calor);
  const col = geoCand.getAttribute('color');
  for (let i = 0; i < candAristas.length; i++) {
    estado.brillo[i] *= 0.90;
    const base = 0.35 + 0.85 * (estado.calor[i] / maxCalor);
    _c.copy(_cand).multiplyScalar(base).lerp(_eleg, estado.brillo[i] * 0.85);
    col.setXYZ(i*2, _c.r, _c.g, _c.b);
    col.setXYZ(i*2+1, _c.r, _c.g, _c.b);
  }
  col.needsUpdate = true;
}

function bucle() {
  requestAnimationFrame(bucle);
  ajustar();
  estado.t += 1/60;
  if (HERO) {
    // Encuadre fijo del hero: misma cámara siempre, giro lento, y el objeto arriba del
    // centro para dejar el tercio inferior despejado para el titular de la landing.
    estado.ang += 0.0016;
    const R = encuadre;
    camara.position.set(Math.cos(estado.ang)*R, R*0.22, Math.sin(estado.ang)*R);
    controles.target.set(0, P.caja.y*0.28, 0);   // el objeto sube: el tercio inferior queda libre
  } else if (estado.orbitando) {
    estado.ang += 0.0022;
    const R = encuadre;
    camara.position.set(Math.cos(estado.ang)*R, R*0.32 + Math.sin(estado.ang*0.6)*R*0.10, Math.sin(estado.ang)*R*0.92);
    controles.target.set(0, 0, 0);
  }
  controles.update();
  if (estado.calor) { avanzar(); avanzar(); avanzar(); }

  renderer.setRenderTarget(rtColor); renderer.render(escena, camara);
  uBorron.tCol.value = rtColor.texture; uBorron.dir.value.set(1/rtA.width, 0);
  renderer.setRenderTarget(rtA); renderer.render(eBorron, camQuad);
  uBorron.tCol.value = rtA.texture; uBorron.dir.value.set(0, 1/rtB.height);
  renderer.setRenderTarget(rtB); renderer.render(eBorron, camQuad);
  uFin.tCol.value = rtColor.texture; uFin.tBorroso.value = rtB.texture; uFin.tProf.value = rtColor.depthTexture;
  uFin.cerca.value = camara.near; uFin.lejos.value = camara.far;
  const dist = camara.position.distanceTo(controles.target);
  uFin.foco.value = dist; uFin.rango.value = Math.max(320, dist*1.8);  // la red es larga: un rango corto le desenfoca media
  uFin.tiempo.value = performance.now()/1000;
  renderer.setRenderTarget(null); renderer.render(eFin, camQuad);
}

async function sha256(t) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}

renderer.domElement.addEventListener('pointerdown', () => { if (!HERO) estado.orbitando = false; });
if ($('orbita')) $('orbita').onclick = () => { estado.orbitando = !estado.orbitando; };
if ($('relluvia')) $('relluvia').onclick = () => { estado.cursor = 0; estado.calor.fill(0); };

(async () => {
  try {
    const crudos = {};
    await Promise.all(FUENTES.map(async f => {
      const r = await fetch(f.url);
      if (!r.ok) throw new Error(`${f.clave} → HTTP ${r.status}`);
      const t = await r.text();
      const h = await sha256(t);
      if (!h.startsWith(f.hash)) throw new Error(`${f.clave} no calza con el hash de su nombre`);
      crudos[f.clave] = { json: JSON.parse(t), hash: h };
    }));
    const topo = crudos.topo.json, esp = crudos.espectro.json, tiros = crudos.disparos.json;

    ajustar();
    // El censo declarado tiene que calzar con lo que se va a dibujar. Si no, algo cambió
    // en la fuente y la pieza estaría mostrando una red distinta de la que dice.
    const lineas = topo.lineas.length, trafos = topo.trafos.length;
    if (lineas !== topo.censo.lineas || trafos !== topo.censo.trafos) {
      throw new Error(`el censo dice ${topo.censo.lineas} líneas y ${topo.censo.trafos} trafos, y el archivo trae ${lineas} y ${trafos}`);
    }
    construirRed(topo, esp.problema.candidatos);
    if (grafo.n !== topo.censo.buses) {
      throw new Error(`el censo dice ${topo.censo.buses} barras y el grafo armó ${grafo.n}`);
    }
    const total = prepararDisparos(tiros);
    document.body.dataset.modo = HERO ? 'hero' : 'pieza';
    $('cargando').remove();

    if (!HERO) {
      $('lema').innerHTML = `La red eléctrica de prueba <b>case118</b>: ${topo.censo.buses} subestaciones,
        <b>${topo.censo.lineas} líneas</b> y ${topo.censo.trafos} transformadores, en azul, que no son
        líneas y por eso se dibujan aparte — sin ellos cuatro subestaciones quedarían sueltas.<br><br>
        En ámbar, los <b>${esp.problema.K} refuerzos</b> que se pueden construir; hay presupuesto para
        <b>${esp.problema.k_budget}</b>. Lo que ves encenderse son las <b>${total.toLocaleString('es')} respuestas</b>
        que dio la computadora cuántica <b>ibm_marrakesh</b>, una por una. Cuanto más brilla un corredor,
        más veces lo eligió la máquina.`;
      $('cifras').innerHTML = `
        <div class="cifra">${topo.censo.lineas}<small>líneas de la red</small></div>
        <div class="cifra" style="margin-top:14px">${total.toLocaleString('es')}<small>respuestas medidas</small></div>
        <div class="cifra" style="margin-top:14px">${Object.keys(tiros.counts_crudos).length}<small>cadenas distintas</small></div>`;
      $('veredicto').innerHTML = `<b>hardware, no simulación</b><br>
        ibm_marrakesh · trabajo ${tiros.job_id}<br>
        <span style="color:#6b6455">La topología es real. La geometría es nuestra.</span>`;
      $('proc').innerHTML = `Tres archivos, cada uno con su sha256 en el nombre, recomputados en este
        navegador antes de dibujar: <b style="color:#ffb648">${crudos.topo.hash.slice(0,8)}</b> la red ·
        <b style="color:#ffb648">${crudos.espectro.hash.slice(0,8)}</b> el problema ·
        <b style="color:#ffb648">${crudos.disparos.hash.slice(0,8)}</b> los disparos. Los tres calzan.<br>
        <span>La fuente no trae coordenadas de barras: el tendido se calcula aquí con un resorte
        determinista. <b>La topología es real; la geometría es nuestra.</b> La red además se regenera
        desde pandapower y da estos mismos bytes.</span>`;
      $('pie').textContent = `case118 K=${esp.problema.K} · presupuesto ${esp.problema.k_budget}`;
    }
    bucle();
  } catch (e) {
    $('cargando').innerHTML = `no se pudo abrir la pieza: ${e.message}<br>(se dice, no se maqueta)`;
  }
})();
