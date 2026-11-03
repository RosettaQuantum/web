// Correo EN VIVO (2-nov-2026): cola entre la página y la sonda del VPS Contabo.
//
// Por qué una cola y no una llamada directa: el Worker no abre el puerto 25, y desde la IP
// compartida de Cloudflare el filtro Cisco de un banco chileno corta con 554. La sonda vive en
// el VPS (vps/sonda-correo/) y es ELLA la que pregunta: no hay puerto abierto en ese
// servidor, que es compartido con Sigo. Decidido por Nicholas el 2-nov.
//
//   navegador → POST /api/sondas/correo {dominio}        → {id}            (público, con límite)
//   navegador → GET  /api/sondas/correo/<id>             → estado/resultado (público)
//   VPS       → GET  /api/sondas/correo/pendiente        → toma un trabajo  (firmado)
//   VPS       → POST /api/sondas/correo/<id>/resultado   → entrega          (firmado)
//
// Un solo escritor por fila: el navegador sólo crea, el VPS sólo toma y entrega.
// Retención: las filas de más de un día se borran solas. Guarda el dominio pedido y el
// resultado (datos públicos de sus servidores de correo); nada del visitante.
// Sin respuesta del VPS en 90 s, la medición vuelve «no medido» con su causa, nunca «no soporta».

import { normalizarHost, permitido } from "./borde-envivo.mjs";

export const CREAR_TABLA = `CREATE TABLE IF NOT EXISTS sondas_correo (
  id TEXT PRIMARY KEY,
  dominio TEXT NOT NULL,
  estado TEXT NOT NULL CHECK (estado IN ('pendiente','tomado','hecho')),
  creado_ms INTEGER NOT NULL,
  tomado_ms INTEGER,
  hecho_ms INTEGER,
  resultado TEXT
)`;
const CACHE_MS = 30 * 60 * 1000;
const ESPERA_VPS_MS = 90 * 1000;
const RETENCION_MS = 24 * 3600 * 1000;
const VENTANA_FIRMA_S = 120;

const json = (o, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

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
/** La firma cubre método, ruta, hora y cuerpo: una firma no sirve para otra ruta ni se reusa pasada la ventana. */
export const textoFirmado = (metodo, ruta, ts, cuerpo = "") => `${metodo}\n${ruta}\n${ts}\n${cuerpo}`;
async function firmaValida(request, env, ruta, cuerpo) {
  const clave = env.SONDA_CORREO_CLAVE;
  if (!clave || clave.length < 32) return false;                    // sin clave configurada, nadie entra
  const ts = Number(request.headers.get("x-ts"));
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > VENTANA_FIRMA_S) return false;
  const esperada = await hmacHex(clave, textoFirmado(request.method, ruta, request.headers.get("x-ts"), cuerpo));
  return igualTiempoConstante(request.headers.get("x-firma") || "", esperada);
}

async function conTabla(env, f) {
  try { return await f(); }
  catch (e) {
    if (!/no such table/i.test(String(e && e.message))) throw e;
    await env.DB.prepare(CREAR_TABLA).run();                          // autocreación perezosa (ver qready-lead.mjs)
    return await f();
  }
}

