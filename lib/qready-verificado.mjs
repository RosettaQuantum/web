// Q-Ready Verified (13-nov-2026): el dominio que su dueño verifica por DNS, su nota pública, su
// sello y su re-medición diaria. Tablas en db/qready-verificado.schema.sql.
//
// LA REGLA QUE ESTE ARCHIVO EXISTE PARA CUMPLIR: nunca se publica la nota con nombre de un tercero.
// Una nota con nombre sale SÓLO si el dueño verificó el dominio por DNS y eligió «público». Todo lo
// que muestra un dominio por su nombre —la página /verificado, el sello, la herramienta MCP, la ruta
// /v1/qready/grade— pasa por UNA función: dominioPublico(). Si no hay fila verificada y pública, la
// respuesta es 404, el sello neutro o null. scripts/check-qready-verificado.mjs lo ejerce.
//
// FALLA CERRADO, Y SIN CONFUNDIR AUSENCIA CON ERROR:
//   · sin el TXT exacto no hay verificación;
//   · sólo la AUSENCIA CONFIRMADA del TXT (DNS respondió NOERROR o NXDOMAIN y el valor no está)
//     despublica. Un error de red, un 5xx del resolvedor o un SERVFAIL se anotan y no cambian nada:
//     una falla de red no se lee como «borraron el TXT».
//
// No abre sockets ni importa CSS: lo cargan los guardias en node. Las rutas que necesitan los tokens
// de marca o el motor de medición los reciben de worker.js (lib/qready-rutas.mjs).
import * as N from "../public/js/qex-nucleo.mjs";
import { textos, FIRMA, snippetSello } from "../public/js/qready-textos.mjs";
import { verificarTurnstile } from "./turnstile.mjs";
import { permitido, normalizarHost } from "./borde-envivo.mjs";

