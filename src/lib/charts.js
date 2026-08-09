/**
 * Motor de graficos para los informes. SVG generado por nosotros, cero dependencias.
 *
 * POR QUE EXISTE
 * --------------
 * El informe del estudio Chile tiene 24 barras, 14 fichas de cifra y 6 tablas — y
 * CERO ejes, cero series de tiempo y cero rangos. Es un motor de proporciones: todo
 * lo que necesite evolucion, escala o incertidumbre hoy no se puede dibujar. La
 * seccion "El calculo se acorto doscientas veces. El hardware no" quedo sin grafico
 * por eso.
 *
 * LAS DOS REGLAS QUE ESTE MODULO IMPONE POR CODIGO
 * ------------------------------------------------
 * 1. UN GRAFICO NO COMPILA SIN SU PROCEDENCIA. `fuente` y `n` son obligatorios y
 *    `grafico()` lanza si faltan. Hoy la nota de metodo la lleva 10 de 13 graficos
 *    porque es opcional; una regla opcional no es una regla. Los siete exhibits de
 *    McKinsey que estudiamos llevan linea `Source:` sin excepcion — no es estetica,
 *    es lo minimo para que alguien pueda discutir el numero.
 *
 * 2. UNA PROYECCION SE VE COMO PROYECCION. Los valores estimados se dibujan como
 *    RANGO, no como punto, y el eje marca desde donde deja de haber medicion.
 *    Publicamos "54" a secas mientras criticamos a quien publica puntos sin banda.
 *
 * Sin librerias externas a proposito: el informe pesa 87 KB y se puede sellar. Un
 * <script src="cdn..."> rompe el sellado.
 */

// Tokens del sitio. Se leen como variables CSS para que el grafico herede el tema
// y no invente una paleta nueva; los respaldos son los valores de la linea hv3.
const C = {
  tinta: "var(--papyrus, #F4EEDF)",
  tenue: "var(--papyrus-dim, #B5AC99)",
  debil: "var(--faint, #6E675C)",
  linea: "var(--stone-line, #3D372F)",
  panel: "var(--basalt-2, #1F1C18)",
  serie: ["var(--faience, #4DC4B5)", "var(--gold, #D9B87A)", "#8FA9C4", "#C98F8F"],
};

export function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Numeros en formato local: coma decimal, punto de miles. */
export function num(v, dec = 0) {
  if (v == null || Number.isNaN(v)) return "—";
  const s = Math.abs(v) >= 1000 || dec > 0
    ? v.toLocaleString("es-CL", { minimumFractionDigits: dec, maximumFractionDigits: dec })
    : String(v);
  return s;
}

/**
 * Etiqueta compacta para magnitudes grandes: 1.000.000 -> "1 M".
 * Sale de un defecto visto a ojo: con el margen fijo de 52 px, un eje logaritmico
 * hasta mil millones imprimia "000.000" — el numero recortado por la izquierda, que
 * es peor que no poner eje. Ahora el margen se calcula (ver `margenY`) y ademas las
 * magnitudes se abrevian, que es lo que hace legible un eje log.
 */
export function numCorto(v, dec = 0) {
  if (v == null || Number.isNaN(v)) return "—";
  const a = Math.abs(v);
  if (a >= 1e9) return num(v / 1e9, v % 1e9 ? 1 : 0) + " MM";
  if (a >= 1e6) return num(v / 1e6, v % 1e6 ? 1 : 0) + " M";
  if (a >= 1e4) return num(v / 1e3, v % 1e3 ? 1 : 0) + " k";
  return num(v, dec);
}

/**
 * Ancho que necesita el eje Y para que NINGUNA etiqueta quede cortada.
 * Se estima por caracteres (no hay medicion de texto sin navegador) y se le da aire.
 */
export function margenY(etiquetas, minimo = 52) {
  const mas = etiquetas.reduce((m, e) => Math.max(m, String(e).length), 0);
  return Math.max(minimo, mas * 7.2 + 18);
}

