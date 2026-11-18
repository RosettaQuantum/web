# Textos provisorios · rúbrica del QEX y de la nota (18-nov-2026)

Generado por `node scripts/build-rubrica-qex.mjs` desde `public/js/rubrica-textos.mjs`. **Nada de esto se publica en producción sin aprobación.**
Todo es NUEVO salvo los nombres de las alertas, que repiten los aprobados (`TXT.alerta` de qready-textos.mjs), y la frase sobre el origen de la tabla HNDL en RQ.S.04 (es), aprobada el 18-nov y sellada en `src/data/q-ready/textos-aprobados/`.
Versión: rosetta-rubrica-qex/1 · QEX-1.2 · QREADY-NOTA-2.1 · sha256 del JSON: `5d4d670861ca1cbc3e932ff803bef65f1952c7bd640a8bf64f6087b51263f86e`
Del mismo encargo, en otro documento: los textos nuevos o cambiados de la ficha (país declarado, enlace a la rúbrica en la sección 06, la línea HNDL de «No medido», la escala en /protocolo/ficha) están en `docs/textos-provisorios-ficha.md` (marcados NUEVO o CAMBIA). También es nueva la descripción del parámetro `pais` en api.js (herramienta MCP y OpenAPI).

## es

- título: Rúbrica del QEX y de la nota Q-Ready
- bajada: Cada variable que mide Rosetta, de dónde sale, cómo se puntúa y qué efecto tiene en la nota. La tabla se genera desde el código que calcula el índice: si una regla cambia, la tabla cambia con ella.
- aviso: Borrador para revisión: el texto de esta página no está aprobado.

### Escala de letras (es)

Se leen en orden: la primera que se cumple decide.

| # | nota | condición | rige desde |
|---|---|---|---|
| E.1 | F | Hay al menos una alerta grave. | QREADY-NOTA-0 |
| E.2 | D | Se midió que el sitio principal no acepta TLS 1.3. | QREADY-NOTA-0 |
| E.3 | sin nota | No se pudo medir el sitio principal (TLS 1.3 o candado nuevo sin dato): sin nota. | QREADY-NOTA-0 |
| E.4 | D | Tiene TLS 1.3, no tiene el candado nuevo en el sitio principal y hay al menos una alerta alta. | QREADY-NOTA-0 |
| E.5 | C | Tiene TLS 1.3, no tiene el candado nuevo en el sitio principal y no hay alertas altas. | QREADY-NOTA-0 |
| E.6 | C | Tiene el candado nuevo en el sitio principal y hay al menos una alerta alta. | QREADY-NOTA-0 |
| E.7 | A+ | Cumple todas las condiciones de A, y además publica un /.well-known/q-ready firmado y vigente y tiene el inventario interno verificado por Rosetta. | QREADY-NOTA-0 |
| E.8 | A | Cumple todas las condiciones de A. | QREADY-NOTA-0 |
| E.9 | B | Tiene el candado nuevo en el sitio principal, sin alertas graves ni altas, y le falta alguna condición de A. | QREADY-NOTA-0 |

### Condiciones de A (es)

- A.1 Candado nuevo (X25519MLKEM768) en el sitio principal. (QREADY-NOTA-0)
- A.2 Ninguna alerta grave ni alta. (QREADY-NOTA-0)
- A.3 El registro público de certificados respondió. (QREADY-NOTA-0)
- A.4 Todos los nombres sensibles del registro se sondearon. (QREADY-NOTA-0)
- A.5 Todos los nombres que responden muestran el candado nuevo. (QREADY-NOTA-1)
- A.6 Ningún ambiente de pruebas publicado, aunque esté bloqueado. (QREADY-NOTA-2)
- A.7 Ninguna dimensión con peso ≥ 0,25 quedó sin medir. (QREADY-NOTA-2.1)

### Filas (es)

