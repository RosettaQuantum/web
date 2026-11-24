// /.well-known/q-ready (13-nov-2026): el nuestro, firmado, y el validador público.
//
//   GET  /.well-known/q-ready             nuestro documento, firmado al servirlo (Ed25519, WebCrypto).
//   GET  /.well-known/q-ready-keys.json   la llave pública (JWKS).
//   POST /api/qready/well-known/validar   {url} o {json} → forma, firma, vigencia y cruce con lo medido.
//
// LA LLAVE PRIVADA vive en el secreto QREADY_FIRMA_JWK (un JWK Ed25519 con d, x y kid). Nunca se
// imprime, no se loguea y no entra al repositorio. Sin el secreto, /.well-known/q-ready responde 503:
// no se sirve un documento sin firma.
//
// El contenido del documento es lib/datos/q-ready-rosetta.json (PROVISORIO: lo aprueba Nicholas).
// El validador sólo pide /.well-known/q-ready y la URL de llaves que el documento declara (https, del
// mismo dominio, sin redirecciones, 64 KB como máximo): no sirve para pedir otra cosa a otro sitio.
import DOC from "./datos/q-ready-rosetta.json" with { type: "json" };
import * as W from "../public/js/qready-wellknown.mjs";
import { permitido, normalizarHost } from "./borde-envivo.mjs";
import { dominioPublico, medicionesDe, entornoDe, dominioVerificado } from "./qready-verificado.mjs";

const NUESTRO = "rosettaquantum.com";
const MAX = 65536;
const ESPERA_MS = 8000;
const json = (o, s = 200, extra = {}) => new Response(JSON.stringify(o, null, 2), {
  status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra } });
const esPreview = (url) => !!url && /\.workers\.dev$/.test(url.hostname);

function llavePrivada(env) {
  try {
    const j = JSON.parse(env && env.QREADY_FIRMA_JWK || "");
    if (j && j.kty === "OKP" && j.crv === "Ed25519" && typeof j.d === "string" && typeof j.x === "string" && typeof j.kid === "string") return j;
  } catch { /* abajo */ }
  return null;
}

export async function nuestroDocumento(env) {
  const k = llavePrivada(env);
  if (!k) return null;
  return await W.firmar({ ...DOC, signature: { ...DOC.signature, kid: k.kid } }, k);
}
export function nuestrasLlaves(env) {
  const k = llavePrivada(env);
  return k ? { keys: [W.llavePublica(k, k.kid)] } : null;
}

// GET acotado: https, sin redirecciones, tope de tamaño y de tiempo.
async function traer(urlTexto) {
  let u; try { u = new URL(urlTexto); } catch { return { error: "URL inválida" }; }
  if (u.protocol !== "https:" || !normalizarHost(u.hostname)) return { error: "sólo https a un nombre público" };
  const ctl = new AbortController(); const reloj = setTimeout(() => ctl.abort(), ESPERA_MS);
  try {
    const r = await fetch(u.toString(), { redirect: "manual", signal: ctl.signal, headers: { accept: "application/json", "user-agent": "RosettaQ-Ready/1.0 (+https://rosettaquantum.com/q-ready/spec)" } });
    if (r.status >= 300 && r.status < 400) return { error: `respondió ${r.status} (redirección): el documento se sirve directo` };
    if (!r.ok) return { error: `respondió ${r.status}` };
    const t = await r.text();
    if (t.length > MAX) return { error: "más de 64 KB" };
    try { return { cuerpo: JSON.parse(t) }; } catch { return { error: "no es JSON" }; }
  } catch (e) { return { error: e && e.name === "AbortError" ? `sin respuesta en ${ESPERA_MS / 1000} s` : String(e && e.message || e) }; }
  finally { clearTimeout(reloj); }
}

// Las llaves: las nuestras salen de adentro (un Worker no se pide a sí mismo por fetch). En el
// preview, un documento de rosettaquantum.com se valida contra la llave del preview: es la única
// excepción, y sólo existe en *.workers.dev.
async function llavesDe(doc, env, reqUrl) {
  let k; try { k = new URL(doc.signature.keys); } catch { return { error: "signature.keys no es una URL" }; }
  if (k.hostname === reqUrl.hostname || (esPreview(reqUrl) && k.hostname === NUESTRO)) {
    const propias = nuestrasLlaves(env);
    return propias ? { cuerpo: propias, interna: true } : { error: "este servidor no tiene llave configurada" };
  }
  return await traer(k.toString());
}

async function documentoDe(host, env, reqUrl) {
  if (host === reqUrl.hostname || (esPreview(reqUrl) && host === NUESTRO)) {
    const d = await nuestroDocumento(env);
    return d ? { cuerpo: d, interna: true } : { error: "este servidor no tiene llave configurada" };
  }
  return await traer(`https://${host}${W.RUTA}`);
}

