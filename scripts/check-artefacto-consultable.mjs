#!/usr/bin/env node
/**
 * Un artefacto sellado que no se puede consultar no cumple su unica funcion.
 *
 * EL DEFECTO (medido el 2026-08-26 contra `/v1/runs` y contra el archivo). El esquema de
 * `w6.que` dejo de usarse, y con el se fueron los campos por los que la API busca:
 *
 *     julio    51 artefactos · problem_class e instance al 100% · 38 campos distintos
 *     agosto   42 artefactos · problem_class e instance al   0% · 128 campos distintos
 *
 * Un corte limpio, sin oscilacion: la ultima poblada es del 30-jul (`EXP-0007-020`), la
 * primera vacia del 03-ago (`RQ-POC-QPU-001`). **Veinticuatro dias y 42 corridas.**
 *
 * Cada guion de sellado nuevo **invento su propia estructura narrativa** en vez de llenar el
 * esquema. Y el detalle que explica por que nadie lo vio: **el contenido de agosto es mejor
 * que el de julio** —mas rico y mas honesto—, asi que leer un artefacto a ojo daba confianza.
 * Lo que se perdio no fue calidad: fue **la capacidad de encontrarlo**.
 *
 * ES LA FORMA MAS PURA DEL DEFECTO DE LA CASA. No se rompio nada. Ningun chequeo fallo. El
 * artefacto esta bien formado, sellado, anclado, con sus dos copias publicas y su hash
 * verificable. **Simplemente dejo de contestar la pregunta para la que existe.** Un agente que
 * consulta el archivo hoy recibe 42 corridas sin clase, sin instancia y sin lado clasico —y el
 * hallazgo vive unicamente en el nombre del archivo, que es justo lo que un formato
 * consultable viene a evitar—.
 *
 * POR QUE NO BARRE EL ARCHIVO. Se invoca sobre **el artefacto que se va a sellar**, no sobre
 * lo publicado. Los 42 de agosto no se re-sellan: publicado es publicado, y si hay que
 * hacerlos consultables va un indice derivado aparte. Este guardia impide el 43.
 *
 * Y hay un modo auditoria que recorre y **reporta sin bloquear**, para medir el avance sin
 * detener a nadie.
 *
 * PRECISION SOBRE COBERTURA. Exige que el campo EXISTA y no este vacio. No juzga si el valor
 * es correcto —`problem_class: "cosas"` pasa— porque eso es criterio y no se automatiza. Lo
 * que impide es el caso que de verdad ocurrio, que es no poner nada.
 *
 * Uso:
 *   node scripts/check-artefacto-consultable.mjs --self-test
 *   node scripts/check-artefacto-consultable.mjs <artefacto.json>   # antes de sellar; bloquea
 *   node scripts/check-artefacto-consultable.mjs --auditar <dir>    # recorre y reporta
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, basename } from "node:path";

/** Quien actua esta senal, y que hace al recibirla. Declarado aqui, no en un documento aparte. */
export const CONSUMIDOR = {
  quien: "quien selle una corrida (laboratorio o archivo)",
  hace: "llena los campos canonicos de w6.que antes de sellar; la narrativa va ademas, no en vez de",
};

/**
 * **LA UNICA DEFINICION.** El generador y este guardia leen de aqui, importandola — no cada
 * uno la suya. Una lista que vive en dos lugares ya divergio (CLAUDE.md §5 bis 3), y eso es
 * literalmente lo que produjo este defecto: cada guion con su propio vocabulario.
 */
export const CAMPOS_CONSULTABLES = ["problem_class", "instance"];

/**
 * Ademas de los obligatorios, estos hacen la corrida comparable. Se reportan, no bloquean.
 *
 * `outcome` ESTUVO EN LA LISTA DE ARRIBA Y SE BAJO, y por que importa: la primera version lo
 * exigia y marcaba **45** artefactos en vez de 42 — los tres extra eran de julio, con
 * `problem_class` e `instance` completos y perfectamente encontrables. Les falta `outcome`
 * porque **no son comparaciones**: un grafo anotado, una iteracion de meta-aprendizaje, una
 * auditoria de conjunto escalado. Exigirles un veredicto que no les corresponde es retener
 * trabajo bueno, que es peor que dejar pasar un caso.
 *
 * El numero correcto es 42, y calza exacto con lo que mide la API por otro camino. **Dos
 * mediciones independientes que coinciden valen algo solo cuando no comparten la premisa** —
 * aqui una lee el artefacto y la otra el endpoint, asi que la coincidencia dice algo.
 */
export const CAMPOS_DESEABLES = ["outcome", "recipe_id", "quantum_side", "classical_side"];

