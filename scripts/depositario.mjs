#!/usr/bin/env node
/**
 * El Depositario: lo unico que estampa una hora, y lo que sostiene la factura.
 *
 * POR QUE EXISTE (medido el 2026-08-26 sobre el archivo real). Hoy la fecha de un artefacto
 * la escribe quien lo genera:
 *
 *     archived_at   92 presentes · 19 copiadas del nombre del archivo
 *     sealed_at     52 presentes · 22 copiadas
 *     lo que deposita el CI      55 artefactos · 0 con ningun campo de tiempo
 *
 * Y los 41 campos contaminados caen **todos** en hora o media hora exacta —34 en `:00`, 7 en
 * `:30`, ninguno en un minuto arbitrario—. Eso invirtio la causa que suponiamos: **nadie copia
 * el nombre al campo. Una persona declara una hora redonda y de ese mismo valor salen el
 * nombre Y el campo.** Hay un origen comun, y el origen es alguien redondeando.
 *
 * Con precio por consumo eso deja de ser higiene: **es la base del cobro**, y un cliente que
 * dispute encontraria que la marca de tiempo se la puso el mismo proceso que le esta cobrando.
 *
 * LOS TRES RELOJES, y cual sostiene que.
 *
 *     duraciones por fase   las escribe el ejecutor    nadie mas ve sus fases   falseable, y no importa
 *     hora de deposito      LA ESCRIBE ESTE MODULO     operar y facturar        falseable por nosotros
 *     ancla                 nadie de esta casa         que el registro es anterior al bloque
 *
 * **El ancla NO sostiene la factura**, y esto se corrigio despues de escribirlo mal: un ancla
 * acota por ARRIBA —el dato existia antes del bloque— y un dato viejo se ancla cuando sea.
 * Sirve contra retrodatar. **El riesgo de un cobro por consumo es el contrario: inflar.** Asi
 * que el peso cae aqui, y por eso este modulo falla cerrado en todo lo que puede.
 *
 * LA DEFENSA DE CONSTRUCCION, mas barata que cualquier guardia: **estampa con precision de
 * subsegundo.** Nadie escribe `.537065` a mano, asi que una hora declarada por una persona
 * queda visible sola. Es mejor hacer el defecto imposible de esconder que perseguirlo.
 *
 * LO QUE ESTE MODULO NO PUEDE, declarado: **no prueba que el trabajo ocurrio.** Los tres
 * relojes contestan «cuando»; ninguno contesta «si». Un deposito que declara cuarenta corridas
 * es indistinguible de uno que declara cuarenta y corrio treinta y ocho. El tercero que si
 * puede probarlo no es Bitcoin: es **quien nos vende el computo** —la nube mide lo que
 * consumimos, el proveedor de QPU emite identificador por trabajo—. Contrastar contra eso es
 * el paso siguiente y no esta construido.
 *
 * Uso:
 *   node scripts/depositario.mjs --self-test
 *   node scripts/depositario.mjs <artefacto.json> --consumo <consumo.json>
 */
import { readFileSync, existsSync } from "node:fs";

/** Quien actua esta senal, y que hace al recibirla. Declarado aqui, no en un documento aparte. */
export const CONSUMIDOR = {
  quien: "quien opera el ejecutor que envio el deposito",
  hace: "corrige lo que el rechazo nombra y reenvia; el deposito es idempotente por clave",
};

