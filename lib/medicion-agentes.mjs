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
//   1. registro público de certificados (manejarCT: copia del borde → copia D1 → crt.sh → Cert Spotter);
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
// La MISMA referencia que pide la página (fetch("/data/qex-referencia-2026-08.json")). El guardia
// exige que los dos nombres coincidan: una edición nueva se cambia en los dos lados o en ninguno.
import REFERENCIA from "../public/data/qex-referencia-2026-08.json" with { type: "json" };

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
export function qexParaAgente(detalle, referencia, clave) {
  const { q, tipos, ref } = detalle;
  const dimensiones = {};
  for (const k of Object.keys(N.PESOS))
    dimensiones[k] = { nombre: N.ETIQUETA_DIM[k], valor: q.dimensiones[k], peso: N.PESOS[k], aporte: q.aportes[k], tipo: tipos[k],
      mediana_pais: referencia.mediana_pais_dimension?.[k] ?? null };
  return {
    qex: { valor: q.score, version: q.version, suma: q.suma, peso_usado: q.peso_usado, tope: q.tope, dimensiones,
      nota: "El índice se renormaliza si falta una dimensión; tope 84 porque lo interno no se ve desde afuera." },
    sector: { clave, nombre: ref.nombre, organizaciones: ref.n, mediana: ref.mediana, p25: ref.p25, p75: ref.p75,
      diferencia_con_mediana: q.score == null ? null : q.score - ref.mediana,
      mediana_pais: referencia.mediana_pais, organizaciones_pais: referencia.n, edicion: referencia.edicion,
      nota: "La referencia publica mediana y cuartiles por sector, no promedio." },
  };
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

  const fila = { id: crypto.randomUUID(), medido_utc: new Date().toISOString(), dominio, sector: sec.clave,
    canal: quien.canal === "mcp" ? "mcp" : "api", agente: texto(quien.user_agent, 300), agente_declarado: texto(entrada.agente, 200),
    ip_hash: await hashIp(quien.ip, env.MEDICION_SAL_IP), qex: null, ok: false, error: null };
  const r = await medir(env, dominio, www(dominio), sec.clave, ip, ctx, m, referencia, fila.medido_utc);
  if (r.http === 429) return r;                       // no se registra: ver cabecera
  fila.ok = r.http === 200 && r.cuerpo.ok === true;
  fila.qex = r.cuerpo.qex?.valor ?? null;
  fila.error = fila.ok ? null : texto(r.cuerpo.error, 300) || `respondió ${r.http}`;
  await registrar(env.DB, fila);
  return r;
}

const www = (dominio) => "www." + dominio;

async function medir(env, dominio, sitio, vertical, ip, ctx, m, referencia, medido) {
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
  const s = await leer(await m.sondas(new Request(SITE + "/api/sondas",
    { method: "POST", headers: cab, body: JSON.stringify({ dominio, www: sitio, sensibles: pedidos }) }), env));
  if (s.status !== 200 || !s.cuerpo.ok) return { http: s.status === 200 ? 502 : s.status, cuerpo: { ok: false, error: s.cuerpo.error || "no se pudo medir" } };
  const d = s.cuerpo;
  const c = await leer(await m.correo(new Request(SITE + "/api/sondas/correo",
    { method: "POST", headers: cab, body: JSON.stringify({ dominio: d.dominio }) }), env, new URL(SITE + "/api/sondas/correo")));

  // 4 · el QEX: armarFoto, la función de la página y del PDF
  let indice = { qex: null, qex_falta: SIN_SECTOR, sectores_validos: sectoresValidos(referencia) };
  if (vertical) {
    const { detalle } = N.armarFoto({ dominio, www: sitio, vertical, medido, ct, sondas: d, referencia, origen: ORIGEN });
    indice = qexParaAgente(detalle, referencia, vertical);
  }

  const v = d.borde?.veredicto || {};
  const cuentas = mapa ? N.conteos([...mapa.keys()]) : null;
  return { http: 200, cuerpo: {
    ok: true,
    instrumento: d.instrumento,
    dominio: d.dominio,
    medido_utc: d.medido_utc,
    ...indice,
    registro_ct: ct
      ? { fuente: ct.fuente, consultado_utc: ct.consultado_utc || medido, certificados: ct.filas.length, sha256_crudo: ct.sha256,
          nombres: cuentas.hostnames, sensibles: sensibles.length, sondeados: pedidos.length, sensibles_sin_sondear: todos.length - pedidos.length,
          fuentes_que_fallaron: ct.fallidos }
      : { fuente: null, estado: "no_disponible", causa: ctFalla?.causa ?? null, fuentes_que_fallaron: ctFalla?.intentos ?? [],
          nota: "Sin registro, la higiene se calcula sólo con TLS, igual que en la página." },
    sitio_web: { host: d.www, soporta_hibrido_pq: v.soporta ?? null, elige_hibrido_pq: v.elige ?? null,
      cdn: d.borde?.dns?.cdn ?? null, saludos: d.borde?.saludos ?? null },
    certificado: d.certificado,
    endpoints: d.endpoints,
    correo: { mx: d.correo?.mx ?? [], proveedor: d.correo?.proveedor ?? null,
      cifrado_pq: c.cuerpo.ok
        ? { estado: "pendiente", id: c.cuerpo.id, consultar: `${SITE}/api/sondas/correo/${c.cuerpo.id}`,
            nota: "Lo mide nuestro servidor de correo; consulte esa URL (o la herramienta ver_cifrado_correo) en 10 a 90 s." }
        : { estado: "no_medido", causa: c.cuerpo.error || `respondió ${c.status}` } },
    security_txt: d.security_txt,
    lectura: LECTURA,
    no_incluye: NO_INCLUYE,
    pagina: `${SITE}/es/q-ready/medicion/`,
    siguiente_paso: siguientePaso(d.dominio, vertical),
  } };
}

export async function correoParaAgente(env, id) {
  const r = await leer(await manejarCorreo(new Request(`${SITE}/api/sondas/correo/${id}`), env,
    new URL(`${SITE}/api/sondas/correo/${id}`)));
  return { http: r.status, cuerpo: r.cuerpo };
}
