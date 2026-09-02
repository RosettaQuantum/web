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

const filas = [...sql.matchAll(/INSERT INTO quantum_algorithms \([^)]*\) VALUES \('[^']*','(?:[^']|'')*','((?:[^']|'')*)','([^']*)'/g)];
if (filas.length !== Number(cab[1])) {
  console.error(`ABORTA: ${filas.length} filas parseadas vs ${cab[1]} que declara la cabecera.`);
  process.exit(1);
}
const clases = {};
for (const f of filas) {
  const id = f[2], nombre = f[1].replace(/''/g, "'");
  clases[id] = clases[id] || { id, nombre, n: 0 };
  clases[id].n++;
}

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
};
writeFileSync("src/data/library-cifras.json", JSON.stringify(salida, null, 2) + "\n");
console.log(`library-cifras.json · ${salida.algoritmos} algoritmos · ${salida.referencias} referencias · ${salida.clases.map((c) => c.id + ":" + c.n).join(" ")}`);
