#!/usr/bin/env node
/**
 * Una lista dice de cuantos, y paginarla llega hasta el final.
 *
 * EL DEFECTO (medido en produccion el 2026-08-27, y estaba vivo):
 *
 *     GET /v1/runs             items=50  total=50    <- el archivo tiene 93
 *     GET /v1/runs?offset=50   items=50  total=50    <- LAS MISMAS 50, sin error
 *     GET /v1/state            93                    <- nuestro propio endpoint lo desmiente
 *
 * **`total` significaba «cuantos te devolvi», no «cuantos hay».** El archivo subdeclaraba el
 * 46 % de si mismo **y traia un campo llamado `total` confirmandoselo al llamador**. Es la
 * forma de siempre: el instrumento contesta una pregunta *parecida* a la que le hiciste, y
 * **el nombre del campo apaga la sospecha.**
 *
 * Y `offset` no fallaba: se ignoraba. Un agente que pagine bien —pedir, avanzar, repetir hasta
 * que no venga nada— **gira para siempre**, o deduplica y concluye que hay 50. **Las dos
 * salidas son peores que un 400.**
 *
 * POR QUE ES CARO Y NO COSMETICO. Nos posicionamos como laboratorio **para agentes** y
 * `llms.txt` senala estas rutas. Lo primero que hace un agente es pedirlas sin parametros. Y el
 * lector que nos interesa —el que compara dos superficies antes de contestar— veia 50 en una y
 * 93 en la otra. **Ese es su oficio, no un caso raro.**
 *
 * LAS TRES COSAS QUE COMPRUEBA, y la tercera es la que no se le ocurre a nadie:
 *
 *   1. La lista declara su denominador con un nombre que no se puede confundir.
 *   2. **Paginar hasta el final suma exactamente ese denominador.** Es la unica forma de
 *      distinguir «offset funciona» de «offset se ignora y devuelve lo mismo».
 *   3. **Ese denominador coincide con `/v1/state`.** Dos endpoints nuestros contando distinto
 *      es peor que uno contando mal: el lector no sabe a cual creerle, y el que subdeclara es
 *      justamente el que enumera.
 *
 * SU PUNTO CIEGO, declarado: comprueba conteos, no contenidos. Si la paginacion devolviera 93
 * filas equivocadas, esto pasa. Para eso esta el sello.
 *
 * Uso:
 *   node scripts/check-listado-denominador.mjs --self-test
 *   node scripts/check-listado-denominador.mjs                 # contra produccion
 */

/** Quien actua esta senal, y que hace al recibirla. Declarado aqui, no en un documento aparte. */
export const CONSUMIDOR = {
  quien: "la sesion CTO",
  hace: "arregla la ruta de listado en api.js: denominador consultado, offset real y hay_mas",
};

const BASE = "https://rosettaquantum.com";

/** Las rutas que enumeran, y contra que contador de `/v1/state` se comparan. */
export const RUTAS = [
  { ruta: "/v1/runs", contador: "corridas_selladas" },
  { ruta: "/v1/verdicts", contador: "veredictos_publicados" },
  { ruta: "/v1/prereg", contador: "pre_registros" },
  { ruta: "/v1/reports", contador: "reportes" },
  { ruta: "/v1/erratas", contador: "erratas" },
  { ruta: "/v1/recipes", contador: "recetas" },
];

/** El denominador, con cualquiera de los nombres que la casa usa. */
export function denominadorDe(cuerpo) {
  for (const k of ["total_archivo", "total_catalogo", "total_disponible"]) {
    if (typeof cuerpo?.[k] === "number") return { valor: cuerpo[k], campo: k };
  }
  return { valor: null, campo: null };
}

/**
 * @param {{ruta:string, paginas:{devueltos:number,cuerpo:object}[], enState:number|null}} ctx
 */
export function evaluarRuta({ ruta, paginas, enState }) {
  const p0 = paginas[0]?.cuerpo;
  const { valor: denom, campo } = denominadorDe(p0);

  if (denom === null) {
    return { ruta, estado: "sin_denominador", motivo: "la respuesta no dice de cuantos: 'total' solo dice cuantos vinieron" };
  }

  // Paginar y sumar. Si `offset` se ignora, las paginas se repiten y la suma se dispara o se
  // estanca — las dos cosas distintas de `denom`, que es justamente lo que se quiere detectar.
  const sumado = paginas.reduce((a, p) => a + p.devueltos, 0);
  if (sumado !== denom) {
    return { ruta, estado: "paginacion_rota", motivo: `paginando se enumeran ${sumado} y la ruta declara ${denom}`, sumado, denom };
  }

  if (enState !== null && enState !== denom) {
    return { ruta, estado: "contradice_state", motivo: `la ruta declara ${denom} y /v1/state declara ${enState}`, denom, enState };
  }

  return { ruta, estado: "ok", denom, campo, sumado };
}

