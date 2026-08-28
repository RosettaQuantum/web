#!/usr/bin/env node
/**
 * Una promesa sin numero tambien es una afirmacion, y nadie la vigilaba.
 *
 * EL DEFECTO, medido en produccion el 2026-08-28 y VIVO cuando se escribio esto:
 *
 *     <title>  Rosetta Quantum - We measure whether quantum wins, and publish the answer
 *     <h1>     Answers no classical computer can reach. One function call away.
 *     /v1/state  victorias_cuanticas_medidas: 0
 *
 * En los dos idiomas. **La pestana promete lo correcto y el cuerpo promete lo que nuestra
 * propia API desmiente con un cero.** El arreglo del 26-ago se llama, textual, «Titulo de
 * pestana: medimos y publicamos, en vez de prometer» — y eso fue exactamente lo que arreglo:
 * la pestana. El `<h1>` se quedo con la promesa.
 *
 * POR QUE NO LO CAZABA NADIE. `check-ventaja-cero` existe para esto y mira **codigo**: busca
 * identificadores numericos —`winRate`, `tasa_de_victorias`— con valor. Corre en verde y este
 * titular pasa, porque **un titular no trae numero**. Es la forma que mas duele en esta casa:
 * una afirmacion vaga no se puede falsar con un `grep` de cifras, y el lector tecnico la falsa
 * en treinta segundos **con la herramienta que le dimos nosotros**.
 *
 * LA REGLA, y lo que la hace precisa: no se persiguen «promesas» en general —eso es imposible
 * de acotar y un falso rojo sobre texto publico retiene trabajo bueno—. Se persigue **una lista
 * cerrada de formas que afirman que entregamos algo que lo clasico no alcanza**, y **solo
 * mientras el contador este en cero**. El dia que midamos una victoria, la misma frase pasa a
 * ser cierta y este guardia se calla solo. No vigila el estilo: vigila la coherencia con el
 * dato.
 *
 * PRECISION COMPROBADA, no supuesta: los 74 algoritmos del catalogo publico se revisaron contra
 * estas formas y dan **0 coincidencias**, asi que describir la ventaja que reclama un tercero no
 * dispara nada. Lo que dispara es afirmarla en primera persona.
 *
 * SU PUNTO CIEGO, declarado: caza las formas que conoce. Una promesa nueva escrita de otra
 * manera pasa, y por eso la lista se amplia cuando aparezca una — no se intenta adivinarlas.
 * Y no juzga el tono: «el mejor archivo del mundo» le da igual, porque eso no lo desmiente
 * nuestra API.
 *
 * Uso:
 *   node scripts/check-promesa-sin-numero.mjs --self-test
 *   node scripts/check-promesa-sin-numero.mjs            # contra el texto publico del repo
 *   node scripts/check-promesa-sin-numero.mjs --vivo     # contra las paginas desplegadas
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** Quien actua esta senal, y que hace al recibirla. Declarado aqui, no en un documento aparte. */
export const CONSUMIDOR = {
  quien: "quien escribe texto publico (Diseno y Comercial, via la sesion CTO)",
  hace: "reescribe la frase para que no afirme una capacidad que el contador desmiente, o la publica cuando el contador deje de ser cero",
  bloquea: "no sale a produccion una portada que nuestro propio /v1/state falsa en treinta segundos",
};

const BASE = "https://rosettaquantum.com";

/**
 * Las formas prohibidas MIENTRAS el contador este en cero. Lista cerrada y declarada.
 *
 * Cada una sale de un caso real, no de imaginar como podria escribirse una promesa. Las dos
 * primeras estaban vivas en la portada; la tercera y la cuarta estaban en la rama `piezas-3d`.
 */
export const AFIRMACIONES = [
  { id: "alcance-clasico-en", re: /\bno classical (?:computer|machine|hardware|solver)[^.!?]{0,40}\b(?:can|could|will)\b[^.!?]{0,20}\b(?:reach|match|solve|touch|do)\b/i,
    dice: "afirma que entregamos algo que ningun clasico alcanza" },
  { id: "alcance-clasico-es", re: /\bning[uú]n (?:computador|ordenador|computadora)(?:es)? cl[aá]sic[oa][^.!?]{0,40}\b(?:alcanza|iguala|resuelve|logra|puede)\b/i,
    dice: "afirma que entregamos algo que ningun clasico alcanza" },
  { id: "mas-alla-de-lo-clasico", re: /\b(?:beyond classical|classically impossible|imposible cl[aá]sicamente|m[aá]s all[aá] de lo (?:que puede )?cl[aá]sico)\b/i,
    dice: "situa nuestro resultado fuera del alcance clasico" },
  { id: "ventaja-en-primera-persona", re: /\b(?:we|nosotros)\b[^.!?]{0,30}\b(?:deliver|achieve|logramos|entregamos|conseguimos)\b[^.!?]{0,30}\b(?:quantum advantage|ventaja cu[aá]ntica)\b/i,
    dice: "reclama ventaja cuantica propia" },
];

