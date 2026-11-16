#!/usr/bin/env node
/**
 * Las tres fotos fijas de la ficha rosetta-ficha/1 (16-nov-2026). Se generan UNA vez y se versionan:
 * scripts/check-ficha.mjs las lee tal cual, así que un cambio en qex-nucleo (la higiene, el QEX) no
 * mueve el snapshot de la ficha. Si un día hay que regenerarlas, se regeneran a propósito:
 *   node scripts/fixtures/ficha/generar.mjs && node scripts/check-ficha.mjs --actualizar
 *
 * Insumos REALES: las respuestas grabadas de /api/ct y /api/sondas de python.org
 * (scripts/fixtures/medicion-agentes/, 12-nov-2026), con el dominio cambiado por uno de ejemplo para
 * ejercer el país (ajuste 2) sin nombrar a nadie. Los cambios sobre lo medido, uno por caso:
 *   a.json          ejemplo.cl     · A · Chile (se compara) · verificado y público (nombres completos)
 *                                    candado nuevo en todos los nombres que responden; security.txt publicado
 *   f.json          ejemplo.com.py · F · Paraguay (no se compara) · no verificado (enmascarado)
 *                                    staging responde 200; crt.sh falló (se usó Cert Spotter); 4 MX sin híbrido
 *   sin-correo.json example.com    · B · sin país (no se compara) · sin MX publicado; correo nunca medido
 *                                    (example.com: nombre reservado, RFC 2606); el nombre de correo no responde
 */
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import * as N from "../../../public/js/qex-nucleo.mjs";

const raiz = new URL("../../../", import.meta.url);
const leer = (r) => readFileSync(new URL(r, raiz), "utf8");
const REF = JSON.parse(leer("public/data/qex-referencia-2026-08.json"));
const CT_TXT = gunzipSync(readFileSync(new URL("scripts/fixtures/medicion-agentes/ct-python.org.json.gz", raiz))).toString("utf8");
const S_TXT = leer("scripts/fixtures/medicion-agentes/sondas-python.org.json");
const MEDIDO = "2026-11-12T17:34:15.418Z";

function con(dominio) {
  const re = (t) => t.split("python.org").join(dominio);
  return { ct: JSON.parse(re(CT_TXT)), s: JSON.parse(re(S_TXT)) };
}
const ep = (s, host, c) => Object.assign(s.endpoints.find((y) => y.host === host), c);
async function foto(dominio, ctResp, sondas, vertical = "banca") {
  const ct = ctResp ? await N.ctDesdeServidor(ctResp, 0) : null;
  const { foto } = N.armarFoto({ dominio, www: "www." + dominio, vertical, medido: MEDIDO, ct, sondas, referencia: REF, origen: "fixture rosetta-ficha/1" });
  return await N.sellarFoto(foto);
}
const mx = (n, soporta) => Array.from({ length: n }, (_, i) => ({ mx: `mx${i + 1}.correo.example`, veredicto: { estado: "medido", soporta } }));

// A · ejemplo.cl
{
  const d = "ejemplo.cl", { ct, s } = con(d);
  for (const e of s.endpoints) if (e.responde_443 === true) e.hibrido = true;
  s.security_txt.publicado = true;
  const f = await foto(d, ct, s);
  const ctx = { verificado: true, publico: true, fuentes_que_fallaron: [],
    correo: { estado: "hecho", resultado: { servidores: mx(1, true) } } };
  writeFileSync(new URL("a.json", import.meta.url), JSON.stringify({ foto: f, ctx }, null, 1) + "\n");
  console.log(d, N.explicarNota(f).nota);
}
// F · ejemplo.com.py
{
  const d = "ejemplo.com.py", { ct, s } = con(d);
  ep(s, "staging." + d, { dns_status: "NOERROR", ip: ["192.0.2.10"], responde_443: true, detalle: "responde; grupo x25519", hibrido: false, http_status: 200 });
  s.security_txt.publicado = false;
  ct.fuente = "Cert Spotter";
  const f = await foto(d, ct, s);
  const ctx = { verificado: false, publico: false,
    fuentes_que_fallaron: [{ fuente: "crt.sh", ms: 20000, error: "crt.sh no respondió en 20 s" }],
    correo: { estado: "hecho", resultado: { servidores: mx(4, false) } } };
  writeFileSync(new URL("f.json", import.meta.url), JSON.stringify({ foto: f, ctx }, null, 1) + "\n");
  console.log(d, N.explicarNota(f).nota);
}
// sin correo · example.com
{
  const d = "example.com", { ct, s } = con(d);
  s.correo = { mx: [], proveedor: null, error: null };
  ep(s, "mail." + d, { responde_443: false, detalle: "sin respuesta TLS en 443 (cerrado)" });
  s.security_txt.publicado = false;
  const f = await foto(d, ct, s, "retail");
  const ctx = { verificado: false, publico: false, fuentes_que_fallaron: [], correo: null };
  writeFileSync(new URL("sin-correo.json", import.meta.url), JSON.stringify({ foto: f, ctx }, null, 1) + "\n");
  console.log(d, N.explicarNota(f).nota);
}
