/*
 * «Sume los años» en vivo — /es/q-ready y /q-ready. 25-nov-2026.
 *
 * El servidor ya pintó el perfil de ejemplo con public/js/mosca-nucleo.mjs; esto toma la figura, mide
 * su ancho real y la vuelve a pintar con el MISMO `svgMosca()`: a ese ancho, 13 px de texto son 13 px
 * (el dibujo del servidor es de 760 unidades y en un teléfono se achicaba). Sin este archivo la figura
 * queda como la dejó el servidor, completa y correcta.
 *
 * Animación: la entrada ocurre una vez, cuando la figura aparece en pantalla (las barras crecen, sube
 * la amenaza, cae la línea de protección). Al mover un control, el dibujo viaja del estado anterior al
 * nuevo en ~0,4 s. Con prefers-reduced-motion no hay ni una ni otra: el mismo contenido, de una vez.
 *
 * Lector de pantalla: cada control anuncia su valor («9 años»); el veredicto se anuncia en una región
 * aparte, con una pausa, para no leer veinte veredictos mientras alguien arrastra el control.
 */
import { tramosDe, cuenta, finEje, veredicto, svgMosca, anios } from "./mosca-nucleo.mjs";

const fig = document.getElementById("mo");
if (fig) {
  let D;
  try { D = JSON.parse(fig.dataset.mosca); } catch { D = null; }
  if (D) montar(fig, D);
}

function montar(fig, D) {
  const T = D.textos, tramos = tramosDe(D.qday), ahora = D.ahora;
  const lienzo = fig.querySelector(".mo-lienzo");
  const inM = fig.querySelector("#mo-migracion"), inS = fig.querySelector("#mo-secreto");
  const outM = fig.querySelector("#mo-migracion-v"), outS = fig.querySelector("#mo-secreto-v");
  const titulo = fig.querySelector(".mo-v-titulo"), linea = fig.querySelector(".mo-v-linea");
  const anuncio = fig.querySelector("#mo-anuncio"), reset = fig.querySelector(".mo-reset");
  const quieto = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Estado: lo que se DIBUJA (cur, puede ser fraccionario a mitad de una transición) y lo pedido (obj).
  const obj = { migracion: D.perfil.migracion, secreto: D.perfil.secreto };
  const cur = { ...obj, fin: finEje(ahora + obj.migracion + obj.secreto, tramos) };
  let rev = { m: 1, s: 1, l: 1, t: 1 }, ancho = 0, anim = 0, aviso = 0;

  const pintar = () => {
    lienzo.innerHTML = svgMosca({ ancho, ahora, secreto: cur.secreto, migracion: cur.migracion, fin: cur.fin,
      tramos, rev, textos: T, final: obj });
  };
  const medir = () => { const w = lienzo.clientWidth; if (w && Math.abs(w - ancho) >= 1) { ancho = w; pintar(); } };

  const textos = () => {
    const c = cuenta({ ahora, secreto: obj.secreto, migracion: obj.migracion, tramos });
    const v = veredicto(c, T);
    titulo.textContent = v.titulo;
    titulo.classList.toggle("mo-tarde", c.tarde);
    titulo.classList.toggle("mo-a-tiempo", !c.tarde);
    linea.textContent = v.linea;
    outM.textContent = obj.migracion; outS.textContent = obj.secreto;
    inM.setAttribute("aria-valuetext", anios(obj.migracion, T));
    inS.setAttribute("aria-valuetext", anios(obj.secreto, T));
    reset.hidden = obj.migracion === D.perfil.migracion && obj.secreto === D.perfil.secreto;
    clearTimeout(aviso);
    aviso = setTimeout(() => { anuncio.textContent = `${v.titulo} ${v.linea}`; }, 700);
    fig.style.setProperty("--mo-pm", pct(inM)); fig.style.setProperty("--mo-ps", pct(inS));
  };
  const pct = (inp) => ((inp.value - inp.min) / (inp.max - inp.min) * 100).toFixed(1) + "%";

  // Transición: de lo dibujado a lo pedido, con desaceleración.
  const viajar = () => {
    cancelAnimationFrame(anim);
    const desde = { ...cur }, hacia = { ...obj, fin: finEje(ahora + obj.migracion + obj.secreto, tramos) };
    if (quieto) { Object.assign(cur, hacia); pintar(); return; }
    const t0 = performance.now(), dur = 420;
    const paso = (t) => {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      for (const key of ["migracion", "secreto", "fin"]) cur[key] = desde[key] + (hacia[key] - desde[key]) * e;
      pintar();
      if (k < 1) anim = requestAnimationFrame(paso);
    };
    anim = requestAnimationFrame(paso);
  };

  // Si alguien mueve un control antes de que el dibujo haya entrado (en un teléfono los controles
  // quedan arriba y el dibujo abajo), la entrada se salta: nunca un gráfico vacío con valores nuevos.
  let io = null;
  const saltarEntrada = () => { if (io) { io.disconnect(); io = null; rev = { m: 1, s: 1, l: 1, t: 1 }; } };
  const cambiar = () => { saltarEntrada(); obj.migracion = +inM.value; obj.secreto = +inS.value; textos(); viajar(); };
  inM.addEventListener("input", cambiar);
  inS.addEventListener("input", cambiar);
  reset.addEventListener("click", () => {
    inM.value = D.perfil.migracion; inS.value = D.perfil.secreto; cambiar();
    inM.focus();
  });

  // Entrada: una vez, al aparecer. Cada capa tiene su tramo del reloj.
  const entrada = () => {
    if (quieto) { rev = { m: 1, s: 1, l: 1, t: 1 }; pintar(); return; }
    const t0 = performance.now(), dur = 1900;
    const tramo = (k, a, b) => { const u = Math.min(1, Math.max(0, (k - a) / (b - a))); return 1 - Math.pow(1 - u, 3); };
    const paso = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      rev = { m: tramo(k, 0, 0.32), s: tramo(k, 0.24, 0.56), t: tramo(k, 0.48, 0.78), l: tramo(k, 0.74, 1) };
      pintar();
      if (k < 1) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  };

  fig.classList.add("mo-vivo");
  fig.querySelector(".mo-controles").hidden = false;
  ancho = lienzo.clientWidth || 760;
  textos();

  const visible = () => { const r = fig.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; };
  if (quieto || !("IntersectionObserver" in window) || visible()) { pintar(); }
  else {
    rev = { m: 0, s: 0, l: 0, t: 0 }; pintar();
    io = new IntersectionObserver((ents) => {
      if (io && ents.some((x) => x.isIntersecting)) { io.disconnect(); io = null; entrada(); }
    }, { threshold: 0.25 });
    io.observe(lienzo);
  }
  if ("ResizeObserver" in window) new ResizeObserver(medir).observe(lienzo);
  else addEventListener("resize", medir);
}
