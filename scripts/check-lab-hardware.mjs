#!/usr/bin/env node
/**
 * /lab/hardware sirve EXACTAMENTE el texto aprobado y las cifras medidas.
 *
 * QUE VIGILA, y por que cada cosa:
 *
 *  1. **Los sellos.** Cada archivo de `src/data/lab/hardware/` tiene que calzar con el sha256
 *     de APROBADOS.json. Lo comprueba llamando al MISMO `sellado()` que usa el generador, no
 *     con una copia de la lógica: dos implementaciones de un contrato cambian en dos pasos, y
 *     eso ya nos costó antes.
 *  2. **El texto, verbatim, en las dos páginas construidas.** Los doce textos los aprobó
 *     Nicholas el 25-nov-2026. Que estén en el documento sellado no prueba que la página los
 *     sirva: entre el documento y el HTML hay un generador, un componente y un layout.
 *  3. **Ninguna llave sin reemplazar.** Un `{maquina}` en pantalla es una cifra que no se midió
 *     anunciándose como texto.
 *  4. **Las cifras del marcador, en el HTML.** El número grande no sale de un texto aprobado,
 *     lo pinta el componente. Si un día deja de pintarlo, los párrafos siguen ahí y la página
 *     se ve bien — con el dato ausente. Es la ausencia disfrazada de valor, y es el caso que
 *     los dos chequeos anteriores NO ven.
 *
 * SU PUNTO CIEGO, DECLARADO. No comprueba que la medición sea reciente —una corrida vieja es
 * válida y la página la marca sola—, ni que el número sea CORRECTO: comprueba que el que está
 * en pantalla es el que está en el artefacto. Si el artefacto miente, esto pasa en verde. De
 * que el artefacto no mienta responden el preregistro sellado y `comprobar()` en `sellar.py`.
 * Y no mira cómo se ve: un número tapado por un ancestro con `overflow` pasa igual.
 *
 * Y NO distingue tilde de no-tilde por simpatía: compara byte a byte. «Español sin tildes pasa
 * el guardia de idioma» es un defecto real de esta casa, y la comparación verbatim es lo único
 * que lo caza.
 *
 * CORRE EN POSTBUILD, no en prebuild: necesita `dist/`. No tiene BASE y no mira producción.
 *
 * Uso:
 *   node scripts/check-lab-hardware.mjs --self-test   # las mutaciones, sin necesitar dist/
 *   node scripts/check-lab-hardware.mjs               # contra dist/
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { pagina, sellado } from "../src/lib/lab-hardware.mjs";

export const CONSUMIDOR = {
  quien: "la sesión web (dueña del frente /lab)",
  hace: "si grita por un sello, vuelve a copiar los artefactos de la medición y a sellarlos; " +
        "si grita por un texto, lo devuelve al aprobado palabra por palabra — NO edita el " +
        "documento aprobado para que calce, porque entonces el guardia vigila una copia de sí " +
        "mismo; si grita por una cifra ausente, arregla el componente, nunca el guardia",
  bloquea: "sí, el build. Una página que dice una medición que no es la medida es peor que no " +
           "tener la página: es la única superficie donde esta casa muestra una QPU real.",
};

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PAGINAS = [
  { lang: "en", ruta: "dist/lab/hardware/index.html" },
  { lang: "es", ruta: "dist/es/lab/hardware/index.html" },
];

/** El HTML como TEXTO comparable: sin comentarios, sin etiquetas, con las entidades resueltas. */
export function textoDe(html) {
  return String(html)
    // Los comentarios se van PRIMERO. Un comentario que documenta el defecto —«acá iba
    // {maquina}»— haría gritar al chequeo de llaves por la documentación del defecto en vez
    // de por el defecto. Ya pasó en esta casa con un guardia que leía prosa como código.
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * LA ESTRUCTURA: cada columna lleva SU rótulo, SU referencia del azar y SU histograma, y el
 * histograma dibuja las cuentas que se midieron.
 *
 * Por qué estos tres y no otros. Los tres nacen de defectos reales de esta página, encontrados
 * mirando la pantalla y no leyendo el código:
 *
 *  - **El histograma sin rótulo.** Se veía un gráfico con cuatro picos y ruido y el lector no
 *    podía saber de qué máquina era. Un gráfico sin su rótulo no es un gráfico ambiguo: es un
 *    gráfico que el lector atribuye a la máquina equivocada la mitad de las veces.
 *  - **El azar en una sola columna.** Colgaba bajo el simulador, o sea bajo la única columna
 *    donde no hace falta, y el 900 del hardware quedaba sin su vara al lado.
 *  - **Las alturas.** Es el más importante y el que ningún humano revisa: el histograma del
 *    simulador estuvo a punto de salir con cuatro barras planas de 250 que yo había fabricado
 *    dividiendo 1.000 entre 4, cuando la corrida muestreada dio 239, 248, 251 y 262. Comparar
 *    las alturas contra las cuentas de los artefactos es lo único que distingue un histograma
 *    medido de uno plausible.
 *
 * Mira el HTML CRUDO, no el texto: lo que se vigila acá es la estructura, y `textoDe` la borra.
 */
export function juzgarEstructura(html, lang) {
  const fallas = [];
  const { textos, medicion: m } = pagina(lang);
  const maximo = Math.max(
    ...Object.values(m.cuentas_simulador), ...Object.values(m.cuentas_hardware));

  const COLS = [
    { clave: "a", rotulo: textos.columna_a, cuentas: m.cuentas_simulador, que: "el simulador" },
    { clave: "b", rotulo: textos.columna_b, cuentas: m.cuentas_hardware, que: "la QPU" },
  ];

  for (const col of COLS) {
    // El trozo de ESTA columna. Buscar los atributos en el documento entero diría que están
    // los dos aunque los dos vivieran en la misma columna, que es el defecto que se vigila.
    const i = html.indexOf(`data-columna="${col.clave}"`);
    if (i < 0) {
      fallas.push(`[${lang}] no está la columna «${col.clave}» (${col.que}).`);
      continue;
    }
    const j = COLS.map((c) => html.indexOf(`data-columna="${c.clave}"`))
      .filter((x) => x > i).sort((a, b) => a - b)[0] ?? html.length;
    const trozo = html.slice(i, j);

    // 1 · el rótulo de SU máquina, con el texto aprobado
    const rot = new RegExp(`data-rotulo-de="${col.clave}"[^>]*>([^<]*)<`).exec(trozo);
    if (!rot) {
      fallas.push(`[${lang}] la columna de ${col.que} no lleva rótulo. Un histograma sin decir ` +
                  `de qué máquina es se lee como el de la otra.`);
    } else if (textoDe(rot[1]) !== col.rotulo.replace(/\s+/g, " ").trim()) {
      fallas.push(`[${lang}] el rótulo de ${col.que} no es el texto aprobado.\n` +
                  `    aprobado: ${col.rotulo}\n    en la página: ${textoDe(rot[1])}`);
    }

    // 2 · su referencia del azar
    if (!trozo.includes(`data-vara-de="${col.clave}"`)) {
      fallas.push(`[${lang}] a la columna de ${col.que} le falta la referencia del azar ` +
                  `(${m.aciertos_azar}). El texto aprobado dice que este número no viaja solo.`);
    }

    // 3 · su histograma, y que dibuje LO MEDIDO
    if (!trozo.includes(`data-reparto-de="${col.clave}"`)) {
      fallas.push(`[${lang}] a la columna de ${col.que} le falta su histograma.`);
      continue;
    }
    const r = trozo.indexOf(`data-reparto-de="${col.clave}"`);
    const alturas = [...trozo.slice(r).matchAll(/block-size:([\d.]+)%/g)].map((x) => +x[1]);
    if (alturas.length !== m.estados) {
      fallas.push(`[${lang}] el histograma de ${col.que} tiene ${alturas.length} barras y los ` +
                  `estados son ${m.estados}.`);
      continue;
    }
    for (let k = 0; k < m.estados; k++) {
      const esperada = +(100 * (col.cuentas[String(k)] ?? 0) / maximo).toFixed(1);
      if (Math.abs(alturas[k] - esperada) > 0.15) {
        fallas.push(
          `[${lang}] el histograma de ${col.que} dibuja el estado ${k} a ${alturas[k]}% y lo ` +
          `medido (${col.cuentas[String(k)] ?? 0} de ${maximo}) da ${esperada}%. El gráfico no ` +
          `muestra los disparos que se midieron.`);
        break; // una por columna: la lista entera sería la misma falla dieciséis veces
      }
    }
  }

  // Y la escala compartida: si cada histograma se escalara a su propio máximo, los dos se
  // verían iguales y la figura diría que el hardware acertó tanto como el simulador exacto.
  const topes = COLS.map((c) => Math.max(...Object.values(c.cuentas)));
  if (!fallas.length && topes[0] !== topes[1]) {
    const altas = COLS.map((c) => {
      const r = html.indexOf(`data-reparto-de="${c.clave}"`);
      const fin = html.indexOf("</div></div>", r);
      return Math.max(...[...html.slice(r, fin > 0 ? fin + 12 : undefined)
        .matchAll(/block-size:([\d.]+)%/g)].map((x) => +x[1]));
    });
    if (Math.abs(altas[0] - altas[1]) < 0.15) {
      fallas.push(`[${lang}] los dos histogramas llegan al mismo alto (${altas[0]}%) y sus ` +
                  `máximos medidos son distintos (${topes[0]} y ${topes[1]}): cada uno está ` +
                  `escalado a sí mismo, así que no se pueden comparar.`);
    }
  }
  return fallas;
}

/**
 * Juzga UNA página ya construida contra lo aprobado y lo medido.
 * Devuelve la lista de fallas; vacía es que pasó. No imprime: así el self-test la puede
 * ejercer sin leer la salida de la consola, que es lo que hace que un auditor imprima FALLA
 * y salga con cero.
 */
export function juzgar(html, lang, hoy = new Date()) {
  const fallas = [];
  const { textos, medicion: m, deHoy } = pagina(lang, hoy);
  const texto = textoDe(html);

  // 1 · los doce textos, verbatim. `no_es_de_ahora` sólo cuando la corrida no es del día:
  // exigirlo siempre haría gritar al guardia justo cuando la página está bien.
  for (const [clave, valor] of Object.entries(textos)) {
    if (clave === "no_es_de_ahora" && deHoy) {
      if (texto.includes(valor)) {
        fallas.push(`[${lang}] la página trae el aviso «no es de ahora» y la medición ES de hoy ` +
                    `(${m.fecha}). Un aviso que sale siempre deja de avisar.`);
      }
      continue;
    }
    const buscado = valor.replace(/\s+/g, " ").trim();
    if (!texto.includes(buscado)) {
      fallas.push(`[${lang}] el texto aprobado «${clave}» no está en la página, o no está igual.\n` +
                  `    aprobado: ${buscado.slice(0, 110)}${buscado.length > 110 ? "…" : ""}`);
    }
  }

  // 2 · ninguna llave sin reemplazar
  for (const [, llave] of texto.matchAll(/\{([a-z_]{3,})\}/g)) {
    fallas.push(`[${lang}] quedó «{${llave}}» sin reemplazar en la página. Es una cifra que no ` +
                `se midió, puesta donde se lee como texto.`);
  }

  // 3 · las cifras del marcador, que NO vienen de ningún texto aprobado
  const n = (v) => v.toLocaleString(lang === "es" ? "es-CL" : "en-US");
  for (const [que, valor] of [
    ["aciertos del simulador", n(m.aciertos_simulador)],
    ["aciertos en hardware", n(m.aciertos_hardware)],
  ]) {
    if (!texto.includes(valor)) {
      fallas.push(`[${lang}] la página no muestra ${que} (${valor}). Los párrafos pueden estar ` +
                  `completos y el número ausente: eso se ve bien y no dice nada.`);
    }
  }
  // Los 16 estados del reparto. Un gráfico que se queda sin barras no rompe nada visible.
  const estados = [...texto.matchAll(/(?:^| )(\d{1,2})(?= |$)/g)].map((x) => x[1]);
  for (const i of m.picos) {
    if (!estados.includes(String(i))) {
      fallas.push(`[${lang}] falta el pico ${i} en el reparto de los disparos. Los cuatro picos ` +
                  `correctos se saben por matemática antes de encender la máquina: si no están ` +
                  `en pantalla, la figura no muestra lo que dice mostrar.`);
    }
  }
  fallas.push(...juzgarEstructura(html, lang));
  return fallas;
}

/* ------------------------------------------------------------------ el self-test */

function selfTest() {
  // La página buena se arma del texto aprobado y las cifras medidas: el mismo camino que
  // recorre el componente, para que el caso de silencio sea realista y no una fija amable.
  const armar = (lang, hoy) => {
    const { textos, medicion: m } = pagina(lang, hoy);
    const n = (v) => v.toLocaleString(lang === "es" ? "es-CL" : "en-US");
    const esc = (v) => v.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
    const maximo = Math.max(
      ...Object.values(m.cuentas_simulador), ...Object.values(m.cuentas_hardware));
    const cols = [
      ["a", textos.columna_a, m.aciertos_simulador, m.cuentas_simulador],
      ["b", textos.columna_b, m.aciertos_hardware, m.cuentas_hardware],
    ].map(([k, rot, aciertos, cuentas]) =>
      `<div data-columna="${k}">` +
      `<div data-rotulo-de="${k}">${esc(rot)}</div>` +
      `<div>${n(aciertos)}</div><div>${esc(textos.rotulo_cifra)}</div>` +
      `<div data-vara-de="${k}"><span style="inline-size:25.0%"></span></div>` +
      `<div data-reparto-de="${k}">` +
      Array.from({ length: m.estados }, (_, i) =>
        `<div><div><span style="block-size:${(100 * (cuentas[String(i)] ?? 0) / maximo).toFixed(1)}%"></span></div>` +
        `<div>${i}</div></div>`).join("") +
      `</div></div>`).join("\n");
    const cuerpo = Object.entries(textos)
      .filter(([k]) => k !== "no_es_de_ahora" && k !== "columna_a" && k !== "columna_b"
                       && k !== "rotulo_cifra")
      .map(([, v]) => `<p>${esc(v)}</p>`).join("\n");
    return `<main>\n${cuerpo}\n${cols}\n</main>`;
  };

  const topeComun = (m) => Math.max(
    ...Object.values(m.cuentas_simulador), ...Object.values(m.cuentas_hardware));

  /** Redibuja el histograma de UNA columna con otras cuentas u otra escala. */
  const reemplazarReparto = (html, clave, cuentas, maximo) => {
    const i = html.indexOf(`<div data-reparto-de="${clave}">`);
    if (i < 0) throw new Error(`la fija no trae el reparto «${clave}»`);
    const fin = html.indexOf("</div></div>", i);
    if (fin < 0) throw new Error(`no encuentro el cierre del reparto «${clave}»`);
    const n = Object.keys(cuentas).length ? Math.max(16, 0) : 16;
    const nuevo = `<div data-reparto-de="${clave}">` +
      Array.from({ length: n }, (_, k) =>
        `<div><div><span style="block-size:${
          (100 * (cuentas[String(k)] ?? 0) / maximo).toFixed(1)}%"></span></div>` +
        `<div>${k}</div></div>`).join("") + `</div>`;
    return html.slice(0, i) + nuevo + html.slice(fin + "</div></div>".length);
  };

  /** Le quita UNA barra al histograma de una columna. */
  const quitarUnaBarra = (html, clave) => {
    const i = html.indexOf(`<div data-reparto-de="${clave}">`);
    if (i < 0) throw new Error(`la fija no trae el reparto «${clave}»`);
    const barra = html.indexOf("<div><div><span", i);
    if (barra < 0) throw new Error(`el reparto «${clave}» no tiene barras`);
    const cierre = html.indexOf("</div></div>", barra);
    return html.slice(0, barra) + html.slice(cierre + "</div></div>".length);
  };

  const casos = [
    // --- los que tienen que GRITAR
    { grita: true, que: "falta un texto aprobado",
      html: (l) => armar(l).replace(/<p>[^<]*<\/p>/, "") },
    // SÓLO EN ESPAÑOL, y por una razón que es la mitad del valor de este caso: quitarle los
    // diacríticos a un texto que no tiene ninguno es la IDENTIDAD. Corrido en inglés, el
    // mutante no entra, el guardia calla con razón y el caso se lee como «el guardia no caza
    // las tildes». Una mutación que es una simetría no prueba nada, y se disfraza de guardia
    // mudo. Por eso abajo se exige que todo mutante CAMBIE el HTML.
    { grita: true, langs: ["es"], que: "a un texto le quitaron las tildes",
      html: (l) => armar(l).normalize("NFD").replace(/[̀-ͯ]/g, "") },
    // El equivalente que sí entra en los dos: la raya por un guión. Mismo largo de palabra,
    // invisible de lejos, y los textos aprobados la traen en los dos idiomas.
    { grita: true, que: "una raya (—) cambiada por un guión",
      html: (l) => armar(l).replace(/—/g, "-") },
    { grita: true, que: "quedó una llave sin reemplazar",
      html: (l) => armar(l) + "<p>Trabajo {job_id} en {maquina}</p>" },
    { grita: true, que: "el número grande desapareció del marcador",
      html: (l) => { const { medicion: m } = pagina(l);
        const v = m.aciertos_hardware.toLocaleString(l === "es" ? "es-CL" : "en-US");
        return armar(l).replace(`<div>${v}</div>`, "<div></div>"); } },
    // Este caso lo reescribí el 25-nov: la versión anterior buscaba `<span>N</span>`, que la
    // fija dejó de emitir al pasar a dos columnas. La mutación no entraba y la línea decía
    // «✓ grita» igual, porque el guardia callaba con razón. Lo delató la comprobación de que
    // todo mutante cambie el HTML — una fija que envejece se ve idéntica a un guardia que
    // funciona.
    { grita: true, que: "a un histograma le falta una barra",
      html: (l) => quitarUnaBarra(armar(l), "b") },
    { grita: true, que: "sale el aviso «no es de ahora» con una medición que SÍ es de hoy",
      html: (l) => armar(l) + `<p>${pagina(l).textos.no_es_de_ahora}</p>` },

    // --- los tres defectos que encontró Main mirando la pantalla, más el que destapó el
    //     primero. Van como casos para que no puedan volver sin que el build se caiga.
    { grita: true, que: "un histograma sin el rótulo de su máquina (el defecto de Main)",
      html: (l) => armar(l).replace(/<div data-rotulo-de="b"[^>]*>[^<]*<\/div>/, "") },
    { grita: true, que: "el rótulo de una columna cambiado por uno inventado",
      html: (l) => armar(l).replace(/(<div data-rotulo-de="b"[^>]*>)[^<]*</, "$1Hardware<") },
    { grita: true, que: "la referencia del azar sólo en la columna del simulador (el 2.º de Main)",
      html: (l) => armar(l).replace(/<div data-vara-de="b">[\s\S]*?<\/div>/, "") },
    { grita: true, que: "el histograma del simulador FABRICADO plano (1.000 ÷ 4 picos), que es " +
                        "lo que estuvo a punto de publicarse",
      html: (l) => { const { medicion: m } = pagina(l);
        // Lo que yo había escrito: repartir los disparos en partes iguales entre los picos.
        // Da 250, 250, 250, 250; lo medido fue 239, 248, 251, 262.
        const plano = Object.fromEntries(
          m.picos.map((i) => [String(i), m.disparos / m.picos.length]));
        return reemplazarReparto(armar(l), "a", plano, topeComun(m)); } },
    { grita: true, que: "los dos histogramas escalados cada uno a su propio máximo",
      html: (l) => { const { medicion: m } = pagina(l);
        return reemplazarReparto(armar(l), "b", m.cuentas_hardware,
                                 Math.max(...Object.values(m.cuentas_hardware))); } },

    // --- los que tienen que CALLARSE. Sin éstos el guardia pasa todas las pruebas de gritar.
    { grita: false, que: "la página correcta",
      html: (l) => armar(l) },
    { grita: false, que: "una llave nombrada DENTRO de un comentario del HTML (el caso paradójico: " +
                         "el defecto descrito, no presente)",
      html: (l) => armar(l) + "<!-- acá iba {maquina} antes de que lo pusiera el generador -->" },
    { grita: false, que: "el texto con entidades HTML y espacios de más",
      html: (l) => armar(l).replace(/<p>/g, '<p>\n   ').replace(/<\/p>/g, '\n  </p>') },
  ];

  // La fecha de la medición es fija y sellada, así que «hoy» se fija aquí para que el caso del
  // aviso sea estable: con la fecha real del sistema este self-test cambiaría de respuesta solo.
  const HOY = new Date(pagina("es").medicion.fecha + "T18:00:00Z");
  let fallas = 0, corridos = 0, gritos = 0, silencios = 0;
  console.log("check-lab-hardware · self-test");
  for (const c of casos) {
    for (const lang of c.langs ?? ["es", "en"]) {
      const html = c.html(lang);

      // EL MUTANTE TIENE QUE ENTRAR. Un caso de grito cuya mutación no cambia nada pasa a ser
      // un caso de silencio disfrazado: el guardia calla con razón y la línea dice que no caza.
      if (c.grita && html === armar(lang, HOY)) {
        console.log(`  ✗ [${lang}] MUTANTE QUE NO ENTRA · ${c.que}\n` +
                    `      → la mutación dejó el HTML idéntico. Este caso no prueba nada.`);
        fallas++;
        continue;
      }

      const encontradas = juzgar(html, lang, HOY);
      const grito = encontradas.length > 0;
      const ok = grito === c.grita;
      corridos++;
      if (ok) { if (c.grita) gritos++; else silencios++; } else fallas++;
      console.log(`  ${ok ? "✓" : "✗"} [${lang}] ${c.grita ? "grita" : "calla"} · ${c.que}` +
                  (ok ? "" : `\n      → ${grito ? "gritó: " + encontradas[0].split("\n")[0] : "NO gritó"}`));
    }
  }
  if (fallas) {
    console.log(`\nFALLA: ${fallas} caso(s) del self-test. El guardia no caza lo que dice cazar.`);
    process.exit(1);
  }
  console.log(`\nok · ${corridos} casos corridos, ${gritos} de grito y ${silencios} de silencio`);
}

/* ------------------------------------------------------------------ contra dist/ */

function contraDist() {
  // Los sellos primero: si un artefacto no calza, lo que la página diga da lo mismo.
  const lista = JSON.parse(readFileSync(resolve(RAIZ, "src/data/lab/hardware/APROBADOS.json"), "utf8"));
  console.log(`check-lab-hardware · ${lista.length} archivos sellados`);
  for (const fila of lista) {
    sellado(fila.archivo); // lanza si la huella no calza
    console.log(`  ✓ ${fila.archivo.padEnd(34)} ${fila.sha256.slice(0, 16)}`);
  }

  let fallas = 0;
  for (const { lang, ruta } of PAGINAS) {
    const p = resolve(RAIZ, ruta);
    if (!existsSync(p)) {
      console.log(`  ✗ [${lang}] no se construyó ${ruta}`);
      fallas++;
      continue;
    }
    const encontradas = juzgar(readFileSync(p, "utf8"), lang);
    if (!encontradas.length) {
      const { textos } = pagina(lang);
      console.log(`  ✓ [${lang}] ${ruta} · ${Object.keys(textos).length} textos aprobados, verbatim`);
    } else {
      for (const f of encontradas) console.log(`  ✗ ${f}`);
      fallas += encontradas.length;
    }
  }
  if (fallas) {
    console.log(`\nFALLA: ${fallas}. La página no sirve lo aprobado o no muestra lo medido.`);
    process.exit(1);
  }
  console.log("\nok · las dos páginas sirven el texto aprobado y las cifras de los sellados");
}

if (process.argv.includes("--self-test")) selfTest();
else contraDist();
