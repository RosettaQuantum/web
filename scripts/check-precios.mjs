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

// La lista vive en scripts/lib/precios-decididos.mjs: T-llms usa la misma, y dos copias
// de lo mismo ya divergieron antes en este repo.
import { DECIDIDOS } from "./lib/precios-decididos.mjs";

const PAGINAS = ["/", "/es/", "/services", "/es/servicios", "/pilots", "/es/pilotos",
  // Las tres puertas publican precio en su propio bloque, asi que entran aqui: un precio
  // que se escribe en cuatro paginas y se vigila en dos es como divergio la lista de /v1.
  "/for/investors", "/es/para/inversionistas", "/for/pilots", "/es/para/pilotos",
  "/for/industry", "/es/para/industria",
                 "/library", "/es/biblioteca", "/methodology", "/es/metodologia"];

const fallos = [];
console.log(`preview: ${PREVIEW}\ndecididos: ${[...DECIDIDOS].join(" · ")}\n`);

for (const ruta of PAGINAS) {
  const r = await fetch(PREVIEW + ruta, { headers: { "x-rq-check": "1" } });
  if (r.status !== 200) { console.log(`  FALLA ${ruta} -> ${r.status}`); fallos.push(ruta); continue; }
  const html = await r.text();
  // Sólo el cuerpo visible: un precio dentro de un comentario o de un script no se publica.
  let texto = html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<!--[\s\S]*?-->/g, "");
  // UNA excepcion, y la pagina tiene que pedirla en voz alta: lo que va dentro de un
  // <span class="ajeno"> es una cifra de MERCADO, no un precio nuestro. Nace de
  // /for/pilots, que declara «los pilotos de nuestro rango cuestan entre US$250.000 y
  // US$1.000.000» — un supuesto sobre lo que cobran otros, que no se puede meter en la
  // lista de precios decididos sin convertir esa lista en un basurero.
  //
  // Es estrecha a proposito: hay que escribirla en el HTML, se ve en la revision, y no
  // hay forma de que se trague un precio propio por accidente. Un guardia con una
  // excepcion declarada sigue siendo un guardia; uno con una excepcion implicita, no.
  const ajenas = [...texto.matchAll(/<span[^>]*class="[^"]*\bajeno\b[^"]*"[^>]*>([\s\S]*?)<\/span>/g)];
  for (const a of ajenas) texto = texto.replace(a[0], " ");
  const montos = [...texto.matchAll(/(?:US\$|\$)\s?([\d][\d.,]*)/g)].map((m) => m[1].replace(/[.,]$/, ""));
  const sinAprobar = [...new Set(montos.filter((m) => !DECIDIDOS.has(m)))];
  if (sinAprobar.length) {
    console.log(`  FALLA ${ruta.padEnd(18)} precios sin decidir: ${sinAprobar.map((x) => "$" + x).join(" · ")}`);
    fallos.push(ruta);
  } else {
    const nota = ajenas.length ? ` · ${ajenas.length} cifra(s) de mercado declaradas y excluidas` : "";
    console.log(`  ok    ${ruta.padEnd(18)} ${montos.length} monto(s), todos decididos${nota}`);
  }
}

if (fallos.length) {
  console.log(`\nT-precios: ${fallos.length} pagina(s) con un precio que nadie aprobo.`);
  console.log("Si el precio es correcto, se agrega a DECIDIDOS con el OK de Nicholas. El rojo ES la pregunta.");
  process.exit(1);
}
console.log(`\nT-precios: las ${PAGINAS.length} paginas publican solo los precios decididos.`);
