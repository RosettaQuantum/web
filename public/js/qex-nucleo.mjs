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

// Nombres que anuncian un servicio de correo. NO es parte de PAT y no se usa para clasificar:
// sólo decide cómo se REDACTA el resultado del sondeo al puerto 443. Un servidor de correo que
// no contesta TLS en 443 está bien configurado —ahí no va un servicio web— y leerlo como
// «no responde» hace que la fila parezca un hallazgo. No toca clases, conteos ni el puntaje.
export const PAT_CORREO = /(^|[.\-])(mail|smtp|webmail|imap|pop3?|mx\d*|correo|owa|exchange)([.\-]|$)/;
export const esNombreDeCorreo = (host) => PAT_CORREO.test(String(host || ""));

// El detalle que viaja en la foto es la medición cruda y no se toca: la foto guarda lo que pasó.
// Esto sólo lo redacta al pintarlo. Si la sonda cambiara su texto, esto le añade la explicación
// sin inventarle un tiempo que no midió.
export const detalleCorreoSinWeb = (crudo) =>
  `${String(crudo || "sin respuesta en 443").replace("sin respuesta TLS en 443", "sin respuesta en 443")}: el nombre no expone un servicio web`;

// Filas de crt.sh → { host: [filas] }. Filtro heredado de agosto: `endsWith(dominio)` de cadena,
// no de etiqueta DNS (cuenta mail.extranetbanco.cl como de banco.cl). Se conserva a
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

// ---------------------------------------------------------------- las reglas, en datos (18-nov-2026)
// Los umbrales y los puntos de cada regla viven aquí UNA vez: los usan las funciones de abajo y la
// rúbrica publicada (public/js/rubrica-qex.mjs), que se genera de estas constantes y no las copia.
// scripts/check-rubrica-qex.mjs grita si una regla cambia sin que la rúbrica publicada cambie, y si
// una función deja de hacer lo que su constante dice (se la sondea en cada umbral). Cambiar un número
// aquí es cambiar el QEX: no se toca sin decisión del dueño.
// higiene_regla.py: base 70 y cuatro descuentos. `desde` = cuántos nombres hacen falta para descontar.
export const REGLA_HIGIENE = Object.freeze({
  base: 70, piso: 0, techo: 100,
  sin_tls13: -30,
  no_productivo: Object.freeze({ desde: 1, puntos: -10 }),
  infra_expuesta: Object.freeze({ desde: 3, puntos: -10 }),
  legado: Object.freeze({ desde: 1, puntos: -10 }),
});
// Regla normativa de certificados (reproduce 149/149 en agosto).
export const REGLA_CERTIFICADOS = Object.freeze({ rsa_bits: 4096, curva_bits: 384, supera: 100, minimo: 75 });
export const REGLA_EDGE = Object.freeze({ soporta: 100, no_soporta: 0 });

// higiene_regla.py. `sinTls13` null = no medido: no descuenta (en agosto, «sin TLS 1.3» sólo
// contaba con la alerta 70 explícita). `ct` null = CT no disponible: sólo cuenta TLS.
export function higiene(sinTls13, ct) {
  const R = REGLA_HIGIENE;
  let base = R.base;
  if (sinTls13 === true) base += R.sin_tls13;
  if (ct) {
    if ((ct.no_productivo || 0) >= R.no_productivo.desde) base += R.no_productivo.puntos;
    if ((ct.infra_expuesta || 0) >= R.infra_expuesta.desde) base += R.infra_expuesta.puntos;
    if ((ct.legado || 0) >= R.legado.desde) base += R.legado.puntos;
  }
  return Math.max(R.piso, Math.min(R.techo, base));
}

// Regla normativa de certificados (reproduce 149/149 en agosto): 100 si supera el mínimo vigente
// (RSA ≥ 4096 o curva ≥ 384 bits), 75 si está en el mínimo. Sin certificado leído: null (no 0).
export function certificadosValor(cert) {
  const R = REGLA_CERTIFICADOS;
  if (!cert || !cert.ok) return null;
  if (cert.algoritmo === "EC") return cert.bits >= R.curva_bits ? R.supera : R.minimo;
  if (cert.algoritmo === "RSA") return cert.bits >= R.rsa_bits ? R.supera : R.minimo;
  return null;
}

export const edgeValor = (soporta) => (soporta === true ? REGLA_EDGE.soporta : soporta === false ? REGLA_EDGE.no_soporta : null);

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

