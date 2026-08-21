import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const RAIZ = new URL('.', import.meta.url).pathname;
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json' };
createServer(async (req, res) => {
  let ruta = decodeURIComponent(req.url.split('?')[0]);
  if (ruta.endsWith('/')) ruta += 'index.html';   // /cleveland/ -> /cleveland/index.html
  const archivo = join(RAIZ, normalize(ruta).replace(/^(\.\.[/\\])+/, ''));
  try {
    const cuerpo = await readFile(archivo);
    res.writeHead(200, { 'content-type': TIPOS[extname(archivo)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(cuerpo);
  } catch { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('no está: ' + ruta); }
}).listen(Number(process.argv[2] || 4340), () => console.log('sirviendo ' + RAIZ + ' en ' + (process.argv[2] || 4340)));