/** Lee `w6.que` sin reventar si falta un tramo. */
export function queDe(artefacto) {
  const w6 = artefacto?.w6;
  const que = w6 && typeof w6 === "object" && !Array.isArray(w6) ? w6.que : undefined;
  return que && typeof que === "object" && !Array.isArray(que) ? que : null;
}

const vacio = (v) => v === undefined || v === null || v === "" ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0);

/**
 * ¿Se puede encontrar esta corrida en el archivo?
 *
 * @param {{artefacto:object, obligatorios?:string[], deseables?:string[]}} ctx
 */
export function evaluar({ artefacto, obligatorios = CAMPOS_CONSULTABLES, deseables = CAMPOS_DESEABLES }) {
  const que = queDe(artefacto);
  if (!que) return { estado: "sin_w6que", motivo: "el artefacto no trae w6.que: no hay donde buscar los campos" };

  const faltan = obligatorios.filter((c) => vacio(que[c]));
  const sinDeseables = deseables.filter((c) => vacio(que[c]));
  const narrativos = Object.keys(que).filter((k) => !obligatorios.includes(k) && !deseables.includes(k));

  if (faltan.length) {
    return { estado: "no_consultable", motivo: `faltan ${faltan.length} campo(s) por los que la API busca`, faltan, sinDeseables, narrativos: narrativos.length };
  }
  return { estado: "ok", sinDeseables, narrativos: narrativos.length };
}

