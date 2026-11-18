#!/usr/bin/env node
/**
 * La lista LITERAL de todo el texto provisorio de rosetta-ficha/1 (16-nov-2026), para que el dueño lo
 * apruebe de una vez: las líneas de la ficha en es/en, la página /protocolo/ficha, la línea de
 * /llms.txt, la línea de las herramientas MCP y las tres fichas de ejemplo tal como salen.
 * Sale del código, no se copia a mano: lo que se aprueba es lo que se sirve.
 *   node scripts/textos-ficha.mjs > docs/textos-provisorios-ficha.md
 * Las funciones se muestran con marcadores ‹1›, ‹2›… donde va el dato.
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { FICHA, FICHA_SPEC, textos } from "../public/js/qready-textos.mjs";
import { armarFicha, markdownDe } from "../public/js/ficha.mjs";

const raiz = new URL("../", import.meta.url);
// CUARTA vuelta (17-nov): aprobado por Nicholas con tres arreglos. Sólo cambia `accion.baja_legado`
// («a el» → «al»). Lo demás de esta vuelta no es texto: el generador mostraba «undefined» y «NaN».
// QUINTA vuelta (17-nov): subíndices QEX v1 (spec aprobada). **NUEVO** = lo que entra con ellos.
// SEXTA vuelta (18-nov): la rúbrica maestra y el país. NUEVO: «país declarado», el enlace a la rúbrica en la
// evidencia y la escala de la nota en /protocolo/ficha. CAMBIA: la línea HNDL de «No medido» (declara que la
// derivación no está publicada), la regla del país y la fila RQ.S.04.1 a .3 del catálogo.
const NUEVO = [/^arbol\./, /^sobre$/, /^catalogo\[1[4-79]\]$/, /^catalogo\[20\]$/, /^reglas\[11\]$/,
  /^pais_declarado$/, /^evidencia\.rubrica$/, /^h_escala$/, /^escala_nota$/, /^col_(nota|condicion|desde)$/, /^rubrica$/];
const CAMBIA = [/^no_medido\.hndl$/, /^reglas\[7\]$/, /^catalogo\[18\]$/];
// Los datos de ejemplo con que se muestra cada función. EL DEFECTO (17-nov): este generador llamaba a
// cada función con marcadores de texto, y a las que llevan singular/plural con un solo argumento; así
// `referencia` salía «mediana 1 undefined (undefined orgs…) undefined está NaN puntos» y `correo_mx`
// «de los undefined servidores». No pasaba en ninguna ficha real (las 5 fotos fijas y las mediciones del
// preview salen limpias), pero el documento que se aprueba tiene que mostrar lo que se sirve.
// Con argumentos de ejemplo explícitos donde hay aritmética, y el resto: singular (1) y plural (‹1›),
// con TODOS sus argumentos.
const EJEMPLOS = {
  referencia: [["fintech", 71, 15, "2026-08", "ejemplo.cl", -10], ["fintech", 71, 15, "2026-08", "ejemplo.cl", 0], ["fintech", 71, 15, "2026-08", "ejemplo.cl", 1]],
  correo_mx: [[1, 5], [2, 5]],
};
const marcadores = (n, desde = 1) => Array.from({ length: n }, (_, i) => `‹${i + desde}›`);
function val(v, clave) {
  if (typeof v !== "function") return v;
  const corta = clave.split(".").pop();
  if (EJEMPLOS[corta]) return EJEMPLOS[corta].map((a) => v(...a)).join(" / ");
  const n = Math.max(v.length, 1);
  if (!/=== 1/.test(String(v))) return v(...marcadores(n));
  // singular con el dato, singular sin él (p. ej. una acción sin nombre) y plural
  const formas = [v(1, ...marcadores(n - 1, 2)), ...(n > 1 ? [v(1)] : []), v(...marcadores(n))];
  return [...new Set(formas)].join(" / ");
}
const marca = (clave) => (NUEVO.some((r) => r.test(clave)) ? "**NUEVO** " : CAMBIA.some((r) => r.test(clave)) ? "**CAMBIA** " : "");
export function generarTextos() {
const out = [];
const p = (...l) => out.push(...l);
function volcar(obj, pre = "") {
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === "object" && !Array.isArray(v)) volcar(v, `${pre}${k}.`);
    else if (Array.isArray(v)) v.forEach((x, i) => p(`- ${marca(`${pre}${k}[${i}]`)}\`${pre}${k}[${i}]\`: ${Array.isArray(x) ? x.join(" · ") : val(x, `${pre}${k}`)}`));
    else p(`- ${marca(pre + k)}\`${pre}${k}\`: ${val(v, pre + k)}`);
  }
}
p("# rosetta-ficha/1 · textos provisorios para aprobar", "",
  "Generado por `node scripts/textos-ficha.mjs` desde el código (public/js/qready-textos.mjs, src/pages/llms.txt.ts). Lo que se apruebe aquí es literalmente lo que se sirve.",
  "", "**Quinta vuelta (17-nov): subíndices QEX v1.** Marcado **NUEVO**: el árbol de puntos de la sección 02 (`arbol.*`), la higiene escrita sobre 70 (`sobre`), las filas nuevas del catálogo y la regla 12 de la spec. RQ.S.04.1 a .3 van «sin dato»: el modelo HNDL publica sólo el valor del sector, no los años ni el margen de Mosca.",
  "", "**Estado anterior (17-nov): APROBADO por Nicholas** (textos y QREADY-NOTA-2.1), con tres arreglos: (1) este documento mostraba «undefined» y «NaN» en `referencia` y `no_medido.correo_mx` (defecto del generador, no de la ficha: ahora se muestran con datos de ejemplo); (2) `accion.baja_legado` decía «a el nombre» (**CAMBIA**); (3) un guardia falla si una ficha renderizada (es/en, markdown y HTML) o este documento dicen «undefined», «NaN» o «null».",
  "", `**Integrado de main (7786413, PROVISORIO allá):** la alerta \`ambiente_pruebas_publicado\` («${textos("es").alerta.ambiente_pruebas_publicado}» / «${textos("en").alerta.ambiente_pruebas_publicado}»), media con techo B, y su acción \`retirar_ambientes_publicados\` (**NUEVO**, mismo texto que la del ambiente bloqueado).`, "",
  "Reusados sin cambio (ya aprobados): los nombres de las alertas (`TXT.alerta`) y la lectura de cada letra (`TXT.nota_lectura`). El encabezado, el pie y las líneas fijas de «No medido», «Evidencia» y «Límites» vienen del ejemplo canónico del encargo del 13-nov.", "");
for (const lang of ["es", "en"]) { p(`## Ficha · ${lang}`, ""); volcar(FICHA[lang]); p(""); }
p("## Nota Q-Ready · texto nuevo de QREADY-NOTA-2.1 (pendiente)", "");
for (const lang of ["es", "en"]) p(`- **NUEVO** \`${lang} falta.dimension_sin_medir\`: ${["certificados", "higiene"].map((d) => textos(lang).falta.dimension_sin_medir({ detalle: d })).join(" / ")}`);
p("");
for (const lang of ["es", "en"]) { p(`## Página /${lang === "es" ? "es/" : ""}protocolo/ficha · ${lang}`, ""); volcar(FICHA_SPEC[lang]); p(""); }
const llms = readFileSync(new URL("src/pages/llms.txt.ts", raiz), "utf8");
const linea = /const LINEA_FICHA = `([^`]*(?:\\`[^`]*)*)`;/.exec(llms);
p("## /llms.txt (línea nueva)", "", "```", (linea ? linea[1] : "(no encontrada)").replace(/\\`/g, "`").replace(/\$\{base\}/g, "https://rosettaquantum.com"), "```", "");
const api = readFileSync(new URL("api.js", raiz), "utf8");
p("## Catálogo de la API (/v1, /llms.txt, OpenAPI) · frases agregadas", "");
for (const m of api.matchAll(/(\(compared only[^)]*\)\. Names are masked[^"]*?presentacion\.markdown\.|, and presentacion \(protocol rosetta-ficha\/1\))/g)) p(`- ${m[1]}`);
p("", "## MCP · línea agregada a medir_exposicion_pqc y get_qready_grade", "", `- ${FICHA.es.linea_mcp}`, `- parámetro idioma: opcional: idioma de presentacion (rosetta-ficha/1), es por defecto`, "");
for (const c of ["a", "f", "sin-correo", "rastreo", "rastreob"]) for (const lang of ["es", "en"]) {
  const fx = JSON.parse(readFileSync(new URL(`scripts/fixtures/ficha/${c}.json`, raiz), "utf8"));
  p(`## Ejemplo · ${c} · ${lang}`, "", "```markdown", markdownDe(armarFicha(fx.foto, { ...fx.ctx, idioma: lang })).trimEnd(), "```", "");
}
return out.join("\n") + "\n";
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.stdout.write(generarTextos());