- **RQ.S.00** Nota Q-Ready (A+ a F) — observa: La letra que resume la medición. · método y límites: Se calcula sobre la foto de la medición con una función pública. Límite: desde afuera el máximo es A. · regla: Ver la escala de letras (bloque 3). · efecto: Es la nota.
- **RQ.S.01** Índice QEX — observa: La suma ponderada de las cuatro dimensiones. · método y límites: Ver la fórmula (bloque 2). Límite: lo interno (inventario, HSM, proveedores) no se ve desde afuera. · regla: 0 a 100, con tope 84. · efecto: No decide la letra.
- **RQ.S.02** Certificados y PKI (dimensión) — observa: El certificado que presenta el sitio principal. · método y límites: Una dimensión: el valor de RQ.S.02.1. Sin certificado leído queda sin dato y el índice se renormaliza. · regla: 0 a 100. · efecto: Sin medir, con peso ≥ 0,25: la nota no puede ser A.
- **RQ.S.02.1** Fuerza de la llave del certificado — observa: Algoritmo y tamaño de la llave del certificado del sitio principal. · método y límites: Se lee la hoja que entrega el servidor. Fuerza clásica por tamaño (NIST SP 800-57, tabla 2): RSA-2048 = 112 bits, RSA-3072 = 128, P-256 = 128, Ed25519 = 128, P-384 = 192. Límite: la sonda reconoce RSA, las curvas P-256, P-384 y P-521, Ed25519 y las firmas post-cuánticas de NIST IR 8547 (tabla 3); otro algoritmo sale sin dato. · regla: 75 con cualquier llave clásica de al menos 112 bits de fuerza (EdDSA: 128), sea RSA-2048, RSA-4096, P-256 o P-384: NIST IR 8547 las depreca después de 2030 y las prohíbe después de 2035, todas por igual. 0 bajo esa fuerza (por ejemplo RSA-1024): no está entre lo aprobado. 100 con una firma post-cuántica (ML-DSA, SLH-DSA, HSS/LMS, XMSS, XMSS^MT). Sin certificado leído: sin dato, nunca 0. · efecto: Ninguno directo (ver RQ.S.02).
- **RQ.S.02.2** Vigencia del certificado — observa: La fecha de vencimiento del certificado del sitio principal. · método y límites: Se compara con el día de la medición (UTC). Indicador de la ficha: RQ.S.07. · regla: Informativo: 0 puntos. · efecto: Vencido el día de la medición: alerta grave, F.
- **RQ.S.02.3** Plan con fecha para certificado post-cuántico — observa: Si el dueño declaró, en un /.well-known/q-ready firmado y vigente, un plan con fecha. · método y límites: Sólo se lee para dominios verificados, en el cron diario. En una medición de un tercero nunca llega: la alerta sale siempre que el certificado es RSA o de curva elíptica. · regla: Informativo: 0 puntos. · efecto: Sin plan con fecha: alerta media; no baja la letra.
- **RQ.S.03** Higiene de superficie (dimensión) — observa: TLS 1.3 en el sitio principal y los nombres del registro público de certificados. · método y límites: Base y cuatro descuentos, con piso y techo. Sin registro de certificados sólo cuenta TLS 1.3. · regla: Base 70; resultado entre 0 y 100. El máximo alcanzable es 70. · efecto: Sin medir, con peso ≥ 0,25: la nota no puede ser A.
- **RQ.S.03.1** TLS 1.3 en el sitio principal — observa: Si el sitio principal acepta un saludo que sólo ofrece TLS 1.3. · método y límites: Respuesta del servidor = sí; alerta 70 (protocol_version) = no; corte o sin respuesta = sin dato, que no descuenta. · regla: −30 si no hay TLS 1.3. · efecto: Sin TLS 1.3: D.
- **RQ.S.03.2** Nombres no productivos en el registro — observa: Nombres de la clase no_productivo (bloque 4) en el registro público de certificados. · método y límites: Se cuentan todos los nombres que el registro acumuló, aunque hoy no existan; en QEX-1.2-hv (interno, no publicado) sólo los que responden hoy. Límite: no ve nombres que nunca tuvieron un certificado público, ni comodines. · regla: −10 si hay 1 o más. · efecto: Ninguno directo: la nota mira los que responden (RQ.S.09.1 a .3).
- **RQ.S.03.3** Infraestructura sensible en el registro — observa: Nombres de la clase infra_expuesta (bloque 4) en el registro público de certificados. · método y límites: Mismo conteo acumulado que RQ.S.03.2. Límite: un nombre de correo cuenta igual, aunque no exponga un servicio web. · regla: −10 si hay 3 o más. · efecto: Ninguno directo: la nota mira los que responden (RQ.S.09.4).
- **RQ.S.03.4** Nombres de legado en el registro — observa: Nombres de la clase legado (bloque 4) en el registro público de certificados. · método y límites: Mismo conteo acumulado que RQ.S.03.2. · regla: −10 si hay 1 o más. · efecto: Ninguno directo: la nota mira los que responden (RQ.S.09.5).
- **RQ.S.03.5** security.txt — observa: Si el dominio publica /.well-known/security.txt con una línea Contact. · método y límites: Se pide en el dominio y en www. 404, 410 o una página sin Contact = no publicado; 403 o 5xx = sin dato. Indicador de la ficha: RQ.S.08. · regla: Informativo: 0 puntos. · efecto: Ninguno.
- **RQ.S.04** Postura HNDL (dimensión) — observa: Nada del dominio: es el valor del sector que se declara al medir. · método y límites: Se lee de la tabla de referencia. Límite: igual para toda organización del sector; nada de lo que haga la organización la mueve. Estos valores son un modelo propio de Rosetta, fijado en la edición de agosto de 2026. La derivación no está publicada: se publica el valor que se usa, no cómo se llegó a él. · regla: Valor del sector: Banca 12 · Educación 37 · Energía 12 · Fintech 65 · Gobierno 12 · Minería 37 · Previsión 12 · Retail 65 · Salud · clínicas 12 · Salud · isapres 12 · Seguros 12 · Telecomunicaciones 12. · efecto: Sin sector no hay índice. Sin medir, con peso ≥ 0,25: la nota no puede ser A.
- **RQ.S.04.1** Años que el dato del sector debe seguir secreto — observa: — · método y límites: Sin dato: tabla por sector fijada en la edición 2026-08; la derivación no está publicada. · regla: No puntúa por separado. · efecto: —
- **RQ.S.04.2** Años que toma migrar en el sector — observa: — · método y límites: Sin dato: tabla por sector fijada en la edición 2026-08; la derivación no está publicada. · regla: No puntúa por separado. · efecto: —
- **RQ.S.04.3** Margen de Mosca — observa: — · método y límites: Sin dato: tabla por sector fijada en la edición 2026-08; la derivación no está publicada. · regla: No puntúa por separado. · efecto: —
- **RQ.S.05** PQC en el borde (dimensión) — observa: Si el sitio principal negocia el intercambio híbrido post-cuántico. · método y límites: Una dimensión: el valor de RQ.S.05.1. · regla: 0 a 100. · efecto: Ver RQ.S.05.1.
- **RQ.S.05.1** Soporta X25519MLKEM768 (el candado nuevo) — observa: Si el sitio principal acepta el intercambio híbrido X25519MLKEM768. · método y límites: Tres saludos TLS 1.3: como navegador, sólo el híbrido, y sin él. Límite: mide el borde (a menudo el CDN), no el tramo del borde al origen. · regla: 100 si lo soporta; 0 si no; sin respuesta, sin dato. · efecto: Sin el candado nuevo: C, o D con una alerta alta. Con él: B o A. Sin dato: sin nota.
- **RQ.S.05.2** Lo elige por defecto — observa: Si el sitio elige el híbrido cuando el cliente ofrece las dos opciones. · método y límites: Del saludo como navegador. · regla: Informativo: 0 puntos. · efecto: Ninguno.
- **RQ.S.05.3** Candado nuevo en todos los nombres que responden — observa: Si cada nombre sondeado que responde en 443 acepta el híbrido. · método y límites: Un saludo sólo con el híbrido a cada nombre que responde. Límite: sólo los nombres sondeados (bloque 4). · regla: Informativo: 0 puntos. · efecto: Condición de A.
- **RQ.S.06** Correo post-cuántico — observa: Cuántos servidores de correo (MX) aceptan el intercambio híbrido. · método y límites: Saludo STARTTLS a cada MX desde el servidor de correo de Rosetta; llega aparte, después de la medición. · regla: No suma al QEX. · efecto: Ninguno.
- **RQ.S.09.1** Ambiente de pruebas que responde abierto — observa: Un nombre de ambiente de pruebas (bloque 4) que responde en 443 y no está bloqueado. · método y límites: Se sondea primero. Con el dueño verificado se pide la raíz: 2xx, 3xx, 401, cualquier otro código o ninguno = abierto. Límite: hasta el tope de nombres sondeados. · regla: No suma al QEX. · efecto: Alerta grave: F.
- **RQ.S.09.2** Ambiente de pruebas con el acceso bloqueado — observa: Un ambiente de pruebas que responde en 443 y devuelve 403 en la raíz. · método y límites: Sólo con el dueño verificado se pide la raíz. · regla: No suma al QEX. · efecto: Alerta media que no deja dar A (techo B).
- **RQ.S.09.3** Ambiente de pruebas publicado, sin consultar la raíz — observa: Un ambiente de pruebas que completa el saludo TLS, de un dominio cuyo dueño no está verificado. · método y límites: Sin dueño verificado no se pide la raíz: no se sabe si está abierto o bloqueado, y no se pregunta. · regla: No suma al QEX. · efecto: Alerta media que no deja dar A (techo B).
- **RQ.S.09.4** Infraestructura sensible que responde — observa: Un nombre de la clase infra_expuesta que responde en 443 y no es de correo. · método y límites: Saludo TLS a cada nombre sondeado. Límite: hasta el tope de nombres sondeados. · regla: No suma al QEX. · efecto: Alerta alta: C con el candado nuevo; D sin él.
- **RQ.S.09.5** Nombre de legado que responde — observa: Un nombre de la clase legado que responde en 443. · método y límites: Saludo TLS a cada nombre sondeado. · regla: No suma al QEX. · efecto: Alerta media; no baja la letra.
- **RQ.S.09.6** Servicio de correo que responde en 443 — observa: Un nombre de infraestructura que anuncia correo (bloque 4) y responde en 443. · método y límites: Saludo TLS a cada nombre sondeado. · regla: No suma al QEX. · efecto: Alerta media; no baja la letra.
- **RQ.S.09.7** Nombres sensibles sin sondear — observa: Nombres sensibles del registro que quedaron fuera del tope de la medición. · método y límites: Se sondean hasta 15 nombres, los ambientes de pruebas primero. Lo que queda fuera no se sabe si responde. · regla: No suma al QEX. · efecto: Mientras quede alguno: no hay A.
- **RQ.S.13** Registro público de certificados disponible — observa: Si el registro público (Certificate Transparency) respondió, y cuántos nombres trae. · método y límites: Se piden crt.sh y Cert Spotter en paralelo y se suman sus filas; cada una con sus copias fechadas. Límite: Cert Spotter sólo trae certificados vigentes. · regla: No suma al QEX por sí mismo (alimenta RQ.S.03.2 a .4). · efecto: Sin registro: no hay A.
- **sin ID (RQ.S.10 a .12 están reservados)** /.well-known/q-ready firmado y vigente — observa: Un plan post-cuántico declarado y firmado por el dueño en su dominio. · método y límites: Se verifica la firma Ed25519 y la vigencia. Límite: una firma válida prueba quién lo publicó, no que lo declarado sea cierto. · regla: No suma al QEX. · efecto: Condición de A+.
- **sin ID (RQ.S.10 está reservado para el inventario)** Inventario interno verificado — observa: Que Rosetta revisó el inventario criptográfico interno. · método y límites: No se ve desde afuera. · regla: No suma al QEX. · efecto: Condición de A+.

