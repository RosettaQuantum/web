/**
 * El registro público de certificados (Certificate Transparency), servido por el Worker.
 *
 * EL DEFECTO QUE ESTO CIERRA (medido el 11-nov-2026). La medición en vivo le preguntaba a crt.sh
 * DESDE EL NAVEGADOR y esperaba hasta 120 s antes de medir nada más. crt.sh es un servicio
 * público y lento: cuatro consultas seguidas por un dominio de banco dieron >60 s sin respuesta,
 * 41 s, 13 s y 17 s; otras tres por otro dominio, 36 s y dos 502. Para el visitante, «Midiendo…»
 * durante uno o dos minutos y luego una caja que le pide subir un archivo .json. La página no
 * estaba rota: dependía de un tercero sin plan B.
 *
 * Lo que hace ahora, en orden, y cada respuesta declara cuál de los caminos la produjo:
 *  1. Copia de crt.sh de menos de 24 h en la caché del borde (con su fecha).
 *  2. crt.sh con tope de 25 s.
 *  3. Copia de crt.sh de hasta 7 días, declarada como vieja: mismo método que siempre.
 *  4. Cert Spotter (SSLMate), segunda fuente pública del mismo registro, paginada, con copia
 *     aparte de 1 h. OJO: sólo devuelve certificados VIGENTES (medido: 120 contra 1.873 de
 *     crt.sh para un mismo banco), así que ve menos nombres. Se declara en la foto.
 *  5. Si nada responde, 503 con la razón: el navegador sigue midiendo sin superficie.
 *
 * El cuerpo trae el TEXTO crudo de las filas para que el navegador calcule el sha256 igual que
 * antes: la huella sigue siendo de lo que se recibió, no de lo que el servidor reinterpretó.
 */
const CRTSH_MS = 25000;
const CS_MS = 20000;
const CS_PAGINAS = 10;            // 100 emisiones por página → hasta 1.000
const FRESCA_S = 24 * 3600;
const VIEJA_S = 7 * 24 * 3600;
const CS_FRESCA_S = 3600;        // la copia de Cert Spotter vive aparte y sólo una hora
const POR_MINUTO = 6;

