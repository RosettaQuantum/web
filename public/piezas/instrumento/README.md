# Prototipo · la propagación en la proteína (Rosetta)

Qué es: una prueba de WebGL/Three.js sobre **RQ-0007 / Cleveland**, para ver si el 3D hace
entender el resultado mejor que la tabla.

Cómo se mira:

```
node serve.mjs 4340   # y abrir http://localhost:4340
```

**Todo el dato se pide en vivo** a `https://rosettaquantum.com/v1/challenges/cleveland-2026-07`
(la API responde con `access-control-allow-origin: *`). No hay una sola cifra escrita a mano:
proteínas, coordenadas, valores por residuo, sitios, avisos, sha256 y estadística salen de ahí.
Si la API no responde, la página **lo dice** en vez de dibujar una maqueta.

Decisiones que hay detrás:

- **El barrido no es tiempo.** Enciende los residuos por orden de valor — el mismo ranking con
  el que se mide el percentil del sitio. Animar un tiempo que el archivo no tiene sería inventar.
- **El color es percentil dentro de la proteína**, no el valor crudo: ctqw y diff viven en
  escalas distintas y pintarlos con la misma rampa absoluta los haría comparables sin serlo.
- **Los sitios conocidos son teal y los predichos oro**, con el aviso del archivo siempre a la
  vista: los predichos no están validados y el conocido nunca entró al cálculo.
- **No puede ser un Artifact**: la CSP de los artifacts bloquea hosts externos, así que ahí sólo
  podría ser una maqueta con datos pegados. Por eso es una página servida localmente.

- **La vista «Cuántica vs. cercanía»** pone al lado del CTQW el mapa de −distancia al residuo
  fuente más cercano. Se calcula en el navegador a partir de las coordenadas selladas, así que
  va **en oro** y la etiqueta lo dice: no es dato del archivo. Encienden casi los mismos
  residuos, y ése es el punto.
- **El diagnóstico que lo explica sale del archivo**, no de mí: se pide
  `/v1/archive/RQ-EXP-CLEV-BLIND-001` y se muestran el hallazgo textual y el
  Spearman(score, distancia) del blanco que estás mirando, emparejado por PDB. Si ese endpoint
  falla, la caja lo dice y no muestra nada en su lugar. La verificación del sello se hace con
  `/raw`, no con esta lectura, y así está escrito en pantalla.

El barrido corre a la mitad de la velocidad anterior (0,25 de percentil por cuadro).

## El pase de look (20-ago)

Escrito a mano, sin `EffectComposer` ni librerías: el A/B se dibuja por tijera en un solo
búfer y el pase corre una vez sobre el cuadro entero. Lleva sombreado plano de tres escalones,
contorno de tinta por salto de profundidad, profundidad de campo, resplandor, curva de tono,
gradación al verde y crema de la casa, viñeta y grano. La costura del A/B se dibuja a propósito
y el contorno se corta ahí, para que el borde entre las dos vistas no se lea como geometría.

**Dos trampas que dejaron el cuadro en negro sin un solo error en rojo** — las dos del tipo que
importa acá, porque nada grita:

1. `WebGLRenderTarget.setSize()` **no redimensiona la textura de profundidad**, sólo las de
   color. El búfer queda incompleto y WebGL sólo avisa con un `warn` de framebuffer. Se rehace
   la textura de profundidad a mano en cada cambio de tamaño.
2. `setViewport`/`setScissor` van en **píxeles CSS**: three los multiplica por el `pixelRatio`
   por dentro, también cuando el destino es un búfer. Pasarlos ya multiplicados por 2 deja todo
   fuera de cuadro.

Y una tercera, de las mismas: tener el tamaño del lienzo y el de los búferes en **dos
condiciones distintas** dejó el lienzo en 600×300 con los búferes correctos. Ahora los ajusta
`ajustar()`, una sola función.
