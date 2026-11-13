// Los dos formularios que piden un correo en Q-Ready (12-nov-2026):
//
//   POST /api/qready/informe-industria  — el panel del hero de /es/q-ready: el informe PQC
//                                         mensual de la industria.
//   POST /api/medicion/descarga         — «Descargar mi informe» tras medir, en
//                                         /es/q-ready/medicion y /q-ready/medicion.
//
// EL ORDEN NO SE NEGOCIA, y es el mismo de lib/qready-lead.mjs:
//   1. validar lo que llega;
//   2. Turnstile (lib/turnstile.mjs). Sin token válido no se escribe NADA y no se envía nada;
//   3. escribir la fila en D1 y sólo confirmar si quedó escrita;
//   4. recién entonces, lo que venga después (encolar el correo del VPS).
// El guardia scripts/check-turnstile-captacion.mjs prueba 2 y 3 con fetch simulado.
//
// Las tablas se crean perezosamente, como en qready-lead.mjs: el binding del Worker tiene permiso
// de escritura en D1 y el token local de las sesiones no siempre.
//
// «Descargar aquí» NO genera un PDF en el servidor: el PDF del informe individual sólo lo arma el
// VPS y sólo viaja por correo (decisión de Nicholas del 21-ago: los informes de cliente nunca se
// sirven desde la web, ni con URL secreta). Descargar aquí abre la versión imprimible de la página
// (@media print), que el navegador guarda como PDF. Lo que se guarda en D1 es el pedido.
import { verificarTurnstile } from "./turnstile.mjs";
import { encolarEnvio } from "./envio-informe.mjs";
import { permitido, normalizarHost } from "./borde-envivo.mjs";
import { fotoIntegra } from "../public/js/qex-nucleo.mjs";
import { guardarMedicion, entornoDe } from "./qready-verificado.mjs";

export const CREAR_PEDIDOS_INDUSTRIA = `CREATE TABLE IF NOT EXISTS pedidos_informe_industria (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL, edicion TEXT NOT NULL, proxima INTEGER NOT NULL DEFAULT 0,
  lang TEXT NOT NULL DEFAULT 'es', origen TEXT NOT NULL DEFAULT 'q-ready',
  creado_utc TEXT NOT NULL)`;

export const CREAR_DESCARGAS = `CREATE TABLE IF NOT EXISTS descargas_informe_medicion (
  id TEXT PRIMARY KEY,
  dominio TEXT NOT NULL, email TEXT NOT NULL,
  eleccion TEXT NOT NULL CHECK (eleccion IN ('descargar','correo')),
  consentimiento INTEGER NOT NULL CHECK (consentimiento = 1),
  lang TEXT NOT NULL DEFAULT 'es', envio_id TEXT,
  creado_utc TEXT NOT NULL)`;