### Fórmula (es)

- F.1 Cuatro dimensiones de 0 a 100, con estos pesos: Certificados y PKI 0,4 · Higiene de superficie 0,25 · Postura HNDL 0,25 · PQC en el borde 0,1.
- F.2 QEX = suma de (valor × peso) de las dimensiones medidas, dividida por la suma de sus pesos.
- F.3 Una dimensión sin medir (sin dato) no cuenta ni como 0: el índice se renormaliza sobre los pesos que sí se midieron.
- F.4 Redondeo al par, como round() de Python 3: 56,5 da 56.
- F.5 Tope 84: el índice nunca pasa de 84, porque lo interno no se ve desde afuera.
- F.6 Máximo alcanzable desde afuera, por valor HNDL del sector: HNDL 12 → 70 · HNDL 37 → 77 · HNDL 65 → 84.

### Clases de nombres (es)

- PAT.no_productivo Ambientes no productivos (clase de agosto; QEX-1.0 y la nota): Palabras: dev, test, qa, uat, stg, stage, staging, lab, demo, sandbox, pre, prueba, pruebas. Expresión exacta: (^|[.\-])(dev|test|qa|uat|stg|stage|staging|lab|demo|sandbox|pre|prueba|pruebas)([.\-]|$)
- PAT.legado Nombres de legado: Palabras: old, legacy, bkp, backup, tmp, temp, deprecated, antiguo, antigua, v1. Expresión exacta: (^|[.\-])(old|legacy|bkp|backup|tmp|temp|deprecated|antiguo|antigua|v1)([.\-]|$)
- PAT.infra_expuesta Infraestructura sensible: Palabras: vpn, mail, smtp, webmail, ftp, sftp, rdp, citrix, jenkins, jira, admin, cpanel, monitor, nagios, grafana, gitlab, sonar. Expresión exacta: (^|[.\-])(vpn|mail|smtp|webmail|ftp|sftp|rdp|citrix|jenkins|jira|admin|cpanel|monitor|nagios|grafana|gitlab|sonar)([.\-]|$)
- PAT.critico Servicios críticos (se cuentan; no descuentan): Palabras: api, pay, pagos?, payments?, auth, login, sso, portal, banca, online, empresas, secure, transfer. Expresión exacta: (^|[.\-])(api|pay|pagos?|payments?|auth|login|sso|portal|banca|online|empresas|secure|transfer)([.\-]|$)
- PAT.senal_prueba Señal de ambientes de prueba (la nota y QEX-1.2-hv): Palabras: desa, desarrollo, development, dev, test, testing, qa, uat, stg, stage, staging, homolog, homologacion, hml, certificacion, prueba, pruebas, preprod, sandbox, demo. Calza como segmento del nombre, o pegado con un guion (por ejemplo api-desarrollo). Expresión exacta: (^|[.-])(desa|desarrollo|development|dev|test|testing|qa|uat|stg|stage|staging|homolog|homologacion|hml|certificacion|prueba|pruebas|preprod|sandbox|demo)(\d*)([.-]|$)
- PAT.correo Nombres de correo (sólo cambia cómo se redacta y qué alerta sale): Palabras: mail, smtp, webmail, imap, pop3?, mx\d*, correo, owa, exchange. Expresión exacta: (^|[.\-])(mail|smtp|webmail|imap|pop3?|mx\d*|correo|owa|exchange)([.\-]|$)
- PAT.sondeo Qué nombres se sondean: Los ambientes de pruebas primero y luego las clases no_productivo, legado, infra_expuesta, hasta 15 nombres por medición.

