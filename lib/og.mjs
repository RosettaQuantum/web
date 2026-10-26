/**
 * La tarjeta social por nota: SVG -> PNG 1200x630, sin navegador.
 *
 * POR QUE EXISTE Y QUE LA DISTINGUE DE scripts/build-og.mjs
 * ---------------------------------------------------------
 * `scripts/build-og.mjs` produce SEIS tarjetas FIJAS en el build, rasterizadas con el
 * mismo Chrome que usan las guardias. Sirve para las paginas que existen como archivo.
 * No sirve para las notas: se publican con un INSERT en D1 **sin rebuild**, asi que en el
 * momento del build la nota todavia no existe. Por eso esta pieza corre en el Worker, en
 * la peticion, y rasteriza con resvg-wasm: en un Worker no hay Chrome.
 *
 * TRES DISEÑOS, PORQUE LOS DATOS TRAEN TRES FORMAS
 * ------------------------------------------------
 * El motor de contenido escribe en `li_cards.spec_json` y hoy hay DOS formas distintas
 * conviviendo (leidas de produccion el 26-oct-2026, no supuestas):
 *
 *   A  kicker · date · title_html · bignum · vlabel_html · rtitle · panel[] · footnote
 *      Dos columnas. `title_html` y `vlabel_html` traen marcado propio del motor
 *      —<accent> y <b>—, que se INTERPRETA; imprimirlo literal seria peor que no tenerlo.
 *      `panel` es una lista de {n, text} con un ultimo item {text, gold:true}.
 *
 *   B  pillar · format · headline_{en,es} · number · subhead_{en,es} · limit_{en,es}
 *      Una columna y bilingue: el sufijo -es del id elige la variante.
 *
 *   NOTA  el respaldo cuando no hay fila en li_cards: title + tldr de la tabla `posts`.
 *
 * Las tres comparten primitivas (medida real, envoltura, marcado) a proposito: tres
 * copias del envolvedor serian tres sitios donde arreglar el mismo defecto.
 *
 * NINGUNA PALABRA DE LA TARJETA SE ESCRIBE AQUI (CLAUDE.md §5)
 * -----------------------------------------------------------
 * Todo lo que se pinta sale del spec que ya escribio el motor o de la fila de `posts`.
 * Lo unico compuesto es el rotulo de la forma B, y se compone con la MISMA plantilla que
 * la forma A ya trae escrita («PILLAR D · SCOREBOARD»). Y el corolario: el texto no se
 * RECORTA nunca. Si un bloque no entra, se omite entero y la cabecera lo declara; cortar
 * con puntos suspensivos cambiaria una frase aprobada sin que nadie lo vea.
 *
 * LA TIPOGRAFIA FALLA HACIA EL SILENCIO, Y POR ESO SE MIDE
 * -------------------------------------------------------
 * Medido con resvg: un texto cuya familia no esta cargada no da error ni cae a un
 * sustituto — sale VACIO, y el PNG queda en 1200x630 con el fondo correcto.
 *
 *     con las TTF:      bbox de "Hola" en 84px -> 143x59
 *     sin fontBuffers:  bbox de "Hola" en 84px -> undefined
 *
 * Lo mismo con el peso: `<b>` sin la cara SemiBold cargada sale en regular y nadie lo ve
 * (medido: 592 px en 400 contra 632 px en 600 para la misma frase). Por eso `medir()` es
 * a la vez la regla y el detector: si una linea mide 0, se ABORTA.
 *
 * PUNTO CIEGO DECLARADO
 * ---------------------
 * Esto comprueba que la familia y el peso pedidos PINTAN glifos y que cada bloque cae
 * dentro de su caja. NO comprueba que el resultado sea bonito, ni que el reparto de dos
 * columnas sea el que el motor imagino cuando escribio el spec: el spec describe datos,
 * no geometria. Eso lo mira una persona.
 */

/**
 * Los tokens del Sistema de marca v1.1. **Se leen de src/styles/global.css, no se
 * copian**: `tokensDeCss()` los extrae de ahi para que una tarjeta no pueda quedarse en
 * una paleta vieja — el caso real fue justo ese, una plantilla en basalto sobreviviendo
 * al cambio a papel.
 *
 * Los dos nombres que importan y se confunden: `--verdict` es el teal **de texto**
 * (#0C7268, 4,5:1 sobre papel) y NO el teal vivo #0F8B7E (3,82:1), que vive solo en
 * barras, puntos y el logotipo. Aqui todo es letra. Lo mismo para el oro: `--pending`
 * #8A6520, no #B8892E.
 */
export const TOKENS_PEDIDOS = ["paper", "panel", "ink", "ink-60", "line", "verdict", "pending"];