const EMAIL = /^[^@\s<>"]{1,64}@[a-z0-9.-]{1,190}\.[a-z]{2,}$/i;
const MAX_CUERPO = 200_000;
const json = (o, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const NO_PERSONA = "No pudimos verificar que es una persona. Recargue la página e intente de nuevo.";

async function conTabla(env, crear, f) {
  try { return await f(); }
  catch (e) {
    if (!/no such table/i.test(String(e && e.message))) throw e;
    await env.DB.prepare(crear).run();
    return await f();
  }
}
async function leerCuerpo(request) {
  const texto = await request.text();
  if (texto.length > MAX_CUERPO) return null;
  try { const c = JSON.parse(texto); return c && typeof c === "object" ? c : null; } catch { return null; }
}

export async function manejarInformeIndustria(request, env) {
  if (request.method !== "POST") return json({ ok: false, error: "ruta" }, 405);
  const c = await leerCuerpo(request);
  if (!c) return json({ ok: false, error: "Pedido inválido." }, 400);
  const email = String(c.email || "").trim().toLowerCase();
  if (!EMAIL.test(email)) return json({ ok: false, error: "Escriba un correo válido." }, 400);
  const edicion = String(c.edicion || "");
  if (!/^\d{4}-\d{2}$/.test(edicion)) return json({ ok: false, error: "Pedido inválido." }, 400);
  const ip = request.headers.get("cf-connecting-ip") || "local";
  if (!(await verificarTurnstile(c.turnstile, env, ip)).ok) return json({ ok: false, error: NO_PERSONA }, 403);
  try {
    const r = await conTabla(env, CREAR_PEDIDOS_INDUSTRIA, () => env.DB.prepare(
      "INSERT INTO pedidos_informe_industria (email, edicion, proxima, lang, origen, creado_utc) VALUES (?1,?2,?3,?4,?5,?6) RETURNING id")
      .bind(email, edicion, c.proxima === true ? 1 : 0, c.lang === "en" ? "en" : "es", "q-ready", new Date().toISOString()).first());
    if (!r || r.id == null) throw new Error("la fila no volvió");
    return json({ ok: true, id: r.id });
  } catch (e) {
    console.error("informe-industria: no se pudo registrar:", (e && e.message) || e);
    return json({ ok: false, error: "No pudimos registrar su correo." }, 500);
  }
}

export async function manejarDescarga(request, env) {
  if (request.method !== "POST") return json({ ok: false, error: "ruta" }, 405);
  const c = await leerCuerpo(request);
  if (!c) return json({ ok: false, error: "Pedido inválido." }, 400);
  const email = String(c.email || "").trim().toLowerCase();
  if (!EMAIL.test(email)) return json({ ok: false, error: "Escriba un correo válido." }, 400);
  if (c.acepta !== true) return json({ ok: false, error: "Falta aceptar el envío." }, 400);
  const eleccion = c.eleccion === "correo" ? "correo" : c.eleccion === "descargar" ? "descargar" : null;
  if (!eleccion) return json({ ok: false, error: "Pedido inválido." }, 400);
  const dominio = normalizarHost(c.dominio);
  if (!dominio) return json({ ok: false, error: "Pedido inválido." }, 400);
  if (eleccion === "correo") {
    if (!env.SONDA_CORREO_CLAVE || env.ENVIO_INFORME_ACTIVO !== "1") return json({ ok: false, error: "El envío por correo no está habilitado en este servidor." }, 503);
    const f = c.foto;
    if (normalizarHost(f?.dominio) !== dominio || f?.esquema !== "rosetta-qex-foto/1" || !(await fotoIntegra(f)))
      return json({ ok: false, error: "La foto no es íntegra: vuelva a medir." }, 400);
  }
  const ip = request.headers.get("cf-connecting-ip") || "local";
  if (!(await verificarTurnstile(c.turnstile, env, ip)).ok) return json({ ok: false, error: NO_PERSONA }, 403);
  if (!(await permitido(ip, "__rl-descarga", 5))) return json({ ok: false, error: "Demasiados pedidos seguidos. Espere un minuto." }, 429);

  const id = crypto.randomUUID(), ahora = Date.now();
  try {
    const r = await conTabla(env, CREAR_DESCARGAS, () => env.DB.prepare(
      "INSERT INTO descargas_informe_medicion (id, dominio, email, eleccion, consentimiento, lang, creado_utc) VALUES (?1,?2,?3,?4,1,?5,?6) RETURNING id")
      .bind(id, dominio, email, eleccion, c.lang === "en" ? "en" : "es", new Date(ahora).toISOString()).first());
    if (!r || r.id !== id) throw new Error("la fila no volvió");
  } catch (e) {
    console.error("descarga: no se pudo registrar:", (e && e.message) || e);
    return json({ ok: false, error: "No pudimos registrar su pedido." }, 500);
  }
  // Q-Ready Verified (13-nov-2026): con el MISMO consentimiento (acepta:true, ya validado arriba, con
  // Turnstile y la fila del pedido escrita), se guarda la medición en qready_mediciones con origen
  // 'pagina'. Es opcional: si la foto no viene, no es íntegra o la base no confirma, el pedido sigue
  // igual y la respuesta lo dice en `medicion_guardada`. Una medición de la página NUNCA se publica
  // (la página /verificado y el sello sólo leen origen 'servidor').
  const medicionGuardada = await guardarDeLaPagina(env, request, dominio, c.foto);
  if (eleccion === "descargar") return json({ ok: true, id, medicion_guardada: medicionGuardada });

  // Correo: la fila del pedido ya está a salvo; ahora la cola del VPS.
  try {
    const correoId = /^[0-9a-f-]{36}$/.test(String(c.correo_id || "")) ? c.correo_id : null;
    const envioId = await encolarEnvio(env, { email, dominio, foto: c.foto, correoId, ahora });
    await env.DB.prepare("UPDATE descargas_informe_medicion SET envio_id=?1 WHERE id=?2").bind(envioId, id).run().catch(() => {});
    return json({ ok: true, id, envio_id: envioId, medicion_guardada: medicionGuardada });
  } catch (e) {
    console.error("descarga: no se pudo encolar el correo:", (e && e.message) || e);
    return json({ ok: false, id, error: "Registramos su pedido, pero no pudimos poner el envío en la cola." }, 500);
  }
}

async function guardarDeLaPagina(env, request, dominio, foto) {
  if (!foto || typeof foto !== "object" || normalizarHost(foto.dominio) !== dominio) return false;
  try {
    const r = await guardarMedicion(env.DB, { foto, origen: "pagina", entorno: entornoDe(env, new URL(request.url)) });
    if (!r.ok) console.error("descarga: medición no guardada:", r.error);
    return r.ok;
  } catch (e) {
    console.error("descarga: medición no guardada:", (e && e.message) || e);
    return false;
  }
}
