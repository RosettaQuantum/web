#!/usr/bin/env node
/**
 * Autoprueba del sellador de version, con sus dos direcciones.
 *
 * Un sellador que estampa siempre pasaria todas las pruebas de estampar, y romperia las
 * paginas que ya traen el marcador poniendoles un segundo. Asi que hay casos que exigen
 * que estampe y casos que exigen que NO toque nada.
 */
import { estampar, tieneMarca } from "./sellar-version.mjs";

let ok = 0, mal = 0;
const prueba = (n, c, d = "") => c ? (ok++, console.log(`  ok   ${n}`))
                                   : (mal++, console.log(`  FALLA ${n}${d ? "\n         " + d : ""}`));

const MARCA = '<meta name="rq-build" content="abc123" />';

// --- estampa cuando falta
const plano = "<!doctype html><html><head><title>x</title></head><body>y</body></html>";
const sellado = estampar(plano, MARCA);
prueba("estampa una pagina sin marcador", tieneMarca(sellado));
prueba("lo pone DENTRO de <head>", /<head>\s*<meta name="rq-build"/.test(sellado), sellado.slice(0, 90));
prueba("no toca el cuerpo", sellado.includes("<body>y</body>"));

// --- no toca cuando ya esta
const conMarca = '<html><head><meta name="rq-build" content="viejo" /></head><body></body></html>';
prueba("NO estampa dos veces", estampar(conMarca, MARCA) === conMarca);

// --- falla cerrado sin cabeza
prueba("devuelve null si no hay <head>", estampar("<div>fragmento</div>", MARCA) === null);

// --- el caso real que abrio esto: la consola es HTML plano con <head> en su linea
const consola = '<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n</head>\n<body class="consola"></body>\n</html>';
prueba("sella la consola, que nunca pasa por el layout", tieneMarca(estampar(consola, MARCA)));

// --- <head> con atributos
prueba("acepta <head> con atributos",
  tieneMarca(estampar('<html><head data-x="1"><title>t</title></head><body></body></html>', MARCA)));

console.log(`\nself-test: ${ok} pasaron, ${mal} fallaron`);
process.exit(mal ? 1 : 0);
