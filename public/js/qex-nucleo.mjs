/*
 * Núcleo del informe QEX en vivo (30-oct-2026). Funciones puras: ni red ni página.
 * Lo usan la página /es/q-ready/medicion (navegador) y scripts/check-informe-envivo.mjs (node),
 * que exige que este archivo reproduzca la medición de octubre hecha con los scripts de Python:
 *   ct_analizar.py   → PAT, filtro de nombres, conteos         (reproduce 220/66/1/0/4/13 de agosto)
 *   higiene_regla.py → regla de higiene                        (reproduce 170/170 filas de agosto)
 *   calcular_qex.py  → irec(): pesos, renormalización y tope   (norma; si discrepan, manda el .py)
 * Una sola definición: la página no recalcula nada por su cuenta.
 */

export const VERSION_QEX = "QEX-1.0";
export const ESQUEMA_FOTO = "rosetta-qex-foto/1";
export const PESOS = { certificados: 0.40, higiene: 0.25, hndl: 0.25, edge: 0.10 };
export const TOPE = 84;

// Idénticos a ct_discover.py de agosto (y a ct_analizar.py). No se «mejoran»: cambiarlos rompe
// la comparación con agosto, que es justo lo que esta página existe para hacer.
export const PAT = {
  no_productivo: /(^|[.\-])(dev|test|qa|uat|stg|stage|staging|lab|demo|sandbox|pre|prueba|pruebas)([.\-]|$)/,
  legado: /(^|[.\-])(old|legacy|bkp|backup|tmp|temp|deprecated|antiguo|antigua|v1)([.\-]|$)/,
  infra_expuesta: /(^|[.\-])(vpn|mail|smtp|webmail|ftp|sftp|rdp|citrix|jenkins|jira|admin|cpanel|monitor|nagios|grafana|gitlab|sonar)([.\-]|$)/,
  critico: /(^|[.\-])(api|pay|pagos?|payments?|auth|login|sso|portal|banca|online|empresas|secure|transfer)([.\-]|$)/,
};
// Clases que se sondean una por una: lo que la dimensión higiene castiga.
export const CLASES_SENSIBLES = ["no_productivo", "legado", "infra_expuesta"];

// Filas de crt.sh → { host: [filas] }. Filtro heredado de agosto: `endsWith(dominio)` de cadena,
// no de etiqueta DNS (cuenta mail.extranetsantander.cl como de santander.cl). Se conserva a
// propósito para comparar igual con igual; `etiqueta_estricta` lo declara por host.
export function nombresCT(filas, dominio, corteNotBefore = null) {
  const s = new Map();
  for (const r of filas) {
    if (corteNotBefore && !(r.not_before <= corteNotBefore)) continue;
    for (let n of String(r.name_value || "").split("\n")) {
      n = n.trim().toLowerCase();
      if (n && !n.includes("*") && n.endsWith(dominio)) {
        if (!s.has(n)) s.set(n, []);
        s.get(n).push(r);
      }
    }
  }
  return s;
}

export const clasesDe = (host) => Object.keys(PAT).filter((k) => PAT[k].test(host));
export const esProfundo = (host) => host.split(".").length - 1 >= 3;

export function conteos(hosts) {
  const o = { hostnames: hosts.length, profundos: hosts.filter(esProfundo).length };
  for (const k of Object.keys(PAT)) o[k] = hosts.filter((h) => PAT[k].test(h)).length;
  return o;
}

export function hostsCT(mapa, dominio) {
  return [...mapa.keys()].sort().map((h) => {
    const certs = mapa.get(h);
    return {
      host: h, clases: clasesDe(h), profundo: esProfundo(h),
      etiqueta_estricta: h === dominio || h.endsWith("." + dominio),
      ultimo_not_before: certs.reduce((m, c) => (c.not_before > m ? c.not_before : m), ""),
      ultimo_not_after: certs.reduce((m, c) => (c.not_after > m ? c.not_after : m), ""),
    };
  });
}

// higiene_regla.py. `sinTls13` null = no medido: no descuenta (en agosto, «sin TLS 1.3» sólo
// contaba con la alerta 70 explícita). `ct` null = CT no disponible: sólo cuenta TLS.
export function higiene(sinTls13, ct) {
  let base = 70;
  if (sinTls13 === true) base -= 30;
  if (ct) {
    if ((ct.no_productivo || 0) > 0) base -= 10;
    if ((ct.infra_expuesta || 0) >= 3) base -= 10;
    if ((ct.legado || 0) > 0) base -= 10;
  }
  return Math.max(0, Math.min(100, base));
}

