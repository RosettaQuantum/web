#!/usr/bin/env node
/**
 * No se promete una tasa de victoria mientras el contador diga cero.
 *
 * LO QUE LO MOTIVA (2026-08-24). El calculador de precios de la portada multiplica por
 * `advRate` — 0,50 · 0,55 · 0,58 · 0,60 segun la vertical — y su propio comentario dice
 * que es "billed wins per request". O sea: le dice a un cliente que entre el 50% y el 60%
 * de sus corridas serian victorias facturables. Nuestro `/v1/state` dice
 * `victorias_cuanticas_medidas: 0`. Nunca observamos una.
 *
 * No es una exageracion de marketing: es una cifra especifica, en la pagina que mas se
 * lee, que **nuestra propia API desmiente con un curl**. Es la §1 ter del CLAUDE.md en su
 * forma mas cara — cuanto mas verificable haces el producto, mas superficie le das a que
 * una afirmacion floja quede en evidencia, y la deja en evidencia el lector con la
 * herramienta que le diste tu.
 *
 * El propio CLAUDE.md ya prescribia este chequeo: "que no dependa de acordarse: un
 * chequeo que compare las cifras del texto publico contra /v1/state".
 *
 * PRECISION SOBRE COBERTURA. Un falso positivo aca retiene el trabajo de Comercial, que
 * es peor que dejar pasar un caso. Por eso NO busca las palabras "win" o "ventaja" sueltas
 * —aparecen legitimamente en "only wins billed" o en la tesis de los negativos— sino algo
 * mucho mas estrecho: **una tasa numerica mayor que cero asignada a un identificador cuyo
 * nombre declara que mide victorias.**
 *
 * SU PUNTO CIEGO, declarado: no entiende prosa. Si alguien escribe "la mayoria de las
 * corridas gana" en una frase, esto no lo ve. Cubre las cifras, que son las que un cliente
 * puede citarnos; el texto lo sigue mirando una persona.
 *
 * Uso:
 *   node scripts/check-ventaja-cero.mjs              # contra /v1/state en vivo
 *   node scripts/check-ventaja-cero.mjs --self-test  # rompe cada regla y exige el grito
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const BASE = "https://rosettaquantum.com";

/**
 * Quita comentarios y deja solo codigo.
 *
 * SIN ESTO EL GUARDIA LEE PROSA (CLAUDE.md §4 bis): el comentario de la linea 14 de
 * index-fn-0.js EXPLICA que advRate son victorias facturables. Un grep sobre el archivo
 * entero se dispararia con esa explicacion aunque alguien borrara la constante — y peor,
 * el dia que alguien documente "aqui NO ponemos advRate", gritaria por el texto que
 * declara la ausencia del defecto.
 */
