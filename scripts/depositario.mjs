#!/usr/bin/env node
/**
 * El Depositario: lo unico que estampa una hora, y lo que sostiene la factura.
 *
 * POR QUE EXISTE (medido el 2026-08-26 sobre el archivo real). Hoy la fecha de un artefacto
 * la escribe quien lo genera:
 *
 *     archived_at   92 presentes · 19 copiadas del nombre del archivo
 *     sealed_at     52 presentes · 22 copiadas
 *     lo que deposita el CI      55 artefactos · 0 con ningun campo de tiempo
 *
 * Y los 41 campos contaminados caen **todos** en hora o media hora exacta —34 en `:00`, 7 en
 * `:30`, ninguno en un minuto arbitrario—. Eso invirtio la causa que suponiamos: **nadie copia
 * el nombre al campo. Una persona declara una hora redonda y de ese mismo valor salen el
 * nombre Y el campo.** Hay un origen comun, y el origen es alguien redondeando.
 *
 * Con precio por consumo eso deja de ser higiene: **es la base del cobro**, y un cliente que
 * dispute encontraria que la marca de tiempo se la puso el mismo proceso que le esta cobrando.
 *
 * LOS TRES RELOJES, y cual sostiene que.
 *
 *     duraciones por fase   las escribe el ejecutor    nadie mas ve sus fases   falseable, y no importa
 *     hora de deposito      LA ESCRIBE ESTE MODULO     operar y facturar        falseable por nosotros
 *     ancla                 nadie de esta casa         que el registro es anterior al bloque
 *
 * **El ancla NO sostiene la factura**, y esto se corrigio despues de escribirlo mal: un ancla
 * acota por ARRIBA —el dato existia antes del bloque— y un dato viejo se ancla cuando sea.
 * Sirve contra retrodatar. **El riesgo de un cobro por consumo es el contrario: inflar.** Asi
 * que el peso cae aqui, y por eso este modulo falla cerrado en todo lo que puede.
 *
 * LA DEFENSA DE CONSTRUCCION, mas barata que cualquier guardia: **estampa con precision de
 * subsegundo.** Nadie escribe `.537065` a mano, asi que una hora declarada por una persona
 * queda visible sola. Es mejor hacer el defecto imposible de esconder que perseguirlo.
 *
 * LO QUE ESTE MODULO NO PUEDE, declarado: **no prueba que el trabajo ocurrio.** Los tres
 * relojes contestan «cuando»; ninguno contesta «si». Un deposito que declara cuarenta corridas
 * es indistinguible de uno que declara cuarenta y corrio treinta y ocho. El tercero que si
 * puede probarlo no es Bitcoin: es **quien nos vende el computo** —la nube mide lo que
 * consumimos, el proveedor de QPU emite identificador por trabajo—. Contrastar contra eso es
 * el paso siguiente y no esta construido.
 *
 * Uso:
 *   node scripts/depositario.mjs --self-test
 *   node scripts/depositario.mjs <artefacto.json> --consumo <consumo.json>
 */
import { readFileSync, existsSync } from "node:fs";

/** Quien actua esta senal, y que hace al recibirla. Declarado aqui, no en un documento aparte. */
export const CONSUMIDOR = {
  quien: "quien opera el ejecutor que envio el deposito",
  hace: "corrige lo que el rechazo nombra y reenvia; el deposito es idempotente por clave",
};

/** Codigos de rechazo. Un cliente los lee en la respuesta, asi que son parte del contrato. */
export const RECHAZOS = {
  SIN_CONSUMO: "no trae consumo medido: un cero ausente no es un cero medido",
  CONSUMO_INCOMPLETO: "el consumo no declara todos los campos que se facturan",
  SIN_COMPILE_SHA: "sin compile_sha no se puede saber si esta corrida es comparable con otra",
  RELOJ_PROVISTO_POR_EL_GENERADOR: "el artefacto ya trae hora de deposito: la pone quien recibe",
  DURACION_IMPOSIBLE: "la duracion declarada no cabe entre inicio y fin",
};

/** Lo que se factura. Un campo ausente NO se completa con cero: se rechaza. */
export const CAMPOS_CONSUMO = ["cpu_s", "costo_proveedor"];

/** Lee un camino exacto. **Nunca por parecido** — un artefacto lleva adentro campos de otros
 * objetos que cita, y buscar «algo con forma de fecha» le atribuye la hora de un objeto ajeno. */
export function cavar(obj, ...ruta) {
  let cur = obj;
  for (const k of ruta) {
    if (!cur || typeof cur !== "object" || Array.isArray(cur)) return undefined;
    cur = cur[k];
  }
  return cur;
}

const ausente = (v) => v === undefined || v === null || v === "";

/**
 * Estampa una hora con subsegundo, en UTC, del reloj de quien recibe.
 * Se inyecta `ahora` para poder probarlo; en produccion es el reloj real.
 */
