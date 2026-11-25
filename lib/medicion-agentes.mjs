// La medición en vivo, para agentes (3-nov-2026): POST /v1/medicion y las herramientas MCP
// medir_exposicion_pqc / ver_cifrado_correo.
//
// No es otro instrumento: llama a los MISMOS manejadores que usa /es/q-ready/medicion
// (manejarCT, manejarSondas y manejarCorreo), con el mismo límite por IP. Si la página y el agente
// midieran con código distinto, dirían cosas distintas con el mismo nombre.
//
// EL QEX (12-nov-2026). Antes la respuesta decía «el índice QEX completo lo calcula la página»,
// porque el QEX se armaba sólo en el navegador. Ahora el servidor repite EXACTAMENTE el orden de
// public/js/medicion-envivo.mjs:
//   1. registro público de certificados (manejarCT: crt.sh y Cert Spotter unidos, cada uno con sus copias);
//   2. nombres sensibles → qué se sondea (N.nombresASondear, la misma función que usa la página);
//   3. sondas (manejarSondas);
//   4. N.armarFoto con la misma referencia por sector que carga la página.
// No hay fórmula propia aquí: si el QEX de la página y el de la API difieren, el defecto es de este
// archivo. scripts/check-medicion-agentes.mjs lo comprueba con insumos fijos.
//
// EL REGISTRO DE QUIÉN MIDE (tabla mediciones_agentes, db/medicion-agentes.schema.sql). Para
// aprender quién usa la herramienta. Nunca la IP cruda: sólo su SHA-256 con sal (secreto
// MEDICION_SAL_IP; sin él, ip_hash queda null). Si la escritura falla, la medición responde igual.
// Qué NO se registra: los pedidos con dominio o sector inválido y los rechazados por el límite por
// minuto (429). Ninguno de los dos pasó por el límite, y escribirlos dejaría a cualquiera llenar
// la tabla a voluntad.
//
// MCP Y clientInfo. El servidor MCP es sin estado: cada POST es independiente y el `initialize`
// (que trae clientInfo.name/version) llega en otra petición que no se guarda. En la herramienta
// sólo se ve el User-Agent, y eso es lo que se registra en `agente`. El agente puede presentarse
// con el argumento opcional `agente`, que va a `agente_declarado`.
import { manejarSondas } from "./informe-envivo.mjs";
import { manejarCorreo } from "./correo-envivo.mjs";
import { manejarCT } from "./ct-registro.mjs";
import * as N from "../public/js/qex-nucleo.mjs";
import { textos } from "../public/js/qready-textos.mjs";
// La ficha rosetta-ficha/1 y los tres ajustes del 13-nov (acciones/no medido, país, nombres enmascarados):
// una sola definición en public/js/ficha.mjs, la misma que usa get_qready_grade.
import * as Fi from "../public/js/ficha.mjs";
import { dominioVerificado } from "./qready-verificado.mjs";
import { extrasDeMedicion } from "./qready-wellknown.mjs";
// (18-nov-2026) el país: ficha maestra (org_ficha) → `pais` declarado → TLD. Ver lib/org-ficha.mjs.
import { fichaMaestra } from "./org-ficha.mjs";
// La MISMA referencia que pide la página (fetch("/data/qex-referencia-vigente.json")). El guardia
// exige que los dos nombres coincidan. Desde el 24-nov-2026 el archivo lo genera
// scripts/build-qex-referencia.mjs desde la ÚLTIMA edición publicada del informe: una edición nueva
// cambia los dos lados a la vez.
import REFERENCIA from "../public/data/qex-referencia-vigente.json" with { type: "json" };

const SITE = "https://rosettaquantum.com";

