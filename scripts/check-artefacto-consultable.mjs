#!/usr/bin/env node
/**
 * Un artefacto sellado que no se puede consultar no cumple su unica funcion.
 *
 * EL DEFECTO (medido el 2026-08-26 contra `/v1/runs` y contra el archivo). El esquema de
 * `w6.que` dejo de usarse, y con el se fueron los campos por los que la API busca:
 *
 *     julio    51 artefactos · problem_class e instance al 100% · 38 campos distintos
 *     agosto   42 artefactos · problem_class e instance al   0% · 128 campos distintos
 *
 * Un corte limpio, sin oscilacion: la ultima poblada es del 30-jul (`EXP-0007-020`), la
 * primera vacia del 03-ago (`RQ-POC-QPU-001`). **Veinticuatro dias y 42 corridas.**
 *
 * Cada guion de sellado nuevo **invento su propia estructura narrativa** en vez de llenar el
 * esquema. Y el detalle que explica por que nadie lo vio: **el contenido de agosto es mejor
 * que el de julio** —mas rico y mas honesto—, asi que leer un artefacto a ojo daba confianza.
 * Lo que se perdio no fue calidad: fue **la capacidad de encontrarlo**.
 *
 * ES LA FORMA MAS PURA DEL DEFECTO DE LA CASA. No se rompio nada. Ningun chequeo fallo. El
 * artefacto esta bien formado, sellado, anclado, con sus dos copias publicas y su hash
 * verificable. **Simplemente dejo de contestar la pregunta para la que existe.** Un agente que
 * consulta el archivo hoy recibe 42 corridas sin clase, sin instancia y sin lado clasico —y el
 * hallazgo vive unicamente en el nombre del archivo, que es justo lo que un formato
 * consultable viene a evitar—.
 *
 * POR QUE NO BARRE EL ARCHIVO. Se invoca sobre **el artefacto que se va a sellar**, no sobre
 * lo publicado. Los 42 de agosto no se re-sellan: publicado es publicado, y si hay que
 * hacerlos consultables va un indice derivado aparte. Este guardia impide el 43.
 *
 * Y hay un modo auditoria que recorre y **reporta sin bloquear**, para medir el avance sin
 * detener a nadie.
 *
 * PRECISION SOBRE COBERTURA. Exige que el campo EXISTA y no este vacio. No juzga si el valor
 * es correcto —`problem_class: "cosas"` pasa— porque eso es criterio y no se automatiza. Lo
 * que impide es el caso que de verdad ocurrio, que es no poner nada.
 *
 * Uso:
 *   node scripts/check-artefacto-consultable.mjs --self-test
 *   node scripts/check-artefacto-consultable.mjs <artefacto.json>   # antes de sellar; bloquea
 *   node scripts/check-artefacto-consultable.mjs --auditar <dir>    # recorre y reporta
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, basename } from "node:path";

/** Quien actua esta senal, y que hace al recibirla. Declarado aqui, no en un documento aparte. */
export const CONSUMIDOR = {
  quien: "quien selle una corrida (laboratorio o archivo)",
  hace: "llena los campos canonicos de w6.que antes de sellar; la narrativa va ademas, no en vez de",
};

/**
 * **LA UNICA DEFINICION.** El generador y este guardia leen de aqui, importandola — no cada
 * uno la suya. Una lista que vive en dos lugares ya divergio (CLAUDE.md §5 bis 3), y eso es
 * literalmente lo que produjo este defecto: cada guion con su propio vocabulario.
 */
export const CAMPOS_CONSULTABLES = ["problem_class", "instance", "outcome"];

