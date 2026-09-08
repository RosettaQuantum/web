/**
 * Los precios que Nicholas decidio, en UN solo lugar.
 *
 * Vivian dentro de check-precios.mjs. Cuando T-llms necesito la misma lista, copiarla
 * habria creado la segunda copia — y en este repo una lista que vive en dos lugares ya
 * divergio (las rutas de /v1 llegaron a existir cuatro veces, y llms.txt iba 7 de 17 sin
 * que nadie lo notara). Se aprueba un precio nuevo: se agrega AQUI, y los dos guardias
 * dejan de gritar a la vez.
 */

// La decision del 2-sep, escrita como cantidades. Formato EN y ES de cada una.
export const DECIDIDOS = new Set([
  "15,000", "35,000", "15.000", "35.000",   // Pilot Referee
  "4,500", "4.500",                          // Claim Screening
  "28,000", "28.000",                        // Diligence Report (desde)
  "149",                                     // Library Analyst, por asiento / mes
  // Precio PLANEADO de la corrida sellada por API (commit 9-ter). Va con su etiqueta
  // "in construction / planned" al lado en la pagina: es futuro declarado, no oferta.
  "50", "200",
]);
