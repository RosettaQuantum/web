/*
 * rosetta-ficha/1 (16-nov-2026): cómo se le muestra a una persona una medición de seguridad
 * post-cuántica. Siempre las mismas 7 secciones, en el mismo orden, con los mismos IDs y la misma
 * sintaxis, la imprima un agente, la API o (más adelante) la página. Encargo del dueño del 13-nov.
 *
 * UNA SOLA DEFINICIÓN. La ficha se arma AQUÍ, desde la foto rosetta-qex-foto/1 que ya producen la
 * página, el servidor y el cron (qex-nucleo.mjs → armarFoto). No mide nada y no recalcula el QEX:
 * lo lee de la foto. La nota sale de N.explicarNota (la misma de la página, del sello y del MCP).
 * La usan lib/medicion-agentes.mjs (POST /v1/medicion y medir_exposicion_pqc) y
 * lib/qready-verificado.mjs (get_qready_grade). Funciones puras: corre en node, en el Worker y en el
 * navegador. scripts/check-ficha.mjs fija el markdown canónico con tres fotos y grita si cambia.
 *
 * Y TAMBIÉN AQUÍ, porque la ficha y el JSON tienen que decir lo mismo, los tres ajustes del encargo:
 *   1. qué falta para A son ACCIONES sobre hallazgos medidos, cada una con la nota a la que sube;
 *      lo que no se midió va aparte (noMedido). No medir algo no es una falla.
 *   2. la comparación con el sector sólo dentro del país de la referencia (hoy CL), deducido del TLD;
 *   3. los nombres de terceros se enmascaran si el dominio no está verificado por su dueño.
 *
 * El texto que lee una persona vive en qready-textos.mjs (FICHA), provisorio hasta que lo apruebe el
 * dueño. Aquí sólo hay estructura.
 */
import * as N from "./qex-nucleo.mjs";
import { textos, textosFicha } from "./qready-textos.mjs";

export const PROTOCOLO = "rosetta-ficha/1";
export const SITE = "https://rosettaquantum.com";
export const SPEC = `${SITE}/protocolo/ficha`;
// El índice de referencia (public/data/qex-referencia-2026-08.json) es de organizaciones chilenas.
export const PAIS_REFERENCIA = "CL";

// ---------------------------------------------------------------- el protocolo, en datos
// IDs estables: no se reutilizan nunca. RQ.S = seguridad; RQ.L queda reservado para el laboratorio.
// El ID nombra el CONCEPTO; cada valor declara además su versión de método (`metodo`), así el día que
// entre QEX-1.1 el mismo ID no tiene dos definiciones sin decirlo.
// CATALOGO = lo que imprimen las tablas de la ficha, en orden. RQ.S.13 (nombres en el registro público,
// NO afirma que respondan) va en el bloque estructurado y en la spec; RQ.S.10-12 están RESERVADOS
// (inventario, proveedores, gobierno) y no se usan.
export const CATALOGO = ["RQ.S.00", "RQ.S.01", "RQ.S.02", "RQ.S.03", "RQ.S.04", "RQ.S.05", "RQ.S.06", "RQ.S.07", "RQ.S.08", "RQ.S.09"];
export const CATALOGO_COMPLETO = [...CATALOGO, "RQ.S.13"];
export const RESERVADOS = ["RQ.S.10", "RQ.S.11", "RQ.S.12"];
export const SECCIONES = ["veredicto", "indicadores", "alertas", "que_hacer", "no_medido", "evidencia", "limites"];
export const TIPOS = ["medido", "modelo", "no medido"];
// Cuatro niveles, en este orden (decisión del 16-nov: ALTA entra al protocolo). En inglés se imprimen
// SERIOUS, HIGH, MEDIUM e INFO; en `secciones` va siempre el código.
export const NIVELES = ["GRAVE", "ALTA", "MEDIA", "INFO"];
// Las alertas de la nota (QREADY-NOTA-2) → nivel de la ficha, uno a uno. INFO no lo emite la NOTA-2.
const NIVEL_DE = { grave: "GRAVE", alta: "ALTA", media: "MEDIA" };
const DIM = { "RQ.S.02": "certificados", "RQ.S.03": "higiene", "RQ.S.04": "hndl", "RQ.S.05": "edge" };
const RANGO = { "A+": 0, A: 1, B: 2, C: 3, D: 4, F: 5 };

// ---------------------------------------------------------------- ajuste 2 · el país del dominio
// Sólo del TLD: .cl → CL. Un TLD de dos letras que se usa como genérico (.io, .ai…) no dice país, y
// un .com tampoco: en los dos casos no se compara, y se dice. Precisión antes que cobertura.
const CC_GENERICOS = new Set(["io", "ai", "co", "me", "tv", "fm", "gg", "sh", "to", "ws", "cc", "ly", "so", "la", "ac", "app", "eu"]);
export function paisDeDominio(dominio) {
  const tld = String(dominio || "").toLowerCase().split(".").pop();
  if (!/^[a-z]{2}$/.test(tld) || CC_GENERICOS.has(tld)) return null;
  return tld === "uk" ? "GB" : tld.toUpperCase();
}
export const tldDe = (dominio) => String(dominio || "").toLowerCase().split(".").pop();
export function nombrePais(codigo, idioma = "es") {
  if (!codigo) return null;
  try { return new Intl.DisplayNames([idioma === "en" ? "en" : "es"], { type: "region" }).of(codigo) || codigo; } catch { return codigo; }
}
// La comparación con el sector: sólo si el dominio es del país de la referencia.
export function comparacion(dominio, score, medianaSector) {
  const pais = paisDeDominio(dominio);
  const compara = pais === PAIS_REFERENCIA && score != null && medianaSector != null;
  return { pais, pais_referencia: PAIS_REFERENCIA, compara, diferencia: compara ? N.redondearPar(score - medianaSector) : null };
}
export function notaSector(dominio, idioma = "es") {
  const F = textosFicha(idioma), pais = paisDeDominio(dominio);
  if (pais === PAIS_REFERENCIA) return null;
  return pais ? F.sector_nota_otro_pais(nombrePais(pais, idioma)) : F.sector_nota_sin_pais(tldDe(dominio));
}

