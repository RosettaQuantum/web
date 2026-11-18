#!/usr/bin/env node
/**
 * Una sola letra por dominio verificado (18-nov-2026).
 *
 * EL DEFECTO REAL. Con el inventario de rosettaquantum.com marcado, la misma página habría mostrado dos
 * letras. En lib/qready-verificado.mjs de main (706d3e9) CUATRO lugares armaban las extras de la nota,
 * con dos modos de fallo:
 *   :128 notaPublica    → inventario_verificado sin well_known_valido (AUSENTE) — de ahí comía la API
 *   :210 medirYGuardar  → well_known_valido: false clavado (si nadie inyectaba extrasDe: el alta)
 *   :286 cuerpoVerificado (ficha de la página) → AUSENTE
 *   :458 notaParaApi (ficha de la API/MCP)     → false clavado
 * Desde hoy los cuatro pasan por extrasNota() (lib/qready-wellknown.mjs); notaPublica sólo entrega el
 * dato crudo (inventario_verificado_en). Este guardia lo exige por la SALIDA, no por el texto: arma el
 * caso con datos de prueba en una D1 EN MEMORIA (nunca la de producción) y lee la letra en cada camino:
 *   1 notaPublica   → la letra del sello SVG y la `nota` de la API
 *   2 medirYGuardar → la letra que guarda la medición (resumen del cron) y la tabla de la página
 *   3 ficha de la página (RQ.S.00 en el HTML de /es/verificado/<dominio>)
 *   4 ficha de la API (RQ.S.00 de presentacion.ficha en notaParaApi)
 *
 *  · GRITO   A con /.well-known válido e inventario verificado: tabla, ficha y API dicen A+, las tres.
 *  · SILENCIO el mismo dominio sin inventario: A en las tres. Con inventario pero sin llave de firma
 *            (documento no servible → well-known inválido): A en las tres.
 *  · MUTACIÓN (copias del archivo con UN cambio, scripts/lib/mutar.mjs): cada uno de los cuatro caminos
 *            vuelto a su forma vieja, los dos modos (AUSENTE: 1 y 3; false clavado: 2 y 4). Cada una tiene
 *            que hacer gritar al comparador.
 *
 * QUÉ NO CUBRE. La letra guardada se calcula al medir y la ficha al servir: si el /.well-known vence o el
 * inventario se marca entre la medición y la visita, pueden diferir hasta la medición siguiente (lo
 * declara extrasNota). No mide el sello SVG: ése lee la misma letra guardada que la tabla. No consulta
 * el /.well-known de un tercero: el caso usa el documento propio, que se sirve sin red. El alta
 * (comprobar → medirYGuardar) usa la MISMA función que el cron; se ejerce el cron, no el alta.
 *   node scripts/check-qready-una-letra.mjs
 */
import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
registerHooks({ resolve: (esp, ctx, sig) => esp === "cloudflare:sockets"
  ? { url: "data:text/javascript,export function connect(){throw new Error('sin sockets en el guardia')}", shortCircuit: true } : sig(esp, ctx) });
const N = await import("../public/js/qex-nucleo.mjs");
const V = await import("../lib/qready-verificado.mjs");
const WK = await import("../public/js/qready-wellknown.mjs");
const { d1EnMemoria } = await import("./lib/d1-memoria.mjs");

export const CONSUMIDOR = { quien: "sesion web de Rosetta", hace: "corrige lib/qready-verificado.mjs o lib/qready-wellknown.mjs para que cron, página y API saquen las extras de extrasNota() antes de desplegar" };

