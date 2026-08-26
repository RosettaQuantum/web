#!/usr/bin/env node
/**
 * Una fecha copiada del nombre del archivo no es una medicion.
 *
 * EL DEFECTO (medido el 2026-08-26 sobre el repo `evidence`). Los artefactos de corrida
 * declaran cuando se archivaron y cuando se sellaron. En una minoria de ellos esa fecha **no
 * la puso un reloj: esta copiada de la marca del propio nombre del archivo**.
 *
 *   archived_at   92 presentes · 19 copiadas del nombre · 73 con reloj real
 *   sealed_at     52 presentes · 22 copiadas del nombre · 30 con reloj real
 *   lo que deposita el CI      55 artefactos · 0 con ningun campo de tiempo
 *
 * OJO CON ESAS CIFRAS, porque su primera version estaba al reves. Una medicion que comparaba
 * solo el minuto daba «73 de 92 copiadas»; el numero correcto es 19, y los otros 54 son
 * relojes reales que caen en el mismo minuto que el nombre **porque el nombre se genera del
 * mismo evento**. Dos sesiones lo confirmaron por separado y coincidieron —una con
 * tolerancia de 60 s, la otra comparando 13 caracteres— porque **compartian la suposicion
 * equivocada, no porque el dato fuera bueno.** Dos mediciones que se apoyan en la misma
 * premisa no se verifican entre si.
 *
 * Y LA CONCLUSION QUE SOBREVIVE, que es lo que importa: **el 20% contaminado es
 * indistinguible del 80% bueno sin este chequeo.** Un campo correcto cuatro de cada cinco
 * veces no es una base de facturacion: es una disputa esperando fecha.
 *
 * DE DONDE SALEN, medido despues: los 41 campos-copia caen **todos** en hora o media hora
 * exacta —34 en `:00`, 7 en `:30`, ninguno en un minuto arbitrario—. Eso invierte la causa
 * que este guardia suponia. **No es que alguien copie el nombre al campo: es que una persona
 * declara una hora redonda, y de ese mismo valor salen el nombre Y el campo.** No hay copia
 * de uno a otro; hay un origen comun, y el origen es alguien redondeando.
 *
 * Lo que hay que cerrar, entonces, no es la copia sino la entrada: **una hora nominal
 * declarada por una persona no puede entrar al artefacto en el campo donde va una
 * observacion.** Y hay una defensa de construccion, mas barata que cualquier chequeo: si el
 * Depositario estampa con **precision de subsegundo**, una hora escrita a mano queda visible
 * sola — nadie escribe `.537065` a mano.
 *
 * El caso que lo cerro: un artefacto declara `archived_at: 2026-08-21T20:00:00Z` y su primer
 * y unico commit es del 19 de agosto. Un archivo commiteado una sola vez no puede archivarse
 * dos dias despues. La fecha es la marca del nombre, `__20260821T2000Z__`, copiada adentro.
 *
 * POR QUE IMPORTA MAS QUE UNA HIGIENE. Ese mismo dia, dos sesiones produjeron **cuatro**
 * respuestas distintas a «cuanto tardamos en publicar una corrida» —14 h, 7 min, 7,5 h y
 * 2,4 h— y las cuatro salian de este campo. Es la §5 quater en su forma mas cara: un valor
 * que existe, esta bien formado, y no mide nada. Con precio por consumo deja de ser una
 * curiosidad: **es la base del cobro**, y un cliente que dispute encontraria que la marca de
 * tiempo se la puso el mismo proceso que le esta cobrando.
 *
 * QUE VIGILA, Y CON QUE FILO. **Solo bloquea lo que puede probar.**
 *
 *   - COPIADA DEL NOMBRE  -> bloquea. Es demostrable byte a byte y no tiene falso positivo:
 *                            si el valor se deriva del nombre, no vino de un reloj.
 *   - HORA EXACTA         -> reporta, NO bloquea. Un reloj real puede caer en :00:00 por
 *                            casualidad, y un falso positivo aca retiene trabajo bueno.
 *   - AUSENTE             -> bloquea solo en modo deposito. El archivo historico tiene 55
 *                            artefactos sin fecha y no se puede reescribir: publicado es
 *                            publicado. Lo que se exige es que **lo nuevo** la traiga.
 *
 * SU PUNTO CIEGO, declarado: no puede distinguir un reloj real de un valor inventado que no
 * coincida con el nombre. Si alguien escribe una fecha plausible a mano, esto la aprueba. Lo
 * unico que cierra ese hueco es que el reloj lo ponga quien recibe —el Depositario— y no
 * quien produce. Este guardia detecta la forma conocida; la arquitectura elimina la clase.
 *
 * Uso:
 *   node scripts/check-reloj-etiqueta.mjs --self-test
 *   node scripts/check-reloj-etiqueta.mjs --archivo <dir>     # audita, reporta, no bloquea
 *   node scripts/check-reloj-etiqueta.mjs --deposito <dir>    # exige reloj, bloquea
 */
