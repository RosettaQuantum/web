#!/usr/bin/env node
/**
 * El buscador encuentra lo que su propio placeholder propone.
 *
 * EL DEFECTO (medido en produccion el 2026-09-09): la caja de la Biblioteca ofrecia
 * tres ejemplos —"certified randomness, QAOA portfolio, Willow"— y **dos de los tres
 * devolvian "No matches"**. La causa era una sola: la consulta se pasaba entera como
 * UN literal a un LIKE, asi que cualquier busqueda de dos palabras daba cero.
 * `qaoa` -> 20 resultados. `portfolio` -> 20. `qaoa portfolio` -> **0**.
 *
 * Peor todavia: el indice rapido de la home SI encontraba "certified randomness", y su
 * mensaje de vacio invitaba a "abrir la busqueda completa de la Biblioteca" — que
 * encontraba menos. Una escalera que baja.
 *
 * POR QUE ES CARO: el placeholder es una PROMESA, escrita por nosotros, en la caja
 * misma. Un visitante que prueba el primer ejemplo que le ofrecemos y no obtiene nada
 * no concluye "la consulta estaba mal": concluye que el archivo esta vacio. Es
 * exactamente el miedo que Nicholas puso por escrito — "si estan pobres o escasas, va
 * a generar desconfianza y la gente va a dudar de nuestro laboratorio".
 *
 * COMO LO COMPRUEBA: lee el placeholder DE LA PAGINA SERVIDA —no una copia en este
 * archivo, que se desincronizaria—, parte sus ejemplos por coma y ejerce cada uno
 * contra las tres puertas que consulta el buscador real (claims, catalogo, corridas).
 * Cada ejemplo tiene que encontrar algo en al menos una.
 *
 * SU PUNTO CIEGO, declarado: comprueba que HAY resultados, no que sean los correctos.
 * Un buscador que devolviera cualquier cosa para todo pasaria por aca — por eso ademas
 * exige que una consulta sin sentido devuelva CERO.
 *
 * Uso:
 *   node scripts/check-buscador.mjs --self-test
 *   node scripts/check-buscador.mjs [--base https://...]
 */

/** Quien actua esta senal, y que hace al recibirla. Declarado aqui, no en un documento aparte. */
export const CONSUMIDOR = {
  quien: "la sesion CTO",
  hace: "arregla el buscador en api.js/public/js, o cambia el placeholder por ejemplos que existan",
};

