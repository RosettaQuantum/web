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
export const CATALOGO = ["RQ.S.00", "RQ.S.01", "RQ.S.02", "RQ.S.03", "RQ.S.04", "RQ.S.05", "RQ.S.06", "RQ.S.07", "RQ.S.08", "RQ.S.09"];
export const SECCIONES = ["veredicto", "indicadores", "alertas", "que_hacer", "no_medido", "evidencia", "limites"];
export const TIPOS = ["medido", "modelo", "no medido"];
export const NIVELES = ["GRAVE", "MEDIA", "INFO"];
// Las alertas de la nota (QREADY-NOTA-2) → nivel de la ficha. La nota tiene tres niveles (grave, alta,
// media) y el protocolo tres (GRAVE, MEDIA, INFO): «alta» baja la letra (a C o D), así que va con GRAVE.
const NIVEL_DE = { grave: "GRAVE", alta: "GRAVE", media: "MEDIA" };
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
// Regla del encargo (la misma del deck): desde el 2º carácter del segmento que delata el ambiente o,
// si no hay, desde la mitad del primer label. El dominio registrable se muestra completo.
//   biometrics-dev.x.com.py → biometrics-d•••.x.com.py ; apigw-legacy.x → apigw-l•••.x
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
  const deja = corte != null ? corte + 1 : Math.max(1, Math.floor(sub.split(".")[0].length / 2));
  return sub.slice(0, deja) + MASCARA + sufijo;
}
// verificado = el dueño verificó el dominio por DNS (qready_dominios, entorno producción): nombres completos.
export const vistaHost = (dominio, verificado) => (h) => (h == null ? h : verificado ? String(h) : enmascarar(h, dominio));
// En la ficha, «Dónde» va sin el dominio registrable (ya está en el encabezado).
const etiqueta = (h, dominio) => (h === dominio ? h : String(h).endsWith("." + dominio) ? String(h).slice(0, -(dominio.length + 1)) : String(h));

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
  if (foto.proveedores?.security_txt === false) out.push({ codigo: "publicar_security_txt", n: 1, hosts: [], resuelve: ["RQ.S.08"], sube_a: null, cambia_nota: false });
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
export function notaParaJson(x, a, { dominio, verificado = false, fuentes_que_fallaron = [], idioma = "es" } = {}) {
  const F = textosFicha(idioma), ver = vistaHost(dominio, verificado);
  const enA = x.nota === "A" || x.nota === "A+";
  return {
    alertas: a.alertas.map((al) => ({ id: al.id, nivel: al.nivel_nota, codigo: al.codigo, texto: textos(idioma).alerta[al.codigo] || al.codigo, host: ver(al.host ?? null) })),
    falta_para_A: enA ? [] : a.acciones.map((ac, i) => ({ id: `H${i + 1}`, codigo: ac.codigo, texto: F.accion[ac.codigo](ac.n),
      hosts: ac.hosts.map(ver), resuelve: ac.resuelve, sube_a: ac.sube_a })),
    no_medido: { nombres_fuera_del_tope: a.sin_sondear ? a.sin_sondear.length : null,
      ejemplos: (a.sin_sondear || []).slice(0, 5).map(ver), fuentes_que_fallaron },
  };
}

