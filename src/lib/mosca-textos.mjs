// Textos NUEVOS del gráfico interactivo «Sume los años» (25-nov-2026): los rótulos de los controles, el
// veredicto y la tabla para lector de pantalla.
//
// APROBADOS el 25-nov-2026; el título del veredicto pasó el mismo día a uno fijo y neutro («Línea de
// tiempo de protección»), para que no suene a alarma: la frase de abajo es la que da el dato.
// APROBADOS el 25-nov-2026 (sellados en src/data/q-ready/textos-aprobados/TEXTOS-mosca-2026-11-25.md,
// vigilados por check-textos-aprobados). La tabla es ↔ en se genera de este
// archivo (node scripts/textos-mosca.mjs → docs/textos-provisorios-mosca.md), para que lo que se apruebe
// sea literalmente lo que se sirve. Van aparte de src/lib/puerta-textos.mjs a propósito: ése está
// sellado (TEXTOS-q-ready-en-2026-11-23.md, `--verificar` en prebuild) y un texto nuevo es una
// aprobación nueva, no una edición de la ya aprobada. Los textos que el gráfico ya tenía (Migrar,
// Seguir secreto, Amenaza, «necesita protección hasta ‹año›», la descripción, el pie) siguen saliendo
// de puerta-textos.mjs sin cambiar una letra.
//
// Los marcadores ‹…› se llenan en orden de aparición (public/js/mosca-nucleo.mjs → llenar). En las
// líneas del veredicto: ‹año› es hasta cuándo necesita protección, ‹h› el año del horizonte y ‹p› el
// rótulo publicado de la encuesta («≥51%»), tal cual viene del informe.
export const PROVISORIO = false;

export const TEXTOS_MOSCA = {
  es: {
    etSecreto: "Años que sus datos deben seguir secretos",
    etMigracion: "Años que le toma migrar",
    anioUno: "1 año",
    tarde: "Línea de tiempo de protección",
    aTiempo: "Línea de tiempo de protección",
    lineaTarde: "Necesita protección hasta ‹año›. Hacia ‹h›, los expertos ya estiman ‹p›.",
    lineaMasAlla: "Necesita protección hasta ‹año›, más allá del último horizonte que mide la encuesta (‹h›: ‹p›).",
    lineaATiempo: "Necesita protección hasta ‹año›, antes del primer horizonte que estima la encuesta (‹h›: ‹p›).",
    reset: "Volver al perfil de ejemplo",
    sinEstimacion: "sin estimación",
    tablaCaption: "Probabilidad estimada de la amenaza, por horizonte",
    tablaHorizonte: "Horizonte",
    tablaProb: "Probabilidad estimada",
  },
  en: {
    etSecreto: "Years your data must stay secret",
    etMigracion: "Years it takes you to migrate",
    anioUno: "1 year",
    tarde: "Protection timeline",
    aTiempo: "Protection timeline",
    lineaTarde: "You need protection until ‹año›. By ‹h›, experts already estimate ‹p›.",
    lineaMasAlla: "You need protection until ‹año›, beyond the last horizon the survey measures (‹h›: ‹p›).",
    lineaATiempo: "You need protection until ‹año›, before the first horizon the survey estimates (‹h›: ‹p›).",
    reset: "Back to the example profile",
    sinEstimacion: "no estimate",
    tablaCaption: "Estimated probability of the threat, by horizon",
    tablaHorizonte: "Horizon",
    tablaProb: "Estimated probability",
  },
};
