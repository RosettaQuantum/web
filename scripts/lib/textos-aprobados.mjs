// Los textos aprobados que viajan SELLADOS por archivo (18-nov-2026): src/data/q-ready/textos-aprobados/,
// copia byte a byte del documento que aprobó el dueño, con su sha256 en APROBADOS.json. Este módulo sólo
// los LEE (no los reescribe): de ahí salen las frases que el código tiene que llevar letra por letra.
// Lo usa scripts/check-textos-aprobados.mjs. Falla cerrado: una sección o una línea que no aparece lanza.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

export const DIR = "src/data/q-ready/textos-aprobados/";
const raiz = new URL("../../", import.meta.url);
export const leerBytes = (archivo) => readFileSync(new URL(DIR + archivo, raiz));
export const sha256 = (b) => createHash("sha256").update(b).digest("hex");
export const aprobados = () => JSON.parse(readFileSync(new URL(DIR + "APROBADOS.json", raiz), "utf8"));

// «## es» / «## en» y, dentro, «- **A:** texto». Devuelve { es: { A, B }, en: { A, B } }.
export function lecturasAB(md) {
  const out = {};
  for (const lang of ["es", "en"]) {
    const i = md.indexOf(`\n## ${lang}\n`);
    if (i < 0) throw new Error(`falta la sección «## ${lang}»`);
    const j = md.indexOf("\n## ", i + 1);
    const sec = md.slice(i, j < 0 ? md.length : j);
    out[lang] = {};
    for (const k of ["A", "B"]) {
      const m = new RegExp(`^- \\*\\*${k}:\\*\\* (.+)$`, "m").exec(sec);
      if (!m) throw new Error(`falta la lectura ${k} en «## ${lang}»`);
      out[lang][k] = m[1];
    }
  }
  return out;
}

// El párrafo que sigue a «## La frase».
export function fraseHndl(md) {
  const m = /\n## La frase\n\n([^\n]+)\n/.exec(md);
  if (!m) throw new Error("falta «## La frase»");
  return m[1];
}

// TEXTOS-para-aprobar-2026-11-18.md (aprobados los textos 2, 3 y 4): la celda de la fila «| **etiqueta** | … |»
// dentro de la sección «### n · …». Una etiqueta que no aparece EXACTA en su sección lanza.
export function celda(md, seccion, etiqueta) {
  const i = md.indexOf(`\n### ${seccion} ·`);
  if (i < 0) throw new Error(`falta la sección «### ${seccion} ·»`);
  const j = md.indexOf("\n### ", i + 1);
  const sec = md.slice(i, j < 0 ? md.length : j);
  const filas = sec.split("\n").filter((l) => l.startsWith(`| **${etiqueta}** | `));
  if (filas.length !== 1) throw new Error(`sección ${seccion}: la fila «${etiqueta}» aparece ${filas.length} veces`);
  const m = /^\| \*\*[^*]+\*\* \| (.+) \|$/.exec(filas[0]);
  if (!m) throw new Error(`sección ${seccion}: la fila «${etiqueta}» no tiene la forma | **etiqueta** | texto |`);
  return m[1];
}
export function textos234(md) {
  return {
    hndl_en: celda(md, 2, "Inglés (nuevo)"),
    tope: { es: celda(md, 3, "Español"), en: celda(md, 3, "Inglés") },
    llave: { metodo: { es: celda(md, 4, "Método, diría"), en: celda(md, 4, "Method, would read") },
      regla: { es: celda(md, 4, "Regla, diría"), en: celda(md, 4, "Rule, would read") } },
  };
}
