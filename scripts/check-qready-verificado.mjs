#!/usr/bin/env node
/**
 * Q-Ready Verified, fase 2 (13-nov-2026): la verificación por DNS falla cerrado, un error de red nunca
 * despublica, el sello escapa todo lo que viene de datos y el modo de prueba sólo existe en el preview.
 *
 * POR QUÉ EXISTE. Los dos errores caros de esta fase son mudos:
 *  · una falla de red leída como «borraron el TXT»: el cron despublica a un cliente que no hizo nada;
 *  · un dominio con caracteres raros que entra crudo al SVG del sello, que se incrusta en sitios ajenos.
 * Y uno de configuración: la variable del modo de prueba (DNS simulado) en producción.
 *
 * Contra el código que corre: DNS sobre HTTPS con respuestas con la forma REAL de cloudflare-dns.com
 * (application/dns-json), el esquema REAL en SQLite, el cron con la foto armada desde respuestas
 * grabadas de producción, y wrangler.jsonc tal cual. Grito, silencio y MUTACIONES reales:
 *  · decidirTxt que lee un error como respuesta → el cron despublica por una falla de red → grita;
 *  · escXml que no escapa → el SVG del sello lleva marcado ajeno → grita;
 *  · QREADY_PRUEBA_DNS fuera de env.preview → grita.
 *   node scripts/check-qready-verificado.mjs
 */
import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
registerHooks({ resolve: (esp, ctx, sig) => esp === "cloudflare:sockets"
  ? { url: "data:text/javascript,export function connect(){throw new Error('sin sockets en el guardia')}", shortCircuit: true } : sig(esp, ctx) });
const N = await import("../public/js/qex-nucleo.mjs");
const V = await import("../lib/qready-verificado.mjs");
const { textos, snippetSello } = await import("../public/js/qready-textos.mjs");
const { d1EnMemoria } = await import("./lib/d1-memoria.mjs");
const { conMutante } = await import("./lib/mutar.mjs");

export const CONSUMIDOR = { quien: "sesion web de Rosetta", hace: "corrige lib/qready-verificado.mjs (DNS, cron o sello) o wrangler.jsonc antes de desplegar; nunca despublica por un error de red" };

const fallas = [];
let casos = 0;
const igual = (a, b, q) => { casos++; if (JSON.stringify(a) !== JSON.stringify(b)) fallas.push(`${q}: esperaba ${JSON.stringify(b)}, dio ${JSON.stringify(a)}`); };
const raiz = new URL("../", import.meta.url);
const leer = (r) => readFileSync(new URL(r, raiz), "utf8");
const ESQUEMA = new URL("db/qready-verificado.schema.sql", raiz);
const TOKENS = { paper: "#F4F5F1", panel: "#FBFBF9", ink: "#16181B", "ink-60": "#4A4E48", line: "#D9DBD6", verdict: "#0C7268", pending: "#8A6520", alert: "#B4432F" };
const silenciar = () => { const o = [console.error, console.log]; console.error = () => {}; console.log = () => {}; return () => { [console.error, console.log] = o; }; };

// ---------------------------------------------------------------- DNS sobre HTTPS (forma real)
const doh = (status, answers = [], http = 200) => async () => new Response(JSON.stringify({ Status: status, TC: false, RD: true, RA: true, AD: false, CD: false,
  Question: [{ name: "_qready.x.example", type: 16 }], Answer: answers }), { status: http, headers: { "content-type": "application/dns-json" } });
const txt = (data) => ({ name: "_qready.x.example", type: 16, TTL: 300, data });
const TOKEN = "a".repeat(64);
const casosDns = [
  ["NOERROR con el valor exacto", doh(0, [txt(`"qready-verificacion=${TOKEN}"`)]), "presente"],
  ["NOERROR con el valor partido en dos cadenas", doh(0, [txt(`"qready-verificacion=${TOKEN.slice(0, 30)}" "${TOKEN.slice(30)}"`)]), "presente"],
  ["NOERROR con otro valor", doh(0, [txt('"v=spf1 -all"')]), "ausente"],
  ["NOERROR sin respuestas", doh(0, []), "ausente"],
  ["NXDOMAIN", doh(3, []), "ausente"],
  ["NOERROR con el token de OTRO pedido", doh(0, [txt(`"qready-verificacion=${"b".repeat(64)}"`)]), "ausente"],
  ["SERVFAIL", doh(2, []), "error"],
  ["REFUSED", doh(5, []), "error"],
  ["el resolvedor responde 503", doh(0, [], 503), "error"],
  ["el resolvedor no responde (fetch lanza)", async () => { throw new TypeError("fetch failed"); }, "error"],
  ["respuesta que no es JSON", async () => new Response("<html>", { status: 200 }), "error"],
];
for (const [q, f, esperado] of casosDns) igual(V.decidirTxt(await V.consultarTxtDoh("_qready.x.example", f), TOKEN), esperado, `DNS: ${q} → ${esperado}`);
let pidio = null;
await V.consultarTxtDoh("_qready.x.example", async (u, o) => { pidio = { u, accept: o.headers.accept }; return doh(0)(); });
igual([pidio.u.startsWith("https://cloudflare-dns.com/dns-query?name=_qready.x.example&type=TXT"), pidio.accept], [true, "application/dns-json"], "consulta DoH a cloudflare-dns.com con accept: application/dns-json");