const raiz = new URL("../", import.meta.url);
const leer = (r) => readFileSync(new URL(r, raiz), "utf8");
const ESQ = [new URL("db/qready-verificado.schema.sql", raiz), new URL("db/medicion-agentes.schema.sql", raiz)];
const DOMINIO = "rosettaquantum.com";
const TOKENS = { paper: "#F4F5F1", panel: "#FBFBF9", ink: "#16181B", "ink-60": "#4A4E48", line: "#D9DBD6", verdict: "#0C7268", pending: "#8A6520", alert: "#B4432F" };
const fallas = [];
let casos = 0;
const igual = (a, b, q) => { casos++; if (JSON.stringify(a) !== JSON.stringify(b)) fallas.push(`${q}: esperaba ${JSON.stringify(b)}, dio ${JSON.stringify(a)}`); };
const silenciar = () => { const o = [console.error, console.log]; console.error = () => {}; console.log = () => {}; return () => { [console.error, console.log] = o; }; };

// La foto: la ficha A aprobada (scripts/fixtures/ficha/a.json), con el dominio cambiado y vuelta a sellar.
const { foto: fa } = JSON.parse(leer("scripts/fixtures/ficha/a.json"));
const { sha256: _viejo, ...resto } = fa;
const FOTO = await N.sellarFoto({ ...resto, dominio: DOMINIO, www: "www." + DOMINIO });
igual([N.notaQEX(FOTO, {}), N.notaQEX(FOTO, { well_known_valido: true, inventario_verificado: true })], ["A", "A+"],
  "la foto de prueba es A desde afuera y A+ con las dos extras (si no, el caso no prueba nada)");

// Una llave Ed25519 de prueba, en memoria: el documento propio se firma con ella al servirlo.
const par = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
const JWK = JSON.stringify({ ...(await crypto.subtle.exportKey("jwk", par.privateKey)), kid: "rq-guardia-prueba" });
const ASSETS = { fetch: async () => new Response("", { status: 404 }) };
// La página de rosettaquantum.com en A+ exige la nota de autoverificación (lib/qready-autoverificacion.mjs):
// se le pasan los .md aprobados como se los pasa lib/qready-rutas.mjs en el Worker.
const AUTOVERIFICACION = { es: leer("src/data/q-ready/autoverificacion/es.md"), en: leer("src/data/q-ready/autoverificacion/en.md") };

// El caso, con el esquema REAL en memoria: dominio verificado y público, inventario marcado o no.
async function caso(Vx, { inventario, conLlave = true }) {
  const db = d1EnMemoria(...ESQ);
  const token = V.generarToken();
  await db.prepare("INSERT INTO qready_dominios (token, dominio, sector, publico, entorno, creado_utc, verificado_en, inventario_verificado_en) VALUES (?1,?2,'banca',1,'produccion',?3,?3,?4)")
    .bind(token, DOMINIO, "2026-11-13T00:00:00.000Z", inventario ? "2026-11-18T00:00:00.000Z" : null).run();
  const env = { DB: db, ASSETS, ...(conLlave ? { QREADY_FIRMA_JWK: JWK } : {}) };
  const resolver = async () => ({ estado: "respuesta", valores: [V.valorTxt(token)], detalle: "DNS NOERROR" });
  const tomarFoto = async () => ({ foto: FOTO });
  const restaurar = silenciar();
  let cron, html, api, sello;
  try {
    cron = await Vx.cronVerificados(env, { tomarFoto, resolver, ahora: "2026-11-18T09:17:00.000Z" });
    const url = new URL(`https://${DOMINIO}/es/verificado/${DOMINIO}`);
    html = await (await Vx.manejarVerificado(new Request(url), env, url, null, { tokens: TOKENS, autoverificacion: AUTOVERIFICACION })).text();
    api = (await Vx.notaParaApi(env, DOMINIO, new URL(`https://${DOMINIO}/`))).cuerpo;
    const us = new URL(`https://${DOMINIO}/sello/${DOMINIO}.svg`);
    sello = await (await Vx.manejarVerificado(new Request(us), env, us, null, { tokens: TOKENS, autoverificacion: AUTOVERIFICACION })).text();
  } finally { restaurar(); }
  const tabla = (html.match(/<td class="qv-n">([^<]*)<\/td>/) || [])[1] ?? null;
  const fichaPag = (html.match(/>RQ\.S\.00 · [^<]*<\/div><div class="rf-l">([^<]*)</) || [])[1] ?? null;
  const rq00 = api.presentacion?.ficha?.indicadores?.["RQ.S.00"];
  const selloLetra = (sello.match(/font-size="32"[^>]*>([^<]*)<\/text>/) || [])[1] ?? null;
  return { cron: cron[0]?.medicion?.nota ?? null, tabla, ficha_pagina: fichaPag, api_nota: api.nota ?? null, sello: selloLetra, api_ficha: rq00 ? rq00.valor : null };
}
// Los cuatro caminos y la lectura que sale de cada uno. El denominador se cuenta de aquí, no se escribe.
const CAMINOS = [
  ["1 notaPublica (:128)", (r) => [r.sello, r.api_nota]],
  ["2 medirYGuardar (:210)", (r) => [r.cron, r.tabla]],
  ["3 ficha de la página (:286)", (r) => [r.ficha_pagina]],
  ["4 ficha de la API (:458)", (r) => [r.api_ficha]],
];
const letras = (r) => CAMINOS.flatMap(([, f]) => f(r));
const porCamino = (r, esperada) => CAMINOS.filter(([, f]) => f(r).every((l) => l === esperada)).length;
// Una lectura que no se pudo hacer (null) NO cuenta como «otra letra»: haría gritar a un mutante por un
// extractor roto. Por eso cada mutante exige además que las seis lecturas existan y nombra la que rompe.
const unaLetra = (r) => new Set(letras(r)).size === 1 && letras(r)[0] != null;
const completa = (r) => !letras(r).includes(null);

