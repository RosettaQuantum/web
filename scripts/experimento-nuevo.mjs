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
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { execSync } from "node:child_process";

/**
 * **Contra que epoca valida este modulo.** Declarado, no deducible del codigo.
 *
 * DE DONDE SALE ESTA DECLARACION, y costo una manana: el Depositario exigia `compile_sha` —un
 * campo real, especificado, que emite **el Compilador**— contra un archivo producido antes de
 * que el Compilador existiera. Rechazaba **93 de 93 corridas**, y la salida se leia como
 * «archivo sucio» y no como «guardia fuera de epoca».
 *
 * El barrido posterior cruzo TODOS los campos que exige cada modulo contra los 266 artefactos
 * del archivo y marco seis mas en cero. **Ninguno era un defecto** —son modulos de escritor,
 * que imponen vocabulario a lo nuevo— pero **eso no se podia saber leyendolos.** Un lector ve
 * «exige cinco campos, el archivo trae cero» y no puede distinguir un guardia roto de uno que
 * mira hacia adelante. Por eso se declara aqui en vez de deducirse.
 */
export const ALCANCE = {
  lado: "escritor",
  valida: "experimentos NUEVOS que este comando abre en experimentos/<id>/",
  no_valida: "el archivo publicado: ninguno de los 12 pre-registros sellados usa este vocabulario, y esta bien — el escritor impone el canonico, el lector tolera los historicos",
};

/** Quien actua esta senal, y que hace al recibirla. Declarado aqui, no en un documento aparte. */
export const CONSUMIDOR = {
  quien: "quien va a correr el experimento",
  hace: "llena el pre-registro antes de correr, o trabaja en el arbol que le corresponde",
};

/** Lo que un pre-registro tiene que responder ANTES de que exista un resultado. */
const SEP = String.fromCharCode(0);
export const CAMPOS_PREREG = ["afirmacion", "criterio_de_exito", "criterio_de_fracaso", "rival", "guardia_propia"];