// ---------------------------------------------------------------- ajuste 3 · enmascarar nombres
// Regla del encargo (la del deck), con el ajuste del 16-nov: se muestra SÓLO el primer label, hasta el
// 2º carácter del segmento que delata el ambiente si ese segmento está en el primer label; si no hay
// segmento, o está más adentro, hasta la mitad del primer label. Lo demás del subdominio se tapa.
// El dominio registrable se muestra completo.
//   biometrics-dev.x.com.py → biometrics-d•••.x.com.py ; apigw-legacy.x → apigw-l•••.x
//   checks-cdn.ind-dev.x → check•••.x (antes del 16-nov salía checks-cdn.ind-d•••: dejaba ver el resto)
// «Delata el ambiente» = la señal de pruebas o una clase sensible de PAT (pruebas, legado,
// infraestructura): las mismas definiciones de qex-nucleo, sin copia propia.
export const MASCARA = "•••";
const DELATA = [N.SENAL_PRUEBA, N.PAT.no_productivo, N.PAT.legado, N.PAT.infra_expuesta];
export function enmascarar(host, dominio) {
  const h = String(host || "").toLowerCase(), d = String(dominio || "").toLowerCase();
  if (!h || h === d || h === "www." + d) return h;
  const sufijo = d && h.endsWith("." + d) ? "." + d : "";
  const sub = sufijo ? h.slice(0, -sufijo.length) : h;
  let corte = null;
  for (const rx of DELATA) {
    const m = rx.exec(sub);
    if (m) { const ini = m.index + m[1].length; if (corte == null || ini < corte) corte = ini; }
  }
  const primero = sub.split(".")[0];
  const deja = corte != null && corte < primero.length ? corte + 1 : Math.max(1, Math.floor(primero.length / 2));
  return primero.slice(0, deja) + MASCARA + sufijo;
}
// Nombres distintos que quedan iguales al enmascararlos (all-dev, all-dev2…) se distinguen con un sufijo
// corto y estable: «#» y los primeros caracteres hex del FNV-1a de 32 bits del nombre completo (2, o más
// sólo si dos del mismo grupo empatan). all-d•••#3f.x.com.py. No revela el nombre; sí deja contarlos.
export function huellaCorta(h) {
  let x = 0x811c9dc5;
  for (const ch of String(h).toLowerCase()) { x ^= ch.codePointAt(0); x = Math.imul(x, 0x01000193) >>> 0; }
  return x.toString(16).padStart(8, "0");
}
// verificado = el dueño verificó el dominio por DNS (qready_dominios, entorno producción): nombres completos.
// `hosts` = todos los nombres que pueden aparecer juntos (para saber cuáles chocan).
export function nombrador(dominio, verificado, hosts = []) {
  if (verificado) return (h) => (h == null ? h : String(h));
  const grupos = new Map();
  for (const h of new Set(hosts.filter(Boolean).map((y) => String(y).toLowerCase()))) {
    const m = enmascarar(h, dominio);
    if (m === h) continue;
    if (!grupos.has(m)) grupos.set(m, []);
    grupos.get(m).push(h);
  }
  const mapa = new Map();
  for (const [m, hs] of grupos) {
    if (hs.length === 1) { mapa.set(hs[0], m); continue; }
    let n = 2, suf = [];
    for (; n <= 8; n++) { suf = hs.map((h) => huellaCorta(h).slice(0, n)); if (new Set(suf).size === hs.length) break; }
    hs.forEach((h, i) => mapa.set(h, m.replace(MASCARA, `${MASCARA}#${suf[i]}`)));
  }
  return (h) => (h == null ? h : mapa.get(String(h).toLowerCase()) ?? enmascarar(h, dominio));
}
// Los nombres de una foto: los del registro y los sondeados, todos juntos (la página usa los mismos).
export const nombradorDeFoto = (foto, verificado) => nombrador(foto.dominio, verificado,
  [...(foto.ct?.hosts || []).map((h) => h.host), ...(foto.endpoints || []).map((e) => e.host)]);
export const vistaHost = (dominio, verificado) => nombrador(dominio, verificado);
// Los endpoints con cada nombre escrito por `ver` (el nombrador): el host y, si lo repite, el CNAME.
export const enmascararEndpoints = (endpoints, ver) => endpoints.map((e) => ({ ...e, host: ver(e.host),
  cname: Array.isArray(e.cname) ? e.cname.map((c) => (e.host && String(c).toLowerCase().includes(e.host) ? String(c).toLowerCase().split(e.host).join(ver(e.host)) : c)) : e.cname }));

// /api/sondas CERRADO (17-nov-2026): a quien no es dueño verificado le devuelve cada nombre enmascarado
// y su posición `i` en la lista que pidió. La página pidió esos nombres (salen del registro público) y
// los vuelve a poner con reasociar(), así su foto, su huella, la comparación y el PDF siguen con los
// nombres completos que ella ya tenía. FALLA CERRADO: si la respuesta viene enmascarada y algún nombre
// no trae su posición, se lanza; una foto con nombres enmascarados daría otra nota sin avisar.
export function reasociar(endpoints, pedidos, enmascarados) {
  return (endpoints || []).map((e) => {
    if (!enmascarados) return e;
    if (!Number.isInteger(e.i) || typeof pedidos[e.i] !== "string") throw new Error("la respuesta de las sondas no trae la posición de un nombre");
    const { i, ...resto } = e;
    return { ...resto, host: pedidos[i] };
  });
}

// ---------------------------------------------------------------- ajuste 1 · alertas, acciones y no medido
const clon = (x) => JSON.parse(JSON.stringify(x));
const apagar = (f, hosts) => { for (const e of f.endpoints || []) if (hosts.includes(e.host)) e.responde_443 = false; };
// Las acciones, en orden de prioridad. Cada una sabe qué hallazgo resuelve y cómo se vería la foto
// resuelta; el efecto sobre la nota se CALCULA con N.explicarNota sobre esa foto, no se escribe.
// Efecto acumulado: «-> B» quiere decir que, resueltas ésta y las anteriores, la nota sería B.
const PASOS = [
  { codigo: "renovar_certificado", alerta: "certificado_vencido", arreglar: (f) => { f.certificado.not_after = "9999-12-31"; } },
  { codigo: "sacar_ambientes_pruebas", alerta: "ambiente_pruebas_expuesto", arreglar: apagar },
  { codigo: "activar_tls13", si: (x) => x.hechos.tls13 === false, resuelve: ["RQ.S.05"], arreglar: (f) => { f.tls13 = true; } },
  { codigo: "hibrido_en_principal", si: (x) => x.hechos.principal_hibrido === false, resuelve: ["RQ.S.05"], arreglar: (f) => { f.borde.soporta = true; } },
  { codigo: "cerrar_infraestructura", alerta: "infraestructura_expuesta", arreglar: apagar },
  { codigo: "retirar_ambientes_bloqueados", alerta: "ambiente_pruebas_publicado_bloqueado", arreglar: apagar },
  // (17-nov, main 7786413) sin dueño verificado no se pide la raíz: el ambiente de pruebas que saluda es
  // «publicado» (media, techo B). La acción es la misma: sacarlo de internet.
  { codigo: "retirar_ambientes_publicados", alerta: "ambiente_pruebas_publicado", arreglar: apagar },
  { codigo: "baja_legado", alerta: "nombre_sin_dueno", arreglar: apagar },
  { codigo: "correo_fuera_de_443", alerta: "correo_responde_443", arreglar: apagar },
  // los nombres que SIGUEN respondiendo sin evidencia del candado nuevo, después de los pasos de arriba
  { codigo: "hibrido_en_nombres", hosts: (x) => (x.hechos.principal_hibrido === true ? x.hechos.sin_evidencia_hibrido : []), resuelve: ["RQ.S.09"],
    arreglar: (f, hosts) => { for (const e of f.endpoints || []) if (hosts.includes(e.host)) e.hibrido = true; } },
  { codigo: "plan_certificado_pq", alerta: "certificado_sin_plan", extras: { plan_con_fecha: true } },
];

const rango = (l) => (l == null ? 9 : RANGO[l]);