export async function manejarCorreo(request, env, url) {
  const p = url.pathname;
  if (!p.startsWith("/api/sondas/correo")) return null;
  const ahora = Date.now();

  // --- VPS: tomar el trabajo más antiguo pendiente
  if (p === "/api/sondas/correo/pendiente" && request.method === "GET") {
    if (!(await firmaValida(request, env, p, ""))) return json({ ok: false, error: "firma" }, 401);
    const fila = await conTabla(env, () => env.DB.prepare(
      `UPDATE sondas_correo SET estado='tomado', tomado_ms=?1
         WHERE id = (SELECT id FROM sondas_correo WHERE estado='pendiente' AND creado_ms > ?2 ORDER BY creado_ms LIMIT 1)
         RETURNING id, dominio`).bind(ahora, ahora - ESPERA_VPS_MS).first());
    return fila ? json({ ok: true, id: fila.id, dominio: fila.dominio }) : new Response(null, { status: 204 });
  }

  // --- VPS: entregar el resultado
  const mEnt = p.match(/^\/api\/sondas\/correo\/([0-9a-f-]{36})\/resultado$/);
  if (mEnt && request.method === "POST") {
    const cuerpo = await request.text();
    if (cuerpo.length > 200000) return json({ ok: false, error: "cuerpo" }, 413);
    if (!(await firmaValida(request, env, p, cuerpo))) return json({ ok: false, error: "firma" }, 401);
    let r; try { r = JSON.parse(cuerpo); } catch { return json({ ok: false, error: "json" }, 400); }
    const res = await conTabla(env, () => env.DB.prepare(
      `UPDATE sondas_correo SET estado='hecho', hecho_ms=?1, resultado=?2 WHERE id=?3 AND estado='tomado' AND dominio=?4`)
      .bind(ahora, JSON.stringify(r), mEnt[1], String(r.dominio || "")).run());
    return json({ ok: res.meta.changes === 1 }, res.meta.changes === 1 ? 200 : 409);
  }

  // --- navegador: pedir una medición
  if (p === "/api/sondas/correo" && request.method === "POST") {
    const c = await request.json().catch(() => ({}));
    const dominio = normalizarHost(c.dominio);
    if (!dominio) return json({ ok: false, error: "Escribe un dominio público, por ejemplo ejemplo.cl." }, 400);
    if (!env.SONDA_CORREO_CLAVE) return json({ ok: false, error: "La medición de correo no está habilitada en este servidor." }, 503);
    const ip = request.headers.get("cf-connecting-ip") || "local";
    if (!(await permitido(ip, "__rl-correo", 4))) return json({ ok: false, error: "Demasiadas mediciones seguidas. Espera un minuto." }, 429);
    return conTabla(env, async () => {
      await env.DB.prepare("DELETE FROM sondas_correo WHERE creado_ms < ?1").bind(ahora - RETENCION_MS).run();
      // Mismo dominio en 30 min: se reusa la medición (protege la reputación de la IP del VPS).
      const previa = await env.DB.prepare(
        `SELECT id FROM sondas_correo WHERE dominio=?1 AND (estado='hecho' AND creado_ms > ?2 OR estado IN ('pendiente','tomado') AND creado_ms > ?3)
           ORDER BY creado_ms DESC LIMIT 1`).bind(dominio, ahora - CACHE_MS, ahora - ESPERA_VPS_MS).first();
      if (previa) return json({ ok: true, id: previa.id, reusada: true });
      const id = crypto.randomUUID();
      await env.DB.prepare("INSERT INTO sondas_correo (id, dominio, estado, creado_ms) VALUES (?1, ?2, 'pendiente', ?3)")
        .bind(id, dominio, ahora).run();
      return json({ ok: true, id, reusada: false });
    });
  }

  // --- navegador: consultar
  const mCon = p.match(/^\/api\/sondas\/correo\/([0-9a-f-]{36})$/);
  if (mCon && request.method === "GET") {
    const f = await conTabla(env, () => env.DB.prepare("SELECT * FROM sondas_correo WHERE id=?1").bind(mCon[1]).first());
    if (!f) return json({ ok: false, error: "no existe (se borran pasado un día)" }, 404);
    if (f.estado === "hecho") return json({ ok: true, estado: "hecho", dominio: f.dominio, resultado: JSON.parse(f.resultado) });
    if (ahora - f.creado_ms > ESPERA_VPS_MS)
      return json({ ok: true, estado: "sin_respuesta", dominio: f.dominio,
        causa: f.estado === "pendiente" ? "el servidor de medición no tomó el trabajo" : "el servidor de medición no entregó a tiempo" });
    return json({ ok: true, estado: f.estado, dominio: f.dominio });
  }
  return json({ ok: false, error: "ruta" }, 404);
}
