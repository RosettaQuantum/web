// Mutaciones reales para los guardias (13-nov-2026). Copia el archivo con UN cambio a un hermano
// temporal (así sus imports relativos siguen resolviendo), lo importa, corre la prueba y lo borra.
// La mutación AFIRMA que cambió el archivo: si el texto a reemplazar no está exactamente una vez,
// falla — un mutante que no entra parece un guardia mudo.
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, basename, join } from "node:path";

export async function conMutante(urlArchivo, de, a, prueba) {
  const ruta = fileURLToPath(urlArchivo);
  const original = readFileSync(ruta, "utf8");
  const veces = original.split(de).length - 1;
  if (veces !== 1) throw new Error(`mutación en ${basename(ruta)}: el texto a cambiar aparece ${veces} veces (tiene que ser 1): ${de.slice(0, 80)}`);
  const mutado = original.replace(de, () => a);
  if (mutado === original) throw new Error(`mutación en ${basename(ruta)}: no cambió nada`);
  const tmp = join(dirname(ruta), `.${basename(ruta, ".mjs")}.mutante-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  writeFileSync(tmp, mutado);
  try { return await prueba(await import(pathToFileURL(tmp).href), mutado); }
  finally { rmSync(tmp, { force: true }); }
}
