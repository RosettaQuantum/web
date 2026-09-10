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

  // Los cuatro «on request», decididos por Nicholas el 10-sep-2026. Cada uno se deriva
  // de un precio ya publicado para que la aritmetica sea visible:
  //   Portfolio Scan   5 x 4.500 + 28.000 = 50.500, en bundle 42.500 (se muestra la RESTA)
  //   Diligence + QPU  desde 45.000, mas tiempo de maquina a costo con tope de 10.000
  //   Sealed Pack      9.500 uno, 30.000 cuatro en doce meses
  //   Library Firm     1.900 / mes hasta 15 asientos (15 Analyst serian 2.235)
  "50,500", "50.500", "42,500", "42.500",    // Portfolio Scan: lista y bundle
  "45,000", "45.000", "10,000", "10.000",    // Diligence + QPU: piso y tope de maquina
  "9,500", "9.500", "30,000", "30.000",      // Sealed Prediction Pack: uno y cuatro
  "1,900", "1.900", "2,235", "2.235",        // Library Firm, y el 15xAnalyst con que se compara
  // Precio PLANEADO de la corrida sellada por API (commit 9-ter). Va con su etiqueta
  // "in construction / planned" al lado en la pagina: es futuro declarado, no oferta.
  "50", "200",
]);