// ---------------------------------------------------------------- token y alta
const tokens = new Set(Array.from({ length: 200 }, () => V.generarToken()));
igual([tokens.size, [...tokens].every((t) => /^[0-9a-f]{64}$/.test(t))], [200, true], "token: 32 bytes al azar en hex, sin repetirse en 200");
{
  const db = d1EnMemoria(ESQUEMA);
  const a = await V.alta(db, { dominio: "https://www.Ejemplo.example/x", sector: "banca", contacto: "ti@ejemplo.example", publico: true }, "produccion", ["banca"]);
  igual([a.ok, a.dominio, a.txt.nombre, a.txt.valor === `qready-verificacion=${a.token}`], [true, "www.ejemplo.example", "_qready.www.ejemplo.example", true], "alta: el registro TXT exacto");
  igual((await V.alta(db, { dominio: "no es dominio", sector: "banca" })).ok, false, "alta: dominio inválido no escribe");
  igual((await V.alta(db, { dominio: "x.example", sector: "astrologia" }, "produccion", ["banca"])).ok, false, "alta: sector desconocido no escribe");
  igual((await db.prepare("SELECT count(*) n FROM qready_dominios").first()).n, 1, "alta: sólo el pedido válido quedó escrito");
}

// ---------------------------------------------------------------- el ciclo: verificar, error de red, ausencia
const REF = JSON.parse(leer("public/data/qex-referencia-2026-08.json"));
const CT = JSON.parse(gunzipSync(readFileSync(new URL("scripts/fixtures/medicion-agentes/ct-python.org.json.gz", raiz))).toString("utf8"));
const SONDAS = JSON.parse(leer("scripts/fixtures/medicion-agentes/sondas-python.org.json"));
// tomarFoto de mentira con insumos reales: lo que devolvería lib/medicion-agentes.mjs → tomarFoto
const tomarFoto = async (env, { dominio, vertical, medido = "2026-11-13T09:17:00.000Z", origen }) => {
  const ct = await N.ctDesdeServidor(CT, 0);
  const { foto, detalle } = N.armarFoto({ dominio, www: "www." + dominio, vertical, medido, ct, sondas: { ...SONDAS, dominio }, referencia: REF, origen });
  return { foto, detalle };
};
const resolverFijo = (estado) => async () => estado === "presente" ? { estado: "respuesta", valores: [`qready-verificacion=${filaToken}`], detalle: "DNS NOERROR" }
  : estado === "ausente" ? { estado: "respuesta", valores: [], detalle: "DNS NXDOMAIN" } : { estado: "error", valores: [], detalle: "sin respuesta del resolvedor: fetch failed" };
