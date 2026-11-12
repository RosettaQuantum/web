// Cloudflare Turnstile del lado del Worker (12-nov-2026). Los formularios que piden un correo
// (informe de la industria en /es/q-ready y «Descargar mi informe» en la medición) mandan el
// token del widget; aquí se pregunta a Cloudflare si es válido ANTES de escribir nada en D1.
//
// FALLA CERRADO: sin secreto configurado, sin token, con un token raro, si Cloudflare no
// responde o responde algo que no es {success:true}, la respuesta es «no». Un antibots que deja
// pasar cuando no puede verificar es un antibots que se apaga solo el día que falla la red.
//
// El secreto vive en env.TURNSTILE_SECRET (secret del Worker; en local, .dev.vars con la clave
// de prueba que publica Cloudflare). La clave del sitio es pública y va en el JS de la página.
export const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** ¿Es válido este token? Devuelve { ok, motivo }. Nunca lanza. */
export async function verificarTurnstile(token, env, ip) {
  const secreto = env && env.TURNSTILE_SECRET;
  if (!secreto) return { ok: false, motivo: "sin-secreto" };
  if (typeof token !== "string" || !token || token.length > 2048) return { ok: false, motivo: "sin-token" };
  const cuerpo = new URLSearchParams({ secret: secreto, response: token });
  if (ip) cuerpo.set("remoteip", ip);
  try {
    const r = await fetch(SITEVERIFY, { method: "POST", body: cuerpo });
    const j = await r.json().catch(() => null);
    if (j && j.success === true) return { ok: true, motivo: null };
    return { ok: false, motivo: (j && j["error-codes"] || []).join(",") || `http-${r.status}` };
  } catch (e) {
    return { ok: false, motivo: "siteverify-no-responde" };
  }
}
