#!/usr/bin/env node
/**
 * El snapshot del ledger dice lo mismo que D1, o grita.
 *
 * EL DEFECTO (auditoria del 2026-08-24, superficie 2.1): `src/data/ledger.json` esta
 * commiteado Y ademas se genera. `sync-ledger.mjs` lo reescribe en cada `prebuild` desde
 * D1, pero CI **nunca lo commitea de vuelta** — asi que el snapshot que vive en `main`
 * puede quedar meses atras de D1 y nadie se entera. El dia que D1 no responda durante un
 * build, `sync-ledger` cae al snapshot viejo y **se publica como si fuera el vivo**.
 *
 * Es la ausencia disfrazada de valor: no falta el dato, hay un dato — el equivocado.
 * Y el respaldo nunca se probo contra el caso para el que existe (CLAUDE.md §5 bis 4).
 *
 * COMO LO COMPRUEBA: reusa la MISMA ruta de transformacion que el build. `sync-ledger`
 * acepta `LEDGER_DUMP` justamente para eso ("whoever regenerates the snapshot by hand
 * produces byte-identical output"). Aca leemos D1, pasamos por esa misma ruta, y
 * comparamos contra el archivo commiteado. Una sola definicion, importada (§5 bis 3).
 *
 * SU PUNTO CIEGO, declarado: compara SOLO lo que el snapshot contiene — recetas,
 * veredictos y experimentos. **No** compara contra `run_archives`, que es otra tabla y
 * otra pregunta: el snapshot cuenta filas de `experiments` (hoy 48) y `/v1/state` cuenta
 * `run_archives` (hoy 86). Restar esas dos habria sido una falsa alarma, y casi la
 * reporto. Dos cifras que se restan tienen que venir del mismo conjunto (§1 quater).
 *
 * Uso:
 *   node scripts/check-ledger-deriva.mjs             # compara el snapshot commiteado con D1
 *   node scripts/check-ledger-deriva.mjs --self-test # rompe cada regla y exige el grito
 *
 * Salidas: 0 = al dia · 1 = hay deriva · 2 = no se pudo comprobar (≠ "esta bien").
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

/**
 * Compara el snapshot commiteado contra lo que dice D1.
 *
 * Devuelve SIEMPRE el denominador — cuantos comparo, cuantos calzan, cuantos no.
 * Un total sin denominador no es un resultado (CLAUDE.md §5 bis 1).
 *
 * @param {{snapshot: object|null, d1: object|null}} ctx
 */
export function compararLedger({ snapshot, d1 }) {
  if (!snapshot) return { estado: "indeterminado", motivo: "no se pudo leer el snapshot commiteado" };
  if (!d1) return { estado: "indeterminado", motivo: "no se pudo leer D1 — el snapshot puede estar viejo y no hay como saberlo" };

  const campos = ["pipeline", "published", "sealed"];
  const difs = [];
  for (const c of campos) {
    const a = snapshot?.counter?.[c];
    const b = d1?.counter?.[c];
    if (a !== b) difs.push({ campo: c, snapshot: a, d1: b });
  }

  // El contador puede calzar y el contenido no: una receta renombrada o un veredicto
  // reescrito no mueve ningun total. Por eso tambien se comparan los ids y el cuerpo.
  const idsA = (snapshot.recipes ?? []).map((r) => r.id).sort().join(",");
  const idsB = (d1.recipes ?? []).map((r) => r.id).sort().join(",");
  if (idsA !== idsB) difs.push({ campo: "ids de recetas", snapshot: idsA, d1: idsB });

  const cuerpoIgual = JSON.stringify(snapshot) === JSON.stringify(d1);
  if (!difs.length && !cuerpoIgual) {
    difs.push({ campo: "contenido", snapshot: "(totales e ids calzan)", d1: "algun campo interno cambio" });
  }

  return {
    estado: difs.length ? "deriva" : "al-dia",
    comparados: campos.length + 2,
    calzan: campos.length + 2 - difs.length,
    difs,
  };
}

/**
 * ¿Puede publicarse lo que se acaba de construir?
 *
 * `sync-ledger` cae al snapshot cuando D1 no responde, a proposito, para que un build
 * local no se rompa sin red. Pero en CI ese fallback **publica** el snapshot viejo como
 * si fuera el vivo: ahi un paso que no produce nada es un fallo, no un aviso (§5 quater 3).
 *
 * @param {{fuente: "d1"|"snapshot", enCI: boolean}} ctx
 */
export function evaluarPublicacion({ fuente, enCI }) {
  if (fuente === "d1") return { ok: true };
  if (!enCI) return { ok: true, aviso: "se uso el snapshot (sin D1) — bien en local, no publicable" };
  return {
    ok: false,
    motivo: "sync-ledger cayo al snapshot y esto es CI: se estaria publicando el ledger viejo como si fuera el vivo.",
  };
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);

