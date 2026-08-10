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
export function num(v, dec = 0, lang = "es") {
  if (v == null || Number.isNaN(v)) return "—";
  // El idioma no es cosmetico aqui: "0,05" dentro de un documento en ingles se lee
  // como otra cosa, y el reporte de Cleveland tiene un umbral de p en el eje. Un
  // separador decimal equivocado en un grafico de p-valores cambia el hallazgo.
  const loc = lang === "en" ? "en-US" : "es-CL";
  return Math.abs(v) >= 1000 || dec > 0
    ? v.toLocaleString(loc, { minimumFractionDigits: dec, maximumFractionDigits: dec })
    : String(v);
}

/**
 * Etiqueta compacta para magnitudes grandes: 1.000.000 -> "1 M".
 * Sale de un defecto visto a ojo: con el margen fijo de 52 px, un eje logaritmico
 * hasta mil millones imprimia "000.000" — el numero recortado por la izquierda, que
 * es peor que no poner eje. Ahora el margen se calcula (ver `margenY`) y ademas las
 * magnitudes se abrevian, que es lo que hace legible un eje log.
 */
export function numCorto(v, dec = 0, lang = "es") {
  if (v == null || Number.isNaN(v)) return "—";
  const a = Math.abs(v);
  const G = lang === "en" ? " B" : " MM";
  if (a >= 1e9) return num(v / 1e9, v % 1e9 ? 1 : 0, lang) + G;
  if (a >= 1e6) return num(v / 1e6, v % 1e6 ? 1 : 0, lang) + " M";
  if (a >= 1e4) return num(v / 1e3, v % 1e3 ? 1 : 0, lang) + " k";
  return num(v, dec, lang);
}

/**
 * Dominio redondeado hacia arriba hasta la siguiente marca.
 *
 * `marcas()` devuelve valores redondos DENTRO del rango, asi que con [0, 0,95] la
 * marca mas alta es 0,75 y el techo del grafico queda sin etiquetar: la barra mas
 * alta —o la linea de umbral— flota por encima de toda referencia. Se descubrio
 * dibujando el umbral pre-registrado de 0,90 del coarse-graining, que quedaba arriba
 * de la ultima marca del eje.
 *
 * Devuelve [lo, hiRedondeado, marcas] para que el eje siempre termine en una marca.
 */
