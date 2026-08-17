#!/usr/bin/env node
/**
 * Servidor de desarrollo SOLO para mirar la consola con dato real.
 *
 * La consola es un archivo estatico que vive de `/v1/...`, y `/v1` lo sirve el Worker en
 * produccion. `astro dev` no lo tiene, asi que la pantalla se veria entera en su estado
 * de error — que es un estado legitimo, pero no el que hay que revisar.
 *
 * Este servidor sirve `public/` desde el disco y reenvia `/v1/*` a produccion. Asi lo que
 * se mira en el navegador es el HTML/JS de esta rama contra los datos verdaderos.
 *
 * NO entra a CI ni al build: es un mirador. Uso: node scripts/dev-consola.mjs [puerto]
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, extname, normalize } from "node:path";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
const PUERTO = Number(process.argv[2] || 4321);
const ARRIBA = "https://rosettaquantum.com";

const TIPOS = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml" };

createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname.startsWith("/v1/")) {
    // Se reenvia tal cual, con la query: /v1/prereg?limit=1000 la necesita.
    const r = await fetch(ARRIBA + url.pathname + url.search, { headers: { accept: "application/json" } });
    const cuerpo = await r.text();
    // Se copian las cabeceras que la consola LEE. x-rq-content-hash es una de ellas y
    // perderla aca haria fallar algo que en produccion funciona.
    const h = { "content-type": r.headers.get("content-type") || "application/json" };
    for (const k of ["x-rq-content-hash", "x-rq-nota"]) if (r.headers.get(k)) h[k] = r.headers.get(k);
    res.writeHead(r.status, h);
    return res.end(cuerpo);
  }
  // normalize() antes de unir: sin eso, `/../..` sale de public/ y sirve el repo entero.
  const rel = normalize(url.pathname.endsWith("/") ? url.pathname + "index.html" : url.pathname).replace(/^(\.\.[/\\])+/, "");
  try {
    const buf = await readFile(join(RAIZ, rel));
    res.writeHead(200, { "content-type": TIPOS[extname(rel)] || "application/octet-stream" });
    res.end(buf);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end(`no existe en public/: ${rel}`);
  }
}).listen(PUERTO, () => console.log(`mirador en http://localhost:${PUERTO}/consola/ — /v1 va a ${ARRIBA}`));