// ---------------------------------------------------------------- la ficha
const huella = (h) => (typeof h === "string" && h.length >= 12 ? `${h.slice(0, 8)}…${h.slice(-4)}` : null);
const sinMs = (iso) => String(iso || "").replace(/\.\d+Z$/, "Z");
const entero = (v) => (v == null ? null : N.redondearPar(v));
function rangos(ids) {
  // A1, A2, A3 → A1-A3 ; A1, A3 → A1, A3. RQ.S.xx se listan tal cual.
  const nums = ids.map((i) => /^A(\d+)$/.exec(i)).filter(Boolean).map((m) => +m[1]);
  if (nums.length !== ids.length || !nums.length) return ids.join(", ");
  const out = []; let ini = nums[0], fin = nums[0];
  for (const n of [...nums.slice(1), null]) {
    if (n === fin + 1) { fin = n; continue; }
    out.push(ini === fin ? `A${ini}` : `A${ini}-A${fin}`); ini = fin = n;
  }
  return out.join(", ");
}

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
  const dominio = foto.dominio, ver = vistaHost(dominio, !!ctx.verificado);
  const x = ctx.x || N.explicarNota(foto, ctx.extras || {});
  const a = analizar(foto, x, ctx.extras || {});
  const acciones = [...a.acciones, ...accionesInformativas(foto, ctx.correo)];
  const q = foto.qex || {}, dims = q.dimensiones || {};
  const pais = paisDeDominio(dominio);
  const medido = sinMs(foto.medido_utc);
  const pre = idioma === "en" ? "" : "/es";
  const urlDominio = ctx.publico ? `${SITE}${pre}/verificado/${dominio}`
    : `${SITE}${pre}/q-ready/medicion/?${new URLSearchParams({ dominio, ...(foto.vertical ? { sector: foto.vertical } : {}) })}`;

  // 1 · veredicto
  const cmp = comparacion(dominio, q.score, foto.referencia?.mediana_sector);
  const sectorNombre = F.sector[foto.vertical] || foto.vertical;
  const referencia = q.score == null ? F.referencia_sin_qex
    : cmp.compara ? F.referencia(sectorNombre, entero(foto.referencia.mediana_sector), foto.referencia.n_sector, foto.referencia.edicion, cmp.diferencia)
    : pais ? F.referencia_otro_pais(nombrePais(pais, idioma)) : F.referencia_sin_pais(tldDe(dominio));
  const veredicto = {
    filas: [
      { id: "RQ.S.00", valor: x.nota ?? F.sin_nota, tipo: x.nota ? "medido" : "no medido", resaltar: !!x.nota },
      { id: "RQ.S.01", valor: q.score == null ? F.sin_dato : F.qex(q.score), tipo: q.score == null ? "no medido" : "medido" },
    ],
    lineas: [
      F.lectura(x.nota ? T.nota_lectura[x.nota] : (T.nota_sin_motivo[x.motivo] || T.nota_sin)),
      referencia,
      ctx.publico ? F.publicacion_publica(urlDominio) : F.publicacion_privada,
    ],
  };

  // 2 · indicadores
  const ind = [];
  for (const id of ["RQ.S.02", "RQ.S.03", "RQ.S.04", "RQ.S.05"]) {
    const v = entero(dims[DIM[id]]);
    ind.push({ id, valor: v == null ? F.sin_dato : F.sobre_100(v), tipo: v == null ? "no medido" : DIM[id] === "hndl" ? "modelo" : "medido" });
  }
  const mx = foto.proveedores?.mx, cm = correoMedido(ctx.correo);
  ind.push(Array.isArray(mx) && mx.length === 0 ? { id: "RQ.S.06", valor: F.correo_sin_mx, tipo: "medido" }
    : cm && cm.total > 0 ? { id: "RQ.S.06", valor: F.correo(cm.aceptan, cm.total), tipo: "medido" }
    : { id: "RQ.S.06", valor: ctx.correo && ["pendiente", "tomado"].includes(ctx.correo.estado) ? F.correo_pendiente : F.sin_dato, tipo: "no medido" });
  const c = foto.certificado || {}, dia = medido.slice(0, 10);
  if (c.ok && c.not_after) {
    const dias = Math.floor((Date.parse(c.not_after.slice(0, 10)) - Date.parse(dia)) / 86400000);
    ind.push({ id: "RQ.S.07", valor: dias < 0 ? F.vigencia_vencido(c.not_after.slice(0, 10)) : F.vigencia(dias, c.not_after.slice(0, 10)), tipo: "medido" });
  } else ind.push({ id: "RQ.S.07", valor: F.sin_dato, tipo: "no medido" });
  const st = foto.proveedores?.security_txt;
  ind.push({ id: "RQ.S.08", valor: st === true ? F.security_si : st === false ? F.security_no : F.sin_dato, tipo: typeof st === "boolean" ? "medido" : "no medido" });
  const eps = Array.isArray(foto.endpoints) ? foto.endpoints : [];
  ind.push(foto.ct || eps.length
    ? { id: "RQ.S.09", valor: F.superficie(eps.filter((e) => e.responde_443 === true).length, eps.length), tipo: "medido" }
    : { id: "RQ.S.09", valor: F.sin_dato, tipo: "no medido" });

  // 3 · alertas (ya en orden: GRAVE, luego MEDIA; INFO no lo emite la NOTA-2)
  const alertas = a.alertas.map((al) => ({ id: al.id, nivel: al.nivel, codigo: al.codigo, hallazgo: T.alerta[al.codigo] || al.codigo,
    donde: etiqueta(ver(al.host ?? foto.www ?? dominio), dominio) }));

  // 4 · qué hacer
  const que = acciones.map((ac, i) => ({ id: `H${i + 1}`, codigo: ac.codigo, accion: F.accion[ac.codigo](ac.n), resuelve: ac.resuelve,
    efecto: ac.sube_a, hosts: ac.hosts.map((h) => etiqueta(ver(h), dominio)) }));

  // 5 · no medido
  const nm = [];
  if (a.sin_sondear && a.sin_sondear.length) nm.push(F.no_medido.tope(a.sin_sondear.length, a.sensibles_total));
  const fallaron = [...new Set((ctx.fuentes_que_fallaron || []).map((f) => f.fuente).filter(Boolean))];
  if (!foto.ct) nm.push(F.no_medido.sin_registro);
  else if (fallaron.length) nm.push(F.no_medido.fuentes(fallaron.join(", "), foto.ct.fuente, foto.ct.filas, foto.ct.conteos?.hostnames ?? 0));
  if (x.motivo === "borde_no_medido") nm.push(F.no_medido.borde);
  const sinEvid = eps.filter((e) => e.responde_443 === true && N.hibridoEnEndpoint(e) == null).length;
  if (sinEvid) nm.push(F.no_medido.sin_evidencia(sinEvid));
  if (!(Array.isArray(mx) && mx.length === 0) && !(cm && cm.total > 0))
    nm.push(ctx.correo && ["pendiente", "tomado"].includes(ctx.correo.estado) ? F.no_medido.correo_pendiente : F.no_medido.correo_sin_dato);
  nm.push(F.no_medido.interno, F.no_medido.nunca);

  // 6 · evidencia
  const ev = [
    F.evidencia.instrumento([foto.instrumentos?.servidor, q.version, x.version].filter(Boolean).join(" · ")),
    F.evidencia.medido(medido),
    foto.ct?.sha256_crudo ? F.evidencia.huella_ct(huella(foto.ct.sha256_crudo)) : F.evidencia.huella_ct_sin,
    ...(foto.sha256 ? [F.evidencia.huella_foto(huella(foto.sha256))] : []),
    F.evidencia.metodo,
  ];

  // 7 · límites y siguiente paso
  const lim = [F.limites.foto, ctx.publico ? F.limites.pagina(urlDominio) : F.limites.informe(urlDominio)];

  const ficha = {
    protocolo: PROTOCOLO, idioma, dominio,
    encabezado: { titulo: F.titulo, dominio, sector: sectorNombre, pais: pais || null, medido_utc: medido },
    secciones: [
      { n: 1, clave: "veredicto", titulo: F.secciones[0], filas: veredicto.filas.map((f) => ({ ...f, indicador: F.indicador[f.id] })), lineas: veredicto.lineas },
      { n: 2, clave: "indicadores", titulo: F.secciones[1], filas: ind.map((f) => ({ ...f, indicador: F.indicador[f.id] })) },
      { n: 3, clave: "alertas", titulo: F.secciones[2], filas: alertas },
      { n: 4, clave: "que_hacer", titulo: F.secciones[3], filas: que },
      { n: 5, clave: "no_medido", titulo: F.secciones[4], lineas: nm },
      { n: 6, clave: "evidencia", titulo: F.secciones[5], lineas: ev },
      { n: 7, clave: "limites", titulo: F.secciones[6], lineas: lim },
    ],
    pie: F.pie(urlDominio),
    url_dominio: urlDominio,
  };
  return ficha;
}