const json = (o, status = 200) => new Response(JSON.stringify(o), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

export function dominioValido(d) {
  return typeof d === "string" && d.length <= 253 && /^([a-z0-9-]+\.)+[a-z]{2,}$/.test(d);
}

// Cert Spotter → filas con la forma de crt.sh (name_value separado por saltos de línea).
export function filasDesdeCertSpotter(emisiones) {
  return emisiones.map((e) => ({
    name_value: (e.dns_names || []).join("\n"),
    not_before: e.not_before || null,
    not_after: e.not_after || null,
    id: e.id || null,
  }));
}

async function conTope(url, ms, init = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try { return await fetch(url, { ...init, signal: ctl.signal }); } finally { clearTimeout(t); }
}

async function crtsh(dominio) {
  const r = await conTope(`https://crt.sh/?q=%25.${encodeURIComponent(dominio)}&output=json`, CRTSH_MS,
    { headers: { "user-agent": "RosettaQuantum-QReady/1 (+https://rosettaquantum.com/es/q-ready/medicion/)" } });
  if (!r.ok) throw new Error(`crt.sh respondió ${r.status}`);
  const texto = await r.text();
  if (!Array.isArray(JSON.parse(texto))) throw new Error("crt.sh no devolvió una lista");
  return texto;
}

export async function certSpotter(dominio, fetchImpl = fetch) {
  const todas = [];
  let despues = null;
  const fin = Date.now() + CS_MS;
  for (let i = 0; i < CS_PAGINAS && Date.now() < fin; i++) {
    const u = `https://api.certspotter.com/v1/issuances?domain=${encodeURIComponent(dominio)}&include_subdomains=true&expand=dns_names${despues ? `&after=${encodeURIComponent(despues)}` : ""}`;
    const r = await fetchImpl(u);
    if (!r.ok) { if (todas.length) break; throw new Error(`Cert Spotter respondió ${r.status}`); }
    const pag = await r.json();
    if (!Array.isArray(pag)) throw new Error("Cert Spotter no devolvió una lista");
    todas.push(...pag);
    if (pag.length < 100) break;
    despues = pag[pag.length - 1].id;
  }
  return JSON.stringify(filasDesdeCertSpotter(todas));
}

async function limitar(request) {
  const ip = request.headers.get("cf-connecting-ip") || "x";
  const k = new Request(`https://rosettaquantum.com/__lim/ct/${ip}/${Math.floor(Date.now() / 60000)}`);
  const c = caches.default;
  const prev = await c.match(k);
  const n = prev ? Number(await prev.text()) || 0 : 0;
  if (n >= POR_MINUTO) return false;
  await c.put(k, new Response(String(n + 1), { headers: { "cache-control": "max-age=70" } }));
  return true;
}

export async function manejarCT(request, ctx) {
  if (request.method !== "GET") return json({ ok: false, error: "use GET" }, 405);
  const dominio = (new URL(request.url).searchParams.get("d") || "").trim().toLowerCase();
  if (!dominioValido(dominio)) return json({ ok: false, error: "dominio inválido" }, 400);

  // DOS copias separadas, a propósito. Medido el 11-nov en producción: crt.sh falló, Cert Spotter
  // devolvió 120 certificados (sólo vigentes) contra 1.873 de crt.sh, y esa respuesta quedó como LA
  // copia por 24 h. Menos nombres vistos = higiene más alta = un índice que mejora sin que nada haya
  // cambiado. Por eso: una copia de crt.sh, aunque tenga hasta 7 días, gana a Cert Spotter; y la de
  // Cert Spotter vive aparte y sólo una hora.
  const c = caches.default;
  const kCrt = new Request(`https://rosettaquantum.com/__ct/v2/crtsh/${dominio}`);
  const kCs = new Request(`https://rosettaquantum.com/__ct/v2/cs/${dominio}`);
  const leer = async (k) => { const r = await c.match(k); return r ? await r.json().catch(() => null) : null; };
  const edad = (o) => o ? (Date.now() - Date.parse(o.consultado_utc)) / 1000 : Infinity;
  const guardar = (k, o) => ctx.waitUntil(c.put(k, new Response(JSON.stringify(o), { headers: { "cache-control": `max-age=${VIEJA_S}` } })));

  const copiaCrt = await leer(kCrt);
  if (copiaCrt && edad(copiaCrt) < FRESCA_S) return json({ ...copiaCrt, ok: true, desde_copia: true });
  if (!await limitar(request)) return json({ ok: false, error: "demasiadas consultas; espere un minuto" }, 429);

  const intentos = [];
  let t = Date.now();
  try {
    const texto = await crtsh(dominio);
    const o = { fuente: "crt.sh", consultado_utc: new Date().toISOString(), ms: Date.now() - t, texto, intentos };
    guardar(kCrt, o);
    return json({ ...o, ok: true, desde_copia: false });
  } catch (e) {
    intentos.push({ fuente: "crt.sh", ms: Date.now() - t, error: e.name === "AbortError" ? "no respondió a tiempo" : String(e.message || e) });
  }
  if (copiaCrt && edad(copiaCrt) < VIEJA_S) return json({ ...copiaCrt, ok: true, desde_copia: true, vieja: true, intentos });

  const CS = "Cert Spotter (SSLMate), sólo certificados vigentes";
  const copiaCs = await leer(kCs);
  if (copiaCs && edad(copiaCs) < CS_FRESCA_S) return json({ ...copiaCs, ok: true, desde_copia: true, intentos });
  t = Date.now();
  try {
    const texto = await certSpotter(dominio);
    const o = { fuente: CS, consultado_utc: new Date().toISOString(), ms: Date.now() - t, texto, intentos };
    guardar(kCs, o);
    return json({ ...o, ok: true, desde_copia: false });
  } catch (e) {
    intentos.push({ fuente: CS, ms: Date.now() - t, error: e.name === "AbortError" ? "no respondió a tiempo" : String(e.message || e) });
  }
  if (copiaCs) return json({ ...copiaCs, ok: true, desde_copia: true, vieja: true, intentos });
  return json({ ok: false, error: "el registro público no respondió", intentos }, 503);
}
