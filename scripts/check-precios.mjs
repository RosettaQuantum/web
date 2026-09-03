/**
 * T-precios — en público sólo aparecen los precios que Nicholas decidió.
 *
 * EL DEFECTO QUE VIGILA (encontrado el 3-sep, y se me habia pasado a mi tambien)
 * -----------------------------------------------------------------------------
 * La decision del 2-sep fija CUATRO precios publicables —Pilot Referee 15.000–35.000,
 * Screening 4.500, Diligence desde 28.000, Library Analyst 149 por asiento/mes— y manda
 * TODO LO DEMAS a "a pedido". Yo apliqué eso en /services y la home siguió publicando
 * `Firm from $10,000/yr`, que venia de la maqueta: una cifra que nadie aprobó, en la
 * pagina mas leida. No la cazó ninguna de las nueve pruebas: un precio de mas no rompe
 * nada, no da 404 y se ve exactamente igual de firme que uno decidido.
 *
 * COMO
 * ----
 * Barre las paginas publicas servidas, saca TODA cantidad con signo de moneda, y exige
 * que cada una este en la lista decidida. Lo que no este, se reporta con su pagina.
 *
 * PRECISION SOBRE COBERTURA: solo mira cantidades con `$`. No intenta adivinar precios
 * escritos en palabras — un guardia que marque "cuesta poco" retendria trabajo bueno.
 * Punto ciego declarado: si un precio nuevo se aprueba, se agrega AQUI primero; que el
 * guardia se ponga rojo es la señal de que falta el OK, no un estorbo.
 */
export const CONSUMIDOR = {
  quien: "quien empuja a una rama rebuild y quien autoriza el cutover",
  hace: "no publica: hay un precio a la vista que Nicholas no decidio, y un precio publicado es un compromiso",
};

const PREVIEW = (process.env.PREVIEW_URL || "").replace(/\/+$/, "");
if (!PREVIEW) { console.error("ABORTA: falta PREVIEW_URL"); process.exit(1); }

// La decision del 2-sep, escrita como cantidades. Formato EN y ES de cada una.
const DECIDIDOS = new Set([
  "15,000", "35,000", "15.000", "35.000",   // Pilot Referee
  "4,500", "4.500",                          // Claim Screening
  "28,000", "28.000",                        // Diligence Report (desde)
  "149",                                     // Library Analyst, por asiento / mes
  // Precio PLANEADO de la corrida sellada por API (commit 9-ter). Va con su etiqueta
  // "in construction / planned" al lado en la pagina: es futuro declarado, no oferta.
  "50", "200",
]);

const PAGINAS = ["/", "/es/", "/services", "/es/servicios", "/pilots", "/es/pilotos",
                 "/library", "/es/biblioteca", "/methodology", "/es/metodologia"];

const fallos = [];
console.log(`preview: ${PREVIEW}\ndecididos: ${[...DECIDIDOS].join(" · ")}\n`);

for (const ruta of PAGINAS) {
  const r = await fetch(PREVIEW + ruta, { headers: { "x-rq-check": "1" } });
  if (r.status !== 200) { console.log(`  FALLA ${ruta} -> ${r.status}`); fallos.push(ruta); continue; }
  const html = await r.text();
  // Sólo el cuerpo visible: un precio dentro de un comentario o de un script no se publica.
  const texto = html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<!--[\s\S]*?-->/g, "");
  const montos = [...texto.matchAll(/(?:US\$|\$)\s?([\d][\d.,]*)/g)].map((m) => m[1].replace(/[.,]$/, ""));
  const sinAprobar = [...new Set(montos.filter((m) => !DECIDIDOS.has(m)))];
  if (sinAprobar.length) {
    console.log(`  FALLA ${ruta.padEnd(18)} precios sin decidir: ${sinAprobar.map((x) => "$" + x).join(" · ")}`);
    fallos.push(ruta);
  } else {
    console.log(`  ok    ${ruta.padEnd(18)} ${montos.length} monto(s), todos decididos`);
  }
}

if (fallos.length) {
  console.log(`\nT-precios: ${fallos.length} pagina(s) con un precio que nadie aprobo.`);
  console.log("Si el precio es correcto, se agrega a DECIDIDOS con el OK de Nicholas. El rojo ES la pregunta.");
  process.exit(1);
}
console.log(`\nT-precios: las ${PAGINAS.length} paginas publican solo los precios decididos.`);
