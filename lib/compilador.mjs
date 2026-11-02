/**
 * El Compilador: convierte un pedido validado en un `config` ejecutable, o lo rechaza
 * con una razon que nombra el campo.
 *
 * ES LA PIEZA P1 del SPEC-04 §4, y existe por un defecto medido en produccion: hoy
 * `POST /v1/jobs` con `params: {"esto_no_existe": 123}` devuelve un PLAN. La Puerta
 * declara ese punto ciego ella misma —«valida la forma de la peticion, no su sentido»—
 * y nombra a esta etapa como la que lo cierra. Esto la cierra.
 *
 * QUE AGREGA SOBRE LA PUERTA, y es todo lo que agrega:
 *   1. valida `params` campo por campo contra el `params_schema` de la receta;
 *   2. exige que la receta este en estado `sellable` para poder pedirse;
 *   3. no deja pedir un veredicto sobre una receta que no puede juzgar (`scorable: 0`);
 *   4. produce el `config` que el ejecutor correria — que es su trabajo de verdad.
 *
 * QUE NO HACE, declarado aqui y no en un documento aparte:
 *   - NO ejecuta. Sigue sin existir quien lo haga (P2, decision D-1).
 *   - NO cobra ni conoce cuentas.
 *   - NO juzga si el experimento vale la pena. Eso es de una persona.
 *
 * Sin dependencias a proposito: el mismo archivo corre en el Worker, en node (MCP) y en
 * el navegador (la landing). Una definicion que vive en tres lugares ya divergio.
 */

/** Codigos de rechazo. Son CONTRATO PUBLICO: se agregan, no se renombran. */
export const RECHAZOS = {
  UNKNOWN_RECIPE: { http: 404,
    dice: "that recipe is not in the catalogue",
    detalle: "Check the recipe id. GET /v1/recipes lists the published recipes; being listed does not make a recipe orderable." },
  RECIPE_NOT_SELLABLE: { http: 409,
    dice: "that recipe exists but cannot be ordered yet",
    detalle: "A recipe is orderable only in state 'sellable'. The reply names what it is still missing." },
  INVALID_PARAMS: { http: 422,
    dice: "the request has parameters this recipe does not accept, or values outside its range",
    detalle: "Every offending field is listed in fields. Nothing was run and nothing was charged." },
  NOT_SCORABLE: { http: 409,
    dice: "a verdict was requested on a recipe that cannot judge",
    detalle: "This recipe has no reference truth, so it can only return a PREDICTION, never a VERDICT." },
};

const esObjeto = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/**
 * Valida un valor contra un subconjunto de JSON Schema: el que las recetas usan de
 * verdad. Deliberadamente parcial, y lo dice: un validador que finge cubrir el
 * estandar entero es peor que uno que declara su alcance.
 * Cubre: type, enum, const, required, additionalProperties, minimum/maximum,
 * minItems/maxItems, uniqueItems, items.
 */