/** Extrae los tokens del bloque :root de global.css. Falla si falta alguno. */
export function tokensDeCss(css) {
  const t = {};
  for (const nombre of TOKENS_PEDIDOS) {
    const re = new RegExp("--" + nombre.replace(/-/g, "\\-") + "\\s*:\\s*(#[0-9A-Fa-f]{3,8})");
    const m = re.exec(String(css ?? ""));
    if (!m) throw new Error(`og: global.css no define --${nombre}. La tarjeta no se inventa un color.`);
    t[nombre] = m[1];
  }
  return t;
}

/** Geometria. Un solo lugar. */
export const LIENZO = {
  ancho: 1200, alto: 630, margen: 72,
  yMarca: 52, yKicker: 150, yRegla: 176, yCuerpo: 214, yPie: 534, yFootnote: 574,
  xDer: 716, anchoIzq: 596, anchoDer: 412,
  limiteCuerpo: 516,
};

const SERIF = "Newsreader", MONO = "IBM Plex Mono";
const XML = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };
export const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => XML[c]);
const desesc = (s) => String(s ?? "")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
  .replace(/&#3[49];/g, "'").replace(/&amp;/g, "&");

// ── Lectura de li_cards: lo PURO, para que una guardia de Node pueda ejercerlo ───────

/**
 * Las UNICAS columnas de li_cards que toca el codigo, y la fuente del SELECT de la ruta.
 * Vive aqui y no en og-ruta.mjs porque og-ruta importa .ttf/.css/.wasm por reglas de
 * modulo del Worker y Node no puede cargarlo: la guardia tiene que poder comprobar esto
 * sin levantar un Worker. T-og-tarjeta exige que estos nombres existan en
 * db/li-cards.schema.sql.
 *
 * `created_at` NO se lee: la frescura de la tarjeta la decide su contenido, no la fecha
 * de insercion.
 */
export const COLUMNAS_LI_CARDS = ["slug_base", "spec_json"];

/**
 * El id de una nota lleva sufijo de idioma y la clave de li_cards no:
 * `/og/advantaged-solve-en.png` busca `advantaged-solve`. Se prueban las dos por si un
 * slug termina de verdad en -en o -es.
 */
export function clavesDe(id) {
  const m = /^(.*)-(en|es)$/.exec(String(id ?? ""));
  const lang = m ? m[2] : "en";
  return { lang, claves: [...new Set(m ? [m[1], id] : [id])] };
}

/** Que forma tiene este spec. `null` = ninguna conocida, y entonces se cae a `posts`. */
export function formaDe(spec) {
  if (!spec || typeof spec !== "object") return null;
  if (typeof spec.title_html === "string" && spec.title_html.trim()) return "A";
  if (typeof spec.headline_en === "string" || typeof spec.headline_es === "string") return "B";
  return null;
}

// ── Marcado del motor ────────────────────────────────────────────────────────────────

/**
 * Parte el marcado que escribe el motor en trozos con estilo.
 * Reconoce `<accent>` (color de veredicto) y `<b>` (SemiBold). Cualquier otra etiqueta se
 * RETIRA y su texto se conserva: perder una palabra es peor que perder un enfasis.
 */
export function trozos(marcado) {
  const out = [];
  let acento = 0, negrita = 0, resto = String(marcado ?? "");
  const re = /<(\/?)([a-zA-Z][\w-]*)[^>]*>/g;
  let i = 0, m;
  const empuja = (t) => { if (t) out.push({ t: desesc(t), a: acento > 0, b: negrita > 0 }); };
  while ((m = re.exec(resto))) {
    empuja(resto.slice(i, m.index));
    const cierra = m[1] === "/", etiqueta = m[2].toLowerCase();
    if (etiqueta === "accent") acento += cierra ? -1 : 1;
    else if (etiqueta === "b" || etiqueta === "strong") negrita += cierra ? -1 : 1;
    i = m.index + m[0].length;
  }
  empuja(resto.slice(i));
  return out.filter((x) => x.t !== "");
}

/**
 * Los trozos, partidos en UNIDADES de envoltura. Una unidad es lo que no se puede
 * separar en dos lineas, y puede tener varios estilos adentro.
 *
 * EL DEFECTO QUE OBLIGA A ESTO, visto en la tarjeta de `what-is-quantum-utility` antes de
 * arreglarlo. Partir por palabras y volver a unir con un espacio **reescribe el texto
 * aprobado en los dos sentidos**:
 *
 *     fuente:  What is <accent>“quantum utility”</accent> — and is it <b>advantage</b>?
 *     salia:   What is“quantum utility” — and is itadvantage ?
 *
 * El espacio ANTES de una etiqueta se perdia (queda al final de un trozo y el split lo
 * tira) y aparecia uno INVENTADO antes del «?» (que en la fuente va pegado a la palabra).
 * Un espacio de mas o de menos en una frase que paso por Nicholas es texto cambiado.
 *
 * Por eso cada unidad recuerda si venia precedida de espacio (`sp`) y guarda sus piezas:
 * `advantage?` es UNA unidad de dos piezas, negrita y regular.
 */
export function palabras(ts) {
  const unidades = [];
  let pegar = false;   // la siguiente pieza va pegada a la unidad anterior
  for (const tr of ts) {
    const partes = String(tr.t).split(/(\s+)/);
    for (const parte of partes) {
      if (parte === "") continue;
      if (/^\s+$/.test(parte)) { pegar = false; continue; }
      if (pegar && unidades.length) unidades[unidades.length - 1].piezas.push({ t: parte, a: tr.a, b: tr.b });
      else unidades.push({ sp: unidades.length > 0, piezas: [{ t: parte, a: tr.a, b: tr.b }] });
      pegar = true;
    }
  }
  return unidades;
}

/** Atajo: texto plano (la tarjeta NOTA, el panel) tratado como un solo trozo sin estilo. */
export const plano = (s) => palabras([{ t: String(s ?? ""), a: false, b: false }]);

/** Pone toda una unidad en negrita, conservando su acento. */
const enNegrita = (u) => ({ ...u, piezas: u.piezas.map((p) => ({ ...p, b: true })) });

// ── Medida real ──────────────────────────────────────────────────────────────────────

/**
 * Medidor de ancho real, con cache. Devuelve el ancho en px de `texto` a `px`, en
 * `familia` y `peso` — medido por resvg, no estimado con una tabla de anchos.
 *
 * Linealidad: el ancho escala con el tamano de fuente, asi que se mide UNA vez a 100 px y
 * se multiplica. Devuelve 0 cuando resvg no pinto nada; quien llama DEBE tratar el 0 como
 * falla, porque es exactamente la forma que tiene aqui una tipografia que no cargo.
 *
 * El ancho del ESPACIO no se puede medir solo (su bbox es vacia): se saca por diferencia,
 * `"a a" - 2*"a"`. Sin esto la envoltura sumaria cero por cada espacio y todas las lineas
 * saldrian mas largas de lo que miden.
 */
export function medidor(Resvg, fontBuffers) {
  const cache = new Map();
  const base = 100;
  const crudo = (texto, fam, peso) => {
    const clave = `${fam}\u0000${peso}\u0000${texto}`;
    let a = cache.get(clave);
    if (a === undefined) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40000" height="400">`
        + `<text x="0" y="300" font-family="${esc(fam)}" font-weight="${peso}" font-size="${base}">${esc(texto)}</text></svg>`;
      const b = new Resvg(svg, { font: { fontBuffers, loadSystemFonts: false } }).innerBBox();
      a = b ? b.width : 0;
      cache.set(clave, a);
    }
    return a;
  };
  const medir = (texto, px, fam = SERIF, peso = 400) => (crudo(texto, fam, peso) * px) / base;
  medir.espacio = (px, fam = SERIF, peso = 400) =>
    Math.max(0, ((crudo("a a", fam, peso) - 2 * crudo("a", fam, peso)) * px) / base);
  return medir;
}