export function estampar(ahora = Date.now()) {
  return new Date(ahora).toISOString(); // ya trae milisegundos: 2026-08-27T00:12:34.567Z
}

/** ¿Tiene subsegundo? Es la propiedad que hace visible una hora escrita a mano. */
export function tieneSubsegundo(iso) {
  return typeof iso === "string" && /T\d{2}:\d{2}:\d{2}\.\d+/.test(iso);
}

/**
 * Recibe un resultado y lo convierte en un deposito, o lo rechaza diciendo por que.
 *
 * @param {{artefacto:object, consumo:object, ahora?:number}} ctx
 * @returns {{estado:"depositado", deposito:object} | {estado:"rechazado", codigo:string, motivo:string}}
 */
export function depositar({ artefacto, consumo, ahora = Date.now() }) {
  const no = (codigo) => ({ estado: "rechazado", codigo, motivo: RECHAZOS[codigo] });

  // 1) El generador NO pone la hora. Si ya viene, es exactamente el defecto que existimos
  //    para impedir — y no se sobreescribe en silencio: se rechaza y se dice.
  if (!ausente(cavar(artefacto, "deposito", "recibido_at"))) return no("RELOJ_PROVISTO_POR_EL_GENERADOR");

  // 2) Sin consumo no se deposita. Un cero medido y un cero ausente no son el mismo cero:
  //    el primero es una corrida gratis, el segundo es no haber mirado.
  if (!consumo || typeof consumo !== "object" || Array.isArray(consumo)) return no("SIN_CONSUMO");
  const faltan = CAMPOS_CONSUMO.filter((c) => ausente(consumo[c]));
  if (faltan.length === CAMPOS_CONSUMO.length) return no("SIN_CONSUMO");
  if (faltan.length) return { ...no("CONSUMO_INCOMPLETO"), faltan };

  // 3) Sin compile_sha, dos corridas no son comparables y nadie se entera al restarlas.
  const compile_sha = cavar(artefacto, "w6", "como", "compile_sha") ?? cavar(artefacto, "compile_sha");
  if (ausente(compile_sha)) return no("SIN_COMPILE_SHA");

  // 4) Las duraciones las declara el ejecutor —es el unico que ve sus fases— pero tienen que
  //    ser coherentes entre si. No comprueba que el trabajo ocurriera: comprueba que lo
  //    declarado no sea imposible, que es lo unico que se puede desde aqui.
  const fases = consumo.fases_ms && typeof consumo.fases_ms === "object" ? consumo.fases_ms : null;
  if (fases) {
    const suma = Object.values(fases).reduce((a, b) => a + (Number(b) || 0), 0);
    const total = Number(consumo.cpu_s) * 1000;
    if (Number.isFinite(total) && suma > total * 1.001) return { ...no("DURACION_IMPOSIBLE"), suma_ms: suma, cpu_ms: total };
  }

  const recibido_at = estampar(ahora);

  return {
    estado: "depositado",
    deposito: {
      recibido_at,                       // el unico campo que pone este modulo
      lo_pone: "el depositario, al recibir",
      alcance: "instante en que este proceso recibio el resultado; no es cuando corrio",
      compile_sha,
      consumo: { ...consumo, alcance: consumo.alcance ?? "declarado por el ejecutor sobre su propio trabajo" },
      // Declarado y no implicito: sin esto un lector supone que el ancla respalda el cobro.
      que_NO_prueba: "que el trabajo ocurrio. Eso lo contrasta el registro del proveedor de computo, no este campo ni el ancla.",
    },
  };
}

