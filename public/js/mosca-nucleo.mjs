/*
 * La cuenta de Mosca — núcleo puro del gráfico «Sume los años» de /es/q-ready y /q-ready. 25-nov-2026.
 *
 * Lo usan DOS lados con el mismo código: el servidor (QReadyPuerta.astro lo importa y pinta el estado
 * de ejemplo, que es lo que ve quien no tiene JavaScript) y el navegador (public/js/mosca.mjs, que lo
 * vuelve a pintar en cada cuadro de la animación y en cada movimiento de los controles). Un solo
 * `svgMosca()`: lo que se ve sin JS y lo que se ve con JS no pueden contar dos cuentas distintas.
 *
 * ── NINGUNA CIFRA DE LA AMENAZA VIVE AQUÍ ────────────────────────────────────────────────────────
 * Los tramos salen de `qday` de la edición del informe (src/data/informe-pqc/*.json): Global Risk
 * Institute, Quantum Threat Timeline Report 2025, 26 expertos. `tramosDe()` lee el rótulo publicado
 * («~15%», «28–49%», «≥51%») y de ahí saca qué SE PUEDE dibujar:
 *   · «~15%»   → aproximado: un valor, sin banda.
 *   · «28–49%» → rango: se dibuja el piso lleno y el rango rayado. No es un punto, y no se ve como punto.
 *   · «≥51%»   → piso: se dibuja el piso lleno y, encima, un degradado abierto: «al menos», sin techo.
 * Y falla cerrado: si `p` no coincide con lo que dice el rótulo, o el rótulo trae una forma nueva,
 * lanza. Un rótulo que no entiendo no se dibuja a ojo.
 *
 * ── NO SE INTERPOLA ──────────────────────────────────────────────────────────────────────────────
 * La encuesta da una probabilidad ACUMULADA por horizonte («hacia 2041»). Entre dos horizontes no dice
 * nada. Lo único que se sigue sin inventar es que la acumulada no baja: lo estimado hacia 2041 sigue
 * valiendo como piso en 2043. Por eso el dibujo es un ESCALÓN que empieza en cada horizonte y se
 * mantiene hasta el siguiente, y la lectura de un año cualquiera es «el último horizonte que ya pasó».
 * Antes del primer horizonte no hay estimación, y el gráfico lo dice en vez de rellenarlo.
 *
 * ── EL VEREDICTO ─────────────────────────────────────────────────────────────────────────────────
 * «Tarde» si la fecha hasta la que sus datos deben seguir secretos llega al primer horizonte que la
 * encuesta estima; «a tiempo» si vence antes. Es un criterio, no una cifra: no agrega ningún número
 * que la fuente no traiga. PROVISORIO hasta su aprobación (ver docs/textos-provisorios-mosca.md).
 */

/** Rango de los controles. Son límites de la interfaz, no datos: cubren el perfil de ejemplo con aire. */
export const LIMITES = { secreto: [1, 30], migracion: [1, 15] };

/** Igual que src/lib/textos-galeria.mjs → llenar: marcadores ‹…› en orden de aparición, falla si no cuadra. */
export function llenar(plantilla, valores) {
  const marcas = plantilla.match(/‹[^›]+›/g) || [];
  if (marcas.length !== valores.length) throw new Error(`plantilla «${plantilla}»: trae ${marcas.length} marcadores y se dieron ${valores.length} valores`);
  let k = 0;
  return plantilla.replace(/‹[^›]+›/g, () => String(valores[k++]));
}

export function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** «‹n› años» con su singular. */
export function anios(n, T) { return n === 1 ? T.anioUno : llenar(T.anios, [n]); }

/**
 * qday → tramos. `h` = «10 años · 2036», `p` = número publicado, `lab` = rótulo publicado.
 * @returns {{anio:number, h:string, lab:string, lo:number, hi:number|null, tipo:'aprox'|'rango'|'piso'}[]}
 */
