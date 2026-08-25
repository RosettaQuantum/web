#!/usr/bin/env node
/**
 * Si un recurso de la API habla dos idiomas, los habla ENTEROS.
 *
 * EL DEFECTO (2026-08-25, encontrado por la sesion de las piezas 3D). En
 * `/v1/challenges/<id>`:
 *
 *   titulo          bilingue  { es, en }
 *   aviso           SOLO espanol
 *   como_verificar  SOLO espanol
 *
 * Y el `aviso` es justo la ADVERTENCIA DE ALCANCE — "los sitios son PREDICHOS por
 * caminata cuantica y no estan validados experimentalmente". Un consumidor en ingles
 * recibe el titulo traducido y **la advertencia en un idioma que puede no leer**. La
 * pieza que mas importa que se entienda es la que no se tradujo.
 *
 * POR QUE NO LO CAZO NADA. Vigilamos que las CIFRAS publicas sobrevivan a un curl contra
 * nuestra propia API. Nadie vigila el idioma ni la paridad. Es la misma familia que el
 * hueco entre ediciones: **los guardias miran DENTRO de un campo, no ENTRE campos.**
 *
 * LA REGLA: en un mismo nivel de objeto, si ALGUN campo de prosa esta en dos idiomas,
 * TODOS los campos de prosa de ese nivel tienen que estarlo. Un recurso enteramente
 * monolingue no se toca: la regla es de coherencia, no de traduccion obligatoria.
 *
 * DOS CONVENCIONES, las dos reconocidas — porque conviven hoy en la MISMA respuesta:
 *   objeto:  titulo: { es, en }
 *   sufijo:  label, label_en
 * Que convivan es deuda declarada, no algo que este guardia arregle. Lo suyo es que
 * ninguna de las dos deje campos atras.
 *
 * PRECISION SOBRE COBERTURA. Un falso positivo aca retiene una publicacion. Por eso NO
 * mira identificadores, fechas, URLs, hashes ni codigos: solo PROSA — texto con espacios
 * y largo de frase. Su punto ciego, declarado: una prosa muy corta y sin espacios
 * ("Listo") pasa por identificador y no se vigila.
 *
 * Uso:
 *   node scripts/check-api-bilingue.mjs              # contra la API viva
 *   node scripts/check-api-bilingue.mjs --self-test  # rompe cada regla y exige el grito
 */

const BASE = "https://rosettaquantum.com";
const RUTAS = ["/v1/challenges", "/v1/challenges/cleveland-2026-07"];

/** Campos que NUNCA son prosa aunque parezcan texto. */
const NO_PROSA = new Set(["id", "pdb", "recipe_id", "pre_registro", "challenge", "fecha",
  "sha256", "content_hash", "file_id", "url", "datos", "raw", "seed", "lang", "slug_base"]);