// x = N.explicarNota(foto, extras). Se recibe hecho para que quien llama decida la letra con la
// función compartida (y el guardia pueda mutar esa llamada). Devuelve hosts SIN enmascarar.
export function analizar(foto, x, extras = {}) {
  const alertas = [
    ...x.graves.map((a) => ({ ...a, nivel_nota: "grave" })),
    ...x.altas.map((a) => ({ ...a, nivel_nota: "alta" })),
    ...x.medias.map((a) => ({ ...a, nivel_nota: "media" })),
  ].map((a, i) => ({ id: `A${i + 1}`, nivel: NIVEL_DE[a.nivel_nota], ...a }));

  const acciones = [];
  const cur = clon(foto);
  let ex = { ...extras }, previa = x.nota;
  for (const p of PASOS) {
    const vivo = new Set((cur.endpoints || []).filter((e) => e.responde_443 === true).map((e) => e.host));
    let hosts = [], resuelve = p.resuelve || [];
    if (p.alerta) {
      const suyas = alertas.filter((a) => a.codigo === p.alerta && (a.host == null || vivo.has(a.host)));
      if (!suyas.length) continue;
      hosts = suyas.map((a) => a.host).filter((h) => h != null);
      resuelve = suyas.map((a) => a.id);
    } else if (p.hosts) {
      hosts = p.hosts(N.explicarNota(cur, ex)).filter((h) => vivo.has(h));
      if (!hosts.length) continue;
    } else if (!p.si(x)) continue;
    if (p.arreglar) p.arreglar(cur, hosts);
    if (p.extras) ex = { ...ex, ...p.extras };
    const nueva = N.explicarNota(cur, ex).nota;
    const sube = nueva != null && rango(nueva) < rango(previa);
    acciones.push({ codigo: p.codigo, n: hosts.length || 1, hosts, resuelve, sube_a: sube ? nueva : null, cambia_nota: true });
    if (nueva != null) previa = nueva;
  }
  const todos = foto.ct ? N.nombresASondear(foto.ct.hosts || []).todos : [];
  const sinSondear = x.hechos.sensibles_sin_sondear;
  return { alertas, acciones, sensibles_total: todos.length, sin_sondear: sinSondear };
}

// Acciones sobre indicadores que no mueven la letra (sólo la ficha las lista: «no cambia la nota»).
function accionesInformativas(foto, correo) {
  const out = [];
  if (foto.proveedores?.security_txt === false) out.push({ codigo: "publicar_security_txt", n: 1, hosts: [], resuelve: [], sube_a: null, cambia_nota: false });
  const c = correoMedido(correo);
  if (c && c.total > 0 && c.aceptan < c.total) out.push({ codigo: "correo_hibrido", n: 1, hosts: [], resuelve: ["RQ.S.06"], sube_a: null, cambia_nota: false });
  return out;
}

// El resultado del correo (lib/correo-envivo.mjs, estado «hecho») → cuántos MX aceptan el híbrido.
// Sólo cuentan los MX medidos (veredicto «medido» o «sin_starttls»); «rechazado» no es una medición.
export function correoMedido(correo) {
  if (!correo || correo.estado !== "hecho" || !Array.isArray(correo.resultado?.servidores)) return null;
  const medidos = correo.resultado.servidores.filter((s) => s.veredicto && ["medido", "sin_starttls"].includes(s.veredicto.estado));
  return { aceptan: medidos.filter((s) => s.veredicto.estado === "medido" && s.veredicto.soporta === true).length, total: medidos.length };
}

// Ajuste 1 en el JSON: falta_para_A y no_medido, con los nombres ya enmascarados si corresponde.
// Las acciones de falta_para_A son las de la ficha (mismo orden y mismos IDs H), sin las informativas.
export function notaParaJson(x, a, { dominio, verificado = false, fuentes_que_fallaron = [], idioma = "es", nom = null } = {}) {
  const F = textosFicha(idioma), ver = nom || vistaHost(dominio, verificado);
  const enA = x.nota === "A" || x.nota === "A+";
  return {
    alertas: a.alertas.map((al) => ({ id: al.id, nivel: al.nivel_nota, codigo: al.codigo, texto: textos(idioma).alerta[al.codigo] || al.codigo, host: ver(al.host ?? null) })),
    falta_para_A: enA ? [] : a.acciones.map((ac, i) => ({ id: `H${i + 1}`, codigo: ac.codigo, texto: F.accion[ac.codigo](ac.n),
      hosts: ac.hosts.map(ver), resuelve: ac.resuelve, sube_a: ac.sube_a })),
    no_medido: { nombres_fuera_del_tope: a.sin_sondear ? a.sin_sondear.length : null,
      ejemplos: (a.sin_sondear || []).slice(0, 5).map(ver), fuentes_que_fallaron },
  };
}

// ---------------------------------------------------------------- la lectura, por motivo (16-nov-2026)
// La lectura dice la causa REAL de la letra, sacada de lo mismo que la decide (N.explicarNota). A y A+
// y «sin nota» conservan el texto aprobado (ya dicen su causa). Texto NUEVO, provisorio: FICHA.lectura_*.
export function lecturaDe(x, foto, idioma = "es") {
  const F = textosFicha(idioma), T = textos(idioma), L = F.lectura_motivo;
  if (!x.nota) return T.nota_sin_motivo[x.motivo] || T.nota_sin;
  if (x.nota === "A" || x.nota === "A+") return T.nota_lectura[x.nota];
  const h = x.hechos || {}, cuenta = (arr, c) => arr.filter((a) => a.codigo === c).length;
  const causas = [];
  if (x.nota === "F") {
    if (cuenta(x.graves, "certificado_vencido")) causas.push(L.certificado_vencido());
    const n = cuenta(x.graves, "ambiente_pruebas_expuesto"); if (n) causas.push(L.pruebas_expuestas(n));
  } else if (h.tls13 === false) return L.sin_tls13;
  else {
    if (x.altas.length) causas.push(L.infraestructura(x.altas.length));
    if (h.principal_hibrido === true && x.nota === "B") {
      const n = x.medias.filter((m) => MEDIAS_TECHO.includes(m.codigo)).length; if (n) causas.push(L.pruebas_publicadas(n));
      // un ambiente de pruebas publicado ya está dicho arriba: no se cuenta dos veces como «sin evidencia»
      const conAlerta = new Set(x.medias.filter((m) => MEDIAS_TECHO.includes(m.codigo)).map((m) => m.host).filter(Boolean));
      const sinEv = (h.sin_evidencia_hibrido || []).filter((y) => !conAlerta.has(y)).length; if (sinEv) causas.push(L.sin_evidencia(sinEv));
      if (!foto.ct) causas.push(L.sin_superficie());
      else if (h.sensibles_sin_sondear?.length) causas.push(L.sin_sondear(h.sensibles_sin_sondear.length));
    }
    // QREADY-NOTA-2.1: la dimensión pesada que no se pudo medir es la causa de la B
    if (x.nota === "B") for (const nd of x.no_evaluado || []) if (nd && nd.dimension) causas.push(L.sin_dimension[nd.dimension] || nd.dimension);
  }
  const lista = causas.length < 2 ? causas.join("") : `${causas.slice(0, -1).join(", ")}${L.y}${causas[causas.length - 1]}`;
  if (h.principal_hibrido === true) return L.con_candado(lista || L.sin_causa());
  if (h.principal_hibrido === false) return lista ? L.sin_candado_y(lista) : L.sin_candado;
  return L.solo(lista || L.sin_causa());
}
const MEDIAS_TECHO = N.MEDIAS_CON_TECHO_B;