export function tramosDe(qday) {
  if (!Array.isArray(qday) || !qday.length) throw new Error("mosca: `qday` vacío o ausente");
  const out = qday.map((q) => {
    const anio = Number(String(q.h).split("·")[1]);
    if (!Number.isInteger(anio)) throw new Error(`mosca: no leo el año del horizonte «${q.h}»`);
    const lab = String(q.lab).trim();
    let m, t;
    if ((m = lab.match(/^~\s*(\d+)\s*%$/))) t = { lo: +m[1], hi: +m[1], tipo: "aprox" };
    else if ((m = lab.match(/^(\d+)\s*[–-]\s*(\d+)\s*%$/))) t = { lo: +m[1], hi: +m[2], tipo: "rango" };
    else if ((m = lab.match(/^≥\s*(\d+)\s*%$/))) t = { lo: +m[1], hi: null, tipo: "piso" };
    else throw new Error(`mosca: rótulo con forma desconocida «${lab}» — no se dibuja a ojo`);
    // `p` es la cifra que el informe usa como barra: el techo del rango, o el piso de «≥». Si no
    // coincide con el rótulo, una de las dos está mal y no sé cuál.
    const esperado = t.tipo === "rango" ? t.hi : t.lo;
    if (q.p !== esperado) throw new Error(`mosca: «${lab}» dice ${esperado} y p dice ${q.p}`);
    if (t.lo < 0 || (t.hi ?? t.lo) > 100 || (t.hi != null && t.hi < t.lo)) throw new Error(`mosca: «${lab}» fuera de 0–100`);
    return { anio, h: q.h, lab, ...t };
  });
  for (let i = 1; i < out.length; i++) {
    if (out[i].anio <= out[i - 1].anio) throw new Error("mosca: los horizontes no van en orden");
    if (out[i].lo < out[i - 1].lo) throw new Error("mosca: la acumulada baja entre horizontes; el escalón no aplica");
  }
  return out;
}

/** El tramo vigente en un año: el último horizonte que ya pasó, o null si es antes del primero. */
export function tramoEn(anio, tramos) {
  let t = null;
  for (const x of tramos) if (x.anio <= anio) t = x;
  return t;
}

/** La cuenta. */
export function cuenta({ ahora, secreto, migracion, tramos }) {
  const finMigra = ahora + migracion, hasta = finMigra + secreto;
  const primero = tramos[0], ultimo = tramos[tramos.length - 1];
  const tramo = tramoEn(hasta, tramos);
  const estado = hasta < primero.anio ? "a-tiempo" : hasta > ultimo.anio ? "mas-alla" : "tarde";
  return { ahora, secreto, migracion, finMigra, hasta, tramo, primero, ultimo, estado, tarde: estado !== "a-tiempo" };
}

/** Fin del eje: deja un tramo de aire después del último horizonte, y crece si la cuenta se pasa. */
export function finEje(hasta, tramos) {
  const ultimo = tramos[tramos.length - 1].anio;
  return Math.max(ultimo + 5, Math.ceil((hasta + 2) / 5) * 5);
}

const r1 = (v) => Math.round(v * 10) / 10;

/**
 * El SVG completo. `e` es el estado que se dibuja; puede traer números no enteros (cuadros intermedios
 * de una transición) y `rev` (0–1 por capa) para la entrada.
 * @param {{ancho:number, ahora:number, secreto:number, migracion:number, fin:number, tramos:any[],
 *          rev?:{m:number,s:number,l:number,t:number}, textos:any, final?:{secreto:number,migracion:number}}} e
 */
