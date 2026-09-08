/**
 * T-boletin — la caja de correo del blog promete lo que promete, y escribe a la lista
 * que prometio.
 *
 * EL DEFECTO QUE LO HIZO NECESARIO (8-sep)
 * ----------------------------------------
 * El blog servia la caja del MONITOR. A alguien leyendo un post se le prometia "one
 * email when the edition seals · no list, no drip" y su correo entraba a la lista del
 * Monitor. Nadie lo vio porque el bloque ESTABA: contarlo daba 1 y todo pasaba. El
 * defecto no era la ausencia del bloque, era que el bloque decia otra cosa.
 *
 * De ahi las dos varas de este guardia, y son distintas:
 *   PRESENCIA  — el bloque existe (se cae de 106 paginas a la vez si el cascaron cambia).
 *   PROMESA    — el TEXTO servido es el de la lista correcta, palabra por palabra. Y la
 *                promesa del Monitor NO puede aparecer en el blog: ese fue el defecto.
 *   ESCRITURA  — se suscribe de verdad y se LEE LA FILA EN D1. Que el endpoint conteste
 *                204 no dice a que lista apunto: eso solo lo dice la tabla.
 *
 * La fila de prueba usa el TLD reservado .invalid —no puede ser de nadie— y se borra al
 * terminar. Si el borrado falla, el guardia lo dice en vez de callarselo.
 *
 * PUNTO CIEGO DECLARADO: la lectura de D1 necesita CLOUDFLARE_API_TOKEN. En CI siempre
 * esta; en una corrida local sin credenciales el guardia AVISA que no la hizo y sigue.
 * No se pinta de verde una comprobacion que no corrio.
 */
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";

export const CONSUMIDOR = {
  quien: "quien empuja a una rama rebuild",
  hace: "no sigue: el sitio recoge correos con una promesa y los apunta a otra lista, que es un consentimiento que nadie dio",
};

const PREVIEW = (process.env.PREVIEW_URL || "").replace(/\/+$/, "");
if (!PREVIEW) { console.error("ABORTA: falta PREVIEW_URL"); process.exit(1); }

const fallos = [];
const ok = (m) => console.log("  ok    " + m);
const mal = (m) => { console.log("  FALLA " + m); fallos.push(m); };
const traer = async (p) => (await fetch(PREVIEW + p, { headers: { "x-rq-check": "1" } })).text();

// Las promesas, palabra por palabra. Si alguien edita el texto, este guardia se pone
// rojo — y eso es lo correcto: el texto que lee una persona antes de dejar su correo
// pasa por Nicholas (CLAUDE.md §5), no por un despliegue.
const PROMESA = {
  weekly: {
    en: ["Get the next one.",
         "One email a week: what the evidence engine published and what moved in the registry. No pitches."],
    es: ["Recibe la próxima.",
         "Un correo por semana: lo que publicó el motor de evidencia y lo que se movió en el registro. Sin ofertas."],
  },
  monitor: {
    en: ["What the ledger can already say.", "one email when the edition seals · no list, no drip"],
    es: ["Lo que el ledger ya puede decir.", "un solo correo cuando la edición selle · sin lista, sin goteo"],
  },
};
// La promesa del Monitor en una pagina del blog ES el defecto de origen.
const AJENA = [PROMESA.monitor.en[1], PROMESA.monitor.es[1]];

// El post NO se escribe a mano: se elige del indice en vivo. Un slug quemado deja de
// existir y la prueba pasaria a verificar un 404 sin que nadie mire.
const indice = await traer("/blog/");
const post = (indice.match(/href="(\/blog\/[a-z0-9-]+\/?)"/g) || [])
  .map((h) => h.slice(6, -1)).find((h) => h !== "/blog/");
if (!post) { console.log("ABORTA: el indice del blog no lista ningun post"); process.exit(1); }

const PAGINAS = [["/blog/", "en"], [post, "en"], ["/es/blog/", "es"]];
for (const [ruta, idioma] of PAGINAS) {
  const h = await traer(ruta);
  const p = [];
  const bloques = (h.match(/class="boletin"/g) || []).length;
  if (bloques !== 1) p.push(`${bloques} bloques (va exactamente 1)`);
  if (!h.includes('id="monMail"')) p.push("sin campo de correo");
  if (!h.includes('data-lista="weekly"')) p.push("el boton no declara lista weekly");
  if (!h.includes("/js/paginas.js")) p.push("sin /js/paginas.js — el boton quedaria en mailto");
  for (const frase of PROMESA.weekly[idioma]) if (!h.includes(frase)) p.push(`falta la promesa: ${JSON.stringify(frase.slice(0, 40))}…`);
  for (const frase of AJENA) if (h.includes(frase)) p.push("sirve la promesa del MONITOR — es el defecto de origen");
  if (p.length) mal(`${ruta} · ${p.join(" · ")}`);
  else ok(`${ruta.padEnd(46)} bloque · promesa weekly ${idioma} textual · lista declarada`);
}