// ---------------------------------------------------------------- la ficha
const huella = (h) => (typeof h === "string" && h.length >= 12 ? `${h.slice(0, 8)}…${h.slice(-4)}` : null);
const sinMs = (iso) => String(iso || "").replace(/\.\d+Z$/, "Z");
const entero = (v) => (v == null ? null : N.redondearPar(v));
function rangos(ids) {
  // A1, A2, A3 → A1-A3 ; A3, A5 → A3 · A5 (como en la ficha aprobada). RQ.S.xx se listan tal cual.
  const nums = ids.map((i) => /^A(\d+)$/.exec(i)).filter(Boolean).map((m) => +m[1]);
  if (nums.length !== ids.length || !nums.length) return ids.join(" · ");
  const out = []; let ini = nums[0], fin = nums[0];
  for (const n of [...nums.slice(1), null]) {
    if (n === fin + 1) { fin = n; continue; }
    out.push(ini === fin ? `A${ini}` : `A${ini}-A${fin}`); ini = fin = n;
  }
  return out.join(" · ");
}


// ---------------------------------------------------------------- armarFicha: la ficha en datos
// La forma es la de la ficha aprobada (yu-track, 16-nov): encabezado, veredicto, indicadores POR ID
// (valor, unidad, texto, tipo), alertas A#, acciones H# (resuelve, efecto), no medido, evidencia,
// límites y pie. El markdown, el HTML de la página y el PDF salen de ESTE objeto; nadie lo rearma.
//
// contexto:
//   idioma            "es" | "en"
//   verificado        el dueño verificó el dominio por DNS → nombres completos
//   publico           además eligió publicar su nota → la ficha enlaza /verificado/<dominio>
//   correo            la respuesta de /api/sondas/correo/<id> ({estado, resultado}) o null
//   fuentes_que_fallaron  intentos fallidos del registro de certificados (lib/ct-registro.mjs)
//   extras            los de N.explicarNota (inventario_verificado, well_known_valido)
//   x                 N.explicarNota(foto, extras) ya calculado; si falta, se calcula aquí
export function armarFicha(foto, ctx = {}) {
  const idioma = ctx.idioma === "en" ? "en" : "es";
  const F = textosFicha(idioma), T = textos(idioma);
  const dominio = foto.dominio, ver = nombradorDeFoto(foto, !!ctx.verificado);
  const x = ctx.x || N.explicarNota(foto, ctx.extras || {});
  const a = analizar(foto, x, ctx.extras || {});
  const acciones = [...a.acciones, ...accionesInformativas(foto, ctx.correo)];
  const q = foto.qex || {}, dims = q.dimensiones || {};
  const pais = paisDeDominio(dominio);
  const medido = sinMs(foto.medido_utc);
  const pre = idioma === "en" ? "" : "/es";
  const urlDominio = ctx.publico ? `${SITE}${pre}/verificado/${dominio}`
    : `${SITE}${pre}/q-ready/medicion/?${new URLSearchParams({ dominio, ...(foto.vertical ? { sector: foto.vertical } : {}) })}`;
  const sector = F.sector[foto.vertical] || foto.vertical || "";

  // 01 · veredicto
  const cmp = comparacion(dominio, q.score, foto.referencia?.mediana_sector);
  const referencia = q.score == null ? F.referencia_sin_qex
    : cmp.compara ? F.referencia(sector.toLowerCase(), entero(foto.referencia.mediana_sector), foto.referencia.n_sector, foto.referencia.edicion, dominio, cmp.diferencia)
    : pais ? F.referencia_otro_pais(nombrePais(pais, idioma)) : F.referencia_sin_pais(tldDe(dominio));
  const ind = {};
  const pon = (id, o) => { ind[id] = { nombre: F.indicador[id], ...o }; };
  // metodo: con qué versión se midió cada valor (regla del protocolo: el ID es el concepto, metodo el cómo)
  const mSondas = foto.instrumentos?.servidor || null;
  pon("RQ.S.00", { valor: x.nota ?? null, unidad: null, texto: x.nota ?? F.sin_nota, tipo: x.nota ? "medido" : "no medido", barra: null, metodo: x.version });
  pon("RQ.S.01", { valor: q.score ?? null, unidad: "/100", tope: q.tope ?? N.TOPE, texto: q.score == null ? F.sin_dato : F.qex(q.score),
    tipo: q.score == null ? "no medido" : "medido", barra: q.score ?? null, metodo: q.version || null });

  // 02 · indicadores
  for (const id of ["RQ.S.02", "RQ.S.03", "RQ.S.04", "RQ.S.05"]) {
    const v = entero(dims[DIM[id]]);
    pon(id, { valor: v, unidad: "/100", texto: v == null ? F.sin_dato : F.sobre_100(v), tipo: v == null ? "no medido" : DIM[id] === "hndl" ? "modelo" : "medido", barra: v,
      metodo: q.version || null });
  }
  const mx = foto.proveedores?.mx, cm = correoMedido(ctx.correo);
  const pendiente = !!ctx.correo && ["pendiente", "tomado"].includes(ctx.correo.estado);
  pon("RQ.S.06", Array.isArray(mx) && mx.length === 0 ? { valor: 0, de: 0, unidad: "MX", texto: F.correo_sin_mx, tipo: "medido", barra: null }
    : cm && cm.total > 0 ? { valor: cm.aceptan, de: cm.total, unidad: "MX", texto: F.correo(cm.aceptan, cm.total), tipo: "medido", barra: Math.round((100 * cm.aceptan) / cm.total) }
    : { valor: null, unidad: "MX", texto: pendiente ? F.correo_pendiente : F.sin_dato, tipo: "no medido", barra: null });
  const c = foto.certificado || {}, dia = medido.slice(0, 10);
  if (c.ok && c.not_after) {
    const fecha = c.not_after.slice(0, 10), dias = Math.floor((Date.parse(fecha) - Date.parse(dia)) / 86400000);
    pon("RQ.S.07", { valor: dias, unidad: "días", fecha, texto: dias < 0 ? F.vigencia_vencido(fecha) : F.vigencia(dias, fecha), tipo: "medido", barra: null });
  } else pon("RQ.S.07", { valor: null, unidad: "días", texto: F.sin_dato, tipo: "no medido", barra: null });
  const st = foto.proveedores?.security_txt;
  pon("RQ.S.08", { valor: typeof st === "boolean" ? st : null, unidad: null, texto: st === true ? F.security_si : st === false ? F.security_no : F.sin_dato,
    tipo: typeof st === "boolean" ? "medido" : "no medido", barra: null });
  const eps = Array.isArray(foto.endpoints) ? foto.endpoints : [];
  const responden = eps.filter((e) => e.responde_443 === true).length;
  pon("RQ.S.09", foto.ct || eps.length
    ? { valor: responden, de: eps.length, unidad: "nombres", texto: eps.length ? F.superficie(responden, eps.length) : F.superficie_sin, tipo: "medido", barra: null }
    : { valor: null, unidad: "nombres", texto: F.sin_dato, tipo: "no medido", barra: null });
  for (const id of ["RQ.S.06", "RQ.S.07", "RQ.S.08", "RQ.S.09"]) ind[id].metodo = mSondas;
  // RQ.S.13: cuántos nombres hay en el registro público. NO dice cuántos responden (eso es RQ.S.09).
  const nCT = foto.ct?.conteos?.hostnames;
  pon("RQ.S.13", foto.ct && nCT != null ? { valor: nCT, unidad: "nombres", texto: F.nombres_ct(nCT), tipo: "medido", barra: null, metodo: `registro CT: ${foto.ct.fuente}` }
    : { valor: null, unidad: "nombres", texto: F.sin_dato, tipo: "no medido", barra: null, metodo: null });

  // 03 · alertas (GRAVE, ALTA, MEDIA; INFO no lo emite la NOTA-2.1). «Dónde» es el nombre completo,
  // enmascarado si el dueño no verificó el dominio; sin nombre, el sitio medido.
  const alertas = a.alertas.map((al) => ({ id: al.id, nivel: al.nivel, codigo: al.codigo, hallazgo: T.alerta[al.codigo] || al.codigo,
    donde: ver(al.host ?? foto.www ?? dominio) }));

  // 04 · qué hacer (efecto acumulado y calculado: ver analizar)
  const que = acciones.map((ac, i) => {
    const h1 = ac.hosts.length === 1 ? ver(ac.hosts[0]) : ac.codigo === "hibrido_en_principal" ? foto.www : null;
    return { id: `H${i + 1}`, codigo: ac.codigo, accion: F.accion[ac.codigo](ac.n, h1), resuelve: ac.resuelve, efecto: ac.sube_a,
      hosts: ac.hosts.map(ver) };
  });

  // 05 · no medido
  const nm = [];
  if (a.sin_sondear && a.sin_sondear.length) nm.push(F.no_medido.tope(a.sin_sondear.length, a.sensibles_total));
  for (const nd of x.no_evaluado || []) if (nd && nd.dimension) nm.push(F.no_medido.dimension(F.indicador[Object.keys(DIM).find((k) => DIM[k] === nd.dimension)] || nd.dimension));
  const fallaron = [...new Set((ctx.fuentes_que_fallaron || []).map((f) => f.fuente).filter(Boolean))];
  if (!foto.ct) nm.push(F.no_medido.sin_registro);
  else if (fallaron.length) nm.push(F.no_medido.fuentes(fallaron.join(", "), foto.ct.fuente, foto.ct.filas, foto.ct.conteos?.hostnames ?? 0));
  if (x.motivo === "borde_no_medido") nm.push(F.no_medido.borde);
  const sinEvid = eps.filter((e) => e.responde_443 === true && N.hibridoEnEndpoint(e) == null).length;
  if (sinEvid) nm.push(F.no_medido.sin_evidencia(sinEvid));
  if (cm) {
    const publicados = Array.isArray(ctx.correo?.resultado?.mx_publicados) ? ctx.correo.resultado.mx_publicados.length : ctx.correo.resultado.servidores.length;
    if (publicados > cm.total) nm.push(F.no_medido.correo_mx(publicados - cm.total, publicados));
  } else if (!(Array.isArray(mx) && mx.length === 0)) nm.push(pendiente ? F.no_medido.correo_pendiente : F.no_medido.correo_sin_dato);
  if (dims.hndl != null) nm.push(F.no_medido.hndl(sector.toLowerCase()));
  nm.push(F.no_medido.interno, F.no_medido.nunca);

  // 06 · evidencia
  const evidencia = {
    instrumento: foto.instrumentos?.servidor || null,
    versiones: [q.version, x.version].filter(Boolean).join(" · "),
    medido,
    huella_ct: foto.ct?.sha256_crudo ? huella(foto.ct.sha256_crudo) : null,
    certificados: foto.ct ? foto.ct.filas : null,
    huella_foto: foto.sha256 ? huella(foto.sha256) : null,
    metodo: F.evidencia.metodo.replace(/^[^:]+: /, ""),
  };

  // 07 · límites y siguiente paso
  const aA = que.findIndex((h) => h.efecto === "A");
  const lim = [F.limites.foto, ctx.publico ? F.limites.pagina(urlDominio) : F.limites.informe(urlDominio), ...(aA >= 0 ? [F.limites.hacia_a(aA + 1)] : [])];

  return {
    protocolo: PROTOCOLO, idioma, dominio,
    encabezado: { titulo: F.titulo, kicker: F.kicker, dominio, sector, pais: pais || null, pais_nombre: pais ? nombrePais(pais, idioma) : F.pais_sin,
      medido_utc: medido, desde_afuera: F.desde_afuera },
    veredicto: { lectura: lecturaDe(x, foto, idioma), referencia, publicacion: ctx.publico ? F.publicacion_publica(urlDominio) : F.publicacion_privada },
    indicadores: ind, alertas, acciones: que, no_medido: nm, evidencia, limites: lim,
    pie: F.pie, url_dominio: urlDominio,
  };
}