// ---------------------------------------------------------------- texto que lee una persona
// Texto aprobado por Nicholas el 12-nov-2026 (literal). `informe_dominio` abre la página de medición
// con el dominio y el sector: la página los prellena y mide sola, y ahí está el botón del informe.
export const SIGUIENTE_PASO_TEXTO = "Esta medición es la foto de hoy. Si a la persona a cargo le sirve, puede recibir cada mes el informe PQC de su sector, o pedir el informe completo de su dominio.";
export function siguientePaso(dominio, sector) {
  const q = new URLSearchParams({ dominio });
  if (sector) q.set("sector", sector);
  return { texto: SIGUIENTE_PASO_TEXTO, informe_mensual: `${SITE}/es/q-ready/#qr-informe-t`,
    informe_dominio: `${SITE}/es/q-ready/medicion/?${q}` };
}
export const LECTURA = "null significa «no medido», nunca «no protegido». Se mide desde afuera: el tramo de su borde a su origen no es observable.";
export const NO_INCLUYE = "El cifrado del correo llega aparte (consulte la URL de correo.cifrado_pq). La respuesta no trae la foto sellada completa ni la comparación con una medición anterior: eso lo hace la página.";
export const SIN_SECTOR = "Indique `sector` para calcular el QEX: la postura HNDL (25 % del índice) es un valor del sector, no una medición.";

const ORIGEN = "Medición para agentes desde rosettaquantum.com/v1/medicion.";

const leer = async (r) => ({ status: r.status, cuerpo: await r.json().catch(() => ({})) });
const texto = (x, max) => (typeof x === "string" && x.trim() ? x.trim().slice(0, max) : null);
const sinTildes = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// sector: la clave del selector de la página (banca, retail…) o su nombre, con o sin tildes.
export function sectorDeEntrada(crudo, referencia = REFERENCIA) {
  if (crudo == null || crudo === "") return { clave: null };
  const s = sinTildes(String(crudo));
  for (const [k, v] of Object.entries(referencia.verticales))
    if (s === k || s === sinTildes(v.nombre)) return { clave: k };
  return { invalido: true };
}
export const sectoresValidos = (referencia = REFERENCIA) => Object.keys(referencia.verticales);

export async function hashIp(ip, sal) {
  if (!ip || !sal) return null;
  return await N.sha256Hex(`${sal}|${ip}`);
}

// Una fila por medición. Devuelve true sólo si la base confirma la fila (RETURNING); cualquier otra
// cosa se dice en consola y NO se propaga: el registro nunca tumba la medición.
export async function registrar(db, fila) {
  if (!db) { console.error("mediciones_agentes: sin binding DB, no se registró"); return false; }
  try {
    const r = await db.prepare(
      "INSERT INTO mediciones_agentes (id, medido_utc, dominio, sector, canal, agente, agente_declarado, ip_hash, qex, ok, error) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id")
      .bind(fila.id, fila.medido_utc, fila.dominio, fila.sector, fila.canal, fila.agente, fila.agente_declarado,
        fila.ip_hash, fila.qex, fila.ok ? 1 : 0, fila.error).first();
    if (!r || r.id !== fila.id) { console.error(`mediciones_agentes: la base no confirmó la fila ${fila.id}`); return false; }
    return true;
  } catch (e) {
    console.error(`mediciones_agentes: no se pudo escribir (${e && e.message || e})`);
    return false;
  }
}

