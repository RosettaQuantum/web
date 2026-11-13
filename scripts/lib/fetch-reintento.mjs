/*
 * Reintento de red para TODOS los chequeos del deploy (13-nov-2026).
 *
 * Desde el runner de GitHub la conexión a Cloudflare se corta al azar (ECONNRESET, «fetch failed»):
 * el mismo día cayó en /library/registry, /for/pilots y el chequeo del catálogo, cada vez en otro
 * lugar y con el sitio sano. Parchar chequeo por chequeo es perseguirlo; esto se carga una vez con
 * NODE_OPTIONS=--import en deploy.yml y cubre a todos.
 *
 * Precisión antes que cobertura: sólo GET y HEAD (un POST no se repite: podría escribir dos veces),
 * y sólo cuando fetch LANZA (la red se cayó). Una respuesta HTTP mala —404, 500— vuelve tal cual:
 * ese sí es un hallazgo y el chequeo tiene que verlo.
 */
const original = globalThis.fetch;
if (typeof original === "function" && !original.__reintento) {
  const reintentar = async function fetch(entrada, opciones) {
    const metodo = String(opciones?.method || entrada?.method || "GET").toUpperCase();
    if (metodo !== "GET" && metodo !== "HEAD") return original(entrada, opciones);
    for (let k = 1; ; k++) {
      try { return await original(entrada, opciones); }
      catch (e) {
        if (k >= 3 || e?.name === "AbortError") throw e;
        await new Promise((r) => setTimeout(r, 1500 * k));
      }
    }
  };
  reintentar.__reintento = true;
  globalThis.fetch = reintentar;
}