export function dominio([lo, hi], cuantas = 5) {
  let vals = marcas([lo, hi], cuantas);
  const ultima = vals[vals.length - 1];
  if (ultima < hi) {
    const paso = vals.length > 1 ? vals[1] - vals[0] : hi - lo;
    hi = Number((ultima + paso).toFixed(10));
    vals = marcas([lo, hi], cuantas);
  }
  return [lo, hi, vals];
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
/**
 * Etiqueta con fondo propio. La linea de umbral cruza el grafico entero, asi que su
 * etiqueta cae SIEMPRE sobre algo: en el grafico de p-valores quedo escrita encima de
 * la tercera barra, ilegible justo en el rotulo que dice cual es el umbral.
 * El ancho se estima por caracteres — no hay medicion de texto sin navegador.
 */
export function etiquetaSobreFondo(texto, x, y, anclaje = "start", color = C.serie[1]) {
  const t = String(texto);
  const ancho = t.length * 5.9 + 8;
  const bx = anclaje === "end" ? x - ancho + 4 : x - 4;
  return `<rect x="${bx.toFixed(1)}" y="${(y - 11).toFixed(1)}" width="${ancho.toFixed(1)}" height="15" ` +
    `fill="var(--basalt, #141210)" opacity=".82"/>` +
    `<text x="${x}" y="${y}" ${anclaje === "end" ? 'text-anchor="end" ' : ""}font-size="11" fill="${color}">${esc(t)}</text>`;
}

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
                         estimadoDesde = null, anotacion = null, log = false, lang = "es",
                         referencia = null } = {}) {
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
  // El umbral entra en el dominio: si queda fuera del eje, la linea se dibuja pegada
  // al borde o directamente no se ve, y en el grafico del coarse-graining ESE umbral
  // pre-registrado es el hallazgo — sin el, el lector tiene que saberselo de memoria.
  if (referencia) {
    const r = tr(referencia.valor);
    lo = Math.min(lo, r);
    // Si el umbral es el techo, se le da aire: pegado al borde superior la linea y su
    // etiqueta quedan recortadas, y es justo la linea que dice si el criterio se
    // cumplio o no.
    hi = Math.max(hi, r >= hi ? r + Math.abs(r - lo) * 0.12 : r);
  }
  if (!log) lo = Math.min(0, lo);
  if (lo === hi) hi = lo + 1;

  // El margen izquierdo se CALCULA a partir de la etiqueta mas larga. Con un margen
  // fijo, un eje logaritmico hasta mil millones imprimia "000.000": el numero
  // recortado, que engana mas que no poner eje.
  let vals; [lo, hi, vals] = dominio([lo, hi]);
  const etiquetas = vals.map(v => (log ? numCorto(Math.pow(10, v), 0, lang) : numCorto(v, dec, lang)) + unidad);
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

  const rotulos = [];
  series.forEach((s, si) => {
    const col = s.color || C.serie[si % C.serie.length];
    const pts = s.valores.map((v, i) => (v == null ? null : [sx(i), sy(tr(v))])).filter(Boolean);
    if (pts.length > 1) {
      svg += `<polyline fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round" ` +
             `points="${pts.map(p => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ")}"/>`;
    }
    pts.forEach(p => { svg += `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2.5" fill="${col}"/>`; });
    const ult = pts[pts.length - 1];
    if (ult) rotulos.push({ x: ult[0] + 10, y: ult[1] + 4, texto: s.nombre, col });
  });

  // Dos lineas que terminan cerca dejan sus rotulos uno encima del otro. En el grafico
  // del coarse-graining salio "CaMdiac myosin" —dos nombres superpuestos, ilegibles—
  // y era el grafico del entregable. Se separan por altura, sin mover las lineas: el
  // dato no se toca, el rotulo si.
  const ALTO_ROTULO = 13;
  rotulos.sort((a, b) => a.y - b.y);
  for (let k = 1; k < rotulos.length; k++) {
    if (rotulos[k].y - rotulos[k - 1].y < ALTO_ROTULO) rotulos[k].y = rotulos[k - 1].y + ALTO_ROTULO;
  }
  // si el corrimiento saco el ultimo del lienzo, se empuja al grupo hacia arriba
  const exceso = rotulos.length ? rotulos[rotulos.length - 1].y - (alto - 4) : 0;
  if (exceso > 0) rotulos.forEach(r => { r.y -= exceso; });
  svg += rotulos.map(r =>
    `<text x="${r.x.toFixed(1)}" y="${r.y.toFixed(1)}" font-size="12" fill="${r.col}">${esc(r.texto)}</text>`
  ).join("");

  if (referencia) {
    const y = sy(tr(referencia.valor));
    svg += `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="${C.serie[1]}" stroke-width="1.5" stroke-dasharray="5 3"/>` +
      etiquetaSobreFondo(referencia.etiqueta, x0 + 6, y - 6, "start");
  }

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

// --------------------------------------------------- barras verticales (y agrupadas)

/**
 * Barras verticales. Una serie por categoria, o varias agrupadas.
 *
 * Nacio para el reporte metodologico de Cleveland: dos de sus cuatro graficos son
 * barras y el motor solo sabia hacer barras de RANGO horizontales — o sea que la
 * pieza que el jurado lee primero no se podia dibujar con nuestras propias reglas.
 *
 * `series`: [{ nombre, valores:[n] }]. Con una sola serie no dibuja leyenda: el
 * nombre no aporta nada cuando no hay con que confundirlo.
 *
 * `referencia`: { valor, etiqueta } traza la linea de umbral. En los dos graficos que
 * la usan (p = 0,05 y el umbral pre-registrado de 0,90) la linea ES el hallazgo:
 * sin ella, el lector tiene que saberse el umbral de memoria para leer el grafico.
 *
 * Los valores negativos se dibujan desde el cero hacia abajo, con el eje en su lugar:
 * los cuatro rho de proximidad son negativos, y una barra negativa dibujada como
 * positiva miente sobre el signo, que aqui es justo lo que importa.
 */
export function barras({ categorias, series, alto = 280, ancho = 720, dec = 0, unidad = "",
                         referencia = null, etiquetaValores = false, lang = "es",
                         decEje = null } = {}) {
  if (!Array.isArray(categorias) || !categorias.length) throw new Error("barras(): faltan categorias");
  if (!Array.isArray(series) || !series.length) throw new Error("barras(): faltan series");
  for (const s of series) {
    if (!s.nombre) throw new Error("barras(): una serie sin nombre no se puede etiquetar");
    if (s.valores.length !== categorias.length)
      throw new Error(`barras(): la serie "${s.nombre}" tiene ${s.valores.length} valores y hay ${categorias.length} categorias`);
  }
  const planos = series.flatMap(s => s.valores).filter(v => v != null && !Number.isNaN(v));
  if (!planos.length) throw new Error("barras(): ninguna serie tiene valores");

  const refV = referencia ? referencia.valor : null;
  let lo = Math.min(0, ...planos, refV == null ? Infinity : refV);
  let hi = Math.max(0, ...planos, refV == null ? -Infinity : refV);
  if (lo === hi) hi = lo + 1;
  let vals; [lo, hi, vals] = dominio([lo, hi]);
  // El eje no necesita los decimales del dato: con dec=4 imprimia "0,6000" cuatro
  // veces en la escala, ruido que compite con el numero que si importa.
  const dEje = decEje == null ? Math.min(dec, 2) : decEje;
  const etiquetas = vals.map(v => numCorto(v, dEje, lang) + unidad);
  const leyenda = series.length > 1;
  const m = { top: 16, der: 16, aba: leyenda ? 52 : 34, izq: margenY(etiquetas) };
  const x0 = m.izq, x1 = ancho - m.der, y0 = m.top, y1 = alto - m.aba;

  const sy = escala([lo, hi], [y1, y0]);
  const paso = (x1 - x0) / categorias.length;
  const hueco = paso * 0.28;
  const anchoGrupo = paso - hueco;
  const anchoBarra = anchoGrupo / series.length;

  let svg = vals.map((v, i) => {
    const y = sy(v);
    return `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="${C.linea}" stroke-width="1" opacity=".6"/>` +
      `<text x="${x0 - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="${C.debil}">${esc(etiquetas[i])}</text>`;
  }).join("");

  const yCero = sy(0);
  categorias.forEach((c, i) => {
    const gx = x0 + i * paso + hueco / 2;
    series.forEach((s, si) => {
      const v = s.valores[i];
      if (v == null || Number.isNaN(v)) return;
      const col = s.color || C.serie[si % C.serie.length];
      const y = sy(v);
      const bx = gx + si * anchoBarra;
      svg += `<rect x="${bx.toFixed(1)}" y="${Math.min(y, yCero).toFixed(1)}" ` +
             `width="${Math.max(1, anchoBarra - 3).toFixed(1)}" height="${Math.abs(y - yCero).toFixed(1)}" fill="${col}"/>`;
      if (etiquetaValores) {
        const arriba = v >= 0;
        svg += `<text x="${(bx + (anchoBarra - 3) / 2).toFixed(1)}" y="${(arriba ? y - 6 : y + 14).toFixed(1)}" ` +
               `text-anchor="middle" font-size="10.5" fill="${C.tenue}">${esc(num(v, dec, lang) + unidad)}</text>`;
      }
    });
    svg += `<text x="${(gx + anchoGrupo / 2).toFixed(1)}" y="${y1 + 16}" text-anchor="middle" font-size="11" fill="${C.debil}">${esc(c)}</text>`;
  });

  // el cero se dibuja siempre que haya negativos: sin el, el signo se pierde
  if (lo < 0) svg += `<line x1="${x0}" y1="${yCero}" x2="${x1}" y2="${yCero}" stroke="${C.tenue}" stroke-width="1"/>`;

  if (referencia) {
    const y = sy(referencia.valor);
    svg += `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="${C.serie[1]}" stroke-width="1.5" stroke-dasharray="5 3"/>` +
      etiquetaSobreFondo(referencia.etiqueta, x1, y - 6, "end");
  }

  if (leyenda) {
    svg += series.map((s, si) => {
      const col = s.color || C.serie[si % C.serie.length];
      const lx = x0 + si * 190;
      return `<rect x="${lx}" y="${alto - 16}" width="10" height="10" fill="${col}"/>` +
        `<text x="${lx + 15}" y="${alto - 7}" font-size="11" fill="${C.tenue}">${esc(s.nombre)}</text>`;
    }).join("");
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
/**
 * Rotulos de la envoltura, por idioma. La primera version los tenia en espanol y el
 * reporte de Cleveland va en ingles: un grafico que dice "Fuente" dentro de un
 * documento ingles delata que el motor no estaba pensado para el entregable.
 * Los GUARDIAS no cambian con el idioma — un titular tiene que afirmar en los dos.
 */
const ROTULOS = {
  es: { fig: "Gráfico", fuente: "Fuente", al: "al" },
  en: { fig: "Figure", fuente: "Source", al: "as of" },
};

export function grafico({ numero, titular, subtitulo, unidad = "", n, cuerpo,
                          notas = [], fuente, fecha = null, hash = null, lang = "es" } = {}) {
  const R = ROTULOS[lang] || ROTULOS.es;
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
  const proc = [`${R.fuente}: ${fuente}`, `n = ${n}`, fecha ? `${R.al} ${fecha}` : null].filter(Boolean).join(" · ");
  return `<figure class="rq-fig">` +
    (numero != null ? `<div class="rq-fig-num">${R.fig} ${esc(numero)}</div>` : "") +
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
