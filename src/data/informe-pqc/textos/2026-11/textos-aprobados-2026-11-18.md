# Lo que decidí, y los cinco textos que necesitan tu lectura

18-nov-2026. Me dijiste «cambia todos según tu mejor criterio». Decidí los seis
puntos abiertos y los dejé implementados. Lo único que no puedo decidir yo es el
texto que lee alguien de afuera, así que va abajo tabulado, para aprobar o
corregir de una lectura.

---

## Primero: la decisión grande, la del número de la regla

**El número es 75.** Toda llave clásica vale lo mismo, 75, y el 100 queda
reservado a una llave post-cuántica — las cuatro familias de la tabla 3 de la
misma norma: ML-DSA, SLH-DSA, LMS/HSS y XMSS.

Lo verifiqué en la fuente antes de decidir: bajé el PDF de NIST IR 8547 del sitio
de NIST y le extraje la tabla 2 (página 15). Dice, textual:

> ECDSA [FIPS186] · ≥ 112 bits of classical security strength ·
> Deprecated after 2030 / Disallowed after 2035

La fila de RSA es idéntica. **Una sola fila por familia, sin distinguir por
tamaño de llave.** Y en el cuerpo: «NIST will instead deprecate all
quantum-vulnerable digital signature algorithms after 2030». La única salida que
la norma reconoce es su tabla 3: ML-DSA, SLH-DSA, LMS/HSS, XMSS.

**Por qué 75 y no 100**, medido sobre nuestras 220 de noviembre:

| | mediana | rango | organizaciones que cambian |
|---|---|---|---|
| la regla de hoy | 58 | 38–74 | — |
| **con 75** | **58** | **38–74** | 7 |
| con 100 | 68 | 42–**84** (el tope) | 212 |

Con 100, el país entero sube diez puntos por haber editado una regla. Y lo que
cerró la decisión: **nuestro propio certificado es P-256**. Con 100, nuestra
ficha publicada saltaría de QEX 74 a 84 sin que hubiéramos cambiado nada. Con
75 no se mueve ni una cifra publicada.

### Lo que sí cambia en el informe de noviembre

Esta tabla la rehice después de rearmar el borrador de verdad. **La primera
versión que te mandé se quedaba corta**: decía que sólo cambiaban cuatro cifras,
y cambian 104. La mediana y el rango sí quedan iguales, pero los 7 que bajan
cruzan bandas, y eso mueve todos los conteos.

| cifra | hoy | con la regla nueva |
|---|---|---|
| mediana nacional y rango | 58 · 38–74 | **iguales** |
| promedio del índice | 57,9 | 57,6 |
| bandas: Consciente · En transición · Perímetro migrado | 33 · 157 · 30 | **37 · 154 · 29** |
| valores distintos en certificados | 2 | 1 |
| concentración de la dimensión | 97 % | 100 % |
| **«Aporte» de certificados en la tabla de dimensiones** | **1,8** | **0,0** |
| la fila «100» del desglose de certificados | 7 · 3 % | **desaparece** |
| la serie de tres meses | 3 % · 2 % · 3 % | **0 % · 0 % · 0 %** |
| organizaciones individuales que bajan | — | 7, entre 10 y 11 puntos |
| verticales cuyo índice baja un punto | — | 3 de 12 |

**Y una corrección que te debo.** Te escribí que la dimensión del 40 % «ya no
aportaba nada». Era falso: el **«Aporte» que publica la tabla era 1,8 y pasa a
0,0**. Yo había medido otra cosa —cuánta dispersión le quita al índice final si
la aplano— y le puse el nombre de la columna publicada. Son dos cantidades
distintas y usé el nombre de una para hablar de la otra.

La línea de la serie pasa a 0 en los tres meses, y es más cierta así: esos 3 %
eran organizaciones con RSA-4096 o P-384, que bajo NIST no están mejor que
nadie. Llamarlas «sobre el mínimo» les atribuía una ventaja que no tienen. Es
el mismo «0 · 0 %» que ya aprobaste: un cero medido, no un hueco.

