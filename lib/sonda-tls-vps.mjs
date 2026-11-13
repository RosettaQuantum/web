// Saludos TLS en 443 desde el VPS (13-nov-2026, opción A aprobada por el dueño: cambia el método a
// propósito). Para lo que el Worker NO puede saludar: un Worker no abre sockets hacia direcciones de
// Cloudflare, así que todo dominio detrás de Cloudflare —rosettaquantum.com incluido— volvía con el
// borde y el certificado en null.
//
// Mismo patrón y misma autenticación que el correo (lib/correo-envivo.mjs): una cola en D1, y es el
// VPS el que pregunta y entrega firmado (HMAC sobre método, ruta, hora y cuerpo). No hay puertos
// abiertos en el VPS. Es un TIPO DE TRABAJO NUEVO con sus propias rutas: el trabajador de correo que
// ya corre no las ve ni las toma.
//
//   Worker (/api/sondas)  → INSERT pedido                          (completarConVps)
//   VPS   → GET  /api/sondas/tls/pendiente                       → toma un pedido (firmado)
//   VPS   → POST /api/sondas/tls/<id>/resultado                  → entrega          (firmado)
//
// QUÉ MIDE EL VPS (vps/sonda-correo/sonda_tls.py): sólo saludos TLS sin completar sesión, los MISMOS
// bytes que el Worker. Borde: A, B y C al sitio; certificado: un saludo TLS 1.2 y devuelve la hoja en
// DER, que se lee AQUÍ con leerHoja() (un solo lector); nombres: A y B. Nada más.
//
// FALLA CERRADO: si la sonda del VPS no está activa (no preguntó en el último minuto) no se crea el
// pedido; si no entrega en ESPERA_MS, queda lo del Worker. En los dos casos el borde queda null, nunca
// «no protegido», y la foto dice por qué (`vps`). Cada parte de la foto declara `medido_desde`.
//
// Entorno: producción usa la clave SONDA_CORREO_CLAVE (la que ya tiene el VPS). El preview, con
// QREADY_PRUEBA_DNS="1", usa SONDA_TLS_CLAVE_PRUEBA y escribe con entorno 'preview-prueba': el VPS de
// producción nunca toma un pedido del preview. Sólo el entorno, no la URL, porque la medición del
// servidor (tomarFoto) llama a /api/sondas con la URL de producción también desde el preview.
import { veredictoDeSaludos, normalizarHost, canon, sha256Hex } from "./borde-envivo.mjs";
import { leerHoja, endpointDeSaludos } from "./informe-envivo.mjs";

export const CREAR_TABLA = `CREATE TABLE IF NOT EXISTS sondas_tls (
  id TEXT PRIMARY KEY,
  entorno TEXT NOT NULL CHECK (entorno IN ('produccion','preview-prueba')),
  dominio TEXT NOT NULL,
  pedido TEXT NOT NULL,
  estado TEXT NOT NULL CHECK (estado IN ('pendiente','tomado','hecho')),
  creado_ms INTEGER NOT NULL,
  tomado_ms INTEGER,
  hecho_ms INTEGER,
  resultado TEXT
)`;
export const CREAR_LATIDO = `CREATE TABLE IF NOT EXISTS sondas_tls_latido (
  entorno TEXT PRIMARY KEY,
  ultimo_ms INTEGER NOT NULL
)`;
export const ESPERA_MS = 30_000;        // lo que la página espera al VPS antes de seguir con lo del Worker
export const LATIDO_VIVO_MS = 60_000;   // el VPS pregunta cada 2 s: un minuto sin preguntar = inactiva
const LATIDO_CADA_MS = 30_000;          // se escribe el latido a lo más cada 30 s (no una escritura cada 2 s)
const RETENCION_MS = 24 * 3600 * 1000;
const VENTANA_FIRMA_S = 120;
const MAX_NOMBRES = 15;
const POLL_MS = 750;

export const entornoTls = (env) => (env && env.QREADY_PRUEBA_DNS === "1" ? "preview-prueba" : "produccion");
export const claveTls = (env) => (entornoTls(env) === "preview-prueba" ? env.SONDA_TLS_CLAVE_PRUEBA : env.SONDA_CORREO_CLAVE);

