// El pedido de exclusión (27-nov-2026, regla de las dos capas): quien no quiere ser medido lo pide en
// /q-ready/quien-mide con su dominio y un correo de ese dominio. La fila (db/capas.schema.sql →
// qready_exclusiones) sólo cuenta cuando se confirma con el enlace que llega a ese correo: así nadie excluye
// a un tercero. La lectura —¿está excluido?— es UNA función, excluido() de lib/capas.mjs; aquí sólo se escribe.
//
//   página → POST /api/exclusion {dominio, correo, turnstile, lang}   → {ok}   (Turnstile y límite por IP)
//   correo → GET  /api/exclusion/confirmar?t=<token>&l=<es|en>       → página: confirmado_utc
//   página → GET  /api/exclusion/revocar?t=<token>&l=<es|en>         → página con un botón (no cambia nada)
//            POST /api/exclusion/revocar?t=<token>&l=<es|en>         → revocado_utc
//
// Reglas que este archivo existe para cumplir:
//   · el correo nunca se guarda en claro: sólo su sha256 (correo_sha256);
//   · el correo tiene que ser del dominio o de un subdominio (correoDelDominio);
//   · la respuesta del POST es la misma esté o no el dominio excluido: no se consulta, no se dice;
//   · revocar es un POST: un antivirus de correo que abre los enlaces por su cuenta no puede deshacer una
//     exclusión (medir a quien pidió no ser medido es el error que no tiene vuelta). Confirmar es un GET:
//     si un antivirus lo abre, el error posible es dejar de medir, que es el lado seguro.
//   · sin un medio para enviar el correo (deps.enviar) el pedido no se acepta: 503 antes de escribir, para
//     no dejar filas que nadie puede confirmar ni prometerle a la persona un correo que no sale.
// Lo ejerce scripts/check-exclusion.mjs con el esquema real en SQLite.
import { permitido, normalizarHost } from "./borde-envivo.mjs";
import { verificarTurnstile } from "./turnstile.mjs";
import { dominioDeEntrada } from "../public/js/qex-nucleo.mjs";

export const VIGENCIA_PEDIDO_HORAS = 72;      // un pedido sin confirmar caduca: hay que pedirlo de nuevo
export const TOPE_POR_MINUTO = 3;             // por IP, como el envío del informe (__rl-envio)
const EMAIL = /^[^@\s<>"]{1,64}@[a-z0-9.-]{1,190}\.[a-z]{2,}$/i;
const TOKEN = /^[0-9a-f]{64}$/;

// PROVISORIO, PENDIENTE DE APROBACIÓN: el correo de confirmación y las páginas de confirmar y revocar.
export const TEXTOS_EXCLUSION = {
  es: {
    asunto: (d) => `Confirme la exclusión de ${d}`,
    correo: (d, enlace) => [
      `Recibimos un pedido para que Rosetta Quantum deje de medir ${d} y sus subdominios.`,
      `Para confirmarlo, abra este enlace: ${enlace}`,
      "Si usted no lo pidió, ignore este correo: no cambia nada.",
      "Quién mide y cómo: https://rosettaquantum.com/es/q-ready/quien-mide/",
    ].join("\n"),
    titulo: "Exclusión",
    confirmado: (d) => `Listo: dejamos de medir ${d} y sus subdominios, a más tardar en 24 horas.`,
    deshacer: "Deshacer la exclusión",
    invalido: "Este enlace no es válido o ya venció. Puede pedir la exclusión de nuevo en la página «Quién mide y cómo».",
    revocar_pregunta: (d) => `¿Volver a medir ${d} como a cualquier dominio público?`,
    revocar_ir: "Sí, deshacer la exclusión",
    revocado: (d) => `Listo: la exclusión de ${d} quedó sin efecto.`,
  },
  en: {
    asunto: (d) => `Confirm the exclusion of ${d}`,
    correo: (d, enlace) => [
      `We received a request for Rosetta Quantum to stop measuring ${d} and its subdomains.`,
      `To confirm it, open this link: ${enlace}`,
      "If you did not ask for this, ignore this email: nothing changes.",
      "Who measures and how: https://rosettaquantum.com/q-ready/quien-mide/",
    ].join("\n"),
    titulo: "Exclusion",
    confirmado: (d) => `Done: we stop measuring ${d} and its subdomains within 24 hours at the latest.`,
    deshacer: "Undo the exclusion",
    invalido: "This link is not valid or has expired. You can request the exclusion again on the “Who measures and how” page.",
    revocar_pregunta: (d) => `Measure ${d} again like any public domain?`,
    revocar_ir: "Yes, undo the exclusion",
    revocado: (d) => `Done: the exclusion of ${d} no longer applies.`,
  },
};
const lengua = (l) => (l === "en" ? "en" : "es");

export async function sha256Hex(texto) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
}
const generarToken = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");

