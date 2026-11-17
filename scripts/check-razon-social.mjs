/*
 * La razón social no aparece en lo público fuera de los documentos legales (17-nov-2026).
 *
 * Regla de Nicholas: Rosetta se presenta como «una unidad de Sumeria», no por su razón social.
 * Los documentos legales (términos, privacidad, reembolsos, precio con el comerciante registrado)
 * SÍ la nombran: ahí identificar a la entidad es una obligación, no una presentación.
 * Precisión antes que cobertura: la lista de excepciones es cerrada y por archivo.
 */
export const CONSUMIDOR = { quien: "el prebuild (bloquea el deploy) y quien escriba un pie o una firma", hace: "cambia la razón social por «una unidad de Sumeria», salvo en un documento legal" };
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const RAIZ = new URL("..", import.meta.url).pathname;
const LEGALES = new Set([
  "src/pages/terms.astro", "src/pages/es/terminos.astro", "src/pages/privacy.astro", "src/pages/es/privacidad.astro",
]);
const esLegal = (rel) => LEGALES.has(rel) || rel.startsWith("src/aprobado/legal/") || /^src\/aprobado\/pricing/.test(rel);
const PATRON = /blue\s+tuna/i;

function recorrer(dir, fuera = []) {
  for (const n of readdirSync(join(RAIZ, dir))) {
    const rel = join(dir, n);
    if (/node_modules|^dist|\.git/.test(rel)) continue;
    const st = statSync(join(RAIZ, rel));
    if (st.isDirectory()) recorrer(rel, fuera);
    else if (/\.(astro|html|mjs|js|ts|md|json)$/.test(n)) fuera.push(rel);
  }
  return fuera;
}

export function revisar(archivos, leer) {
  return archivos.filter((rel) => !esLegal(rel) && PATRON.test(leer(rel)));
}

const autoprueba = () => {
  const mem = { "src/components/Pie.astro": "Rosetta Quantum es una marca de Blue Tuna SpA.", "src/pages/es/terminos.astro": "Blue Tuna SpA, sociedad", "src/x.astro": "una unidad de Sumeria" };
  const malos = revisar(Object.keys(mem), (r) => mem[r]);
  if (malos.length !== 1 || malos[0] !== "src/components/Pie.astro") throw new Error("autoprueba: el guardia no distingue legal de público " + JSON.stringify(malos));
};
autoprueba();

const archivos = [...recorrer("src"), ...recorrer("public")];
const malos = revisar(archivos, (rel) => readFileSync(join(RAIZ, rel), "utf8"));
if (malos.length) { console.error("check-razon-social: FALLA, la razón social aparece fuera de lo legal en:\n  " + malos.join("\n  ")); process.exit(1); }
console.log(`check-razon-social: ok (${archivos.length} archivos, ${LEGALES.size} páginas legales exceptuadas)`);
