/**
 * T-generados — lo commiteado es lo que su generador produce HOY.
 *
 * EL DEFECTO QUE LO HIZO NECESARIO (9-sep)
 * ----------------------------------------
 * Cambie el sistema de botones en home.css y el CTA de la barra siguio sirviendose con
 * el estilo viejo. La causa: `marca-gana.css` es un archivo GENERADO —copia los
 * selectores en conflicto con `html` delante para que ganen por especificidad— y nadie
 * lo regenera. Seguia promoviendo la regla anterior, y como gana por especificidad,
 * ganaba tambien sobre la nueva. Un archivo derivado que no se regenera no es una copia:
 * es una version antigua con autoridad.
 *
 * Y no era el unico. Al mirarlo aparecieron tres sin ninguna comprobacion de deriva, uno
 * de ellos el que produce TODA la home en español: si alguien edita home.en.html y no
 * regenera, la cara española se queda vieja en silencio. Ese es el mismo mecanismo que
 * dejo 29 enlaces en ingles en la home ES durante dos semanas.
 *
 * COMO
 * ----
 * Se guarda el archivo, se corre su generador, se compara, y se DEJA EL ARBOL COMO
 * ESTABA. El guardia no arregla: avisa y dice el comando. Arreglar en silencio esconde
 * que alguien edito a mano un archivo que se genera.
 *
 * PUNTO CIEGO DECLARADO: solo cubre generadores deterministas y locales. `sync-ledger`
 * lee D1 y cambia entre corridas por diseño, asi que no entra aqui — lo vigila
 * check-ledger-deriva.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

export const CONSUMIDOR = {
  quien: "quien construye el sitio, antes de desplegar",
  hace: "no despliega: se publica una version vieja de un archivo generado, y gana sobre la nueva sin avisar",
};

const PARES = [
  ["scripts/build-marca-gana.mjs", "src/styles/componentes/marca-gana.css",
   "promueve los selectores en conflicto con `html` delante; si queda viejo, gana la regla anterior"],
  ["scripts/build-home-es.mjs", "src/content_html/home.es.html",
   "produce la home en español entera; si queda vieja, se sirve la traduccion anterior"],
  ["scripts/build-library-cifras.mjs", "src/data/library-cifras.json",
   "hornea el catalogo de 74 algoritmos desde la semilla SQL"],
];

const fallos = [];
for (const [generador, salida, porque] of PARES) {
  let antes;
  try { antes = readFileSync(salida, "utf8"); }
  catch { console.log(`  ---   ${salida} no existe todavia — se salta`); continue; }
  try { execFileSync("node", [generador], { stdio: "pipe" }); }
  catch (e) {
    console.log(`  FALLA ${generador} no corre: ${String(e.stderr || e).slice(0, 120)}`);
    fallos.push(generador); continue;
  }
  const despues = readFileSync(salida, "utf8");
  if (antes === despues) { console.log(`  ok    ${salida.padEnd(40)} coincide con su generador`); continue; }
  // El arbol vuelve a como estaba: este guardia informa, no arregla.
  writeFileSync(salida, antes);
  const d1 = antes.split("\n"), d2 = despues.split("\n");
  const linea = d1.findIndex((l, i) => l !== d2[i]);
  console.log(`  FALLA ${salida} NO es lo que produce ${generador}`);
  console.log(`        ${porque}`);
  if (linea >= 0) {
    console.log(`        primera diferencia, linea ${linea + 1}:`);
    console.log(`          commiteado: ${(d1[linea] || "(no existe)").trim().slice(0, 110)}`);
    console.log(`          generado:   ${(d2[linea] || "(no existe)").trim().slice(0, 110)}`);
  }
  console.log(`        se arregla con:  node ${generador}`);
  fallos.push(salida);
}

if (fallos.length) {
  console.log(`\nT-generados: ${fallos.length} archivo(s) generado(s) a la deriva. El arbol quedo como estaba.`);
  process.exit(1);
}
console.log(`\nT-generados: los ${PARES.length} archivos generados coinciden con su generador.`);
