/**
 * T-estructura — una sola barra y un solo pie por pagina del rebuild.
 *
 * EL DEFECTO QUE VIGILA (paso DOS veces)
 * --------------------------------------
 * BaseLayout monta el chrome viejo (Nav.astro + Footer.astro) para las 38 paginas que
 * siguen en el diseño oscuro. La maqueta v20 trae SU PROPIA barra y SU PROPIO pie dentro
 * del cuerpo. Al montarla sin apagar el chrome del layout, la pagina sirve los dos.
 *   · La barra doble se vio en el navegador y se arreglo con el prop `nav`.
 *   · El pie doble sobrevivio a esa revision, a P0, a T-css, a T-nav, a T-api y a una QA
 *     de navegador completa. Se vio contando "<footer" en el HTML servido: 2.
 * Un pie de mas vive al final del scroll —donde nadie llega revisando— y no rompe nada:
 * sin error de consola, sin 404, y el tamaño no cambia lo suficiente para que T-guardia
 * lo note. Es el modo de fallo de esta casa: se ve bien y esta mal.
 *
 * COMO
 * ----
 * Contra el HTML SERVIDO (no la fuente: el defecto lo produce el layout al ensamblar):
 *   1. exactamente un <footer>;
 *   2. exactamente un wordmark nuevo (la barra v2);
 *   3. CERO marcadores del chrome viejo (wm-text, foot-inner).
 *
 * Se comprueba SOLO en las rutas del rebuild, declaradas aqui. No se cuenta "<nav" a
 * secas a proposito: /rosettaq sirve dos <nav> legitimamente (subnav de seccion) y una
 * regla que lo marcara seria un falso positivo — retiene trabajo bueno, que es peor que
 * dejar pasar un caso.
 *
 * PUNTO CIEGO DECLARADO: comprueba que el chrome no este DUPLICADO, no que sea correcto.
 * Una barra con enlaces rotos pasa verde; eso lo miran T-nav y T-301.
 */
export const CONSUMIDOR = {
  quien: "quien empuja a una rama rebuild",
  hace: "no sigue: la pagina lleva el chrome viejo montado debajo del nuevo, y se ve bien hasta que bajas del todo",
};

const PREVIEW = (process.env.PREVIEW_URL || "").replace(/\/+$/, "");
if (!PREVIEW) { console.error("ABORTA: falta PREVIEW_URL"); process.exit(1); }

const RUTAS = (process.env.RUTAS_REBUILD || "/,/es/").split(",").map((r) => r.trim()).filter(Boolean);
const cuenta = (t, re) => (t.match(re) || []).length;

console.log(`preview: ${PREVIEW}\nrutas del rebuild: ${RUTAS.join(" · ")}\n`);
const fallos = [];

for (const ruta of RUTAS) {
  const r = await fetch(PREVIEW + ruta, { headers: { "x-rq-check": "1" } });
  if (r.status !== 200) { console.log(`  FALLA ${ruta} -> ${r.status}`); fallos.push(ruta); continue; }
  const html = await r.text();

  const pies = cuenta(html, /<footer[\s>]/g);
  const barras = cuenta(html, /class="wordmark"/g);
  const viejoNav = cuenta(html, /class="wm-text"/g);
  const viejoPie = cuenta(html, /class="wrap foot-inner"/g);

  // Enlaces que no van a ninguna parte. La maqueta v20 trae sus CTAs en href="#" y asi
  // salieron a la home: 24 enlaces —cada llamada a la accion del sitio— que no dan 404,
  // no dan error de consola y no cambian el tamaño de la pagina. Hacen scroll a ninguna
  // parte. La barra si se habia remapeado, porque era un componente; el cuerpo y el pie
  // entraron como HTML crudo y se quedaron con los marcadores de la maqueta.
  const muertos = cuenta(html, /href="#"/g);
  // Y enlaces absolutos a produccion: desde el preview sacan al sitio de verdad, o sea
  // que lo que estas revisando no es lo que estas mirando. Solo <a>: el canonical y los
  // hreflang de la cabecera TIENEN que ser absolutos a produccion, y marcarlos seria un
  // falso positivo sobre lo unico que ahi esta bien.
  const aProduccion = cuenta(html, /<a[^>]+href="https:\/\/rosettaquantum\.com/g);

  const problemas = [];
  if (muertos) problemas.push(`${muertos} enlaces href="#" — no dan 404 y no llevan a ninguna parte`);
  if (aProduccion) problemas.push(`${aProduccion} enlaces absolutos a rosettaquantum.com — desde el preview sacan a produccion`);
  if (pies !== 1) problemas.push(`${pies} <footer> — deberia haber 1`);
  if (barras !== 1) problemas.push(`${barras} barras v2 (class="wordmark") — deberia haber 1`);
  if (viejoNav) problemas.push(`chrome viejo presente: ${viejoNav} wm-text — quedo Nav.astro o Footer.astro montado`);
  if (viejoPie) problemas.push(`pie viejo presente: Footer.astro sigue montado (falta pie={false})`);

  if (problemas.length) {
    console.log(`  FALLA ${ruta}`); problemas.forEach((p) => console.log(`        ${p}`)); fallos.push(ruta);
  } else {
    console.log(`  ok    ${ruta.padEnd(12)} 1 barra v2 · 1 pie · 0 restos del chrome viejo · 0 enlaces muertos`);
  }
}

if (fallos.length) { console.log(`\nT-estructura: ${fallos.length} pagina(s) con chrome duplicado.`); process.exit(1); }
console.log(`\nT-estructura: las ${RUTAS.length} paginas del rebuild llevan un solo chrome.`);
