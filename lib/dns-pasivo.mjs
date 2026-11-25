// Consultas DNS PASIVAS de la medición (25-nov-2026, decisión del dueño «(a) y (c)», antes de la demo del 26):
//  (a) SPF válido, DNSSEC (DS en la zona padre) y CAA;
//  (c) el CNAME de los nombres del registro CT, para ver un ambiente no productivo detrás de un nombre de
//      producción (abona.tenpo.cl → rechargetenpodev.azureedge.net).
// Todo son consultas DNS sobre HTTPS a un resolvedor público: no se toca ningún servidor del dominio.
// NO mueve el QEX ni la letra: la ficha lo muestra como alertas INFO (QREADY-NOTA-2.1 no las emite).
// El resolvedor es inyectable (`q(nombre, tipo)` → Answer[]) para que el guardia use respuestas grabadas.
// Guardia: scripts/check-dns-pasivo.mjs (tenpo.cl y un banco chileno grande, grabados y anonimizado el banco; gritos y silencios).

export const DOH = "https://cloudflare-dns.com/dns-query";
export const TIPO = { A: 1, CNAME: 5, TXT: 16, DS: 43, CAA: 257 };
export const resolvedorDoh = (f = fetch) => async (nombre, tipo) => {
  const r = await f(`${DOH}?name=${encodeURIComponent(nombre)}&type=${tipo}`, { headers: { accept: "application/dns-json" } });
  if (!r || !r.ok) throw new Error(`DoH ${r ? r.status : "sin respuesta"}`);
  const j = await r.json();
  if (typeof j.Status !== "number" || (j.Status !== 0 && j.Status !== 3)) throw new Error(`DNS RCODE ${j.Status}`);
  return j.Answer || [];
};
// Un TXT puede venir partido en varias cadenas entre comillas: se unen sin separador (RFC 7208 §3.3).
export const txtDe = (a) => { const s = String(a.data || ""); const p = s.match(/"((?:[^"\\]|\\.)*)"/g); return p ? p.map((x) => x.slice(1, -1)).join("") : s; };

// ---------------------------------------------------------------- (a) SPF (RFC 7208)
// permerror si: más de un registro v=spf1 (§4.5); más de 10 mecanismos que consultan DNS (§4.6.4: include,
// a, mx, ptr, exists, redirect); un include o redirect que vuelve a un dominio ya visitado (bucle, p.ej.
// include a sí mismo); un include a un dominio sin SPF (§5.2: permerror). Tope propio: 25 consultas TXT.
export const SPF_MAX_LOOKUPS = 10;
const CONSULTA = /^[+\-~?]?(include:|a\b|a:|a\/|mx\b|mx:|mx\/|ptr\b|ptr:|exists:)|^redirect=/i;
export async function spf(dominio, q) {
  const out = { registros: 0, valido: null, problema: null, consultas: 0, detalle: null };
  const visto = new Set(); let txts = 0;
  const registrosDe = async (d) => { txts++; return (await q(d, "TXT")).filter((a) => a.type === TIPO.TXT).map(txtDe).filter((t) => /^v=spf1(\s|$)/i.test(t)); };
  const raiz = await registrosDe(dominio);
  out.registros = raiz.length;
  if (!raiz.length) { out.valido = null; out.problema = "sin_spf"; return out; }
  if (raiz.length > 1) { out.valido = false; out.problema = "varios_registros"; out.detalle = `${raiz.length} registros v=spf1`; return out; }
  const recorrer = async (d, reg) => {
    visto.add(d);
    for (const t of reg.split(/\s+/).slice(1)) {
      if (!CONSULTA.test(t)) continue;
      out.consultas++;
      const m = /^[+\-~?]?include:(.+)$/i.exec(t) || /^redirect=(.+)$/i.exec(t);
      if (!m) continue;
      const dest = m[1].toLowerCase().replace(/\.$/, "");
      if (visto.has(dest)) throw Object.assign(new Error(`${dest} vuelve a un dominio ya visitado`), { problema: dest === dominio ? "incluye_a_si_mismo" : "bucle" });
      if (txts >= 25) throw Object.assign(new Error("más de 25 consultas TXT"), { problema: "demasiadas_consultas" });
      const sub = await registrosDe(dest);
      if (sub.length !== 1) throw Object.assign(new Error(`${dest}: ${sub.length} registros SPF`), { problema: "include_sin_spf" });
      await recorrer(dest, sub[0]);
    }
  };
  try { await recorrer(dominio, raiz[0]); }
  catch (e) { if (!e.problema) throw e; out.valido = false; out.problema = e.problema; out.detalle = e.message; return out; }
  if (out.consultas > SPF_MAX_LOOKUPS) { out.valido = false; out.problema = "mas_de_10_consultas"; out.detalle = `${out.consultas} consultas`; return out; }
  out.valido = true;
  return out;
}

