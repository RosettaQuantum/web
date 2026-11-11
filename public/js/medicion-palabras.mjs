/*
 * Lo que el lector ve cuando algo no se pudo medir (11-nov-2026).
 *
 * Defecto real que lo motivó: la tarjeta del certificado de un dominio medido mostró
 * «No pudimos leer el certificado: Stream was cancelled», el texto crudo del runtime.
 * El mensaje técnico sigue intacto en el registro de la medición (la traza); en las
 * tarjetas y tablas va esta traducción.
 *
 * Precisión antes que cobertura: si el texto ya viene en español (lo escribimos nosotros
 * en el servidor), pasa tal cual. Si viene en inglés y no lo reconocemos, se dice algo
 * general y verdadero, nunca una causa inventada.
 */

const REGLAS = [
  [/abort|timed? ?out|timeout|deadline/i, "el servidor no respondió a tiempo"],
  [/cancel/i, "la conexión se cortó antes de terminar"],
  [/refused|ECONNREFUSED/i, "el servidor rechazó la conexión"],
  [/reset|closed|EOF|hang ?up|socket/i, "el servidor cortó la conexión"],
  [/ENOTFOUND|NXDOMAIN|getaddrinfo|dns|resolve/i, "el nombre no se pudo resolver en DNS"],
  [/handshake|alert|protocol|ssl|tls/i, "el servidor no completó el saludo cifrado"],
  [/no route|unreachable/i, "no pudimos llegar al servidor"],
  [/failed to fetch|network/i, "no hubo conexión con nuestro servidor de medición"],
];

// Español escrito por nosotros: tildes, eñes o palabras que el inglés del runtime no usa.
const ES = /[áéíóúñ¿¡]|\b(el|la|los|las|del|servidor|respondió|medición|sin|llegó)\b/i;

/** Traduce un error técnico a una frase corta para el lector. Vacío → "". */
export function enPalabras(err) {
  // Sin punto final: quien la usa la pone dentro de su propia oración («…: <causa>.»).
  const t = String(err ?? "").trim().replace(/[.\s]+$/, "");
  if (!t) return "";
  if (ES.test(t)) return t;
  for (const [re, frase] of REGLAS) if (re.test(t)) return frase;
  return "no obtuvimos una respuesta utilizable del servidor";
}

/*
 * La frase de arriba del resultado: qué canal ya está protegido y cuál todavía no.
 * Sólo cuenta lo MEDIDO. Un canal sin medir se nombra aparte, nunca como «no protegido».
 * Recibe las tarjetas de canales() de medicion-historia.mjs: { k, estado: "si"|"no"|"nm"|"info" }.
 */
const NOMBRE = { web: "su sitio", correo: "su correo", cert: "su certificado" };
const unir = (xs) => xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`;
const mayus = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const prot = (n) => n > 1 ? "están protegidos" : "está protegido";

export function fraseVeredicto(lista) {
  const de = (e) => lista.filter((c) => NOMBRE[c.k] && c.estado === e).map((c) => NOMBRE[c.k]);
  const si = de("si"), no = de("no"), nm = de("nm");
  if (!si.length && !no.length) return "No pudimos medir ningún canal. Vuelva a medir en unos minutos.";
  const partes = [];
  if (si.length && no.length) partes.push(`${mayus(unir(si))} ya ${prot(si.length)}. ${mayus(unir(no))}, todavía no.`);
  else if (si.length) partes.push(`${mayus(unir(si))} ya ${prot(si.length)}.`);
  else partes.push(`${mayus(unir(no))} todavía no ${prot(no.length)}.`);
  if (nm.length) partes.push(`No pudimos medir ${unir(nm)}.`);
  return partes.join(" ");
}
