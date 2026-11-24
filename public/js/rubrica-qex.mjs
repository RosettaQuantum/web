/*
 * La rúbrica maestra del QEX y de la nota Q-Ready, GENERADA DESDE EL CÓDIGO (18-nov-2026).
 * Encargo del 18-nov, aprobado por el dueño.
 *
 * Una fila por variable, más tres bloques: la fórmula del índice, la escala de letras y las clases de
 * nombres. Cada número sale de las constantes y funciones de qex-nucleo.mjs (PESOS, TOPE, REGLA_*,
 * ESCALA_NOTA, ALERTAS_NOTA, CONDICIONES_A, PAT, SENAL_PRUEBA, MAX_SONDEADOS…) y de la referencia por
 * sector; ninguno se escribe aquí. El texto que lee una persona vive en rubrica-textos.mjs (PROVISORIO).
 *
 * scripts/build-rubrica-qex.mjs escribe public/data/rubrica-qex.{json,es.csv,en.csv} y la lista de
 * textos para aprobar. scripts/check-rubrica-qex.mjs regenera y grita si lo publicado y el código
 * divergen, y sondea cada función en sus umbrales para que una regla cambiada a mano también grite.
 *
 * Funciones puras: corre en node y en el navegador. Sin fechas de generación: la salida es determinista.
 */
import * as NUCLEO from "./qex-nucleo.mjs";
import { textosRubrica, numRubrica, puntosRubrica } from "./rubrica-textos.mjs";

export const RUBRICA_PROTOCOLO = "rosetta-rubrica-qex/1";
export const SITE = "https://rosettaquantum.com";
export const RUBRICA_URL = { es: `${SITE}/es/metodologia/qex`, en: `${SITE}/methodology/qex` };
export const ARCHIVOS = { json: "/data/rubrica-qex.json", csv: { es: "/data/rubrica-qex.es.csv", en: "/data/rubrica-qex.en.csv" } };
export const COLUMNAS = ["version", "seccion", "id", "dimension", "variable", "observa", "fuente", "metodo", "tipo", "regla",
  "puntos_dimension", "peso", "puntos_qex", "efecto_nota", "desde", "norma", "frecuencia"];

// Las normas que la rúbrica cita: SÓLO las que el repo ya cita, con el archivo donde están. El guardia
// abre cada archivo y exige que la cita siga ahí. No se agrega una norma que no esté citada y verificada.
export const NORMAS = Object.freeze({
  ir8547: { etiqueta: "NIST IR 8547 (versión final, oct-2026)", etiqueta_en: "NIST IR 8547 (final version, Oct 2026)", citada_en: "public/js/medicion-envivo.mjs", busca: "NIST IR 8547 (oct-2026)" },
  fips203: { etiqueta: "FIPS 203 (ML-KEM)", etiqueta_en: "FIPS 203 (ML-KEM)", citada_en: "src/pages/informe-pqc/index.astro", busca: "ML-KEM (FIPS 203)" },
  // fips204: la cita vivía en QrLanding (la /q-ready vieja, retirada el 23-nov-2026); sigue en el informe PQC.
  fips204: { etiqueta: "FIPS 204 (ML-DSA)", etiqueta_en: "FIPS 204 (ML-DSA)", citada_en: "src/pages/informe-pqc/index.astro", busca: "ML-DSA · FIPS 204" },
  sp80057: { etiqueta: "NIST SP 800-57 pt. 1 rev. 5, tabla 2", etiqueta_en: "NIST SP 800-57 pt. 1 rev. 5, table 2", citada_en: "docs/fuentes/regla-llave-2026-11-18.md", busca: "Table 2: Comparable security strengths" },
  rfc8446: { etiqueta: "RFC 8446 (TLS 1.3)", etiqueta_en: "RFC 8446 (TLS 1.3)", citada_en: "lib/tls13-certificado.mjs", busca: "RFC 8446" },
  rfc9116: { etiqueta: "RFC 9116 (security.txt)", etiqueta_en: "RFC 9116 (security.txt)", citada_en: "src/pages/q-ready/spec/index.astro", busca: "RFC 9116" },
  rfc8032: { etiqueta: "RFC 8032 (Ed25519)", etiqueta_en: "RFC 8032 (Ed25519)", citada_en: "src/pages/q-ready/spec/index.astro", busca: "RFC 8032" },
});

