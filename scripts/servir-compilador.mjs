// Servidor estatico minimo para mirar la landing sin levantar Astro.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
const RAIZ = join(process.cwd(), "public", "compilador");
const TIPO = { ".html":"text/html; charset=utf-8", ".mjs":"text/javascript; charset=utf-8",
               ".js":"text/javascript; charset=utf-8", ".json":"application/json; charset=utf-8" };
createServer(async (req, res) => {
  const ruta = normalize(decodeURIComponent(req.url.split("?")[0])).replace(/^(\.\.[/\\])+/, "");
  const f = join(RAIZ, ruta === "/" ? "index.html" : ruta);
  try {
    const b = await readFile(f);
    res.writeHead(200, { "content-type": TIPO[extname(f)] || "application/octet-stream" });
    res.end(b);
  } catch { res.writeHead(404, {"content-type":"text/plain"}); res.end("404 " + ruta); }
}).listen(4567, () => console.log("compilador en http://127.0.0.1:4567/"));
