#!/usr/bin/env node
/**
 * Un rojo que sobrevive a un dia no puede pasar desapercibido — y el silencio tampoco.
 *
 * DE DONDE SALE (2026-08-25). Nicholas recibia por correo cada fallo de CI de los tres
 * repos: **201 alertas en 90 dias**, todas a la unica persona que no podia arreglarlas, y
 * **ninguna con su aviso de resolucion** — sólo la mitad roja de cada historia.
 *
 * El ruido tapo algo real: la «Auditoria del archivo» de `evidence` —el guardia que
 * vigila que los sellos no cambien— estuvo roja del 19 al 21 de agosto. Se arreglo. Pero
 * **si se hubiera quedado rota nadie lo habria notado, porque un rojo diario era
 * indistinguible de los otros doscientos.** Ese es el sistema que respalda lo que le
 * entregamos a un jurado.
 *
 * Desactivar el correo arregla que a Nicholas le lleguen sintomas que no puede actuar.
 * NO arregla que alguien mire: pasa de una alerta con el consumidor equivocado a una
 * alerta sin consumidor, **y la segunda se ve mejor**.
 *
 * SU CONSUMIDOR, declarado aqui y no en un documento aparte: **la sesion CTO**. A Nicholas
 * no le llega nunca, ni en el caso grave — eso sube por la sesion que coordina, ya
 * diagnosticado. Una alerta sin consumidor asignado no se crea.
 *
 * PRECISION SOBRE COBERTURA, y aqui es literal: sólo dispara con **mas de un dia en rojo
 * sobre la punta de `main`**. Un rojo del momento no dice nada —alguien esta trabajando—;
 * uno que sobrevive a un dia ya es informacion. Un falso positivo nos entrena a
 * ignorarlo, que es exactamente como se llego a 201 correos invisibles.
 *
 * ────────────────────────────────────────────────────────────────────────────────────────
 * EL LATIDO: quien vigila al vigilante
 * ────────────────────────────────────────────────────────────────────────────────────────
 * Un monitor que muere en silencio es PEOR que ninguno: fabrica confianza. Si deja de
 * correr, el resultado se ve identico a «todo verde».
 *
 * No se resuelve agregando otro vigilante —eso mueve la pregunta un piso—. Se resuelve
 * asi:
 *
 *  1. **El latido no es un artefacto nuevo: es el historial de corridas de GitHub.** La
 *     ultima corrida exitosa de este monitor ES el latido. Cero estado que mantener, y no
 *     puede divergir de la realidad porque ES la realidad. (Un latido en un archivo
 *     commiteado repetiria el error de la marca de tiempo de `ledger.json`: un archivo
 *     que sale modificado siempre es uno cuyos diffs la gente aprende a saltarse.)
 *
 *  2. **Lo comprueba el deploy de `web`, que corre por sus propias razones.** Si el
 *     monitor lleva mas de dos dias sin latir, **el deploy falla**. No depende de la
 *     disciplina de nadie: depende de la conveniencia del que puede arreglarlo. Eso es lo
 *     que corta el regreso infinito.
 *
 *  3. **El monitor confiesa sus propios huecos.** Cada corrida mira su corrida anterior;
 *     si el hueco supera lo esperado, lo reporta. Un monitor que resucita en silencio
 *     deja creer que vigilo todo ese tiempo.
 *
 * ────────────────────────────────────────────────────────────────────────────────────────
 * SU PUNTO CIEGO, declarado a proposito y no deducible: **si nadie despliega `web` Y el
 * monitor esta muerto, nada lo caza hasta el proximo deploy.** Es una ventana real. La
 * acota el punto 3 —el hueco se confiesa apenas el monitor vuelva— pero no la cierra.
 *
 * Y la causa mas probable de muerte silenciosa, verificada contra la documentacion de
 * GitHub el 2026-08-25: **«In a public repository, scheduled workflows are automatically
 * disabled when no repository activity has occurred in 60 days.»** `web` y `evidence` son
 * PUBLICOS, asi que les aplica; `quantum-run` es privado y no. Hoy `web` recibe push a
 * diario, asi que el riesgo es remoto — pero es exactamente el escenario de un repo que
 * se calma, y por eso queda escrito.
 *
 * Un monitor con un hueco declarado es honesto. Uno que promete cubrirlo todo fabrica
 * confianza, que es lo peor que puede hacer un monitor.
 *
 * LO QUE ESTE MONITOR **NO** DICE, y el nombre enganna: no dice «el CI esta sano», dice
 * «la punta de `main` esta sana». Un guardia roto en una rama de trabajo no lo ve. Es
 * correcto para lo que vigila —lo que respalda las entregas es `main`— pero en tres meses
 * alguien va a leer el nombre y suponer lo primero.
 *
 * Uso:
 *   node scripts/check-ci-salud.mjs                # revisa los repos activos
 *   node scripts/check-ci-salud.mjs --latido       # ¿sigue vivo el monitor? (lo usa deploy.yml)
 *   node scripts/check-ci-salud.mjs --self-test
 */