// La ficha → markdown canónico. Sólo formato: todo el contenido viene de armarFicha.
export function markdownDe(ficha) {
  const F = textosFicha(ficha.idioma), e = ficha.encabezado, C = F.col;
  const tipo = (t) => F.tipo[t];
  const tabla = (cab, filas) => [`| ${cab.join(" | ")} |`, `|${cab.map(() => "---").join("|")}|`, ...filas.map((f) => `| ${f.join(" | ")} |`)];
  const out = [`# ${e.titulo}`, `**${e.dominio}** · ${e.sector} · ${e.pais || F.pais_sin} · ${F.medido(e.medido_utc.slice(0, 16).replace("T", " "))}`];
  for (const s of ficha.secciones) {
    out.push("", `## ${s.n}. ${s.titulo}`);
    if (s.clave === "veredicto") {
      out.push(...tabla([C.id, C.indicador, C.valor], s.filas.map((f) => [f.id, f.indicador, f.resaltar ? `**${f.valor}**` : f.valor])), "");
      out.push(...s.lineas);
    } else if (s.clave === "indicadores") {
      out.push(...tabla([C.id, C.indicador, C.valor, C.tipo], s.filas.map((f) => [f.id, f.indicador, f.valor, tipo(f.tipo)])));
    } else if (s.clave === "alertas") {
      out.push(...(s.filas.length ? tabla([C.n, C.nivel, C.hallazgo, C.donde], s.filas.map((f) => [f.id, F.nivel[f.nivel], f.hallazgo, f.donde])) : [F.vacio]));
    } else if (s.clave === "que_hacer") {
      out.push(...(s.filas.length ? tabla([C.n, C.accion, C.resuelve, C.efecto],
        s.filas.map((f) => [f.id, f.accion, f.resuelve.length ? rangos(f.resuelve) : "—", f.efecto ? F.efecto_sube(f.efecto) : F.efecto_no])) : [F.vacio]));
    } else {
      out.push(...s.lineas.map((l) => `- ${l}`));
    }
  }
  out.push("", ficha.pie, "");
  return out.join("\n");
}

