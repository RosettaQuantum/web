/**
 * La tarjeta social por nota: SVG -> PNG 1200x630, sin navegador.
 *
 * POR QUE EXISTE Y QUE LA DISTINGUE DE scripts/build-og.mjs
 * ---------------------------------------------------------
 * `scripts/build-og.mjs` produce SEIS tarjetas FIJAS en el build, rasterizadas con el
 * mismo Chrome que usan las guardias. Sirve para las paginas que existen como archivo.
 * No sirve para las notas: se publican con un INSERT en D1 **sin rebuild** (memoria del
 * proyecto, "Opcion C"), asi que en el momento del build la nota todavia no existe. Hoy
 * TODAS las notas servidas desde D1 comparten /og/default.png, y en LinkedIn se ven
 * identicas entre si.
 *
 * Por eso esta pieza corre en el Worker, en la peticion, y por eso rasteriza con
 * resvg-wasm: en un Worker no hay Chrome. Es la unica dependencia nueva del repo y se
 * agrega con una razon que el comentario de build-og.mjs («un pipeline social no
 * justifica traer un rasterizador») no cubria: ahi habia Chrome, aqui no hay ninguno.
 *
 * NINGUNA PALABRA DE LA TARJETA SE ESCRIBE AQUI (CLAUDE.md §5)
 * -----------------------------------------------------------
 * El titular es el `title` de la nota, el subtitulo es su `tldr`, y el rotulo se compone
 * con las MISMAS cadenas que worker.js ya pinta en el rotulo del articulo (`Pilar`/
 * `Pillar`, `Estado a`/`State as of`). La tarjeta no introduce texto publico nuevo: si
 * una frase no paso por Nicholas, no esta aqui.
 *
 * Y el corolario: el `tldr` NO SE RECORTA. Si no entra completo en dos lineas, se omite
 * y la cabecera lo declara (`tldr:omitida`). Cortar con puntos suspensivos cambiaria una
 * frase aprobada sin que nadie lo vea.
 *
 * LA TIPOGRAFIA FALLA HACIA EL SILENCIO, Y POR ESO SE MIDE
 * -------------------------------------------------------
 * Medido con resvg el 26-oct-2026: un texto cuya familia no esta cargada no sale en rojo
 * ni lanza error — sale VACIO, y el PNG queda en 1200x630 con el fondo correcto. Es
 * exactamente el defecto de [[texto-vivo-cae-al-sustituto-sin-avisar]], con la agravante
 * de que en un Worker no hay fuentes del sistema a las que caer.
 *
 *     con las dos TTF:  bbox de "Hola" en 84px -> 143x59
 *     sin fontBuffers:  bbox de "Hola" en 84px -> undefined
 *
 * Asi que `medidor()` es a la vez la regla y el detector: si una linea mide 0, se ABORTA.
 * Una tarjeta en blanco cacheada meses en LinkedIn es peor que no tener tarjeta.
 *
 * PUNTO CIEGO DECLARADO
 * ---------------------
 * Esto comprueba que la familia pedida PINTA glifos y que el bloque de texto cae dentro
 * de la caja. NO comprueba que los glifos sean los de Newsreader y no los de otra TTF
 * que alguien ponga en og/fonts/ con el mismo nombre de archivo, ni que el resultado sea
 * bonito. Lo primero lo cierra el sha de las fuentes; lo segundo lo mira una persona.
 */

/**
 * Los tokens del Sistema de marca v1.1. **Se leen de src/styles/global.css, no se
 * copian**: `tokensDeCss()` los extrae de ahi para que una tarjeta no pueda quedarse en
 * una paleta vieja — el caso real del 26-oct fue justo ese, una plantilla en basalto
 * sobreviviendo al cambio a papel.
 *
 * Los dos nombres que importan y se confunden: `--verdict` es el teal **de texto**
 * (#0C7268, 4,5:1 sobre papel) y NO el teal vivo #0F8B7E (3,82:1), que vive solo en
 * barras, puntos y el logotipo. El rotulo de la tarjeta es texto de 20px: va en el
 * accesible. Lo mismo para el ocre: `--pending` #8A6520, no #B8892E.
 */
export const TOKENS_PEDIDOS = ["paper", "panel", "ink", "ink-60", "line", "verdict"];

