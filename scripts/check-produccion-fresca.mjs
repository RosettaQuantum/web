#!/usr/bin/env node
/**
 * No se despliega sin haber corrido los chequeos de produccion CONTRA ESTE codigo.
 *
 * EL DEFECTO (medido el 2026-08-26). `check:prod` encadena ocho guardias que miran la web
 * viva, la API, el ledger y las promesas publicadas. **Ningun flujo automatico lo invoca.**
 * Lo unico que corre el CI es `npm run build`. O sea: ocho controles que existen, pasan
 * cuando alguien se acuerda, y el dia que nadie se acuerda no avisan nada.
 *
 * Es la forma que ya tenemos escrita —*un control que vive en un prompt cubre justo los dias
 * en que no hace falta*— y su primo del mismo dia: `check-guardias-cableados.mjs` comprobaba
 * que cada guardia **apareciera** en un script de npm, no que alguien lo **ejecutara**. Verde
 * en el registro, cero corridas.
 *
 * POR QUE UN RECIBO Y NO UN RECORDATORIO. La disciplina se abandona; la conveniencia no. Este
 * guardia corre en `predeploy`, asi que **quien no corrio los chequeos no puede desplegar**.
 * No le pide a nadie que se acuerde: le cierra la puerta.
 *
 * POR QUE EL RECIBO GUARDA EL SHA Y NO SOLO LA FECHA, que es lo que lo hace servir:
 *
 *   - «corrio hace 2 horas» se satisface **sin haber mirado el codigo que se va a desplegar**.
 *     Un recibo fresco de otro commit es exactamente un numero bien formado que no mide nada.
 *   - «corrio contra ESTE sha» no se puede satisfacer por accidente. Si cambiaste algo, el
 *     recibo caduca solo.
 *
 * Y guarda **que guardias corrieron**, no solo que corrio: agregar un guardia nuevo a
 * `check:prod` caduca los recibos viejos, que es lo correcto —un recibo de antes no puede
 * dar fe de un chequeo que todavia no existia—.
 *
 * SU PUNTO CIEGO, declarado: no comprueba que los ocho hayan PASADO, solo que corrieron.
 * Eso es a proposito y es responsabilidad de cada uno: si uno falla, `check:prod` se detiene
 * y el recibo no llega a escribirse. El recibo solo se emite al final de la cadena.
 *
 * Uso:
 *   node scripts/check-produccion-fresca.mjs --self-test
 *   node scripts/check-produccion-fresca.mjs --emitir    # lo llama check:prod al terminar
 *   node scripts/check-produccion-fresca.mjs             # lo llama predeploy; bloquea
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";

export const RECIBO = ".recibo-produccion.json";
/** Un recibo de mas de esto ya no dice nada util del estado de produccion. */
export const HORAS_MAX = 24;

/** Los guardias que `check:prod` encadena. Si cambia la lista, los recibos viejos caducan. */
export function guardiasDeProd(scripts) {
  const cadena = (scripts ?? {})["check:prod"] ?? "";
  return [...cadena.matchAll(/scripts\/(check-[\w-]+)\.mjs/g)].map((m) => m[1]).sort();
}

/**
 * ¿Sirve este recibo para desplegar ESTE codigo?
 *
 * @param {{recibo:object|null, sha:string, guardias:string[], ahora:number}} ctx
 */
export function evaluar({ recibo, sha, guardias, ahora }) {
  if (!recibo) return { estado: "sin_recibo", motivo: "nunca se corrio check:prod, o el recibo no esta" };

  if (recibo.sha !== sha) {
    return {
      estado: "otro_codigo",
      motivo: `el recibo es del commit ${String(recibo.sha).slice(0, 7)} y se va a desplegar ${sha.slice(0, 7)}`,
    };
  }

  const faltan = guardias.filter((g) => !(recibo.guardias ?? []).includes(g));
  if (faltan.length) {
    return { estado: "incompleto", motivo: `el recibo no cubre ${faltan.length} guardia(s) que hoy existen`, faltan };
  }

  const horas = (ahora - Date.parse(recibo.fecha)) / 3.6e6;
  if (!Number.isFinite(horas)) return { estado: "sin_recibo", motivo: "el recibo no trae una fecha legible" };
  if (horas > HORAS_MAX) {
    return { estado: "viejo", motivo: `el recibo tiene ${horas.toFixed(1)} h y el maximo son ${HORAS_MAX}`, horas };
  }

  return { estado: "ok", horas };
}