const peso = (p) => (p.b ? 600 : 400);

/** Ancho de una unidad: la suma de sus piezas, cada una con su peso. */
export function anchoUnidad(u, px, fam, medir) {
  let w = 0;
  for (const p of u.piezas) w += medir(p.t, px, fam, peso(p));
  return w;
}

/** Ancho de una linea de unidades. El espacio solo cuenta donde lo habia en la fuente. */
export function anchoLinea(ws, px, fam, medir) {
  let w = 0;
  for (let i = 0; i < ws.length; i++) {
    if (i > 0 && ws[i].sp) w += medir.espacio(px, fam, peso(ws[i].piezas[0]));
    w += anchoUnidad(ws[i], px, fam, medir);
  }
  return w;
}

/** Parte en lineas que no pasen de `max`. Nunca corta una unidad. */
export function envolver(ws, max, px, fam, medir) {
  const lineas = [];
  let actual = [];
  for (const u of ws) {
    const probar = [...actual, u];
    if (!actual.length || anchoLinea(probar, px, fam, medir) <= max) actual = probar;
    else { lineas.push(actual); actual = [u]; }
  }
  if (actual.length) lineas.push(actual);
  return lineas;
}

/**
 * El tamano mas grande en el que el texto entra en `ancho` y en `maxLineas`.
 * `{error:"sin-glifos"}` si la familia no pinta; `{error:"no-entra"}` si no cabe en el
 * cuerpo mas chico. Las dos son fallas, no tarjetas recortadas.
 */
