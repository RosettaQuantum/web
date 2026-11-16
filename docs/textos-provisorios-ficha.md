# rosetta-ficha/1 · textos provisorios para aprobar

Generado por `node scripts/textos-ficha.mjs` desde el código (public/js/qready-textos.mjs, src/pages/llms.txt.ts). Lo que se apruebe aquí es literalmente lo que se sirve.

**Segunda vuelta (16-nov).** Marcado **NUEVO** o **CAMBIA** abajo. Además, sin texto nuevo: (1) el nivel ALTA (HIGH) entra al protocolo; (2) en las acciones, security.txt pasa a «Resuelve: —»; (3) RQ.S.09 sin nombres sondeados dice «sin nombres sondeados» en vez de «0/0 responden»; (4) la página /es/q-ready/medicion y /q-ready/medicion pintan los nombres enmascarados (consola, mapa al pasar el cursor, tabla de endpoints, alertas, «Qué falta para A» y comparación) salvo que el dominio esté verificado, con la misma regla y sufijo #xx que la API; (5) nota.lectura del JSON pasa a ser la misma lectura por motivo de la ficha.

Reusados sin cambio (ya aprobados): los nombres de las alertas (`TXT.alerta`) y la lectura de cada letra (`TXT.nota_lectura`). El encabezado, el pie y las líneas fijas de «No medido», «Evidencia» y «Límites» vienen del ejemplo canónico del encargo del 13-nov.

## Ficha · es

