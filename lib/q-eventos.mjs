/**
 * Embudo de la landing pagada /es/q: los eventos y su lectura agregada.
 * Encargo del 6-nov-2026 (T3 y T4 del handoff de q-landing).
 *
 * La tabla `q_events` ya existia en D1 cuando esto se escribio; no la cree yo. Y trae dos
 * columnas que obligan a decidir, porque el encargo dice "sin cookies ni fingerprinting,
 * ip_hash con sal rotativa es el maximo":
 *
 *  · `ua`      — NO se guarda el user-agent crudo. Se guarda su CLASE (`claseUA` de
 *                lib/hits.mjs: browser, bot:other, ai:ChatGPT-User...). El invariante escrito
 *                en db/usage.schema.sql es "ningun user-agent", y un UA crudo identifica mas
 *                que un hash de IP: trae version de sistema, dispositivo y navegador. La
 *                columna se llama `ua` por herencia; lo que lleva dentro es la clase.
 *  · `ip_hash` — sha256 de (sal del dia + IP), truncado a 16 hex. La sal cambia cada dia, asi
 *                que dos visitas del mismo dia se pueden agrupar y dos de dias distintos NO:
 *                es lo que permite contar "cuantos" sin construir un historial por persona.
 *                Sin ninguna semilla configurada (`Q_IP_SALT`, o la `MEDICION_SAL_IP` que ya
 *                existe) no se escribe el campo, en vez de caer a una sal fija: una sal fija
 *                convierte el hash en un identificador permanente.
 *
 * El resto es el molde de la casa: nunca en el camino de la respuesta, nunca una excepcion
 * hacia afuera, y una lista blanca para todo lo que un tercero puede escribir. Un evento
 * llega por `sendBeacon`, que no lee el cuerpo de la respuesta: se contesta 204 y punto.
 */

import { claseUA } from "./hits.mjs";

/** Lo que un tercero puede escribir, y nada mas. Un `ev` libre convierte la tabla en basura. */
export const EVENTOS = ["view", "cta", "form_start", "form_submit", "outbound"];
export const LADOS = ["seguridad", "lab"];
/** Tope de cada texto. Un campo sin tope es un remitente decidiendo cuanto ocupa una fila. */
export const MAX = 120;

const recorta = (v) => {
  if (v == null) return null;
  const s = String(v).trim().replace(/[\u0000-\u001f\u007f]/g, "");
  return s ? s.slice(0, MAX) : null;
};

/** El host del referrer, nunca la URL completa: la ruta de donde vino no es asunto nuestro. */
export function hostDe(ref) {
  try { return ref ? new URL(ref).hostname.toLowerCase().slice(0, MAX) : null; } catch { return null; }
}

