#!/usr/bin/env node
/* B10.2 · la franja de frescura tambien en las paginas legales. Va AQUI y no en los
   .astro: son GENERADOS desde los .md, y `--verificar` compara byte a byte. Meter el
   script a mano en el generado tumbo el deploy del 10-sep — el guardia hizo
   exactamente lo que tenia que hacer, y en el paso correcto: antes de publicar. */
/**
 * Arma las seis paginas legales LEYENDO el texto aprobado, no transcribiendolo.
 *
 * Mismo mecanismo que `build-pricing.mjs`, y por las mismas razones — pero aca pesan
 * mas: son las paginas que Paddle verifica para habilitar el cobro, y un texto legal
 * con una palabra distinta de la aprobada no es un detalle de maquetado.
 *
 *  - El .astro se GENERA desde el .md. Nadie teclea el texto, asi que lo publicado es
 *    demostrablemente lo aprobado.
 *  - Cada archivo esta anclado a SU sha256. Si el documento cambia debajo, ABORTA en
 *    vez de publicar en silencio texto que nadie aprobo.
 *  - `--verificar` corre en CI y grita si alguien edita un .astro a mano.
 *
 * LA DIRECCION LEGAL ESTA AUSENTE A PROPOSITO. Nicholas no la ha dado. No se completa,
 * no se infiere y no se pone un marcador que parezca texto: si un dia llega, llega como
 * revision nueva del .md con su sha.
 *
 * Uso:
 *   node scripts/build-legal.mjs             # genera las cuatro
 *   node scripts/build-legal.mjs --verificar # no escribe: compara con lo que hay
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const VERIFICAR = process.argv.includes("--verificar");

/**
 * TERMINOS Y REEMBOLSOS SON UNA SOLA PAGINA desde el 12-nov-2026 (pedido de Nicholas):
 * la politica de reembolsos se publica como seccion de los terminos (#refunds /
 * #reembolsos) y /refunds y /es/reembolsos saltan alli por 301 (worker.js). Los dos .md
 * aprobados NO se tocan y siguen anclados a su sha: el armador los lee los dos y los
 * une. Lo unico que cambia es el encabezado — el h1 de los terminos pasa a ser el de
 * `h1`, y los encabezados del anexo bajan un nivel para quedar dentro de la pagina.
 *
 * Las cuatro paginas, con el sha256 de la version que Nicholas aprobo el 2026-08-11
 * ("ok apruebo las tres, publicalas"). Los hashes vienen del HASHES.txt que
 * acompana la carpeta aprobada, y se comprobaron contra los archivos antes de copiar.
 */
export const PAGINAS = [
  { md: "terms-en.md",    salida: "src/pages/terms.astro",         ruta: "/terms/",           alt: "/es/terminos/",   lang: "en",
    sha: "1ae9d16c686bdd660e16006952036ef656b5822334a841a4a6aedcb14b0e439b",
    titulo: "Terms and Conditions — Rosetta Q",
    h1: "Terms and Conditions",
    desc: "Terms and conditions for rosettaquantum.com, its public API and its measurement services, including the refund policy.",
    anexo: { md: "refunds-en.md", id: "refunds",
             sha: "7323b77f2f6f7ab9f12d922a5234dc71f69353c83abeedf90e734dba6a077719" } },
  { md: "privacy-en.md",  salida: "src/pages/privacy.astro",       ruta: "/privacy/",         alt: "/es/privacidad/", lang: "en",
    sha: "d5a51279a8aa5bbdebd55d8e9cf3d90d469eca30634dac07f68887b775e2b939",
    titulo: "Privacy Policy — Rosetta Q",
    desc: "What personal data Rosetta Quantum collects, why, and what rights you have over it." },
  { md: "terms-es.md",    salida: "src/pages/es/terminos.astro",   ruta: "/es/terminos/",     alt: "/terms/",         lang: "es",
    sha: "fa320e43e80f12633c0d25e3e154b306eac2a5ec32b8f1d34814b3abacaf3d90",
    titulo: "Términos y Condiciones — Rosetta Q",
    h1: "Términos y Condiciones",
    desc: "Términos y condiciones de rosettaquantum.com, su API pública y sus servicios de medición, incluida la política de reembolsos.",
    anexo: { md: "refunds-es.md", id: "reembolsos",
             sha: "47eefc17e7d158e237465e3a2affbdcaf207a3dee30416d3f3f0ad4abaeef1b3" } },
  { md: "privacy-es.md",  salida: "src/pages/es/privacidad.astro", ruta: "/es/privacidad/",   alt: "/privacy/",       lang: "es",
    sha: "d4bf8c50968a82cfff76b6a009e912524d597a6d92751d9ca20d61ea4054b94d",
    titulo: "Política de privacidad — Rosetta Q",
    desc: "Qué datos personales recoge Rosetta Quantum, para qué, y qué derechos tienes sobre ellos." },
];

