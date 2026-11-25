/**
 * /lab/hardware — los datos de la pagina, armados desde los archivos SELLADOS.
 *
 * LA REGLA QUE GOBIERNA ESTE ARCHIVO: **ninguna cifra de la pagina se escribe aqui.** Los textos
 * aprobados traen marcadores entre llaves —{maquina}, {prof_transpilada}, {job_id}— y esto los
 * reemplaza leyendo `src/data/lab/hardware/`. Si falta un archivo, si una huella no calza o si
 * queda un marcador sin reemplazar, **lanza y la pagina no se genera**.
 *
 * POR QUE ASI. Una cifra tecleada en una plantilla se despega del dia que la midio y nadie lo
 * nota: sigue ahi, con buena cara, diciendo lo de antes. En esta casa eso ya costo caro. El
 * precio de hacerlo bien es que la pagina depende de sus artefactos, y eso es exactamente lo que
 * se quiere — si no hay medicion, no hay pagina.
 *
 * LOS ARCHIVOS SON COPIAS, no lecturas de otra carpeta. El generador corre tambien en CI, donde
 * el proyecto que produjo la medicion no existe; un generador que lee fuera del repo anda en el
 * Mac de quien lo escribio y revienta en el build de verdad. Las copias llevan su sha256 en
 * APROBADOS.json, que es el patron de src/data/q-ready/textos-aprobados/.
 *
 * LO QUE NO CUBRE, declarado: no comprueba que la medicion sea RECIENTE. Una corrida vieja es
 * una corrida valida y la pagina la muestra con su fecha; lo que hace es marcarla —el texto
 * `no_es_de_ahora` aparece sola cuando la corrida no es del dia— para que nadie la lea como si
 * fuera de recien. Esa distincion la decide `esDeHoy()`, no el que escribe el HTML.
 */
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const RELATIVO = "src/data/lab/hardware";

/**
 * La raíz del proyecto, BUSCADA, no supuesta.
 *
 * `new URL("../data/…", import.meta.url)` parece lo correcto y no lo es: Astro empaqueta este
 * módulo en `dist/.prerender/chunks/`, así que al construir el sitio `import.meta.url` apunta
 * ahí y la ruta relativa cae en una carpeta que no existe. El build se cayó así la primera vez
 * —el guardia funcionando, que es lo que uno quiere de él—. Y `process.cwd()` tampoco sirve:
 * amarra el módulo a desde dónde se lo invoque, y de acá lo llaman Astro y un script de
 * `scripts/` por separado.
 *
 * Entonces se sube desde este archivo hasta la carpeta que tiene a la vez `package.json` y los
 * datos. Funciona empaquetado, funciona bajo node suelto y funciona en CI, donde el árbol de
 * fuentes está presente al construir.
 */
function raizDelProyecto() {
  let d = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 12; i++) {
    if (existsSync(join(d, "package.json")) && existsSync(join(d, RELATIVO))) return d;
    const arriba = resolve(d, "..");
    if (arriba === d) break;
    d = arriba;
  }
  throw new Error(
    `/lab/hardware: no encuentro la raíz del proyecto subiendo desde ${
      dirname(fileURLToPath(import.meta.url))}. Tiene que haber una carpeta con package.json y ` +
    `${RELATIVO}/ — ahí viven los archivos sellados de la medición.`);
}

// fileURLToPath y no .pathname: una ruta con un espacio llega como %20 y el archivo no existe.
// Pasa de verdad en este proyecto, cuyo clon vive bajo «Rosetta Quantum».
const DIR = join(raizDelProyecto(), RELATIVO) + "/";
const TEXTOS = "TEXTOS-lab-hardware-2026-11-25.md";

const bytes = (archivo) => {
  try {
    return readFileSync(DIR + archivo);
  } catch (e) {
    throw new Error(
      `/lab/hardware: falta «${archivo}» en src/data/lab/hardware/. La pagina no se genera sin ` +
      `sus archivos sellados — una pagina a medias diria una medicion que no existe. (${e.code})`);
  }
};
const sha = (b) => createHash("sha256").update(b).digest("hex");

