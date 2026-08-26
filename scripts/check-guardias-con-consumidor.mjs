#!/usr/bin/env node
/**
 * Un guardia sin consumidor es una fuente futura de ruido.
 *
 * EL DEFECTO (medido el 2026-08-26). Hay 21 guardias en `scripts/` y **uno solo declara quien
 * lo actua cuando grita** — y lo hace en prosa, dentro de un comentario. Los otros veinte
 * emiten una senal que no tiene destinatario.
 *
 * Es la regla que ya tenemos escrita —*toda alerta declara su consumidor o no se crea*— y su
 * consecuencia documentada: asi se llega a doscientas alertas que alguien aprende a ignorar.
 * Un guardia sin consumidor no es neutro: **es peor que no tenerlo**, porque da tranquilidad.
 *
 * Y el criterio de a quien pertenece lo fijo la sesion de archivo, revisando los ocho de
 * `check:prod` uno por uno en vez de repartirlos por el nombre:
 *
 *     **Un guardia es de quien puede arreglarlo cuando grita, no de quien es dueno del dato
 *     que mira.**
 *
 * Es la misma regla de las alertas: la senal va a quien puede actuarla. `check-ledger-deriva`
 * mira el ledger —dato del archivo— pero cuando grita lo que se arregla es la regeneracion en
 * el build, asi que es del CTO.
 *
 * POR QUE TRINQUETE Y NO BLOQUEO A SECAS. Exigirlo hoy a los veinte dejaria el build rojo por
 * trabajo ajeno, y **un bloqueador que retiene trabajo bueno es peor que dejar pasar un caso**.
 * Entonces: los que existen hoy quedan heredados, listados por nombre; **cualquier guardia
 * nuevo, o cualquier heredado que se toque, tiene que declarar.** La lista solo puede encoger.
 *
 * COMO SE DECLARA. Un export, no un comentario — un comentario no se puede comprobar:
 *
 *     export const CONSUMIDOR = {
 *       quien: "sesion CTO",
 *       hace: "regenera el snapshot del ledger y vuelve a desplegar",
 *     };
 *
 * SU PUNTO CIEGO, declarado: comprueba que el campo exista y no este vacio, no que el
 * consumidor sea el correcto ni que exista de verdad. Un `quien: "alguien"` pasa. Eso lo
 * mira una persona; esto impide el caso que de verdad ocurre, que es no poner nada.
 *
 * Uso:
 *   node scripts/check-guardias-con-consumidor.mjs --self-test
 *   node scripts/check-guardias-con-consumidor.mjs
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Guardias que existian el 2026-08-26 sin declarar consumidor. **Esta lista solo encoge.**
 * Quien toque uno de estos, lo declara y lo saca de aqui.
 */
export const HEREDADOS = [
  "check-alcance", "check-api-bilingue", "check-api-vs-sello", "check-estado-completo",
  "check-guardias-cableados", "check-informe-cifras", "check-informe-confidencial",
  "check-informe-geometria", "check-openapi", "check-posts-sobrescritura",
  "check-promesa-verificable", "check-qex-formula", "check-quantum-catalog",
  "check-ventaja-cero",
];

