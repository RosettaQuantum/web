#!/usr/bin/env node
/**
 * Ninguna superficie publica una escala de letras A+…F distinta de ESCALA_NOTA (18-nov-2026).
 *
 * EL DEFECTO REAL. yu-track.com salió D con TLS 1.3. Lo único escrito sobre la D en lo que se sirve
 * (/js/qex-nucleo.mjs, el comentario de explicarNota) era la línea de abajo, que dejó de ser la regla el
 * 16-nov: la D también le toca a un sitio CON TLS 1.3, sin candado nuevo y con una alerta alta abierta.
 *     «//   D  · sin TLS 1.3 medido (sólo 1.2 o anterior). Sin TLS 1.3 no hay candado nuevo posible.»
 * La escala se publica ahora desde UNA definición (qex-nucleo.mjs → ESCALA_NOTA; el texto en
 * rubrica-textos.mjs) que importan la rúbrica, /protocolo/ficha y las páginas de metodología, y que
 * scripts/check-rubrica-qex.mjs ata a explicarNota.
 *
 * QUÉ BUSCA. En lo que se publica (src/, public/, lib/, api.js, worker.js, mcp/, el PDF del VPS y
 * docs/ietf) toda línea que diga una letra seguida de un separador y de una condición de la nota:
 *     «D: …TLS…», «C · …candado…», «"B": "Candado…"», «| F | …grave… |»
 * Cada una tiene que estar REVISADA: su huella sha256 en REVISADAS, con el motivo. Una línea nueva o
 * cambiada grita hasta que alguien la compare con la escala y la registre (o la cambie por la escala
 * generada). Por qué una lista de huellas y no «leer» la frase: no hay forma mecánica de saber si una
 * prosa dice la regla; sí la hay de saber que nadie la miró desde que cambió.
 *
 * PRECISIÓN ANTES QUE COBERTURA. Exige letra suelta + separador inmediato + palabra de la nota a menos
 * de 80 caracteres. No ve una escala escrita en prosa corrida («la letra D es para…»), ni en una
 * imagen, ni en un PDF ya generado. Los archivos generados de la rúbrica (public/data/rubrica-qex.*) no
 * se miran aquí: los vigila check-rubrica-qex.
 *   node scripts/check-escala-nota.mjs [--self-test]
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

export const CONSUMIDOR = { quien: "sesion web de Rosetta, antes de desplegar", hace: "cambia la escala escrita a mano por la generada (ESCALA_NOTA vía rubrica-qex.mjs), o la compara con la escala y registra su huella en REVISADAS con el motivo" };

const RAIZ = new URL("..", import.meta.url).pathname;
const RAICES = ["src", "public", "lib", "mcp", "api.js", "worker.js", "vps/sonda-correo", "docs/ietf"];
const EXT = /\.(astro|md|mdx|ts|js|mjs|json|html|txt|py|svg)$/;
const FUERA = /(^|\/)(node_modules|dist)(\/|$)|^public\/data\/rubrica-qex\.|^public\/consola\/|^src\/data\/ledger\.json$/;
const sha = (t) => createHash("sha256").update(t).digest("hex");

// Letra suelta (A+, A, B, C, D, F) en MAYÚSCULA, comilla opcional y un separador; antes de la letra sólo
// puede haber marcas (comentario, viñeta, celda de tabla, etiqueta HTML, llave u objeto), nunca una
// palabra: «Plan B: …» no es una escala. Después, a menos de 80 caracteres, una palabra de la nota.
export const LETRA_SEP = /(A\+|A|B|C|D|F)["'`»]?\s*(?:·|:|=|—|–|\|)/g;
const PREFIJO_OK = /^[\s\/*#\-|>{,("'`«]*$/;
export const CONDICION = /\b(TLS|candado|lock|alerta|alert|grave|serious|X25519MLKEM768|h[ií]brido|hybrid)/i;

// Revisadas el 18-nov contra ESCALA_NOTA. Motivo por grupo. La huella es de la línea sin espacios a los lados.
export const REVISADAS = {
  // public/js/qready-textos.mjs · TXT.nota_lectura (aprobado el 13-nov; C y D actualizadas el 16-nov).
  // Es la LECTURA de cada letra (la pintan /q-ready/medicion y /verificado), no la escala. C, D y F dicen
  // la regla real. A+ resume la suya. A y B describen sólo una de sus causas (A: falta «todos los nombres
  // sensibles sondeados», «sin ambiente de pruebas publicado» y «dimensiones medidas»; B: también sale
  // por esas causas, no sólo por nombres sin evidencia). Propuesta de texto en
  // docs/textos-provisorios-rubrica.md: no se cambia sin aprobación.
  "lectura de la letra (TXT.nota_lectura), revisada contra ESCALA_NOTA el 18-nov": [
    "66ea9e77ed2da2a2e59974be0c469973194935d848fe337c13dd0196856abaed", "dfd90a2e5a246aa911c0cde61fcf36454b62718d908bfaafc805d68008ddd4c1",
    "cc5779927598bb212bbda61407d157b4eee1b69b5f989776b28d6c63c9ae8033", "ffca9f63271d1bf2e8c7f39863da219fc154da338244433226e711b047635859",
    "26eeae6772860a17f4675713110f6a968a8ab6b372d232c09147017e817b27ec", "80a64e6b2d65932e382b1951fbebcb025ffe5362fc4a8865b71593fd3f17f94b",
    "d55cfc602dcfd37e40578bda812406cf7061ae0bd558b9501a10e288c28107cd", "589c427d8cc4c77026346970cf205af69bf453caf1f59a0c6652c93a79634493",
    "16d5970ba637cd2d08842f4b0147a99b613ffc0c706b704efbb53082021b2b52", "26d9e45c91fa48eaca6841ac829f256de5d3e5d9985721038463e5c5cb80559d",
    "5c656da75e3ba27a2cbeb6728005c972c7880e826c0227263666e77689d94d5b", "90aaff0bed03a3601d0ac2cda7e277acbac7f61e5d651f8602a5b8ec72a577b8",
  ],
  // lib/borde-envivo.mjs: los saludos TLS A, B y C al sitio principal. Son letras de los saludos, no la nota.
  "saludos A/B/C del borde (no son la nota)": [
    "22c1a749ce0d0e388b8b5b303afd3578f4ed0cb1620319fb265468ca3e3432ec", "cb4471bd015a9cc9a4c2035844d28e44fb0f4368aa00967ad099436c71615a6e",
  ],
};

export function lineasConEscala(texto) {
  const out = [];
  texto.split("\n").forEach((l, i) => {
    for (const m of l.matchAll(LETRA_SEP)) {
      const previo = l.slice(0, m.index).replace(/<[^>]*>/g, "");
      const letraSuelta = !/[A-Za-z0-9_]$/.test(l.slice(0, m.index));
      if (letraSuelta && PREFIJO_OK.test(previo) && CONDICION.test(l.slice(m.index, m.index + m[0].length + 80))) {
        out.push({ n: i + 1, linea: l.trim(), huella: sha(l.trim()) }); break;
      }
    }
  });
  return out;
}

function archivos(rel, out = []) {
  const abs = join(RAIZ, rel);
  let st; try { st = statSync(abs); } catch { return out; }
  if (FUERA.test(rel)) return out;
  if (st.isDirectory()) { for (const n of readdirSync(abs)) archivos(join(rel, n), out); return out; }
  if (EXT.test(rel) && st.size < 2_000_000) out.push(rel);
  return out;
}

export function revisar(textos, revisadas = REVISADAS) {
  const ok = new Set(Object.values(revisadas).flat());
  const sinRevisar = [];
  for (const [rel, t] of textos) for (const h of lineasConEscala(t)) if (!ok.has(h.huella)) sinRevisar.push({ rel, ...h });
  return sinRevisar;
}

function autoprueba() {
  const fallas = [];
  const grita = (t, q) => { if (revisar([["x", t]]).length === 0) fallas.push(`no grita: ${q}`); };
  const calla = (t, q) => { const r = revisar([["x", t]]); if (r.length) fallas.push(`grita sin motivo: ${q} → ${r[0].linea}`); };
  // GRITO: el defecto real, tal como estaba servido, y la escala que vio el dueño
  grita("//   D  · sin TLS 1.3 medido (sólo 1.2 o anterior). Sin TLS 1.3 no hay candado nuevo posible.", "el comentario real del núcleo (16-nov)");
  grita("<li>D: sólo TLS 1.2 o anterior, sin candado nuevo</li>", "la escala publicada que vio el dueño");
  grita("| C | TLS 1.3 sin candado nuevo |", "una escala en una tabla markdown");
  grita('      D: "Sólo TLS 1.2 o anterior, sin candado nuevo.",', "una lectura de la D cambiada sin revisar");
  calla('      D: "Sin TLS 1.3 medido, o sin candado nuevo y con una alerta alta abierta.",', "la lectura de la D revisada (su huella está registrada)");
  grita('"A+": "New lock on everything visible"', "la A+ entre comillas");
  // SILENCIO: lo que no es una escala
  calla("RQ.S.03.1 TLS 1.3 (−30); no productivos (−10)", "un ID de la ficha");
  calla("| A1 | GRAVE | Ambiente de pruebas expuesto |", "una alerta numerada");
  calla("Plan B: medir de nuevo mañana con TLS 1.3", "«Plan B» en prosa");
  calla("api.acme-bank.example TLS 1.2 · ECDHE / ECDSA P-256", "una fila de inventario TLS");
  calla("const d = ct ? 1 : 0; // TLS", "código con dos puntos");
  calla("la letra D era sólo para sitios con TLS 1.2 o anterior", "la escala en prosa corrida (punto ciego declarado)");
  return fallas;
}

const directo = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (directo && process.argv.includes("--self-test")) {
  const f = autoprueba();
  for (const x of f) console.log("  FALLA autoprueba: " + x);
  console.log(`check-escala-nota --self-test: ${f.length ? "FALLA" : "ok (5 gritos, 7 silencios)"}`);
  process.exit(f.length ? 1 : 0);
}

if (directo) {
const lista = RAICES.flatMap((r) => archivos(r));
const textos = lista.map((rel) => [rel, readFileSync(join(RAIZ, rel), "utf8")]);
const sinRevisar = revisar(textos);
const auto = autoprueba();
const vistas = textos.reduce((t, [, x]) => t + lineasConEscala(x).length, 0);
for (const s of sinRevisar) console.log(`  FALLA ${s.rel}:${s.n} publica una escala de letras sin revisar contra ESCALA_NOTA (huella ${s.huella})\n        ${s.linea.slice(0, 160)}`);
for (const x of auto) console.log("  FALLA autoprueba: " + x);
console.log(`check-escala-nota: ${lista.length} archivos, ${vistas} líneas con forma de escala, ${sinRevisar.length} sin revisar · autoprueba ${auto.length ? "FALLA" : "ok"}`);
process.exit(sinRevisar.length || auto.length ? 1 : 0);
}
