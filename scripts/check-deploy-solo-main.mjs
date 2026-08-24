#!/usr/bin/env node
/**
 * Una superficie, un escritor.
 *
 * EL FALLO (2026-08-24, costo dos deploys): un `wrangler deploy` corrido a mano desde una
 * rama sobrescribio lo que .github/workflows/deploy.yml acababa de publicar desde `main`.
 * Sin conflicto de git y sin aviso: Cloudflare no integra dos fuentes, aplica la ultima que
 * llego. El ganador es arbitrario — depende de que terminal ejecuto el comando mas tarde.
 *
 * Dos guardias, porque uno solo no alcanza:
 *
 *   1. PREVENTIVO (evaluarRama) — corre antes de desplegar y aborta si no estas en main.
 *      Punto ciego declarado: solo cubre el camino sancionado (`npm run deploy`). Quien
 *      escriba `wrangler deploy` a mano lo saltea entero. Por eso existe el segundo.
 *
 *   2. DETECTOR DE DERIVA (evaluarSello) — mira el TERRENO, no el repo: compara el
 *      <meta name="rq-build"> que sirve produccion contra origin/main. Un deploy a mano no
 *      tiene GITHUB_SHA, asi que sella la palabra "local"; y un deploy desde una rama sella
 *      un sha que no es ancestro de origin/main. Los dos casos gritan aca aunque nadie haya
 *      pasado por el guardia preventivo.
 *
 * El segundo es el que de verdad cierra la clase: el primero pide colaboracion, el segundo
 * comprueba lo que paso.
 *
 * Uso:
 *   node scripts/check-deploy-solo-main.mjs              # preventivo (antes de wrangler deploy)
 *   node scripts/check-deploy-solo-main.mjs --deriva     # detector contra produccion viva
 *   node scripts/check-deploy-solo-main.mjs --self-test  # rompe cada regla a proposito y exige el grito
 */
import { execSync } from "node:child_process";

export const RAZON =
  "Una superficie, un escritor (COORDINACION.md §12 quinquies). Dos fuentes de verdad sobre el mismo Worker se revierten entre si sin conflicto y sin aviso.";

/**
 * Guardia preventivo: solo `main` despliega.
 *
 * @param {{rama: string, githubRef?: string}} ctx
 *   rama: salida de `git rev-parse --abbrev-ref HEAD`. En CI, actions/checkout deja el repo
 *         en detached HEAD y esto vale "HEAD" — de ahi githubRef.
 *   githubRef: process.env.GITHUB_REF ("refs/heads/main" en un push a main).
 */
