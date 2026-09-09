#!/usr/bin/env node
/**
 * La ventana horneada y la isla leen la MISMA coleccion, y entre las dos no se pierde
 * ni un artefacto.
 *
 * EL DEFECTO (medido en produccion el 2026-09-09, y estaba vivo desde el commit 10-bis):
 *
 *     /ledger hornea 45 filas   <- SELECT ... FROM run_archives ORDER BY ... LIMIT 45
 *                                  (los 45 mas recientes, DE TODOS LOS TIPOS)
 *     la isla pagina desde 45   <- GET /v1/runs?limit=25&offset=45
 *                                  (/v1/runs solo tiene type='RUN')
 *
 * Dos colecciones distintas, un solo offset. De las 93 corridas selladas, 25 —el lote
 * E.ON entero, RQ-EXP-EON-*— no aparecian en NINGUNA pagina del ledger publico. Y el
 * pie declaraba "93 of 93 artifacts in the archive" usando el total de RUN como si
 * fuera el del archivo: el archivo tiene 136.
 *
 * Por que ninguna guardia lo vio: `check-listado-denominador` compara la API contra la
 * API y lo hace bien —/v1/runs pagina perfecto hasta 93—. **Nadie comparaba la PAGINA
 * contra la API.** El numero era correcto y medía otra cosa, que es la familia de
 * defectos mas cara de este proyecto.
 *
 * LO QUE COMPRUEBA, y el orden importa:
 *
 *   1. La ventana horneada ES la primera pagina de la coleccion que la isla pagina.
 *      No "tiene el mismo largo": los MISMOS ids, en el MISMO orden. Si no lo fueran,
 *      el offset de la isla apunta a otra parte y el salto es invisible.
 *   2. Paginar desde ahi hasta el final suma exactamente el denominador declarado, sin
 *      un id repetido.
 *   3. **Toda corrida de /v1/runs aparece en esa union.** Es el cruce que caza el
 *      defecto real: la coleccion enumerada tiene que contener a la que ya publicamos
 *      por otra puerta.
 *   4. El denominador coincide con `artefactos_en_el_archivo` de /v1/state. Dos
 *      superficies nuestras contando distinto es peor que una contando mal.
 *
 * SU PUNTO CIEGO, declarado: comprueba QUE artefactos se enumeran, no si el contenido
 * de cada fila es correcto. Un hash equivocado en una fila pasa por aca. Para eso esta
 * `check-api-vs-sello`.
 *
 * Uso:
 *   node scripts/check-ledger-ventana.mjs --self-test        # unidad, sin red
 *   node scripts/check-ledger-ventana.mjs                    # contra produccion
 *   node scripts/check-ledger-ventana.mjs --base https://... # contra preview
 *
 * Salidas: 0 = completo · 1 = se pierden artefactos · 2 = no se pudo comprobar.
 */

/** Quien actua esta senal, y que hace al recibirla. Declarado aqui, no en un documento aparte. */
export const CONSUMIDOR = {
  quien: "la sesion CTO",
  hace: "hace que public/js/ledger.js pagine la misma coleccion que hornea sync-ledger.mjs, y vuelve a desplegar",
};

/**
 * El nucleo, puro y sin red, para que el self-test pueda romperlo.
 *
 * Devuelve SIEMPRE los denominadores: cuantas horneadas, cuantas de la API, cuantas
 * corridas cruzadas. Un veredicto sin denominador no es un resultado.
 *
 * @param {{idsHorneadas: string[], primeraPagina: string[], union: string[],
 *          totalDeclarado: number, idsRun: string[], totalEstado: number|null}} ctx
 */
