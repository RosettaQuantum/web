#!/usr/bin/env node
/**
 * CONSUMIDOR: quien edite lib/compilador.mjs o una receta. Si esto grita, la landing
 * esta validando con una version distinta de la que usan el MCP y el Worker.
 *
 * Por que existe: la pagina necesita el modulo servido como estatico, asi que hay dos
 * archivos. Una lista que vive en dos lugares ya divergio — la defensa no es acordarse,
 * es un chequeo que falla cerrado.
 */
import { readFileSync, readdirSync } from "node:fs";
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