// ------------------------------------------------------------------ escalas y ejes

/** Escala lineal de dominio a rango de pixeles. */
export function escala([d0, d1], [r0, r1]) {
  const span = d1 - d0 || 1;
  const f = v => r0 + ((v - d0) / span) * (r1 - r0);
  f.dominio = [d0, d1];
  f.rango = [r0, r1];
  return f;
}

/**
 * Marcas "redondas" para un eje. Un eje con marcas en 0, 3.7, 7.4 es ilegible;
 * la gracia de un eje es que el lector pueda estimar sin leer cada etiqueta.
 */
export function marcas([min, max], cuantas = 5) {
  if (max === min) return [min];
  const crudo = (max - min) / Math.max(1, cuantas - 1);
  const mag = Math.pow(10, Math.floor(Math.log10(crudo)));
  const paso = [1, 2, 2.5, 5, 10].map(m => m * mag).find(p => p >= crudo) || mag * 10;
  const desde = Math.floor(min / paso) * paso;
  const out = [];
  for (let v = desde; v <= max + paso * 1e-9; v += paso) {
    out.push(Number(v.toFixed(10)));
  }
  return out.filter(v => v >= min - paso * 1e-9);
}

/** Eje Y con marcas y lineas de referencia horizontales. */
export function ejeY(sy, { x0, x1, dec = 0, unidad = "" } = {}) {
  return marcas(sy.dominio).map(v => {
    const y = sy(v);
    return `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="${C.linea}" stroke-width="1" opacity=".6"/>` +
      `<text x="${x0 - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="${C.debil}">${esc(num(v, dec))}${esc(unidad)}</text>`;
  }).join("");
}

/**
 * Eje X categorico. `estimadoDesde` marca desde que categoria dejan de ser datos
 * medidos: se dibuja una banda y la palabra "estimado" debajo. Sin esa marca, una
 * proyeccion y una medicion se ven iguales, que es precisamente el problema.
 */
export function ejeX(sx, categorias, { y, y0, estimadoDesde = null, etiquetaEstimado = "estimado" } = {}) {
  let out = "";
  const iEst = estimadoDesde == null ? -1 : categorias.indexOf(estimadoDesde);
  if (iEst >= 0) {
    const xa = sx(iEst) - (categorias.length > 1 ? (sx(1) - sx(0)) / 2 : 0);
    const xb = sx(categorias.length - 1) + (categorias.length > 1 ? (sx(1) - sx(0)) / 2 : 0);
    out += `<rect x="${xa}" y="${y0}" width="${Math.max(0, xb - xa)}" height="${y - y0}" fill="${C.tinta}" opacity=".04"/>`;
    out += `<text x="${(xa + xb) / 2}" y="${y + 32}" text-anchor="middle" font-size="10.5" font-style="italic" fill="${C.debil}">${esc(etiquetaEstimado)}</text>`;
  }
  out += categorias.map((c, i) =>
    `<text x="${sx(i)}" y="${y + 16}" text-anchor="middle" font-size="11" fill="${C.debil}">${esc(c)}</text>`
  ).join("");
  return out;
}

// -------------------------------------------------------------- linea multiserie

/**
 * Linea multiserie con eje temporal y ETIQUETA AL FINAL DE CADA LINEA.
 * Sin leyenda a proposito: el nombre va donde esta la linea, que es como lo hacen
 * los siete exhibits que estudiamos y ahorra al lector el salto de ida y vuelta.
 *
 * `series`: [{ nombre, valores:[n|null], color? }]
 * `anotacion`: { desde:i, hasta:i, serie:idx, texto } dibuja la diferencia con
 *              flecha — afirma la comparacion en vez de dejarsela al lector.
 */