/** Quien actua esta senal, y que hace al recibirla. Declarado aqui, no en un documento aparte. */
export const CONSUMIDOR = {
  quien: "sesion CTO",
  hace: "arregla el generador para que la hora la ponga el depositario, no el nombre del archivo",
};

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, basename } from "node:path";

/**
 * Campos que declaran un instante y que, por tanto, pueden ser una etiqueta disfrazada.
 *
 * RUTAS FIJAS, Y ES A PROPOSITO. La tentacion es barrer el JSON entero buscando cualquier
 * campo que parezca una fecha. **No se puede: un artefacto lleva adentro sellos de OTROS
 * objetos que cita.** Medido: 52 artefactos traen `/meta/sealed_at` —el suyo— y uno trae
 * ademas `/w6/como/prereg/sealed_at`, que es el sello del pre-registro al que se refiere.
 * Un barrido general le atribuiria al artefacto la hora de un objeto ajeno.
 *
 * Es la misma forma que el `utc` dentro de `outcome`: **un instrumento que busca por parecido
 * encuentra lo que no es.** Aqui la defensa es no buscar por parecido sino por direccion.
 */
export const CAMPOS_RELOJ = [
  ["w6", "cuando", "archived_at"],
  ["w6", "cuando", "started_at"],
  ["meta", "sealed_at"],
  ["deposito", "recibido_at"],
];

/**
 * La marca de tiempo que lleva el NOMBRE del archivo, si la lleva.
 * Formato de la casa: `__20260821T2000Z__`.
 *
 * @returns {string|null} los 13 digitos significativos `AAAAMMDDTHHMM`, o null
 */
export function marcaDelNombre(archivo) {
  const m = /__(\d{8}T\d{4})Z__/.exec(basename(archivo ?? ""));
  return m ? m[1] : null;
}

/** Normaliza un instante a `AAAAMMDDTHHMM` para poder compararlo con la marca del nombre. */
export function aClave(valor) {
  if (typeof valor !== "string") return null;
  const s = valor.replace(/[-:]/g, "");
  const m = /^(\d{8}T\d{4})/.exec(s);
  return m ? m[1] : null;
}

/**
 * ¿Este valor salio del nombre del archivo?
 *
 * DOS CONDICIONES, y la segunda es la que hace al guardia servir. La primera version solo
 * comparaba el minuto y **marcaba 83 de 93 artefactos, la mayoria sanos**: un reloj real cae
 * en el mismo minuto que el nombre **porque el nombre se genera del mismo evento**. Ese
 * falso positivo habria retenido casi todo el archivo.
 *
 * El discriminador verdadero: **la marca del nombre no lleva segundos.** Entonces un valor
 * copiado de ella tiene, necesariamente, segundos en `00` y ninguna fraccion. Un reloj real
 * trae `:48` o `.537065`. Con las dos condiciones juntas el conteo pasa de 83 a 19, y los 19
 * son los de verdad —incluido el que declara haberse archivado dos dias despues de su unico
 * commit—.
 *
 * Esta correccion la produjo el propio guardia al correrse contra el archivo real (§5 quater
 * regla 5): pasar el self-test no probaba nada; ejercerlo contra el terreno conocido, si.
 */
