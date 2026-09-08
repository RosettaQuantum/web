/**
 * Quita los comentarios de una hoja ANTES de inyectarla en la página.
 *
 * POR QUE: las hojas de este repo llevan el por qué de cada regla —de dónde salió el
 * defecto, quién lo decidió, qué mina desarma— y esas hojas se sirven INLINE. Medido el
 * 7-sep sobre dist/: 56 archivos contenían "mina nº" y 55 "Cowork". Notas internas, en
 * la página, para cualquiera. El comentario se queda en el archivo fuente, que es donde
 * sirve; lo que viaja es CSS.
 *
 * Sólo bloques `/* … *\/`. No se tocan comentarios de línea ni nada dentro de un string:
 * un limpiador agresivo sobre código que se sirve es peor que la fuga que arregla.
 */
export function sinComentarios(css) {
  return String(css)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