/**
 * Nombres historicos del MISMO campo. El productor exige uno; el lector tolera los que ya
 * viajaron. Publicado es publicado.
 *
 * POR QUE EXISTE ESTA TABLA, y es la correccion de un error mio de ayer. `outcome` estuvo en
 * la lista de arriba, **lo baje a deseable**, y escribi la razon con seguridad: los tres
 * artefactos de julio que marcaba «no son comparaciones — un grafo anotado, una iteracion de
 * meta-aprendizaje, una auditoria — y exigirles un veredicto que no les corresponde es retener
 * trabajo bueno».
 *
 * Los tres SI adjudican. Traen el veredicto en un campo llamado `veredicto`.
 *
 * **Medi el nombre del campo y dije haber medido la cosa.** Y el error se sostuvo porque la
 * explicacion era buena: «precision sobre cobertura» es la regla correcta de la casa, invocada
 * sobre un hecho falso — que es exactamente la cautela disfrazada de rigor de CLAUDE.md §5
 * quater 7. La pregunta que faltaba no era *¿a cuales les corresponde un veredicto?* sino
 * **¿existe el dato y lo estoy buscando por el nombre que tiene?**
 *
 * EL COSTO, medido y no estimado (2026-08-27, sobre los 125 artefactos con `w6.que`):
 *
 *     con problem_class + instance ....... 51
 *     de esos, sin `outcome` .............  3   <- lo que bloquearia exigir el nombre exacto
 *     de esos, sin NINGUN sinonimo .......  0   <- lo que bloquea esta version
 *
 * Cero falsos positivos. La precision no se pago con cobertura: **se pagaba con una lectura
 * equivocada.**
 */
export const SINONIMOS = {
  outcome: ["veredicto", "VEREDICTO", "verdict", "resultado"],
};

/** Todo nombre que ocupa el lugar de un campo canonico, para no contarlo como narrativa. */
const ALIAS = new Set(Object.values(SINONIMOS).flat());

/** El valor de un campo canonico, por su nombre o por cualquiera de los que tuvo antes. */
export function valorDe(que, campo) {
  for (const k of [campo, ...(SINONIMOS[campo] ?? [])]) {
    if (k in (que ?? {}) && !vacio(que[k])) return { valor: que[k], bajo: k };
  }
  return { valor: undefined, bajo: null };
}

/** Ademas de los obligatorios, estos hacen la corrida comparable. Se reportan, no bloquean. */
export const CAMPOS_DESEABLES = ["recipe_id", "quantum_side", "classical_side"];

const vacio = (v) => v === undefined || v === null || v === "" ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0);

/**
 * El esquema canonico es **de las corridas**, y solo de ellas.
 *
 * EL DEFECTO DE ESTE MISMO GUARDIA, medido el 2026-08-27 al correrlo contra el archivo. Su
 * modo auditoria informaba **74 artefactos no consultables**. El numero real es **42**:
 *
 *     RUN         93 con w6.que · 42 no cumplen   <- las corridas, el defecto verdadero
 *     REPORT      14 · 14        PREREG   6 · 6
 *     RECIPE       4 ·  4        MANIFEST 3 · 3
 *     ERRATA       3 ·  3        VERDICT  1 · 1     PREDICTION 1 · 1
 *
 * Los otros 32 no fallaban: **se les estaba aplicando el esquema equivocado.** Y el caso que
 * lo deja claro es el pre-registro: exigirle `outcome` a un PREREG esta al reves por
 * definicion — se registra ANTES de que exista el resultado. Un guardia que le pide el
 * resultado a un pre-registro no encontro un defecto, tiene uno.
 *
 * Es la §4 sexies con el guardia adentro: **decia «artefactos no consultables» y media
 * «artefactos de cualquier tipo que no cumplen el esquema de las corridas»**. No rompia nada,
 * no fallaba ningun test, y el 74 iba camino a un reporte.
 *
 * El 42 coincide con lo que mide la API por otro camino — y esa coincidencia vale porque las
 * dos mediciones no comparten la premisa: una lee el artefacto, la otra el endpoint.
 *
 * Sin `meta.type` **se bloquea igual**, con otro mensaje: no se puede elegir esquema sin saber
 * que es, y un artefacto que se sella sin tipo es su propio defecto. No se asume RUN.
 */
export const TIPO_CON_ESQUEMA = "RUN";

/** Lee `w6.que` sin reventar si falta un tramo. */
export function queDe(artefacto) {
  const w6 = artefacto?.w6;
  const que = w6 && typeof w6 === "object" && !Array.isArray(w6) ? w6.que : undefined;
  return que && typeof que === "object" && !Array.isArray(que) ? que : null;
}

