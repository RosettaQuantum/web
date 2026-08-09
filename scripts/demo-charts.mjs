#!/usr/bin/env node
/**
 * Genera la pagina de prueba del motor de graficos.
 *
 * POR QUE ESTA ACA Y NO ES UN HTML COMMITEADO
 * -------------------------------------------
 * La primera version de esta demo la copie a la carpeta del proyecto, DOS niveles
 * arriba de la raiz del repo — o sea, fuera de git. Quedo un entregable que existia
 * solo en un disco: exactamente lo que COORDINACION §1 prohibe ("declarar por donde
 * viaja el archivo; si va por una ruta local, no va"). Lo detecto la coordinadora
 * buscandolo en `origin/main` y no encontrandolo.
 *
 * El arreglo no es commitear el HTML generado: es commitear lo que lo genera. Asi
 * la demo se reconstruye desde git y no puede quedar desincronizada del motor que
 * pretende mostrar.
 *
 * Uso: node scripts/demo-charts.mjs [--salida ruta.html]
 */

import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { lineas, barrasRango, cifra, grafico, CSS_GRAFICOS } from "../src/lib/charts.js";

const args = process.argv.slice(2);
const salida = args.includes("--salida") ? args[args.indexOf("--salida") + 1] : "demo-motor-graficos.html";

// El caso que motivo el motor: la seccion "el calculo se acorto doscientas veces,
// el hardware no" llevaba meses siendo prosa porque no habia con que dibujarla.
const g1 = grafico({
  numero: 1,
  titular: "El recurso estimado para romper RSA-2048 cayó dos órdenes de magnitud; el hardware disponible no siguió.",
  subtitulo: "Qubits físicos requeridos según la estimación publicada, y qubits físicos realmente disponibles",
  unidad: "escala logarítmica",
  n: "8 estimaciones publicadas",
  cuerpo: lineas({
    categorias: ["2012", "2015", "2019", "2021", "2023", "2025", "2030"],
    estimadoDesde: "2030",
    log: true,
    series: [
      { nombre: "requerido (estimado)", valores: [1e9, 1e9, 2e8, 2e7, 2e7, 1e6, 1e6] },
      { nombre: "disponible", valores: [10, 50, 53, 127, 433, 1180, null] },
    ],
    anotacion: { desde: 0, hasta: 5, serie: 0, texto: "÷1000" },
  }),
  notas: ["Las cifras de 2030 son proyección, no medición: el eje lo marca."],
  fuente: "literatura publicada, recuento propio",
  fecha: "2026-08-09",
});

// Por que los rangos importan: cuatro estimaciones de terceros como banda, y un
// conteo nuestro como punto. La diferencia se ve sin leer la nota.
const g2 = grafico({
  numero: 2,
  titular: "El valor declarado por la industria se publica siempre como rango, y el nuestro también debería.",
  subtitulo: "Valor en juego declarado por sector a 2035",
  unidad: "miles de millones de US$",
  n: "declarado por la fuente, no medido por Rosetta",
  cuerpo: barrasRango({
    items: [
      { etiqueta: "Química", rango: [450, 800] },
      { etiqueta: "Servicios financieros", rango: [400, 600] },
      { etiqueta: "Transporte y logística", rango: [200, 500] },
      { etiqueta: "Farmacéutica", rango: [80, 400] },
      { etiqueta: "Corridas selladas nuestras", valor: 54, color: "var(--gold,#D9B87A)" },
    ],
  }),
  notas: ["Las cuatro primeras filas son estimaciones de terceros. La última es un conteo nuestro: por eso es un punto y no una banda."],
  fuente: "Monitor de industria 2026 · ledger de Rosetta",
});

const fichas = `<div style="margin:24px 0">` +
  cifra({ valor: 54, etiqueta: "corridas selladas" }) +
  cifra({ valor: 0, etiqueta: "victorias cuánticas medidas" }) +
  cifra({ rango: [1.3, 2.7], unidad: " B", etiqueta: "valor declarado por la industria a 2035", dec: 1, estimado: true }) +
  `</div>`;

const html = `<!DOCTYPE html>
<html lang="es">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Motor de gráficos — prueba</title>
<style>
:root{--basalt:#141210;--basalt-2:#1F1C18;--stone-line:#3D372F;--papyrus:#F4EEDF;--papyrus-dim:#B5AC99;--faint:#6E675C;--faience:#4DC4B5;--gold:#D9B87A}
body{background:var(--basalt);color:var(--papyrus);font-family:system-ui,sans-serif;max-width:860px;margin:0 auto;padding:40px 28px}
h1{font-size:20px;font-weight:400;color:var(--papyrus-dim)}
${CSS_GRAFICOS}
</style>
<h1>Motor de gráficos — las cuatro piezas de prioridad alta</h1>
${fichas}${g1}${g2}
`;

writeFileSync(salida, html, "utf8");
console.log(`escrito ${salida} (${Buffer.byteLength(html)} bytes)`);
console.log(`  sha256: ${createHash("sha256").update(html, "utf8").digest("hex")}`);
