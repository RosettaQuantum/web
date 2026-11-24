// Textos NUEVOS del carrusel de publicaciones (24-nov-2026): el botón de pausa del avance automático, que
// exige WCAG 2.2.2 («Pausar, detener, ocultar») cuando algo se mueve solo más de 5 segundos.
//
// PROVISORIOS hasta que Nicholas los apruebe: docs/textos-provisorios-carrusel.md. Van aparte de
// src/lib/puerta-textos.mjs a propósito: ése está sellado (TEXTOS-q-ready-en-2026-11-23.md, `--verificar` en
// prebuild) y un texto nuevo es una aprobación nueva, no una edición de la ya aprobada.
//
// Las pestañas NO traen texto nuevo: usan las cejas que ya tienen las tarjetas («Informe PQC mensual» /
// «Guía de referencia», y sus pares aprobados en inglés).
export const TEXTOS_CARRUSEL = {
  es: { pausar: "Pausar", reanudar: "Reanudar" },
  en: { pausar: "Pause", reanudar: "Resume" },
};