// `version` (16-nov-2026): la misma cuenta sirve a QEX-1.0 y a QEX-1.1, que sólo difieren en qué
// higiene reciben. Sin argumento declara QEX-1.0, como siempre.
export function qex(dim, version = VERSION_QEX) {
  const aportes = {}; let suma = 0, pesoUsado = 0;
  for (const [k, p] of Object.entries(PESOS)) {
    aportes[k] = dim[k] == null ? null : Math.round(dim[k] * p * 100) / 100;
    if (dim[k] != null) { suma += dim[k] * p; pesoUsado += p; }
  }
  return { version, dimensiones: dim, pesos: PESOS, aportes,
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

// La CLAVE es la medición y es estable; la ETIQUETA es cómo se lee y puede cambiar de redacción.
// `comparar` compara claves. Que quede dicho con precisión: esto NO arregla un defecto vivo.
// Una foto guardada antes de un cambio de redacción guarda la medición cruda, y `comparar`
// vuelve a redactar los dos lados con el código de hoy, así que nunca inventó un «cambió» —
// medido: mutar esto para comparar etiquetas deja la suite en 59/0. Es prevención, y sólo
// muerde el día que una foto llegue con una etiqueta ya escrita adentro.
export function claveEndpoint(e) {
  if (!e) return null;
  if (e.dns_status == null && e.responde_443 == null) return "presente_ct";
  if (e.dns_status === "NXDOMAIN") return "no_publicado";
  if (e.responde_443 === true) return "responde";
  if (e.responde_443 === false) return "no_responde";
  return e.dns_status ? `dns_${e.dns_status}` : "sin_medicion";
}

export function estadoEndpoint(e) {
  if (!e) return null;
  if (e.dns_status == null && e.responde_443 == null) return "presente en el registro público";
  if (e.dns_status === "NXDOMAIN") return "ya no publicado en DNS";
  if (e.responde_443 === true) return "responde en el puerto 443";
  if (e.responde_443 === false) return esNombreDeCorreo(e.host)
    ? "publicado en DNS, sin servicio web: es lo normal en un servidor de correo"
    : "publicado en DNS, no responde en 443";
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
    const ea = eA.get(h), eb = eB.get(h), b = estadoEndpoint(eb);
    // Un nombre que la foto anterior no tenía en CT no estaba «sin medir»: todavía no existía en el registro.
    const a = ea ? estadoEndpoint(ea) : nuevos?.includes(h) ? "aún no estaba en el registro público" : null;
    const kb = eb && !soloPresencia(eb) ? claveEndpoint(eb) : null;
    const ka = ea && !soloPresencia(ea) ? claveEndpoint(ea) : null;
    return { host: h, antes: a, ahora: b, estado: estadoPar(ka, kb, (x, y) => x === y) };
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

// ---------------------------------------------------------------- los pasos ANTES de armar la foto
// (12-nov-2026) Vivían escritos dentro de medicion-envivo.mjs. Ahora también mide el servidor, para
// los agentes (lib/medicion-agentes.mjs), y dos copias de «qué nombres se sondean» darían dos QEX
// distintos para el mismo dominio. Una sola definición, la usan los dos.

// Lo que escribe la persona (o manda el agente) → el dominio que se mide, o null si no es un dominio.
export function dominioDeEntrada(crudo) {
  const d = String(crudo ?? "").trim().toLowerCase()
    .replace(/^https?:\/\//, "").replace(/[\/?#].*$/, "").replace(/^www\./, "");
  return /^([a-z0-9-]+\.)+[a-z]{2,}$/.test(d) ? d : null;
}

// Tope de nombres sondeados por medición (lib/informe-envivo.mjs acepta hasta 15).
export const MAX_SONDEADOS = 15;

// Nombres que delatan un ambiente NO productivo, en español o en inglés (16-nov-2026, QREADY-NOTA-2).
// EL DEFECTO: openfinance-desa.<banco>.cl existe y responde 403 desde internet, pero la nota del banco
// salía A, porque «desa» no está en PAT.no_productivo y entonces el nombre NUNCA se sondeaba: la señal
// vieja (PRUEBA_LOCAL) sólo se miraba sobre nombres ya sondeados. Lo mismo con desarrollo,
// certificacion, homologacion, hml y development.
// NO es parte de PAT ni toca la higiene: PAT reproduce la medición de agosto y alimenta el QEX-1.0.
// Esto decide SÓLO qué se sondea primero y la nota.
// Calza como segmento DNS o como prefijo/sufijo con guion (openfinance-desa, api-desarrollo,
// rygo-development), con dígitos opcionales (dev2, qa1). Precisión antes que cobertura: «cert» sola
// no cuenta (choca con certificados.*) ni «pre» sola (choca con preferencias.*); «pre» sólo cuenta
// como segmento exacto, por la regla de agosto (PAT.no_productivo), que esto no cambia.
export const SENAL_PRUEBA = /(^|[.-])(desa|desarrollo|development|dev|test|testing|qa|uat|stg|stage|staging|homolog|homologacion|hml|certificacion|prueba|pruebas|preprod|sandbox|demo)(\d*)([.-]|$)/;
// Una sola definición de «este nombre es un ambiente de pruebas»: la usan qué se sondea, la nota y la
// página. Suma la clase de agosto (dev, lab, pre…) y la señal de arriba.
export const esAmbientePruebas = (host) => {
  const h = String(host || "").toLowerCase();
  return PAT.no_productivo.test(h) || SENAL_PRUEBA.test(h);
};

// Qué nombres se sondean, en este orden: PRIMERO los ambientes de pruebas (deciden la F, y con el tope
// de 15 no pueden quedar fuera por orden alfabético), luego los sensibles del registro, y (si se
// compara) los de la foto anterior y los nombres nuevos desde ella. Lo nuevo es justo lo que una
// comparación tiene que mirar.
export function nombresASondear(hosts, comparar = null) {
  const pruebas = hosts.filter((h) => esAmbientePruebas(h.host)).map((h) => h.host);
  const sensibles = [...new Set([...pruebas, ...hosts.filter((h) => h.clases.some((c) => CLASES_SENSIBLES.includes(c))).map((h) => h.host)])];
  const antesCT = new Set((comparar?.ct?.hosts || []).map((h) => h.host));
  const nuevosCT = antesCT.size ? hosts.map((h) => h.host).filter((h) => !antesCT.has(h)) : [];
  const todos = [...new Set([...sensibles, ...(comparar ? (comparar.endpoints || []).map((x) => x.host) : []), ...nuevosCT])];
  return { pruebas, sensibles, nuevosCT, todos, pedidos: todos.slice(0, MAX_SONDEADOS) };
}

// La respuesta de /api/ct (lib/ct-registro.mjs) → el `ct` que recibe armarFoto. La huella es del
// texto crudo recibido, no de lo que se reinterpretó.
// `fuentes` (16-nov-2026): qué fuentes del registro se unieron, cada una con su fecha; no entra a la foto.
export async function ctDesdeServidor(j, ms) {
  return { filas: JSON.parse(j.texto), sha256: await sha256Hex(j.texto), ms,
    fuente: j.desde_copia ? `${j.fuente}, copia del servidor` : j.fuente,
    consultado_utc: j.desde_copia ? j.consultado_utc : undefined, intentos: 1, fuentes: j.fuentes || null };
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
  // hibrido y medido_desde (13-nov-2026): el saludo B por nombre y desde dónde se saludó (worker o vps).
  // Sólo se agregan: una respuesta de sondas anterior, sin esos campos, deja null y "worker".
  const endpoints = s.endpoints.map((x) => ({ host: x.host, clases: clases.get(x.host) || clasesDe(x.host), dns_status: x.dns_status,
    ip: x.ip, cname: x.cname, responde_443: x.responde_443, detalle: x.detalle, medido_utc: x.medido_utc,
    hibrido: x.hibrido ?? null, http_status: x.http_status ?? null, http_consultado: x.http_consultado ?? null, medido_desde: x.medido_desde || "worker" }));
  const b = s.borde, v = b.veredicto, A = b.saludos.A_como_navegador;
  // TLS 1.3: el saludo A sólo ofrece 1.3. Respuesta de servidor = sí; alerta 70 (protocol_version) = no; corte = sin dato.
  const tls13 = A.grupo ? true : (A.alerta && /\/70$/.test(A.alerta)) ? false : null;
  const c = s.certificado;
  const ref = referencia.verticales[vertical];
  if (!ref) throw new Error(`sector desconocido: ${vertical}`);
  const sinTls13 = tls13 === false ? true : tls13 === true ? false : null;
  const dim = { certificados: certificadosValor(c), higiene: higiene(sinTls13, cuentas),
    hndl: ref.hndl, edge: edgeValor(v.soporta) };
  const q = qex(dim);
  // QEX-1.1 (16-nov-2026) viaja sólo en el detalle: NO entra a la foto (ni a su huella), ni a la página,
  // ni al PDF. La cifra que se publica sigue siendo `q` (QEX-1.0).
  const q11 = qex11({ dim10: dim, sinTls13, ct: !!ct, endpoints, hosts, cuentas });
  const tipos = { certificados: "medido", higiene: ct ? "medido" : "medido, sin superficie", hndl: "modelo de sector", edge: "medido" };
  const corta = (iso) => (iso ? iso.slice(0, 10) : null);
  const foto = {
    esquema: ESQUEMA_FOTO, edicion: medido.slice(0, 7), dominio, www, vertical, medido_utc: medido, origen,
    ct: ct ? { fuente: ct.fuente, intentos: ct.intentos ?? null, consultado_utc: ct.consultado_utc || medido, filas: ct.filas.length, sha256_crudo: ct.sha256, conteos: cuentas, hosts } : null,
    endpoints,
    borde: { cdn: b.dns.cdn, cadena: b.dns.cadena, soporta: v.soporta, elige: v.elige, pide_mejora: v.pide_mejora, sha256_medicion: b.sha256,
      medido_desde: b.medido_desde || "worker" },
    // Qué pasó con la sonda del VPS (lib/sonda-tls-vps.mjs): no_hizo_falta, inactiva, sin_respuesta o hecho.
    vps: s.vps ? { estado: s.vps.estado, causa: s.vps.causa ?? null, desde_ip: s.vps.desde_ip ?? null } : null,
    tls13,
    certificado: c.ok ? { ok: true, algoritmo: c.algoritmo, curva: c.curva, bits: c.bits, firma: c.firma, emisor: c.emisor, sujeto: c.sujeto,
      not_before: corta(c.not_before), not_after: corta(c.not_after), medido_desde: c.medido_desde || "worker" } : { ok: false, error: c.error, medido_desde: c.medido_desde || "worker" },
    proveedores: { correo: s.correo.proveedor, mx: s.correo.mx, security_txt: s.security_txt.publicado },
    qex: { ...q, tipos },
    referencia: { edicion: referencia.edicion, mediana_pais: referencia.mediana_pais, mediana_sector: ref.mediana, n_sector: ref.n },
    instrumentos: { pagina: "qex-nucleo.mjs", servidor: s.instrumento },
  };
  return { foto, detalle: { cuentas, hosts, endpoints, tls13, dim, q, tipos, ref, q11 } };
}

// ---------------------------------------------------------------- QEX-1.1: la higiene se mueve (16-nov-2026)
// EL DEFECTO. En QEX-1.0 la higiene descuenta por los nombres ACUMULADOS en el registro público de
// certificados: un certificado viejo para staging.<dominio> queda ahí para siempre. Si la organización
// apaga sus ambientes de prueba, su higiene no sube: nada de lo que haga la mueve.
//
// QEX-1.1 cambia SÓLO de qué conteos se alimenta la regla de higiene. La regla (higiene(): base 70,
// −30 sin TLS 1.3, −10 por ambiente no productivo, −10 por legado, −10 con 3 o más de infraestructura
// sensible), los pesos 40/25/25/10 y el tope son los mismos. Las clases son las de PAT (agosto), con UNA
// excepción, abajo: el ambiente de pruebas se reconoce con la señal de la nota.
// En 1.1 un nombre cuenta sólo si existe y responde HOY: se sondeó, su DNS está vigente y contesta en
// 443. La sonda sólo saluda si el DNS dio direcciones (sondaEndpoint), así que «responde» ya implica
// «DNS vigente». Cada nombre del registro con clase que castiga queda en uno de estos estados:
//   vivo         sondeado y responde en 443                       → cuenta
//   no_vigente   sondeado; DNS NXDOMAIN o sin direcciones         → no cuenta
//   sin_443      sondeado; DNS vigente, sin respuesta TLS en 443   → no cuenta. OJO: incluye el saludo que
//                el Worker no pudo completar y la sonda del VPS tampoco (o no estaba): ahí no se sabe
//                si hay servicio. No castigar es la lectura de precisión; el número se informa.
//   sin_dato     sondeado; el DNS no contestó                      → no cuenta (null es «no medido»)
//   sin_sondear  quedó fuera del tope de MAX_SONDEADOS             → NO castiga, y se informa cuántos.
//                No se sabe si vive o no: precisión antes que cobertura.
// Los conteos del registro (los que usa 1.0) viajan como dato informativo: `historico`.
// AMBIENTE DE PRUEBAS (corrección del 16-nov-2026). En 1.1 un nombre es «no productivo» si lo dice
// esAmbientePruebas (la señal de QREADY-NOTA-2, que ya incluye la clase de agosto): desa, desarrollo,
// homologacion, hml… EL DEFECTO: con la clase de agosto sola, openfinance-desa.<banco>.cl respondía 403
// desde internet, la nota lo veía y la higiene 1.1 quedaba en 70. Índice y nota no pueden contradecirse
// en una versión nueva. Un ambiente de pruebas que responde descuenta aunque responda 403: en el índice,
// «publicado» es superficie (en la nota, 403 baja la gravedad; en la higiene, no). QEX-1.0 y PAT no
// cambian: `historico` y la higiene 1.0 siguen con las clases de agosto.
// Consecuencia: 1.1 sube cuando lo apagado deja de contar, y puede BAJAR respecto de 1.0 cuando hay un
// ambiente de pruebas vivo que PAT no reconocía.
// Sin registro (ct null) la higiene es la misma de 1.0: sólo TLS.
// scripts/check-qex-11.mjs: grito, silencio y mutaciones.
export const VERSION_QEX_11 = "QEX-1.1";

export function estadoVivo(e) {
  if (!e) return "sin_sondear";
  if (e.responde_443 === true) return "vivo";
  if (e.dns_status === "NXDOMAIN") return "no_vigente";
  if (e.dns_status == null) return "sin_dato";
  if (e.responde_443 === false) return "sin_443";
  return "no_vigente";                                // DNS contestó sin direcciones: no se saludó
}

// Las clases que descuentan higiene en 1.1: las de PAT, y «no_productivo» también si esAmbientePruebas lo
// dice. Una sola definición: candidatos y conteos la leen igual. SÓLO la usa 1.1.
export const clasesQueCastigan = (host) => {
  const k = clasesDe(host).filter((c) => CLASES_SENSIBLES.includes(c));
  if (esAmbientePruebas(host) && !k.includes("no_productivo")) k.push("no_productivo");
  return k;
};

// endpoints: los que devolvió la sonda. hosts: los del registro (hostsCT). Devuelve los conteos por
// clase de los nombres VIVOS (la forma de conteos(), para que higiene() los lea igual) y cuántos nombres
// con clase que castiga cayeron en cada estado.
export function superficieViva(endpoints, hosts) {
  const porHost = new Map((endpoints || []).map((e) => [e.host, e]));
  const candidatos = (hosts || []).map((h) => h.host).filter((h) => clasesQueCastigan(h).length > 0);
  const estados = { vivo: 0, no_vigente: 0, sin_443: 0, sin_dato: 0, sin_sondear: 0 };
  const conteosVivos = { no_productivo: 0, legado: 0, infra_expuesta: 0 };
  const sinSondear = { no_productivo: 0, legado: 0, infra_expuesta: 0 };
  for (const h of candidatos) {
    const est = estadoVivo(porHost.get(h));
    estados[est]++;
    for (const k of clasesQueCastigan(h)) {
      if (est === "vivo") conteosVivos[k]++;
      if (est === "sin_sondear") sinSondear[k]++;
    }
  }
  return { conteos: conteosVivos, nombres: candidatos.length, ...estados, sin_sondear_por_clase: sinSondear };
}

// El QEX-1.1 de una medición. dim10: las dimensiones de 1.0 (certificados, hndl y edge no cambian).
export function qex11({ dim10, sinTls13, ct, endpoints, hosts, cuentas = null }) {
  const viva = ct ? superficieViva(endpoints, hosts) : null;
  const dim = { ...dim10, higiene: higiene(sinTls13, viva ? viva.conteos : null) };
  const historico = cuentas ? { no_productivo: cuentas.no_productivo, legado: cuentas.legado, infra_expuesta: cuentas.infra_expuesta } : null;
  return { ...qex(dim, VERSION_QEX_11), superficie: viva, historico };
}

// ---------------------------------------------------------------- etiquetas en inglés (12-nov-2026)
// Sólo se AGREGA: la página /q-ready/medicion las usa para pintar. Nada de lo de arriba cambia,
// ni la foto, ni el cálculo, ni lo que lee el PDF (que sigue en español).
export const ETIQUETA_DIM_EN = { certificados: "Certificates and PKI", higiene: "Surface hygiene", hndl: "HNDL posture", edge: "PQC at the edge" };
export const ETIQUETA_CT_EN = { hostnames: "Names in the public log", profundos: "Names three or more levels deep",
  no_productivo: "Non-production environments", legado: "Legacy names", infra_expuesta: "Sensitive infrastructure", critico: "Critical services" };
// Etiqueta de cada ítem de comparar(), por su clave `k` (la clave no cambia; la etiqueta sí).
export const ETIQUETA_ITEM_EN = { score: "QEX", ...ETIQUETA_DIM_EN, ...ETIQUETA_CT_EN,
  cdn: "Who serves the edge", soporta: "Supports X25519MLKEM768", elige: "Chooses it when free to choose", tls13: "TLS 1.3",
  algoritmo: "Certificate algorithm", emisor: "Issuer", vence: "Expires", correo: "Email provider (MX)",
  security_txt: "Security reporting channel (security.txt)" };
// Valores que comparar() redacta en español (sí/no/publicado) y lo que redacta estadoEndpoint().
export const VALOR_EN = { "sí": "yes", "no": "no", "publicado": "published", "no publicado": "not published",
  "presente en el registro público": "present in the public log", "ya no publicado en DNS": "no longer published in DNS",
  "responde en el puerto 443": "responds on port 443",
  "publicado en DNS, sin servicio web: es lo normal en un servidor de correo": "published in DNS, no web service: normal for a mail server",
  "publicado en DNS, no responde en 443": "published in DNS, does not respond on 443", "sin medición": "not measured",
  "aún no estaba en el registro público": "not yet in the public log", "otro": "other", "sin CNAME": "no CNAME" };
export const estadoEndpointEn = (e) => { const t = estadoEndpoint(e); return t == null ? null : VALOR_EN[t] ?? t; };

// ---------------------------------------------------------------- la nota Q-Ready Verified (13-nov-2026)
// Una letra A+…F a partir de la foto rosetta-qex-foto/1 que el escáner YA produce. No mide nada:
// lee la foto. Una sola definición; la usan la página (medicion-envivo.mjs), el servidor
// (lib/medicion-agentes.mjs), el cron de los dominios verificados, el sello y la herramienta MCP.
// scripts/check-qready-nota.mjs grita si alguno de ellos escribe su propia regla.
//
// Los umbrales son la PROPUESTA INICIAL del encargo (13-nov). Cambiarlos es decisión del dueño:
// se proponen, no se tocan en silencio.
//
// LA ESCALA (qué letra y cuándo) está escrita UNA vez, en datos: ESCALA_NOTA y ALERTAS_NOTA, al final
// de este bloque. Es la que publican la ficha, la rúbrica y las páginas; nadie la reescribe en prosa
// (18-nov-2026: este comentario decía que la letra D era sólo para sitios con TLS 1.2 o anterior, y no
// es la regla: también da D un sitio CON TLS 1.3, sin candado nuevo y con una alerta alta abierta).
// scripts/check-rubrica-qex.mjs exige que ESCALA_NOTA dé la MISMA letra que explicarNota sobre todas las
// combinaciones de hechos, y scripts/check-escala-nota.mjs grita si una superficie publica otra escala.
// Desde afuera el máximo es A: A+ pide /.well-known/q-ready firmado y vigente e inventario interno
// verificado por Rosetta, que no se ven desde afuera. null es «no medido», nunca «no protegido».
// Los certificados post-cuánticos llegan en 2027: hoy no se castiga no tenerlos.
// QREADY-NOTA-2 (16-nov-2026): cambia resultados, por eso sube la versión. Los ambientes de pruebas
// (esAmbientePruebas, arriba) entran al sondeo con prioridad, y la señal suma desarrollo, development,
// certificacion, homologacion, testing, preprod y demo. Con la NOTA-1, openfinance-desa.<banco>.cl no se
// sondeaba nunca y el banco salía A con un ambiente de pruebas respondiendo; con la NOTA-2 sale F.
// Además el registro une crt.sh y Cert Spotter (lib/ct-registro.mjs) en vez de elegir uno.
// QREADY-NOTA-2.1 (16-nov-2026, PENDIENTE DE APROBACIÓN DEL DUEÑO). EL DEFECTO (B1): yutrack.com salió A
// con «Certificados y PKI» (40 % del índice) en null, porque el servidor no aceptó el saludo TLS 1.2 con
// que se leía el certificado; el QEX se renormalizó a peso 0,6 y no_evaluado vino vacío. Regla nueva:
// si falta una dimensión de peso ≥ 0,25 (NOTA_DIMENSION_MINIMA), la nota no puede ser A (máximo B), y
// la dimensión va en no_evaluado y en falta_para_A. null sigue siendo «no medido», nunca «no protegido».
export const VERSION_NOTA = "QREADY-NOTA-2.1";
export const NOTA_DIMENSION_MINIMA = 0.25;
export const NOTAS = ["A+", "A", "B", "C", "D", "F"];
// Ambiente de pruebas que responde: ¿abierto o bloqueado? (16-nov-2026, decisión del dueño, dentro de la
// NOTA-2). Sólo un 403 en la raíz es «publicado con el acceso bloqueado» (alerta media, no F). 2xx, 3xx
// y 401 (pide clave: está expuesto) son abiertos → F. Precisión antes que cobertura: SIN código HTTP
// (foto anterior, o la sonda no lo obtuvo) se lee como hasta hoy, abierto → F; y cualquier otro código
// (404, 5xx…) también, porque el servidor está ahí sirviendo. La excepción es estrecha a propósito.
export const pruebasBloqueado = (e) => !!e && e.http_status === 403;
// Techo de B (decisión del dueño, 16-nov: «alerta media, nota B»). SÓLO esta alerta media lo pone: un
// ambiente de pruebas publicado, aunque bloqueado, no es una A. Las demás medias (certificado sin plan,
// legado, correo en 443) siguen sin bajar la letra; si no, rosettaquantum.com perdería su A.
// (17-nov-2026, decisión del dueño) El GET a la raíz sólo se hace con el dueño verificado. Sin él,
// `http_consultado` es false y un ambiente de pruebas que completa el saludo TLS es «publicado» (media,
// techo B): no se sabe si está abierto o bloqueado, y no se pregunta. Una foto anterior sin el campo
// (null) se lee como hasta ahora.
export const pruebasSinConsultar = (e) => !!e && e.http_consultado === false;
export const MEDIAS_CON_TECHO_B = ["ambiente_pruebas_publicado_bloqueado", "ambiente_pruebas_publicado"];
const HIBRIDO = "X25519MLKEM768";

// Un nombre que respondió: ¿tiene el candado nuevo? Desde el 13-nov la sonda le manda también el saludo
// B (sólo el híbrido, llave vacía): `hibrido` true/false es la respuesta de B, la misma regla del borde.
// Una foto anterior no trae `hibrido`: entonces sólo cuenta como evidencia que el saludo A haya
// elegido el híbrido; si eligió x25519 no se sabe (es lo correcto en TLS) y es «sin evidencia».
export function hibridoEnEndpoint(e) {
  if (!e || e.responde_443 !== true) return null;
  if (typeof e.hibrido === "boolean") return e.hibrido;
  return new RegExp(`grupo ${HIBRIDO}\\b`).test(String(e.detalle || "")) ? true : null;
}

export function explicarNota(foto, extras = {}) {
  const out = { version: VERSION_NOTA, nota: null, graves: [], altas: [], medias: [], no_evaluado: [], falta_para_A: [], hechos: {} };
  if (!foto || foto.esquema !== ESQUEMA_FOTO) { out.motivo = "foto_invalida"; return out; }
  const dia = String(foto.medido_utc || "").slice(0, 10);
  const c = foto.certificado || {};
  const eps = Array.isArray(foto.endpoints) ? foto.endpoints : [];
  const responde = eps.filter((e) => e.responde_443 === true);
  const tiene = (e, k) => Array.isArray(e.clases) && e.clases.includes(k);

  if (c.ok && c.not_after && dia && c.not_after < dia) out.graves.push({ codigo: "certificado_vencido", detalle: c.not_after });
  for (const e of responde) if (tiene(e, "no_productivo") || esAmbientePruebas(e.host)) {
    if (pruebasSinConsultar(e)) out.medias.push({ codigo: "ambiente_pruebas_publicado", host: e.host });
    else if (pruebasBloqueado(e)) out.medias.push({ codigo: "ambiente_pruebas_publicado_bloqueado", host: e.host, http_status: e.http_status });
    else out.graves.push({ codigo: "ambiente_pruebas_expuesto", host: e.host, http_status: e.http_status ?? null });
  }
  for (const e of responde) if (tiene(e, "infra_expuesta") && !esNombreDeCorreo(e.host)) out.altas.push({ codigo: "infraestructura_expuesta", host: e.host });
  if (c.ok && (c.algoritmo === "RSA" || c.algoritmo === "EC") && !extras.plan_con_fecha) out.medias.push({ codigo: "certificado_sin_plan" });
  for (const e of responde) if (tiene(e, "legado")) out.medias.push({ codigo: "nombre_sin_dueno", host: e.host });
  for (const e of responde) if (tiene(e, "infra_expuesta") && esNombreDeCorreo(e.host)) out.medias.push({ codigo: "correo_responde_443", host: e.host });

  const techoB = out.medias.some((m) => MEDIAS_CON_TECHO_B.includes(m.codigo));
  const principal = foto.borde ? foto.borde.soporta : null;           // true | false | null
  const tls13 = principal === true ? true : foto.tls13;                // el híbrido sólo existe en TLS 1.3
  const sinEvidencia = responde.filter((e) => hibridoEnEndpoint(e) !== true).map((e) => e.host);
  const sensibles = foto.ct ? nombresASondear(foto.ct.hosts || []).todos : [];
  const sinSondear = foto.ct ? sensibles.filter((h) => !eps.some((e) => e.host === h)) : null;
  out.hechos = { principal_hibrido: principal, tls13, nombres_que_responden: responde.length, sin_evidencia_hibrido: sinEvidencia,
    superficie: !!foto.ct, sensibles_sin_sondear: sinSondear };

  if (out.graves.length) { out.nota = "F"; }
  else if (tls13 === false) out.nota = "D";
  else if (principal == null || tls13 == null) { out.nota = null; out.motivo = "borde_no_medido"; }
  else if (principal === false) out.nota = out.altas.length ? "D" : "C";
  else if (out.altas.length) out.nota = "C";
  else if (foto.ct && sinSondear.length === 0 && sinEvidencia.length === 0 && !techoB) out.nota = "A";
  else out.nota = "B";

  // QREADY-NOTA-2.1: una dimensión pesada sin medir no deja dar A (ver VERSION_NOTA)
  const dimsQ = (foto.qex && foto.qex.dimensiones) || {};
  const sinDim = Object.keys(PESOS).filter((k) => PESOS[k] >= NOTA_DIMENSION_MINIMA && dimsQ[k] == null);
  for (const k of sinDim) out.no_evaluado.push({ dimension: k, peso: PESOS[k] });
  if (out.nota === "A" && sinDim.length) out.nota = "B";

  if (out.nota === "A" && extras.well_known_valido === true && extras.inventario_verificado === true) out.nota = "A+";

  // Qué le falta para A. Se dice en códigos; el texto lo pone quien pinta (public/js/qready-textos.mjs).
  if (out.nota !== "A" && out.nota !== "A+") {
    for (const g of out.graves) out.falta_para_A.push({ codigo: "resolver_" + g.codigo, host: g.host, detalle: g.detalle });
    if (tls13 === false) out.falta_para_A.push({ codigo: "activar_tls13" });
    if (principal == null && tls13 !== false) out.falta_para_A.push({ codigo: "medir_borde" });
    if (principal === false) out.falta_para_A.push({ codigo: "hibrido_en_principal" });
    for (const a of out.altas) out.falta_para_A.push({ codigo: "cerrar_" + a.codigo, host: a.host });
    if (principal === true) {
      for (const m of out.medias) if (MEDIAS_CON_TECHO_B.includes(m.codigo)) out.falta_para_A.push({ codigo: "resolver_ambiente_pruebas_expuesto", host: m.host });
      for (const h of sinEvidencia) out.falta_para_A.push({ codigo: "hibrido_en_nombre", host: h });
      if (!foto.ct) out.falta_para_A.push({ codigo: "superficie_no_disponible" });
      else for (const h of sinSondear) out.falta_para_A.push({ codigo: "nombre_sin_sondear", host: h });
    }
    for (const k of sinDim) out.falta_para_A.push({ codigo: "dimension_sin_medir", detalle: k });
  }
  return out;
}

export const notaQEX = (foto, extras = {}) => explicarNota(foto, extras).nota;

// ---------------------------------------------------------------- la escala de la nota, en datos (18-nov-2026)
// Encargo del 18-nov, opción (b) del dueño: la escala publicada dice la regla REAL, con las
// reglas de la C y de la D aprobadas el 16-nov (las cuatro entradas del medio, abajo).
// ESCALA_NOTA se lee en orden y la primera que aplica decide, sobre los hechos que explicarNota ya devuelve
// (hechosDeNota). NO decide la nota en producción: la decide explicarNota. Es la descripción publicada, y
// scripts/check-rubrica-qex.mjs exige que las dos den la misma letra en todas las combinaciones.
// `desde`: la versión de la nota en que entró la regla (git: QREADY-NOTA-0 y -1 del 13-nov, -2 y -2.1 del
// 16-nov). El texto que lee una persona vive en public/js/rubrica-textos.mjs (PROVISORIO).
export const VERSIONES_NOTA = Object.freeze({
  "QREADY-NOTA-0": "2026-11-13", "QREADY-NOTA-1": "2026-11-13", "QREADY-NOTA-2": "2026-11-16", "QREADY-NOTA-2.1": "2026-11-16",
});
// Las alertas que emite explicarNota, con su nivel. `techo_b`: la media que no deja dar A (MEDIAS_CON_TECHO_B).
export const ALERTAS_NOTA = Object.freeze([
  { codigo: "certificado_vencido", nivel: "grave", desde: "QREADY-NOTA-0" },
  { codigo: "ambiente_pruebas_expuesto", nivel: "grave", desde: "QREADY-NOTA-0" },
  { codigo: "infraestructura_expuesta", nivel: "alta", desde: "QREADY-NOTA-0" },
  { codigo: "ambiente_pruebas_publicado_bloqueado", nivel: "media", techo_b: true, desde: "QREADY-NOTA-2" },
  // agregada el 17-nov (main 7786413) sin subir la versión de la nota: se declara así, no se corrige la historia
  { codigo: "ambiente_pruebas_publicado", nivel: "media", techo_b: true, desde: "QREADY-NOTA-2 (17-nov, sin cambio de versión)" },
  { codigo: "certificado_sin_plan", nivel: "media", desde: "QREADY-NOTA-0" },
  { codigo: "nombre_sin_dueno", nivel: "media", desde: "QREADY-NOTA-0" },
  { codigo: "correo_responde_443", nivel: "media", desde: "QREADY-NOTA-0" },
]);
// Las condiciones de A, una por una (todas a la vez). La de la dimensión usa NOTA_DIMENSION_MINIMA.
export const CONDICIONES_A = Object.freeze([
  { codigo: "candado_principal", desde: "QREADY-NOTA-0", si: (h) => h.principal === true },
  { codigo: "sin_graves_ni_altas", desde: "QREADY-NOTA-0", si: (h) => h.graves === 0 && h.altas === 0 },
  { codigo: "superficie", desde: "QREADY-NOTA-0", si: (h) => h.superficie === true },
  { codigo: "sensibles_sondeados", desde: "QREADY-NOTA-0", si: (h) => h.sin_sondear === 0 },
  { codigo: "candado_en_todos", desde: "QREADY-NOTA-1", si: (h) => h.sin_evidencia === 0 },
  { codigo: "sin_ambiente_publicado", desde: "QREADY-NOTA-2", si: (h) => !h.techo_b },
  { codigo: "dimensiones_medidas", desde: "QREADY-NOTA-2.1", si: (h) => h.dimension_sin_medir === 0 },
]);
const esA = (h) => CONDICIONES_A.every((c) => c.si(h));
export const ESCALA_NOTA = Object.freeze([
  { regla: "grave", nota: "F", desde: "QREADY-NOTA-0", si: (h) => h.graves > 0 },
  { regla: "sin_tls13", nota: "D", desde: "QREADY-NOTA-0", si: (h) => h.tls13 === false },
  { regla: "borde_no_medido", nota: null, desde: "QREADY-NOTA-0", si: (h) => h.principal == null || h.tls13 == null },
  { regla: "sin_candado_con_alta", nota: "D", desde: "QREADY-NOTA-0", si: (h) => h.principal === false && h.altas > 0 },
  { regla: "sin_candado", nota: "C", desde: "QREADY-NOTA-0", si: (h) => h.principal === false },
  { regla: "candado_con_alta", nota: "C", desde: "QREADY-NOTA-0", si: (h) => h.altas > 0 },
  { regla: "a_mas", nota: "A+", desde: "QREADY-NOTA-0", si: (h) => esA(h) && h.well_known && h.inventario },
  { regla: "a", nota: "A", desde: "QREADY-NOTA-0", si: esA },
  { regla: "b", nota: "B", desde: "QREADY-NOTA-0", si: () => true },
]);
// Los hechos que mira la escala, leídos del resultado de explicarNota (x) y de los extras que recibió.
export function hechosDeNota(x, extras = {}) {
  const h = (x && x.hechos) || {};
  return { graves: (x?.graves || []).length, altas: (x?.altas || []).length, principal: h.principal_hibrido ?? null, tls13: h.tls13 ?? null,
    superficie: h.superficie === true, sin_sondear: (h.sensibles_sin_sondear || []).length, sin_evidencia: (h.sin_evidencia_hibrido || []).length,
    techo_b: (x?.medias || []).some((m) => MEDIAS_CON_TECHO_B.includes(m.codigo)), dimension_sin_medir: (x?.no_evaluado || []).length,
    well_known: extras.well_known_valido === true, inventario: extras.inventario_verificado === true };
}
// La letra según la escala publicada (y qué regla de la escala la dio).
export function notaPorEscala(x, extras = {}) {
  const h = hechosDeNota(x, extras);
  const r = ESCALA_NOTA.find((e) => e.si(h));
  return { nota: r.nota, regla: r.regla, hechos: h };
}
