// RQ.T · descubrimiento de proveedores desde la superficie PÚBLICA del cliente (T.01–T.07), v0.
// Diseño: entregables/ficha-rosetta-2026-11/RQ.T-vista-de-proveedores-v0.md (Projects/Rosetta Quantum).
//
// MÓDULO PURO. Entra un objeto `insumos` (las respuestas DNS y CT ya obtenidas, ver
// lib/proveedores-ejecutor.mjs) y sale una lista de filas: señal · proveedor · evidencia. Aquí no se
// consulta nada; por eso se prueba con fijas (test/proveedores.test.mjs) y dos corridas sobre los mismos
// insumos dan, por construcción, la misma salida.
//
// LO QUE ESTO NO HACE, y está fuera a propósito:
//  - T.08 (GET a la portada): requiere aprobación de Nicholas. Tampoco se leen encabezados HTTP en T.01:
//    hoy la medición pública no los obtiene, y obtenerlos exige un GET.
//  - T.09 (lista declarada): la entrega el cliente. Si no viene, `no_declarados` es null, nunca 0.
//  - T.10–T.15 (medir a cada proveedor): este módulo sólo DESCUBRE.
//  - No crea índice, no toca el QEX ni la nota. Alimenta RQ.S.11 (reservado).
//
// REGLAS DE LECTURA (las mismas de la rúbrica):
//  - Una señal que no devuelve nada dice «sin dato» y su conteo es null. Nunca 0.
//  - Un TXT, un CNAME o un include que no calza con el catálogo NO inventa proveedor: entra al
//    denominador, y si apunta fuera del dominio queda como «externo sin clasificar», fuera del conteo.
//  - Ningún proveedor descubierto se nombra en una superficie pública (regla 4 del encargo): esta salida
//    es para el cliente que la contrata.
import * as C from "./proveedores-catalogo.mjs";

export const ESQUEMA = "rosetta-rqt-descubrimiento/0";
export const SENALES = {
  "RQ.T.01": "Operador del borde", "RQ.T.02": "Proveedor de correo", "RQ.T.03": "Envío autorizado (SPF/DKIM)",
  "RQ.T.04": "DNS autoritativo", "RQ.T.05": "Emisor de certificados (CT + CAA)", "RQ.T.06": "Servicios delegados por nombre",
  "RQ.T.07": "Servicios verificados por DNS",
};
export const FUERA_DE_ALCANCE = [
  "RQ.T.01: encabezados HTTP del borde — no se obtienen sin un GET a la portada (eso es RQ.T.08).",
  "RQ.T.08: terceros cargados por la portada — requiere un GET; queda fuera hasta que Nicholas lo apruebe.",
  "RQ.T.09: proveedores declarados — los entrega el cliente; sin esa lista, «no declarados» no se puede calcular.",
  "RQ.T.10–RQ.T.15: medir a cada proveedor (nota, canal delegado, correo, fecha, cambio) — este módulo sólo descubre.",
  "RQ.T.03: mecanismos ip4/ip6 del SPF — se cuentan pero no se atribuyen a proveedor (haría falta el ASN de cada rango).",
  "RQ.T.07: sólo el TXT del apex; los TXT en subnombres (_amazonses, _dnsauth…) no se consultan.",
];
export const MAX_NOMBRES_CT = 400;
export const MAX_SPF_CONSULTAS = 10;   // el límite de búsquedas DNS que el propio SPF impone (RFC 7208 §4.6.4)

// ---------------------------------------------------------------- lectura de respuestas DNS
export const clave = (nombre, tipo) => `${String(nombre).toLowerCase().replace(/\.$/, "")}|${tipo}`;
const sinPunto = (s) => String(s).replace(/\.$/, "").toLowerCase();
// TXT de DoH: una o varias cadenas entre comillas, que se concatenan sin separador (RFC 7208 §3.3).
export function textoTxt(data) {
  const partes = String(data).match(/"((?:[^"\\]|\\.)*)"/g);
  return partes ? partes.map((p) => p.slice(1, -1).replace(/\\(.)/g, "$1")).join("") : String(data);
}
/** Lo que dijo el DNS de un nombre: { estado: "respondió" | "sin dato", ... }. */
export function leer(insumos, nombre, tipo) {
  const r = insumos.dns?.[clave(nombre, tipo)];
  if (!r) return { estado: "sin dato", razon: "no consultado" };
  if (r.error) return { estado: "sin dato", razon: `sin respuesta (${r.error})` };
  if (r.status !== "NOERROR") return { estado: "sin dato", razon: `DNS ${r.status}` };
  const ans = r.answer || [];
  return { estado: "respondió", answer: ans, cname: ans.filter((a) => a.type === 5).map((a) => sinPunto(a.data)),
    a: ans.filter((a) => a.type === 1 || a.type === 28).map((a) => a.data).sort() };
}
const deTipo = (l, t) => (l.answer || []).filter((a) => a.type === t);

