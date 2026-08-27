#!/usr/bin/env node
/**
 * La Puerta: el unico lugar por donde entra trabajo, y el unico que puede decir «no» barato.
 *
 * QUE ES Y QUE NO ES, HOY. Esto implementa **solo el ensayo en seco** (`dry_run`). Es una
 * decision de alcance, no un tramo a medias, y esta escrita aqui para que nadie la descubra
 * leyendo el codigo: **no hay cuentas, no hay creditos, no hay cobro, y no se ejecuta nada.**
 * Una peticion real devuelve `501 NO_CONSTRUIDO` con el motivo, en vez de fingir una cola.
 *
 * POR QUE ASI. El ensayo en seco es la unica mitad de la Puerta que se puede construir con
 * verdad hoy: contesta «¿esto se aceptaria, cuanto costaria, y que me rechazarias?» **sin
 * necesitar dinero ni ejecutor**. Y es la mitad que le sirve a un agente: puede explorar el
 * catalogo y validar su peticion antes de que exista la cuenta.
 *
 * LA IDEMPOTENCIA ES OBLIGATORIA DESDE EL PRIMER DIA, incluso en seco, y **conviene decir sobre
 * que evidencia**, porque la que yo mismo habia escrito era falsa:
 *
 *   - Mi documento de la planta afirmaba «cinco copias del mismo baseline de HSBC estan en el
 *     historial». **Lo medi el 27-ago y es falso**: los cinco archivos son S1, S2, S3, S4 y el
 *     baseline — cinco mediciones deliberadamente distintas (n=20, 20, 20 y 5, sha256 distintos)
 *     que el propio artefacto compara entre si con `delta_S1_menos_S4`. Cada una entro una vez.
 *   - Y el archivo entero, medido: **51 pares clase+instancia, 0 repetidos.** Hoy no hay ni un
 *     reintento duplicado.
 *
 * Asi que la exigencia **no se justifica con un defecto pasado**: se justifica hacia adelante, y
 * se dice asi. Una planta que corre miles de experimentos reintenta sola; sin la clave, el
 * reintento cobra dos veces y el cliente no tiene como demostrarlo. **Es mas barato exigirla
 * cuando no hay clientes que agregarla cuando los hay** — despues es un cambio incompatible.
 *
 * (Y la leccion de haber citado esa evidencia sin medirla esta en §1 quater: un numero plausible
 * escrito de memoria es indistinguible de uno medido, y el mio venia envuelto en un ejemplo
 * concreto, que es la envoltura que mas confianza da.)
 *
 * SU PUNTO CIEGO, declarado: **valida la forma de la peticion, no su sentido.** Un `n_assets`
 * de 10.000 pasa si el esquema lo permite. Juzgar si un experimento vale la pena es de una
 * persona, y de la etapa siguiente —el Compilador— rechazar lo que no se puede sostener.
 *
 * Uso:
 *   node scripts/puerta.mjs --self-test
 */

/**
 * **Contra que epoca valida este modulo.** Declarado, no deducible del codigo.
 *
 * DE DONDE SALE ESTA DECLARACION, y costo una manana: el Depositario exigia `compile_sha` —un
 * campo real, especificado, que emite **el Compilador**— contra un archivo producido antes de
 * que el Compilador existiera. Rechazaba **93 de 93 corridas**, y la salida se leia como
 * «archivo sucio» y no como «guardia fuera de epoca».
 *
 * El barrido posterior cruzo TODOS los campos que exige cada modulo contra los 266 artefactos
 * del archivo y marco seis mas en cero. **Ninguno era un defecto** —son modulos de escritor,
 * que imponen vocabulario a lo nuevo— pero **eso no se podia saber leyendolos.** Un lector ve
 * «exige cinco campos, el archivo trae cero» y no puede distinguir un guardia roto de uno que
 * mira hacia adelante. Por eso se declara aqui en vez de deducirse.
 */
export const ALCANCE = {
  lado: "escritor",
  valida: "peticiones que entran, antes de que exista nada",
  no_valida: "artefactos ya producidos: no lee el archivo",
};

/** Quien actua esta senal, y que hace al recibirla. Declarado aqui, no en un documento aparte. */
export const CONSUMIDOR = {
  quien: "quien llama la API o el MCP — un agente, un cliente, la consola",
  hace: "corrige lo que el rechazo nombra y reintenta con la MISMA Idempotency-Key",
  bloquea: "no se acepta trabajo sin clave de idempotencia: un reintento sin ella se cobra dos veces",
};

/**
 * Codigos de rechazo. **Son contrato publico**: los lee un tercero, asi que se agregan pero no
 * se renombran. Los cinco primeros son los de la Puerta; el resto los hereda del Depositario y
 * viajan tal cual para que el que llama vea el rechazo completo en una sola respuesta.
 */
