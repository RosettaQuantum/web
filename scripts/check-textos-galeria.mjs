#!/usr/bin/env node
/**
 * Los textos de la galería «Publicaciones de Rosetta» y del botón «Seguridad» que Nicholas aprobó el
 * 23-nov-2026 («Sí, así») llegan a la página letra por letra, y el documento aprobado no cambia.
 *
 * QUÉ SE SELLA: src/data/publicaciones/textos-aprobados/TEXTOS-galeria-seguridad-2026-11-23.md, copia
 * byte a byte de docs/textos-provisorios-galeria.md tal como se aprobó, con su sha256 y su aprobado_por
 * en APROBADOS.json (el patrón de src/data/q-ready/textos-aprobados/). El código NO trae copia de estos
 * textos: NavV2 y components/publicaciones/ los leen del documento vía src/lib/textos-galeria.mjs.
 *
 * Comprueba:
 *  1. SELLO    el documento tiene el sha256 de APROBADOS.json y el aprobado_por exacto.
 *  2. LECTURA  el documento se lee entero (falla cerrado si falta una línea esperada).
 *  3. PÁGINA   (--dist, postbuild) cada texto aprobado está en el HTML construido de /es/q-ready, /q-ready,
 *              /es/ y /, en su idioma; las plantillas del informe en inglés, llenas con las cifras de la
 *              edición publicada.
 *  4. GRITO    mutaciones reales: un byte cambiado en la copia, una línea quitada del documento, un texto
 *              cambiado en el HTML construido. Cada una tiene que gritar. SILENCIO: lo que está, pasa.
 * QUÉ NO CUBRE: la tarjeta del informe en español (no está en este documento: no cambió) y el HTML
 * desplegado (eso es de producción, no del build).
 *   node scripts/check-textos-galeria.mjs            (prebuild)
 *   node scripts/check-textos-galeria.mjs --dist     (postbuild)
 */
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";

export const CONSUMIDOR = {
  quien: "sesion web de Rosetta, antes de desplegar",
  hace: "no edita los textos aprobados de la galería ni en el documento sellado ni en el código: un texto nuevo es un documento nuevo, aprobado, con su sha256 y su aprobado_por",
};

const { textosGaleria, llenar, ARCHIVO, DIR } = await import("../src/lib/textos-galeria.mjs");
const APROBADO_POR = 'Nicholas, 23-nov-2026: "Sí, así"';
const fallas = [];
let casos = 0;
const ok = (m) => console.log(`  ok    ${m}`);
const mal = (m) => { console.log(`  FALLA ${m}`); fallas.push(m); };
const sha = (b) => createHash("sha256").update(b).digest("hex");

// ---------------------------------------------------------------- 1 · el sello
const AP = JSON.parse(readFileSync(DIR + "APROBADOS.json", "utf8"));
const bytes = readFileSync(DIR + ARCHIVO);
const sello = (b, ap) => ap.length === 1 && ap[0].archivo === ARCHIVO && ap[0].aprobado_por === APROBADO_POR && sha(b) === ap[0].sha256;
casos++;
sello(bytes, AP) ? ok(`${ARCHIVO}: sha256 ${AP[0].sha256.slice(0, 12)}… y aprobado_por «${APROBADO_POR}»`)
                 : mal(`${ARCHIVO}: el sha256 o el aprobado_por no son los de APROBADOS.json (sha actual ${sha(bytes)})`);

// ---------------------------------------------------------------- 2 · se lee entero
const md = bytes.toString("utf8");
let T = null;
casos++;
try { T = textosGaleria(md); ok("el documento aprobado se lee entero: menú, encabezado, guía (es/en) e informe (en)"); }
catch (e) { mal(`el documento aprobado no se lee: ${e.message}`); }

// ---------------------------------------------------------------- 4 · grito y silencio (fuente)
{
  // Un byte: la «L» de «Lo que medimos» pasa a minúscula en la copia sellada.
  const i = md.indexOf("Lo que medimos");
  const mut = Buffer.from(md.slice(0, i) + "lo" + md.slice(i + 2), "utf8");
  casos++;
  !sello(mut, AP) ? ok("grito: una letra cambiada en la copia sellada rompe el sello") : mal("la mutación de un byte NO rompió el sello");
  casos++;
  sello(bytes, AP) ? ok("silencio: la copia sin tocar pasa el sello") : mal("la copia sin tocar no pasa el sello");
  // Una línea quitada: la lectura tiene que lanzar, no inventar un vacío.
  const sinLinea = md.split("\n").filter((l) => !l.startsWith("- **PROVISORIO** en · datos:")).join("\n");
  let lanzo = false;
  try { textosGaleria(sinLinea); } catch { lanzo = true; }
  casos++;
  lanzo ? ok("grito: sin la línea «en · datos» la lectura lanza (falla cerrado)") : mal("quitar «en · datos» no hizo lanzar la lectura");
  // Y el menú no puede apuntar a otra parte.
  let lanzoRuta = false;
  try { textosGaleria(md.replace("`Seguridad` → /es/q-ready", "`Seguridad` → /es/seguridad")); } catch { lanzoRuta = true; }
  casos++;
  lanzoRuta ? ok("grito: el botón apuntando a otra ruta hace lanzar la lectura") : mal("el botón con otra ruta no hizo lanzar la lectura");
}

// ---------------------------------------------------------------- 3 · la página construida
// Sólo se escapan & y comillas: los bordes < y > de `entero` son marcado, no texto.
const esc = (t) => t.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
// Astro escapa el texto; el HTML de comparación se normaliza para no depender de cómo escape « » “ ”.
const norm = (h) => h.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));