## en

- título: QEX and Q-Ready grade rubric
- bajada: Every variable Rosetta measures, where it comes from, how it is scored and what it does to the grade. The table is generated from the code that computes the index: if a rule changes, the table changes with it.
- aviso: Draft for review: the text on this page is not approved.

### Escala de letras (en)

Read in order: the first one that holds decides.

| # | nota | condición | rige desde |
|---|---|---|---|
| E.1 | F | There is at least one serious alert. | QREADY-NOTA-0 |
| E.2 | D | The main site was measured not to accept TLS 1.3. | QREADY-NOTA-0 |
| E.3 | no grade | The main site could not be measured (TLS 1.3 or new lock with no data): no grade. | QREADY-NOTA-0 |
| E.4 | D | It has TLS 1.3, no new lock on the main site, and at least one high alert. | QREADY-NOTA-0 |
| E.5 | C | It has TLS 1.3, no new lock on the main site, and no high alerts. | QREADY-NOTA-0 |
| E.6 | C | It has the new lock on the main site and at least one high alert. | QREADY-NOTA-0 |
| E.7 | A+ | It meets every condition for A, and also publishes a signed, unexpired /.well-known/q-ready and has its internal inventory verified by Rosetta. | QREADY-NOTA-0 |
| E.8 | A | It meets every condition for A. | QREADY-NOTA-0 |
| E.9 | B | It has the new lock on the main site, no serious or high alerts, and misses some condition for A. | QREADY-NOTA-0 |

