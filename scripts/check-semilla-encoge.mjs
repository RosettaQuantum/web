#!/usr/bin/env node
/**
 * Una semilla no encoge una tabla viva sin que alguien lo pida a proposito.
 *
 * EL DEFECTO (auditoria del 2026-08-24, superficie abierta hasta hoy). `db/quantum.seed.sql`
 * empieza con cuatro `DELETE FROM` **sin WHERE** y despues repuebla:
 *
 *     DELETE FROM quantum_algorithms;        -> luego inserta 74
 *     DELETE FROM quantum_sources;           -> luego inserta 40
 *     DELETE FROM quantum_algorithm_ledger;  -> luego inserta  3
 *     DELETE FROM quantum_catalog_meta;      -> luego inserta 15
 *
 * `db/motor.seed.sql` hace lo mismo con `propagations` y `structures`.
 *
 * El archivo lo produce un generador. **Si el generador produce de menos —un archivo de
 * entrada que falta, un filtro que cambio, un parseo que se rompio— la semilla borra lo que
 * hay y deja menos, sin conflicto, sin aviso y sin respaldo.** Y no es una tabla interna:
 * `/clases/` sirve esos 74 algoritmos en publico.
 *
 * Es la regla de los datos de salud aplicada al catalogo: **antes de borrar, comprueba que lo
 * que queda contiene lo que se va.** Si no lo contiene, decide una persona.
 *
 * LA TRAMPA QUE ESTE GUARDIA TIENE CERRADA, y es la que lo haria inutil. La cuenta de
 * «cuantas filas quedarian» sale del archivo; la de «cuantas hay» **tiene que salir de D1**.
 * Si D1 no responde y el guardia se conformara con el archivo, estaria comparandolo consigo
 * mismo y daria verde siempre. **Sin D1 la respuesta es «no se pudo comprobar», no «ok».**
 *
 * PRECISION SOBRE COBERTURA. Solo bloquea el ENCOGIMIENTO. Crecer o quedar igual pasa sin
 * ruido: un catalogo que suma algoritmos es el caso normal y retenerlo seria peor que dejar
 * pasar uno. Y un `DELETE` **con** `WHERE` no es un barrido —`challenges.seed.sql` borra solo
 * su propia corrida— asi que no cuenta.
 *
 * SU PUNTO CIEGO, declarado: cuenta filas, no contenido. Una semilla que reemplace los 74
 * algoritmos por otros 74 distintos pasa sin decir nada. Para eso hace falta comparar claves,
 * y hoy no lo hace.
 *
 * Uso:
 *   node scripts/check-semilla-encoge.mjs --self-test
 *   node scripts/check-semilla-encoge.mjs db/quantum.seed.sql
 *   node scripts/check-semilla-encoge.mjs db/quantum.seed.sql --encoger   # decision explicita
 */
/** Quien actua esta senal, y que hace al recibirla. Declarado aqui, no en un documento aparte. */
export const CONSUMIDOR = {
  quien: "sesion CTO",
  hace: "revisa el generador de la semilla antes de aplicarla; si el encogimiento es real, --encoger",
};

import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";

const DB = "rosettaq-ledger";

/** Quita comentarios SQL para no leer prosa como si fuera codigo (CLAUDE.md §4 bis). */
export function soloSql(sql) {
  return String(sql ?? "")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ");
}

/**
 * Lee una semilla y dice, por tabla, si la barre y cuantas filas le deja.
 *
 * @returns {Map<string,{barre:boolean, inserta:number}>}
 */
export function leerSemilla(sql) {
  const limpio = soloSql(sql);
  const tablas = new Map();
  const tocar = (t) => {
    if (!tablas.has(t)) tablas.set(t, { barre: false, inserta: 0 });
    return tablas.get(t);
  };

  // DELETE sin WHERE = barrido. Con WHERE es una operacion acotada y no cuenta.
  // La tabla se registra SIEMPRE, aunque el DELETE sea acotado: si solo se registrara al
  // barrer, preguntar por una tabla tocada-pero-no-barrida devolveria `undefined`, que quien
  // llama lee como «no la toca». Registrarla con `barre:false` dice lo que de verdad pasa.
  for (const m of limpio.matchAll(/\bDELETE\s+FROM\s+([A-Za-z_][\w]*)\s*([^;]*);/gi)) {
    const t = tocar(m[1]);
    if (!/\bWHERE\b/i.test(m[2])) t.barre = true;
  }
  // TRUNCATE siempre barre.
  for (const m of limpio.matchAll(/\bTRUNCATE\s+(?:TABLE\s+)?([A-Za-z_][\w]*)/gi)) {
    tocar(m[1]).barre = true;
  }
  // Un INSERT puede traer varias tuplas: `VALUES (..),(..),(..)`.
  for (const m of limpio.matchAll(/\bINSERT\s+(?:OR\s+\w+\s+)?INTO\s+([A-Za-z_][\w]*)\s*(?:\([^)]*\))?\s*VALUES\b([^;]*);/gi)) {
    tocar(m[1]).inserta += contarTuplas(m[2]);
  }
  return tablas;
}