export function ajustar(ws, { ancho, maxLineas, tamanos, fam = SERIF, medir }) {
  if (!ws.length) return { px: tamanos[0], lineas: [] };
  for (const px of tamanos) {
    const lineas = envolver(ws, ancho, px, fam, medir);
    const mayor = Math.max(...lineas.map((l) => anchoLinea(l, px, fam, medir)), 0);
    if (mayor === 0) return { error: "sin-glifos" };
    if (mayor <= ancho && lineas.length <= maxLineas) return { px, lineas };
  }
  return { error: "no-entra" };
}

// ── Dibujo ───────────────────────────────────────────────────────────────────────────

/**
 * Una linea de unidades, como un <text> con un <tspan> por pieza con estilo.
 *
 * `xml:space="preserve"` NO es decorativo: por defecto SVG colapsa y RECORTA el espacio
 * al principio de cada <tspan>, asi que un espacio escrito justo antes de un <accent>
 * desaparecia. El separador va ademas como texto suelto entre tspans, no dentro del
 * siguiente, para no depender de esa regla dos veces.
 */
export function lineaSvg(ws, { x, y, px, fam = SERIF, fill, tokens, ancla, ls }) {
  if (!ws.length) return "";
  const partes = [];
  for (let i = 0; i < ws.length; i++) {
    if (i > 0 && ws[i].sp) partes.push(" ");
    for (const p of ws[i].piezas) {
      const color = p.a ? tokens.verdict : null;
      partes.push(color || p.b
        ? `<tspan${color ? ` fill="${color}"` : ""}${p.b ? ` font-weight="600"` : ""}>${esc(p.t)}</tspan>`
        : esc(p.t));
    }
  }
  return `<text xml:space="preserve" x="${x}" y="${y.toFixed(1)}" font-family="${fam}" font-size="${px}" fill="${fill}"`
    + (ancla ? ` text-anchor="${ancla}"` : "") + (ls ? ` letter-spacing="${ls.toFixed(2)}"` : "")
    + `>${partes.join("")}</text>`;
}

/** Bloque de varias lineas. Devuelve el svg y el alto consumido. */
function bloque(lineas, { x, y, px, interlinea, fam, fill, tokens, ancla, ls }) {
  const out = [];
  let yy = y + px * 0.82;
  for (const l of lineas) { out.push(lineaSvg(l, { x, y: yy, px, fam, fill, tokens, ancla, ls })); yy += interlinea; }
  return { svg: out.join(""), alto: lineas.length * interlinea };
}

/** Cabecera comun: marca, rotulo, fecha y regla. Igual en las tres formas. */
function cabecera({ kicker, fecha, tokens, marcaInterior, marcaViewBox }) {
  const L = LIENZO;
  const out = [
    `<svg x="${L.margen}" y="${L.yMarca}" width="34" height="44" viewBox="${esc(marcaViewBox)}">${marcaInterior}</svg>`,
    `<text x="${L.margen + 48}" y="${L.yMarca + 32}" font-family="${SERIF}" font-size="26" fill="${tokens.ink}">Rosetta Quantum</text>`,
  ];
  if (kicker) out.push(`<text x="${L.margen}" y="${L.yKicker}" font-family="${MONO}" font-size="17" letter-spacing="2.72" fill="${tokens.verdict}">${esc(kicker)}</text>`);
  if (fecha) out.push(`<text x="${L.ancho - L.margen}" y="${L.yKicker}" font-family="${MONO}" font-size="17" letter-spacing="2.72" text-anchor="end" fill="${tokens["ink-60"]}">${esc(fecha)}</text>`);
  out.push(`<line x1="${L.margen}" y1="${L.yRegla}" x2="${L.ancho - L.margen}" y2="${L.yRegla}" stroke="${tokens.line}" stroke-width="1"/>`);
  return out.join("");
}

function pie({ footnote, tokens }) {
  const L = LIENZO;
  return `<line x1="${L.margen}" y1="${L.yPie}" x2="${L.ancho - L.margen}" y2="${L.yPie}" stroke="${tokens.line}" stroke-width="1"/>`
    + (footnote ? `<text x="${L.margen}" y="${L.yFootnote}" font-family="${MONO}" font-size="17" fill="${tokens["ink-60"]}">${esc(footnote)}</text>` : "");
}

const envoltura = (cuerpo, tokens) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${LIENZO.ancho}" height="${LIENZO.alto}" viewBox="0 0 ${LIENZO.ancho} ${LIENZO.alto}">`
  + `<rect width="${LIENZO.ancho}" height="${LIENZO.alto}" fill="${tokens.paper}"/>${cuerpo}</svg>`;