### Condiciones de A (en)

- A.1 New lock (X25519MLKEM768) on the main site. (QREADY-NOTA-0)
- A.2 No serious or high alert. (QREADY-NOTA-0)
- A.3 The public certificate log answered. (QREADY-NOTA-0)
- A.4 Every sensitive name in the log was probed. (QREADY-NOTA-0)
- A.5 Every name that answers shows the new lock. (QREADY-NOTA-1)
- A.6 No published test environment, even if blocked. (QREADY-NOTA-2)
- A.7 No dimension with weight ≥ 0.25 was left unmeasured. (QREADY-NOTA-2.1)

### Filas (en)

- **RQ.S.00** Q-Ready grade (A+ to F) — observa: The letter that sums up the measurement. · método y límites: Computed on the measurement snapshot by a public function. Limit: from outside, the highest grade is A. · regla: See the letter scale (block 3). · efecto: It is the grade.
- **RQ.S.01** QEX index — observa: The weighted sum of the four dimensions. · método y límites: See the formula (block 2). Limit: what is internal (inventory, HSM, providers) cannot be seen from outside. · regla: 0 to 100, capped at 84. · efecto: Does not decide the letter.
- **RQ.S.02** Certificates and PKI (dimension) — observa: The certificate the main site presents. · método y límites: One dimension: the value of RQ.S.02.1. With no certificate read it has no data and the index is renormalized. · regla: 0 to 100. · efecto: Not measured, with weight ≥ 0.25: the grade cannot be A.
- **RQ.S.02.1** Certificate key strength — observa: Algorithm and key size of the main site's certificate. · método y límites: The leaf the server presents is read. Classical strength by size (NIST SP 800-57, table 2): RSA-2048 = 112 bits, RSA-3072 = 128, P-256 = 128, Ed25519 = 128, P-384 = 192. Limit: the probe recognizes RSA, the P-256, P-384 and P-521 curves, Ed25519 and the post-quantum signatures of NIST IR 8547 (table 3); any other algorithm comes out as no data. · regla: 75 for any classical key of at least 112 bits of strength (EdDSA: 128), be it RSA-2048, RSA-4096, P-256 or P-384: NIST IR 8547 deprecates them after 2030 and disallows them after 2035, all alike. 0 below that strength (for example RSA-1024): it is not among the approved. 100 with a post-quantum signature (ML-DSA, SLH-DSA, HSS/LMS, XMSS, XMSS^MT). No certificate read: no data, never 0. · efecto: None directly (see RQ.S.02).
- **RQ.S.02.2** Certificate validity — observa: The expiry date of the main site's certificate. · método y límites: Compared with the measurement day (UTC). Fact-sheet indicator: RQ.S.07. · regla: For information: 0 points. · efecto: Expired on the measurement day: serious alert, F.
- **RQ.S.02.3** Dated plan for a post-quantum certificate — observa: Whether the owner declared a dated plan in a signed, unexpired /.well-known/q-ready. · método y límites: Read only for verified domains, in the daily cron. A third-party measurement never receives it: the alert appears whenever the certificate is RSA or elliptic-curve. · regla: For information: 0 points. · efecto: No dated plan: medium alert; does not lower the letter.
- **RQ.S.03** Surface hygiene (dimension) — observa: TLS 1.3 on the main site and the names in the public certificate log. · método y límites: A base and four deductions, with a floor and a ceiling. Without the certificate log only TLS 1.3 counts. · regla: Base 70; result between 0 and 100. The highest reachable is 70. · efecto: Not measured, with weight ≥ 0.25: the grade cannot be A.
- **RQ.S.03.1** TLS 1.3 on the main site — observa: Whether the main site accepts a handshake that offers only TLS 1.3. · método y límites: A server answer = yes; alert 70 (protocol_version) = no; a cut or no answer = no data, which does not deduct. · regla: −30 if there is no TLS 1.3. · efecto: No TLS 1.3: D.
- **RQ.S.03.2** Non-production names in the log — observa: Names of the no_productivo class (block 4) in the public certificate log. · método y límites: Every name the log ever accumulated counts, even if it no longer exists; in QEX-1.2-hv (internal, not published) only those that answer today. Limit: it does not see names that never had a public certificate, nor wildcards. · regla: −10 if there are 1 or more. · efecto: None directly: the grade looks at the ones that answer (RQ.S.09.1 to .3).
- **RQ.S.03.3** Sensitive infrastructure in the log — observa: Names of the infra_expuesta class (block 4) in the public certificate log. · método y límites: Same accumulated count as RQ.S.03.2. Limit: a mail name counts the same, even if it exposes no web service. · regla: −10 if there are 3 or more. · efecto: None directly: the grade looks at the ones that answer (RQ.S.09.4).
- **RQ.S.03.4** Legacy names in the log — observa: Names of the legado class (block 4) in the public certificate log. · método y límites: Same accumulated count as RQ.S.03.2. · regla: −10 if there are 1 or more. · efecto: None directly: the grade looks at the ones that answer (RQ.S.09.5).
- **RQ.S.03.5** security.txt — observa: Whether the domain publishes /.well-known/security.txt with a Contact line. · método y límites: Requested on the domain and on www. 404, 410 or a page without Contact = not published; 403 or 5xx = no data. Fact-sheet indicator: RQ.S.08. · regla: For information: 0 points. · efecto: None.
- **RQ.S.04** HNDL posture (dimension) — observa: Nothing about the domain: it is the value of the sector declared when measuring. · método y límites: Read from the reference table. Limit: the same for every organization in the sector; nothing the organization does moves it. · regla: Sector value: Banca 12 · Educación 37 · Energía 12 · Fintech 65 · Gobierno 12 · Minería 37 · Previsión 12 · Retail 65 · Salud · clínicas 12 · Salud · isapres 12 · Seguros 12 · Telecomunicaciones 12. · efecto: No sector, no index. Not measured, with weight ≥ 0.25: the grade cannot be A.
- **RQ.S.04.1** Years the sector's data must stay secret — observa: — · método y límites: No data: a per-sector table fixed in the 2026-08 edition; the derivation is not published. · regla: Not scored separately. · efecto: —
- **RQ.S.04.2** Years the sector takes to migrate — observa: — · método y límites: No data: a per-sector table fixed in the 2026-08 edition; the derivation is not published. · regla: Not scored separately. · efecto: —
- **RQ.S.04.3** Mosca margin — observa: — · método y límites: No data: a per-sector table fixed in the 2026-08 edition; the derivation is not published. · regla: Not scored separately. · efecto: —
- **RQ.S.05** PQC at the edge (dimension) — observa: Whether the main site negotiates the hybrid post-quantum key exchange. · método y límites: One dimension: the value of RQ.S.05.1. · regla: 0 to 100. · efecto: See RQ.S.05.1.
- **RQ.S.05.1** Supports X25519MLKEM768 (the new lock) — observa: Whether the main site accepts the X25519MLKEM768 hybrid key exchange. · método y límites: Three TLS 1.3 handshakes: as a browser, hybrid only, and without it. Limit: it measures the edge (often the CDN), not the edge-to-origin leg. · regla: 100 if supported; 0 if not; no answer, no data. · efecto: Without the new lock: C, or D with a high alert. With it: B or A. No data: no grade.
- **RQ.S.05.2** Chooses it by default — observa: Whether the site chooses the hybrid when the client offers both options. · método y límites: From the browser-like handshake. · regla: For information: 0 points. · efecto: None.
- **RQ.S.05.3** New lock on every name that answers — observa: Whether every probed name that answers on 443 accepts the hybrid. · método y límites: A hybrid-only handshake to each name that answers. Limit: probed names only (block 4). · regla: For information: 0 points. · efecto: Condition for A.
- **RQ.S.06** Post-quantum email — observa: How many mail servers (MX) accept the hybrid key exchange. · método y límites: A STARTTLS handshake to each MX from Rosetta's mail server; it arrives separately, after the measurement. · regla: Does not add to the QEX. · efecto: None.
- **RQ.S.09.1** Test environment that answers open — observa: A test-environment name (block 4) that answers on 443 and is not blocked. · método y límites: Probed first. With a verified owner the root is requested: 2xx, 3xx, 401, any other code or none = open. Limit: up to the cap of probed names. · regla: Does not add to the QEX. · efecto: Serious alert: F.
- **RQ.S.09.2** Test environment with access blocked — observa: A test environment that answers on 443 and returns 403 at the root. · método y límites: The root is requested only with a verified owner. · regla: Does not add to the QEX. · efecto: Medium alert that rules out A (B ceiling).
- **RQ.S.09.3** Test environment published, root not requested — observa: A test environment that completes the TLS handshake, on a domain whose owner is not verified. · método y límites: Without a verified owner the root is not requested: it is unknown whether it is open or blocked, and it is not asked. · regla: Does not add to the QEX. · efecto: Medium alert that rules out A (B ceiling).
- **RQ.S.09.4** Sensitive infrastructure that answers — observa: A name of the infra_expuesta class that answers on 443 and is not a mail name. · método y límites: A TLS handshake to each probed name. Limit: up to the cap of probed names. · regla: Does not add to the QEX. · efecto: High alert: C with the new lock; D without it.
- **RQ.S.09.5** Legacy name that answers — observa: A name of the legado class that answers on 443. · método y límites: A TLS handshake to each probed name. · regla: Does not add to the QEX. · efecto: Medium alert; does not lower the letter.
- **RQ.S.09.6** Mail service answering on 443 — observa: An infrastructure name that announces mail (block 4) and answers on 443. · método y límites: A TLS handshake to each probed name. · regla: Does not add to the QEX. · efecto: Medium alert; does not lower the letter.
- **RQ.S.09.7** Sensitive names left unprobed — observa: Sensitive names in the log left out by the per-measurement cap. · método y límites: Up to 15 names are probed, test environments first. Whatever is left out is unknown. · regla: Does not add to the QEX. · efecto: While any remains: no A.
- **RQ.S.13** Public certificate log available — observa: Whether the public log (Certificate Transparency) answered, and how many names it holds. · método y límites: crt.sh and Cert Spotter are requested in parallel and their rows merged, each with its dated copies. Limit: Cert Spotter only returns unexpired certificates. · regla: Does not add to the QEX by itself (feeds RQ.S.03.2 to .4). · efecto: No log: no A.
- **no ID (RQ.S.10 to .12 are reserved)** Signed, unexpired /.well-known/q-ready — observa: A post-quantum plan declared and signed by the owner on its domain. · método y límites: The Ed25519 signature and the expiry are checked. Limit: a valid signature proves who published it, not that the declaration is true. · regla: Does not add to the QEX. · efecto: Condition for A+.
- **no ID (RQ.S.10 is reserved for the inventory)** Verified internal inventory — observa: That Rosetta reviewed the internal cryptographic inventory. · método y límites: Not visible from outside. · regla: Does not add to the QEX. · efecto: Condition for A+.

