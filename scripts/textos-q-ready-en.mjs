#!/usr/bin/env node
// Genera docs/textos-provisorios-q-ready-en.md desde src/lib/puerta-textos.mjs: la tabla español ↔ inglés de
// la portada de seguridad, para que Nicholas apruebe EXACTAMENTE lo que se sirve (23-nov-2026).
//   node scripts/textos-q-ready-en.mjs
import { writeFileSync, readFileSync } from "node:fs";
import { TEXTOS_PUERTA, EN_DE_LA_PAGINA_RETIRADA } from "../src/lib/puerta-textos.mjs";
import { textosGaleria, ARCHIVO, DIR } from "../src/lib/textos-galeria.mjs";

const filas = [];
const recorrer = (es, en, ruta) => {
  if (typeof es === "string") { filas.push([ruta, es, en]); return; }
  if (Array.isArray(es)) { es.forEach((v, i) => recorrer(v, en[i], `${ruta}[${i + 1}]`)); return; }
  for (const k of Object.keys(es)) recorrer(es[k], en[k], ruta ? `${ruta}.${k}` : k);
};
recorrer(TEXTOS_PUERTA.es, TEXTOS_PUERTA.en, "");

const celda = (t) => String(t).replace(/\|/g, "\\|");
const NUEVO_EN_LOS_DOS = new Set(["carrusel.anterior", "carrusel.siguiente"]);
const estado = (clave, es, en) => {
  if (clave.startsWith("rutas.")) return "ruta (no es texto)";
  if (es === en) return "igual en los dos idiomas";
  if (NUEVO_EN_LOS_DOS.has(clave)) return "**PROVISORIO** · nuevo también en español";
  if (EN_DE_LA_PAGINA_RETIRADA.has(en)) return "**PROVISORIO** · igual a la /q-ready retirada (sin aprobación registrada)";
  return "**PROVISORIO**";
};

const T = textosGaleria(readFileSync(DIR + ARCHIVO, "utf8"));
const md = `# Portada de seguridad en inglés (/q-ready) · textos PROVISORIOS para aprobar

Generado por \`node scripts/textos-q-ready-en.mjs\` desde \`src/lib/puerta-textos.mjs\`. Lo que se apruebe aquí es
literalmente lo que se sirve. 23-nov-2026.

**Qué es.** /q-ready pasa a ser la misma portada que /es/q-ready (el mismo componente, con \`lang="en"\`), y la
/q-ready vieja (identidad retirada, \`noindex\`) se retira. La columna «español» es el texto que ya está publicado
en /es/q-ready y **no cambia**; la columna «inglés» es nueva.

**Ya aprobados (no se repiten aquí):** el botón «Security» del menú, la tarjeta de la guía y la tarjeta del informe
en inglés, sellados el 23-nov en \`src/data/publicaciones/textos-aprobados/\` («Sí, así»). La tarjeta del informe en
inglés dice que el informe está en español: «${T.informeEn.enlace} →». El nombre accesible del carrusel es el título
aprobado de la galería: «${T.galeria.es.titulo}» / «${T.galeria.en.titulo}».

**No hay textos en inglés aprobados para esta portada en el repositorio** (busqué en el código, en docs/ y en los
documentos de aprobados; el handoff de la maqueta v20 no está en el repositorio). Tres frases en inglés coinciden con la /q-ready retirada; van marcadas, pero tampoco
consta que se hayan aprobado.

**Fuera de esta tabla, a propósito:** el bloque de cifras del informe y la opción «informe» del diálogo, que
están apagados (\`INFORME_PUBLICO = false\`) y, como el informe existe sólo en español, no se pintan en inglés.
Las notas internas que el formulario manda a hello@ siguen en español.

‹…› es un dato que se llena al construir (cifras de la edición, años, dominio).

| clave | español (publicado) | inglés (nuevo) | estado |
|---|---|---|---|
${filas.map(([k, es, en]) => `| \`${k}\` | ${celda(es)} | ${celda(en)} | ${estado(k, es, en)} |`).join("\n")}
`;
// --verificar: lo que el código sirve HOY tiene que ser byte a byte la tabla que Nicholas aprobó el 23-nov
// («Textos OK, súbelo»), sellada en src/data/q-ready/textos-aprobados/ con su sha256 en APROBADOS.json.
// Un texto nuevo es una tabla nueva y una aprobación nueva, no una edición de ésta.
const SELLADO = "src/data/q-ready/textos-aprobados/TEXTOS-q-ready-en-2026-11-23.md";
if (process.argv.includes("--verificar")) {
  const sellado = readFileSync(SELLADO, "utf8");
  const difiere = (a, b) => { const x = a.split("\n"), y = b.split("\n"); for (let i = 0; i < Math.max(x.length, y.length); i++) if (x[i] !== y[i]) return i + 1; return 0; };
  // grito: una mutación de un carácter en un texto servido tiene que detectarse
  const mutada = md.replace("Measure my domain now", "Measure my domain now!");
  if (mutada === md || !difiere(mutada, sellado)) { console.log("FALLA autoprueba: la mutación no entró o no se detecta"); process.exit(1); }
  const linea = difiere(md, sellado);
  if (linea) { console.log(`FALLA textos de /q-ready distintos de los aprobados (${SELLADO}), primera diferencia en la línea ${linea}:\n  servido:  ${md.split("\n")[linea - 1]}\n  aprobado: ${sellado.split("\n")[linea - 1]}`); process.exit(1); }
  console.log(`textos-q-ready-en --verificar: ok · ${filas.length} filas servidas = las aprobadas · la mutación grita`);
  process.exit(0);
}
writeFileSync("docs/textos-provisorios-q-ready-en.md", md);
console.log(`docs/textos-provisorios-q-ready-en.md: ${filas.length} filas`);