/** Extrae los tokens del bloque :root de global.css. Falla si falta alguno. */
export function tokensDeCss(css) {
  const t = {};
  for (const nombre of TOKENS_PEDIDOS) {
    const re = new RegExp("--" + nombre.replace(/[-]/g, "\\-") + "\\s*:\\s*(#[0-9A-Fa-f]{3,8})");
    const m = re.exec(String(css ?? ""));
    if (!m) throw new Error(`og: global.css no define --${nombre}. La tarjeta no se inventa un color.`);
    t[nombre] = m[1];
  }
  return t;
}

/** Geometria de la tarjeta. Un solo lugar. */
export const LIENZO = {
  ancho: 1200, alto: 630,
  margen: 72, arribaMarca: 52,
  yRotulo: 196, yTituloTope: 232, yReglaPie: 534, yPie: 574,
  tamanosTitular: [84, 76, 68, 60, 52, 46],
  tamanoTldr: 30, tamanoRotulo: 20, tamanoPie: 24, tamanoMarca: 28,
};

const XML = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };
export const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => XML[c]);

/**
 * Medidor de ancho real, con cache. Devuelve el ancho en px de `texto` a `px` en
 * `familia`, medido por resvg — no estimado por una tabla de anchos.
 *
 * Linealidad: el ancho de una cadena escala con el tamano de fuente, asi que se mide UNA
 * vez a 100px y se multiplica. Eso convierte "medir cada palabra en cada tamano
 * candidato" (unas 70 rasterizaciones) en "medir cada palabra una vez" (unas 12).
 *
 * Devuelve 0 cuando resvg no pinto nada. Quien llama DEBE tratar el 0 como falla.
 */