// ---------------------------------------------------------------- SPF (lo usa también el ejecutor)
export function esSpf(txt) { return /^v=spf1(\s|$)/i.test(String(txt).trim()); }
export function mecanismosSpf(txt) {
  const out = { include: [], redirect: null, ip: 0, otros: [] };
  for (const t of String(txt).trim().split(/\s+/).slice(1)) {
    const m = t.replace(/^[+\-~?]/, "");
    if (/^include:/i.test(m)) out.include.push(sinPunto(m.slice(8)));
    else if (/^redirect=/i.test(m)) out.redirect = sinPunto(m.slice(9));
    else if (/^ip[46]:/i.test(m)) out.ip++;
    else if (!/^all$/i.test(m)) out.otros.push(m);
  }
  return out;
}
/** Recorre el árbol de includes que esté en los insumos. Devuelve cada dominio incluido, con su nivel. */
export function arbolSpf(insumos, dominio) {
  const raiz = leer(insumos, dominio, "TXT");
  if (raiz.estado !== "respondió") return { estado: "sin dato", razon: raiz.razon };
  const spf = deTipo(raiz, 16).map((a) => textoTxt(a.data)).filter(esSpf);
  if (!spf.length) return { estado: "sin dato", razon: "el dominio no publica SPF" };
  const visitados = [], cola = [{ dom: dominio, txt: spf[0], nivel: 0 }];
  let ip = 0, consultas = 0;
  const pendientes = [];
  while (cola.length) {
    const { dom, txt, nivel } = cola.shift();
    const m = mecanismosSpf(txt);
    ip += m.ip;
    for (const inc of [...m.include, ...(m.redirect ? [m.redirect] : [])]) {
      if (visitados.some((v) => v.dominio === inc)) continue;
      consultas++;
      const v = { dominio: inc, nivel: nivel + 1, desde: dom };
      visitados.push(v);
      if (consultas > MAX_SPF_CONSULTAS) { v.nota = "no seguido: pasa el límite de 10 búsquedas del SPF"; continue; }
      const l = leer(insumos, inc, "TXT");
      if (l.estado !== "respondió") { v.nota = l.razon; pendientes.push(inc); continue; }
      const hijo = deTipo(l, 16).map((a) => textoTxt(a.data)).find(esSpf);
      if (hijo) cola.push({ dom: inc, txt: hijo, nivel: nivel + 1 });
    }
  }
  return { estado: "respondió", registro: spf[0], includes: visitados, ip, pendientes };
}

// ---------------------------------------------------------------- CT
export const nombresDeCt = (insumos, dominio) => {
  const s = new Set();
  for (const f of insumos.ct?.fuentes || []) if (f.ok)
    for (const c of f.certificados || []) for (const n of c.nombres || []) {
      const x = sinPunto(n);
      if (x && !x.includes("*") && C.esPropio(x, dominio)) s.add(x);
    }
  return [...s].sort();
};
/** La organización (O=) de un DN de emisor, con o sin comillas. */
export function organizacionDe(dn) {
  const m = String(dn || "").match(/(?:^|,\s*)O=("(?:[^"]|"")*"|[^,]*)/);
  if (!m) return null;
  const v = m[1].trim();
  return v.startsWith('"') ? v.slice(1, -1).replace(/""/g, '"') : v;
}

// ---------------------------------------------------------------- las filas
function fila(senal, p) {
  return { senal, proveedor: p.proveedor ?? null, servicio: p.servicio ?? null, clasificado: !!p.clasificado,
    estado: p.estado || "con dato", evidencia: p.evidencia, ...(p.nombres ? { nombres: p.nombres } : {}) };
}
const sinDato = (senal, razon) => fila(senal, { estado: "sin dato", evidencia: razon });
const ejemplos = (xs, k = 2) => xs.slice(0, k).join(", ") + (xs.length > k ? ` y ${xs.length - k} más` : "");