// Las líneas de evidencia, en el orden de la ficha aprobada.
function lineasEvidencia(F, e) {
  return [
    F.evidencia.instrumento(e.instrumento || "—"),
    F.evidencia.versiones(e.versiones),
    F.evidencia.medido(e.medido),
    e.huella_ct ? F.evidencia.huella_ct(e.huella_ct, e.certificados) : F.evidencia.huella_ct_sin,
    ...(e.huella_foto ? [F.evidencia.huella_foto(e.huella_foto)] : []),
    F.evidencia.metodo,
  ];
}
const num2 = (n) => String(n).padStart(2, "0");
const efectoMd = (F, e) => (e ? F.efecto_sube(e) : F.efecto_no);

// ---------------------------------------------------------------- markdownDe: la ficha → markdown canónico
export function markdownDe(ficha) {
  const F = textosFicha(ficha.idioma), e = ficha.encabezado, C = F.col;
  const tabla = (cab, filas) => [`| ${cab.join(" | ")} |`, `|${cab.map(() => "---").join("|")}|`, ...filas.map((f) => `| ${f.join(" | ")} |`)];
  const titulo = (i) => `## ${num2(i + 1)} ${F.secciones[i]}`;
  const I = ficha.indicadores;
  const out = [`# ${e.titulo}`, `**${e.dominio}** · ${e.sector} · ${e.pais_nombre} · ${F.medido(e.medido_utc.slice(0, 16).replace("T", " "))} · ${e.desde_afuera}`];
  out.push("", titulo(0), ...tabla([C.id, C.indicador, C.valor], ["RQ.S.00", "RQ.S.01"].map((id) => [id, I[id].nombre, id === "RQ.S.00" && I[id].valor ? `**${I[id].texto}**` : I[id].texto])), "",
    F.lectura(ficha.veredicto.lectura), ficha.veredicto.referencia, ficha.veredicto.publicacion);
  out.push("", titulo(1), ...tabla([C.id, C.indicador, C.valor, C.tipo], CATALOGO.slice(2).map((id) => [id, I[id].nombre, I[id].texto, F.tipo[I[id].tipo]])), "", F.leyenda);
  out.push("", titulo(2), ...(ficha.alertas.length ? tabla([C.n, C.nivel, C.hallazgo, C.donde], ficha.alertas.map((a) => [a.id, F.nivel[a.nivel], a.hallazgo, a.donde])) : [F.vacio]));
  out.push("", titulo(3), ...(ficha.acciones.length ? tabla([C.n, C.accion, C.resuelve, C.efecto],
    ficha.acciones.map((h) => [h.id, h.accion, h.resuelve.length ? rangos(h.resuelve) : "—", efectoMd(F, h.efecto)])) : [F.vacio]));
  out.push("", titulo(4), ...ficha.no_medido.map((l) => `- ${l}`));
  out.push("", titulo(5), ...lineasEvidencia(F, ficha.evidencia).map((l) => `- ${l}`));
  out.push("", titulo(6), ...ficha.limites.map((l) => `- ${l}`));
  out.push("", ficha.pie, "");
  return out.join("\n");
}