// La respuesta del QEX, a partir de lo que devuelve armarFoto. Nada se recalcula: se reordena.
// AJUSTE 2 (13-nov-2026): la diferencia con la mediana sólo se da si el dominio es del país de la
// referencia (hoy CL, deducido del TLD). A un .py se lo comparaba con la banca CHILENA sin decirlo.
// `pais`: el { codigo, fuente } de Fi.resolverPais (18-nov); sin él, el del TLD como antes.
export function qexParaAgente(detalle, referencia, clave, dominio, pais = null) {
  const { q, tipos, ref } = detalle;
  const dimensiones = {};
  for (const k of Object.keys(N.PESOS))
    // mediana_pais de una dimensión MODELO (HNDL, valor del sector) es null (25-nov-2026): la mediana nacional de un
    // valor que se asigna por sector no compara nada con el dominio (fintech decía 65 contra «país 12»).
    dimensiones[k] = { nombre: N.ETIQUETA_DIM[k], valor: q.dimensiones[k], peso: N.PESOS[k], aporte: q.aportes[k], tipo: tipos[k],
      mediana_pais: String(tipos[k]).startsWith("modelo") ? null : referencia.mediana_pais_dimension?.[k] ?? null };
  const cmp = Fi.comparacion(dominio, q.score, ref.mediana, pais);
  return {
    qex: { valor: q.score, version: q.version, suma: q.suma, peso_usado: q.peso_usado, tope: q.tope, dimensiones,
      nota: "El índice se renormaliza si falta una dimensión; tope 84 porque lo interno no se ve desde afuera." },
    sector: { clave, nombre: ref.nombre, organizaciones: ref.n, mediana: ref.mediana, p25: ref.p25, p75: ref.p75,
      diferencia_con_mediana: cmp.diferencia, pais_referencia: cmp.pais_referencia, pais_dominio: cmp.pais, pais_fuente: cmp.pais_fuente,
      mediana_pais: referencia.mediana_pais, organizaciones_pais: referencia.n, edicion: referencia.edicion,
      // APROBADO por Nicholas el 24-nov-2026 («Sí, apruebo y sube»): la edición vigente no publica cuartiles por sector, así
      // que el texto anterior («…publica mediana y cuartiles por sector, no promedio.») dejó de ser cierto.
      nota: Fi.notaSector(dominio, "es", pais) || "La referencia publica la mediana por sector, no el promedio." },
  };
}

// La higiene viva (16-nov-2026; hasta el 18-nov se llamaba QEX-1.1 y viajaba en `qex_1_1`), en un campo aparte y
// SIN publicar: la cifra vigente es `qex`. Sale de detalle.q11, que arma armarFoto (qex-nucleo.mjs): aquí
// tampoco se recalcula nada. El nombre de la versión viene del núcleo (VERSION_QEX_HV).
export const QEX_HV_NOTA = `Versión en evaluación, no publicada. La cifra vigente es \`qex\` (${N.VERSION_QEX}). En ${N.VERSION_QEX_HV} la higiene cuenta sólo los nombres del registro que existen y responden hoy (DNS vigente y respuesta en 443); los nombres sólo históricos se informan, no descuentan, y los que no se alcanzaron a sondear tampoco.`;
export function qexHigieneVivaParaAgente(detalle) {
  const q = detalle.q11;
  if (!q) return null;
  return { version: q.version, publicado: false, valor: q.score, suma: q.suma, peso_usado: q.peso_usado, tope: q.tope,
    dimensiones: q.dimensiones, diferencia_con_publicado: q.score == null || detalle.q.score == null ? null : q.score - detalle.q.score,
    higiene: { cuenta_hoy: q.superficie ? q.superficie.conteos : null, historico: q.historico,
      nombres_con_clase: q.superficie?.nombres ?? null, vivos: q.superficie?.vivo ?? null, no_vigentes: q.superficie?.no_vigente ?? null,
      sin_443: q.superficie?.sin_443 ?? null, sin_dato: q.superficie?.sin_dato ?? null,
      sin_sondear: q.superficie?.sin_sondear ?? null, sin_sondear_por_clase: q.superficie?.sin_sondear_por_clase ?? null },
    nota: QEX_HV_NOTA };
}

// Los manejadores de las rutas que usa la página. Se pueden sustituir sólo para el guardia
// (scripts/check-medicion-agentes.mjs), que los reemplaza por respuestas reales grabadas.
export const MANEJADORES = { ct: manejarCT, sondas: manejarSondas, correo: manejarCorreo };