/** Lee un archivo y EXIGE que su huella sea la de APROBADOS.json. Falla cerrado. */
export function sellado(archivo) {
  const lista = JSON.parse(bytes("APROBADOS.json").toString("utf8"));
  const fila = lista.find((x) => x.archivo === archivo);
  if (!fila) throw new Error(`/lab/hardware: «${archivo}» no esta en APROBADOS.json`);
  const b = bytes(archivo);
  const real = sha(b);
  if (real !== fila.sha256) {
    throw new Error(
      `/lab/hardware: «${archivo}» tiene sha256 ${real.slice(0, 16)} y APROBADOS.json sella ` +
      `${fila.sha256.slice(0, 16)}. O se edito a mano un archivo sellado, o se cambio la ` +
      `medicion sin volver a sellarla. La pagina no se genera.`);
  }
  return b;
}

/** Los doce textos de un idioma, del documento aprobado. Una clave que falta lanza. */
export function textos(lang) {
  const md = sellado(TEXTOS).toString("utf8");
  const i = md.indexOf(`\n## ${lang}\n`);
  if (i < 0) throw new Error(`/lab/hardware: el documento aprobado no trae la seccion «## ${lang}»`);
  const j = md.indexOf("\n## ", i + 1);
  const sec = md.slice(i, j < 0 ? md.length : j);
  const out = {};
  for (const linea of sec.split("\n")) {
    const m = /^- \*\*([a-z_]+):\*\* (.+)$/.exec(linea);
    if (m) out[m[1]] = m[2];
  }
  const CLAVES = ["titulo", "bajada", "no_es", "que_se_mide", "columna_a", "columna_b",
                  "rotulo_cifra", "azar", "profundidad", "rsa", "procedencia", "no_es_de_ahora"];
  const faltan = CLAVES.filter((k) => !out[k]);
  if (faltan.length) {
    throw new Error(`/lab/hardware: al documento aprobado le faltan, en «${lang}»: ` +
                    `${faltan.join(", ")}. Son los textos que Nicholas aprobo; no se inventan.`);
  }
  return out;
}

