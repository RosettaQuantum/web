#!/usr/bin/env node
/**
 * Los textos que el dueño aprobó el 18-nov-2026 llegan al código letra por letra, y el documento aprobado
 * no cambia. Si un byte se mueve en cualquiera de los dos lados, el build se detiene.
 *
 * QUÉ SE SELLA (src/data/q-ready/textos-aprobados/, copia byte a byte de los documentos aprobados, con su
 * sha256 y su aprobado_por en APROBADOS.json; el patrón de src/data/q-ready/autoverificacion/):
 *  · TEXTO-lectura-notas-A-B-2026-11-18.md («Sí, el reemplazo»): la lectura de A y de B, en es y en, que
 *    pintan /q-ready/medicion y /verificado (TXT.nota_lectura de public/js/qready-textos.mjs). La B
 *    anterior afirmaba una sola de sus causas y una B por un ambiente de pruebas publicado la hacía falsa.
 *  · TEXTO-rubrica-hndl-origen-2026-11-18.md («Sí, así queda»): la frase sobre el origen de la tabla
 *    HNDL, al final de «método y límites» de RQ.S.04 en la rúbrica en español.
 *
 * Comprueba:
 *  1. SELLO   cada copia tiene el sha256 de APROBADOS.json (un byte distinto falla).
 *  2. CÓDIGO  TXT.es/en.nota_lectura.A y .B son EXACTAMENTE las del documento; A+, C, D y F no cambiaron
 *             respecto de sus huellas registradas. RQ.S.04 (es) termina con la frase, y la rúbrica publicada
 *             (public/data/rubrica-qex.es.csv y .json) la lleva.
 *  3. GRITO   (mutación) un espacio de más en el código, una letra cambiada en la copia del documento, la
 *             frase quitada de la rúbrica: cada uno grita. SILENCIO: lo que está, pasa (la corrida misma).
 * QUÉ NO CUBRE: la versión en inglés de la frase HNDL (no hay texto aprobado en inglés: la rúbrica en
 * inglés no la lleva) y el HTML desplegado.
 *   node scripts/check-textos-aprobados.mjs
 */
import { TEXTOS_CARRUSEL } from "../src/lib/carrusel-textos.mjs";
import { readFileSync } from "node:fs";
const TA = await import("./lib/textos-aprobados.mjs");
const { conMutante } = await import("./lib/mutar.mjs");

export const CONSUMIDOR = { quien: "sesion web de Rosetta, antes de desplegar", hace: "no edita los textos aprobados en el código ni en la copia sellada: un texto nuevo es un documento nuevo con su sha256 y su aprobado_por" };

const raiz = new URL("../", import.meta.url);
const leer = (r) => readFileSync(new URL(r, raiz), "utf8");
const fallas = [];
let casos = 0;
const igual = (a, b, q) => { casos++; if (JSON.stringify(a) !== JSON.stringify(b)) fallas.push(`${q}: esperaba ${JSON.stringify(b)}, dio ${JSON.stringify(a)}`); };

const LECTURA = "TEXTO-lectura-notas-A-B-2026-11-18.md", HNDL = "TEXTO-rubrica-hndl-origen-2026-11-18.md", T234 = "TEXTOS-para-aprobar-2026-11-18.md";
const CARRUSEL = "TEXTOS-carrusel-2026-11-24.md";
const QR_EN = "TEXTOS-q-ready-en-2026-11-23.md";
const MCP = "TEXTOS-mcp-2026-11-24.md"; // su contenido lo vigila scripts/textos-q-ready-en.mjs --verificar
// Las lecturas que NO se tocan (A+, C, D, F), como estaban el 18-nov: cambiarlas no está aprobado.
const SIN_CAMBIO = {
  es: { "A+": "Candado nuevo en todo lo visible y un plan interno firmado y verificado.",
    C: "TLS 1.3, pero sin candado nuevo en el sitio principal (o con una alerta alta abierta).",
    D: "Sin TLS 1.3 medido, o sin candado nuevo y con una alerta alta abierta.",
    F: "Hay una falla grave medida: certificado vencido o un ambiente de pruebas expuesto." },
  en: { "A+": "New lock on everything visible, plus a signed internal plan verified by us.",
    C: "TLS 1.3, but no new lock on the main site (or a high alert left open).",
    D: "No TLS 1.3 measured, or no new lock and a high alert left open.",
    F: "A serious failure was measured: an expired certificate or an exposed test environment." },
};

