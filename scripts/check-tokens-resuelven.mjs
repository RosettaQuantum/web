#!/usr/bin/env node
/**
 * Comprueba que los tokens del sistema de diseño EXISTAN en cada pagina que los usa,
 * y que el titular se vea como titular.
 *
 * EL DEFECTO REAL (10-sep-2026), vivo en las 114 notas del blog. `global.css` trae
 * `.article h1{font-size:var(--t-title)}`. `BlogLayoutV2` cargaba global.css pero NO
 * `tokens.css`, que es donde `--t-title` se declara. Resultado: la regla ganaba la
 * cascada, pedia un token inexistente, la declaracion quedaba invalida al computar, y
 * el titular de cada post caia por herencia a 16px — EL MISMO TAMANO QUE SUS PARRAFOS.
 *
 * Lo que hace peligroso a este fallo es que todo parece bien desde cada lado:
 *   · la regla existe y es correcta
 *   · la hoja se carga y el navegador la lee
 *   · el selector calza con el elemento
 *   · no hay error de consola, ni 404, ni build roto
 * Lo unico que falla es que el token no esta ahi, y `var()` sin valor no grita: se
 * evapora. Es el hermano de [[el-empaquetador-borra-el-token-que-nadie-usa]] al reves
 * — alli el token se caia por no tener consumidor; aqui el consumidor vive en un
 * layout que nunca importo la hoja donde el token se declara.
 *
 * DOS COMPROBACIONES, y la segunda es la que de verdad protege:
 *
 *   1. TOKENS DEFINIDOS. Cada token declarado en tokens.css tiene que resolver en
 *      `:root` de cada pagina. Caza la causa.
 *
 *   2. EL TITULAR SE VE COMO TITULAR. El h1 tiene que medir mas que el texto de
 *      cuerpo de su propia pagina. Caza el SINTOMA, y por eso vale mas: seguiria
 *      gritando si manana el titular se rompe por una razon distinta —un literal mal
 *      puesto, una hoja que no carga, una especificidad nueva— sin que este guardia
 *      sepa nada de tokens.
 *
 * No comprueba estetica ni jerarquia fina: solo que el titular no haya colapsado al
 * tamano del cuerpo. Precision sobre cobertura.
 *
 * CONSUMIDOR: quien publica el sitio y quien autoriza el cutover.
 * QUE HACE SI FALLA: no publica. Una pagina cuyo titular mide lo mismo que su cuerpo
 * se lee como un borrador, y son las notas —la superficie que mas indexan los modelos.
 *
 * PUNTO CIEGO DECLARADO: mide el PRIMER h1 de cada pagina. Si una pagina tuviera dos
 * y solo el segundo estuviera roto, no lo ve.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { abrirChrome } from "./lib/chrome.mjs";

export const CONSUMIDOR = {
  quien: "quien publica el sitio y quien autoriza el cutover",
  hace: "no publica: hay paginas cuyo titular mide lo mismo que su cuerpo porque un token no resuelve, y se leen como un borrador",
};

/** El nucleo, puro: recibe lo medido y decide. Separado de la red para poder ejercerlo. */
export function evaluar(medidas, tokensEsperados) {
  const sinTokens = [], titularPlano = [], sinMedir = [];
  for (const m of medidas) {
    if (!m.ok) { sinMedir.push(m.ruta); continue; }
    const faltan = tokensEsperados.filter((t) => !m.tokens[t]);
    if (faltan.length) sinTokens.push({ ruta: m.ruta, faltan });
    if (m.h1 != null && m.cuerpo != null && m.h1 <= m.cuerpo)
      titularPlano.push({ ruta: m.ruta, h1: m.h1, cuerpo: m.cuerpo });
  }
  return {
    revisadas: medidas.length, sinTokens, titularPlano, sinMedir,
    sanas: medidas.length - sinTokens.length - titularPlano.length - sinMedir.length,
  };
}

if (process.argv.includes("--autoprueba")) {
  const TOK = ["--t-title", "--t-body"];
  const sana = { ruta: "/", ok: true, tokens: { "--t-title": "34px", "--t-body": "18px" }, h1: 40, cuerpo: 18 };
  // EL CASO REAL: los tokens no llegan y el h1 cae al tamano del cuerpo.
  const rota = { ruta: "/blog/x-es", ok: true, tokens: {}, h1: 16, cuerpo: 16 };
  const a = evaluar([rota], TOK), b = evaluar([sana], TOK);
  const p = (n, c) => { console.log(`  ${c ? "ok  " : "FALLA"} ${n}`); return c; };
  let bien = true;
  bien &= p("grita por el token que falta", a.sinTokens.length === 1 && a.sinTokens[0].faltan.length === 2);
  bien &= p("y ademas por el titular aplanado", a.titularPlano.length === 1);
  bien &= p("calla en una pagina sana", b.sinTokens.length === 0 && b.titularPlano.length === 0 && b.sanas === 1);
  // El sintoma se caza AUNQUE los tokens esten: es lo que lo hace util manana.
  const otra = evaluar([{ ruta: "/z", ok: true, tokens: { "--t-title": "34px", "--t-body": "18px" }, h1: 18, cuerpo: 18 }], TOK);
  bien &= p("caza un titular plano aunque los tokens si resuelvan", otra.sinTokens.length === 0 && otra.titularPlano.length === 1);
  bien &= p("reporta el denominador", a.revisadas === 1 && b.revisadas === 1);
  process.exit(bien ? 0 : 1);
}