/**
 * Cuenta `(...)` de primer nivel en un bloque VALUES.
 *
 * A mano y no con una expresion regular, porque los valores traen parentesis adentro
 * —`'CTQW (continuous-time)'`— y contar `(` daria de mas. Respeta comillas simples y su
 * escape SQL (`''`).
 */
export function contarTuplas(bloque) {
  let n = 0, prof = 0, comilla = false;
  const s = String(bloque ?? "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (comilla) {
      if (c === "'") { if (s[i + 1] === "'") i++; else comilla = false; }
      continue;
    }
    if (c === "'") comilla = true;
    else if (c === "(") { if (prof === 0) n++; prof++; }
    else if (c === ")") prof--;
  }
  return n;
}

/**
 * ¿Puede aplicarse esta semilla?
 *
 * @param {{semilla: Map, vivas: Map<string,number>|null, encoger: boolean}} ctx
 *   vivas: conteos reales de D1. **null significa que no se pudo consultar**, y eso NO es ok.
 */
export function evaluar({ semilla, vivas, encoger = false }) {
  if (!vivas) return { estado: "indeterminado", motivo: "no se pudo consultar D1: no hay contra que comparar" };

  const barren = [...semilla.entries()].filter(([, v]) => v.barre);
  const encogen = [];
  const sinDato = [];

  for (const [t, v] of barren) {
    const antes = vivas.get(t);
    if (antes === undefined) { sinDato.push(t); continue; }
    if (v.inserta < antes) encogen.push({ tabla: t, antes, despues: v.inserta, pierde: antes - v.inserta });
  }

  // Una tabla que la semilla barre y cuyo conteo vivo no se pudo leer es indeterminado, no ok:
  // es exactamente el caso en que borrar a ciegas hace el dano.
  if (sinDato.length) {
    return { estado: "indeterminado", motivo: `sin conteo vivo para: ${sinDato.join(", ")}`, sinDato };
  }
  if (encogen.length && !encoger) {
    return { estado: "encoge", motivo: `${encogen.length} tabla(s) quedarian con menos filas de las que tienen`, encogen, barridas: barren.length };
  }
  return { estado: "ok", encogen, barridas: barren.length, forzado: encogen.length > 0 && encoger };
}

