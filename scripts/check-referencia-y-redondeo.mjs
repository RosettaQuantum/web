#!/usr/bin/env node
/**
 * La medición compara contra la ÚLTIMA edición publicada, y el QEX y su máximo redondean con UNA regla (24-nov-2026).
 *
 * EL DEFECTO REAL (1). santander.cl, 24-nov, por MCP: «mediana banca 57 (12 orgs, edición 2026-08)» con la
 * edición 02 · 2026-11 publicada (banca 56, 17 orgs, nacional 58). Ahora la referencia es
 * public/data/qex-referencia-vigente.json, que genera scripts/build-qex-referencia.mjs desde la edición.
 * Se exige por la SALIDA de medirParaAgente (lo que contestan el MCP y /v1/medicion), con las respuestas
 * reales grabadas de python.org declarado CL y sector banca:
 *  · sector.mediana / organizaciones / edicion / mediana_pais = los de la última edición publicada;
 *  · la ficha cita «mediana banca 56 (17 orgs, edición 2026-11)» (armada con la cifra de la edición, no escrita);
 *  · SILENCIO: la línea del modelo HNDL sigue diciendo «fijada en la edición 2026-08» (el modelo no cambió);
 *  · GRITO: una edición con otra mediana de banca da otra referencia que la del archivo (--verificar lo vería).
 *
 * LA PREGUNTA (2). «55,50 → 56 pero 70,50 → 70»: ¿dos reglas? No: el QEX (irec) y el máximo (irec sobre los
 * máximos) usan la MISMA, N.redondearPar = round() de Python 3, mitad al par, la que calculó los índices
 * publicados. Está escrita en la rúbrica (F.4). Este guardia la ejerce con justo los casos ,50:
 *  · la ficha real de banca dice «55,50 → 56» y «Máximo alcanzable desde afuera: 70,50 → 70.»;
 *  · 55,5→56 · 56,5→56 · 70,5→70 · 73,5→74, y F.4 de la rúbrica publicada dice la regla con su ejemplo;
 *  · MUTACIÓN: el máximo con Math.round (70,50 → 71) grita; redondearPar con Math.round grita.
 *   node scripts/check-referencia-y-redondeo.mjs
 */
import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
registerHooks({ resolve: (esp, ctx, sig) => esp === "cloudflare:sockets"
  ? { url: "data:text/javascript,export function connect(){throw new Error('sin sockets en el guardia')}", shortCircuit: true } : sig(esp, ctx) });
const A = await import("../lib/medicion-agentes.mjs");
const N = await import("../public/js/qex-nucleo.mjs");
const R = await import("./build-qex-referencia.mjs");
const { conMutante } = await import("./lib/mutar.mjs");

export const CONSUMIDOR = { quien: "sesión web de Rosetta", hace: "regenera la referencia con scripts/build-qex-referencia.mjs al publicar una edición, y no cambia la regla de redondeo de un lado solo" };

const raiz = new URL("../", import.meta.url);
const leer = (r) => readFileSync(new URL(r, raiz), "utf8");
const fallas = [];
let casos = 0;
const igual = (a, b, q) => { casos++; if (JSON.stringify(a) !== JSON.stringify(b)) fallas.push(`${q}: esperaba ${JSON.stringify(b)}, dio ${JSON.stringify(a)}`); };
const silenciar = () => { const o = [console.error, console.log]; console.error = () => {}; console.log = () => {}; return () => { [console.error, console.log] = o; }; };

const FX = "scripts/fixtures/medicion-agentes/";
const CT = JSON.parse(gunzipSync(readFileSync(new URL(FX + "ct-python.org.json.gz", raiz))).toString("utf8"));
const SONDAS = JSON.parse(leer(FX + "sondas-python.org.json"));
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
const M = { ct: async () => json(CT), sondas: async () => json(SONDAS), correo: async () => json({ ok: true, id: "c0ffee" }) };
const dbNula = { prepare: () => ({ bind: () => ({ first: async () => null, all: async () => ({ results: [] }) }), first: async () => null }) };
async function medir(Mod) {
  const restaurar = silenciar();
  try { return (await Mod.medirParaAgente({ DB: dbNula }, { dominio: "python.org", sector: "banca", pais: "CL" }, { canal: "mcp", ip: "203.0.113.11" }, null, M)).cuerpo; }
  finally { restaurar(); }
}