/**
 * Codigos de rechazo. **Contrato publico**: los lee un tercero, asi que se agregan pero no se
 * renombran una vez publicados. Nada de esto esta publicado todavia, por eso se renombra ahora.
 *
 * LA REGLA, y es de Main: **el codigo nombra el DEFECTO, no el mecanismo que lo produjo.** Quien
 * recibe un rechazo necesita saber que arreglar, no como lo detectamos.
 *
 * LOS DOS QUE SE RENOMBRARON, y como se supo que hacia falta:
 *
 *   - `RELOJ_PROVISTO_POR_EL_GENERADOR` -> `FECHA_NO_INDEPENDIENTE`. El viejo describia de
 *     donde venia la marca de tiempo; el nuevo dice que esta mal — la cosa medida fijo su
 *     propia fecha.
 *   - `SIN_CONSUMO` -> `SIN_CONSUMO_MEDIDO`, y esta es la interesante. Main leyo `SIN_CONSUMO`
 *     como «no declara quien consume esta senal» y propuso `SIN_CONSUMIDOR_DECLARADO`. **Es
 *     otra cosa**: aqui `consumo` son `cpu_s` y `costo_proveedor`, los recursos que gasto la
 *     corrida. Su rename habria hecho que el codigo dijera algo que el codigo no comprueba.
 *
 *     **Y su lectura equivocada es la mejor prueba de su propio argumento.** Si alguien que
 *     trabaja en esta base todos los dias lo entendio al reves, un tercero no tiene ninguna
 *     posibilidad. El nombre viejo era ambiguo exactamente como el decia; lo que estaba mal era
 *     el reemplazo, no el diagnostico.
 *
 * Cada rechazo trae `detalle`: que hacer para arreglarlo, en una linea, sin haber estado en esta
 * conversacion. **Un codigo cuyo unico significado vive en el chat donde se invento se publica
 * roto por mas bueno que sea el nombre.**
 */
export const RECHAZOS = {
  SIN_CONSUMO_MEDIDO: {
    dice: "no trae los recursos medidos de la corrida: un cero ausente no es un cero medido",
    detalle: "manda `consumo` con `cpu_s` (segundos de CPU) y `costo_proveedor` (lo que cobro quien presto el computo). Si la corrida fue gratis, manda 0: es distinto de no haber mirado.",
  },
  CONSUMO_MEDIDO_INCOMPLETO: {
    dice: "faltan campos de los recursos medidos que se facturan",
    detalle: "vienen algunos y faltan otros. La respuesta lista cuales en `faltan`. No se completan con cero.",
  },
  SIN_HUELLA_DE_CODIGO: {
    dice: "no se puede saber que codigo produjo esta corrida, asi que no es comparable con otra",
    detalle: "el artefacto tiene que traer el sha256 del arnes que corrio, en `meta.sealed_by.harness_sha256`.",
  },
  FECHA_NO_INDEPENDIENTE: {
    dice: "el artefacto trae su propia hora de deposito, y la fecha no puede ponerla lo que se esta midiendo",
    detalle: "quita `deposito.recibido_at` del artefacto. La hora la estampa quien recibe, y por eso vale como respaldo de un cobro.",
  },
  DURACION_IMPOSIBLE: {
    dice: "las duraciones por fase suman mas que el total declarado",
    detalle: "la suma de `consumo.fases_ms` no puede pasar `consumo.cpu_s`. La respuesta trae las dos cifras.",
  },
};

/**
 * Donde se publica la definicion de cada codigo. **En `null` mientras la pagina no exista.**
 *
 * No es un pendiente olvidado: es §1 bis. Ya nos paso publicar una API que decia «recomputa el
 * hash segun /api-docs» cuando esa pagina daba 404 — **una promesa verificable que se corta a
 * medias pide confianza en vez de darla**. Un enlace a una pagina inexistente es peor que no
 * poner enlace, asi que hasta que exista viaja el `detalle` y nada mas.
 */
export const DEFINICIONES_EN = null;

/** Lo que se factura. Un campo ausente NO se completa con cero: se rechaza. */
export const CAMPOS_CONSUMO = ["cpu_s", "costo_proveedor"];