// Lo declarado contra lo medido desde afuera. Sólo con una medición del servidor de un dominio
// verificado y público; si no hay, se dice «sin dato», nunca «calza».
export function cruzar(doc, foto) {
  if (!foto) return { estado: "sin_dato", items: [] };
  const items = [];
  const edge = (doc.providers || []).find((p) => p.role === "edge");
  if (edge) {
    const medido = foto.borde ? foto.borde.soporta : null;
    items.push({ campo: "providers.edge", declarado: edge.status, medido: medido == null ? null : medido ? "pq_hybrid" : "classical",
      calza: medido == null ? null : edge.status === "pq_hybrid" ? medido === true : edge.status === "classical" ? medido === false : true });
  }
  const cert = (doc.providers || []).find((p) => p.role === "certificates");
  if (cert && foto.certificado && foto.certificado.ok) {
    const clasico = ["RSA", "EC"].includes(foto.certificado.algoritmo);
    items.push({ campo: "providers.certificates", declarado: cert.status, medido: clasico ? "classical" : foto.certificado.algoritmo,
      calza: cert.status === "pq_hybrid" ? !clasico : true });
  }
  return { estado: items.some((i) => i.calza === false) ? "no_calza" : "calza_o_sin_dato", items };
}

export async function validarEntrada(entrada, env, reqUrl, db = null) {
  let doc = null, origen = null;
  if (entrada.json != null) {
    try { doc = typeof entrada.json === "string" ? JSON.parse(entrada.json) : entrada.json; origen = "json"; }
    catch { return { http: 400, cuerpo: { ok: false, error: "El texto pegado no es JSON." } }; }
  } else if (entrada.url) {
    const host = normalizarHost(String(entrada.url));
    if (!host) return { http: 400, cuerpo: { ok: false, error: "Escriba un dominio o una URL https." } };
    const r = await documentoDe(host, env, reqUrl);
    if (r.error) return { http: 200, cuerpo: { ok: true, valido: false, vigente: false, errores: [`no se pudo leer https://${host}${W.RUTA}: ${r.error}`], fuente: `https://${host}${W.RUTA}` } };
    doc = r.cuerpo; origen = `https://${host}${W.RUTA}`;
  } else return { http: 400, cuerpo: { ok: false, error: "Mande {url} o {json}." } };

  const forma = W.validarForma(doc);
  let jwks = null, llavesError = null;
  if (doc && doc.signature && typeof doc.signature.keys === "string" && !forma.some((e) => e.startsWith("signature.keys"))) {
    const k = await llavesDe(doc, env, reqUrl);
    if (k.error) llavesError = k.error; else jwks = k.cuerpo;
  }
  const v = await W.validar(doc, jwks);
  if (llavesError) v.errores.push(`llaves: ${llavesError}`);
  let cruce = { estado: "sin_dato", items: [] };
  if (db && doc && typeof doc.domain === "string") {
    try {
      const entorno = entornoDe(env, reqUrl);
      const fila = await dominioPublico(db, doc.domain, entorno);
      const [m] = fila ? await medicionesDe(db, fila.dominio, entorno, 1) : [];
      cruce = cruzar(doc, m ? JSON.parse(m.foto_json) : null);
    } catch (e) { console.error("validar: cruce:", e && e.message); }
  }
  return { http: 200, cuerpo: { ok: true, valido: v.valido && !llavesError, vigente: v.vigente, errores: v.errores, firma: v.firma, fuente: origen,
    dominio: doc && doc.domain || null, cruce } };
}

