// Pieza del home · Cleveland: la caminata cuántica sobre la proteína.
//
// Vive dentro de un contenedor, no del viewport. No deja globales, no dibuja HUD y
// no arranca hasta que la sección entra en pantalla. Si la API no responde, no pasa
// nada: el texto de la sección ya trae las cifras horneadas en el build y esto era
// sólo la capa de encima.
import * as THREE from '/piezas/vendor/three.module.min.js';
import { OrbitControls } from '/piezas/vendor/OrbitControls.home.js';
import * as CW from '/piezas/cleveland/caminata.js';

const BASE = 'https://rosettaquantum.com/v1';
const RETRATO = { fov: 40, dpr: 1.75 };

// OFICIAL — paleta de marca (28-ago), sobre el basalto del sitio. Reemplaza a CRISTAL,
// que era un color de laboratorio elegido antes de que existiera el logo. La rampa de
// probabilidad usa los mismos tres tonos que gradientQ en brand-kit/docs/colors.json:
// navy en el suelo, cian y oro en el pico — no son colores nuevos, son los del kit.
const PALETAS = {
  cristal: {
    fondoAlto: 0x1b1038, fondoBajo: 0x05030e, niebla: 0x0d0722,
    rampa: [0x101a3a, 0x2f7ad6, 0x9df6ff], acento: 0xff4fd8, traza: 0xff4fd8,
  },
  oficial: {
    fondoAlto: 0x1f1c18, fondoBajo: 0x100e0b, niebla: 0x141210,   // --basalt-2 / --basalt-3 / --basalt
    rampa: [0x0b1220, 0x05e8ee, 0xf6c254],                        // navy · cyan · gold, de colors.json
    acento: 0xf6c254, traza: 0x2370c9,                             // gold · blue
  },
};
let LOOK = PALETAS.oficial;

const v3 = (hex) => new THREE.Vector3(((hex>>16)&255)/255, ((hex>>8)&255)/255, (hex&255)/255);

