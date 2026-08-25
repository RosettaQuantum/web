#!/usr/bin/env node
/**
 * La instruccion que publicamos para verificarnos, SE SIGUE — y aqui se sigue entera.
 *
 * DE DONDE SALE (2026-08-25). El `como_verificar` de /v1/challenges decia "recomputa el
 * sha256 sobre datos + estadistica tal como salieron del entregable sellado". La sesion
 * Comercial fue a seguirlo **como si fuera un tercero**, sin que nadie se lo pidiera, y
 * reprodujo **1 de 4** probando 60 canonicalizaciones. Con 84 sale igual. Con la receta
 * mas natural de Python, **0 de 4**.
 *
 * La causa: el hash se calcula con el `JSON.stringify` de JavaScript, y JS y Python
 * formatean algunos flotantes distinto. Con Node reproduce 4 de 4. La instruccion no
 * nombraba el serializador, ni el orden de claves, ni los separadores — de los que
 * dependia el resultado. **No era dificil de seguir: era imposible.**
 *
 * Y lo peor no fue el fallo, fue CUAL reproducia: la primera de la lista. Un tercero
 * prueba la primera, le funciona, concluye que entendio la receta — y cuando las otras
 * tres fallan, la conclusion natural no es "me falta un detalle de serializacion", es
 * **"sus datos estan mal"**. Le dimos la herramienta para desconfiar de nosotros y le
 * escondimos el dato que la hacia funcionar.
 *
 * POR QUE ESTE GUARDIA IMPORTA MAS QUE EL ARREGLO: la regla §1 bis —"lo que prometes
 * comprobable, compruebalo tu primero"— llevaba **un mes** sobre este endpoint sin que
 * nadie la ejerciera. Una regla que vive en la cabeza de la gente no es una regla, es una
 * intencion. Esto la pone en codigo y la corre en cada despliegue.
 *
 * QUE HACE: se pone en los zapatos del tercero. Baja lo que la API dice que hay que
 * bajar, le saca el sha256 al cuerpo tal como viene, y lo compara con lo que la API
 * declara. **Sin conocimiento privilegiado**: no importa el serializador ni el orden de
 * claves, porque el camino publicado ya no depende de eso — y si algun dia vuelve a
 * depender, esto lo caza.
 *
 * SU PUNTO CIEGO, declarado: comprueba el camino de /v1/challenges. Las otras promesas
 * verificables del producto —las cuatro convenciones del archivo, /v1/archive/<id>/raw—
 * tienen sus propios chequeos; esto no las cubre.
 *
 * Uso:
 *   node scripts/check-promesa-verificable.mjs              # contra la API viva
 *   node scripts/check-promesa-verificable.mjs --self-test
 */
import { createHash } from "node:crypto";
import { esperarVersion, esperarRutas } from "./lib/esperar.mjs";

const BASE = process.argv.includes("--base")
  ? process.argv[process.argv.indexOf("--base") + 1] : "https://rosettaquantum.com";
const CORRIDA = "cleveland-2026-07";

/** El sha256 de unos bytes, tal como los bajaria un tercero. */
export const sha256 = (texto) => createHash("sha256").update(texto, "utf8").digest("hex");

/**
 * @param {{declarado: string, cuerpo: string, cabecera?: string}} ctx
 */
export function verificarProteina({ declarado, cuerpo, cabecera }) {
  if (!declarado) return { estado: "sin-declarar", motivo: "la API no publica sha256 para esta proteína" };
  if (cuerpo == null) return { estado: "sin-cuerpo", motivo: "la ruta /raw no devolvió cuerpo" };

  const calculado = sha256(cuerpo);
  if (calculado !== declarado) {
    return { estado: "no-reproduce", motivo: `el sha256 del cuerpo (${calculado.slice(0, 12)}…) no es el declarado (${declarado.slice(0, 12)}…)` };
  }
  // La cabecera existe para comparar sin parsear el cuerpo. Si miente, un consumidor que
  // confie en ella se lleva un falso negativo — y no lo va a poder distinguir de un
  // dato manipulado.
  if (cabecera && cabecera !== declarado) {
    return { estado: "cabecera-miente", motivo: "x-rq-sha256 no coincide con el sha256 del recurso" };
  }
  return { estado: "ok" };
}

