#!/usr/bin/env node
/**
 * Dos fotos fijas desde las respuestas CRUDAS del MCP de producción del 16-nov-2026 (las de la ficha
 * aprobada: carpeta entregables/ficha-rosetta-2026-11/, fuera de este repo). Casos de B1 y de ALTA.
 *   node scripts/fixtures/ficha/generar-rastreo.mjs <carpeta> <archivo>:<salida>:<dominio real>:<dominio de ejemplo> …
 *
 * Los dominios se enmascaran (el repo es público): el dominio real → uno .example, en TODO el texto,
 * antes de leerlo. El nombre real NO se escribe en este archivo: llega por argumento. Cada fixture
 * guarda el sha256 del archivo original del que sale, para que se pueda cotejar contra la carpeta.
 * Lo RECONSTRUIDO (la respuesta del MCP no trae el registro crudo): las filas del registro de certificados
 * son sólo los nombres que la respuesta deja ver (el sitio, www y los sondeados), así que el QEX de la
 * foto puede diferir del real; la nota, las alertas y el certificado salen de lo medido tal cual.
 *   rastreob.json  B1: el servidor no aceptó TLS 1.2, «Certificados y PKI» quedó en null (salía A)
 *   rastreo.json   F con GRAVE, ALTA y MEDIA (la ficha aprobada)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import * as N from "../../../public/js/qex-nucleo.mjs";

const [carpeta, ...pares] = process.argv.slice(2);
if (!carpeta || !pares.length) { console.error("uso: generar-rastreo.mjs <carpeta> <archivo>:<salida>:<dominio real>:<dominio de ejemplo> …"); process.exit(2); }
const raiz = new URL("../../../", import.meta.url);
const REF = JSON.parse(readFileSync(new URL("public/data/qex-referencia-2026-08.json", raiz), "utf8"));
const CASOS = pares.map((p) => p.split(":"));
// todos los reemplazos se aplican a todos los archivos (un archivo puede nombrar al otro dominio)
const anonimo = (t) => CASOS.reduce((x, [, , real, ej]) => x.split(real).join(ej), t);

for (const [orig, sal] of CASOS) {
  const crudo = readFileSync(join(carpeta, orig));
  const sha = createHash("sha256").update(crudo).digest("hex");
  const r = JSON.parse(anonimo(JSON.parse(crudo.toString("utf8")).result.content[0].text));
  const nombres = [...new Set([r.dominio, r.sitio_web.host, ...r.endpoints.map((e) => e.host)])];
  const ct = { filas: [{ name_value: nombres.join("\n"), not_before: "2026-11-08T00:00:00", not_after: "2027-02-06T00:00:00" }],
    sha256: r.registro_ct.sha256_crudo, ms: 0, fuente: r.registro_ct.fuente, consultado_utc: r.registro_ct.consultado_utc, intentos: 1 };
  const sondas = { ok: true, instrumento: r.instrumento, dominio: r.dominio, www: r.sitio_web.host, medido_utc: r.medido_utc,
    borde: { dns: { cdn: r.sitio_web.cdn, cadena: [] }, saludos: r.sitio_web.saludos, sha256: "0".repeat(64),
      veredicto: { conectado: true, soporta: r.sitio_web.soporta_hibrido_pq, elige: r.sitio_web.elige_hibrido_pq, pide_mejora: null } },
    certificado: r.certificado, endpoints: r.endpoints, correo: { mx: r.correo.mx, proveedor: r.correo.proveedor }, security_txt: r.security_txt };
  const { foto } = N.armarFoto({ dominio: r.dominio, www: r.sitio_web.host, vertical: r.sector.clave, medido: r.medido_utc, ct, sondas, referencia: REF,
    origen: "fixture rosetta-ficha/1 desde la respuesta del MCP de producción" });
  const sellada = await N.sellarFoto(foto);
  const ctx = { verificado: false, publico: false, fuentes_que_fallaron: r.registro_ct.fuentes_que_fallaron || [], correo: null };
  writeFileSync(new URL(sal, import.meta.url), JSON.stringify({ origen_sha256: sha,
    nota_en_produccion: r.nota.letra, version_en_produccion: r.nota.version, foto: sellada, ctx }, null, 1) + "\n");
  console.log(sal, "producción:", r.nota.letra, "· ahora:", N.explicarNota(sellada).nota, N.VERSION_NOTA, "· sha256 original", sha);
}