- `titulo`: Ficha Rosetta · Seguridad post-cuántica
- `medido`: medido ‹1› UTC
- `pais_sin`: país no determinado
- `secciones[0]`: Veredicto
- `secciones[1]`: Indicadores
- `secciones[2]`: Alertas
- `secciones[3]`: Qué hacer
- `secciones[4]`: No medido
- `secciones[5]`: Evidencia
- `secciones[6]`: Límites y siguiente paso
- `col.id`: ID
- `col.indicador`: Indicador
- `col.valor`: Valor
- `col.tipo`: Tipo
- `col.n`: #
- `col.nivel`: Nivel
- `col.hallazgo`: Hallazgo
- `col.donde`: Dónde
- `col.accion`: Acción
- `col.resuelve`: Resuelve
- `col.efecto`: Efecto
- `indicador.RQ.S.00`: Nota Q-Ready
- `indicador.RQ.S.01`: Índice QEX
- `indicador.RQ.S.02`: Certificados y PKI
- `indicador.RQ.S.03`: Higiene de superficie
- `indicador.RQ.S.04`: Postura HNDL
- `indicador.RQ.S.05`: PQC en el borde
- `indicador.RQ.S.06`: Correo post-cuántico
- `indicador.RQ.S.07`: Vigencia del certificado
- `indicador.RQ.S.08`: security.txt
- `indicador.RQ.S.09`: Superficie expuesta
- `tipo.medido`: medido
- `tipo.modelo`: modelo
- `tipo.no medido`: no medido
- `nivel.GRAVE`: GRAVE
- **NUEVO** `nivel.ALTA`: ALTA
- `nivel.MEDIA`: MEDIA
- `nivel.INFO`: INFO
- `sector.banca`: banca
- `sector.educacion`: educación
- `sector.energia`: energía
- `sector.fintech`: fintech
- `sector.gobierno`: gobierno
- `sector.mineria`: minería
- `sector.prevision`: previsión
- `sector.retail`: retail
- `sector.salud_clinica`: salud · clínicas
- `sector.salud_isapre`: salud · isapres
- `sector.seguros`: seguros
- `sector.telecom`: telecomunicaciones
- `sin_nota`: sin nota
- `sin_dato`: sin dato
- `qex`: ‹1›/100 (tope externo 84)
- `sobre_100`: ‹1›/100
- `correo`: ‹1›/‹2› MX
- `correo_sin_mx`: sin MX publicado
- `correo_pendiente`: pendiente
- `vigencia`: ‹1› días (‹2›)
- `vigencia_vencido`: vencido (‹1›)
- `security_si`: publicado
- `security_no`: no publicado
- `superficie`: ‹1›/‹2› responden
- **NUEVO** `superficie_sin`: sin nombres sondeados
- `lectura`: Lectura: ‹1›
- **NUEVO** `lectura_motivo.con_candado`: Su sitio ya usa el candado post-cuántico, pero ‹1›.
- **NUEVO** `lectura_motivo.sin_candado_y`: Su sitio todavía no usa el candado post-cuántico y ‹1›.
- **NUEVO** `lectura_motivo.sin_candado`: Su sitio usa TLS 1.3, pero todavía no usa el candado post-cuántico.
- **NUEVO** `lectura_motivo.sin_tls13`: Su sitio principal no usa TLS 1.3, y sin TLS 1.3 no hay candado post-cuántico.
- **NUEVO** `lectura_motivo.solo`: ‹1›.
- **NUEVO** `lectura_motivo.y`:  y 
- **NUEVO** `lectura_motivo.certificado_vencido`: tiene el certificado vencido
- **NUEVO** `lectura_motivo.pruebas_expuestas`: tiene un ambiente de pruebas expuesto a internet / tiene ‹1› ambientes de prueba expuestos a internet
- **NUEVO** `lectura_motivo.infraestructura`: tiene un nombre de infraestructura sensible que responde / tiene ‹1› nombres de infraestructura sensible que responden
- **NUEVO** `lectura_motivo.pruebas_publicadas`: tiene un ambiente de pruebas publicado / tiene ‹1› ambientes de prueba publicados
- **NUEVO** `lectura_motivo.sin_evidencia`: un nombre que responde no muestra el candado nuevo / ‹1› nombres que responden no muestran el candado nuevo
- **NUEVO** `lectura_motivo.sin_superficie`: el registro público de certificados no respondió
- **NUEVO** `lectura_motivo.sin_sondear`: un nombre sensible quedó sin medir / ‹1› nombres sensibles quedaron sin medir
- **NUEVO** `lectura_motivo.sin_causa`: no todo lo que respondió muestra el candado nuevo
- `referencia`: Referencia: mediana de ‹1› en Chile ‹2›/100 (‹3› organizaciones, edición ‹4›); diferencia ‹5›.
- `referencia_sin_qex`: Referencia: sin QEX, no se compara.
- `referencia_otro_pais`: Referencia: sin índice para ‹1›; no se compara.
- `referencia_sin_pais`: Referencia: el dominio .‹1› no indica país; no se compara.
- `publicacion_privada`: Publicación: privada. El dueño no ha activado su página pública.
- `publicacion_publica`: Publicación: pública en ‹1›
- `vacio`: Sin hallazgos.
- `efecto_sube`: -> ‹1›
- `efecto_no`: no cambia la nota
- `accion.renovar_certificado`: Renovar el certificado vencido
- `accion.sacar_ambientes_pruebas`: Sacar de internet el ambiente de pruebas / Sacar de internet los ‹1› ambientes de prueba
- `accion.activar_tls13`: Activar TLS 1.3 en el sitio principal
- `accion.hibrido_en_principal`: Activar el intercambio híbrido X25519MLKEM768 en el sitio principal
- `accion.cerrar_infraestructura`: Cerrar o restringir el nombre de infraestructura que responde / Cerrar o restringir los ‹1› nombres de infraestructura que responden
- `accion.retirar_ambientes_bloqueados`: Retirar de internet el ambiente de pruebas publicado / Retirar de internet los ‹1› ambientes de prueba publicados
- `accion.baja_legado`: Dar de baja o asignar dueño al nombre de legado / Dar de baja o asignar dueño a los ‹1› nombres de legado
- `accion.correo_fuera_de_443`: Cerrar el puerto 443 en el servicio de correo / Cerrar el puerto 443 en los ‹1› servicios de correo
- `accion.hibrido_en_nombres`: Activar X25519MLKEM768 en el nombre que responde sin él / Activar X25519MLKEM768 en los ‹1› nombres que responden sin él
- `accion.plan_certificado_pq`: Plan con fecha para certificado post-cuántico
- `accion.publicar_security_txt`: Publicar security.txt
- `accion.correo_hibrido`: Pedir al proveedor de correo fecha para el intercambio híbrido
- `no_medido.tope`: ‹1› de ‹2› nombres sensibles quedaron fuera del tope de la sonda.
- `no_medido.fuentes`: ‹1› no respondió; se usó ‹2› (‹3› certificados, ‹4› nombres).
- `no_medido.sin_registro`: El registro público de certificados no respondió: sin superficie no se puede dar A.
- `no_medido.borde`: El sitio principal no respondió a nuestros saludos: sin nota.
- `no_medido.sin_evidencia`: ‹1› nombres respondieron sin evidencia del candado nuevo.
- `no_medido.correo_pendiente`: El cifrado del correo se mide aparte y llega después (herramienta ver_cifrado_correo).
- `no_medido.correo_sin_dato`: El cifrado del correo no se midió en esta foto.
- `no_medido.interno`: Lo interno (inventario, HSM, proveedores) no se ve desde afuera: por eso el tope es 84.
- `no_medido.nunca`: "No medido" nunca significa "no protegido".
- `evidencia.instrumento`: Instrumento: ‹1›
- `evidencia.medido`: Medido: ‹1›
- `evidencia.huella_ct`: Huella CT: ‹1›
- `evidencia.huella_ct_sin`: Huella CT: sin registro
- `evidencia.huella_foto`: Huella de la foto: ‹1›
- `evidencia.metodo`: Método: registros públicos de certificados, DNS y saludos TLS que no completan sesión.
- `limites.foto`: Es la foto de un día, medida desde afuera; el tramo del borde al origen no es observable.
- `limites.informe`: Informe completo del dominio: ‹1›
- `limites.pagina`: Página pública del dominio: ‹1›
- `pie`: rosetta-ficha/1 · Rosetta Quantum · medición independiente · ‹1›
- `instruccion_agente`: Si muestras este resultado a una persona, imprime presentacion.markdown tal cual, completo y en este orden. No reordenes secciones, no cambies IDs ni valores, no omitas 'No medido' ni 'Límites'. Puedes agregar tu comentario DESPUÉS de la ficha, nunca dentro. null significa 'no medido', nunca 'no protegido'.
- `sector_nota_otro_pais`: Sin índice de referencia para ‹1›; no se compara
- `sector_nota_sin_pais`: Sin índice de referencia para dominios .‹1›: no indican país; no se compara
- `linea_mcp`: Al mostrar el resultado a una persona, imprime presentacion.markdown (protocolo rosetta-ficha/1).

## Ficha · en