export function soloCodigo(js) {
  return js.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

/**
 * Busca tasas de victoria declaradas en codigo.
 *
 * @param {string} js  contenido del archivo
 * @returns {{nombre: string, valor: number}[]}
 */
export function tasasDeclaradas(js) {
  const limpio = soloCodigo(js);
  const out = [];
  // Identificadores cuyo NOMBRE dice que miden victoria/ventaja, con valor numerico.
  const re = /\b(adv(?:antage)?Rate|winRate|tasa_?(?:de_?)?victorias?|hitRate)\s*[:=]\s*(0?\.\d+|\d+(?:\.\d+)?)/gi;
  let m;
  while ((m = re.exec(limpio))) out.push({ nombre: m[1], valor: Number(m[2]) });
  return out;
}

/**
 * ¿Puede publicarse esto?
 *
 * @param {{victoriasMedidas: number|null, tasas: {nombre:string,valor:number}[]}} ctx
 */
export function evaluarVentaja({ victoriasMedidas, tasas }) {
  if (victoriasMedidas === null) {
    return { estado: "indeterminado", motivo: "no se pudo leer victorias_cuanticas_medidas de /v1/state" };
  }
  if (victoriasMedidas > 0) return { estado: "ok", motivo: `hay ${victoriasMedidas} victoria(s) medida(s): una tasa publicada tiene de donde salir` };

  const positivas = tasas.filter((t) => t.valor > 0);
  if (!positivas.length) return { estado: "ok", motivo: "el contador dice 0 y no se publica ninguna tasa de victoria" };

  return {
    estado: "contradiccion",
    motivo: `se publican ${positivas.length} tasa(s) de victoria mayores que cero y /v1/state dice victorias_cuanticas_medidas: 0`,
    tasas: positivas,
  };
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────
if (process.argv.includes("--self-test")) {
  const casos = [
    ["grita: tasa > 0 con el contador en cero", () =>
      evaluarVentaja({ victoriasMedidas: 0, tasas: [{ nombre: "advRate", valor: 0.6 }] }).estado === "contradiccion"],
    ["CALLA: contador en cero y ninguna tasa publicada", () =>
      evaluarVentaja({ victoriasMedidas: 0, tasas: [] }).estado === "ok"],
    ["CALLA: hay victorias medidas, la tasa tiene de donde salir", () =>
      evaluarVentaja({ victoriasMedidas: 3, tasas: [{ nombre: "advRate", valor: 0.6 }] }).estado === "ok"],
    ["CALLA: tasa en cero declarada explicitamente", () =>
      evaluarVentaja({ victoriasMedidas: 0, tasas: [{ nombre: "advRate", valor: 0 }] }).estado === "ok"],
    ["grita distinto: /v1/state ilegible es INDETERMINADO, no ok", () =>
      evaluarVentaja({ victoriasMedidas: null, tasas: [] }).estado === "indeterminado"],

    // — el lector de codigo —
    ["encuentra la constante real", () => {
      const t = tasasDeclaradas('var F={a:{hwBase:12, royBase:55, advRate:0.60}};');
      return t.length === 1 && t[0].valor === 0.6;
    }],
    // EL CASO PARADOJICO, el que mas rinde y el que no se le ocurre a nadie: el defecto
    // DESCRITO en un comentario y AUSENTE del codigo. Si grita aca, lee prosa.
    ["CALLA: 'advRate' solo mencionado en un comentario", () =>
      tasasDeclaradas('// ojo: no volver a poner advRate: 0.60 aqui\nvar F={a:{hwBase:12}};').length === 0],
    ["CALLA: comentario de bloque que explica advRate = 0.5", () =>
      tasasDeclaradas('/* advRate: 0.5 seria la tasa de victorias */\nvar x=1;').length === 0],
    ["encuentra varias", () =>
      tasasDeclaradas("a={advRate:0.6}; b={advRate:0.5}; c={winRate: 0.58}").length === 3],
  ];

  let fallos = 0;
  for (const [nombre, fn] of casos) {
    let paso; try { paso = fn(); } catch { paso = false; }
    console.log(`${paso ? "ok  " : "FALLA"}  ${nombre}`);
    if (!paso) fallos++;
  }
  console.log(`\n[ventaja-cero] self-test: ${casos.length - fallos} de ${casos.length} pasaron.`);
  process.exit(fallos ? 1 : 0);
}

// Modo real
let victoriasMedidas = null;
try {
  const r = await fetch(`${BASE}/v1/state`, { headers: { "User-Agent": "rosetta ventaja-cero check" } });
  const j = await r.json();
  const v = j?.estado_medido?.victorias_cuanticas_medidas;
  victoriasMedidas = typeof v === "number" ? v : null;
} catch { victoriasMedidas = null; }

const dirs = ["public/js", "src/content_html"].filter((d) => existsSync(d));
const tasas = [];
let archivos = 0;
for (const d of dirs) {
  for (const f of readdirSync(d).filter((x) => /\.(js|html)$/.test(x))) {
    archivos++;
    for (const t of tasasDeclaradas(readFileSync(join(d, f), "utf8"))) tasas.push({ ...t, archivo: `${d}/${f}` });
  }
}

const r = evaluarVentaja({ victoriasMedidas, tasas });
console.log(`[ventaja-cero] ${archivos} archivos publicos revisados · victorias medidas: ${victoriasMedidas ?? "?"}`);

if (r.estado === "indeterminado") {
  console.error(`[ventaja-cero] NO SE PUDO COMPROBAR: ${r.motivo}`);
  process.exit(2);
}
if (r.estado === "contradiccion") {
  console.error(`[ventaja-cero] CONTRADICCION: ${r.motivo}`);
  for (const t of r.tasas) console.error(`    ${t.archivo}: ${t.nombre} = ${t.valor}`);
  console.error("[ventaja-cero] Un cliente lo desmiente con: curl -s " + BASE + "/v1/state");
  console.error("[ventaja-cero] O sale la cifra, o sale del contador. No las dos.");
  process.exit(1);
}
console.log(`[ventaja-cero] ${r.motivo}`);
