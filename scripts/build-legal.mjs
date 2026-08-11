#!/usr/bin/env node
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
 *   node scripts/build-legal.mjs             # genera las seis
 *   node scripts/build-legal.mjs --verificar # no escribe: compara con lo que hay
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const VERIFICAR = process.argv.includes("--verificar");

/**
 * Las seis, con el sha256 de la version que Nicholas aprobo el 2026-08-11
 * ("ok apruebo las tres, publicalas"). Los hashes vienen del HASHES.txt que
 * acompana la carpeta aprobada, y se comprobaron contra los archivos antes de copiar.
 */
export const PAGINAS = [
  { md: "terms-en.md",    salida: "src/pages/terms.astro",         ruta: "/terms/",           alt: "/es/terminos/",   lang: "en",
    sha: "1ae9d16c686bdd660e16006952036ef656b5822334a841a4a6aedcb14b0e439b",
    titulo: "Terms of Service — Rosetta Q",
    desc: "Terms of service for rosettaquantum.com, its public API and its measurement services." },
  { md: "privacy-en.md",  salida: "src/pages/privacy.astro",       ruta: "/privacy/",         alt: "/es/privacidad/", lang: "en",
    sha: "d5a51279a8aa5bbdebd55d8e9cf3d90d469eca30634dac07f68887b775e2b939",
    titulo: "Privacy Policy — Rosetta Q",
    desc: "What personal data Rosetta Quantum collects, why, and what rights you have over it." },
  { md: "refunds-en.md",  salida: "src/pages/refunds.astro",       ruta: "/refunds/",         alt: "/es/reembolsos/", lang: "en",
    sha: "7323b77f2f6f7ab9f12d922a5234dc71f69353c83abeedf90e734dba6a077719",
    titulo: "Refund Policy — Rosetta Q",
    desc: "When we refund in full, and why the result of a measurement is never grounds for a refund." },
  { md: "terms-es.md",    salida: "src/pages/es/terminos.astro",   ruta: "/es/terminos/",     alt: "/terms/",         lang: "es",
    sha: "fa320e43e80f12633c0d25e3e154b306eac2a5ec32b8f1d34814b3abacaf3d90",
    titulo: "Términos de servicio — Rosetta Q",
    desc: "Términos de servicio de rosettaquantum.com, su API pública y sus servicios de medición." },
  { md: "privacy-es.md",  salida: "src/pages/es/privacidad.astro", ruta: "/es/privacidad/",   alt: "/privacy/",       lang: "es",
    sha: "d4bf8c50968a82cfff76b6a009e912524d597a6d92751d9ca20d61ea4054b94d",
    titulo: "Política de privacidad — Rosetta Q",
    desc: "Qué datos personales recoge Rosetta Quantum, para qué, y qué derechos tienes sobre ellos." },
  { md: "refunds-es.md",  salida: "src/pages/es/reembolsos.astro", ruta: "/es/reembolsos/",   alt: "/refunds/",       lang: "es",
    sha: "47eefc17e7d158e237465e3a2affbdcaf207a3dee30416d3f3f0ad4abaeef1b3",
    titulo: "Política de reembolsos — Rosetta Q",
    desc: "Cuándo devolvemos el total, y por qué el resultado de una medición nunca da lugar a reembolso." },
];

const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const enlinea = s => esc(s)
  .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
  .replace(/`([^`]+)`/g, "<code>$1</code>")
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
  .replace(/\b([a-z0-9._%+-]+@rosettaquantum\.com)\b/g, '<a href="mailto:$1">$1</a>');

/** El subconjunto de markdown que estos seis documentos usan: h1, h2, vinnetas, parrafos. */
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

let escritas = 0;
for (const P of PAGINAS) {
  const ruta = join(RAIZ, "src/aprobado/legal", P.md);
  const bytes = readFileSync(ruta);
  const sha = createHash("sha256").update(bytes).digest("hex");
  if (sha !== P.sha) {
    console.error(`ABORTA: ${P.md} no es la version aprobada.\n` +
      `  aprobado: sha256:${P.sha}\n  en disco: sha256:${sha}\n` +
      `  Publicar esto seria publicar texto legal que nadie aprobo.`);
    process.exit(1);
  }
  const md = bytes.toString("utf8");

  // Falla cerrado contra un marcador de relleno. La direccion legal esta ausente a
  // proposito, y un "COMPLETA NICHOLAS" servido en la pagina que Paddle revisa seria
  // peor que la ausencia.
  // OJO con la insensibilidad a mayusculas: la primera version usaba /TODO/i y
  // marcaba la palabra espanola "todo", que aparece en cada parrafo. Un falso
  // positivo aca retiene texto legal aprobado y bloquea a Paddle — precision sobre
  // cobertura. Los marcadores van EN MAYUSCULAS y como palabra completa.
  const relleno = md.match(/COMPLETA NICHOLAS|\bTODO\b|\bXXX\b|\bTBD\b|\[pendiente\]|\[PENDING\]/);
  if (relleno) { console.error(`ABORTA: ${P.md} trae un marcador sin completar: "${relleno[0]}"`); process.exit(1); }

  const relativo = P.lang === "es" ? "../../" : "../";
  const pagina = `---
// GENERADO por scripts/build-legal.mjs — no editar a mano.
//
// El texto sale de src/aprobado/legal/${P.md}, aprobado por Nicholas el 2026-08-11,
// leido por el armador y no tecleado por nadie. Para cambiarlo se edita el .md, se
// mueve el sha en el armador y se regenera, en el mismo commit.
//
// texto fuente sha256: ${sha}
import BaseLayout from '${relativo}layouts/BaseLayout.astro';
import css from '${relativo}styles/pages/legal.css?raw';
---
<BaseLayout
  title="${P.titulo}"
  description="${P.desc}"
  lang="${P.lang}"
  altUrl="${P.alt}"
  pageCss={css}>
  <article class="article wrap legal">
      ${aHtml(md)}

      <p class="sello-fuente">${P.lang === "es"
        ? "Texto publicado desde su documento aprobado"
        : "Published from its approved source document"} ·
        <code>sha256:${sha.slice(0, 16)}…</code></p>
  </article>
</BaseLayout>
`;

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
