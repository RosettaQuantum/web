/*
 * Dos frases de la portada del informe que se DERIVAN del dato, no se escriben a mano
 * (18-nov-2026, encargo de la sesión Q-Ready medición; texto aprobado por Nicholas el 17-nov).
 *
 * Defectos reales: (1) el literal decía «cuatro puntos» y «sección 11» cuando eran seis puntos y la
 * sección 14 (agosto tampoco era la 11): un número clavado que fue cierto el mes en que se escribió.
 * (2) una ventana de un día se imprimía «Medición 2026-11-06 → 2026-11-06».
 */
const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const PALABRAS = ["cero","uno","dos","tres","cuatro","cinco","seis","siete","ocho","nueve","diez","once","doce"];

/** Los puntos del recuadro «Pendiente de revisión legal antes de publicar». Una sola lista:
 *  el recuadro se dibuja desde aquí y la frase de la portada cuenta desde aquí. */
export const PENDIENTES_LEGALES = [
  "Redacción del método frente a la legislación chilena sobre acceso no autorizado.",
  "Publicación de agregados sectoriales sin nombrar organizaciones.",
  "Umbral de anonimato: ninguna cifra sobre bases menores a ocho organizaciones.",
  "Texto del aviso previo: que la entrega del hallazgo sea incondicional.",
  "Menciones a proveedores como ausencia de declaración pública, no afirmación sobre el producto.",
  "Suficiencia de los descargos de este apartado.",
];

const enPalabras = (n) => (PALABRAS[n] ?? String(n));

/** «revisión legal de los seis puntos marcados en la sección 14». Sin «y aviso previo a las organizaciones con
 *  hallazgos» desde el 18-nov-2026: Nicholas decidió no avisar antes de publicar, así que la portada prometía un
 *  paso que no va a ocurrir. Texto aprobado (texto 1) en textos/2026-11/textos-aprobados-2026-11-18.md. */
export function pendientePorDefecto(nPuntos, nSeccion) {
  if (!(nPuntos > 0) || !(nSeccion > 0)) throw new Error("informe-pqc: no se puede derivar la frase de pendientes (sin puntos o sin sección legal)");
  return `revisión legal de los ${enPalabras(nPuntos)} puntos marcados en la sección ${nSeccion}`;
}

/** Un día → «Medición: 6 de noviembre de 2026». Dos días → «Medición 2026-07-31 → 2026-08-02» (como siempre). */
export function ventanaTexto(v) {
  if (v?.desde && v.desde === v.hasta) {
    const [y, m, d] = v.desde.split("-").map(Number);
    return `Medición: ${d} de ${MESES[m - 1]} de ${y}`;
  }
  return `Medición ${v?.desde} → ${v?.hasta}`;
}