/** El molde. Cada campo lleva por que existe: un formulario sin razones se llena por llenar. */
export function plantilla({ id, dueno, fecha }) {
  return {
    id,
    dueno,
    abierto_at: fecha,
    firmado_at: null,
    huella: null,             // sha256 de los cinco campos al firmar; sin esto el poste se mueve
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

/**
 * El compromiso, en una cadena. **Es lo que impide mover el poste despues de firmar.**
 *
 * Sin esto el pre-registro era teatro con marca de tiempo. La sesion de laboratorio lo estreno,
 * lleno los cinco campos, firmo, y **despues cambio el criterio de exito a «cualquier cosa que
 * salga la llamamos exito»** — y la herramienta volvio a decir «se puede correr», con el mismo
 * sello de tiempo y sin notar nada. Impedia correr sin UN criterio y no impedia **cambiarlo**,
 * que es el defecto entero.
 *
 * Los cinco van en orden fijo y separados por un byte nulo, que no aparece en texto: asi mover
 * contenido de un campo a otro tambien cambia la huella. Es el mecanismo del sellado del
 * archivo, aplicado a cinco cadenas.
 */
export function huella(prereg, campos = CAMPOS_PREREG) {
  const partes = campos.map((c) => String((prereg ?? {})[c] ?? "").trim());
  return createHash("sha256").update(partes.join(SEP)).digest("hex");
}

/** ¿El pre-registro sigue diciendo lo que decia al firmar? */
export function estadoDeFirma(prereg) {
  if (!prereg?.firmado_at || !prereg?.huella) return "sin_firmar";
  return huella(prereg) === prereg.huella ? "intacto" : "ALTERADO";
}

/** ¿Esta listo para correr? */
export function evaluarPrereg({ prereg, campos = CAMPOS_PREREG }) {
  if (!prereg || typeof prereg !== "object") return { estado: "sin_prereg", motivo: "no hay pre-registro en el directorio" };
  const faltan = campos.filter((c) => {
    const v = prereg[c];
    return v === undefined || v === null || String(v).trim() === "";
  });
  if (faltan.length) return { estado: "incompleto", motivo: `faltan ${faltan.length} de ${campos.length} campos`, faltan };

  // Firmado y despues editado. No es «incompleto»: el compromiso ya no es el que se firmo,
  // y eso es PEOR que no haber firmado, porque trae fecha y visto bueno.
  if (estadoDeFirma(prereg) === "ALTERADO") {
    return { estado: "alterado", motivo: `el pre-registro cambio despues de firmarse el ${prereg.firmado_at}` };
  }
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

    // EL ATAQUE REAL de la sesion de laboratorio, 2026-08-27: llenar, firmar, y despues cambiar
    // el criterio de exito a «cualquier cosa que salga la llamamos exito». La version anterior
    // volvia a decir «se puede correr» con el mismo sello y sin notar nada.
    ["grita: firmado y DESPUES editado — el poste se movio", () => {
      const firmado = { ...lleno, firmado_at: "2026-08-27T14:44:40Z", huella: huella(lleno) };
      const movido = { ...firmado, criterio_de_exito: "cualquier cosa que salga la llamamos exito" };
      return evaluarPrereg({ prereg: movido }).estado === "alterado";
    }],

    ["CALLA: firmado e intacto", () => {
      const firmado = { ...lleno, firmado_at: "2026-08-27T14:44:40Z", huella: huella(lleno) };
      return evaluarPrereg({ prereg: firmado }).estado === "listo";
    }],

    // Sin firmar todavia no es alterado: es el estado normal antes del primer `listo`.
    ["CALLA: completo y sin firmar aun", () =>
      estadoDeFirma(lleno) === "sin_firmar" && evaluarPrereg({ prereg: lleno }).estado === "listo"],

    // Mover texto de un campo a otro sin cambiar el total tambien tiene que delatarse.
    ["grita: mover contenido ENTRE campos cambia la huella", () => {
      const a = { ...lleno, afirmacion: "AB", criterio_de_exito: "" , criterio_de_fracaso: "x", rival: "y", guardia_propia: "z" };
      const b = { ...a, afirmacion: "A", criterio_de_exito: "B" };
      return huella(a) !== huella(b);
    }],

    // MUTACION: sin la huella, el ataque de arriba pasa. Es la razon de existir del campo.
    ["MUTACION: sin huella guardada, el pre-registro movido pasaria", () => {
      const movido = { ...lleno, criterio_de_exito: "lo que sea", firmado_at: "2026-08-27T14:44:40Z" };
      return estadoDeFirma(movido) === "sin_firmar" && evaluarPrereg({ prereg: movido }).estado === "listo";
    }],


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
      if (r.estado === "alterado") {
        console.error("[experimento] Mover el criterio despues de verlo es exactamente lo que un");
        console.error("[experimento] pre-registro existe para impedir. Abre uno nuevo y di por que.");
      }
      console.error("[experimento] Un pre-registro escrito DESPUES de ver el diseno describe lo ya decidido.");
      console.error("[experimento] Escrito antes, fija el criterio sin saber el resultado. Ese es todo el punto.");
      process.exit(1);
    }
    const yaFirmado = Boolean(prereg.firmado_at && prereg.huella);
    const p = yaFirmado ? prereg : { ...prereg, firmado_at: new Date().toISOString(), huella: huella(prereg) };
    if (!yaFirmado) writeFileSync(fPrereg, JSON.stringify(p, null, 2) + "\n");
    console.log(`[experimento] ${id}: firmado ${p.firmado_at} · huella ${p.huella.slice(0, 12)}. Se puede correr.`);
    console.log("[experimento] Desde aqui el compromiso esta cerrado: si cambia un campo, esto lo dice.");
    process.exit(0);
  }

  console.error(`[experimento] comando desconocido: ${cmd}`);
  process.exit(2);
}
