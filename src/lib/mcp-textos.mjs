// Textos del MCP que lee una persona o un agente (24-nov-2026).
//
// APROBADOS por Nicholas el 24-nov-2026 (textos 1 y 3, ES y EN tal cual); sellados en
// src/data/q-ready/textos-aprobados/TEXTOS-mcp-2026-11-24.md y vigilados por check-textos-aprobados: un byte
// distinto aquí o en la copia sellada detiene el build. Un texto nuevo es una aprobación nueva.
//   medir    → la descripción de medir_exposicion_pqc (api.js; hoy sólo se sirve el español)
//   registro → GET /mcp (es, con mayúscula inicial) y /api-docs (en)
export const TEXTOS_MCP = {
  es: {
    medir: "y la nota Q-Ready (A+ a F, QREADY-NOTA-2.1; QEX en su versión vigente, QEX-1.2). Si el dueño verificó el dominio, la letra es la misma de su sello. `ficha_url` abre la ficha del dominio en la web; `informe_pqc`, el informe PQC mensual publicado.",
    registro: "la medición y la verificación dejan un registro de uso; lo demás es sólo lectura",
  },
  en: {
    medir: "and the Q-Ready grade (A+ to F, QREADY-NOTA-2.1; QEX at its current version, QEX-1.2). If the owner verified the domain, the grade matches its seal. `ficha_url` opens the domain's sheet on the web; `informe_pqc`, the published monthly PQC report.",
    registro: "measurement and verification log usage; everything else is read-only",
  },
};
export const mayuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);
