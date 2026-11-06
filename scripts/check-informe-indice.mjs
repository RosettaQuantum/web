#!/usr/bin/env node
/**
 * T-informe-indice — el indice, la barra fina y las secciones dicen lo mismo.
 *
 * LO QUE PASO (5-nov-2026)
 * -----------------------
 * El informe tenia DOS listas de sus secciones: un `const SECCIONES` de doce entradas que
 * no usaba nadie, y el indice visible escrito a mano con trece. Ya habian divergido —a la
 * muerta le faltaba «Los cuatro relojes» y cuatro titulos decian otra cosa— y nada lo
 * noto, porque una lista que no se pinta no da error. Al agregar la barra fina al
 * desplazar, esa misma lista pasa a pintarse en DOS lugares: si vuelven a separarse, el
 * lector ve un indice que promete una seccion y una barra que nombra otra.
 *
 * Hoy las dos salen de `SECCIONES`, asi que no pueden diferir por descuido. Lo que ESTE
 * guardia cubre es lo otro: que esa lista siga siendo la lista real del documento. Una
 * seccion nueva en el HTML que nadie agrega a `SECCIONES` no rompe nada visible —queda
 * fuera del indice y fuera de la barra, y el documento se ve entero igual.
 *
 * PUNTO CIEGO DECLARADO: compara ids, titulos y orden sobre el HTML construido. NO
 * comprueba que el salto deje el titulo donde se ve (eso es `scroll-margin-top`, que se
 * le pregunta al navegador) ni que el texto de cada titulo sea bueno: eso lo lee Nicholas.
 * Y mira SOLO /informe-pqc: /informe-cliente comparte la hoja pero no lleva barra fina.
 */
import { readFileSync, existsSync } from "node:fs";

export const CONSUMIDOR = {
  quien: "quien empuja a una rama rebuild y quien autoriza el cutover",
  hace: "no publica: el indice del informe, la barra fina y las secciones del documento dejaron de decir lo mismo",
};

const PAGINA = "dist/informe-pqc/index.html";
const fallos = [];
const ok = (m) => console.log("  ok    " + m);
const mal = (m) => { console.log("  FALLA " + m); fallos.push(m); };

if (!existsSync(PAGINA)) { console.error(`ABORTA: no existe ${PAGINA} — corre despues del build`); process.exit(1); }
const html = readFileSync(PAGINA, "utf8");

// Las tres listas, leidas del HTML servido y no de la plantilla: lo que importa es lo que
// le llega al lector. El texto se normaliza (espacios y saltos) porque el formateador
// parte las lineas y «Panel de exposicion ·\n  lectura» es el mismo titulo.
const limpia = (s) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const sacar = (bloque, re) => [...bloque.matchAll(re)].map((m) => ({ id: m[1], t: limpia(m[2]) }));

const trozo = (abre, cierra) => {
  const i = html.indexOf(abre);
  if (i < 0) return null;
  const j = html.indexOf(cierra, i);
  return j < 0 ? null : html.slice(i, j);
};

const bloqueToc = trozo('<nav class="toc"', "</nav>");
const bloqueBarra = trozo('<ol class="tb-lista"', "</ol>");
if (!bloqueToc) mal("la pagina no trae <nav class=\"toc\">: o se renombro, o el indice desaparecio");
if (!bloqueBarra) mal("la pagina no trae <ol class=\"tb-lista\">: la barra fina no se esta pintando");
if (fallos.length) { console.log(`\nT-informe-indice: ${fallos.length} fallo(s).`); process.exit(1); }

const indice = sacar(bloqueToc, /href="#([^"]+)"[^>]*>([\s\S]*?)<\/a>/g);
const barra = sacar(bloqueBarra, /href="#([^"]+)"[^>]*>([\s\S]*?)<\/a>/g);
// En la barra cada enlace empieza por su numero en un <span>; al limpiar las etiquetas
// queda pegado al titulo. Se le quita para comparar contra el indice, que no lo lleva.
const barraLimpia = barra.map((s) => ({ id: s.id, t: s.t.replace(/^\d\d\s*/, "") }));
const secciones = [...html.matchAll(/<section id="([^"]+)"/g)].map((m) => m[1]);

if (!indice.length || !barraLimpia.length || !secciones.length) {
  mal(`alguna lista salio vacia (indice:${indice.length} barra:${barraLimpia.length} secciones:${secciones.length})`);
} else {
  ok(`${secciones.length} secciones · ${indice.length} en el indice · ${barraLimpia.length} en la barra`);
}

const comoTexto = (l) => l.map((s) => `${s.id}|${s.t}`).join("\n");
const difiere = (a, b) => {
  const A = comoTexto(a).split("\n"), B = comoTexto(b).split("\n");
  const n = Math.max(A.length, B.length);
  for (let i = 0; i < n; i++) if (A[i] !== B[i]) return `fila ${i + 1}: «${A[i] ?? "(no hay)"}» vs «${B[i] ?? "(no hay)"}»`;
  return null;
};

// 1 · el indice y la barra, misma lista y mismo orden
{
  const d = difiere(indice, barraLimpia);
  if (d) mal(`el indice y la barra fina no dicen lo mismo — ${d}`);
  else ok("el indice y la barra fina: mismos ids, mismos titulos, mismo orden");
}