// entrada: { dominio, sector, agente } tal como llegó; quien: { canal, ip, user_agent }.
export async function medirParaAgente(env, entrada = {}, quien = {}, ctx = null, m = MANEJADORES, referencia = REFERENCIA) {
  const ip = quien.ip || "agente";
  const dominio = N.dominioDeEntrada(entrada.dominio);
  if (!dominio) return { http: 400, cuerpo: { ok: false, error: "Escribe un dominio público, por ejemplo ejemplo.cl." } };
  const sec = sectorDeEntrada(entrada.sector, referencia);
  if (sec.invalido) return { http: 400, cuerpo: { ok: false, error: `Sector desconocido. Use uno de: ${sectoresValidos(referencia).join(", ")}.` } };
  // `pais` (18-nov): opcional; si viene, tiene que ser un código ISO 3166-1 de dos letras.
  const hayPais = entrada.pais != null && String(entrada.pais).trim() !== "";
  if (hayPais && !Fi.codigoPais(entrada.pais)) return { http: 400, cuerpo: { ok: false, error: "País inválido: use el código ISO de dos letras, por ejemplo CL." } };

  const fila = { id: crypto.randomUUID(), medido_utc: new Date().toISOString(), dominio, sector: sec.clave,
    canal: quien.canal === "mcp" ? "mcp" : "api", agente: texto(quien.user_agent, 300), agente_declarado: texto(entrada.agente, 200),
    ip_hash: await hashIp(quien.ip, env.MEDICION_SAL_IP), qex: null, ok: false, error: null };
  const r = await medir(env, dominio, www(dominio), sec.clave, ip, ctx, m, referencia, fila.medido_utc, entrada.idioma === "en" ? "en" : "es",
    hayPais ? Fi.codigoPais(entrada.pais) : null);
  if (r.http === 429) return r;                       // no se registra: ver cabecera
  fila.ok = r.http === 200 && r.cuerpo.ok === true;
  fila.qex = r.cuerpo.qex?.valor ?? null;
  fila.error = fila.ok ? null : texto(r.cuerpo.error, 300) || `respondió ${r.http}`;
  await registrar(env.DB, fila);
  return r;
}

const www = (dominio) => "www." + dominio;

// Los pasos 1 a 4 —registro, qué se sondea, sondas, armarFoto— en UNA función. La usan la medición
// para agentes (abajo) y el cron diario de los dominios Q-Ready Verified (lib/qready-verificado.mjs):
// el mismo camino, para que la letra del sello sea la que vería la página. Sin sector no hay foto
// (armarFoto la exige: la postura HNDL es del sector), y entonces `foto` vuelve null.
// Devuelve { error: {http, cuerpo} } si las sondas no respondieron; nunca lanza por eso.
export async function tomarFoto(env, { dominio, www: sitio = www(dominio), vertical = null, ip = "agente", ctx = null,
  m = MANEJADORES, referencia = REFERENCIA, medido = new Date().toISOString(), origen = ORIGEN } = {}) {
  const cab = { "content-type": "application/json", "cf-connecting-ip": ip };
  const sinCtx = { waitUntil: () => {} };

  // 1 · registro público de certificados: el mismo manejador que /api/ct
  const t = Date.now();
  let ct = null, ctFalla = null;
  try {
    const rc = await leer(await m.ct(new Request(`${SITE}/api/ct?d=${encodeURIComponent(dominio)}`, { headers: cab }), ctx || sinCtx, env));
    if (rc.status === 200 && rc.cuerpo.ok) ct = await N.ctDesdeServidor(rc.cuerpo, Date.now() - t);
    else ctFalla = { causa: rc.cuerpo.error || `respondió ${rc.status}`, intentos: rc.cuerpo.intentos || [] };
    if (ct) ct.fallidos = rc.cuerpo.intentos || [];
  } catch (e) { ctFalla = { causa: String(e && e.message || e), intentos: [] }; }

  // 2 · qué se sondea: la misma regla que la página
  const mapa = ct ? N.nombresCT(ct.filas, dominio) : null;
  const hosts = mapa ? N.hostsCT(mapa, dominio) : [];
  const { sensibles, todos, pedidos } = N.nombresASondear(hosts, null);

  // 3 · sondas
  // interno: el servidor necesita los nombres completos para su foto (la respuesta al agente se enmascara
  // después, en medir); la ruta pública /api/sondas los enmascara para quien no es dueño verificado.
  const s = await leer(await m.sondas(new Request(SITE + "/api/sondas",
    { method: "POST", headers: cab, body: JSON.stringify({ dominio, www: sitio, sensibles: pedidos }) }), env, { interno: true }));
  if (s.status !== 200 || !s.cuerpo.ok) return { error: { http: s.status === 200 ? 502 : s.status, cuerpo: { ok: false, error: s.cuerpo.error || "no se pudo medir" } } };
  const d = s.cuerpo;

  // 4 · la foto: armarFoto, la función de la página y del PDF
  const armada = vertical ? N.armarFoto({ dominio, www: sitio, vertical, medido, ct, sondas: d, referencia, origen }) : null;
  return { ct, ctFalla, mapa, sensibles, todos, pedidos, d, foto: armada ? armada.foto : null, detalle: armada ? armada.detalle : null };
}

