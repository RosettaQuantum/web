# Portada de seguridad en inglés (/q-ready) · textos PROVISORIOS para aprobar

Generado por `node scripts/textos-q-ready-en.mjs` desde `src/lib/puerta-textos.mjs`. Lo que se apruebe aquí es
literalmente lo que se sirve. 23-nov-2026.

**Qué es.** /q-ready pasa a ser la misma portada que /es/q-ready (el mismo componente, con `lang="en"`), y la
/q-ready vieja (identidad retirada, `noindex`) se retira. La columna «español» es el texto que ya está publicado
en /es/q-ready y **no cambia**; la columna «inglés» es nueva.

**Ya aprobados (no se repiten aquí):** el botón «Security» del menú, la tarjeta de la guía y la tarjeta del informe
en inglés, sellados el 23-nov en `src/data/publicaciones/textos-aprobados/` («Sí, así»). La tarjeta del informe en
inglés dice que el informe está en español: «Read the report (in Spanish) →». El nombre accesible del carrusel es el título
aprobado de la galería: «Publicaciones de Rosetta» / «Rosetta publications».

**No hay textos en inglés aprobados para esta portada en el repositorio** (busqué en el código, en docs/ y en los
documentos de aprobados; el handoff de la maqueta v20 no está en el repositorio). Tres frases en inglés coinciden con la /q-ready retirada; van marcadas, pero tampoco
consta que se hayan aprobado.

**Fuera de esta tabla, a propósito:** el bloque de cifras del informe y la opción «informe» del diálogo, que
están apagados (`INFORME_PUBLICO = false`) y, como el informe existe sólo en español, no se pintan en inglés.
Las notas internas que el formulario manda a hello@ siguen en español.

‹…› es un dato que se llena al construir (cifras de la edición, años, dominio).

