/**
 * Una hoja del sitio, reescrita para vivir DENTRO de un shadow root (17-nov-2026).
 *
 * Lo usa la barra y el pie del sitio que se inyectan en la guía PQC (src/components/BarraGuia.astro).
 * La guía trae su propio CSS con selectores desnudos (`*`, `body`, `a`, `h1`…) y el sitio el suyo
 * (`nav:not([class])`, `footer`, `.wrap`…). Dentro de un shadow root ninguna de las dos hojas
 * cruza la frontera: ni la barra se rompe ni la guía se desarma.
 *
 * Lo único que hay que traducir: dentro de la sombra no existen `:root`, `html` ni `body`. Los
 * tokens del sitio (`:root{--t-body…}`) y la base tipográfica del body pasan a `:host`. Sin esto,
 * `var(--t-label)` no resolvería —la guía no lo declara— y la barra caería a tamaños heredados.
 *
 * Sólo se reescriben selectores que son EXACTAMENTE `:root`, `html` o `body` dentro de una
 * lista; `body.algo` o `html[lang]` se dejan como están (no calzan en la sombra y no dañan).
 */
export function cssParaSombra(css) {
  return String(css).replace(/([^{}@;]+)\{/g, (todo, preludio) => {
    const partes = preludio.split(",");
    const nuevas = partes.map((p) => {
      const t = p.trim();
      return t === ":root" || t === "html" || t === "body" ? p.replace(t, ":host") : p;
    });
    return nuevas.join(",") + "{";
  });
}