// ---------------------------------------------------------------- 1 · el sello
const AP = TA.aprobados();
igual(AP.map((a) => a.archivo).sort(), [LECTURA, HNDL, T234, QR_EN, CARRUSEL, MCP].sort(), "APROBADOS.json declara los seis documentos, ni más ni menos");
igual(AP.find((a) => a.archivo === MCP)?.sha256, "0bf245ba5cd0885060e1059eb6df78f940942a523a143385aa85f1b85175fe48", "TEXTOS-mcp: el sha256 con que se aprobó");
igual(AP.find((a) => a.archivo === CARRUSEL)?.sha256, "76d5bcc1159c74ce69b4f8630e5974e50693475f3067fd5c4901b9c61d69a5a1", "TEXTOS-carrusel: el sha256 con que se aprobó");
{ const sell = TA.leerBytes(CARRUSEL).toString("utf8");
  for (const [l, t] of Object.entries(TEXTOS_CARRUSEL)) for (const [k, v] of Object.entries(t))
    igual(sell.includes(`| ${v} |`), true, `carrusel ${l}.${k} «${v}» es el texto aprobado`); }
igual(AP.find((a) => a.archivo === QR_EN)?.sha256, "3d16e4f79b7297c553170691727fff3a11e05e74a2e38895cfcaaf6f33c23cd4", "TEXTOS-q-ready-en: el sha256 con que se aprobó");
for (const a of AP) igual([TA.sha256(TA.leerBytes(a.archivo)), /^Nicholas, (18-nov-2026(: "Sí, | \(textos 2, 3 y 4\)$)|23-nov-2026: «Textos OK, súbelo»|24-nov-2026: «Sí, con esos textos»|24-nov-2026 \(vía coordinación\): textos 1 y 3 del MCP, ES y EN tal cual$)/.test(a.aprobado_por)], [a.sha256, true], `${a.archivo}: sha256 y aprobado_por iguales a APROBADOS.json`);
igual(AP.find((a) => a.archivo === T234).sha256, "a31d2c1c3215d7f05b3568dc8e7468cf607615301177c2801c9de2dbb706aaa3", "TEXTOS-para-aprobar: el sha256 con que se aprobó");

// ---------------------------------------------------------------- 2 · el código dice lo aprobado
function revisar(TX, RT, docLectura, docHndl, rubricaCsv, rubricaJson) {
  const out = [];
  const L = TA.lecturasAB(docLectura), frase = TA.fraseHndl(docHndl);
  for (const lang of ["es", "en"]) {
    for (const k of ["A", "B"]) if (TX.TXT[lang].nota_lectura[k] !== L[lang][k]) out.push(`${lang}.nota_lectura.${k} no es la aprobada`);
    for (const [k, v] of Object.entries(SIN_CAMBIO[lang])) if (TX.TXT[lang].nota_lectura[k] !== v) out.push(`${lang}.nota_lectura.${k} cambió y no está aprobada`);
  }
  if (!RT.RUBRICA.es.filas["RQ.S.04"].metodo.endsWith(" " + frase)) out.push("RQ.S.04 (es) no termina con la frase aprobada");
  if (!rubricaCsv.includes(frase)) out.push("la rúbrica publicada (CSV es) no lleva la frase aprobada");
  if (JSON.parse(rubricaJson).es.filas.find((f) => f.id === "RQ.S.04").metodo.endsWith(frase) !== true) out.push("la rúbrica publicada (JSON) no lleva la frase aprobada en RQ.S.04");
  return out;
}
const TX = await import("../public/js/qready-textos.mjs"), RT = await import("../public/js/rubrica-textos.mjs");
const DOC_L = TA.leerBytes(LECTURA).toString("utf8"), DOC_H = TA.leerBytes(HNDL).toString("utf8");
const CSV = leer("public/data/rubrica-qex.es.csv"), JSN = leer("public/data/rubrica-qex.json");
igual(revisar(TX, RT, DOC_L, DOC_H, CSV, JSN), [], "el código y la rúbrica publicada dicen exactamente lo aprobado");

// ---------------------------------------------------------------- 2 bis · los textos 2, 3 y 4 (18-nov-2026)
// Las cifras NO se copian: el tope sale de MAX_SONDEADOS y la regla de la llave de REGLA_CERTIFICADOS. El chequeo
// exige que lo construido con esos valores (15; 75/112/0/100) sea byte a byte la frase aprobada.
const N = await import("../public/js/qex-nucleo.mjs");
const DOC_234 = TA.leerBytes(T234).toString("utf8");
function revisar234(RT, M = N, csv = CSV) {
  const out = [], A = TA.textos234(DOC_234), F = { es: RT.RUBRICA.es.filas, en: RT.RUBRICA.en.filas };
  if (!F.en["RQ.S.04"].metodo.endsWith(" " + A.hndl_en)) out.push("texto 2: RQ.S.04 (en) no termina con la frase HNDL aprobada");
  for (const l of ["es", "en"]) {
    if (F[l]["RQ.S.09.7"].metodo(M.MAX_SONDEADOS) !== A.tope[l]) out.push(`texto 3 (${l}): el método de RQ.S.09.7 armado con MAX_SONDEADOS = ${M.MAX_SONDEADOS} no es la frase aprobada`);
    if (F[l]["RQ.S.02.1"].metodo(M.REGLA_CERTIFICADOS) !== A.llave.metodo[l]) out.push(`texto 4 (${l}): el método de RQ.S.02.1 no es el aprobado`);
    if (F[l]["RQ.S.02.1"].regla(M.REGLA_CERTIFICADOS) !== A.llave.regla[l]) out.push(`texto 4 (${l}): la regla de RQ.S.02.1 armada con REGLA_CERTIFICADOS no es la aprobada`);
  }
  for (const f of [A.tope.es, A.llave.metodo.es, A.llave.regla.es]) if (!csv.includes(f)) out.push(`la rúbrica publicada (CSV es) no lleva: ${f.slice(0, 50)}…`);
  return out;
}
igual(revisar234(RT), [], "textos 2, 3 y 4: la rúbrica (y su CSV publicado) dice exactamente lo aprobado, con las cifras de las constantes");
igual(N.MAX_SONDEADOS, 15, "el tope vigente es el de la frase aprobada (15)");

// ---------------------------------------------------------------- 3 · mutaciones
await conMutante(new URL("public/js/qready-textos.mjs", raiz), "pero falta algo para A:", "pero falta algo para  A:",
  async (M) => igual(revisar(M, RT, DOC_L, DOC_H, CSV, JSN).length > 0, true, "MUTACIÓN: un espacio de más en la B del código → grita"));
await conMutante(new URL("public/js/qready-textos.mjs", raiz), 'D: "No TLS 1.3 measured', 'D: "No TLS 1.3 was measured',
  async (M) => igual(revisar(M, RT, DOC_L, DOC_H, CSV, JSN).length > 0, true, "MUTACIÓN: una lectura que no se aprobó cambiar (D en inglés) → grita"));
igual(TA.sha256(Buffer.from(DOC_L.replace("cuatro causas", "cuatro  causas"), "utf8")) === AP.find((a) => a.archivo === LECTURA).sha256, false,
  "MUTACIÓN: un espacio de más en la copia del documento cambia su sha256 (el sello grita)");
await conMutante(new URL("public/js/rubrica-textos.mjs", raiz), " Estos valores son un modelo propio de Rosetta", " Estos valores son un modelo de Rosetta",
  async (M) => igual(revisar(TX, M, DOC_L, DOC_H, CSV, JSN).length > 0, true, "MUTACIÓN: la frase HNDL con una palabra menos → grita"));
igual(revisar(TX, RT, DOC_L, DOC_H, CSV.replace(TA.fraseHndl(DOC_H), ""), JSN).length > 0, true, "MUTACIÓN: la rúbrica publicada sin regenerar (CSV sin la frase) → grita");
// una mutación por texto aprobado (2, 3 y 4)
const RTX = new URL("public/js/rubrica-textos.mjs", raiz);
await conMutante(RTX, "fixed in the August 2026 edition.", "fixed in the August 2026 edition .",
  async (M) => igual(revisar234(M).some((x) => x.startsWith("texto 2")), true, "MUTACIÓN texto 2: un espacio de más en la frase HNDL en inglés → grita"));
await conMutante(RTX, "nombres por organización. La nota A exige", "nombres por organización.  La nota A exige",
  async (M) => igual(revisar234(M).some((x) => x.startsWith("texto 3 (es)")), true, "MUTACIÓN texto 3: un espacio de más en el tope (es) → grita"));
igual(revisar234(RT, { ...N, MAX_SONDEADOS: 16 }).some((x) => x.startsWith("texto 3")), true, "MUTACIÓN texto 3: con otro tope, la frase armada ya no es la aprobada → grita");
await conMutante(RTX, "depreca después de 2030 todo ECDSA y RSA", "depreca después de 2030 todo RSA y ECDSA",
  async (M) => igual(revisar234(M).some((x) => x.startsWith("texto 4 (es): el método")), true, "MUTACIÓN texto 4: el método de la llave reordenado → grita"));
await conMutante(RTX, "sólo si es post-cuántica;", "sólo si es postcuántica;",
  async (M) => igual(revisar234(M).some((x) => x.startsWith("texto 4 (es): la regla")), true, "MUTACIÓN texto 4: la regla de la llave con un guion menos → grita"));

// ---------------------------------------------------------------- 4 · los textos del MCP (24-nov-2026)
// TEXTOS-mcp-2026-11-24.md: textos 1 y 3, ES y EN. El código los sirve desde src/lib/mcp-textos.mjs:
//  1 es → la descripción de medir_exposicion_pqc (tools/list); 3 es → GET /mcp con mayúscula inicial;
//  3 en → /api-docs, dos veces, y ya no dice «read-only tools». 1 en está sellado y hoy no se sirve.
const MCP_DOC = TA.leerBytes(MCP).toString("utf8");
const { HERRAMIENTAS, NOTA_MCP } = await import("../api.js");
const NUC = await import("../public/js/qex-nucleo.mjs");
function revisarMcp(TM, herramientas = HERRAMIENTAS, nota = NOTA_MCP, docs = leer("src/pages/api-docs.astro")) {
  const out = [];
  for (const l of ["es", "en"]) for (const k of ["medir", "registro"])
    if (!MCP_DOC.includes(`| ${TM.TEXTOS_MCP[l][k]} |`)) out.push(`mcp ${l}.${k} no es el texto aprobado`);
  const medir = herramientas.find((h) => h.name === "medir_exposicion_pqc")?.description || "";
  if (!medir.includes("comparación con el sector, " + TM.TEXTOS_MCP.es.medir + " El cifrado")) out.push("medir_exposicion_pqc no sirve el texto 1 aprobado");
  if (!nota.startsWith(TM.mayuscula(TM.TEXTOS_MCP.es.registro) + ". ")) out.push("GET /mcp no sirve el texto 3 aprobado");
  if ((docs.match(/\{TEXTOS_MCP\.en\.registro\}/g) || []).length !== 2 || /read-only\s+tools/.test(docs)) out.push("/api-docs no sirve el texto 3 en inglés (o vuelve a decir read-only tools)");
  for (const v of [NUC.VERSION_NOTA, NUC.VERSION_QEX]) if (!TM.TEXTOS_MCP.es.medir.includes(v) || !TM.TEXTOS_MCP.en.medir.includes(v))
    out.push(`el texto 1 aprobado nombra otra versión que la vigente (${v}): se vuelve a aprobar`);
  return out;
}
const TM = await import("../src/lib/mcp-textos.mjs");
igual(revisarMcp(TM), [], "MCP: los textos 1 y 3 se sirven tal cual se aprobaron, ES y EN");
await conMutante(new URL("src/lib/mcp-textos.mjs", raiz), "la letra es la misma de su sello", "la letra es igual a la de su sello",
  async (M) => igual(revisarMcp(M).some((x) => x.startsWith("mcp es.medir")), true, "MUTACIÓN MCP texto 1: otra redacción en el código → grita"));
igual(revisarMcp(TM, HERRAMIENTAS, NOTA_MCP, leer("src/pages/api-docs.astro").replace("tools\n        ({TEXTOS_MCP.en.registro}):", "read-only\n        tools:")).length > 0, true,
  "MUTACIÓN MCP texto 3: /api-docs vuelve a «read-only tools» → grita");
igual(revisarMcp(TM, HERRAMIENTAS, "Solo lectura. Toda respuesta incluye sha256 y URLs de las copias públicas.").length > 0, true, "MUTACIÓN MCP texto 3: GET /mcp vuelve a «Solo lectura» → grita");

for (const f of fallas) console.log("  FALLA " + f);
console.log(fallas.length ? `check-textos-aprobados: ${fallas.length} falla(s) de ${casos} casos`
  : `check-textos-aprobados: ok (${casos} casos · 6 documentos sellados · lectura A/B, frase HNDL es/en, tope y llave, textos del MCP = lo aprobado · 12 mutaciones gritan)`);
process.exit(fallas.length ? 1 : 0);
