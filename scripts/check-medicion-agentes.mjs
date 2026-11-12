#!/usr/bin/env node
/**
 * El QEX que recibe un agente es el mismo que ve la persona en la página, y registrar quién mide
 * nunca tumba la medición (12-nov-2026).
 *
 * POR QUÉ EXISTE. POST /v1/medicion y la herramienta MCP medir_exposicion_pqc ahora devuelven el
 * QEX, que antes sólo calculaba el navegador. El modo de fallo es silencioso: dos caminos que
 * eligen distinto qué nombres sondear, o el servidor que mide sin el registro de certificados, o
 * con otra referencia por sector, dan DOS QEX para el mismo dominio y ninguno parece roto.
 *
 * Se ejerce el código real de lib/medicion-agentes.mjs con los manejadores sustituidos por
 * respuestas REALES grabadas de producción (scripts/fixtures/medicion-agentes/: /api/ct y
 * /api/sondas para un dominio público ajeno, capturadas el 12-nov-2026 con los nombres que la página
 * habría pedido). Comprueba:
 *  1. QEX del servidor = armarFoto con los mismos insumos, siguiendo el orden de la página; y que
 *     el servidor le pidió a las sondas EXACTAMENTE los nombres que pediría la página.
 *     Grito: con otro sector, o con el registro de certificados caído, el comparador lo detecta.
 *  2. La página usa las mismas funciones compartidas (sin copia propia de la regla) y la misma
 *     referencia por sector que importa el servidor.
 *  3. El registro: una fila por medición, sin IP cruda, con canal y agente; una base que falla o
 *     que no confirma la fila no cambia la respuesta; 400 y 429 no escriben.
 *  4. La lista de sectores que anuncian api.js (MCP y OpenAPI) es la de la referencia.
 *   node scripts/check-medicion-agentes.mjs
 */
import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
// lib/informe-envivo.mjs importa "cloudflare:sockets", que sólo existe en Workers. Aquí no se abre
// ningún socket: los manejadores se sustituyen por respuestas grabadas.
registerHooks({ resolve: (esp, ctx, sig) => esp === "cloudflare:sockets"
  ? { url: "data:text/javascript,export function connect(){throw new Error('sin sockets en el guardia')}", shortCircuit: true } : sig(esp, ctx) });
const A = await import("../lib/medicion-agentes.mjs");
const N = await import("../public/js/qex-nucleo.mjs");

export const CONSUMIDOR = { quien: "sesion web de Rosetta", hace: "corrige lib/medicion-agentes.mjs (o la página) hasta que el QEX de la API vuelva a ser el de la página, antes de desplegar" };

const fallas = [];
const igual = (a, b, q) => { if (JSON.stringify(a) !== JSON.stringify(b)) fallas.push(`${q}: esperaba ${JSON.stringify(b)}, dio ${JSON.stringify(a)}`); };
const raiz = new URL("../", import.meta.url);
const leer = (r) => readFileSync(new URL(r, raiz), "utf8");
const sinComentarios = (t) => t.replace(/^\s*\/\*[\s\S]*?\*\/\s*$/gm, "").replace(/^\s*\/\/.*$/gm, "").replace(/^\s*\*.*$/gm, "");

// ---------------------------------------------------------------- insumos reales grabados
const DOMINIO = "python.org";
const FX = "scripts/fixtures/medicion-agentes/";
const CT_TEXTO = gunzipSync(readFileSync(new URL(FX + "ct-python.org.json.gz", raiz))).toString("utf8");
const CT = JSON.parse(CT_TEXTO);
const SONDAS = JSON.parse(leer(FX + "sondas-python.org.json"));
const REF = JSON.parse(leer("public/data/qex-referencia-2026-08.json"));
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });

