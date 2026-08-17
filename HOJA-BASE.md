# La hoja base pelea, y no se ve leyendo tu código

La consola se construyó sobre `public/consola/consola.css`, una hoja heredada de otro
contexto (claro, columna estrecha, otra semántica de clases). Encima va `tema.css`, que la
vuelve terminal oscura. **Cuatro defectos del 2026-08-17 salieron de esa herencia, y los
cuatro tienen la misma forma: el markup estaba bien y la pantalla estaba mal.**

Por eso vale escribirlo: es la única familia de defectos de este frente que **no se
encuentra leyendo el código que escribiste**. Hay que mirar la pantalla, o preguntarle al
navegador con una medición.

## Los cuatro casos, con su número

| lo que hice | lo que hace la hoja base | lo que se vio |
|---|---|---|
| Reusé `class="barra"` para el contenedor del filtro | `.barra{height:4px;overflow:hidden}` — es una **barra de progreso** | el buscador (22 px) y **el denominador** de las corridas, recortados a una línea |
| Puse un `.btn` dentro de una celda de tabla | `.btn{width:100%}` — vivía en una columna estrecha | 116 px en Corridas y 220 px en Compromisos, para el mismo texto |
| Puse el botón de cerrar en el panel del sello | el mismo `width:100%` | una barra de 500 px que decía «✕» |
| Escribí `body.consola .btn` para el tema oscuro | una regla base más específica ganaba | **texto negro sobre fondo negro** |

Y uno de la misma familia, por herencia de layout y no de clase: `main{overflow-x:hidden}`
hacía que la tabla de Corridas se **recortara** en vez de desplazarse. Medido a 375 px, el
botón «ver el sello» quedaba en x=771 dentro de una ventana de 375: existía, se podía leer
en el HTML, y **no había forma de tocarlo en un teléfono**. El gesto que sostiene el
producto entero era inalcanzable en la pantalla donde más se usa.

## Las cuatro reglas que salen de ahí

1. **Un nombre de clase de la hoja base trae su tamaño puesto.** Antes de reusar uno,
   búscalo: `grep -n '\.nombre{' public/consola/consola.css`. Si define `height`, `width`,
   `max-*` u `overflow`, no lo reuses para otra cosa — ponle nombre propio. Renombrar es
   más barato que pelear la especificidad, y deja el defecto imposible en vez de corregido.
2. **La especificidad se cuenta, no se estima.** `tema.css` lleva el prefijo `:root` en
   **35 de sus 41 selectores** por esto exactamente. Si una regla tuya «no aplica», el
   navegador no está equivocado: cuenta los selectores de las dos.
3. **Lo que restringe tamaño se verifica en el navegador, no en el archivo.** Un
   `overflow:hidden` heredado no aparece en ningún diff. Las tres preguntas que atraparon
   los cuatro casos: ¿el elemento mide lo que crees (`getBoundingClientRect`)?, ¿está
   dentro de la ventana (`right <= innerWidth`)?, ¿su contenedor desplaza o recorta
   (`scrollWidth > clientWidth` con `overflow`)?
4. **Y siempre a 375 px.** Los cuatro se veían bien en el escritorio. Dos sólo existían en
   pantalla angosta, y uno de esos inutilizaba el producto.

## Qué quedó automatizado y qué no

`scripts/test-consola-zonas.mjs` incluye la parte que **sí** se puede vigilar sin
navegador: marca cualquier clase que la hoja base restrinja en tamaño y que la consola use
sin volver a definirla. Hoy no marca nada; con `class="barra"` puesto de vuelta, grita. El
caso está entre los 10 de `--self-test`, con el defecto real.

No dice «esto está mal»: dice **«esta clase trae un tamaño de otro contexto, decide a
propósito»**. Es a propósito un conjunto chico — precisión sobre cobertura, porque un falso
positivo aquí retiene trabajo bueno.

**Lo que NO está automatizado** —y conviene saberlo antes de confiar— es la medición en el
navegador de la regla 3: los recortes por herencia de layout (`main{overflow-x:hidden}`) no
los ve ningún análisis estático, porque no hay ninguna clase compartida de por medio. Eso
hoy depende de que alguien mire la pantalla a 375 px. CI corre en Ubuntu y el único Chrome
del repo está cableado a una ruta de macOS (`scripts/build-report-cleveland.mjs`), así que
un chequeo de navegador en CI es trabajo aparte, no un ajuste.

## Un apunte sobre los instrumentos

Dos veces el mismo día el guardia se equivocó **leyendo un comentario como si fuera
código**: contó `/v1/...` mencionado en la cabecera de `consola.js` como una ruta pedida, y
contó `.barra` escrito en el comentario que explica **por qué el contenedor no puede
llamarse así** como una redefinición — o sea, el texto que describe el defecto hacía que el
guardia aprobara el defecto. Los dos se arreglan igual: quitar comentarios antes de mirar.

Si un chequeo pasa a la primera contra un caso que sabes roto, sospecha del chequeo.
