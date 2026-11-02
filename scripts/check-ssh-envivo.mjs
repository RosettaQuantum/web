// Pruebas de lib/ssh-kex.mjs contra paquetes REALES capturados el 2-nov-2026 (banner + KEXINIT
// del puerto 22, sin autenticar). Las listas esperadas NO salen de este parser: salen de OpenSSH
// 10.3 (`ssh -vv`, línea «KEX algorithms» de «peer server KEXINIT proposal»), contra el mismo
// servidor y el mismo día. Así un error del parser no se aprueba a sí mismo.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluarSsh, leerKexinit, leerBanner, familiaPq } from "../lib/ssh-kex.mjs";

export const CONSUMIDOR = { quien: "npm run build (prebuild) y npm run check:ssh; lo actúa quien despliegue /api/sondas",
  hace: "si falla, no se despliega: la sonda SSH podría informar «no ofrece post-cuántico» sobre una lista mal leída" };

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const fija = (n) => new Uint8Array(fs.readFileSync(path.join(AQUI, "fixtures/ssh", n)));
const OPENSSH = {
  "github.bin": "mlkem768x25519-sha256,sntrup761x25519-sha512,sntrup761x25519-sha512@openssh.com,curve25519-sha256,curve25519-sha256@libssh.org,ecdh-sha2-nistp256,ecdh-sha2-nistp384,ecdh-sha2-nistp521,diffie-hellman-group-exchange-sha256,kex-strict-s-v00@openssh.com",
  "gitlab.bin": "mlkem768x25519-sha256,curve25519-sha256,curve25519-sha256@libssh.org,ecdh-sha2-nistp256,ecdh-sha2-nistp384,ecdh-sha2-nistp521,diffie-hellman-group14-sha256,diffie-hellman-group14-sha1,kex-strict-s-v00@openssh.com",
  "codeberg.bin": "mlkem768x25519-sha256,sntrup761x25519-sha512,sntrup761x25519-sha512@openssh.com,curve25519-sha256,curve25519-sha256@libssh.org,ecdh-sha2-nistp256,ecdh-sha2-nistp384,ecdh-sha2-nistp521,ext-info-s,kex-strict-s-v00@openssh.com",
  "azure-devops.bin": "diffie-hellman-group14-sha256,diffie-hellman-group16-sha512,diffie-hellman-group-exchange-sha256,diffie-hellman-group18-sha512,kex-strict-s-v00@openssh.com",
};

let pasa = 0, falla = 0;
const prueba = (nombre, f) => {
  try { f(); pasa++; console.log(`  ok    ${nombre}`); }
  catch (e) { falla++; console.log(`  FALLA ${nombre}: ${e.message}`); }
};
const igual = (a, b, q) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${q}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`); };
const lanza = (f, q) => { try { f(); } catch { return; } throw new Error(`${q}: debía fallar y devolvió un resultado`); };

// La lista cruda coincide con OpenSSH, nombre por nombre y en orden (el orden es la preferencia).
for (const [n, ref] of Object.entries(OPENSSH))
  prueba(`${n}: lista idéntica a la que lee OpenSSH`, () => igual(leerKexinit(leerBanner(fija(n)).resto).kex, ref.split(","), n));

// Grito: tres servidores que SÍ ofrecen híbrido post-cuántico, y lo prefieren.
for (const n of ["github.bin", "gitlab.bin", "codeberg.bin"])
  prueba(`${n}: ofrece y prefiere post-cuántico`, () => {
    const r = evaluarSsh(fija(n));
    igual([r.pq_ofrecido, r.pq_preferido, r.pq_algoritmos[0]], [true, true, "mlkem768x25519-sha256"], n);
  });
prueba("github.bin: cuenta las dos familias (ML-KEM y sntrup761)", () =>
  igual(evaluarSsh(fija("github.bin")).pq_familias, ["ML-KEM + X25519", "sntrup761 + X25519"], "familias"));

// Silencio: Azure DevOps NO ofrece post-cuántico. pq:false sale de una lista leída entera.
prueba("azure-devops.bin: no ofrece post-cuántico", () => {
  const r = evaluarSsh(fija("azure-devops.bin"));
  igual([r.pq_ofrecido, r.pq_preferido, r.pq_algoritmos.length], [false, false, 0], "azure");
});
// Las marcas de extensión no son algoritmos: no entran a la lista ni a la preferencia.
prueba("kex-strict y ext-info no se cuentan como algoritmos", () =>
  igual(evaluarSsh(fija("codeberg.bin")).kex.some((k) => /^(kex-strict|ext-info)/.test(k)), false, "marcas"));

// Ausencia no es «no»: un paquete cortado tiene que FALLAR, no devolver pq:false.
prueba("paquete cortado: falla en vez de decir «no ofrece»", () => {
  const b = fija("github.bin"); lanza(() => evaluarSsh(b.subarray(0, b.length - 40)), "cortado");
});
prueba("sólo el banner: falla", () => {
  const b = fija("github.bin"); lanza(() => evaluarSsh(b.subarray(0, b.indexOf(0x0a) + 1)), "sin KEXINIT");
});
// RFC 4253 §4.2: el servidor puede mandar líneas antes del banner.
prueba("líneas antes del banner: se saltan", () => {
  const pre = new TextEncoder().encode("Aviso: acceso restringido\r\n");
  const b = fija("gitlab.bin"), n = new Uint8Array(pre.length + b.length); n.set(pre); n.set(b, pre.length);
  igual(evaluarSsh(n).banner, "SSH-2.0-GitLab-SSHD", "banner");
});
// Familias: reconoce variantes con sufijo; no confunde un clásico con uno híbrido.
prueba("familias: variantes con sufijo sí, clásicos no", () =>
  igual(["sntrup761x25519-sha512@openssh.com", "mlkem1024nistp384-sha384", "curve25519-sha256", "ecdh-sha2-nistp384"].map(familiaPq),
    ["sntrup761 + X25519", "ML-KEM + ECDH NIST", null, null], "familias"));

console.log(`\ncheck-ssh-envivo: ${pasa} pasaron, ${falla} fallaron, 0 saltadas`);
process.exit(falla ? 1 : 0);