### Fórmula (en)

- F.1 Four dimensions from 0 to 100, with these weights: Certificates and PKI 0.4 · Surface hygiene 0.25 · HNDL posture 0.25 · PQC at the edge 0.1.
- F.2 QEX = sum of (value × weight) over the measured dimensions, divided by the sum of their weights.
- F.3 A dimension that was not measured (no data) does not count, not even as 0: the index is renormalized over the weights that were measured.
- F.4 Round half to even, like Python 3 round(): 56.5 gives 56.
- F.5 Cap 84: the index never exceeds 84, because what is internal cannot be seen from outside.
- F.6 Highest reachable from outside, by the sector's HNDL value: HNDL 12 → 70 · HNDL 37 → 77 · HNDL 65 → 84.

### Clases de nombres (en)

- PAT.no_productivo Non-production environments (August class; QEX-1.0 and the grade): Words: dev, test, qa, uat, stg, stage, staging, lab, demo, sandbox, pre, prueba, pruebas. Exact expression: (^|[.\-])(dev|test|qa|uat|stg|stage|staging|lab|demo|sandbox|pre|prueba|pruebas)([.\-]|$)
- PAT.legado Legacy names: Words: old, legacy, bkp, backup, tmp, temp, deprecated, antiguo, antigua, v1. Exact expression: (^|[.\-])(old|legacy|bkp|backup|tmp|temp|deprecated|antiguo|antigua|v1)([.\-]|$)
- PAT.infra_expuesta Sensitive infrastructure: Words: vpn, mail, smtp, webmail, ftp, sftp, rdp, citrix, jenkins, jira, admin, cpanel, monitor, nagios, grafana, gitlab, sonar. Exact expression: (^|[.\-])(vpn|mail|smtp|webmail|ftp|sftp|rdp|citrix|jenkins|jira|admin|cpanel|monitor|nagios|grafana|gitlab|sonar)([.\-]|$)
- PAT.critico Critical services (counted; no deduction): Words: api, pay, pagos?, payments?, auth, login, sso, portal, banca, online, empresas, secure, transfer. Exact expression: (^|[.\-])(api|pay|pagos?|payments?|auth|login|sso|portal|banca|online|empresas|secure|transfer)([.\-]|$)
- PAT.senal_prueba Test-environment signal (the grade and QEX-1.2-hv): Words: desa, desarrollo, development, dev, test, testing, qa, uat, stg, stage, staging, homolog, homologacion, hml, certificacion, prueba, pruebas, preprod, sandbox, demo. Matches as a segment of the name, or joined with a hyphen (for example api-desarrollo). Exact expression: (^|[.-])(desa|desarrollo|development|dev|test|testing|qa|uat|stg|stage|staging|homolog|homologacion|hml|certificacion|prueba|pruebas|preprod|sandbox|demo)(\d*)([.-]|$)
- PAT.correo Mail names (only changes the wording and which alert appears): Words: mail, smtp, webmail, imap, pop3?, mx\d*, correo, owa, exchange. Exact expression: (^|[.\-])(mail|smtp|webmail|imap|pop3?|mx\d*|correo|owa|exchange)([.\-]|$)
- PAT.sondeo Which names are probed: Test environments first, then the classes no_productivo, legado, infra_expuesta, up to 15 names per measurement.
