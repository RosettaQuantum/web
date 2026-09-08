/**
 * T-masa — el contenido sigue estando EN EL HTML, no sólo detrás de un fetch.
 *
 * EL DEFECTO QUE VIGILA (medido en el catastro del 7-sep)
 * ------------------------------------------------------
 * Al absorber /clases en /library, los 74 algoritmos dejaron de estar escritos en la
 * página: /clases servía 212 KB con 78 entradas en el HTML, /library servía 37 KB y no
 * nombraba ninguna. Lo mismo, más suave, en el ledger: de 52 ids de corrida y 48 enlaces
 * a evidencia en el HTML, a 15 y 12 — el resto pasó a pintarse desde /v1/runs.
 *
 * Para una persona no cambia nada: el buscador y la isla traen lo mismo. Para un
 * rastreador que no ejecuta JavaScript —y para un modelo que lee la página— el sitio
 * encogió. La indexación por LLM es el canal declarado de esta casa, así que esto no es
 * una preferencia de rendimiento: es el producto.
 *
 * POR QUE PISOS FIJOS Y NO UNA COMPARACION CONTRA PRODUCCION
 * ---------------------------------------------------------
 * Porque después del cutover producción SERA este sitio, y el guardia se compararía
 * consigo mismo: verde para siempre, mire lo que mire. Los pisos salen del dato sellado
 * (74 algoritmos en la instantánea del Zoo) y de una decisión declarada (40 artefactos).
 *
 * PUNTO CIEGO DECLARADO: cuenta presencia, no calidad. Una página con los 74 nombres y
 * descripciones vacías pasa verde. Eso lo ve un humano.
 */
export const CONSUMIDOR = {
  quien: "quien empuja a una rama rebuild y quien autoriza el cutover",
  hace: "no fusiona: el sitio se ve igual y trae menos contenido que el que reemplaza, y eso no se nota hasta que baja el tráfico",
};

const PREVIEW = (process.env.PREVIEW_URL || "").replace(/\/+$/, "");
if (!PREVIEW) { console.error("ABORTA: falta PREVIEW_URL"); process.exit(1); }

const cuenta = (t, re) => (t.match(re) || []).length;
const unicos = (t, re) => new Set(t.match(re) || []).size;

// [ruta, descripcion, medida, piso, por que ese piso]
const REGLAS = [
  ["/library",         "algoritmos escritos en la pagina", (t) => cuenta(t, /class="cat-fila"/g), 74, "los 74 de la instantanea sellada del Zoo"],
  ["/es/biblioteca",   "algoritmos escritos en la pagina", (t) => cuenta(t, /class="cat-fila"/g), 74, "los 74 de la instantanea sellada del Zoo"],
  ["/ledger",          "ids de artefacto en el HTML",      (t) => unicos(t, /RQ-[A-Z0-9-]{4,}|EXP-\d{4}-\d{3}/g), 40, "produccion servia 52; 40 es el piso decidido"],
  ["/es/ledger",       "ids de artefacto en el HTML",      (t) => unicos(t, /RQ-[A-Z0-9-]{4,}|EXP-\d{4}-\d{3}/g), 40, "produccion servia 52; 40 es el piso decidido"],
  ["/ledger",          "enlaces a la evidencia",           (t) => cuenta(t, /raw\.githubusercontent/g), 40, "produccion servia 48"],
  ["/es/ledger",       "enlaces a la evidencia",           (t) => cuenta(t, /raw\.githubusercontent/g), 40, "produccion servia 48"],
];

const fallos = [];
const cache = new Map();
async function html(r) {
  if (!cache.has(r)) cache.set(r, (await fetch(PREVIEW + r, { headers: { "x-rq-check": "1" } })).text());
  return cache.get(r);
}

console.log(`preview: ${PREVIEW}\n`);
for (const [ruta, que, medir, piso, porque] of REGLAS) {
  const t = await html(ruta);
  const n = medir(t);
  if (n < piso) {
    console.log(`  FALLA ${ruta.padEnd(16)} ${n} ${que} — el piso es ${piso} (${porque})`);
    fallos.push(`${ruta} ${que}`);
  } else {
    console.log(`  ok    ${ruta.padEnd(16)} ${String(n).padStart(3)} ${que} (piso ${piso})`);
  }
}

// Y el caso de silencio: el guardia tiene que CALLARSE sobre una pagina que
// legitimamente no lleva ninguna de las dos cosas. Sin esto, no se sabe si mide o grita.
const about = await html("/about");
const falsoPositivo = cuenta(about, /class="cat-fila"/g);
if (falsoPositivo) { console.log(`  FALLA /about lleva ${falsoPositivo} filas de catalogo — la regla se esta aplicando donde no toca`); fallos.push("/about"); }
else console.log("  ok    /about          sin filas de catalogo, como corresponde — la regla no se derrama");

if (fallos.length) { console.log(`\nT-masa: ${fallos.length} medida(s) bajo el piso. El sitio nuevo trae menos que el que reemplaza.`); process.exit(1); }
console.log("\nT-masa: el contenido sigue en el HTML, no solo detras de un fetch.");