// ¿El correo es del dominio o de un subdominio? «x@ejemplo.cl» y «x@mail.ejemplo.cl» sí; «x@otroejemplo.cl» no.
export function correoDelDominio(correo, dominio) {
  const c = String(correo || "").trim().toLowerCase(), d = String(dominio || "").trim().toLowerCase();
  if (!EMAIL.test(c) || !d) return false;
  const host = c.slice(c.lastIndexOf("@") + 1);
  return host === d || host.endsWith("." + d);
}

// Valida y escribe el pedido. Devuelve { ok, token, dominio } o { ok: false, http, error }.
export async function pedirExclusion(db, { dominio, correo }, ahora = new Date().toISOString()) {
  const d = dominioDeEntrada(normalizarHost(dominio) || "");   // sin «www.»: se excluye el dominio
  if (!d) return { ok: false, http: 400, error: "dominio" };
  const c = String(correo || "").trim().toLowerCase();
  if (!correoDelDominio(c, d)) return { ok: false, http: 400, error: "correo" };
  const token = generarToken();
  const r = await db.prepare(
    "INSERT INTO qready_exclusiones (token, dominio, correo_sha256, pedido_utc) VALUES (?1, ?2, ?3, ?4) RETURNING token")
    .bind(token, d, await sha256Hex(c), ahora).first();
  if (!r || r.token !== token) return { ok: false, http: 500, error: "la base no confirmó el pedido" };
  return { ok: true, token, dominio: d };
}

const caduco = (pedido, ahora) => Date.parse(ahora) - Date.parse(pedido) > VIGENCIA_PEDIDO_HORAS * 3600 * 1000;

// Confirma. estado: 'confirmado' (ahora), 'ya' (ya estaba confirmado) o 'invalido' (no existe, revocado o caducado).
export async function confirmarExclusion(db, token, ahora = new Date().toISOString()) {
  if (!TOKEN.test(String(token || ""))) return { estado: "invalido" };
  const f = await db.prepare("SELECT dominio, pedido_utc, confirmado_utc, revocado_utc FROM qready_exclusiones WHERE token = ?1").bind(token).first();
  if (!f || f.revocado_utc) return { estado: "invalido" };
  if (f.confirmado_utc) return { estado: "ya", dominio: f.dominio };
  if (caduco(f.pedido_utc, ahora)) return { estado: "invalido" };
  const r = await db.prepare("UPDATE qready_exclusiones SET confirmado_utc = ?2 WHERE token = ?1 AND confirmado_utc IS NULL AND revocado_utc IS NULL RETURNING token")
    .bind(token, ahora).first();
  return r && r.token === token ? { estado: "confirmado", dominio: f.dominio } : { estado: "invalido" };
}

// Revoca. Quien tiene un enlace confirmado del dominio deshace la exclusión del DOMINIO entero (todas sus filas
// vigentes): si otra fila confirmada siguiera viva, «deshacer» no desharía nada. Los subdominios con su propia
// exclusión no se tocan. estado: 'revocado' o 'invalido'.
export async function revocarExclusion(db, token, ahora = new Date().toISOString()) {
  if (!TOKEN.test(String(token || ""))) return { estado: "invalido" };
  const f = await db.prepare("SELECT dominio FROM qready_exclusiones WHERE token = ?1 AND confirmado_utc IS NOT NULL AND revocado_utc IS NULL").bind(token).first();
  if (!f) return { estado: "invalido" };
  await db.prepare("UPDATE qready_exclusiones SET revocado_utc = ?2 WHERE dominio = ?1 AND revocado_utc IS NULL").bind(f.dominio, ahora).run();
  return { estado: "revocado", dominio: f.dominio };
}

export function correoConfirmacion({ dominio, enlace, lang }) {
  const T = TEXTOS_EXCLUSION[lengua(lang)];
  return { asunto: T.asunto(dominio), texto: T.correo(dominio, enlace) };
}