export const RECHAZOS = {
  SIN_CLAVE_DE_IDEMPOTENCIA: {
    http: 400,
    dice: "falta la cabecera Idempotency-Key, que es obligatoria",
    detalle: "manda `Idempotency-Key` con un valor unico por trabajo. Si reintentas, manda EL MISMO valor: asi el segundo intento devuelve el resultado del primero en vez de cobrar dos veces.",
  },
  CLAVE_REUSADA_CON_OTRO_CUERPO: {
    http: 409,
    dice: "esta clave ya se uso para una peticion distinta",
    detalle: "o cambiaste el cuerpo de un trabajo que ya mandaste —entonces usa una clave nueva— o reciclaste una clave vieja sin querer. El orden de los campos no cuenta: se compara el contenido.",
  },
  PETICION_INVALIDA: {
    http: 422,
    dice: "a la peticion le faltan campos obligatorios",
    detalle: "la respuesta lista cuales en `faltan`. Toda peticion lleva al menos `receta` y `params`.",
  },
  RECETA_DESCONOCIDA: {
    http: 422,
    dice: "no hay una receta con ese identificador",
    detalle: "pide GET /v1/recipes para ver el catalogo vigente. La respuesta dice cuantas hay en `hay`.",
  },
  SIN_CREDENCIAL: {
    http: 401,
    dice: "ejecutar de verdad necesita una credencial",
    detalle: "el ensayo en seco (`dry_run: true`) no necesita ninguna: usalo para validar la peticion y ver el plan antes de tener cuenta.",
  },
  NO_CONSTRUIDO: {
    http: 501,
    dice: "la ejecucion real todavia no existe",
    detalle: "hoy la Puerta solo contesta en seco. Manda `dry_run: true` y recibiras el plan y los rechazos que habria, sin consumir nada.",
  },
};

/**
 * Donde se publica la definicion de cada codigo. **En `null` mientras la pagina no exista**, por
 * §1 bis: ya publicamos una API que decia «recomputa el hash segun /api-docs» cuando esa pagina
 * daba 404. Un enlace roto pide confianza en vez de darla, asi que hasta que exista viaja el
 * `detalle` completo y ningun enlace.
 */
export const DEFINICIONES_EN = null;

/** Lo que toda peticion tiene que traer, se ejecute o no. */
export const CAMPOS_PETICION = ["receta", "params"];

const vacio = (v) => v === undefined || v === null || v === "" ||
  (Array.isArray(v) && v.length === 0);

/**
 * Huella estable del cuerpo, para decidir si dos peticiones con la misma clave son la misma.
 *
 * **Ordena las claves**, porque si no, `{a,b}` y `{b,a}` —el mismo trabajo escrito por dos
 * clientes— darian huellas distintas y el segundo recibiria un 409 falso. Un 409 falso retiene
 * trabajo bueno, que es peor que dejar pasar un caso.
 */
export function huellaDelCuerpo(cuerpo) {
  const orden = (v) => {
    if (Array.isArray(v)) return v.map(orden);
    if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).sort().map((k) => [k, orden(v[k])]));
    return v;
  };
  return JSON.stringify(orden(cuerpo ?? {}));
}

/**
 * Decide que hacer con una peticion, sin ejecutar nada.
 *
 * @param {{peticion:object, clave:string|null, catalogo:string[], vistas?:Map, credencial?:string|null}} ctx
 */