/** Agrupa hallazgos {proveedor, servicio, clasificado, nombre, detalle} en una fila por proveedor. */
function agrupar(senal, hallazgos, rotulo) {
  const g = new Map();
  for (const h of hallazgos) {
    const k = h.proveedor;
    if (!g.has(k)) g.set(k, { ...h, nombres: [], servicios: new Set(), detalles: new Set() });
    const x = g.get(k);
    if (h.nombre) x.nombres.push(h.nombre);
    if (h.servicio) x.servicios.add(h.servicio);
    if (h.detalle) x.detalles.add(h.detalle);
  }
  return [...g.values()].map((x) => {
    const nombres = [...new Set(x.nombres)].sort();
    const det = [...x.detalles].sort();
    return fila(senal, { proveedor: x.proveedor, servicio: [...x.servicios].sort().join(" · ") || null, clasificado: x.clasificado,
      evidencia: (nombres.length ? `${nombres.length} ${nombres.length === 1 ? rotulo[0] : rotulo[1]}: ${ejemplos(nombres)}` : "") + (det.length ? `${nombres.length ? " · " : ""}${ejemplos(det, 3)}` : ""),
      nombres: nombres.length ? nombres : undefined });
  });
}

// Una cadena CNAME → hallazgos. Cada eslabón clasificado da un hallazgo (borde → T.01, otra clase → T.06).
// Si ningún eslabón calza y la cadena sale del dominio, queda un «externo sin clasificar» (T.06).
export function leerCadena(nombre, cadena, dominio) {
  const out = [];
  for (const e of cadena) {
    const c = C.clasificarNombre(e);
    if (c && !out.some((o) => o.proveedor === c.proveedor && o.clase === c.clase))
      out.push({ proveedor: c.proveedor, servicio: c.servicio, clase: c.clase, clasificado: true, nombre, detalle: `${nombre} → ${e}` });
  }
  if (!out.length) {
    const ext = cadena.find((e) => !C.esPropio(e, dominio));
    if (ext) out.push({ proveedor: C.registrable(ext), servicio: null, clase: "externo", clasificado: false, nombre, detalle: `${nombre} → ${ext}` });
  }
  return out;
}