const BASE = (process.argv.find((a) => a.startsWith("--base="))?.slice(7)
  || process.env.PREVIEW_URL || "").replace(/\/+$/, "");
if (!BASE) {
  console.error("ABORTA: falta --base=<url> o PREVIEW_URL. Un verde sin base declarada no dice que se midio.");
  process.exit(1);
}

const aqui = dirname(fileURLToPath(import.meta.url));
// Los tokens que se exigen se LEEN de tokens.css, no se listan a mano: una lista
// escrita aqui envejece el dia que alguien agregue el septimo tamano.
const css = readFileSync(resolve(aqui, "../src/styles/tokens.css"), "utf8");
const TOKENS = [...new Set([...css.matchAll(/^\s*(--t-[a-z0-9-]+)\s*:/gm)].map((m) => m[1]))];

// Una pagina por cada layout, mas dos notas: el defecto vivia en UN layout y no se
// habria visto mirando solo la home.
const RUTAS = ["/", "/es/", "/services", "/for/investors", "/ledger", "/library",
  "/informe-pqc", "/blog", "/es/blog",
  "/blog/who-submits-the-classical-rival-en", "/blog/who-submits-the-classical-rival-es",
  "/blog/what-is-qoblib-and-how-do-you-use-a-pre-registered-benchmark-es"];

/* El lector se fabrica con la lista de tokens ADENTRO.
 * `chrome.mjs` evalua `(${fn.toString()})()` — sin argumentos. La primera version
 * recibia `toks` como parametro, que llegaba `undefined`, la funcion lanzaba, y las 12
 * paginas caian a «no se pudo medir»... con el guardia saliendo en VERDE. Dos fallas
 * en una: la del parametro y la de dar por bueno lo que no se midio. */
const hacerLector = (toks) => new Function(`
  const toks = ${JSON.stringify(toks)};
  const raiz = getComputedStyle(document.documentElement);
  const tokens = {};
  for (const t of toks) { const v = raiz.getPropertyValue(t).trim(); if (v) tokens[t] = v; }
  const h1 = document.querySelector("h1");
  // El cuerpo se mide en un parrafo REAL de la pagina, no en el body: es contra eso
  // que el lector compara el titular.
  const p = [...document.querySelectorAll("main p, article p, .body p")]
    .find((e) => e.textContent.trim().split(/\\s+/).length > 12);
  const px = (e) => (e ? parseFloat(getComputedStyle(e).fontSize) : null);
  return { tokens, h1: px(h1), cuerpo: px(p) || px(document.body) };
`);
const leer = hacerLector(TOKENS);

const c = await abrirChrome({ ancho: 1280, alto: 900 });
const medidas = [];
for (const r of RUTAS) {
  let estado = 0;
  try { estado = (await fetch(BASE + r, { headers: { "x-rq-check": "1" }, redirect: "follow" })).status; } catch { /* 0 */ }
  if (estado !== 200) { medidas.push({ ruta: r, ok: false, estado }); continue; }
  try { medidas.push({ ruta: r, ok: true, ...(await c.evaluar(BASE + r, leer, 1600)) }); }
  catch (e) { medidas.push({ ruta: r, ok: false, estado, error: String(e.message || e).slice(0, 90) }); }
}
await c.cerrar();

const res = evaluar(medidas, TOKENS);
console.log(`tokens y titulares · ${BASE}\n  ${TOKENS.length} tokens exigidos: ${TOKENS.join(" ")}\n`);
res.sinMedir.forEach((r) => console.log(`  ✗ NO SE PUDO MEDIR ${r}`));
res.sinTokens.forEach((x) => console.log(`  ✗ ${x.ruta.padEnd(52)} no resuelve ${x.faltan.join(" ")}`));
res.titularPlano.forEach((x) => console.log(`  ✗ ${x.ruta.padEnd(52)} h1 ${x.h1}px = cuerpo ${x.cuerpo}px — el titular no se ve como titular`));
if (!res.sinTokens.length && !res.titularPlano.length && !res.sinMedir.length)
  console.log(`  ok    ${res.sanas} de ${res.revisadas} paginas: tokens resueltos y titular por encima del cuerpo`);

/* Lo que no se pudo medir CUENTA COMO FALLA. Un guardia que mide cero paginas y
   escribe «0 fallas» es el caso de [[guardia-que-se-da-la-razon-solo]], y esta version
   lo cometio en su primera corrida: 12 de 12 sin medir, salida 0. */
const fallas = res.sinTokens.length + res.titularPlano.length + res.sinMedir.length;
console.log(`\n${res.revisadas} paginas · ${res.sinMedir.length} sin medir · ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