/**
 * Donde vive la huella del codigo que corrio. **Rutas exactas y en orden de preferencia.**
 *
 * EL DEFECTO DE ESTE MODULO, encontrado el 2026-08-27 al ejercerlo por primera vez contra el
 * archivo real: rechazaba **93 de 93 corridas** con `SIN_COMPILE_SHA`. El campo `compile_sha`
 * **no existe en el archivo: cero apariciones.**
 *
 * Y la razon es mas interesante que un nombre mal elegido, que fue mi primer diagnostico.
 * `compile_sha` **si esta especificado**: es lo que emite **el Compilador**, la etapa que
 * convierte un enunciado en circuito + rival clasico. Lo que pasa es que **el Compilador
 * todavia no existe**, asi que ningun artefacto del archivo pudo traerlo nunca.
 *
 * O sea: **este modulo exigia el contrato de manana sobre los datos de ayer.** Esa clase falla
 * el 100 % por construccion, y —lo peor— **se lee como un defecto de los datos**: la salida
 * decia «93 corridas sin identificar su codigo», que suena a archivo sucio y no a guardia
 * fuera de epoca. Un guardia que valida contra una pieza no construida no encuentra cero
 * defectos: encuentra todos, y ninguno es real.
 *
 * Lo que existe, y es exactamente la cosa que el campo pretendia capturar:
 *
 *     meta.sealed_by.harness_sha256    52 corridas
 *     w6.como.harness.sha256           18
 *     w6.como.harness_sha256            8
 *
 * POR QUE VIVIO SIN VERSE, que es lo que hay que aprender y no el nombre del campo: el modulo
 * tenia **14 casos en verde** y los catorce corrian contra fijas que escribi yo, **usando el
 * nombre que invente yo**. Un self-test no puede desmentir el vocabulario de quien lo escribe;
 * solo puede hacerlo el archivo. CLAUDE.md §5 ter — modo informe contra datos reales antes de
 * escribir nada — y aqui costo un modulo entero que rechazaba el 100%.
 *
 * La regla que sale: **un guardia declara contra que epoca valida.** Si su campo lo produce
 * una pieza que no existe, no se cablea todavia — o acepta lo que hay hoy y dice hasta cuando,
 * que es lo que hace la lista de abajo.
 *
 * SIGUE RECHAZANDO SI FALTA, y el dato dice que se puede: la cobertura por mes es
 * **agosto 42/42, julio 10/51**. Lo que se produce hoy trae la huella siempre, asi que fallar
 * cerrado no retiene trabajo actual — retiene 41 corridas de julio que nadie va a re-depositar,
 * porque publicado es publicado.
 *
 * Se buscan RUTAS EXACTAS y nunca por parecido: el archivo tiene 28 `w6.que.artefacto.sha256`,
 * que es la huella de un objeto CITADO. Tomarla como propia le atribuiria a la corrida el
 * codigo de otra cosa — ver el aviso de `cavar()`.
 */
export const RUTAS_HUELLA = [
  ["meta", "sealed_by", "harness_sha256"],
  ["w6", "como", "harness", "sha256"],
  ["w6", "como", "harness_sha256"],
];

/** Lee un camino exacto. **Nunca por parecido** — un artefacto lleva adentro campos de otros
 * objetos que cita, y buscar «algo con forma de fecha» le atribuye la hora de un objeto ajeno. */
export function cavar(obj, ...ruta) {
  let cur = obj;
  for (const k of ruta) {
    if (!cur || typeof cur !== "object" || Array.isArray(cur)) return undefined;
    cur = cur[k];
  }
  return cur;
}

const ausente = (v) => v === undefined || v === null || v === "";

/**
 * Estampa una hora con subsegundo, en UTC, del reloj de quien recibe.
 * Se inyecta `ahora` para poder probarlo; en produccion es el reloj real.
 */
export function estampar(ahora = Date.now()) {
  return new Date(ahora).toISOString(); // ya trae milisegundos: 2026-08-27T00:12:34.567Z
}

/** ¿Tiene subsegundo? Es la propiedad que hace visible una hora escrita a mano. */
export function tieneSubsegundo(iso) {
  return typeof iso === "string" && /T\d{2}:\d{2}:\d{2}\.\d+/.test(iso);
}

/**
 * Recibe un resultado y lo convierte en un deposito, o lo rechaza diciendo por que.
 *
 * @param {{artefacto:object, consumo:object, ahora?:number}} ctx
 * @returns {{estado:"depositado", deposito:object} | {estado:"rechazado", codigo:string, motivo:string}}
 */