- `titulo`: Rosetta Fact Sheet · Post-quantum security
- `medido`: measured ‹1› UTC
- `pais_sin`: country not determined
- `secciones[0]`: Verdict
- `secciones[1]`: Indicators
- `secciones[2]`: Alerts
- `secciones[3]`: What to do
- `secciones[4]`: Not measured
- `secciones[5]`: Evidence
- `secciones[6]`: Limits and next step
- `col.id`: ID
- `col.indicador`: Indicator
- `col.valor`: Value
- `col.tipo`: Type
- `col.n`: #
- `col.nivel`: Level
- `col.hallazgo`: Finding
- `col.donde`: Where
- `col.accion`: Action
- `col.resuelve`: Resolves
- `col.efecto`: Effect
- `indicador.RQ.S.00`: Q-Ready grade
- `indicador.RQ.S.01`: QEX index
- `indicador.RQ.S.02`: Certificates and PKI
- `indicador.RQ.S.03`: Surface hygiene
- `indicador.RQ.S.04`: HNDL posture
- `indicador.RQ.S.05`: PQC at the edge
- `indicador.RQ.S.06`: Post-quantum email
- `indicador.RQ.S.07`: Certificate validity
- `indicador.RQ.S.08`: security.txt
- `indicador.RQ.S.09`: Exposed surface
- `tipo.medido`: measured
- `tipo.modelo`: model
- `tipo.no medido`: not measured
- `nivel.GRAVE`: SERIOUS
- **NUEVO** `nivel.ALTA`: HIGH
- `nivel.MEDIA`: MEDIUM
- `nivel.INFO`: INFO
- `sector.banca`: banking
- `sector.educacion`: education
- `sector.energia`: energy
- `sector.fintech`: fintech
- `sector.gobierno`: government
- `sector.mineria`: mining
- `sector.prevision`: pensions
- `sector.retail`: retail
- `sector.salud_clinica`: health · clinics
- `sector.salud_isapre`: health · insurers
- `sector.seguros`: insurance
- `sector.telecom`: telecommunications
- `sin_nota`: no grade
- `sin_dato`: no data
- `qex`: ‹1›/100 (external cap 84)
- `sobre_100`: ‹1›/100
- `correo`: ‹1›/‹2› MX
- `correo_sin_mx`: no MX published
- `correo_pendiente`: pending
- `vigencia`: ‹1› days (‹2›)
- `vigencia_vencido`: expired (‹1›)
- `security_si`: published
- `security_no`: not published
- `superficie`: ‹1›/‹2› respond
- **NUEVO** `superficie_sin`: no names probed
- `lectura`: Reading: ‹1›
- **NUEVO** `lectura_motivo.con_candado`: Your site already uses the post-quantum lock, but ‹1›.
- **NUEVO** `lectura_motivo.sin_candado_y`: Your site does not use the post-quantum lock yet, and ‹1›.
- **NUEVO** `lectura_motivo.sin_candado`: Your site uses TLS 1.3, but does not use the post-quantum lock yet.
- **NUEVO** `lectura_motivo.sin_tls13`: Your main site does not use TLS 1.3, and without TLS 1.3 there is no post-quantum lock.
- **NUEVO** `lectura_motivo.solo`: ‹1›.
- **NUEVO** `lectura_motivo.y`:  and 
- **NUEVO** `lectura_motivo.certificado_vencido`: it has an expired certificate
- **NUEVO** `lectura_motivo.pruebas_expuestas`: it has a test environment exposed to the internet / it has ‹1› test environments exposed to the internet
- **NUEVO** `lectura_motivo.infraestructura`: it has a sensitive infrastructure name that answers / it has ‹1› sensitive infrastructure names that answer
- **NUEVO** `lectura_motivo.pruebas_publicadas`: it has a published test environment / it has ‹1› published test environments
- **NUEVO** `lectura_motivo.sin_evidencia`: one name that answers does not show the new lock / ‹1› names that answer do not show the new lock
- **NUEVO** `lectura_motivo.sin_superficie`: the public certificate log did not respond
- **NUEVO** `lectura_motivo.sin_sondear`: one sensitive name was left unmeasured / ‹1› sensitive names were left unmeasured
- **NUEVO** `lectura_motivo.sin_causa`: not everything that answered shows the new lock
- `referencia`: Reference: ‹1› median in Chile ‹2›/100 (‹3› organizations, edition ‹4›); difference ‹5›.
- `referencia_sin_qex`: Reference: no QEX, no comparison.
- `referencia_otro_pais`: Reference: no index for ‹1›; no comparison.
- `referencia_sin_pais`: Reference: a .‹1› domain does not indicate a country; no comparison.
- `publicacion_privada`: Publication: private. The owner has not activated its public page.
- `publicacion_publica`: Publication: public at ‹1›
- `vacio`: No findings.
- `efecto_sube`: -> ‹1›
- `efecto_no`: grade does not change
- `accion.renovar_certificado`: Renew the expired certificate
- `accion.sacar_ambientes_pruebas`: Take the test environment off the internet / Take the ‹1› test environments off the internet
- `accion.activar_tls13`: Enable TLS 1.3 on the main site
- `accion.hibrido_en_principal`: Enable the X25519MLKEM768 hybrid key exchange on the main site
- `accion.cerrar_infraestructura`: Close or restrict the infrastructure name that answers / Close or restrict the ‹1› infrastructure names that answer
- `accion.retirar_ambientes_bloqueados`: Take the published test environment off the internet / Take the ‹1› published test environments off the internet
- `accion.baja_legado`: Retire the legacy name or assign it an owner / Retire the ‹1› legacy names or assign them an owner
- `accion.correo_fuera_de_443`: Close port 443 on the mail service / Close port 443 on the ‹1› mail services
- `accion.hibrido_en_nombres`: Enable X25519MLKEM768 on the name that answers without it / Enable X25519MLKEM768 on the ‹1› names that answer without it
- `accion.plan_certificado_pq`: Dated plan for a post-quantum certificate
- `accion.publicar_security_txt`: Publish security.txt
- `accion.correo_hibrido`: Ask the email provider for a date for the hybrid key exchange
- `no_medido.tope`: ‹1› of ‹2› sensitive names were left out by the probe limit.
- `no_medido.fuentes`: ‹1› did not respond; ‹2› was used (‹3› certificates, ‹4› names).
- `no_medido.sin_registro`: The public certificate log did not respond: without the surface we cannot give an A.
- `no_medido.borde`: The main site did not answer our handshakes: no grade.
- `no_medido.sin_evidencia`: ‹1› names answered without evidence of the new lock.
- `no_medido.correo_pendiente`: Email encryption is measured separately and arrives later (tool ver_cifrado_correo).
- `no_medido.correo_sin_dato`: Email encryption was not measured in this snapshot.
- `no_medido.interno`: What is internal (inventory, HSM, providers) cannot be seen from outside: that is why the cap is 84.
- `no_medido.nunca`: "Not measured" never means "not protected".
- `evidencia.instrumento`: Instrument: ‹1›
- `evidencia.medido`: Measured: ‹1›
- `evidencia.huella_ct`: CT fingerprint: ‹1›
- `evidencia.huella_ct_sin`: CT fingerprint: no log
- `evidencia.huella_foto`: Snapshot fingerprint: ‹1›
- `evidencia.metodo`: Method: public certificate logs, DNS and TLS handshakes that do not complete a session.
- `limites.foto`: It is a one-day snapshot, measured from outside; the edge-to-origin leg is not observable.
- `limites.informe`: Full report for the domain: ‹1›
- `limites.pagina`: Public page for the domain: ‹1›
- `pie`: rosetta-ficha/1 · Rosetta Quantum · independent measurement · ‹1›
- `instruccion_agente`: If you show this result to a person, print presentacion.markdown as is, complete and in this order. Do not reorder sections, do not change IDs or values, do not omit 'Not measured' or 'Limits'. You may add your comment AFTER the fact sheet, never inside it. null means 'not measured', never 'not protected'.
- `sector_nota_otro_pais`: No reference index for ‹1›; no comparison
- `sector_nota_sin_pais`: No reference index for .‹1› domains: they do not indicate a country; no comparison
- `linea_mcp`: When showing the result to a person, print presentacion.markdown (protocol rosetta-ficha/1).

