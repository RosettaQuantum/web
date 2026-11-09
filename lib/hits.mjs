/**
 * Contador propio de visitas: cuantas lecturas tiene cada pagina del blog, y cuantas de
 * ellas vienen de agentes de IA (la metrica GEO). Encargo del 8-nov-2026.
 *
 * Reglas del encargo, y por que cada una:
 *  · NUNCA en el camino de la respuesta: va por ctx.waitUntil y los errores se tragan. Un
 *    contador caido no puede bajar una pagina.
 *  · Privacidad: no se guarda IP, ni el user-agent crudo, ni el query string. Solo la clase
 *    del agente, el host del referrer y la ruta.
 *  · Solo GET con 200, en las rutas que se leen: /, el blog en los dos idiomas, /llms.txt y
 *    /rss.xml. Solo en rosettaquantum.com: el preview escribe en la MISMA base, y sus
 *    visitas de prueba ensuciarian la cifra.
 */

/** Orden de la lista = orden de prueba. El primero que calza gana. */
const CLASES = [
  ["ai", ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-User", "anthropic",
          "PerplexityBot", "Perplexity-User", "Google-Extended", "CCBot", "Bytespider",
          "meta-externalagent", "cohere"]],
  ["search", ["Googlebot", "Bingbot", "DuckDuckBot"]],
];

export function claseUA(ua) {
  const u = String(ua || "").toLowerCase();
  for (const [pref, nombres] of CLASES)
    for (const n of nombres) if (u.includes(n.toLowerCase())) return `${pref}:${n}`;
  if (/bot|crawler|spider/.test(u)) return "bot:other";
  return "browser";
}

const RUTAS = /^\/(?:$|llms\.txt$|rss\.xml$|blog(?:\/|$)|es\/blog(?:\/|$))/;

export function debeContar(request, response) {
  if (request.method !== "GET" || !response || response.status !== 200) return false;
  const url = new URL(request.url);
  if (url.hostname !== "rosettaquantum.com") return false;
  return RUTAS.test(url.pathname);
}

export function hostReferrer(ref) {
  try { return ref ? new URL(ref).hostname.toLowerCase() : ""; } catch { return ""; }
}

export function filaVisita(request, ahora = new Date()) {
  const url = new URL(request.url);
  return {
    day: ahora.toISOString().slice(0, 10),
    path: url.pathname,
    ua_class: claseUA(request.headers.get("user-agent")),
    referrer_host: hostReferrer(request.headers.get("referer")),
  };
}

export const SQL_HIT =
  "INSERT INTO hits (day,path,ua_class,referrer_host,n) VALUES (?,?,?,?,1) " +
  "ON CONFLICT(day,path,ua_class,referrer_host) DO UPDATE SET n = n + 1";

export function registrarVisita(request, response, env, ctx) {
  try {
    if (!env || !env.DB || !ctx || !debeContar(request, response)) return;
    const f = filaVisita(request);
    ctx.waitUntil(env.DB.prepare(SQL_HIT).bind(f.day, f.path, f.ua_class, f.referrer_host).run().catch(() => {}));
  } catch { /* el contador nunca rompe la respuesta */ }
}
