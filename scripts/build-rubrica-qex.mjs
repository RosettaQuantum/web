#!/usr/bin/env node
/**
 * Genera la rúbrica maestra del QEX y de la nota (18-nov-2026) DESDE EL CÓDIGO:
 *   public/data/rubrica-qex.es.csv, public/data/rubrica-qex.en.csv  (RFC 4180, UTF-8 con BOM)
 *   public/data/rubrica-qex.json                                    (las dos caras, versión y sha256)
 *   docs/textos-provisorios-rubrica.md                              (el texto literal para aprobar)
 * Insumos: public/js/rubrica-qex.mjs (que lee qex-nucleo.mjs), la referencia por sector y el cron de
 * wrangler.jsonc. Determinista: sin fechas de generación. scripts/check-rubrica-qex.mjs regenera en
 * memoria y grita si lo commiteado difiere.
 *   node scripts/build-rubrica-qex.mjs            escribe
 *   node scripts/build-rubrica-qex.mjs --stdout   sólo imprime el resumen (no escribe)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const raiz = new URL("../", import.meta.url);
const leer = (r) => readFileSync(new URL(r, raiz), "utf8");
const R = await import("../public/js/rubrica-qex.mjs");
const N = await import("../public/js/qex-nucleo.mjs");
const { RUBRICA } = await import("../public/js/rubrica-textos.mjs");

export const REFERENCIA_ARCHIVO = "public/data/qex-referencia-2026-08.json";

// PROPUESTA, NO APLICADA (18-nov-2026). La lectura de la A y de la B (TXT.nota_lectura de
// qready-textos.mjs, aprobada el 13-nov) describe sólo una de sus causas: una B que sale por un ambiente
// de pruebas publicado se lee «quedan nombres públicos sin evidencia del candado nuevo», que puede ser
// falso. Esta es la propuesta para aprobar; ningún código la usa hasta entonces. Vive aquí y no en
// public/js: no se sirve un texto sin aprobar.
const PROPUESTA_LECTURA = {
  es: {
    A: "Candado nuevo en el sitio y en todos los nombres públicos que respondieron, sin alertas graves ni altas, sin ambientes de prueba publicados y con todo lo sensible medido. Es la nota máxima que se puede dar desde afuera.",
    B: "Candado nuevo en el sitio principal y sin alertas graves ni altas, pero falta algo para A: nombres sin evidencia del candado nuevo, un ambiente de pruebas publicado, nombres sensibles sin medir o una dimensión sin medir.",
  },
  en: {
    A: "New lock on the site and on every public name that responded, no serious or high alerts, no published test environments, and everything sensitive measured. The highest grade that can be given from outside.",
    B: "New lock on the main site and no serious or high alerts, but something is missing for A: names without evidence of the new lock, a published test environment, sensitive names left unmeasured, or a dimension not measured.",
  },
};

const sha = (t) => createHash("sha256").update(t).digest("hex");

// El cron sale de wrangler.jsonc (la única definición). JSONC: se quitan los comentarios de línea.
export function cronDeWrangler(texto) {
  const sinComentarios = texto.split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
  const m = /"triggers"\s*:\s*\{\s*"crons"\s*:\s*\[\s*"([^"]+)"/.exec(sinComentarios);
  if (!m) throw new Error("wrangler.jsonc: no encontré triggers.crons de producción");
  return m[1];
}

export function generar({ N: nucleo = N } = {}) {
  const referencia = JSON.parse(leer(REFERENCIA_ARCHIVO));
  const cron = cronDeWrangler(leer("wrangler.jsonc"));
  const es = R.armarRubrica({ referencia, cron, idioma: "es", N: nucleo });
  const en = R.armarRubrica({ referencia, cron, idioma: "en", N: nucleo });
  const csv = { es: R.aCSV(es), en: R.aCSV(en) };
  const cuerpo = {
    protocolo: es.protocolo, version: es.version, rige: es.rige, referencia: es.referencia,
    generado_desde: ["public/js/qex-nucleo.mjs", "public/js/rubrica-qex.mjs", "public/js/rubrica-textos.mjs", REFERENCIA_ARCHIVO, "wrangler.jsonc (triggers.crons)"],
    estado_texto: "provisorio: pendiente de aprobación",
    csv: { es: { archivo: R.ARCHIVOS.csv.es, sha256: sha(csv.es) }, en: { archivo: R.ARCHIVOS.csv.en, sha256: sha(csv.en) } },
    columnas: R.COLUMNAS,
    es, en,
  };
  const json = { ...cuerpo, sha256: sha(N.canon(cuerpo)) };
  return { csv, json: JSON.stringify(json, null, 1) + "\n", md: textosParaAprobar(es, en, json), es, en };
}

// La lista literal de textos para aprobar: las plantillas evaluadas, como las ve el lector.
function textosParaAprobar(es, en, json) {
  const L = ["# Textos provisorios · rúbrica del QEX y de la nota (18-nov-2026)", "",
    "Generado por `node scripts/build-rubrica-qex.mjs` desde `public/js/rubrica-textos.mjs`. **Nada de esto se publica en producción sin aprobación.**",
    "Todo es NUEVO salvo los nombres de las alertas, que repiten los aprobados (`TXT.alerta` de qready-textos.mjs).",
    `Versión: ${json.version} · sha256 del JSON: \`${json.sha256}\``,
    "Del mismo encargo, en otro documento: los textos nuevos o cambiados de la ficha (país declarado, enlace a la rúbrica en la sección 06, la línea HNDL de «No medido», la escala en /protocolo/ficha) están en `docs/textos-provisorios-ficha.md` (marcados NUEVO o CAMBIA). También es nueva la descripción del parámetro `pais` en api.js (herramienta MCP y OpenAPI).", ""];
  for (const [lang, r] of [["es", es], ["en", en]]) {
    const T = RUBRICA[lang];
    L.push(`## ${lang}`, "", `- título: ${T.titulo}`, `- bajada: ${T.lede}`, `- aviso: ${T.provisorio}`, "");
    L.push(`### Escala de letras (${lang})`, "", `${T.escala.orden}`, "", "| # | nota | condición | rige desde |", "|---|---|---|---|");
    for (const e of r.escala) L.push(`| ${e.id} | ${e.variable} | ${e.regla} | ${e.desde} |`);
    L.push("", `### Condiciones de A (${lang})`, "");
    for (const c of r.condiciones_a) L.push(`- ${c.id} ${c.regla} (${c.desde})`);
    L.push("", `### Filas (${lang})`, "");
    for (const f of r.filas) L.push(`- **${f.id}** ${f.variable} — observa: ${f.observa} · método y límites: ${f.metodo} · regla: ${f.regla} · efecto: ${f.efecto_nota}`);
    L.push("", `### Fórmula (${lang})`, "");
    for (const f of r.formula) L.push(`- ${f.id} ${f.regla}`);
    L.push("", `### Clases de nombres (${lang})`, "");
    for (const p of r.pat) L.push(`- ${p.id} ${p.variable}: ${p.regla}`);
    L.push("");
  }
  L.push("## Propuesta, NO aplicada: la lectura de la A y de la B", "",
    "`TXT.nota_lectura` (qready-textos.mjs, aprobado el 13-nov) la pintan /q-ready/medicion y /verificado. C, D y F dicen la regla real; A y B describen sólo una de sus causas. Propuesta (no la usa ningún código hasta que se apruebe):", "");
  for (const lang of ["es", "en"]) for (const k of ["A", "B"]) L.push(`- ${lang} · ${k}: ${PROPUESTA_LECTURA[lang][k]}`);
  L.push("");
  return L.join("\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const g = generar();
  if (!process.argv.includes("--stdout")) {
    writeFileSync(new URL("public/data/rubrica-qex.es.csv", raiz), g.csv.es);
    writeFileSync(new URL("public/data/rubrica-qex.en.csv", raiz), g.csv.en);
    writeFileSync(new URL("public/data/rubrica-qex.json", raiz), g.json);
    writeFileSync(new URL("docs/textos-provisorios-rubrica.md", raiz), g.md);
  }
  const j = JSON.parse(g.json);
  console.log(`rubrica-qex: ${g.es.filas.length} variables + ${g.es.formula.length} fórmula + ${g.es.escala.length} escala + ${g.es.alertas.length} alertas + ${g.es.condiciones_a.length} condiciones de A + ${g.es.pat.length} clases · ${j.version} · json ${j.sha256.slice(0, 12)}…`);
}
