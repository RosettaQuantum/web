#!/usr/bin/env node
/**
 * El gráfico «Sume los años» (/es/q-ready, /q-ready) cuenta lo que dice la fuente, y nada más.
 *
 * QUÉ PROTEGE (25-nov-2026, al volverlo interactivo):
 *   1. Los tramos de la amenaza salen de `qday` de la edición vigente y se leen de su RÓTULO: «28–49%»
 *      es un rango, no un punto. Si `p` y el rótulo dejan de decir lo mismo, o aparece una forma de
 *      rótulo nueva, el núcleo lanza: no se dibuja a ojo.
 *   2. NO SE INTERPOLA. Se dibuja el gráfico para TODAS las combinaciones de los controles (450) y a
 *      cuatro anchos; cada porcentaje que aparece en el dibujo tiene que ser un rótulo publicado. Un
 *      «37%» interpolado entre 2036 y 2041 grita.
 *   3. La lectura de un año es el último horizonte que ya pasó (la acumulada no baja), con los bordes
 *      exactos: el año del horizonte ya cuenta; el anterior, no.
 *   4. El perfil de ejemplo (src/data/q-ready/mosca-perfil-ejemplo.json) dice lo mismo que el texto del
 *      informe en relojes[id=vida] («secretos 8 años y migrar le tomará 9»).
 *   5. Los textos nuevos (src/lib/mosca-textos.mjs) tienen las mismas claves y los mismos marcadores en
 *      los dos idiomas, y ninguna salida trae «NaN», «undefined» ni un marcador sin llenar.
 *
 * SU PUNTO CIEGO, declarado: mira el SVG como texto. Que se VEA bien —que un rótulo no tape otro a
 * 375 px, que la animación no tironee— lo ve una persona mirando la vista previa.
 *
 * Uso:  node scripts/check-mosca.mjs
 */
export const CONSUMIDOR = {
  quien: "la sesión que toque el gráfico de Mosca, sus textos o `qday` del informe",
  hace: "corrige el núcleo o el dato hasta que el dibujo vuelva a decir sólo lo que dice la encuesta",
};

import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tramosDe, tramoEn, cuenta, finEje, svgMosca, veredicto, llenar, LIMITES } from "../public/js/mosca-nucleo.mjs";
import { TEXTOS_MOSCA } from "../src/lib/mosca-textos.mjs";
import { TEXTOS_PUERTA } from "../src/lib/puerta-textos.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = resolve(REPO, "src/data/informe-pqc");
// La edición vigente, elegida igual que QReadyPuerta.astro: la de slug mayor.
const slug = readdirSync(DIR).filter((f) => /^\d{4}-\d{2}\.json$/.test(f)).sort().pop();
const ed = JSON.parse(readFileSync(resolve(DIR, slug), "utf8"));
const perfil = JSON.parse(readFileSync(resolve(REPO, "src/data/q-ready/mosca-perfil-ejemplo.json"), "utf8"));

let ok = 0, mal = 0;
const p = (n, c, d = "") => { if (c) { ok++; console.log(`  ok   ${n}`); } else { mal++; console.log(`  FALLA ${n}${d ? "\n         " + d : ""}`); } };
const lanza = (f) => { try { f(); return false; } catch { return true; } };

console.log(`check-mosca · edición ${slug}`);

// 1 · tramos leídos del rótulo, y falla cerrado.
const tramos = tramosDe(ed.qday);
p("lee un tramo por horizonte publicado", tramos.length === ed.qday.length);
p("cada tramo conserva su rótulo publicado", tramos.every((t, i) => t.lab === ed.qday[i].lab));
for (const t of tramos) {
  if (t.tipo === "rango") p(`«${t.lab}» es un rango (${t.lo}–${t.hi}), no un punto`, t.hi > t.lo);
  if (t.tipo === "piso") p(`«${t.lab}» es un piso sin techo`, t.hi === null);
}
const q0 = ed.qday;
const conRango = q0.findIndex((q) => /[–-]/.test(q.lab));
p("grito: un rango cuyo `p` no es su techo lanza", conRango < 0 || lanza(() => tramosDe(q0.map((q, i) => i === conRango ? { ...q, p: q.p + 1 } : q))));
p("grito: un rótulo con forma nueva lanza", lanza(() => tramosDe([{ h: "5 años · 2031", p: 15, lab: "15 aprox." }])));
p("grito: una acumulada que baja lanza", lanza(() => tramosDe([{ h: "5 años · 2031", p: 40, lab: "≥40%" }, { h: "10 años · 2036", p: 20, lab: "≥20%" }])));
p("grito: un horizonte sin año lanza", lanza(() => tramosDe([{ h: "5 años", p: 15, lab: "~15%" }])));
p("grito: sin `qday` lanza", lanza(() => tramosDe([])));