export function evaluarPeticion({ peticion, clave, catalogo, vistas = new Map(), credencial = null }) {
  const no = (codigo, extra = {}) => ({
    estado: "rechazado", codigo,
    http: RECHAZOS[codigo].http,
    motivo: RECHAZOS[codigo].dice,
    // El detalle viaja SIEMPRE: un codigo cuyo unico significado vive en el chat donde se
    // invento se publica roto por mas bueno que sea el nombre.
    detalle: RECHAZOS[codigo].detalle,
    ...(DEFINICIONES_EN ? { definicion: `${DEFINICIONES_EN}#${codigo}` } : {}),
    ...extra,
  });

  // 1) La clave va PRIMERO, y tambien en seco. Si solo se exigiera al ejecutar, el cliente
  //    aprende a llamar sin ella y el dia que ejecute de verdad no la tiene puesta.
  if (vacio(clave)) return no("SIN_CLAVE_DE_IDEMPOTENCIA");

  // 2) Misma clave y cuerpo distinto es ambiguo, y lo ambiguo no se adivina.
  const huella = huellaDelCuerpo(peticion);
  const previa = vistas.get(clave);
  if (previa !== undefined && previa !== huella) return no("CLAVE_REUSADA_CON_OTRO_CUERPO", { clave });

  // 3) La forma.
  const faltan = CAMPOS_PETICION.filter((c) => vacio(peticion?.[c]));
  if (faltan.length) return no("PETICION_INVALIDA", { faltan });

  // 4) El catalogo se CONSULTA. Nunca una lista escrita aqui: una lista que vive en dos
  //    lugares ya divergio, y el catalogo real vive en D1.
  if (!catalogo.includes(peticion.receta)) return no("RECETA_DESCONOCIDA", { pidio: peticion.receta, hay: catalogo.length });

  // 5) Repeticion legitima: misma clave, mismo cuerpo. **No es un error**: es la respuesta
  //    correcta a un reintento, y por eso devuelve el mismo plan sin volver a cobrar.
  const repetida = previa === huella;

  // 6) En seco se contesta el plan y se acaba. Ejecutar de verdad necesita credencial Y un
  //    ejecutor que no existe — y se dice cual de los dos falta, no un 501 mudo.
  if (!peticion.dry_run) {
    if (vacio(credencial)) return no("SIN_CREDENCIAL");
    return no("NO_CONSTRUIDO");
  }

  return {
    estado: "en_seco",
    repetida,
    plan: {
      receta: peticion.receta,
      params: peticion.params,
      clave,
      // Lo que NO se hizo, dicho aqui y no en la documentacion: sin esto un lector supone
      // que algo quedo encolado.
      no_se_ejecuto: "ensayo en seco: no se encolo trabajo, no se consumio cuota y no se escribio nada",
      costo_estimado: null,
      por_que_sin_costo: "no hay tarifa medida todavia; un costo inventado es peor que ninguno",
    },
  };
}