import { execSync } from "node:child_process";

// `quantum-run` guarda el motor de experimentos y el trabajo de Cleveland, entregado el
// 13-ago. Esta legitimamente DORMIDO, no abandonado — y dormido, sin vigilancia y
// cargando lo que respalda una entrega ya hecha es la peor combinacion de las tres: el
// perfil exacto del repo que nadie mira hasta que importa. Ser privado lo salva del
// apagado por inactividad, no de romperse en silencio.
const REPOS = ["RosettaQuantum/web", "RosettaQuantum/evidence", "RosettaQuantum/quantum-run"];
const UMBRAL_HORAS = 24;        // un rojo mas viejo que esto ya es informacion
const LATIDO_MAX_HORAS = 48;    // el monitor corre a diario: dos dias sin latir es que murio

const horas = (a, b) => (new Date(a) - new Date(b)) / 36e5;

/**
 * Estado de un repo a partir de su historial de corridas sobre `main`.
 *
 * @param {{corridas: {conclusion:string, createdAt:string}[], ahora: string, umbralHoras?: number}} ctx
 * @returns {{estado:"verde"|"rojo-fresco"|"rojo-persistente"|"recuperado"|"sin-datos", horasEnRojo?:number, vistas:number}}
 */
export function evaluarRepo({ corridas, ahora, umbralHoras = UMBRAL_HORAS }) {
  const orden = [...(corridas ?? [])]
    .filter((c) => c.conclusion === "success" || c.conclusion === "failure")
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));   // mas nueva primero

  if (!orden.length) return { estado: "sin-datos", vistas: 0 };

  const ultima = orden[0];
  const vistas = orden.length;

  if (ultima.conclusion === "success") {
    // Recuperado = la de antes habia fallado. Se AVISA: era la mitad que faltaba en las
    // 201 alertas — sin el cierre nadie distingue "sigue roto" de "se arreglo hace un mes".
    const previa = orden[1];
    if (previa && previa.conclusion === "failure") return { estado: "recuperado", vistas };
    return { estado: "verde", vistas };
  }

  // Esta en rojo. ¿Desde cuando? Desde la ultima vez que estuvo verde.
  const ultimoExito = orden.find((c) => c.conclusion === "success");
  const desde = ultimoExito ? ultimoExito.createdAt : orden[orden.length - 1].createdAt;
  const enRojo = horas(ahora, desde);

  return {
    estado: enRojo > umbralHoras ? "rojo-persistente" : "rojo-fresco",
    horasEnRojo: Math.round(enRojo),
    vistas,
  };
}

/**
 * ¿Hay guardias APAGADOS? No se infiere de la ausencia de corridas: se PREGUNTA.
 *
 * Un workflow deshabilitado deja de producir corridas, y «cero corridas nuevas» se ve
 * igual que «no ha habido cambios». Yo habia dado ese hueco por incerrable —cubierto por
 * la disciplina de avisar cuando alguien relaja un guardia— y la sesion que coordina hizo
 * notar lo obvio: **la API de Actions expone el `state` de cada workflow.** No hay que
 * deducirlo de un silencio; se consulta.
 *
 * Y distingue las dos causas, que piden respuestas distintas:
 *   disabled_inactivity  → GitHub lo apago solo tras 60 dias sin actividad (repos
 *                          PUBLICOS). Es la causa verificada de muerte silenciosa.
 *   disabled_manually    → alguien apago un guardia. Eso cambia la garantia que damos
 *                          hacia afuera, y ahora se caza por mecanismo y no porque
 *                          alguien se acuerde de avisar.
 *
 * @param {{workflows: {name:string, state:string}[]}} ctx
 */
export function evaluarWorkflows({ workflows }) {
  const lista = workflows ?? [];
  const apagados = lista.filter((w) => w.state && w.state !== "active");
  return {
    vistos: lista.length,
    activos: lista.length - apagados.length,
    apagados: apagados.map((w) => ({ nombre: w.name, estado: w.state })),
  };
}

