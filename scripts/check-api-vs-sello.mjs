#!/usr/bin/env node
/**
 * Lo que la API sirve como texto sellado ES el texto sellado, byte a byte.
 *
 * DE DONDE SALE (2026-08-25). Al hacer bilingue el endpoint de challenges aparecieron tres
 * campos `estadistica.req.circuito.nota` en espanol que NO se pueden traducir en el lugar:
 * su texto es byte-identico a un artefacto sellado y anclado
 * (RosettaQ__RUN__EXP-0007-019__20260725T1553Z). Cambiarlos rompe el sello.
 *
 * La salida acordada es servir la traduccion AL LADO del original:
 *   nota: { es: <el texto sellado, byte a byte>, en: <traduccion>, _sello: {...} }
 * El sello se conserva porque `es` sigue siendo exactamente lo sellado — pero **eso es una
 * promesa hasta que algo lo comprueba**, y de eso se trata este guardia.
 *
 * LO QUE MEDI Y POR ESO EXISTE: ese texto sellado tiene **seis copias** en dos repos
 * —el sello, evidence/data, el generador en evidence/code, y en la web stats.json,
 * challenges.seed.sql y viz.original.html— mas la fila en D1 y la respuesta de la API.
 * Hoy las seis coinciden. **Coinciden por disciplina, no por construccion**: nada las
 * compara. Es una superficie con muchos escritores y ningun candado, sobre el unico texto
 * del sistema que por definicion no puede cambiar.
 *
 * SU PUNTO CIEGO, declarado y es grande: el sello vive en OTRO repositorio
 * (RosettaQuantum/evidence) y el CI de la web no lo puede leer. Asi que este guardia
 * compara la API contra la copia que SI esta en este repo (`stats.json`), y publica el id
 * del sello para que un tercero cierre el ultimo tramo contra el archivo publico. Prueba
 * que la API no se despego de este repo; **no** prueba que este repo no se despego del
 * sello. Ese tramo lo cubre el notario, no esto.
 *
 * Uso:
 *   node scripts/check-api-vs-sello.mjs              # contra la API viva
 *   node scripts/check-api-vs-sello.mjs --self-test
 *
 * QUIEN LO CONSUME Y QUE HACE AL RECIBIRLO
 * ----------------------------------------
 * CONSUMIDOR: la sesion de coordinacion del archivo (Rosetta Q Main). No el CTO: cuando esto
 * grita, lo roto no es el despliegue sino la correspondencia entre un sello y lo que la API
 * dice que es ese sello, y la autoridad sobre que ES el texto sellado la tiene el archivo.
 *
 * QUE HACE: abre el artefacto sellado, compara byte a byte contra lo que sirve el endpoint, y
 * decide cual de los dos esta mal. Si el sello esta bien, se arregla la API. Si el sello esta
 * mal, NO se re-sella: va una errata, porque publicado es publicado.
 *
 * SI ESTE GUARDIA NO CORRIO, no se publica un entregable que cite el endpoint como fuente
 * verificable — es la promesa que sostiene, y sin correr no esta sostenida.
 */
import { readFileSync } from "node:fs";

const BASE = "https://rosettaquantum.com";
const SELLO_ID = "RQ-EXP-0007-019";
const FUENTE = "src/viz/cleveland/datos/cleveland-2026-07.stats.json";

/**
 * Compara el texto que sirve la API contra la copia en el repo.
 *
 * `servido` puede ser una cadena (el campo todavia monolingue) o un objeto { es, en }
 * (ya bilingue). En los dos casos lo que se compara es el lado ESPANOL, que es el sellado.
 *
 * `hayBloque` dice si la estructura que DEBERIA contener el campo existe. Sin eso, una
 * proteina sin analisis de circuito —c_MYC no tiene sitios conocidos ni bloque
 * `estadistica.req`— se marcaba como campo ausente. Falso positivo: su ausencia es
 * legitima, y un guardia que la reporta retiene trabajo bueno.
 *
 * @param {{servido: string|object, enRepo: string, hayBloque?: boolean}} ctx
 */
export function compararConSello({ servido, enRepo, hayBloque = true }) {
  if (servido == null) {
    return hayBloque
      ? { estado: "ausente", motivo: "existe el bloque de circuito pero no su nota" }
      : { estado: "no-aplica", motivo: "esta proteina no tiene analisis de circuito" };
  }
  if (enRepo == null) return { estado: "indeterminado", motivo: "no esta la copia del repo con que comparar" };

  const lado = typeof servido === "string" ? servido : servido.es;
  if (typeof lado !== "string") {
    return { estado: "sin-lado-es", motivo: "el campo es bilingue pero no tiene lado `es`: el sellado no puede faltar" };
  }
  // Byte a byte. NADA de normalizar: normalizar aqui seria quitarle el sentido —
  // una tilde de mas o de menos YA es otro texto que el sellado (y el sellado, ojo, no
  // tiene ninguna: esta anclado asi y no se "arregla").
  if (lado !== enRepo) return { estado: "deriva", motivo: "el texto servido no es byte-identico al del repo" };
  return { estado: "ok" };
}

