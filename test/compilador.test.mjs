/**
 * Pruebas del Compilador. La regla de la casa: por cada regla, un caso que GRITA y uno
 * que SE CALLA — y el que se calla se lee dos veces, porque un guardia ruidoso pasa
 * todas las pruebas de gritar.
 *
 * Uso: node test/compilador.test.mjs
 */
import { compilar } from "../lib/compilador.mjs";
import { readFileSync } from "node:fs";

const REAL = JSON.parse(readFileSync(new URL("../recetas/qksvm-multiclase.json", import.meta.url)));
// La misma receta, pero vendible: hoy ninguna lo es, y sin esta copia no se podria
// probar nada mas alla de la primera compuerta.
const VENDIBLE = { ...REAL, estado: "sellable" };
const ok = { receta: "RQ-M1-QKSVM", params: { datasets: ["Iris"] } };

let pasaron = 0, fallaron = 0, saltados = 0;
const caso = (nombre, fn) => {
  let r;
  try { r = fn(); } catch (e) { r = "EXCEPCION: " + e.message; }
  if (r === true) { pasaron++; console.log("  ok    " + nombre); }
  else { fallaron++; console.log("  FALLA " + nombre + "  ->  " + r); }
};

console.log("\nGRITAN (el defecto esta presente)");

caso("campo que sobra: lo RECHAZA y lo NOMBRA", () => {
  const r = compilar({ pedido: { receta: "RQ-M1-QKSVM", params: { datasets: ["Iris"], esto_no_existe: 123 } }, receta: VENDIBLE });
  if (r.status !== "rejected" || r.code !== "INVALID_PARAMS") return "no rechazo: " + r.status + "/" + r.code;
  const f = r.fields.find((x) => x.campo === "esto_no_existe");
  return f ? true : "rechazo pero no nombro el campo: " + JSON.stringify(r.fields);
});

caso("valor fuera del enum: nombra el indice", () => {
  const r = compilar({ pedido: { receta: "RQ-M1-QKSVM", params: { datasets: ["Marte"] } }, receta: VENDIBLE });
  return r.code === "INVALID_PARAMS" && r.fields.some((f) => f.campo === "datasets[0]") ? true : JSON.stringify(r);
});

caso("falta un obligatorio", () => {
  const r = compilar({ pedido: { receta: "RQ-M1-QKSVM", params: { contexto: true } }, receta: VENDIBLE });
  return r.code === "INVALID_PARAMS" && r.fields.some((f) => f.campo === "datasets" && /obligatorio/.test(f.problema)) ? true : JSON.stringify(r);
});

caso("semilla distinta de la congelada: cambiarla es otro experimento", () => {
  const r = compilar({ pedido: { receta: "RQ-M1-QKSVM", params: { datasets: ["Iris"], semilla: 42 } }, receta: VENDIBLE });
  return r.code === "INVALID_PARAMS" && r.fields.some((f) => f.campo === "semilla") ? true : JSON.stringify(r);
});

caso("repeticiones fuera de rango", () => {
  const r = compilar({ pedido: { receta: "RQ-M1-QKSVM", params: { datasets: ["Iris"], repeticiones: 99 } }, receta: VENDIBLE });
  return r.code === "INVALID_PARAMS" && r.fields.some((f) => f.campo === "repeticiones") ? true : JSON.stringify(r);
});

caso("datasets repetidos", () => {
  const r = compilar({ pedido: { receta: "RQ-M1-QKSVM", params: { datasets: ["Iris", "Iris"] } }, receta: VENDIBLE });
  return r.code === "INVALID_PARAMS" ? true : JSON.stringify(r);
});

caso("receta inexistente", () => {
  const r = compilar({ pedido: { receta: "RQ-NO-EXISTE", params: {} }, receta: null });
  return r.code === "UNKNOWN_RECIPE" ? true : JSON.stringify(r);
});

caso("la receta REAL no es vendible, y el rechazo dice que le falta", () => {
  const r = compilar({ pedido: ok, receta: REAL });
  return r.code === "RECIPE_NOT_SELLABLE" && /ficha de requisitos/.test(r.missing) ? true : JSON.stringify(r);
});

caso("veredicto pedido sobre receta que no puede juzgar", () => {
  const sinArbitro = { ...VENDIBLE, promesa: { ...VENDIBLE.promesa, scorable: 0, arbitro: null } };
  const r = compilar({ pedido: ok, receta: sinArbitro, exige_veredicto: true });
  return r.code === "NOT_SCORABLE" && r.returns === "PREDICTION" ? true : JSON.stringify(r);
});

console.log("\nSE CALLAN (el defecto NO esta, y el guardia no debe gritar)");

caso("pedido minimo valido: devuelve plan", () => {
  const r = compilar({ pedido: ok, receta: VENDIBLE });
  return r.status === "plan" && r.emits === "VERDICT" && r.arbiter === "juez-v1" ? true : JSON.stringify(r);
});

caso("los defaults se aplican Y SE DECLARAN", () => {
  const r = compilar({ pedido: ok, receta: VENDIBLE });
  if (r.status !== "plan") return JSON.stringify(r);
  if (r.config.semilla !== 20261026) return "no congelo la semilla";
  if (r.config.familias.length !== 4) return "no puso las 4 familias";
  return r.defaults_applied.includes("semilla") ? true : "los puso y no lo dijo: " + JSON.stringify(r.defaults_applied);
});

caso("los 6 datasets a la vez pasan", () => {
  const r = compilar({ pedido: { receta: "RQ-M1-QKSVM", params: { datasets: ["Iris","Tae","Penguin","Glass","Ecoli","Vowel"] } }, receta: VENDIBLE });
  return r.status === "plan" ? true : JSON.stringify(r);
});

caso("PARADOJICO: la receta MENCIONA el campo prohibido en una nota, y el pedido es valido", () => {
  // Si el validador leyera el texto de la receta en vez de la estructura del pedido,
  // esta nota lo haria gritar. Es el caso que caza al guardia que lee prosa.
  const conNota = JSON.parse(JSON.stringify(VENDIBLE));
  conNota.pedido.params_schema.properties.datasets._nota += " · un pedido con esto_no_existe se rechaza";
  const r = compilar({ pedido: ok, receta: conNota });
  return r.status === "plan" ? true : "grito por una nota: " + JSON.stringify(r);
});

caso("el plan declara que NO ejecuto y que no hay tarifa", () => {
  const r = compilar({ pedido: ok, receta: VENDIBLE });
  return /no work was queued/.test(r.not_executed) && r.estimated_cost === null ? true : JSON.stringify(r);
});

console.log("\nMUTACION (si el guardia no caza por la regla que dice, esto no falla)");

caso("sin additionalProperties:false, el campo que sobra DEBE pasar", () => {
  const flojo = JSON.parse(JSON.stringify(VENDIBLE));
  delete flojo.pedido.params_schema.additionalProperties;
  const r = compilar({ pedido: { receta: "RQ-M1-QKSVM", params: { datasets: ["Iris"], esto_no_existe: 123 } }, receta: flojo });
  // Si SIGUE rechazando, el rechazo venia de otra parte y la prueba de arriba no probaba nada.
  return r.status === "plan" ? true : "sigue rechazando sin la regla: el caso positivo no probaba lo que dice";
});

console.log(`\npasaron ${pasaron} · fallaron ${fallaron} · saltados ${saltados}`);
process.exit(fallaron ? 1 : 0);