if (args.includes("--self-test")) {
  const base = { counter: { pipeline: 4, published: 1, sealed: 48 }, recipes: [{ id: "a" }, { id: "b" }] };
  const clonar = (o) => JSON.parse(JSON.stringify(o));

  const casos = [
    // — comparacion —
    ["CALLA: snapshot identico a D1", () => compararLedger({ snapshot: base, d1: clonar(base) }).estado === "al-dia"],
    ["grita: un contador movido", () => {
      const d = clonar(base); d.counter.sealed = 86;
      const r = compararLedger({ snapshot: base, d1: d });
      return r.estado === "deriva" && r.difs.some((x) => x.campo === "sealed");
    }],
    ["grita: una receta nueva en D1", () => {
      const d = clonar(base); d.recipes.push({ id: "c" }); d.counter.pipeline = 5;
      return compararLedger({ snapshot: base, d1: d }).estado === "deriva";
    }],
    // El caso que de verdad cuesta: los totales calzan y el contenido no. Un veredicto
    // reescrito no mueve ningun contador — si el guardia solo mirara totales, pasaria.
    ["grita: totales iguales pero contenido distinto", () => {
      const d = clonar(base); d.recipes[0].name_en = "otro nombre";
      const r = compararLedger({ snapshot: base, d1: d });
      return r.estado === "deriva" && r.difs.some((x) => x.campo === "contenido");
    }],
    // "No pude comprobar" NO es "esta bien". Es el error que convierte un guardia en adorno.
    ["grita distinto: D1 ilegible es INDETERMINADO, no al-dia", () => {
      const r = compararLedger({ snapshot: base, d1: null });
      return r.estado === "indeterminado";
    }],
    ["grita distinto: snapshot ilegible es INDETERMINADO", () => compararLedger({ snapshot: null, d1: base }).estado === "indeterminado"],
    ["reporta denominador", () => compararLedger({ snapshot: base, d1: clonar(base) }).comparados === 5],
    // — publicacion —
    ["CALLA: vino de D1, en CI", () => evaluarPublicacion({ fuente: "d1", enCI: true }).ok === true],
    ["CALLA: vino del snapshot, en local (build sin red debe funcionar)", () => evaluarPublicacion({ fuente: "snapshot", enCI: false }).ok === true],
    ["grita: vino del snapshot y es CI", () => evaluarPublicacion({ fuente: "snapshot", enCI: true }).ok === false],
  ];

  let fallos = 0;
  for (const [nombre, fn] of casos) {
    let paso;
    try { paso = fn(); } catch { paso = false; }
    console.log(`${paso ? "ok  " : "FALLA"}  ${nombre}`);
    if (!paso) fallos++;
  }
  console.log(`\n[ledger-deriva] self-test: ${casos.length - fallos} de ${casos.length} pasaron.`);
  process.exit(fallos ? 1 : 0);
}

// Modo real: leer el snapshot commiteado y regenerar desde D1 por la MISMA ruta.
let snapshot = null;
try {
  snapshot = JSON.parse(readFileSync("src/data/ledger.json", "utf8"));
} catch (e) {
  console.error(`[ledger-deriva] no se pudo leer el snapshot: ${String(e).split("\n")[0]}`);
  process.exit(2);
}

let d1 = null;
try {
  // Se regenera por la MISMA ruta del build y se compara; el archivo commiteado no se
  // toca. En --stdout, sync-ledger sale con codigo 2 si D1 no responde en vez de
  // devolver el snapshot — sin eso estariamos comparando el snapshot consigo mismo.
  const salida = execSync("node scripts/sync-ledger.mjs --stdout", {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  d1 = JSON.parse(salida);
} catch {
  d1 = null;
}

const r = compararLedger({ snapshot, d1 });

if (r.estado === "indeterminado") {
  console.error(`[ledger-deriva] NO SE PUDO COMPROBAR: ${r.motivo}`);
  console.error("[ledger-deriva] Esto no es \"esta al dia\": es que no se sabe.");
  process.exit(2);
}

if (r.estado === "deriva") {
  console.error(`[ledger-deriva] DERIVA: ${r.calzan} de ${r.comparados} calzan.`);
  for (const d of r.difs) console.error(`  ${d.campo}: snapshot=${d.snapshot}  D1=${d.d1}`);
  console.error("[ledger-deriva] El snapshot commiteado es el que se publica si D1 no responde.");
  console.error("[ledger-deriva] Arreglo: `npm run sync:ledger` y commitear src/data/ledger.json.");
  process.exit(1);
}

console.log(`[ledger-deriva] al dia: ${r.calzan} de ${r.comparados} comparados calzan con D1.`);
