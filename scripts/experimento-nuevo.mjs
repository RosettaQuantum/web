#!/usr/bin/env node
/**
 * Arrancar un experimento bien formado, sin acordarse de nada.
 *
 * DE DONDE SALE. La sesion de laboratorio arranco un experimento el 2026-08-27 haciendo cuatro
 * cosas a mano y **fallo en las cuatro**:
 *
 *     crear el directorio       choco con el trabajo de otra sesion — su codigo empezo a
 *                              correr sobre archivos ajenos SIN AVISO
 *     escribir el pre-registro  lo escribio DESPUES de tener el diseno
 *     cronometrar las fases     no existia; lo construyo a mitad de camino
 *     sellar                    el sello acepto un artefacto sin campos consultables
 *
 * **Las dos ultimas ya estan arregladas en el laboratorio** —la instrumentacion por fases
 * existe y `seal()` aborta si faltan los campos canonicos—. **Este comando cubre las dos
 * primeras, que son las que quedaban sin dueno.**
 *
 * EL RIESGO DEL PRIMERO NO ES PERDER UN ARCHIVO, y por eso vale un comando y no un recordatorio:
 * dos sesiones sobre el mismo arbol producen **una confirmacion falsa** — dos «mediciones
 * independientes» que en realidad corrieron el mismo codigo. Es exactamente el defecto que nos
 * costo tres reconciliaciones hoy, pero con la premisa compartida por accidente en vez de por
 * razonamiento.
 *
 * EL SEGUNDO ES EL UNICO FRENO CONTRA EL TRABAJO CORRECTO SOBRE LA PREGUNTA EQUIVOCADA. Un
 * pre-registro escrito DESPUES de ver el diseno no compromete nada: describe lo que ya se
 * decidio. Escrito antes, fija el criterio sin saber el resultado. **La concurrencia empeora
 * esta familia — cuarenta corridas impecables que responden algo que nadie pregunto.**
 *
 * QUE NO HACE, declarado: no corre nada, no sella, no toca el archivo. **Prepara el terreno y
 * cierra la puerta.** Correr y sellar es del laboratorio, con sus herramientas.
 *
 * Uso:
 *   node scripts/experimento-nuevo.mjs --self-test
 *   node scripts/experimento-nuevo.mjs abrir  <id> --dueno <sesion>
 *   node scripts/experimento-nuevo.mjs listo  <id>      # comprueba que se puede correr
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

/** Quien actua esta senal, y que hace al recibirla. Declarado aqui, no en un documento aparte. */
export const CONSUMIDOR = {
  quien: "quien va a correr el experimento",
  hace: "llena el pre-registro antes de correr, o trabaja en el arbol que le corresponde",
};

/** Lo que un pre-registro tiene que responder ANTES de que exista un resultado. */
export const CAMPOS_PREREG = ["afirmacion", "criterio_de_exito", "criterio_de_fracaso", "rival", "guardia_propia"];

/** El molde. Cada campo lleva por que existe: un formulario sin razones se llena por llenar. */
export function plantilla({ id, dueno, fecha }) {
  return {
    id,
    dueno,
    abierto_at: fecha,
    firmado_at: null,
    _instrucciones: "Llena los cinco campos ANTES de correr. `experimento-nuevo listo` no deja seguir hasta que esten.",
    afirmacion: "",            // que se va a sostener si sale bien
    criterio_de_exito: "",     // que numero, sobre que conjunto, con que umbral
    criterio_de_fracaso: "",   // lo que mas cuesta escribir y lo unico que impide moverlo despues
    rival: "",                 // contra que se compara; sin esto el numero no compara con nada
    guardia_propia: "",        // el chequeo especifico del METODO. La espina se reusa; esto no,
                               // y es lo que atrapa los errores. Probado por mutacion.
    _por_que_antes: "Escrito despues de ver el diseno, un pre-registro describe lo ya decidido. Escrito antes, compromete.",
  };
}

