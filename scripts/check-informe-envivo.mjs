#!/usr/bin/env node
// Guardia del informe QEX en vivo (public/js/qex-nucleo.mjs). 30-oct-2026.
//
// Siempre: vectores fijos (redondeo al par de Python, irec, clases de CT, comparación).
// Con --corpus <carpeta del proyecto Rosetta Quantum>: exige que el núcleo JS reproduzca la
// medición de Python sobre los MISMOS archivos crudos — conteos de agosto reconstruidos
// (220/66/1/0/4/13), conteos y lista de hosts de octubre (ct-santander-2026-10.json), higiene,
// QEX 56, y las 170 filas de indice-agosto-2026.json. Ese corpus trae nombres de organizaciones
// y NO vive en este repositorio (es público): por eso entra por argumento.
// Sin --corpus esas pruebas salen como SALTADAS en el resumen, nunca como pasadas.
import fs from "node:fs";
import path from "node:path";
import * as N from "../public/js/qex-nucleo.mjs";

export const CONSUMIDOR = { quien: "npm run check:envivo, y quien genere una foto o el informe de un cliente (entregables/*/envivo)",
  hace: "no confía en una cifra del QEX en vivo ni en una comparación de fotos si esto no pasa con --corpus" };

let pasa = 0, falla = 0, salta = 0;
const ok = (c, m) => { if (c) { pasa++; } else { falla++; console.log("  FALLA " + m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);

// --- redondeo: Python round() es mitad al par
eq(N.redondearPar(55.5), 56, "55,5"); eq(N.redondearPar(56.5), 56, "56,5 (Math.round daría 57)"); eq(N.redondearPar(57.5), 58, "57,5");
eq(N.redondearPar(56.49), 56, "56,49"); eq(N.redondearPar(56.51), 57, "56,51");
// --- irec
eq(N.irec({ certificados: 75, higiene: 50, hndl: 12, edge: 100 }), 56, "Santander agosto");
eq(N.irec({ certificados: 100, higiene: 100, hndl: 100, edge: 100 }), 84, "tope 84");
eq(N.irec({ certificados: 75, higiene: 60, hndl: 12, edge: null }), N.redondearPar((75 * .4 + 60 * .25 + 12 * .25) / .9), "edge no medido renormaliza");
eq(N.irec({ certificados: null, higiene: null, hndl: null, edge: null }), null, "nada medido = null, no 0");
let lanzo = false; try { N.irec({ certificados: 75 }); } catch { lanzo = true; } ok(lanzo, "falta dimensión debe lanzar");
// --- higiene: grito y silencio
eq(N.higiene(false, { no_productivo: 1, infra_expuesta: 4, legado: 0 }), 50, "higiene Santander");
eq(N.higiene(false, { no_productivo: 0, infra_expuesta: 2, legado: 0 }), 70, "infra 2 no descuenta");
eq(N.higiene(false, { no_productivo: 0, infra_expuesta: 3, legado: 0 }), 60, "infra 3 SÍ descuenta (borde del umbral)");
eq(N.higiene(false, { no_productivo: 0, infra_expuesta: 0, legado: 1 }), 60, "legado 1 descuenta");
eq(N.higiene(null, null), 70, "sin TLS medido ni CT: no descuenta");
eq(N.higiene(true, null), 40, "sin TLS 1.3 descuenta 30");
// --- certificados
eq(N.certificadosValor({ ok: true, algoritmo: "EC", bits: 256 }), 75, "P-256 = 75");
eq(N.certificadosValor({ ok: true, algoritmo: "EC", bits: 384 }), 100, "P-384 = 100");
eq(N.certificadosValor({ ok: true, algoritmo: "RSA", bits: 2048 }), 75, "RSA 2048 = 75");
eq(N.certificadosValor({ ok: false }), null, "certificado no leído = null, no 0");
// --- clases: grito y silencio (el silencio paradójico: la palabra dentro de otra)
eq(N.clasesDe("pre.fxenlinea.santander.cl"), ["no_productivo"], "pre. es no productivo");
eq(N.clasesDe("prensa.santander.cl"), [], "prensa NO es pre");
eq(N.clasesDe("smtp.corp.santander.cl"), ["infra_expuesta"], "smtp");
eq(N.clasesDe("mailing.santander.cl"), [], "mailing NO es mail");
eq(N.clasesDe("api-test.santander.cl"), ["no_productivo", "critico"], "api-test: dos clases");
// --- comparación: un ítem sin dato nunca se lee como «se mantiene»
{
  const a = { dominio: "x.cl", qex: { score: 56, dimensiones: { certificados: 75, higiene: 50, hndl: 12, edge: 100 } },
    ct: { conteos: { hostnames: 2 }, hosts: [{ host: "a.x.cl" }, { host: "b.x.cl" }] }, borde: { soporta: true },
    endpoints: [{ host: "mail.x.cl", dns_status: null, responde_443: null }], proveedores: { security_txt: false } };
  const b = { dominio: "x.cl", qex: { score: 56, dimensiones: { certificados: 75, higiene: 50, hndl: 12, edge: 100 } },
    ct: { conteos: { hostnames: 3 }, hosts: [{ host: "a.x.cl" }, { host: "b.x.cl" }, { host: "c.x.cl" }] }, borde: { soporta: true },
    endpoints: [{ host: "mail.x.cl", dns_status: "NXDOMAIN", responde_443: null }], proveedores: { security_txt: null } };
  const c = N.comparar(a, b);
  const por = (k) => c.items.find((i) => i.k === k);
  eq(por("score").estado, "se_mantiene", "QEX igual");
  eq(por("hostnames").estado, "cambio", "conteo cambia");
  eq(por("security_txt").estado, "sin_dato", "null hoy = sin dato");
  eq(por("emisor").estado, "sin_dato", "ausente en ambas = sin dato");
  eq(por("elige").estado, "sin_dato", "ausente en ambas = sin dato");
  eq(c.hosts, { nuevos: ["c.x.cl"], retirados: [], siguen: 2 }, "hosts nuevos/retirados");
  eq(c.endpoints[0], { host: "mail.x.cl", antes: "presente en el registro público", ahora: "ya no publicado en DNS", estado: "medido_hoy" }, "sólo presencia antes → medido hoy, NO «cambió»");
  const d = N.comparar({ ...a, borde: {}, endpoints: [{ host: "mail.x.cl", dns_status: "NOERROR", responde_443: true }] }, b);
  eq(d.items.find((i) => i.k === "soporta").estado, "medido_hoy", "no medido antes → medido hoy");
  eq(d.endpoints[0].estado, "cambio", "medido en ambas y distinto → cambió");
  const sinHosts = N.comparar({ ...a, ct: { conteos: {} } }, b);
  eq(sinHosts.hosts, { nuevos: null, retirados: null, siguen: null }, "sin lista previa: null, no «0 nuevos»");
}
// --- sello: integridad detecta un cambio de un carácter
{
  const f = await N.sellarFoto({ esquema: N.ESQUEMA_FOTO, dominio: "x.cl", qex: { score: 56 } });
  ok(await N.fotoIntegra(f), "foto sellada es íntegra");
  ok(!(await N.fotoIntegra({ ...f, qex: { score: 57 } })), "foto alterada NO es íntegra");
}

// --- corpus privado: el núcleo JS tiene que reproducir lo medido con Python
const i = process.argv.indexOf("--corpus");
const PRUEBAS_CORPUS = 7;
if (i < 0) {
  salta += PRUEBAS_CORPUS;
  console.log(`  (sin --corpus: ${PRUEBAS_CORPUS} pruebas de reproducción contra Python SALTADAS)`);
} else {
  const R = process.argv[i + 1];
  const M = path.join(R, "entregables/santander-2026-11/medicion-octubre");
  const J = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
  const filas = J(path.join(M, "crudo/crtsh-santander.cl.json"));
  const ref = J(path.join(M, "ct-santander-2026-10.json"));
  const ago = N.nombresCT(filas, "santander.cl", ref.corte_agosto_not_before);
  const hoy = N.nombresCT(filas, "santander.cl");
  eq(N.conteos([...ago.keys()]), ref.conteos_agosto_publicado, "agosto reconstruido = 220/66/1/0/4/13 publicados");
  eq(N.conteos([...hoy.keys()]), ref.conteos_octubre, "conteos de octubre = Python");
  eq([...hoy.keys()].sort(), ref.hosts.map((h) => h.host), "lista de hosts de octubre = Python");
  eq(N.hostsCT(hoy, "santander.cl").map((h) => [h.host, h.clases, h.profundo, h.etiqueta_estricta]),
    ref.hosts.map((h) => [h.host, h.clases, h.profundo, h.etiqueta_estricta_santander_cl]), "clases por host = Python");
  const q = J(path.join(M, "qex-santander-2026-10.json"));
  eq(N.higiene(false, N.conteos([...hoy.keys()])), q.dimensiones.higiene, "higiene = Python");
  eq(N.irec(q.dimensiones), q.score, "QEX octubre = Python");
  const idx = J(path.join(R, "indice-agosto-2026.json"));
  const malas = idx.filter((r) => N.irec(r) !== r.score);
  eq(`${idx.length - malas.length}/${idx.length}`, `${idx.length}/${idx.length}`, "irec reproduce el índice de agosto");
}

console.log(`check-informe-envivo: ${pasa} pasaron, ${falla} fallaron, ${salta} saltadas`);
process.exit(falla ? 1 : 0);
