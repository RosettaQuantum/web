#!/usr/bin/env node
/**
 * verificar_dominio por MCP (24-nov-2026): el agente consulta e inicia por el MISMO camino que la página.
 *
 * POR QUÉ. Hasta hoy el MCP no podía ni consultar ni comprobar una verificación de dominio: la página
 * /q-ready/verificar sí. La herramienta nueva NO tiene camino propio: sin token lee dominioPublico() (la
 * compuerta del sello) y con token llama comprobarPedido(), la misma función que POST
 * /api/qready/verificado/comprobar. Este guardia lo exige por la salida, con D1 en memoria:
 *  · tools/list (HERRAMIENTAS de api.js) expone verificar_dominio con dominio, token e idioma.
 *  · sin token: dominio sin verificar → publicado false y el enlace prellenado a /es/q-ready/verificar.
 *  · SILENCIO de la privacidad: verificado en PRIVADO → la respuesta es idéntica a la de uno sin verificar.
 *  · con token (modo de prueba del preview, TXT simulado): ausente → no verifica; presente → verificado,
 *    con página y sello; y la respuesta de la ruta de la página trae los mismos campos y valores.
 *  · el alta NO existe por MCP: la herramienta no escribe un pedido nuevo (cuenta de filas igual).
 *  · token mal formado → 400 sin tocar la base.
 *   node scripts/check-mcp-verificar.mjs
 */
import { registerHooks } from "node:module";
registerHooks({ resolve: (esp, ctx, sig) => esp === "cloudflare:sockets"
  ? { url: "data:text/javascript,export function connect(){throw new Error('sin sockets en el guardia')}", shortCircuit: true } : sig(esp, ctx) });
// El límite por IP usa caches.default (el borde); en Node, una caché en memoria con la misma forma.
const memoria = new Map();
globalThis.caches = { default: { match: async (k) => (memoria.has(k.url) ? new Response(memoria.get(k.url)) : undefined),
  put: async (k, r) => { memoria.set(k.url, await r.text()); } } };
const V = await import("../lib/qready-verificado.mjs");
const { HERRAMIENTAS } = await import("../api.js");
const { d1EnMemoria } = await import("./lib/d1-memoria.mjs");

export const CONSUMIDOR = { quien: "sesión web de Rosetta", hace: "corrige lib/qready-verificado.mjs (verificacionParaApi / comprobarPedido) o api.js antes de desplegar el MCP" };

const raiz = new URL("../", import.meta.url);
const ESQ = [new URL("db/qready-verificado.schema.sql", raiz), new URL("db/medicion-agentes.schema.sql", raiz)];
const fallas = [];
let casos = 0;
const igual = (a, b, q) => { casos++; if (JSON.stringify(a) !== JSON.stringify(b)) fallas.push(`${q}: esperaba ${JSON.stringify(b)}, dio ${JSON.stringify(a)}`); };
const PROD = new URL("https://rosettaquantum.com/mcp");
const PREV = new URL("https://rosetta-quantum-preview.ejemplo.workers.dev/mcp");
const cuantas = async (db) => (await db.prepare("SELECT COUNT(*) AS n FROM qready_dominios").first()).n;

// ---------------------------------------------------------------- tools/list
const h = HERRAMIENTAS.find((x) => x.name === "verificar_dominio");
igual([!!h, Object.keys(h?.inputSchema?.properties || {}), h?.inputSchema?.properties?.idioma?.enum], [true, ["dominio", "token", "idioma"], ["es", "en"]],
  "tools/list expone verificar_dominio con dominio, token e idioma");
igual(HERRAMIENTAS.filter((x) => x.name === "verificar_dominio").length, 1, "una sola definición");