export const SITE = "https://rosettaquantum.com";
export const TXT_PREFIJO = "qready-verificacion=";
export const nombreTxt = (dominio) => `_qready.${dominio}`;
export const valorTxt = (token) => `${TXT_PREFIJO}${token}`;
export const DOH = "https://cloudflare-dns.com/dns-query";
export const ORIGEN_SERVIDOR = "Medición diaria Q-Ready Verified desde rosettaquantum.com.";
const SECTORES_OK = /^[a-z_]{2,30}$/;
const EMAIL = /^[^@\s<>"]{1,64}@[a-z0-9.-]{1,190}\.[a-z]{2,}$/i;

// ---------------------------------------------------------------- entorno (producción / prueba)
// Modo de prueba del DNS: SÓLO con la variable QREADY_PRUEBA_DNS="1" (declarada únicamente en
// env.preview de wrangler.jsonc) Y sirviendo desde *.workers.dev. En ese modo el «TXT» se simula con
// la columna txt_prueba y todo se escribe y se lee con entorno 'preview-prueba', que producción no lee.
export function modoPrueba(env, url) {
  return !!(env && env.QREADY_PRUEBA_DNS === "1" && url && /\.workers\.dev$/.test(url.hostname));
}
export const entornoDe = (env, url) => (modoPrueba(env, url) ? "preview-prueba" : "produccion");

export function generarToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------- DNS sobre HTTPS
// Devuelve { estado: 'respuesta' | 'error', valores, detalle }. 'respuesta' = el resolvedor contestó
// con autoridad sobre el nombre (NOERROR o NXDOMAIN). Cualquier otra cosa es 'error'.
const RCODE = { 0: "NOERROR", 1: "FORMERR", 2: "SERVFAIL", 3: "NXDOMAIN", 4: "NOTIMP", 5: "REFUSED" };
export async function consultarTxtDoh(nombre, f = fetch) {
  let r;
  try {
    r = await f(`${DOH}?name=${encodeURIComponent(nombre)}&type=TXT`, { headers: { accept: "application/dns-json" } });
  } catch (e) { return { estado: "error", valores: [], detalle: `sin respuesta del resolvedor: ${e && e.message || e}` }; }
  if (!r || !r.ok) return { estado: "error", valores: [], detalle: `el resolvedor respondió ${r ? r.status : "nada"}` };
  let j;
  try { j = await r.json(); } catch { return { estado: "error", valores: [], detalle: "respuesta DNS ilegible" }; }
  if (!j || typeof j.Status !== "number") return { estado: "error", valores: [], detalle: "respuesta DNS sin Status" };
  if (j.Status !== 0 && j.Status !== 3) return { estado: "error", valores: [], detalle: `DNS ${RCODE[j.Status] || "RCODE " + j.Status}` };
  // Un TXT puede venir partido en varias cadenas entre comillas: se unen sin separador (RFC 7208 §3.3).
  const valores = (j.Answer || []).filter((a) => a.type === 16)
    .map((a) => { const s = String(a.data || ""); const p = s.match(/"((?:[^"\\]|\\.)*)"/g); return p ? p.map((x) => x.slice(1, -1)).join("") : s; });
  return { estado: "respuesta", valores, detalle: `DNS ${RCODE[j.Status]}` };
}

// En modo de prueba: el «TXT» es la columna txt_prueba de la fila. 'error' simula una falla de red.
export async function consultarTxtPrueba(fila) {
  if (fila.txt_prueba === "error") return { estado: "error", valores: [], detalle: "falla de red simulada (modo de prueba)" };
  return { estado: "respuesta", valores: fila.txt_prueba ? [fila.txt_prueba] : [], detalle: "DNS simulado (modo de prueba)" };
}

// La decisión, pura: ¿presente, ausente o error? Sólo 'ausente' puede despublicar.
export function decidirTxt(consulta, token) {
  if (!consulta || consulta.estado !== "respuesta") return "error";
  return consulta.valores.some((v) => v.trim() === valorTxt(token)) ? "presente" : "ausente";
}

// ---------------------------------------------------------------- la compuerta
// LA ÚNICA función que decide si un dominio se muestra por su nombre. Verificado Y público, en el
// entorno que corresponde. Devuelve la fila o null.
export async function dominioPublico(db, dominio, entorno = "produccion") {
  const d = normalizarHost(dominio);
  if (!d || !db) return null;
  return await db.prepare(
    "SELECT token, dominio, sector, verificado_en, inventario_verificado_en FROM qready_dominios " +
    "WHERE dominio = ?1 AND entorno = ?2 AND verificado_en IS NOT NULL AND publico = 1 LIMIT 1")
    .bind(d, entorno).first();
}

// Mediciones que se pueden mostrar: SÓLO las del servidor. Llamar sólo después de dominioPublico().
export async function medicionesDe(db, dominio, entorno = "produccion", limite = 60) {
  const r = await db.prepare(
    "SELECT fecha, qex, nota, sha256, foto_json FROM qready_mediciones " +
    "WHERE dominio = ?1 AND entorno = ?2 AND origen = 'servidor' ORDER BY fecha DESC LIMIT ?3")
    .bind(dominio, entorno, limite).all();
  return r.results || [];
}

// La nota pública de un dominio: lo que muestran el sello, la página y la herramienta MCP.
// null si el dominio no está verificado y público. Si lo está pero aún no hay medición, nota null.
export async function notaPublica(db, dominio, entorno = "produccion") {
  const fila = await dominioPublico(db, dominio, entorno);
  if (!fila) return null;
  const [m] = await medicionesDe(db, fila.dominio, entorno, 1);
  return { dominio: fila.dominio, verificado_en: fila.verificado_en, nota: m ? m.nota : null, qex: m ? m.qex : null,
    fecha: m ? m.fecha : null, sha256: m ? m.sha256 : null };
}

// ---------------------------------------------------------------- guardar una medición
// La foto tiene que estar íntegra (la huella cubre la foto entera). La nota y el QEX se recalculan
// AQUÍ desde la foto: no se le cree la letra a quien la manda. Devuelve { ok, id, ya_estaba }.
export async function guardarMedicion(db, { foto, origen, entorno = "produccion", extras = {} }) {
  if (!db) return { ok: false, error: "sin base" };
  if (!foto || foto.esquema !== N.ESQUEMA_FOTO || !(await N.fotoIntegra(foto))) return { ok: false, error: "foto no íntegra" };
  const dominio = normalizarHost(foto.dominio);
  if (!dominio) return { ok: false, error: "dominio inválido" };
  if (origen !== "pagina" && origen !== "servidor") return { ok: false, error: "origen inválido" };
  const nota = N.notaQEX(foto, extras);
  const qex = foto.qex && Number.isInteger(foto.qex.score) ? foto.qex.score : null;
  const id = crypto.randomUUID();
  const r = await db.prepare(
    "INSERT INTO qready_mediciones (id, dominio, fecha, qex, nota, sha256, foto_json, origen, entorno, creado_utc) " +
    "VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10) ON CONFLICT (dominio, sha256) DO NOTHING RETURNING id")
    .bind(id, dominio, foto.medido_utc, qex, nota, foto.sha256, JSON.stringify(foto), origen, entorno, new Date().toISOString()).first();
  if (r && r.id === id) return { ok: true, id, nota, ya_estaba: false };
  // No volvió fila: o ya estaba (misma huella) o la base no escribió. Se le pregunta a la base.
  const ya = await db.prepare("SELECT id FROM qready_mediciones WHERE dominio = ?1 AND sha256 = ?2").bind(dominio, foto.sha256).first();
  return ya ? { ok: true, id: ya.id, nota, ya_estaba: true } : { ok: false, error: "la base no confirmó la fila" };
}

// ---------------------------------------------------------------- alta y comprobación
export async function alta(db, { dominio, sector, contacto, publico }, entorno = "produccion", sectoresValidos = null) {
  const d = normalizarHost(dominio);
  if (!d || !N.dominioDeEntrada(d)) return { ok: false, http: 400, error: "dominio" };
  if (!SECTORES_OK.test(String(sector || "")) || (sectoresValidos && !sectoresValidos.includes(sector))) return { ok: false, http: 400, error: "sector" };
  const c = contacto ? String(contacto).trim().toLowerCase() : null;
  if (c && !EMAIL.test(c)) return { ok: false, http: 400, error: "contacto" };
  const token = generarToken();
  const r = await db.prepare(
    "INSERT INTO qready_dominios (token, dominio, sector, contacto, publico, entorno, creado_utc) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7) RETURNING token")
    .bind(token, d, sector, c, publico === true ? 1 : 0, entorno, new Date().toISOString()).first();
  if (!r || r.token !== token) return { ok: false, http: 500, error: "la base no confirmó el pedido" };
  return { ok: true, token, dominio: d, txt: { nombre: nombreTxt(d), tipo: "TXT", valor: valorTxt(token) } };
}

// Consulta el TXT de UN pedido y aplica la decisión. `resolver(fila)` devuelve la consulta DNS.
// Devuelve { estado: 'presente'|'ausente'|'error', verificado, cambio: 'verificado'|'despublicado'|null }.
export async function comprobar(db, token, resolver, ahora = new Date().toISOString()) {
  if (!/^[0-9a-f]{64}$/.test(String(token || ""))) return { ok: false, http: 400, error: "token" };
  const fila = await db.prepare("SELECT * FROM qready_dominios WHERE token = ?1").bind(token).first();
  if (!fila) return { ok: false, http: 404, error: "pedido" };
  const consulta = await resolver(fila);
  const estado = decidirTxt(consulta, token);
  let cambio = null, verificado = fila.verificado_en != null;
  if (estado === "presente" && !verificado) {
    // El TXT nuevo prueba el control de hoy: otro pedido verificado del mismo dominio deja de estarlo.
    const [, r] = await db.batch([
      db.prepare("UPDATE qready_dominios SET verificado_en = NULL, despublicado_utc = ?3 WHERE dominio = ?1 AND entorno = ?2 AND token <> ?4 AND verificado_en IS NOT NULL")
        .bind(fila.dominio, fila.entorno, ahora, token),
      db.prepare("UPDATE qready_dominios SET verificado_en = ?2, despublicado_utc = NULL, ultimo_chequeo_utc = ?2, ultimo_chequeo_estado = 'presente', ultimo_chequeo_detalle = ?3 WHERE token = ?1 RETURNING verificado_en")
        .bind(token, ahora, consulta.detalle),
    ]);
    const ok = r && r.results && r.results[0] && r.results[0].verificado_en === ahora;
    if (!ok) return { ok: false, http: 500, error: "la base no confirmó la verificación" };
    verificado = true; cambio = "verificado";
  } else if (estado === "ausente" && verificado) {
    const r = await db.prepare("UPDATE qready_dominios SET verificado_en = NULL, despublicado_utc = ?2, ultimo_chequeo_utc = ?2, ultimo_chequeo_estado = 'ausente', ultimo_chequeo_detalle = ?3 WHERE token = ?1 RETURNING token")
      .bind(token, ahora, consulta.detalle).first();
    if (!r || r.token !== token) return { ok: false, http: 500, error: "la base no confirmó el cambio" };
    verificado = false; cambio = "despublicado";
  } else {
    // 'error' (y los casos sin cambio) sólo anotan: nunca tocan verificado_en.
    await db.prepare("UPDATE qready_dominios SET ultimo_chequeo_utc = ?2, ultimo_chequeo_estado = ?3, ultimo_chequeo_detalle = ?4 WHERE token = ?1")
      .bind(token, ahora, estado, consulta.detalle).run();
  }
  return { ok: true, estado, verificado, cambio, dominio: fila.dominio, publico: fila.publico === 1, detalle: consulta.detalle };
}

export const resolverPara = (prueba, f = fetch) => (prueba ? consultarTxtPrueba : (fila) => consultarTxtDoh(nombreTxt(fila.dominio), f));

// ---------------------------------------------------------------- medir y guardar (alta y cron)
// `tomarFoto` es lib/medicion-agentes.mjs → tomarFoto: el mismo camino que la medición para agentes.
export async function medirYGuardar(env, fila, { tomarFoto, entorno = "produccion", extras = null } = {}) {
  const r = await tomarFoto(env, { dominio: fila.dominio, vertical: fila.sector, ip: `cron:${fila.dominio}`, origen: ORIGEN_SERVIDOR });
  if (r.error) return { ok: false, dominio: fila.dominio, error: r.error.cuerpo && r.error.cuerpo.error || `respondió ${r.error.http}` };
  if (!r.foto) return { ok: false, dominio: fila.dominio, error: "sin foto" };
  const sellada = await N.sellarFoto(r.foto);
  const ex = extras || { inventario_verificado: fila.inventario_verificado_en != null, well_known_valido: false };
  const g = await guardarMedicion(env.DB, { foto: sellada, origen: "servidor", entorno, extras: ex });
  return { ...g, dominio: fila.dominio, sha256: sellada.sha256 };
}

// El cron diario. Por cada pedido verificado: (1) el TXT; (2) si sigue verificado, medir y guardar.
// Un dominio que falla no detiene a los demás. Devuelve el resumen (va a la consola del Worker).
export async function cronVerificados(env, { tomarFoto, resolver, entorno = "produccion", ahora = new Date().toISOString(), extrasDe = null } = {}) {
  const { results = [] } = await env.DB.prepare(
    "SELECT * FROM qready_dominios WHERE entorno = ?1 AND verificado_en IS NOT NULL ORDER BY dominio").bind(entorno).all();
  const resumen = [];
  for (const fila of results) {
    const linea = { dominio: fila.dominio };
    try {
      const c = await comprobar(env.DB, fila.token, resolver, ahora);
      linea.txt = c.estado; linea.cambio = c.cambio;
      if (c.ok && c.verificado) {
        const extras = extrasDe ? await extrasDe(fila, env) : null;
        const m = await medirYGuardar(env, fila, { tomarFoto, entorno, extras });
        linea.medicion = m.ok ? { nota: m.nota, sha256: m.sha256, ya_estaba: m.ya_estaba } : { error: m.error };
      }
    } catch (e) { linea.error = String(e && e.message || e); }
    resumen.push(linea);
  }
  return resumen;
}

// ---------------------------------------------------------------- el sello SVG
// TODO lo que viene de datos se escapa: el dominio, la letra, la fecha. Un dominio llega normalizado
// ([a-z0-9.-]), pero el sello no confía en eso: escapa igual.
export const escXml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
// 300 x 64 (13-nov-2026): con 220 la firma «Q-Ready Verified · Rosetta Quantum» se salía del recuadro
// (defecto visto en el sello de rosettaquantum.com). anchoTexto() estima el ancho con la métrica de
// las fuentes (Plex Mono = 0,6 em; Plex Sans <= 0,62 em por carácter) y check-sello-cabe.mjs exige que
// cada línea quepa. Un dominio largo se comprime con textLength en vez de salirse.
export const SELLO = { ancho: 300, alto: 64, x: 70, margen: 10 };
export const anchoTexto = (texto, px, em, espaciado = 0) => String(texto).length * (px * em + espaciado);
const DISPONIBLE = SELLO.ancho - SELLO.x - SELLO.margen;
const ajustar = (texto, px, em, esp = 0) => (anchoTexto(texto, px, em, esp) > DISPONIBLE ? ` textLength="${DISPONIBLE}" lengthAdjust="spacingAndGlyphs"` : "");
const fechaCortaUtc = (iso) => (iso ? String(iso).slice(0, 10) : "");

export function selloSvg({ dominio, nota, fecha, tokens, lang = "es" }) {
  const T = textos(lang), k = tokens;
  const color = !nota ? k["ink-60"] : nota === "F" ? k.alert || k.ink : (nota === "C" || nota === "D") ? k.pending : k.verdict;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SELLO.ancho}" height="${SELLO.alto}" viewBox="0 0 ${SELLO.ancho} ${SELLO.alto}" role="img" aria-label="${escXml(T.sello_alt(dominio, nota || "—"))}">`
    + `<title>${escXml(T.sello_alt(dominio, nota || "—"))}</title>`
    + `<rect x="0.5" y="0.5" width="${SELLO.ancho - 1}" height="${SELLO.alto - 1}" rx="3" fill="${k.paper}" stroke="${k.line}"/>`
    + `<rect x="0.5" y="0.5" width="58" height="${SELLO.alto - 1}" rx="3" fill="${k.panel}" stroke="${k.line}"/>`
    + `<text x="29.5" y="42" text-anchor="middle" font-family="Newsreader,Georgia,serif" font-size="32" fill="${color}">${escXml(nota || "—")}</text>`
    + `<text x="${SELLO.x}" y="22" font-family="IBM Plex Mono,monospace" font-size="10" letter-spacing="0.3"${ajustar(FIRMA, 10, 0.6, 0.3)} fill="${k.ink}">${escXml(FIRMA)}</text>`
    + `<text x="${SELLO.x}" y="38" font-family="IBM Plex Sans,system-ui,sans-serif" font-size="12"${ajustar(dominio, 12, 0.62)} fill="${k.ink}">${escXml(dominio)}</text>`
    + `<text x="${SELLO.x}" y="53" font-family="IBM Plex Mono,monospace" font-size="10" fill="${k["ink-60"]}">${escXml(fechaCortaUtc(fecha))}</text>`
    + `</svg>`;
}

