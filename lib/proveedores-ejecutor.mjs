// RQ.T · el ejecutor: hace las consultas y arma los `insumos` que lee lib/proveedores-descubrir.mjs.
//
// NIVEL 0 Y NADA MÁS. Sólo DNS sobre HTTPS a cloudflare-dns.com (el mismo resolvedor que ya usan
// lib/borde-envivo.mjs, lib/informe-envivo.mjs y lib/qready-verificado.mjs) y el registro público de
// certificados (crt.sh y Cert Spotter, las mismas dos fuentes de lib/ct-registro.mjs). Ningún GET, ningún
// saludo TLS, ningún socket al cliente ni a sus proveedores. El ASN se pregunta por DNS a Team Cymru.
//
// NO ESCRIBE NADA. A diferencia de manejarCT, no guarda copias en la caché ni en D1: el preview comparte la
// base de producción, y este módulo no debe tocarla. Recibe `fetch` inyectado: corre igual en Node
// (scripts/descubrir-proveedores.mjs) y en el Worker (herramienta MCP descubrir_proveedores).
//
// Cada respuesta queda en `insumos.dns["nombre|TIPO"]` tal como llegó (status + answer) o con su error:
// así una corrida se puede releer, re-clasificar con otro catálogo y comparar sin volver a consultar.
import { clave, nombresDeCt, esSpf, mecanismosSpf, textoTxt, MAX_NOMBRES_CT, MAX_SPF_CONSULTAS } from "./proveedores-descubrir.mjs";
import { DKIM_SELECTORES, esPropio } from "./proveedores-catalogo.mjs";

export const ESQUEMA_INSUMOS = "rosetta-rqt-insumos/0";
const DOH = "https://cloudflare-dns.com/dns-query";
const STATUS = { 0: "NOERROR", 2: "SERVFAIL", 3: "NXDOMAIN", 5: "REFUSED" };
const DNS_MS = 8000, CT_MS = 25000, CS_PAGINAS = 10, A_LA_VEZ = 8;
const UA = "RosettaQuantum-RQT/0 (+https://rosettaquantum.com/es/q-ready/medicion/)";

async function conTope(f, url, ms, init = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try { return await f(url, { ...init, signal: ctl.signal }); } finally { clearTimeout(t); }
}
const falla = (e) => (e && e.name === "AbortError" ? "no respondió a tiempo" : String((e && e.message) || e));

/** Una consulta DoH. Un SERVFAIL o un corte se reintenta UNA vez; el resultado final queda tal cual. */
export async function consultaDns(f, nombre, tipo) {
  let ultimo;
  for (let i = 0; i < 2; i++) {
    try {
      const r = await conTope(f, `${DOH}?name=${encodeURIComponent(nombre)}&type=${tipo}`, DNS_MS, { headers: { accept: "application/dns-json" } });
      if (!r.ok) { ultimo = { error: `DoH ${r.status}` }; continue; }
      const j = await r.json();
      const answer = (j.Answer || []).map((a) => ({ name: String(a.name).replace(/\.$/, "").toLowerCase(), type: a.type, data: String(a.data) }))
        .sort((a, b) => a.type - b.type || a.name.localeCompare(b.name) || a.data.localeCompare(b.data));
      ultimo = { status: STATUS[j.Status] || `RCODE ${j.Status}`, answer };
      if (ultimo.status !== "SERVFAIL") return ultimo;
    } catch (e) { ultimo = { error: falla(e) }; }
  }
  return ultimo;
}

async function crtsh(f, dominio) {
  const r = await conTope(f, `https://crt.sh/?q=%25.${encodeURIComponent(dominio)}&output=json`, CT_MS, { headers: { "user-agent": UA } });
  if (!r.ok) throw new Error(`crt.sh respondió ${r.status}`);
  const filas = await r.json();
  if (!Array.isArray(filas)) throw new Error("crt.sh no devolvió una lista");
  return filas.map((x) => ({ nombres: String(x.name_value || "").split("\n").map((s) => s.trim()).filter(Boolean),
    emisor_dn: x.issuer_name || null, not_after: x.not_after || null }));
}
async function certSpotter(f, dominio) {
  const todas = []; let despues = null, parcial = null;
  for (let i = 0; i < CS_PAGINAS; i++) {
    const u = `https://api.certspotter.com/v1/issuances?domain=${encodeURIComponent(dominio)}&include_subdomains=true&expand=dns_names&expand=issuer${despues ? `&after=${encodeURIComponent(despues)}` : ""}`;
    const r = await conTope(f, u, CT_MS);
    // Una página que falla después de otras buenas NO se calla: la fuente queda «parcial» con la razón
    // (medido el 24-nov: la página 2 dio 429 y sin esto la corrida decía 100 certificados como si fueran todos).
    if (!r.ok) { if (todas.length) { parcial = `página ${i + 1}: Cert Spotter respondió ${r.status}`; break; } throw new Error(`Cert Spotter respondió ${r.status}`); }
    const pag = await r.json();
    if (!Array.isArray(pag)) throw new Error("Cert Spotter no devolvió una lista");
    todas.push(...pag);
    if (pag.length < 100) break;
    despues = pag[pag.length - 1].id;
  }
  if (todas.length >= CS_PAGINAS * 100 && !parcial) parcial = `tope de ${CS_PAGINAS} páginas`;
  const certificados = todas.map((e) => ({ nombres: e.dns_names || [], emisor_dn: e.issuer?.name || null,
    emisor_operador: e.issuer?.friendly_name || null, not_after: e.not_after || null }));
  return parcial ? { certificados, parcial } : certificados;
}

