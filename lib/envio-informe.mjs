// El informe por correo (3-nov-2026): cola entre la página de medición y el servidor de Contabo.
//
// Mismo diseño que la sonda de correo (correo-envivo.mjs), por la misma razón: el PDF se arma y
// se envía FUERA del sitio. Los informes de cliente nunca se sirven desde la web, ni con URL
// secreta (decisión de Nicholas, 21-ago): aquí la foto sólo se guarda hasta que Contabo la toma.
//
//   página → POST /api/medicion/envio {email, foto, correo_id, acepta}  → {id}   (público, con límite)
//   VPS    → GET  /api/medicion/envio/pendiente                        → trabajo  (firmado)
//   VPS    → POST /api/medicion/envio/<id>/resultado {ok, detalle}     → entrega  (firmado)
//   correo → GET  /baja?t=<token>                                      → se da de baja
//
// Un solo escritor por fila: la página crea, el VPS toma y entrega. La firma es la misma HMAC
// que usa la sonda de correo (SONDA_CORREO_CLAVE): es el mismo servidor y la misma confianza.
// La foto de la cola se borra al entregarse; queda la suscripción (correo, dominio, huella).
import { textoFirmado } from "./correo-envivo.mjs";
import { permitido, normalizarHost } from "./borde-envivo.mjs";
import { fotoIntegra } from "../public/js/qex-nucleo.mjs";

export const CREAR_COLA = `CREATE TABLE IF NOT EXISTS envios_informe (
  id TEXT PRIMARY KEY, email TEXT NOT NULL, dominio TEXT NOT NULL, foto TEXT, correo_id TEXT,
  estado TEXT NOT NULL CHECK (estado IN ('pendiente','tomado','enviado','fallido')),
  creado_ms INTEGER NOT NULL, tomado_ms INTEGER, hecho_ms INTEGER, detalle TEXT)`;
export const CREAR_SUSCRIPCIONES = `CREATE TABLE IF NOT EXISTS suscripciones_medicion (
  email TEXT NOT NULL, dominio TEXT NOT NULL, creado_utc TEXT NOT NULL, ultima_foto_sha TEXT,
  baja_token TEXT NOT NULL UNIQUE, baja_utc TEXT, PRIMARY KEY (email, dominio))`;
const ESPERA_TOMA_MS = 15 * 60 * 1000;     // un pedido que nadie toma en 15 min se reporta fallido
const VENTANA_FIRMA_S = 120;
const MAX_FOTO = 200_000;
const EMAIL = /^[^@\s<>"]{1,64}@[a-z0-9.-]{1,190}\.[a-z]{2,}$/i;

const json = (o, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

async function hmacHex(clave, texto) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(clave), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(texto)))).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function firmaValida(request, env, ruta, cuerpo) {
  const clave = env.SONDA_CORREO_CLAVE;
  if (!clave || clave.length < 32) return false;
  const ts = Number(request.headers.get("x-ts"));
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > VENTANA_FIRMA_S) return false;
  const esperada = await hmacHex(clave, textoFirmado(request.method, ruta, request.headers.get("x-ts"), cuerpo));
  const dada = request.headers.get("x-firma") || "";
  if (dada.length !== esperada.length) return false;
  let d = 0; for (let i = 0; i < dada.length; i++) d |= dada.charCodeAt(i) ^ esperada.charCodeAt(i);
  return d === 0;
}
async function conTablas(env, f) {
  try { return await f(); }
  catch (e) {
    if (!/no such table/i.test(String(e && e.message))) throw e;
    await env.DB.prepare(CREAR_COLA).run();
    await env.DB.prepare(CREAR_SUSCRIPCIONES).run();
    return await f();
  }
}
const token = () => Array.from(crypto.getRandomValues(new Uint8Array(16))).map((b) => b.toString(16).padStart(2, "0")).join("");