// La nota Q-Ready para un agente: la letra de N.explicarNota (la misma de la página) y su lectura
// en palabras (public/js/qready-textos.mjs, provisorio).
// AJUSTE 1 (13-nov-2026): falta_para_A trae SÓLO acciones sobre hallazgos medidos, en orden y con la
// nota a la que sube cada una (Fi.analizar, la misma de la ficha); lo no medido va en no_medido.
// Antes traía 82 ítems y 77 eran «Medir X (quedó fuera del tope)»: no medir algo no es una falla.
// AJUSTE 3: los nombres van enmascarados si el dominio no está verificado por su dueño (ctx.verificado).
export function notaParaAgente(x, foto, ctx = {}, lang = "es") {
  const T = textos(lang);
  const nom = Fi.nombradorDeFoto(foto, !!ctx.verificado);
  const j = Fi.notaParaJson(x, Fi.analizar(foto, x, ctx.extras || {}), { ...ctx, dominio: foto.dominio, idioma: lang, nom });
  // la lectura dice la causa de la letra (16-nov): la misma frase que la ficha
  return { letra: x.nota, version: x.version, lectura: Fi.lecturaDe(x, foto, lang),
    alertas: j.alertas, falta_para_A: j.falta_para_A, no_medido: j.no_medido,
    no_evaluado: x.no_evaluado, escala: T.nota_escala };
}

// AJUSTE 3: los nombres de un dominio que su dueño no verificó salen enmascarados. Los conteos no
// cambian; cambia sólo cómo se escribe cada nombre (host y, si lo repite, el CNAME).
// `hosts`: todos los nombres que pueden aparecer juntos (registro + sondeados), para que dos nombres
// distintos que quedan iguales lleven su sufijo #xx, el mismo que en la ficha y en la página.
// 25-nov-2026 (Nicholas, «Dejar de enmascarar»): Fi.ENMASCARA es false y los nombres van completos siempre.
export function endpointsParaAgente(endpoints, dominio, verificado, hosts = []) {
  if (verificado || !Fi.ENMASCARA || !Array.isArray(endpoints)) return endpoints;
  return Fi.enmascararEndpoints(endpoints, Fi.nombrador(dominio, false, [...hosts, ...endpoints.map((e) => e.host)]));
}

