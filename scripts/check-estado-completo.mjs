#!/usr/bin/env node
/**
 * Guardia de /v1/state y de las erratas.
 *
 * POR QUE EXISTE
 * --------------
 * `estado_medido` reportaba 4 categorias de las 8 que la propia tabla `run_archives`
 * ya contaba (RUN, PREREG, RECIPE, VERDICT — con MANIFEST, PREDICTION, REPORT y ERRATA
 * invisibles). No era un bug de conteo: `cuenta` ya traia los ocho numeros desde la
 * misma consulta GROUP BY, y nadie los sacaba de ahi hacia la vitrina. Es la misma
 * clase de defecto que el comentario de /v1/predictions ya nombraba: "un tipo nuevo
 * que solo responde por /v1/archive/{id} queda publicado e invisible".
 *
 * Y una errata que SI se muestra pero sin decir a que sello corrige no prueba nada:
 * la promesa es "el original queda intacto y consultable" (CLAUDE.md Rosetta 1 bis),
 * asi que este chequeo, en modo --esperar, comprueba de verdad que ese ID original
 * responde 200.
 *
 * Uso:
 *   node scripts/check-estado-completo.mjs --self-test   # unidad, sin red
 *   node scripts/check-estado-completo.mjs --esperar 60  # contra produccion
 */
import { estado, resumenArchivo } from "../api.js";

let ok = 0, mal = 0;
const prueba = (nombre, cond, detalle = "") => {
  if (cond) { ok++; console.log(`  ok   ${nombre}`); }
  else { mal++; console.log(`  FALLA ${nombre}${detalle ? "\n         " + detalle : ""}`); }
};

// ------------------------------------------------------------- fixture de D1 falso
// Los ocho tipos reales medidos en produccion el 2026-08-21 (RQ D1 rosettaq-ledger,
// GROUP BY type): RUN 86, PREREG 10, VERDICT 1, RECIPE 4, MANIFEST 3, PREDICTION 1,
// REPORT 5, ERRATA 1. El fixture usa esos mismos numeros para que un lector que
// compare este archivo contra la consulta real vea que no son inventados.
function dbFalsa(filas) {
  return {
    DB: {
      // `prepare()` real devuelve un statement que `batch()` ejecuta; aca alcanza con
      // devolver la SQL misma, porque el `batch()` falso de abajo no la mira — resuelve
      // por posicion, en el mismo orden en que `estado()` arma el arreglo.
      prepare: (sql) => sql,
      batch: async (stmts) => stmts.map((_, i) => {
        if (i === 0) return { results: filas };
        if (i === 1) return { results: [] };                 // recetas
        if (i === 2) return { results: [{ n: 1 }] };          // veredictos publicados
        if (i === 3) return { results: [{ n: 0 }] };          // victorias
        return { results: [] };
      }),
    },
  };
}

const FILAS_REALES = [
  { type: "RUN", n: 86 }, { type: "PREREG", n: 10 }, { type: "VERDICT", n: 1 },
  { type: "RECIPE", n: 4 }, { type: "MANIFEST", n: 3 }, { type: "PREDICTION", n: 1 },
  { type: "REPORT", n: 5 }, { type: "ERRATA", n: 1 },
];

const st = await estado(dbFalsa(FILAS_REALES));
const em = st.estado_medido;

prueba("corridas_selladas sigue leyendo RUN", em.corridas_selladas === 86);
prueba("pre_registros sigue leyendo PREREG", em.pre_registros === 10);
prueba("recetas sigue leyendo RECIPE", em.recetas === 4);
// Las cuatro que faltaban — el caso que este guardia existe para cazar.
prueba("manifiestos aparece y cuenta MANIFEST", em.manifiestos === 3);
prueba("predicciones aparece y cuenta PREDICTION", em.predicciones === 1);
prueba("reportes aparece y cuenta REPORT", em.reportes === 5);
prueba("erratas aparece y cuenta ERRATA", em.erratas === 1);

// El caso de silencio (§4 bis): un tipo AUSENTE en la fila de D1 tiene que leerse 0,
// nunca `undefined` ni desaparecer del objeto — es la misma regla que ya protege a
// pre_registros/recetas mas arriba, ejercida contra los cuatro campos nuevos.
const stVacio = await estado(dbFalsa([{ type: "RUN", n: 86 }]));
prueba("un tipo ausente en D1 se lee 0, no undefined",
  [stVacio.estado_medido.manifiestos, stVacio.estado_medido.predicciones,
    stVacio.estado_medido.reportes, stVacio.estado_medido.erratas].every(v => v === 0),
  JSON.stringify(stVacio.estado_medido));

