#!/usr/bin/env node
/**
 * ¿Se puede TOCAR lo que la pagina muestra? Sobre todo a 375 px.
 *
 * EL DEFECTO QUE ESTE CHEQUEO EXISTE PARA ATRAPAR
 * -----------------------------------------------
 * El 2026-08-17, en /consola/, el boton «ver el sello» de Corridas quedaba en x=771 dentro
 * de una ventana de 375, en un contenedor que heredaba `main{overflow-x:hidden}`. El boton
 * existia, estaba en el HTML, se leia en el DOM — y no habia forma de llegar a el con el
 * dedo. Ningun analisis estatico lo ve: no hay clase compartida ni cadena que grepear.
 * Es el punto ciego que el guardia de zonas declara y no cubre.
 *
 * Y es de los que nadie reporta: el usuario no dice «este boton esta a 771 pixeles», dice
 * «no me funciono» y se va.
 *
 * LA REGLA, Y POR QUE ES ESTRECHA A PROPOSITO
 * -------------------------------------------
 * Un elemento interactivo esta INALCANZABLE si su rectangulo cae fuera del area visible de
 * un ancestro que lo RECORTA (`overflow` hidden/clip) y ese ancestro NO puede desplazarse.
 * Si el contenedor hace scroll, el elemento se alcanza deslizando y no es defecto — por eso
 * el arreglo de aquel dia fue `overflow-x:auto`, no ensanchar la pantalla.
 *
 * Precision sobre cobertura: un falso positivo aqui retiene trabajo bueno y entrena a
 * ignorar el chequeo.
 *
 * Uso:  node scripts/check-alcance.mjs [--base https://rosettaquantum.com] [--self-test]
 */
import { abrirChrome } from "./lib/chrome.mjs";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/* OJO: por defecto mide PRODUCCION, no el build local. Es lo correcto para un
   chequeo de alcance —lo que importa es si el usuario puede tocar lo que ve en
   el sitio vivo— pero significa que NO sirve como guardia de prebuild: fallaria
   por el estado de produccion, no por el del build. Va en `npm run check:prod`,
   despues de desplegar. Para auditar un build local: --base http://127.0.0.1:PUERTO
   Costo real de no saberlo: media hora persiguiendo un desborde de 550 px que
   estaba en produccion y ya estaba arreglado en el codigo. (2026-08-21) */
const BASE = process.argv.includes("--base") ? process.argv[process.argv.indexOf("--base") + 1]
                                             : "https://rosettaquantum.com";
/** Las paginas donde alguien tiene que poder HACER algo. */
const PAGINAS = ["/consola/", "/cleveland/", "/es/cleveland/", "/es/precios/", "/pricing/", "/api-docs/", "/es/api-docs/",
  // Q-Ready y los informes, agregados 2026-08-20. Son las paginas que un cliente
  // lee para decidir una compra y las que nadie habia mirado renderizadas.
  "/informe-pqc/", "/q-ready/", "/es/q-ready/", "/q-ready/sample-report/", "/es/q-ready/sample-report/"];
const ANCHOS = [375, 1280];

/**
 * Corre DENTRO de la pagina: se inyecta como texto, asi que TODO lo que usa vive adentro.
 *
 * Si la pagina tiene zonas (el riel de la consola) las RECORRE haciendo clic. Auditar solo
 * la zona activa dejaria sin mirar cinco sextos de la pantalla — y el defecto que origino
 * este chequeo estaba justo en una zona que no era la de entrada. Con el riel puesto, la
 * consola pasa de 15 elementos vistos a todos los suyos.
 */
export function auditarTodo() {
  const SEL = "a[href], button, input, select, textarea, [role=button], [tabindex]:not([tabindex='-1'])";
  // Por EJE, y mirando el TIPO de overflow — no si el contenido desborda.
  // Mi primera version preguntaba `scrollWidth > clientWidth`, que con overflow:hidden es
  // TRUE (el contenido desborda) aunque el usuario no pueda desplazar nada. O sea que el
  // chequeo se callaba justo con el defecto que existe para atrapar.
  const recortaEje = (e, eje) =>
    /hidden|clip/.test(getComputedStyle(e)[eje === "x" ? "overflowX" : "overflowY"]);

  const unaPantalla = () => {
    const malos = [];
    let vistos = 0;
    for (const el of document.querySelectorAll(SEL)) {
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) continue;              // oculto: no es defecto de alcance
      if (getComputedStyle(el).visibility === "hidden") continue;
      if (el.closest("[hidden]")) continue;             // zona no activa
      vistos++;
      let p = el.parentElement, causa = null;
      while (p && p !== document.documentElement) {
        // Si un ancestro INTERMEDIO se desplaza de verdad, el elemento se alcanza
        // deslizando y no hay defecto — aunque mas arriba haya algo que recorte. Sin este
        // corte, el chequeo marcaba los botones de Corridas que ya se arreglaron poniendo
        // `overflow-x:auto` en su caja: 79 falsos positivos, todos del mismo origen.
        const desplazable = eje =>
          /auto|scroll/.test(getComputedStyle(p)[eje === "x" ? "overflowX" : "overflowY"]) &&
          (eje === "x" ? p.scrollWidth > p.clientWidth + 1 : p.scrollHeight > p.clientHeight + 1);
        if (desplazable("x") || desplazable("y")) break;
        const pr = p.getBoundingClientRect();
        const fueraX = r.right > pr.right + 1 || r.left < pr.left - 1;
        const fueraY = r.bottom > pr.bottom + 1 || r.top < pr.top - 1;
        if ((fueraX && recortaEje(p, "x")) || (fueraY && recortaEje(p, "y"))) {
          causa = { ancestro: p.tagName.toLowerCase() + (p.id ? "#" + p.id : ""),
                    eje: fueraX && recortaEje(p, "x") ? "x" : "y" };
          break;
        }
        p = p.parentElement;
      }
      if (causa) malos.push({ etiqueta: el.tagName.toLowerCase(),
        texto: (el.textContent || "").trim().slice(0, 40),
        x: Math.round(r.left), derecha: Math.round(r.right), ventana: innerWidth, ...causa });
    }
    return { vistos, malos, desbordaBody: document.documentElement.scrollWidth > innerWidth + 1 };
  };

  const rieles = [...document.querySelectorAll(".rail button[data-v]")];
  if (!rieles.length) return { ...unaPantalla(), zonas: 1, ancho: innerWidth };
  const malos = [];
  let vistos = 0, desbordaBody = false;
  for (const b of rieles) {
    b.click();
    const r = unaPantalla();
    vistos += r.vistos;
    desbordaBody = desbordaBody || r.desbordaBody;
    malos.push(...r.malos.map(m => ({ ...m, zona: b.dataset.v })));
  }
  return { vistos, malos, desbordaBody, zonas: rieles.length, ancho: innerWidth };
}

