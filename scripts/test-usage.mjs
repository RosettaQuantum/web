#!/usr/bin/env node
/**
 * Tests del contador de uso.
 *
 * El que importa es el de FALLA ABIERTA. "El conteo no puede tumbar la respuesta"
 * es una promesa, y una promesa sin caso positivo es indistinguible de una que
 * dejo de cumplirse: aca se fuerza el fallo de la escritura y se comprueba que
 * `contarUso` devuelve en vez de propagar el error.
 *
 * Uso: node scripts/test-usage.mjs
 */
import { contarUso, formaDeRuta } from "../api.js";

let ok = 0, mal = 0; const fallos = [];
const prueba = async (n, fn) => {
  try { await fn(); ok++; console.log(`  ok    ${n}`); }
  catch (e) { mal++; fallos.push(`${n}: ${e.message}`); console.log(`  FALLA ${n}\n          ${e.message}`); }
};
const igual = (a, b, m) => { if (a !== b) throw new Error(`${m || ""} esperaba ${JSON.stringify(b)}, dio ${JSON.stringify(a)}`); };
const cierto = (c, m) => { if (!c) throw new Error(m || "no se cumplio"); };

// Una base que anota lo que le piden, y otra que revienta.
const baseOk = () => { const escrito = []; return { escrito, prepare: sql => ({ bind: (...a) => ({ run: async () => { escrito.push({ sql, a }); return {}; } }) }) }; };
const baseRota = () => ({ prepare: () => { throw new Error("D1 caida"); } });
const baseRotaAlCorrer = () => ({ prepare: () => ({ bind: () => ({ run: async () => { throw new Error("timeout"); } }) }) });

console.log("\n— la forma de la ruta, no la ruta —");
await prueba("un parametro se normaliza a su forma", () =>
  igual(formaDeRuta("/v1/algorithms/qaoa"), "/v1/algorithms/{id}"));
await prueba("dos parametros tambien", () =>
  igual(formaDeRuta("/v1/challenges/cleveland-2026-07/KRAS_G12C"), "/v1/challenges/{id}/{proteina}"));
await prueba("una ruta sin parametro queda igual", () =>
  igual(formaDeRuta("/v1/state"), "/v1/state"));
await prueba("la barra final no crea una ruta distinta", () =>
  igual(formaDeRuta("/v1/sources/"), "/v1/sources"));
await prueba("una ruta desconocida no se guarda cruda", () => {
  const f = formaDeRuta("/v1/loquesea/secreto");
  cierto(!f.includes("secreto"), `se guardo el valor crudo: ${f}`);
  igual(f, "(otra)");
});

console.log("\n— falla abierta: el conteo NUNCA tumba la respuesta —");
await prueba("cuenta cuando la base responde", async () => {
  const db = baseOk();
  igual(await contarUso(db, { superficie: "api", ruta: "/v1/state" }), true);
  igual(db.escrito.length, 1);
  cierto(/ON CONFLICT/.test(db.escrito[0].sql), "no usa el agregado incremental");
});
await prueba("NO lanza si la base esta caida", async () =>
  igual(await contarUso(baseRota(), { superficie: "api", ruta: "/v1/state" }), false));
await prueba("NO lanza si la escritura revienta a mitad", async () =>
  igual(await contarUso(baseRotaAlCorrer(), { superficie: "api", ruta: "/v1/state" }), false));
await prueba("NO lanza si le pasan una base nula", async () =>
  igual(await contarUso(null, { superficie: "api", ruta: "/v1/state" }), false));

console.log("\n— lo que se guarda —");
await prueba("solo fecha, superficie, ruta y tool", async () => {
  const db = baseOk();
  await contarUso(db, { superficie: "mcp", ruta: "/mcp", tool: "verificar_sello" });
  const [fecha, sup, ruta, tool] = db.escrito[0].a;
  igual(db.escrito[0].a.length, 4, "se estan guardando mas campos de los declarados:");
  cierto(/^\d{4}-\d{2}-\d{2}$/.test(fecha), `la fecha no es un dia: ${fecha}`);
  igual(sup, "mcp"); igual(ruta, "/mcp"); igual(tool, "verificar_sello");
});

console.log(`\n${ok} pasaron, ${mal} fallaron`);
if (mal) { console.log("\nFALLOS:\n - " + fallos.join("\n - ")); process.exit(1); }