Y una corrección a algo que yo mismo dije antes: temía que la regla nueva
dejara sin aporte a la dimensión que pesa el 40 %. **Ya no aportaba nada** —lo
medí: −0,0 puntos de dispersión con la regla vieja—. La regla nueva no destruye
nada; hace visible que no había nada.

---

## Los cinco textos

### 1 · Portada — se cae la promesa de aviso previo

Ya decidiste no avisarle a las organizaciones antes de publicar, así que la
portada prometía un paso que no va a ocurrir.

| | |
|---|---|
| **Decía** | Pendiente antes de publicar: revisión legal de los seis puntos marcados en la sección 14, **y aviso previo a las organizaciones con hallazgos**. Esta edición no se ofrece a los buscadores mientras diga esto. |
| **Diría** | Pendiente antes de publicar: revisión legal de los seis puntos marcados en la sección 14. Esta edición no se ofrece a los buscadores mientras diga esto. |

### 2 · La frase del HNDL, en inglés

El español ya está aprobado y sellado. Esto es sólo su par, para que la rúbrica
no explique en un idioma de dónde sale la tabla y en el otro no.

| | |
|---|---|
| **Español (aprobado)** | Estos valores son un modelo propio de Rosetta, fijado en la edición de agosto de 2026. La derivación no está publicada: se publica el valor que se usa, no cómo se llegó a él. |
| **Inglés (nuevo)** | These values are Rosetta's own model, fixed in the August 2026 edition. The derivation is not published: what is published is the value used, not how it was arrived at. |

### 3 · El tope de sondeo — por qué una A puede ser imposible

Leí la condición en el código antes de escribirla: la A exige que **todo** nombre
sensible haya sido sondeado, y el tope son 15 nombres. No lleva ninguna cifra
adentro a propósito: la ficha ya dice cuántos quedaron sin sondear, y un número
clavado en el texto es el defecto que nos dejó «los cuatro puntos de la sección
11».

| | |
|---|---|
| **Español** | Se sondean hasta 15 nombres por organización. La nota A exige que todo nombre sensible haya sido sondeado, así que una organización con más nombres sensibles que el tope no puede alcanzarla. La ficha dice cuántos quedaron sin sondear. |
| **Inglés** | Up to 15 names per organization are probed. Grade A requires every sensitive name to have been probed, so an organization with more sensitive names than the cap cannot reach it. The fact sheet states how many were left unprobed. |

### 4 · La fila de la rúbrica que describe la regla de la llave

Hay que cambiarla porque **citaba NIST IR 8547 para respaldar una distinción que
la versión final de NIST IR 8547 no hace**. Y se cae su «límite» declarado: la
regla nueva sí distingue una RSA de 1024 de una de 2048.

| | |
|---|---|
| **Método, decía** | Se lee la hoja que entrega el servidor. Límite: no distingue una RSA de 1024 bits de una de 2048; las dos están bajo el umbral. |
| **Método, diría** | Se lee la hoja que entrega el servidor. Toda llave clásica vale lo mismo, cualquiera sea su tamaño: NIST IR 8547 —final, octubre de 2026, tabla 2— depreca después de 2030 todo ECDSA y RSA de 112 bits o más, sin distinguir entre ellos. El puntaje máximo queda reservado a una llave post-cuántica, la única salida que la norma reconoce. |
| **Regla, decía** | 100 si RSA ≥ 4096 bits o curva ≥ 384 bits; 75 si es menor; sin certificado leído, sin dato (nunca 0). |
| **Regla, diría** | 75 si la llave es clásica y da 112 bits de fuerza o más; 0 si da menos; 100 sólo si es post-cuántica; sin certificado leído, sin dato (nunca 0). |
| **Method, would read** | The leaf the server presents is read. Every classical key counts the same, whatever its size: NIST IR 8547 —final, October 2026, table 2— deprecates all ECDSA and RSA of 112 bits or more after 2030, drawing no distinction between them. The top score is reserved for a post-quantum key, the only exit the standard recognizes. |
| **Rule, would read** | 75 if the key is classical and gives 112 bits of strength or more; 0 if less; 100 only if post-quantum; with no certificate read, no data (never 0). |

