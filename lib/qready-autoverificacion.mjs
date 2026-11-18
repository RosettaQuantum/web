// La nota de autoverificación de /verificado/rosettaquantum.com (18-nov-2026).
//
// POR QUÉ EXISTE. El A+ de rosettaquantum.com incluye una revisión del inventario interno de criptografía
// que hizo la propia Rosetta: somos juez y parte, y la página tiene que decirlo. Aprobado por Nicholas el
// 18-nov-2026 («Sí, así»), en español y en inglés.
//
// CÓMO VIAJA EL TEXTO. Sellado por archivo, como los textos del informe (src/data/informe-pqc/textos/):
// src/data/q-ready/autoverificacion/{es,en}.md con su sha256 y su aprobado_por en APROBADOS.json. El Worker
// los recibe como texto (regla Text de wrangler.jsonc, lib/qready-rutas.mjs); los guardias, del disco.
// Nada de la frase se escribe aquí. La fecha sale de qready_dominios.inventario_verificado_en y las cifras
// de lib/datos/inventario-rosetta.json; el texto sólo trae los huecos {fecha} {filas} {medidas} {no_medidas}.
//
// CUÁNDO SE MUESTRA. Sólo si el dominio es rosettaquantum.com Y la letra es A+. Si un día la regla de la
// nota cambia, la condición es la misma letra que pinta la página, no otra cuenta.
// scripts/check-qready-autoverificacion.mjs: grito, silencio y mutaciones.
import DATOS from "./datos/inventario-rosetta.json" with { type: "json" };

export const DOMINIO_PROPIO = "rosettaquantum.com";
const HUECOS = ["fecha", "filas", "medidas", "no_medidas"];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ¿Lleva la nota esta página? Una sola regla, la usa cuerpoVerificado y la ejerce el guardia.
export const llevaAutoverificacion = (dominio, nota) => dominio === DOMINIO_PROPIO && nota === "A+";

// Rellena los huecos y pasa el **negrita** del .md a <strong>. Falla cerrado: un hueco que falta, que
// sobra o un dato ausente es un error, no una frase a medias.
export function textoAutoverificacion(md, inventarioVerificadoEn, datos = DATOS) {
  if (typeof md !== "string" || !md.trim()) throw new Error("autoverificación: falta el texto aprobado");
  const fecha = String(inventarioVerificadoEn || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error("autoverificación: inventario_verificado_en no es una fecha");
  const valores = { fecha, filas: datos.filas, medidas: datos.medidas, no_medidas: datos.no_medidas };
  for (const k of ["filas", "medidas", "no_medidas"]) if (!Number.isInteger(valores[k])) throw new Error(`autoverificación: ${k} no es un entero`);
  if (valores.medidas + valores.no_medidas !== valores.filas) throw new Error("autoverificación: medidas + no medidas no da el total");
  let t = md.trim();
  for (const k of HUECOS) {
    const veces = t.split(`{${k}}`).length - 1;
    if (veces !== 1) throw new Error(`autoverificación: el hueco {${k}} aparece ${veces} veces`);
    t = t.replace(`{${k}}`, String(valores[k]));
  }
  if (/\{[a-z_]+\}/.test(t)) throw new Error("autoverificación: queda un hueco sin rellenar");
  return t;
}

export function htmlAutoverificacion(md, inventarioVerificadoEn, datos = DATOS) {
  const t = textoAutoverificacion(md, inventarioVerificadoEn, datos);
  const html = esc(t).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  return `<p class="qv-lee qv-autoverificacion" data-autoverificacion="${esc(String(inventarioVerificadoEn).slice(0, 10))}">${html}</p>`;
}
