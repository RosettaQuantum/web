/**
 * T-verify — la promesa de /verify se ejerce en cada deploy, no se escribe.
 *
 * POR QUE EXISTE
 * --------------
 * La primera version de /verify prometia "baja el archivo y recomputamos su sha256". Al
 * probarla contra un artefacto real —RQ-EXP-HSBC-Q-002— el archivo daba 829db084… y el
 * ledger declaraba 2c52b228…: la pagina le habria dicho al lector que NUESTRO PROPIO
 * sello no calza, con la herramienta que nosotros le dimos. Es el fallo que esta casa ya
 * pago dos veces (una API que mandaba a un /api-docs con 404; cuatro sellos citando
 * archivos de procedencia no publicados). Aca el producto ES la verificabilidad: una
 * promesa verificable que no se ejerce es peor que no hacerla.
 *
 * QUE COMPRUEBA
 * -------------
 *  1. La receta v3 reproduce el content_hash de artefactos REALES tomados del ledger en
 *     vivo (no una lista escrita a mano, que envejece y termina verificando un 404).
 *  2. El jcs.mjs que sirve la web es BYTE A BYTE el del laboratorio. Dos copias de un
 *     canonizador divergen en el primer flotante raro y nadie lo nota.
 *  3. /verify carga el modulo, y /v1/archive/<id>/raw responde.
 *
 * PUNTO CIEGO DECLARADO: comprueba la convencion v3, que es la vigente. El archivo tiene
 * tres anteriores; la pagina lo dice y manda a verificar.py, que las prueba las cuatro.
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { jcs } from "./lib/jcs.mjs";

export const CONSUMIDOR = {
  quien: "quien empuja a una rama rebuild y quien autoriza el cutover",
  hace: "no publica /verify: la pagina le diria a un tercero que nuestros propios sellos no calzan",
};

const PREVIEW = (process.env.PREVIEW_URL || "").replace(/\/+$/, "");
if (!PREVIEW) { console.error("ABORTA: falta PREVIEW_URL"); process.exit(1); }

const fallos = [];
const sha = (t) => "sha256:" + createHash("sha256").update(t, "utf8").digest("hex");

// La convencion v3, escrita una sola vez y en el mismo orden que la pagina.
function podar(doc) {
  const d = JSON.parse(JSON.stringify(doc));
  if (d.meta) { delete d.meta.content_hash; delete d.meta.schema; }
  delete d.storage;
  return d;
}

console.log(`preview: ${PREVIEW}\n`);

// 1 · el canonizador servido es el del laboratorio, byte a byte
const local = createHash("sha256").update(readFileSync("scripts/lib/jcs.mjs")).digest("hex");
const publicado = createHash("sha256").update(readFileSync("public/js/lib/jcs.mjs")).digest("hex");
if (local !== publicado) { console.log(`  FALLA jcs.mjs servido != el del laboratorio (${publicado.slice(0,8)}… vs ${local.slice(0,8)}…)`); fallos.push("jcs"); }
else console.log(`  ok    jcs.mjs servido = el del laboratorio · sha256 ${local.slice(0, 8)}…`);

// 2 · la pagina carga el modulo
const pag = await fetch(PREVIEW + "/verify", { headers: { "x-rq-check": "1" } });
const html = await pag.text();
if (pag.status !== 200 || !html.includes('src="/js/verificar.js"')) { console.log(`  FALLA /verify no carga el modulo (${pag.status})`); fallos.push("/verify"); }
else console.log("  ok    /verify carga /js/verificar.js");

// 3 · la receta reproduce sellos REALES, tomados del ledger en vivo
const runs = await (await fetch(PREVIEW + "/v1/runs?limit=6")).json();
const items = (runs.items || []).filter((x) => x.content_hash);
if (items.length < 3) { console.log(`  FALLA el ledger devolvio ${items.length} artefactos con hash — no hay con que probar`); fallos.push("muestra"); }

let calzan = 0;
for (const it of items) {
  let raw;
  try { raw = await (await fetch(`${PREVIEW}/v1/archive/${encodeURIComponent(it.id)}/raw`)).json(); }
  catch { console.log(`  FALLA ${it.id.padEnd(24)} /v1/archive/<id>/raw no devolvio JSON`); fallos.push(it.id); continue; }
  const calculado = sha(jcs(podar(raw)));
  if (calculado === it.content_hash) { calzan++; console.log(`  ok    ${it.id.padEnd(24)} v3/JCS reproduce ${it.content_hash.slice(7, 15)}…`); }
  else { console.log(`  FALLA ${it.id.padEnd(24)} recomputado ${calculado.slice(7, 15)}… vs declarado ${it.content_hash.slice(7, 15)}…`); fallos.push(it.id); }
}

if (fallos.length) {
  console.log(`\nT-verify: ${fallos.length} fallo(s). ${calzan} de ${items.length} artefactos reproducen su sello.`);
  console.log("Si /verify sale asi, le dice a un tercero que nuestros propios sellos no calzan.");
  process.exit(1);
}
console.log(`\nT-verify: la receta v3 reproduce el sello de los ${calzan} artefactos probados, tomados del ledger en vivo.`);