// ── self-test ────────────────────────────────────────────────────────────────────────────
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href && process.argv.includes("--self-test")) {
  const AHORA = Date.parse("2026-08-26T20:00:00Z");
  const base = { sha: "abc1234", fecha: "2026-08-26T19:00:00Z", guardias: ["check-alcance", "check-openapi"] };
  const G = ["check-alcance", "check-openapi"];

  const casos = [
    ["CALLA: recibo de este commit, fresco y completo", () =>
      evaluar({ recibo: base, sha: "abc1234", guardias: G, ahora: AHORA }).estado === "ok"],

    ["grita: no hay recibo", () =>
      evaluar({ recibo: null, sha: "abc1234", guardias: G, ahora: AHORA }).estado === "sin_recibo"],

    // EL CASO QUE JUSTIFICA GUARDAR EL SHA: fresquisimo, y de otro codigo.
    ["grita: recibo de hace un minuto pero de OTRO commit", () =>
      evaluar({ recibo: { ...base, fecha: "2026-08-26T19:59:00Z" }, sha: "def5678", guardias: G, ahora: AHORA })
        .estado === "otro_codigo"],

    ["grita: recibo viejo aunque sea del mismo commit", () =>
      evaluar({ recibo: { ...base, fecha: "2026-08-24T19:00:00Z" }, sha: "abc1234", guardias: G, ahora: AHORA })
        .estado === "viejo"],

    // Un guardia nuevo caduca los recibos anteriores: no pudieron dar fe de el.
    ["grita: se agrego un guardia que el recibo no cubre", () => {
      const r = evaluar({ recibo: base, sha: "abc1234", guardias: [...G, "check-esquema-deriva"], ahora: AHORA });
      return r.estado === "incompleto" && r.faltan[0] === "check-esquema-deriva";
    }],

    ["CALLA: el recibo cubre MAS guardias de los que hoy existen (se quito uno)", () =>
      evaluar({ recibo: { ...base, guardias: [...G, "check-viejo"] }, sha: "abc1234", guardias: G, ahora: AHORA })
        .estado === "ok"],

    ["grita distinto: fecha ilegible es sin_recibo, no ok", () =>
      evaluar({ recibo: { ...base, fecha: "ayer" }, sha: "abc1234", guardias: G, ahora: AHORA }).estado === "sin_recibo"],

    ["justo en el limite de 24 h todavia sirve", () =>
      evaluar({ recibo: { ...base, fecha: "2026-08-25T20:00:01Z" }, sha: "abc1234", guardias: G, ahora: AHORA })
        .estado === "ok"],

    // ── el lector de la cadena ──
    ["lee los guardias de check:prod y los ordena", () => {
      const g = guardiasDeProd({ "check:prod": "node scripts/check-openapi.mjs && node scripts/check-alcance.mjs" });
      return g.length === 2 && g[0] === "check-alcance";
    }],

    ["CALLA: sin check:prod devuelve lista vacia, no revienta", () =>
      guardiasDeProd({}).length === 0],

    // ── mutacion ──
    ["MUTACION: sin comparar el sha, un recibo ajeno pasaria", () => {
      const conSha = evaluar({ recibo: base, sha: "def5678", guardias: G, ahora: AHORA }).estado;
      const soloFecha = (AHORA - Date.parse(base.fecha)) / 3.6e6 <= HORAS_MAX;
      return conSha === "otro_codigo" && soloFecha === true;
    }],
  ];

  let fallos = 0;
  for (const [nombre, fn] of casos) {
    let paso; try { paso = fn(); } catch { paso = false; }
    console.log(`${paso ? "ok   " : "FALLA"}  ${nombre}`);
    if (!paso) fallos++;
  }
  console.log(`\n[produccion-fresca] self-test: ${casos.length - fallos} de ${casos.length} pasaron.`);
  process.exit(fallos ? 1 : 0);
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────
// Sin esto, IMPORTAR el modulo ejecuta el CLI: un test que quiera ejercer `evaluar()` se
// encuentra con el guardia corriendo y, peor, emitiendo o bloqueando. Un modulo que no se
// puede importar sin efectos no se puede probar desde afuera.
const esPrincipal = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;

const sha = (!esPrincipal ? null : (() => {
  try { return execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); }
  catch { return null; }
})());

const guardias = (() => {
  try { return guardiasDeProd(JSON.parse(readFileSync("package.json", "utf8")).scripts); }
  catch { return []; }
})();

if (esPrincipal && process.argv.includes("--emitir")) {
  if (!sha) { console.error("[produccion-fresca] no se pudo leer el sha: no se emite recibo."); process.exit(2); }
  writeFileSync(RECIBO, JSON.stringify({ sha, fecha: new Date().toISOString(), guardias }, null, 2) + "\n");
  console.log(`[produccion-fresca] recibo emitido · ${sha.slice(0, 7)} · ${guardias.length} guardia(s)`);
} else if (esPrincipal && !process.argv.includes("--self-test")) {
  if (!sha) {
    console.error("[produccion-fresca] NO SE PUDO COMPROBAR: no hay repositorio git aqui.");
    process.exit(2);
  }
  const recibo = existsSync(RECIBO) ? JSON.parse(readFileSync(RECIBO, "utf8")) : null;
  const r = evaluar({ recibo, sha, guardias, ahora: Date.now() });

  if (r.estado === "ok") {
    console.log(`[produccion-fresca] recibo de ${sha.slice(0, 7)}, ${r.horas.toFixed(1)} h, ${guardias.length} guardia(s). Adelante.`);
  } else {
    console.error(`[produccion-fresca] BLOQUEADO: ${r.motivo}`);
    if (r.faltan) for (const g of r.faltan) console.error(`    falta: ${g}`);
    console.error("[produccion-fresca] Los chequeos de produccion no dan fe de lo que se va a desplegar.");
    console.error("[produccion-fresca] Corre:  npm run check:prod");
    process.exit(1);
  }
}