export function lineas({ categorias, series, alto = 260, ancho = 720, dec = 0, unidad = "",
                         estimadoDesde = null, anotacion = null, log = false } = {}) {
  if (!Array.isArray(categorias) || !categorias.length) throw new Error("lineas(): faltan categorias");
  if (!Array.isArray(series) || !series.length) throw new Error("lineas(): faltan series");
  for (const s of series) {
    if (!s.nombre) throw new Error("lineas(): una serie sin nombre no se puede etiquetar al final de la linea");
    if (s.valores.length !== categorias.length)
      throw new Error(`lineas(): la serie "${s.nombre}" tiene ${s.valores.length} valores y hay ${categorias.length} categorias`);
  }
  const planos = series.flatMap(s => s.valores).filter(v => v != null && !Number.isNaN(v));
  if (!planos.length) throw new Error("lineas(): ninguna serie tiene valores");
  const tr = log ? (v => Math.log10(Math.max(v, 1e-9))) : (v => v);
  let lo = Math.min(...planos.map(tr)), hi = Math.max(...planos.map(tr));
  if (!log) lo = Math.min(0, lo);
  if (lo === hi) hi = lo + 1;

  // El margen izquierdo se CALCULA a partir de la etiqueta mas larga. Con un margen
  // fijo, un eje logaritmico hasta mil millones imprimia "000.000": el numero
  // recortado, que engana mas que no poner eje.
  const vals = marcas([lo, hi]);
  const etiquetas = vals.map(v => (log ? numCorto(Math.pow(10, v)) : numCorto(v, dec)) + unidad);
  const m = { top: 14, der: 132, aba: estimadoDesde ? 52 : 34, izq: margenY(etiquetas) };
  const x0 = m.izq, x1 = ancho - m.der, y0 = m.top, y1 = alto - m.aba;

  const sy = escala([lo, hi], [y1, y0]);
  const sx = escala([0, Math.max(1, categorias.length - 1)], [x0, x1]);

  let svg = ejeX(sx, categorias, { y: y1, y0, estimadoDesde });
  svg += vals.map((v, i) => {
    const y = sy(v);
    return `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="${C.linea}" stroke-width="1" opacity=".6"/>` +
      `<text x="${x0 - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="${C.debil}">${esc(etiquetas[i])}</text>`;
  }).join("");

  series.forEach((s, si) => {
    const col = s.color || C.serie[si % C.serie.length];
    const pts = s.valores.map((v, i) => (v == null ? null : [sx(i), sy(tr(v))])).filter(Boolean);
    if (pts.length > 1) {
      svg += `<polyline fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round" ` +
             `points="${pts.map(p => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ")}"/>`;
    }
    pts.forEach(p => { svg += `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2.5" fill="${col}"/>`; });
    const ult = pts[pts.length - 1];
    if (ult) {
      svg += `<text x="${(ult[0] + 10).toFixed(1)}" y="${(ult[1] + 4).toFixed(1)}" font-size="12" fill="${col}">${esc(s.nombre)}</text>`;
    }
  });

  if (anotacion) {
    const s = series[anotacion.serie || 0];
    const va = s.valores[anotacion.desde], vb = s.valores[anotacion.hasta];
    if (va != null && vb != null) {
      const xa = sx(anotacion.hasta), ya = sy(tr(va)), yb = sy(tr(vb));
      svg += `<line x1="${xa}" y1="${ya}" x2="${xa}" y2="${yb}" stroke="${C.tenue}" stroke-width="1" stroke-dasharray="2 2"/>` +
        `<text x="${xa + 8}" y="${(ya + yb) / 2 + 4}" font-size="11.5" font-weight="600" fill="${C.tinta}">${esc(anotacion.texto)}</text>`;
    }
  }
  return `<svg viewBox="0 0 ${ancho} ${alto}" width="100%" height="auto" role="img" font-family="inherit">${svg}</svg>`;
}

// ------------------------------------------------------------------ barras de rango

/**
 * Barras de RANGO: cada fila va de su minimo a su maximo, no a un punto.
 * `items`: [{ etiqueta, rango:[lo,hi] }]  o  [{ etiqueta, valor }] para un dato medido.
 * Un punto y un rango se distinguen a la vista: el punto lleva marca, el rango barra.
 */
