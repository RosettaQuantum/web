#!/usr/bin/env node
/**
 * Saludos TLS desde el VPS (13-nov-2026, opción A): lo que el Worker no puede saludar lo saluda la sonda
 * del VPS, con los MISMOS bytes, y si el VPS no responde el borde queda null — nunca «no protegido».
 *
 * POR QUÉ EXISTE. Un Worker no abre sockets hacia Cloudflare, así que todo dominio detrás de Cloudflare
 * quedaba sin borde ni certificado. El arreglo agrega un segundo instrumento, y con él tres modos de
 * fallo mudos: que el VPS mande OTROS bytes (otra medición con el mismo nombre); que un VPS caído o
 * lento se lea como «no soporta» (una F o una D inventada); y que el preview le pase trabajo al VPS de
 * producción. Contra el código que corre:
 *  1. ClientHello TLS 1.3 (A, B, C) y TLS 1.2 del VPS (python) = los del Worker (JS), byte a byte.
 *  2. Con la cola REAL (lib/sonda-tls-vps.mjs, esquema real en SQLite) y la respuesta GRABADA de la sonda
 *     corrida desde este Mac contra rosettaquantum.com: el borde y el certificado quedan medidos desde el
 *     VPS, la foto lo declara y la nota sale de explicarNota (la misma de la página).
 *  3. Sonda inactiva o que no entrega: borde null y sin nota. MUTACIÓN: un tiempo agotado leído como
 *     «no soporta» → aparece una letra → grita.
 *  4. Firmas y entornos: sin firma, firma vieja o clave de producción en el preview → 401; el pedido del
 *     preview no lo toma producción.
 *  5. python.org (el Worker lo saluda bien): no se pide nada al VPS y el QEX no cambia.
 *   node scripts/check-sonda-tls.mjs
 */
import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { spawnSync } from "node:child_process";
registerHooks({ resolve: (esp, ctx, sig) => esp === "cloudflare:sockets"
  ? { url: "data:text/javascript,export function connect(){throw new Error('sin sockets en el guardia')}", shortCircuit: true } : sig(esp, ctx) });
const B = await import("../lib/borde-envivo.mjs");
const I = await import("../lib/informe-envivo.mjs");
const S = await import("../lib/sonda-tls-vps.mjs");
const N = await import("../public/js/qex-nucleo.mjs");
const { d1EnMemoria } = await import("./lib/d1-memoria.mjs");
const { conMutante } = await import("./lib/mutar.mjs");

export const CONSUMIDOR = { quien: "sesion web de Rosetta", hace: "corrige lib/sonda-tls-vps.mjs o vps/sonda-correo/sonda_tls.py antes de desplegar; un VPS que no responde nunca se lee como «no protegido»" };

const fallas = [];
let casos = 0;
const igual = (a, b, q) => { casos++; if (JSON.stringify(a) !== JSON.stringify(b)) fallas.push(`${q}: esperaba ${JSON.stringify(b)}, dio ${JSON.stringify(a)}`); };
const raiz = new URL("../", import.meta.url);
const leer = (r) => readFileSync(new URL(r, raiz), "utf8");
const ESQUEMA = new URL("db/sondas-tls.schema.sql", raiz);
const clon = (x) => JSON.parse(JSON.stringify(x));

// ---------------------------------------------------------------- 1 · los mismos bytes
const py = spawnSync("python3", ["-I", "-c", `
import sys, json; sys.path.insert(0, "vps/sonda-correo")
import sonda_correo as C, sonda_tls as T
z = lambda n: bytes(n)
print(json.dumps({"A": C.hello("www.ejemplo.cl", C.TODOS, True, azar=z).hex(), "B": C.hello("www.ejemplo.cl", C.SOLO_HIB, False, azar=z).hex(),
  "C": C.hello("www.ejemplo.cl", C.LIBRE, False, azar=z).hex(), "T12": T.hello12("www.ejemplo.cl", azar=z).hex()}))`], { cwd: new URL(".", raiz), encoding: "utf8" });
if (py.status !== 0) fallas.push(`python no corrió: ${py.stderr}`);
const P = py.status === 0 ? JSON.parse(py.stdout) : {};
const azarOriginal = crypto.getRandomValues.bind(crypto);
crypto.getRandomValues = (a) => a.fill(0);
const hex = (u8) => Buffer.from(u8).toString("hex");
const J = { A: hex(B.clientHello("www.ejemplo.cl", B.TODOS, true)), B: hex(B.clientHello("www.ejemplo.cl", B.SOLO_HIB, false)),
  C: hex(B.clientHello("www.ejemplo.cl", B.LIBRE, false)), T12: hex(I.clientHello12("www.ejemplo.cl")) };