export async function ipHash(ip, salDelDia) {
  if (!ip || !salDelDia) return null;
  const datos = new TextEncoder().encode(`${salDelDia}:${ip}`);
  const h = await crypto.subtle.digest("SHA-256", datos);
  return [...new Uint8Array(h)].slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Valida y arma la fila. Devuelve { error } si el evento no es de los nuestros: se rechaza
 * ANTES de tocar la base, y el rechazo dice que se esperaba.
 */
export function filaEvento(cuerpo, { ua, ref, ipH } = {}) {
  const b = cuerpo && typeof cuerpo === "object" && !Array.isArray(cuerpo) ? cuerpo : {};
  const ev = recorta(b.ev);
  if (!ev || !EVENTOS.includes(ev)) return { error: `ev must be one of: ${EVENTOS.join(", ")}` };
  const side = recorta(b.side);
  if (side && !LADOS.includes(side)) return { error: `side must be one of: ${LADOS.join(", ")}` };
  return {
    fila: {
      ev, side,
      cta: recorta(b.cta), landing: recorta(b.landing), path: recorta(b.path),
      utm_source: recorta(b.utm_source), utm_medium: recorta(b.utm_medium),
      utm_campaign: recorta(b.utm_campaign), utm_term: recorta(b.utm_term),
      utm_content: recorta(b.utm_content),
      gclid: recorta(b.gclid), msclkid: recorta(b.msclkid),
      ref: hostDe(ref),
      // La CLASE, no el user-agent. Ver la cabecera de este archivo.
      ua: claseUA(ua),
      ip_hash: ipH || null,
      // No hay campo `dia`: la tabla tiene `ts` con su propio DEFAULT y el dia se saca de ahi
      // (`substr(ts,1,10)` en las estadisticas). Lo habia, declarado y relleno, y NO estaba en el
      // INSERT: un campo que nadie escribe y que el lector siguiente cree que existe. El dia si se
      // usa, para la sal del hash de IP, y eso vive en manejarEvento.
    },
  };
}

export const SQL_EVENTO =
  "INSERT INTO q_events (ev,side,cta,landing,path,utm_source,utm_medium,utm_campaign," +
  "utm_term,utm_content,gclid,msclkid,ref,ua,ip_hash) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";

export const BIND_EVENTO = (f) => [
  f.ev, f.side, f.cta, f.landing, f.path, f.utm_source, f.utm_medium, f.utm_campaign,
  f.utm_term, f.utm_content, f.gclid, f.msclkid, f.ref, f.ua, f.ip_hash,
];

/**
 * T3 — POST /api/q/event. Contesta 204 siempre que el evento sea valido, escriba o no:
 * `sendBeacon` no lee el cuerpo, y un 500 en un pixel no puede ser noticia para el visitante.
 * Un evento invalido SI devuelve 400, porque eso es un error de quien integra, no del visitante.
 */
export async function manejarEvento(request, env, ctx) {
  let cuerpo = null;
  try { cuerpo = await request.json(); } catch { /* un beacon puede llegar vacio */ }
  const dia = new Date().toISOString().slice(0, 10);
  // La semilla es `Q_IP_SALT` si esta puesta, y si no la de la medicion que ya existe. No es
  // comodidad: un paso colgado de una credencial que alguien tiene que acordarse de poner deja
  // de ocurrir, y mientras tanto `ip_hash` va vacio y "visitantes" dice 0 sin que nada avise.
  // Reusar la semilla NO reusa el hash: alla se calcula `sha256(sal|ip)` —una sal FIJA, o sea un
  // identificador permanente por persona, que es justo lo que este embudo no quiere— y aca
  // `sha256(sal:dia:ip)`. Dos derivaciones distintas de la misma entropia no se pueden cruzar.
  const semilla = env && (env.Q_IP_SALT || env.MEDICION_SAL_IP);
  const sal = semilla ? `${semilla}:${dia}` : null;
  const ipH = await ipHash(request.headers.get("cf-connecting-ip"), sal).catch(() => null);
  const r = filaEvento(cuerpo, {
    ua: request.headers.get("user-agent"),
    ref: request.headers.get("referer"),
    ipH,
  });
  if (r.error) return new Response(JSON.stringify({ ok: false, error: r.error }), { status: 400, headers: { "content-type": "application/json" } });
  try {
    const p = env.DB.prepare(SQL_EVENTO).bind(...BIND_EVENTO(r.fila)).run().catch(() => {});
    if (ctx && ctx.waitUntil) ctx.waitUntil(p); else await p;
  } catch { /* la medicion nunca rompe nada */ }
  return new Response(null, { status: 204 });
}

/**
 * T4 — GET /api/q/stats, protegido. La clave va en la CABECERA, nunca en el query string:
 * una clave en la URL queda escrita en todos los registros que la URL atraviesa.
 * Comparacion de largo constante para no filtrar el prefijo correcto por tiempo.
 */
export function claveOk(entregada, esperada) {
  if (!esperada || !entregada) return false;
  const a = new TextEncoder().encode(String(entregada));
  const b = new TextEncoder().encode(String(esperada));
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}

export function claveDe(request) {
  const h = request.headers.get("authorization") || "";
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m ? m[1] : null;
}

export async function manejarStats(request, env) {
  const esperada = env && env.Q_STATS_KEY;
  if (!esperada) {
    return new Response(JSON.stringify({ ok: false, error: "stats are not configured on this house" }), { status: 503, headers: { "content-type": "application/json" } });
  }
  if (!claveOk(claveDe(request), esperada)) {
    return new Response(JSON.stringify({ ok: false, error: "Authorization: Bearer <key> required" }), { status: 401, headers: { "content-type": "application/json" } });
  }
  const [porEvento, porCampana, porDia] = await env.DB.batch([
    env.DB.prepare("SELECT ev, side, COUNT(*) AS n FROM q_events GROUP BY ev, side ORDER BY n DESC"),
    env.DB.prepare("SELECT COALESCE(utm_source,'(directo)') AS fuente, COALESCE(utm_campaign,'') AS campana, COUNT(*) AS n FROM q_events GROUP BY fuente, campana ORDER BY n DESC LIMIT 50"),
    env.DB.prepare("SELECT substr(ts,1,10) AS dia, COUNT(*) AS n, COUNT(DISTINCT ip_hash) AS visitantes FROM q_events GROUP BY dia ORDER BY dia DESC LIMIT 30"),
  ]);
  const total = (porEvento.results || []).reduce((s, r) => s + r.n, 0);
  return new Response(JSON.stringify({
    ok: true, total,
    // El denominador viaja con el resultado: un total sin su ventana no dice nada.
    desde: (porDia.results || []).at(-1)?.dia || null,
    hasta: (porDia.results || [])[0]?.dia || null,
    por_evento: porEvento.results || [],
    por_campana: porCampana.results || [],
    por_dia: porDia.results || [],
    // Lo que esta medicion NO sabe, escrito al lado del numero y no en otra parte.
    limites: [
      "visitantes = ip_hash distintos del dia, con sal que cambia cada dia: no se puede seguir a nadie entre dias, y por eso tampoco se suman entre dias",
      "sin semilla configurada (Q_IP_SALT o MEDICION_SAL_IP), ip_hash va vacio y visitantes es 0",
      "ua es la CLASE del agente, nunca el user-agent crudo",
    ],
  }), { status: 200, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}