export function barrasRango({ items, ancho = 720, altoFila = 30, dec = 0, unidad = "", etiquetaAncho = null } = {}) {
  if (!Array.isArray(items) || !items.length) throw new Error("barrasRango(): faltan items");
  const planos = items.flatMap(i => (i.rango ? i.rango : [i.valor])).filter(v => v != null);
  if (!planos.length) throw new Error("barrasRango(): ningun item tiene valor ni rango");
  const alto = items.length * altoFila + 34;
  // igual que en el eje Y: el ancho de las etiquetas se calcula, no se adivina.
  const x0 = etiquetaAncho || margenY(items.map(i => i.etiqueta), 120);
  const x1 = ancho - 110;
  const sx = escala([Math.min(0, ...planos), Math.max(...planos)], [x0, x1]);

  let svg = marcas(sx.dominio, 4).map(v =>
    `<line x1="${sx(v)}" y1="6" x2="${sx(v)}" y2="${items.length * altoFila + 6}" stroke="${C.linea}" stroke-width="1" opacity=".5"/>` +
    `<text x="${sx(v)}" y="${items.length * altoFila + 24}" text-anchor="middle" font-size="10.5" fill="${C.debil}">${esc(num(v, dec))}</text>`
  ).join("");

  items.forEach((it, i) => {
    const y = i * altoFila + altoFila / 2 + 6;
    const col = it.color || C.serie[0];
    svg += `<text x="${x0 - 12}" y="${y + 4}" text-anchor="end" font-size="12.5" fill="${C.tenue}">${esc(it.etiqueta)}</text>`;
    if (it.rango) {
      const [lo, hi] = it.rango;
      svg += `<rect x="${sx(lo)}" y="${y - 7}" width="${Math.max(2, sx(hi) - sx(lo))}" height="14" fill="${col}" opacity=".55" rx="2"/>` +
        `<line x1="${sx(lo)}" y1="${y - 9}" x2="${sx(lo)}" y2="${y + 9}" stroke="${col}" stroke-width="2"/>` +
        `<line x1="${sx(hi)}" y1="${y - 9}" x2="${sx(hi)}" y2="${y + 9}" stroke="${col}" stroke-width="2"/>` +
        `<text x="${sx(hi) + 10}" y="${y + 4}" font-size="12" fill="${C.tinta}">${esc(num(lo, dec))}–${esc(num(hi, dec))}${esc(unidad)}</text>`;
    } else {
      svg += `<rect x="${sx(Math.min(0, sx.dominio[0]))}" y="${y - 6}" width="${Math.max(2, sx(it.valor) - sx(sx.dominio[0]))}" height="12" fill="${col}" rx="2"/>` +
        `<text x="${sx(it.valor) + 10}" y="${y + 4}" font-size="12" fill="${C.tinta}">${esc(num(it.valor, dec))}${esc(unidad)}</text>`;
    }
  });
  return `<svg viewBox="0 0 ${ancho} ${alto}" width="100%" height="auto" role="img" font-family="inherit">${svg}</svg>`;
}

/**
 * Ficha de cifra CON su banda. Nuestras 14 fichas actuales muestran un punto sin
 * incertidumbre — justo lo que le criticamos a los informes de industria. Si el dato
 * es una estimacion, `rango` es obligatorio y la ficha lo dice.
 */
export function cifra({ valor, rango = null, etiqueta, unidad = "", dec = 0, estimado = false } = {}) {
  if (!etiqueta) throw new Error("cifra(): falta la etiqueta");
  if (estimado && !rango) throw new Error("cifra(): una cifra marcada como estimada tiene que traer su rango");
  const principal = rango ? `${num(rango[0], dec)}–${num(rango[1], dec)}` : num(valor, dec);
  return `<div class="rq-cifra">` +
    `<span class="rq-cifra-v">${esc(principal)}${esc(unidad)}</span>` +
    (estimado ? `<span class="rq-cifra-est">estimado</span>` : "") +
    `<span class="rq-cifra-k">${esc(etiqueta)}</span></div>`;
}

