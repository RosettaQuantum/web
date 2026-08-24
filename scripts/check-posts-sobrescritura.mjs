#!/usr/bin/env node
/**
 * El migrador de posts no pisa una edicion viva sin decirlo.
 *
 * EL DEFECTO (auditoria del 2026-08-24, superficie 1.1). Dos escritores sobre la tabla
 * `posts`, y el que pierde es el que el propio codigo recomienda:
 *
 *   - `worker.js` declara que **D1 manda sobre el estatico: es la copia viva y editable
 *     sin push**. O sea que editar un post directamente en D1 es el camino sancionado.
 *   - `migrate-posts-to-d1.mjs` hace `INSERT OR REPLACE INTO posts` con el cuerpo sacado
 *     del `.md` commiteado, **sobre todos los posts, sin filtrar y sin comparar**.
 *
 * Correr el migrador despues de editar en D1 borra la edicion viva **sin conflicto, sin
 * aviso y sin respaldo**. Es la misma forma que nos costo dos despliegues esta manana con
 * el Worker: dos fuentes de verdad sobre la misma superficie, y el ultimo que escribe
 * gana en silencio. El `--dry` existe, pero es opt-in: un candado que hay que acordarse
 * de poner no es un candado.
 *
 * QUE HACE ESTE GUARDIA, Y QUE NO. **No decide quien tiene razon, porque no puede.** Si
 * la fila de D1 difiere de lo que el `.md` produciria, hay dos explicaciones y desde aca
 * son indistinguibles: alguien edito el post en D1, o alguien edito el markdown para
 * publicarlo. Adivinar seria peor que no mirar.
 *
 * Lo que hace es **negarse a decidirlo en silencio**: separa los posts en nuevos
 * (seguros), identicos (nada que hacer) y divergentes (alguien pierde trabajo), reporta
 * cuales y en que campos, y **no escribe los divergentes salvo que se lo pidan a
 * proposito**. Los nuevos entran igual, porque ahi no hay nada que pisar.
 *
 * Es la regla de los datos de salud aplicada al contenido: antes de borrar, comprueba que
 * lo que queda contiene lo que se va. Si no lo contiene, decide una persona.
 *
 * Uso:
 *   node scripts/check-posts-sobrescritura.mjs --self-test
 *   (el migrador lo usa; ver migrate-posts-to-d1.mjs)
 */

/** Campos que el migrador escribe y que, por tanto, puede pisar. */
export const CAMPOS = ["slug_base", "lang", "title", "tldr", "date", "pillar", "sources_json", "body_html"];

/**
 * Separa lo que se va a escribir en tres grupos.
 *
 * @param {{generado: object[], enD1: object[]}} ctx
 *   generado: filas que el migrador produjo desde los .md + dist/
 *   enD1: filas que hoy existen en la tabla
 * @returns {{nuevos: object[], iguales: object[], divergentes: {id:string,campos:string[]}[], vistos:number}}
 */
export function clasificar({ generado, enD1 }) {
  const indice = new Map((enD1 ?? []).map((r) => [r.id, r]));
  const nuevos = [], iguales = [], divergentes = [];

  for (const g of generado ?? []) {
    const actual = indice.get(g.id);
    if (!actual) { nuevos.push(g); continue; }

    const campos = CAMPOS.filter((c) => {
      const a = actual[c], b = g[c];
      // null y "" son lo mismo para esta comparacion: D1 devuelve null donde el
      // generador produce cadena vacia, y tratarlos como distintos marcaria divergente
      // a todo post con un campo vacio. Un falso positivo aca retiene publicaciones
      // buenas, que es peor que dejar pasar un caso.
      return (a ?? "") !== (b ?? "");
    });

    if (campos.length) divergentes.push({ id: g.id, campos });
    else iguales.push(g);
  }

  return { nuevos, iguales, divergentes, vistos: (generado ?? []).length };
}

/**
 * ¿Puede escribir el migrador, y que exactamente?
 *
 * @param {{clasificacion: object, sobrescribir: boolean}} ctx
 */