const r2 = (v) => Math.round(v * 100) / 100;
const fmt = (v, idioma) => (v == null ? "—" : numRubrica(r2(v), idioma));
const conSigno = (v, idioma) => (v == null ? "—" : puntosRubrica(r2(v), idioma));

// Las palabras de una expresión de PAT, leídas de la propia expresión (no de una lista aparte).
export function palabrasDe(rx) {
  const m = /\(((?:[a-z0-9?*\\]+\|)+[a-z0-9?*\\]+)\)/.exec(rx.source);
  return m ? m[1].split("|") : [];
}

// cron: la expresión de triggers.crons de wrangler.jsonc ("17 9 * * *") → "09:17".
export function horaCron(cron) {
  const m = /^(\d+)\s+(\d+)\s/.exec(String(cron || ""));
  return m ? `${m[2].padStart(2, "0")}:${m[1].padStart(2, "0")}` : null;
}

// referencia: public/data/qex-referencia-<edición>.json. cron: triggers.crons[0] de wrangler.jsonc.
export function armarRubrica({ referencia, cron, idioma = "es", N = NUCLEO }) {
  const T = textosRubrica(idioma), F = T.filas, en = idioma === "en";
  const P = N.PESOS, RH = N.REGLA_HIGIENE, RC = N.REGLA_CERTIFICADOS, RE = N.REGLA_EDGE;
  const ed = referencia.edicion, hora = horaCron(cron);
  if (!hora) throw new Error(`cron ilegible: ${cron}`);
  const version = `${RUBRICA_PROTOCOLO} · ${N.VERSION_QEX} · ${N.VERSION_NOTA}`;
  const norma = (...ks) => ks.map((k) => (en ? NORMAS[k].etiqueta_en : NORMAS[k].etiqueta)).join("; ") || T.sin_norma;
  const minDim = numRubrica(N.NOTA_DIMENSION_MINIMA, idioma);
  const alerta = (c) => N.ALERTAS_NOTA.find((a) => a.codigo === c);
  const condA = (c) => N.CONDICIONES_A.find((a) => a.codigo === c);
  const esc = (r) => N.ESCALA_NOTA.find((e) => e.regla === r);
  const desde = (...vs) => [...new Set(vs.filter(Boolean))].join(" · ");
  // Las reglas que no cambiaron desde agosto rigen desde QEX-1.0; sólo la llave (RQ.S.02.1) rige desde la
  // vigente. El nombre sale de VERSIONES_QEX (el guardia exige que cada «rige desde» exista ahí).
  const Q10 = Object.keys(N.VERSIONES_QEX)[0];
  const fMed = T.frecuencia.medicion(hora), fEd = T.frecuencia.edicion(ed);
  const valoresHndl = Object.values(referencia.verticales).map((v) => v.hndl);
  const minH = Math.min(...valoresHndl), maxH = Math.max(...valoresHndl);
  const listaHndl = Object.entries(referencia.verticales).map(([, v]) => `${v.nombre} ${v.hndl}`).join(" · ");

  // {hv}: el nombre de la variante interna sale del núcleo, no se escribe en el texto
  const hv = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === "string" ? v.replaceAll("{hv}", N.VERSION_QEX_HV) : v]));
  const fila = (o) => hv({ version, seccion: T.seccion.variable, norma: T.sin_norma, frecuencia: fMed, peso: null, puntos_qex: "—", puntos_dimension: "—", ...o });
  const tipo = (t) => T.tipo[t];
  const filas = [];
  const dimRow = (id, clave, maxDim, extra) => fila({ id, dimension: T.dim[clave], variable: F[id].variable, observa: F[id].observa, metodo: F[id].metodo,
    peso: P[clave], ...extra });

  // RQ.S.00 · RQ.S.01
  filas.push(fila({ id: "RQ.S.00", dimension: T.dim.nota, variable: F["RQ.S.00"].variable, observa: F["RQ.S.00"].observa, fuente: T.fuente.codigo,
    metodo: F["RQ.S.00"].metodo, tipo: tipo("medido"), regla: F["RQ.S.00"].regla(), efecto_nota: F["RQ.S.00"].efecto(), desde: N.VERSION_NOTA }));
  filas.push(fila({ id: "RQ.S.01", dimension: T.dim.qex, variable: F["RQ.S.01"].variable, observa: F["RQ.S.01"].observa, fuente: T.fuente.codigo,
    metodo: F["RQ.S.01"].metodo, tipo: tipo("medido"), regla: F["RQ.S.01"].regla(N.TOPE), puntos_dimension: `0–100`, puntos_qex: `0–${N.TOPE}`,
    efecto_nota: F["RQ.S.01"].efecto(), desde: Q10 }));

  // RQ.S.02 · certificados
  filas.push(dimRow("RQ.S.02", "certificados", RC.pq, { fuente: T.fuente.tls_hoja, tipo: tipo("medido"), regla: F["RQ.S.02"].regla(RC.pq),
    puntos_dimension: `0–${RC.pq}`, puntos_qex: fmt(RC.pq * P.certificados, idioma), efecto_nota: F["RQ.S.02"].efecto(minDim),
    desde: desde(Q10, condA("dimensiones_medidas").desde) }));
  filas.push(fila({ id: "RQ.S.02.1", dimension: T.dim.certificados, variable: F["RQ.S.02.1"].variable, observa: F["RQ.S.02.1"].observa, fuente: T.fuente.tls_hoja,
    metodo: F["RQ.S.02.1"].metodo(RC), tipo: tipo("medido"), regla: F["RQ.S.02.1"].regla(RC), puntos_dimension: `${RC.pq} / ${RC.aprobada} / ${RC.bajo}`, peso: P.certificados,
    puntos_qex: `${fmt(RC.pq * P.certificados, idioma)} / ${fmt(RC.aprobada * P.certificados, idioma)} / ${fmt(RC.bajo * P.certificados, idioma)}`, efecto_nota: F["RQ.S.02.1"].efecto(),
    desde: N.VERSION_QEX, norma: norma("ir8547", "sp80057", "fips204") }));
  filas.push(fila({ id: "RQ.S.02.2", dimension: T.dim.certificados, variable: F["RQ.S.02.2"].variable, observa: F["RQ.S.02.2"].observa, fuente: T.fuente.tls_hoja,
    metodo: F["RQ.S.02.2"].metodo, tipo: tipo("medido"), regla: F["RQ.S.02.2"].regla(), puntos_dimension: "0", peso: P.certificados, puntos_qex: "0",
    efecto_nota: F["RQ.S.02.2"].efecto(), desde: desde(Q10, alerta("certificado_vencido").desde) }));
  filas.push(fila({ id: "RQ.S.02.3", dimension: T.dim.certificados, variable: F["RQ.S.02.3"].variable, observa: F["RQ.S.02.3"].observa, fuente: T.fuente.wellknown,
    metodo: F["RQ.S.02.3"].metodo, tipo: tipo("declarado"), regla: F["RQ.S.02.3"].regla(), puntos_dimension: "0", peso: P.certificados, puntos_qex: "0",
    efecto_nota: F["RQ.S.02.3"].efecto(), desde: alerta("certificado_sin_plan").desde, norma: norma("ir8547"), frecuencia: T.frecuencia.cron(hora) }));

  // RQ.S.03 · higiene
  filas.push(dimRow("RQ.S.03", "higiene", RH.base, { fuente: `${T.fuente.tls13}; ${T.fuente.ct}`, tipo: tipo("medido"), regla: F["RQ.S.03"].regla(RH),
    puntos_dimension: `${RH.piso}–${RH.base}`, puntos_qex: fmt(RH.base * P.higiene, idioma), efecto_nota: F["RQ.S.03"].efecto(minDim),
    desde: desde(Q10, condA("dimensiones_medidas").desde) }));
  filas.push(fila({ id: "RQ.S.03.1", dimension: T.dim.higiene, variable: F["RQ.S.03.1"].variable, observa: F["RQ.S.03.1"].observa, fuente: T.fuente.tls13,
    metodo: F["RQ.S.03.1"].metodo, tipo: tipo("medido"), regla: F["RQ.S.03.1"].regla(RH.sin_tls13), puntos_dimension: conSigno(RH.sin_tls13, idioma), peso: P.higiene,
    puntos_qex: conSigno(RH.sin_tls13 * P.higiene, idioma), efecto_nota: F["RQ.S.03.1"].efecto(), desde: desde(Q10, esc("sin_tls13").desde), norma: norma("rfc8446") }));
  for (const [id, k] of [["RQ.S.03.2", "no_productivo"], ["RQ.S.03.3", "infra_expuesta"], ["RQ.S.03.4", "legado"]]) {
    filas.push(fila({ id, dimension: T.dim.higiene, variable: F[id].variable, observa: F[id].observa, fuente: T.fuente.ct, metodo: F[id].metodo, tipo: tipo("medido"),
      regla: F[id].regla(RH[k]), puntos_dimension: conSigno(RH[k].puntos, idioma), peso: P.higiene, puntos_qex: conSigno(RH[k].puntos * P.higiene, idioma),
      efecto_nota: F[id].efecto(), desde: Q10 }));
  }
  filas.push(fila({ id: "RQ.S.03.5", dimension: T.dim.higiene, variable: F["RQ.S.03.5"].variable, observa: F["RQ.S.03.5"].observa, fuente: T.fuente.http_security,
    metodo: F["RQ.S.03.5"].metodo, tipo: tipo("medido"), regla: F["RQ.S.03.5"].regla(), puntos_dimension: "0", peso: P.higiene, puntos_qex: "0",
    efecto_nota: F["RQ.S.03.5"].efecto(), desde: Q10, norma: norma("rfc9116") }));

  // RQ.S.04 · HNDL: modelo del sector; sus tres números no existen como datos
  filas.push(dimRow("RQ.S.04", "hndl", maxH, { fuente: T.fuente.sector, tipo: tipo("modelo"), regla: F["RQ.S.04"].regla(listaHndl),
    puntos_dimension: `${minH}–${maxH}`, puntos_qex: `${fmt(minH * P.hndl, idioma)}–${fmt(maxH * P.hndl, idioma)}`, efecto_nota: F["RQ.S.04"].efecto(minDim),
    desde: desde(Q10, condA("dimensiones_medidas").desde), frecuencia: fEd }));
  for (const id of ["RQ.S.04.1", "RQ.S.04.2", "RQ.S.04.3"]) {
    filas.push(fila({ id, dimension: T.dim.hndl, variable: F[id].variable, observa: F[id].observa, fuente: T.fuente.sector, metodo: F.hndl_sin_derivacion(ed),
      tipo: tipo("modelo"), regla: F.hndl_regla_sub(), puntos_dimension: "—", peso: P.hndl, puntos_qex: "—", efecto_nota: "—", desde: Q10, frecuencia: fEd }));
  }

  // RQ.S.05 · borde
  filas.push(dimRow("RQ.S.05", "edge", RE.soporta, { fuente: T.fuente.tls_borde, tipo: tipo("medido"), regla: F["RQ.S.05"].regla(RE.soporta),
    puntos_dimension: `${RE.no_soporta}–${RE.soporta}`, puntos_qex: fmt(RE.soporta * P.edge, idioma), efecto_nota: F["RQ.S.05"].efecto(), desde: Q10 }));
  filas.push(fila({ id: "RQ.S.05.1", dimension: T.dim.edge, variable: F["RQ.S.05.1"].variable, observa: F["RQ.S.05.1"].observa, fuente: T.fuente.tls_borde,
    metodo: F["RQ.S.05.1"].metodo, tipo: tipo("medido"), regla: F["RQ.S.05.1"].regla(RE), puntos_dimension: `${RE.soporta} / ${RE.no_soporta}`, peso: P.edge,
    puntos_qex: `${fmt(RE.soporta * P.edge, idioma)} / ${fmt(RE.no_soporta * P.edge, idioma)}`, efecto_nota: F["RQ.S.05.1"].efecto(),
    desde: desde(Q10, esc("sin_candado").desde), norma: norma("fips203") }));
  filas.push(fila({ id: "RQ.S.05.2", dimension: T.dim.edge, variable: F["RQ.S.05.2"].variable, observa: F["RQ.S.05.2"].observa, fuente: T.fuente.tls_borde,
    metodo: F["RQ.S.05.2"].metodo, tipo: tipo("medido"), regla: F["RQ.S.05.2"].regla(), puntos_dimension: "0", peso: P.edge, puntos_qex: "0",
    efecto_nota: F["RQ.S.05.2"].efecto(), desde: Q10, norma: norma("fips203") }));
  filas.push(fila({ id: "RQ.S.05.3", dimension: T.dim.edge, variable: F["RQ.S.05.3"].variable, observa: F["RQ.S.05.3"].observa, fuente: T.fuente.tls_nombres,
    metodo: F["RQ.S.05.3"].metodo, tipo: tipo("medido"), regla: F["RQ.S.05.3"].regla(), puntos_dimension: "0", peso: P.edge, puntos_qex: "0",
    efecto_nota: F["RQ.S.05.3"].efecto(), desde: condA("candado_en_todos").desde, norma: norma("fips203") }));

  // RQ.S.06 · correo: se mide, no suma
  filas.push(fila({ id: "RQ.S.06", dimension: T.dim.correo, variable: F["RQ.S.06"].variable, observa: F["RQ.S.06"].observa, fuente: T.fuente.mx,
    metodo: F["RQ.S.06"].metodo, tipo: tipo("medido"), regla: F["RQ.S.06"].regla(), efecto_nota: F["RQ.S.06"].efecto(), desde: "—", norma: norma("fips203") }));

  // RQ.S.09.n · superficie: lo que decide alertas de la nota
  const sup = [
    ["RQ.S.09.1", desde(alerta("ambiente_pruebas_expuesto").desde, "QREADY-NOTA-2"), `${T.fuente.tls_nombres}; ${T.fuente.http_raiz}`],
    ["RQ.S.09.2", alerta("ambiente_pruebas_publicado_bloqueado").desde, `${T.fuente.tls_nombres}; ${T.fuente.http_raiz}`],
    ["RQ.S.09.3", alerta("ambiente_pruebas_publicado").desde, T.fuente.tls_nombres],
    ["RQ.S.09.4", alerta("infraestructura_expuesta").desde, T.fuente.tls_nombres],
    ["RQ.S.09.5", alerta("nombre_sin_dueno").desde, T.fuente.tls_nombres],
    ["RQ.S.09.6", alerta("correo_responde_443").desde, T.fuente.tls_nombres],
    ["RQ.S.09.7", condA("sensibles_sondeados").desde, `${T.fuente.ct}; ${T.fuente.dns}`],
  ];
  for (const [id, d, fuente] of sup) {
    const m = F[id].metodo;
    filas.push(fila({ id, dimension: T.dim.superficie, variable: F[id].variable, observa: F[id].observa, fuente, metodo: typeof m === "function" ? m(N.MAX_SONDEADOS) : m,
      tipo: tipo("medido"), regla: F[id].regla(), efecto_nota: F[id].efecto(), desde: d }));
  }
  filas.push(fila({ id: "RQ.S.13", dimension: T.dim.registro, variable: F["RQ.S.13"].variable, observa: F["RQ.S.13"].observa, fuente: T.fuente.ct,
    metodo: F["RQ.S.13"].metodo, tipo: tipo("medido"), regla: F["RQ.S.13"].regla(), efecto_nota: F["RQ.S.13"].efecto(), desde: condA("superficie").desde }));
  // A+: lo declarado
  filas.push(fila({ id: F.wellknown.id, dimension: T.dim.a_mas, variable: F.wellknown.variable, observa: F.wellknown.observa, fuente: T.fuente.wellknown,
    metodo: F.wellknown.metodo, tipo: tipo("declarado"), regla: F.wellknown.regla(), efecto_nota: F.wellknown.efecto(), desde: esc("a_mas").desde,
    norma: norma("rfc8032"), frecuencia: T.frecuencia.cron(hora) }));
  filas.push(fila({ id: F.inventario.id, dimension: T.dim.a_mas, variable: F.inventario.variable, observa: F.inventario.observa, fuente: T.fuente.revision,
    metodo: F.inventario.metodo, tipo: tipo("declarado"), regla: F.inventario.regla(), efecto_nota: F.inventario.efecto(), desde: esc("a_mas").desde,
    frecuencia: T.frecuencia.manual }));

  // ---- bloque 2 · la fórmula, con sus números calculados por el núcleo
  const bloque = (seccion, id, variable, regla, d, extra = {}) => hv({ ...Object.fromEntries(COLUMNAS.map((c) => [c, "—"])), version, seccion, id, variable, regla, desde: d, ...extra });
  const pesos = Object.entries(P).map(([k, p]) => `${T.dim[k]} ${numRubrica(p, idioma)}`).join(" · ");
  const ejemplo = 56.5;
  const maximos = [...new Set(valoresHndl)].sort((a, b) => a - b)
    .map((h) => `HNDL ${h} → ${N.irec({ certificados: RC.pq, higiene: RH.base, hndl: h, edge: RE.soporta })}`).join(" · ");
  const sF = T.seccion.formula, Fo = T.formula;
  const formula = [
    bloque(sF, "F.1", T.dim.qex, Fo.dimension(pesos), Q10),
    bloque(sF, "F.2", T.dim.qex, Fo.suma(), Q10),
    bloque(sF, "F.3", T.dim.qex, Fo.renormaliza(), Q10),
    bloque(sF, "F.4", T.dim.qex, Fo.redondeo(numRubrica(ejemplo, idioma), N.redondearPar(ejemplo)), Q10),
    bloque(sF, "F.5", T.dim.qex, Fo.tope(N.TOPE), Q10),
    bloque(sF, "F.6", T.dim.qex, Fo.maximo(maximos), Q10),
  ];

  // ---- bloque 3 · la escala de letras (ESCALA_NOTA), los niveles de alerta y las condiciones de A
  const E = T.escala;
  const escala = N.ESCALA_NOTA.map((e, i) => bloque(T.seccion.escala, `E.${i + 1}`, e.nota ?? E.sin_nota, E[e.regla](), e.desde, { efecto_nota: e.nota ?? E.sin_nota }));
  const alertas = N.ALERTAS_NOTA.map((a) => bloque(T.seccion.alerta, `AL.${a.codigo}`, T.alerta[a.codigo],
    `${T.nivel[a.nivel]}${a.techo_b ? ` · ${T.techo_b}` : ""}`, a.desde, { efecto_nota: T.nivel[a.nivel] }));
  const condiciones = N.CONDICIONES_A.map((c, i) => bloque(T.seccion.condicion_a, `A.${i + 1}`, "A",
    T.condicion_a[c.codigo](minDim), c.desde));

  // ---- bloque 4 · PAT, la señal de ambientes de prueba y los nombres de correo
  const Pt = T.pat, sP = T.seccion.pat;
  const pat = [
    ...Object.keys(N.PAT).map((k) => bloque(sP, `PAT.${k}`, Pt[k], `${Pt.palabras(palabrasDe(N.PAT[k]).join(", "))} ${Pt.regla_rx(N.PAT[k].source)}`, Q10)),
    bloque(sP, "PAT.senal_prueba", Pt.senal_prueba, `${Pt.palabras(palabrasDe(N.SENAL_PRUEBA).join(", "))} ${Pt.calza} ${Pt.regla_rx(N.SENAL_PRUEBA.source)}`, "QREADY-NOTA-2"),
    bloque(sP, "PAT.correo", Pt.correo, `${Pt.palabras(palabrasDe(N.PAT_CORREO).join(", "))} ${Pt.regla_rx(N.PAT_CORREO.source)}`, Q10),
    bloque(sP, "PAT.sondeo", Pt.sondeo, Pt.sensibles(N.CLASES_SENSIBLES.join(", "), N.MAX_SONDEADOS), "QREADY-NOTA-2"),
  ];
  return { protocolo: RUBRICA_PROTOCOLO, version, idioma, rige: { qex: N.VERSION_QEX, qex_interno: N.VERSION_QEX_HV, nota: N.VERSION_NOTA },
    referencia: ed, filas, formula, escala, alertas, condiciones_a: condiciones, pat };
}

// ---------------------------------------------------------------- CSV (RFC 4180, con BOM para Excel)
const campo = (v) => { const s = v == null ? "" : typeof v === "number" ? String(v) : String(v); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export function aCSV(r) {
  const T = textosRubrica(r.idioma);
  const filas = [...r.filas, ...r.formula, ...r.escala, ...r.alertas, ...r.condiciones_a, ...r.pat];
  const lineas = [COLUMNAS.map((c) => campo(T.col[c])).join(","),
    ...filas.map((f) => COLUMNAS.map((c) => campo(c === "peso" ? (f.peso == null ? "—" : numRubrica(f.peso, r.idioma)) : f[c])).join(","))];
  return "﻿" + lineas.join("\r\n") + "\r\n";
}

// La escala, para pintarla (ficha, /protocolo/ficha y la página de la rúbrica): [{nota, regla, condicion, desde}].
export function escalaPublicada(idioma = "es", N = NUCLEO) {
  const T = textosRubrica(idioma);
  return N.ESCALA_NOTA.map((e) => ({ nota: e.nota ?? T.escala.sin_nota, regla: e.regla, condicion: T.escala[e.regla](), desde: e.desde }));
}