// ── Forma A: dos columnas, con marcado y panel ───────────────────────────────────────

export function tarjetaA(spec, { tokens, marcaInterior, marcaViewBox, medir }) {
  const L = LIENZO;
  const cuerpo = [cabecera({ kicker: spec.kicker, fecha: spec.date, tokens, marcaInterior, marcaViewBox })];
  const tieneDer = Array.isArray(spec.panel) && spec.panel.length > 0;
  const anchoIzq = tieneDer ? L.anchoIzq : L.ancho - L.margen * 2;

  // IZQUIERDA: titular, cifra grande y etiqueta de la cifra, ajustados JUNTOS.
  //
  // Se ajustan juntos porque por separado se pierde contenido: con el titular tomando el
  // cuerpo mas grande que le cabia a el solo, la columna se quedaba sin alto y `vlabel`
  // —la frase que explica de donde sale la cifra— se omitia en 2 de las 3 tarjetas
  // reales de forma A. Un titular dos puntos mas chico las salva a las tres. El orden es
  // el correcto: primero que quepa todo, despues que sea grande.
  let elegido = null;
  for (const px of [52, 46, 42, 38, 34]) {
    const lineas = envolver(palabras(trozos(spec.title_html)), anchoIzq, px, SERIF, medir);
    const mayor = Math.max(...lineas.map((l) => anchoLinea(l, px, SERIF, medir)), 0);
    if (mayor === 0) return { error: "sin-glifos" };
    if (mayor > anchoIzq || lineas.length > 4) continue;
    let y2 = L.yCuerpo + lineas.length * px * 1.12;
    const bn = spec.bignum ? ajustar(plano(spec.bignum), { ancho: anchoIzq, maxLineas: 1, tamanos: [56, 48, 40, 34], medir }) : null;
    if (bn && !bn.error) y2 += 34 + bn.px * 1.1;
    let vl = null;
    if (spec.vlabel_html) {
      for (const vpx of [19, 18, 17, 16]) {
        const vls = envolver(palabras(trozos(spec.vlabel_html)), anchoIzq, vpx, SERIF, medir);
        if (vls.length <= 4 && y2 + 14 + vls.length * vpx * 1.34 <= L.limiteCuerpo) { vl = { px: vpx, lineas: vls }; break; }
      }
      if (!vl) continue;   // con este titular no cabe la etiqueta: se prueba uno mas chico
    }
    elegido = { px, lineas, bn, vl };
    break;
  }
  // Si NINGUN cuerpo deja entrar la etiqueta, se dibuja sin ella y la cabecera lo dice.
  // Omitir un bloque entero y declararlo es honesto; recortarlo a puntos suspensivos
  // cambiaria una frase aprobada sin que nadie lo vea.
  const omitidos = [];
  if (!elegido) {
    const tit0 = ajustar(palabras(trozos(spec.title_html)), { ancho: anchoIzq, maxLineas: 4, tamanos: [52, 46, 42, 38, 34], medir });
    if (tit0.error) return { error: tit0.error };
    const bn0 = spec.bignum ? ajustar(plano(spec.bignum), { ancho: anchoIzq, maxLineas: 1, tamanos: [56, 48, 40, 34], medir }) : null;
    elegido = { px: tit0.px, lineas: tit0.lineas, bn: bn0, vl: null };
    if (spec.vlabel_html) omitidos.push("vlabel");
  }

  let y = L.yCuerpo;
  const bt = bloque(elegido.lineas, { x: L.margen, y, px: elegido.px, interlinea: elegido.px * 1.12, fill: tokens.ink, tokens });
  cuerpo.push(bt.svg);
  const cajaTitular = { x: L.margen, y: Math.round(y), w: anchoIzq, h: Math.round(bt.alto) };
  y += bt.alto;
  if (elegido.bn && !elegido.bn.error) {
    y += 34;
    cuerpo.push(bloque(elegido.bn.lineas, { x: L.margen, y, px: elegido.bn.px, interlinea: elegido.bn.px * 1.1, fill: tokens.ink, tokens }).svg);
    y += elegido.bn.px * 1.1;
  } else if (spec.bignum) omitidos.push("bignum");
  if (elegido.vl) {
    y += 14;
    cuerpo.push(bloque(elegido.vl.lineas, { x: L.margen, y, px: elegido.vl.px, interlinea: elegido.vl.px * 1.34, fill: tokens["ink-60"], tokens }).svg);
  }
  const tit = { px: elegido.px, lineas: elegido.lineas };

  // DERECHA: rotulo del panel y sus items. El tamano se ajusta para el panel ENTERO: un
  // item que no entra no se tira, se achica el bloque. Si ni al mas chico entra, el panel
  // se omite completo y la cabecera lo dice — media lista es peor que ninguna.
  if (tieneDer) {
    if (spec.rtitle) cuerpo.push(`<text x="${L.xDer}" y="${L.yCuerpo + 12}" font-family="${MONO}" font-size="15" letter-spacing="2.1" fill="${tokens["ink-60"]}">${esc(spec.rtitle)}</text>`);
    const y0 = L.yCuerpo + 42;
    const items = spec.panel.map((it) => ({ n: it.n ? String(it.n) : "", ws: plano(it.text), gold: Boolean(it.gold) }));
    let dibujado = null;
    for (const px of [18, 17, 16, 15, 14]) {
      const sangria = it => (it.n ? 56 : 0);
      const cortes = items.map((it) => envolver(it.ws, L.anchoDer - sangria(it), px, SERIF, medir));
      const inter = px * 1.3, hueco = 14;
      const alto = cortes.reduce((a, l) => a + l.length * inter + hueco, 0);
      const mayor = Math.max(...cortes.flat().map((l) => anchoLinea(l, px, SERIF, medir)), 0);
      if (mayor === 0) return { error: "sin-glifos" };
      if (y0 + alto <= L.limiteCuerpo + 18) { dibujado = { px, cortes, inter, hueco }; break; }
    }
    if (!dibujado) omitidos.push("panel");
    else {
      let yy = y0;
      items.forEach((it, i) => {
        const color = it.gold ? tokens.pending : tokens.ink;
        if (it.n) cuerpo.push(`<text x="${L.xDer}" y="${(yy + dibujado.px * 0.82).toFixed(1)}" font-family="${MONO}" font-size="${dibujado.px - 3}" fill="${tokens.verdict}">${esc(it.n)}</text>`);
        const ws = it.gold ? it.ws.map(enNegrita) : it.ws;
        const cortesEstilo = envolver(ws, L.anchoDer - (it.n ? 56 : 0), dibujado.px, SERIF, medir);
        const b = bloque(cortesEstilo, { x: L.xDer + (it.n ? 56 : 0), y: yy, px: dibujado.px, interlinea: dibujado.inter, fill: color, tokens });
        cuerpo.push(b.svg);
        yy += b.alto + dibujado.hueco;
      });
    }
  }

  cuerpo.push(pie({ footnote: spec.footnote, tokens }));
  return { svg: envoltura(cuerpo.join(""), tokens), px: tit.px, lineas: tit.lineas.length, caja: cajaTitular, omitidos };
}