// Regla normativa de certificados (reproduce 149/149 en agosto): 100 si supera el mínimo vigente
// (RSA ≥ 4096 o curva ≥ 384 bits), 75 si está en el mínimo. Sin certificado leído: null (no 0).
export function certificadosValor(cert) {
  if (!cert || !cert.ok) return null;
  if (cert.algoritmo === "EC") return cert.bits >= 384 ? 100 : 75;
  if (cert.algoritmo === "RSA") return cert.bits >= 4096 ? 100 : 75;
  return null;
}

export const edgeValor = (soporta) => (soporta === true ? 100 : soporta === false ? 0 : null);

// round() de Python 3: mitad al par. Math.round(56.5) da 57; Python da 56.
export function redondearPar(x) {
  const f = Math.floor(x), d = x - f;
  if (Math.abs(d - 0.5) < 1e-9) return f % 2 === 0 ? f : f + 1;
  return Math.round(x);
}

// calcular_qex.irec: dimensión null = NO MEDIDA, se renormaliza sobre los pesos usables.
export function irec(dim, tope = TOPE) {
  let num = 0, den = 0;
  for (const [k, p] of Object.entries(PESOS)) {
    if (!(k in dim)) throw new Error(`falta la dimensión '${k}'`);
    const v = dim[k];
    if (v == null) continue;
    if (!(v >= 0 && v <= 100)) throw new Error(`'${k}' fuera de rango 0-100: ${v}`);
    num += v * p; den += p;
  }
  if (den === 0) return null;
  return Math.min(tope, redondearPar(num / den));
}

export function qex(dim) {
  const aportes = {}; let suma = 0, pesoUsado = 0;
  for (const [k, p] of Object.entries(PESOS)) {
    aportes[k] = dim[k] == null ? null : Math.round(dim[k] * p * 100) / 100;
    if (dim[k] != null) { suma += dim[k] * p; pesoUsado += p; }
  }
  return { version: VERSION_QEX, dimensiones: dim, pesos: PESOS, aportes,
    suma: Math.round(suma * 100) / 100, peso_usado: Math.round(pesoUsado * 100) / 100,
    score: irec(dim), tope: TOPE };
}

// JSON con claves ordenadas: la huella no depende del orden en que se armó el objeto.
// Igual a canon() de lib/borde-envivo.mjs.
export function canon(v) {
  if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
  if (v && typeof v === "object") return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
  return JSON.stringify(v);
}

export async function sha256Hex(texto) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// La huella cubre la foto entera menos el propio campo sha256.
export async function sellarFoto(foto) {
  const { sha256, ...resto } = foto;
  return { ...resto, sha256: await sha256Hex(canon(resto)) };
}
export async function fotoIntegra(foto) {
  const { sha256, ...resto } = foto;
  return !!sha256 && sha256 === (await sha256Hex(canon(resto)));
}

// ---------------------------------------------------------------- comparación de dos fotos
// Cada ítem sale con uno de cuatro estados:
//   cambio       — las dos fotos lo midieron igual y el valor es distinto.
//   se_mantiene  — las dos lo midieron y el valor es el mismo.
//   medido_hoy   — la foto anterior no lo midió (o sólo registró que el nombre existía) y la de hoy sí.
//                  No se dice «cambió»: no se sabe cómo estaba antes.
//   sin_dato     — la foto de hoy no lo pudo medir.
// Un ítem sin dato NUNCA se lee como «se mantiene», y uno medido por primera vez nunca como «cambió».
const igual = (a, b) => canon(a) === canon(b);
function item(grupo, k, etiqueta, antes, ahora, fmt = (x) => x) {
  return { grupo, k, etiqueta, antes: antes == null ? null : fmt(antes), ahora: ahora == null ? null : fmt(ahora),
    estado: estadoPar(antes, ahora, igual) };
}

