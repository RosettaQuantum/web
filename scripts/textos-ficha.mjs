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
import { FICHA, FICHA_SPEC, textos } from "../public/js/qready-textos.mjs";
import { armarFicha, markdownDe } from "../public/js/ficha.mjs";

const raiz = new URL("../", import.meta.url);
// Lo de la TERCERA vuelta (16-nov: homologar con la ficha aprobada de yu-track, B1/QREADY-NOTA-2.1,
// RQ.S.13 y la versión de método): **NUEVO** lo que no existía, **CAMBIA** lo que se reescribió.
const NUEVO = [/^kicker$/, /^desde_afuera$/, /^escala$/, /^tope_externo$/, /^leyenda$/, /^nombres_ct$/, /^no_medido\.(hndl|dimension|correo_mx)$/,
  /^evidencia\.versiones$/, /^limites\.hacia_a$/, /^lectura_motivo\.sin_dimension\./, /^indicador\.RQ\.S\.13$/, /^catalogo\[1[0-3]\]$/, /^reglas\[10\]$/];
const CAMBIA = [/^sector\./, /^col\.efecto$/, /^vigencia/, /^superficie$/, /^referencia$/, /^efecto_no$/, /^accion\./, /^no_medido\.nunca$/,
  /^evidencia\.(huella_ct|metodo)$/, /^pie$/, /^bloque$/, /^catalogo_nota$/, /^catalogo\[9\]$/];
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
  "", "**Tercera vuelta (16-nov): homologación con la ficha aprobada (yu-track).** Marcado **NUEVO** o **CAMBIA** abajo (sólo lo de esta vuelta). Además, visible sin texto nuevo: (1) las secciones se numeran 01..07; (2) la web de medición abre con la ficha completa, la página /verificado muestra 01 y 02, y el PDF del informe ES la ficha (mismo HTML); (3) «Dónde» y las acciones de un solo nombre muestran el nombre completo (enmascarado si no está verificado); (4) el pie ya no lleva la URL (va en 07); (5) en HTML y PDF el efecto se pinta «→ B», en el markdown sigue «-> B».",
  "", "**PENDIENTE DE APROBACIÓN (regla, no texto): QREADY-NOTA-2.1.** Si falta una dimensión de peso ≥ 0,25 (Certificados y PKI 0,40; Higiene 0,25; HNDL 0,25), la nota no puede ser A: máximo B, con la causa en la lectura, y la dimensión va en no_evaluado y en «qué falta para A». Caso real: yutrack.com salía A con Certificados y PKI sin medir. Texto nuevo de la regla: `falta.dimension_sin_medir` (abajo) y `no_medido.dimension` / `lectura_motivo.sin_dimension`.", "",
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
process.stdout.write(out.join("\n") + "\n");
