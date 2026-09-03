/**
 * T-301 — las catorce redirecciones existen, apuntan donde dicen, y el destino responde.
 *
 * POR QUE NO BASTA CON "DEVUELVE 301"
 * -----------------------------------
 * Un 301 a un 404 es PEOR que no redirigir: la pagina original ya no existe, asi que el
 * visitante y el buscador se quedan sin nada, y el 301 se ve perfecto en cualquier
 * chequeo que solo mire el codigo de estado. Aqui se sigue el salto y se exige 200 al
 * otro lado.
 *
 * Y POR QUE SE COMPRUEBA CON Y SIN BARRA FINAL
 * -------------------------------------------
 * Este repo ya se quemo con eso: /blog sin barra devuelve 307 y curl sin -L trae cuerpo
 * vacio; "el post esta vacio" era "pedi la URL equivocada". La tabla del Worker
 * normaliza la barra antes de mirar, asi que las dos formas tienen que redirigir.
 *
 * PUNTO CIEGO DECLARADO: comprueba el salto, no que el destino sea el CORRECTO en
 * contenido. Que /clases mande a la Biblioteca y no a la home es una decision de
 * producto; aqui solo se garantiza que llega a algo vivo.
 */
export const CONSUMIDOR = {
  quien: "quien empuja a una rama rebuild y quien autoriza el cutover",
  hace: "no fusiona: una ruta indexada quedaria sirviendo la pagina vieja, o redirigiendo a un 404",
};

const PREVIEW = (process.env.PREVIEW_URL || "").replace(/\/+$/, "");
if (!PREVIEW) { console.error("ABORTA: falta PREVIEW_URL"); process.exit(1); }

// La misma tabla del Worker. Se escribe aqui a proposito: si el guardia la leyera del
// archivo bajo prueba, borrar una entrada dejaria de vigilarla y el CI seguiria verde —
// el mismo error que reprobo la primera version de T-guardia.
const R = {
  "/rosettaq": "/library",
  "/rosettaq/calculator": "/library",
  "/rosettaq/catalog": "/library",
  "/rosettaq/router": "/library",
  "/rosettaq/unit": "/library",
  "/es/rosettaq": "/es/biblioteca",
  "/es/rosettaq/calculator": "/es/biblioteca",
  "/es/rosettaq/catalog": "/es/biblioteca",
  "/es/rosettaq/router": "/es/biblioteca",
  "/es/rosettaq/unit": "/es/biblioteca",
  "/pricing": "/services",
  "/es/precios": "/es/servicios",
  "/clases": "/library",
  "/es/clases": "/es/biblioteca",
};

const fallos = [];
console.log(`preview: ${PREVIEW}\nredirecciones declaradas: ${Object.keys(R).length}\n`);

for (const [origen, destino] of Object.entries(R)) {
  for (const forma of [origen, origen + "/"]) {
    const r = await fetch(PREVIEW + forma, { redirect: "manual", headers: { "x-rq-check": "1" } });
    const loc = r.headers.get("location") || "";
    if (r.status !== 301) { console.log(`  FALLA ${forma.padEnd(26)} ${r.status} — se esperaba 301`); fallos.push(forma); continue; }
    if (!loc.endsWith(destino)) { console.log(`  FALLA ${forma.padEnd(26)} 301 -> ${loc} — se esperaba ${destino}`); fallos.push(forma); continue; }
    const d = await fetch(PREVIEW + destino, { headers: { "x-rq-check": "1" } });
    if (d.status !== 200) { console.log(`  FALLA ${forma.padEnd(26)} 301 correcto pero el destino ${destino} responde ${d.status}`); fallos.push(forma); continue; }
    console.log(`  ok    ${forma.padEnd(26)} 301 -> ${destino} (200)`);
  }
}

if (fallos.length) { console.log(`\nT-301: ${fallos.length} de ${Object.keys(R).length * 2} formas fallan.`); process.exit(1); }
console.log(`\nT-301: las ${Object.keys(R).length} redirecciones saltan bien, con y sin barra final, y todos los destinos responden 200.`);