export function medidor(Resvg, fontBuffers) {
  const cache = new Map();
  const base = 100;
  return function medir(texto, px, familia) {
    if (!texto) return 0;
    const clave = familia + "\u0000" + texto;
    let a100 = cache.get(clave);
    if (a100 === undefined) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="20000" height="400">`
        + `<text x="0" y="300" font-family="${esc(familia)}" font-size="${base}">${esc(texto)}</text></svg>`;
      const r = new Resvg(svg, { font: { fontBuffers, loadSystemFonts: false } });
      const b = r.innerBBox();
      a100 = b ? b.width : 0;
      cache.set(clave, a100);
    }
    return (a100 * px) / base;
  };
}

/** Parte `texto` en lineas que no pasen de `maxAncho` a `px`. Nunca corta una palabra. */
export function envolver(texto, maxAncho, px, familia, medir) {
  const palabras = String(texto ?? "").trim().split(/\s+/).filter(Boolean);
  const lineas = [];
  let actual = "";
  for (const p of palabras) {
    const probar = actual ? actual + " " + p : p;
    if (medir(probar, px, familia) <= maxAncho || !actual) actual = probar;
    else { lineas.push(actual); actual = p; }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

/**
 * Elige el tamano mas grande en el que el titular entra en la caja, en ancho y en alto.
 * Devuelve null si no entra en ninguno: eso es una falla, no una tarjeta recortada.
 */
export function ajustarTitular(titulo, { ancho, alto, familia, medir, tamanos = LIENZO.tamanosTitular }) {
  for (const px of tamanos) {
    const lineas = envolver(titulo, ancho, px, familia, medir);
    const interlinea = px * 1.1;
    const anchoMax = Math.max(...lineas.map((l) => medir(l, px, familia)), 0);
    if (anchoMax === 0) return { error: "sin-glifos" };
    if (anchoMax <= ancho && lineas.length * interlinea <= alto) return { px, lineas, interlinea };
  }
  return { error: "no-entra" };
}

/**
 * La tarjeta, en SVG. `marcaInterior` y `marcaViewBox` salen de public/rosetta-mark.svg
 * —el mismo archivo que sirve el sitio—, nunca de una copia del path aqui.
 */
export function tarjetaSvg({ titular, rotulo, pie, tldr, tokens, marcaInterior, marcaViewBox }, medir) {
  const L = LIENZO;
  const anchoUtil = L.ancho - L.margen * 2;
  const SERIF = "Newsreader", MONO = "IBM Plex Mono";

  // El tldr se resuelve ANTES del titular porque le quita alto: si entra, el titular
  // dispone de menos caja. Al reves el titular se quedaria grande y se pisarian.
  let tldrLineas = [];
  const altoTldr = () => (tldrLineas.length ? tldrLineas.length * L.tamanoTldr * 1.3 + 26 : 0);
  if (tldr) {
    const l = envolver(tldr, anchoUtil, L.tamanoTldr, SERIF, medir);
    if (l.length <= 2 && Math.max(...l.map((x) => medir(x, L.tamanoTldr, SERIF))) <= anchoUtil) tldrLineas = l;
  }

  const cajaAlto = L.yReglaPie - 34 - L.yTituloTope - altoTldr();
  const t = ajustarTitular(titular, { ancho: anchoUtil, alto: cajaAlto, familia: SERIF, medir });
  if (t.error) return { error: t.error };

  const trozos = [];
  trozos.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${L.ancho}" height="${L.alto}" viewBox="0 0 ${L.ancho} ${L.alto}">`);
  trozos.push(`<rect width="${L.ancho}" height="${L.alto}" fill="${tokens.paper}"/>`);
  // La marca, anidada con su propio viewBox: resvg soporta <svg> dentro de <svg>.
  trozos.push(`<svg x="${L.margen}" y="${L.arribaMarca}" width="34" height="44" viewBox="${esc(marcaViewBox)}">${marcaInterior}</svg>`);
  trozos.push(`<text x="${L.margen + 48}" y="${L.arribaMarca + 32}" font-family="${SERIF}" font-size="${L.tamanoMarca}" fill="${tokens.ink}">Rosetta Quantum</text>`);
  trozos.push(`<text x="${L.margen}" y="${L.yRotulo}" font-family="${MONO}" font-size="${L.tamanoRotulo}" letter-spacing="${(L.tamanoRotulo * 0.18).toFixed(2)}" fill="${tokens.verdict}">${esc(rotulo.toUpperCase())}</text>`);

  // El bloque de texto se ANCLA ABAJO, como el `space-between` de las seis tarjetas
  // fijas: marca arriba, dato abajo, y el titular empujado contra el pie. Anclarlo
  // arriba dejaba un hueco grande y variable debajo del tldr, distinto en cada nota.
  // Si el bloque es alto, el tope manda y no se sube mas alla del rotulo.
  const altoBloque = t.lineas.length * t.interlinea + altoTldr();
  const yBase = Math.max(L.yTituloTope, L.yReglaPie - 62 - altoBloque);
  let y = yBase + t.px * 0.82;
  for (const linea of t.lineas) {
    trozos.push(`<text x="${L.margen}" y="${y.toFixed(1)}" font-family="${SERIF}" font-size="${t.px}" fill="${tokens.ink}">${esc(linea)}</text>`);
    y += t.interlinea;
  }
  if (tldrLineas.length) {
    let yt = y - t.interlinea + t.px * 0.3 + 44;
    for (const linea of tldrLineas) {
      trozos.push(`<text x="${L.margen}" y="${yt.toFixed(1)}" font-family="${SERIF}" font-size="${L.tamanoTldr}" fill="${tokens["ink-60"]}">${esc(linea)}</text>`);
      yt += L.tamanoTldr * 1.3;
    }
  }
  trozos.push(`<line x1="${L.margen}" y1="${L.yReglaPie}" x2="${L.ancho - L.margen}" y2="${L.yReglaPie}" stroke="${tokens.line}" stroke-width="1"/>`);
  trozos.push(`<text x="${L.margen}" y="${L.yPie}" font-family="${MONO}" font-size="${L.tamanoPie}" fill="${tokens["ink-60"]}">${esc(pie)}</text>`);
  trozos.push(`</svg>`);
  // La CAJA del titular viaja con el resultado para que una guardia pueda mirar la tinta
  // AHI y no en toda la tarjeta. Medido: quitando el titular entero, la tinta del lienzo
  // completo solo baja de 5,2% a 1,87% —la marca, el rotulo, el tldr, la regla y el pie
  // siguen pintando— y un umbral sobre el total daba por buena una tarjeta SIN TITULAR.
  return {
    svg: trozos.join(""), px: t.px, lineas: t.lineas.length, tldr: tldrLineas.length,
    caja: { x: L.margen, y: Math.round(yBase), w: anchoUtil, h: Math.round(t.lineas.length * t.interlinea) },
  };
}