// ── Forma B: una columna, bilingue ───────────────────────────────────────────────────

/** El rotulo se compone con la MISMA plantilla que la forma A ya trae escrita. */
export function kickerB(spec) {
  const partes = [];
  if (spec.pillar) partes.push(`PILLAR ${String(spec.pillar).toUpperCase()}`);
  if (spec.format) partes.push(String(spec.format).toUpperCase());
  return partes.join(" · ");
}

export function tarjetaB(spec, lang, { tokens, marcaInterior, marcaViewBox, medir }) {
  const L = LIENZO;
  const s = (base) => spec[`${base}_${lang}`] ?? spec[`${base}_en`] ?? "";
  const ancho = L.ancho - L.margen * 2;
  const cuerpo = [cabecera({ kicker: kickerB(spec), fecha: "", tokens, marcaInterior, marcaViewBox })];

  const tit = ajustar(palabras(trozos(s("headline"))), { ancho, maxLineas: 3, tamanos: [54, 48, 44, 40, 36], medir });
  if (tit.error) return { error: tit.error };
  let y = L.yCuerpo;
  const bt = bloque(tit.lineas, { x: L.margen, y, px: tit.px, interlinea: tit.px * 1.12, fill: tokens.ink, tokens });
  cuerpo.push(bt.svg);
  const caja = { x: L.margen, y: Math.round(y), w: ancho, h: Math.round(bt.alto) };
  y += bt.alto;

  const omitidos = [];
  if (spec.number) {
    const bn = ajustar(plano(spec.number), { ancho, maxLineas: 1, tamanos: [40, 34, 30, 26], medir });
    if (bn.error) omitidos.push("number");
    else { y += 26; cuerpo.push(bloque(bn.lineas, { x: L.margen, y, px: bn.px, interlinea: bn.px * 1.1, fam: MONO, fill: tokens.verdict, tokens }).svg); y += bn.px * 1.1; }
  }
  const sub = s("subhead");
  if (sub) {
    const v = ajustar(palabras(trozos(sub)), { ancho, maxLineas: 3, tamanos: [22, 21, 20, 19], medir });
    if (v.error || y + 16 + v.lineas.length * v.px * 1.36 > L.limiteCuerpo) omitidos.push("subhead");
    else { y += 16; cuerpo.push(bloque(v.lineas, { x: L.margen, y, px: v.px, interlinea: v.px * 1.36, fill: tokens["ink-60"], tokens }).svg); }
  }
  // `limit` es la linea de honestidad del motor («nuestros negativos no autorizan…»).
  // Va al pie y en el tono de alerta suave: si una tarjeta de marcador se publica SIN su
  // limite, la tarjeta afirma mas de lo que el post sostiene.
  const lim = s("limit");
  const L2 = lim ? ajustar(plano(lim), { ancho, maxLineas: 1, tamanos: [17, 16, 15, 14], medir }) : null;
  cuerpo.push(pie({ tokens }));
  if (L2 && !L2.error) cuerpo.push(bloque(L2.lineas, { x: L.margen, y: LIENZO.yFootnote - 14, px: L2.px, interlinea: L2.px, fam: MONO, fill: tokens["ink-60"], tokens }).svg);
  else if (lim) omitidos.push("limit");

  return { svg: envoltura(cuerpo.join(""), tokens), px: tit.px, lineas: tit.lineas.length, caja, omitidos };
}