/** Los ejemplos que la caja promete, tal como los escribe la pagina. */
export function ejemplosDelPlaceholder(placeholder) {
  return String(placeholder || "")
    .replace(/^\s*(e\.g\.|ej\.)\s*/i, "")
    .replace(/[…\.]+\s*$/, "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * @param {{ejemplo: string, resultados: number}[]} pruebas
 * @param {number} ruidoResultados cuantos devolvio una consulta sin sentido
 */
export function evaluarBuscador(pruebas, ruidoResultados) {
  const vacios = pruebas.filter((p) => p.resultados === 0);
  const fallas = [];
  if (vacios.length) {
    fallas.push(`${vacios.length} de ${pruebas.length} ejemplos del placeholder no encuentran nada: ` +
      vacios.map((v) => `"${v.ejemplo}"`).join(", "));
  }
  // Un buscador que contesta a todo no esta buscando.
  if (ruidoResultados > 0) fallas.push(`una consulta sin sentido devolvio ${ruidoResultados} resultados`);
  return { ok: fallas.length === 0, fallas, denominadores: { ejemplos: pruebas.length, vacios: vacios.length } };
}

// --------------------------------------------------------------------------- self-test

function selfTest() {
  let ok = 0, mal = 0;
  const p = (n, c, d = "") => { if (c) { ok++; console.log(`  ok   ${n}`); } else { mal++; console.log(`  FALLA ${n}${d ? "\n         " + d : ""}`); } };

  p("parte el placeholder ingles",
    JSON.stringify(ejemplosDelPlaceholder("e.g. certified randomness, QAOA portfolio, Willow…")) ===
    JSON.stringify(["certified randomness", "QAOA portfolio", "Willow"]));
  p("parte el placeholder español",
    JSON.stringify(ejemplosDelPlaceholder("ej. aleatoriedad certificada, QAOA portafolio, Willow…")) ===
    JSON.stringify(["aleatoriedad certificada", "QAOA portafolio", "Willow"]));

  const sano = evaluarBuscador([{ ejemplo: "a", resultados: 3 }, { ejemplo: "b", resultados: 1 }], 0);
  p("calla cuando los tres ejemplos encuentran", sano.ok, JSON.stringify(sano.fallas));

  // EL CASO REAL del 2026-09-09: dos de tres vacios.
  const real = evaluarBuscador([
    { ejemplo: "certified randomness", resultados: 0 },
    { ejemplo: "QAOA portfolio", resultados: 0 },
    { ejemplo: "Willow", resultados: 1 },
  ], 0);
  p("grita con el caso real", !real.ok && /2 de 3 ejemplos/.test(real.fallas[0]), JSON.stringify(real.fallas));
  p("nombra los ejemplos que fallan", /certified randomness/.test(real.fallas[0]));

  const ruidoso = evaluarBuscador([{ ejemplo: "a", resultados: 3 }], 7);
  p("grita si contesta a una consulta sin sentido", !ruidoso.ok && /sin sentido/.test(ruidoso.fallas[0]));

  console.log(`\n  ${ok} ok · ${mal} fallas`);
  return mal === 0 ? 0 : 1;
}

// ------------------------------------------------------------------------------ vivo

const RUIDO = "zqxjkvwyx";

async function contraSitio(base) {
  const j = async (u) => {
    const r = await fetch(base + u, { headers: { accept: "application/json" } });
    return r.ok ? r.json() : null;
  };
  // Las tres puertas que consulta el buscador de la Biblioteca, en el mismo orden.
  const cuantos = async (q) => {
    const [alg, run, cl] = await Promise.all([
      j("/v1/algorithms?limit=20&q=" + encodeURIComponent(q)),
      j("/v1/search?limit=10&q=" + encodeURIComponent(q)),
      j("/v1/claims?limit=50"),
    ]);
    const palabras = q.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
    // TODO el texto de la fila, no una lista de campos elegida a mano: el 2026-09-09
    // los claims ganaron `title_en`/`domain_en` y una guardia con la lista vieja
    // habria seguido diciendo "no encuentra nada" con el arreglo ya desplegado.
    const enClaims = ((cl && cl.claims) || []).filter((c) => {
      const heno = Object.values(c).filter((v) => typeof v === "string").join(" ").toLowerCase();
      return palabras.every((w) => heno.includes(w));
    }).length;
    return ((alg && alg.items) || []).length + ((run && run.items) || []).length + enClaims;
  };

  const resultado = [];
  for (const [ruta, etiqueta] of [["/library/", "EN"], ["/es/biblioteca/", "ES"]]) {
    const html = await (await fetch(base + ruta)).text();
    const m = html.match(/id="libQ"[^>]*placeholder="([^"]*)"/) || html.match(/placeholder="([^"]*)"[^>]*id="libQ"/);
    if (!m) { resultado.push({ etiqueta, estado: "indeterminado", motivo: `sin placeholder en ${ruta}` }); continue; }
    const ejemplos = ejemplosDelPlaceholder(m[1].replace(/&amp;/g, "&"));
    const pruebas = [];
    for (const e of ejemplos) pruebas.push({ ejemplo: e, resultados: await cuantos(e) });
    resultado.push({ etiqueta, placeholder: m[1], ...evaluarBuscador(pruebas, await cuantos(RUIDO)), pruebas });
  }
  return resultado;
}

import { pathToFileURL } from "node:url";
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.includes("--self-test")) process.exit(selfTest());
  const i = args.indexOf("--base");
  const BASE = i >= 0 ? args[i + 1] : "https://rosettaquantum.com";
  console.log(`buscador · los ejemplos que promete la caja — ${BASE}`);
  const r = await contraSitio(BASE);
  let malas = 0, indet = 0;
  for (const c of r) {
    if (c.estado === "indeterminado") { console.log(`  INDETERMINADO ${c.etiqueta}: ${c.motivo}`); indet++; continue; }
    c.pruebas.forEach((p) => console.log(`  ${p.resultados ? "ok  " : "VACIO"} ${c.etiqueta} "${p.ejemplo}" → ${p.resultados}`));
    if (!c.ok) { c.fallas.forEach((f) => console.log(`  FALLA ${c.etiqueta} ${f}`)); malas++; }
  }
  if (indet && !malas) process.exit(2);
  process.exit(malas ? 1 : 0);
}