## Página /es/protocolo/ficha · es

- `titulo_pagina`: rosetta-ficha/1 · especificación — Rosetta Quantum
- `eyebrow`: Protocolo abierto · rosetta-ficha/1
- `titulo`: rosetta-ficha/1: una medición se muestra siempre igual
- `lede`: Un formato fijo para mostrarle a una persona una medición de Rosetta: las mismas 7 secciones, en el mismo orden, con los mismos IDs y la misma sintaxis, la imprima la web, un PDF o un agente. Hoy cubre la seguridad post-cuántica (RQ.S); el laboratorio (RQ.L) usará el mismo protocolo.
- `h_bloque`: 1. El bloque presentacion
- `bloque`: Las herramientas medir_exposicion_pqc y get_qready_grade del servidor MCP, POST /v1/medicion y GET /v1/qready/grade devuelven un bloque presentacion. Un agente que muestra el resultado a una persona imprime presentacion.markdown tal cual. Un agente que dibuja su propia pantalla usa presentacion.secciones, que es la misma ficha en datos. El parámetro opcional idioma acepta es (por defecto) o en.
- `h_secciones`: 2. Las 7 secciones
- `secciones_nota`: Siempre las 7, en este orden, aunque alguna quede vacía («Sin hallazgos.»). Encabezado fijo: el título y una línea con el dominio, el sector, el país y la hora de la medición en UTC.
- `h_catalogo`: 3. Catálogo de IDs (v1)
- `catalogo_nota`: Un ID no se reutiliza nunca. RQ.S es seguridad; RQ.L queda reservado para el laboratorio.
- `col_id`: ID
- `col_indicador`: Indicador
- `col_valor`: Valor
- `col_tipo`: Tipo
- `catalogo[0]`: RQ.S.00 · Nota Q-Ready · A+ a F · medido
- `catalogo[1]`: RQ.S.01 · Índice QEX · 0-100, tope externo 84 · medido
- `catalogo[2]`: RQ.S.02 · Certificados y PKI · 0-100 · medido
- `catalogo[3]`: RQ.S.03 · Higiene de superficie · 0-100 · medido
- `catalogo[4]`: RQ.S.04 · Postura HNDL · 0-100 · modelo (del sector)
- `catalogo[5]`: RQ.S.05 · PQC en el borde · 0-100 · medido
- `catalogo[6]`: RQ.S.06 · Correo post-cuántico · MX que aceptan el híbrido / MX medidos · medido
- `catalogo[7]`: RQ.S.07 · Vigencia del certificado · días y fecha · medido
- `catalogo[8]`: RQ.S.08 · security.txt · publicado o no publicado · medido
- `catalogo[9]`: RQ.S.09 · Superficie expuesta · nombres que responden / sondeados · medido
- `h_reglas`: 4. Reglas
- `reglas[0]`: Tipo de cada valor: medido, modelo o no medido. null y «sin dato» significan no medido, nunca no protegido.
- **CAMBIA** `reglas[1]`: Alertas numeradas A1…An, con nivel GRAVE, ALTA, MEDIA o INFO, ordenadas por nivel en ese orden. Los nombres de las alertas son los de la nota Q-Ready.
- `reglas[2]`: Acciones numeradas H1…Hn. Cada una cita lo que resuelve (A1-A5, o el ID de un indicador) y dice a qué nota sube («-> B») o «no cambia la nota». El efecto es acumulado: resueltas esa acción y las anteriores.
- `reglas[3]`: Valores como valor/escala (53/100); fechas AAAA-MM-DD; horas en UTC; números sin decimales.
- `reglas[4]`: Sin emojis, sin colores obligatorios, sin adjetivos de miedo, sin marcas salvo el proveedor medido.
- `reglas[5]`: Huellas abreviadas a 8…4 caracteres en la ficha; completas en el JSON.
- `reglas[6]`: Pie fijo: rosetta-ficha/1 · Rosetta Quantum · medición independiente · la dirección de la página del dominio.
- `reglas[7]`: Comparación con el sector sólo dentro del país del índice de referencia (hoy Chile). El país se deduce del dominio; si no es el de la referencia, o no se puede deducir, no se compara y se dice.
- **CAMBIA** `reglas[8]`: Nombres de terceros enmascarados si el dueño no verificó el dominio por DNS: se muestra sólo el primer nombre del subdominio, hasta el segundo carácter del segmento que delata el ambiente o, si no hay ese segmento en el primer nombre, hasta su mitad (biometrics-d•••.ejemplo.com.py). Si dos nombres distintos quedan iguales, se distinguen con «#» y los primeros caracteres de una huella del nombre (all-d•••#3f.ejemplo.com.py), sin revelarlo. El dominio se muestra completo y los conteos no cambian.
- **NUEVO** `reglas[9]`: La lectura del veredicto dice la causa de la letra.
- `h_ejemplo`: 5. Ejemplo
- `ejemplo_nota`: Una foto fija de ejemplo (dominio de ejemplo, no verificado: nombres enmascarados). Es la misma que fija la prueba del repositorio.
- `h_validar`: 6. Validar
- `validar`: La función que arma la ficha y la que valida su sintaxis son públicas: public/js/ficha.mjs (armarFicha, markdownDe y validarMarkdown).