// ------------------------------------------------- el envoltorio que falla cerrado

/**
 * Envuelve un grafico con su mobiliario obligatorio.
 *
 * LANZA si falta `fuente` o `n`. Es la regla del modulo: un grafico sin procedencia
 * no compila. `n` acepta el numero de observaciones o el string que explique por que
 * no aplica ("serie completa", "poblacion entera") — pero algo hay que declarar.
 */
export function grafico({ numero, titular, subtitulo, unidad = "", n, cuerpo,
                          notas = [], fuente, fecha = null, hash = null } = {}) {
  if (!titular) throw new Error("grafico(): falta el titular");
  if (!/[.!?]$/.test(String(titular).trim()))
    throw new Error(`grafico(): el titular tiene que AFIRMAR el hallazgo en una frase, no rotular el tema — "${titular}"`);
  if (!cuerpo) throw new Error("grafico(): falta el cuerpo del grafico");
  if (!fuente) throw new Error(`grafico(): "${titular}" no declara fuente. Un grafico sin procedencia no se publica.`);
  if (n === undefined || n === null || n === "")
    throw new Error(`grafico(): "${titular}" no declara n. Un total sin denominador no es un resultado.`);

  const sub = [subtitulo, unidad].filter(Boolean).join(", ");
  const notasHtml = notas.length
    ? `<ol class="rq-notas">` + notas.map(x => `<li>${esc(x)}</li>`).join("") + `</ol>`
    : "";
  const proc = [`Fuente: ${fuente}`, `n = ${n}`, fecha ? `al ${fecha}` : null].filter(Boolean).join(" · ");
  return `<figure class="rq-fig">` +
    (numero != null ? `<div class="rq-fig-num">Gráfico ${esc(numero)}</div>` : "") +
    `<figcaption class="rq-fig-tit">${esc(titular)}</figcaption>` +
    (sub ? `<div class="rq-fig-sub">${esc(sub)}</div>` : "") +
    `<div class="rq-fig-cuerpo">${cuerpo}</div>` +
    notasHtml +
    `<div class="rq-fig-proc">${esc(proc)}` +
    (hash ? ` · <code>${esc(String(hash).slice(0, 12))}…</code>` : "") +
    `</div></figure>`;
}

/** CSS del motor. Usa los tokens del sitio; no define paleta propia. */
export const CSS_GRAFICOS = `
.rq-fig{margin:32px 0;border-top:1px solid var(--stone-line,#3D372F);padding-top:14px}
.rq-fig-num{font-family:'IBM Plex Mono',monospace;font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--faint,#6E675C)}
.rq-fig-tit{margin-top:8px;font-size:17px;font-weight:600;color:var(--papyrus,#F4EEDF);line-height:1.35;max-width:760px}
.rq-fig-sub{margin-top:5px;font-size:13px;color:var(--papyrus-dim,#B5AC99)}
.rq-fig-cuerpo{margin-top:18px;overflow-x:auto}
.rq-notas{margin:14px 0 0 16px;padding:0;font-size:11.5px;color:var(--faint,#6E675C);line-height:1.5}
.rq-fig-proc{margin-top:10px;font-family:'IBM Plex Mono',monospace;font-size:10.5px;color:var(--faint,#6E675C)}
.rq-cifra{display:inline-block;margin:0 28px 14px 0}
.rq-cifra-v{display:block;font-family:'Marcellus',serif;font-size:30px;color:var(--faience,#4DC4B5);line-height:1}
.rq-cifra-est{display:inline-block;margin-top:5px;font-family:'IBM Plex Mono',monospace;font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--gold,#D9B87A);border:1px solid var(--gold,#D9B87A);border-radius:2px;padding:1px 5px}
.rq-cifra-k{display:block;margin-top:6px;font-family:'IBM Plex Mono',monospace;font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--papyrus-dim,#B5AC99);max-width:220px}
`;