export const ETIQUETA_DIM = { certificados: "Certificados y PKI", higiene: "Higiene de superficie", hndl: "Postura HNDL", edge: "PQC en el borde" };
export const ETIQUETA_CT = { hostnames: "Nombres en el registro público", profundos: "Nombres de 3 niveles o más",
  no_productivo: "Ambientes no productivos", legado: "Nombres de legado", infra_expuesta: "Infraestructura sensible", critico: "Servicios críticos" };

function estadoPar(antes, ahora, mismo) {
  if (ahora == null) return "sin_dato";
  if (antes == null) return "medido_hoy";
  return mismo(antes, ahora) ? "se_mantiene" : "cambio";
}
// Un endpoint que la foto anterior sólo registró como presente en CT no tiene estado medido.
const soloPresencia = (e) => e && e.dns_status == null && e.responde_443 == null;

export function estadoEndpoint(e) {
  if (!e) return null;
  if (e.dns_status == null && e.responde_443 == null) return "presente en el registro público";
  if (e.dns_status === "NXDOMAIN") return "ya no publicado en DNS";
  if (e.responde_443 === true) return "responde en el puerto 443";
  if (e.responde_443 === false) return "publicado en DNS, no responde en 443";
  return e.dns_status ? `DNS ${e.dns_status}` : "sin medición";
}

export function comparar(antes, ahora) {
  const it = [];
  it.push(item("qex", "score", "QEX", antes.qex?.score, ahora.qex?.score));
  for (const k of Object.keys(PESOS)) it.push(item("qex", k, ETIQUETA_DIM[k], antes.qex?.dimensiones?.[k], ahora.qex?.dimensiones?.[k]));
  for (const k of Object.keys(ETIQUETA_CT)) it.push(item("superficie", k, ETIQUETA_CT[k], antes.ct?.conteos?.[k], ahora.ct?.conteos?.[k]));

  const hA = new Set((antes.ct?.hosts || []).map((h) => h.host)), hB = new Set((ahora.ct?.hosts || []).map((h) => h.host));
  const hostsComparables = hA.size > 0 && hB.size > 0;
  const nuevos = hostsComparables ? [...hB].filter((h) => !hA.has(h)).sort() : null;
  const retirados = hostsComparables ? [...hA].filter((h) => !hB.has(h)).sort() : null;
  const siguen = hostsComparables ? [...hB].filter((h) => hA.has(h)).length : null;

  const eA = new Map((antes.endpoints || []).map((e) => [e.host, e])), eB = new Map((ahora.endpoints || []).map((e) => [e.host, e]));
  const endpoints = [...new Set([...eA.keys(), ...eB.keys()])].sort().map((h) => {
    const ea = eA.get(h), eb = eB.get(h), a = estadoEndpoint(ea), b = estadoEndpoint(eb);
    const medidoB = eb && !soloPresencia(eb) ? b : null;
    return { host: h, antes: a, ahora: b, estado: estadoPar(ea && !soloPresencia(ea) ? a : null, medidoB, (x, y) => x === y) };
  });

  const bA = antes.borde || {}, bB = ahora.borde || {};
  it.push(item("borde", "cdn", "Quién sirve el borde", bA.cdn, bB.cdn));
  it.push(item("borde", "soporta", "Soporta X25519MLKEM768", bA.soporta, bB.soporta, (x) => (x ? "sí" : "no")));
  it.push(item("borde", "elige", "Lo elige con libertad", bA.elige, bB.elige, (x) => (x ? "sí" : "no")));
  it.push(item("borde", "tls13", "TLS 1.3", antes.tls13, ahora.tls13, (x) => (x ? "sí" : "no")));
  const cA = antes.certificado || {}, cB = ahora.certificado || {};
  const algo = (c) => (c.ok ? `${c.algoritmo === "EC" ? "ECDSA" : c.algoritmo} ${c.curva || c.bits}` : null);
  it.push(item("certificado", "algoritmo", "Algoritmo del certificado", algo(cA), algo(cB)));
  it.push(item("certificado", "emisor", "Emisor", cA.emisor, cB.emisor));
  it.push(item("certificado", "vence", "Vence", cA.not_after, cB.not_after));
  const pA = antes.proveedores || {}, pB = ahora.proveedores || {};
  it.push(item("proveedores", "correo", "Proveedor de correo (MX)", pA.correo, pB.correo));
  it.push(item("proveedores", "security_txt", "Canal de reporte de seguridad (security.txt)", pA.security_txt, pB.security_txt,
    (x) => (x ? "publicado" : "no publicado")));

  const n = (e) => it.filter((x) => x.estado === e).length + endpoints.filter((x) => x.estado === e).length;
  return { antes: { medido_utc: antes.medido_utc, sha256: antes.sha256, edicion: antes.edicion },
    ahora: { medido_utc: ahora.medido_utc, sha256: ahora.sha256, edicion: ahora.edicion },
    mismo_dominio: antes.dominio === ahora.dominio,
    items: it, endpoints, hosts: { nuevos, retirados, siguen },
    resumen: { cambio: n("cambio"), se_mantiene: n("se_mantiene"), medido_hoy: n("medido_hoy"), sin_dato: n("sin_dato") } };
}