export function selloNeutro({ dominio, tokens, lang = "es" }) {
  const T = textos(lang), k = tokens;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SELLO.ancho}" height="${SELLO.alto}" viewBox="0 0 ${SELLO.ancho} ${SELLO.alto}" role="img" aria-label="${escXml(T.sello_alt_neutro(dominio))}">`
    + `<title>${escXml(T.sello_alt_neutro(dominio))}</title>`
    + `<rect x="0.5" y="0.5" width="${SELLO.ancho - 1}" height="${SELLO.alto - 1}" rx="3" fill="${k.paper}" stroke="${k.line}"/>`
    + `<text x="12" y="27" font-family="IBM Plex Mono,monospace" font-size="10" letter-spacing="0.6" fill="${k["ink-60"]}">Q-Ready · Rosetta Quantum</text>`
    + `<text x="12" y="46" font-family="IBM Plex Sans,system-ui,sans-serif" font-size="13" fill="${k["ink-60"]}">${escXml(T.sello_no_verificado)}</text>`
    + `</svg>`;
}

// ---------------------------------------------------------------- la página /verificado/<dominio>
const escHtml = escXml;
export function cuerpoVerificado({ lang, dominio, fila, mediciones }) {
  const T = textos(lang);
  const ult = mediciones[0] || null;
  let lectura = "";
  if (ult) {
    let x = null;
    try { x = N.explicarNota(JSON.parse(ult.foto_json), { inventario_verificado: fila.inventario_verificado_en != null }); } catch { x = null; }
    if (x) lectura = `<p class="qv-lee">${escHtml(x.nota ? T.nota_lectura[x.nota] : (T.nota_sin_motivo[x.motivo] || T.nota_sin))}</p>`
      + (x.falta_para_A.length ? `<p class="qv-falta-t">${escHtml(T.falta_titulo)}</p><ul class="qv-falta">${x.falta_para_A.map((f) => `<li>${escHtml(T.falta[f.codigo] ? T.falta[f.codigo](f) : f.codigo)}</li>`).join("")}</ul>` : "");
  }
  const filas = mediciones.map((m, i) =>
    `<tr><td>${escHtml(String(m.fecha).replace("T", " ").slice(0, 16))}</td><td class="qv-n">${escHtml(m.nota || "—")}</td><td class="qv-n">${escHtml(m.qex ?? "—")}</td>`
    + `<td class="qv-h"><code>${escHtml(m.sha256)}</code></td><td><button type="button" class="qv-ver" data-i="${i}">${escHtml(T.pag_verificar)}</button><span class="qv-res" data-r="${i}" role="status"></span></td></tr>`).join("");
  // Las fotos viajan en un JSON inerte (type="application/json"): el navegador recalcula la huella.
  // Se escapa «<» para que ninguna cadena de la foto cierre el <script>.
  const fotos = JSON.stringify(mediciones.map((m) => m.foto_json)).replace(/</g, "\\u003c");
  const spec = lang === "en" ? "/q-ready/spec" : "/es/q-ready/spec";
  return `<section class="qv"><div class="qv-wrap">`
    + `<p class="qv-eyebrow">${escHtml(T.pag_eyebrow)}</p>`
    + `<h1 class="qv-dom">${escHtml(dominio)}</h1>`
    + `<p class="qv-lede">${escHtml(T.pag_lede)}</p>`
    + `<div class="qv-nota" data-nota="${escHtml(ult ? ult.nota || "" : "")}"><span class="qv-letra">${escHtml(ult ? ult.nota || "—" : "—")}</span>`
    + `<div><p class="qv-meta">${escHtml(T.pag_ultima)}: ${escHtml(ult ? String(ult.fecha).replace("T", " ").slice(0, 16) + " UTC" : "—")} · QEX ${escHtml(ult ? ult.qex ?? "—" : "—")}</p>`
    + `<p class="qv-meta">${escHtml(T.pag_verificado_desde)}: ${escHtml(String(fila.verificado_en).slice(0, 10))}</p></div></div>`
    + (ult ? lectura : `<p class="qv-lee">${escHtml(T.pag_sin_medicion)}</p>`)
    + `<h2 class="qv-h2">${escHtml(T.pag_hist)}</h2>`
    + `<div class="qv-tabla-caja"><table class="qv-tabla"><thead><tr><th>${escHtml(T.pag_col.fecha)}</th><th>${escHtml(T.pag_col.nota)}</th><th>${escHtml(T.pag_col.qex)}</th><th>${escHtml(T.pag_col.huella)}</th><th></th></tr></thead><tbody>${filas}</tbody></table></div>`
    + `<h2 class="qv-h2">${escHtml(T.pag_como)}</h2><p class="qv-lee">${escHtml(T.pag_como_txt)} <a href="${spec}">${escHtml(T.pag_metodo)}</a></p>`
    + `<script type="application/json" id="qv-fotos">${fotos}</script>`
    + `<script type="module" src="/js/qready-verificado.mjs"></script>`
    + `</div></section>`;
}

