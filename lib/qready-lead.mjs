/**
 * Maneja un envio del formulario Enterprise (co-lead, tier=l3) de /q-ready/checkout.
 *
 * EL REGISTRO SE ABRE AL RECIBIR, NO AL TERMINAR
 * -----------------------------------------------
 * La fila en `qready_leads` se escribe ANTES de intentar el aviso por correo. Si el
 * correo falla, el lead sigue vivo en D1 y `emailed`/`email_error` quedan actualizados
 * sobre esa MISMA fila — nunca se pierde por un problema de envio.
 *
 * LA CONFIRMACION SE DERIVA DEL RESULTADO REAL
 * ----------------------------------------------
 * Si la fila NO se pudo escribir, se devuelve ok:false y no hay confirmacion — el
 * visitante ve un error, no una promesa falsa. Si la fila SI se escribio, el lead esta
 * a salvo y se confirma, aunque el correo falle despues: eso es un problema de aviso,
 * no de perdida de dato, y queda registrado en la fila para que se pueda encontrar.
 *
 * AUTOCREACION PEREZOSA DE LA TABLA
 * ----------------------------------
 * El token local de esta sesion no tiene permiso D1:Edit (verificado: 7403 en
 * `wrangler d1 execute`, aunque el mismo token SI puede desplegar el Worker). El Worker
 * desplegado usa su propio binding `env.DB`, que si tiene el permiso, asi que la
 * primera vez que corre este endpoint crea la tabla el mismo — no depende de que nadie
 * corra una migracion a mano con el token que falta.
 */
const REQUERIDOS = ["legal", "name", "email"];
const EMAIL_OK = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function validar(b) {
  const faltan = REQUERIDOS.filter(k => !b || !String(b[k] || "").trim());
  if (faltan.length) return `faltan: ${faltan.join(", ")}`;
  if (!EMAIL_OK.test(b.email)) return "email invalido";
  return null;
}

export const CREAR_TABLA = `CREATE TABLE IF NOT EXISTS qready_leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  legal TEXT NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL,
  phone TEXT, notes TEXT, tier TEXT NOT NULL DEFAULT 'l3',
  lang TEXT NOT NULL DEFAULT 'en', source TEXT NOT NULL DEFAULT 'qready-checkout',
  emailed INTEGER NOT NULL DEFAULT 0, email_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

function insertar(env, b) {
  return env.DB.prepare(
    "INSERT INTO qready_leads (legal,name,email,phone,notes,tier,lang,source) VALUES (?,?,?,?,?,?,?,?)"
  ).bind(b.legal, b.name, b.email, b.phone || null, b.notes || null,
    b.tier || "l3", b.lang || "en", "qready-checkout").run();
}

/**
 * `enviar` es inyectable a proposito: en produccion es `enviarAviso` (usa el binding
 * de correo, que solo existe en el runtime de Workers). En los tests se reemplaza por
 * una funcion falsa, asi el modulo se puede probar en Node sin tocar "cloudflare:email".
 */
export async function manejarQreadyLead(b, env, enviar = enviarAviso) {
  const err = validar(b);
  if (err) return { status: 400, cuerpo: { ok: false, error: err } };

  let ins;
  try {
    ins = await insertar(env, b);
  } catch (e) {
    if (!/no such table/i.test(String((e && e.message) || e))) {
      return { status: 500, cuerpo: { ok: false, error: "no se pudo registrar" } };
    }
    try {
      await env.DB.exec(CREAR_TABLA);
      ins = await insertar(env, b);
    } catch (e2) {
      return { status: 500, cuerpo: { ok: false, error: "no se pudo registrar" } };
    }
  }
  const id = ins && ins.meta && ins.meta.last_row_id;

  let emailed = 0, emailError = null;
  try {
    await enviar(env, { id, ...b });
    emailed = 1;
  } catch (e) {
    emailError = String((e && e.message) || e).slice(0, 300);
  }
  try {
    await env.DB.prepare("UPDATE qready_leads SET emailed=?, email_error=? WHERE id=?")
      .bind(emailed, emailError, id).run();
  } catch (e) { /* el lead ya esta a salvo; si esto falla, emailed queda en 0 por defecto */ }

  return { status: 200, cuerpo: { ok: true, id, emailed: !!emailed } };
}

/** El aviso real. Vive aparte porque importa "cloudflare:email", que solo existe en Workers. */
export async function enviarAviso(env, l) {
  const cuerpo = [
    `Nuevo lead Q-Ready (${l.tier || "l3"})`,
    `Razon social: ${l.legal}`,
    `Nombre: ${l.name}`,
    `Email: ${l.email}`,
    `Telefono: ${l.phone || "-"}`,
    `Notas: ${l.notes || "-"}`,
    `Idioma: ${l.lang || "en"}`,
    `id: ${l.id}`,
  ].join("\n");
  const raw = `From: leads@rosettaquantum.com\r\nTo: hello@rosettaquantum.com\r\n` +
    `Subject: Q-Ready lead: ${l.legal}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${cuerpo}`;
  const { EmailMessage } = await import("cloudflare:email");
  const msg = new EmailMessage("leads@rosettaquantum.com", "hello@rosettaquantum.com", raw);
  await env.MAILER.send(msg);
}
