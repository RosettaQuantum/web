/**
 * Las zonas de la consola, en UN solo lugar.
 *
 * POR QUE ESTE ARCHIVO EXISTE
 * ---------------------------
 * El prototipo de marca define OCHO zonas. La consola sirve las que tienen dato detras.
 * La tentacion obvia —y el defecto que este archivo existe para impedir— es dibujar las
 * otras con datos de ejemplo "para que se vea completa". Una zona con datos inventados
 * es indistinguible de una medida hasta que alguien la audita, y esta es la pantalla con
 * la que se vende.
 *
 * Asi que las zonas sin dato NO se dibujan a medias: se DECLARAN. Cada una dice que
 * mostraria, que le falta exactamente para existir, y —cuando se puede medir— por que no
 * se puede dibujar hoy, con el numero contado en vivo contra la API.
 *
 * LA REGLA QUE VIGILA test-consola-zonas.mjs
 * ------------------------------------------
 * Ninguna zona declarada lleva digitos escritos a mano. Si una declaracion necesita una
 * cifra, la cifra la calcula `medicion()` contra el dato real en el momento de pintar.
 * Un "51 de 72" escrito aca envejece en silencio la primera vez que sellamos una corrida
 * mas, y un numero viejo en esta pantalla es exactamente el fallo que la pantalla dice
 * no cometer.
 */

/** Las que ya se dibujan con dato real. El orden es el del riel. */
export const CON_DATOS = ["archivo", "corridas", "compromisos", "biblioteca", "maquinas", "lab", "cuenta"];

/**
 * Las que el prototipo define y todavia no tienen con que existir.
 *
 * `falta` nombra lo que hace falta CONSTRUIR, no una disculpa: quien lea esto tiene que
 * poder decir si el trabajo es de un dia o de un trimestre.
 */
export const DECLARADAS = [
  {
    id: "despacho",
    nombre: "Despacho",
    proto: "z0",
    proposito: "El panorama del dia: que cambio en el archivo desde ayer, que corrida " +
      "termino, que precio se movio.",
    falta: "Un registro de cambios con fecha. La API sirve el estado de hoy, no la " +
      "diferencia contra ayer: sin serie historica no hay «que cambio», solo «que hay».",
    medicion: null,
  },
  {
    id: "traduccion",
    nombre: "Traducción",
    proto: "z1",
    proposito: "Escribir un experimento en una frase y que la consola lo componga: " +
      "problema, receta, máquina y costo.",
    falta: "Un modelo de lenguaje del lado del servidor. Es la única zona con costo por " +
      "uso, así que no se enciende sin decidir antes quién lo paga y con qué tope.",
    medicion: null,
  },
  {
    id: "mapa",
    nombre: "Mapa",
    proto: "z4",
    proposito: "La frontera: dónde el método cuántico se acerca al campeón clásico, por " +
      "tamaño de instancia, y qué parte del mapa está a oscuras.",
    falta: "Dos campos por corrida que hoy no existen en el sello: la brecha contra el " +
      "campeón clásico y el tamaño de la instancia. Sin esos dos ejes no hay plano que dibujar.",
    // El numero de esta declaracion se cuenta en vivo: es la razon medida de que la zona
    // no exista, y una razon medida vale mas que una explicacion.
    medicion: (corridas) => {
      const t = corridas.length;
      if (!t) return null;
      const con = (c) => corridas.filter(x => x[c] != null && String(x[c]).trim() !== "").length;
      return `Medido ahora mismo sobre las corridas publicadas: ${con("clase_de_problema")} de ${t} ` +
        `declaran clase de problema y ${con("metrica")} de ${t} traen métrica. ` +
        `Ninguna trae brecha ni tamaño.`;
    },
  },
  {
    id: "monitores",
    nombre: "Monitores",
    proto: "z6",
    proposito: "Volver a medir lo mismo cada día y sellar cada re-medición, para que una " +
      "afirmación que envejece se note.",
    falta: "Un disparador programado que corra y selle solo, y un canal de aviso. Hoy " +
      "cada corrida se lanza a mano.",
    medicion: null,
  },
  {
    id: "boveda",
    nombre: "Bóveda",
    proto: "z7",
    proposito: "Los modelos publicados como funciones que se llaman por API, con su sello " +
      "y su cuenta de llamadas.",
    falta: "Endpoints de escritura. La API de hoy es de sólo lectura entera, a propósito: " +
      "abrirla es una decisión de producto, no un pendiente técnico.",
    medicion: null,
  },
];

/** Todas, en el orden del riel: las que tienen dato y después las declaradas. */
export const TODAS = [...CON_DATOS, ...DECLARADAS.map(z => z.id)];