function validar(valor, esquema, ruta, fallas) {
  const falla = (que) => fallas.push({ campo: ruta || "(raiz)", problema: que });

  if (esquema.const !== undefined && valor !== esquema.const) {
    return falla(`tiene que ser exactamente ${JSON.stringify(esquema.const)}`);
  }
  if (esquema.enum && !esquema.enum.some((e) => e === valor)) {
    return falla(`no es uno de ${JSON.stringify(esquema.enum)}`);
  }

  switch (esquema.type) {
    case "object": {
      if (!esObjeto(valor)) return falla("tiene que ser un objeto");
      for (const req of esquema.required || []) {
        if (valor[req] === undefined) fallas.push({ campo: ruta ? `${ruta}.${req}` : req, problema: "falta y es obligatorio" });
      }
      // EL CASO QUE ESTO EXISTE PARA CAZAR: un campo que sobra.
      if (esquema.additionalProperties === false) {
        for (const k of Object.keys(valor)) {
          if (!(esquema.properties || {})[k]) {
            fallas.push({ campo: ruta ? `${ruta}.${k}` : k,
              problema: "esta receta no acepta este campo",
              acepta: Object.keys(esquema.properties || {}) });
          }
        }
      }
      for (const [k, sub] of Object.entries(esquema.properties || {})) {
        if (valor[k] !== undefined) validar(valor[k], sub, ruta ? `${ruta}.${k}` : k, fallas);
      }
      return;
    }
    case "array": {
      if (!Array.isArray(valor)) return falla("tiene que ser una lista");
      if (esquema.minItems !== undefined && valor.length < esquema.minItems) falla(`necesita al menos ${esquema.minItems} elementos`);
      if (esquema.maxItems !== undefined && valor.length > esquema.maxItems) falla(`admite como máximo ${esquema.maxItems} elementos`);
      if (esquema.uniqueItems && new Set(valor.map((v) => JSON.stringify(v))).size !== valor.length) falla("no admite repetidos");
      if (esquema.items) valor.forEach((v, i) => validar(v, esquema.items, `${ruta}[${i}]`, fallas));
      return;
    }
    case "integer":
    case "number": {
      if (typeof valor !== "number" || Number.isNaN(valor)) return falla("tiene que ser un número");
      if (esquema.type === "integer" && !Number.isInteger(valor)) return falla("tiene que ser entero");
      if (esquema.minimum !== undefined && valor < esquema.minimum) falla(`no puede ser menor que ${esquema.minimum}`);
      if (esquema.maximum !== undefined && valor > esquema.maximum) falla(`no puede ser mayor que ${esquema.maximum}`);
      return;
    }
    case "boolean":
      if (typeof valor !== "boolean") falla("tiene que ser true o false");
      return;
    case "string":
      if (typeof valor !== "string") falla("tiene que ser texto");
      return;
    default:
      return; // sin `type`, enum/const ya decidieron
  }
}

/** Rellena los `default` declarados por el esquema. Lo que se completa se DICE. */
function completar(params, esquema) {
  const config = { ...params };
  const puestos = [];
  for (const [k, sub] of Object.entries(esquema.properties || {})) {
    if (config[k] === undefined && sub.default !== undefined) { config[k] = sub.default; puestos.push(k); }
    if (config[k] === undefined && sub.const !== undefined) { config[k] = sub.const; puestos.push(k); }
  }
  return { config, puestos };
}

/**
 * @param {{pedido:object, receta:object|null, exige_veredicto?:boolean}} ctx
 * @returns rechazo, o `{status:"plan", ...}` con el config que correria el ejecutor.
 */
export function compilar({ pedido, receta, exige_veredicto = false }) {
  const no = (code, extra = {}) => ({
    status: "rejected", code, http: RECHAZOS[code].http,
    reason: RECHAZOS[code].dice, detail: RECHAZOS[code].detalle, ...extra,
  });

  if (!receta) return no("UNKNOWN_RECIPE", { requested: pedido?.receta ?? null });

  if (receta.estado !== "sellable") {
    return no("RECIPE_NOT_SELLABLE", {
      recipe: receta.id, state: receta.estado,
      // La razon viaja con el rechazo: un 409 que no dice que falta obliga a preguntar.
      missing: receta._por_que_no_es_sellable || "la receta no declara qué le falta",
    });
  }

  if (exige_veredicto && !receta.promesa?.scorable) {
    return no("NOT_SCORABLE", { recipe: receta.id, returns: "PREDICTION" });
  }

  const esquema = receta.pedido?.params_schema;
  if (!esquema) return no("RECIPE_NOT_SELLABLE", { recipe: receta.id, missing: "la receta no declara qué parámetros acepta" });

  const fallas = [];
  validar(pedido?.params ?? {}, esquema, "", fallas);
  if (fallas.length) return no("INVALID_PARAMS", { recipe: receta.id, fields: fallas });

  const { config, puestos } = completar(pedido.params ?? {}, esquema);
  return {
    status: "plan",
    recipe: receta.id,
    recipe_version: receta.version,
    config,
    defaults_applied: puestos,
    emits: receta.promesa?.scorable ? "VERDICT" : "PREDICTION",
    arbiter: receta.promesa?.arbitro ?? null,
    gates: receta.ejecucion?.contrato_ejecutor?.compuertas ?? [],
    // Las dos cosas que este plan NO dice, dichas aqui y no en la documentacion.
    not_executed: "compiled only: no work was queued, no quota was consumed and nothing was written",
    estimated_cost: null,
    why_no_cost: "no measured tariff exists yet; an invented cost is worse than none",
  };
}