// 3 · la lectura de un año, con sus bordes.
const ahora = +ed.edicion.slice(0, 4);
const pri = tramos[0], ult = tramos[tramos.length - 1];
p("un año antes del primer horizonte no tiene estimación", tramoEn(pri.anio - 1, tramos) === null);
p("el año del horizonte ya cuenta", tramoEn(pri.anio, tramos) === pri);
p("entre dos horizontes vale el último que pasó (escalón, sin interpolar)",
  tramos.slice(0, -1).every((t, i) => tramoEn(tramos[i + 1].anio - 1, tramos) === t));
const c0 = cuenta({ ahora, secreto: perfil.secreto, migracion: perfil.migracion, tramos });
p(`el perfil de ejemplo necesita protección hasta ${ahora + perfil.secreto + perfil.migracion}`, c0.hasta === ahora + perfil.secreto + perfil.migracion);
const bordeA = cuenta({ ahora, secreto: 1, migracion: pri.anio - ahora - 2, tramos });
const bordeB = cuenta({ ahora, secreto: 1, migracion: pri.anio - ahora - 1, tramos });
p("un año antes del primer horizonte: a tiempo", bordeA.estado === "a-tiempo" && !bordeA.tarde);
p("justo en el primer horizonte: tarde", bordeB.estado === "tarde" && bordeB.tramo === pri);
p("después del último horizonte: tarde, «más allá»", cuenta({ ahora, secreto: ult.anio - ahora, migracion: 1, tramos }).estado === "mas-alla");

// 2 · no se interpola: cada porcentaje dibujado es un rótulo publicado. Todas las combinaciones.
const labs = new Set(ed.qday.map((q) => q.lab));
const T = (lang) => { const R = TEXTOS_PUERTA[lang].reloj; return { titulo: R.titulo, descA: R.descA, descItem: R.descItem, migrar: R.migrar,
  secreto: R.secreto, amenaza: R.amenaza, prob: R.prob, anios: R.anios, corte: R.corte, ...TEXTOS_MOSCA[lang] }; };
