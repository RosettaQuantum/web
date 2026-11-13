/*
 * El informe nacional publica la edición PUBLICADA más reciente, no el slug más alto (13-nov-2026).
 * Casos contra los defectos reales: un borrador nuevo (6-nov) y un archivo «SIMULADO» (13-nov,
 * rama consola-v2 / feat/estado-completo-y-erratas). Más el caso de la carpeta real de hoy.
 */
export const CONSUMIDOR = { quien: "el prebuild (bloquea el deploy) y quien suelte una edición en src/data/informe-pqc/", hace: "saca la fija o marca la edición publicada antes de desplegar" };
import { readdirSync, readFileSync } from "node:fs";
import { elegirEdicion } from "../src/lib/informe-elegir.mjs";

const fallas = [];
const ed = (slug, d) => ({ slug, d: { edicion: slug, ...d } });
const ok = (c, m) => { if (!c) fallas.push(m); };

// grito 1: un borrador más nuevo NO desplaza a la publicada
let r = elegirEdicion([ed("2026-11", { borrador: "falta revisión" }), ed("2026-08", { borrador: false })]);
ok(r.actual.slug === "2026-08", "un borrador más nuevo desplazó a la edición publicada");
// grito 2: sin campo borrador (falla cerrado) tampoco desplaza
r = elegirEdicion([ed("2026-09", {}), ed("2026-08", { borrador: false })]);
ok(r.actual.slug === "2026-08", "una edición sin `borrador` desplazó a la publicada");
// grito 3: un archivo que se declara simulado rompe el build
let lanzo = false;
try { elegirEdicion([ed("2026-09", { SIMULADO: "Datos inventados" }), ed("2026-08", { borrador: false })]); } catch { lanzo = true; }
ok(lanzo, "un archivo con clave SIMULADO no rompió el build");
// silencio: dos publicadas → la más reciente, y su anterior es la siguiente
r = elegirEdicion([ed("2026-10", { borrador: false }), ed("2026-08", { borrador: false })]);
ok(r.actual.slug === "2026-10" && r.anterior?.slug === "2026-08", "con dos publicadas no eligió la más reciente");
// silencio: ninguna publicada → la más reciente (sale como borrador por la regla de la página)
r = elegirEdicion([ed("2026-08", {})]);
ok(r.actual.slug === "2026-08", "sin publicadas no mostró la única edición");
// la carpeta real de hoy
const dir = new URL("../src/data/informe-pqc/", import.meta.url);
const reales = readdirSync(dir).filter((f) => /^\d{4}-\d{2}\.json$/.test(f)).sort().reverse()
  .map((f) => ({ slug: f.slice(0, 7), d: JSON.parse(readFileSync(new URL(f, dir), "utf8")) }));
try { r = elegirEdicion(reales); ok(r.actual.d.borrador === false || !reales.some((e) => e.d.borrador === false), "la carpeta real no publica su edición publicada"); }
catch (e) { fallas.push(`la carpeta real: ${e.message}`); }

if (fallas.length) { console.error("check-informe-elige-publicada: FALLA\n  " + fallas.join("\n  ")); process.exit(1); }
console.log(`check-informe-elige-publicada: ok (borrador nuevo, sin borrador, SIMULADO, dos publicadas, carpeta real → ${r.actual.slug})`);
