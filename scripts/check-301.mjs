/**
 * T-301 — las redirecciones existen, apuntan donde dicen, y el destino responde.
 *
 * POR QUE NO BASTA CON "DEVUELVE 301"
 * -----------------------------------
 * Un 301 a un 404 es PEOR que no redirigir: la pagina original ya no existe, asi que el
 * visitante y el buscador se quedan sin nada, y el 301 se ve perfecto en cualquier
 * chequeo que solo mire el codigo de estado. Aqui se sigue el salto y se exige 200 al
 * otro lado.
 *
 * Y POR QUE SE COMPRUEBA CON Y SIN BARRA FINAL
 * -------------------------------------------
 * Este repo ya se quemo con eso: /blog sin barra devuelve 307 y curl sin -L trae cuerpo
 * vacio; "el post esta vacio" era "pedi la URL equivocada". La tabla del Worker
 * normaliza la barra antes de mirar, asi que las dos formas tienen que redirigir.
 *
 * PUNTO CIEGO DECLARADO: comprueba el salto, no que el destino sea el CORRECTO en
 * contenido. Que /clases mande a la Biblioteca y no a la home es una decision de
 * producto; aqui solo se garantiza que llega a algo vivo.
 */
export const CONSUMIDOR = {
  quien: "quien empuja a una rama rebuild y quien autoriza el cutover",
  hace: "no fusiona: una ruta indexada quedaria sirviendo la pagina vieja, o redirigiendo a un 404",
};

import { readFileSync } from "node:fs";

const PREVIEW = (process.env.PREVIEW_URL || "").replace(/\/+$/, "");
if (!PREVIEW) { console.error("ABORTA: falta PREVIEW_URL"); process.exit(1); }

// La misma tabla del Worker. Se escribe aqui a proposito: si el guardia la leyera del
// archivo bajo prueba, borrar una entrada dejaria de vigilarla y el CI seguiria verde —
// el mismo error que reprobo la primera version de T-guardia.
const R = {
  "/rosettaq": "/library",
  "/rosettaq/calculator": "/library",
  "/rosettaq/catalog": "/library",
  "/rosettaq/router": "/library",
  "/rosettaq/unit": "/library",
  "/es/rosettaq": "/es/biblioteca",
  "/es/rosettaq/calculator": "/es/biblioteca",
  "/es/rosettaq/catalog": "/es/biblioteca",
  "/es/rosettaq/router": "/es/biblioteca",
  "/es/rosettaq/unit": "/es/biblioteca",
  "/pricing": "/services",
  "/es/precios": "/es/servicios",
  "/clases": "/library",
  "/es/clases": "/es/biblioteca",
  // 9-sep: las erratas se concentran en el ledger, en su propia ancla.
  "/errata": "/ledger#erratas",
  "/es/erratas": "/es/ledger#erratas",
};

// ...PERO la lista escrita a mano tiene su propio agujero, y se vio el mismo dia que
// se escribio este bloque: agregue dos redirecciones al Worker y este guardia siguio
// diciendo "las 14 redirecciones saltan bien". No mintio — vigilo 14 de 16 y llamo 14
// al total. Una lista de lo esperado no ve lo que falta del mundo.
//
// Se conservan las DOS: `R` sigue siendo la expectativa independiente (borrar una
// entrada del Worker tiene que gritar), y ademas se comparan los conjuntos de claves
// contra el Worker de verdad. Asi, agregar sin vigilar tambien grita.
function tablaDelWorker() {
  const txt = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const m = txt.match(/const REDIRECTS_301 = \{([\s\S]*?)\n\};/);
  if (!m) return null;
  const pares = [...m[1].matchAll(/"([^"]+)"\s*:\s*"([^"]+)"/g)];
  return Object.fromEntries(pares.map((x) => [x[1], x[2]]));
}


// Reintento corto. NO es para tapar un fallo: es porque el manifiesto de ASSETS y el
// Worker no llegan al borde en el mismo instante. Medido en el CI del commit 10: en la
// MISMA corrida, /clases devolvio 307 (el asset viejo, que ya no existe en el build) y
// /clases/ devolvio 301 (el Worker nuevo). Segundos despues, las dos daban 301.
// Un guardia que falla a ratos es peor que no tenerlo: la gente aprende a re-lanzarlo.
async function esperar(url, ok, intentos = 10, ms = 3000) {
  let ultimo = null;
  for (let i = 0; i < intentos; i++) {
    ultimo = await fetch(url, { redirect: "manual", headers: { "x-rq-check": "1" } });
    if (ok(ultimo)) return ultimo;
    if (i < intentos - 1) await new Promise((r) => setTimeout(r, ms));
  }
  return ultimo;
}

const fallos = [];
console.log(`preview: ${PREVIEW}\nredirecciones declaradas: ${Object.keys(R).length}\n`);

const delWorker = tablaDelWorker();
if (!delWorker) {
  console.log("  FALLA no se pudo leer REDIRECTS_301 de worker.js — el cotejo no corrio");
  fallos.push("cotejo");
} else {
  const soloWorker = Object.keys(delWorker).filter((k) => !(k in R));
  const soloGuardia = Object.keys(R).filter((k) => !(k in delWorker));
  const distinto = Object.keys(R).filter((k) => k in delWorker && delWorker[k] !== R[k]);
  if (soloWorker.length) { console.log(`  FALLA el Worker redirige ${soloWorker.length} ruta(s) que este guardia no vigila: ${soloWorker.join(", ")}`); fallos.push("cotejo"); }
  if (soloGuardia.length) { console.log(`  FALLA este guardia espera ${soloGuardia.length} redireccion(es) que el Worker ya no tiene: ${soloGuardia.join(", ")}`); fallos.push("cotejo"); }
  if (distinto.length) { console.log(`  FALLA ${distinto.length} destino(s) distintos entre el guardia y el Worker: ${distinto.join(", ")}`); fallos.push("cotejo"); }
  if (!soloWorker.length && !soloGuardia.length && !distinto.length)
    console.log(`  ok    la tabla del guardia y la del Worker son la misma (${Object.keys(R).length} entradas)`);
}

for (const [origen, destino] of Object.entries(R)) {
  for (const forma of [origen, origen + "/"]) {
    const r = await esperar(PREVIEW + forma, (x) => x.status === 301);
    const loc = r.headers.get("location") || "";
    if (r.status !== 301) { console.log(`  FALLA ${forma.padEnd(26)} ${r.status} — se esperaba 301`); fallos.push(forma); continue; }
    if (!loc.endsWith(destino)) { console.log(`  FALLA ${forma.padEnd(26)} 301 -> ${loc} — se esperaba ${destino}`); fallos.push(forma); continue; }
    const d = await fetch(PREVIEW + destino, { headers: { "x-rq-check": "1" } });
    if (d.status !== 200) { console.log(`  FALLA ${forma.padEnd(26)} 301 correcto pero el destino ${destino} responde ${d.status}`); fallos.push(forma); continue; }
    console.log(`  ok    ${forma.padEnd(26)} 301 -> ${destino} (200)`);
  }
}

if (fallos.length) { console.log(`\nT-301: ${fallos.length} de ${Object.keys(R).length * 2} formas fallan.`); process.exit(1); }
console.log(`\nT-301: las ${Object.keys(R).length} redirecciones saltan bien, con y sin barra final, y todos los destinos responden 200.`);