crypto.getRandomValues = azarOriginal;
for (const k of ["A", "B", "C", "T12"]) igual(P[k], J[k], `ClientHello ${k}: el VPS manda los mismos bytes que el Worker`);

// ---------------------------------------------------------------- insumos reales
const SONDAS_RQ = JSON.parse(leer("scripts/fixtures/qready/sondas-rosettaquantum.com.json"));   // del Worker: «Stream was cancelled.»
const VPS_RQ = JSON.parse(leer("scripts/fixtures/qready/tls-vps-rosettaquantum.com.json"));      // sonda_tls.py desde este Mac
const CT_RQ = JSON.parse(gunzipSync(readFileSync(new URL("scripts/fixtures/qready/ct-rosettaquantum.com.json.gz", raiz))).toString("utf8"));
const SONDAS_PY = JSON.parse(leer("scripts/fixtures/medicion-agentes/sondas-python.org.json"));
const CT_PY = JSON.parse(gunzipSync(readFileSync(new URL("scripts/fixtures/medicion-agentes/ct-python.org.json.gz", raiz))).toString("utf8"));
const REF = JSON.parse(leer("public/data/qex-referencia-2026-08.json"));
const crudoDe = (s) => ({ dominio: s.dominio, www: s.www, borde: clon(s.borde), certificado: clon(s.certificado), endpoints: clon(s.endpoints) });
async function nota(sondas, ctResp, dominio) {
  const ct = await N.ctDesdeServidor(ctResp, 0);
  const { foto, detalle } = N.armarFoto({ dominio, www: "www." + dominio, vertical: "fintech", medido: sondas.medido_utc, ct, sondas, referencia: REF, origen: "guardia" });
  return { x: N.explicarNota(foto), foto, qex: detalle.q.score };
}

// ---------------------------------------------------------------- 2 · la cola real con la sonda grabada
const KEY = "p".repeat(48), KEY_PROD = "q".repeat(48);
const firmar = async (clave, metodo, ruta, cuerpo = "", ts = Math.floor(Date.now() / 1000)) => {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(clave), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const f = Buffer.from(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(S.textoFirmado(metodo, ruta, String(ts), cuerpo)))).toString("hex");
  return { "x-ts": String(ts), "x-firma": f };
};
const llamar = async (env, clave, metodo, ruta, cuerpo = "", ts) => {
  const url = new URL("https://rosetta-quantum-preview.example.workers.dev" + ruta);
  return S.manejarTls(new Request(url, { method: metodo, headers: await firmar(clave, metodo, ruta, cuerpo, ts), body: metodo === "POST" ? cuerpo : undefined }), env, url);
};
// Un VPS de mentira que hace exactamente lo que hace sonda_tls.py (preguntar, entregar), con la respuesta grabada.
async function vpsFalso(env, clave, respuesta, { entregar = true, vueltas = 40 } = {}) {
  for (let i = 0; i < vueltas; i++) {
    const r = await llamar(env, clave, "GET", "/api/sondas/tls/pendiente");
    if (r.status === 200) {
      const t = await r.json();
      if (!entregar) return { tomado: t };
      const cuerpo = JSON.stringify({ ...respuesta, dominio: t.pedido.dominio });
      const e = await llamar(env, clave, "POST", `/api/sondas/tls/${t.id}/resultado`, cuerpo);
      return { tomado: t, entrega: e.status };
    }
    await new Promise((ok) => setTimeout(ok, 50));
  }
  return { tomado: null };
}
const envPrueba = () => ({ DB: d1EnMemoria(ESQUEMA), QREADY_PRUEBA_DNS: "1", SONDA_TLS_CLAVE_PRUEBA: KEY, SONDA_CORREO_CLAVE: KEY_PROD });
const latir = (env) => llamar(env, KEY, "GET", "/api/sondas/tls/pendiente");   // el VPS pregunta: queda el latido