// LAS EXTRAS DE LA NOTA, en UN solo lugar (18-nov-2026). ¿Inventario verificado por Rosetta? ¿El dominio
// publica un /.well-known/q-ready válido y vigente? Las dos sólo cuentan para A+.
// La usan todos los caminos de un dominio verificado: la medición que guarda la letra (cron y alta,
// medirYGuardar), la ficha de /verificado/<dominio> y la API/MCP (notaParaApi, que lee notaPublica).
// EL DEFECTO que la hizo única: cuatro lugares de lib/qready-verificado.mjs armaban las extras, dos sin
// well_known_valido y dos con false clavado; sólo el cron inyectaba el /.well-known. Con el inventario
// marcado la tabla habría dicho A+ y la ficha A en la misma página.
// scripts/check-qready-una-letra.mjs grita si alguna vuelve a armar sus propias extras.
// El /.well-known se consulta SÓLO con el inventario verificado: sin inventario no hay A+ y la respuesta
// no cambia la letra, así que la página y la API no salen a pedir documentos ajenos en cada visita.
// Efecto declarado: un dominio con /.well-known válido y SIN inventario ya no recibe plan_con_fecha en la
// medición (antes sí, sólo en el cron); sólo quitaba la media «certificado_sin_plan», que no mueve la letra.
// Punto ciego: la letra guardada se calcula al medir y la ficha al servir; si el documento vence o el
// inventario se marca entre la medición y la visita, pueden diferir hasta la medición siguiente.
export async function extrasNota(fila, env = {}) {
  const inventario = !!fila && fila.inventario_verificado_en != null;
  const base = { inventario_verificado: inventario, well_known_valido: false, plan_con_fecha: false };
  // Este well_known_valido: false es un valor POR OMISIÓN, no una medición: sin inventario no se miró el
  // /.well-known. No sirve para mostrar «publica / no publica un q-ready firmado»; si algún día se muestra,
  // hay que medirlo de verdad aquí o devolver null («no medido»), nunca este false.
  if (!inventario) return base;
  try {
    const reqUrl = new URL(`https://${NUESTRO}/`);
    const d = await documentoDe(fila.dominio, env, reqUrl);
    if (d.error || !d.cuerpo || d.cuerpo.domain !== fila.dominio) return base;
    const k = await llavesDe(d.cuerpo, env, reqUrl);
    if (k.error) return base;
    const v = await W.validar(d.cuerpo, k.cuerpo);
    return { ...base, well_known_valido: v.valido && v.vigente, plan_con_fecha: v.valido && v.vigente };
  } catch { return base; }
}

// Las extras de una medición EN VIVO (24-nov-2026): la medición para agentes (MCP medir_exposicion_pqc y
// POST /v1/medicion), /api/sondas → la página /q-ready/medicion, y el PDF por correo.
// EL DEFECTO REAL. Con rosettaquantum.com verificado y con inventario, el 24-nov el sello, la página
// /verificado y get_qready_grade decían A+, y la medición en vivo del MISMO dominio, el MISMO día, por MCP y
// por la página, decía A: esos tres caminos llamaban explicarNota(foto) sin extras. Ahora piden las extras
// aquí, con extrasNota() sobre la fila verificada en producción: la misma regla que el cron y el sello.
// Dominio no verificado → {} (desde afuera el máximo sigue siendo A). Falla cerrado: si la base no contesta,
// dominioVerificado dice «no verificado» y esto devuelve {}. `v`: el resultado de dominioVerificado si quien
// llama ya lo tiene (para no consultar dos veces).
// Guardia: scripts/check-medicion-una-letra.mjs.
export async function extrasDeMedicion(env, dominio, v = null) {
  const ver = v || await dominioVerificado(env && env.DB, dominio);
  if (!ver || !ver.verificado) return {};
  return extrasNota({ dominio, inventario_verificado_en: ver.inventario_verificado_en ?? null }, env);
}

export async function manejarWellKnown(request, env, url) {
  const p = url.pathname;
  if (p === W.RUTA || p === W.RUTA + "/") {
    if (request.method !== "GET" && request.method !== "HEAD") return json({ error: "GET" }, 405);
    const d = await nuestroDocumento(env);
    if (!d) return json({ error: "firma no configurada en este servidor" }, 503);
    return new Response(request.method === "HEAD" ? null : JSON.stringify(d, null, 2) + "\n", { headers: {
      "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=3600", "access-control-allow-origin": "*" } });
  }
  if (p === W.RUTA_LLAVES) {
    const k = nuestrasLlaves(env);
    if (!k) return json({ error: "llave no configurada en este servidor" }, 503);
    return new Response(request.method === "HEAD" ? null : JSON.stringify(k, null, 2) + "\n", { headers: {
      "content-type": "application/jwk-set+json; charset=utf-8", "cache-control": "public, max-age=3600", "access-control-allow-origin": "*" } });
  }
  if (p === "/api/qready/well-known/validar") {
    if (request.method !== "POST") return json({ ok: false, error: "Usa POST con {url} o {json}." }, 405);
    const ip = request.headers.get("cf-connecting-ip") || "local";
    if (!(await permitido(ip, "__rl-qr-validar", 10))) return json({ ok: false, error: "Demasiadas validaciones seguidas. Espere un minuto." }, 429);
    const texto = await request.text();
    if (texto.length > MAX * 2) return json({ ok: false, error: "Pedido demasiado grande." }, 413);
    let c = {}; try { c = JSON.parse(texto); } catch { return json({ ok: false, error: "Pedido inválido." }, 400); }
    const r = await validarEntrada(c, env, url, env.DB);
    return json(r.cuerpo, r.http);
  }
  return null;
}