// ── Forma NOTA: el respaldo desde la tabla `posts` ───────────────────────────────────

export function tarjetaNota({ titular, tldr, rotulo, pie: piePie }, { tokens, marcaInterior, marcaViewBox, medir }) {
  const L = LIENZO;
  const ancho = L.ancho - L.margen * 2;
  const cuerpo = [cabecera({ kicker: rotulo, fecha: "", tokens, marcaInterior, marcaViewBox })];

  // El tldr se resuelve ANTES del titular porque le quita alto. Y NO se recorta: si no
  // entra entero en dos lineas se omite, y la cabecera lo declara.
  const omitidos = [];
  let tldrL = null;
  if (tldr) {
    const t = ajustar(plano(tldr), { ancho, maxLineas: 2, tamanos: [30], medir });
    if (t.error) omitidos.push("tldr"); else tldrL = t;
  }
  const altoTldr = tldrL ? tldrL.lineas.length * tldrL.px * 1.3 + 26 : 0;
  const tit = ajustar(plano(titular), {
    ancho, maxLineas: 4, tamanos: [84, 76, 68, 60, 52, 46], medir,
  });
  if (tit.error) return { error: tit.error };
  const alto = tit.lineas.length * tit.px * 1.1 + altoTldr;
  const yBase = Math.max(L.yCuerpo, L.yPie - 62 - alto);
  const bt = bloque(tit.lineas, { x: L.margen, y: yBase, px: tit.px, interlinea: tit.px * 1.1, fill: tokens.ink, tokens });
  cuerpo.push(bt.svg);
  if (tldrL) cuerpo.push(bloque(tldrL.lineas, { x: L.margen, y: yBase + bt.alto + 14, px: tldrL.px, interlinea: tldrL.px * 1.3, fill: tokens["ink-60"], tokens }).svg);
  cuerpo.push(pie({ footnote: piePie, tokens }));
  return {
    svg: envoltura(cuerpo.join(""), tokens), px: tit.px, lineas: tit.lineas.length,
    caja: { x: L.margen, y: Math.round(yBase), w: ancho, h: Math.round(bt.alto) }, omitidos,
  };
}

// ── Rasterizado ──────────────────────────────────────────────────────────────────────

/** El interior y el viewBox de public/rosetta-mark.svg, sin copiar el path. */
export function marcaDeSvg(fuente) {
  const s = String(fuente ?? "");
  const vb = /viewBox="([^"]+)"/.exec(s);
  const dentro = /<svg[^>]*>([\s\S]*)<\/svg>/.exec(s);
  if (!vb || !dentro) throw new Error("og: public/rosetta-mark.svg no tiene la forma esperada");
  return { marcaViewBox: vb[1], marcaInterior: dentro[1].trim() };
}

/**
 * Dibuja y rasteriza. `forma` elige el diseño; `Resvg` y `fontBuffers` se inyectan para
 * que el Worker y la guardia corran EXACTAMENTE este codigo.
 */