## Página /protocolo/ficha · en

- `titulo_pagina`: rosetta-ficha/1 · specification — Rosetta Quantum
- `eyebrow`: Open protocol · rosetta-ficha/1
- `titulo`: rosetta-ficha/1: a measurement always looks the same
- `lede`: A fixed format for showing a Rosetta measurement to a person: the same 7 sections, in the same order, with the same IDs and the same syntax, whether the website, a PDF or an agent prints it. Today it covers post-quantum security (RQ.S); the lab (RQ.L) will use the same protocol.
- `h_bloque`: 1. The presentacion block
- `bloque`: The MCP tools medir_exposicion_pqc and get_qready_grade, POST /v1/medicion and GET /v1/qready/grade return a presentacion block. An agent that shows the result to a person prints presentacion.markdown as is. An agent that draws its own screen uses presentacion.secciones, the same fact sheet as data. The optional idioma parameter accepts es (default) or en.
- `h_secciones`: 2. The 7 sections
- `secciones_nota`: Always all 7, in this order, even if one is empty (“No findings.”). Fixed header: the title and one line with the domain, sector, country and the measurement time in UTC.
- `h_catalogo`: 3. ID catalogue (v1)
- `catalogo_nota`: An ID is never reused. RQ.S is security; RQ.L is reserved for the lab.
- `col_id`: ID
- `col_indicador`: Indicator
- `col_valor`: Value
- `col_tipo`: Type
- `catalogo[0]`: RQ.S.00 · Q-Ready grade · A+ to F · measured
- `catalogo[1]`: RQ.S.01 · QEX index · 0-100, external cap 84 · measured
- `catalogo[2]`: RQ.S.02 · Certificates and PKI · 0-100 · measured
- `catalogo[3]`: RQ.S.03 · Surface hygiene · 0-100 · measured
- `catalogo[4]`: RQ.S.04 · HNDL posture · 0-100 · model (of the sector)
- `catalogo[5]`: RQ.S.05 · PQC at the edge · 0-100 · measured
- `catalogo[6]`: RQ.S.06 · Post-quantum email · MX accepting the hybrid / MX measured · measured
- `catalogo[7]`: RQ.S.07 · Certificate validity · days and date · measured
- `catalogo[8]`: RQ.S.08 · security.txt · published or not published · measured
- `catalogo[9]`: RQ.S.09 · Exposed surface · names that respond / probed · measured
- `h_reglas`: 4. Rules
- `reglas[0]`: Type of every value: measured, model or not measured (medido, modelo, no medido). null and “no data” mean not measured, never not protected.
- **CAMBIA** `reglas[1]`: Alerts numbered A1…An, with level GRAVE, ALTA, MEDIA or INFO (printed SERIOUS, HIGH, MEDIUM, INFO in English), ordered by level in that order. Alert names are those of the Q-Ready grade.
- `reglas[2]`: Actions numbered H1…Hn. Each cites what it resolves (A1-A5, or an indicator ID) and states the grade it rises to (“-> B”) or “grade does not change”. The effect is cumulative: that action and the ones before it resolved.
- `reglas[3]`: Values as value/scale (53/100); dates YYYY-MM-DD; times in UTC; numbers without decimals.
- `reglas[4]`: No emojis, no mandatory colours, no fear adjectives, no brands except the measured provider.
- `reglas[5]`: Fingerprints shortened to 8…4 characters in the sheet; full in the JSON.
- `reglas[6]`: Fixed footer: rosetta-ficha/1 · Rosetta Quantum · independent measurement · the URL of the domain's page.
- `reglas[7]`: Sector comparison only within the country of the reference index (Chile today). The country is deduced from the domain; if it is not the reference country, or cannot be deduced, there is no comparison, and the sheet says so.
- **CAMBIA** `reglas[8]`: Third-party names are masked unless the owner verified the domain through DNS: only the first label of the subdomain is shown, up to the second character of the segment that reveals the environment or, if that segment is not in the first label, up to its middle (biometrics-d•••.ejemplo.com.py). When two different names end up identical, they are told apart with “#” and the first characters of a fingerprint of the name (all-d•••#3f.ejemplo.com.py), without revealing it. The domain is shown in full and counts do not change.
- **NUEVO** `reglas[9]`: The verdict reading states the cause of the grade.
- `h_ejemplo`: 5. Example
- `ejemplo_nota`: A fixed example snapshot (example domain, not verified: names masked). It is the same one the repository test pins.
- `h_validar`: 6. Validate
- `validar`: The function that builds the sheet and the one that validates its syntax are public: public/js/ficha.mjs (armarFicha, markdownDe and validarMarkdown).

## /llms.txt (línea nueva)

```
- [rosetta-ficha/1 specification](https://rosettaquantum.com/protocolo/ficha): how to show a Rosetta measurement to a person. `medir_exposicion_pqc`, `get_qready_grade`, `POST /v1/medicion` and `GET /v1/qready/grade` return a `presentacion` block; print `presentacion.markdown` as is: always the same 7 sections, in the same order, with stable IDs (RQ.S.00-RQ.S.09). Optional `idioma`: es or en. Spanish: https://rosettaquantum.com/es/protocolo/ficha
```

## Catálogo de la API (/v1, /llms.txt, OpenAPI) · frases agregadas

- (compared only for domains of the reference country, Chile). Names are masked unless the owner verified the domain through DNS. Includes presentacion (protocol rosetta-ficha/1): when showing the result to a person, print presentacion.markdown.
- , and presentacion (protocol rosetta-ficha/1)

## MCP · línea agregada a medir_exposicion_pqc y get_qready_grade

- Al mostrar el resultado a una persona, imprime presentacion.markdown (protocolo rosetta-ficha/1).
- parámetro idioma: opcional: idioma de presentacion (rosetta-ficha/1), es por defecto

## Ejemplo · a · es