/**
 * ¿Se puede encontrar esta corrida en el archivo?
 *
 * @param {{artefacto:object, obligatorios?:string[], deseables?:string[]}} ctx
 */
export function evaluar({ artefacto, obligatorios = CAMPOS_CONSULTABLES, deseables = CAMPOS_DESEABLES }) {
  const tipo = artefacto?.meta?.type;
  if (tipo === undefined || tipo === null || tipo === "") {
    return { estado: "sin_tipo", tipo: null, motivo: "el artefacto no declara meta.type: no se puede saber que esquema le toca" };
  }
  if (tipo !== TIPO_CON_ESQUEMA) {
    return { estado: "no_aplica", tipo, motivo: `el esquema canonico es de ${TIPO_CON_ESQUEMA}; esto es ${tipo}` };
  }

  const que = queDe(artefacto);
  if (!que) return { estado: "sin_w6que", tipo, motivo: "el artefacto no trae w6.que: no hay donde buscar los campos" };

  const faltan = obligatorios.filter((c) => valorDe(que, c).valor === undefined);
  // Que campo llego bajo un nombre viejo: se informa, para saber cuanto archivo queda por
  // migrar sin tener que volver a contarlo a mano.
  const porAlias = obligatorios
    .map((c) => ({ campo: c, bajo: valorDe(que, c).bajo }))
    .filter((x) => x.bajo && x.bajo !== x.campo);
  const sinDeseables = deseables.filter((c) => vacio(que[c]));
  const narrativos = Object.keys(que)
    .filter((k) => !obligatorios.includes(k) && !deseables.includes(k) && !ALIAS.has(k));

  if (faltan.length) {
    return { estado: "no_consultable", tipo, motivo: `faltan ${faltan.length} campo(s) por los que la API busca`, faltan, porAlias, sinDeseables, narrativos: narrativos.length };
  }
  return { estado: "ok", tipo, porAlias, sinDeseables, narrativos: narrativos.length };
}

