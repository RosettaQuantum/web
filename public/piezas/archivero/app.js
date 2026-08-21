import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';

const BASE = 'https://rosettaquantum.com/v1';
const $ = (id) => document.getElementById(id);
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

// ── escalas: la misma historia, tres distancias ──────────────────────────────
const ESCALAS = [
  { id: 'sub',   rot: 'Lo subatómico',   sub: 'donde ocurre el cálculo',                dist: 16 },
  { id: 'algo',  rot: 'Los algoritmos',  sub: '74 catalogados, 1 medido',               dist: 132 },
  { id: 'prob',  rot: 'Los problemas',   sub: 'a lo que apuntan, y quién lo comprobó',  dist: 190 },
];

const estado = { datos: null, escala: 'algo', hover: -1, t0: performance.now() };

// ── render ──────────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0x050705, 1);
document.body.appendChild(renderer.domElement);

const escena = new THREE.Scene();
escena.fog = new THREE.Fog(0x050705, 110, 340);
const camara = new THREE.PerspectiveCamera(38, 1, 0.5, 900);
camara.position.set(64, 46, 96);   // la escala de los algoritmos, ya encuadrada
const controles = new OrbitControls(camara, renderer.domElement);
controles.enableDamping = true; controles.dampingFactor = 0.06;
controles.minDistance = 9; controles.maxDistance = 320;
controles.autoRotate = true; controles.autoRotateSpeed = 0.28;

escena.add(new THREE.AmbientLight(0xffffff, 1.55));
const luz = new THREE.DirectionalLight(0xffffff, 1.15); luz.position.set(1, 1.4, 0.8); escena.add(luz);
const luzOro = new THREE.PointLight(0xc9a24d, 60, 160, 2); escena.add(luzOro);

