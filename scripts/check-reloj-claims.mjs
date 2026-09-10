#!/usr/bin/env node
/**
 * Vigila que el reloj de cada claim cuadre con las dos fechas que se publican a su lado.
 *
 * EL DEFECTO REAL (10-sep-2026). /v1/claims publicaba `clock_days` leyendo una columna
 * guardada en D1, y en 3 de las 11 filas con desafio esa columna no reproducia la resta
 * de las dos fechas que viajan en la MISMA fila:
 *
 *     RQC-2019-GOOGLE-RCS      publicaba   2   ·  2019-10-23 - 2019-10-21 =  -2
 *     RQC-2018-TANG-DEQUANT    publicaba 862   ·                            861
 *     RQC-2020-USTC-JIUZHANG   publicaba 270   ·                            272
 *
 * Un lector resta dos fechas en diez segundos. Es el mismo modo de fallo que
 * check-informe-cifras caza en el informe PQC —un numero correcto en apariencia,
 * calculado sobre una base y rotulado con otra— pero en el ledger, que es la pieza
 * de la que vive la casa.
 *
 * EL ARREGLO NO FUE PARCHEAR LAS TRES FILAS: fue derivar el numero de las fechas en
 * la consulta. Lo observable son las fechas; el conteo es una vista de ellas. Asi no
 * puede volver a divergir. Este guardia existe para que ese arreglo no se deshaga en
 * silencio en un refactor futuro, y para dos cosas mas que la derivacion no resuelve.
 *
 * QUE COMPRUEBA, y por que cada cosa:
 *   1. `clock_days` == la resta de las dos fechas publicadas. Si alguien vuelve a
 *      servir la columna guardada, esto grita.
 *   2. `clock_days_guardado` != el derivado -> se REPORTA como deriva del dato en D1.
 *      No falla: la API ya publica el correcto. Pero decirlo es lo que permite
 *      limpiar la tabla algun dia en vez de olvidarla.
 *   3. Un desafio ANTERIOR a su claim (clock_days negativo) se lista para revision
 *      humana. Puede ser cierto —el caso de Google lo es, la refutacion de IBM
 *      circulo antes de que Nature publicara— o puede ser una fecha mal tecleada.
 *      El guardia no adivina cual: lo pone donde se vea.
 *   4. `first_challenge` presente <-> `clock_days` no nulo. Una de las dos sin la
 *      otra es una fila a medio llenar.
 *
 * CONSUMIDOR: quien publica el ledger y quien autoriza el cutover.
 * QUE HACE SI FALLA: no publica. El ledger estaria afirmando un intervalo que sus
 * propias fechas desmienten, y es la pagina que sostiene la promesa de la casa.
 *
 * PUNTO CIEGO DECLARADO: no comprueba que las FECHAS sean correctas. Si claim_date y
 * first_challenge estan las dos mal, la resta cuadra y este guardia pasa. Eso se
 * verifica contra la fuente de cada claim, no contra la aritmetica.
 */

export const CONSUMIDOR = {
  quien: "quien publica el ledger y quien autoriza el cutover",
  hace: "no publica: el ledger estaria afirmando un intervalo que sus propias fechas desmienten, y es la pagina que sostiene la promesa de la casa",
};

const dias = (a, b) =>
  Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);

/** El nucleo, separado de la red para poder ejercerlo con filas inventadas. */
export function revisar(claims) {
  const fallas = [], deriva = [], negativos = [];
  for (const c of claims) {
    const tiene = c.first_challenge != null && c.first_challenge !== "";
    if (tiene !== (c.clock_days != null)) {
      fallas.push(`${c.id}: first_challenge=${c.first_challenge ?? "null"} y clock_days=${c.clock_days ?? "null"} — una sin la otra`);
      continue;
    }
    if (!tiene) continue;
    const real = dias(c.claim_date, c.first_challenge);
    if (c.clock_days !== real)
      fallas.push(`${c.id}: publica ${c.clock_days} · ${c.first_challenge} - ${c.claim_date} = ${real}`);
    if (c.clock_days_guardado != null && c.clock_days_guardado !== real)
      deriva.push(`${c.id}: la columna de D1 dice ${c.clock_days_guardado}, la resta da ${real}`);
    if (real < 0) negativos.push(`${c.id}: el desafío es ${Math.abs(real)} días ANTERIOR al claim`);
  }
  return { fallas, deriva, negativos };
}

/* AUTOPRUEBA. Tiene que GRITAR en el defecto historico real y CALLAR en el corregido:
   un guardia que solo sabe hacer una de las dos cosas no esta probado. */
if (process.argv.includes("--autoprueba")) {
  const roto = [{ id: "T-GOOGLE", claim_date: "2019-10-23", first_challenge: "2019-10-21", clock_days: 2, clock_days_guardado: 2 }];
  const sano = [{ id: "T-GOOGLE", claim_date: "2019-10-23", first_challenge: "2019-10-21", clock_days: -2, clock_days_guardado: 2 },
                { id: "T-SIN", claim_date: "2026-08-03", first_challenge: null, clock_days: null, clock_days_guardado: null }];
  const a = revisar(roto), b = revisar(sano);
  const grita = a.fallas.length === 1;
  const calla = b.fallas.length === 0;
  const ve_deriva = b.deriva.length === 1;
  const ve_negativo = b.negativos.length === 1;
  console.log(`  grita en el defecto real ........ ${grita ? "sí" : "NO"}  ${a.fallas[0] ?? ""}`);
  console.log(`  calla en el corregido ........... ${calla ? "sí" : "NO"}`);
  console.log(`  ve la deriva de la columna ...... ${ve_deriva ? "sí" : "NO"}`);
  console.log(`  marca el intervalo negativo ..... ${ve_negativo ? "sí" : "NO"}`);
  process.exit(grita && calla && ve_deriva && ve_negativo ? 0 : 1);
}

/* La base se exige AQUI y no arriba: la autoprueba no toca la red y tiene que poder
   correr sola. La primera version pedia --base antes de mirar el flag, asi que la
   autoprueba abortaba sin llegar a probar nada — un autotest que no puede correr es
   exactamente el «enchufado sin ejercer» que parece vivo. */
const BASE = (process.argv.find((a) => a.startsWith("--base="))?.slice(7)
  || process.env.PREVIEW_URL || "").replace(/\/+$/, "");
if (!BASE) {
  console.error("ABORTA: falta --base=<url> o PREVIEW_URL.");
  console.error("  Sin base declarada un verde no dice que se midio. (Leccion del 10-sep:");
  console.error("  check-alcance corrio ocho veces contra produccion creyendo medir preview.)");
  process.exit(1);
}

const r = await fetch(BASE + "/v1/claims?limit=200", { headers: { "x-rq-check": "1" } });
if (!r.ok) { console.log(`ABORTA: /v1/claims -> ${r.status}`); process.exit(1); }
const { claims = [] } = await r.json();
const con = claims.filter((c) => c.first_challenge);
console.log(`reloj de claims · ${BASE}`);
console.log(`  ${claims.length} claims · ${con.length} con desafío registrado\n`);

const { fallas, deriva, negativos } = revisar(claims);
for (const d of deriva)    console.log(`  — deriva  ${d}`);
for (const n of negativos) console.log(`  — revisar ${n}`);
for (const f of fallas)    console.log(`  ✗ ${f}`);
if (!fallas.length) console.log(`  ok    las ${con.length} reproducen su intervalo desde sus dos fechas`);

console.log(`\n${con.length} recomputados · ${deriva.length} con deriva en D1 · ${negativos.length} para revisar · ${fallas.length} fallas`);
process.exit(fallas.length ? 1 : 0);
