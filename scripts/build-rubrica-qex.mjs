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

export const REFERENCIA_ARCHIVO = "public/data/qex-referencia-vigente.json";


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
    "Todo es NUEVO salvo los nombres de las alertas, que repiten los aprobados (`TXT.alerta` de qready-textos.mjs), la frase sobre el origen de la tabla HNDL en RQ.S.04 (es, «Sí, así queda»), y los textos 2, 3 y 4 del 18-nov: RQ.S.04 en inglés, el método de RQ.S.09.7 (el tope de sondeo) y el método y la regla de RQ.S.02.1 (la llave), aprobados y sellados en `src/data/q-ready/textos-aprobados/`.",
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