export function descubrir(insumos, { declarados = null } = {}) {
  const dominio = sinPunto(insumos.dominio);
  const filas = [];
  const den = {};
  const nota = (s, o) => { den[s] = { ...(den[s] || {}), ...o }; };

  // ---------- T.04 NS
  {
    const l = leer(insumos, dominio, "NS");
    const ns = l.estado === "respondió" ? deTipo(l, 2).map((a) => sinPunto(a.data)).sort() : [];
    if (!ns.length) { filas.push(sinDato("RQ.T.04", l.razon || "NOERROR sin registros NS")); nota("RQ.T.04", { consultados: 1, registros: null }); }
    else {
      const h = ns.map((n) => { const c = C.clasificarNombre(n);
        return c ? { proveedor: c.proveedor, servicio: c.servicio, clasificado: true, nombre: n }
          : C.esPropio(n, dominio) ? { proveedor: "(propio)", servicio: "servidores bajo el mismo dominio", clasificado: false, propio: true, nombre: n }
          : { proveedor: C.registrable(n), clasificado: false, nombre: n }; });
      filas.push(...agrupar("RQ.T.04", h, ["servidor NS", "servidores NS"]));
      nota("RQ.T.04", { consultados: 1, registros: ns.length });
    }
  }

  // ---------- T.02 MX (la MISMA clasificación que la ficha pública: proveedorMx)
  {
    const l = leer(insumos, dominio, "MX");
    const mx = l.estado === "respondió" ? deTipo(l, 15).map((a) => sinPunto(String(a.data).split(" ").pop())).filter(Boolean).sort() : [];
    if (!mx.length) { filas.push(sinDato("RQ.T.02", l.razon || "NOERROR sin registros MX")); nota("RQ.T.02", { consultados: 1, registros: null }); }
    else {
      const h = mx.map((m) => {
        const srv = C.proveedorMx(m), emp = C.EMPRESA_MX[srv];
        if (emp) return { proveedor: emp, servicio: srv, clasificado: true, nombre: m };
        if (C.esPropio(m, dominio)) return { proveedor: "(propio)", servicio: "servidores bajo el mismo dominio", clasificado: false, nombre: m };
        const c = C.clasificarNombre(m);
        return c ? { proveedor: c.proveedor, servicio: c.servicio, clasificado: true, nombre: m } : { proveedor: srv, clasificado: false, nombre: m };
      });
      filas.push(...agrupar("RQ.T.02", h, ["servidor MX", "servidores MX"]));
      nota("RQ.T.02", { consultados: 1, registros: mx.length });
    }
  }

  // ---------- T.03 SPF + DKIM
  {
    const spf = arbolSpf(insumos, dominio);
    const h = [];
    if (spf.estado === "respondió") {
      for (const inc of spf.includes) {
        const c = C.clasificarNombre(inc.dominio);
        if (c) h.push({ proveedor: c.proveedor, servicio: c.servicio, clasificado: true, nombre: `include:${inc.dominio}` });
        else if (!C.esPropio(inc.dominio, dominio)) h.push({ proveedor: C.registrable(inc.dominio), clasificado: false, nombre: `include:${inc.dominio}` });
      }
    }
    let dkimCon = 0;
    for (const s of C.DKIM_SELECTORES) {
      const nombre = `${s}._domainkey.${dominio}`;
      const l = leer(insumos, nombre, "TXT");
      if (l.estado !== "respondió" || !(l.answer || []).length) continue;
      dkimCon++;
      const porCname = l.cname.map((x) => C.clasificarNombre(x)).find(Boolean);
      const unico = C.DKIM_SELECTOR_UNICO[s];
      if (porCname) h.push({ proveedor: porCname.proveedor, servicio: porCname.servicio, clasificado: true, nombre: `DKIM ${s}`, detalle: `${s}._domainkey → ${l.cname.join(" → ")}` });
      else if (unico) h.push({ proveedor: unico[0], servicio: unico[1], clasificado: true, nombre: `DKIM ${s}` });
      else { const ext = l.cname.find((x) => !C.esPropio(x, dominio));
        if (ext) h.push({ proveedor: C.registrable(ext), clasificado: false, nombre: `DKIM ${s}`, detalle: `${s}._domainkey → ${ext}` }); }
    }
    const consultadosDkim = C.DKIM_SELECTORES.filter((s) => insumos.dns?.[clave(`${s}._domainkey.${dominio}`, "TXT")]).length;
    if (spf.estado !== "respondió" && !h.length) filas.push(sinDato("RQ.T.03", `SPF: ${spf.razon}; DKIM: ${dkimCon} de ${consultadosDkim} selectores conocidos con registro`));
    else if (!h.length) filas.push(fila("RQ.T.03", { estado: "con dato", evidencia: `SPF sin includes de terceros (${spf.ip ?? 0} rangos ip4/ip6 no atribuidos); DKIM: ${dkimCon} de ${consultadosDkim} selectores con registro, ninguno atribuible` }));
    else filas.push(...agrupar("RQ.T.03", h, ["mecanismo", "mecanismos"]));
    nota("RQ.T.03", { spf: spf.estado === "respondió" ? { includes: spf.includes.length, rangos_ip_no_atribuidos: spf.ip, sin_respuesta: spf.pendientes.length } : null,
      dkim: { selectores_consultados: consultadosDkim, con_registro: dkimCon } });
  }

  // ---------- T.05 CT (emisor) + CAA
  {
    const hoy = String(insumos.medido_utc || "").slice(0, 10);
    const fuentes = insumos.ct?.fuentes || [];
    const ok = fuentes.filter((f) => f.ok);
    const h = [];
    const porCa = new Map();
    for (const f of ok) for (const c of f.certificados || []) {
      if (!(c.nombres || []).some((n) => C.esPropio(sinPunto(n), dominio))) continue;
      const ca = C.caDeEmisor(c.emisor_operador || organizacionDe(c.emisor_dn) || c.emisor_dn);
      const vig = !hoy || !c.not_after || String(c.not_after).slice(0, 10) >= hoy;
      if (!porCa.has(ca)) porCa.set(ca, { vigentes: {}, total: {} });
      const x = porCa.get(ca);
      x.total[f.fuente] = (x.total[f.fuente] || 0) + 1;
      if (vig) x.vigentes[f.fuente] = (x.vigentes[f.fuente] || 0) + 1;
    }
    const cuenta = (o) => Object.entries(o).sort().map(([k, v]) => `${k} ${v}`).join(" · ");
    const historicas = [];
    for (const [ca, x] of [...porCa.entries()].sort()) {
      if (Object.keys(x.vigentes).length) h.push({ proveedor: C.empresaDeCa(ca), servicio: `${ca}: emite (CT)`, clasificado: true, detalle: `vigentes: ${cuenta(x.vigentes)} (histórico: ${cuenta(x.total)})` });
      else historicas.push(ca);
    }
    const caa = leer(insumos, dominio, "CAA");
    const caaReg = caa.estado === "respondió" ? deTipo(caa, 257).map((a) => String(a.data)) : [];
    for (const r of caaReg) {
      const m = r.match(/^\d+\s+(issue|issuewild)\s+"([^";]*)/i);
      if (!m || !m[2].trim()) continue;
      const v = m[2].trim().toLowerCase(), ca = C.CAA_CA[v];
      h.push({ proveedor: ca ? C.empresaDeCa(ca) : v, servicio: ca ? `${ca}: autorizada (CAA)` : null, clasificado: !!ca, detalle: `CAA ${m[1]} "${v}"` });
    }
    if (!ok.length && !caaReg.length)
      filas.push(sinDato("RQ.T.05", `CT: ${fuentes.length ? fuentes.map((f) => `${f.fuente} ${f.error || "sin respuesta"}`).join("; ") : "no consultado"}; CAA: ${caa.razon || "NOERROR sin registros CAA"}`));
    else filas.push(...agrupar("RQ.T.05", h, ["", ""]));
    for (const f of fuentes.filter((x) => x.ok && x.parcial))
      filas.push(fila("RQ.T.05", { estado: "con dato", evidencia: `${f.fuente} PARCIAL (${f.parcial}): ${(f.certificados || []).length} certificados leídos, no todos` }));
    if (historicas.length) filas.push(fila("RQ.T.05", { estado: "con dato", proveedor: null,
      evidencia: `emisores sólo con certificados vencidos (no se cuentan como proveedor actual): ${historicas.join(", ")}` }));
    nota("RQ.T.05", { ct_fuentes: fuentes.map((f) => ({ fuente: f.fuente, ok: !!f.ok, certificados: f.ok ? (f.certificados || []).length : null,
      ...(f.parcial ? { parcial: f.parcial } : {}), ...(f.error ? { error: f.error } : {}) })),
      caa_registros: caa.estado === "respondió" ? caaReg.length : null, ...(caa.estado !== "respondió" ? { caa: caa.razon } : {}) });
    if (ok.length && !caaReg.length) filas.push(fila("RQ.T.05", { estado: "sin dato", evidencia: `CAA: ${caa.razon || "el dominio no publica CAA (cualquier CA puede emitir)"}` }));
  }

  // ---------- T.01 borde (apex y www: CNAME + ASN) y T.06 (nombres de CT → CNAME)
  {
    const h01 = [], h06 = [];
    let respondieron = 0;
    const asnSinDato = [];
    for (const host of [dominio, `www.${dominio}`]) {
      const l = leer(insumos, host, "A");
      if (l.estado !== "respondió" || (!l.cname.length && !l.a.length)) continue;
      respondieron++;
      for (const x of leerCadena(host, l.cname, dominio)) (x.clase === "borde" ? h01 : h06).push(x);
      for (const ip of l.a.filter((a) => /^\d+\.\d+\.\d+\.\d+$/.test(a))) {
        const o = leer(insumos, ip.split(".").reverse().join(".") + ".origin.asn.cymru.com", "TXT");
        const t = o.estado === "respondió" ? deTipo(o, 16).map((a) => textoTxt(a.data))[0] : null;
        if (!t) { asnSinDato.push(ip); continue; }
        const asn = Number(t.split("|")[0].trim().split(" ")[0]);
        const nom = leer(insumos, `AS${asn}.asn.cymru.com`, "TXT");
        const asNombre = nom.estado === "respondió" ? (deTipo(nom, 16).map((a) => textoTxt(a.data))[0] || "").split("|").pop().trim() : null;
        const p = C.proveedorAsn(asn);
        h01.push({ proveedor: p || `AS${asn}${asNombre ? ` ${asNombre}` : ""}`, servicio: p ? `red AS${asn}` : null, clasificado: !!p, nombre: host, detalle: `${host} en AS${asn}${asNombre ? ` (${asNombre})` : ""}` });
      }
    }
    const todos = nombresDeCt(insumos, dominio);
    const consultados = todos.slice(0, MAX_NOMBRES_CT);
    let resueltos = 0, inexistentes = 0, sinResp = 0, conCname = 0, propios = 0;
    for (const n of consultados) {
      if (n === dominio || n === `www.${dominio}`) continue;
      const l = leer(insumos, n, "A");
      if (l.estado !== "respondió") { if (/NXDOMAIN/.test(l.razon)) inexistentes++; else sinResp++; continue; }
      resueltos++;
      if (!l.cname.length) continue;
      conCname++;
      const xs = leerCadena(n, l.cname, dominio);
      if (!xs.length) propios++;
      for (const x of xs) (x.clase === "borde" ? h01 : h06).push(x);
    }
    if (!respondieron && !h01.length) filas.push(sinDato("RQ.T.01", `${dominio} y www.${dominio} sin respuesta DNS utilizable`));
    else if (!h01.length) filas.push(fila("RQ.T.01", { estado: "con dato", evidencia: "ningún eslabón CNAME ni ASN atribuible a un operador de borde conocido" }));
    else filas.push(...agrupar("RQ.T.01", h01, ["nombre", "nombres"]));
    if (asnSinDato.length) filas.push(fila("RQ.T.01", { estado: "sin dato", evidencia: `ASN de las IP de ${dominio} y www: Team Cymru (DNS) no respondió` }));   // el número de IP va al denominador: el borde las rota
    nota("RQ.T.01", { hosts: 2, respondieron, ips_sin_asn: asnSinDato.length, encabezados: "no medidos (requieren GET, RQ.T.08)" });

    if (!todos.length) filas.push(sinDato("RQ.T.06", `sin nombres en CT: ${(insumos.ct?.fuentes || []).map((f) => `${f.fuente} ${f.ok ? "0 nombres" : f.error || "sin respuesta"}`).join("; ") || "no consultado"}`));
    else if (!h06.length) filas.push(fila("RQ.T.06", { estado: "con dato", evidencia: `${conCname} de ${resueltos} nombres con CNAME, ninguno delegado a un tercero` }));
    else filas.push(...agrupar("RQ.T.06", h06, ["nombre", "nombres"]));
    nota("RQ.T.06", { nombres_ct: todos.length, consultados: consultados.length, recortados: todos.length - consultados.length,
      resueltos, ya_no_existen: inexistentes, sin_respuesta: sinResp, con_cname: conCname, cname_propio: propios });
  }

  // ---------- T.07 TXT de verificación
  {
    const l = leer(insumos, dominio, "TXT");
    const txt = l.estado === "respondió" ? deTipo(l, 16).map((a) => textoTxt(a.data)) : [];
    if (l.estado !== "respondió" || !txt.length) { filas.push(sinDato("RQ.T.07", l.razon || "NOERROR sin registros TXT")); nota("RQ.T.07", { txt: null }); }
    else {
      const h = []; let sinPatron = 0, spf = 0, dmarc = 0;
      for (const t of txt) {
        if (esSpf(t)) { spf++; continue; }
        const v = C.verificacionTxt(t);
        if (v) h.push({ proveedor: v.proveedor, servicio: v.servicio, clasificado: true, nombre: t.split(/[=:]/)[0] + "=…" });
        else sinPatron++;
      }
      if (!h.length) filas.push(fila("RQ.T.07", { estado: "con dato", evidencia: `${txt.length} TXT, ninguno con patrón de verificación conocido` }));
      else filas.push(...agrupar("RQ.T.07", h, ["registro", "registros"]));
      nota("RQ.T.07", { txt: txt.length, spf, con_patron: h.length, sin_patron: sinPatron });
    }
  }

  // ---------- resumen
  filas.sort((a, b) => a.senal.localeCompare(b.senal) || (a.estado === b.estado ? 0 : a.estado === "sin dato" ? 1 : -1)
    || String(a.proveedor).localeCompare(String(b.proveedor)) || a.evidencia.localeCompare(b.evidencia));
  const terceros = filas.filter((f) => f.clasificado && f.proveedor);
  const prov = new Map();
  for (const f of terceros) { if (!prov.has(f.proveedor)) prov.set(f.proveedor, new Set()); prov.get(f.proveedor).add(f.senal); }
  const proveedores = [...prov.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([p, s]) => ({ proveedor: p, senales: [...s].sort() }));
  const externos = filas.filter((f) => !f.clasificado && f.proveedor && !f.proveedor.startsWith("(")).map((f) => ({ dominio: f.proveedor, senal: f.senal }));
  const por_senal = {};
  for (const s of Object.keys(SENALES)) {
    const fs = filas.filter((f) => f.senal === s);
    const conDato = fs.some((f) => f.estado === "con dato");
    por_senal[s] = { nombre: SENALES[s], estado: conDato ? "con dato" : "sin dato",
      // null si la señal no devolvió nada: «sin dato» no es «cero proveedores»
      proveedores: conDato ? new Set(fs.filter((f) => f.clasificado && f.proveedor).map((f) => f.proveedor)).size : null,
      externos_sin_clasificar: conDato ? fs.filter((f) => !f.clasificado && f.proveedor && !f.proveedor.startsWith("(")).length : null,
      denominador: den[s] || null };
  }
  let no_declarados = null, nota_declarados = "No hay lista declarada (RQ.T.09): «no declarados» no se puede calcular; se reporta el total descubierto con su denominador por señal.";
  if (Array.isArray(declarados)) {
    const d = new Set(declarados.map((x) => String(x).trim().toLowerCase()));
    no_declarados = proveedores.filter((p) => !d.has(p.proveedor.toLowerCase())).map((p) => p.proveedor);
    nota_declarados = `${no_declarados.length} de ${proveedores.length} proveedores descubiertos no están en la lista declarada (${d.size} declarados).`;
  }
  return { esquema: ESQUEMA, catalogo: C.CATALOGO_VERSION, dominio, medido_utc: insumos.medido_utc || null,
    resumen: { proveedores_descubiertos: proveedores.length, externos_sin_clasificar: externos.length,
      declarados: Array.isArray(declarados) ? declarados.length : null, no_declarados: no_declarados ? no_declarados.length : null,
      nota: nota_declarados },
    proveedores, externos_sin_clasificar: externos, no_declarados, por_senal, filas, fuera_de_alcance: FUERA_DE_ALCANCE };
}