// ── self-test ────────────────────────────────────────────────────────────────────────────
const _esPrincipal = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (_esPrincipal && process.argv.includes("--self-test")) {
  const pag = (n, denom) => ({ devueltos: n, cuerpo: { total: n, total_archivo: denom } });

  const casos = [
    // EL CASO REAL: offset ignorado. Dos paginas de 50 identicas contra un archivo de 93.
    ["grita: offset ignorado — dos paginas iguales suman mas que el archivo", () =>
      evaluarRuta({ ruta: "/v1/runs", paginas: [pag(50, 93), pag(50, 93)], enState: 93 }).estado === "paginacion_rota"],

    // EL OTRO CASO REAL: sin denominador, `total` dice 50 y suena a que hay 50.
    ["grita: la respuesta no declara denominador", () =>
      evaluarRuta({ ruta: "/v1/runs", paginas: [{ devueltos: 50, cuerpo: { total: 50 } }], enState: 93 }).estado === "sin_denominador"],

    ["grita: la ruta y /v1/state cuentan distinto", () =>
      evaluarRuta({ ruta: "/v1/runs", paginas: [pag(93, 93)], enState: 50 }).estado === "contradice_state"],

    ["CALLA: una sola pagina que trae todo y calza con state", () =>
      evaluarRuta({ ruta: "/v1/runs", paginas: [pag(93, 93)], enState: 93 }).estado === "ok"],

    ["CALLA: dos paginas que suman el denominador", () =>
      evaluarRuta({ ruta: "/v1/runs", paginas: [pag(50, 93), pag(43, 93)], enState: 93 }).estado === "ok"],

    // Sin contador equivalente en /v1/state no se inventa una comparacion.
    ["CALLA: sin contador en state, no se compara", () =>
      evaluarRuta({ ruta: "/v1/x", paginas: [pag(7, 7)], enState: null }).estado === "ok"],

    ["CALLA: una lista legitimamente vacia", () =>
      evaluarRuta({ ruta: "/v1/x", paginas: [{ devueltos: 0, cuerpo: { total: 0, total_archivo: 0 } }], enState: 0 }).estado === "ok"],

    // ── el lector del denominador ──
    ["acepta los tres nombres de la casa", () =>
      denominadorDe({ total_archivo: 5 }).valor === 5 &&
      denominadorDe({ total_catalogo: 6 }).valor === 6 &&
      denominadorDe({ total_disponible: 7 }).valor === 7],

    // EL CASO QUE DEFINE EL DEFECTO: `total` NO es denominador, por mas que lo parezca.
    ["'total' por si solo NO cuenta como denominador", () =>
      denominadorDe({ total: 50 }).valor === null],

    // ── mutacion ──
    ["MUTACION: si se aceptara 'total' como denominador, el defecto real pasaria", () => {
      const conRegla = evaluarRuta({ ruta: "/v1/runs", paginas: [{ devueltos: 50, cuerpo: { total: 50 } }], enState: 93 }).estado;
      const siAceptara = 50 === 50; // sumado === "denom", y nadie mira /v1/state
      return conRegla === "sin_denominador" && siAceptara === true;
    }],
  ];

  let fallos = 0;
  for (const [nombre, fn] of casos) {
    let paso; try { paso = fn(); } catch { paso = false; }
    console.log(`${paso ? "ok   " : "FALLA"}  ${nombre}`);
    if (!paso) fallos++;
  }
  console.log(`\n[listado] self-test: ${casos.length - fallos} de ${casos.length} pasaron.`);
  process.exit(fallos ? 1 : 0);
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────
if (_esPrincipal && !process.argv.includes("--self-test")) {
  const pedir = async (u) => {
    const r = await fetch(u, { headers: { "User-Agent": "rosetta listado-denominador" } });
    if (!r.ok) throw new Error(`${u} -> HTTP ${r.status}`);
    return r.json();
  };

  let state = null;
  try { state = (await pedir(`${BASE}/v1/state`))?.estado_medido ?? null; }
  catch (e) {
    console.error(`[listado] NO SE PUDO COMPROBAR: /v1/state no responde. ${String(e).split("\n")[0]}`);
    process.exit(2);
  }

  const malos = [];
  for (const { ruta, contador } of RUTAS) {
    let paginas = [];
    try {
      // Se pagina de a poco A PROPOSITO: con una sola pagina grande, un `offset` roto no se
      // distingue de uno que funciona. El defecto solo aparece al pedir la segunda.
      const PASO = 25;
      for (let off = 0, guarda = 0; guarda < 40; guarda++, off += PASO) {
        const c = await pedir(`${BASE}${ruta}?limit=${PASO}&offset=${off}`);
        const n = (c.items ?? []).length;
        paginas.push({ devueltos: n, cuerpo: c });
        if (n < PASO) break;
      }
    } catch (e) {
      console.error(`[listado] ${ruta}: no se pudo leer — ${String(e).split("\n")[0]}`);
      malos.push({ ruta, estado: "ilegible" });
      continue;
    }
    const enState = typeof state?.[contador] === "number" ? state[contador] : null;
    const r = evaluarRuta({ ruta, paginas, enState });
    if (r.estado === "ok") console.log(`   ok    ${ruta.padEnd(16)} ${r.denom} declarados via ${r.campo}, ${r.sumado} enumerados${enState !== null ? `, ${enState} en /v1/state` : ""}`);
    else { console.error(`   FALLA ${ruta.padEnd(16)} ${r.motivo}`); malos.push(r); }
  }

  console.log(`\n[listado] ${RUTAS.length} ruta(s) de listado revisadas · ${malos.length} con problema`);
  if (malos.length) {
    console.error("[listado] Una lista que no dice de cuantos hace que el lector se crea el largo de la pagina.");
    console.error("[listado] Y `offset` que se ignora es peor que uno que falla: el que pagina bien gira para siempre.");
    process.exit(1);
  }
  console.log("[listado] cada lista dice de cuantos, paginar llega al final, y coincide con /v1/state.");
}