export function cuerpoNoActivado({ lang }) {
  const T = textos(lang);
  const alta = lang === "en" ? "/q-ready/verificar" : "/es/q-ready/verificar";
  return `<section class="qv"><div class="qv-wrap"><p class="qv-eyebrow">Q-Ready Verified</p>`
    + `<h1 class="qv-h1">${escHtml(T.no_activado)}</h1><p class="qv-lede">${escHtml(T.no_activado_extra)}</p>`
    + `<p><a class="qv-ir" href="${alta}">${escHtml(T.no_activado_ir)}</a></p></div></section>`;
}

// Rellena el cascarón (src/pages/q-ready/cascaron-verificado.astro y su par /es/): marcadores __QV_*__.
// El cascarón se compila en /q-ready/cascaron-verificado/, así que trae ESE canonical, og:url y
// hreflang horneados: se reemplazan por los de la URL real (mismo cuidado que renderPostHTML).
export function rellenarCascaron(shell, { titulo, descripcion, canonical, alt, cuerpo, noindex = false, lang = "es" }) {
  const altAbs = alt.startsWith("http") ? alt : SITE + alt;
  const en = lang === "en" ? canonical : altAbs;
  let h = shell.split("__QV_TITLE__").join(escHtml(titulo)).split("__QV_DESC__").join(escHtml(descripcion))
    .split("/__QV_ALT__").join(escHtml(alt)).split("__QV_ALT__").join(escHtml(alt)).replace("__QV_BODY__", () => cuerpo);
  h = h.replace(/<link rel="alternate" hreflang="[^"]*" href="[^"]*"\s*\/?>/g, "")
    .replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${escHtml(canonical)}">`
      + (noindex ? "" : `<link rel="alternate" hreflang="${lang}" href="${escHtml(canonical)}"><link rel="alternate" hreflang="${lang === "en" ? "es" : "en"}" href="${escHtml(altAbs)}"><link rel="alternate" hreflang="x-default" href="${escHtml(en)}">`))
    .replace(/<meta property="og:url" content="[^"]*"\s*\/?>/, `<meta property="og:url" content="${escHtml(canonical)}">`);
  if (!noindex) h = h.replace(/<meta name="robots"[^>]*>/, "");
  return h;
}

