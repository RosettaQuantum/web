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

// 1 · las paginas vivas estan anunciadas
const faltan = PUBLICAS.filter((p) => !txt.includes(p));
if (faltan.length) mal(`no se anuncian: ${faltan.join(" · ")} — una pagina que el archivo no nombra no existe para un modelo`);
else ok(`las ${PUBLICAS.length} paginas publicas estan anunciadas (excepto ${NO_SE_ANUNCIAN.join(", ")}, legal, declarado)`);

// 2 · lo anunciado responde. Un enlace muerto en este canal es peor que no ponerlo:
// el modelo lo cita igual y manda al lector a un 404 con nuestro nombre encima.
const rutas = [...new Set([...txt.matchAll(/https?:\/\/[^\s)`]+/g)].map((m) => m[0]))]
  .filter((u) => !/\/blog\//.test(u))   // los posts los cubre T-guardia, y son 106
  .map((u) => u.replace(/^https?:\/\/[^/]+/, ""))
  .filter((p) => p && p !== "/");
const muertas = [];
for (const p of rutas) {
  const x = await fetch(PREVIEW + p, { headers: { "x-rq-check": "1" } });
  if (x.status !== 200) muertas.push(`${p} -> ${x.status}`);
}
if (muertas.length) mal(`enlaces que no responden 200: ${muertas.join(" · ")}`);
else ok(`las ${rutas.length} rutas anunciadas (sin contar posts) responden 200`);

// 3 · lo retirado no vuelve
for (const [re, porque] of RETIRADO) {
  if (re.test(txt)) mal(`${re} sigue en llms.txt — ${porque}`);
  else ok(`${String(re).padEnd(24)} fuera del archivo`);
}

// 4 · ningun precio que Nicholas no haya decidido. Misma lista que T-precios, un archivo.
const montos = [...new Set([...txt.matchAll(/(?:US\$|\$)\s?([\d][\d.,]*)/g)]
  .map((m) => m[1].replace(/[.,]$/, "")))];
const sinAprobar = montos.filter((m) => !DECIDIDOS.has(m));
if (sinAprobar.length) mal(`precios sin decidir: ${sinAprobar.map((x) => "$" + x).join(" · ")}`);
else ok(`${montos.length} monto(s) en el archivo, todos decididos`);

// Grito y silencio, por mutacion sobre una copia en memoria. Sin esto el guardia solo
// demuestra que sabe callarse el dia que todo esta bien.
{
  const roto = txt + "\n- [Q-Ready](https://x/q-ready): US$4,900\n";
  const gritaRetirado = RETIRADO.every(([re]) => re.test(roto));
  const cojo = txt.replace("/monitor", "/monitorX");
  const gritaFalta = PUBLICAS.some((p) => !cojo.includes(p));
  if (gritaRetirado && gritaFalta) ok("grito         una linea de Q-Ready vuelve, o una pagina desaparece: se detecta");
  else mal("la prueba de mutacion no dispara — el guardia no sabe gritar");
}

if (fallos.length) { console.log(`\nT-llms: ${fallos.length} fallo(s). El archivo responde 200 igual: por eso esto se mira aqui.`); process.exit(1); }
console.log("\nT-llms: el canal de indexacion esta completo y no ofrece nada retirado.");