function manejadores({ ctCaido = false, limite = false } = {}) {
  const vistos = { sondas: [] };
  return { vistos, m: {
    ct: async () => ctCaido ? json({ ok: false, error: "el registro público no respondió", intentos: [{ fuente: "crt.sh", ms: 1, error: "crt.sh respondió 502" }] }, 503) : json(CT),
    sondas: async (req) => { const b = await req.json(); vistos.sondas.push(b); return limite ? json({ ok: false, error: "Demasiadas mediciones seguidas. Espera un minuto." }, 429) : json(SONDAS); },
    correo: async () => json({ ok: true, id: "c0ffee" }),
  } };
}
function dbFalsa(modo = "bien") {
  const filas = [];
  return { filas, DB: { prepare: (sql) => ({ bind: (...a) => ({ first: async () => {
    if (modo === "lanza") throw new Error("D1_ERROR: no such table: mediciones_agentes");
    filas.push({ sql, a });
    if (modo === "muda") return null;
    return /RETURNING id/.test(sql) ? { id: a[0] } : null;
  } }) }) } };
}
const IP = "203.0.113.77";
const UA = "agente-de-prueba/1.0";
const medirCon = (entrada, { canal = "api", env = { DB: dbFalsa().DB }, ...op } = {}) => {
  const h = manejadores(op);
  return A.medirParaAgente(env, entrada, { canal, ip: IP, user_agent: UA }, null, h.m).then((r) => ({ r, h }));
};

// ---------------------------------------------------------------- 1 · QEX del servidor = página
// Lo que hace la página (public/js/medicion-envivo.mjs), paso por paso, con los mismos insumos.
async function qexDeLaPagina(entradaDominio, vertical, ctResp) {
  const dominio = N.dominioDeEntrada(entradaDominio);
  const ct = ctResp ? await N.ctDesdeServidor(ctResp, 0) : null;
  const mapa = ct ? N.nombresCT(ct.filas, dominio) : null;
  const hosts = mapa ? N.hostsCT(mapa, dominio) : [];
  const { pedidos } = N.nombresASondear(hosts, null);
  const { detalle } = N.armarFoto({ dominio, www: "www." + dominio, vertical, medido: "2026-11-12T00:00:00.000Z", ct, sondas: SONDAS, referencia: REF, origen: "página" });
  return { qex: detalle.q.score, dims: detalle.q.dimensiones, pedidos };
}
// El comparador: qué tiene que coincidir entre el servidor y la página.
function comparar(cuerpo, pagina, vistosSondas) {
  const f = [];
  if (cuerpo.qex?.valor !== pagina.qex) f.push(`QEX del servidor ${cuerpo.qex?.valor} ≠ página ${pagina.qex}`);
  for (const k of Object.keys(N.PESOS))
    if (cuerpo.qex?.dimensiones?.[k]?.valor !== pagina.dims[k]) f.push(`dimensión ${k}: servidor ${cuerpo.qex?.dimensiones?.[k]?.valor} ≠ página ${pagina.dims[k]}`);
  if (JSON.stringify(vistosSondas[0]?.sensibles) !== JSON.stringify(pagina.pedidos)) f.push(`nombres sondeados: servidor ${JSON.stringify(vistosSondas[0]?.sensibles)} ≠ página ${JSON.stringify(pagina.pedidos)}`);
  return f;
}

const pagina = await qexDeLaPagina("https://www." + DOMINIO + "/", "banca", CT);
// el caso tiene que ejercer la regla: con superficie, nombres sensibles y descuento de higiene
igual(pagina.pedidos.length > 0 && pagina.dims.higiene < 70, true, "los insumos grabados ejercen nombres sensibles y descuento de higiene");
// SILENCIO: el camino real, con la entrada escrita como la escribiría una persona
const s1 = await medirCon({ dominio: "https://www." + DOMINIO + "/", sector: "Banca" }, { env: { DB: dbFalsa().DB } });
igual(s1.r.http, 200, "medición con insumos grabados responde 200");
igual(comparar(s1.r.cuerpo, pagina, s1.h.vistos.sondas), [], "silencio: el servidor y la página dan el mismo QEX, dimensiones y nombres");
igual([s1.r.cuerpo.sector?.clave, s1.r.cuerpo.sector?.mediana, s1.r.cuerpo.sector?.diferencia_con_mediana],
  ["banca", REF.verticales.banca.mediana, pagina.qex - REF.verticales.banca.mediana], "comparación con el sector, de la referencia");