export function decidir({ clasificacion, sobrescribir }) {
  const { nuevos, divergentes } = clasificacion;
  if (sobrescribir) {
    return { escribir: [...nuevos, ...divergentes.map((d) => d.id)], bloqueado: false };
  }
  return {
    escribir: nuevos,
    bloqueado: divergentes.length > 0,
    motivo: divergentes.length
      ? `${divergentes.length} post(s) difieren de lo que hay en D1: escribirlos borraria la version viva.`
      : undefined,
  };
}

// ── self-test ────────────────────────────────────────────────────────────────────────────
if (process.argv.includes("--self-test")) {
  const post = (id, extra = {}) => ({
    id, slug_base: "s", lang: "en", title: "T", tldr: "t", date: "2026-01-01",
    pillar: "1", sources_json: "[]", body_html: "<p>a</p>", ...extra,
  });

  const casos = [
    ["CALLA: nada cambio", () => {
      const c = clasificar({ generado: [post("a")], enD1: [post("a")] });
      return c.iguales.length === 1 && c.divergentes.length === 0;
    }],
    ["CALLA: un post nuevo entra sin bloquear (no hay nada que pisar)", () => {
      const c = clasificar({ generado: [post("b")], enD1: [] });
      const d = decidir({ clasificacion: c, sobrescribir: false });
      return c.nuevos.length === 1 && d.bloqueado === false && d.escribir.length === 1;
    }],
    ["grita: el cuerpo difiere — alguien pierde trabajo", () => {
      const c = clasificar({ generado: [post("a")], enD1: [post("a", { body_html: "<p>editado en D1</p>" })] });
      return c.divergentes.length === 1 && c.divergentes[0].campos.includes("body_html");
    }],
    ["grita: dice EN QUE campos difiere, no solo que difiere", () => {
      const c = clasificar({ generado: [post("a")], enD1: [post("a", { title: "otro", tldr: "otro" })] });
      const ca = c.divergentes[0].campos;
      return ca.includes("title") && ca.includes("tldr") && !ca.includes("body_html");
    }],
    ["bloquea la escritura de los divergentes por defecto", () => {
      const c = clasificar({ generado: [post("a")], enD1: [post("a", { body_html: "x" })] });
      const d = decidir({ clasificacion: c, sobrescribir: false });
      return d.bloqueado === true && d.escribir.length === 0;
    }],
    ["pero los nuevos SI entran aunque otro sea divergente", () => {
      const c = clasificar({
        generado: [post("a"), post("nuevo")],
        enD1: [post("a", { body_html: "x" })],
      });
      const d = decidir({ clasificacion: c, sobrescribir: false });
      return d.escribir.length === 1 && d.escribir[0].id === "nuevo";
    }],
    ["CALLA con --sobrescribir: es una decision explicita, no un descuido", () => {
      const c = clasificar({ generado: [post("a")], enD1: [post("a", { body_html: "x" })] });
      return decidir({ clasificacion: c, sobrescribir: true }).bloqueado === false;
    }],
    // Precision sobre cobertura: si null y "" contaran como distintos, TODO post con un
    // campo vacio saldria divergente y el guardia retendria publicaciones buenas.
    ["CALLA: null en D1 y cadena vacia en el generador son lo mismo", () => {
      const c = clasificar({ generado: [post("a", { tldr: "" })], enD1: [post("a", { tldr: null })] });
      return c.divergentes.length === 0;
    }],
    ["reporta denominador", () => {
      const c = clasificar({ generado: [post("a"), post("b"), post("c")], enD1: [post("a")] });
      return c.vistos === 3 && c.nuevos.length + c.iguales.length + c.divergentes.length === 3;
    }],
  ];

  let fallos = 0;
  for (const [nombre, fn] of casos) {
    let paso; try { paso = fn(); } catch { paso = false; }
    console.log(`${paso ? "ok  " : "FALLA"}  ${nombre}`);
    if (!paso) fallos++;
  }
  console.log(`\n[posts] self-test: ${casos.length - fallos} de ${casos.length} pasaron.`);
  process.exit(fallos ? 1 : 0);
}
