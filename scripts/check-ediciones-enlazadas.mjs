#!/usr/bin/env node
// La lista «Ediciones» de la tarjeta del informe (portada de seguridad, ES y EN) enlaza CADA edición
// publicada a su página permanente, y esa página existe en dist/ (24-nov-2026). Caso real: agosto
// quedó como texto sin enlace después de que nació /informe-pqc/2026-08/; Nicholas lo vio a ojo.
// Corre en postbuild, sobre lo construido. No cubre: que la página enlazada muestre ESA edición
// (eso lo miran los check-informe-*).
export const CONSUMIDOR = { quien: "sesión web de Rosetta, en el build", hace: "no publica la portada de seguridad si una edición del informe queda sin enlace a su página permanente: agrega el enlace en TarjetaInformePqc.astro" };
import fs from "node:fs";
import path from "node:path";
const DIST = path.resolve("dist");
const publicadas = fs.readdirSync("src/data/informe-pqc").filter((f) => /^\d{4}-\d{2}\.json$/.test(f))
  .filter((f) => JSON.parse(fs.readFileSync(path.join("src/data/informe-pqc", f), "utf8")).borrador === false)
  .map((f) => f.replace(".json", "")).sort();
let mal = 0, ok = 0;
const p = (n, c) => { c ? ok++ : mal++; console.log(`  ${c ? "ok   " : "FALLA"} ${n}`); };
export function enlacesDeArchivo(html) {
  const m = html.match(/<div class="qr-archivo">([\s\S]*?)<\/ol>/);
  if (!m) return null;
  return [...m[1].matchAll(/<li>([\s\S]*?)<\/li>/g)].map((li) => (li[1].match(/<a href="\/informe-pqc\/(\d{4}-\d{2})\/"/) || [])[1] || null);
}
// autoprueba contra el defecto real (la vigente enlazada, agosto en <span>)
const roto = '<div class="qr-archivo"><ol><li><a href="/informe-pqc">Noviembre de 2026</a></li><li><span>Agosto de 2026</span></li></ol>';
p("grito: el HTML que salió el 24-nov (agosto sin enlace) se detecta", enlacesDeArchivo(roto).every((x) => x === null));
const sano = '<div class="qr-archivo"><ol><li><a href="/informe-pqc/2026-11/">N</a></li><li><a href="/informe-pqc/2026-08/">A</a></li></ol>';
p("silencio: dos ediciones enlazadas a su URL permanente", enlacesDeArchivo(sano).join() === "2026-11,2026-08");
for (const pag of ["es/q-ready/index.html", "q-ready/index.html"]) {
  const f = path.join(DIST, pag);
  if (!fs.existsSync(f)) { p(`${pag} existe en dist/`, false); continue; }
  const e = enlacesDeArchivo(fs.readFileSync(f, "utf8"));
  p(`${pag}: la lista Ediciones existe`, Array.isArray(e));
  if (!e) continue;
  p(`${pag}: ${e.length} ediciones listadas = ${publicadas.length} publicadas`, e.length === publicadas.length);
  p(`${pag}: todas enlazadas a /informe-pqc/AAAA-MM/ (${e.map((x) => x || "SIN ENLACE").join(", ")})`, e.every(Boolean));
  for (const s of e.filter(Boolean)) p(`${pag}: /informe-pqc/${s}/ existe en dist/`, fs.existsSync(path.join(DIST, "informe-pqc", s, "index.html")));
}
console.log(`check-ediciones-enlazadas: ${ok} pasaron, ${mal} fallaron`);
process.exit(mal ? 1 : 0);