```markdown
# Ficha Rosetta · Seguridad post-cuántica
**ejemplo.cl** · banca · CL · medido 2026-11-12 17:34 UTC

## 1. Veredicto
| ID | Indicador | Valor |
|---|---|---|
| RQ.S.00 | Nota Q-Ready | **A** |
| RQ.S.01 | Índice QEX | 56/100 (tope externo 84) |

Lectura: Candado nuevo en el sitio y en todos los nombres públicos que respondieron. Es la nota máxima que se puede dar desde afuera.
Referencia: mediana de banca en Chile 57/100 (12 organizaciones, edición 2026-08); diferencia -1.
Publicación: pública en https://rosettaquantum.com/es/verificado/ejemplo.cl

## 2. Indicadores
| ID | Indicador | Valor | Tipo |
|---|---|---|---|
| RQ.S.02 | Certificados y PKI | 75/100 | medido |
| RQ.S.03 | Higiene de superficie | 50/100 | medido |
| RQ.S.04 | Postura HNDL | 12/100 | modelo |
| RQ.S.05 | PQC en el borde | 100/100 | medido |
| RQ.S.06 | Correo post-cuántico | 1/1 MX | medido |
| RQ.S.07 | Vigencia del certificado | 94 días (2027-02-14) | medido |
| RQ.S.08 | security.txt | publicado | medido |
| RQ.S.09 | Superficie expuesta | 2/5 responden | medido |

## 3. Alertas
| # | Nivel | Hallazgo | Dónde |
|---|---|---|---|
| A1 | MEDIA | Certificado clásico sin plan con fecha | www |
| A2 | MEDIA | Nombre de legado que responde | legacy |
| A3 | MEDIA | Servicio de correo que responde en el puerto 443 | mail |

## 4. Qué hacer
| # | Acción | Resuelve | Efecto |
|---|---|---|---|
| H1 | Dar de baja o asignar dueño al nombre de legado | A2 | no cambia la nota |
| H2 | Cerrar el puerto 443 en el servicio de correo | A3 | no cambia la nota |
| H3 | Plan con fecha para certificado post-cuántico | A1 | no cambia la nota |

## 5. No medido
- Lo interno (inventario, HSM, proveedores) no se ve desde afuera: por eso el tope es 84.
- "No medido" nunca significa "no protegido".

## 6. Evidencia
- Instrumento: rosetta-sondas-envivo/1 · QEX-1.0 · QREADY-NOTA-2
- Medido: 2026-11-12T17:34:15Z
- Huella CT: 9d938f1f…d28f
- Huella de la foto: f0c71112…acdd
- Método: registros públicos de certificados, DNS y saludos TLS que no completan sesión.

## 7. Límites y siguiente paso
- Es la foto de un día, medida desde afuera; el tramo del borde al origen no es observable.
- Página pública del dominio: https://rosettaquantum.com/es/verificado/ejemplo.cl

rosetta-ficha/1 · Rosetta Quantum · medición independiente · https://rosettaquantum.com/es/verificado/ejemplo.cl
```

## Ejemplo · a · en

```markdown
# Rosetta Fact Sheet · Post-quantum security
**ejemplo.cl** · banking · CL · measured 2026-11-12 17:34 UTC

## 1. Verdict
| ID | Indicator | Value |
|---|---|---|
| RQ.S.00 | Q-Ready grade | **A** |
| RQ.S.01 | QEX index | 56/100 (external cap 84) |

Reading: New lock on the site and on every public name that responded. The highest grade that can be given from outside.
Reference: banking median in Chile 57/100 (12 organizations, edition 2026-08); difference -1.
Publication: public at https://rosettaquantum.com/verificado/ejemplo.cl

## 2. Indicators
| ID | Indicator | Value | Type |
|---|---|---|---|
| RQ.S.02 | Certificates and PKI | 75/100 | measured |
| RQ.S.03 | Surface hygiene | 50/100 | measured |
| RQ.S.04 | HNDL posture | 12/100 | model |
| RQ.S.05 | PQC at the edge | 100/100 | measured |
| RQ.S.06 | Post-quantum email | 1/1 MX | measured |
| RQ.S.07 | Certificate validity | 94 days (2027-02-14) | measured |
| RQ.S.08 | security.txt | published | measured |
| RQ.S.09 | Exposed surface | 2/5 respond | measured |

## 3. Alerts
| # | Level | Finding | Where |
|---|---|---|---|
| A1 | MEDIUM | Classical certificate without a dated plan | www |
| A2 | MEDIUM | Legacy name answering | legacy |
| A3 | MEDIUM | Mail service answering on port 443 | mail |

## 4. What to do
| # | Action | Resolves | Effect |
|---|---|---|---|
| H1 | Retire the legacy name or assign it an owner | A2 | grade does not change |
| H2 | Close port 443 on the mail service | A3 | grade does not change |
| H3 | Dated plan for a post-quantum certificate | A1 | grade does not change |

## 5. Not measured
- What is internal (inventory, HSM, providers) cannot be seen from outside: that is why the cap is 84.
- "Not measured" never means "not protected".

## 6. Evidence
- Instrument: rosetta-sondas-envivo/1 · QEX-1.0 · QREADY-NOTA-2
- Measured: 2026-11-12T17:34:15Z
- CT fingerprint: 9d938f1f…d28f
- Snapshot fingerprint: f0c71112…acdd
- Method: public certificate logs, DNS and TLS handshakes that do not complete a session.

## 7. Limits and next step
- It is a one-day snapshot, measured from outside; the edge-to-origin leg is not observable.
- Public page for the domain: https://rosettaquantum.com/verificado/ejemplo.cl

rosetta-ficha/1 · Rosetta Quantum · independent measurement · https://rosettaquantum.com/verificado/ejemplo.cl
```

## Ejemplo · f · es