export function depositar({ artefacto, consumo, ahora = Date.now() }) {
  const no = (codigo) => ({
    estado: "rechazado", codigo,
    motivo: RECHAZOS[codigo].dice,
    detalle: RECHAZOS[codigo].detalle,
    ...(DEFINICIONES_EN ? { definicion: `${DEFINICIONES_EN}#${codigo}` } : {}),
  });

  // 1) El generador NO pone la hora. Si ya viene, es exactamente el defecto que existimos
  //    para impedir — y no se sobreescribe en silencio: se rechaza y se dice.
  if (!ausente(cavar(artefacto, "deposito", "recibido_at"))) return no("FECHA_NO_INDEPENDIENTE");

  // 2) Sin consumo no se deposita. Un cero medido y un cero ausente no son el mismo cero:
  //    el primero es una corrida gratis, el segundo es no haber mirado.
  if (!consumo || typeof consumo !== "object" || Array.isArray(consumo)) return no("SIN_CONSUMO_MEDIDO");
  const faltan = CAMPOS_CONSUMO.filter((c) => ausente(consumo[c]));
  if (faltan.length === CAMPOS_CONSUMO.length) return no("SIN_CONSUMO_MEDIDO");
  if (faltan.length) return { ...no("CONSUMO_MEDIDO_INCOMPLETO"), faltan };

  // 3) Sin la huella del codigo, dos corridas no son comparables y nadie se entera al restarlas.
  let huella_codigo, huella_bajo;
  for (const ruta of RUTAS_HUELLA) {
    const v = cavar(artefacto, ...ruta);
    if (!ausente(v)) { huella_codigo = v; huella_bajo = ruta.join("."); break; }
  }
  if (ausente(huella_codigo)) return no("SIN_HUELLA_DE_CODIGO");

  // 4) Las duraciones las declara el ejecutor —es el unico que ve sus fases— pero tienen que
  //    ser coherentes entre si. No comprueba que el trabajo ocurriera: comprueba que lo
  //    declarado no sea imposible, que es lo unico que se puede desde aqui.
  const fases = consumo.fases_ms && typeof consumo.fases_ms === "object" ? consumo.fases_ms : null;
  if (fases) {
    const suma = Object.values(fases).reduce((a, b) => a + (Number(b) || 0), 0);
    const total = Number(consumo.cpu_s) * 1000;
    if (Number.isFinite(total) && suma > total * 1.001) return { ...no("DURACION_IMPOSIBLE"), suma_ms: suma, cpu_ms: total };
  }

  const recibido_at = estampar(ahora);

  return {
    estado: "depositado",
    deposito: {
      recibido_at,                       // el unico campo que pone este modulo
      lo_pone: "el depositario, al recibir",
      alcance: "instante en que este proceso recibio el resultado; no es cuando corrio",
      huella_codigo,
      huella_bajo,                       // en cual de las rutas venia, para no re-adivinarlo
      consumo: { ...consumo, alcance: consumo.alcance ?? "declarado por el ejecutor sobre su propio trabajo" },
      // Declarado y no implicito: sin esto un lector supone que el ancla respalda el cobro.
      que_NO_prueba: "que el trabajo ocurrio. Eso lo contrasta el registro del proveedor de computo, no este campo ni el ancla.",
    },
  };
}