// ── self-test ────────────────────────────────────────────────────────────────────────────
const _esPrincipal = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (_esPrincipal && process.argv.includes("--self-test")) {
  const AHORA = Date.parse("2026-08-27T00:12:34.567Z");
  const ART = { w6: { como: { compile_sha: "a71f3e" } } };
  const CON = { cpu_s: 45.943, costo_proveedor: 0.0005 };

  const casos = [
    // ── deposita ──
    ["CALLA: artefacto y consumo completos", () =>
      depositar({ artefacto: ART, consumo: CON, ahora: AHORA }).estado === "depositado"],

    ["la hora la pone ESTE modulo, no el artefacto", () =>
      depositar({ artefacto: ART, consumo: CON, ahora: AHORA }).deposito.recibido_at === "2026-08-27T00:12:34.567Z"],

    // LA DEFENSA DE CONSTRUCCION: con subsegundo, una hora escrita a mano se ve sola.
    ["estampa con subsegundo — nadie escribe .567 a mano", () =>
      tieneSubsegundo(depositar({ artefacto: ART, consumo: CON, ahora: AHORA }).deposito.recibido_at)],

    ["el consumo viaja DENTRO del deposito, no en una tabla aparte", () =>
      depositar({ artefacto: ART, consumo: CON, ahora: AHORA }).deposito.consumo.cpu_s === 45.943],

    ["declara lo que NO prueba, en vez de dejarlo implicito", () =>
      /no prueba|que_NO_prueba/.test(JSON.stringify(depositar({ artefacto: ART, consumo: CON, ahora: AHORA }).deposito))],

    // ── rechaza ──
    // EL DEFECTO REAL: el generador poniendo la hora. Es por lo que existe este modulo.
    ["grita: el artefacto ya trae hora de deposito", () =>
      depositar({ artefacto: { ...ART, deposito: { recibido_at: "2026-08-21T20:00:00Z" } }, consumo: CON, ahora: AHORA })
        .codigo === "RELOJ_PROVISTO_POR_EL_GENERADOR"],

    ["grita: sin consumo no se deposita", () =>
      depositar({ artefacto: ART, consumo: null, ahora: AHORA }).codigo === "SIN_CONSUMO"],

    ["grita: consumo a medias es distinto de consumo ausente", () => {
      const r = depositar({ artefacto: ART, consumo: { cpu_s: 45.9 }, ahora: AHORA });
      return r.codigo === "CONSUMO_INCOMPLETO" && r.faltan[0] === "costo_proveedor";
    }],

    ["grita: sin compile_sha, dos corridas no son comparables", () =>
      depositar({ artefacto: {}, consumo: CON, ahora: AHORA }).codigo === "SIN_COMPILE_SHA"],

    ["grita: las fases suman mas de lo que dice el total", () =>
      depositar({ artefacto: ART, consumo: { ...CON, cpu_s: 1, fases_ms: { a: 900, b: 900 } }, ahora: AHORA })
        .codigo === "DURACION_IMPOSIBLE"],

    // ── el borde que mas se confunde ──
    // Un cero MEDIDO es una corrida gratis y es legitimo. Un cero AUSENTE es no haber mirado.
    ["CALLA: un cero MEDIDO se deposita — es distinto de un cero ausente", () =>
      depositar({ artefacto: ART, consumo: { cpu_s: 0, costo_proveedor: 0 }, ahora: AHORA }).estado === "depositado"],

    ["CALLA: fases que suman justo el total", () =>
      depositar({ artefacto: ART, consumo: { ...CON, cpu_s: 2, fases_ms: { a: 1000, b: 1000 } }, ahora: AHORA })
        .estado === "depositado"],

    // ── lee por ruta, no por parecido ──
    ["CALLA: un compile_sha de OTRO objeto citado adentro no se toma como propio", () =>
      depositar({ artefacto: { w6: { como: { procedencia: [{ compile_sha: "ajeno" }] } } }, consumo: CON, ahora: AHORA })
        .codigo === "SIN_COMPILE_SHA"],

    // ── mutacion ──
    ["MUTACION: sin subsegundo, una hora redonda escrita a mano seria indistinguible", () =>
      tieneSubsegundo("2026-08-27T00:12:34.567Z") === true && tieneSubsegundo("2026-08-21T20:00:00Z") === false],
  ];

  let fallos = 0;
  for (const [nombre, fn] of casos) {
    let paso; try { paso = fn(); } catch { paso = false; }
    console.log(`${paso ? "ok   " : "FALLA"}  ${nombre}`);
    if (!paso) fallos++;
  }
  console.log(`\n[depositario] self-test: ${casos.length - fallos} de ${casos.length} pasaron.`);
  process.exit(fallos ? 1 : 0);
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────
if (_esPrincipal && !process.argv.includes("--self-test")) {
  const art = process.argv[2];
  const iCon = process.argv.indexOf("--consumo");
  const con = iCon >= 0 ? process.argv[iCon + 1] : null;

  if (!art || !existsSync(art)) { console.error(`[depositario] NO SE PUDO: falta el artefacto (${art ?? "sin argumento"}).`); process.exit(2); }
  if (!con || !existsSync(con)) { console.error("[depositario] NO SE PUDO: falta --consumo <archivo.json>."); process.exit(2); }

  let artefacto, consumo;
  try { artefacto = JSON.parse(readFileSync(art, "utf8")); consumo = JSON.parse(readFileSync(con, "utf8")); }
  catch (e) { console.error(`[depositario] NO SE PUDO: JSON ilegible. ${String(e).split("\n")[0]}`); process.exit(2); }

  const r = depositar({ artefacto, consumo });
  if (r.estado === "rechazado") {
    console.error(`[depositario] RECHAZADO ${r.codigo}: ${r.motivo}`);
    if (r.faltan) console.error(`    faltan: ${r.faltan.join(", ")}`);
    process.exit(1);
  }
  process.stdout.write(JSON.stringify(r.deposito, null, 2) + "\n");
  console.error(`[depositario] depositado · ${r.deposito.recibido_at} · compile_sha ${String(r.deposito.compile_sha).slice(0, 12)}`);
}
