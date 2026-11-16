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
 *  3b. Copia GLOBAL de crt.sh en D1 (ct_copia), de hasta 30 días (12-nov-2026): la caché del borde
 *     es por centro de datos, y en otro colo la copia no existía (QEX 56 → 58 con Cert Spotter).
 *     Una copia de D1 de menos de 24 h se usa ANTES de ir a crt.sh, igual que la del borde.
 *  4. Cert Spotter (SSLMate), segunda fuente pública del mismo registro, paginada, con copia
 *     aparte de 1 h. OJO: sólo devuelve certificados VIGENTES (medido: 120 contra 1.873 de
 *     crt.sh para un mismo banco), así que ve menos nombres. Se declara en la foto.
 *  5. Si nada responde, 503 con la razón: el navegador sigue midiendo sin superficie.
 *
 * UNIR, NO ELEGIR (16-nov-2026). Elegir UNA fuente hacía que la nota dependiera de cuál contestó.
 * Medido ese día: para un dominio real, crt.sh devolvió 135 certificados con UN solo nombre (el apex
 * y el comodín) y la nota salió C; Cert Spotter devolvió 17 nombres, entre ellos staging y
 * serverless-staging, que responden, y con esa fuente la nota salía F. Ahora se piden las dos EN
 * PARALELO (tope ~25 s, no 25 + 20) y se suman sus filas. Cada fuente conserva su propio camino de
 * copias (borde y D1, frescas 24 h; viejas hasta 7 y 30 días). Si una falla, se declara en `intentos`
 * y se usa la otra, igual que antes. La respuesta declara en `fuentes` cuáles se usaron, con su fecha.
 * Esto SÍ puede mover la higiene del QEX: más nombres vistos, más clases contadas.
 *
 * El cuerpo trae el TEXTO crudo de las filas para que el navegador calcule el sha256 igual que
 * antes: la huella sigue siendo de lo que se recibió (la unión, si hubo dos fuentes), no de lo que
 * el servidor reinterpretó.
 */
const CRTSH_MS = 25000;
const CS_MS = 20000;
const CS_PAGINAS = 10;            // 100 emisiones por página → hasta 1.000
const FRESCA_S = 24 * 3600;
const VIEJA_S = 7 * 24 * 3600;
// Antes la copia de Cert Spotter vivía sólo una hora porque REEMPLAZABA a crt.sh (menos nombres, higiene
// más alta). Unidas, ya no reemplaza: suma, y vive lo mismo que la de crt.sh para que tres mediciones
// seguidas vean los mismos nombres.
const CS_FRESCA_S = FRESCA_S;
const POR_MINUTO = 6;
const D1_VIEJA_S = 30 * 24 * 3600;
const D1_MAX = 1_900_000;         // D1 acepta filas de hasta 2 MB
const CS = "Cert Spotter (SSLMate), sólo certificados vigentes";
export const FUENTE_UNION = "crt.sh + Cert Spotter (SSLMate)";
// La copia global de Cert Spotter va en la MISMA tabla ct_copia, con esta clave delante del dominio:
// sin migración, y ninguna consulta por dominio válido la confunde con la de crt.sh («:» no es de un dominio).
export const CLAVE_D1_CS = "certspotter:";

async function gz(texto) {
  const s = new Blob([texto]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(s).arrayBuffer());
}
async function desgz(bytes) {
  const s = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return await new Response(s).text();
}
// `clave` es el dominio (copia de crt.sh) o CLAVE_D1_CS + dominio (copia de Cert Spotter).
export async function leerD1(db, clave, fuente = "crt.sh") {
  if (!db) return null;
  try {
    const f = await db.prepare("SELECT consultado_utc, ms, gz FROM ct_copia WHERE dominio = ?").bind(clave).first();
    if (!f || !f.gz) return null;
    return { fuente, consultado_utc: f.consultado_utc, ms: f.ms, texto: await desgz(new Uint8Array(f.gz)), intentos: [] };
  } catch { return null; }
}
export async function guardarD1(db, dominio, o) {
  if (!db) return false;
  const b = await gz(o.texto);
  if (b.byteLength > D1_MAX) return false;
  await db.prepare("INSERT INTO ct_copia (dominio, consultado_utc, ms, gz) VALUES (?, ?, ?, ?) ON CONFLICT(dominio) DO UPDATE SET consultado_utc = excluded.consultado_utc, ms = excluded.ms, gz = excluded.gz WHERE excluded.consultado_utc > ct_copia.consultado_utc")
    .bind(dominio, o.consultado_utc, o.ms ?? null, b).run();
  return true;
}

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

