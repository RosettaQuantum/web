/**
 * T-llms — el canal que leen los modelos dice la verdad y esta completo.
 *
 * LO QUE SE MIDIO (8-sep, sobre el preview servido)
 * -------------------------------------------------
 * llms.txt anunciaba OCHO de las paginas publicas: /monitor y /contact no estaban. Y en
 * cambio seguia OFRECIENDO Q-Ready con su precio —US$4,900 y dos enlaces— cuando la
 * pagina ya no se enlaza desde ninguna parte del sitio ni figura en el sitemap. O sea:
 * el unico archivo escrito para que un modelo nos cite era el ultimo lugar donde
 * seguiamos vendiendo un producto retirado, y el unico que no mencionaba dos paginas
 * vivas. Ninguna prueba lo vio: llms.txt responde 200 y se ve bien formado siempre.
 *
 * POR QUE UN GUARDIA Y NO UNA REVISION
 * ------------------------------------
 * Porque este archivo se escribe a mano cada vez que nace una pagina, y ya fallo asi
 * dos veces (llego a listar 7 de 17 rutas de /v1). Lo que se olvida no da error.
 *
 * PUNTO CIEGO DECLARADO: esto comprueba QUE se anuncia y que lo anunciado existe. NO
 * juzga si la descripcion de cada pagina es buena — eso lo lee una persona.
 */
import { DECIDIDOS } from "./lib/precios-decididos.mjs";

export const CONSUMIDOR = {
  quien: "quien empuja a una rama rebuild y quien autoriza el cutover",
  hace: "no publica: el archivo que leen los modelos anuncia paginas muertas, se salta paginas vivas, o sigue ofreciendo algo retirado",
};

const PREVIEW = (process.env.PREVIEW_URL || "").replace(/\/+$/, "");
if (!PREVIEW) { console.error("ABORTA: falta PREVIEW_URL"); process.exit(1); }

// Las paginas publicas del rebuild. Misma lista que T-pages, con su excepcion declarada.
const PUBLICAS = ["/services", "/pilots", "/methodology", "/about", "/errata",
                  "/contact", "/monitor", "/verify", "/library", "/library/registry"];
// /policies es texto legal: no aporta nada a un modelo que busca evidencia, y obligarlo
// aqui seria cobertura sin precision. Declarado, no olvidado.
const NO_SE_ANUNCIAN = ["/policies"];
// Lo retirado no puede volver por este archivo. Cada entrada trae POR QUE salio.
const RETIRADO = [
  [/\/q-ready/, "la pagina ya no se enlaza desde el sitio ni esta en el sitemap"],
  [/4,900|4\.900/, "precio de un producto que no esta en la lista decidida"],
];

const fallos = [];
const ok = (m) => console.log("  ok    " + m);
const mal = (m) => { console.log("  FALLA " + m); fallos.push(m); };

const r = await fetch(PREVIEW + "/llms.txt", { headers: { "x-rq-check": "1" } });
if (r.status !== 200) { console.log(`ABORTA: /llms.txt -> ${r.status}`); process.exit(1); }
const txt = await r.text();
console.log(`preview: ${PREVIEW}\nllms.txt: ${txt.length} bytes\n`);