export function esCopiaDelNombre({ archivo, valor }) {
  const marca = marcaDelNombre(archivo);
  const clave = aClave(valor);
  if (!marca || !clave || marca !== clave) return false;

  // Mismo minuto no basta. Un reloj real deja segundos o fraccion; una copia no puede.
  const m = /T\d{2}:\d{2}:(\d{2})(?:\.(\d+))?/.exec(valor);
  if (!m) return false;                                  // sin segundos legibles: no se afirma
  const segundos = m[1] !== "00";
  const fraccion = Boolean(m[2] && Number(m[2]) !== 0);
  return !segundos && !fraccion;
}

/** Una hora con minutos Y segundos en cero. Senal, no prueba. */
export function esHoraExacta(valor) {
  return typeof valor === "string" && /T\d{2}:00:00(\b|[.Z+-])/.test(valor);
}

/** Lee un camino anidado sin reventar si falta un tramo. */
export function cavar(obj, ruta) {
  let cur = obj;
  for (const k of ruta) {
    if (!cur || typeof cur !== "object" || Array.isArray(cur)) return undefined;
    cur = cur[k];
  }
  return cur;
}

/**
 * Clasifica UN artefacto.
 *
 * @param {{archivo:string, datos:object, modo:"archivo"|"deposito"}} ctx
 * @returns {{archivo:string, etiquetas:{campo:string,valor:string}[], exactas:string[],
 *            relojes:number, veredicto:"ok"|"etiqueta"|"sin_reloj"}}
 */
export function evaluarArtefacto({ archivo, datos, modo = "archivo" }) {
  const etiquetas = [], exactas = [];
  let relojes = 0;

  for (const ruta of CAMPOS_RELOJ) {
    const valor = cavar(datos, ruta);
    if (typeof valor !== "string" || !aClave(valor)) continue;
    relojes++;
    const campo = ruta.join(".");
    if (esCopiaDelNombre({ archivo, valor })) etiquetas.push({ campo, valor });
    else if (esHoraExacta(valor)) exactas.push(campo);
  }

  let veredicto = "ok";
  if (etiquetas.length) veredicto = "etiqueta";
  else if (relojes === 0 && modo === "deposito") veredicto = "sin_reloj";

  return { archivo, etiquetas, exactas, relojes, veredicto };
}

/**
 * ¿Pasa el lote?
 *
 * Reporta SIEMPRE el denominador (§5 bis 1): cuantos vio, cuantos tenian reloj, cuantos
 * saltó. Un total sin denominador no es un resultado.
 */
export function evaluarLote({ artefactos, modo = "archivo" }) {
  const res = artefactos.map((a) => evaluarArtefacto({ ...a, modo }));
  const etiqueta = res.filter((r) => r.veredicto === "etiqueta");
  const sinReloj = res.filter((r) => r.veredicto === "sin_reloj");
  const exactas = res.filter((r) => r.veredicto === "ok" && r.exactas.length);

  return {
    vistos: res.length,
    conReloj: res.filter((r) => r.relojes > 0).length,
    etiqueta, sinReloj, exactas,
    // El modo archivo AUDITA: informa y no detiene. Lo publicado es publicado y no se
    // reescribe; lo que se exige es que lo nuevo no repita la forma.
    bloquea: modo === "deposito" && (etiqueta.length > 0 || sinReloj.length > 0),
  };
}