const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const enlinea = s => esc(s)
  .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
  // `*asi*` — los terminos lo usan para citar el principio de reembolso y la pagina
  // publicaba los asteriscos a la vista. Va despues de `**`, que ya se consumio.
  .replace(/(?<![*\w])\*([^*\n]+)\*(?![*\w])/g, "<em>$1</em>")
  // `_asi_` — el documento de privacidad lo usa para la linea de "ultima actualizacion"
  // y el conversor no lo conocia, asi que las dos caras publicaban los guiones bajos a
  // la vista: "_Last updated: 2026-08-11_". No se toca el .md aprobado —el texto dice
  // enfasis y eso es lo que hay que publicar—; se ensena al conversor a leerlo.
  // El guion bajo tiene que estar SUELTO: sin esto, un content_hash o un run_id en
  // cualquier documento futuro se convertiria en cursiva y perderia el guion.
  .replace(/(?<![\w])_([^_\n]+)_(?![\w])/g, "<em>$1</em>")
  .replace(/`([^`]+)`/g, "<code>$1</code>")
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
  .replace(/\b([a-z0-9._%+-]+@rosettaquantum\.com)\b/g, '<a href="mailto:$1">$1</a>');

/** El subconjunto de markdown que estos documentos usan: h1, h2, vinnetas, parrafos. */
function aHtml(md) {
  const out = [];
  const L = md.split("\n");
  let i = 0;
  while (i < L.length) {
    const l = L[i];
    if (/^# /.test(l))  { out.push(`<h1>${enlinea(l.slice(2))}</h1>`); i++; continue; }
    if (/^## /.test(l)) { out.push(`<h2>${enlinea(l.slice(3))}</h2>`); i++; continue; }
    if (/^### /.test(l)){ out.push(`<h3>${enlinea(l.slice(4))}</h3>`); i++; continue; }
    if (/^- /.test(l)) {
      const it = []; while (i < L.length && /^- /.test(L[i])) it.push(L[i++].slice(2));
      out.push(`<ul>${it.map(x => `<li>${enlinea(x)}</li>`).join("")}</ul>`); continue;
    }
    if (/^---+$/.test(l)) { out.push("<hr>"); i++; continue; }
    if (!l.trim()) { i++; continue; }
    // Los saltos de linea DENTRO de un parrafo se respetan: en la cabecera, "Last
    // updated: 2026-08-11" va en su propia linea bajo el nombre, y unirlas dejaria la
    // fecha corrida contra el dominio.
    const par = []; while (i < L.length && L[i].trim() && !/^(#|- |---)/.test(L[i])) par.push(L[i++]);
    out.push(`<p>${par.map(enlinea).join("<br>")}</p>`);
  }
  return out.join("\n      ");
}

/**
 * La forma DOCUMENTO — la de los terminos. Mismo texto que `aHtml`, mismo conversor de
 * linea; lo que agrega es estructura: cabecera con la fecha a la vista, un id por
 * seccion para el indice y para el 301, y el anexo con sus encabezados un nivel abajo.
 *
 * Por que no se cambia `aHtml`: privacidad sigue saliendo de ahi, byte a byte igual.
 * Pasarla a esta forma es una decision aparte, no un efecto colateral.
 */
const ES_FECHA = /^(Last updated|Última actualización):/;

function bloques(md) {
  // Devuelve [{t:"h1"|"h2"|"p"|"ul"|"ol"|"hr", ...}] con el mismo corte que aHtml.
  const out = []; const L = md.split("\n"); let i = 0;
  while (i < L.length) {
    const l = L[i];
    if (/^# /.test(l))   { out.push({ t: "h1", x: l.slice(2) }); i++; continue; }
    if (/^## /.test(l))  { out.push({ t: "h2", x: l.slice(3) }); i++; continue; }
    if (/^- /.test(l))   { const it = []; while (i < L.length && /^- /.test(L[i])) it.push(L[i++].slice(2)); out.push({ t: "ul", it }); continue; }
    // Lista numerada: el anexo de reembolsos la trae ("1. Email…  2. That's it") y
    // `aHtml` la publicaba como un parrafo con <br>. Se lee como lo que dice ser.
    if (/^\d+\. /.test(l)) { const it = []; while (i < L.length && /^\d+\. /.test(L[i])) it.push(L[i++].replace(/^\d+\. /, "")); out.push({ t: "ol", it }); continue; }
    if (/^---+$/.test(l)) { out.push({ t: "hr" }); i++; continue; }
    if (!l.trim()) { i++; continue; }
    const par = []; while (i < L.length && L[i].trim() && !/^(#|- |---|\d+\. )/.test(L[i])) par.push(L[i++]);
    out.push({ t: "p", lineas: par });
  }
  return out;
}

const numero = x => (x.match(/^(\d+)\./) || [])[1];
const sinEtiquetas = s => s.replace(/<[^>]+>/g, "");

function aDocumento(P, mdPrincipal, mdAnexo, shaPrincipal, shaAnexo) {
  const es = P.lang === "es";
  const pref = es ? "seccion" : "section";
  const indice = [];       // [{id, txt, hijos:[{id,txt}]}]
  const cuerpo = [];
  let cabeza = "";

  const B = bloques(mdPrincipal);
  // Cabecera: el h1 (reemplazado por el titulo nuevo) y el parrafo que lo sigue —el
  // nombre y la fecha—, con la fecha en su propia linea marcada para que se vea.
  if (B[0]?.t !== "h1" || B[1]?.t !== "p") throw new Error(`${P.md}: la cabecera no tiene la forma esperada (h1 + parrafo)`);
  const meta = B[1].lineas.map(x => ES_FECHA.test(x)
    ? `<span class="doc-fecha">${enlinea(x)}</span>` : `<span>${enlinea(x)}</span>`).join("");
  if (!B[1].lineas.some(x => ES_FECHA.test(x))) throw new Error(`${P.md}: no encontre la linea de fecha en la cabecera`);
  cabeza = `<header class="doc-cabeza">
      <p class="eyebrow">Legal</p>
      <h1>${esc(P.h1)}</h1>
      <p class="doc-meta">${meta}</p>
    </header>`;

  const pintar = (b, nivel) => {
    if (b.t === "p")  return `<p>${b.lineas.map(enlinea).join("<br>")}</p>`;
    if (b.t === "ul") return `<ul>${b.it.map(x => `<li>${enlinea(x)}</li>`).join("")}</ul>`;
    if (b.t === "ol") return `<ol>${b.it.map(x => `<li>${enlinea(x)}</li>`).join("")}</ol>`;
    if (b.t === "hr") return "<hr>";
    throw new Error(`bloque inesperado ${b.t}`);
  };

  for (const b of B.slice(2)) {
    if (b.t === "h1") throw new Error(`${P.md}: un segundo h1`);
    if (b.t === "h2") {
      const n = numero(b.x); if (!n) throw new Error(`${P.md}: seccion sin numero: ${b.x}`);
      const id = `${pref}-${n}`; const html = enlinea(b.x);
      indice.push({ id, txt: html, hijos: [] });
      cuerpo.push(`<h2 id="${id}">${html}</h2>`); continue;
    }
    cuerpo.push(pintar(b));
  }

  // El anexo: su h1 pasa a h2 con el ancla del 301; sus h2 pasan a h3.
  const A = bloques(mdAnexo);
  if (A[0]?.t !== "h1") throw new Error(`${P.anexo.md}: no empieza con su titulo`);
  const parte = { id: P.anexo.id, txt: enlinea(A[0].x), hijos: [] };
  indice.push(parte);
  cuerpo.push(`<h2 id="${P.anexo.id}" class="doc-parte">${parte.txt}</h2>`);
  for (const b of A.slice(1)) {
    if (b.t === "h1") throw new Error(`${P.anexo.md}: un segundo h1`);
    if (b.t === "h2") {
      const n = numero(b.x); if (!n) throw new Error(`${P.anexo.md}: seccion sin numero: ${b.x}`);
      const id = `${P.anexo.id}-${n}`; const html = enlinea(b.x);
      parte.hijos.push({ id, txt: html });
      cuerpo.push(`<h3 id="${id}">${html}</h3>`); continue;
    }
    cuerpo.push(pintar(b));
  }

  const li = e => `<li><a href="#${e.id}">${sinEtiquetas(e.txt)}</a>${e.hijos.length
    ? `<ol>${e.hijos.map(h => `<li><a href="#${h.id}">${sinEtiquetas(h.txt)}</a></li>`).join("")}</ol>` : ""}</li>`;

  return `<div class="wrap legal-doc">
    ${cabeza}
    <div class="doc-cuerpo">
      <nav class="doc-indice" aria-label="${es ? "Contenido" : "Contents"}">
        <p class="doc-indice-t">${es ? "Contenido" : "Contents"}</p>
        <ol>${indice.map(li).join("")}</ol>
      </nav>
      <article class="doc-texto">
      ${cuerpo.join("\n      ")}

      <p class="sello-fuente">${es
        ? "Texto publicado desde sus documentos aprobados"
        : "Published from its approved source documents"} ·
        <code>sha256:${shaPrincipal.slice(0, 16)}…</code> ·
        <code>sha256:${shaAnexo.slice(0, 16)}…</code></p>
      </article>
    </div>
  </div>`;
}

function leerAprobado(md, shaEsperado) {
  const bytes = readFileSync(join(RAIZ, "src/aprobado/legal", md));
  const sha = createHash("sha256").update(bytes).digest("hex");
  if (sha !== shaEsperado) {
    console.error(`ABORTA: ${md} no es la version aprobada.\n` +
      `  aprobado: sha256:${shaEsperado}\n  en disco: sha256:${sha}\n` +
      `  Publicar esto seria publicar texto legal que nadie aprobo.`);
    process.exit(1);
  }
  const txt = bytes.toString("utf8");
  // Falla cerrado contra un marcador de relleno. La direccion legal esta ausente a
  // proposito, y un "COMPLETA NICHOLAS" servido en la pagina que Paddle revisa seria
  // peor que la ausencia.
  // OJO con la insensibilidad a mayusculas: la primera version usaba /TODO/i y
  // marcaba la palabra espanola "todo", que aparece en cada parrafo. Un falso
  // positivo aca retiene texto legal aprobado y bloquea a Paddle — precision sobre
  // cobertura. Los marcadores van EN MAYUSCULAS y como palabra completa.
  const relleno = txt.match(/COMPLETA NICHOLAS|\bTODO\b|\bXXX\b|\bTBD\b|\[pendiente\]|\[PENDING\]/);
  if (relleno) { console.error(`ABORTA: ${md} trae un marcador sin completar: "${relleno[0]}"`); process.exit(1); }
  return { txt, sha };
}

let escritas = 0;
for (const P of PAGINAS) {
  const { txt: md, sha } = leerAprobado(P.md, P.sha);
  const relativo = P.lang === "es" ? "../../" : "../";
  let pagina;

  if (P.anexo) {
    const { txt: mdA, sha: shaA } = leerAprobado(P.anexo.md, P.anexo.sha);
    pagina = `---
