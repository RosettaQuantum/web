#!/usr/bin/env node
/**
 * En este repositorio, `git push` a `main` ES un despliegue. Aqui se dice antes.
 *
 * EL DEFECTO, y es sobre un acto propio (2026-08-27). Arregle el `content-type` de
 * `/v1/challenges/.../raw`, empuje a `main`, y **media hora despues escribi «esta commiteado y
 * empujado, sin desplegar, tu decides»** — pidiendo autorizacion para algo que ya habia hecho
 * yo, y pidiendole el turno a la sesion que lleva el orden. Lo paro que esa sesion fuera a mirar
 * produccion antes de aprobarme: **si me hubiera creido el mensaje, yo habria desplegado encima
 * de mi propio despliegue creyendo que era el primero.**
 *
 * El dato estaba escrito en la primera linea del workflow —`# prod = git push`— y en la memoria
 * del proyecto. **No fue falta de informacion: fue tener el dato y afirmar lo contrario.**
 *
 * POR QUE NO ES UN PROBLEMA DE VISIBILIDAD SINO DE VOCABULARIO. Medido: **28 despliegues a
 * produccion en un dia**, todos por `push`, todos con exito, **ninguno anunciado como
 * despliegue**. Un `push` se siente reversible y un despliegue no: **la palabra estaba haciendo
 * el trabajo de ocultar la consecuencia**, y por eso nadie pedia turno.
 *
 * POR QUE ES UN GUARDIA Y NO UN RECORDATORIO. Regla de la casa: *un control que vive en un
 * prompt no es un control*, y «me acuerdo de anunciarlo» es exactamente eso. Si un dia no avisa,
 * nadie sabe si fue porque no habia nada o porque dejo de mirar.
 *
 * EL DENOMINADOR CORRECTO, que es lo que hace barata esta regla. El 28 parecia caro, pero es el
 * denominador equivocado: cuenta despliegues, no cambios servidos. Contando los commits del dia:
 *
 *     commits en origin/main ................. 22
 *       TOCAN lo servido ..................... 4    <- por rama, con OK
 *       no lo tocan (guardias, scripts) ...... 18   <- siguen directo
 *
 * **Cuatro, no veintiocho.** Y los cuatro son justo los que uno querria mirar dos veces.
 *
 * SU PUNTO CIEGO, declarado: mira **rutas**, no efectos. Un guardia que un dia empiece a
 * escribir en `public/` lo marcaria; un cambio en `package.json` que altere el build no. Para
 * eso esta el chequeo contra la URL viva **despues** — este cubre el aviso, no la verificacion.
 *
 * Uso:
 *   node scripts/check-empujar-es-desplegar.mjs --self-test
 *   node scripts/check-empujar-es-desplegar.mjs            # antes de empujar a main
 */
import { execSync } from "node:child_process";

/** Quien actua esta senal, y que hace al recibirla. Declarado aqui, no en un documento aparte. */
export const CONSUMIDOR = {
  quien: "quien esta a punto de empujar a main (la sesion CTO)",
  hace: "si el diff toca lo servido, abre rama y pide el OK; si empuja igual, lo anuncia como DESPLIEGUE con su chequeo",
  bloquea: "no se empuja a main un cambio servido sin turno: en este repo push == deploy",
};

/**
 * Lo que sale a produccion. **Rutas, no adivinanzas.**
 *
 * Sale de mirar el workflow: `deploy.yml` construye con Astro y publica el Worker, asi que lo
 * servido es el Worker (`api.js`, `worker.js`), el sitio (`src/`, `public/`) y lo que decide
 * como se construyen (`astro.config.*`, `wrangler.*`).
 */
export const SERVIDO = ["api.js", "worker.js", "src/", "public/", "astro.config", "wrangler."];

/** Los guardias NO se sirven: viven en el repo y corren en CI o a mano, pero no salen. */
export const NO_SE_SIRVE = ["scripts/", ".github/", "db/", "test/", "docs/"];