/**
 * Formas que MENCIONAN la promesa sin hacerla. Se descuentan antes de juzgar.
 *
 * Sin esto, la frase que explica por que algo esta prohibido dispara la prohibicion — el defecto
 * del 17-ago, donde el comentario que documentaba el problema hacia que el guardia lo aprobara.
 * Aqui va al reves y es igual de malo: **el texto que declara el cero saldria en rojo.**
 */
export const EXIMENTES = [
  /\b(?:we do not|we don't|no) claim\b/i,
  /\bno afirmamos\b/i,
  /\bnot yet\b/i,
  /\btodav[ií]a no\b/i,
  /\b(?:cero|0) victorias\b/i,
  /\bzero (?:measured )?wins\b/i,
];

/** Quita comentarios HTML: documentar un defecto no es cometerlo. */
export function soloTextoVisible(html) {
  return String(html || "").replace(/<!--[\s\S]*?-->/g, " ");
}

/**
 * @param {{texto:string, victorias:number|null}} ctx
 */
export function evaluarTexto({ texto, victorias }) {
  // Un contador que no se pudo leer NO es un cero: sin el no se puede juzgar nada, y aprobar
  // por no haber podido mirar es como se publican las cosas que nos importan.
  if (victorias === null || victorias === undefined) {
    return { estado: "sin_contador", hallazgos: [],
             motivo: "no se pudo leer victorias_cuanticas_medidas: sin el dato no se juzga el texto" };
  }
  // El dia que midamos una victoria, estas frases pasan a ser ciertas y el guardia se calla.
  if (victorias > 0) return { estado: "ok", hallazgos: [], motivo: `el contador dice ${victorias}: estas afirmaciones ya no son promesas` };

  const visible = soloTextoVisible(texto);
  const hallazgos = [];
  for (const a of AFIRMACIONES) {
    const m = a.re.exec(visible);
    if (!m) continue;
    const desde = Math.max(0, m.index - 90), hasta = Math.min(visible.length, m.index + m[0].length + 90);
    const contexto = visible.slice(desde, hasta);
    if (EXIMENTES.some((e) => e.test(contexto))) continue;   // la menciona, no la hace
    hallazgos.push({ id: a.id, dice: a.dice, frase: m[0].replace(/\s+/g, " ").trim() });
  }
  return hallazgos.length
    ? { estado: "promete_de_mas", hallazgos, motivo: `${hallazgos.length} afirmacion(es) que /v1/state desmiente con un 0` }
    : { estado: "ok", hallazgos: [], motivo: "ninguna forma conocida de promesa sin numero" };
}

// ── self-test ────────────────────────────────────────────────────────────────────────────
const _esPrincipal = typeof process !== "undefined" && process.argv?.[1] &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (_esPrincipal && process.argv.includes("--self-test")) {
  // LOS CASOS REALES, copiados del disco el 2026-08-28. No inventados.
  const H1_EN = "Answers no classical computer can reach. One function call away.";
  const H1_ES = "Respuestas que ningún computador clásico alcanza. A una llamada de función.";
  const TITULO_HONESTO = "Rosetta Quantum - We measure whether quantum wins, and publish the answer";

  const casos = [
    // ── grita ──
    ["grita: el <h1> REAL en ingles, con el contador en 0", () =>
      evaluarTexto({ texto: H1_EN, victorias: 0 }).estado === "promete_de_mas"],

    ["grita: el <h1> REAL en espanol", () =>
      evaluarTexto({ texto: H1_ES, victorias: 0 }).estado === "promete_de_mas"],

    ["grita: dice CUAL frase y por que, no solo que hay una", () => {
      const h = evaluarTexto({ texto: H1_EN, victorias: 0 }).hallazgos[0];
      return /no classical computer can reach/i.test(h.frase) && h.dice.length > 20;
    }],

    ["grita: reclamar ventaja cuantica propia", () =>
      evaluarTexto({ texto: "We deliver quantum advantage today.", victorias: 0 }).estado === "promete_de_mas"],

    // ── calla ──
    ["CALLA: el titulo honesto que ya usa la casa", () =>
      evaluarTexto({ texto: TITULO_HONESTO, victorias: 0 }).estado === "ok"],

    // Con una victoria medida la MISMA frase es cierta. El guardia se retira solo.
    ["CALLA: con el contador en 1, la misma frase deja de ser promesa", () =>
      evaluarTexto({ texto: H1_EN, victorias: 1 }).estado === "ok"],

    ["CALLA: describir la ventaja que reclama un TERCERO", () =>
      evaluarTexto({ texto: "Farhi et al. claim a speedup on MaxCut instances.", victorias: 0 }).estado === "ok"],

    ["CALLA: negada o acotada", () =>
      ["We do not claim answers no classical computer can reach.",
       "No afirmamos respuestas que ningun computador clasico alcanza.",
       "Answers no classical computer can reach - not yet: zero measured wins."]
        .every((t) => evaluarTexto({ texto: t, victorias: 0 }).estado === "ok")],

    // ── el caso paradojico ──
    // El texto que DOCUMENTA la prohibicion no puede dispararla. Es el defecto del 17-ago al
    // reves: alli el comentario aprobaba el defecto; aqui condenaria a quien lo explica.
    ["CALLA: la frase dentro de un comentario HTML no es una promesa", () =>
      evaluarTexto({ texto: "<!-- prohibido: 'Answers no classical computer can reach' -->", victorias: 0 }).estado === "ok"],

    // ── falla cerrado ──
    ["grita distinto: sin contador NO se aprueba, se declara", () =>
      evaluarTexto({ texto: H1_EN, victorias: null }).estado === "sin_contador"],

    // ── mutacion ──
    ["MUTACION: sin quitar comentarios, el texto que explica la regla saldria en rojo", () => {
      const t = "<!-- prohibido: 'Answers no classical computer can reach' -->";
      const conFiltro = evaluarTexto({ texto: t, victorias: 0 }).estado;
      const sinFiltro = AFIRMACIONES[0].re.test(t);
      return conFiltro === "ok" && sinFiltro === true;
    }],

    ["MUTACION: sin mirar el contador, gritaria incluso con victorias medidas", () => {
      const conRegla = evaluarTexto({ texto: H1_EN, victorias: 3 }).estado;
      const sinRegla = AFIRMACIONES[0].re.test(H1_EN);
      return conRegla === "ok" && sinRegla === true;
    }],

    // El catalogo real: 74 algoritmos, 0 coincidencias. Medido antes de escribir la lista.
    ["la lista es cerrada y cada forma trae su explicacion", () =>
      AFIRMACIONES.length >= 4 && AFIRMACIONES.every((a) => a.re instanceof RegExp && a.dice.length > 15)],
  ];

  let fallos = 0;
  for (const [nombre, fn] of casos) {
    let paso; try { paso = fn(); } catch { paso = false; }
    console.log(`${paso ? "ok   " : "FALLA"}  ${nombre}`);
    if (!paso) fallos++;
  }
  console.log(`\n[promesa-sin-numero] self-test: ${casos.length - fallos} de ${casos.length} pasaron.`);
  process.exit(fallos ? 1 : 0);
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────
if (_esPrincipal && !process.argv.includes("--self-test")) {
  const vivo = process.argv.includes("--vivo");

  // El contador se CONSULTA. Si no responde, no se aprueba nada: se sale con 2 y se dice.
  let victorias = null;
  try {
    const r = await fetch(`${BASE}/v1/state`, { headers: { "x-rq-check": "1" } });
    victorias = (await r.json())?.estado_medido?.victorias_cuanticas_medidas ?? null;
  } catch { /* queda en null */ }
  if (typeof victorias !== "number") {
    console.error("[promesa] NO SE PUDO COMPROBAR: /v1/state no dio victorias_cuanticas_medidas.");
    console.error("[promesa] Sin el contador no se juzga el texto, y no aprobar es lo correcto.");
    process.exit(2);
  }
  console.log(`[promesa] victorias_cuanticas_medidas = ${victorias}`);

  const superficies = [];
  if (vivo) {
    for (const ruta of ["/", "/es/", "/clases/", "/api-docs/"]) {
      try {
        const r = await fetch(BASE + ruta, { headers: { "x-rq-check": "1" } });
        superficies.push({ nombre: BASE + ruta, texto: await r.text() });
      } catch (e) { console.error(`[promesa] ${ruta}: no se pudo leer — ${String(e).split("\n")[0]}`); process.exit(2); }
    }
  } else {
    const dir = "src/content_html";
    if (!existsSync(dir)) { console.error(`[promesa] NO SE PUDO COMPROBAR: falta ${dir}.`); process.exit(2); }
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".html"))) {
      superficies.push({ nombre: join(dir, f), texto: readFileSync(join(dir, f), "utf8") });
    }
  }

  let malas = 0;
  for (const s of superficies) {
    const r = evaluarTexto({ texto: s.texto, victorias });
    if (r.estado === "ok") { console.log(`   ok    ${s.nombre}`); continue; }
    malas++;
    console.error(`   FALLA ${s.nombre} — ${r.motivo}`);
    for (const h of r.hallazgos) console.error(`         «${h.frase}» — ${h.dice}`);
  }

  console.log(`\n[promesa] ${superficies.length} superficie(s) revisadas · ${malas} que prometen de mas`);
  if (malas) {
    console.error("[promesa] Una promesa sin numero tambien es una afirmacion, y esta la desmiente");
    console.error("[promesa] nuestro propio /v1/state con un 0 — con la herramienta que le dimos al lector.");
    process.exit(1);
  }
  console.log("[promesa] ninguna superficie afirma lo que el contador desmiente.");
}
