// La medición en vivo, para agentes (3-nov-2026): POST /v1/medicion y las herramientas MCP
// medir_exposicion_pqc / ver_medicion_correo.
//
// No es otro instrumento: llama a los MISMOS manejadores que usa /es/q-ready/medicion
// (manejarSondas y manejarCorreo), con el mismo límite por IP. Si la página y el agente
// midieran con código distinto, dirían cosas distintas con el mismo nombre.
//
// Lo que NO hace, declarado en cada respuesta: no consulta el registro público de certificados
// ni calcula el QEX (eso lo hace la página en el navegador del que mide), y el cifrado del correo
// llega aparte porque lo mide nuestro servidor de correo y tarda hasta 90 s.
import { manejarSondas } from "./informe-envivo.mjs";
import { manejarCorreo } from "./correo-envivo.mjs";

const SITE = "https://rosettaquantum.com";

const leer = async (r) => ({ status: r.status, cuerpo: await r.json().catch(() => ({})) });

export async function medirParaAgente(env, dominio, ip) {
  const cab = { "content-type": "application/json", "cf-connecting-ip": ip || "agente" };
  const s = await leer(await manejarSondas(new Request(SITE + "/api/sondas",
    { method: "POST", headers: cab, body: JSON.stringify({ dominio }) }), env));
  if (s.status !== 200 || !s.cuerpo.ok) return { http: s.status, cuerpo: { ok: false, error: s.cuerpo.error || "no se pudo medir" } };
  const d = s.cuerpo;
  const c = await leer(await manejarCorreo(new Request(SITE + "/api/sondas/correo",
    { method: "POST", headers: cab, body: JSON.stringify({ dominio: d.dominio }) }), env, new URL(SITE + "/api/sondas/correo")));
  const v = d.borde?.veredicto || {};
  return { http: 200, cuerpo: {
    ok: true,
    instrumento: d.instrumento,
    dominio: d.dominio,
    medido_utc: d.medido_utc,
    sitio_web: { host: d.www, soporta_hibrido_pq: v.soporta ?? null, elige_hibrido_pq: v.elige ?? null,
      cdn: d.borde?.dns?.cdn ?? null, saludos: d.borde?.saludos ?? null },
    certificado: d.certificado,
    correo: { mx: d.correo?.mx ?? [], proveedor: d.correo?.proveedor ?? null,
      cifrado_pq: c.cuerpo.ok
        ? { estado: "pendiente", id: c.cuerpo.id, consultar: `${SITE}/api/sondas/correo/${c.cuerpo.id}`,
            nota: "Lo mide nuestro servidor de correo; consulte esa URL (o la herramienta ver_medicion_correo) en 10 a 90 s." }
        : { estado: "no_medido", causa: c.cuerpo.error || `respondió ${c.status}` } },
    security_txt: d.security_txt,
    lectura: "null significa «no medido», nunca «no protegido». Se mide desde afuera: el tramo de su borde a su origen no es observable.",
    no_incluye: "La superficie del registro público de certificados y el índice QEX completo: los calcula la página.",
    pagina: `${SITE}/es/q-ready/medicion/`,
  } };
}

export async function correoParaAgente(env, id) {
  const r = await leer(await manejarCorreo(new Request(`${SITE}/api/sondas/correo/${id}`), env,
    new URL(`${SITE}/api/sondas/correo/${id}`)));
  return { http: r.status, cuerpo: r.cuerpo };
}