const json = (o, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function hmacHex(clave, texto) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(clave), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const f = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(f)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function igualTiempoConstante(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
// Idéntico a textoFirmado() de lib/correo-envivo.mjs y a texto_firmado() de sonda_correo.py.
export const textoFirmado = (metodo, ruta, ts, cuerpo = "") => `${metodo}\n${ruta}\n${ts}\n${cuerpo}`;
export async function firmaValida(request, env, ruta, cuerpo) {
  const clave = claveTls(env);
  if (!clave || clave.length < 32) return false;
  const ts = Number(request.headers.get("x-ts"));
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > VENTANA_FIRMA_S) return false;
  const esperada = await hmacHex(clave, textoFirmado(request.method, ruta, request.headers.get("x-ts"), cuerpo));
  return igualTiempoConstante(request.headers.get("x-firma") || "", esperada);
}

async function conTablas(db, f) {
  try { return await f(); }
  catch (e) {
    if (!/no such table/i.test(String(e && e.message))) throw e;
    await db.prepare(CREAR_TABLA).run();
    await db.prepare(CREAR_LATIDO).run();
    return await f();
  }
}

// ---------------------------------------------------------------- qué le falta al Worker
// Un saludo con `error` (corte, silencio, socket rechazado) es lo que el Worker no pudo medir. Una
// alerta TLS sí es medición: no se repite.
const fallo = (x) => !!(x && x.error);
export function pedidoParaVps({ dominio, www, borde, certificado, endpoints }) {
  const s = borde && borde.saludos || {};
  const bordeFalta = fallo(s.A_como_navegador) || fallo(s.B_solo_hibrido) || fallo(s.C_eleccion_libre);
  const certFalta = !!(certificado && !certificado.ok && certificado.error && !/alerta TLS/.test(certificado.error));
  // Nombres: sólo los que DNS resolvió y el saludo A falló (los demás ya se midieron o no existen).
  const hosts = (endpoints || []).filter((e) => (e.ip && e.ip.length || e.cname && e.cname.length) && e.responde_443 === false && /sin respuesta TLS/.test(e.detalle || ""))
    .map((e) => e.host).slice(0, MAX_NOMBRES);
  if (!bordeFalta && !certFalta && !hosts.length) return null;
  return { dominio, www, borde: bordeFalta, certificado: certFalta, hosts };
}

// ---------------------------------------------------------------- unir lo del VPS con lo del Worker
const NOMBRES_SALUDO = ["A_como_navegador", "B_solo_hibrido", "C_eleccion_libre"];
const saludoValido = (x) => x && typeof x === "object" && ["grupo", "hrr", "alerta", "error", "ms"].every((k) => k in x);
const der64 = (b64) => Uint8Array.from(atob(String(b64)), (c) => c.charCodeAt(0));

export async function unir(crudo, pedido, r, desdeIp = null) {
  let { borde, certificado, endpoints } = crudo;
  if (pedido.borde && r.borde && NOMBRES_SALUDO.every((k) => saludoValido(r.borde[k]))) {
    const [a, b, c] = NOMBRES_SALUDO.map((k) => r.borde[k]);
    const informe = { instrumento: "rosetta-borde-envivo/1 · saludos desde la sonda del VPS (vps/sonda-correo/sonda_tls.py)",
      host: borde.host, medido_utc: r.medido_utc || borde.medido_utc, dns: borde.dns,
      saludos: { A_como_navegador: a, B_solo_hibrido: b, C_eleccion_libre: c }, veredicto: veredictoDeSaludos(a, b, c),
      medido_desde: "vps", desde_ip: desdeIp, alcance: borde.alcance };
    informe.sha256 = await sha256Hex(canon(informe));
    borde = informe;
  }
  if (pedido.certificado && r.certificado && r.certificado.der_b64) {
    try {
      certificado = { host: certificado.host, ok: true, metodo: "saludo TLS 1.2 desde la sonda del VPS; se lee la hoja que entrega el servidor",
        error: null, ms: r.certificado.ms ?? null, ...leerHoja(der64(r.certificado.der_b64)), medido_desde: "vps" };
    } catch (e) { certificado = { ...certificado, vps_error: `hoja ilegible: ${e && e.message || e}` }; }
  }
  if (pedido.hosts.length && r.hosts && typeof r.hosts === "object") {
    endpoints = endpoints.map((e) => {
      const h = pedido.hosts.includes(e.host) ? r.hosts[e.host] : null;
      if (!h || !saludoValido(h.A) || h.A.error) return e;   // el VPS tampoco pudo: queda lo del Worker
      return { ...e, ...endpointDeSaludos(h.A, saludoValido(h.B) ? h.B : null), medido_desde: "vps" };
    });
  }
  return { borde, certificado, endpoints };
}

// ---------------------------------------------------------------- el pedido y la espera
// Devuelve { borde, certificado, endpoints, vps }. `vps` dice qué pasó: no_hizo_falta, inactiva,
// sin_respuesta, hecho. Nunca lanza: un error aquí deja lo que midió el Worker.
export async function completarConVps(env, crudo, { esperaMs = ESPERA_MS, pollMs = POLL_MS } = {}) {
  const pedido = pedidoParaVps(crudo);
  const base = { borde: crudo.borde, certificado: crudo.certificado, endpoints: crudo.endpoints };
  if (!pedido) return { ...base, vps: { estado: "no_hizo_falta" } };
  const db = env && env.DB, entorno = entornoTls(env);
  if (!db || !claveTls(env)) return { ...base, vps: { estado: "inactiva", causa: "la sonda del VPS no está configurada en este servidor" } };
  try {
    const ahora = Date.now();
    const lat = await conTablas(db, () => db.prepare("SELECT ultimo_ms FROM sondas_tls_latido WHERE entorno = ?1").bind(entorno).first());
    if (!lat || ahora - lat.ultimo_ms > LATIDO_VIVO_MS)
      return { ...base, vps: { estado: "inactiva", causa: "la sonda del VPS no preguntó en el último minuto" } };
    await db.prepare("DELETE FROM sondas_tls WHERE creado_ms < ?1").bind(ahora - RETENCION_MS).run();
    const id = crypto.randomUUID();
    const r0 = await db.prepare("INSERT INTO sondas_tls (id, entorno, dominio, pedido, estado, creado_ms) VALUES (?1, ?2, ?3, ?4, 'pendiente', ?5) RETURNING id")
      .bind(id, entorno, pedido.dominio, JSON.stringify(pedido), ahora).first();
    if (!r0 || r0.id !== id) return { ...base, vps: { estado: "sin_respuesta", causa: "la base no confirmó el pedido" } };
    const hasta = ahora + esperaMs;
    while (Date.now() < hasta) {
      await espera(pollMs);
      const f = await db.prepare("SELECT estado, resultado FROM sondas_tls WHERE id = ?1").bind(id).first();
      if (f && f.estado === "hecho") {
        let r; try { r = JSON.parse(f.resultado); } catch { r = null; }
        if (!r || r.error) return { ...base, vps: { estado: "sin_respuesta", id, causa: r && r.error || "resultado ilegible" } };
        return { ...(await unir(crudo, pedido, r, r.desde_ip || null)), vps: { estado: "hecho", id, instrumento: r.instrumento || null, desde_ip: r.desde_ip || null } };
      }
    }
    return { ...base, vps: { estado: "sin_respuesta", id, causa: `la sonda del VPS no entregó en ${esperaMs / 1000} s` } };
  } catch (e) {
    console.error("sonda-tls: ", (e && e.message) || e);
    return { ...base, vps: { estado: "sin_respuesta", causa: "error al hablar con la cola" } };
  }
}

// ---------------------------------------------------------------- las rutas del VPS
export async function manejarTls(request, env, url) {
  const p = url.pathname;
  if (!p.startsWith("/api/sondas/tls")) return null;
  const db = env.DB, entorno = entornoTls(env), ahora = Date.now();

  if (p === "/api/sondas/tls/pendiente" && request.method === "GET") {
    if (!(await firmaValida(request, env, p, ""))) return json({ ok: false, error: "firma" }, 401);
    // El latido: la página sólo espera al VPS si preguntó hace poco. Se escribe a lo más cada 30 s.
    await conTablas(db, () => db.prepare("INSERT INTO sondas_tls_latido (entorno, ultimo_ms) VALUES (?1, ?2) ON CONFLICT (entorno) DO UPDATE SET ultimo_ms = excluded.ultimo_ms WHERE sondas_tls_latido.ultimo_ms < ?3")
      .bind(entorno, ahora, ahora - LATIDO_CADA_MS).run());
    const fila = await db.prepare(
      `UPDATE sondas_tls SET estado='tomado', tomado_ms=?1
         WHERE id = (SELECT id FROM sondas_tls WHERE estado='pendiente' AND entorno=?2 AND creado_ms > ?3 ORDER BY creado_ms LIMIT 1)
         RETURNING id, pedido`).bind(ahora, entorno, ahora - ESPERA_MS).first();
    return fila ? json({ ok: true, id: fila.id, pedido: JSON.parse(fila.pedido) }) : new Response(null, { status: 204 });
  }

  const m = p.match(/^\/api\/sondas\/tls\/([0-9a-f-]{36})\/resultado$/);
  if (m && request.method === "POST") {
    const cuerpo = await request.text();
    if (cuerpo.length > 300000) return json({ ok: false, error: "cuerpo" }, 413);
    if (!(await firmaValida(request, env, p, cuerpo))) return json({ ok: false, error: "firma" }, 401);
    let r; try { r = JSON.parse(cuerpo); } catch { return json({ ok: false, error: "json" }, 400); }
    const res = await conTablas(db, () => db.prepare(
      "UPDATE sondas_tls SET estado='hecho', hecho_ms=?1, resultado=?2 WHERE id=?3 AND estado='tomado' AND entorno=?4 AND dominio=?5")
      .bind(ahora, JSON.stringify(r), m[1], entorno, String(normalizarHost(r.dominio) || "")).run());
    return json({ ok: res.meta.changes === 1 }, res.meta.changes === 1 ? 200 : 409);
  }
  return json({ ok: false, error: "ruta" }, 404);
}
