/**
 * El texto sellado va en ASCII; el que lee una persona va con tildes.
 *
 * POR QUE EXISTE ESTE ARCHIVO
 * ---------------------------
 * La prosa de los sellos es ASCII y eso NO se toca: un caracter con tilde cambia el
 * sha256, y la convencion v1-legada ademas escapa los no-ASCII. Pero esa misma prosa se
 * muestra en la consola al lado de «API publica» y «auditoria diaria», y la regla de la
 * casa es que el texto que lee una persona lleva tildes.
 *
 * Asi que la API emite un campo APARTE, derivado. El sellado sigue intacto y viaja igual.
 *
 * DERIVADO, NO ESCRITO A MANO
 * ---------------------------
 * Un texto legible escrito a mano ya divergio el dia que se escribio: manana cambia el
 * sellado y el legible se queda contando otra cosa — y el que queda mal es el que ve el
 * comprador. Aca se deriva palabra por palabra del sellado, con una tabla cerrada.
 *
 * LA INVARIANTE, QUE ES LO QUE HACE ESTO SEGURO
 * ---------------------------------------------
 * `legible(t)` SOLO puede agregar tildes. Quitadas las tildes, el resultado tiene que ser
 * identico al original, caracter por caracter — `soloDifierenEnTildes()` lo comprueba y
 * `test-legible.mjs` lo exige sobre los 27 textos reales del archivo. Si algun dia la
 * tabla cambia una letra, el chequeo grita antes de que salga.
 *
 * LAS AMBIGUAS NO SE TOCAN
 * ------------------------
 * `mas` puede ser «mas» (conjuncion) o «más» (cantidad); `replica`, `diagnostico` y
 * `cardiaca` tienen mas de una lectura valida. Adivinar produciria un texto plausible y
 * equivocado, que es el modo de
 * fallo mas caro de este proyecto. Se dejan como estan y quedan listadas abajo: preferimos
 * una tilde ausente a una tilde inventada.
 */

/**
 * Tabla cerrada, construida sobre el vocabulario REAL de los textos sellados (135
 * palabras distintas en 27 textos, medidas el 17-ago-2026), no sobre un diccionario
 * inventado. Sumar una palabra es una linea; adivinar no es una opcion.
 */
export const TILDES = {
  alosterica: "alostérica",
  alostericas: "alostéricas",
  alosterico: "alostérico",
  alostericos: "alostéricos",
  clasico: "clásico",
  clasica: "clásica",
  clasicos: "clásicos",
  contribucion: "contribución",
  cuantica: "cuántica",
  cuanticas: "cuánticas",
  cuantico: "cuántico",
  cuanticos: "cuánticos",
  dias: "días",
  estadistica: "estadística",
  estadisticas: "estadísticas",
  fisicamente: "físicamente",
  fraccion: "fracción",
  metodo: "método",
  metodos: "métodos",
  metodologia: "metodología",
  metrica: "métrica",
  metricas: "métricas",
  metrico: "métrico",
  metricos: "métricos",
  ningun: "ningún",
  prediccion: "predicción",
  predicciones: "predicciones",
  propagacion: "propagación",
  proteina: "proteína",
  proteinas: "proteínas",
  validos: "válidos",
  validas: "válidas",
};

/**
 * Palabras con mas de una lectura correcta. NO se tocan, a proposito, y se declaran para
 * que nadie las agregue a la tabla creyendo que faltaban.
 */
export const AMBIGUAS = ["mas", "solo", "esta", "publico", "replica", "diagnostico", "cardiaca", "medio"];

const quitarTildes = t => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** Conserva la caja: METODO→MÉTODO, Metodo→Método, metodo→método. */
function comoElOriginal(original, reemplazo) {
  if (original === original.toUpperCase()) return reemplazo.toUpperCase();
  if (original[0] === original[0].toUpperCase()) return reemplazo[0].toUpperCase() + reemplazo.slice(1);
  return reemplazo;
}

/**
 * Devuelve el texto con las tildes puestas, o `null` si no cambio nada — para que quien
 * llame no emita un campo «legible» identico al sellado, que seria ruido.
 */
export function legible(texto) {
  if (typeof texto !== "string" || !texto) return null;
  const salida = texto.replace(/[A-Za-zÀ-ÿ]+/g, palabra => {
    const clave = palabra.toLowerCase();
    const t = TILDES[clave];
    return t ? comoElOriginal(palabra, t) : palabra;
  });
  return salida === texto ? null : salida;
}

/**
 * ¿Los dos textos son el mismo, salvo tildes? Es la invariante del modulo y tambien el
 * chequeo que compara lo legible contra lo sellado: si alguien edita uno de los dos, la
 * diferencia deja de ser ortografica y esto lo dice.
 */
export function soloDifierenEnTildes(a, b) {
  return quitarTildes(String(a)) === quitarTildes(String(b));
}

/**
 * Los campos legibles de un objeto, para los que cambian. Devuelve `{}` si ninguno
 * cambia: un objeto vacio significa «no hacia falta», y su AUSENCIA significa «este
 * endpoint todavia no lo emite». No son lo mismo y quien muestra tiene que distinguirlos.
 */
export function legiblesDe(obj, campos) {
  const out = {};
  for (const c of campos) {
    const v = legible(obj[c]);
    if (v !== null) out[c] = v;
  }
  return out;
}