/** ¿Este valor es prosa que un lector tendria que entender? */
export function esProsa(clave, valor) {
  if (typeof valor !== "string") return false;
  if (NO_PROSA.has(clave)) return false;
  if (/^https?:\/\//.test(valor)) return false;
  if (/^[0-9a-f]{16,}$/i.test(valor)) return false;          // hashes
  if (/^\d{4}(-\d{2}){0,2}$/.test(valor)) return false;      // fechas
  // Prosa = tiene espacios y largo de frase. Un slug o un codigo no.
  return valor.includes(" ") && valor.trim().length >= 25;
}

/** ¿Este campo esta en dos idiomas? Reconoce las dos convenciones. */
export function bilingue(clave, valor, hermanos) {
  if (valor && typeof valor === "object" && !Array.isArray(valor)) {
    return typeof valor.es === "string" && typeof valor.en === "string";
  }
  if (typeof valor === "string") {
    if (clave.endsWith("_en")) return true;                    // la mitad inglesa de un par
    return typeof hermanos?.[clave + "_en"] === "string";      // la mitad espanola
  }
  return false;
}

/**
 * Revisa un objeto y todos sus descendientes.
 * @returns {{nivelesVistos:number, camposVistos:number, faltas:{ruta:string,campo:string}[]}}
 */
export function revisar(raiz, rutaBase = "") {
  const conDos = [], soloUno = []; let nivelesVistos = 0, camposVistos = 0;

  const visitar = (obj, ruta) => {
    if (Array.isArray(obj)) { obj.forEach((x, i) => visitar(x, `${ruta}[${i}]`)); return; }
    if (!obj || typeof obj !== "object") return;

    nivelesVistos++;
    const claves = Object.keys(obj);
    // Las mitades inglesas de un par no se cuentan aparte: son el mismo campo.
    const propias = claves.filter((k) => !(k.endsWith("_en") && claves.includes(k.slice(0, -3))));

    const prosa = propias.filter((k) => esProsa(k, obj[k]) || bilingue(k, obj[k], obj));
    camposVistos += prosa.length;
    const conDosIdiomas = prosa.filter((k) => bilingue(k, obj[k], obj));

    // Se ACUMULA y se decide al final, no aqui. El alcance es el RECURSO, no el nivel:
    // en /v1/challenges el `titulo` bilingue vive dentro de items[] y el `aviso`
    // monolingue en la raiz. Decidiendo por nivel, ese aviso no se marcaba nunca — y es
    // el mismo texto y el mismo lector. El defecto no respeta la forma del arbol.
    for (const k of prosa) {
      (bilingue(k, obj[k], obj) ? conDos : soloUno).push({ ruta: ruta || "/", campo: k });
    }

    for (const k of claves) {
      // NO se baja dentro de un par { es, en }: ese objeto YA es la unidad bilingue, y
      // recorrerlo hacia adentro convertia sus dos mitades en dos campos monolingues —
      // el guardia se acusaba a si mismo de lo que estaba comprobando.
      if (bilingue(k, obj[k], obj) && obj[k] && typeof obj[k] === "object") continue;
      visitar(obj[k], ruta ? `${ruta}.${k}` : k);
    }
  };

  visitar(raiz, rutaBase);
  // Si NADA del recurso habla dos idiomas, es monolingue a proposito y no se opina.
  const faltas = conDos.length ? soloUno : [];
  return { nivelesVistos, camposVistos, faltas };
}

// ── self-test ────────────────────────────────────────────────────────────────────────────
if (process.argv.includes("--self-test")) {
  const LARGO = "Los sitios son PREDICHOS por caminata cuantica y no estan validados.";
  const OTRO = "Cada proteina trae su sha256 calculado sobre datos y estadistica.";

  const casos = [
    ["grita: titulo bilingue y aviso monolingue (el defecto real)", () =>
      revisar({ titulo: { es: "t", en: "t" }, aviso: LARGO }).faltas.some((f) => f.campo === "aviso")],

    ["CALLA: todo bilingue", () =>
      revisar({ titulo: { es: "t", en: "t" }, aviso: { es: LARGO, en: LARGO } }).faltas.length === 0],

    // La regla es de COHERENCIA, no de traduccion obligatoria: un recurso entero en
    // espanol es una decision valida y este guardia no opina.
    ["CALLA: recurso enteramente monolingue", () =>
      revisar({ aviso: LARGO, nota: OTRO }).faltas.length === 0],

    ["reconoce la convencion de sufijo _en", () =>
      revisar({ label: LARGO, label_en: LARGO, aviso: OTRO }).faltas.some((f) => f.campo === "aviso")],

    ["CALLA: par label/label_en completo y nada mas", () =>
      revisar({ label: LARGO, label_en: LARGO }).faltas.length === 0],

    // Precision: si marcara identificadores, gritaria en cada respuesta y seria inservible.
    ["CALLA: identificadores, hashes, fechas y URLs no son prosa", () =>
      revisar({ titulo: { es: "t", en: "t" }, id: "cleveland-2026-07", pdb: "4OBE",
                fecha: "2026-07", sha256: "a".repeat(64), url: "https://x.com/y" }).faltas.length === 0],

    ["baja a los objetos anidados", () =>
      revisar({ items: [{ titulo: { es: "t", en: "t" }, aviso: LARGO }] })
        .faltas.some((f) => f.campo === "aviso" && f.ruta.includes("items"))],

    ["reporta denominador", () => {
      const r = revisar({ titulo: { es: "t", en: "t" }, aviso: LARGO });
      return r.nivelesVistos >= 1 && r.camposVistos >= 2;
    }],
  ];

  let fallos = 0;
  for (const [nombre, fn] of casos) {
    let paso; try { paso = fn(); } catch { paso = false; }
    console.log(`${paso ? "ok  " : "FALLA"}  ${nombre}`);
    if (!paso) fallos++;
  }
  console.log(`\n[api-bilingue] self-test: ${casos.length - fallos} de ${casos.length} pasaron.`);
  process.exit(fallos ? 1 : 0);
}

// ── modo real ────────────────────────────────────────────────────────────────────────────
let totalFaltas = 0, rutasVistas = 0;
for (const ruta of RUTAS) {
  let j;
  try { j = await (await fetch(BASE + ruta, { headers: { "User-Agent": "rosetta bilingue check" } })).json(); }
  catch (e) { console.error(`[api-bilingue] no se pudo leer ${ruta}: ${String(e).split("\n")[0]}`); process.exit(2); }
  rutasVistas++;
  const r = revisar(j);
  console.log(`  ${ruta}: ${r.camposVistos} campo(s) de prosa en ${r.nivelesVistos} nivel(es) · faltas: ${r.faltas.length}`);
  for (const f of r.faltas) console.error(`    ! ${ruta} -> ${f.ruta}.${f.campo} esta en un solo idioma y sus hermanos en dos`);
  totalFaltas += r.faltas.length;
}

console.log(`[api-bilingue] ${rutasVistas} ruta(s) revisadas · ${totalFaltas} falta(s).`);
if (totalFaltas) {
  console.error("[api-bilingue] Un consumidor en ingles recibe parte del recurso en un idioma que puede no leer.");
  console.error("[api-bilingue] Si el recurso habla dos idiomas, los habla enteros.");
  process.exit(1);
}