/** ¿Esta listo para correr? */
export function evaluarPrereg({ prereg, campos = CAMPOS_PREREG }) {
  if (!prereg || typeof prereg !== "object") return { estado: "sin_prereg", motivo: "no hay pre-registro en el directorio" };
  const faltan = campos.filter((c) => {
    const v = prereg[c];
    return v === undefined || v === null || String(v).trim() === "";
  });
  if (faltan.length) return { estado: "incompleto", motivo: `faltan ${faltan.length} de ${campos.length} campos`, faltan };
  return { estado: "listo" };
}

/**
 * ¿Este arbol es de quien dice ser?
 *
 * Un actor por arbol se cumple por construccion o no se cumple. Comprobarlo con un archivo de
 * dueno es debil —cualquiera lo pisa— pero **convierte una colision silenciosa en una ruidosa**,
 * que es toda la diferencia: el fallo de hoy no aviso.
 */
export function evaluarDueno({ marcaEnDisco, dueno }) {
  if (!marcaEnDisco) return { estado: "sin_marca", motivo: "el directorio no declara dueno" };
  if (marcaEnDisco !== dueno) {
    return { estado: "ajeno", motivo: `el directorio es de "${marcaEnDisco}" y lo abre "${dueno}"`, deQuien: marcaEnDisco };
  }
  return { estado: "propio" };
}

