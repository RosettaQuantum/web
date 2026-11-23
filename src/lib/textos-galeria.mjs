// Los textos APROBADOS de la galería «Publicaciones de Rosetta» y del botón «Seguridad» (23-nov-2026).
//
// La fuente es src/data/publicaciones/textos-aprobados/TEXTOS-galeria-seguridad-2026-11-23.md: copia byte
// a byte del documento que Nicholas aprobó («Sí, así»), con su sha256 en APROBADOS.json del mismo
// directorio. La galería (components/publicaciones/) y la barra (NavV2) LEEN de aquí: no hay una segunda
// copia de estos textos en el código. scripts/check-textos-galeria.mjs grita si el documento cambia un
// byte, si una línea que se espera falta, o si lo construido no dice lo aprobado.
//
// Falla CERRADO: una línea que no aparece exactamente una vez lanza, y el build se detiene. Un texto que
// falta no se reemplaza por nada.
//
// Las plantillas del informe en inglés traen marcadores ‹…›. Se llenan EN ORDEN DE APARICIÓN (`llenar`),
// no por nombre: el documento repite ‹n› con dos sentidos en la misma línea («no. ‹n› · median ‹m› ·
// n = ‹n›» es número de edición y luego número de organizaciones).

export const ARCHIVO = "TEXTOS-galeria-seguridad-2026-11-23.md";
export const DIR = "src/data/publicaciones/textos-aprobados/";

function seccion(md, titulo) {
  const i = md.indexOf(`\n## ${titulo}\n`);
  if (i < 0) throw new Error(`textos de la galería: falta la sección «## ${titulo}»`);
  const j = md.indexOf("\n## ", i + 1);
  return md.slice(i, j < 0 ? md.length : j);
}

// «- **PROVISORIO** <lang> · <clave>: <texto>» — exactamente una vez en la sección.
function linea(sec, lang, clave, titulo) {
  const pre = `- **PROVISORIO** ${lang} · ${clave}: `;
  const filas = sec.split("\n").filter((l) => l.startsWith(pre));
  if (filas.length !== 1) throw new Error(`textos de la galería: «${lang} · ${clave}» aparece ${filas.length} veces en «${titulo}» (tiene que ser 1)`);
  const t = filas[0].slice(pre.length);
  if (!t.trim()) throw new Error(`textos de la galería: «${lang} · ${clave}» está vacío`);
  return t;
}

const partir = (t, sep, q) => {
  const i = t.indexOf(sep);
  if (i < 0) throw new Error(`textos de la galería: «${q}» no trae el separador «${sep}»: ${t}`);
  return [t.slice(0, i), t.slice(i + sep.length)];
};
const sinFlecha = (t) => t.replace(/ →$/, "");

/** Llena los marcadores ‹…› en orden. Si sobran o faltan valores, lanza. */
export function llenar(plantilla, valores) {
  const marcas = plantilla.match(/‹[^›]+›/g) || [];
  if (marcas.length !== valores.length) throw new Error(`plantilla «${plantilla}»: trae ${marcas.length} marcadores y se dieron ${valores.length} valores`);
  let k = 0;
  return plantilla.replace(/‹[^›]+›/g, () => String(valores[k++]));
}

export function textosGaleria(md) {
  // El menú: «- **PROVISORIO** es: `Seguridad` → /es/q-ready»
  const menu = {};
  const secMenu = seccion(md, "Menú de arriba");
  for (const [lang, ruta] of [["es", "/es/q-ready"], ["en", "/q-ready"]]) {
    const re = new RegExp("^- \\*\\*PROVISORIO\\*\\* " + lang + ": `([^`]+)` → (\\S+)$", "gm");
    const m = [...secMenu.matchAll(re)];
    if (m.length !== 1) throw new Error(`textos de la galería: el botón del menú en «${lang}» aparece ${m.length} veces`);
    if (m[0][2] !== ruta) throw new Error(`textos de la galería: el botón del menú en «${lang}» apunta a ${m[0][2]}, no a ${ruta}`);
    // 23-nov-2026: «Security» llevó unas horas a /es/q-ready, mientras /q-ready era la página vieja. Desde que
    // /q-ready es la portada nueva en inglés, vuelve a su destino aprobado: el que dice el documento.
    menu[lang] = { texto: m[0][1], ruta };
  }

  const tG = "Galería · encabezado", sG = seccion(md, tG);
  const galeria = {};
  for (const lang of ["es", "en"]) galeria[lang] = { titulo: linea(sG, lang, "título", tG), bajada: linea(sG, lang, "bajada", tG) };

  const tGuia = "Tarjeta · Guía de criptografía post-cuántica", sGuia = seccion(md, tGuia);
  const mt = /Título: es el de la guía, sin cambio \(«([^»]+)» \/\s*«([^»]+)»\)\./.exec(sGuia);
  if (!mt) throw new Error("textos de la galería: falta el título de la guía («Título: es el de la guía, sin cambio (« … » / « … »).»)");
  const guia = {};
  for (const [lang, titulo] of [["es", mt[1]], ["en", mt[2]]]) {
    const enl = linea(sGuia, lang, "enlaces", tGuia).split(" · ");
    if (enl.length !== 2) throw new Error(`textos de la galería: «${lang} · enlaces» tiene que traer dos enlaces separados por « · »`);
    guia[lang] = {
      etiqueta: partir(linea(sGuia, lang, "etiqueta", tGuia), " · ", `${lang} · etiqueta`),
      titulo,
      bajada: linea(sGuia, lang, "bajada", tGuia),
      meta: linea(sGuia, lang, "datos", tGuia),
      enlaces: enl.map(sinFlecha),
      alt: linea(sGuia, lang, "texto alternativo de la portada", tGuia),
    };
  }

  const tI = "Tarjeta · Informe PQC mensual", sI = seccion(md, tI);
  const L = (k) => linea(sI, "en", k, tI);
  const [etqIzq, etqDer] = partir(L("etiqueta"), " · ", "en · etiqueta");
  const [cifraIzq, cifraDer] = partir(L("cifra"), " — ", "en · cifra");
  const [cifraL1, cifraL2] = partir(cifraDer, ", ", "en · cifra");
  const [grafT, grafR] = partir(L("gráfico"), " — ", "en · gráfico");
  const mR = /^rótulo «([^»]+)»$/.exec(grafR);
  if (!mR) throw new Error(`textos de la galería: «en · gráfico» no trae «rótulo «…»»: ${grafR}`);
  const [archT, archFila] = partir(L("archivo"), " — ", "en · archivo");
  if (!cifraIzq.startsWith("‹")) throw new Error(`textos de la galería: «en · cifra» tiene que empezar por la cifra: ${cifraIzq}`);
  const informeEn = {
    etiqueta: [etqIzq, etqDer],                       // [texto, plantilla: edición, mes]
    titulo: L("título"),
    cifraPeque: cifraIzq.replace(/^‹[^›]+›/, ""),     // « QEX · median», lo que va junto a la cifra
    cifraLineas: [cifraL1, cifraL2],                  // plantillas: [n], [min, max]
    graficoTitulo: grafT,                             // plantilla: [mes]
    graficoRotulo: mR[1],                             // plantilla: [techo]
    pie: L("pie del gráfico"),                        // plantilla: [n, max, techo]
    enlace: sinFlecha(L("enlace")),
    archivoTitulo: archT,
    archivoFila: archFila,                            // plantilla: [número, mediana, n]
  };
  return { menu, galeria, guia, informeEn };
}