/** ¿Este archivo sale a produccion? */
export function esServido(ruta) {
  const r = String(ruta || "").replace(/^\.\//, "");
  if (NO_SE_SIRVE.some((p) => r.startsWith(p))) return false;
  return SERVIDO.some((p) => r === p || r.startsWith(p));
}

/**
 * @param {{archivos:string[], rama:string}} ctx
 */
export function evaluarEmpuje({ archivos, rama }) {
  const servidos = (archivos || []).filter(esServido);
  if (!servidos.length) {
    return { estado: "no_cambia_lo_servido", servidos: [], total: (archivos || []).length,
             motivo: "ningun archivo de este empuje cambia el codigo que se sirve" };
  }
  if (rama !== "main") {
    return { estado: "en_rama", servidos, total: archivos.length,
             motivo: `toca lo servido pero va a '${rama}', no a main: se despliega al fusionar` };
  }
  return { estado: "es_un_despliegue", servidos, total: archivos.length,
           motivo: `${servidos.length} archivo(s) servidos directo a main: esto ES un despliegue` };
}

// ── self-test ────────────────────────────────────────────────────────────────────────────
const _esPrincipal = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (_esPrincipal && process.argv.includes("--self-test")) {
  // LOS CUATRO CASOS REALES del 2026-08-27, con los archivos que tocaron de verdad.
  const REAL_SERVIDO = ["api.js", "scripts/check-quantum-catalog.mjs"];   // el /raw
  const REAL_GUARDIA = ["scripts/check-openapi.mjs"];                     // 18 de 22 son asi

  const casos = [
    // ── grita ──
    ["grita: el caso REAL — api.js directo a main es un despliegue", () =>
      evaluarEmpuje({ archivos: REAL_SERVIDO, rama: "main" }).estado === "es_un_despliegue"],

    ["grita: dice CUALES salen, no solo que salen", () =>
      evaluarEmpuje({ archivos: REAL_SERVIDO, rama: "main" }).servidos.join() === "api.js"],

    ["grita: una pagina del sitio tambien sale", () =>
      evaluarEmpuje({ archivos: ["src/pages/index.astro"], rama: "main" }).estado === "es_un_despliegue"],

    ["grita: lo que decide como se construye tambien cuenta", () =>
      ["wrangler.jsonc", "astro.config.mjs"].every((f) =>
        evaluarEmpuje({ archivos: [f], rama: "main" }).estado === "es_un_despliegue")],

    // ── calla ──
    // 18 de 22 commits del dia son asi. Si el guardia los marcara, seria fricción sobre trabajo
    // bueno y se aprenderia a ignorarlo.
    ["CALLA: un guardia no se sirve — 18 de los 22 commits del dia son esto", () =>
      evaluarEmpuje({ archivos: REAL_GUARDIA, rama: "main" }).estado === "no_cambia_lo_servido"],

    ["CALLA: workflows, migraciones y tests tampoco salen", () =>
      [".github/workflows/deploy.yml", "db/quantum.seed.sql", "test/x.spec.js", "docs/a.md"]
        .every((f) => evaluarEmpuje({ archivos: [f], rama: "main" }).estado === "no_cambia_lo_servido")],

    // Toca lo servido pero va a una rama: se avisa distinto, no se bloquea. El despliegue
    // ocurre al fusionar, y ahi es donde va el OK.
    ["distingue: lo servido en una RAMA no es un despliegue todavia", () =>
      evaluarEmpuje({ archivos: REAL_SERVIDO, rama: "feat/puerta" }).estado === "en_rama"],

    // ── el borde que importa ──
    // `scripts/` gana sobre todo lo demas: un guardia que lea `public/` no se sirve por eso.
    ["un guardia que MENCIONA public/ en su ruta sigue sin servirse", () =>
      esServido("scripts/check-oro-semantico.mjs") === false],

    ["public/ de verdad SI se sirve", () =>
      esServido("public/consola/index.html") === true],

    // ── mutacion ──
    // Sin la lista de lo que NO se sirve, `scripts/` no calzaria con SERVIDO igual... pero un
    // dia alguien agrega `src/` a un script y el orden decide. Este caso fija el orden.
    ["MUTACION: sin NO_SE_SIRVE, un guardia bajo src/ se marcaria como servido", () => {
      const ruta = "src/guardias/interno.mjs";
      const conOrden = esServido(ruta);                       // hoy: true, y esta bien
      const siNoHubieraLista = SERVIDO.some((p) => ruta.startsWith(p));
      return conOrden === true && siNoHubieraLista === true;
    }],

    ["MUTACION: si solo mirara la rama, empujar api.js a main pasaria", () => {
      const conRegla = evaluarEmpuje({ archivos: REAL_SERVIDO, rama: "main" }).estado;
      const siSoloMiraraRama = "main" === "main"; // "voy a main, es lo normal"
      return conRegla === "es_un_despliegue" && siSoloMiraraRama === true;
    }],
  ];

  let fallos = 0;
  for (const [nombre, fn] of casos) {
    let paso; try { paso = fn(); } catch { paso = false; }
    console.log(`${paso ? "ok   " : "FALLA"}  ${nombre}`);
    if (!paso) fallos++;
  }
  console.log(`\n[empujar-es-desplegar] self-test: ${casos.length - fallos} de ${casos.length} pasaron.`);
  process.exit(fallos ? 1 : 0);
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────
if (_esPrincipal && !process.argv.includes("--self-test")) {
  const sh = (c) => execSync(c, { encoding: "utf8" }).trim();
  let rama, archivos, rango = null;
  try {
    rama = sh("git rev-parse --abbrev-ref HEAD");
    // QUE SE COMPARA CONTRA QUE, y la primera version lo tenia mal de una forma que solo
    // aparecio al ensayarla: sin rama remota caia a `HEAD~1..HEAD`, o sea **el ultimo commit**,
    // no lo que el empuje llevaria. En una rama con tres commits habria reportado uno y callado
    // dos — un subconteo silencioso, que es la clase que este proyecto persigue.
    //
    // Lo que un empuje lleva de verdad es lo que hay aqui y no esta publicado:
    //   - con rama remota: contra ella.
    //   - rama nueva: contra `origin/main`, porque eso es lo que se fusionaria.
    // Sin ninguna de las dos NO se adivina: se sale con 2 y se dice.
    if (sh(`git rev-parse --verify --quiet origin/${rama} || true`)) rango = `origin/${rama}..HEAD`;
    else if (sh("git rev-parse --verify --quiet origin/main || true")) rango = "origin/main..HEAD";
    if (!rango) {
      console.error(`[empujar] NO SE PUDO COMPROBAR: no hay origin/${rama} ni origin/main con que comparar.`);
      console.error("[empujar] Sin punto de comparacion no se sabe que llevaria el empuje, y no se supone.");
      process.exit(2);
    }
    archivos = sh(`git diff --name-only ${rango}`).split("\n").filter(Boolean);
  } catch (e) {
    console.error(`[empujar] NO SE PUDO COMPROBAR: ${String(e).split("\n")[0]}`);
    process.exit(2);   // nunca verde por no haber podido mirar
  }

  const r = evaluarEmpuje({ archivos, rama });
  console.log(`[empujar] rama '${rama}' · ${r.total} archivo(s) sin empujar (${rango})`);

  if (r.estado === "no_cambia_lo_servido") {
    console.log(`   ${r.motivo}.`);
    // PRECISION, y la primera version decia «empujar aqui no despliega», que es FALSO.
    // `deploy.yml` corre `npm run build` y `wrangler deploy` en CADA push a main, mire lo que
    // mire el diff. Y el build REGENERA el ledger desde D1, asi que un empuje de solo guardias
    // igual republica — con datos frescos. Lo que no cambia es el CODIGO servido, que es otra
    // cosa y es la que importa para pedir turno.
    console.log("   OJO: el CI despliega igual en cada push a main, y el build regenera el");
    console.log("   ledger desde D1. No cambia el codigo servido; el despliegue ocurre igual.");
    process.exit(0);
  }
  if (r.estado === "en_rama") {
    console.log(`   ${r.motivo}`);
    for (const f of r.servidos) console.log(`     sale a produccion: ${f}`);
    console.log("   El despliegue ocurre al FUSIONAR. El OK va ahi, no aqui.");
    process.exit(0);
  }

  console.error(`\n[empujar] ESTO ES UN DESPLIEGUE: ${r.motivo}`);
  for (const f of r.servidos) console.error(`     sale a produccion: ${f}`);
  console.error("[empujar] `deploy.yml` publica en cada push a main: no existe «empujar sin desplegar».");
  console.error("[empujar] Abre una rama y pide el turno, o si empujas igual, anuncialo como");
  console.error("[empujar] DESPLIEGUE y declara ANTES que chequeo vas a correr contra la URL viva.");
  process.exit(1);
}