let filaToken = null;
async function ciclo(VV) {
  const db = d1EnMemoria(ESQUEMA);
  const env = { DB: db };
  const a = await VV.alta(db, { dominio: "cliente.example", sector: "banca", publico: true });
  filaToken = a.token;
  const r = {};
  r.ausenteAntes = await VV.comprobar(db, a.token, resolverFijo("ausente"));
  r.presente = await VV.comprobar(db, a.token, resolverFijo("presente"));
  r.cron1 = await VV.cronVerificados(env, { tomarFoto, resolver: resolverFijo("presente") });
  r.publicoTras1 = !!(await VV.dominioPublico(db, "cliente.example"));
  r.cronError = await VV.cronVerificados(env, { tomarFoto, resolver: resolverFijo("error") });
  r.publicoTrasError = !!(await VV.dominioPublico(db, "cliente.example"));
  r.estadoTrasError = (await db.prepare("SELECT ultimo_chequeo_estado e FROM qready_dominios WHERE token=?1").bind(a.token).first()).e;
  r.cronAusente = await VV.cronVerificados(env, { tomarFoto, resolver: resolverFijo("ausente") });
  r.publicoTrasAusente = !!(await VV.dominioPublico(db, "cliente.example"));
  r.mediciones = (await db.prepare("SELECT count(*) n FROM qready_mediciones WHERE origen='servidor'").first()).n;
  // un segundo pedido verificado del mismo dominio deja al primero sin verificar
  const b = await VV.alta(db, { dominio: "cliente.example", sector: "banca", publico: false });
  filaToken = a.token; await VV.comprobar(db, a.token, resolverFijo("presente"));
  filaToken = b.token; await VV.comprobar(db, b.token, resolverFijo("presente"));
  r.verificadosDelDominio = (await db.prepare("SELECT count(*) n FROM qready_dominios WHERE dominio='cliente.example' AND verificado_en IS NOT NULL").first()).n;
  r.publicoTrasCambioDeDueno = !!(await VV.dominioPublico(db, "cliente.example"));
  return r;
}
let restaurar = silenciar();
const c = await ciclo(V);
restaurar();
igual([c.ausenteAntes.estado, c.ausenteAntes.verificado], ["ausente", false], "sin TXT no hay verificación");
igual([c.presente.estado, c.presente.cambio, c.presente.verificado], ["presente", "verificado", true], "con el TXT exacto: verificado");
igual([c.cron1[0].txt, !!c.cron1[0].medicion?.sha256, c.publicoTras1], ["presente", true, true], "cron: TXT presente → mide con el mismo camino y guarda la foto del servidor");
igual([c.cronError[0].txt, c.cronError[0].cambio, c.publicoTrasError, c.estadoTrasError], ["error", null, true, "error"], "SILENCIO: un error de red NO despublica; queda anotado");
igual([c.cronAusente[0].txt, c.cronAusente[0].cambio, c.publicoTrasAusente, c.cronAusente[0].medicion], ["ausente", "despublicado", false, undefined], "GRITO: la ausencia confirmada del TXT despublica y no se mide");
igual(c.mediciones, 1, "la misma foto no se guarda dos veces; un dominio despublicado no se mide");
igual([c.verificadosDelDominio, c.publicoTrasCambioDeDueno], [1, false], "un TXT nuevo de otro pedido toma el dominio: queda uno solo verificado (y éste eligió no publicar)");
// MUTACIÓN: un error de red leído como respuesta vacía → el cron despublica a un cliente que no hizo nada
await conMutante(new URL("lib/qready-verificado.mjs", raiz), 'if (!consulta || consulta.estado !== "respuesta") return "error";', 'if (!consulta) return "error";',
  async (M) => { restaurar = silenciar(); const m = await ciclo(M); restaurar(); igual(m.publicoTrasError, false, "MUTACIÓN: si un error de red cuenta como ausencia, el guardia ve la despublicación"); });
await conMutante(new URL("lib/qready-verificado.mjs", raiz), '} catch (e) { return { estado: "error", valores: [], detalle: `sin respuesta del resolvedor: ${e && e.message || e}` }; }',
  '} catch (e) { return { estado: "respuesta", valores: [], detalle: "" }; }',
  async (M) => igual(M.decidirTxt(await M.consultarTxtDoh("_qready.x.example", async () => { throw new TypeError("fetch failed"); }), TOKEN), "ausente", "MUTACIÓN: si la falla de fetch se lee como respuesta, el guardia la ve como «ausente»"));

// ---------------------------------------------------------------- el sello: escapar todo lo que viene de datos
const malo = 'x"><script>alert(1)</script><x a="';
const svgMalo = V.selloSvg({ dominio: malo, nota: '<b>A</b>', fecha: '2026-11-13"><g onload="x', tokens: TOKENS });
const sinMarcadoAjeno = (s) => !/<script|<b>|onload="x|<x /.test(s);
igual(sinMarcadoAjeno(svgMalo), true, "sello: dominio, letra y fecha con marcado llegan escapados");
igual(sinMarcadoAjeno(V.selloNeutro({ dominio: malo, tokens: TOKENS })), true, "sello neutro: también escapa");
const svgBueno = V.selloSvg({ dominio: "rosettaquantum.com", nota: "B", fecha: "2026-11-13T09:17:00.000Z", tokens: TOKENS });
igual([svgBueno.includes(">B</text>"), svgBueno.includes("Q-Ready Verified · Rosetta Quantum"), svgBueno.includes(">2026-11-13</text>"), svgBueno.includes(">rosettaquantum.com</text>")], [true, true, true, true], "sello: letra, firma, fecha de la última medición y dominio");
const neutro = V.selloNeutro({ dominio: "x.example", tokens: TOKENS });
igual([/>[A-DF]\+?<\/text>/.test(neutro), neutro.includes(textos("es").sello_no_verificado)], [false, true], "sello neutro: sin letra, dice «no verificado»");
await conMutante(new URL("lib/qready-verificado.mjs", raiz), 'export const escXml = (s) => String(s ?? "").replace(/[&<>"\']/g,', 'export const escXml = (s) => String(s ?? "").replace(/[]/g,',
  async (M) => igual(sinMarcadoAjeno(M.selloSvg({ dominio: malo, nota: "A", fecha: "2026-11-13", tokens: TOKENS })), false, "MUTACIÓN: con escXml que no escapa, el guardia ve el marcado ajeno en el SVG"));
