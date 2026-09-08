/**
 * T-boletin — el bloque de captura del boletin esta en las paginas del blog Y ESTA VIVO.
 *
 * POR QUE EXISTE
 * --------------
 * En la QA del 8-sep se reporto que el bloque NO estaba, ni en los posts ni en /blog. Se
 * midio: si esta, en los dos indices y en los posts que sirve el Worker. El reporte
 * buscaba las palabras "subscribe" y "weekly", y el texto aprobado no usa ninguna de las
 * dos —dice "Get Edition 001 when it seals"—, asi que la busqueda dio cero sobre una
 * pagina correcta. Un guardia que busque VOCABULARIO PROPIO en vez del objeto encuentra
 * lo que no hay y no encuentra lo que hay.
 *
 * Pero el susto dejo ver que nada vigilaba este bloque, y es de los fragiles: no vive en
 * la pagina del post —los posts salen de D1— sino en el cascaron que el Worker rellena.
 * Si el cascaron cambia, desaparece de 106 paginas a la vez y el build sale verde.
 *
 * Y SE EJERCE, no solo se cuenta: el boton del Monitor de la home ya estuvo un mes siendo
 * un `mailto:` con el endpoint enchufado y nunca llamado. Aqui se llama de verdad, con un
 * correo invalido a proposito: la ruta tiene que responder 400 y no escribir nada. Eso
 * prueba que existe y que falla cerrada, sin ensuciar la tabla en cada corrida de CI.
 */
export const CONSUMIDOR = {
  quien: "quien empuja a una rama rebuild",
  hace: "no sigue: el unico punto de captura de correos del blog desaparecio de 106 paginas, o esta pintado y no escribe",
};

const PREVIEW = (process.env.PREVIEW_URL || "").replace(/\/+$/, "");
if (!PREVIEW) { console.error("ABORTA: falta PREVIEW_URL"); process.exit(1); }

const fallos = [];
const ok = (m) => console.log("  ok    " + m);
const mal = (m) => { console.log("  FALLA " + m); fallos.push(m); };
const traer = async (p) => (await fetch(PREVIEW + p, { headers: { "x-rq-check": "1" } })).text();

// El post NO se escribe a mano: se elige del indice en vivo. Un slug quemado deja de
// existir y la prueba pasaria a verificar un 404 sin que nadie mire.
const indice = await traer("/blog/");
const post = (indice.match(/href="(\/blog\/[a-z0-9-]+\/?)"/g) || [])
  .map((h) => h.slice(6, -1)).find((h) => h !== "/blog/");
if (!post) { console.log("ABORTA: el indice del blog no lista ningun post"); process.exit(1); }

const RUTAS = ["/blog/", "/es/blog/", post];
for (const ruta of RUTAS) {
  const h = await traer(ruta);
  const p = [];
  if ((h.match(/class="boletin"/g) || []).length !== 1) p.push(`${(h.match(/class="boletin"/g) || []).length} bloques (va exactamente 1)`);
  if (!h.includes('id="monMail"')) p.push("sin campo de correo");
  if (!h.includes('id="monGo"')) p.push("sin boton");
  // Sin el script, el boton es un mailto y el endpoint no se llama nunca.
  if (!h.includes("/js/paginas.js")) p.push("sin /js/paginas.js — el boton quedaria en mailto");
  if (p.length) mal(`${ruta} · ${p.join(" · ")}`);
  else ok(`${ruta.padEnd(46)} bloque + campo + boton + cableado`);
}

const js = await traer("/js/paginas.js");
if (!/monGo[\s\S]*monitor-lead/.test(js)) mal("/js/paginas.js no conecta el boton con /api/monitor-lead");
else ok("/js/paginas.js".padEnd(46) + "conecta el boton con /api/monitor-lead");

// EJERCICIO. Correo invalido a proposito: 400 y cero escritura.
const r = await fetch(PREVIEW + "/api/monitor-lead", {
  method: "POST", headers: { "content-type": "application/json", "x-rq-check": "1" },
  body: JSON.stringify({ email: "no-es-un-correo" }),
});
if (r.status !== 400) mal(`/api/monitor-lead con correo invalido -> ${r.status} (se espera 400: falla cerrada, no escribe)`);
else ok("/api/monitor-lead".padEnd(46) + "responde 400 al correo invalido — viva y falla cerrada");

// Grito: el guardia tiene que detectar la desaparicion del bloque, que es el modo de
// fallo real (cambia el cascaron, se cae de 106 paginas y el build queda verde).
{
  const sin = indice.split('class="boletin"').join('class="otra-cosa"');
  if ((sin.match(/class="boletin"/g) || []).length === 0) ok("grito".padEnd(52) + "si el bloque desaparece del cascaron, se detecta");
  else mal("la prueba de mutacion no quita el bloque — el guardia no sabe gritar");
}

if (fallos.length) { console.log(`\nT-boletin: ${fallos.length} fallo(s).`); process.exit(1); }
console.log(`\nT-boletin: el bloque esta en ${RUTAS.length} paginas y el endpoint responde.`);