// ---------------------------------------------------------------- armar la foto
// Una sola definición de qué es una foto: la usan la página y entregables/…/envivo/foto_envivo.mjs
// (la que alimenta el PDF). Entradas crudas: filas de crt.sh (o null si no hubo registro) y la
// respuesta de /api/sondas tal cual. Devuelve la foto SIN sellar y el detalle que la página muestra.
export function armarFoto({ dominio, www, vertical, medido, ct, sondas: s, referencia, origen }) {
  const mapa = ct ? nombresCT(ct.filas, dominio) : null;
  const hosts = mapa ? hostsCT(mapa, dominio) : [];
  const cuentas = mapa ? conteos([...mapa.keys()]) : null;
  const clases = new Map(hosts.map((h) => [h.host, h.clases]));
  const endpoints = s.endpoints.map((x) => ({ host: x.host, clases: clases.get(x.host) || clasesDe(x.host), dns_status: x.dns_status,
    ip: x.ip, cname: x.cname, responde_443: x.responde_443, detalle: x.detalle, medido_utc: x.medido_utc }));
  const b = s.borde, v = b.veredicto, A = b.saludos.A_como_navegador;
  // TLS 1.3: el saludo A sólo ofrece 1.3. Respuesta de servidor = sí; alerta 70 (protocol_version) = no; corte = sin dato.
  const tls13 = A.grupo ? true : (A.alerta && /\/70$/.test(A.alerta)) ? false : null;
  const c = s.certificado;
  const ref = referencia.verticales[vertical];
  if (!ref) throw new Error(`sector desconocido: ${vertical}`);
  const dim = { certificados: certificadosValor(c), higiene: higiene(tls13 === false ? true : tls13 === true ? false : null, cuentas),
    hndl: ref.hndl, edge: edgeValor(v.soporta) };
  const q = qex(dim);
  const tipos = { certificados: "medido", higiene: ct ? "medido" : "medido, sin superficie", hndl: "modelo de sector", edge: "medido" };
  const corta = (iso) => (iso ? iso.slice(0, 10) : null);
  const foto = {
    esquema: ESQUEMA_FOTO, edicion: medido.slice(0, 7), dominio, www, vertical, medido_utc: medido, origen,
    ct: ct ? { fuente: ct.fuente, intentos: ct.intentos ?? null, consultado_utc: medido, filas: ct.filas.length, sha256_crudo: ct.sha256, conteos: cuentas, hosts } : null,
    endpoints,
    borde: { cdn: b.dns.cdn, cadena: b.dns.cadena, soporta: v.soporta, elige: v.elige, pide_mejora: v.pide_mejora, sha256_medicion: b.sha256 },
    tls13,
    certificado: c.ok ? { ok: true, algoritmo: c.algoritmo, curva: c.curva, bits: c.bits, firma: c.firma, emisor: c.emisor, sujeto: c.sujeto,
      not_before: corta(c.not_before), not_after: corta(c.not_after) } : { ok: false, error: c.error },
    proveedores: { correo: s.correo.proveedor, mx: s.correo.mx, security_txt: s.security_txt.publicado },
    qex: { ...q, tipos },
    referencia: { edicion: referencia.edicion, mediana_pais: referencia.mediana_pais, mediana_sector: ref.mediana, n_sector: ref.n },
    instrumentos: { pagina: "qex-nucleo.mjs", servidor: s.instrumento },
  };
  return { foto, detalle: { cuentas, hosts, endpoints, tls13, dim, q, tipos, ref } };
}