async function medir(env, dominio, sitio, vertical, ip, ctx, m, referencia, medido, idioma = "es", paisDeclarado = null) {
  const cab = { "content-type": "application/json", "cf-connecting-ip": ip };
  const r = await tomarFoto(env, { dominio, www: sitio, vertical, ip, ctx, m, referencia, medido });
  if (r.error) return r.error;
  const { ct, ctFalla, mapa, sensibles, todos, pedidos, d } = r;
  const c = await leer(await m.correo(new Request(SITE + "/api/sondas/correo",
    { method: "POST", headers: cab, body: JSON.stringify({ dominio: d.dominio }) }), env, new URL(SITE + "/api/sondas/correo")));

  // El correo se reusa si ya se midió hace poco (lib/correo-envivo.mjs): entonces el resultado ya está.
  let correoHecho = null;
  if (c.cuerpo.ok && c.cuerpo.reusada) {
    const u = new URL(`${SITE}/api/sondas/correo/${c.cuerpo.id}`);
    const rc = await leer(await m.correo(new Request(u), env, u)).catch(() => null);
    if (rc && rc.status === 200 && rc.cuerpo.estado === "hecho") correoHecho = rc.cuerpo;
  }

  // ¿El dueño verificó el dominio? Sólo entonces los nombres salen completos (falla cerrado: enmascara).
  const verif = await dominioVerificado(env.DB, d.dominio);
  // Las extras de la nota (24-nov): las mismas del sello si el dueño verificó el dominio; si no, {}.
  const extras = await extrasDeMedicion(env, d.dominio, verif);
  const nombres = { verificado: verif.verificado, fuentes_que_fallaron: ct ? ct.fallidos : (ctFalla?.intentos ?? []), extras };
  // El país (18-nov): la ficha maestra manda; si no está (o la tabla falla), el declarado; si no, el TLD.
  const maestra = await fichaMaestra(env.DB, d.dominio);
  const pais = Fi.resolverPais(d.dominio, { maestra: maestra?.pais ?? null, declarado: paisDeclarado });

  // el QEX y la nota salen de la foto que armó tomarFoto: nada se recalcula aquí
  let indice = { qex: null, qex_falta: SIN_SECTOR, sectores_validos: sectoresValidos(referencia), nota: null, presentacion: null };
  if (r.foto) {
    const x = N.explicarNota(r.foto, extras);
    indice = { ...qexParaAgente(r.detalle, referencia, vertical, d.dominio, pais), nota: notaParaAgente(x, r.foto, nombres),
      // La higiene viva aparte y SIN publicar (publicado: false): no entra a la ficha ni a su markdown.
      qex_higiene_viva: qexHigieneVivaParaAgente(r.detalle),
      // La ficha rosetta-ficha/1: la MISMA foto y la MISMA letra (x) que el bloque nota.
      presentacion: Fi.presentacion(r.foto, { x, extras, idioma, verificado: verif.verificado, publico: verif.publico, pais,
        fuentes_que_fallaron: nombres.fuentes_que_fallaron,
        correo: correoHecho || (c.cuerpo.ok ? { estado: "pendiente" } : null) }) };
  }

  const v = d.borde?.veredicto || {};
  const cuentas = mapa ? N.conteos([...mapa.keys()]) : null;
  return { http: 200, cuerpo: {
    ok: true,
    instrumento: d.instrumento,
    dominio: d.dominio,
    medido_utc: d.medido_utc,
    // de dónde salió el país: "ficha" (registro de Rosetta), "declarado" (parámetro pais), "tld" o null
    pais: { codigo: pais.codigo, fuente: pais.fuente },
    ...indice,
    registro_ct: ct
      ? { fuente: ct.fuente, consultado_utc: ct.consultado_utc || medido, certificados: ct.filas.length, sha256_crudo: ct.sha256,
          nombres: cuentas.hostnames, sensibles: sensibles.length, sondeados: pedidos.length, sensibles_sin_sondear: todos.length - pedidos.length,
          fuentes: ct.fuentes, fuentes_que_fallaron: ct.fallidos }
      : { fuente: null, estado: "no_disponible", causa: ctFalla?.causa ?? null, fuentes_que_fallaron: ctFalla?.intentos ?? [],
          nota: "Sin registro, la higiene se calcula sólo con TLS, igual que en la página." },
    sitio_web: { host: d.www, soporta_hibrido_pq: v.soporta ?? null, elige_hibrido_pq: v.elige ?? null,
      cdn: d.borde?.dns?.cdn ?? null, cdn_asn: d.borde?.dns?.asn ?? null, saludos: d.borde?.saludos ?? null, que_es_cada_saludo: QUE_ES_CADA_SALUDO },
    certificado: d.certificado,
    endpoints: endpointsParaAgente(d.endpoints, d.dominio, verif.verificado, mapa ? [...mapa.keys()] : []),
    nombres_enmascarados: Fi.ENMASCARA && !verif.verificado,
    correo: { mx: d.correo?.mx ?? [], proveedor: d.correo?.proveedor ?? null,
      cifrado_pq: correoHecho
        ? { estado: "hecho", id: c.cuerpo.id, consultar: `${SITE}/api/sondas/correo/${c.cuerpo.id}`, resultado: correoHecho.resultado }
        : c.cuerpo.ok
        ? { estado: "pendiente", id: c.cuerpo.id, consultar: `${SITE}/api/sondas/correo/${c.cuerpo.id}`,
            nota: "Lo mide nuestro servidor de correo; consulte esa URL (o la herramienta ver_cifrado_correo) en 10 a 90 s." }
        : { estado: "no_medido", causa: c.cuerpo.error || `respondió ${c.status}` } },
    security_txt: d.security_txt,
    lectura: LECTURA,
    no_incluye: NO_INCLUYE,
    pagina: `${SITE}/es/q-ready/medicion/`,
    // Los enlaces de salida (24-nov-2026): la ficha del dominio en la web (la página /verificado si es pública;
    // si no, la medición con dominio y sector, que mide sola), el informe PQC mensual publicado (la última
    // edición vive en /informe-pqc/) y la rúbrica pública del QEX.
    ficha_url: indice.presentacion?.ficha?.url_dominio ?? siguientePaso(d.dominio, vertical).informe_dominio,
    informe_pqc: `${SITE}/informe-pqc/`,
    rubrica: `${SITE}/data/rubrica-qex.json`,
    siguiente_paso: siguientePaso(d.dominio, vertical),
  } };
}