// ------------------------------------------------------------------ self-test
if (process.argv.includes("--self-test")) {
  const dir = mkdtempSync(join(tmpdir(), "rq-alcance-"));
  // EL CASO REAL, reconstruido — y OJO con reconstruirlo mal: mi primera version ponia una
  // tabla de 900 px pero el boton caia en x=110, o sea DENTRO, y el chequeo se callaba con
  // razon. El defecto de verdad tenia columnas anchas por delante que empujaban la ultima
  // celda a x=771 de una ventana de 375. Sin esa celda ancha el caso no reproduce nada.
  const roto = `<!doctype html><html><head><meta charset=utf-8><style>
    main{width:375px;overflow-x:hidden} table{width:900px} td.ancha{width:760px}</style></head>
    <body><main><table><tr><td class=ancha>resultado largo</td><td><button>ver el sello</button></td></tr></table></main></body></html>`;
  // El MISMO html con el arreglo que se aplico: el contenedor se desplaza.
  const sano = roto.replace("overflow-x:hidden", "overflow-x:auto");
  writeFileSync(join(dir, "roto.html"), roto);
  writeFileSync(join(dir, "sano.html"), sano);

  const c = await abrirChrome({ ancho: 375, alto: 812 });
  let ok = 0, mal = 0;
  const prueba = (n, cond, d = "") => cond ? (ok++, console.log(`  ok   ${n}`))
                                           : (mal++, console.log(`  FALLA ${n}${d ? "\n         " + d : ""}`));
  const rRoto = await c.evaluar("file://" + join(dir, "roto.html"), auditarTodo, 300);
  const rSano = await c.evaluar("file://" + join(dir, "sano.html"), auditarTodo, 300);
  await c.cerrar();

  prueba("grita con el defecto real: recortado y sin scroll", rRoto.malos.length === 1, JSON.stringify(rRoto));
  prueba("y dice donde estaba", rRoto.malos[0] && rRoto.malos[0].derecha > 375, JSON.stringify(rRoto.malos[0]));
  // El caso que exige SILENCIO: el mismo boton, misma posicion, contenedor que se desplaza.
  prueba("se calla cuando el contenedor SI se desplaza", rSano.malos.length === 0, JSON.stringify(rSano));
  prueba("vio botones en los dos casos", rRoto.vistos === 1 && rSano.vistos === 1,
    `roto=${rRoto.vistos} sano=${rSano.vistos}`);
  console.log(`\nself-test: ${ok} pasaron, ${mal} fallaron`);
  process.exit(mal ? 1 : 0);
}

// ------------------------------------------------------------------ en vivo
let fallos = 0, totalVistos = 0;
for (const ancho of ANCHOS) {
  const c = await abrirChrome({ ancho, alto: 900 });
  for (const ruta of PAGINAS) {
    const r = await c.evaluar(BASE + ruta, auditarTodo);
    totalVistos += r.vistos;
    const problemas = [];
    if (r.malos.length) problemas.push(...r.malos.map(m =>
      `«${m.texto}» en x=${m.x}..${m.derecha} de ${m.ventana}, recortado por ${m.ancestro}`));
    if (r.desbordaBody) problemas.push("el body desborda horizontalmente");
    // La condicion declarada se compara consigo misma: pedir 375 no es obtener 375
    // —Chrome tiene un ancho minimo de ventana— y una linea que dice «@375px» sin haberlo
    // medido es un verde con la etiqueta equivocada.
    if (r.ancho !== ancho) problemas.push(`pedi ${ancho} px de ancho y la pagina midio ${r.ancho}`);
    if (problemas.length) { fallos += problemas.length; console.log(`  FALLA ${ruta} @${r.ancho}px\n         ${problemas.join("\n         ")}`); }
    else console.log(`  ok   ${ruta} @${r.ancho}px medidos · ${r.vistos} elementos alcanzables en ${r.zonas} zona(s)`);
  }
  await c.cerrar();
}
console.log(`\n${PAGINAS.length * ANCHOS.length} páginas·ancho revisadas, ${totalVistos} elementos interactivos, ${fallos} inalcanzables`);
process.exit(fallos ? 1 : 0);