// la ruta: cabeceras del sello (cache 1 h, tipo SVG, neutro para quien no está publicado)
{
  const db = d1EnMemoria(ESQUEMA);
  const url = new URL("https://rosettaquantum.com/sello/nadie.example.svg");
  const r = await V.manejarVerificado(new Request(url), { DB: db }, url, null, { tokens: TOKENS });
  igual([r.status, r.headers.get("content-type"), r.headers.get("cache-control"), r.headers.get("x-qready-estado")],
    [200, "image/svg+xml; charset=utf-8", "public, max-age=3600", "no-verificado"], "ruta del sello: SVG, cache 1 h, neutro si no está verificado");
}
// el snippet
const sn = snippetSello("rosettaquantum.com", "es");
igual([sn.includes('href="https://rosettaquantum.com/es/verificado/rosettaquantum.com"'), sn.includes('src="https://rosettaquantum.com/sello/rosettaquantum.com.svg"')], [true, true], "snippet: enlaza el sello a /verificado");

// ---------------------------------------------------------------- el modo de prueba sólo en el preview
const sinComentariosJsonc = (t) => t.replace(/^\s*\/\/.*$/gm, "");
const conf = JSON.parse(sinComentariosJsonc(leer("wrangler.jsonc")));
function pruebaFueraDelPreview(c) {
  const malos = [];
  if (c.vars && "QREADY_PRUEBA_DNS" in c.vars) malos.push("nivel superior");
  for (const [n, e] of Object.entries(c.env || {})) if (n !== "preview" && e.vars && "QREADY_PRUEBA_DNS" in e.vars) malos.push(n);
  return malos;
}
igual(pruebaFueraDelPreview(conf), [], "QREADY_PRUEBA_DNS sólo en env.preview");
igual(conf.env?.preview?.vars?.QREADY_PRUEBA_DNS, "1", "el preview tiene su modo de prueba");
igual([conf.triggers?.crons?.length, conf.env?.preview?.triggers?.crons?.length], [1, 0], "un cron en producción y ninguno en el preview (base compartida)");
igual(pruebaFueraDelPreview({ ...conf, vars: { QREADY_PRUEBA_DNS: "1" } }), ["nivel superior"], "MUTACIÓN: la variable en producción → grita");
for (const k of ["/sello/*", "/verificado/*", "/es/verificado/*", "/.well-known/q-ready"]) {
  igual(conf.assets.run_worker_first.includes(k) && conf.env.preview.assets.run_worker_first.includes(k), true, `run_worker_first incluye ${k} en los dos entornos (si no, HEAD da 404 sin pasar por el Worker)`);
}
// y el código: el modo de prueba exige la variable Y *.workers.dev
igual([V.modoPrueba({ QREADY_PRUEBA_DNS: "1" }, new URL("https://rosettaquantum.com/")), V.modoPrueba({}, new URL("https://x.workers.dev/")), V.modoPrueba({ QREADY_PRUEBA_DNS: "1" }, new URL("https://x.workers.dev/"))],
  [false, false, true], "modo de prueba: sólo con la variable y en *.workers.dev");
// las rutas de prueba no existen fuera del modo de prueba
{
  const url = new URL("https://rosettaquantum.com/api/qready/verificado/prueba-txt");
  const r = await V.manejarVerificado(new Request(url, { method: "POST", body: "{}" }), { DB: d1EnMemoria(ESQUEMA) }, url, null, { tokens: TOKENS });
  igual(r.status, 404, "en producción /api/qready/verificado/prueba-txt no existe");
}
// el cron está cableado en worker.js y llama al camino de la medición
const worker = leer("worker.js"), rutas = leer("lib/qready-rutas.mjs");
igual([/async scheduled\(event, env, ctx\)[\s\S]{0,200}cronDiario\(env\)/.test(worker), /import \{ tomarFoto[^}]*\} from "\.\/medicion-agentes\.mjs"/.test(rutas)], [true, true], "scheduled → cronDiario → tomarFoto de lib/medicion-agentes.mjs");

if (fallas.length) { console.error("check-qready-verificado: FALLA\n  " + fallas.join("\n  ")); process.exit(1); }
console.log(`check-qready-verificado: ok (${casos} casos · DNS ${casosDns.length} respuestas reales · error de red no despublica · sello escapado · modo de prueba sólo en el preview · 4 mutaciones gritan)`);