// ── self-test ────────────────────────────────────────────────────────────────────────────
const _esPrincipal = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (_esPrincipal && process.argv.includes("--self-test")) {
  // Los dos casos REALES, con la forma exacta que tienen los archivos (§2).
  const JULIO = { w6: { que: { recipe_id: "r1", problem_class: "MaxCut", instance: "3-regular n=64", outcome: "classical wins", quantum_side: "QAOA p=3", classical_side: "GW" } } };
  const AGOSTO = { w6: { que: { artefacto: "eon_case118.json", VEREDICTO: "empate", cruce_ventaja_cuantica: "no", censo_de_la_red: "118 barras" } } };

  const casos = [
    // ── grita ──
    ["grita: el caso real de agosto — narrativa rica y cero campos consultables", () =>
      evaluar({ artefacto: AGOSTO }).estado === "no_consultable"],

    ["grita: dice CUALES faltan, no solo que faltan", () => {
      const r = evaluar({ artefacto: AGOSTO });
      return r.faltan.includes("problem_class") && r.faltan.includes("instance");
    }],

    ["grita distinto: sin w6.que no es 'faltan campos', es que no hay donde buscarlos", () =>
      evaluar({ artefacto: { w6: {} } }).estado === "sin_w6que"],

    ["grita: un solo campo vacio basta", () =>
      evaluar({ artefacto: { w6: { que: { problem_class: "MaxCut", instance: "", outcome: "x" } } } }).estado === "no_consultable"],

    // ── calla ──
    ["CALLA: el caso real de julio", () => evaluar({ artefacto: JULIO }).estado === "ok"],

    // LA CONDICION QUE PEDIA EL ARCHIVO: la narrativa se conserva, no se sacrifica.
    ["CALLA: campos canonicos MAS narrativa rica encima", () => {
      const mixto = { w6: { que: { ...JULIO.w6.que, ...AGOSTO.w6.que, problem_class: "MaxCut", instance: "n=64", outcome: "empate" } } };
      const r = evaluar({ artefacto: mixto });
      return r.estado === "ok" && r.narrativos >= 3;
    }],

    ["CALLA: faltan deseables pero estan los obligatorios — se reporta, no bloquea", () => {
      const r = evaluar({ artefacto: { w6: { que: { problem_class: "a", instance: "b", outcome: "c" } } } });
      return r.estado === "ok" && r.sinDeseables.length === 3;
    }],

    ["CALLA: un valor pobre pero presente pasa — juzgar el contenido es de una persona", () =>
      evaluar({ artefacto: { w6: { que: { problem_class: "cosas", instance: "x", outcome: "y" } } } }).estado === "ok"],

    // ── bordes de 'vacio' ──
    ["cero y false NO son vacio", () =>
      evaluar({ artefacto: { w6: { que: { problem_class: 0, instance: false, outcome: "x" } } } }).estado === "ok"],

    ["lista vacia y objeto vacio SI son vacio", () =>
      evaluar({ artefacto: { w6: { que: { problem_class: [], instance: {}, outcome: "x" } } } }).faltan.length === 2],

    // ── una sola definicion ──
    ["la lista de campos es una constante exportada, no una copia local", () =>
      Array.isArray(CAMPOS_CONSULTABLES) && CAMPOS_CONSULTABLES.includes("problem_class")],

    // ── mutacion ──
    ["MUTACION: si solo se exigiera 'outcome', agosto pasaria — y agosto lo tiene al 69%", () => {
      const soloOutcome = evaluar({ artefacto: { w6: { que: { outcome: "empate", VEREDICTO: "x" } } }, obligatorios: ["outcome"] });
      const completo = evaluar({ artefacto: { w6: { que: { outcome: "empate", VEREDICTO: "x" } } } });
      return soloOutcome.estado === "ok" && completo.estado === "no_consultable";
    }],

    // EL FALSO POSITIVO REAL que produjo la primera version: tres de julio, encontrables, sin
    // veredicto porque no son comparaciones. Salio del archivo, no de la imaginacion.
    ["CALLA: encontrable pero sin veredicto — un grafo anotado no adjudica nada", () =>
      evaluar({ artefacto: { w6: { que: {
        problem_class: "Prediccion de sitios alostericos", instance: "KRAS G12C, BCR-ABL1",
      } } } }).estado === "ok"],
  ];

  let fallos = 0;
  for (const [nombre, fn] of casos) {
    let paso; try { paso = fn(); } catch { paso = false; }
    console.log(`${paso ? "ok   " : "FALLA"}  ${nombre}`);
    if (!paso) fallos++;
  }
  console.log(`\n[consultable] self-test: ${casos.length - fallos} de ${casos.length} pasaron.`);
  process.exit(fallos ? 1 : 0);
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────
if (_esPrincipal && !process.argv.includes("--self-test")) {
  const iAud = process.argv.indexOf("--auditar");

  if (iAud >= 0) {
    // Modo auditoria: recorre y REPORTA. No bloquea — lo publicado no se re-sella.
    const raiz = process.argv[iAud + 1];
    if (!raiz || !existsSync(raiz)) {
      console.error(`[consultable] NO SE PUDO COMPROBAR: falta el directorio (${raiz ?? "sin argumento"}).`);
      process.exit(2);
    }
    const filas = [];
    (function rec(d) {
      for (const e of readdirSync(d)) {
        const p = join(d, e);
        if (statSync(p).isDirectory()) rec(p);
        else if (e.endsWith(".json")) {
          try {
            const a = JSON.parse(readFileSync(p, "utf8"));
            if (a && typeof a === "object" && !Array.isArray(a) && queDe(a)) filas.push([p, evaluar({ artefacto: a })]);
          } catch { /* JSON ilegible: asunto de otro guardia */ }
        }
      }
    })(raiz);

    const mal = filas.filter(([, r]) => r.estado !== "ok");
    console.log(`[consultable] auditoria · ${filas.length} artefactos con w6.que · ${filas.length - mal.length} consultables · ${mal.length} no`);
    for (const [p, r] of mal.slice(0, 10)) console.log(`   ${r.estado.padEnd(16)} ${basename(p).slice(0, 58)}`);
    if (mal.length > 10) console.log(`   … y ${mal.length - 10} mas`);
    console.log("\n[consultable] modo auditoria: informa y no detiene. Lo publicado no se re-sella.");
    process.exit(0);
  }

  const archivo = process.argv[2];
  if (!archivo || !existsSync(archivo)) {
    console.error(`[consultable] NO SE PUDO COMPROBAR: falta el artefacto (${archivo ?? "sin argumento"}).`);
    process.exit(2);
  }
  let artefacto;
  try { artefacto = JSON.parse(readFileSync(archivo, "utf8")); }
  catch (e) { console.error(`[consultable] NO SE PUDO COMPROBAR: JSON ilegible. ${String(e).split("\n")[0]}`); process.exit(2); }

  const r = evaluar({ artefacto });
  console.log(`[consultable] ${basename(archivo)}`);

  if (r.estado === "ok") {
    if (r.sinDeseables.length) console.log(`   sin (no bloquea): ${r.sinDeseables.join(", ")}`);
    console.log(`   ${r.narrativos} campo(s) narrativos ademas de los canonicos. Consultable.`);
  } else {
    console.error(`\n[consultable] BLOQUEADO: ${r.motivo}`);
    if (r.faltan) for (const c of r.faltan) console.error(`    falta: ${c}`);
    if (r.narrativos) console.error(`    (trae ${r.narrativos} campos narrativos — el contenido esta, pero no se puede encontrar)`);
    console.error("[consultable] La narrativa va ADEMAS de los campos canonicos, no en vez de ellos.");
    console.error("[consultable] Un artefacto que no se puede consultar no cumple su unica funcion.");
    process.exit(1);
  }
}