igual(s1.r.cuerpo.registro_ct?.fuente, CT.fuente, "declara la fuente del registro usada");
igual(typeof s1.r.cuerpo.siguiente_paso?.texto === "string" && /^https:\/\//.test(s1.r.cuerpo.siguiente_paso.informe_mensual) && /^https:\/\//.test(s1.r.cuerpo.siguiente_paso.piloto), true, "trae siguiente_paso con sus URLs");
igual(/QEX completo: los calcula la página/.test(JSON.stringify(s1.r.cuerpo)), false, "ya no dice que el QEX lo calcula sólo la página");
// GRITO: otro sector → el comparador lo ve
const s2 = await medirCon({ dominio: DOMINIO, sector: "retail" });
igual(comparar(s2.r.cuerpo, pagina, s2.h.vistos.sondas).length > 0, true, "grito: con otro sector el comparador detecta la diferencia");
// GRITO: el servidor sin registro de certificados → otro QEX, y lo declara
const s3 = await medirCon({ dominio: DOMINIO, sector: "banca" }, { ctCaido: true });
igual(comparar(s3.r.cuerpo, pagina, s3.h.vistos.sondas).length > 0, true, "grito: sin registro de certificados el comparador detecta la diferencia");
igual([s3.r.http, s3.r.cuerpo.registro_ct?.estado], [200, "no_disponible"], "sin registro: mide igual y lo declara");
igual(comparar(s3.r.cuerpo, await qexDeLaPagina(DOMINIO, "banca", null), s3.h.vistos.sondas), [], "sin registro: igual a la página sin superficie");
// sin sector: no inventa un QEX
const s4 = await medirCon({ dominio: DOMINIO });
igual([s4.r.http, s4.r.cuerpo.qex, Array.isArray(s4.r.cuerpo.sectores_validos)], [200, null, true], "sin sector: qex null y la lista de sectores");

// ---------------------------------------------------------------- 2 · la página usa lo mismo
const pag = sinComentarios(leer("public/js/medicion-envivo.mjs"));
for (const f of ["N.dominioDeEntrada(", "N.nombresASondear(", "N.ctDesdeServidor(", "N.armarFoto("])
  if (!pag.includes(f)) fallas.push(`la página ya no usa ${f}…): la regla quedó en dos lugares`);
const copiaPropia = (t) => /\.slice\(0,\s*15\)|CLASES_SENSIBLES\.includes/.test(t);
if (copiaPropia(pag)) fallas.push("la página volvió a escribir su propia regla de qué se sondea");
igual(copiaPropia("const pedidos = todos.slice(0, 15);"), true, "el detector de copia propia grita con la regla vieja");
const refPagina = /fetch\("\/data\/(qex-referencia-[\d-]+\.json)"\)/.exec(pag)?.[1];
const refServidor = /from "\.\.\/public\/data\/(qex-referencia-[\d-]+\.json)"/.exec(leer("lib/medicion-agentes.mjs"))?.[1];
igual([!!refPagina, refPagina === refServidor], [true, true], `la página (${refPagina}) y el servidor (${refServidor}) usan la misma referencia por sector`);

// ---------------------------------------------------------------- 3 · el registro
const SAL = "sal-de-prueba";
const b1 = dbFalsa();
const r1 = await medirCon({ dominio: DOMINIO, sector: "banca", agente: "mi-agente 2.1" }, { canal: "mcp", env: { DB: b1.DB, MEDICION_SAL_IP: SAL } });
igual(b1.filas.length, 1, "una fila por medición");
// la base confirma la fila con RETURNING: una D1 que no devuelve fila no cuenta como escrita
igual(await A.registrar(dbFalsa().DB, { id: "f1", medido_utc: "t", dominio: DOMINIO, canal: "api", ok: true }), true, "registrar() confirma la fila por RETURNING");
const a = b1.filas[0]?.a || [];
const col = (n) => a[["id", "medido_utc", "dominio", "sector", "canal", "agente", "agente_declarado", "ip_hash", "qex", "ok", "error"].indexOf(n)];
igual([col("dominio"), col("sector"), col("canal"), col("agente"), col("agente_declarado"), col("qex"), col("ok")],
  [DOMINIO, "banca", "mcp", UA, "mi-agente 2.1", r1.r.cuerpo.qex.valor, 1], "la fila trae dominio, sector, canal, agente y qex");
igual(a.some((x) => String(x).includes(IP)), false, "la IP cruda no llega a la base");
igual(col("ip_hash"), await N.sha256Hex(`${SAL}|${IP}`), "ip_hash = SHA-256 con sal");
const b0 = dbFalsa();
await medirCon({ dominio: DOMINIO, sector: "banca" }, { env: { DB: b0.DB } });
igual(b0.filas[0]?.a[7], null, "sin sal configurada: ip_hash null, nunca la IP");
const errores = [];
const errorOriginal = console.error;
console.error = (...x) => errores.push(x.join(" "));
for (const modo of ["lanza", "muda"]) {
  const b = dbFalsa(modo);
  const r = await medirCon({ dominio: DOMINIO, sector: "banca" }, { env: { DB: b.DB } });
  igual([r.r.http, r.r.cuerpo.qex?.valor], [200, pagina.qex], `base que ${modo === "lanza" ? "falla" : "no confirma la fila"}: la medición responde igual`);
}
const sinBase = await medirCon({ dominio: DOMINIO, sector: "banca" }, { env: {} });
igual(sinBase.r.http, 200, "sin binding DB: la medición responde igual");
igual(await A.registrar(dbFalsa("muda").DB, { id: "x" }).catch(() => "lanzó"), false, "registrar() sin RETURNING devuelve false, no true");
console.error = errorOriginal;
igual(errores.length === 4 && errores.every((e) => /mediciones_agentes/.test(e)), true, `cada escritura fallida queda en consola (${errores.length} de 4)`);
const b4 = dbFalsa();
const r4 = await medirCon({ dominio: "esto no es un dominio", sector: "banca" }, { env: { DB: b4.DB } });
const r5 = await medirCon({ dominio: DOMINIO, sector: "astrología" }, { env: { DB: b4.DB } });
const r6 = await medirCon({ dominio: DOMINIO, sector: "banca" }, { env: { DB: b4.DB }, limite: true });
igual([r4.r.http, r5.r.http, r6.r.http, b4.filas.length], [400, 400, 429, 0], "dominio inválido, sector inválido y 429 no escriben");
igual(r4.h.vistos.sondas.length + r5.h.vistos.sondas.length, 0, "una entrada inválida no mide nada");

// ---------------------------------------------------------------- 4 · los sectores anunciados
const api = leer("api.js");
const listas = [...api.matchAll(/(?:sector para el QEX y la comparación|Sector key for the QEX): ([a-z_, ]+)"/g)].map((m) => m[1].split(", ").sort());
igual(listas.length, 2, "api.js anuncia los sectores en MCP y en OpenAPI");
for (const l of listas) igual(l, Object.keys(REF.verticales).sort(), "los sectores anunciados son los de la referencia");

if (fallas.length) { console.error("check-medicion-agentes: FALLA\n  " + fallas.join("\n  ")); process.exit(1); }
console.log(`check-medicion-agentes: ok (QEX ${pagina.qex} = página con insumos grabados, gritos de sector y de registro caído, registro sin IP cruda y que no tumba la medición)`);