// ── self-test ────────────────────────────────────────────────────────────────────────────
if (process.argv.includes("--self-test")) {
  // El defecto REAL, con sus valores reales. No un ejemplo inventado (§2).
  const REAL = {
    archivo: "RosettaQ__RUN__RQ-EXP-HSBC-ATAQUE-001__20260821T2000Z__replicacion-adversarial.json",
    datos: { w6: { cuando: { archived_at: "2026-08-21T20:00:00Z" } } },
  };

  const casos = [
    // ── grita ──
    ["grita: el caso real medido — archived_at es la marca del nombre", () =>
      evaluarArtefacto({ ...REAL }).veredicto === "etiqueta"],

    ["grita: dice QUE campo, no solo que hay un problema", () =>
      evaluarArtefacto({ ...REAL }).etiquetas[0].campo === "w6.cuando.archived_at"],

    ["grita: sealed_at copiado del nombre, en otra rama del JSON", () =>
      evaluarArtefacto({
        archivo: "RosettaQ__RUN__X__20260819T2200Z__y.json",
        datos: { meta: { sealed_at: "2026-08-19T22:00:00Z" } },
      }).veredicto === "etiqueta"],

    ["grita: en modo deposito, un artefacto SIN ningun reloj no entra", () =>
      evaluarArtefacto({ archivo: "a.json", datos: { resultado: 1 }, modo: "deposito" })
        .veredicto === "sin_reloj"],

    // ── calla ── (la mitad que falta en casi todo guardia, §4 bis)
    // EL FALSO POSITIVO REAL que produjo la primera version de este guardia. Marcaba 83 de
    // 93 porque comparaba solo el minuto. Este caso salio del archivo, no de la imaginacion.
    ["CALLA: reloj real EN EL MISMO MINUTO que el nombre, con microsegundos", () =>
      evaluarArtefacto({
        archivo: "RosettaQ__RUN__EXP-0007-002__20260724T2154Z__ctqw.json",
        datos: { w6: { cuando: { archived_at: "2026-07-24T21:54:48.537065+00:00" } } },
      }).veredicto === "ok"],

    ["CALLA: mismo minuto, segundos distintos de cero, sin fraccion", () =>
      evaluarArtefacto({
        archivo: "RosettaQ__RUN__X__20260724T2154Z__y.json",
        datos: { w6: { cuando: { archived_at: "2026-07-24T21:54:48Z" } } },
      }).veredicto === "ok"],

    ["grita igual: mismo minuto, segundos en cero, sin fraccion — eso SI es copia", () =>
      evaluarArtefacto({
        archivo: "RosettaQ__RUN__X__20260724T2154Z__y.json",
        datos: { w6: { cuando: { archived_at: "2026-07-24T21:54:00Z" } } },
      }).veredicto === "etiqueta"],

    ["CALLA: reloj real, cercano al nombre pero NO identico", () =>
      evaluarArtefacto({
        archivo: "RosettaQ__RUN__X__20260821T2000Z__y.json",
        datos: { w6: { cuando: { archived_at: "2026-08-21T20:07:33Z" } } },
      }).veredicto === "ok"],

    ["CALLA: hora exacta por casualidad NO bloquea — solo se reporta", () => {
      const r = evaluarArtefacto({
        archivo: "RosettaQ__RUN__X__20260821T1400Z__y.json",
        datos: { w6: { cuando: { archived_at: "2026-08-21T20:00:00Z" } } },
      });
      return r.veredicto === "ok" && r.exactas.length === 1;
    }],

    ["CALLA: en modo archivo, un artefacto sin reloj NO bloquea (lo publicado no se reescribe)", () =>
      evaluarArtefacto({ archivo: "a.json", datos: { resultado: 1 }, modo: "archivo" })
        .veredicto === "ok"],

    ["CALLA: un nombre SIN marca de tiempo no puede producir una copia", () =>
      evaluarArtefacto({
        archivo: "resultado-suelto.json",
        datos: { w6: { cuando: { archived_at: "2026-08-21T20:00:00Z" } } },
      }).etiquetas.length === 0],

    // EL PARADOJICO: el defecto DESCRITO en el artefacto y AUSENTE de los campos de reloj.
    // Si grita aca, esta leyendo prosa en vez de mirar los campos que le tocan.
    ["CALLA: el defecto explicado en un campo de texto, con los relojes sanos", () =>
      evaluarArtefacto({
        archivo: "RosettaQ__RUN__X__20260821T2000Z__y.json",
        datos: {
          nota: "OJO: no copiar 2026-08-21T20:00:00Z desde el nombre del archivo",
          w6: { cuando: { archived_at: "2026-08-21T20:07:33Z" } },
        },
      }).veredicto === "ok"],

    // ── el lote, con denominador ──
    ["el lote reporta denominador y no lo maquilla", () => {
      const r = evaluarLote({
        artefactos: [REAL, { archivo: "b.json", datos: { meta: { sealed_at: "2026-08-01T03:14:09Z" } } }],
        modo: "archivo",
      });
      return r.vistos === 2 && r.conReloj === 2 && r.etiqueta.length === 1 && r.bloquea === false;
    }],

    ["modo deposito SI bloquea lo que modo archivo solo reporta", () =>
      evaluarLote({ artefactos: [REAL], modo: "deposito" }).bloquea === true],

    // ── mutacion: si le quitas la comparacion con el nombre, el caso real tiene que pasar ──
    // Esto es lo que convierte al guardia en algo que caza y no en una linea que pasa
    // siempre. Se prueba invocando la pieza pura con el filtro desactivado.
    ["MUTACION 1: sin comparar contra el nombre, el defecto real queda invisible", () => {
      const conFiltro = esCopiaDelNombre({ archivo: REAL.archivo, valor: "2026-08-21T20:00:00Z" });
      const sinFiltro = esCopiaDelNombre({ archivo: "", valor: "2026-08-21T20:00:00Z" });
      return conFiltro === true && sinFiltro === false;
    }],

    // MUTACION 2, la que faltaba y costo el falso positivo: si SOLO se compara el minuto,
    // un reloj real del mismo minuto se marca como copia. Esta prueba fija esa distincion.
    ["MUTACION 2: la condicion de segundos es la que separa copia de reloj real", () => {
      const copia = esCopiaDelNombre({ archivo: "a__20260724T2154Z__b.json", valor: "2026-07-24T21:54:00Z" });
      const real  = esCopiaDelNombre({ archivo: "a__20260724T2154Z__b.json", valor: "2026-07-24T21:54:48.537065+00:00" });
      return copia === true && real === false;
    }],
  ];

  let fallos = 0;
  for (const [nombre, fn] of casos) {
    let paso; try { paso = fn(); } catch { paso = false; }
    console.log(`${paso ? "ok   " : "FALLA"}  ${nombre}`);
    if (!paso) fallos++;
  }
  console.log(`\n[reloj-etiqueta] self-test: ${casos.length - fallos} de ${casos.length} pasaron.`);
  process.exit(fallos ? 1 : 0);
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────
const iDir = process.argv.findIndex((a) => a === "--archivo" || a === "--deposito");
if (iDir >= 0) {
  const modo = process.argv[iDir] === "--deposito" ? "deposito" : "archivo";
  const raiz = process.argv[iDir + 1];

  if (!raiz || !existsSync(raiz)) {
    console.error(`[reloj-etiqueta] NO SE PUDO COMPROBAR: falta el directorio (${raiz ?? "sin argumento"}).`);
    console.error("[reloj-etiqueta] Sin artefactos que mirar la respuesta es 'no se sabe', no 'ok'.");
    process.exit(2);
  }

  const artefactos = [];
  (function recorrer(d) {
    for (const e of readdirSync(d)) {
      const p = join(d, e);
      if (statSync(p).isDirectory()) recorrer(p);
      else if (e.endsWith(".json")) {
        try {
          const datos = JSON.parse(readFileSync(p, "utf8"));
          if (datos && typeof datos === "object" && !Array.isArray(datos)) artefactos.push({ archivo: p, datos });
        } catch { /* un JSON ilegible es asunto de otro guardia */ }
      }
    }
  })(raiz);

  const r = evaluarLote({ artefactos, modo });

  console.log(`[reloj-etiqueta] modo ${modo} · ${r.vistos} artefactos · ${r.conReloj} con algun campo de reloj`);
  console.log(`   copiadas del nombre : ${r.etiqueta.length}`);
  console.log(`   sin ningun reloj    : ${artefactos.length - r.conReloj}`);
  console.log(`   en hora exacta      : ${r.exactas.length}   (se reporta, no bloquea)`);

  for (const e of r.etiqueta.slice(0, 8)) {
    console.log(`   ETIQUETA  ${e.etiquetas.map((x) => `${x.campo}=${x.valor}`).join(" ")}  ${basename(e.archivo)}`);
  }
  if (r.etiqueta.length > 8) console.log(`   … y ${r.etiqueta.length - 8} mas`);

  if (r.bloquea) {
    console.error("\n[reloj-etiqueta] BLOQUEADO: hay fechas que salieron del nombre del archivo, no de un reloj.");
    console.error("[reloj-etiqueta] La hora la pone quien recibe (el Depositario), nunca quien produce.");
    process.exit(1);
  }
  console.log(`\n[reloj-etiqueta] ${modo === "archivo" ? "auditoria completa — no bloquea por diseno" : "sin defectos"}.`);
}