// ---------------------------------------------------------------- el caso que grita: A+ en las cinco lecturas
const conInv = await caso(V, { inventario: true });
if (conInv.cron !== "A+" && WK.validarForma(JSON.parse(leer("lib/datos/q-ready-rosetta.json"))).some((e) => /venció/.test(e)))
  fallas.push("lib/datos/q-ready-rosetta.json venció (expires): renuévelo; sin documento vigente no hay A+ y este guardia no prueba nada");
igual(letras(conInv), Array(6).fill("A+"), "A + /.well-known válido + inventario: los 4 caminos (sello, nota API, medición, tabla, ficha página, ficha API) dicen A+");
const comprobadosAmas = porCamino(conInv, "A+");

// ---------------------------------------------------------------- silencio
const sinInv = await caso(V, { inventario: false });
igual(letras(sinInv), Array(6).fill("A"), "SILENCIO: sin inventario sigue en A en los 4 caminos");
const comprobadosA = porCamino(sinInv, "A");
const sinLlave = await caso(V, { inventario: true, conLlave: false });
igual(letras(sinLlave), Array(6).fill("A"), "SILENCIO: inventario marcado pero /.well-known no servible (sin llave) → A en los 4 caminos");

// ---------------------------------------------------------------- una sola definición, leída del código
const codigo = (r) => leer(r).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const qv = codigo("lib/qready-verificado.mjs");
igual([/well_known_valido\s*:|inventario_verificado\s*:/.test(qv), (qv.match(/extrasNota\(/g) || []).length], [false, 3],
  "lib/qready-verificado.mjs no arma extras propias: tres llamadas a extrasNota (medición, página, API; notaPublica sólo da el dato crudo) y ningún literal well_known_valido/inventario_verificado");
igual(/extrasDe|extrasWellKnown/.test(codigo("lib/qready-rutas.mjs") + qv), false, "ya no hay extras inyectadas por otro camino (extrasDe)");

// ---------------------------------------------------------------- mutaciones: cada una tiene que gritar
const mutaciones = [
  ["1 notaPublica vuelve a dar inventario_verificado y la API arma sus extras con eso (well_known AUSENTE)", "ausente", "api_ficha", [
    ["    inventario_verificado_en: fila.inventario_verificado_en };", "    inventario_verificado: fila.inventario_verificado_en != null };"],
    ["extras: await extrasNota({ dominio: n.dominio, inventario_verificado_en: n.inventario_verificado_en }, env) });", "extras: { inventario_verificado: n.inventario_verificado } });"]]],
  ["2 medirYGuardar vuelve a guardar con well_known_valido: false clavado", "false", "cron", [
    ["  const ex = await extrasNota(fila, env);", "  const ex = { inventario_verificado: fila.inventario_verificado_en != null, well_known_valido: false };"]]],
  ["3 la ficha de la página vuelve a armarse sin well_known_valido (AUSENTE)", "ausente", "ficha_pagina", [
    ["    const extras = await extrasNota(fila, env);\n", "    const extras = { inventario_verificado: fila.inventario_verificado_en != null };\n"],
    ["  if (!extras || typeof extras.well_known_valido !== \"boolean\" || typeof extras.inventario_verificado !== \"boolean\")\n    throw new Error(\"cuerpoVerificado: faltan las extras de la nota (extrasNota)\");\n", ""]]],
  ["4 la ficha de la API vuelve a fijar well_known_valido: false", "false", "api_ficha", [
    ["extras: await extrasNota({ dominio: n.dominio, inventario_verificado_en: n.inventario_verificado_en }, env) });", "extras: { inventario_verificado: n.inventario_verificado_en != null, well_known_valido: false } });"]]],
];
const salidaMutantes = [];
// Varios cambios en el mismo archivo: se aplican todos a UNA copia hermana (así sus imports relativos
// resuelven), se importa, se prueba y se borra. Como scripts/lib/mutar.mjs, AFIRMA que cada texto a
// cambiar aparece exactamente una vez: un mutante que no entra parece un guardia mudo.
const { writeFileSync, rmSync } = await import("node:fs");
async function mutar(cambios, prueba) {
  let texto = leer("lib/qready-verificado.mjs");
  for (const [de, a] of cambios) {
    const veces = texto.split(de).length - 1;
    if (veces !== 1) throw new Error(`mutación: el texto a cambiar aparece ${veces} veces (tiene que ser 1): ${de.slice(0, 80)}`);
    texto = texto.replace(de, () => a);
  }
  const tmp = new URL(`lib/.qready-verificado.mutante-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`, raiz);
  writeFileSync(tmp, texto);
  try { return await prueba(await import(tmp.href)); } finally { rmSync(tmp, { force: true }); }
}
const modos = new Set();
for (const [nombre, modo, rota, cambios] of mutaciones) {
  let r;
  try { r = await mutar(cambios, (M) => caso(M, { inventario: true })); }
  catch (e) { casos++; fallas.push(`MUTACIÓN: ${nombre} → no se pudo aplicar (${e.message}): un mutante que no entra parece un guardia mudo`); continue; }
  salidaMutantes.push(`  mutante «${nombre}»: sello ${r.sello} · nota API ${r.api_nota} · medición ${r.cron} · tabla ${r.tabla} · ficha página ${r.ficha_pagina} · ficha API ${r.api_ficha} → ${unaLetra(r) ? "UNA letra (el guardia NO grita)" : "DOS letras: grita"}`);
  igual([completa(r), r[rota], unaLetra(r)], [true, "A", false], `MUTACIÓN: ${nombre} → seis lecturas, «${rota}» cae a A y el comparador ve dos letras`);
  if (completa(r) && r[rota] === "A" && !unaLetra(r)) modos.add(modo);
}
igual([...modos].sort(), ["ausente", "false"], "las mutaciones cubren los dos modos de fallo (ausente y false clavado)");

console.log(salidaMutantes.join("\n"));
if (fallas.length) {
  console.error(`check-qready-una-letra: ${fallas.length} de ${casos} fallaron`);
  for (const f of fallas) console.error("  ✗ " + f);
  process.exit(1);
}
console.log(`check-qready-una-letra: ok (${casos} casos · ${comprobadosAmas} de ${CAMINOS.length} caminos comprobados en A+ y ${comprobadosA} de ${CAMINOS.length} en A sin inventario · ${mutaciones.length} de ${mutaciones.length} mutaciones gritan, modos ausente y false)`);