// ---------------------------------------------------------------- comparar dos corridas
// Dos niveles, y los dos se muestran: (1) el RESULTADO — qué proveedor salió de qué señal y en qué
// estado —, y (2) la evidencia textual completa, que incluye conteos de CT que cambian con la fuente que
// contestó (crt.sh cae a ratos y sus réplicas difieren en unas filas). No compara la hora ni la latencia.
export function diffCorridas(a, b) {
  const dif = (ka) => { const A = new Set(a.filas.map(ka)), B = new Set(b.filas.map(ka));
    return [[...A].filter((x) => !B.has(x)).sort(), [...B].filter((x) => !A.has(x)).sort()]; };
  const [pa, pb] = dif((f) => `${f.senal} · ${f.proveedor ?? "—"} · ${f.estado}`);
  const [solo_a, solo_b] = dif((f) => `${f.senal} · ${f.proveedor ?? "—"} · ${f.estado} · ${f.evidencia}`);
  const la = a.proveedores.map((p) => p.proveedor).join("|"), lb = b.proveedores.map((p) => p.proveedor).join("|");
  return { resultado_igual: !pa.length && !pb.length && la === lb, iguales: !solo_a.length && !solo_b.length && la === lb,
    filas_a: a.filas.length, filas_b: b.filas.length, proveedores_a: a.proveedores.length, proveedores_b: b.proveedores.length,
    pares_solo_en_a: pa, pares_solo_en_b: pb, solo_en_a: solo_a, solo_en_b: solo_b };
}

/** Tabla de texto: señal · proveedor · evidencia. */
export function tabla(r) {
  const l = [`${r.dominio} · ${r.medido_utc} · ${r.catalogo}`,
    `proveedores descubiertos: ${r.resumen.proveedores_descubiertos} · externos sin clasificar: ${r.resumen.externos_sin_clasificar} · no declarados: ${r.resumen.no_declarados ?? "sin lista (null)"}`];
  for (const f of r.filas) l.push(`${f.senal} | ${f.estado === "sin dato" ? "SIN DATO" : f.proveedor ?? "—"}${f.clasificado ? "" : f.proveedor ? " (sin clasificar)" : ""} | ${f.evidencia}`);
  return l.join("\n");
}