export async function manejarEnvio(request, env, url) {
  const p = url.pathname, ahora = Date.now();

  // --- página: pedir el informe
  if (p === "/api/medicion/envio" && request.method === "POST") {
    const texto = await request.text();
    if (texto.length > MAX_FOTO) return json({ ok: false, error: "La foto es demasiado grande." }, 413);
    let c; try { c = JSON.parse(texto); } catch { return json({ ok: false, error: "Pedido inválido." }, 400); }
    const email = String(c.email || "").trim().toLowerCase();
    if (!EMAIL.test(email)) return json({ ok: false, error: "Escriba un correo válido." }, 400);
    if (c.acepta !== true) return json({ ok: false, error: "Falta aceptar el envío." }, 400);
    const foto = c.foto;
    const dominio = normalizarHost(foto?.dominio);
    if (!dominio || foto?.esquema !== "rosetta-qex-foto/1" || !(await fotoIntegra(foto)))
      return json({ ok: false, error: "La foto no es íntegra: vuelva a medir." }, 400);
    const correoId = /^[0-9a-f-]{36}$/.test(String(c.correo_id || "")) ? c.correo_id : null;
    if (!env.SONDA_CORREO_CLAVE) return json({ ok: false, error: "El envío por correo no está habilitado en este servidor." }, 503);
    const ip = request.headers.get("cf-connecting-ip") || "local";
    if (!(await permitido(ip, "__rl-envio", 3))) return json({ ok: false, error: "Demasiados pedidos seguidos. Espere un minuto." }, 429);
    return conTablas(env, async () => {
      const id = crypto.randomUUID();
      await env.DB.prepare("INSERT INTO envios_informe (id, email, dominio, foto, correo_id, estado, creado_ms) VALUES (?1,?2,?3,?4,?5,'pendiente',?6)")
        .bind(id, email, dominio, JSON.stringify(foto), correoId, ahora).run();
      await env.DB.prepare(`INSERT INTO suscripciones_medicion (email, dominio, creado_utc, ultima_foto_sha, baja_token) VALUES (?1,?2,?3,?4,?5)
          ON CONFLICT (email, dominio) DO UPDATE SET ultima_foto_sha = excluded.ultima_foto_sha, baja_utc = NULL`)
        .bind(email, dominio, new Date(ahora).toISOString(), foto.sha256, token()).run();
      return json({ ok: true, id });
    });
  }

  // --- VPS: tomar el pedido más antiguo
  if (p === "/api/medicion/envio/pendiente" && request.method === "GET") {
    if (!(await firmaValida(request, env, p, ""))) return json({ ok: false, error: "firma" }, 401);
    const f = await conTablas(env, () => env.DB.prepare(
      `UPDATE envios_informe SET estado='tomado', tomado_ms=?1
         WHERE id = (SELECT id FROM envios_informe WHERE estado='pendiente' ORDER BY creado_ms LIMIT 1)
         RETURNING id, email, dominio, foto, correo_id`).bind(ahora).first());
    if (!f) return new Response(null, { status: 204 });
    const s = await env.DB.prepare("SELECT baja_token FROM suscripciones_medicion WHERE email=?1 AND dominio=?2").bind(f.email, f.dominio).first();
    return json({ ok: true, id: f.id, email: f.email, dominio: f.dominio, foto: JSON.parse(f.foto), correo_id: f.correo_id,
      baja: s ? `https://rosettaquantum.com/baja?t=${s.baja_token}` : null });
  }

  // --- VPS: entregar el resultado (la foto se borra: ya no hace falta guardarla)
  const m = p.match(/^\/api\/medicion\/envio\/([0-9a-f-]{36})\/resultado$/);
  if (m && request.method === "POST") {
    const cuerpo = await request.text();
    if (!(await firmaValida(request, env, p, cuerpo))) return json({ ok: false, error: "firma" }, 401);
    let r; try { r = JSON.parse(cuerpo); } catch { return json({ ok: false, error: "json" }, 400); }
    const res = await conTablas(env, () => env.DB.prepare(
      "UPDATE envios_informe SET estado=?1, hecho_ms=?2, detalle=?3, foto=NULL WHERE id=?4 AND estado='tomado'")
      .bind(r.ok === true ? "enviado" : "fallido", ahora, String(r.detalle || "").slice(0, 500), m[1]).run());
    return json({ ok: res.meta.changes === 1 }, res.meta.changes === 1 ? 200 : 409);
  }

  // --- página: ¿se envió?
  const mc = p.match(/^\/api\/medicion\/envio\/([0-9a-f-]{36})$/);
  if (mc && request.method === "GET") {
    const f = await conTablas(env, () => env.DB.prepare("SELECT estado, creado_ms, detalle FROM envios_informe WHERE id=?1").bind(mc[1]).first());
    if (!f) return json({ ok: false, error: "no existe" }, 404);
    const estado = f.estado === "pendiente" && ahora - f.creado_ms > ESPERA_TOMA_MS ? "sin_respuesta" : f.estado;
    return json({ ok: true, estado });
  }
  return json({ ok: false, error: "ruta" }, 404);
}

// El enlace de baja: una línea en el correo, sin cuenta ni contraseña. Responde en HTML simple.
export async function manejarBaja(request, env, url) {
  const t = url.searchParams.get("t") || "";
  const html = (msg) => new Response(`<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><title>Baja · Rosetta Quantum</title><p style="font:16px system-ui;max-width:40ch;margin:4rem auto">${msg}</p>`,
    { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
  if (!/^[0-9a-f]{32}$/.test(t)) return html("Este enlace de baja no es válido.");
  const r = await conTablas(env, () => env.DB.prepare("UPDATE suscripciones_medicion SET baja_utc=?1 WHERE baja_token=?2 AND baja_utc IS NULL")
    .bind(new Date().toISOString(), t).run());
  return html(r.meta.changes === 1 ? "Listo: no le volveremos a escribir sobre este dominio." : "Este correo ya estaba dado de baja.");
}