// ---------------------------------------------------------------- sin token
{
  const db = d1EnMemoria(...ESQ);
  const nada = (await V.verificacionParaApi({ DB: db }, { dominio: "https://www.Cliente.example/x" }, PROD)).cuerpo;
  igual([nada.ok, nada.dominio, nada.publicado, nada.pagina, nada.iniciar?.pagina, nada.iniciar?.txt_nombre],
    [true, "cliente.example", false, null, "https://rosettaquantum.com/es/q-ready/verificar/?dominio=cliente.example", "_qready.cliente.example"],
    "sin verificar: publicado false y el enlace prellenado para iniciar");
  igual((await V.verificacionParaApi({ DB: db }, { dominio: "no es dominio" }, PROD)).http, 400, "dominio inválido: 400");
  igual((await V.verificacionParaApi({ DB: db }, { dominio: "cliente.example", idioma: "en" }, PROD)).cuerpo.iniciar.pagina,
    "https://rosettaquantum.com/q-ready/verificar/?dominio=cliente.example", "idioma en: la página en inglés");
  // verificado en PRIVADO: la respuesta no puede distinguirse de la de un dominio sin verificar
  const priv = await V.alta(db, { dominio: "privado.example", sector: "banca", publico: false });
  await V.comprobar(db, priv.token, async () => ({ estado: "respuesta", valores: [V.valorTxt(priv.token)], detalle: "DNS NOERROR" }));
  const sinVer = (await V.verificacionParaApi({ DB: db }, { dominio: "otro.example" }, PROD)).cuerpo;
  const privado = (await V.verificacionParaApi({ DB: db }, { dominio: "privado.example" }, PROD)).cuerpo;
  const sinDominio = (o) => JSON.stringify(o).replaceAll(o.dominio, "X");
  igual(sinDominio(privado), sinDominio(sinVer), "SILENCIO: un dominio verificado en privado responde igual que uno sin verificar");
  // público
  const pub = await V.alta(db, { dominio: "publico.example", sector: "banca", publico: true });
  await V.comprobar(db, pub.token, async () => ({ estado: "respuesta", valores: [V.valorTxt(pub.token)], detalle: "DNS NOERROR" }));
  const p = (await V.verificacionParaApi({ DB: db }, { dominio: "publico.example" }, PROD)).cuerpo;
  igual([p.publicado, p.pagina, p.sello], [true, "https://rosettaquantum.com/es/verificado/publico.example", "https://rosettaquantum.com/sello/publico.example.svg"],
    "verificado y público: página y sello");
  const antes = await cuantas(db);
  await V.verificacionParaApi({ DB: db }, { dominio: "nuevo.example" }, PROD);
  igual(await cuantas(db), antes, "sin token la herramienta no escribe ningún pedido (el alta sigue en la página, con Turnstile)");
}

// ---------------------------------------------------------------- con token (modo de prueba del preview)
{
  const db = d1EnMemoria(...ESQ);
  const env = { DB: db, QREADY_PRUEBA_DNS: "1" };
  const a = await V.alta(db, { dominio: "cliente.example", sector: "banca", publico: true }, "preview-prueba");
  const b = await V.alta(db, { dominio: "cliente2.example", sector: "banca", publico: true }, "preview-prueba");
  const ausente = (await V.verificacionParaApi(env, { token: a.token }, PREV, "203.0.113.8")).cuerpo;
  igual([ausente.ok, ausente.estado, ausente.verificado, ausente.pagina], [true, "ausente", false, null], "con token y sin TXT: no verifica");
  await db.prepare("UPDATE qready_dominios SET txt_prueba = ?2 WHERE token = ?1").bind(a.token, V.valorTxt(a.token)).run();
  await db.prepare("UPDATE qready_dominios SET txt_prueba = ?2 WHERE token = ?1").bind(b.token, V.valorTxt(b.token)).run();
  const mcp = (await V.verificacionParaApi(env, { token: a.token }, PREV, "203.0.113.8")).cuerpo;
  igual([mcp.estado, mcp.verificado, mcp.cambio, mcp.publico, mcp.pagina, mcp.sello],
    ["presente", true, "verificado", true, `${PREV.origin}/es/verificado/cliente.example`, `${PREV.origin}/sello/cliente.example.svg`],
    "con token y TXT presente: verificado, con página y sello del entorno");
  // la ruta de la página con el otro pedido: los mismos campos y valores (salvo el dominio)
  const url = new URL(`${PREV.origin}/api/qready/verificado/comprobar`);
  const ruta = await (await V.manejarVerificado(new Request(url, { method: "POST", body: JSON.stringify({ token: b.token }), headers: { "cf-connecting-ip": "203.0.113.9" } }),
    env, url, null, {})).json();
  const comun = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => !["pagina", "sello"].includes(k)).map(([k, v]) => [k, typeof v === "string" ? v.replaceAll(o.dominio, "X") : v]));
  igual(comun(mcp), comun(ruta), "la herramienta y el botón «Comprobar» de la página devuelven lo mismo");
  igual((await V.verificacionParaApi(env, { token: "no-es-un-token" }, PREV, "203.0.113.8")).http, 400, "token mal formado: 400");
}

if (fallas.length) {
  console.error(`check-mcp-verificar: ${fallas.length} FALLA(S) de ${casos} casos`);
  for (const f of fallas) console.error("  ✗ " + f);
  process.exit(1);
}
console.log(`check-mcp-verificar: ok (${casos} casos · consulta sin token, privado = sin verificar, comprobar = botón de la página, sin alta por MCP)`);
