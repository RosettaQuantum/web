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
export function enPalabras(err, idioma = "es") {
  // Sin punto final: quien la usa la pone dentro de su propia oración («…: <causa>.»).
  const t = String(err ?? "").trim().replace(/[.\s]+$/, "");
  if (!t) return "";
  if (idioma === "en") {
    // En inglés, el español de nuestro servidor se traduce por tabla; nunca pasa tal cual.
    const tabla = tablaServidor(t);
    if (tabla) return tabla;
    if (ES.test(t)) return GENERICO_EN;
    for (const [re, frase] of REGLAS_EN) if (re.test(t)) return frase;
    return GENERICO_EN;
  }
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

export function fraseVeredicto(lista, idioma = "es") {
  if (idioma === "en") return fraseVeredictoEn(lista);
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

// ---------------------------------------------------------------- versión en inglés (12-nov-2026)
// La página /q-ready/medicion usa estas mismas funciones con idioma "en". El español queda como
// estaba: el idioma por omisión es "es" y ese camino no cambió una letra.
// Regla: a un lector en inglés no le llega español. Lo que el servidor escribe en español se
// traduce por tabla; si no está en la tabla, se dice algo general y verdadero en inglés.

const REGLAS_EN = [
  [/abort|timed? ?out|timeout|deadline/i, "the server did not respond in time"],
  [/cancel/i, "the connection was cut before it finished"],
  [/refused|ECONNREFUSED/i, "the server refused the connection"],
  [/reset|closed|EOF|hang ?up|socket/i, "the server closed the connection"],
  [/ENOTFOUND|NXDOMAIN|getaddrinfo|dns|resolve/i, "the name could not be resolved in DNS"],
  [/handshake|alert|protocol|ssl|tls/i, "the server did not complete the encrypted handshake"],
  [/no route|unreachable/i, "we could not reach the server"],
  [/failed to fetch|network/i, "there was no connection to our measurement server"],
];
export const GENERICO_EN = "we did not get a usable response from the server";

// Lo que nuestro servidor escribe en español (lib/*.mjs y la sonda de correo), con su inglés.
// Se compara sin punto final y sin distinguir mayúsculas.
const SERVIDOR_EN = [
  [/^escribe un (nombre de )?dominio público, por ejemplo .*$/i, "Enter a public domain, for example example.com"],
  [/^el sitio tiene que ser del mismo dominio$/i, "The website must belong to the same domain"],
  [/^como máximo (\d+) endpoints por medición$/i, "At most $1 endpoints per measurement"],
  [/^demasiadas mediciones seguidas\. espera un minuto$/i, "Too many measurements in a row. Please wait a minute"],
  [/^demasiados pedidos seguidos\. espere un minuto$/i, "Too many requests in a row. Please wait a minute"],
  [/^demasiadas consultas; espere un minuto$/i, "too many requests; please wait a minute"],
  [/^la medición de correo no está habilitada en este servidor$/i, "Email measurement is not enabled on this server"],
  [/^el envío por correo no está habilitado en este servidor$/i, "Sending by email is not enabled on this server"],
  [/^el servidor de medición no tomó el trabajo$/i, "the measurement server did not pick up the job"],
  [/^el servidor de medición no entregó a tiempo$/i, "the measurement server did not deliver in time"],
  [/^no llegó respuesta en (\d+) s$/i, "no response arrived within $1 s"],
  [/^no existe \(se borran pasado un día\)$/i, "not found (requests are deleted after one day)"],
  [/^dominio inválido$/i, "invalid domain"],
  [/^el registro público no respondió$/i, "the public certificate log did not respond"],
  [/^no respondió a tiempo$/i, "did not respond in time"],
  [/^tope por hora alcanzado: no medido$/i, "hourly limit reached: not measured"],
  [/^la foto es demasiado grande$/i, "The snapshot is too large"],
  [/^pedido inválido$/i, "Invalid request"],
  [/^escriba un correo válido$/i, "Enter a valid email address"],
  [/^falta aceptar el envío$/i, "You need to accept the sending terms"],
  [/^la foto no es íntegra: vuelva a medir$/i, "The snapshot failed its integrity check: measure again"],
  [/^no pudimos verificar que es una persona\. recargue la página e intente de nuevo$/i, "We could not verify that you are a person. Reload the page and try again"],
  [/^no pudimos registrar su (pedido|correo)$/i, "We could not record your request"],
  [/^registramos su pedido, pero no pudimos poner el envío en la cola$/i, "We recorded your request, but could not queue the email"],
  [/^el servicio respondió (\d+)$/i, "the service returned $1"],
  [/^sin_respuesta$/, "no response"],
  // errores que lanzan lib/ct-registro.mjs, lib/borde-envivo.mjs y lib/informe-envivo.mjs
  [/^(crt\.sh|Cert Spotter) respondió (\d+)$/, "$1 returned $2"],
  [/^(crt\.sh|Cert Spotter) no devolvió una lista$/, "$1 did not return a list"],
  [/^respuesta corta$/, "short response"],
  [/^sin respuesta en ([\d.,]+) s$/, "no response within $1 s"],
  [/^el servidor cerró antes del certificado$/, "the server closed the connection before sending the certificate"],
  [/^respuesta demasiado larga$/, "response too long"],
  [/^alerta TLS (\S+) \(el servidor no aceptó TLS 1\.2\)$/, "TLS alert $1 (the server did not accept TLS 1.2)"],
  [/^registro inesperado (\S+)$/, "unexpected record $1"],
  [/^el servidor terminó el saludo sin enviar certificado$/, "the server ended the handshake without sending a certificate"],
  [/^el servidor cerró antes de enviar su lista de algoritmos$/, "the server closed before sending its list of algorithms"],
  [/^la clave para medir SSH no es válida\. La medición de SSH sólo corre con autorización del dueño del dominio$/i,
    "The key to measure SSH is not valid. SSH measurement only runs with the domain owner’s authorization"],
];

const tablaServidor = (t) => { for (const [re, en] of SERVIDOR_EN) if (re.test(t)) return t.replace(re, en); return null; };

/** Mensaje del servidor (o error del runtime) para el lector. "es": tal cual. "en": nunca español. */
export function delServidor(msg, idioma = "es") {
  if (idioma !== "en") return String(msg ?? "");
  const t = String(msg ?? "").trim().replace(/[.\s]+$/, "");
  if (!t) return "";
  return tablaServidor(t) ?? enPalabras(t, "en");
}

/**
 * La consola (traza) muestra el texto técnico crudo a propósito. En inglés, el crudo del runtime
 * (que ya es inglés) pasa; lo que escribimos en español se traduce por tabla o se dice en general.
 */
export function paraTraza(x, idioma = "es") {
  const t = String(x ?? "");
  if (idioma !== "en") return t;
  const s = t.trim().replace(/[.\s]+$/, "");
  return tablaServidor(s) ?? (ES.test(s) ? GENERICO_EN : t);
}

/**
 * La fuente del registro de certificados (lib/ct-registro.mjs y la propia página la escriben en
 * español: «Cert Spotter (SSLMate), sólo certificados vigentes», «…, copia del servidor»).
 * En inglés se traduce por partes; lo que quede en español cae a una etiqueta general.
 */
export function fuenteCT(f, idioma = "es") {
  const t = String(f ?? "");
  if (idioma !== "en") return t;
  const en = t.replace(", sólo certificados vigentes", ", valid certificates only").replace(", copia del servidor", ", server copy")
    .replace(", copia guardada en este navegador", ", copy saved in this browser").replace(/^archivo /, "file ");
  return ES.test(en) ? "public certificate log" : en;
}

/** Detalle crudo de un endpoint (lib/informe-envivo.mjs, en español) para el lector en inglés. */
export function detalleEndpointEn(crudo) {
  const t = String(crudo ?? "").trim();
  if (!t) return "";
  let m;
  if ((m = /^DNS sin respuesta: (.*)$/.exec(t))) return `no DNS response: ${enPalabras(m[1], "en")}`;
  if (/^el nombre ya no existe en DNS: no se envió saludo$/.test(t)) return "the name no longer exists in DNS: no handshake sent";
  if ((m = /^DNS (\S+) sin direcciones: no se envió saludo$/.exec(t))) return `DNS ${m[1]} with no addresses: no handshake sent`;
  if ((m = /^sin respuesta (?:TLS )?en 443(?: \((.*)\))?(: el nombre no expone un servicio web)?$/.exec(t)))
    return `no TLS response on 443${m[1] ? ` (${enPalabras(m[1], "en")})` : ""}${m[2] ? ": the name does not expose a web service" : ""}`;
  if ((m = /^responde con (.*)$/.exec(t))) return `responds with ${m[1]}`;
  if ((m = /^responde; grupo (.*)$/.exec(t))) return `responds; group ${m[1]}`;
  return ES.test(t) ? GENERICO_EN : t;
}

const NOMBRE_EN = { web: "your website", correo: "your email", cert: "your certificate" };
const unirEn = (xs) => xs.length < 2 ? xs.join("") : xs.length === 2 ? `${xs[0]} and ${xs[1]}` : `${xs.slice(0, -1).join(", ")}, and ${xs[xs.length - 1]}`;
const protEn = (n) => n > 1 ? "are already protected" : "is already protected";

function fraseVeredictoEn(lista) {
  const de = (e) => lista.filter((c) => NOMBRE_EN[c.k] && c.estado === e).map((c) => NOMBRE_EN[c.k]);
  const si = de("si"), no = de("no"), nm = de("nm");
  if (!si.length && !no.length) return "We could not measure any channel. Please measure again in a few minutes.";
  const partes = [];
  if (si.length && no.length) partes.push(`${mayus(unirEn(si))} ${protEn(si.length)}. ${mayus(unirEn(no))}, not yet.`);
  else if (si.length) partes.push(`${mayus(unirEn(si))} ${protEn(si.length)}.`);
  else partes.push(`${mayus(unirEn(no))} ${no.length > 1 ? "are" : "is"} not protected yet.`);
  if (nm.length) partes.push(`We could not measure ${unirEn(nm)}.`);
  return partes.join(" ");
}