/**
 * ¿Sigue vivo el monitor? Lo pregunta el deploy, no el monitor.
 *
 * @param {{ultimoExito: string|null, ahora: string, maxHoras?: number}} ctx
 */
export function evaluarLatido({ ultimoExito, ahora, maxHoras = LATIDO_MAX_HORAS }) {
  if (!ultimoExito) {
    return { estado: "nunca", motivo: "el monitor no tiene ninguna corrida exitosa: o nunca corrio, o esta deshabilitado" };
  }
  const h = horas(ahora, ultimoExito);
  if (h > maxHoras) {
    return { estado: "muerto", horas: Math.round(h),
             motivo: `el monitor no late hace ${Math.round(h)}h (max ${maxHoras}h). Si el repo estuvo 60 dias quieto, GitHub deshabilita los workflows programados de los repos PUBLICOS.` };
  }
  return { estado: "vivo", horas: Math.round(h) };
}

/**
 * ¿Se salteo corridas el propio monitor? Lo pregunta el monitor de si mismo.
 * Un monitor que resucita en silencio deja creer que vigilo todo ese tiempo.
 */
export function confesarHueco({ corridaPrevia, ahora, esperadoHoras = 24 }) {
  if (!corridaPrevia) return { hubo: false };
  const h = horas(ahora, corridaPrevia);
  if (h > esperadoHoras * 2) return { hubo: true, horas: Math.round(h) };
  return { hubo: false, horas: Math.round(h) };
}