// ── self-test ────────────────────────────────────────────────────────────────────────────
if (process.argv.includes("--self-test")) {
  const T = "cada clase de color es un emparejamiento: en codificacion binaria.";
  const casos = [
    ["CALLA: campo monolingue identico al repo", () =>
      compararConSello({ servido: T, enRepo: T }).estado === "ok"],
    ["CALLA: campo bilingue cuyo lado es es identico", () =>
      compararConSello({ servido: { es: T, en: "whatever" }, enRepo: T }).estado === "ok"],
    ["grita: el texto servido cambio", () =>
      compararConSello({ servido: T + " y algo mas", enRepo: T }).estado === "deriva"],
    // El caso que motiva el guardia entero: al volverlo bilingue, alguien "mejora" el
    // espanol —le pone las tildes, por ejemplo— y el lado sellado deja de serlo.
    ["grita: le acentuaron el lado sellado", () =>
      compararConSello({ servido: { es: "codificación", en: "x" }, enRepo: "codificacion" }).estado === "deriva"],
    ["grita distinto: bilingue SIN lado es", () =>
      compararConSello({ servido: { en: "only english" }, enRepo: T }).estado === "sin-lado-es"],
    ["grita distinto: no hay con que comparar es INDETERMINADO, no ok", () =>
      compararConSello({ servido: T, enRepo: null }).estado === "indeterminado"],
    ["grita distinto: hay bloque de circuito pero falta la nota", () =>
      compararConSello({ servido: null, enRepo: T, hayBloque: true }).estado === "ausente"],
    // c_MYC no tiene sitios conocidos NI bloque de circuito. Sin este caso, el guardia
    // reportaba su ausencia legitima como defecto — 3 de 4 en vez de 3 de 3.
    ["CALLA: proteina sin analisis de circuito (ausencia legitima)", () =>
      compararConSello({ servido: null, enRepo: null, hayBloque: false }).estado === "no-aplica"],
  ];
  let fallos = 0;
  for (const [n, fn] of casos) {
    let p; try { p = fn(); } catch { p = false; }
    console.log(`${p ? "ok  " : "FALLA"}  ${n}`); if (!p) fallos++;
  }
  console.log(`\n[api-vs-sello] self-test: ${casos.length - fallos} de ${casos.length} pasaron.`);
  process.exit(fallos ? 1 : 0);
}

// ── modo real ────────────────────────────────────────────────────────────────────────────
let stats;
try { stats = JSON.parse(readFileSync(FUENTE, "utf8")); }
catch (e) { console.error(`[api-vs-sello] no se pudo leer ${FUENTE}: ${String(e).split("\n")[0]}`); process.exit(2); }

let api;
try { api = await (await fetch(`${BASE}/v1/challenges/cleveland-2026-07`, { headers: { "User-Agent": "rosetta sello check" } })).json(); }
catch (e) { console.error(`[api-vs-sello] no se pudo leer la API: ${String(e).split("\n")[0]}`); process.exit(2); }

const proteinas = Object.keys(api.proteinas ?? {});
let ok = 0, noAplica = 0; const malos = [];
for (const p of proteinas) {
  const servido = api.proteinas[p]?.estadistica?.req?.circuito?.nota;
  const enRepo = stats[p]?.req?.circuito?.nota ?? stats[p]?.null?.req?.circuito?.nota;
  const hayBloque = !!api.proteinas[p]?.estadistica?.req?.circuito;
  const r = compararConSello({ servido, enRepo, hayBloque });
  if (r.estado === "ok") ok++;
  else if (r.estado === "no-aplica") noAplica++;
  else malos.push({ p, ...r });
}

console.log(`[api-vs-sello] ${ok} de ${proteinas.length - noAplica} nota(s) byte-identicas a la copia del repo` +
            (noAplica ? ` (${noAplica} sin analisis de circuito, no aplica)` : "") + ` · sello ${SELLO_ID}`);
if (malos.length) {
  for (const m of malos) console.error(`  ! ${m.p}: ${m.estado} — ${m.motivo}`);
  console.error("[api-vs-sello] La API estaria sirviendo como sellado un texto que no lo es.");
  process.exit(malos.some((m) => m.estado === "indeterminado") ? 2 : 1);
}
console.log(`[api-vs-sello] Verificacion externa del ultimo tramo: ${BASE}/v1/archive/${SELLO_ID}`);