// Las rutas se leen COMO LO QUE SON, no como cadenas sueltas. La primera version de
// este guardia uso `txt.includes("/monitor")` y `replace("/monitor","/monitorX")` para
// mutarlo: "/monitorX" CONTIENE "/monitor", asi que la mutacion no cambiaba nada y el
// guardia se declaraba incapaz de gritar. Aqui se separan las dos cosas que el archivo
// tiene: enlaces markdown a PAGINAS, y rutas de API entre acentos graves.
const ruta = (u) => u.replace(/^https?:\/\/[^/]+/, "").replace(/\/$/, "") || "/";
const paginas = new Set([...txt.matchAll(/\]\((https?:\/\/[^)]+)\)/g)].map((m) => ruta(m[1])));
const apis = [...new Set([...txt.matchAll(/`(?:GET|POST) (https?:\/\/[^`]+)`/g)].map((m) => ruta(m[1])))];

// 1 · las paginas vivas estan anunciadas, con la ruta exacta
const faltan = PUBLICAS.filter((p) => !paginas.has(p));
if (faltan.length) mal(`no se anuncian: ${faltan.join(" · ")} — una pagina que el archivo no nombra no existe para un modelo`);
else ok(`las ${PUBLICAS.length} paginas publicas estan anunciadas (excepto ${NO_SE_ANUNCIAN.join(", ")}, legal, declarado)`);

// 2 · lo anunciado responde. Un enlace muerto en este canal es peor que no ponerlo: el
// modelo lo cita igual y manda al lector a un 404 con nuestro nombre encima.
const muertas = [];
// El denominador que se reporta es el que se COMPROBO, no el total del archivo: decir
// "121 responden 200" habiendo pedido quince es un verde midiendo otra cosa.
const comprobadas = [...paginas].filter((p) => !/\/blog\//.test(p) && p !== "/");
for (const p of comprobadas) {
  const x = await fetch(PREVIEW + p, { headers: { "x-rq-check": "1" } });
  if (x.status !== 200) muertas.push(`${p} -> ${x.status}`);
}
if (muertas.length) mal(`paginas anunciadas que no responden 200: ${muertas.join(" · ")}`);
else ok(`${comprobadas.length} de ${paginas.size} paginas anunciadas responden 200 (los ${paginas.size - comprobadas.length - 1} posts los cubre T-guardia)`);

// 3 · las rutas de API existen. Aqui la vara NO es 200: /v1/jobs es POST y devuelve 405,
// /v1/search sin consulta devuelve 400, y las dos respuestas prueban que la ruta esta.
// Lo que no puede pasar es un 404 — eso es anunciar un endpoint que no existe. Las
// plantillas con {id} se saltan: no son URLs, son la forma de una URL.
const inexistentes = [];
const plantillas = apis.filter((p) => p.includes("{"));
for (const p of apis.filter((p) => !p.includes("{"))) {
  const x = await fetch(PREVIEW + p, { headers: { "x-rq-check": "1" } });
  if (x.status === 404) inexistentes.push(p);
}
if (inexistentes.length) mal(`rutas de API anunciadas que no existen: ${inexistentes.join(" · ")}`);
else ok(`${apis.length - plantillas.length} rutas de API anunciadas existen (${plantillas.length} plantillas con {id}, no consultables)`);

// 4 · lo retirado no vuelve
for (const [re, porque] of RETIRADO) {
  if (re.test(txt)) mal(`${re} sigue en llms.txt — ${porque}`);
  else ok(`${String(re).padEnd(24)} fuera del archivo`);
}

// 5 · ningun precio que Nicholas no haya decidido. Misma lista que T-precios, un archivo.
const montos = [...new Set([...txt.matchAll(/(?:US\$|\$)\s?([\d][\d.,]*)/g)]
  .map((m) => m[1].replace(/[.,]$/, "")))];
const sinAprobar = montos.filter((m) => !DECIDIDOS.has(m));
if (sinAprobar.length) mal(`precios sin decidir: ${sinAprobar.map((x) => "$" + x).join(" · ")}`);
else ok(`${montos.length} monto(s) en el archivo, todos decididos`);

// Grito, por mutacion sobre una copia en memoria. Sin esto el guardia solo demuestra que
// sabe callarse el dia que todo esta bien — y esta prueba ya cazo un error mio.
{
  const conRetirado = txt + "\n- [Q-Ready](https://x/q-ready): US$4,900\n";
  const gritaRetirado = RETIRADO.every(([re]) => re.test(conRetirado));
  const sinMonitor = new Set([...paginas].filter((p) => p !== "/monitor"));
  const gritaFalta = PUBLICAS.some((p) => !sinMonitor.has(p));
  if (gritaRetirado && gritaFalta) ok("grito                    una linea de Q-Ready vuelve, o una pagina desaparece: se detecta");
  else mal(`la prueba de mutacion no dispara (retirado:${gritaRetirado} falta:${gritaFalta}) — el guardia no sabe gritar`);
}

if (fallos.length) { console.log(`\nT-llms: ${fallos.length} fallo(s). El archivo responde 200 igual: por eso esto se mira aqui.`); process.exit(1); }
console.log("\nT-llms: el canal de indexacion esta completo y no ofrece nada retirado.");