/** La medicion: lo que sale de los artefactos sellados, ya en numeros. */
export function medicion() {
  const ref = JSON.parse(sellado("referencia.json").toString("utf8"));
  const ibm = JSON.parse(sellado("en-ibm.json").toString("utf8"));
  const sello = Object.fromEntries(
    sellado("preregistro-sello.txt").toString("utf8").split("\n")
      .filter((l) => l.includes("=") && !l.startsWith("#"))
      .map((l) => l.split("=").map((x) => x.trim())).map(([k, ...v]) => [k, v.join("=")]));

  // EL AZAR SE CUENTA, no se copia: picos sobre estados. Si un dia el circuito cambia, este
  // numero cambia solo, y el texto aprobado que dice «250» dejaria de calzar — lo caza el guardia.
  const picos = ref.picos_correctos.length;
  const estados = ref.estados;
  const azar = picos / estados;

  // LOS DOS HISTOGRAMAS SE DIBUJAN UNO AL LADO DEL OTRO Y EN LA MISMA ESCALA: eso sólo
  // significa algo si los dos brazos tiraron la misma cantidad de disparos. Si un día no
  // coinciden, las dos figuras seguirían viéndose bien y la comparación sería falsa, así que
  // esto aborta en vez de normalizar en silencio — normalizar escondería el cambio.
  if (ref.disparos !== ibm.disparos) {
    throw new Error(
      `/lab/hardware: el simulador tiró ${ref.disparos} disparos y la QPU ${ibm.disparos}. Los ` +
      `dos histogramas van lado a lado en la misma escala y eso deja de ser comparable. La ` +
      `página no se genera.`);
  }

  const aciertos = (fid) => Math.round(fid * ibm.disparos);
  return {
    maquina: ibm.maquina,
    qubits_maquina: ibm.qubits_de_la_maquina,
    job_id: ibm.trabajo,
    disparos: ibm.disparos,
    cuando_utc: ibm.cuando_utc,
    hora_utc: ibm.cuando_utc,
    fecha: ibm.cuando_utc.slice(0, 10),
    prof_original: ibm.profundidad_original,
    prof_transpilada: ibm.profundidad_transpilada,
    sha_circuito: sello.circuito_sha256,
    prereg_id: sello.prereg_id,
    hora_sello: sello.congelado_utc,
    picos: ref.picos_correctos,
    estados,
    azar,
    aciertos_azar: Math.round(azar * ibm.disparos),
    // LA COLUMNA A SALE DE LA CORRIDA MUESTREADA DEL SIMULADOR, no de una division.
    //
    // Antes esto decia `aciertos_simulador: ibm.disparos` y fabricaba el histograma repartiendo
    // los 1.000 disparos en partes iguales entre los cuatro picos: 250, 250, 250, 250. El
    // numero salia bien —la fidelidad muestreada ES 1— pero por una razon distinta de la
    // verdadera, y el histograma era directamente FALSO: el simulador, muestreado con la
    // semilla 20261124, dio 239, 248, 251 y 262. Cuatro barras planas inventadas por mi,
    // puestas al lado de un histograma medido en una QPU, en la unica pagina de la casa cuyo
    // tema entero es que las cifras se pueden comprobar.
    //
    // Lo cazo Main mirando la pantalla, pidiendo que el histograma dijera de que maquina es.
    // Un numero plausible escrito de memoria es indistinguible de uno medido, y este ademas
    // habria sobrevivido a cualquier cambio del circuito: la division siempre reparte parejo.
    aciertos_simulador: aciertos(ref.fidelidad_de_picos_muestreada),
    fidelidad_simulador: ref.fidelidad_de_picos_muestreada,
    aciertos_hardware: aciertos(ibm.fidelidad_de_picos),
    fidelidad_hardware: ibm.fidelidad_de_picos,
    cuentas_hardware: ibm.cuentas,
    cuentas_simulador: Object.fromEntries(
      Array.from({ length: estados }, (_, i) =>
        [String(i), Math.round((ref.probabilidades_muestreadas[String(i)] ?? 0) * ref.disparos)])),
    // Los dos brazos tiraron los mismos disparos, asi que los dos histogramas son
    // directamente comparables. Se dice aqui porque es la condicion que los hace comparables,
    // y si un dia deja de valer, los dos graficos de al lado mienten sin avisar.
    disparos_simulador: ref.disparos,
  };
}

/** ¿La medicion es del dia de hoy? De esto depende que salga el aviso de que no es de ahora. */
export function esDeHoy(m, hoy = new Date()) {
  return m.fecha === hoy.toISOString().slice(0, 10);
}

/** Los textos con sus llaves ya reemplazadas. Una llave que sobra lanza. */
export function pagina(lang, hoy = new Date()) {
  const t = textos(lang);
  const m = medicion();
  const out = {};
  for (const [k, v] of Object.entries(t)) {
    const puesto = v.replace(/\{([a-z_]+)\}/g, (todo, clave) => {
      if (!(clave in m)) {
        throw new Error(
          `/lab/hardware: el texto aprobado «${k}» (${lang}) pide {${clave}} y la medicion no ` +
          `lo trae. O el texto nombra algo que no se mide, o el artefacto perdio un campo.`);
      }
      return String(m[clave]);
    });
    if (/\{[a-z_]+\}/.test(puesto)) {
      throw new Error(`/lab/hardware: al texto «${k}» (${lang}) le quedaron llaves sin reemplazar`);
    }
    out[k] = puesto;
  }
  return { textos: out, medicion: m, deHoy: esDeHoy(m, hoy) };
}