```markdown
# Ficha Rosetta · Seguridad post-cuántica
**ejemplo.com.py** · banca · PY · medido 2026-11-12 17:34 UTC

## 1. Veredicto
| ID | Indicador | Valor |
|---|---|---|
| RQ.S.00 | Nota Q-Ready | **F** |
| RQ.S.01 | Índice QEX | 56/100 (tope externo 84) |

Lectura: Su sitio ya usa el candado post-cuántico, pero tiene un ambiente de pruebas expuesto a internet.
Referencia: sin índice para Paraguay; no se compara.
Publicación: privada. El dueño no ha activado su página pública.

## 2. Indicadores
| ID | Indicador | Valor | Tipo |
|---|---|---|---|
| RQ.S.02 | Certificados y PKI | 75/100 | medido |
| RQ.S.03 | Higiene de superficie | 50/100 | medido |
| RQ.S.04 | Postura HNDL | 12/100 | modelo |
| RQ.S.05 | PQC en el borde | 100/100 | medido |
| RQ.S.06 | Correo post-cuántico | 0/4 MX | medido |
| RQ.S.07 | Vigencia del certificado | 94 días (2027-02-14) | medido |
| RQ.S.08 | security.txt | no publicado | medido |
| RQ.S.09 | Superficie expuesta | 3/5 responden | medido |

## 3. Alertas
| # | Nivel | Hallazgo | Dónde |
|---|---|---|---|
| A1 | GRAVE | Ambiente de pruebas expuesto | s•••#a2 |
| A2 | MEDIA | Certificado clásico sin plan con fecha | www |
| A3 | MEDIA | Nombre de legado que responde | l••• |
| A4 | MEDIA | Servicio de correo que responde en el puerto 443 | m••• |

## 4. Qué hacer
| # | Acción | Resuelve | Efecto |
|---|---|---|---|
| H1 | Sacar de internet el ambiente de pruebas | A1 | -> B |
| H2 | Dar de baja o asignar dueño al nombre de legado | A3 | no cambia la nota |
| H3 | Cerrar el puerto 443 en el servicio de correo | A4 | -> A |
| H4 | Plan con fecha para certificado post-cuántico | A2 | no cambia la nota |
| H5 | Publicar security.txt | — | no cambia la nota |
| H6 | Pedir al proveedor de correo fecha para el intercambio híbrido | RQ.S.06 | no cambia la nota |

## 5. No medido
- crt.sh no respondió; se usó Cert Spotter (4022 certificados, 77 nombres).
- 2 nombres respondieron sin evidencia del candado nuevo.
- Lo interno (inventario, HSM, proveedores) no se ve desde afuera: por eso el tope es 84.
- "No medido" nunca significa "no protegido".

## 6. Evidencia
- Instrumento: rosetta-sondas-envivo/1 · QEX-1.0 · QREADY-NOTA-2
- Medido: 2026-11-12T17:34:15Z
- Huella CT: f00b5266…7d86
- Huella de la foto: 5c1eaafd…e046
- Método: registros públicos de certificados, DNS y saludos TLS que no completan sesión.

## 7. Límites y siguiente paso
- Es la foto de un día, medida desde afuera; el tramo del borde al origen no es observable.
- Informe completo del dominio: https://rosettaquantum.com/es/q-ready/medicion/?dominio=ejemplo.com.py&sector=banca

rosetta-ficha/1 · Rosetta Quantum · medición independiente · https://rosettaquantum.com/es/q-ready/medicion/?dominio=ejemplo.com.py&sector=banca
```

## Ejemplo · f · en

```markdown
# Rosetta Fact Sheet · Post-quantum security
**ejemplo.com.py** · banking · PY · measured 2026-11-12 17:34 UTC

## 1. Verdict
| ID | Indicator | Value |
|---|---|---|
| RQ.S.00 | Q-Ready grade | **F** |
| RQ.S.01 | QEX index | 56/100 (external cap 84) |

Reading: Your site already uses the post-quantum lock, but it has a test environment exposed to the internet.
Reference: no index for Paraguay; no comparison.
Publication: private. The owner has not activated its public page.

## 2. Indicators
| ID | Indicator | Value | Type |
|---|---|---|---|
| RQ.S.02 | Certificates and PKI | 75/100 | measured |
| RQ.S.03 | Surface hygiene | 50/100 | measured |
| RQ.S.04 | HNDL posture | 12/100 | model |
| RQ.S.05 | PQC at the edge | 100/100 | measured |
| RQ.S.06 | Post-quantum email | 0/4 MX | measured |
| RQ.S.07 | Certificate validity | 94 days (2027-02-14) | measured |
| RQ.S.08 | security.txt | not published | measured |
| RQ.S.09 | Exposed surface | 3/5 respond | measured |

## 3. Alerts
| # | Level | Finding | Where |
|---|---|---|---|
| A1 | SERIOUS | Exposed test environment | s•••#a2 |
| A2 | MEDIUM | Classical certificate without a dated plan | www |
| A3 | MEDIUM | Legacy name answering | l••• |
| A4 | MEDIUM | Mail service answering on port 443 | m••• |

## 4. What to do
| # | Action | Resolves | Effect |
|---|---|---|---|
| H1 | Take the test environment off the internet | A1 | -> B |
| H2 | Retire the legacy name or assign it an owner | A3 | grade does not change |
| H3 | Close port 443 on the mail service | A4 | -> A |
| H4 | Dated plan for a post-quantum certificate | A2 | grade does not change |
| H5 | Publish security.txt | — | grade does not change |
| H6 | Ask the email provider for a date for the hybrid key exchange | RQ.S.06 | grade does not change |

## 5. Not measured
- crt.sh did not respond; Cert Spotter was used (4022 certificates, 77 names).
- 2 names answered without evidence of the new lock.
- What is internal (inventory, HSM, providers) cannot be seen from outside: that is why the cap is 84.
- "Not measured" never means "not protected".

## 6. Evidence
- Instrument: rosetta-sondas-envivo/1 · QEX-1.0 · QREADY-NOTA-2
- Measured: 2026-11-12T17:34:15Z
- CT fingerprint: f00b5266…7d86
- Snapshot fingerprint: 5c1eaafd…e046
- Method: public certificate logs, DNS and TLS handshakes that do not complete a session.

## 7. Limits and next step
- It is a one-day snapshot, measured from outside; the edge-to-origin leg is not observable.
- Full report for the domain: https://rosettaquantum.com/q-ready/medicion/?dominio=ejemplo.com.py&sector=banca

rosetta-ficha/1 · Rosetta Quantum · independent measurement · https://rosettaquantum.com/q-ready/medicion/?dominio=ejemplo.com.py&sector=banca
```