/** El interior y el viewBox de public/rosetta-mark.svg, sin copiar el path. */
export function marcaDeSvg(fuente) {
  const s = String(fuente ?? "");
  const vb = /viewBox="([^"]+)"/.exec(s);
  const dentro = /<svg[^>]*>([\s\S]*)<\/svg>/.exec(s);
  if (!vb || !dentro) throw new Error("og: public/rosetta-mark.svg no tiene la forma esperada");
  return { marcaViewBox: vb[1], marcaInterior: dentro[1].trim() };
}

/**
 * Renderiza la tarjeta a PNG. Devuelve `{ png, meta }` o `{ error }`.
 * `Resvg` y `fontBuffers` se inyectan para que el Worker y la guardia usen EXACTAMENTE
 * este mismo codigo — una lista que vive en dos lugares ya divergio.
 */
export function construirTarjeta(datos, { Resvg, fontBuffers }) {
  const medir = medidor(Resvg, fontBuffers);
  const r = tarjetaSvg(datos, medir);
  if (r.error) return { error: r.error };
  const img = new Resvg(r.svg, {
    font: { fontBuffers, loadSystemFonts: false, defaultFontFamily: "Newsreader" },
    fitTo: { mode: "original" },
  }).render();
  if (img.width !== LIENZO.ancho || img.height !== LIENZO.alto) {
    return { error: `dimension:${img.width}x${img.height}` };
  }
  return { png: img.asPng(), meta: { px: r.px, lineas: r.lineas, tldr: r.tldr, caja: r.caja, ancho: img.width, alto: img.height } };
}

/** Hash corto y estable del contenido de la tarjeta. Entra en la clave de cache y en el ETag. */
export function huella(partes) {
  let h = 0x811c9dc5;
  const s = partes.filter((x) => x != null).join("\u0000");
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}

/**
 * Lee un PNG de verdad: cabecera IHDR y pixeles. Existe porque «mide 1200x630» y «el
 * fondo es papel» tienen que salir DEL ARCHIVO, no del codigo que lo escribio. Un
 * guardia que se cree la constante de su propio generador se da la razon solo.
 *
 * `inflate` se inyecta (node:zlib en una guardia, DecompressionStream en otro sitio)
 * para que este archivo siga sirviendo dentro del Worker, donde no hay node:zlib.
 * Solo soporta el PNG que produce resvg: 8 bits, RGBA (colorType 6), sin entrelazado.
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
    const datos = b.subarray(p + 8, p + 8 + largo);
    if (nombre === "IHDR") {
      ancho = dv.getUint32(p + 8); alto = dv.getUint32(p + 12);
      bits = b[p + 16]; tipo = b[p + 17]; entrelazado = b[p + 20];
    } else if (nombre === "IDAT") idat.push(datos);
    else if (nombre === "IEND") break;
    p += 12 + largo;
  }
  const api = { ancho, alto, bits, tipo };
  api.pixel = (x, y) => {
    if (bits !== 8 || tipo !== 6 || entrelazado !== 0) {
      throw new Error(`PNG no soportado: bits=${bits} tipo=${tipo} entrelazado=${entrelazado}`);
    }
    const crudo = new Uint8Array(inflate(concat(idat)));
    const canales = 4, paso = ancho * canales;
    const img = new Uint8Array(alto * paso);
    let q = 0;
    for (let fila = 0; fila < alto; fila++) {
      const filtro = crudo[q++];
      for (let i = 0; i < paso; i++) {
        const cru = crudo[q + i];
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
      return [img[o], img[o + 1], img[o + 2], img[o + 3]];
    };
    return api.pixel(x, y);
  };
  return api;
}

function concat(trozos) {
  const n = trozos.reduce((a, t) => a + t.length, 0);
  const out = new Uint8Array(n);
  let o = 0;
  for (const t of trozos) { out.set(t, o); o += t.length; }
  return out;
}

/** #RRGGBB -> [r,g,b]. */
export function hexARgb(hex) {
  const h = String(hex).replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
}