export function montar(contenedor, { pdb, target, paleta = 'oficial', hero = false }) {
  LOOK = PALETAS[paleta] || PALETAS.oficial;
  // El hero es la portada: cámara fija en el mismo punto relativo, sin arrastre, y la
  // composición sube un poco más para dejar el tercio inferior libre para el titular.
  const desviacionVertical = hero ? 0.95 : 0.35;
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, RETRATO.dpr));
  contenedor.appendChild(renderer.domElement);
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';

  const escena = new THREE.Scene();
  escena.fog = new THREE.FogExp2(LOOK.niebla, 0.006);
  escena.add(new THREE.AmbientLight(0xffffff, 0.75));
  const key = new THREE.DirectionalLight(0xa8d8ff, 2.2); key.position.set(1, 1.1, 1.2); escena.add(key);
  const fill = new THREE.DirectionalLight(0xff5fd0, 1.25); fill.position.set(-1.3, -0.5, -0.9); escena.add(fill);

  const camara = new THREE.PerspectiveCamera(RETRATO.fov, 1, 0.1, 4000);
  const controles = new OrbitControls(camara, renderer.domElement);
  controles.enableDamping = true; controles.dampingFactor = 0.07;
  controles.enablePan = false;
  controles.enabled = !hero;   // el hero no se toca: se mira

  // ── pase de look ─────────────────────────────────────────────────────────
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
  const uFin = { tCol:{value:null}, tBorroso:{value:null}, tProf:{value:null},
    res:{value:new THREE.Vector2()}, cerca:{value:0.1}, lejos:{value:4000},
    foco:{value:60}, rango:{value:90}, tiempo:{value:0},
    fondoAlto:{value:v3(LOOK.fondoAlto)}, fondoBajo:{value:v3(LOOK.fondoBajo)} };
  const eFin = pasada(`
    uniform sampler2D tCol, tBorroso, tProf; uniform vec2 res;
    uniform float cerca, lejos, foco, rango, tiempo; uniform vec3 fondoAlto, fondoBajo;
    varying vec2 vUv;
    float zLin(vec2 uv){ float d=texture2D(tProf,uv).x, z=d*2.-1.; return (2.*cerca*lejos)/(lejos+cerca-z*(lejos-cerca)); }
    float lum(vec3 c){ return dot(c, vec3(0.2126,0.7152,0.0722)); }
    float ruido(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
    void main(){
      vec2 px = 1.0/res, q = vUv-0.5;
      vec3 col = texture2D(tCol,vUv).rgb, bor = texture2D(tBorroso,vUv).rgb;
      float z = zLin(vUv);
      col = mix(col, bor, clamp(abs(z-foco)/rango,0.,1.)*0.42);
      col += bor * smoothstep(0.34,0.70,lum(bor)) * 1.35;
      float d=0.;
      d=max(d,abs(zLin(vUv+vec2(px.x,0.))-z)); d=max(d,abs(zLin(vUv-vec2(px.x,0.))-z));
      d=max(d,abs(zLin(vUv+vec2(0.,px.y))-z)); d=max(d,abs(zLin(vUv-vec2(0.,px.y))-z));
      col = mix(col, vec3(0.10,0.06,0.19), smoothstep(0.10,0.55,d/max(z*0.02,0.05))*0.25);
      col *= 1.9;
      col = col/(col+vec3(0.92))*1.52;
      col = pow(clamp(col,0.,1.), vec3(0.86));
      col = mix(col, mix(vec3(0.040,0.024,0.078), vec3(0.94,0.91,1.00), col), 0.22);
      col = (col-0.44)*1.20 + 0.47;
      float esFondo = step(lejos*0.85, z);
      vec3 fondo = mix(fondoBajo, fondoAlto, smoothstep(0.,1.,vUv.y));
      fondo += (fondoAlto-fondoBajo)*0.5 * (1.0 - clamp(length(q)*1.5,0.,1.));
      col = mix(col, fondo, esFondo);
      col *= 1.0 - dot(q,q)*0.42;
      col += (ruido(vUv*res+tiempo)-0.5)*0.016;
      gl_FragColor = vec4(max(col,vec3(0.)),1.0);
    }`, uFin);

  let ultW = 0, ultH = 0;
  function ajustar() {
    const w = contenedor.clientWidth, h = contenedor.clientHeight;
    if (w < 2 || h < 2) return false;
    // Se compara contra el último tamaño aplicado, NO contra el CSS del lienzo: el lienzo
    // está fijado a 100% y su clientWidth siempre iguala al contenedor, así que ese chequeo
    // salía verdadero siempre y el búfer se quedaba en el tamaño por omisión.
    if (ultW === w && ultH === h) return true;
    ultW = w; ultH = h;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    camara.aspect = w/h; camara.updateProjectionMatrix();
    const dpr = renderer.getPixelRatio();
    const W = Math.max(2, Math.floor(w*dpr)), H = Math.max(2, Math.floor(h*dpr));
    if (rtColor.depthTexture) rtColor.depthTexture.dispose();
    const prof = new THREE.DepthTexture(W, H); prof.type = THREE.UnsignedIntType;
    rtColor.depthTexture = prof;
    rtColor.setSize(W, H); rtA.setSize(W>>2, H>>2); rtB.setSize(W>>2, H>>2);
    uFin.res.value.set(W, H);
    return true;
  }

  // ── la molécula ──────────────────────────────────────────────────────────
  const rampa = (t) => {
    const a = new THREE.Color(LOOK.rampa[0]), b = new THREE.Color(LOOK.rampa[1]), c = new THREE.Color(LOOK.rampa[2]);
    return t < 0.5 ? a.lerp(b, t/0.5) : b.lerp(c, (t-0.5)/0.5);
  };
  let malla = null, datos = null, red = null, walk = null, prob = null, lap = false;
  let acum = 0, ang = 0, centro = null, radio = 60, vivo = false, corriendo = false;

  function construir(d) {
    datos = d;
    malla = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 16, 12),
      new THREE.MeshStandardMaterial({ metalness: 0.25, roughness: 0.22, emissive: 0x0a1428, emissiveIntensity: 0.9 }), d.n);
    escena.add(malla);
    escena.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(d.coords.map(c => new THREE.Vector3().fromArray(c))),
      new THREE.LineBasicMaterial({ color: LOOK.traza, transparent: true, opacity: 0.45 })));
    d.src.forEach(i => {
      const a = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.14, 8, 26),
        new THREE.MeshBasicMaterial({ color: LOOK.acento }));
      a.position.fromArray(d.coords[i]); a.userData.mira = true; escena.add(a);
    });
    d.sites.forEach(s => {
      const r = 3.2 + 1.0*Math.cbrt(s.n_residues);
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1),
        new THREE.MeshBasicMaterial({ color: LOOK.acento, wireframe: true, transparent: true, opacity: 0.5 }));
      b.position.fromArray(s.centroid); escena.add(b);
    });
    const caja = new THREE.Box3();
    d.coords.forEach(c => caja.expandByPoint(new THREE.Vector3().fromArray(c)));
    const esf = caja.getBoundingSphere(new THREE.Sphere());
    centro = esf.center.clone(); radio = esf.radius;
    camara.near = radio/100; camara.far = radio*40; camara.updateProjectionMatrix();
    controles.target.copy(centro);
    escena.fog.density = 0.9/(radio*8);
    prob = new Float64Array(d.n);
  }

  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Vector3(), _v = new THREE.Vector3();
  function pintar() {
    let max = 0;
    for (let i = 0; i < prob.length; i++) if (prob[i] > max) max = prob[i];
    if (max <= 0) return;
    for (let i = 0; i < prob.length; i++) {
      const t = Math.sqrt(prob[i]/max), r = 0.45 + 1.25*t;
      _m.compose(_v.fromArray(datos.coords[i]), _q, _e.set(r, r, r));
      malla.setMatrixAt(i, _m);
      malla.setColorAt(i, rampa(t));
    }
    malla.instanceMatrix.needsUpdate = true;
    malla.instanceColor.needsUpdate = true;
  }

  function cuadro() {
    if (!corriendo) return;
    requestAnimationFrame(cuadro);
    if (!ajustar()) return;
    if (!quieto) {
      ang += 0.0026;
      const R = radio*(hero ? 2.7 : 2.35);
      camara.position.set(
        centro.x + Math.cos(ang)*R*1.12,
        centro.y + Math.sin(ang*0.5)*R*0.30 + radio*desviacionVertical,
        centro.z + Math.sin(ang)*R*0.86);
    }
    controles.update();
    escena.children.forEach(o => { if (o.userData.mira) o.quaternion.copy(camara.quaternion); });
    if (!quieto && red && walk) {
      acum += 0.75;
      while (acum >= 1) { CW.paso(red, walk, 0.01, lap); acum -= 1; }
      if (walk.t > 8.0) walk = CW.nuevoEstado(red, datos.src);
      CW.probabilidad(walk, prob);
      pintar();
    }
    dibujar();
  }

  // Un cuadro suelto, fuera del bucle: se usa al montar y cuando el visitante pide
  // movimiento reducido. Sin esto, un navegador que no entrega cuadros deja el lienzo
  // en blanco y la pieza se ve rota sin estarlo.
  function dibujar() {
    renderer.setRenderTarget(rtColor); renderer.render(escena, camara);
    uBorron.tCol.value = rtColor.texture; uBorron.dir.value.set(1/rtA.width, 0);
    renderer.setRenderTarget(rtA); renderer.render(eBorron, camQuad);
    uBorron.tCol.value = rtA.texture; uBorron.dir.value.set(0, 1/rtB.height);
    renderer.setRenderTarget(rtB); renderer.render(eBorron, camQuad);
    uFin.tCol.value = rtColor.texture; uFin.tBorroso.value = rtB.texture; uFin.tProf.value = rtColor.depthTexture;
    uFin.cerca.value = camara.near; uFin.lejos.value = camara.far;
    const dist = camara.position.distanceTo(controles.target);
    uFin.foco.value = dist; uFin.rango.value = Math.max(18, dist*0.9);
    uFin.tiempo.value = performance.now()/1000;
    renderer.setRenderTarget(null); renderer.render(eFin, camQuad);
  }

  function arrancar() { if (corriendo || !vivo) return; corriendo = true; cuadro(); }
  function parar() { corriendo = false; }

  const ojo = new IntersectionObserver(([e]) => { e.isIntersecting ? arrancar() : parar(); }, { threshold: 0.05 });
  ojo.observe(contenedor);
  addEventListener('resize', ajustar);

  (async () => {
    try {
      const traer = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(u + ' → HTTP ' + r.status); return r.json(); };
      const [reto, estructura] = await Promise.all([
        traer(`${BASE}/challenges/cleveland-2026-07`),
        traer(`${BASE}/structures/${pdb}`),
      ]);
      const d = reto.proteinas[target].datos;
      construir(d);
      const par = CW.parametrosDeRed(estructura);
      if (par) {
        red = CW.construirRed(d.coords, par);
        const ventana = [0.5, 8.0];
        const a = CW.spearman(CW.promedioEnVentana(red, d.src, ventana, false), d.ctqw);
        const l = CW.spearman(CW.promedioEnVentana(red, d.src, ventana, true), d.ctqw);
        lap = Math.abs(l) > Math.abs(a);
        walk = CW.nuevoEstado(red, d.src);
        contenedor.dispatchEvent(new CustomEvent('pieza:lista', { bubbles: true,
          detail: { rho: lap ? l : a, hamiltoniano: lap ? 'L' : 'A', nodos: red.n,
                    aristas: red.vec.reduce((s, x) => s + x.length, 0)/2 } }));
      }
      for (let i = 0; i < d.n; i++) prob[i] = i === d.src[0] ? 1 : 0;
      pintar();
      ajustar();          // sin esto el lienzo se queda en los 300x150 por omisión
                          // hasta el primer cuadro, y el primer cuadro puede no llegar.
      const R0 = radio*(hero ? 2.7 : 2.35);
      camara.position.set(centro.x + R0*1.12, centro.y + radio*desviacionVertical, centro.z + R0*0.10);
      controles.update();
      escena.children.forEach(o => { if (o.userData.mira) o.quaternion.copy(camara.quaternion); });
      dibujar();
      vivo = true;
      contenedor.dataset.estado = 'vivo';
      arrancar();
    } catch (e) {
      contenedor.dataset.estado = 'sin-lienzo';
      contenedor.dispatchEvent(new CustomEvent('pieza:falla', { bubbles: true, detail: { mensaje: e.message } }));
    }
  })();

  return { parar, arrancar };
}
