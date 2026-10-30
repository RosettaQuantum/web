#!/usr/bin/env node
/**
 * Por que existe: la pagina necesita el modulo servido como estatico, asi que hay dos
 * archivos. Una lista que vive en dos lugares ya divergio — la defensa no es acordarse,
 * es un chequeo que falla cerrado.
 *
 * SU PUNTO CIEGO, declarado: compara los bytes, no el comportamiento. Dos copias
 * identicas que ambas estan mal pasan en verde. Lo que impide es el caso que de verdad
 * ocurre: editar `lib/` y olvidar la copia.
 */
import { readFileSync, readdirSync } from "node:fs";

/**
 * Es de quien puede arreglarlo cuando grita, no de quien es dueno del dato que mira:
 * cuando esto suena, lo que hay que hacer es re-sincronizar las dos copias y volver a
 * commitear, y eso lo hace quien acaba de editar el modulo o la receta.
 */
export const CONSUMIDOR = {
  quien: "la sesion Lab (quien edite lib/compilador.mjs o recetas/*.json)",
  hace: "corre `npm run compilador:sync` y commitea las dos copias juntas",
  bloquea: "si, el prebuild: con las copias divergidas la landing valida con una version distinta de la que usan el MCP y el Worker",
};
import { createHash } from "node:crypto";
const sha = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
const pares = [["lib/compilador.mjs", "public/compilador/compilador.mjs"]];
for (const f of readdirSync("recetas").filter((x) => x.endsWith(".json")))
  pares.push([`recetas/${f}`, `public/compilador/${f}`]);

let malos = 0;
for (const [a, b] of pares) {
  let ha, hb;
  try { ha = sha(a); } catch { console.log(`FALTA  ${a}`); malos++; continue; }
  try { hb = sha(b); } catch { console.log(`FALTA  ${b}  (copia de ${a})`); malos++; continue; }
  if (ha === hb) console.log(`ok     ${a}  ==  ${b}  ${ha.slice(0, 12)}`);
  else { console.log(`DIVERGE ${a} (${ha.slice(0,12)})  !=  ${b} (${hb.slice(0,12)})`); malos++; }
}
console.log(malos ? `\nFALLA: ${malos} copia(s) fuera de sincronia. Corre: npm run compilador:sync` : `\nok: ${pares.length} par(es) identicos`);
process.exit(malos ? 1 : 0);