// El bloque `presentacion` de la respuesta (encargo del 13-nov, literal en la forma).
export function presentacion(foto, ctx = {}) {
  const ficha = armarFicha(foto, ctx);
  const F = textosFicha(ficha.idioma);
  return { protocolo: PROTOCOLO, spec: SPEC, instruccion_agente: F.instruccion_agente, idioma: ficha.idioma,
    markdown: markdownDe(ficha), encabezado: ficha.encabezado, secciones: ficha.secciones, pie: ficha.pie };
}

// ---------------------------------------------------------------- el validador de la sintaxis
// Lo que cualquiera puede comprobar sobre un markdown rosetta-ficha/1 sin la foto: las 7 secciones en
// orden, los IDs del catálogo en orden, alertas A1..An con nivel válido y ordenadas, acciones H1..Hn
// con su efecto, huellas abreviadas y el pie. Devuelve la lista de fallas ([] = válido).
export function validarMarkdown(md, idioma = "es") {
  const F = textosFicha(idioma), fallas = [];
  const L = String(md).split("\n");
  if (L[0] !== `# ${F.titulo}`) fallas.push("encabezado: la primera línea no es el título fijo");
  if (!/^\*\*[a-z0-9.-]+\*\* · .+ · .+ · .+ \d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC$/.test(L[1] || "")) fallas.push("encabezado: la segunda línea no es «**dominio** · sector · país · medido AAAA-MM-DD HH:MM UTC»");
  const h2 = L.filter((l) => l.startsWith("## "));
  const esperadas = F.secciones.map((t, i) => `## ${i + 1}. ${t}`);
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
    if (!/^(—|(A\d+(-A\d+)?|RQ\.S\.\d\d)(, (A\d+(-A\d+)?|RQ\.S\.\d\d))*)$/.test(c[2])) fallas.push(`acciones: «Resuelve» inválido en ${c[0]}: «${c[2]}»`);
    if (!(c[3] === F.efecto_no || /^-> (A\+|[ABCDF])$/.test(c[3]))) fallas.push(`acciones: efecto inválido en ${c[0]}: «${c[3]}»`);
  });
  for (const n of [5, 6, 7]) if (!seccion(n).some((l) => l.startsWith("- "))) fallas.push(`sección ${n}: vacía`);
  for (const l of seccion(6)) if (/[0-9a-f]{13,}/.test(l)) fallas.push(`evidencia: huella sin abreviar: ${l}`);
  if (!seccion(6).some((l) => /[0-9a-f]{8}…[0-9a-f]{4}|: (sin registro|no log)$/.test(l))) fallas.push("evidencia: sin huella CT abreviada (8…4)");
  const pie = L.filter((l) => l.trim()).pop() || "";
  if (!pie.startsWith(`${PROTOCOLO} · Rosetta Quantum · `) || !/ · https:\/\/rosettaquantum\.com\/\S+$/.test(pie)) fallas.push("pie: no es el pie fijo con la URL del dominio");
  if (/\p{Extended_Pictographic}/u.test(md)) fallas.push("tiene emojis");
  return fallas;
}
