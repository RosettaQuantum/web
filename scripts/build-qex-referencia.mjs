#!/usr/bin/env node
/**
 * La referencia por sector de la medición, derivada de la ÚLTIMA edición publicada del informe (24-nov-2026).
 *
 * EL DEFECTO REAL. El 24-nov la medición de un banco (MCP, /v1/medicion y /es/q-ready/medicion) citaba
 * «mediana banca 57 (12 orgs, edición 2026-08)» cuando la edición publicada era la 02 · 2026-11: banca 56 con
 * 17 organizaciones, nacional 58. La referencia era public/data/qex-referencia-2026-08.json, copiada a mano
 * una vez y nunca más tocada.
 *
 * AHORA. Este script escribe public/data/qex-referencia-vigente.json desde:
 *  · la última edición con `borrador === false` en src/data/informe-pqc/ (la misma regla de /informe-pqc y de
 *    llms.txt: si el JSON no dice false, es borrador): n y mediana nacional, mediana y n por sector
 *    (indice.verticales: indice y norg) y la mediana nacional por dimensión (indice.dimensiones);
 *  · la tabla del MODELO HNDL por sector (valor y nombre del sector), que NO es una estadística de la edición:
 *    se fijó en la edición 2026-08 y sale de public/data/qex-referencia-2026-08.json. Por eso la referencia
 *    lleva dos ediciones: `edicion` (las medianas) y `hndl_edicion` (el modelo).
 *  · p25 y p75 quedan null: la edición no publica cuartiles por sector (null = no publicado, nunca 0).
 * La página (fetch) y el servidor (import) leen ESE archivo: un solo cambio para las dos.
 *
 *   node scripts/build-qex-referencia.mjs             escribe el archivo
 *   node scripts/build-qex-referencia.mjs --verificar  (prebuild) falla si el archivo no es lo que da la edición
 *                                                       vigente, o si la regla no reproduce la de agosto
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";

const raiz = new URL("../", import.meta.url);
const leer = (r) => readFileSync(new URL(r, raiz), "utf8");
export const SALIDA = "public/data/qex-referencia-vigente.json";
export const MODELO_HNDL = "public/data/qex-referencia-2026-08.json";
const DIR = "src/data/informe-pqc/";
const DIM = { cert: "certificados", higiene: "higiene", hndl: "hndl", edge: "edge" };

export const CONSUMIDOR = { quien: "sesión web de Rosetta, al publicar una edición del informe", hace: "corre `node scripts/build-qex-referencia.mjs` y sube public/data/qex-referencia-vigente.json con la edición" };

// La última edición publicada: `borrador === false`, slug mayor (falla cerrado: sin publicada, lanza).
export function ultimaPublicada(dir = DIR) {
  const eds = readdirSync(new URL(dir, raiz)).filter((f) => /^\d{4}-\d{2}\.json$/.test(f)).sort().reverse();
  for (const f of eds) {
    const texto = leer(dir + f), d = JSON.parse(texto);
    if (d.borrador === false) return { slug: f.replace(/\.json$/, ""), archivo: dir + f, d };
  }
  throw new Error("no hay ninguna edición publicada del informe (borrador === false)");
}

// La referencia, pura: edición + modelo HNDL → objeto. Lanza si los sectores no coinciden (un sector sin
// mediana o sin modelo no se inventa).
export function referenciaDe(ed, modelo, { slug, archivo }) {
  const ix = ed.indice;
  if (!ix || !Array.isArray(ix.verticales)) throw new Error(`${archivo}: sin indice.verticales`);
  const porId = Object.fromEntries(ix.verticales.map((v) => [v.id, v]));
  const claves = Object.keys(modelo.verticales);
  const sobran = Object.keys(porId).filter((k) => !claves.includes(k)), faltan = claves.filter((k) => !porId[k]);
  if (sobran.length || faltan.length) throw new Error(`sectores distintos entre ${archivo} y el modelo HNDL: sobran ${sobran}, faltan ${faltan}`);
  const dims = {};
  for (const d of ix.dimensiones || []) if (DIM[d.id]) dims[DIM[d.id]] = d.mediana ?? null;
  // 25-nov-2026: la HNDL es un valor asignado por sector (modelo), no una medición: su «mediana nacional» no
  // compara nada con un dominio (fintech 65 contra «país 12»). Va null en la página y en el MCP.
  if ("hndl" in dims) dims.hndl = null;
  const verticales = {};
  for (const k of claves) {
    const v = porId[k], m = modelo.verticales[k];
    if (!Number.isFinite(v.indice) || !Number.isInteger(v.norg)) throw new Error(`${archivo}: el sector ${k} no trae indice y norg`);
    verticales[k] = { nombre: m.nombre, n: v.norg, mediana: v.indice, p25: null, p75: null, hndl: m.hndl };
  }
  return {
    edicion: slug,
    fuente: `${archivo} (indice: ${ix.n} organizaciones chilenas; sólo agregados)`,
    n: ix.n, mediana_pais: ix.mediana,
    mediana_pais_dimension: dims,
    cuartiles: "La edición no publica cuartiles por sector: p25 y p75 van null (no publicado).",
    hndl_edicion: modelo.edicion,
    hndl_fuente: MODELO_HNDL,
    hndl_es_modelo: modelo.hndl_es_modelo,
    generado_por: "scripts/build-qex-referencia.mjs",
    verticales,
  };
}

export const serializar = (o) => JSON.stringify(o, null, 2) + "\n";

if (import.meta.url === `file://${process.argv[1]}`) {
  const modelo = JSON.parse(leer(MODELO_HNDL));
  const ult = ultimaPublicada();
  const ref = referenciaDe(ult.d, modelo, ult);
  if (!process.argv.includes("--verificar")) {
    writeFileSync(new URL(SALIDA, raiz), serializar(ref));
    console.log(`build-qex-referencia: ${SALIDA} desde ${ult.archivo} (banca ${ref.verticales.banca.mediana} · ${ref.verticales.banca.n} orgs · nacional ${ref.mediana_pais})`);
  } else {
    const fallas = [];
    let actual = null;
    try { actual = leer(SALIDA); } catch { fallas.push(`${SALIDA} no existe`); }
    if (actual != null && actual !== serializar(ref)) fallas.push(`${SALIDA} no es lo que da la edición vigente ${ult.slug}: corra node scripts/build-qex-referencia.mjs`);
    // La regla reproduce la referencia de agosto desde la edición de agosto (n, medianas, nacional, dimensiones).
    const ago = referenciaDe(JSON.parse(leer(DIR + "2026-08.json")), modelo, { slug: "2026-08", archivo: DIR + "2026-08.json" });
    if (ago.n !== modelo.n || ago.mediana_pais !== modelo.mediana_pais) fallas.push("la regla no reproduce n o la mediana nacional de agosto");
    for (const [k, v] of Object.entries(modelo.verticales))
      // la edición publica la mediana entera; la referencia de agosto traía un decimal (telecom 51,5 → 51)
      if (ago.verticales[k].n !== v.n || Math.abs(ago.verticales[k].mediana - v.mediana) > 0.5)
        fallas.push(`la regla no reproduce agosto en ${k}: ${ago.verticales[k].n}/${ago.verticales[k].mediana} contra ${v.n}/${v.mediana}`);
    for (const [k, v] of Object.entries(modelo.mediana_pais_dimension))
      if (k !== "hndl" && ago.mediana_pais_dimension[k] !== v) fallas.push(`la regla no reproduce la mediana nacional de ${k} en agosto`);
    // El archivo vigente dice la edición de la que salió y su HNDL es el modelo, sin tocar.
    if (actual != null) {
      const a = JSON.parse(actual);
      if (a.edicion !== ult.slug) fallas.push(`edicion ${a.edicion} ≠ última publicada ${ult.slug}`);
      for (const [k, v] of Object.entries(modelo.verticales)) if (a.verticales[k]?.hndl !== v.hndl) fallas.push(`el HNDL de ${k} no es el del modelo`);
    }
    if (fallas.length) { for (const f of fallas) console.error("  ✗ " + f); console.error(`build-qex-referencia --verificar: ${fallas.length} falla(s)`); process.exit(1); }
    console.log(`build-qex-referencia --verificar: ok (${SALIDA} = edición ${ult.slug} · banca ${ref.verticales.banca.mediana}/${ref.verticales.banca.n} · nacional ${ref.mediana_pais} · la regla reproduce agosto · HNDL del modelo ${modelo.edicion})`);
  }
}
