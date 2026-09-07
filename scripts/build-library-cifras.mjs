/**
 * Genera src/data/library-cifras.json — las cifras del catalogo que /library hornea.
 *
 * POR QUE HORNEADAS Y NO EN VIVO: el catalogo completo son 241 KB por /v1/algorithms.
 * Pedirlos en cada visita a la Biblioteca para pintar cuatro numeros es cobrarle al
 * lector el peso de todo el archivo. Y no hace falta: el catalogo es una INSTANTANEA
 * sellada del Quantum Algorithm Zoo (sha256 en la cabecera del seed), no un dato vivo.
 * Lo que SI esta vivo —los 16 claims y cuantos siguen en pie— entra por isla.
 *
 * LA TRAMPA QUE EVITA: /v1/algorithms devuelve un campo `total` que NO es el
 * denominador, es cuantos devolvio con el limite puesto. Medido: ?categoria=oracular&
 * limit=1 responde total:1 con 31 en la clase. Una pagina que pintara ese `total` diria
 * "1 algoritmo oracular" y no fallaria nada. Aqui se cuenta sobre la fuente.
 *
 * El guardia T-lib compara estas cifras contra el catalogo servido: si el seed y D1 se
 * separan, el CI se pone rojo en vez de publicar un numero viejo.
 */
import { readFileSync, writeFileSync } from "node:fs";

const sql = readFileSync("db/quantum.seed.sql", "utf8");

// La cabecera la escribe build-quantum-catalog.mjs junto con el sha256 de la instantanea.
const cab = sql.match(/algoritmos:\s*(\d+)\s*·\s*categorias:\s*(\d+)\s*·\s*citas:\s*(\d+)/);
const sha = (sql.match(/instantanea sha256:\s*([0-9a-f]{64})/) || [])[1];
const fecha = (sql.match(/generado:\s*([\d-]+)/) || [])[1];
if (!cab || !sha || !fecha) { console.error("ABORTA: la cabecera del seed cambio de forma."); process.exit(1); }

// Los valores se leen con un tokenizador, no con una expresion regular: los textos del
// catalogo traen comillas escapadas ('') y comas dentro, y un regex que "casi" funciona
// deja fuera las filas raras — que son justo las que nadie revisa.
function valores(linea) {
  const i = linea.indexOf("VALUES (");
  const s = linea.slice(i + 8);
  const out = [];
  let cur = "", dentro = false, j = 0;
  while (j < s.length) {
    const c = s[j];
    if (dentro) {
      if (c === "'" && s[j + 1] === "'") { cur += "'"; j += 2; continue; }
      if (c === "'") { dentro = false; out.push(cur); cur = ""; j++; continue; }
      cur += c; j++; continue;
    }
    if (c === "'") { dentro = true; j++; continue; }
    if (c === ")") break;
    if (c === ",") { if (cur.trim()) { out.push(cur.trim()); cur = ""; } j++; continue; }
    cur += c; j++;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
// COLUMNAS, en el orden del INSERT generado por build-quantum-catalog.mjs:
// id,nombre,categoria,categoria_id,problema_es,problema_en,speedup_declarado,
// fuente_nombre,fuente_url,ancla,refs_json,impl_json,remisiones_json,n_refs,orden
const filas = sql.split("\n").filter((l) => l.startsWith("INSERT INTO quantum_algorithms ")).map(valores);
if (filas.length !== Number(cab[1])) {
  console.error(`ABORTA: ${filas.length} filas parseadas vs ${cab[1]} que declara la cabecera.`);
  process.exit(1);
}
const clases = {};
const algoritmos = [];
for (const f of filas) {
  const [id, nombre, categoria, categoria_id, problema_es, problema_en, speedup, , fuente_url, ancla] = f;
  clases[categoria_id] = clases[categoria_id] || { id: categoria_id, nombre: categoria, n: 0 };
  clases[categoria_id].n++;
  algoritmos.push({
    id, nombre, categoria, categoria_id, speedup,
    fuente_url, // ya trae el ancla del Zoo dentro; concatenarla otra vez la duplica
    problema_en, problema_es,
    n_refs: Number(f[13]) || 0,
  });
}
algoritmos.sort((a, b) => a.categoria.localeCompare(b.categoria) || a.nombre.localeCompare(b.nombre));

const salida = {
  _procedencia: {
    fuente: "Quantum Algorithm Zoo",
    instantanea_sha256: sha,
    generado: fecha,
    como: "scripts/build-library-cifras.mjs sobre db/quantum.seed.sql; T-lib lo compara contra /v1/algorithms",
  },
  algoritmos: Number(cab[1]),
  referencias: Number(cab[3]),
  clases: Object.values(clases).sort((a, b) => b.n - a.n),
  // La lista COMPLETA, para que los 74 vivan en el HTML y no solo detras de un fetch.
  // /clases servia 212 KB con los 74 escritos en la pagina; al absorberla en /library
  // quedaron detras del buscador y del endpoint, y esa era la mayor masa indexable del
  // sitio. Decision de Nicholas del 7-sep: no se regala.
  catalogo: algoritmos,
};
writeFileSync("src/data/library-cifras.json", JSON.stringify(salida, null, 2) + "\n");
console.log(`library-cifras.json · ${salida.algoritmos} algoritmos en la lista (${salida.catalogo.length} fichas) · ${salida.referencias} referencias · ${salida.clases.map((c) => c.id + ":" + c.n).join(" ")}`);
