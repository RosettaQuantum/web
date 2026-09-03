/**
 * T-es — la home en español no deja fragmentos en inglés fuera de lo declarado.
 *
 * POR QUE EXISTE
 * --------------
 * La home ES se audito DOS veces a mano y las dos dejaron pasar lo mismo, porque las dos
 * filtraban por largo: la primera pedia mas de 18 caracteres, la segunda mas de 14.
 * "days" tiene 4 y "per pilot" tiene 9. En la pagina se leia, a la vista de cualquiera:
 *     "desafiado a los 2 days"      y      "US$15.000–35.000 per pilot"
 * Un filtro de largo es un punto ciego con forma de criterio: parece que acota el ruido
 * y lo que acota es justo la clase de defecto mas facil de dejar.
 *
 * COMO
 * ----
 * Contra el HTML SERVIDO de /es/: saca el texto visible y marca cualquier fragmento con
 * palabra inglesa que no este declarado abajo. Sin minimo de largo.
 *
 * LO DECLARADO —y por que cada cosa se queda en ingles—
 *  · capa medida: ids, hashes, fechas selladas, nombres de solver, unidades;
 *  · rotulos dibujados DENTRO de un canvas (regla del cierre ES del 3-sep);
 *  · nombres de producto (Pilot Referee, Survival Clock, Evidence Library, Ledger…);
 *  · las tarjetas de Notes, que /v1/posts?lang=es reemplaza al mirar la pagina — lo
 *    horneado en ingles es solo el respaldo, y si sale es porque el endpoint fallo.
 *
 * PUNTO CIEGO DECLARADO: mira palabras inglesas, no gramatica. Una frase mal traducida
 * pero en español pasa verde. Eso lo lee un humano; esto caza el fragmento sin traducir.
 */
export const CONSUMIDOR = {
  quien: "quien empuja a una rama rebuild y quien aprueba el texto en español",
  hace: "no aprueba: la pagina en español tiene fragmentos en ingles a la vista, y los cortos no los ve nadie leyendo",
};

const PREVIEW = (process.env.PREVIEW_URL || "").replace(/\/+$/, "");
if (!PREVIEW) { console.error("ABORTA: falta PREVIEW_URL"); process.exit(1); }

// OJO CON EL LIMITE DE PALABRA: en JavaScript `\b` es ASCII, asi que en "Cómo" hay
// frontera entre la "ó" y la "m" y `\bmo\b` marca la palabra inglesa "mo" dentro de una
// palabra española. La primera version de este guardia reprobo "Cómo se ve una medición".
// Se usa un limite que trata cualquier LETRA —con tilde incluida— como parte de palabra.
const ING = /(?<!\p{L})(days?|per|month|year|of|and|the|for|with|from|on|in|at|to|by|seat|browse|request|still|surviving|eroded|contested|challenged|verdict|outcome|run|runs|raw|data|counts|scores|shots|search|open|all|more|less|show|hide|free|wins|sealed|tracked)(?!\p{L})/iu;

// Lo que se queda en ingles a proposito. Cada patron es una decision, no una excepcion
// de conveniencia: si algo nuevo aparece aqui, es porque se decidio que no se traduce.
const DECLARADO = [
  /RQ-|EXP-|V-\d|sha256|ibm_|eon_case|PDB|cleveland|Cα|iψ/,            // capa medida
  /CTQW|QAOA|CP-SAT|OR-Tools|XGBoost|Airbus|Taylor|Reynolds|OTS|MCP/,  // nombres tecnicos
  /Pilot Referee|Sealed Predictions|Evidence Library|Survival Clock|Advantage Monitor|decision page|Notes|Analyst|Firm/, // producto
  /^RUN · |^ERRATA · /,                                                // tipo de artefacto del ledger
  /verify ↗|hide ↙/,                                                   // control auditable
  /Maps &amp; data|Pillar|Canonical dictionary|architecture|QRAM|atoms/, // tarjetas que sirve /v1/posts
  /^[\s\d.,%·—→↗↙▸■●○┈━()\/+-]*$/,                                     // solo simbolos y numeros
];

// ARCHIVO_ES es para probar ANTES de desplegar, sobre dist/. En CI NUNCA se usa: el
// guardia mira la pagina SERVIDA, porque el defecto que caza puede entrar en el camino
// entre el build y el borde (es la leccion de la §1: comprueba lo desplegado).
const local = process.env.ARCHIVO_ES;
let html;
if (local) {
  html = (await import("node:fs")).readFileSync(local, "utf8");
  console.log(`(modo local: ${local} — CI usa la pagina servida)`);
} else {
  const r = await fetch(PREVIEW + "/es/", { headers: { "x-rq-check": "1" } });
  if (r.status !== 200) { console.error(`ABORTA: /es/ responde ${r.status}`); process.exit(1); }
  html = await r.text();
}
html = html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<!--[\s\S]*?-->/g, "");

const vistos = new Set();
const sueltos = [];
for (const m of html.matchAll(/>([^<>]{1,160})</g)) {
  const t = m[1].trim();
  if (!t || vistos.has(t)) continue;
  vistos.add(t);
  if (!ING.test(t)) continue;
  if (DECLARADO.some((re) => re.test(t))) continue;
  sueltos.push(t);
}

console.log(`preview: ${PREVIEW}/es/\nfragmentos de texto revisados: ${vistos.size}\n`);
if (sueltos.length) {
  sueltos.forEach((t) => console.log(`  FALLA sin traducir: ${JSON.stringify(t.slice(0, 100))}`));
  console.log(`\nT-es: ${sueltos.length} fragmento(s) en ingles sin declarar.`);
  console.log("Si alguno debe quedar en ingles, se declara en DECLARADO con su motivo. El rojo ES la pregunta.");
  process.exit(1);
}
console.log(`T-es: la home en español no deja fragmentos en ingles fuera de lo declarado.`);