// ---------------------------------------------------------------- htmlDe: la ficha → HTML (página y PDF)
// El diseño de la ficha aprobada (ficha-yu-track.html): paleta del sitio, Newsreader e IBM Plex. Todo
// queda bajo .rf para no tocar el resto de la página. documento: true arma el A4 completo que el VPS
// convierte en PDF (lib/envio-informe.mjs → vps/sonda-correo/informe_pdf.py): misma fuente que la web.
// secciones: las claves de SECCIONES a mostrar (la página del sello muestra sólo 01 y 02).
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const conEtiqueta = (l) => { const i = l.indexOf(": "); return i > 0 && i < 30 ? `<b>${esc(l.slice(0, i + 1))}</b> ${esc(l.slice(i + 2))}` : esc(l); };
export const CSS_FICHA = `
.rf{--rf-teal:#0F8B7E;--rf-ink:#12302C;--rf-och:#B8892E;--rf-red:#B4432F;--rf-grey:#8A8F8A;--rf-sub:#5E6A67;--rf-line:#DCE6E3;--rf-paper:#FBFAF7;
 color:var(--rf-ink);font-family:var(--sans,'IBM Plex Sans',system-ui,sans-serif);font-size:15px;line-height:1.5}
.rf *{box-sizing:border-box}
.rf .rf-kick{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--rf-teal);font-weight:600;margin:0}
.rf .rf-h1{font-family:var(--serif,'Newsreader',Georgia,serif);font-weight:600;font-size:40px;line-height:1.1;margin:2px 0;letter-spacing:-.01em;overflow-wrap:anywhere}
.rf .rf-meta{color:var(--rf-sub);font-size:14px;margin:0}
.rf .rf-meta b{color:var(--rf-ink);font-weight:500}
.rf .rf-h2{font-family:var(--serif,'Newsreader',Georgia,serif);font-weight:600;font-size:21px;margin:22px 0 8px;display:flex;align-items:baseline;gap:8px}
.rf .rf-num{font-family:var(--mono,'IBM Plex Mono',ui-monospace,monospace);font-size:12px;color:var(--rf-teal);font-weight:500}
.rf .rf-hero{display:flex;gap:14px;flex-wrap:wrap}
.rf .rf-grade{flex:0 0 170px;border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;justify-content:space-between;border:1px solid}
.rf .rf-grade .rf-l{font-family:var(--serif,'Newsreader',Georgia,serif);font-size:84px;line-height:1;font-weight:600}
.rf .rf-g-a{background:#E3F1EE;border-color:#A9D3CB;color:var(--rf-teal)}
.rf .rf-g-b{background:#F7EFDD;border-color:#E2CF9F;color:#8C6618}
.rf .rf-g-f{background:#F6E6E2;border-color:#E2B3A9;color:var(--rf-red)}
.rf .rf-g-n{background:#F1F3F2;border-color:var(--rf-line);color:var(--rf-grey)}
.rf .rf-lab{font-family:var(--mono,'IBM Plex Mono',ui-monospace,monospace);font-size:11px;color:var(--rf-sub);text-transform:uppercase}
.rf .rf-lab.rf-min{text-transform:none}
.rf .rf-qex{flex:1 1 280px;border-radius:10px;background:#fff;border:1px solid var(--rf-line);padding:12px 16px}
.rf .rf-qex .rf-n{font-family:var(--serif,'Newsreader',Georgia,serif);font-size:46px;line-height:1;font-weight:600}
.rf .rf-qex .rf-n small{font-size:18px;color:var(--rf-sub)}
.rf .rf-scale{position:relative;height:10px;background:#EEF2F1;border-radius:5px;margin:12px 0 4px}
.rf .rf-scale .rf-f{position:absolute;left:0;top:0;bottom:0;background:var(--rf-teal);border-radius:5px}
.rf .rf-scale .rf-t{position:absolute;left:84%;top:-4px;bottom:-4px;border-left:2px dashed var(--rf-ink)}
.rf .rf-sl{display:flex;justify-content:space-between;font-family:var(--mono,'IBM Plex Mono',ui-monospace,monospace);font-size:11px;color:var(--rf-sub)}
.rf .rf-read{margin:8px 0 0}
.rf .rf-notes{display:flex;gap:10px;margin-top:10px;flex-wrap:wrap}
.rf .rf-note{flex:1 1 240px;border-left:3px solid var(--rf-grey);background:#fff;padding:7px 11px;font-size:13px}
.rf .rf-table{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--rf-line)}
.rf .rf-table th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--rf-sub);font-weight:600;padding:7px 10px;background:#F1F5F4;border-bottom:1px solid var(--rf-line)}
.rf .rf-table td{padding:6px 10px;border-bottom:1px solid #EDF1F0;vertical-align:middle}
.rf .rf-id{font-family:var(--mono,'IBM Plex Mono',ui-monospace,monospace);font-size:12px;color:var(--rf-teal);white-space:nowrap}
.rf .rf-val{font-weight:500}
.rf .rf-mono{font-family:var(--mono,'IBM Plex Mono',ui-monospace,monospace);font-size:12px;overflow-wrap:anywhere}
.rf .rf-b{width:22%}
.rf .rf-bar{display:block;position:relative;height:6px;background:#EEF2F1;border-radius:3px}
.rf .rf-fill{position:absolute;left:0;top:0;bottom:0;border-radius:3px}
.rf .rf-pill{border:1px solid;border-radius:20px;padding:0 7px;font-size:11px;white-space:nowrap}
.rf .rf-lvl{font-family:var(--mono,'IBM Plex Mono',ui-monospace,monospace);font-size:11px;font-weight:500;padding:1px 7px;border-radius:4px;white-space:nowrap}
.rf .rf-lvl-grave{background:#F6E6E2;color:var(--rf-red)}
.rf .rf-lvl-alta{background:#F8E9E5;color:#9A3B28}
.rf .rf-lvl-media{background:#F7EFDD;color:#8C6618}
.rf .rf-lvl-info{background:#F1F3F2;color:var(--rf-sub)}
.rf .rf-eff{font-family:var(--mono,'IBM Plex Mono',ui-monospace,monospace);font-size:12px;color:var(--rf-sub);white-space:nowrap}
.rf .rf-eff-up{color:var(--rf-teal);font-weight:500}
.rf .rf-legend{font-size:12px;color:var(--rf-sub);margin-top:6px}
.rf .rf-ul{margin:4px 0 0;padding-left:18px}
.rf .rf-ul li{margin-bottom:3px}
.rf .rf-ev{background:#fff;border:1px solid var(--rf-line);border-radius:8px;padding:8px 12px;font-family:var(--mono,'IBM Plex Mono',ui-monospace,monospace);font-size:12px;line-height:1.7;overflow-wrap:anywhere}
.rf .rf-ev span{color:var(--rf-sub)}
.rf .rf-two{display:flex;gap:14px;flex-wrap:wrap}
.rf .rf-two>div{flex:1 1 260px}
.rf .rf-pie{margin-top:18px;border-top:1px solid var(--rf-line);padding-top:6px;font-family:var(--mono,'IBM Plex Mono',ui-monospace,monospace);font-size:11px;color:var(--rf-sub)}
.rf .rf-top{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--rf-line);padding-bottom:8px;margin-bottom:12px}
.rf .rf-brand{display:flex;align-items:center;gap:8px;font-family:var(--serif,'Newsreader',Georgia,serif);font-weight:600;font-size:17px}
.rf .rf-brand svg{height:26px;width:auto}
.rf .rf-proto{font-family:var(--mono,'IBM Plex Mono',ui-monospace,monospace);font-size:10px;color:var(--rf-sub);text-align:right}
@media (max-width:600px){.rf .rf-h1{font-size:30px}.rf .rf-grade{flex-basis:100%}.rf .rf-b{display:none}}
`;
// El A4 del PDF: el pie va en el margen de cada página (el texto del pie es el de la ficha, ver htmlDe).
const cssPdf = (pie) => `@page{size:A4;margin:12mm 15mm 14mm;background:#FBFAF7;@bottom-left{content:"${pie.replace(/["\\]/g, "")}";font:7pt 'IBM Plex Mono',monospace;color:#5E6A67}
 @bottom-right{content:counter(page) " / " counter(pages);font:7pt 'IBM Plex Mono',monospace;color:#5E6A67}}
body{margin:0;background:#FBFAF7}.rf{font-size:9pt;line-height:1.4}.rf .rf-h1{font-size:28pt}.rf .rf-h2{font-size:13pt;margin:10px 0 5px}
.rf .rf-grade{flex-basis:44mm}.rf .rf-grade .rf-l{font-size:58pt}.rf .rf-qex .rf-n{font-size:32pt}.rf .rf-lab{font-size:7pt}
.rf .rf-table th{font-size:7pt;padding:5px 9px}.rf .rf-table td{padding:3.5px 9px}.rf .rf-mono,.rf .rf-id,.rf .rf-eff{font-size:7.8pt}
.rf .rf-note{font-size:8.2pt;padding:5px 10px}.rf .rf-legend{font-size:7.2pt}.rf .rf-pag2{break-before:page}.rf .rf-table tr{break-inside:avoid}`;
const FUENTES = "https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,500;6..72,600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap";

