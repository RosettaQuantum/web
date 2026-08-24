#!/usr/bin/env node
/**
 * Vigila que ningun texto quede ILEGIBLE sobre su propio fondo.
 *
 * Nace de un defecto real (2026-08-21) que Nicholas cazo a ojo y que ninguno de
 * los cinco guardias existentes miraba: al hacer opaca la barra del sitio en las
 * paginas del informe, mis reglas `.sitenav a{...}` le pisaron el color del texto
 * a DOS elementos que se pintan solos --el boton «Acceso anticipado» y el idioma
 * activo del selector--. Los dos quedaron en **1,06:1**. El minimo legible es
 * 4,5:1; 1,06 es texto del mismo color que su fondo.
 *
 * UMBRAL: 3,0:1, no 4,5. A proposito.
 *   El sitio usa `--faint` (#6E675C) como gris deliberado de de-enfasis en pies,
 *   enlaces legales y etiquetas: da 3,34:1 en todas partes. Fallar en 4,5 marcaria
 *   decenas de elementos que son una decision de diseno, no un defecto -- y un
 *   falso positivo retiene trabajo bueno. Con 3,0 caza lo ilegible de verdad
 *   (texto sobre su propio color) sin discutir la paleta.
 *
 * Punto ciego declarado: mide texto sobre fondo. NO ve contraste de bordes, de
 * iconos, ni si algo queda tapado por otro elemento.
 */
import { abrirChrome } from './lib/chrome.mjs';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, extname } from 'node:path';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = resolve(REPO, 'dist');
const UMBRAL = 3.0;
const PAGINAS = ['/informe-pqc/', '/q-ready/', '/es/q-ready/',
                 '/q-ready/sample-report/', '/es/q-ready/sample-report/'];

if (!existsSync(DIST)) { console.log('contraste: no hay dist/, nada que medir'); process.exit(0); }

const MIME = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript',
               '.svg':'image/svg+xml', '.woff2':'font/woff2', '.png':'image/png' };
const srv = createServer((q, s) => {
  let f = join(DIST, decodeURIComponent(q.url.split('?')[0]));
  if (existsSync(f) && !extname(f)) f = join(f, 'index.html');
  if (!existsSync(f)) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { 'content-type': MIME[extname(f)] ?? 'application/octet-stream' });
  s.end(readFileSync(f));
});
await new Promise((r) => srv.listen(0, r));
const base = `http://127.0.0.1:${srv.address().port}`;
const c = await abrirChrome({ ancho: 1280, alto: 900 });

let fallas = 0;
console.log(`contraste · texto legible sobre su fondo (umbral ${UMBRAL}:1)`);
for (const ruta of PAGINAS) {
  const malos = await c.evaluar(base + ruta, () => {
    const rgba = (s) => { const m = (s.match(/[\d.]+/g) || [0,0,0]).map(Number);
      return [m[0]||0, m[1]||0, m[2]||0, m[3] === undefined ? 1 : m[3]]; };
    const lum = (c) => { const f = (v) => { v /= 255;
      return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); };
      return 0.2126*f(c[0]) + 0.7152*f(c[1]) + 0.0722*f(c[2]); };
    // Un fondo translucido NO es su propio color: se compone sobre lo de atras.
    // Sin esto, texto crit sobre un tinte crit al 9 % da 1,00:1 y parece
    // invisible cuando en pantalla se lee perfecto.
    const fondo = (e) => { let p = e, capas = [];
      while (p) { const b = getComputedStyle(p).backgroundColor;
        if (b && !/transparent/.test(b)) { const x = rgba(b); if (x[3] > 0) capas.push(x); }
        p = p.parentElement; }
      capas.push([0,0,0,1]);
      let out = capas[capas.length-1].slice(0,3);
      for (let i = capas.length-2; i >= 0; i--) { const x = capas[i], a = x[3];
        out = [0,1,2].map((k) => x[k]*a + out[k]*(1-a)); }
      return out; };
    const malos = [];
    document.querySelectorAll('a,button,span,td,th,p,h1,h2,h3,h4,li,div').forEach((e) => {
      if (!e.textContent.trim() || e.children.length) return;
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return;
      const r = e.getBoundingClientRect(); if (!r.width || !r.height) return;
      const l1 = lum(rgba(cs.color)), l2 = lum(fondo(e));
      const cr = (Math.max(l1,l2)+0.05) / (Math.min(l1,l2)+0.05);
      if (cr < 3.0) malos.push(`${e.tagName}.${String(e.className).slice(0,22)} «${e.textContent.trim().slice(0,30)}» ${cr.toFixed(2)}:1`);
    });
    return [...new Set(malos)];
  }, 1200);
  if (malos.length) { console.log(`  ✗ ${ruta}`); malos.slice(0,6).forEach((m) => console.log(`      ${m}`)); fallas += malos.length; }
  else console.log(`  ✓ ${ruta}`);
}
await c.cerrar(); srv.close();
console.log(fallas ? `\ncontraste: ${fallas} elemento(s) ilegible(s). El build se detiene.`
                   : '\ncontraste: nada ilegible.');
process.exit(fallas ? 1 : 0);
