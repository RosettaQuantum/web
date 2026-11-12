#!/usr/bin/env node
/**
 * La medición en vivo existe en dos idiomas y al lector en inglés no le llega español.
 *
 * Por qué existe (12-nov-2026): /q-ready/medicion se construyó en inglés sobre los MISMOS
 * scripts que /es/q-ready/medicion; los .mjs leen <html lang> y eligen el texto. El modo de
 * fallo es silencioso: un mensaje que nuestro servidor escribe en español («el servidor de
 * medición no entregó a tiempo», lib/correo-envivo.mjs) o un cableado que olvida pasar el
 * idioma, y el lector en inglés ve una frase en español en medio de la página.
 *
 * Comprueba, contra el código que corre (no contra un ejemplo inventado):
 *  1. Funcional: carga medicion-historia.mjs con un DOM mínimo, en inglés y en español, y le
 *     entrega una medición con la causa REAL en español del servidor de correo y un error real
 *     del runtime. Grito: en inglés, ni el veredicto ni las tarjetas pueden traer español.
 *     Silencio: en español sale exactamente lo de antes (veredicto byte a byte).
 *  2. Funciones puras de medicion-palabras.mjs con los mensajes reales de lib/*.mjs.
 *  3. Cableado en medicion-envivo.mjs: cada enPalabras() lleva idioma y cada traza que muestra
 *     un error del servidor lo pasa por traz() en su rama inglesa.
 *  4. Las dos páginas existen, se declaran mutuamente (hreflang vía altUrl), tienen los mismos
 *     ids (los scripts los buscan por id) y el sitemap empareja las dos URLs.
 *   node scripts/check-medicion-bilingue.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { enPalabras, fraseVeredicto, delServidor, detalleEndpointEn, paraTraza, fuenteCT } from "../public/js/medicion-palabras.mjs";

export const CONSUMIDOR = { quien: "sesion web de Rosetta", hace: "traduce el texto nuevo en las dos ramas (t(es, en)) o corrige el cableado antes de desplegar" };

const fallas = [];
const raiz = new URL("../", import.meta.url);
const leer = (r) => readFileSync(new URL(r, raiz), "utf8");
// Español que no puede llegar a un lector en inglés: tildes, eñes y palabras que el inglés no usa.
const ESPANOL = /[áéíóúñ¿¡«»]|\b(el|la|los|las|del|servidor|medición|pudimos|su|sus|correo|sitio|todavía|está|sonda|entregó|vuelva|medido|clásico)\b/i;
const sinEspanol = (txt, q) => { const m = ESPANOL.exec(txt); if (m) fallas.push(`${q}: llega español («${m[0]}») → ${txt.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 140)}`); };

// Mensajes REALES que escribe nuestro servidor (se leen del código, no se recuerdan).
const correoLib = leer("lib/correo-envivo.mjs");
const causaReal = /no entregó a tiempo/.test(correoLib) ? "el servidor de medición no entregó a tiempo" : null;
if (!causaReal) fallas.push("lib/correo-envivo.mjs ya no escribe «el servidor de medición no entregó a tiempo»: actualizar el caso real");
const reales = [...correoLib.matchAll(/error: "([^"]*[a-záéíóúñ][^"]*)"/g), ...leer("lib/informe-envivo.mjs").matchAll(/error: "([^"]*[áéíóúñ][^"]*)"/g),
  ...leer("lib/envio-informe.mjs").matchAll(/error: "([^"]*[áéíóúñ][^"]*)"/g), ...leer("lib/ct-registro.mjs").matchAll(/error: "([^"]*[áéíóúñ ][^"]*)"/g)]
  .map((m) => m[1]).filter((t) => t.length > 6 && /\s/.test(t));
// Y los errores que esas mismas bibliotecas LANZAN y viajan como texto (caso real del 12-nov:
// «crt.sh respondió 502» llegó a la consola inglesa como frase general). Las interpolaciones se
// rellenan con un valor plausible.
for (const f of ["lib/ct-registro.mjs", "lib/borde-envivo.mjs", "lib/informe-envivo.mjs"])
  for (const m of leer(f).matchAll(/new Error\((["`])((?:(?!\1).)*)\1\)/g))
    if (/[áéíóúñ]|\b(respuesta|servidor|registro|sin|alerta|respondió)\b/.test(m[2])) reales.push(m[2].replace(/\$\{[^}]*ESPERA_MS[^}]*\}/g, "8").replace(/\$\{[^}]*\}/g, "502"));
if (reales.length < 8) fallas.push(`sólo ${reales.length} mensajes reales del servidor encontrados: la lectura de lib/ se rompió`);

// ---------------------------------------------------------------- 2 · funciones puras
for (const m of [causaReal, ...reales].filter((x) => x && /[áéíóúñ]|\b(el|la|los|del|servidor|respuesta|registro|sin|alerta|respondió|demasiadas|demasiados|escriba|escribe|pedido|dominio|como)\b/i.test(x))) {
  // con tabla: ninguno cae a la frase general (la general es la red, no la regla)
  if (delServidor(m, "en") === "we did not get a usable response from the server") fallas.push(`«${m}» no tiene traducción en la tabla: cae a la frase general`);
  sinEspanol(enPalabras(m, "en"), `enPalabras(«${m}», en)`);
  sinEspanol(delServidor(m, "en"), `delServidor(«${m}», en)`);
  sinEspanol(paraTraza(m, "en"), `paraTraza(«${m}», en)`);
  if (delServidor(m) !== m) fallas.push(`delServidor cambia el español: «${m}»`);
}
sinEspanol(enPalabras("un mensaje nuevo que nadie tradujo todavía", "en"), "español sin tabla cae a lo general");
if (enPalabras("Stream was cancelled", "en") !== "the connection was cut before it finished") fallas.push("el caso real del runtime no se traduce en inglés");
if (paraTraza("Stream was cancelled", "en") !== "Stream was cancelled") fallas.push("la traza en inglés debe dejar el crudo del runtime (ya es inglés)");
// La fuente del registro: caso real del 12-nov en el preview, «Cert Spotter (SSLMate), sólo
// certificados vigentes, server copy» llegó a la consola en inglés. Se lee de lib/ct-registro.mjs.
const csReal = /const CS = "([^"]+)"/.exec(leer("lib/ct-registro.mjs"))?.[1];
if (!csReal) fallas.push("lib/ct-registro.mjs ya no declara la fuente Cert Spotter: actualizar el caso real");
for (const f of [csReal, `${csReal}, copia del servidor`, "crt.sh, copia guardada en este navegador", "archivo respuesta.json"].filter(Boolean)) {
  sinEspanol(fuenteCT(f, "en"), `fuenteCT(«${f}», en)`);
  if (fuenteCT(f) !== f) fallas.push(`fuenteCT cambia el español: «${f}»`);
}
if (csReal && fuenteCT(csReal, "en") !== csReal.replace(", sólo certificados vigentes", ", valid certificates only")) fallas.push(`la fuente Cert Spotter cae a la etiqueta general: «${fuenteCT(csReal, "en")}»`);
if (!/fuenteTxt\(x\.fuente\)/.test(leer("public/js/medicion-envivo.mjs")) || !/fuenteTxt\(ct\.fuente\)/.test(leer("public/js/medicion-envivo.mjs"))) fallas.push("medicion-envivo.mjs muestra la fuente del registro sin fuenteTxt()");
for (const d of ["DNS sin respuesta: timeout", "el nombre ya no existe en DNS: no se envió saludo", "DNS SERVFAIL sin direcciones: no se envió saludo",
  "sin respuesta TLS en 443 (Stream was cancelled)", "sin respuesta en 443: el nombre no expone un servicio web", "responde; grupo X25519MLKEM768"])
  sinEspanol(detalleEndpointEn(d), `detalleEndpointEn(«${d}»)`);
const L = (w, c, ce) => [{ k: "web", estado: w }, { k: "correo", estado: c }, { k: "endp", estado: "info" }, { k: "cert", estado: ce }, { k: "ssh", estado: "nm" }];
for (const [w, c, ce] of [["si", "no", "no"], ["si", "nm", "no"], ["nm", "nm", "nm"], ["no", "si", "nm"]]) sinEspanol(fraseVeredicto(L(w, c, ce), "en"), `veredicto en ${w}/${c}/${ce}`);
if (/not (yet )?protected/i.test(fraseVeredicto(L("nm", "nm", "nm"), "en"))) fallas.push("en inglés, tres canales sin medir se leen como no protegidos");
if (fraseVeredicto(L("si", "nm", "no"), "en") !== "Your website is already protected. Your certificate, not yet. We could not measure your email.") fallas.push("el veredicto en inglés no separa lo no medido");

// ---------------------------------------------------------------- 1 · funcional sobre medicion-historia.mjs
function domFalso(lang) {
  const els = new Map();
  const el = () => ({ innerHTML: "", textContent: "", hidden: true, disabled: false, value: "", checked: false, dataset: {}, style: { setProperty() {} },
    classList: { toggle() {}, add() {} }, addEventListener() {}, setAttribute() {}, querySelectorAll: () => [], getBoundingClientRect: () => ({ height: 60 }) });
  const oyentes = {};
  globalThis.document = { documentElement: { lang, style: { setProperty() {} } }, getElementById: (id) => (els.has(id) || els.set(id, el()), els.get(id)),
    querySelector: () => null, querySelectorAll: () => [] };
  globalThis.window = { addEventListener: (n, f) => { oyentes[n] = f; } };
  // Los archivos publicados que la página lee (cápsula y Shor) se sirven del disco, tal cual.
  globalThis.fetch = (u) => /^\/datos\//.test(u) ? Promise.resolve({ json: async () => JSON.parse(leer("public" + u)) }) : Promise.reject(new Error("sin red en el guardia"));
  globalThis.IntersectionObserver = class { observe() {} };
  return { els, oyentes };
}
const medicion = {
  dominio: "ejemplo.cl", www: "www.ejemplo.cl", foto: { sha256: "x" },
  d: { endpoints: [{ host: "a.ejemplo.cl", responde_443: true }] },
  s: { borde: { veredicto: { soporta: true }, dns: { cdn: "sin CNAME" }, medido_utc: "2026-11-12T10:00:00Z" },
    correo_tls: { estado: "sin_respuesta", causa: causaReal || "el servidor de medición no entregó a tiempo" },
    certificado: { ok: false, error: "Stream was cancelled" } },
};
async function correr(lang) {
  const { els, oyentes } = domFalso(lang);
  await import(new URL(`../public/js/medicion-historia.mjs?lang=${lang}`, import.meta.url).href);
  if (!oyentes["mv:medido"]) { fallas.push(`medicion-historia.mjs (${lang}) no escucha mv:medido`); return null; }
  oyentes["mv:medido"]({ detail: medicion });
  await new Promise((r) => setTimeout(r, 50));
  return { capsula: (els.get("mv-cap-pie")?.innerHTML || "") + " " + (els.get("mv-cap-hex")?.textContent || "") + " " + (els.get("mv-shor-nota")?.innerHTML || "") + " " + (els.get("mv-cap-lee")?.innerHTML || ""), veredicto: els.get("mv-veredicto")?.textContent || "", canales: els.get("mv-canales")?.innerHTML || "", puente: els.get("mv-puente")?.innerHTML || "" };
}
const en = await correr("en");
if (en) {
  sinEspanol(en.veredicto, "EN · veredicto pintado");
  sinEspanol(en.canales.replace(/class="[^"]*"/g, ""), "EN · tarjetas de canales");
  sinEspanol(en.puente.replace(/(class|href)="[^"]*"/g, ""), "EN · puente");
  // caso real del 12-nov: el archivo de la cápsula dice «x25519 (clásico)» y llegó así al inglés
  sinEspanol(en.capsula.replace(/(class|href)="[^"]*"/g, ""), "EN · cápsula y Shor");
  if (!/real capture/.test(en.capsula) || !/Exact simulation/.test(en.capsula)) fallas.push("EN · la cápsula o la corrida de Shor no se pintaron en el guardia: el caso no se ejerció");
  if (!/We could not measure your email/.test(en.veredicto)) fallas.push(`EN · el correo sin medir no se nombra como no medido: «${en.veredicto}»`);
}
const es = await correr("es");
if (es) {
  // silencio: el español es el de siempre, letra por letra
  const esperado = "Su sitio ya está protegido. No pudimos medir su correo y su certificado.";
  if (es.veredicto !== esperado) fallas.push(`ES · el veredicto cambió: «${es.veredicto}» (esperaba «${esperado}»)`);
  if (!es.canales.includes("No pudimos medir el cifrado de su correo: el servidor de medición no entregó a tiempo.")) fallas.push("ES · la tarjeta del correo ya no dice la causa en español como antes");
}

// ---------------------------------------------------------------- 3 · cableado en medicion-envivo.mjs
const envivo = leer("public/js/medicion-envivo.mjs");
if (!/const EN = document\.documentElement\.lang === "en"/.test(envivo)) fallas.push("medicion-envivo.mjs no lee el idioma del documento");
envivo.split("\n").forEach((l, i) => {
  if (/^\s*(\/\/|\*)/.test(l) || !/enPalabras\(/.test(l) || /^import/.test(l)) return;
  // cada llamada lleva idioma, o vive en la rama española de un t(es, en) cuya rama inglesa lo lleva
  const llamadas = l.match(/enPalabras\((?:[^()]|\([^()]*\))*\)/g) || [];
  const conIdioma = llamadas.filter((c) => /,\s*(IDIOMA|"en")\)$/.test(c)).length;
  if (conIdioma === 0) fallas.push(`medicion-envivo.mjs:${i + 1} llama a enPalabras() sin idioma: ${l.trim().slice(0, 100)}`);
});
// trazas que muestran un error del servidor: en su rama inglesa pasan por traz()
const sentencias = envivo.split(/\n(?=\s*(?:\}\s*else\s+)?(?:traza|aviso|if|for|const|let|\}|\$|ct =|return|riel|await|catch))/);
for (const s of sentencias) {
  if (!/\btraza\(/.test(s)) continue;
  if (/\$\{\s*esc\(\s*(c|sa|co|x)\??\.(error|causa)|\$\{\s*esc\(\s*co\.(causa|resultado\.error)|err\.message\)\}\)?`?\s*:/.test(s) && !/traz\(/.test(s))
    fallas.push(`traza con error del servidor sin traz(): ${s.trim().slice(0, 110)}`);
}
const historia = leer("public/js/medicion-historia.mjs");
// t(es, en) no puede quedar tapado por otra variable `t` (caso real del 12-nov en el preview:
// consultarCT tenía `const t = performance.now()` y aviso(t(…)) reventó con «t is not a function»;
// la medición se cortaba en los dos idiomas apenas crt.sh fallaba).
for (const [f, txt] of [["medicion-envivo.mjs", envivo], ["medicion-historia.mjs", historia]]) {
  const lineas = txt.split("\n");
  // Declaración (`const t =`): su alcance son las líneas siguientes del bloque, hasta la próxima que
  // empieza en la columna 0. Parámetro de una flecha de una línea (`(t) =>`, `([n, t]) =>`): el
  // resto de esa línea. Precisión antes que cobertura: una `t` local que nadie llama no grita.
  lineas.forEach((l, i) => {
    if (/^\s*(\/\/|\*)/.test(l)) return;
    let alcance = null;
    if (/\b(const|let|var)\s+t\s*=(?!\s*\(es, en\))/.test(l)) {
      let fin = i + 1; while (fin < lineas.length && !/^\S/.test(lineas[fin])) fin++;
      alcance = [l.replace(/^.*?\bt\s*=/, ""), ...lineas.slice(i + 1, fin)].join("\n");
    } else {
      const m = /(?:\(\s*t\s*(?:,[^)]*)?\)|\(\s*\[\s*\w+\s*,\s*t\s*\]\s*\))\s*=>(.*)$/.exec(l);
      if (m) alcance = m[1];
    }
    if (alcance != null && /(^|[^\w.])t\(/.test(alcance)) fallas.push(`${f}:${i + 1} una variable local \`t\` tapa a t(es, en) y alguien la llama: ${l.trim().slice(0, 90)}`);
  });
}
if (!/fraseVeredicto\(lista, IDIOMA\)/.test(historia)) fallas.push("medicion-historia.mjs no pasa el idioma a fraseVeredicto()");

// ---------------------------------------------------------------- 4 · las dos páginas
const PES = "src/pages/es/q-ready/medicion/index.astro", PEN = "src/pages/q-ready/medicion/index.astro";
if (!existsSync(new URL(PES, raiz)) || !existsSync(new URL(PEN, raiz))) fallas.push("falta una de las dos páginas de la medición");
else {
  const pes = leer(PES), pen = leer(PEN);
  if (!/lang="es" altUrl="\/q-ready\/medicion"/.test(pes)) fallas.push("la página española no declara a la inglesa (altUrl → hreflang)");
  if (!/lang="en" altUrl="\/es\/q-ready\/medicion"/.test(pen)) fallas.push("la página inglesa no declara a la española (altUrl → hreflang)");
  const ids = (t) => [...t.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]).sort().join(" ");
  if (ids(pes) !== ids(pen)) fallas.push("las dos páginas no tienen los mismos ids: los scripts no encontrarían sus elementos");
  for (const p of [pes, pen]) for (const js of ["/js/medicion-envivo.mjs", "/js/medicion-historia.mjs"]) if (!p.includes(`src="${js}"`)) fallas.push(`una página no carga ${js}`);
  const cuerpo = pen.slice(pen.indexOf("<MarcaLayout"));
  const visible = cuerpo.replace(/<script type="application\/ld\+json"[\s\S]*?\/>/, "").replace(/<[^>]+>/g, " ");
  sinEspanol(visible, "texto visible de la página inglesa");
  const conf = leer("astro.config.mjs");
  if (!conf.includes("${SITE}/q-ready/medicion/") || !conf.includes("${SITE}/es/q-ready/medicion/")) fallas.push("el sitemap no empareja las dos URLs de la medición");
}

if (fallas.length) { console.error("[medicion-bilingue] FALLA\n  " + fallas.join("\n  ")); process.exit(1); }
console.log(`[medicion-bilingue] ok: ${reales.length + 1} mensajes reales del servidor sin español en inglés, veredicto ES intacto, cableado y hreflang de las dos páginas`);
