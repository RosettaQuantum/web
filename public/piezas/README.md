# Piezas 3D · prototipos para el home

Tres piezas que leen **dato en vivo** de la API pública (`/v1/...`). Ninguna cifra está
escrita a mano: si la API no responde, la página lo dice en vez de dibujar una maqueta.

| Carpeta | Qué es |
|---|---|
| `cleveland/` | La caminata cuántica sobre la proteína, calculada en el navegador. Cinco direcciones de arte; la elegida es **CRISTAL**. |
| `instrumento/` | El panel: propagación sellada, A/B contra difusión y contra cercanía a la fuente, y el diagnóstico sellado. |
| `archivero/` | **Congelado.** El campo entero (74 algoritmos) y lo único que Rosetta midió. |
| `vendor/` | three.js r169 y OrbitControls, compartidos por las tres. |

## Lo que hay que saber antes de tocarlas

- **La caminata es real y está contrastada.** Se arma con los parámetros que declara
  `/v1/structures/{pdb}` (corte 8,5 Å, sigma 6,0) — no con parámetros recordados. La red que
  resulta tiene 169 nodos y 927 aristas para 4OBE: **las mismas que el archivo sellado**, igual
  que fuente (25) y distales (119). El Hamiltoniano se elige por medición y no por preferencia:
  adyacencia reproduce el ranking sellado con ρ de Spearman 0,746; el laplaciano, 0,133.
- **Lo calculado en el navegador se declara en pantalla.** La caminata y la distancia a la
  fuente se marcan como «calculado aquí, no sellado». Sellado es sólo lo que baja de la API.
- **El pase de look es propio**, sin `EffectComposer`: contorno por salto de profundidad,
  desenfoque, resplandor, curva de tono, gradación, viñeta y grano. Corre una sola vez por
  cuadro, así el A/B por tijera sigue funcionando.

## Tres trampas que dejaron el cuadro en negro sin un error en rojo

1. `WebGLRenderTarget.setSize()` **no** redimensiona la textura de profundidad. Se rehace a mano.
2. `setViewport`/`setScissor` van en píxeles CSS: three los multiplica por el `pixelRatio` solo.
3. Un `uniform` declarado en el shader y ausente del objeto de uniformes vale **cero**. Hay un
   chequeo que compara ambos lados.

Y una cuarta, de color: `THREE.Color(hex)` convierte de sRGB a lineal. El pase de composición
escribe crudo a pantalla, así que los colores del fondo van como `Vector3`, no como `Color`.

## Correrlas fuera de Astro

```
node serve.mjs 4343
```