async function enLotes(xs, n, fn) {
  const cola = [...xs];
  await Promise.all(Array.from({ length: n }, async () => { for (let x = cola.shift(); x !== undefined; x = cola.shift()) await fn(x); }));
}

/** Arma los insumos de un dominio. `f` = fetch. `consultas` cuenta cada pedido hecho (el denominador real). */
export async function recolectar(dominio, { f = fetch, conCt = true } = {}) {
  const ins = { esquema: ESQUEMA_INSUMOS, dominio, medido_utc: new Date().toISOString(), dns: {}, ct: { fuentes: [] }, consultas: { dns: 0, ct: 0 } };
  const q = async (nombre, tipo) => {
    const k = clave(nombre, tipo);
    if (!ins.dns[k]) { ins.consultas.dns++; ins.dns[k] = await consultaDns(f, nombre, tipo); }
    return ins.dns[k];
  };
  const www = `www.${dominio}`;

  // CT en paralelo con el DNS base (es lo más lento).
  const ct = conCt ? Promise.all([["crt.sh", crtsh], ["Cert Spotter", certSpotter]].map(async ([fuente, fn]) => {
    // crt.sh contesta 502 a ratos (medido el 24-nov: 502 y, 8 s después, 1.873 certificados). Un reintento,
    // a los 3 s; si vuelve a fallar, la fuente queda con su error y la fila lo declara.
    const t = Date.now(); const errores = [];
    for (let i = 0; i < 2; i++) {
      ins.consultas.ct++;
      try { const x = await fn(f, dominio); const certificados = Array.isArray(x) ? x : x.certificados;
        return { fuente, ok: true, ms: Date.now() - t, intentos: i + 1, ...(x.parcial ? { parcial: x.parcial } : {}), certificados }; }
      catch (e) { errores.push(falla(e)); if (i === 0) await new Promise((ok) => setTimeout(ok, 3000)); }
    }
    return { fuente, ok: false, ms: Date.now() - t, intentos: 2, error: errores.join("; luego ") };
  })) : Promise.resolve([]);

  await Promise.all([q(dominio, "NS"), q(dominio, "MX"), q(dominio, "TXT"), q(dominio, "CAA"), q(dominio, "A"), q(www, "A"),
    ...DKIM_SELECTORES.map((s) => q(`${s}._domainkey.${dominio}`, "TXT"))]);

  // SPF: se siguen los include/redirect hasta el límite del propio SPF.
  const txt = ins.dns[clave(dominio, "TXT")];
  const raiz = (txt?.answer || []).filter((a) => a.type === 16).map((a) => textoTxt(a.data)).find(esSpf);
  if (raiz) {
    const vistos = new Set(); let cola = [raiz], n = 0;
    while (cola.length && n < MAX_SPF_CONSULTAS) {
      const sig = [];
      for (const t of cola) { const m = mecanismosSpf(t);
        for (const d of [...m.include, ...(m.redirect ? [m.redirect] : [])]) if (!vistos.has(d) && n < MAX_SPF_CONSULTAS) { vistos.add(d); n++; sig.push(d); } }
      const res = await Promise.all(sig.map((d) => q(d, "TXT")));
      cola = res.flatMap((r) => (r?.answer || []).filter((a) => a.type === 16).map((a) => textoTxt(a.data)).filter(esSpf));
    }
  }

  // ASN de las IPv4 del apex y de www (Team Cymru por DNS).
  const ips = new Set();
  for (const h of [dominio, www]) for (const a of ins.dns[clave(h, "A")]?.answer || []) if (a.type === 1) ips.add(a.data);
  const asns = new Set();
  await Promise.all([...ips].sort().map(async (ip) => {
    const r = await q(ip.split(".").reverse().join(".") + ".origin.asn.cymru.com", "TXT");
    const t = (r?.answer || []).find((a) => a.type === 16);
    if (t) asns.add(textoTxt(t.data).split("|")[0].trim().split(" ")[0]);
  }));
  await Promise.all([...asns].filter((x) => /^\d+$/.test(x)).map((n) => q(`AS${n}.asn.cymru.com`, "TXT")));

  // Nombres de CT → una consulta A por nombre (la respuesta trae la cadena CNAME completa).
  ins.ct.fuentes = await ct;
  const nombres = nombresDeCt(ins, dominio).filter((n) => esPropio(n, dominio)).slice(0, MAX_NOMBRES_CT);
  await enLotes(nombres, A_LA_VEZ, (n) => q(n, "A"));
  return ins;
}
