#!/usr/bin/env node
/**
 * Vectores del verificador de sellos.
 *
 * POR QUE EXISTEN
 * ---------------
 * El sello se calcula sobre el TEXTO que produce `json.dumps` de Python, y ahi hay una
 * familia de trampas que no se ve hasta que alguien verifica desde otro lenguaje:
 *
 *   Python          JavaScript      donde aparecio
 *   8.0             8               64 de 69 archivos del ledger
 *   1e-06           1e-6            396 numeros, uno en un sello ya anclado
 *   -0.0            0               posible en cualquier medicion
 *
 * Un verificador que parsea el JSON y lo vuelve a serializar produce un hash distinto
 * sobre un archivo honesto — y ese fallo PARECE manipulacion. Por eso el parser conserva
 * el literal tal como venia en el archivo en vez del valor.
 *
 * Estos vectores estan escritos contra los casos REALES que aparecieron en el archivo, no
 * contra ejemplos comodos, y son los que hay que volver a pasar cuando el laboratorio
 * publique el canonicalizador v3.
 *
 * Uso: node scripts/test-sello.mjs
 */
import { pyDumps, parseConLiterales } from "./lib/sello.mjs";

let ok = 0, mal = 0; const fallos = [];
const prueba = (que, entrada, esperado) => {
  const salida = pyDumps(parseConLiterales(entrada));
  if (salida === esperado) { ok++; console.log(`  ok    ${que}`); }
  else { mal++; fallos.push(`${que}: ${salida} (esperaba ${esperado})`); console.log(`  FALLA ${que}\n          ${entrada} -> ${salida}, esperaba ${esperado}`); }
};

console.log("\n— la familia del formato de numeros —");
prueba("float entero: 8.0 no es 8", '{"a": 8.0}', '{"a": 8.0}');
prueba("exponencial con cero: 1e-06 no es 1e-6", '{"a": 1e-06}', '{"a": 1e-06}');
prueba("exponencial en mayuscula", '{"a": 1E-6}', '{"a": 1E-6}');
prueba("exponencial positiva", '{"a": 2.5e10}', '{"a": 2.5e10}');
prueba("cero negativo", '{"a": -0.0}', '{"a": -0.0}');
prueba("entero de verdad se conserva", '{"a": 8}', '{"a": 8}');
prueba("dentro de un arreglo", '{"a": [1.0, 2, 1e-06]}', '{"a": [1.0, 2, 1e-06]}');
prueba("anidado", '{"a": {"b": 9.0}}', '{"a": {"b": 9.0}}');

console.log("\n— el resto de la convencion —");
prueba("claves ordenadas", '{"b": 1, "a": 2}', '{"a": 2, "b": 1}');
prueba("separadores de Python: coma-espacio y dos-puntos-espacio", '{"a":1,"b":2}', '{"a": 1, "b": 2}');
prueba("ensure_ascii=False: no se escapa", '{"a": "ñoño"}', '{"a": "ñoño"}');
prueba("cadena con comillas", '{"a": "di\\"jo"}', '{"a": "di\\"jo"}');
prueba("nulos y booleanos", '{"a": null, "b": true, "c": false}', '{"a": null, "b": true, "c": false}');
prueba("objeto vacio", '{}', '{}');
prueba("arreglo vacio", '{"a": []}', '{"a": []}');

console.log("\n— el caso positivo: sin preservar literales, NO calza —");
{
  // Si el parser se rompiera y devolviera numeros normales, esto tendria que cambiar.
  const conLiterales = pyDumps(parseConLiterales('{"a": [7.5, 8.0, 9.0]}'));
  const comoJS = JSON.stringify(JSON.parse('{"a": [7.5, 8.0, 9.0]}')).replace(/,/g, ", ").replace(/":/g, '": ');
  if (conLiterales !== comoJS) { ok++; console.log("  ok    preservar literales da un texto distinto al de JSON.stringify"); }
  else { mal++; fallos.push("el parser dejo de preservar literales"); console.log("  FALLA el parser dejo de preservar literales"); }
}

console.log(`\n${ok} pasaron, ${mal} fallaron`);
if (mal) { console.log("\nFALLOS:\n - " + fallos.join("\n - ")); process.exit(1); }
