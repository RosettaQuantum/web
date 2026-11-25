#!/usr/bin/env node
// Genera docs/textos-provisorios-mosca.md desde src/lib/mosca-textos.mjs: la tabla español ↔ inglés de los
// textos NUEVOS del gráfico «Sume los años», para que lo que Nicholas apruebe sea literalmente lo que se sirve.
// Uso: node scripts/textos-mosca.mjs
import { writeFileSync } from "node:fs";
import { TEXTOS_MOSCA } from "../src/lib/mosca-textos.mjs";
const fila = (k) => `| \`${k}\` | ${TEXTOS_MOSCA.es[k]} | ${TEXTOS_MOSCA.en[k]} |`;
const md = `# Textos provisorios · gráfico «Sume los años» (/es/q-ready, /q-ready)

Generado por \`node scripts/textos-mosca.mjs\` desde \`src/lib/mosca-textos.mjs\`. **Ninguno está aprobado.**
Los textos que el gráfico ya tenía (Migrar, Seguir secreto, Amenaza, «necesita protección hasta ‹año›», la
descripción y el pie) no cambian y siguen en \`src/lib/puerta-textos.mjs\`.

Marcadores: ‹año› = hasta cuándo necesita protección; ‹h› = año del horizonte; ‹p› = rótulo publicado de la
encuesta («≥51%»).

| clave | español | inglés |
|---|---|---|
${Object.keys(TEXTOS_MOSCA.es).map(fila).join("\n")}

**Criterio del veredicto (también por aprobar):** «Ya va tarde» si el año hasta el que necesita protección llega
al primer horizonte que estima la encuesta; «Llega a tiempo» si vence antes.
`;
writeFileSync(new URL("../docs/textos-provisorios-mosca.md", import.meta.url), md);
console.log("docs/textos-provisorios-mosca.md");