{
  const env = envPrueba();
  await latir(env);
  const pedido = S.pedidoParaVps(crudoDe(SONDAS_RQ));
  igual([pedido.borde, pedido.certificado, pedido.hosts], [true, true, []], "rosettaquantum.com: el Worker no pudo saludar el borde ni leer el certificado → se le pide al VPS");
  const [vps, r] = await Promise.all([vpsFalso(env, KEY, VPS_RQ), S.completarConVps(env, crudoDe(SONDAS_RQ), { esperaMs: 5000, pollMs: 30 })]);
  igual([vps.entrega, r.vps.estado], [200, "hecho"], "la sonda toma el pedido, entrega firmado y el Worker lo lee");
  igual([r.borde.medido_desde, r.borde.veredicto.soporta, r.borde.saludos.B_solo_hibrido.grupo], ["vps", true, "X25519MLKEM768"], "borde medido desde el VPS: soporta X25519MLKEM768 (leído de B)");
  igual([r.certificado.ok, r.certificado.medido_desde, r.certificado.algoritmo != null], [true, "vps", true], "certificado: la hoja del VPS leída con leerHoja() del Worker");
  const s = { ...SONDAS_RQ, borde: r.borde, certificado: r.certificado, endpoints: r.endpoints, vps: r.vps };
  const n = await nota(s, CT_RQ, "rosettaquantum.com");
  igual([n.foto.borde.medido_desde, n.foto.certificado.medido_desde, n.foto.vps.estado], ["vps", "vps", "hecho"], "la foto declara desde dónde se saludó");
  igual(n.x.nota, "A", "rosettaquantum.com con el borde medido por la sonda: A");
  globalThis.__notaRq = n;
}

// ---------------------------------------------------------------- 3 · VPS inactivo o que no entrega
{
  const env = envPrueba();   // sin latido: nadie preguntó
  const t0 = Date.now();
  const r = await S.completarConVps(env, crudoDe(SONDAS_RQ), { esperaMs: 5000, pollMs: 30 });
  igual([r.vps.estado, Date.now() - t0 < 1000, r.borde.veredicto.soporta], ["inactiva", true, null], "sonda inactiva: no se espera, el borde queda null");
  const pendientes = (await env.DB.prepare("SELECT count(*) n FROM sondas_tls").first()).n;
  igual(pendientes, 0, "sonda inactiva: no se crea un pedido que nadie va a tomar");
  const n = await nota({ ...SONDAS_RQ, vps: r.vps }, CT_RQ, "rosettaquantum.com");
  igual([n.x.nota, n.x.motivo], [null, "borde_no_medido"], "sonda inactiva: sin nota, nunca C ni D");
}
async function noEntrega(mod) {
  const env = envPrueba(); await latir(env);
  const [, r] = await Promise.all([vpsFalso(env, KEY, VPS_RQ, { entregar: false }), mod.completarConVps(env, crudoDe(SONDAS_RQ), { esperaMs: 400, pollMs: 30 })]);
  const n = await nota({ ...SONDAS_RQ, borde: r.borde, certificado: r.certificado, vps: r.vps }, CT_RQ, "rosettaquantum.com");
  return { r, n };
}
{
  const { r, n } = await noEntrega(S);
  igual([r.vps.estado, r.borde.veredicto.soporta, n.x.nota], ["sin_respuesta", null, null], "la sonda toma y no entrega: borde null y sin nota");
}
await conMutante(new URL("lib/sonda-tls-vps.mjs", raiz), "return { ...base, vps: { estado: \"sin_respuesta\", id, causa: `la sonda del VPS no entregó en ${esperaMs / 1000} s` } };",
  "return { ...base, borde: { ...base.borde, veredicto: { ...base.borde.veredicto, soporta: false }, saludos: { ...base.borde.saludos, A_como_navegador: { ...base.borde.saludos.A_como_navegador, error: null, grupo: \"x25519\" } } }, vps: { estado: \"sin_respuesta\", id } };",
  async (M) => { const { n } = await noEntrega(M); igual(n.x.nota !== null, true, "MUTACIÓN: un tiempo agotado leído como «no soporta» inventa una letra, y el guardia lo ve"); });
{
  // un VPS que entrega un error (tope por hora, red caída) también deja el borde en null
  const env = envPrueba(); await latir(env);
  const [, r] = await Promise.all([vpsFalso(env, KEY, { instrumento: "x", error: "tope por hora alcanzado: no medido" }), S.completarConVps(env, crudoDe(SONDAS_RQ), { esperaMs: 3000, pollMs: 30 })]);
  igual([r.vps.estado, r.borde.veredicto.soporta], ["sin_respuesta", null], "la sonda entrega un error: borde null, con la causa");
  // y un VPS que tampoco pudo saludar (sus saludos traen error): el veredicto sigue null
  const env2 = envPrueba(); await latir(env2);
  const corte = { grupo: null, hrr: null, alerta: null, error: "TimeoutError: timed out", ms: 8000 };
  const vpsCortado = { ...VPS_RQ, borde: { A_como_navegador: corte, B_solo_hibrido: corte, C_eleccion_libre: corte }, certificado: { der_b64: null, error: "timed out", ms: 8000 } };
  const [, r2] = await Promise.all([vpsFalso(env2, KEY, vpsCortado), S.completarConVps(env2, crudoDe(SONDAS_RQ), { esperaMs: 3000, pollMs: 30 })]);
  igual([r2.borde.medido_desde, r2.borde.veredicto.soporta, r2.certificado.ok], ["vps", null, false], "el VPS tampoco pudo saludar: medido desde el VPS, veredicto null");
}