export function evaluarRama({ rama, githubRef }) {
  const efectiva = rama === "HEAD" && githubRef ? githubRef.replace(/^refs\/heads\//, "") : rama;
  if (efectiva === "main") return { ok: true, rama: efectiva };
  return {
    ok: false,
    rama: efectiva,
    motivo: `Deploy bloqueado: estas en '${efectiva}', solo 'main' publica.`,
  };
}

/**
 * Detector de deriva: lo que sirve produccion tiene que venir de origin/main.
 *
 * @param {{sello: string|null, esAncestro: (sha: string) => boolean}} ctx
 *   sello: el content de <meta name="rq-build"> que sirve la URL viva, o null si no esta.
 *   esAncestro: dice si ese sha es alcanzable desde origin/main.
 */
export function evaluarSello({ sello, esAncestro }) {
  if (!sello) {
    return { ok: false, motivo: "La pagina viva no trae <meta name=\"rq-build\">: no se puede saber que esta desplegado." };
  }
  if (sello === "local") {
    return {
      ok: false,
      motivo: 'Produccion sirve un build sellado "local": alguien corrio `wrangler deploy` a mano, fuera de CI.',
    };
  }
  if (!/^[0-9a-f]{7,40}$/.test(sello)) {
    return { ok: false, motivo: `Sello "${sello}" no es un sha: build de procedencia desconocida.` };
  }
  if (!esAncestro(sello)) {
    return {
      ok: false,
      motivo: `Lo desplegado (${sello}) NO es ancestro de origin/main: produccion corre codigo que no esta en main.`,
    };
  }
  return { ok: true, sello };
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);

function fallar(motivo) {
  console.error(`\n[deploy-solo-main] ${motivo}`);
  console.error(`[deploy-solo-main] ${RAZON}`);
  console.error("[deploy-solo-main] Camino correcto: merge a main y deja que .github/workflows/deploy.yml publique.\n");
  process.exit(1);
}

if (args.includes("--self-test")) {
  // Cada caso que GRITA, y —lo que casi nunca se escribe— cada caso que CALLA.
  // Un guardia demasiado ruidoso pasa todas las pruebas de gritar (CLAUDE.md §4 bis).
  const casos = [
    // — rama —
    ["grita: rama de trabajo", () => evaluarRama({ rama: "guardia/deploy-solo-main" }).ok === false],
    ["grita: rama que CONTIENE main", () => evaluarRama({ rama: "respaldo/main-vieja" }).ok === false],
    ["grita: detached HEAD sin CI que lo respalde", () => evaluarRama({ rama: "HEAD" }).ok === false],
    ["grita: CI empujando a una rama que no es main", () => evaluarRama({ rama: "HEAD", githubRef: "refs/heads/feat/x" }).ok === false],
    ["CALLA: main en local", () => evaluarRama({ rama: "main" }).ok === true],
    // Sin esta rama del guardia, el propio deploy.yml quedaria bloqueado: actions/checkout
    // deja detached HEAD y `--abbrev-ref` devuelve "HEAD". Un falso positivo que retiene
    // trabajo bueno es peor que dejar pasar un caso (CLAUDE.md §2).
    ["CALLA: detached HEAD de actions/checkout en push a main", () => evaluarRama({ rama: "HEAD", githubRef: "refs/heads/main" }).ok === true],
    // — sello —
    // Se afirma sobre el MOTIVO, no solo sobre ok===false: el chequeo de formato hex de mas
    // abajo tambien rechaza "local", asi que un `ok === false` a secas pasaba igual con esta
    // regla borrada — y el operador perdia el diagnostico que dice QUE paso. Encontrado
    // probando el guardia por mutacion.
    [
      "grita: deploy a mano (sello 'local') Y lo diagnostica como tal",
      () => {
        const r = evaluarSello({ sello: "local", esAncestro: () => true });
        return r.ok === false && /a mano/.test(r.motivo);
      },
    ],
    ["grita: sin marca en la pagina", () => evaluarSello({ sello: null, esAncestro: () => true }).ok === false],
    ["grita: sello que no es un sha", () => evaluarSello({ sello: "v1.2.3", esAncestro: () => true }).ok === false],
    ["grita: sha que no esta en origin/main", () => evaluarSello({ sello: "deadbeef1234", esAncestro: () => false }).ok === false],
    ["CALLA: sha de origin/main", () => evaluarSello({ sello: "338e6edbb2a5", esAncestro: () => true }).ok === true],
  ];

  let fallos = 0;
  for (const [nombre, fn] of casos) {
    const paso = fn();
    console.log(`${paso ? "ok  " : "FALLA"}  ${nombre}`);
    if (!paso) fallos++;
  }
  // Denominador explicito: un total sin denominador no es un resultado (CLAUDE.md §5 bis).
  console.log(`\n[deploy-solo-main] self-test: ${casos.length - fallos} de ${casos.length} pasaron.`);
  process.exit(fallos ? 1 : 0);
}

if (args.includes("--deriva")) {
  const url = "https://rosettaquantum.com/";
  const html = execSync(`curl -fsS ${url}`, { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
  const m = html.match(/name="rq-build"\s+content="([^"]*)"/);
  const sello = m ? m[1] : null;

  const r = evaluarSello({
    sello,
    esAncestro: (sha) => {
      try {
        execSync(`git merge-base --is-ancestor ${sha} origin/main`, { stdio: "ignore" });
        return true;
      } catch {
        return false;
      }
    },
  });

  if (!r.ok) fallar(r.motivo);
  console.log(`[deploy-solo-main] produccion sirve ${r.sello}, que esta en origin/main. Una sola fuente de verdad.`);
  process.exit(0);
}

// Preventivo (modo por defecto)
const rama = execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf8" }).trim();
const r = evaluarRama({ rama, githubRef: process.env.GITHUB_REF });
if (!r.ok) fallar(r.motivo);
console.log(`[deploy-solo-main] rama '${r.rama}': autorizado a publicar.`);