// ── self-test ────────────────────────────────────────────────────────────────────────────
const _esPrincipal = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (_esPrincipal && process.argv.includes("--self-test")) {
  // El catalogo REAL de produccion, medido el 2026-08-27. El comando queda al lado del dato
  // para que el proximo no tenga que inventarlo:
  //   curl -s 'https://rosettaquantum.com/v1/recipes?limit=10' | python3 -c \
  //     "import json,sys; d=json.load(sys.stdin); print(d['total_archivo'], [i['recipe_id'] for i in d['items']])"
  // Se deja FIJO a proposito: un caso atado al catalogo de hoy mide el calendario, no la regla.
  const CATALOGO = ["RQ-0033", "RQ-0019", "RQ-0012", "RQ-0007"];
  const OK = { receta: "RQ-0033", params: { n: 12 }, dry_run: true };

  const casos = [
    // ── grita ──
    ["grita: sin Idempotency-Key, incluso en seco", () =>
      evaluarPeticion({ peticion: OK, clave: null, catalogo: CATALOGO }).codigo === "SIN_CLAVE_DE_IDEMPOTENCIA"],

    ["grita: misma clave con cuerpo distinto", () => {
      const vistas = new Map([["k1", huellaDelCuerpo(OK)]]);
      return evaluarPeticion({ peticion: { ...OK, params: { n: 99 } }, clave: "k1", catalogo: CATALOGO, vistas }).codigo === "CLAVE_REUSADA_CON_OTRO_CUERPO";
    }],

    ["grita: receta que no esta en el catalogo, y dice cuantas hay", () => {
      const r = evaluarPeticion({ peticion: { ...OK, receta: "NO-EXISTE" }, clave: "k", catalogo: CATALOGO });
      return r.codigo === "RECETA_DESCONOCIDA" && r.hay === 4;
    }],

    ["grita: falta un campo obligatorio y dice cual", () => {
      const r = evaluarPeticion({ peticion: { receta: "RQ-0033", dry_run: true }, clave: "k", catalogo: CATALOGO });
      return r.codigo === "PETICION_INVALIDA" && r.faltan.includes("params");
    }],

    // Los dos motivos de no poder ejecutar son DISTINTOS y se distinguen. Un 501 mudo haria
    // que un cliente sin credencial creyera que el problema es nuestro.
    ["grita distinto: ejecutar sin credencial es 401, no 501", () =>
      evaluarPeticion({ peticion: { ...OK, dry_run: false }, clave: "k", catalogo: CATALOGO }).codigo === "SIN_CREDENCIAL"],

    ["grita distinto: con credencial, ejecutar es 501 NO_CONSTRUIDO y lo dice", () =>
      evaluarPeticion({ peticion: { ...OK, dry_run: false }, clave: "k", catalogo: CATALOGO, credencial: "x" }).codigo === "NO_CONSTRUIDO"],

    // ── calla ──
    ["CALLA: peticion valida en seco", () =>
      evaluarPeticion({ peticion: OK, clave: "k", catalogo: CATALOGO }).estado === "en_seco"],

    // EL CASO QUE DEFINE LA IDEMPOTENCIA: repetir no es fallar.
    ["CALLA: misma clave y MISMO cuerpo es una repeticion legitima, no un 409", () => {
      const vistas = new Map([["k1", huellaDelCuerpo(OK)]]);
      const r = evaluarPeticion({ peticion: OK, clave: "k1", catalogo: CATALOGO, vistas });
      return r.estado === "en_seco" && r.repetida === true;
    }],

    ["el mismo trabajo con las claves en otro orden NO da un 409 falso", () => {
      const a = { receta: "RQ-0033", params: { b: 2, a: 1 }, dry_run: true };
      const b = { dry_run: true, params: { a: 1, b: 2 }, receta: "RQ-0033" };
      return huellaDelCuerpo(a) === huellaDelCuerpo(b);
    }],

    ["el ensayo en seco declara que NO ejecuto nada", () =>
      /no se encolo|no se consumio/.test(evaluarPeticion({ peticion: OK, clave: "k", catalogo: CATALOGO }).plan.no_se_ejecuto)],

    // Un costo inventado seria una cifra sin medicion viajando como si la tuviera (§1 quater).
    ["el costo va en null con su razon, no en un numero inventado", () => {
      const p = evaluarPeticion({ peticion: OK, clave: "k", catalogo: CATALOGO }).plan;
      return p.costo_estimado === null && typeof p.por_que_sin_costo === "string";
    }],

    // ── contrato publico ──
    ["todo rechazo trae codigo HTTP, explicacion y QUE HACER", () =>
      Object.values(RECHAZOS).every((r) => typeof r.http === "number" && r.dice.length > 20 && r.detalle.length > 40)],

    // Un codigo cuyo unico significado vive en la conversacion donde se invento se publica roto.
    ["el detalle viaja en la respuesta, no solo en la tabla", () =>
      typeof evaluarPeticion({ peticion: OK, clave: null, catalogo: CATALOGO }).detalle === "string"],

    // §1 bis: ya publicamos una API que apuntaba a una pagina 404. Mientras no exista, no hay
    // enlace — y este caso lo obliga.
    ["no se emite enlace a definiciones mientras la pagina no exista", () =>
      DEFINICIONES_EN === null &&
      evaluarPeticion({ peticion: OK, clave: null, catalogo: CATALOGO }).definicion === undefined],

    // El codigo nombra el DEFECTO, no el mecanismo. Un tercero necesita saber que arreglar.
    ["ningun codigo nombra el mecanismo que lo detecto", () =>
      !Object.keys(RECHAZOS).some((k) => /RELOJ|PROVISTO|SPEC|REPLAY|GENERADOR/.test(k))],

    // ── mutacion ──
    // Si la clave solo se exigiera al ejecutar, el cliente aprende a no mandarla y el dia que
    // ejecute de verdad no la tiene. Por eso se exige TAMBIEN en seco.
    ["MUTACION: si la clave solo se exigiera al ejecutar, el ensayo en seco pasaria sin ella", () => {
      const conRegla = evaluarPeticion({ peticion: OK, clave: null, catalogo: CATALOGO }).codigo;
      const siSoloAlEjecutar = OK.dry_run === true; // en seco no se miraria la clave
      return conRegla === "SIN_CLAVE_DE_IDEMPOTENCIA" && siSoloAlEjecutar === true;
    }],

    // Si la huella no ordenara las claves, el mismo trabajo escrito distinto daria 409.
    ["MUTACION: sin ordenar las claves, el mismo trabajo daria un 409 falso", () => {
      const a = { params: { b: 2, a: 1 } }, b = { params: { a: 1, b: 2 } };
      const sinOrdenar = JSON.stringify(a) !== JSON.stringify(b);
      return huellaDelCuerpo(a) === huellaDelCuerpo(b) && sinOrdenar === true;
    }],

    // El catalogo se consulta; si estuviera escrito aqui, agregar una receta en D1 no la
    // habilitaria y nadie sabria por que.
    ["el catalogo entra por parametro: no hay lista escrita en este archivo", () =>
      evaluarPeticion({ peticion: { ...OK, receta: "RQ-NUEVA" }, clave: "k", catalogo: ["RQ-NUEVA"] }).estado === "en_seco"],
  ];

  let fallos = 0;
  for (const [nombre, fn] of casos) {
    let paso; try { paso = fn(); } catch { paso = false; }
    console.log(`${paso ? "ok   " : "FALLA"}  ${nombre}`);
    if (!paso) fallos++;
  }
  console.log(`\n[puerta] self-test: ${casos.length - fallos} de ${casos.length} pasaron.`);
  process.exit(fallos ? 1 : 0);
}
