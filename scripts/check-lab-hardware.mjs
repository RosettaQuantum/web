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
  return fallas;
}

/* ------------------------------------------------------------------ el self-test */

function selfTest() {
  // La página buena se arma del texto aprobado y las cifras medidas: el mismo camino que
  // recorre el componente, para que el caso de silencio sea realista y no una fija amable.
  const armar = (lang, hoy) => {
    const { textos, medicion: m } = pagina(lang, hoy);
    const n = (v) => v.toLocaleString(lang === "es" ? "es-CL" : "en-US");
    const cuerpo = Object.entries(textos)
      .filter(([k]) => k !== "no_es_de_ahora")
      .map(([, v]) => `<p>${v.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}</p>`).join("\n");
    return `<main>\n${cuerpo}\n<div>${n(m.aciertos_simulador)}</div>` +
           `<div>${n(m.aciertos_hardware)}</div>\n` +
           m.picos.map((i) => `<span>${i}</span>`).join("\n") + `\n</main>`;
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
    { grita: true, que: "el reparto se quedó sin uno de los picos",
      html: (l) => { const { medicion: m } = pagina(l);
        return armar(l).replace(`<span>${m.picos[0]}</span>`, "<span></span>"); } },
    { grita: true, que: "sale el aviso «no es de ahora» con una medición que SÍ es de hoy",
      html: (l) => armar(l) + `<p>${pagina(l).textos.no_es_de_ahora}</p>` },

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