// ── self-test ────────────────────────────────────────────────────────────────────────────
const _esPrincipal = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (_esPrincipal && process.argv.includes("--self-test")) {
  const lleno = Object.fromEntries(CAMPOS_PREREG.map((c) => [c, "algo"]));

  const casos = [
    // ── el pre-registro ──
    ["grita: el molde recien creado NO deja correr", () =>
      evaluarPrereg({ prereg: plantilla({ id: "x", dueno: "y", fecha: "z" }) }).estado === "incompleto"],

    ["grita: dice CUALES faltan, no solo cuantos", () => {
      const p = { ...lleno, criterio_de_fracaso: "" };
      return evaluarPrereg({ prereg: p }).faltan[0] === "criterio_de_fracaso";
    }],

    ["CALLA: los cinco llenos", () => evaluarPrereg({ prereg: lleno }).estado === "listo"],

    // El campo que mas cuesta y el unico que impide mover el poste despues de ver el resultado.
    ["grita: sin criterio de FRACASO no se puede correr", () =>
      evaluarPrereg({ prereg: { ...lleno, criterio_de_fracaso: "   " } }).estado === "incompleto"],

    // Lo de Lab: la guardia propia cuesta 0,5% del reloj y es la que atrapa los errores.
    ["grita: sin guardia propia del metodo tampoco", () =>
      evaluarPrereg({ prereg: { ...lleno, guardia_propia: "" } }).estado === "incompleto"],

    ["grita distinto: sin pre-registro es sin_prereg, no incompleto", () =>
      evaluarPrereg({ prereg: null }).estado === "sin_prereg"],

    // ── el dueno ──
    // EL FALLO REAL DE HOY: dos sesiones sobre el mismo arbol, sin aviso.
    ["grita: el directorio es de otra sesion", () => {
      const r = evaluarDueno({ marcaEnDisco: "Rosetta Q Main", dueno: "Rosetta Q Lab" });
      return r.estado === "ajeno" && r.deQuien === "Rosetta Q Main";
    }],

    ["CALLA: el directorio es de quien lo abre", () =>
      evaluarDueno({ marcaEnDisco: "Rosetta Q Lab", dueno: "Rosetta Q Lab" }).estado === "propio"],

    ["grita distinto: sin marca de dueno no es 'propio'", () =>
      evaluarDueno({ marcaEnDisco: null, dueno: "quien sea" }).estado === "sin_marca"],

    // ── el molde ──
    ["el molde trae los cinco campos y ninguno lleno", () => {
      const p = plantilla({ id: "a", dueno: "b", fecha: "c" });
      return CAMPOS_PREREG.every((c) => c in p) && CAMPOS_PREREG.every((c) => p[c] === "");
    }],

    ["el molde dice POR QUE va antes — un formulario sin razones se llena por llenar", () =>
      String(plantilla({ id: "a", dueno: "b", fecha: "c" })._por_que_antes).includes("compromete")],

    // ── mutacion ──
    ["MUTACION: sin exigir criterio_de_fracaso, el molde vacio pasaria a medias", () => {
      const soloExito = evaluarPrereg({ prereg: { ...lleno, criterio_de_fracaso: "" }, campos: ["afirmacion", "criterio_de_exito"] });
      const completo = evaluarPrereg({ prereg: { ...lleno, criterio_de_fracaso: "" } });
      return soloExito.estado === "listo" && completo.estado === "incompleto";
    }],
  ];

  let fallos = 0;
  for (const [nombre, fn] of casos) {
    let paso; try { paso = fn(); } catch { paso = false; }
    console.log(`${paso ? "ok   " : "FALLA"}  ${nombre}`);
    if (!paso) fallos++;
  }
  console.log(`\n[experimento] self-test: ${casos.length - fallos} de ${casos.length} pasaron.`);
  process.exit(fallos ? 1 : 0);
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────
if (_esPrincipal && !process.argv.includes("--self-test")) {
  const [, , cmd, id] = process.argv;
  const iD = process.argv.indexOf("--dueno");
  const dueno = iD >= 0 ? process.argv[iD + 1] : null;
  const RAIZ = "experimentos";

  if (!cmd || !id) {
    console.error("[experimento] uso: experimento-nuevo abrir <id> --dueno <sesion>  |  listo <id>");
    process.exit(2);
  }
  const dir = join(RAIZ, id);
  const fPrereg = join(dir, "prereg.json");
  const fDueno = join(dir, ".dueno");

  if (cmd === "abrir") {
    if (!dueno) { console.error("[experimento] falta --dueno. Un arbol sin dueno declarado es una colision esperando."); process.exit(2); }

    if (existsSync(dir)) {
      const marca = existsSync(fDueno) ? readFileSync(fDueno, "utf8").trim() : null;
      const r = evaluarDueno({ marcaEnDisco: marca, dueno });
      if (r.estado !== "propio") {
        console.error(`[experimento] BLOQUEADO: ${r.motivo}`);
        console.error("[experimento] Dos sesiones sobre el mismo arbol no pierden un archivo:");
        console.error("[experimento] producen una CONFIRMACION FALSA — dos mediciones que corrieron el mismo codigo.");
        process.exit(1);
      }
      console.log(`[experimento] ${dir} ya existe y es tuyo.`);
    } else {
      mkdirSync(dir, { recursive: true });
      writeFileSync(fDueno, dueno + "\n");
      writeFileSync(fPrereg, JSON.stringify(plantilla({ id, dueno, fecha: new Date().toISOString() }), null, 2) + "\n");
      console.log(`[experimento] abierto ${dir} · dueno "${dueno}"`);
    }
    console.log(`[experimento] llena ${fPrereg} — los cinco campos — y despues: experimento-nuevo listo ${id}`);
    process.exit(0);
  }

  if (cmd === "listo") {
    if (!existsSync(dir)) { console.error(`[experimento] no existe ${dir}. Abrelo primero.`); process.exit(2); }
    let prereg = null;
    try { prereg = JSON.parse(readFileSync(fPrereg, "utf8")); } catch { /* queda null */ }
    const r = evaluarPrereg({ prereg });
    if (r.estado !== "listo") {
      console.error(`[experimento] NO SE PUEDE CORRER: ${r.motivo}`);
      if (r.faltan) for (const c of r.faltan) console.error(`    falta: ${c}`);
      console.error("[experimento] Un pre-registro escrito DESPUES de ver el diseno describe lo ya decidido.");
      console.error("[experimento] Escrito antes, fija el criterio sin saber el resultado. Ese es todo el punto.");
      process.exit(1);
    }
    const p = { ...prereg, firmado_at: prereg.firmado_at ?? new Date().toISOString() };
    writeFileSync(fPrereg, JSON.stringify(p, null, 2) + "\n");
    console.log(`[experimento] ${id}: pre-registro completo y firmado ${p.firmado_at}. Se puede correr.`);
    process.exit(0);
  }

  console.error(`[experimento] comando desconocido: ${cmd}`);
  process.exit(2);
}