// ---------------------------------------------------------------- rutas
// deps = { tokens, tomarFoto, sectoresValidos, validarWellKnown? }. Devuelve Response o null.
const json = (o, s = 200, extra = {}) => new Response(JSON.stringify(o, null, 2), {
  status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra } });

async function cascaron(env, lang) {
  const r = await env.ASSETS.fetch(new Request(`${SITE}${lang === "en" ? "" : "/es"}/q-ready/cascaron-verificado/`));
  return r.status === 200 ? await r.text() : null;
}

export async function manejarVerificado(request, env, url, ctx, deps) {
  const p = url.pathname;
  const entorno = entornoDe(env, url);
  const prueba = modoPrueba(env, url);

  // /verificado/<dominio> y /es/verificado/<dominio>
  const mv = p.match(/^\/(es\/)?verificado\/([^/]+)\/?$/);
  if (mv && (request.method === "GET" || request.method === "HEAD")) {
    const lang = mv[1] ? "es" : "en";
    const T = textos(lang);
    const pedido = decodeURIComponent(mv[2]).toLowerCase();
    const fila = await dominioPublico(env.DB, pedido, entorno).catch((e) => { console.error("verificado:", e && e.message); return null; });
    const shell = await cascaron(env, lang);
    if (!fila) {
      const cuerpo = cuerpoNoActivado({ lang });
      const html = shell ? rellenarCascaron(shell, { titulo: T.no_activado_titulo, descripcion: T.no_activado, canonical: `${SITE}${lang === "en" ? "" : "/es"}/q-ready/verificar`, alt: lang === "en" ? "/es/q-ready/verificar" : "/q-ready/verificar", cuerpo, noindex: true, lang })
        : `<!doctype html><meta charset="utf-8"><title>${escHtml(T.no_activado_titulo)}</title>${cuerpo}`;
      return new Response(request.method === "HEAD" ? null : html, { status: 404, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } });
    }
    const mediciones = await medicionesDe(env.DB, fila.dominio, entorno);
    const cuerpo = cuerpoVerificado({ lang, dominio: fila.dominio, fila, mediciones });
    const otra = lang === "en" ? `/es/verificado/${fila.dominio}` : `/verificado/${fila.dominio}`;
    const html = shell ? rellenarCascaron(shell, { titulo: T.pag_titulo(fila.dominio), descripcion: T.pag_desc(fila.dominio), canonical: `${SITE}${lang === "en" ? "" : "/es"}/verificado/${fila.dominio}`, alt: otra, cuerpo, noindex: entorno !== "produccion", lang })
      : `<!doctype html><meta charset="utf-8"><title>${escHtml(T.pag_titulo(fila.dominio))}</title>${cuerpo}`;
    return new Response(request.method === "HEAD" ? null : html, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" } });
  }

  // /sello/<dominio>.svg — cache 1 h. No verificado o no público: el SVG neutro, sin letra.
  const ms = p.match(/^\/sello\/([^/]+)\.svg$/);
  if (ms && (request.method === "GET" || request.method === "HEAD")) {
    const lang = url.searchParams.get("lang") === "en" ? "en" : "es";
    const pedido = decodeURIComponent(ms[1]).toLowerCase();
    const d = normalizarHost(pedido) || "";
    let n = null;
    try { n = d ? await notaPublica(env.DB, d, entorno) : null; } catch (e) { console.error("sello:", e && e.message); n = null; }
    const svg = n ? selloSvg({ dominio: n.dominio, nota: n.nota, fecha: n.fecha, tokens: deps.tokens, lang })
      : selloNeutro({ dominio: d || "?", tokens: deps.tokens, lang });
    return new Response(request.method === "HEAD" ? null : svg, { status: 200, headers: {
      "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=3600",
      "x-qready-estado": n ? "verificado" : "no-verificado", "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'" } });
  }

  if (!p.startsWith("/api/qready/verificado/")) return null;
  if (request.method !== "POST") return json({ ok: false, error: "Usa POST." }, 405);
  const c = await request.json().catch(() => ({}));
  const ip = request.headers.get("cf-connecting-ip") || "local";

  // Alta: Turnstile (en modo de prueba del preview, si no hay token, se deja pasar: esas filas
  // nunca se leen en producción).
  if (p === "/api/qready/verificado/alta") {
    const ts = await verificarTurnstile(c.turnstile, env, ip);
    if (!ts.ok && !(prueba && !c.turnstile)) return json({ ok: false, error: "No pudimos verificar que es una persona. Recargue la página e intente de nuevo." }, 403);
    if (!(await permitido(ip, "__rl-qv-alta", 5))) return json({ ok: false, error: "Demasiados pedidos seguidos. Espere un minuto." }, 429);
    const r = await alta(env.DB, { dominio: c.dominio, sector: c.sector, contacto: c.contacto, publico: c.publico === true }, entorno, deps.sectoresValidos);
    if (!r.ok) return json({ ok: false, error: r.error }, r.http);
    return json({ ok: true, token: r.token, dominio: r.dominio, txt: r.txt, entorno, comprobar: `${url.origin}/api/qready/verificado/comprobar` });
  }

  // Comprobar: consulta el TXT. Si queda verificado por primera vez, mide en segundo plano.
  if (p === "/api/qready/verificado/comprobar") {
    if (!(await permitido(ip, "__rl-qv-comprobar", 10))) return json({ ok: false, error: "Demasiados pedidos seguidos. Espere un minuto." }, 429);
    const r = await comprobar(env.DB, c.token, resolverPara(prueba));
    if (!r.ok) return json({ ok: false, error: r.error }, r.http);
    if (r.cambio === "verificado" && deps.tomarFoto) {
      const fila = await env.DB.prepare("SELECT * FROM qready_dominios WHERE token = ?1").bind(c.token).first();
      const tarea = medirYGuardar(env, fila, { tomarFoto: deps.tomarFoto, entorno }).then((m) => console.log("qready alta medida:", JSON.stringify(m)))
        .catch((e) => console.error("qready alta: no se pudo medir:", e && e.message));
      if (ctx && ctx.waitUntil) ctx.waitUntil(tarea); else await tarea;
    }
    const lang = c.lang === "en" ? "en" : "es";
    return json({ ok: true, estado: r.estado, verificado: r.verificado, cambio: r.cambio, dominio: r.dominio, publico: r.publico,
      snippet: r.verificado && r.publico ? snippetSello(r.dominio, lang, entorno === "produccion" ? SITE : url.origin) : null });
  }

  // Sólo en el modo de prueba del preview: simular el TXT y correr el cron a mano.
  if (!prueba) return json({ ok: false, error: "ruta" }, 404);
  if (p === "/api/qready/verificado/prueba-txt") {
    if (!/^[0-9a-f]{64}$/.test(String(c.token || ""))) return json({ ok: false, error: "token" }, 400);
    const valor = c.txt === "error" ? "error" : c.txt === null ? null : String(c.txt || "").slice(0, 200);
    const r = await env.DB.prepare("UPDATE qready_dominios SET txt_prueba = ?2 WHERE token = ?1 AND entorno = 'preview-prueba' RETURNING token").bind(c.token, valor).first();
    return r ? json({ ok: true, token: c.token, txt_prueba: valor }) : json({ ok: false, error: "pedido de prueba no encontrado" }, 404);
  }
  if (p === "/api/qready/verificado/prueba-cron") {
    const resumen = await cronVerificados(env, { tomarFoto: deps.tomarFoto, resolver: consultarTxtPrueba, entorno: "preview-prueba", extrasDe: deps.extrasDe || null });
    return json({ ok: true, entorno: "preview-prueba", resumen });
  }
  return json({ ok: false, error: "ruta" }, 404);
}