export async function correoParaAgente(env, id) {
  const r = await leer(await manejarCorreo(new Request(`${SITE}/api/sondas/correo/${id}`), env,
    new URL(`${SITE}/api/sondas/correo/${id}`)));
  // 25-nov-2026: cuáles MX quedaron fuera y por qué (antes sólo mx_omitidos: 3). El tope es el de la sonda.
  const res = r.cuerpo && r.cuerpo.resultado;
  if (res && Array.isArray(res.mx_publicados)) {
    const fuera = Fi.mxOmitidos(res);
    res.mx_omitidos_lista = fuera;
    if (fuera.length) res.mx_omitidos_motivo = MX_OMITIDOS_MOTIVO;
  }
  return { http: r.status, cuerpo: r.cuerpo };
}
// APROBADO por Nicholas el 25-nov-2026 («Sí, apruebo y sube»).
export const MX_OMITIDOS_MOTIVO = `La sonda mide como máximo ${Fi.MAX_MX_CORREO} servidores de correo por dominio: los ${Fi.MAX_MX_CORREO} primeros de la lista publicada.`;
// APROBADO por Nicholas el 25-nov-2026 («Sí, apruebo y sube»): qué hace cada saludo. «A_como_navegador» NO imita a un
// navegador (un navegador manda key_share y no provoca HelloRetryRequest); la clave queda por compatibilidad.
export const QUE_ES_CADA_SALUDO = {
  A_como_navegador: "Ofrece todos los grupos, con key_share sólo para x25519 (clásico). Un servidor que prefiere el híbrido pide un viaje extra (HelloRetryRequest: hrr: true) para obtenerlo. Un navegador actual manda también el key_share híbrido y no provoca ese viaje: el nombre «como navegador» es histórico.",
  B_solo_hibrido: "Ofrece sólo X25519MLKEM768, con key_share vacío: si el servidor pide ese grupo (hrr: true), lo soporta.",
  C_eleccion_libre: "Ofrece el híbrido y x25519, con key_share vacío: el grupo que pide el servidor (hrr: true) es el que elige.",
};