// ── self-test ────────────────────────────────────────────────────────────────────────────
if (process.argv.includes("--self-test")) {
  // El defecto REAL, con la forma exacta del archivo que existe hoy.
  const REAL = `
    DELETE FROM quantum_algorithms;
    INSERT INTO quantum_algorithms (id,name) VALUES ('a','CTQW (continuous-time)'),('b','QAOA');
  `;

  const casos = [
    // ── grita ──
    ["grita: la semilla dejaria menos filas de las que hay", () =>
      evaluar({ semilla: leerSemilla(REAL), vivas: new Map([["quantum_algorithms", 74]]), encoger: false }).estado === "encoge"],

    ["grita: dice cuantas pierde, no solo que encoge", () => {
      const r = evaluar({ semilla: leerSemilla(REAL), vivas: new Map([["quantum_algorithms", 74]]) });
      return r.encogen[0].pierde === 72 && r.encogen[0].antes === 74 && r.encogen[0].despues === 2;
    }],

    // LA TRAMPA: sin D1 no hay con que comparar. Verde aqui seria un guardia que no mira nada.
    ["grita distinto: sin D1 es INDETERMINADO, nunca ok", () =>
      evaluar({ semilla: leerSemilla(REAL), vivas: null }).estado === "indeterminado"],

    ["grita distinto: barre una tabla cuyo conteo vivo no se leyo", () =>
      evaluar({ semilla: leerSemilla(REAL), vivas: new Map([["otra_tabla", 5]]) }).estado === "indeterminado"],

    // ── calla ──
    ["CALLA: la semilla deja mas filas de las que hay", () =>
      evaluar({ semilla: leerSemilla(REAL), vivas: new Map([["quantum_algorithms", 1]]) }).estado === "ok"],

    ["CALLA: deja exactamente las mismas", () =>
      evaluar({ semilla: leerSemilla(REAL), vivas: new Map([["quantum_algorithms", 2]]) }).estado === "ok"],

    ["CALLA con --encoger: es una decision explicita, no un descuido", () =>
      evaluar({ semilla: leerSemilla(REAL), vivas: new Map([["quantum_algorithms", 74]]), encoger: true }).estado === "ok"],

    // Un DELETE acotado no es un barrido: challenges.seed.sql borra solo su propia corrida.
    ["CALLA: DELETE con WHERE no cuenta como barrido", () => {
      const s = leerSemilla("DELETE FROM challenge_runs WHERE id='cleveland-2026-07';");
      return s.get("challenge_runs").barre === false;
    }],

    // EL PARADOJICO: el defecto descrito en un comentario y ausente del SQL.
    ["CALLA: 'DELETE FROM x;' solo mencionado en un comentario", () =>
      leerSemilla("-- ojo: no poner DELETE FROM quantum_algorithms; aqui\nSELECT 1;").size === 0],

    ["CALLA: comentario de bloque con el defecto adentro", () =>
      leerSemilla("/* DELETE FROM quantum_sources; seria un barrido */\nSELECT 1;").size === 0],

    // ── el contador de tuplas ──
    ["cuenta varias tuplas en un solo INSERT", () =>
      leerSemilla("INSERT INTO t (a) VALUES (1),(2),(3);").get("t").inserta === 3],

    // Sin esto el conteo se infla: los nombres reales del catalogo traen parentesis.
    ["no se confunde con parentesis DENTRO de un valor", () =>
      leerSemilla("INSERT INTO t (a) VALUES ('CTQW (continuous-time)'),('QAOA (p=3)');").get("t").inserta === 2],

    ["no se confunde con una comilla escapada", () =>
      leerSemilla("INSERT INTO t (a) VALUES ('it''s (one)'),('dos');").get("t").inserta === 2],

    // ── mutacion ──
    ["MUTACION: sin el filtro de WHERE, un DELETE acotado se leeria como barrido", () => {
      const conFiltro = leerSemilla("DELETE FROM t WHERE id='x';").get("t").barre;
      const barrido = leerSemilla("DELETE FROM t;").get("t").barre;
      return conFiltro === false && barrido === true;
    }],

    ["MUTACION: contar '(' a secas daria 4 donde hay 2", () =>
      contarTuplas("('CTQW (continuous-time)'),('QAOA (p=3)')") === 2 &&
      ("('CTQW (continuous-time)'),('QAOA (p=3)')".match(/\(/g) || []).length === 4],
  ];

  let fallos = 0;
  for (const [nombre, fn] of casos) {
    let paso; try { paso = fn(); } catch { paso = false; }
    console.log(`${paso ? "ok   " : "FALLA"}  ${nombre}`);
    if (!paso) fallos++;
  }
  console.log(`\n[semilla-encoge] self-test: ${casos.length - fallos} de ${casos.length} pasaron.`);
  process.exit(fallos ? 1 : 0);
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────
const archivo = process.argv[2];
if (archivo && !archivo.startsWith("--")) {
  if (!existsSync(archivo)) {
    console.error(`[semilla-encoge] NO SE PUDO COMPROBAR: no existe ${archivo}`);
    process.exit(2);
  }
  const encoger = process.argv.includes("--encoger");
  const semilla = leerSemilla(readFileSync(archivo, "utf8"));
  const barridas = [...semilla.entries()].filter(([, v]) => v.barre).map(([t]) => t);

  console.log(`[semilla-encoge] ${archivo} · ${semilla.size} tabla(s) tocada(s) · ${barridas.length} barrida(s) sin WHERE`);

  let vivas = new Map();
  try {
    for (const t of barridas) {
      const salida = execSync(
        `npx wrangler d1 execute ${DB} --remote --json --command "SELECT COUNT(*) AS n FROM ${t}"`,
        { stdio: ["ignore", "pipe", "pipe"] }
      ).toString();
      vivas.set(t, JSON.parse(salida)[0].results[0].n);
    }
  } catch (err) {
    vivas = null;
    console.error(`[semilla-encoge] D1 no responde: ${String(err).split("\n")[0]}`);
  }

  const r = evaluar({ semilla, vivas, encoger });

  if (r.estado === "indeterminado") {
    console.error(`[semilla-encoge] NO SE PUDO COMPROBAR: ${r.motivo}`);
    console.error("[semilla-encoge] Sin el conteo vivo, aplicar esto es borrar a ciegas.");
    process.exit(2);
  }

  for (const t of barridas) console.log(`   ${t}: viva ${vivas.get(t)} -> semilla ${semilla.get(t).inserta}`);

  if (r.estado === "encoge") {
    console.error(`\n[semilla-encoge] BLOQUEADO: ${r.motivo}`);
    for (const e of r.encogen) console.error(`    ${e.tabla}: ${e.antes} -> ${e.despues}  (pierde ${e.pierde})`);
    console.error("[semilla-encoge] Antes de borrar, lo que queda tiene que contener lo que se va.");
    console.error("[semilla-encoge] Si es a proposito, se dice: --encoger");
    process.exit(1);
  }
  if (r.forzado) console.log("\n[semilla-encoge] encoge, pero se pidio con --encoger. Aplicando bajo decision explicita.");
  else console.log("\n[semilla-encoge] ninguna tabla pierde filas.");
}
