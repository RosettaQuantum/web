#!/usr/bin/env node
/**
 * La triple copia se promete; hasta hoy nadie la contaba.
 *
 * EL DEFECTO, medido el 2026-08-28: **D1 iba 130 y el archivo 136.** Los 5 sellos de VW
 * llegaron a GitHub y a Codeberg y **no a la tercera copia**, durante un dia entero, mientras
 * `PROTOCOL.md` promete tres:
 *
 *     1. GitHub   2. Codeberg   3. Cloudflare D1 — rosettaq-ledger.run_archives
 *
 * LA CAUSA, y por que no gritó: el unico disparador del sync a D1 es el paso 4 de
 * `notarize.py`. Se prohibio correr `notarize.py` por un `git add -A` que se llevaba trabajo
 * ajeno —correcto— **y con el se detuvo, sin que nadie lo notara, la tercera copia.** Un
 * candado sobre un proceso que hace DOS cosas, pensado para una.
 *
 * Y NO ES LA PRIMERA VEZ. `notarize_globs.py` documenta el caso anterior, textual: *«notarize.py
 * incluia manifests/ y sync_archives_to_d1.py no. Nadie lo noto porque **ningun paso comparaba
 * los totales** — la tercera copia iba 63 de 64»*. Arreglaron la lista compartida y **nunca
 * agregaron la comparacion.** Esto es la comparacion.
 *
 * SE COMPARAN CONJUNTOS, NO CIFRAS, y eso no es purismo: al escribir esto, GitHub y la API
 * daban **136 los dos** con desgloses distintos —GitHub 12 prereg y 21 reports; la API 11, 18 y
 * 4 erratas—, porque la carpeta no decide el tipo, lo decide `meta.type`. **Dos totales que
 * coinciden pueden tener contenidos distintos**, asi que comparar totales habria dicho «todo
 * bien» sin mirar nada.
 *
 * SE MIRA DESDE FUERA, sin credenciales y sin árbol local: las tres superficies son las que ve
 * un tercero. Si el guardia necesitara nuestro disco, comprobaria nuestra copia privada en vez
 * de la promesa publica.
 *
 * SU PUNTO CIEGO, declarado: compara **presencia**, no contenido. Dos copias podrian tener
 * bytes distintos bajo el mismo id y esto pasaria; para eso esta el sello y su hash. Y no
 * comprueba el ancla de OpenTimestamps, que es una cuarta cosa.
 *
 * Uso:
 *   node scripts/check-tres-copias.mjs --self-test
 *   node scripts/check-tres-copias.mjs
 */

/** Quien actua esta senal, y que hace al recibirla. Declarado aqui, no en un documento aparte. */
export const CONSUMIDOR = {
  quien: "la sesion que mantiene el archivo (Rosetta Q Main)",
  hace: "corre `python3 scripts/sync_archives_to_d1.py` —o `notarize.py` entero— para reponer la copia que falta",
  bloquea: "no se anuncia triple copia mientras sean dos: la promesa esta en PROTOCOL.md y la lee un tercero",
};

const GITHUB = "https://api.github.com/repos/RosettaQuantum/evidence/git/trees/main?recursive=1";
const CODEBERG = "https://codeberg.org/api/v1/repos/RosettaQuantum/evidence/git/trees/main?recursive=true&per_page=1000";
const API = "https://rosettaquantum.com";

/** Las carpetas que componen el archivo. Misma definicion que `notarize_globs.py`. */
export const CARPETAS = ["runs/", "prereg/", "verdicts/", "reports/", "recipes/", "manifests/", "predictions/"];

/** Las listas publicas de la copia 3. `erratas` incluida: en disco no tiene carpeta propia. */
export const LISTAS = ["runs", "verdicts", "prereg", "reports", "recipes", "manifests", "predictions", "erratas"];

/**
 * El id de un artefacto, sacado de su nombre: `RosettaQ__TIPO__ID__marca__slug.json`.
 *
 * **Devuelve null si el nombre no sigue la convencion, y el que llama tiene que contarlo.**
 * Un nombre raro que se descarta en silencio es un artefacto que desaparece del conteo sin que
 * nadie lo sepa — y ese es justo el fallo que este guardia existe para no cometer.
 */
export function idDeNombre(nombre) {
  const base = String(nombre || "").replace(/\.json$/, "");
  const p = base.split("__");
  return p.length >= 3 && p[2] ? p[2] : null;
}