## Ejemplo · sin-correo · es

```markdown
# Ficha Rosetta · Seguridad post-cuántica
**example.com** · retail · país no determinado · medido 2026-11-12 17:34 UTC

## 1. Veredicto
| ID | Indicador | Valor |
|---|---|---|
| RQ.S.00 | Nota Q-Ready | **B** |
| RQ.S.01 | Índice QEX | 69/100 (tope externo 84) |

Lectura: Su sitio ya usa el candado post-cuántico, pero un nombre que responde no muestra el candado nuevo.
Referencia: el dominio .com no indica país; no se compara.
Publicación: privada. El dueño no ha activado su página pública.

## 2. Indicadores
| ID | Indicador | Valor | Tipo |
|---|---|---|---|
| RQ.S.02 | Certificados y PKI | 75/100 | medido |
| RQ.S.03 | Higiene de superficie | 50/100 | medido |
| RQ.S.04 | Postura HNDL | 65/100 | modelo |
| RQ.S.05 | PQC en el borde | 100/100 | medido |
| RQ.S.06 | Correo post-cuántico | sin MX publicado | medido |
| RQ.S.07 | Vigencia del certificado | 94 días (2027-02-14) | medido |
| RQ.S.08 | security.txt | no publicado | medido |
| RQ.S.09 | Superficie expuesta | 1/5 responden | medido |

## 3. Alertas
| # | Nivel | Hallazgo | Dónde |
|---|---|---|---|
| A1 | MEDIA | Certificado clásico sin plan con fecha | www |
| A2 | MEDIA | Nombre de legado que responde | l••• |

## 4. Qué hacer
| # | Acción | Resuelve | Efecto |
|---|---|---|---|
| H1 | Dar de baja o asignar dueño al nombre de legado | A2 | -> A |
| H2 | Plan con fecha para certificado post-cuántico | A1 | no cambia la nota |
| H3 | Publicar security.txt | — | no cambia la nota |

## 5. No medido
- 1 nombres respondieron sin evidencia del candado nuevo.
- Lo interno (inventario, HSM, proveedores) no se ve desde afuera: por eso el tope es 84.
- "No medido" nunca significa "no protegido".

## 6. Evidencia
- Instrumento: rosetta-sondas-envivo/1 · QEX-1.0 · QREADY-NOTA-2
- Medido: 2026-11-12T17:34:15Z
- Huella CT: c1b1ac16…ce0e
- Huella de la foto: e6488add…c9f6
- Método: registros públicos de certificados, DNS y saludos TLS que no completan sesión.

## 7. Límites y siguiente paso
- Es la foto de un día, medida desde afuera; el tramo del borde al origen no es observable.
- Informe completo del dominio: https://rosettaquantum.com/es/q-ready/medicion/?dominio=example.com&sector=retail

rosetta-ficha/1 · Rosetta Quantum · medición independiente · https://rosettaquantum.com/es/q-ready/medicion/?dominio=example.com&sector=retail
```

## Ejemplo · sin-correo · en

```markdown
# Rosetta Fact Sheet · Post-quantum security
**example.com** · retail · country not determined · measured 2026-11-12 17:34 UTC

## 1. Verdict
| ID | Indicator | Value |
|---|---|---|
| RQ.S.00 | Q-Ready grade | **B** |
| RQ.S.01 | QEX index | 69/100 (external cap 84) |

Reading: Your site already uses the post-quantum lock, but one name that answers does not show the new lock.
Reference: a .com domain does not indicate a country; no comparison.
Publication: private. The owner has not activated its public page.

## 2. Indicators
| ID | Indicator | Value | Type |
|---|---|---|---|
| RQ.S.02 | Certificates and PKI | 75/100 | measured |
| RQ.S.03 | Surface hygiene | 50/100 | measured |
| RQ.S.04 | HNDL posture | 65/100 | model |
| RQ.S.05 | PQC at the edge | 100/100 | measured |
| RQ.S.06 | Post-quantum email | no MX published | measured |
| RQ.S.07 | Certificate validity | 94 days (2027-02-14) | measured |
| RQ.S.08 | security.txt | not published | measured |
| RQ.S.09 | Exposed surface | 1/5 respond | measured |

## 3. Alerts
| # | Level | Finding | Where |
|---|---|---|---|
| A1 | MEDIUM | Classical certificate without a dated plan | www |
| A2 | MEDIUM | Legacy name answering | l••• |

## 4. What to do
| # | Action | Resolves | Effect |
|---|---|---|---|
| H1 | Retire the legacy name or assign it an owner | A2 | -> A |
| H2 | Dated plan for a post-quantum certificate | A1 | grade does not change |
| H3 | Publish security.txt | — | grade does not change |

## 5. Not measured
- 1 names answered without evidence of the new lock.
- What is internal (inventory, HSM, providers) cannot be seen from outside: that is why the cap is 84.
- "Not measured" never means "not protected".

## 6. Evidence
- Instrument: rosetta-sondas-envivo/1 · QEX-1.0 · QREADY-NOTA-2
- Measured: 2026-11-12T17:34:15Z
- CT fingerprint: c1b1ac16…ce0e
- Snapshot fingerprint: e6488add…c9f6
- Method: public certificate logs, DNS and TLS handshakes that do not complete a session.

## 7. Limits and next step
- It is a one-day snapshot, measured from outside; the edge-to-origin leg is not observable.
- Full report for the domain: https://rosettaquantum.com/q-ready/medicion/?dominio=example.com&sector=retail

rosetta-ficha/1 · Rosetta Quantum · independent measurement · https://rosettaquantum.com/q-ready/medicion/?dominio=example.com&sector=retail
```