// ── posprocesado propio (sin dependencias) ──────────────────────────────────
const quadGeo = new THREE.PlaneGeometry(2, 2);
const camQuad = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const VERT = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`;
function paso(frag, uniforms) {
  const s = new THREE.Scene();
  const m = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });
  s.add(new THREE.Mesh(quadGeo, m));
  return { escena: s, mat: m };
}
const opciones = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
const rtColor = new THREE.WebGLRenderTarget(1, 1, opciones);
rtColor.depthTexture = new THREE.DepthTexture(1, 1);
rtColor.depthTexture.type = THREE.UnsignedIntType;
const rtA = new THREE.WebGLRenderTarget(1, 1, opciones);
const rtB = new THREE.WebGLRenderTarget(1, 1, opciones);

const uBorron = { tCol: { value: null }, dir: { value: new THREE.Vector2() } };
const borron = paso(`
  uniform sampler2D tCol; uniform vec2 dir; varying vec2 vUv;
  void main(){
    vec3 s = texture2D(tCol,vUv).rgb * 0.2270270;
    s += (texture2D(tCol,vUv+dir*1.3846).rgb + texture2D(tCol,vUv-dir*1.3846).rgb) * 0.3162162;
    s += (texture2D(tCol,vUv+dir*3.2307).rgb  + texture2D(tCol,vUv-dir*3.2307).rgb)  * 0.0702702;
    gl_FragColor = vec4(s,1.);
  }`, uBorron);

const uFin = {
  tCol: { value: null }, tBorroso: { value: null }, tProf: { value: null },
  res: { value: new THREE.Vector2() }, cerca: { value: 0.5 }, lejos: { value: 900 },
  foco: { value: 60 }, rango: { value: 90 }, tiempo: { value: 0 },
  bloom: { value: 0.85 }, umbral: { value: 0.42 }, contorno: { value: 0.9 },
};
const fin = paso(`
  uniform sampler2D tCol, tBorroso, tProf;
  uniform vec2 res; uniform float cerca, lejos, foco, rango, tiempo, bloom, umbral, contorno;
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

    // profundidad de campo: lo que está lejos del foco se va de foco
    float z = zLineal(vUv);
    float desenfoque = clamp(abs(z - foco)/rango, 0.0, 1.0);
    col = mix(col, bor, desenfoque*0.42);

    // resplandor: sólo lo que ya era brillante
    col += bor * smoothstep(umbral, umbral+0.35, lum(bor)) * bloom;

    // contorno por salto de profundidad — el borde de tinta
    float z0 = z;
    float d = 0.0;
    d = max(d, abs(zLineal(vUv+vec2(px.x,0.))-z0));
    d = max(d, abs(zLineal(vUv-vec2(px.x,0.))-z0));
    d = max(d, abs(zLineal(vUv+vec2(0.,px.y))-z0));
    d = max(d, abs(zLineal(vUv-vec2(0.,px.y))-z0));
    float borde = smoothstep(0.10, 0.55, d/max(z0*0.02,0.05));
    col = mix(col, vec3(0.008,0.015,0.011), borde*contorno);

    // curva de tono primero, y recién ahí la gradación de la casa
    col = col/(col+vec3(0.72)) * 1.42;
    col = pow(clamp(col,0.0,1.0), vec3(0.94));
    vec3 sombra  = vec3(0.016,0.030,0.022);     // el verde de la casa en el negro
    vec3 luzAlta = vec3(0.93,1.00,0.90);        // crema fría en la luz
    vec3 grad = mix(sombra, luzAlta, col);
    col = mix(col, grad, 0.34);
    col = (col - 0.5)*1.16 + 0.5;               // un punto de contraste

    // viñeta y grano
    vec2 q = vUv-0.5; float v = 1.0 - dot(q,q)*0.62;
    col *= v;
    col += (ruido(vUv*res + tiempo)-0.5)*0.022;

    gl_FragColor = vec4(col, 1.0);
  }`, uFin);

function redimensionar() {
  const w = innerWidth, h = innerHeight, dpr = renderer.getPixelRatio();
  renderer.setSize(w, h);
  camara.aspect = w/h; camara.updateProjectionMatrix();
  rtColor.setSize(w*dpr, h*dpr);
  rtA.setSize(w*dpr/4, h*dpr/4);
  rtB.setSize(w*dpr/4, h*dpr/4);
  uFin.res.value.set(w*dpr, h*dpr);
}
addEventListener('resize', redimensionar);

// ── el mundo ────────────────────────────────────────────────────────────────
const DIRS = [                                   // cuatro rumbos, uno por categoría
  new THREE.Vector3( 1, 1, 1).normalize(),
  new THREE.Vector3(-1,-1, 1).normalize(),
  new THREE.Vector3(-1, 1,-1).normalize(),
  new THREE.Vector3( 1,-1,-1).normalize(),
];
const R_ALGO = 34, R_PROB = 96;
const TINTES = [0x4a7358, 0x3f6f66, 0x556f45, 0x3d6a7a];   // cuatro regiones, un tinte cada una
const grupos = {};
let rumboOro = null;
const torres = [];           // {id, obj, algo, pos}

function baseDe(dir) {
  const a = Math.abs(dir.z) < 0.9 ? new THREE.Vector3(0,0,1) : new THREE.Vector3(1,0,0);
  const u = new THREE.Vector3().crossVectors(dir, a).normalize();
  const v = new THREE.Vector3().crossVectors(dir, u);
  return [u, v];
}
function enCasquete(dir, k, n, apertura) {
  const [u, v] = baseDe(dir);
  const t = (k + 0.5) / n;
  const ang = Math.acos(1 - t*(1 - Math.cos(apertura)));
  const phi = k * 2.399963229728653;             // ángulo áureo: reparto parejo, sin azar
  return new THREE.Vector3()
    .addScaledVector(dir, Math.cos(ang))
    .addScaledVector(u, Math.sin(ang)*Math.cos(phi))
    .addScaledVector(v, Math.sin(ang)*Math.sin(phi))
    .normalize();
}

function nucleo() {
  const g = new THREE.Group(); g.name = 'nucleo';
  const n = 900, pos = new Float32Array(n*3);
  for (let i = 0; i < n; i++) {                  // capa esférica, reparto áureo
    const y = 1 - (i/(n-1))*2, r = Math.sqrt(Math.max(0,1-y*y)), th = i*2.399963229728653;
    const rad = 4.2 + 1.6*((i*97)%13)/13;
    pos[i*3] = Math.cos(th)*r*rad; pos[i*3+1] = y*rad; pos[i*3+2] = Math.sin(th)*r*rad;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x8cffc0, size: 0.30, sizeAttenuation: true, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })));
  const centro = new THREE.Mesh(new THREE.IcosahedronGeometry(2.1, 2),
    new THREE.MeshBasicMaterial({ color: 0x2f7a52, wireframe: true, transparent: true, opacity: 0.7 }));
  g.add(centro);
  return g;
}

function construir(datos) {
  const { algos, cats } = datos;
  escena.add(nucleo());

  // cascarón de referencia: la esfera de los problemas
  const malla = new THREE.Mesh(new THREE.IcosahedronGeometry(R_PROB, 3),
    new THREE.MeshBasicMaterial({ color: 0x1e3326, wireframe: true, transparent: true, opacity: 0.38 }));
  malla.name = 'problemas'; escena.add(malla);

  const maxRef = Math.max(...algos.map(a => a.n_referencias));
  cats.forEach((cat, ci) => {
    const dir = DIRS[ci % 4];
    const suyos = algos.filter(a => a.categoria_id === cat.id);
    const g = new THREE.Group(); g.name = 'cat-' + cat.id;
    suyos.forEach((a, k) => {
      const u = enCasquete(dir, k, suyos.length, 0.72);
      const alto = 2 + 9 * Math.log(1 + a.n_referencias) / Math.log(1 + maxRef);
      const medido = !!(a.evidencia_rosetta && a.evidencia_rosetta.medido);
      const geo = new THREE.BoxGeometry(1.5, 1.5, alto);
      const mat = new THREE.MeshLambertMaterial({ color: medido ? 0xd8ad55 : TINTES[ci % 4], emissive: medido ? 0x6b4f14 : 0x0d1a12 });
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(u).multiplyScalar(R_ALGO + alto/2);
      m.lookAt(0, 0, 0);
      m.userData = { algo: a, medido };
      g.add(m);
      torres.push({ id: a.id, obj: m, algo: a, dir: u, alto });
      if (medido) {
        rumboOro = u.clone();
        luzOro.position.copy(u).multiplyScalar(R_ALGO + alto + 6);
        const haz = new THREE.Mesh(
          new THREE.CylinderGeometry(0.22, 0.9, R_PROB - R_ALGO - alto, 10, 1, true),
          new THREE.MeshBasicMaterial({ color: 0xc9a24d, transparent: true, opacity: 0.22, side: THREE.DoubleSide }));
        haz.position.copy(u).multiplyScalar((R_ALGO + alto + R_PROB) / 2);
        haz.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), u);
        haz.name = 'haz'; escena.add(haz);
        const marca = new THREE.Mesh(new THREE.TorusGeometry(5.5, 0.18, 8, 40),
          new THREE.MeshBasicMaterial({ color: 0xc9a24d }));
        marca.position.copy(u).multiplyScalar(R_PROB);
        marca.lookAt(0,0,0); escena.add(marca);
      }
    });
    escena.add(g); grupos[cat.id] = g;
  });

  // remisiones: sólo las que se pueden resolver contra el catálogo
  const porClave = {};
  algos.forEach(a => { porClave[norm(a.id)] = a.id; porClave[norm(a.nombre)] = a.id; });
  const donde = {}; torres.forEach(t => donde[t.id] = t);
  let vistas = 0, resueltas = 0;
  const lineas = new THREE.Group(); lineas.name = 'remisiones';
  algos.forEach(a => (a.remisiones || []).forEach(r => {
    vistas++;
    const destino = porClave[norm(r.ancla)];
    if (!destino || !donde[destino] || !donde[a.id]) return;
    resueltas++;
    const p = donde[a.id].obj.position, q = donde[destino].obj.position;
    const medio = p.clone().add(q).multiplyScalar(0.5).setLength(R_ALGO * 1.42);
    const curva = new THREE.QuadraticBezierCurve3(p, medio, q);
    lineas.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(curva.getPoints(28)),
      new THREE.LineBasicMaterial({ color: 0x2c8c80, transparent: true, opacity: 0.55 })));
  }));
  escena.add(lineas);
  return { vistas, resueltas };
}

// ── interfaz ────────────────────────────────────────────────────────────────
function pintarHUD(d, rem) {
  $('lema').textContent = 'El campo entero, y encima lo que Rosetta comprobó. '
    + 'Cada torre es un algoritmo; su altura, la literatura que lo sostiene.';
  const e = d.state.estado_medido;
  const cifras = [
    ['74', 'algoritmos catalogados'],
    [String(d.medidos), 'medidos por Rosetta', true],
    [String(e.corridas_selladas), 'corridas selladas'],
    [String(e.victorias_cuanticas_medidas), 'victorias medidas', true],
  ];
  $('contadores').innerHTML = cifras.map(([n, t, oro]) =>
    `<div class="cifra${oro ? ' oro' : ''}">${n}<small>${t}</small></div>`).join('');
  $('aviso').textContent = d.aviso;
  $('proc').innerHTML = `Catálogo: ${d.proc.fuente} · instantánea sha256 ${d.proc.instantanea_sha256}<br>
    Remisiones dibujadas: ${rem.resueltas} de ${rem.vistas} — las demás apuntan a anclas de la fuente
    que el catálogo no resuelve contra un id, y no se inventan.<br>
    Estado del ledger: <a style="color:#2c8c80" href="${BASE}/state" target="_blank">/v1/state</a> ·
    catálogo: <a style="color:#2c8c80" href="${BASE}/algorithms?limit=100" target="_blank">/v1/algorithms</a>`;

  $('escalas').innerHTML = '';
  ESCALAS.forEach(s => {
    const b = document.createElement('button');
    b.innerHTML = `${s.rot}<small>${s.sub}</small>`;
    b.setAttribute('aria-pressed', String(s.id === estado.escala));
    b.onclick = () => irA(s);
    $('escalas').appendChild(b);
  });
}

let objetivoDist = null;
function irA(s) {
  estado.escala = s.id; objetivoDist = s.dist;
  [...$('escalas').children].forEach((b, i) => b.setAttribute('aria-pressed', String(ESCALAS[i].id === s.id)));
}

const rayo = new THREE.Raycaster();
const puntero = new THREE.Vector2();
addEventListener('pointermove', (ev) => {
  puntero.x = (ev.clientX/innerWidth)*2-1;
  puntero.y = -(ev.clientY/innerHeight)*2+1;
  rayo.setFromCamera(puntero, camara);
  const hit = rayo.intersectObjects(torres.map(t => t.obj));
  const f = $('ficha');
  if (hit.length) {
    const a = hit[0].object.userData.algo, med = hit[0].object.userData.medido;
    f.style.display = 'block';
    f.style.left = Math.min(ev.clientX+16, innerWidth-350)+'px';
    f.style.top  = Math.min(ev.clientY+16, innerHeight-190)+'px';
    f.innerHTML = `<div class="cat">${a.categoria}</div><b>${a.nombre}</b><br>${a.problema}<br>
      <span style="color:#7d8f79">aceleración declarada por ${a.declarado_por}:</span> ${a.speedup_declarado}<br>
      <span style="color:#7d8f79">${a.n_referencias} referencias · ${a.implementaciones.length} implementaciones</span><br>
      <span class="${med ? 'oro' : ''}">${med
        ? 'MEDIDO por Rosetta · ' + a.evidencia_rosetta.recetas.map(r => r.recipe_id+' ('+r.estado+')').join(', ')
        : a.evidencia_rosetta.lectura}</span>`;
  } else f.style.display = 'none';
});

// ── bucle ───────────────────────────────────────────────────────────────────
function bucle() {
  requestAnimationFrame(bucle);
  const t = (performance.now() - estado.t0)/1000;
  if (objetivoDist !== null) {
    const d = camara.position.length();
    const nd = d + (objetivoDist - d) * 0.045;
    camara.position.setLength(nd);
    if (Math.abs(nd - objetivoDist) < 0.6) objetivoDist = null;
  }
  controles.update();
  luzOro.intensity = 55 + Math.sin(t*1.6)*12;

  renderer.setRenderTarget(rtColor);
  renderer.clear();
  renderer.render(escena, camara);

  uBorron.tCol.value = rtColor.texture;
  uBorron.dir.value.set(1/rtA.width, 0);
  renderer.setRenderTarget(rtA); renderer.render(borron.escena, camQuad);
  uBorron.tCol.value = rtA.texture;
  uBorron.dir.value.set(0, 1/rtB.height);
  renderer.setRenderTarget(rtB); renderer.render(borron.escena, camQuad);

  uFin.tCol.value = rtColor.texture;
  uFin.tBorroso.value = rtB.texture;
  uFin.tProf.value = rtColor.depthTexture;
  uFin.cerca.value = camara.near; uFin.lejos.value = camara.far;
  uFin.foco.value = Math.max(20, camara.position.length() - 34);
  uFin.rango.value = Math.max(55, camara.position.length()*1.05);
  uFin.tiempo.value = t;
  renderer.setRenderTarget(null);
  renderer.render(fin.escena, camQuad);
}

// Mando de look: se ajusta en vivo desde la consola del navegador y se copia al código.
window.rq = { camara, controles, escena, estado, uFin, torres, irA, ESCALAS };

// ── arranque ────────────────────────────────────────────────────────────────
(async () => {
  try {
    const traer = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(u+' → HTTP '+r.status); return r.json(); };
    const [cat, alg, st] = await Promise.all([
      traer(`${BASE}/categories`), traer(`${BASE}/algorithms?limit=100`), traer(`${BASE}/state`),
    ]);
    const datos = {
      cats: cat.categorias, algos: alg.items, state: st,
      aviso: alg.aviso, proc: alg.procedencia,
      medidos: alg.items.filter(a => a.evidencia_rosetta && a.evidencia_rosetta.medido).length,
    };
    if (datos.algos.length !== cat.total) throw new Error(`el catálogo dice ${cat.total} y llegaron ${datos.algos.length}`);
    estado.datos = datos;
    $('cargando').remove();
    redimensionar();
    const rem = construir(datos);
    pintarHUD(datos, rem);
    estado.escala = 'algo';
    if (rumboOro) {
      // el cuadro cuenta la escala entera: el núcleo, la única torre medida y su haz saliendo
      const arriba = new THREE.Vector3(0, 1, 0);
      const lado = new THREE.Vector3().crossVectors(rumboOro, arriba).normalize();
      camara.position.copy(lado).multiplyScalar(96).addScaledVector(arriba, 34).addScaledVector(rumboOro, 18);
      controles.target.copy(rumboOro).multiplyScalar(26);
      controles.update();
    }
    bucle();
  } catch (e) {
    $('cargando').innerHTML = `no se pudo armar el mundo: ${e.message}<br>(se dice, no se maqueta)`;
  }
})();