export function evaluarVentana({ idsHorneadas, primeraPagina, union, totalDeclarado, idsRun, totalEstado }) {
  const fallas = [];

  // 1. La ventana horneada es la primera pagina, id por id y en orden.
  const mismoLargo = idsHorneadas.length === primeraPagina.length;
  const desalineadas = mismoLargo
    ? idsHorneadas.map((id, i) => (id === primeraPagina[i] ? null : { pos: i, horneada: id, api: primeraPagina[i] }))
        .filter(Boolean)
    : [];
  if (!mismoLargo) {
    fallas.push(`la ventana horneada trae ${idsHorneadas.length} filas y la primera pagina de la API ${primeraPagina.length}`);
  } else if (desalineadas.length) {
    const m = desalineadas[0];
    fallas.push(`la ventana horneada NO es la primera pagina de la coleccion que pagina la isla: ` +
      `${desalineadas.length} de ${idsHorneadas.length} desalineadas (pos ${m.pos}: horneada ${m.horneada} · API ${m.api})`);
  }

  // 2. La union llega al denominador y no repite.
  const vistos = new Set(union);
  const repetidos = union.length - vistos.size;
  if (repetidos) fallas.push(`${repetidos} id(s) repetidos al paginar`);
  if (vistos.size !== totalDeclarado) {
    fallas.push(`paginar de punta a punta da ${vistos.size} artefactos y el denominador declarado es ${totalDeclarado}`);
  }

  // 3. Toda corrida publicada por /v1/runs aparece enumerada. ESTE es el cruce que caza.
  const runsPerdidas = idsRun.filter((id) => !vistos.has(id));
  if (runsPerdidas.length) {
    fallas.push(`${runsPerdidas.length} de ${idsRun.length} corridas de /v1/runs NO aparecen en ninguna pagina del ledger` +
      ` (ej. ${runsPerdidas.slice(0, 3).join(", ")})`);
  }

  // 4. El denominador tiene una segunda fuente que lo confirme.
  if (totalEstado !== null && totalEstado !== undefined && totalEstado !== totalDeclarado) {
    fallas.push(`el ledger declara ${totalDeclarado} artefactos y /v1/state dice ${totalEstado}`);
  }

  return {
    ok: fallas.length === 0,
    fallas,
    denominadores: {
      horneadas: idsHorneadas.length,
      enumeradas: vistos.size,
      declarado: totalDeclarado,
      corridas_cruzadas: idsRun.length,
      corridas_perdidas: runsPerdidas.length,
    },
  };
}

// --------------------------------------------------------------------------- self-test

function selfTest() {
  let ok = 0, mal = 0;
  const p = (nombre, cond, detalle = "") => {
    if (cond) { ok++; console.log(`  ok   ${nombre}`); }
    else { mal++; console.log(`  FALLA ${nombre}${detalle ? "\n         " + detalle : ""}`); }
  };

  // El caso SANO: 5 horneadas, 8 en el archivo, 4 de ellas RUN, todas enumeradas.
  const sano = {
    idsHorneadas: ["A", "B", "C", "D", "E"],
    primeraPagina: ["A", "B", "C", "D", "E"],
    union: ["A", "B", "C", "D", "E", "F", "G", "H"],
    totalDeclarado: 8,
    idsRun: ["A", "C", "F", "H"],
    totalEstado: 8,
  };
  const r0 = evaluarVentana(sano);
  p("calla cuando esta completo", r0.ok, JSON.stringify(r0.fallas));
  p("reporta los denominadores", r0.denominadores.enumeradas === 8 && r0.denominadores.horneadas === 5);

  // EL DEFECTO REAL, en miniatura: la isla pagina otra coleccion (solo RUN) con el
  // offset de la ventana horneada, asi que se salta los RUN que caian dentro de ella.
  // Horneadas A..E (mezcla de tipos); la API solo tiene RUN [A,C,F,H] y desde offset 5
  // no devuelve nada, asi que F y H —corridas reales— nunca se enumeran.
  const roto = {
    idsHorneadas: ["A", "B", "C", "D", "E"],
    primeraPagina: ["A", "C", "F", "H"],       // otra coleccion: ni el largo calza
    union: ["A", "B", "C", "D", "E"],
    totalDeclarado: 5,
    idsRun: ["A", "C", "F", "H"],
    totalEstado: 8,
  };
  const r1 = evaluarVentana(roto);
  p("grita cuando la isla pagina otra coleccion", !r1.ok);
  p("nombra las corridas perdidas", r1.fallas.some((f) => /corridas de \/v1\/runs NO aparecen/.test(f)),
    JSON.stringify(r1.fallas));
  p("nombra el denominador que no calza con /v1/state", r1.fallas.some((f) => /\/v1\/state dice 8/.test(f)));

  // El caso que casi no se ve: mismo largo, ids corridos por uno.
  const corrido = { ...sano, primeraPagina: ["B", "C", "D", "E", "F"] };
  const r2 = evaluarVentana(corrido);
  p("grita con la ventana corrida por uno (mismo largo)", !r2.ok && r2.fallas.some((f) => /desalineadas/.test(f)));

  // Paginar que se repite en vez de avanzar: el sintoma clasico de offset ignorado.
  const repetida = { ...sano, union: ["A", "B", "C", "D", "E", "A", "B", "C"] };
  const r3 = evaluarVentana(repetida);
  p("grita cuando paginar repite en vez de avanzar", !r3.ok && r3.fallas.some((f) => /repetidos/.test(f)));

  console.log(`\n  ${ok} ok · ${mal} fallas`);
  return mal === 0 ? 0 : 1;
}