// ── self-test ────────────────────────────────────────────────────────────────────────────
const _esPrincipal = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (_esPrincipal && process.argv.includes("--self-test")) {
  const AHORA = Date.parse("2026-08-27T00:12:34.567Z");
  // LA FIJA AHORA SALE DEL ARCHIVO, no de mi cabeza: es la ruta que usan las 52 corridas
  // selladas. La fija anterior usaba `w6.como.compile_sha`, que no existe en ningun artefacto.
  const ART = { meta: { sealed_by: { harness_sha256: "a71f3e" } } };
  const CON = { cpu_s: 45.943, costo_proveedor: 0.0005 };

  const casos = [
    // ── deposita ──
    ["CALLA: artefacto y consumo completos", () =>
      depositar({ artefacto: ART, consumo: CON, ahora: AHORA }).estado === "depositado"],

    ["la hora la pone ESTE modulo, no el artefacto", () =>
      depositar({ artefacto: ART, consumo: CON, ahora: AHORA }).deposito.recibido_at === "2026-08-27T00:12:34.567Z"],

    // LA DEFENSA DE CONSTRUCCION: con subsegundo, una hora escrita a mano se ve sola.
    ["estampa con subsegundo — nadie escribe .567 a mano", () =>
      tieneSubsegundo(depositar({ artefacto: ART, consumo: CON, ahora: AHORA }).deposito.recibido_at)],

    ["el consumo viaja DENTRO del deposito, no en una tabla aparte", () =>
      depositar({ artefacto: ART, consumo: CON, ahora: AHORA }).deposito.consumo.cpu_s === 45.943],

    ["declara lo que NO prueba, en vez de dejarlo implicito", () =>
      /no prueba|que_NO_prueba/.test(JSON.stringify(depositar({ artefacto: ART, consumo: CON, ahora: AHORA }).deposito))],

    // ── rechaza ──
    // EL DEFECTO REAL: el generador poniendo la hora. Es por lo que existe este modulo.
    ["grita: el artefacto ya trae hora de deposito", () =>
      depositar({ artefacto: { ...ART, deposito: { recibido_at: "2026-08-21T20:00:00Z" } }, consumo: CON, ahora: AHORA })
        .codigo === "FECHA_NO_INDEPENDIENTE"],

    ["grita: sin consumo no se deposita", () =>
      depositar({ artefacto: ART, consumo: null, ahora: AHORA }).codigo === "SIN_CONSUMO_MEDIDO"],

    ["grita: consumo a medias es distinto de consumo ausente", () => {
      const r = depositar({ artefacto: ART, consumo: { cpu_s: 45.9 }, ahora: AHORA });
      return r.codigo === "CONSUMO_MEDIDO_INCOMPLETO" && r.faltan[0] === "costo_proveedor";
    }],

    ["grita: sin huella del codigo, dos corridas no son comparables", () =>
      depositar({ artefacto: {}, consumo: CON, ahora: AHORA }).codigo === "SIN_HUELLA_DE_CODIGO"],

    ["grita: las fases suman mas de lo que dice el total", () =>
      depositar({ artefacto: ART, consumo: { ...CON, cpu_s: 1, fases_ms: { a: 900, b: 900 } }, ahora: AHORA })
        .codigo === "DURACION_IMPOSIBLE"],

    // ── el borde que mas se confunde ──
    // Un cero MEDIDO es una corrida gratis y es legitimo. Un cero AUSENTE es no haber mirado.
    ["CALLA: un cero MEDIDO se deposita — es distinto de un cero ausente", () =>
      depositar({ artefacto: ART, consumo: { cpu_s: 0, costo_proveedor: 0 }, ahora: AHORA }).estado === "depositado"],

    ["CALLA: fases que suman justo el total", () =>
      depositar({ artefacto: ART, consumo: { ...CON, cpu_s: 2, fases_ms: { a: 1000, b: 1000 } }, ahora: AHORA })
        .estado === "depositado"],

    // ── lee por ruta, no por parecido ──
    ["CALLA: un compile_sha de OTRO objeto citado adentro no se toma como propio", () =>
      depositar({ artefacto: { w6: { como: { procedencia: [{ compile_sha: "ajeno" }] } } }, consumo: CON, ahora: AHORA })
        .codigo === "SIN_HUELLA_DE_CODIGO"],

    // ── mutacion ──
    // ── las tres rutas reales del archivo ──
    // Las tres salen de contar el archivo, no de suponer. Si el dia de manana el generador
    // cambia de ruta otra vez, aqui se ve cual falta.
    ["acepta la ruta de las 52 selladas: meta.sealed_by.harness_sha256", () =>
      depositar({ artefacto: { meta: { sealed_by: { harness_sha256: "aa" } } }, consumo: CON, ahora: AHORA }).estado === "depositado"],

    ["acepta la de 18: w6.como.harness.sha256", () =>
      depositar({ artefacto: { w6: { como: { harness: { sha256: "bb" } } } }, consumo: CON, ahora: AHORA }).estado === "depositado"],

    ["acepta la de 8: w6.como.harness_sha256", () =>
      depositar({ artefacto: { w6: { como: { harness_sha256: "cc" } } } , consumo: CON, ahora: AHORA }).estado === "depositado"],

    ["dice bajo que ruta la encontro, para no re-adivinarlo despues", () => {
      const r = depositar({ artefacto: { w6: { como: { harness_sha256: "cc" } } }, consumo: CON, ahora: AHORA });
      return r.deposito.huella_bajo === "w6.como.harness_sha256";
    }],

    // EL CASO QUE COSTO EL MODULO: el nombre que invente yo no esta en ningun artefacto.
    ["grita: `compile_sha` NO es la huella — no existe en el archivo", () =>
      depositar({ artefacto: { w6: { como: { compile_sha: "a71f3e" } } }, consumo: CON, ahora: AHORA }).codigo === "SIN_HUELLA_DE_CODIGO"],

    // MUTACION: si se buscara «algo con forma de sha» en vez de rutas exactas, las 28 corridas
    // que citan otro objeto por sha le atribuirian a la corrida el codigo de una cosa ajena.
    ["MUTACION: la huella de un objeto CITADO no se toma como propia", () =>
      depositar({ artefacto: { w6: { que: { artefacto: { sha256: "de-otro" } } } }, consumo: CON, ahora: AHORA }).codigo === "SIN_HUELLA_DE_CODIGO"],

    ["MUTACION: sin subsegundo, una hora redonda escrita a mano seria indistinguible", () =>
      tieneSubsegundo("2026-08-27T00:12:34.567Z") === true && tieneSubsegundo("2026-08-21T20:00:00Z") === false],
  ];

  let fallos = 0;
  for (const [nombre, fn] of casos) {
    let paso; try { paso = fn(); } catch { paso = false; }
    console.log(`${paso ? "ok   " : "FALLA"}  ${nombre}`);
    if (!paso) fallos++;
  }
  console.log(`\n[depositario] self-test: ${casos.length - fallos} de ${casos.length} pasaron.`);
  process.exit(fallos ? 1 : 0);
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────
if (_esPrincipal && !process.argv.includes("--self-test")) {
  const art = process.argv[2];
  const iCon = process.argv.indexOf("--consumo");
  const con = iCon >= 0 ? process.argv[iCon + 1] : null;

  if (!art || !existsSync(art)) { console.error(`[depositario] NO SE PUDO: falta el artefacto (${art ?? "sin argumento"}).`); process.exit(2); }
  if (!con || !existsSync(con)) { console.error("[depositario] NO SE PUDO: falta --consumo <archivo.json>."); process.exit(2); }

  let artefacto, consumo;
  try { artefacto = JSON.parse(readFileSync(art, "utf8")); consumo = JSON.parse(readFileSync(con, "utf8")); }
  catch (e) { console.error(`[depositario] NO SE PUDO: JSON ilegible. ${String(e).split("\n")[0]}`); process.exit(2); }

  const r = depositar({ artefacto, consumo });
  if (r.estado === "rechazado") {
    console.error(`[depositario] RECHAZADO ${r.codigo}: ${r.motivo}`);
    console.error(`    que hacer: ${r.detalle}`);
    if (r.faltan) console.error(`    faltan: ${r.faltan.join(", ")}`);
    process.exit(1);
  }
  process.stdout.write(JSON.stringify(r.deposito, null, 2) + "\n");
  console.error(`[depositario] depositado · ${r.deposito.recibido_at} · codigo ${String(r.deposito.huella_codigo).slice(0, 12)} (${r.deposito.huella_bajo})`);
}
