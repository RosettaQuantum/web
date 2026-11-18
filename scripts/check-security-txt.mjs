/*
 * Nuestro propio security.txt existe, es válido (RFC 9116) y no está por vencer (18-nov-2026).
 * Defecto real: el informe de noviembre le señala al 97 % de las organizaciones que no publican
 * security.txt, y rosettaquantum.com tampoco lo publicaba (404). Texto aprobado por Nicholas el
 * 18-nov («Sí, así»). Un security.txt vencido es peor que ninguno: dice «no me escribas».
 * Grita si falta Contact, si falta Expires, o si Expires vence en menos de 60 días.
 * NO cubre: que el buzón de Contact reciba de verdad (eso es correo, no build).
 */
export const CONSUMIDOR = { quien: "el postbuild (bloquea el deploy) y quien renueve public/.well-known/security.txt", hace: "mueve Expires antes de que falten 60 días; no lo deja vencer" };
import fs from "node:fs";

export function revisar(txt, ahora = new Date()) {
  const mal = [], lineas = txt.split(/\r?\n/).filter((l) => l && !l.startsWith("#"));
  const campo = (k) => lineas.filter((l) => l.toLowerCase().startsWith(k.toLowerCase() + ":")).map((l) => l.slice(k.length + 1).trim());
  if (!campo("Contact").length) mal.push("falta Contact");
  const ex = campo("Expires");
  if (ex.length !== 1) mal.push(`Expires aparece ${ex.length} veces y tiene que aparecer una`);
  else {
    const t = Date.parse(ex[0]);
    if (Number.isNaN(t)) mal.push(`Expires no es una fecha: «${ex[0]}»`);
    else if (t - ahora.getTime() < 60 * 86400e3) mal.push(`Expires vence el ${ex[0]}, en menos de 60 días`);
  }
  return mal;
}
let pasa = 0, falla = 0, saltadas = 0;
const prueba = (n, ok) => { ok ? pasa++ : falla++; console.log(`  ${ok ? "ok   " : "FALLA"} ${n}`); };
const bueno = "Contact: mailto:a@b.c\nExpires: 2027-11-18T00:00:00Z\n", hoy = new Date("2026-11-18T00:00:00Z");
prueba("silencio: válido y vigente", revisar(bueno, hoy).length === 0);
prueba("silencio paradójico: «Contact:» sólo en un comentario no cuenta", revisar("# Contact: x\nExpires: 2027-11-18T00:00:00Z\n", hoy).length === 1);
prueba("grito: sin Contact", revisar("Expires: 2027-11-18T00:00:00Z\n", hoy).length === 1);
prueba("grito: sin Expires", revisar("Contact: mailto:a@b.c\n", hoy).length === 1);
prueba("MUTACIÓN el reloj avanza a 30 días del vencimiento: grita", revisar(bueno, new Date("2027-10-19T00:00:00Z")).length === 1);
for (const [n, u] of [["public", "../public/.well-known/security.txt"], ["dist", "../dist/.well-known/security.txt"]]) {
  const f = new URL(u, import.meta.url);
  if (!fs.existsSync(f)) { if (n === "dist") { saltadas++; console.log("  SALTADA dist (no hay build)"); continue; } }
  const mal = fs.existsSync(f) ? revisar(fs.readFileSync(f, "utf8")) : ["no existe"];
  prueba(`${n}/.well-known/security.txt: ${mal.length ? mal.join(" · ") : "válido y vigente"}`, mal.length === 0);
}
console.log(`\ncheck-security-txt: ${pasa} pasaron, ${falla} fallaron, ${saltadas} saltadas`);
if (falla) process.exit(1);