// ── self-test ────────────────────────────────────────────────────────────────────────────
if (process.argv.includes("--self-test")) {
  const cuerpo = '{"a":1}{"b":2}';
  const bueno = sha256(cuerpo);
  const casos = [
    ["CALLA: el cuerpo reproduce el sha declarado", () =>
      verificarProteina({ declarado: bueno, cuerpo }).estado === "ok"],
    ["CALLA: cabecera coherente", () =>
      verificarProteina({ declarado: bueno, cuerpo, cabecera: bueno }).estado === "ok"],
    // EL CASO QUE MOTIVA EL GUARDIA ENTERO: el cuerpo cambio un byte —una coordenada
    // reserializada por otro lenguaje— y el hash publicado ya no le corresponde.
    ["grita: un byte distinto en el cuerpo", () =>
      verificarProteina({ declarado: bueno, cuerpo: cuerpo + " " }).estado === "no-reproduce"],
    ["grita: la cabecera dice otra cosa que el recurso", () =>
      verificarProteina({ declarado: bueno, cuerpo, cabecera: sha256("otro") }).estado === "cabecera-miente"],
    ["grita distinto: sin cuerpo NO es ok", () =>
      verificarProteina({ declarado: bueno, cuerpo: null }).estado === "sin-cuerpo"],
    ["grita distinto: sin sha declarado NO es ok", () =>
      verificarProteina({ declarado: "", cuerpo }).estado === "sin-declarar"],
    // Sin cabecera es legitimo: es una comodidad, no el camino de verificacion.
    ["CALLA: sin cabecera, el cuerpo manda", () =>
      verificarProteina({ declarado: bueno, cuerpo, cabecera: undefined }).estado === "ok"],
  ];
  let fallos = 0;
  for (const [n, fn] of casos) {
    let p; try { p = fn(); } catch { p = false; }
    console.log(`${p ? "ok  " : "FALLA"}  ${n}`); if (!p) fallos++;
  }
  console.log(`\n[promesa] self-test: ${casos.length - fallos} de ${casos.length} pasaron.`);
  process.exit(fallos ? 1 : 0);
}

// ── modo real: seguir la instruccion como un tercero ─────────────────────────────────────
//
// PRIMERO SE ESPERA A QUE EL BORDE SIRVA ESTE BUILD, y esto no es prolijidad: la primera
// version de este guardia no esperaba y tumbo un despliegue que estaba bien. Dio "2 de 4"
// —propagacion PARCIAL, unos nodos con la ruta nueva y otros sin ella— y a los dos minutos
// daba 4 de 4 a mano. Un guardia que reporta roto lo que esta sano se desactiva solo, en
// la cabeza del que revisa.
//
// El helper ya existe y lo usan los otros chequeos: una sola definicion, importada.
const ESPERA_MAX = 90;
await esperarVersion(BASE, process.env.GITHUB_SHA, ESPERA_MAX);
await esperarRutas(BASE, [`/v1/challenges/${CORRIDA}`], ESPERA_MAX);

let corrida;
try { corrida = await (await fetch(`${BASE}/v1/challenges/${CORRIDA}`, { headers: { "User-Agent": "rosetta promesa check" } })).json(); }
catch (e) { console.error(`[promesa] no se pudo leer la corrida: ${String(e).split("\n")[0]}`); process.exit(2); }

const claves = Object.keys(corrida.proteinas ?? {});
if (!claves.length) { console.error("[promesa] la corrida no trae proteínas: no hay promesa que ejercer"); process.exit(2); }

let ok = 0; const malos = [];
for (const clave of claves) {
  const declarado = corrida.proteinas[clave]?.sha256;
  let cuerpo = null, cabecera, ultimo = null;
  // Hasta 3 intentos: el borde propaga por nodo, no de golpe, asi que dos peticiones
  // seguidas pueden caer en nodos distintos. Comprobar varias veces antes de concluir
  // es la regla de la casa para este sitio.
  for (let intento = 1; intento <= 3 && cuerpo == null; intento++) {
    try {
      const r = await fetch(`${BASE}/v1/challenges/${CORRIDA}/${encodeURIComponent(clave)}/raw`,
                            { headers: { "User-Agent": "rosetta promesa check", "x-rq-check": "1" } });
      if (r.ok) { cuerpo = await r.text(); cabecera = r.headers.get("x-rq-sha256") || undefined; }
      else { ultimo = { estado: "http-" + r.status, motivo: `la ruta que la instrucción manda a bajar no responde (tras ${intento} intento(s))` }; }
    } catch (e) { ultimo = { estado: "sin-red", motivo: String(e).split("\n")[0] }; }
    if (cuerpo == null && intento < 3) await new Promise((res) => setTimeout(res, 5000));
  }
  if (cuerpo == null && ultimo) malos.push({ clave, ...ultimo });

  if (cuerpo == null && !malos.some((m) => m.clave === clave)) continue;
  if (cuerpo == null) continue;

  const r = verificarProteina({ declarado, cuerpo, cabecera });
  if (r.estado === "ok") ok++; else malos.push({ clave, ...r });
}

console.log(`[promesa] ${ok} de ${claves.length} proteína(s) reproducen siguiendo la instrucción publicada.`);
if (malos.length) {
  for (const m of malos) console.error(`  ! ${m.clave}: ${m.estado} — ${m.motivo}`);
  console.error("[promesa] Un tercero que siga nuestra instrucción NO nos puede verificar.");
  console.error("[promesa] En un producto cuyo valor es la verificabilidad, esto es el producto roto.");
  process.exit(1);
}