export function svgMosca(e) {
  const T = e.textos, W = Math.max(200, Math.round(e.ancho));
  const rev = { m: 1, s: 1, l: 1, t: 1, ...(e.rev || {}) };
  const compacto = W < 560;
  // Geometría. Ancho del dibujo = ancho real en pantalla (el cliente lo mide): 13 px son 13 px.
  const L = compacto ? 0 : 156, R = W - 8;
  const g = compacto
    ? { corte: 16, lm: 44, ym: 52, ls: 100, ys: 108, lt: 158, t0: 176, t1: 300, eje: 322, H: 330, alto: 24 }
    : { corte: 22, lm: 0, ym: 40, ls: 0, ys: 82, lt: 0, t0: 132, t1: 272, eje: 294, H: 302, alto: 24 };
  const span = e.fin - e.ahora;
  const x = (a) => L + (a - e.ahora) * (R - L) / span;
  const y = (p) => g.t1 - (g.t1 - g.t0) * p / 100;
  const ch = 7.85; // ancho medio de un carácter de Plex Mono a 13 px, para no montar rótulos
  const m = e.migracion, s = e.secreto;
  const finMigra = e.ahora + m, hasta = finMigra + s;
  // Lo que se ROTULA sale del estado final (enteros), no del cuadro intermedio.
  const fm = e.final ? e.final.migracion : Math.round(m), fs = e.final ? e.final.secreto : Math.round(s);
  const hastaF = e.ahora + fm + fs;
  const tramoF = tramoEn(hastaF, e.tramos);
  const o = [];
  o.push(`<defs>`
    + `<pattern id="mo-raya" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" class="mo-raya-f"/><line x1="0" y1="0" x2="0" y2="6" class="mo-raya-l"/></pattern>`
    + `<linearGradient id="mo-abierto" x1="0" y1="1" x2="0" y2="0"><stop offset="0" class="mo-ab-0"/><stop offset="1" class="mo-ab-1"/></linearGradient>`
    + `</defs>`);

  // Rejilla y eje. Cada 5 años si caben, si no cada 10.
  const paso = (R - L) / span * 5 >= 46 ? 5 : 10;
  let finRotulo = -Infinity; const anchoAnio = 4 * ch;
  for (let a = e.ahora; a <= e.fin + 0.01; a += paso) {
    const xa = r1(x(a));
    o.push(`<line class="mo-grid" x1="${xa}" y1="${g.ym - 8}" x2="${xa}" y2="${g.t1}"/>`);
    const anc = a === e.ahora ? "start" : (x(a) > R - 20 ? "end" : "middle");
    const izq = anc === "start" ? xa : anc === "end" ? xa - anchoAnio : xa - anchoAnio / 2;
    if (izq < finRotulo + 8) continue; // un año que montaría al anterior no se rotula (la línea queda)
    finRotulo = izq + anchoAnio;
    o.push(`<text class="mo-eje" x="${xa}" y="${g.eje}" text-anchor="${anc}">${a}</text>`);
  }

  // La ventana expuesta: desde el primer horizonte que la encuesta estima hasta que el secreto vence.
  const x0exp = x(e.tramos[0].anio), xHasta = x(e.ahora + (m * rev.m) + (s * rev.s));
  if (xHasta > x0exp) o.push(`<rect class="mo-expuesta" x="${r1(x0exp)}" y="${g.ym - 8}" width="${r1(xHasta - x0exp)}" height="${g.t1 - g.ym + 8}"/>`);

  // Rótulos de fila. En teléfono van DENTRO del dibujo, sobre las filas: se pintan al final (`encima`),
  // con un halo del color del panel, para que la línea de protección pase por detrás y no los tache.
  const encima = [];
  if (compacto) {
    encima.push(`<text class="mo-fila mo-halo" x="0" y="${g.lm}">${esc(T.migrar)}</text>`);
    encima.push(`<text class="mo-fila mo-halo" x="0" y="${g.ls}">${esc(T.secreto)}</text>`);
    encima.push(`<text class="mo-fila mo-halo" x="0" y="${g.lt}">${esc(T.amenaza)} <tspan class="mo-sub">· ${esc(T.prob)}</tspan></text>`);
  } else {
    o.push(`<text class="mo-fila" x="0" y="${g.ym + 17}">${esc(T.migrar)}</text>`);
    o.push(`<text class="mo-fila" x="0" y="${g.ys + 17}">${esc(T.secreto)}</text>`);
    o.push(`<text class="mo-fila" x="0" y="${y(50) - 4}">${esc(T.amenaza)}</text>`);
    o.push(`<text class="mo-sub" x="0" y="${y(50) + 16}">${esc(T.prob)}</text>`);
  }

  // Barras. El rótulo va adentro si cabe; si no, a la derecha en tinta.
  const barra = (cls, xa, w, yb, n) => {
    if (w <= 0.5) return;
    o.push(`<rect class="${cls}" x="${r1(xa)}" y="${yb}" width="${r1(w)}" height="${g.alto}" rx="2"/>`);
    const tx = anios(n, T), tw = tx.length * ch + 16;
    if (w >= tw) o.push(`<text class="mo-dentro" x="${r1(xa + 8)}" y="${yb + g.alto / 2 + 4.5}">${esc(tx)}</text>`);
    else encima.push(`<text class="mo-fuera mo-halo" x="${r1(xa + w + 6)}" y="${yb + g.alto / 2 + 4.5}">${esc(tx)}</text>`);
  };
  const wm = x(e.ahora + m * rev.m) - x(e.ahora);
  barra("mo-migra", x(e.ahora), wm, g.ym, fm);
  if (rev.s > 0) barra("mo-secreto", x(finMigra), x(finMigra + s * rev.s) - x(finMigra), g.ys, fs);

  // La amenaza: escalones que empiezan en cada horizonte. Piso lleno; rango rayado; «≥» abierto.
  const sube = (p) => y(p * rev.t);
  o.push(`<line class="mo-base" x1="${L}" y1="${g.t1}" x2="${R}" y2="${g.t1}"/>`);
  // Guía del 50 %: una referencia de lectura («más probable que no»), no un dato. Va detrás de todo.
  o.push(`<line class="mo-guia" x1="${L}" y1="${y(50)}" x2="${R}" y2="${y(50)}"/>`);
  o.push(`<text class="mo-guia-t" x="${L + 6}" y="${y(50) - 5}">50%</text>`);
  const xPrimero = x(e.tramos[0].anio);
  if (xPrimero - L > T.sinEstimacion.length * ch + 12) {
    o.push(`<text class="mo-sin" x="${r1(L + 6)}" y="${g.t1 - 8}">${esc(T.sinEstimacion)}</text>`);
  }
  let linea = `M${r1(xPrimero)},${g.t1}`;
  e.tramos.forEach((t, i) => {
    const xa = x(t.anio), xb = i + 1 < e.tramos.length ? x(e.tramos[i + 1].anio) : R;
    const w = r1(xb - xa), activo = tramoF === t;
    const cl = activo ? " mo-activo" : "";
    if (t.tipo === "rango") o.push(`<rect class="mo-rango${cl}" x="${r1(xa)}" y="${r1(sube(t.hi))}" width="${w}" height="${r1(sube(t.lo) - sube(t.hi))}"/>`);
    if (t.tipo === "piso") o.push(`<rect class="mo-abierto${cl}" x="${r1(xa)}" y="${r1(sube(100))}" width="${w}" height="${r1(sube(t.lo) - sube(100))}"/>`);
    o.push(`<rect class="mo-piso${cl}" x="${r1(xa)}" y="${r1(sube(t.lo))}" width="${w}" height="${r1(g.t1 - sube(t.lo))}"/>`);
    linea += ` V${r1(sube(t.lo))} H${r1(xb)}`;
    // Rótulo del tramo: arriba del dibujo del tramo, pegado a su borde izquierdo.
    const techo = t.tipo === "rango" ? t.hi : t.lo;
    const ly = Math.max(g.t0 - 2, sube(techo) - 6);
    if (rev.t > 0.6 && xb - xa > t.lab.length * ch + 8) encima.push(`<text class="mo-lab mo-halo${cl}" x="${r1(xa + 5)}" y="${r1(ly)}">${esc(t.lab)}</text>`);
  });
  o.push(`<path class="mo-borde" d="${linea}"/>`);

  // La línea de protección: cae desde arriba hasta el escalón del año en que el secreto vence.
  if (rev.l > 0) {
    const tr = tramoEn(hasta, e.tramos);
    const yFin = tr ? sube(tr.lo) : g.t1;
    const yIni = g.corte + 8, yAhora = yIni + (yFin - yIni) * rev.l;
    const xc = r1(x(hasta));
    o.push(`<line class="mo-corte" x1="${xc}" y1="${yIni}" x2="${xc}" y2="${r1(yAhora)}"/>`);
    if (rev.l >= 1) o.push(`<circle class="mo-punto${tr ? "" : " mo-punto-sin"}" cx="${xc}" cy="${r1(yFin)}" r="5"/>`);
    const tx = llenar(T.corte, [hastaF]), tw = tx.length * ch;
    const derecha = x(hasta) - tw - 8 < L;
    const tx0 = derecha ? x(hasta) + 8 : x(hasta) - 8;
    if (!(derecha && tx0 + tw > W)) o.push(`<text class="mo-corte-t" x="${r1(tx0)}" y="${g.corte}" text-anchor="${derecha ? "start" : "end"}">${esc(tx)}</text>`);
  }

  o.push(...encima);
  return `<svg class="mo-svg" viewBox="0 0 ${W} ${g.H}" width="${W}" height="${g.H}" role="img" aria-labelledby="mo-t mo-d" xmlns="http://www.w3.org/2000/svg">`
    + `<title id="mo-t">${esc(T.titulo)}</title><desc id="mo-d">${esc(descripcion({ ahora: e.ahora, secreto: fs, migracion: fm, tramos: e.tramos, textos: T }))}</desc>`
    + o.join("") + `</svg>`;
}

/** La descripción para lector de pantalla: las plantillas que ya estaban aprobadas (descA, descItem). */
export function descripcion({ ahora, secreto, migracion, tramos, textos: T }) {
  const finMigra = ahora + migracion, hasta = finMigra + secreto;
  return llenar(T.descA, [migracion, ahora, finMigra, secreto, hasta])
    + tramos.map((t) => llenar(T.descItem, [t.anio, t.lab])).join("; ") + ".";
}

/** El veredicto en palabras: título y una línea. */
export function veredicto(c, T) {
  const titulo = c.tarde ? T.tarde : T.aTiempo;
  const linea = c.estado === "a-tiempo" ? llenar(T.lineaATiempo, [c.hasta, c.primero.anio, c.primero.lab])
    : c.estado === "mas-alla" ? llenar(T.lineaMasAlla, [c.hasta, c.ultimo.anio, c.ultimo.lab])
    : llenar(T.lineaTarde, [c.hasta, c.tramo.anio, c.tramo.lab]);
  return { titulo, linea };
}