// ── self-test ────────────────────────────────────────────────────────────────────────────
if (process.argv.includes("--self-test")) {
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const { dirname, join } = await import("node:path");
  const AQUI = dirname(fileURLToPath(import.meta.url));

  // EL CASO REAL, no uno inventado: las corridas de "Auditoria del archivo" de
  // RosettaQuantum/evidence, capturadas del historial de GitHub. Ahi hubo 5 fallos entre
  // el 19 y el 21 de agosto — el guardia que vigila que los sellos no cambien, roto tres
  // dias seguidos sin que nadie lo viera.
  //
  // OJO CON EL ALCANCE, y se declara en vez de exagerarlo: la ventana real del incidente
  // fue del 14 al 21, pero GitHub guarda las ultimas 100 corridas y ahi el historial
  // empieza el 19. Esto se prueba contra la COLA del incidente, no contra el incidente
  // entero. Tres dias de rojo consecutivo alcanzan para el caso.
  const real = JSON.parse(readFileSync(join(AQUI, "fixtures/evidence-auditoria-19-25ago.json"), "utf8"));
  const hasta = (iso) => real.filter((c) => c.createdAt <= iso);

  const casos = [
    // ── contra el defecto real ──
    // El momento REAL del incidente, leido de los datos y no supuesto: ultimo verde el
    // 19-ago 20:19, y a partir de ahi failure el 19 a las 20:22, el 20 a las 07:06 y el
    // 21 a las 07:08. A mediodia del 21 llevaba ~40h en rojo. (Mi primera version de este
    // caso apuntaba al 21 a las 23:59 y NO gritaba — con razon: a esa hora ya se habia
    // recuperado, a las 13:32. La expectativa estaba mal, no el guardia. Se descubrio
    // porque la fija son corridas REALES y no un ejemplo inventado.)
    ["GRITA contra el incidente real de evidence (21-ago 12:00, ~40h en rojo)", () => {
      const r = evaluarRepo({ corridas: hasta("2026-08-21T12:00:00Z"), ahora: "2026-08-21T12:00:00Z" });
      return r.estado === "rojo-persistente" && r.horasEnRojo > 24;
    }],
    ["CALLA en la primera hora del mismo incidente (19-ago 21:00)", () => {
      const r = evaluarRepo({ corridas: hasta("2026-08-19T21:00:00Z"), ahora: "2026-08-19T21:00:00Z" });
      return r.estado === "rojo-fresco";
    }],
    ["avisa la RECUPERACION real (21-ago 13:35, tras el fix)", () => {
      const r = evaluarRepo({ corridas: hasta("2026-08-21T13:35:00Z"), ahora: "2026-08-21T13:35:00Z" });
      return r.estado === "recuperado";
    }],
    ["CALLA contra la misma cola una vez arreglada (25-ago)", () => {
      const r = evaluarRepo({ corridas: real, ahora: "2026-08-25T18:00:00Z" });
      return r.estado === "verde" || r.estado === "recuperado";
    }],

    // ── el umbral: precision sobre cobertura ──
    ["CALLA: rojo recien salido (2h) — alguien esta trabajando", () => {
      const c = [{ conclusion: "success", createdAt: "2026-08-25T10:00:00Z" },
                 { conclusion: "failure", createdAt: "2026-08-25T16:00:00Z" }];
      return evaluarRepo({ corridas: c, ahora: "2026-08-25T18:00:00Z" }).estado === "rojo-fresco";
    }],
    ["grita: el mismo rojo 30h despues", () => {
      const c = [{ conclusion: "success", createdAt: "2026-08-24T10:00:00Z" },
                 { conclusion: "failure", createdAt: "2026-08-24T16:00:00Z" }];
      return evaluarRepo({ corridas: c, ahora: "2026-08-25T18:00:00Z" }).estado === "rojo-persistente";
    }],
    // El rojo se mide desde el ultimo VERDE, no desde el ultimo fallo: si falla cada hora
    // durante dos dias, el ultimo fallo siempre es reciente y el problema lleva dos dias.
    ["grita: falla repetida y reciente, pero sin verde hace 40h", () => {
      const c = [{ conclusion: "success", createdAt: "2026-08-24T02:00:00Z" },
                 { conclusion: "failure", createdAt: "2026-08-25T14:00:00Z" },
                 { conclusion: "failure", createdAt: "2026-08-25T17:50:00Z" }];
      return evaluarRepo({ corridas: c, ahora: "2026-08-25T18:00:00Z" }).estado === "rojo-persistente";
    }],

    // ── el regreso a verde: la mitad que faltaba en las 201 ──
    ["avisa el REGRESO a verde, no solo la caida", () => {
      const c = [{ conclusion: "failure", createdAt: "2026-08-25T10:00:00Z" },
                 { conclusion: "success", createdAt: "2026-08-25T16:00:00Z" }];
      return evaluarRepo({ corridas: c, ahora: "2026-08-25T18:00:00Z" }).estado === "recuperado";
    }],
    ["CALLA: verde tras verde no es noticia", () => {
      const c = [{ conclusion: "success", createdAt: "2026-08-25T10:00:00Z" },
                 { conclusion: "success", createdAt: "2026-08-25T16:00:00Z" }];
      return evaluarRepo({ corridas: c, ahora: "2026-08-25T18:00:00Z" }).estado === "verde";
    }],
    ["grita distinto: sin datos NO es verde", () =>
      evaluarRepo({ corridas: [], ahora: "2026-08-25T18:00:00Z" }).estado === "sin-datos"],

    // ── el latido ──
    ["CALLA: el monitor latio hace 6h", () =>
      evaluarLatido({ ultimoExito: "2026-08-25T12:00:00Z", ahora: "2026-08-25T18:00:00Z" }).estado === "vivo"],
    ["grita: el monitor no late hace 3 dias", () =>
      evaluarLatido({ ultimoExito: "2026-08-22T18:00:00Z", ahora: "2026-08-25T18:00:00Z" }).estado === "muerto"],
    // El caso que fabrica confianza: sin corridas, el silencio se ve igual que "todo bien".
    ["grita distinto: monitor que NUNCA corrio no es 'vivo'", () =>
      evaluarLatido({ ultimoExito: null, ahora: "2026-08-25T18:00:00Z" }).estado === "nunca"],

    // ── guardias apagados: se pregunta, no se infiere ──
    ["CALLA: todos los workflows activos", () =>
      evaluarWorkflows({ workflows: [{ name: "a", state: "active" }, { name: "b", state: "active" }] }).apagados.length === 0],
    // El caso que yo daba por incerrable: alguien apago un guardia. Antes se veia igual
    // que "no ha habido cambios"; ahora tiene nombre.
    ["grita: alguien apago un guardia a mano", () => {
      const r = evaluarWorkflows({ workflows: [{ name: "Auditoria", state: "disabled_manually" }] });
      return r.apagados.length === 1 && r.apagados[0].estado === "disabled_manually";
    }],
    ["grita: GitHub lo apago por inactividad", () => {
      const r = evaluarWorkflows({ workflows: [{ name: "Monitor", state: "disabled_inactivity" }] });
      return r.apagados[0].estado === "disabled_inactivity";
    }],
    ["reporta denominador de workflows", () => {
      const r = evaluarWorkflows({ workflows: [{ name: "a", state: "active" }, { name: "b", state: "disabled_manually" }] });
      return r.vistos === 2 && r.activos === 1;
    }],
    ["CALLA: sin workflows no inventa apagados", () =>
      evaluarWorkflows({ workflows: [] }).apagados.length === 0],

    // ── la confesion del propio hueco ──
    ["el monitor confiesa un hueco de 3 dias", () =>
      confesarHueco({ corridaPrevia: "2026-08-22T18:00:00Z", ahora: "2026-08-25T18:00:00Z" }).hubo === true],
    ["CALLA: corrida diaria normal, sin hueco", () =>
      confesarHueco({ corridaPrevia: "2026-08-24T18:00:00Z", ahora: "2026-08-25T18:00:00Z" }).hubo === false],
  ];

  let fallos = 0;
  for (const [n, fn] of casos) {
    let p; try { p = fn(); } catch (e) { p = false; }
    console.log(`${p ? "ok  " : "FALLA"}  ${n}`); if (!p) fallos++;
  }
  console.log(`\n[ci-salud] self-test: ${casos.length - fallos} de ${casos.length} pasaron.`);
  process.exit(fallos ? 1 : 0);
}