// Cada texto se busca ENTERO, entre el cierre de una etiqueta y la apertura de la siguiente (`>texto<`):
// buscar sólo «contiene» dejaba pasar «Publicaciones de Rosetta.» como si fuera lo aprobado (la mutación
// del punto de más lo mostró). Los que llevan algo pegado declaran su borde exacto.
const entero = (t) => `>${t}<`;
export function esperados(T, informe) {
  const out = { "/es/q-ready/index.html": [], "/q-ready/index.html": [], "/es/index.html": [], "/index.html": [] };
  out["/es/index.html"].push(`href="${T.menu.es.ruta}">${T.menu.es.texto}</a>`);
  out["/index.html"].push(`href="${T.menu.en.ruta}">${T.menu.en.texto}</a>`);
  for (const [lang, f] of [["es", "/es/q-ready/index.html"], ["en", "/q-ready/index.html"]]) {
    const G = T.galeria[lang], g = T.guia[lang];
    // /q-ready (inglés) es la página VIEJA, con su propia barra: no lleva NavV2, así que el botón del menú se
    // exige sólo en las páginas con NavV2 (23-nov-2026: «Security» ya no apunta a ella).
    if (lang === "es") out[f].push(`href="${T.menu[lang].ruta}">${T.menu[lang].texto}</a>`);
    out[f].push(
      ...[G.titulo, G.bajada, g.etiqueta[0], g.etiqueta[1], g.titulo, g.bajada, g.meta, g.enlaces[1]].map(entero),
      `>${g.enlaces[0]} <span`, `alt="${g.alt}"`);
  }
  if (informe) {
    const E = T.informeEn, P = informe, mes = P.mes;
    out["/q-ready/index.html"].push(...[E.etiqueta[0], llenar(E.etiqueta[1], [P.numero, mes]), E.titulo, E.cifraPeque,
      llenar(E.cifraLineas[0], [P.n]), llenar(E.cifraLineas[1], [P.min, P.max]), llenar(E.graficoTitulo, [mes]),
      llenar(E.graficoRotulo, [P.tope]), llenar(E.pie, [P.n, P.max, P.tope]), E.archivoTitulo,
      llenar(E.archivoFila, [P.numero, P.mediana, P.n])].map(entero), `>${E.enlace} <span`);
  }
  return out;
}
export function faltantes(esp, leer) {
  const f = [];
  for (const [arch, lista] of Object.entries(esp)) {
    const h = norm(leer(arch));
    for (const t of lista) if (!h.includes(t) && !h.includes(esc(t))) f.push(`${arch}: «${t}»`);
  }
  return f;
}

if (process.argv.includes("--dist") && T) {
  if (!existsSync("dist/q-ready/index.html")) mal("no hay dist/: --dist corre después de construir");
  else {
    // La edición publicada más reciente, leída igual que la lee la tarjeta.
    const { readdirSync } = await import("node:fs");
    const eds = readdirSync("src/data/informe-pqc").filter((f) => /^\d{4}-\d{2}\.json$/.test(f)).sort().reverse()
      .map((f) => JSON.parse(readFileSync(`src/data/informe-pqc/${f}`, "utf8"))).filter((d) => d.borrador === false);
    const MESES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const P = eds[0] ? { numero: eds[0].numero, mes: `${MESES[+eds[0].edicion.split("-")[1] - 1]} ${eds[0].edicion.split("-")[0]}`,
      n: eds[0].indice.n, min: eds[0].indice.min, max: eds[0].indice.max, tope: eds[0].indice.tope, mediana: eds[0].indice.mediana } : null;
    const esp = esperados(T, P);
    const leer = (a) => readFileSync("dist" + a, "utf8");
    const total = Object.values(esp).reduce((n, l) => n + l.length, 0);
    const f = faltantes(esp, leer);
    casos++;
    f.length ? mal(`${f.length} de ${total} textos aprobados no están en el HTML construido: ${f.slice(0, 4).join(" · ")}`)
             : ok(`los ${total} textos aprobados están en el HTML construido (/es/q-ready, /q-ready, /es/, /)`);
    // Grito: el mismo HTML con UN texto cambiado (un punto final de más en el título de la galería).
    const mutado = (a) => a === "/es/q-ready/index.html" ? leer(a).replaceAll(T.galeria.es.titulo, T.galeria.es.titulo + ".") : leer(a);
    const fm = faltantes(esp, mutado);
    casos++;
    fm.length === 1 ? ok(`grito: un punto de más en «${T.galeria.es.titulo}» dentro del HTML construido se detecta`)
                    : mal(`la mutación del HTML no se detectó bien (${fm.length} faltantes, se esperaba 1)`);
    // Grito: la tarjeta en inglés con el texto viejo (antes de leer del documento) también se detecta.
    const conViejo = (a) => a === "/q-ready/index.html" ? leer(a).replaceAll(T.informeEn.enlace, "Read the report") : leer(a);
    casos++;
    faltantes(esp, conViejo).length ? ok("grito: el enlace del informe en inglés cambiado en el HTML se detecta")
                                    : mal("cambiar el enlace del informe en inglés en el HTML NO se detectó");
  }
}

console.log(fallas.length ? `\ncheck-textos-galeria: ${fallas.length} fallo(s) en ${casos} casos` : `\ncheck-textos-galeria: ${casos} casos, todos bien`);
process.exit(fallas.length ? 1 : 0);