// Y el reverso: la home CONSERVA la del Monitor. Sin este caso el guardia bendeciria
// borrar la caja del Monitor de todas partes.
for (const [ruta, idioma] of [["/", "en"], ["/es/", "es"]]) {
  const h = await traer(ruta);
  const falta = PROMESA.monitor[idioma].filter((f) => !h.includes(f));
  if (falta.length) mal(`${ruta} perdio la promesa del Monitor: ${falta.map((f) => JSON.stringify(f.slice(0, 32))).join(" · ")}`);
  else if (h.includes(PROMESA.weekly[idioma][1])) mal(`${ruta} sirve la promesa semanal — la home es la caja del Monitor`);
  else ok(`${ruta.padEnd(46)} conserva la promesa del Monitor, y solo esa`);
}

const js = await traer("/js/paginas.js");
if (!/monGo[\s\S]*api\/subscribe/.test(js)) mal("/js/paginas.js no conecta el boton con /api/subscribe");
else ok("/js/paginas.js".padEnd(46) + "conecta el boton con /api/subscribe");

// FALLA CERRADA: correo invalido, y lista desconocida. Caer a un valor por defecto
// apuntaria a alguien a una lista que no eligio, en silencio.
for (const [cuerpo, que] of [
  [{ email: "no-es-un-correo", lista: "weekly" }, "correo invalido"],
  [{ email: "a@b.co", lista: "inventada" }, "lista desconocida"],
  [{ email: "a@b.co" }, "sin lista"],
]) {
  const r = await fetch(PREVIEW + "/api/subscribe", {
    method: "POST", headers: { "content-type": "application/json", "x-rq-check": "1" }, body: JSON.stringify(cuerpo) });
  if (r.status !== 400) mal(`/api/subscribe con ${que} -> ${r.status} (se espera 400)`);
  else ok(`/api/subscribe`.padEnd(46) + `400 con ${que}`);
}

// ESCRITURA REAL, leida en la tabla. Lo unico que prueba a que lista apunto.
const marca = randomBytes(4).toString("hex");
const correo = `t-boletin-${marca}@rosettaquantum.invalid`;
const alta = await fetch(PREVIEW + "/api/subscribe", {
  method: "POST", headers: { "content-type": "application/json", "x-rq-check": "1" },
  body: JSON.stringify({ email: correo, lista: "weekly", origen: "/blog/t-boletin" }) });
if (alta.status !== 204) mal(`/api/subscribe con lista weekly -> ${alta.status} (se espera 204)`);
else ok("/api/subscribe".padEnd(46) + "204 con lista weekly");

if (!process.env.CLOUDFLARE_API_TOKEN) {
  console.log("  ---   sin CLOUDFLARE_API_TOKEN: NO se leyo la fila en D1. Esta comprobacion no corrio.");
} else {
  const d1 = (sql) => JSON.parse(execFileSync("./node_modules/.bin/wrangler",
    ["d1", "execute", "rosettaq-ledger", "--remote", "--json", "--command", sql], { encoding: "utf8" }));
  const fila = (d1(`SELECT lista, origen FROM monitor_leads WHERE email='${correo}'`)[0]?.results || [])[0];
  if (!fila) mal("la suscripcion contesto 204 y no hay fila en monitor_leads — el 204 mentia");
  else if (fila.lista !== "weekly") mal(`la fila quedo en lista='${fila.lista}', no 'weekly' — se apunto a una lista que nadie eligio`);
  else ok(`monitor_leads`.padEnd(46) + `fila real con lista='weekly' · origen='${fila.origen}'`);
  d1(`DELETE FROM monitor_leads WHERE email='${correo}'`);
  const quedan = (d1(`SELECT COUNT(*) n FROM monitor_leads WHERE email='${correo}'`)[0]?.results || [])[0]?.n;
  if (quedan !== 0) mal(`la fila de prueba no se borro (quedan ${quedan})`);
  else ok("monitor_leads".padEnd(46) + "la fila de prueba se borro");
}

if (fallos.length) { console.log(`\nT-boletin: ${fallos.length} fallo(s).`); process.exit(1); }
console.log(`\nT-boletin: promesa weekly en ${PAGINAS.length} paginas, Monitor solo en la home, y la fila llega a su lista.`);