// ------------------------------------------------------- resumenArchivo() de una errata
// Fixture con la MISMA forma que RQ-ERRATA-POC-QPU-001 (evidence/reports/2026/08/…),
// no inventada: meta.type, meta.scope_note, meta.corrige.{file_id,content_hash} y
// w6.que.afirmacion_corregida son los cuatro campos reales de ese archivo.
const filaErrata = {
  file_id: "RQ-ERRATA-POC-QPU-001", type: "ERRATA", recipe_id: null,
  is_demo: 0, archived_at: "2026-08-21T18:34:29+00:00",
  content_hash: "sha256:2275b61b", github_url: "https://x", codeberg_url: "https://y",
  payload: JSON.stringify({
    meta: { type: "ERRATA", scope_note: "no reescribe el original",
      corrige: { file_id: "RQ-POC-QPU-001", content_hash: "sha256:d026eddc" } },
    w6: { que: { afirmacion_corregida: "61.4% de los disparos sobrevive; la estructura no." } },
  }),
};
const resErrata = resumenArchivo(filaErrata);
prueba("una fila ERRATA expone .errata.corrige_id", resErrata.errata?.corrige_id === "RQ-POC-QPU-001");
prueba("una fila ERRATA expone .errata.corrige_hash", resErrata.errata?.corrige_hash === "sha256:d026eddc");
prueba("una fila ERRATA expone .errata.afirmacion_corregida",
  resErrata.errata?.afirmacion_corregida?.includes("61.4%"));

// Caso de silencio: una fila RUN normal NO debe traer `.errata` — su ausencia declara
// "no aplica", no "no medido". Si esto grita, el guardia de arriba esta leyendo prosa
// en vez de mirar meta.type, exactamente el defecto de la 4 bis.
const filaRun = { file_id: "RQ-0012-001", type: "RUN", recipe_id: "RQ-0012",
  is_demo: 0, archived_at: "2026-08-01", content_hash: "sha256:aa", github_url: "", codeberg_url: "",
  payload: JSON.stringify({ w6: { que: { problem_class: "portfolio" } } }) };
prueba("una fila RUN normal no trae .errata", resumenArchivo(filaRun).errata === undefined);

console.log(`\n${ok} pasaron, ${mal} fallaron`);

// -------------------------------------------------------------- --esperar produccion
if (process.argv.includes("--esperar")) {
  const SITE = "https://rosettaquantum.com";
  console.log("\n-- contra produccion --");
  let okv = 0, malv = 0;
  const pv = (n, c, d = "") => { if (c) { okv++; console.log(`  ok   ${n}`); } else { malv++; console.log(`  FALLA ${n}${d ? "\n         " + d : ""}`); } };

  const est = await (await fetch(SITE + "/v1/state")).json();
  const campos = ["corridas_selladas", "veredictos_publicados", "pre_registros", "recetas",
    "manifiestos", "predicciones", "reportes", "erratas", "victorias_cuanticas_medidas"];
  for (const c of campos) {
    pv(`/v1/state.estado_medido.${c} es un entero >= 0`,
      Number.isInteger(est.estado_medido?.[c]) && est.estado_medido[c] >= 0,
      `valor: ${JSON.stringify(est.estado_medido?.[c])}`);
  }

  const err = await (await fetch(SITE + "/v1/erratas")).json();
  pv("/v1/erratas responde con filtro.tipo=ERRATA", err.filtro?.tipo === "ERRATA");
  pv(`/v1/erratas.total coincide con estado_medido.erratas (${est.estado_medido?.erratas})`,
    err.total === est.estado_medido?.erratas,
    `erratas.total=${err.total} vs estado_medido.erratas=${est.estado_medido?.erratas}`);

  // La promesa central de una errata: el original que corrige sigue vivo y consultable.
  for (const item of (err.items || [])) {
    if (!item.errata?.corrige_id) continue;
    const r = await fetch(SITE + "/v1/archive/" + encodeURIComponent(item.errata.corrige_id));
    pv(`el original que corrige ${item.id} (${item.errata.corrige_id}) sigue respondiendo 200`,
      r.status === 200, `respondio ${r.status}`);
  }

  const rep = await (await fetch(SITE + "/v1/reports")).json();
  pv("/v1/reports responde con filtro.tipo=REPORT", rep.filtro?.tipo === "REPORT");

  console.log(`\n${okv} pasaron, ${malv} fallaron (produccion)`);
  if (malv) process.exit(1);
}

process.exit(mal ? 1 : 0);