/** @param {{github:string[], codeberg:string[], api:string[]}} ctx — ids ya extraidos */
export function evaluarCopias({ github, codeberg, api }) {
  const S = (a) => new Set(a);
  const g = S(github), c = S(codeberg), a = S(api);
  const menos = (x, y) => [...x].filter((v) => !y.has(v)).sort();

  const faltan = {
    en_codeberg: menos(g, c),
    en_la_api: menos(g, a),
    solo_en_codeberg: menos(c, g),
    solo_en_la_api: menos(a, g),
  };
  const rotas = Object.values(faltan).reduce((n, v) => n + v.length, 0);

  return {
    estado: rotas ? "copias_desiguales" : "ok",
    conteo: { github: g.size, codeberg: c.size, api: a.size },
    faltan,
    motivo: rotas
      ? `${rotas} artefacto(s) no estan en las tres copias`
      : `las tres copias tienen los mismos ${g.size} artefactos`,
  };
}

// ── self-test ────────────────────────────────────────────────────────────────────────────
const _esPrincipal = typeof process !== "undefined" && process.argv?.[1] &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (_esPrincipal && process.argv.includes("--self-test")) {
  const base = Array.from({ length: 130 }, (_, i) => `EXP-${String(i).padStart(4, "0")}`);
  const VW = ["RQ-PREREG-VW-001", "RQ-ERRATA-VW-001", "RQ-REPORT-VW-001", "RQ-REPORT-VW-002", "RQ-REPORT-VW-003", "RQ-REPORT-VW-004"];

  const casos = [
    // EL CASO REAL del 28-ago: los 6 de VW en GitHub y Codeberg, ausentes de D1.
    ["grita: el caso REAL — la tercera copia va 130 y las otras 136", () => {
      const r = evaluarCopias({ github: [...base, ...VW], codeberg: [...base, ...VW], api: base });
      return r.estado === "copias_desiguales" && r.faltan.en_la_api.length === 6;
    }],

    ["grita: dice CUALES faltan y en que copia", () => {
      const r = evaluarCopias({ github: [...base, ...VW], codeberg: [...base, ...VW], api: base });
      return r.faltan.en_la_api.includes("RQ-PREREG-VW-001") && r.faltan.en_codeberg.length === 0;
    }],

    ["grita: el espejo de Codeberg atrasado tambien cuenta", () =>
      evaluarCopias({ github: [...base, "X-1"], codeberg: base, api: [...base, "X-1"] }).faltan.en_codeberg.length === 1],

    ["grita: algo en la API que NO esta en el archivo publico", () =>
      evaluarCopias({ github: base, codeberg: base, api: [...base, "FANTASMA-1"] }).faltan.solo_en_la_api.length === 1],

    // ── calla ──
    ["CALLA: las tres con los mismos artefactos", () =>
      evaluarCopias({ github: base, codeberg: base, api: base }).estado === "ok"],

    ["CALLA: el orden no importa, son conjuntos", () =>
      evaluarCopias({ github: base, codeberg: [...base].reverse(), api: [...base].sort() }).estado === "ok"],

    // ── el id sale del nombre ──
    ["saca el id de la convencion real de la casa", () =>
      idDeNombre("RosettaQ__ERRATA__RQ-ERRATA-EXP-HSBC-Q-001__20260826T0133Z__el-umbral.json") === "RQ-ERRATA-EXP-HSBC-Q-001"],

    // Un nombre fuera de convencion NO se descarta callado: devuelve null y el CLI lo cuenta.
    ["un nombre que no sigue la convencion devuelve null, no se traga", () =>
      idDeNombre("suelto.json") === null && idDeNombre("") === null],

    // ── mutacion ──
    // LA QUE JUSTIFICA EL DISENO ENTERO, y salio del terreno: al escribir esto, GitHub y la API
    // daban 136 LOS DOS con desgloses distintos. Comparar totales habria dicho «todo bien».
    ["MUTACION: comparar TOTALES aprobaria dos copias con contenidos distintos", () => {
      const g = [...base, "A-1", "A-2"], a = [...base, "B-1", "B-2"];
      const porConjunto = evaluarCopias({ github: g, codeberg: g, api: a }).estado;
      const porTotal = g.length === a.length;
      return porConjunto === "copias_desiguales" && porTotal === true;
    }],

    ["el conteo viaja con el veredicto, para poder restarlo a mano", () => {
      const r = evaluarCopias({ github: [...base, ...VW], codeberg: [...base, ...VW], api: base });
      return r.conteo.github === 136 && r.conteo.api === 130;
    }],
  ];

  let fallos = 0;
  for (const [nombre, fn] of casos) {
    let paso; try { paso = fn(); } catch { paso = false; }
    console.log(`${paso ? "ok   " : "FALLA"}  ${nombre}`);
    if (!paso) fallos++;
  }
  console.log(`\n[tres-copias] self-test: ${casos.length - fallos} de ${casos.length} pasaron.`);
  process.exit(fallos ? 1 : 0);
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────
if (_esPrincipal && !process.argv.includes("--self-test")) {
  const traer = async (u) => {
    const r = await fetch(u, { headers: { "User-Agent": "rosetta tres-copias", "x-rq-check": "1" } });
    if (!r.ok) throw new Error(`${u.split("/")[2]} -> HTTP ${r.status}`);
    return r.json();
  };
  // Si una copia no se puede leer NO se aprueba: se sale con 2. «No se pudo mirar» y «estan
  // iguales» son cosas distintas, y confundirlas es como se publica una promesa rota.
  const copia = async (nombre, fn) => {
    try { return await fn(); }
    catch (e) {
      console.error(`[tres-copias] NO SE PUDO COMPROBAR: ${nombre} — ${String(e.message || e).slice(0, 80)}`);
      console.error("[tres-copias] Sin las tres no se compara nada. Esto no es «estan iguales»: es que no se sabe.");
      process.exit(2);
    }
  };

  const deArbol = (tree) => {
    const raros = [];
    const ids = [];
    for (const x of tree) {
      const p = x.path || "";
      if (!p.endsWith(".json") || !CARPETAS.some((c) => p.startsWith(c))) continue;
      const id = idDeNombre(p.split("/").pop());
      if (id) ids.push(id); else raros.push(p);
    }
    return { ids, raros };
  };

  const gh = await copia("GitHub", async () => {
    const d = await traer(GITHUB);
    if (d.truncated) throw new Error("el arbol vino truncado: el conteo seria parcial");
    return deArbol(d.tree || []);
  });
  const cb = await copia("Codeberg", async () => {
    const d = await traer(CODEBERG);
    if (d.truncated) throw new Error("el arbol vino truncado: el conteo seria parcial");
    return deArbol(d.tree || []);
  });
  const api = await copia("la API", async () => {
    const ids = [];
    for (const l of LISTAS) {
      const d = await traer(`${API}/v1/${l}?limit=200`);
      const total = d.total_archivo;
      const items = d.items || [];
      // Un listado paginado a medias haria creer que faltan artefactos que si estan.
      if (typeof total === "number" && items.length < total) {
        throw new Error(`/v1/${l} devolvio ${items.length} de ${total}: haria falta paginar`);
      }
      for (const i of items) if (i.id) ids.push(i.id);
    }
    return { ids, raros: [] };
  });

  const raros = [...gh.raros, ...cb.raros];
  if (raros.length) {
    console.log(`[tres-copias] ${raros.length} archivo(s) fuera de la convencion de nombre, NO contados:`);
    for (const p of raros.slice(0, 6)) console.log(`      ${p}`);
  }

  const r = evaluarCopias({ github: gh.ids, codeberg: cb.ids, api: api.ids });
  console.log(`[tres-copias] github ${r.conteo.github} · codeberg ${r.conteo.codeberg} · api ${r.conteo.api}`);

  if (r.estado === "ok") {
    console.log(`[tres-copias] ${r.motivo}.`);
    process.exit(0);
  }

  console.error(`\n[tres-copias] LAS COPIAS NO CALZAN: ${r.motivo}`);
  for (const [donde, ids] of Object.entries(r.faltan)) {
    if (!ids.length) continue;
    console.error(`    ${donde.replace(/_/g, " ")}: ${ids.length}`);
    for (const id of ids.slice(0, 8)) console.error(`       ${id}`);
    if (ids.length > 8) console.error(`       … y ${ids.length - 8} mas`);
  }
  console.error("[tres-copias] PROTOCOL.md promete tres copias. Mientras falte una, son dos.");
  console.error("[tres-copias] Se repone con `python3 scripts/sync_archives_to_d1.py` en el arbol del archivo.");
  process.exit(1);
}