### 5 · Una palabra que sobra en la página 3

La dimensión ya no es «prácticamente» constante: es constante, 219 de 219. La
página 14 ya lo dice bien sola, porque se deriva de las cifras —«Los
certificados no se mueven: 0 %, 0 %, 0 %»—, así que sólo sobra esta palabra.

| | |
|---|---|
| **Dice** | La dimensión de mayor peso es **prácticamente** constante en toda la muestra. La columna Cert. vale 75 en las 12 verticales; la cifra bajo ella es cuántas organizaciones del sector comparten ese valor. |
| **Diría** | La dimensión de mayor peso es **constante** en toda la muestra: las 219 organizaciones con certificado leído obtienen el mismo valor. La columna Cert. vale 75 en las 12 verticales; la cifra bajo ella es cuántas organizaciones del sector comparten ese valor. Con la regla de NIST IR 8547 ninguna se separa hasta que aparezca un certificado post-cuántico. |

La segunda mitad —la razón de NIST— la propuso el agente de la rúbrica de Q
Main y la traigo yo, porque es tu decisión y no la de ellos.

### 6 · Las nueve etiquetas de figura de la maqueta

El guardia las marca porque sus palabras no están en ningún documento aprobado.
Mi criterio: van como están. Son rótulos de figura y de eje, no afirmaciones —
ninguna dice nada sobre el país. Pero necesitan quedar en un documento aprobado,
porque si no el guardia seguirá en rojo para siempre, y un guardia que se ignora
deja de ser un guardia.

| página | la línea |
|---|---|
| 3 | La dimensión de mayor peso es prácticamente constante en toda la muestra. La **columna** Cert. **vale** … en las 12 verticales; la cifra bajo **ella** es **cuántas** organizaciones del sector **comparten** ese valor |
| 3 | 0 **org.** · 33 **org.** · 157 **org.** · 30 **org.** |
| 4 | **Fig** 1 |
| 4 | **Fig.** 1 — Tres mediciones, el mismo grupo |
| 4 | n = 191 organizaciones medidas en los tres meses · **eje** 0–100 en los tres **paneles** |

---

## Lo que cambié sin preguntarte, porque no es texto

- **El wordmark sale de la portada**: va el símbolo solo, el activo propio del
  kit, sin tocarle un byte. «Rosetta Quantum» aparecía dos veces en la misma
  pantalla.
- **La regla nueva quedó versionada**, no reemplazada: agosto y septiembre
  siguen con la vieja porque están publicados, y la autoprueba los reproduce
  fila por fila. Si agosto cayera en la regla nueva, el paso aborta — lo probé
  mutándolo.
- **La serie usa una sola regla para los tres meses**, la del mes más nuevo.
  Puntuar cada mes con la suya daría una pendiente que es parte cambio del país
  y parte cambio nuestro.
- **La serie ganó un cuarto estado, «no se mueve».** Con 0-0-0 decía «no es
  monótona», que a un lector le suena a que la cifra oscila.
- **Los cinco auditores de la maqueta ahora fallan cerrados.** Hasta hoy
  imprimían «FALLA» y salían con código 0, y el arnés los encadenaba sin mirar
  ninguno: anunciaba defectos y siempre decía que sí. Al arreglarlo apareció
  una discrepancia real que llevaba días escondida, ya corregida.
- **Un guardia nuevo exige que el recuadro «Borrador de trabajo» esté en la
  portada.** Lo descubrí rompiéndolo: cambiar el logotipo reflujo la página y
  mandó la advertencia a la página 2, en silencio.

Pruebas: el índice pasó de 19 a 28 casos y la serie de 8 a 12, cero fallas.