/** ¿Este archivo declara un consumidor con las dos partes llenas? */
export function declara(fuente) {
  const limpio = String(fuente ?? "").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
  const m = /export\s+const\s+CONSUMIDOR\s*=\s*\{([\s\S]{0,400}?)\}/.exec(limpio);
  if (!m) return false;
  const cuerpo = m[1];
  const quien = /\bquien\s*:\s*["'`]([^"'`]+)["'`]/.exec(cuerpo);
  const hace = /\bhace\s*:\s*["'`]([^"'`]+)["'`]/.exec(cuerpo);
  return Boolean(quien && hace && quien[1].trim() && hace[1].trim());
}

/**
 * @param {{guardias: {nombre:string, fuente:string}[], heredados: string[]}} ctx
 */
export function evaluar({ guardias, heredados = HEREDADOS }) {
  const sinDeclarar = guardias.filter((g) => !declara(g.fuente)).map((g) => g.nombre);
  const nuevos = sinDeclarar.filter((n) => !heredados.includes(n));
  // El trinquete: un heredado que YA declara tiene que salir de la lista, o la lista miente.
  const yaDeclaran = guardias.filter((g) => declara(g.fuente) && heredados.includes(g.nombre)).map((g) => g.nombre);

  return {
    vistos: guardias.length,
    declaran: guardias.length - sinDeclarar.length,
    heredadosPendientes: sinDeclarar.filter((n) => heredados.includes(n)),
    nuevos,
    listaObsoleta: yaDeclaran,
    bloquea: nuevos.length > 0 || yaDeclaran.length > 0,
  };
}

// ── self-test ────────────────────────────────────────────────────────────────────────────
if (process.argv.includes("--self-test")) {
  const CON = 'export const CONSUMIDOR = { quien: "sesion CTO", hace: "redespliega" };';
  const g = (nombre, fuente) => ({ nombre, fuente });

  const casos = [
    ["CALLA: un heredado que sigue sin declarar no bloquea", () =>
      evaluar({ guardias: [g("check-alcance", "// nada")], heredados: ["check-alcance"] }).bloquea === false],

    ["grita: un guardia NUEVO sin declarar", () =>
      evaluar({ guardias: [g("check-nuevo", "// nada")], heredados: ["check-alcance"] }).bloquea === true],

    ["CALLA: un guardia nuevo que declara", () =>
      evaluar({ guardias: [g("check-nuevo", CON)], heredados: [] }).bloquea === false],

    // EL TRINQUETE: si un heredado ya declara, la lista quedo mentirosa y hay que apretarla.
    ["grita: un heredado que YA declara sigue en la lista", () => {
      const r = evaluar({ guardias: [g("check-alcance", CON)], heredados: ["check-alcance"] });
      return r.bloquea === true && r.listaObsoleta[0] === "check-alcance";
    }],

    // ── el lector ──
    ["CALLA: declaracion completa", () => declara(CON) === true],
    ["grita: falta 'hace'", () => declara('export const CONSUMIDOR = { quien: "CTO" };') === false],
    ["grita: 'quien' vacio", () => declara('export const CONSUMIDOR = { quien: "", hace: "x" };') === false],

    // EL PARADOJICO: la declaracion DESCRITA en un comentario y ausente del codigo.
    ["CALLA: CONSUMIDOR solo mencionado en un comentario", () =>
      declara('// falta: export const CONSUMIDOR = { quien: "CTO", hace: "x" };\nconst a=1;') === false],

    ["CALLA: comentario de bloque con la declaracion adentro", () =>
      declara('/* export const CONSUMIDOR = { quien: "CTO", hace: "x" }; */\nconst a=1;') === false],

    ["reporta denominador", () => {
      const r = evaluar({ guardias: [g("a", CON), g("b", "//"), g("c", "//")], heredados: ["b", "c"] });
      return r.vistos === 3 && r.declaran === 1 && r.heredadosPendientes.length === 2;
    }],

    // ── mutacion ──
    ["MUTACION: sin quitar comentarios, el paradojico pasaria por declaracion", () => {
      const fuente = '// export const CONSUMIDOR = { quien: "CTO", hace: "x" };';
      return declara(fuente) === false && /export\s+const\s+CONSUMIDOR/.test(fuente) === true;
    }],
  ];

  let fallos = 0;
  for (const [nombre, fn] of casos) {
    let paso; try { paso = fn(); } catch { paso = false; }
    console.log(`${paso ? "ok   " : "FALLA"}  ${nombre}`);
    if (!paso) fallos++;
  }
  console.log(`\n[consumidor] self-test: ${casos.length - fallos} de ${casos.length} pasaron.`);
  process.exit(fallos ? 1 : 0);
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────
const esPrincipal = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (esPrincipal) {
  const DIR = "scripts";
  const guardias = readdirSync(DIR)
    .filter((f) => /^check-.*\.mjs$/.test(f))
    .map((f) => ({ nombre: f.replace(/\.mjs$/, ""), fuente: readFileSync(join(DIR, f), "utf8") }));

  const r = evaluar({ guardias });

  console.log(`[consumidor] ${r.vistos} guardias · ${r.declaran} declaran quien los actua · ${r.heredadosPendientes.length} heredados pendientes`);
  if (r.heredadosPendientes.length) {
    console.log(`   heredados (no bloquean, pero la lista solo puede encoger):`);
    for (const n of r.heredadosPendientes) console.log(`      ${n}`);
  }

  if (r.nuevos.length) {
    console.error(`\n[consumidor] BLOQUEADO: ${r.nuevos.length} guardia(s) sin declarar quien los actua.`);
    for (const n of r.nuevos) console.error(`    ${n}`);
    console.error('[consumidor] Agrega:  export const CONSUMIDOR = { quien: "...", hace: "..." };');
    console.error("[consumidor] Una senal sin destinatario es ruido que alguien aprendera a ignorar.");
    process.exit(1);
  }
  if (r.listaObsoleta.length) {
    console.error(`\n[consumidor] BLOQUEADO: ${r.listaObsoleta.length} heredado(s) YA declaran y siguen en la lista.`);
    for (const n of r.listaObsoleta) console.error(`    ${n}  ->  sacalo de HEREDADOS`);
    console.error("[consumidor] El trinquete solo aprieta: una lista que no encoge deja de decir la verdad.");
    process.exit(1);
  }
  console.log("\n[consumidor] ningun guardia nuevo sin consumidor.");
}