const sinEscala = (svg) => svg.replace(/<text class="mo-guia-t"[^>]*>50%<\/text>/g, "");
let combos = 0, intrusos = new Set(), sucios = 0, deter = true;
for (const lang of ["es", "en"]) for (const ancho of [260, 297, 343, 760, 1352]) {
  for (let s = LIMITES.secreto[0]; s <= LIMITES.secreto[1]; s++) for (let m = LIMITES.migracion[0]; m <= LIMITES.migracion[1]; m++) {
    const c = cuenta({ ahora, secreto: s, migracion: m, tramos });
    const e = { ancho, ahora, secreto: s, migracion: m, fin: finEje(c.hasta, tramos), tramos, textos: T(lang) };
    const svg = svgMosca(e);
    if (ancho === 760 && s === perfil.secreto && m === perfil.migracion) deter = deter && svg === svgMosca(e);
    // La guía del 50 % es ESCALA (una marca del eje), no una lectura de la encuesta: se aparta por su
    // clase, y sólo ella. Cualquier otro porcentaje tiene que ser un rótulo publicado.
    const texto = sinEscala(svg).replace(/<[^>]+>/g, " ") + " " + Object.values(veredicto(c, T(lang))).join(" ");
    for (const x of texto.match(/[~≥]?\d+(?:\s*[–-]\s*\d+)?\s*%/g) || []) if (!labs.has(x.trim())) intrusos.add(x.trim());
    if (/NaN|undefined|‹|›|Infinity/.test(svg + texto)) sucios++;
    combos++;
  }
}
p(`no interpola: ${combos} dibujos, ningún porcentaje que la encuesta no publique`, intrusos.size === 0, [...intrusos].join(", "));
p("la guía de escala es la única excepción, y está una sola vez por dibujo", (() => { const e = { ancho: 760, ahora, secreto: perfil.secreto, migracion: perfil.migracion, fin: 2051, tramos, textos: T("es") }; const svg = svgMosca(e); return (svg.match(/mo-guia-t/g) || []).length === 1 && !/%/.test(sinEscala(svg).replace(/<[^>]+>/g, " ").replace(/[~≥]?\d+(?:\s*[–-]\s*\d+)?\s*%/g, (x) => labs.has(x.trim()) ? "" : x)); })());
p("ningún dibujo trae NaN, undefined ni un marcador sin llenar", sucios === 0, `${sucios} sucios`);
p("el mismo estado da el mismo dibujo (servidor y navegador cuentan igual)", deter);
// Y el detector de intrusos detecta: un rótulo inventado en el dato tiene que gritar.
{
  const falso = ed.qday.map((q, i) => i === conRango ? { ...q, lab: "30–49%" } : q);
  const t2 = tramosDe(falso);
  const svg = svgMosca({ ancho: 760, ahora, secreto: perfil.secreto, migracion: perfil.migracion, fin: 2051, tramos: t2, textos: T("es") });
  const vistos = (sinEscala(svg).replace(/<[^>]+>/g, " ").match(/[~≥]?\d+(?:\s*[–-]\s*\d+)?\s*%/g) || []).filter((x) => !labs.has(x.trim()));
  p("mutación: un rótulo que no es el publicado se detecta", conRango < 0 || vistos.length > 0);
}

// El dibujo se hace al ancho real: si el viewBox fuera más ancho que la pantalla, 13 px se verían a 12
// (pasó: un mínimo de 300 contra un lienzo de 281 px a 375 dio 14 textos bajo 13 px).
for (const ancho of [260, 281, 297]) {
  const svg = svgMosca({ ancho, ahora, secreto: perfil.secreto, migracion: perfil.migracion, fin: 2051, tramos, textos: T("es") });
  p(`a ${ancho} px el viewBox mide ${ancho} (13 px se ven a 13)`, new RegExp(`viewBox="0 0 ${ancho} `).test(svg));
}

// 4 · el perfil de ejemplo y el texto del informe dicen lo mismo.
const vida = (ed.relojes || []).find((r) => r.id === "vida");
const mt = vida && vida.cuerpo.match(/secretos (\d+) años y migrar le tomará (\d+)/);
p("relojes[vida] trae el ejemplo «secretos N años y migrar le tomará M»", !!mt, vida ? vida.cuerpo.slice(0, 120) : "sin relojes[vida]");
p("el perfil de ejemplo coincide con ese texto", !!mt && +mt[1] === perfil.secreto && +mt[2] === perfil.migracion,
  mt ? `texto ${mt[1]}/${mt[2]} · archivo ${perfil.secreto}/${perfil.migracion}` : "");
p("el perfil de ejemplo cae dentro de los controles", perfil.secreto >= LIMITES.secreto[0] && perfil.secreto <= LIMITES.secreto[1]
  && perfil.migracion >= LIMITES.migracion[0] && perfil.migracion <= LIMITES.migracion[1]);

// 5 · los textos nuevos, parejos en los dos idiomas.
const ks = (o) => Object.keys(o).sort().join(",");
p("es y en tienen las mismas claves", ks(TEXTOS_MOSCA.es) === ks(TEXTOS_MOSCA.en));
const marcas = (s) => (s.match(/‹[^›]+›/g) || []).length;
p("los mismos marcadores en los dos idiomas", Object.keys(TEXTOS_MOSCA.es).every((k) => marcas(TEXTOS_MOSCA.es[k]) === marcas(TEXTOS_MOSCA.en[k])));
p("llenar falla si faltan valores (no deja un ‹año› a la vista)", lanza(() => llenar("hasta ‹año›", [])));

console.log(`\n  ${ok} ok · ${mal} fallas`);
process.exit(mal ? 1 : 0);