// ---------------------------------------------------------------- 1 · la referencia vigente
const ult = R.ultimaPublicada();
const banca = ult.d.indice.verticales.find((v) => v.id === "banca");
const r = await medir(A);
igual([r.sector.edicion, r.sector.mediana, r.sector.organizaciones, r.sector.mediana_pais, r.sector.organizaciones_pais, r.sector.p25],
  [ult.slug, banca.indice, banca.norg, ult.d.indice.mediana, ult.d.indice.n, null], `la medición compara contra la última edición publicada (${ult.slug})`);
const md = r.presentacion?.markdown || "";
igual(md.includes(`mediana banca ${banca.indice} (${banca.norg} orgs, edición ${ult.slug})`), true, "la ficha cita la mediana de banca de la edición vigente");
igual(/fijada en la edición 2026-08/.test(md), true, "SILENCIO: el modelo HNDL sigue citando la edición en que se fijó (2026-08)");
{
  const modelo = JSON.parse(leer(R.MODELO_HNDL));
  const otra = JSON.parse(JSON.stringify(ult.d));
  otra.indice.verticales.find((v) => v.id === "banca").indice = banca.indice + 1;
  igual(R.serializar(R.referenciaDe(otra, modelo, ult)) === leer(R.SALIDA), false, "GRITO: una edición con otra mediana de banca no coincide con el archivo (--verificar falla)");
  igual(R.serializar(R.referenciaDe(ult.d, modelo, ult)) === leer(R.SALIDA), true, "el archivo es exactamente lo que da la edición vigente");
}

// ---------------------------------------------------------------- 2 · una regla de redondeo, con los casos ,50
igual([55.5, 56.5, 70.5, 73.5].map(N.redondearPar), [56, 56, 70, 74], "mitad al par: 55,5→56 · 56,5→56 · 70,5→70 · 73,5→74");
igual(r.presentacion?.ficha?.puntos_qex ? [r.presentacion.ficha.puntos_qex.suma, r.presentacion.ficha.puntos_qex.score, r.presentacion.ficha.puntos_qex.maximo.suma, r.presentacion.ficha.puntos_qex.maximo.score] : null,
  [55.5, 56, 70.5, 70], "la ficha real de banca: suma 55,50 → 56 y máximo 70,50 → 70, la misma regla");
igual([md.includes("55,50 → 56"), md.includes("Máximo alcanzable desde afuera: 70,50 → 70.")], [true, true], "el markdown lo dice así");
const F4 = JSON.parse(leer("public/data/rubrica-qex.json")).es.formula.find((f) => f.id === "F.4")?.regla || "";
igual([/Redondeo al par/.test(F4), F4.includes(`56,5 da ${N.redondearPar(56.5)}`)], [true, true], "la rúbrica publicada (F.4) escribe la regla y su ejemplo sale de la misma función");
await conMutante(new URL("public/js/ficha.mjs", raiz), "maximo: { suma: r2(maxSuma), score: N.irec(max) }", "maximo: { suma: r2(maxSuma), score: Math.round(maxSuma) }", async (Fm) => {
  const p = Fm.arbolQex(fotoDe());
  igual(p.maximo.score === N.redondearPar(p.maximo.suma), false, "MUTACIÓN: el máximo con Math.round (70,50 → 71) se aparta de la regla → grita");
});
await conMutante(new URL("public/js/qex-nucleo.mjs", raiz), "  if (Math.abs(d - 0.5) < 1e-9) return f % 2 === 0 ? f : f + 1;\n", "", async (Nm) => {
  igual([55.5, 70.5].map(Nm.redondearPar).join(",") === "56,70", false, "MUTACIÓN: redondearPar sin la mitad al par → 70,5 da 71 → grita");
});

function fotoDe() {
  const ct = { filas: JSON.parse(CT.texto), sha256: "0".repeat(64), fuente: "fixture", consultado_utc: "2026-11-12T00:00:00.000Z" };
  const ref = JSON.parse(leer(R.SALIDA));
  return N.armarFoto({ dominio: "python.org", www: "www.python.org", vertical: "banca", medido: "2026-11-24T00:00:00.000Z", ct, sondas: SONDAS, referencia: ref, origen: "guardia" }).foto;
}

if (fallas.length) { for (const f of fallas) console.error("  ✗ " + f); console.error(`check-referencia-y-redondeo: ${fallas.length} FALLA(S) de ${casos} casos`); process.exit(1); }
console.log(`check-referencia-y-redondeo: ok (${casos} casos · referencia = edición ${ult.slug}: banca ${banca.indice}/${banca.norg}, nacional ${ult.d.indice.mediana} · HNDL sigue en 2026-08 · 55,50→56 y 70,50→70 con la misma regla · 2 mutaciones gritan)`);