export function htmlDe(ficha, { documento = false, secciones = SECCIONES, marca = null } = {}) {
  const F = textosFicha(ficha.idioma), e = ficha.encabezado, C = F.col, I = ficha.indicadores;
  const ver = new Set(secciones);
  const h2 = (i) => `<h2 class="rf-h2"><span class="rf-num">${num2(i + 1)}</span>${esc(F.secciones[i])}</h2>`;
  const tabla = (cab, filas) => `<table class="rf-table"><tr>${cab.map((c) => `<th>${esc(c)}</th>`).join("")}</tr>${filas.join("")}</table>`;
  const color = (t) => (t === "modelo" ? "var(--rf-och)" : t === "medido" ? "var(--rf-teal)" : "var(--rf-grey)");
  const pill = (t) => `<span class="rf-pill" style="color:${color(t)};border-color:${color(t)}">${esc(F.tipo[t])}</span>`;
  const barra = (v, t) => (v == null ? "" : `<span class="rf-bar"><span class="rf-fill" style="width:${Math.max(0, Math.min(100, v))}%;background:${color(t)}"></span></span>`);
  const nota = I["RQ.S.00"].valor, qx = I["RQ.S.01"];
  const gcls = !nota ? "rf-g-n" : /^A/.test(nota) ? "rf-g-a" : nota === "B" || nota === "C" ? "rf-g-b" : "rf-g-f";
  const partes = [];
  if (documento) partes.push(`<div class="rf-top"><div class="rf-brand">${marca || ""}Rosetta Quantum</div><div class="rf-proto">FICHA ROSETTA · ${esc(PROTOCOLO)}</div></div>`);
  partes.push(`<p class="rf-kick">${esc(e.kicker)}</p><h1 class="rf-h1">${esc(e.dominio)}</h1>`,
    `<p class="rf-meta"><b>${esc(e.sector)}</b> · ${esc(e.pais_nombre)} · ${esc(F.medido("").replace(/ UTC$/, "").trim())} <b>${esc(e.medido_utc.slice(0, 16).replace("T", " "))} UTC</b> · ${esc(e.desde_afuera)}</p>`);
  if (ver.has("veredicto")) partes.push(h2(0),
    `<div class="rf-hero"><div class="rf-grade ${gcls}"><div class="rf-lab">RQ.S.00 · ${esc(I["RQ.S.00"].nombre)}</div><div class="rf-l">${esc(nota || "—")}</div><div class="rf-lab rf-min">${esc(nota ? F.escala : F.sin_nota)}</div></div>`
    + `<div class="rf-qex"><div class="rf-lab">RQ.S.01 · ${esc(qx.nombre)}</div><div class="rf-n">${esc(qx.valor ?? "—")}<small> /100</small></div>`
    + `<div class="rf-scale"><div class="rf-f" style="width:${qx.valor ?? 0}%"></div><div class="rf-t"></div></div>`
    + `<div class="rf-sl"><span>0</span><span style="margin-left:auto;margin-right:14%">${esc(F.tope_externo)}</span><span>100</span></div>`
    + `<p class="rf-read">${esc(ficha.veredicto.lectura)}</p></div></div>`,
    `<div class="rf-notes"><div class="rf-note">${conEtiqueta(ficha.veredicto.referencia)}</div><div class="rf-note">${conEtiqueta(ficha.veredicto.publicacion)}</div></div>`);
  if (ver.has("indicadores")) partes.push(h2(1), tabla([C.id, C.indicador, C.valor, "", C.tipo], CATALOGO.slice(2).map((id) => {
    const r = I[id]; return `<tr><td class="rf-id">${id}</td><td>${esc(r.nombre)}</td><td class="rf-val">${esc(r.texto)}</td><td class="rf-b">${barra(r.barra, r.tipo)}</td><td>${pill(r.tipo)}</td></tr>`;
  })), `<p class="rf-legend">${esc(F.leyenda)}</p>`);
  if (ver.has("alertas")) partes.push(h2(2), ficha.alertas.length ? tabla([C.n, C.nivel, C.hallazgo, C.donde], ficha.alertas.map((a) =>
    `<tr><td class="rf-id">${a.id}</td><td><span class="rf-lvl rf-lvl-${a.nivel.toLowerCase()}">${esc(F.nivel[a.nivel])}</span></td><td>${esc(a.hallazgo)}</td><td class="rf-mono">${esc(a.donde)}</td></tr>`)) : `<p>${esc(F.vacio)}</p>`);
  const pag2 = [];
  if (ver.has("que_hacer")) pag2.push(h2(3), ficha.acciones.length ? tabla([C.n, C.accion, C.resuelve, C.efecto], ficha.acciones.map((h) =>
    `<tr><td class="rf-id">${h.id}</td><td>${esc(h.accion)}</td><td class="rf-mono">${esc(h.resuelve.length ? rangos(h.resuelve) : "—")}</td><td><span class="rf-eff${h.efecto ? " rf-eff-up" : ""}">${esc(h.efecto ? `→ ${h.efecto}` : F.efecto_no)}</span></td></tr>`)) : `<p>${esc(F.vacio)}</p>`);
  const dos = [];
  if (ver.has("no_medido")) dos.push(`<div>${h2(4)}<ul class="rf-ul">${ficha.no_medido.map((l) => `<li>${l === F.no_medido.nunca ? `<b>${esc(l)}</b>` : esc(l)}</li>`).join("")}</ul></div>`);
  if (ver.has("evidencia")) dos.push(`<div>${h2(5)}<div class="rf-ev">${lineasEvidencia(F, ficha.evidencia).map((l) => { const i = l.indexOf(": "); return `<span>${esc(l.slice(0, i))}</span> ${esc(l.slice(i + 2))}`; }).join("<br>")}</div></div>`);
  if (dos.length) pag2.push(`<div class="rf-two">${dos.join("")}</div>`);
  if (ver.has("limites")) pag2.push(h2(6), `<ul class="rf-ul">${ficha.limites.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`);
  if (documento && pag2.length) pag2.unshift(`<div class="rf-top"><div class="rf-brand">${marca || ""}Rosetta Quantum</div><div class="rf-proto">${esc(e.dominio)} · ${esc(e.medido_utc.slice(0, 10))}</div></div>`);
  if (pag2.length) partes.push(`<div class="rf-pag2">${pag2.join("")}</div>`);
  if (!documento && ver.has("limites")) partes.push(`<p class="rf-pie">${esc(ficha.pie)}</p>`);
  const cuerpo = `<div class="rf${documento ? " rf-pdf" : ""}" data-protocolo="${esc(PROTOCOLO)}">${partes.join("")}</div>`;
  if (!documento) return cuerpo;
  return `<!doctype html><html lang="${ficha.idioma}"><head><meta charset="utf-8"><title>${esc(`${F.titulo} · ${e.dominio}`)}</title>`
    + `<link href="${FUENTES}" rel="stylesheet"><style>${CSS_FICHA}${cssPdf(ficha.pie)}</style></head><body>${cuerpo}</body></html>`;
}