// ------------------------------------------------------------------------------ vivo

async function contraSitio(base) {
  const traer = async (u) => {
    const r = await fetch(base + u, { headers: { accept: "application/json" } });
    if (!r.ok) throw new Error(`${u} -> ${r.status}`);
    return r.json();
  };

  // La PAGINA, tal como la sirve el sitio: cuantas filas hornea y cuales.
  const html = await (await fetch(base + "/ledger/")).text();
  const cuerpo = html.match(/<tbody id="artBody"[^>]*data-horneados="(\d+)"([\s\S]*?)<\/tbody>/);
  if (!cuerpo) return { estado: "indeterminado", motivo: "no se encontro <tbody id=artBody data-horneados> en /ledger" };
  const declaradas = parseInt(cuerpo[1], 10);
  const idsHorneadas = [...cuerpo[2].matchAll(/<tr id="([^"]+)"/g)].map((m) => m[1]);
  if (idsHorneadas.length !== declaradas) {
    return { estado: "roto", fallas: [`data-horneados dice ${declaradas} y el HTML trae ${idsHorneadas.length} filas`] };
  }

  const pag0 = await traer(`/v1/archives?limit=${declaradas}&offset=0`);
  const totalDeclarado = pag0.total_archivo;

  // Paginar de punta a punta, igual que la isla.
  const union = [...pag0.items.map((x) => x.id)];
  let off = union.length;
  while (off < totalDeclarado && off < 1000) {
    const p = await traer(`/v1/archives?limit=50&offset=${off}`);
    if (!p.items.length) break;
    union.push(...p.items.map((x) => x.id));
    off += p.items.length;
  }

  const runs = await traer("/v1/runs?limit=200");
  const st = await traer("/v1/state");

  return {
    estado: "medido",
    ...evaluarVentana({
      idsHorneadas,
      primeraPagina: pag0.items.map((x) => x.id),
      union,
      totalDeclarado,
      idsRun: runs.items.map((x) => x.id),
      totalEstado: st?.estado_medido?.artefactos_en_el_archivo ?? null,
    }),
  };
}

// El CLI corre solo cuando este archivo ES el que se invoco. Sin esto, importar
// `evaluarVentana` desde otra guardia dispara la corrida contra la red y el proceso
// se cierra antes de que el que importo llegue a usar nada.
import { pathToFileURL } from "node:url";
const esEntrada = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
const args = process.argv.slice(2);
if (esEntrada && args.includes("--self-test")) process.exit(selfTest());
if (esEntrada) await main();

async function main() {

  const iBase = args.indexOf("--base");
  const BASE = iBase >= 0 ? args[iBase + 1] : "https://rosettaquantum.com";
  console.log(`ledger · ventana horneada vs isla — ${BASE}`);
  try {
    const r = await contraSitio(BASE);
    if (r.estado === "indeterminado") { console.log(`  INDETERMINADO: ${r.motivo}`); process.exit(2); }
    console.log("  denominadores: " + JSON.stringify(r.denominadores || {}));
    if (r.ok) { console.log("  ok   el ledger enumera el archivo entero, sin saltos"); process.exit(0); }
    r.fallas.forEach((f) => console.log(`  FALLA ${f}`));
    process.exit(1);
  } catch (e) {
    console.log(`  INDETERMINADO: ${e.message}`);
    process.exit(2);
  }
}
