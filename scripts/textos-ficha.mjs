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
import { FICHA, FICHA_SPEC } from "../public/js/qready-textos.mjs";
import { armarFicha, markdownDe } from "../public/js/ficha.mjs";

const raiz = new URL("../", import.meta.url);
// Lo que cambió en la segunda vuelta (16-nov, pedido de la coordinación): se marca **NUEVO** o **CAMBIA**.
const NUEVO = [/^lectura_motivo\./, /^superficie_sin$/, /^nivel\.ALTA$/, /^reglas\[9\]$/];
const CAMBIA = [/^reglas\[1\]$/, /^reglas\[8\]$/];
const out = [];
const p = (...l) => out.push(...l);
// Una función con singular y plural se muestra con las dos formas: «uno / ‹1› varios».
const val = (v) => (typeof v !== "function" ? v
  : /=== 1/.test(String(v)) ? `${v(1)} / ${v("‹1›")}` : v(...Array.from({ length: v.length || 1 }, (_, i) => `‹${i + 1}›`)));
const marca = (clave) => (NUEVO.some((r) => r.test(clave)) ? "**NUEVO** " : CAMBIA.some((r) => r.test(clave)) ? "**CAMBIA** " : "");
function volcar(obj, pre = "") {
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === "object" && !Array.isArray(v)) volcar(v, `${pre}${k}.`);
    else if (Array.isArray(v)) v.forEach((x, i) => p(`- ${marca(`${pre}${k}[${i}]`)}\`${pre}${k}[${i}]\`: ${Array.isArray(x) ? x.join(" · ") : val(x)}`));
    else p(`- ${marca(pre + k)}\`${pre}${k}\`: ${val(v)}`);
  }
}
p("# rosetta-ficha/1 · textos provisorios para aprobar", "",
  "Generado por `node scripts/textos-ficha.mjs` desde el código (public/js/qready-textos.mjs, src/pages/llms.txt.ts). Lo que se apruebe aquí es literalmente lo que se sirve.",
  "", "**Segunda vuelta (16-nov).** Marcado **NUEVO** o **CAMBIA** abajo. Además, sin texto nuevo: (1) el nivel ALTA (HIGH) entra al protocolo; (2) en las acciones, security.txt pasa a «Resuelve: —»; (3) RQ.S.09 sin nombres sondeados dice «sin nombres sondeados» en vez de «0/0 responden»; (4) la página /es/q-ready/medicion y /q-ready/medicion pintan los nombres enmascarados (consola, mapa al pasar el cursor, tabla de endpoints, alertas, «Qué falta para A» y comparación) salvo que el dominio esté verificado, con la misma regla y sufijo #xx que la API; (5) nota.lectura del JSON pasa a ser la misma lectura por motivo de la ficha.", "",
  "Reusados sin cambio (ya aprobados): los nombres de las alertas (`TXT.alerta`) y la lectura de cada letra (`TXT.nota_lectura`). El encabezado, el pie y las líneas fijas de «No medido», «Evidencia» y «Límites» vienen del ejemplo canónico del encargo del 13-nov.", "");
for (const lang of ["es", "en"]) { p(`## Ficha · ${lang}`, ""); volcar(FICHA[lang]); p(""); }
for (const lang of ["es", "en"]) { p(`## Página /${lang === "es" ? "es/" : ""}protocolo/ficha · ${lang}`, ""); volcar(FICHA_SPEC[lang]); p(""); }
const llms = readFileSync(new URL("src/pages/llms.txt.ts", raiz), "utf8");
const linea = /const LINEA_FICHA = `([^`]*(?:\\`[^`]*)*)`;/.exec(llms);
p("## /llms.txt (línea nueva)", "", "```", (linea ? linea[1] : "(no encontrada)").replace(/\\`/g, "`").replace(/\$\{base\}/g, "https://rosettaquantum.com"), "```", "");
const api = readFileSync(new URL("api.js", raiz), "utf8");
p("## Catálogo de la API (/v1, /llms.txt, OpenAPI) · frases agregadas", "");
for (const m of api.matchAll(/(\(compared only[^)]*\)\. Names are masked[^"]*?presentacion\.markdown\.|, and presentacion \(protocol rosetta-ficha\/1\))/g)) p(`- ${m[1]}`);
p("", "## MCP · línea agregada a medir_exposicion_pqc y get_qready_grade", "", `- ${FICHA.es.linea_mcp}`, `- parámetro idioma: opcional: idioma de presentacion (rosetta-ficha/1), es por defecto`, "");
for (const c of ["a", "f", "sin-correo"]) for (const lang of ["es", "en"]) {
  const fx = JSON.parse(readFileSync(new URL(`scripts/fixtures/ficha/${c}.json`, raiz), "utf8"));
  p(`## Ejemplo · ${c} · ${lang}`, "", "```markdown", markdownDe(armarFicha(fx.foto, { ...fx.ctx, idioma: lang })).trimEnd(), "```", "");
}
process.stdout.write(out.join("\n") + "\n");