// ── self-test ────────────────────────────────────────────────────────────────────────────
const _esPrincipal = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (_esPrincipal && process.argv.includes("--self-test")) {
  // Los dos casos REALES, con la forma exacta que tienen los archivos (§2).
  const JULIO = { meta: { type: "RUN" }, w6: { que: { recipe_id: "r1", problem_class: "MaxCut", instance: "3-regular n=64", outcome: "classical wins", quantum_side: "QAOA p=3", classical_side: "GW" } } };
  const AGOSTO = { meta: { type: "RUN" }, w6: { que: { artefacto: "eon_case118.json", VEREDICTO: "empate", cruce_ventaja_cuantica: "no", censo_de_la_red: "118 barras" } } };

  // Copia deliberada de `vacio` para que la mutacion no dependa de exportarlo: simula el
  // guardia SIN tabla de sinonimos, que es el estado anterior a este arreglo.
  const vacioLocal = (v) => v === undefined || v === null || v === "";

  const casos = [
    // ── grita ──
    ["grita: el caso real de agosto — narrativa rica y cero campos consultables", () =>
      evaluar({ artefacto: AGOSTO }).estado === "no_consultable"],

    ["grita: dice CUALES faltan, no solo que faltan", () => {
      const r = evaluar({ artefacto: AGOSTO });
      return r.faltan.includes("problem_class") && r.faltan.includes("instance");
    }],

    ["grita distinto: sin w6.que no es 'faltan campos', es que no hay donde buscarlos", () =>
      evaluar({ artefacto: { meta: { type: "RUN" }, w6: {} } }).estado === "sin_w6que"],

    ["grita: un solo campo vacio basta", () =>
      evaluar({ artefacto: { meta: { type: "RUN" }, w6: { que: { problem_class: "MaxCut", instance: "", outcome: "x" } } } }).estado === "no_consultable"],

    // ── calla ──
    ["CALLA: el caso real de julio", () => evaluar({ artefacto: JULIO }).estado === "ok"],

    // LA CONDICION QUE PEDIA EL ARCHIVO: la narrativa se conserva, no se sacrifica.
    ["CALLA: campos canonicos MAS narrativa rica encima", () => {
      const mixto = { meta: { type: "RUN" }, w6: { que: { ...JULIO.w6.que, ...AGOSTO.w6.que, problem_class: "MaxCut", instance: "n=64", outcome: "empate" } } };
      const r = evaluar({ artefacto: mixto });
      return r.estado === "ok" && r.narrativos >= 3;
    }],

    ["CALLA: faltan deseables pero estan los obligatorios — se reporta, no bloquea", () => {
      const r = evaluar({ artefacto: { meta: { type: "RUN" }, w6: { que: { problem_class: "a", instance: "b", outcome: "c" } } } });
      return r.estado === "ok" && r.sinDeseables.length === 3;
    }],

    ["CALLA: un valor pobre pero presente pasa — juzgar el contenido es de una persona", () =>
      evaluar({ artefacto: { meta: { type: "RUN" }, w6: { que: { problem_class: "cosas", instance: "x", outcome: "y" } } } }).estado === "ok"],

    // ── bordes de 'vacio' ──
    ["cero y false NO son vacio", () =>
      evaluar({ artefacto: { meta: { type: "RUN" }, w6: { que: { problem_class: 0, instance: false, outcome: "x" } } } }).estado === "ok"],

    ["lista vacia y objeto vacio SI son vacio", () =>
      evaluar({ artefacto: { meta: { type: "RUN" }, w6: { que: { problem_class: [], instance: {}, outcome: "x" } } } }).faltan.length === 2],

    // ── una sola definicion ──
    ["la lista de campos es una constante exportada, no una copia local", () =>
      Array.isArray(CAMPOS_CONSULTABLES) && CAMPOS_CONSULTABLES.includes("problem_class")],

    // ── mutacion ──
    ["MUTACION: si solo se exigiera 'outcome', agosto pasaria — y agosto lo tiene al 69%", () => {
      const soloOutcome = evaluar({ artefacto: { meta: { type: "RUN" }, w6: { que: { outcome: "empate", VEREDICTO: "x" } } }, obligatorios: ["outcome"] });
      const completo = evaluar({ artefacto: { meta: { type: "RUN" }, w6: { que: { outcome: "empate", VEREDICTO: "x" } } } });
      return soloOutcome.estado === "ok" && completo.estado === "no_consultable";
    }],

    // ── el campo bajo su nombre viejo ──
    // LOS TRES DE JULIO, con la forma exacta que tienen en el archivo. Yo los habia declarado
    // «no son comparaciones» y los tres adjudican: el veredicto se llama `veredicto`.
    ["CALLA: adjudica bajo el nombre viejo `veredicto`", () =>
      evaluar({ artefacto: { meta: { type: "RUN" }, w6: { que: {
        problem_class: "Prediccion de sitios alostericos", instance: "KRAS G12C, BCR-ABL1",
        veredicto: "el clasico gana en 2 de 3",
      } } } }).estado === "ok"],

    ["CALLA: y en MAYUSCULAS, como lo escribio agosto", () =>
      evaluar({ artefacto: { meta: { type: "RUN" }, w6: { que: { problem_class: "a", instance: "b", VEREDICTO: "empate" } } } }).estado === "ok"],

    ["dice bajo que nombre llego, para saber cuanto queda por migrar", () => {
      const r = evaluar({ artefacto: { meta: { type: "RUN" }, w6: { que: { problem_class: "a", instance: "b", veredicto: "x" } } } });
      return r.porAlias.length === 1 && r.porAlias[0].campo === "outcome" && r.porAlias[0].bajo === "veredicto";
    }],

    ["un sinonimo NO se cuenta como narrativa: es el campo canonico con otro nombre", () =>
      evaluar({ artefacto: { meta: { type: "RUN" }, w6: { que: { problem_class: "a", instance: "b", veredicto: "x" } } } }).narrativos === 0],

    // ── grita ──
    // Encontrable y sin adjudicar por ningun nombre: eso SI se retiene. Es el caso que la
    // version anterior dejaba pasar entero por haber bajado `outcome` a deseable.
    ["grita: encontrable pero sin veredicto bajo NINGUN nombre", () =>
      evaluar({ artefacto: { meta: { type: "RUN" }, w6: { que: { problem_class: "MaxCut", instance: "n=64" } } } }).estado === "no_consultable"],

    ["un sinonimo VACIO no salva: presente y vacio es peor que ausente", () =>
      evaluar({ artefacto: { meta: { type: "RUN" }, w6: { que: { problem_class: "a", instance: "b", veredicto: "" } } } }).estado === "no_consultable"],

    // ── de que tipo es el artefacto ──
    // EL DEFECTO DE ESTE GUARDIA: le exigia el resultado a un pre-registro, que por definicion
    // se sella antes de que el resultado exista.
    ["CALLA: un PREREG no lleva outcome — pedirselo esta al reves", () =>
      evaluar({ artefacto: { meta: { type: "PREREG" }, w6: { que: { afirmacion: "x" } } } }).estado === "no_aplica"],

    ["CALLA: REPORT, MANIFEST, RECIPE y ERRATA tampoco llevan el esquema de las corridas", () =>
      ["REPORT", "MANIFEST", "RECIPE", "ERRATA"].every((t) =>
        evaluar({ artefacto: { meta: { type: t }, w6: { que: {} } } }).estado === "no_aplica")],

    // Falla cerrado, pero por su motivo verdadero: no se asume RUN por defecto.
    ["grita distinto: sin meta.type no se elige esquema — bloquea como `sin_tipo`, no como falta de campos", () =>
      evaluar({ artefacto: { w6: { que: { problem_class: "a", instance: "b", outcome: "c" } } } }).estado === "sin_tipo"],

    ["una RUN sigue juzgandose igual: el filtro por tipo no la indulta", () =>
      evaluar({ artefacto: { meta: { type: "RUN" }, w6: { que: { narrativa: "rica" } } } }).estado === "no_consultable"],

    // MUTACION: sin el filtro de tipo, el pre-registro se retiene. Es el 74 contra el 42.
    ["MUTACION: sin filtrar por tipo, un PREREG legitimo quedaria bloqueado", () => {
      const prereg = { meta: { type: "PREREG" }, w6: { que: { afirmacion: "x" } } };
      const conFiltro = evaluar({ artefacto: prereg }).estado;
      const sinFiltro = CAMPOS_CONSULTABLES.filter((c) => valorDe(prereg.w6.que, c).valor === undefined);
      return conFiltro === "no_aplica" && sinFiltro.length === 3;
    }],

    // ── mutacion ──
    // Sin la tabla de sinonimos, los tres de julio se bloquean. Es la medicion que corrige el
    // error: exigir el nombre exacto retiene 3 de 51; aceptando los viejos, 0.
    ["MUTACION: sin SINONIMOS, los tres artefactos reales de julio quedarian retenidos", () => {
      const julio3 = { meta: { type: "RUN" }, w6: { que: { problem_class: "a", instance: "b", veredicto: "x" } } };
      const conTabla = evaluar({ artefacto: julio3 }).estado;
      const sinTabla = ["problem_class", "instance", "outcome"].filter((c) => vacioLocal(julio3.w6.que[c]));
      return conTabla === "ok" && sinTabla.length === 1;
    }],
  ];

  let fallos = 0;
  for (const [nombre, fn] of casos) {
    let paso; try { paso = fn(); } catch { paso = false; }
    console.log(`${paso ? "ok   " : "FALLA"}  ${nombre}`);
    if (!paso) fallos++;
  }
  console.log(`\n[consultable] self-test: ${casos.length - fallos} de ${casos.length} pasaron.`);
  process.exit(fallos ? 1 : 0);
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────
if (_esPrincipal && !process.argv.includes("--self-test")) {
  const iAud = process.argv.indexOf("--auditar");

  if (iAud >= 0) {
    // Modo auditoria: recorre y REPORTA. No bloquea — lo publicado no se re-sella.
    const raiz = process.argv[iAud + 1];
    if (!raiz || !existsSync(raiz)) {
      console.error(`[consultable] NO SE PUDO COMPROBAR: falta el directorio (${raiz ?? "sin argumento"}).`);
      process.exit(2);
    }
    const filas = [];
    (function rec(d) {
      for (const e of readdirSync(d)) {
        const p = join(d, e);
        if (statSync(p).isDirectory()) rec(p);
        else if (e.endsWith(".json")) {
          try {
            const a = JSON.parse(readFileSync(p, "utf8"));
            if (a && typeof a === "object" && !Array.isArray(a) && queDe(a)) filas.push([p, evaluar({ artefacto: a })]);
          } catch { /* JSON ilegible: asunto de otro guardia */ }
        }
      }
    })(raiz);

    // El denominador es de las CORRIDAS. Mezclar los otros tipos fue el defecto de ayer: 74
    // donde el numero real era 42. Todo proceso que recorre un conjunto declara su denominador.
    const corridas = filas.filter(([, r]) => r.estado !== "no_aplica" && r.estado !== "sin_tipo");
    const otros = filas.filter(([, r]) => r.estado === "no_aplica");
    const sinTipo = filas.filter(([, r]) => r.estado === "sin_tipo");
    const mal = corridas.filter(([, r]) => r.estado !== "ok");

    console.log(`[consultable] auditoria · ${filas.length} artefactos con w6.que en total`);
    console.log(`   ${corridas.length} del tipo ${TIPO_CON_ESQUEMA} — ${corridas.length - mal.length} consultables, ${mal.length} no`);
    console.log(`   ${otros.length} de otros tipos: el esquema de las corridas no les toca, no se cuentan`);
    if (sinTipo.length) console.log(`   ${sinTipo.length} SIN meta.type — no se puede saber que esquema les toca`);
    for (const [p, r] of mal.slice(0, 10)) console.log(`   ${r.estado.padEnd(16)} ${basename(p).slice(0, 58)}`);
    if (mal.length > 10) console.log(`   … y ${mal.length - 10} mas`);
    console.log("\n[consultable] modo auditoria: informa y no detiene. Lo publicado no se re-sella.");
    process.exit(0);
  }

  const archivo = process.argv[2];
  if (!archivo || !existsSync(archivo)) {
    console.error(`[consultable] NO SE PUDO COMPROBAR: falta el artefacto (${archivo ?? "sin argumento"}).`);
    process.exit(2);
  }
  let artefacto;
  try { artefacto = JSON.parse(readFileSync(archivo, "utf8")); }
  catch (e) { console.error(`[consultable] NO SE PUDO COMPROBAR: JSON ilegible. ${String(e).split("\n")[0]}`); process.exit(2); }

  const r = evaluar({ artefacto });
  console.log(`[consultable] ${basename(archivo)}${r.tipo ? `  ·  type=${r.tipo}` : ""}`);

  if (r.estado === "no_aplica") {
    console.log(`   ${r.motivo}. Nada que exigir aqui.`);
    process.exit(0);
  }
  if (r.estado === "sin_tipo") {
    console.error(`\n[consultable] BLOQUEADO: ${r.motivo}`);
    console.error("[consultable] No se asume RUN: un artefacto sellado sin tipo es su propio defecto.");
    process.exit(1);
  }

  if (r.estado === "ok") {
    for (const x of r.porAlias ?? []) console.log(`   ~ ${x.campo} llego como \`${x.bajo}\` — nombre historico, se acepta`);
    if (r.sinDeseables.length) console.log(`   sin (no bloquea): ${r.sinDeseables.join(", ")}`);
    console.log(`   ${r.narrativos} campo(s) narrativos ademas de los canonicos. Consultable.`);
  } else {
    console.error(`\n[consultable] BLOQUEADO: ${r.motivo}`);
    if (r.faltan) for (const c of r.faltan) console.error(`    falta: ${c}`);
    if (r.narrativos) console.error(`    (trae ${r.narrativos} campos narrativos — el contenido esta, pero no se puede encontrar)`);
    console.error("[consultable] La narrativa va ADEMAS de los campos canonicos, no en vez de ellos.");
    console.error("[consultable] Un artefacto que no se puede consultar no cumple su unica funcion.");
    process.exit(1);
  }
}