// Une las respuestas de las fuentes en UNA lista de filas con la forma de crt.sh. Los certificados no se
// deduplican (crt.sh da id y número de serie; Cert Spotter, huellas: no comparten identificador), así
// que `filas` suma las de ambas; los NOMBRES quedan únicos porque nombresCT los agrupa por nombre.
export function unirFilas(textos) {
  return JSON.stringify(textos.flatMap((t) => JSON.parse(t)));
}
const cuantas = (texto) => { try { return JSON.parse(texto).length; } catch { return null; } };
// Lo que la respuesta declara de cada fuente usada (sin el texto).
export const metaFuente = (p) => ({ fuente: p.fuente, consultado_utc: p.consultado_utc, ms: p.ms ?? null,
  desde_copia: !!p.desde_copia, vieja: !!p.vieja, certificados: cuantas(p.texto) });

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

export async function manejarCT(request, ctx, env = {}) {
  if (request.method !== "GET") return json({ ok: false, error: "use GET" }, 405);
  const dominio = (new URL(request.url).searchParams.get("d") || "").trim().toLowerCase();
  if (!dominioValido(dominio)) return json({ ok: false, error: "dominio inválido" }, 400);

  // DOS copias separadas por fuente, a propósito. Medido el 11-nov en producción: crt.sh falló, Cert
  // Spotter devolvió 120 certificados (sólo vigentes) contra 1.873 de crt.sh, y esa respuesta quedó como
  // LA copia por 24 h. Menos nombres vistos = higiene más alta = un índice que mejora sin que nada haya
  // cambiado. Por eso cada fuente tiene su copia, y si crt.sh cae hoy se usa su copia vieja (hasta 7
  // días en el borde, 30 en D1) JUNTO con Cert Spotter, nunca Cert Spotter solo si hay copia de crt.sh.
  const c = caches.default;
  const kCrt = new Request(`https://rosettaquantum.com/__ct/v2/crtsh/${dominio}`);
  const kCs = new Request(`https://rosettaquantum.com/__ct/v2/cs/${dominio}`);
  const leer = async (k) => { const r = await c.match(k); return r ? await r.json().catch(() => null) : null; };
  const edad = (o) => o ? (Date.now() - Date.parse(o.consultado_utc)) / 1000 : Infinity;
  const guardar = (k, o) => ctx.waitUntil(c.put(k, new Response(JSON.stringify(o), { headers: { "cache-control": `max-age=${VIEJA_S}` } })));
  const masNueva = (...xs) => xs.filter(Boolean).sort((a, b) => edad(a) - edad(b))[0] || null;
  const falla = (e) => e.name === "AbortError" ? "no respondió a tiempo" : String(e.message || e);

  const [copiaCrt, copiaD1, copiaCs, copiaCsD1] = await Promise.all([leer(kCrt), leerD1(env.DB, dominio),
    leer(kCs), leerD1(env.DB, CLAVE_D1_CS + dominio, CS)]);
  // una copia del borde más nueva que la global sube a D1, para que los otros colos la tengan
  if (copiaCrt && edad(copiaCrt) < edad(copiaD1)) ctx.waitUntil(guardarD1(env.DB, dominio, copiaCrt).catch(() => false));
  if (copiaCs && edad(copiaCs) < edad(copiaCsD1)) ctx.waitUntil(guardarD1(env.DB, CLAVE_D1_CS + dominio, copiaCs).catch(() => false));

  // Cada fuente, por su propio camino: copia fresca (borde o D1) → la red → copia vieja declarada.
  const fuentes = {
    crt: { nombre: "crt.sh", k: kCrt, borde: copiaCrt, d1: copiaD1, clave: dominio, fresca_s: FRESCA_S, pedir: () => crtsh(dominio) },
    cs: { nombre: CS, k: kCs, borde: copiaCs, d1: copiaCsD1, clave: CLAVE_D1_CS + dominio, fresca_s: CS_FRESCA_S, pedir: () => certSpotter(dominio) },
  };
  for (const f of Object.values(fuentes)) {
    const m = masNueva(f.borde, f.d1);
    f.fresca = m && edad(m) < f.fresca_s ? m : null;
    if (f.fresca && f.fresca === f.d1 && f.borde !== f.d1) guardar(f.k, f.d1);
  }
  const hayFresca = fuentes.crt.fresca || fuentes.cs.fresca;
  const faltaRed = !fuentes.crt.fresca || !fuentes.cs.fresca;
  const puedeRed = faltaRed ? await limitar(request) : true;
  if (!puedeRed && !hayFresca) return json({ ok: false, error: "demasiadas consultas; espere un minuto" }, 429);

  async function parte(f) {
    const intentos = [];
    if (f.fresca) return { p: { ...f.fresca, desde_copia: true }, intentos };
    if (puedeRed) {
      const t = Date.now();
      try {
        const texto = await f.pedir();
        const o = { fuente: f.nombre, consultado_utc: new Date().toISOString(), ms: Date.now() - t, texto };
        guardar(f.k, o);
        ctx.waitUntil(guardarD1(env.DB, f.clave, o).catch(() => false));
        return { p: { ...o, desde_copia: false }, intentos };
      } catch (e) { intentos.push({ fuente: f.nombre, ms: Date.now() - t, error: falla(e) }); }
    } else intentos.push({ fuente: f.nombre, ms: 0, error: "demasiadas consultas; espere un minuto" });
    // la más reciente de las dos copias viejas de ESTA fuente (borde de este colo, o D1 global)
    const vieja = masNueva(f.borde && edad(f.borde) < VIEJA_S ? f.borde : null, f.d1 && edad(f.d1) < D1_VIEJA_S ? f.d1 : null);
    return { p: vieja ? { ...vieja, desde_copia: true, vieja: true } : null, intentos };
  }
  const [rc, rs] = await Promise.all([parte(fuentes.crt), parte(fuentes.cs)]);
  const intentos = [...rc.intentos, ...rs.intentos];
  const partes = [rc.p, rs.p].filter(Boolean);
  if (!partes.length) return json({ ok: false, error: "el registro público no respondió", intentos }, 503);
  if (partes.length === 1) {
    const { fuente, consultado_utc, ms, texto, desde_copia, vieja } = partes[0];
    return json({ fuente, consultado_utc, ms, texto, ok: true, desde_copia, ...(vieja ? { vieja: true } : {}), intentos, fuentes: [metaFuente(partes[0])] });
  }
  // las dos: la fecha que se declara es la MÁS VIEJA de las dos (lo conservador), y si alguna salió de
  // una copia, la respuesta entera se declara copia.
  const [a, b] = partes;
  return json({ fuente: FUENTE_UNION, consultado_utc: edad(a) > edad(b) ? a.consultado_utc : b.consultado_utc,
    ms: Math.max(a.ms ?? 0, b.ms ?? 0), texto: unirFilas([a.texto, b.texto]), ok: true,
    desde_copia: !!(a.desde_copia || b.desde_copia), ...(a.vieja || b.vieja ? { vieja: true } : {}),
    intentos, fuentes: partes.map(metaFuente) });
}
