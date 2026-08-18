/**
 * Manejador minimo de Chrome por CDP, SIN dependencias nuevas.
 *
 * POR QUE ASI Y NO CON PUPPETEER
 * ------------------------------
 * Puppeteer trae su propio navegador y su propia cadena de versiones. El 2026-08-12 un
 * `npx wrangler` sin fijar tumbo un deploy por un paquete de terceros que no existia: una
 * herramienta sin version fija en el camino critico es una dependencia de terceros ahi
 * dentro. Node 22 trae `WebSocket` global y el runner de GitHub trae Chrome preinstalado
 * (google-chrome 151 en ubuntu-24.04, comprobado en el manifiesto de la imagen), asi que
 * hablar CDP directo cuesta ~60 lineas y cero dependencias.
 *
 * Hace lo justo: abrir una pagina, evaluar JS dentro, devolver el resultado, cerrar.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Chrome segun el sistema. Si no esta, se dice DONDE se busco: un "no encontrado" sin ruta no se puede arreglar. */
export function buscarChrome() {
  const candidatos = process.platform === "darwin"
    ? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
       "/Applications/Chromium.app/Contents/MacOS/Chromium"]
    : ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium-browser", "/usr/bin/chromium"];
  for (const c of candidatos) if (existsSync(c)) return c;
  throw new Error(`no encontre Chrome. Busque en:\n   - ${candidatos.join("\n   - ")}`);
}

/** Abre Chrome y devuelve `{ evaluar, cerrar }`. `ancho`/`alto` fijan la ventana. */
export async function abrirChrome({ ancho = 1280, alto = 900 } = {}) {
  const perfil = mkdtempSync(join(tmpdir(), "rq-chrome-"));
  const proc = spawn(buscarChrome(), [
    "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    "--disable-dev-shm-usage", "--no-sandbox",
    `--window-size=${ancho},${alto}`, `--user-data-dir=${perfil}`, "--remote-debugging-port=0",
    "about:blank",
  ], { stdio: ["ignore", "pipe", "pipe"] });

  // Chrome anuncia su puerto real en stderr. Esperarlo es mas fiable que fijar un puerto:
  // un puerto ocupado daria un fallo raro y tardio en vez de uno claro.
  const ws = await new Promise((res, rej) => {
    let buf = "";
    const t = setTimeout(() => rej(new Error("Chrome no anuncio su puerto en 20 s")), 20000);
    proc.stderr.on("data", d => {
      buf += d;
      const m = buf.match(/ws:\/\/[^\s]+/);
      if (m) { clearTimeout(t); res(m[0]); }
    });
    proc.on("exit", c => { clearTimeout(t); rej(new Error(`Chrome murio con codigo ${c}: ${buf.slice(-300)}`)); });
  });

  const sock = new WebSocket(ws);
  await new Promise((res, rej) => { sock.onopen = res; sock.onerror = e => rej(new Error("no pude conectar a CDP")); });
  let id = 0;
  const pendientes = new Map();
  sock.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pendientes.has(m.id)) { pendientes.get(m.id)(m); pendientes.delete(m.id); }
  };
  const enviar = (method, params = {}, sessionId) => new Promise((res, rej) => {
    const i = ++id;
    pendientes.set(i, m => m.error ? rej(new Error(`${method}: ${m.error.message}`)) : res(m.result));
    sock.send(JSON.stringify({ id: i, method, params, sessionId }));
  });

  const { targetId } = await enviar("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await enviar("Target.attachToTarget", { targetId, flatten: true });
  await enviar("Page.enable", {}, sessionId);
  await enviar("Runtime.enable", {}, sessionId);
  // `--window-size` NO alcanza: Chrome tiene un ancho minimo de ventana (~500 px), asi que
  // pedir 375 daba un innerWidth de 500 y el chequeo AFIRMABA medir a 375 midiendo otra
  // cosa. El viewport se emula, que es lo unico que hace que la cifra sea la que dice.
  await enviar("Emulation.setDeviceMetricsOverride",
    { width: ancho, height: alto, deviceScaleFactor: 1, mobile: ancho < 768 }, sessionId);

  return {
    /** Carga `url`, espera a que la pagina quede quieta, y evalua `fn` dentro. */
    async evaluar(url, fn, esperaMs = 3500) {
      await enviar("Page.navigate", { url }, sessionId);
      await new Promise(r => setTimeout(r, esperaMs));   // la consola pinta despues de fetch
      const r = await enviar("Runtime.evaluate", {
        expression: `(${fn.toString()})()`, returnByValue: true, awaitPromise: true,
      }, sessionId);
      if (r.exceptionDetails) throw new Error("la pagina lanzo: " + r.exceptionDetails.text);
      return r.result.value;
    },
    async cerrar() {
      sock.close();
      proc.kill();
      // Esperar a que MUERA antes de borrar el perfil: si no, Chrome sigue escribiendo y
      // el borrado revienta con ENOTEMPTY — un fallo de limpieza que se lee como fallo
      // del chequeo, que es peor que no limpiar.
      await new Promise(r => { proc.on("exit", r); setTimeout(r, 3000); });
      try { rmSync(perfil, { recursive: true, force: true }); } catch { /* perfil temporal: no vale tumbar el chequeo */ }
    },
  };
}