| clave | español (publicado) | inglés (nuevo) | estado |
|---|---|---|---|
| `meta.titulo` | ¿Qué tan lista está su criptografía para el momento cuántico? — Rosetta Q-Ready | How ready is your cryptography for the quantum moment? — Rosetta Q-Ready | **PROVISORIO** |
| `meta.descripcion` | Medimos desde afuera, sin tocar su red, qué criptografía expone su superficie pública y quién decide su plazo real de migración. Informe individual gratis y confidencial. | We measure from the outside, without touching your network, what cryptography your public surface exposes and who decides your real migration deadline. Free, confidential individual report. | **PROVISORIO** |
| `rutas.medicion` | /es/q-ready/medicion | /q-ready/medicion | ruta (no es texto) |
| `rutas.origen` | /es/q-ready | /q-ready | ruta (no es texto) |
| `hero.eyebrow` | Q-Ready · exposición criptográfica post-cuántica | Q-Ready · post-quantum cryptographic exposure | **PROVISORIO** |
| `hero.h1` | ¿Qué tan lista está su criptografía para el momento cuántico? | How ready is your cryptography for the quantum moment? | **PROVISORIO** |
| `hero.lede` | Medimos desde afuera, sin tocar su red, qué criptografía expone hoy su superficie pública y quién decide de verdad su plazo de migración. Es el mismo método con que medimos a ‹organizaciones› organizaciones chilenas en ‹mes›. | We measure from the outside, without touching your network, what cryptography your public surface exposes today and who really decides your migration deadline. It is the same method we used to measure ‹organizaciones› Chilean organizations in ‹mes›. | **PROVISORIO** |
| `hero.individual` | Solicitar mi informe individual | Request my individual report | **PROVISORIO** |
| `hero.medir` | Medir mi dominio ahora | Measure my domain now | **PROVISORIO** |
| `hero.nota` | El informe individual es gratis y confidencial: no se publica ni se comparte. | The individual report is free and confidential: it is not published or shared. | **PROVISORIO** |
| `ahora.eyebrow` | Por qué ahora | Why now | **PROVISORIO** |
| `ahora.h2` | El riesgo empieza hoy, no cuando llegue la máquina. | The risk starts today, not when the machine arrives. | **PROVISORIO** · igual a la /q-ready retirada (sin aprobación registrada) |
| `ahora.p` | Un adversario con paciencia puede grabar hoy tráfico cifrado y guardarlo, barato, hasta que exista un computador capaz de romper RSA y curvas elípticas. Ese día el archivo se abre hacia atrás: lo que salió cifrado en 2026 queda legible entonces. | A patient adversary can record encrypted traffic today and store it, cheaply, until a computer capable of breaking RSA and elliptic curves exists. On that day the archive opens backwards: what was sent encrypted in 2026 becomes readable then. | **PROVISORIO** |
| `ahora.nota` | No afirmamos que a nadie le hayan robado datos. Afirmamos una exposición medible contra un calendario público. | We do not claim that anyone’s data has been stolen. We claim a measurable exposure against a public calendar. | **PROVISORIO** |
| `ahora.pasos[1][1]` | Graba | Record | **PROVISORIO** |
| `ahora.pasos[1][2]` | el tráfico cifrado en tránsito | encrypted traffic in transit | **PROVISORIO** |
| `ahora.pasos[2][1]` | Guarda | Store | **PROVISORIO** |
| `ahora.pasos[2][2]` | a la espera de capacidad | waiting for the capability | **PROVISORIO** |
| `ahora.pasos[3][1]` | Rompe | Break | **PROVISORIO** |
| `ahora.pasos[3][2]` | la clave cuando exista la máquina | the key once the machine exists | **PROVISORIO** |
| `ahora.pasos[4][1]` | Lee | Read | **PROVISORIO** |
| `ahora.pasos[4][2]` | lo de hace años, hacia atrás | what was sent years ago, backwards | **PROVISORIO** |
| `reloj.eyebrow` | Sume los años | Add up the years | **PROVISORIO** |
| `reloj.h2` | Si la cuenta da tarde, ya va tarde. | If the sum comes out late, you are already late. | **PROVISORIO** |
| `reloj.lede` | Si el tiempo que sus datos deben seguir secretos más el que toma migrar supera el tiempo hasta la amenaza, la organización llega tarde. Con un perfil típico de banca: | If the time your data must stay secret plus the time migration takes exceeds the time until the threat, the organization is late. With a typical banking profile: | **PROVISORIO** |
| `reloj.deslice` | Deslice para ver hasta ‹fin› → | Swipe to see up to ‹fin› → | **PROVISORIO** |
| `reloj.titulo` | Sume los años | Add up the years | **PROVISORIO** |
| `reloj.descA` | Migrar toma ‹años› años, de ‹desde› a ‹hasta›. Lo último migrado debe seguir secreto ‹años› años más, hasta ‹año›.  | Migration takes ‹años› years, from ‹desde› to ‹hasta›. The last thing migrated must stay secret ‹años› more years, until ‹año›.  | **PROVISORIO** |
| `reloj.descItem` | hacia ‹año› la probabilidad estimada es ‹p› | by ‹año› the estimated probability is ‹p› | **PROVISORIO** |
| `reloj.migrar` | Migrar | Migrate | **PROVISORIO** |
| `reloj.secreto` | Seguir secreto | Stay secret | **PROVISORIO** |
| `reloj.amenaza` | Amenaza | Threat | **PROVISORIO** |
| `reloj.prob` | prob. estimada | est. probability | **PROVISORIO** |
| `reloj.anios` | ‹n› años | ‹n› years | **PROVISORIO** |
| `reloj.corte` | necesita protección hasta ‹año› | needs protection until ‹año› | **PROVISORIO** |
| `reloj.pie` | Perfil de ejemplo: secreto ‹s› años, migración ‹m›. Probabilidades: consenso de 26 expertos del Global Risk Institute; las de 15 y 20 años usan la lectura conservadora. | Example profile: secret for ‹s› years, migration ‹m›. Probabilities: consensus of 26 experts from the Global Risk Institute; the 15- and 20-year figures use the conservative reading. | **PROVISORIO** |
| `reloj.pieNegrita` | Ninguna de estas fechas es un pronóstico: | None of these dates is a forecast: | **PROVISORIO** |
| `reloj.pieCola` | son la distancia contra la que se planifica. | they are the distance you plan against. | **PROVISORIO** |
| `reloj.fuente` | fuente → | source → | **PROVISORIO** |
| `individual.eyebrow` | Su informe individual | Your individual report | **PROVISORIO** |
| `individual.h2` | Lo que recibe su organización. | What your organization receives. | **PROVISORIO** |
| `individual.p` | Un documento que un directorio puede leer, con la evidencia detrás. Sale de la medición de su propia superficie pública y lo revisa una persona antes de entregarlo. | A document a board can read, with the evidence behind it. It comes from measuring your own public surface, and a person reviews it before it is delivered. | **PROVISORIO** |
| `individual.nota` | Gratis. Confidencial: dirigido sólo a su organización, fuera del informe agregado. | Free. Confidential: addressed only to your organization, kept out of the aggregate report. | **PROVISORIO** |
| `individual.indice[1][1]` | Su índice | Your index | **PROVISORIO** |
| `individual.indice[1][2]` | Su número de 0 a 100 frente a la mediana del país y de su sector. | Your number from 0 to 100 against the median for the country and for your sector. | **PROVISORIO** |
| `individual.indice[2][1]` | El hallazgo principal | The main finding | **PROVISORIO** |
| `individual.indice[2][2]` | Lo que más pesa en su caso, con la evidencia que lo sostiene. | What weighs most in your case, with the evidence behind it. | **PROVISORIO** |
| `individual.indice[3][1]` | Su superficie pública | Your public surface | **PROVISORIO** |
| `individual.indice[3][2]` | Qué encontramos en registros públicos y qué responde desde internet. | What we found in public records and what answers from the internet. | **PROVISORIO** |
| `individual.indice[4][1]` | Su ruta crítica | Your critical path | **PROVISORIO** |
| `individual.indice[4][2]` | Los proveedores que fijan su plazo real, y cuáles no tienen fecha. | The providers that set your real deadline, and which of them have no date. | **PROVISORIO** |
| `individual.indice[5][1]` | Plan 30 · 90 · 365 | Plan 30 · 90 · 365 | igual en los dos idiomas |
| `individual.indice[5][2]` | Qué hacer, en qué orden, y de qué hallazgo sale cada acción. | What to do, in what order, and which finding each action comes from. | **PROVISORIO** |
| `individual.indice[6][1]` | Alcance y límites | Scope and limits | **PROVISORIO** |
| `individual.indice[6][2]` | Qué mide el informe, qué no puede decir, y cómo reproducirlo. | What the report measures, what it cannot say, and how to reproduce it. | **PROVISORIO** |
| `pasos.eyebrow` | Cómo se mide | How it is measured | **PROVISORIO** |
| `pasos.h2` | Cuatro pasos, sin tocar su red. | Four steps, without touching your network. | **PROVISORIO** |
| `pasos.lista[1][1]` | Usted lo pide | You request it | **PROVISORIO** |
| `pasos.lista[1][2]` | Con su dominio y un correo de su organización. Medimos sólo lo que alguien de la organización autoriza. | With your domain and an email from your organization. We only measure what someone in the organization authorizes. | **PROVISORIO** |
| `pasos.lista[2][1]` | Leemos registros públicos | We read public records | **PROVISORIO** |
| `pasos.lista[2][2]` | Certificate Transparency muestra cada nombre de host que su organización certificó alguna vez. | Certificate Transparency shows every host name your organization has ever certified. | **PROVISORIO** |
| `pasos.lista[3][1]` | Un saludo por host | One greeting per host | **PROVISORIO** |
| `pasos.lista[3][2]` | Sobre los hosts críticos abrimos una conexión y enviamos un solo saludo TLS. No se completa: no hay sesión, ni datos, ni credenciales, ni prueba de intrusión. | On the critical hosts we open a connection and send a single TLS greeting. It is never completed: no session, no data, no credentials, no intrusion test. | **PROVISORIO** |
| `pasos.lista[4][1]` | Una persona lo revisa | A person reviews it | **PROVISORIO** |
| `pasos.lista[4][2]` | Un analista revisa el resultado antes de entregárselo y le escribe para coordinar. | An analyst reviews the result before delivering it and writes to you to coordinate. | **PROVISORIO** |
| `noEs.eyebrow` | Con honestidad | In all honesty | **PROVISORIO** |
| `noEs.h2` | Lo que Q-Ready no es. | What Q-Ready is not. | **PROVISORIO** · igual a la /q-ready retirada (sin aprobación registrada) |
| `noEs.lista[1]` | No es una certificación, ni reemplaza una revisión interna formal. | It is not a certification, and it does not replace a formal internal review. | **PROVISORIO** |
| `noEs.lista[2]` | No ve el interior: módulos de seguridad de hardware, core, VPN, firma de código o cifrado en reposo quedan fuera de una medición externa. | It does not see inside: hardware security modules, core systems, VPN, code signing and encryption at rest are outside an external measurement. | **PROVISORIO** |
| `noEs.lista[3]` | Un número bajo no significa que su organización sea insegura, y uno alto no significa que esté preparada. | A low number does not mean your organization is insecure, and a high one does not mean it is prepared. | **PROVISORIO** |
| `noEs.lista[4]` | No vende pánico: las fechas de 2030 y 2035 son de política pública, no un pronóstico sobre el hardware. | It does not sell panic: the 2030 and 2035 dates are public policy, not a forecast about hardware. | **PROVISORIO** |
| `cierre.lede` | Vea dónde está su criptografía frente al reloj. | See where your cryptography stands against the clock. | **PROVISORIO** · igual a la /q-ready retirada (sin aprobación registrada) |
| `dialogo.cerrar` | Cerrar | Close | **PROVISORIO** |
| `dialogo.eyebrow` | Q-Ready | Q-Ready | igual en los dos idiomas |
| `dialogo.h2` | Pida el informe de su organización. | Request your organization’s report. | **PROVISORIO** |
| `dialogo.et` | Su informe individual · gratis | Your individual report · free | **PROVISORIO** |
| `dialogo.h3` | Su organización, medida. | Your organization, measured. | **PROVISORIO** |
| `dialogo.p` | El mismo método, sobre su propia superficie. Confidencial: sólo para su organización. | The same method, on your own surface. Confidential: only for your organization. | **PROVISORIO** |
| `dialogo.organizacion` | Organización | Organization | **PROVISORIO** |
| `dialogo.dominio` | Dominio raíz | Root domain | **PROVISORIO** |
| `dialogo.dominioEj` | empresa.cl | company.com | **PROVISORIO** |
| `dialogo.nombre` | Nombre y cargo | Name and title | **PROVISORIO** |
| `dialogo.correo` | Correo de la organización | Organization email | **PROVISORIO** |
| `dialogo.correoEj` | nombre@empresa.cl | name@company.com | **PROVISORIO** |
| `dialogo.autoriza` | Represento a esta organización y autorizo medir su superficie pública: un saludo TLS por host, sin acceso a sistemas. | I represent this organization and authorize measuring its public surface: one TLS greeting per host, no access to systems. | **PROVISORIO** |
| `dialogo.enviar` | Solicitar mi informe | Request my report | **PROVISORIO** |
| `dialogo.pie` | Puede pedir su exclusión o el detalle de lo observado cuando quiera, sin costo y sin condiciones. | You can ask to be excluded, or for the detail of what we observed, at any time, free and without conditions. | **PROVISORIO** |
| `js.faltan` | Faltan campos por completar. | Some fields are still empty. | **PROVISORIO** |
| `js.dominio` | El correo tiene que ser del dominio ‹dominio›. | The email must belong to the domain ‹dominio›. | **PROVISORIO** |
| `js.dominioSin` | El correo tiene que ser del dominio que indicó. | The email must belong to the domain you entered. | **PROVISORIO** |
| `js.enviando` | Enviando… | Sending… | **PROVISORIO** |
| `js.recibido` | Recibido. Le escribiremos a ese correo para coordinar su informe. | Received. We will write to that email to coordinate your report. | **PROVISORIO** |
| `js.noRegistro` | No pudimos registrar su pedido. Escríbanos a hello@rosettaquantum.com. | We could not register your request. Write to us at hello@rosettaquantum.com. | **PROVISORIO** |
| `js.noConecta` | No pudimos conectar. Escríbanos a hello@rosettaquantum.com. | We could not connect. Write to us at hello@rosettaquantum.com. | **PROVISORIO** |
| `carrusel.anterior` | Publicación anterior | Previous publication | **PROVISORIO** · nuevo también en español |
| `carrusel.siguiente` | Publicación siguiente | Next publication | **PROVISORIO** · nuevo también en español |