// ── modo latido: lo corre el DEPLOY, no el monitor ───────────────────────────────────────
const ahora = new Date().toISOString();
const gh = (args) => JSON.parse(execSync(`gh ${args}`, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));

if (process.argv.includes("--latido")) {
  let ultimoExito = null;
  try {
    const c = gh('run list --repo RosettaQuantum/web --workflow=monitor-ci.yml --status=success --limit 1 --json createdAt');
    ultimoExito = c[0]?.createdAt ?? null;
  } catch (e) { ultimoExito = null; }

  const r = evaluarLatido({ ultimoExito, ahora });
  if (r.estado === "vivo") { console.log(`[ci-salud] el monitor latio hace ${r.horas}h — vivo.`); process.exit(0); }
  console.error(`[ci-salud] LATIDO PERDIDO: ${r.motivo}`);
  console.error("[ci-salud] Un monitor muerto se ve identico a 'todo verde'. Por eso esto detiene el deploy:");
  console.error("[ci-salud] el que sufre el bloqueo es el que puede arreglarlo.");
  process.exit(1);
}

// ── modo real: revisar los repos ─────────────────────────────────────────────────────────
let hallazgos = 0;
for (const repo of REPOS) {
  let corridas = [];
  try { corridas = gh(`run list --repo ${repo} --branch main --limit 40 --json conclusion,createdAt`); }
  catch (e) { console.error(`  ! ${repo}: no se pudo consultar — ${String(e).split("\n")[0]}`); hallazgos++; continue; }

  const r = evaluarRepo({ corridas, ahora });

  // El estado de los workflows se PREGUNTA. Cero corridas puede ser "no paso nada" o
  // "alguien apago el guardia", y desde las corridas esas dos son indistinguibles.
  let w = { vistos: 0, activos: 0, apagados: [] };
  try { w = evaluarWorkflows({ workflows: gh(`api repos/${repo}/actions/workflows --jq '[.workflows[] | {name, state}]'`) }); }
  catch (e) { console.error(`  ! ${repo}: no se pudo leer el estado de los workflows — ${String(e).split("\n")[0]}`); hallazgos++; }

  const linea = `  ${repo.padEnd(28)} ${r.estado}${r.horasEnRojo ? ` (${r.horasEnRojo}h)` : ""} · ${r.vistas} corrida(s) · ${w.activos}/${w.vistos} workflow(s) activo(s)`;

  if (r.estado === "rojo-persistente") { console.error(linea + "  <-- ESCALAR"); hallazgos++; }
  else if (r.estado === "sin-datos") { console.error(linea + "  <-- sin datos no es verde"); hallazgos++; }
  else console.log(linea);

  for (const a of w.apagados) {
    const porque = a.estado === "disabled_inactivity"
      ? "GitHub lo apagó tras 60 días sin actividad del repo (aplica a repos PÚBLICOS)"
      : "alguien lo apagó a mano — eso cambia la garantía que damos hacia afuera";
    console.error(`    ! guardia APAGADO en ${repo}: "${a.nombre}" (${a.estado}) — ${porque}`);
    hallazgos++;
  }
}

console.log(`[ci-salud] ${REPOS.length} repo(s) revisados · ${hallazgos} que escalar. Consumidor: la sesión CTO.`);
process.exit(hallazgos ? 1 : 0);