export function construirTarjeta({ forma, spec, lang, nota, tokens, marcaInterior, marcaViewBox }, { Resvg, fontBuffers }) {
  const medir = medidor(Resvg, fontBuffers);
  const ctx = { tokens, marcaInterior, marcaViewBox, medir };
  const r = forma === "A" ? tarjetaA(spec, ctx)
    : forma === "B" ? tarjetaB(spec, lang === "es" ? "es" : "en", ctx)
    : tarjetaNota(nota, ctx);
  if (r.error) return { error: r.error };
  const img = new Resvg(r.svg, {
    font: { fontBuffers, loadSystemFonts: false, defaultFontFamily: SERIF },
    fitTo: { mode: "original" },
  }).render();
  if (img.width !== LIENZO.ancho || img.height !== LIENZO.alto) return { error: `dimension:${img.width}x${img.height}` };
  return { png: img.asPng(), svg: r.svg, meta: { px: r.px, lineas: r.lineas, caja: r.caja, omitidos: r.omitidos || [], ancho: img.width, alto: img.height } };
}

/** Hash corto y estable del contenido. Entra en la clave de cache y en el ETag. */
export function huella(partes) {
  let h = 0x811c9dc5;
  const s = partes.filter((x) => x != null).join("\u0000");
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}

/**
 * Lee un PNG de verdad: cabecera IHDR y pixeles. Existe porque «mide 1200x630» y «el
 * fondo es papel» tienen que salir DEL ARCHIVO, no del codigo que lo escribio.
 * `inflate` se inyecta (node:zlib en una guardia) para que este archivo siga sirviendo
 * dentro del Worker. Soporta 8 bits sin entrelazado, en RGBA (tipo 6, el que produce
 * resvg) y RGB (tipo 2, el que produce Chrome en las seis tarjetas fijas de
 * scripts/build-og.mjs). Lo segundo no estaba y se noto leyendo /og/default.png: el
 * lector se caia con «PNG no soportado» sobre un archivo perfectamente valido.
 */
export function leerPng(bytes, inflate) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const firma = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) if (b[i] !== firma[i]) throw new Error("no es un PNG");
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let p = 8, ancho = 0, alto = 0, bits = 0, tipo = -1, entrelazado = 1;
  const idat = [];
  while (p < b.length) {
    const largo = dv.getUint32(p);
    const nombre = String.fromCharCode(b[p + 4], b[p + 5], b[p + 6], b[p + 7]);
    if (nombre === "IHDR") {
      ancho = dv.getUint32(p + 8); alto = dv.getUint32(p + 12);
      bits = b[p + 16]; tipo = b[p + 17]; entrelazado = b[p + 20];
    } else if (nombre === "IDAT") idat.push(b.subarray(p + 8, p + 8 + largo));
    else if (nombre === "IEND") break;
    p += 12 + largo;
  }
  const api = { ancho, alto, bits, tipo };
  api.pixel = (x, y) => {
    if (bits !== 8 || (tipo !== 6 && tipo !== 2) || entrelazado !== 0) throw new Error(`PNG no soportado: bits=${bits} tipo=${tipo} entrelazado=${entrelazado}`);
    const crudoPng = new Uint8Array(inflate(concat(idat)));
    const canales = tipo === 6 ? 4 : 3, paso = ancho * canales;
    const img = new Uint8Array(alto * paso);
    let q = 0;
    for (let fila = 0; fila < alto; fila++) {
      const filtro = crudoPng[q++];
      for (let i = 0; i < paso; i++) {
        const cru = crudoPng[q + i];
        const a = i >= canales ? img[fila * paso + i - canales] : 0;
        const arr = fila > 0 ? img[(fila - 1) * paso + i] : 0;
        const aa = fila > 0 && i >= canales ? img[(fila - 1) * paso + i - canales] : 0;
        let v;
        if (filtro === 0) v = cru;
        else if (filtro === 1) v = cru + a;
        else if (filtro === 2) v = cru + arr;
        else if (filtro === 3) v = cru + ((a + arr) >> 1);
        else if (filtro === 4) {
          const pr = a + arr - aa, pa = Math.abs(pr - a), pb = Math.abs(pr - arr), pc = Math.abs(pr - aa);
          v = cru + (pa <= pb && pa <= pc ? a : pb <= pc ? arr : aa);
        } else throw new Error(`filtro PNG ${filtro} desconocido`);
        img[fila * paso + i] = v & 0xff;
      }
      q += paso;
    }
    api.pixel = (xx, yy) => {
      const o = yy * paso + xx * canales;
      return [img[o], img[o + 1], img[o + 2], canales === 4 ? img[o + 3] : 255];
    };
    return api.pixel(x, y);
  };
  return api;
}

function concat(trozosArr) {
  const n = trozosArr.reduce((a, t) => a + t.length, 0);
  const out = new Uint8Array(n);
  let o = 0;
  for (const t of trozosArr) { out.set(t, o); o += t.length; }
  return out;
}

/** #RRGGBB -> [r,g,b]. */
export function hexARgb(hex) {
  const h = String(hex).replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
}