// GENERADO por scripts/build-legal.mjs — no editar a mano.
//
// El texto sale de DOS documentos aprobados por Nicholas el 2026-08-11, leidos por el
// armador y no tecleados por nadie: src/aprobado/legal/${P.md} y, como seccion
// #${P.anexo.id}, src/aprobado/legal/${P.anexo.md}. Para cambiarlo se edita el .md, se
// mueve el sha en el armador y se regenera, en el mismo commit.
//
// texto fuente sha256: ${sha}
// anexo        sha256: ${shaA}
import MarcaLayout from '${relativo}layouts/MarcaLayout.astro';
import css from '${relativo}styles/pages/legal-doc.css?raw';
---
<MarcaLayout
  title="${P.titulo}"
  description="${P.desc}"
  lang="${P.lang}"
  altUrl="${P.alt}"
  ruta="${P.ruta}"
  pageCss={css} scripts={["/js/frescura.js"]}>
  ${aDocumento(P, md, mdA, sha, shaA)}
</MarcaLayout>
`;
  } else {
  pagina = `---
// GENERADO por scripts/build-legal.mjs — no editar a mano.
//
// El texto sale de src/aprobado/legal/${P.md}, aprobado por Nicholas el 2026-08-11,
// leido por el armador y no tecleado por nadie. Para cambiarlo se edita el .md, se
// mueve el sha en el armador y se regenera, en el mismo commit.
//
// texto fuente sha256: ${sha}
import MarcaLayout from '${relativo}layouts/MarcaLayout.astro';
import css from '${relativo}styles/pages/legal.css?raw';
---
<MarcaLayout
  title="${P.titulo}"
  description="${P.desc}"
  lang="${P.lang}"
  altUrl="${P.alt}"
  ruta="${P.ruta}"
  pageCss={css} scripts={["/js/frescura.js"]}>
  <article class="article wrap legal">
      ${aHtml(md)}

      <p class="sello-fuente">${P.lang === "es"
        ? "Texto publicado desde su documento aprobado"
        : "Published from its approved source document"} ·
        <code>sha256:${sha.slice(0, 16)}…</code></p>
  </article>
</MarcaLayout>
`;
  }

  const destino = join(RAIZ, P.salida);
  if (VERIFICAR) {
    if (readFileSync(destino, "utf8") !== pagina) {
      console.error(`FALLA: ${P.salida} no coincide con el texto aprobado.\n` +
        "       Alguien edito el .astro a mano, o cambio el .md sin regenerar.");
      process.exit(1);
    }
    console.log(`  ok  ${P.ruta.padEnd(18)} ${P.md}`);
  } else {
    writeFileSync(destino, pagina);
    escritas++;
    console.log(`  ${P.ruta.padEnd(18)} <- ${P.md}  sha256:${sha.slice(0, 12)}…`);
  }
}
console.log(VERIFICAR
  ? `\n  ${PAGINAS.length} de ${PAGINAS.length} coinciden con su texto aprobado`
  : `\n  ${escritas} de ${PAGINAS.length} paginas generadas`);