// El bloque `presentacion` de la respuesta: el markdown canónico y la ficha en datos.
export function presentacion(foto, ctx = {}) {
  const ficha = armarFicha(foto, ctx);
  const F = textosFicha(ficha.idioma);
  return { protocolo: PROTOCOLO, spec: SPEC, instruccion_agente: F.instruccion_agente, idioma: ficha.idioma,
    markdown: markdownDe(ficha), ficha };
}

// ---------------------------------------------------------------- el validador de la sintaxis
// Lo que cualquiera puede comprobar sobre un markdown rosetta-ficha/1 sin la foto: las 7 secciones
// (01..07) en orden, los IDs del catálogo en orden, alertas A1..An con nivel válido y ordenadas,
// acciones H1..Hn con su efecto, huellas abreviadas y el pie. Devuelve la lista de fallas ([] = válido).
export function validarMarkdown(md, idioma = "es") {
  const F = textosFicha(idioma), fallas = [];
  const L = String(md).split("\n");
  if (L[0] !== `# ${F.titulo}`) fallas.push("encabezado: la primera línea no es el título fijo");
  const fin = ` UTC · ${F.desde_afuera}`;
  if (!/^\*\*[a-z0-9.-]+\*\* · .+ · .+ · .+ \d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(L[1] || "") || !(L[1] || "").endsWith(fin)) fallas.push("encabezado: la segunda línea no es «**dominio** · sector · país · medido AAAA-MM-DD HH:MM UTC · …»");
  const h2 = L.filter((l) => l.startsWith("## "));
  const esperadas = F.secciones.map((t, i) => `## ${num2(i + 1)} ${t}`);
  if (JSON.stringify(h2) !== JSON.stringify(esperadas)) fallas.push(`secciones: ${JSON.stringify(h2)} ≠ las 7 fijas en orden`);
  const seccion = (n) => { const i = L.indexOf(esperadas[n - 1]); const j = n < 7 ? L.indexOf(esperadas[n]) : L.length; return i < 0 ? [] : L.slice(i + 1, j < 0 ? L.length : j); };
  const celdas = (l) => l.split("|").slice(1, -1).map((c) => c.trim());
  const filasDe = (n) => seccion(n).filter((l) => l.startsWith("| ") && !/^\|( ?-+ ?\|)+$/.test(l)).slice(1).map(celdas);
  const ids = [...filasDe(1), ...filasDe(2)].map((c) => c[0]);
  if (JSON.stringify(ids) !== JSON.stringify(CATALOGO)) fallas.push(`IDs: ${ids.join(",")} ≠ ${CATALOGO.join(",")}`);
  for (const c of filasDe(2)) if (!Object.values(F.tipo).includes(c[3])) fallas.push(`tipo inválido en ${c[0]}: «${c[3]}»`);
  for (const c of [...filasDe(1), ...filasDe(2)]) if (/\d[.,]\d/.test(c[2])) fallas.push(`decimales en ${c[0]}: «${c[2]}»`);
  const al = filasDe(3), niveles = Object.values(F.nivel);
  if (!al.length && !seccion(3).includes(F.vacio)) fallas.push("alertas: ni tabla ni «" + F.vacio + "»");
  al.forEach((c, i) => {
    if (c[0] !== `A${i + 1}`) fallas.push(`alertas: ${c[0]} en la posición ${i + 1}`);
    if (!niveles.includes(c[1])) fallas.push(`alertas: nivel inválido «${c[1]}»`);
    if (i && niveles.indexOf(c[1]) < niveles.indexOf(al[i - 1][1])) fallas.push(`alertas: ${c[0]} no está ordenada por nivel`);
  });
  const ac = filasDe(4);
  if (!ac.length && !seccion(4).includes(F.vacio)) fallas.push("qué hacer: ni tabla ni «" + F.vacio + "»");
  ac.forEach((c, i) => {
    if (c[0] !== `H${i + 1}`) fallas.push(`acciones: ${c[0]} en la posición ${i + 1}`);
    if (!/^(—|(A\d+(-A\d+)?|RQ\.S\.\d\d)( · (A\d+(-A\d+)?|RQ\.S\.\d\d))*)$/.test(c[2])) fallas.push(`acciones: «Resuelve» inválido en ${c[0]}: «${c[2]}»`);
    if (!(c[3] === F.efecto_no || /^-> (A\+|[ABCDF])$/.test(c[3]))) fallas.push(`acciones: efecto inválido en ${c[0]}: «${c[3]}»`);
  });
  for (const n of [5, 6, 7]) if (!seccion(n).some((l) => l.startsWith("- "))) fallas.push(`sección ${n}: vacía`);
  for (const l of seccion(6)) if (/[0-9a-f]{13,}/.test(l)) fallas.push(`evidencia: huella sin abreviar: ${l}`);
  if (!seccion(6).some((l) => /[0-9a-f]{8}…[0-9a-f]{4}|: (sin registro|no log)$/.test(l))) fallas.push("evidencia: sin huella CT abreviada (8…4)");
  const pie = L.filter((l) => l.trim()).pop() || "";
  if (pie !== F.pie) fallas.push("pie: no es el pie fijo");
  if (/\p{Extended_Pictographic}/u.test(md)) fallas.push("tiene emojis");
  return fallas;
}