// ---------------------------------------------------------------- (a) DNSSEC y CAA
// DNSSEC: hay registro DS del dominio en la zona padre (el resolvedor lo trae de la padre). CAA: hay registro
// CAA en el dominio (RFC 8659; no se sube a la padre: el dominio registrable es el que se mide).
export async function dnssec(dominio, q) { return { ds: (await q(dominio, "DS")).some((a) => a.type === TIPO.DS) }; }
export async function caa(dominio, q) {
  const r = (await q(dominio, "CAA")).filter((a) => a.type === TIPO.CAA);
  return { publicado: r.length > 0, registros: r.length };
}

// ---------------------------------------------------------------- (c) CNAME de los nombres del registro
// Marcador de ambiente como TOKEN delimitado, nunca como substring: una etiqueta se parte por «.», «-», «_» y
// dígitos, y además por el nombre de la organización (la primera etiqueta del dominio: «tenpo»), porque los
// servicios en la nube pegan el nombre de la cuenta al del ambiente (rechargetenpodev → recharge·tenpo·dev).
// «developers», «devolucion», «devices», «testimonios», «contest» no son marcadores: no son el token.
export const MARCADORES = ["dev", "qa", "stg", "staging", "test", "uat"];
export function tokens(etiqueta, org) {
  let s = String(etiqueta || "").toLowerCase();
  if (org && org.length >= 3) s = s.split(org).join(".");
  return s.split(/[.\-_0-9]+/).filter(Boolean);
}
export function marcadorEn(cadena, org) {
  for (const nombre of cadena) {
    const labels = String(nombre).toLowerCase().replace(/\.$/, "").split(".");
    // las dos últimas etiquetas son el dominio del proveedor (azureedge.net): no se leen como ambiente
    for (const l of labels.slice(0, Math.max(0, labels.length - 2))) {
      const t = tokens(l, org).find((x) => MARCADORES.includes(x));
      if (t) return { marcador: t, en: nombre.replace(/\.$/, "") };
    }
  }
  return null;
}
// El nombre propio ya delata el ambiente (lo cuenta RQ.S.03.2 por su nombre): no se repite aquí.
export const nombreDelata = (host, org) => tokens(String(host).split(".")[0], org).some((x) => MARCADORES.includes(x));

// Tope: CNAME_MAX nombres y CNAME_MS de reloj, en tandas de CNAME_TANDA. Lo que no alcanzó se cuenta.
export const CNAME_MAX = 80, CNAME_MS = 2500, CNAME_TANDA = 16;
export async function cnameDeNombres(nombres, dominio, q, { max = CNAME_MAX, ms = CNAME_MS, tanda = CNAME_TANDA, ahora = () => Date.now() } = {}) {
  const org = String(dominio).split(".")[0];
  const lista = [...new Set(nombres.map((n) => String(n).toLowerCase()))].filter((n) => n !== dominio && n !== "www." + dominio && !nombreDelata(n, org));
  const t0 = ahora(), hallazgos = []; let leidos = 0;
  const pendientes = lista.slice(0, max);
  for (let i = 0; i < pendientes.length; i += tanda) {
    if (ahora() - t0 >= ms) break;
    const lote = pendientes.slice(i, i + tanda);
    const res = await Promise.all(lote.map(async (h) => {
      try { return { h, cadena: (await q(h, "CNAME")).filter((a) => a.type === TIPO.CNAME).map((a) => String(a.data).replace(/\.$/, "")) }; }
      catch { return { h, cadena: null }; }
    }));
    for (const { h, cadena } of res) {
      if (cadena == null) continue;
      leidos++;
      const m = marcadorEn(cadena, org);
      if (m) hallazgos.push({ host: h, cname: cadena[0], marcador: m.marcador });
    }
  }
  return { candidatos: lista.length, leidos, sin_leer: lista.length - leidos, ms: ahora() - t0, hallazgos };
}

// Todo junto, con su tiempo. Una falla de DNS deja null (no medido), nunca «no tiene».
export async function dnsPasivo(dominio, nombres, q = resolvedorDoh()) {
  const t0 = Date.now();
  const seguro = (p) => p.catch(() => null);
  const [s, d, c, n] = await Promise.all([seguro(spf(dominio, q)), seguro(dnssec(dominio, q)), seguro(caa(dominio, q)),
    seguro(cnameDeNombres(nombres || [], dominio, q))]);
  return { spf: s, dnssec: d, caa: c, cname_ct: n, ms: Date.now() - t0 };
}