// ---------------------------------------------------------------- 4 · firmas y entornos
{
  const env = envPrueba();
  const url = new URL("https://x.workers.dev/api/sondas/tls/pendiente");
  igual((await S.manejarTls(new Request(url), env, url)).status, 401, "sin firma → 401");
  igual((await llamar(env, KEY, "GET", "/api/sondas/tls/pendiente", "", Math.floor(Date.now() / 1000) - 600)).status, 401, "firma de hace 10 minutos → 401");
  igual((await llamar(env, KEY_PROD, "GET", "/api/sondas/tls/pendiente")).status, 401, "en el preview, la clave de producción no entra");
  // un pedido creado en el preview no lo ve el VPS de producción (misma base)
  await latir(env);
  const p = S.completarConVps(env, crudoDe(SONDAS_RQ), { esperaMs: 300, pollMs: 30 });
  await new Promise((ok) => setTimeout(ok, 60));
  const envProd = { DB: env.DB, SONDA_CORREO_CLAVE: KEY_PROD };
  const rp = await llamar(envProd, KEY_PROD, "GET", "/api/sondas/tls/pendiente");
  igual(rp.status, 204, "el VPS de producción no toma un pedido del preview");
  await p;
  igual([S.entornoTls({}), S.entornoTls({ QREADY_PRUEBA_DNS: "1" })], ["produccion", "preview-prueba"], "el entorno sale de la variable del preview, no de la URL");
}
// el trabajador de correo que ya corre no ve estos pedidos: rutas y tabla propias
igual(/sondas_correo/.test(leer("lib/sonda-tls-vps.mjs").replace(/\/\/.*$/gm, "")), false, "la cola TLS no toca la tabla del correo");

// ---------------------------------------------------------------- 5 · python.org: sin regresión
{
  igual(S.pedidoParaVps(crudoDe(SONDAS_PY)), null, "python.org: el Worker saludó todo, no se pide nada al VPS");
  const r = await S.completarConVps(envPrueba(), crudoDe(SONDAS_PY));
  igual(r.vps.estado, "no_hizo_falta", "python.org: el VPS ni se consulta");
  const antes = await nota(SONDAS_PY, CT_PY, "python.org");
  const despues = await nota({ ...SONDAS_PY, ...r }, CT_PY, "python.org");
  igual([despues.qex, despues.x.nota], [antes.qex, antes.x.nota], `python.org: mismo QEX (${antes.qex}) y misma nota (${antes.x.nota})`);
}
// cableado: /api/sondas pasa por completarConVps; worker.js enruta /api/sondas/tls
igual([/completarConVps\(env, \{ dominio, www, borde: borde0/.test(leer("lib/informe-envivo.mjs")), /startsWith\("\/api\/sondas\/tls"\)\) return manejarTls/.test(leer("worker.js"))], [true, true], "cableado: /api/sondas → completarConVps; worker.js → manejarTls");

if (fallas.length) { console.error("check-sonda-tls: FALLA\n  " + fallas.join("\n  ")); process.exit(1); }
console.log(`check-sonda-tls: ok (${casos} casos · bytes VPS = Worker · rosettaquantum.com con la sonda grabada = ${globalThis.__notaRq.x.nota} · VPS inactivo o mudo = sin nota · 1 mutación grita)`);