// ---------------------------------------------------------------- la nota por API y MCP
// get_qready_grade y GET /v1/qready/grade. Un dominio no verificado o no público devuelve NADA de él:
// sólo que no está publicado. Pasa por dominioPublico(), la misma compuerta que la página y el sello.
export async function notaParaApi(env, dominioCrudo, url) {
  const dominio = N.dominioDeEntrada(dominioCrudo);
  const T = textos("es");
  if (!dominio) return { http: 400, cuerpo: { ok: false, error: "Escriba un dominio público, por ejemplo ejemplo.cl." } };
  const entorno = entornoDe(env, url);
  let n = null;
  try { n = await notaPublica(env.DB, dominio, entorno); } catch (e) { console.error("notaParaApi:", e && e.message); n = null; }
  if (!n) return { http: 200, cuerpo: { ok: true, dominio, publicado: false, nota: null, mensaje: T.no_activado } };
  const base = entorno === "produccion" ? SITE : url.origin;
  return { http: 200, cuerpo: { ok: true, dominio: n.dominio, publicado: true, nota: n.nota, qex: n.qex, medido_utc: n.fecha, sha256: n.sha256,
    verificado_en: n.verificado_en, version: N.VERSION_NOTA, lectura: n.nota ? T.nota_lectura[n.nota] : T.nota_sin,
    pagina: `${base}/verificado/${n.dominio}`, sello: `${base}/sello/${n.dominio}.svg`, especificacion: `${base}/q-ready/spec` } };
}