// 2 · y esa lista es la del documento. Las dos direcciones: una seccion sin entrada es
// una parte del informe a la que no se llega, y una entrada sin seccion es un enlace al
// vacio. Mirar una sola direccion deja viva la mitad del defecto.
{
  const ids = indice.map((s) => s.id);
  const sinEntrada = secciones.filter((id) => !ids.includes(id));
  const sinSeccion = ids.filter((id) => !secciones.includes(id));
  if (sinEntrada.length) mal(`secciones del documento que no estan en el indice: ${sinEntrada.join(" · ")}`);
  if (sinSeccion.length) mal(`entradas del indice que no son una seccion: ${sinSeccion.join(" · ")}`);
  if (!sinEntrada.length && !sinSeccion.length) {
    const d = difiere(secciones.map((id) => ({ id, t: "" })), ids.map((id) => ({ id, t: "" })));
    if (d) mal(`el indice no va en el orden del documento — ${d}`);
    else ok("la lista es exactamente la del documento, y en su orden");
  }
}

// 3 · la etiqueta que la barra muestra antes de que corra el script es la primera seccion.
// Sin JS la barra sirve igual, y tiene que decir algo cierto.
{
  const m = bloqueToc && html.match(/<span class="tb-n">([^<]*)<\/span>\s*<span class="tb-t">([\s\S]*?)<\/span>/);
  if (!m) mal("la barra no trae etiqueta inicial: sin JS no dice en que seccion va");
  else if (m[1].trim() !== "01" || limpia(m[2]) !== indice[0].t)
    mal(`la etiqueta inicial dice «${m[1].trim()} ${limpia(m[2])}» y la primera seccion es «01 ${indice[0].t}»`);
  else ok(`etiqueta inicial sin JS: «01 ${indice[0].t}»`);
}

// 4 · la barra fina se pega DEBAJO de la barra del sitio, no a un alto supuesto.
// Caso real (6-nov-2026): la barra fina iba a `top:60px`, el alto de .nav-inner. En
// produccion la franja de frescura aparece despues de cargar y la barra del sitio mide
// ~97: la fina quedaba entera detras (z 50 sobre 40) y el lector no la veia nunca. En la
// vista previa local la franja no aparece, asi que ahi se veia perfecta. Ahora el script
// mide el alto real y lo deja en --alto-nav. Se miran el CSS SIN comentarios (el comentario
// que explica el defecto nombra el `60px`) y el script servido.
const sinComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "");
const topDeBarra = (css) => {
  const m = sinComentarios(css).match(/\.tocbar\s*\{[^}]*?\btop\s*:\s*([^;}]+)/);
  return m ? m[1].trim() : null;
};
const topSigueAlSitio = (t) => !!t && /^var\(--alto-nav\b/.test(t);
{
  const t = topDeBarra(html);
  if (!t) mal("no encuentro el `top` de .tocbar en la pagina: o se renombro, o la barra ya no es sticky");
  else if (!topSigueAlSitio(t)) mal(`.tocbar se pega a «${t}», un alto fijo: en produccion la barra del sitio cambia de alto y la tapa`);
  else ok(`la barra fina se pega a «${t}», el alto medido de la barra del sitio`);
  const JS = "dist/js/informe-indice.js";
  const js = existsSync(JS) ? readFileSync(JS, "utf8") : "";
  if (!/setProperty\(\s*['"]--alto-nav['"]/.test(js)) mal(`${JS} no fija --alto-nav: la barra quedaria en el respaldo de 60 px`);
  else ok("el script mide la barra del sitio y fija --alto-nav");
}

// Grito y silencio, por mutacion sobre copias en memoria. Sin esto el guardia solo
// demuestra que sabe callarse el dia que todo esta bien.
{
  const quitada = indice.slice(0, -1);
  const cambiada = indice.map((s, i) => (i === 2 ? { id: s.id, t: s.t + " (otro)" } : s));
  const gritaFalta = !!difiere(indice, quitada);
  const gritaTexto = !!difiere(indice, cambiada);
  const calla = !difiere(indice, indice.map((s) => ({ ...s })));
  if (gritaFalta && gritaTexto && calla)
    ok("grito/silencio           si cae una entrada o cambia un titulo se detecta; dos listas iguales no gritan");
  else mal(`la mutacion no sirve (falta:${gritaFalta} texto:${gritaTexto} silencio:${calla})`);
}
{
  const gritaFijo = !topSigueAlSitio(topDeBarra(".tocbar{position:sticky;top:60px;z-index:40}"));
  const callaVar = topSigueAlSitio(topDeBarra(".tocbar{position:sticky;top:var(--alto-nav,60px);z-index:40}"));
  // El paradojico: el defecto descrito en un comentario, y el codigo bien.
  const callaComentario = topSigueAlSitio(topDeBarra("/* antes: .tocbar{top:60px} */ .tocbar{top:var(--alto-nav,60px)}"));
  if (gritaFijo && callaVar && callaComentario)
    ok("grito/silencio           top:60px grita; var(--alto-nav) y un comentario que nombra 60px no");
  else mal(`la mutacion del alto no sirve (fijo:${gritaFijo} var:${callaVar} comentario:${callaComentario})`);
}

if (fallos.length) { console.log(`\nT-informe-indice: ${fallos.length} fallo(s). La pagina se ve entera igual: por eso esto se mira aqui.`); process.exit(1); }
console.log("\nT-informe-indice: indice, barra fina y secciones son la misma lista.");