const json = (o, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export function pagina(lang, cuerpo) {
  const l = lengua(lang);
  return new Response(`<!doctype html><html lang="${l}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(TEXTOS_EXCLUSION[l].titulo)} · Rosetta Quantum</title>`
    + `<body style="font:16px/1.5 system-ui,sans-serif;max-width:44ch;margin:4rem auto;padding:0 16px">${cuerpo}</body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } });
}

// deps.enviar(env, { para, asunto, texto }): el medio que entrega el correo de confirmación. Sin él, 503.
export async function manejarExclusion(request, env, url, deps = {}) {
  const p = url.pathname;
  const l = lengua(url.searchParams.get("l"));
  const T = TEXTOS_EXCLUSION[l];
  const ip = request.headers.get("cf-connecting-ip") || "local";

  if (p === "/api/exclusion") {
    if (request.method !== "POST") return json({ ok: false, error: "Usa POST." }, 405);
    if (typeof deps.enviar !== "function") return json({ ok: false, error: "no_habilitado" }, 503);
    const c = await request.json().catch(() => ({}));
    if (!(await permitido(ip, "__rl-exclusion", TOPE_POR_MINUTO))) return json({ ok: false, error: "Demasiados pedidos seguidos. Espere un minuto." }, 429);
    if (!(await verificarTurnstile(c.turnstile, env, ip)).ok) return json({ ok: false, error: "No pudimos verificar que es una persona. Recargue la página e intente de nuevo." }, 403);
    let r;
    try { r = await pedirExclusion(env.DB, { dominio: c.dominio, correo: c.correo }); }
    catch (e) {
      // Sin la tabla (esquema de capas sin aplicar) no hay dónde guardar el pedido: no se promete nada.
      console.error("exclusion:", e && e.message);
      return json({ ok: false, error: "no_habilitado" }, 503);
    }
    if (!r.ok) return json({ ok: false, error: r.error }, r.http);
    const lang = lengua(c.lang);
    const enlace = `${url.origin}/api/exclusion/confirmar?t=${r.token}&l=${lang}`;
    try { await deps.enviar(env, { para: String(c.correo).trim().toLowerCase(), ...correoConfirmacion({ dominio: r.dominio, enlace, lang }) }); }
    catch (e) { console.error("exclusion: no se pudo enviar:", e && e.message); return json({ ok: false, error: "envio" }, 502); }
    return json({ ok: true });
  }

  if (p === "/api/exclusion/confirmar" && request.method === "GET") {
    const t = url.searchParams.get("t") || "";
    let r;
    try { r = await confirmarExclusion(env.DB, t); } catch (e) { console.error("exclusion confirmar:", e && e.message); r = { estado: "invalido" }; }
    if (r.estado === "invalido") return pagina(l, `<p>${esc(T.invalido)}</p>`);
    return pagina(l, `<p>${esc(T.confirmado(r.dominio))}</p><p><a href="/api/exclusion/revocar?t=${esc(t)}&amp;l=${l}">${esc(T.deshacer)}</a></p>`);
  }

  if (p === "/api/exclusion/revocar") {
    const t = url.searchParams.get("t") || "";
    if (!TOKEN.test(t)) return pagina(l, `<p>${esc(T.invalido)}</p>`);
    if (request.method === "GET") {
      let f = null;
      try { f = await env.DB.prepare("SELECT dominio FROM qready_exclusiones WHERE token = ?1 AND confirmado_utc IS NOT NULL AND revocado_utc IS NULL").bind(t).first(); }
      catch (e) { console.error("exclusion revocar:", e && e.message); }
      if (!f) return pagina(l, `<p>${esc(T.invalido)}</p>`);
      return pagina(l, `<p>${esc(T.revocar_pregunta(f.dominio))}</p><form method="post" action="/api/exclusion/revocar?t=${esc(t)}&amp;l=${l}"><button type="submit">${esc(T.revocar_ir)}</button></form>`);
    }
    if (request.method === "POST") {
      let r;
      try { r = await revocarExclusion(env.DB, t); } catch (e) { console.error("exclusion revocar:", e && e.message); r = { estado: "invalido" }; }
      return pagina(l, `<p>${esc(r.estado === "revocado" ? T.revocado(r.dominio) : T.invalido)}</p>`);
    }
  }
  return json({ ok: false, error: "ruta" }, 404);
}
