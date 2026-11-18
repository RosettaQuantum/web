# rosetta-ficha/1 · textos provisorios para aprobar

Generado por `node scripts/textos-ficha.mjs` desde el código (public/js/qready-textos.mjs, src/pages/llms.txt.ts). Lo que se apruebe aquí es literalmente lo que se sirve.

**Quinta vuelta (17-nov): subíndices QEX v1.** Marcado **NUEVO**: el árbol de puntos de la sección 02 (`arbol.*`), la higiene escrita sobre 70 (`sobre`), las filas nuevas del catálogo y la regla 12 de la spec. RQ.S.04.1 a .3 van «sin dato»: el modelo HNDL publica sólo el valor del sector, no los años ni el margen de Mosca.

**Estado anterior (17-nov): APROBADO por Nicholas** (textos y QREADY-NOTA-2.1), con tres arreglos: (1) este documento mostraba «undefined» y «NaN» en `referencia` y `no_medido.correo_mx` (defecto del generador, no de la ficha: ahora se muestran con datos de ejemplo); (2) `accion.baja_legado` decía «a el nombre» (**CAMBIA**); (3) un guardia falla si una ficha renderizada (es/en, markdown y HTML) o este documento dicen «undefined», «NaN» o «null».

**Integrado de main (7786413, PROVISORIO allá):** la alerta `ambiente_pruebas_publicado` («Ambiente de pruebas publicado en internet» / «Test environment published on the internet»), media con techo B, y su acción `retirar_ambientes_publicados` (**NUEVO**, mismo texto que la del ambiente bloqueado).

Reusados sin cambio (ya aprobados): los nombres de las alertas (`TXT.alerta`) y la lectura de cada letra (`TXT.nota_lectura`). El encabezado, el pie y las líneas fijas de «No medido», «Evidencia» y «Límites» vienen del ejemplo canónico del encargo del 13-nov.

## Ficha · es

- `titulo`: Ficha Rosetta · Seguridad post-cuántica
- `medido`: medido ‹1› UTC
- `pais_sin`: país no determinado
- **NUEVO** `pais_declarado`: ‹1› (país declarado)
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
- `col.efecto`: Efecto en la nota
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
- `indicador.RQ.S.13`: Nombres observados en el registro público
- `tipo.medido`: medido
- `tipo.modelo`: modelo
- `tipo.no medido`: no medido
- `nivel.GRAVE`: GRAVE
- `nivel.ALTA`: ALTA
- `nivel.MEDIA`: MEDIA
- `nivel.INFO`: INFO
- `sector.banca`: Banca
- `sector.educacion`: Educación
- `sector.energia`: Energía
- `sector.fintech`: Fintech
- `sector.gobierno`: Gobierno
- `sector.mineria`: Minería
- `sector.prevision`: Previsión
- `sector.retail`: Retail
- `sector.salud_clinica`: Salud · clínicas
- `sector.salud_isapre`: Salud · isapres
- `sector.seguros`: Seguros
- `sector.telecom`: Telecomunicaciones
- `kicker`: Seguridad post-cuántica
- `desde_afuera`: desde afuera, sin instalar nada
- `escala`: escala A+ a F
- `tope_externo`: tope externo 84
- `leyenda`: medido: observado hoy por la sonda · modelo: valor del sector, no medido en el dominio · no medido nunca significa no protegido
- `sin_nota`: sin nota
- `sin_dato`: sin dato
- `qex`: ‹1›/100 (tope externo 84)
- `sobre_100`: ‹1›/100
- **NUEVO** `sobre`: ‹1›/‹2›
- `correo`: ‹1›/‹2› MX
- `correo_sin_mx`: sin MX publicado
- **NUEVO** `arbol.col.id`: ID
- **NUEVO** `arbol.col.regla`: Regla
- **NUEVO** `arbol.col.dimension`: Dimensión
- **NUEVO** `arbol.col.qex`: QEX
- **NUEVO** `arbol.informativo`: ‹1› (informativo)
- **NUEVO** `arbol.llave_minimo`: ‹1› = mínimo vigente
- **NUEVO** `arbol.llave_supera`: ‹1› supera el mínimo vigente
- **NUEVO** `arbol.llave_aprobada`: ‹1› = llave clásica aprobada hasta 2030 (‹2› bits)
- **NUEVO** `arbol.llave_bajo`: ‹1›: ‹2› bits, bajo lo aprobado
- **NUEVO** `arbol.llave_pq`: ‹1› = certificado post-cuántico
- **NUEVO** `arbol.sin_certificado`: certificado no leído
- **NUEVO** `arbol.vigencia`: vigencia: ‹1› días, hasta ‹2›
- **NUEVO** `arbol.plan_sin`: sin plan con fecha para certificado post-cuántico
- **NUEVO** `arbol.base`: base de la higiene (máximo 70)
- **NUEVO** `arbol.tls13_si`: TLS 1.3 en el sitio principal
- **NUEVO** `arbol.tls13_no`: sin TLS 1.3 en el sitio principal
- **NUEVO** `arbol.tls13_nm`: TLS 1.3 sin dato (no descuenta)
- **NUEVO** `arbol.no_productivos`: 1 nombre no productivo en el registro / ‹1› nombres no productivos en el registro
- **NUEVO** `arbol.infraestructura`: 1 nombre de infraestructura en el registro (resta desde 3) / ‹1› nombres de infraestructura en el registro (resta desde 3)
- **NUEVO** `arbol.legado`: 1 nombre de legado en el registro / ‹1› nombres de legado en el registro
- **NUEVO** `arbol.sin_registro`: sin registro de certificados (no descuenta)
- **NUEVO** `arbol.security_si`: security.txt publicado
- **NUEVO** `arbol.security_no`: security.txt no publicado
- **NUEVO** `arbol.security_nm`: security.txt sin dato
- **NUEVO** `arbol.hndl_modelo`: modelo del sector ‹1›
- **NUEVO** `arbol.hndl_secreto`: años que el dato del sector debe seguir secreto
- **NUEVO** `arbol.hndl_migrar`: años que toma migrar en el sector
- **NUEVO** `arbol.hndl_mosca`: margen de Mosca
- **NUEVO** `arbol.hndl_sin_dato`: sin dato
- **NUEVO** `arbol.borde_si`: soporta X25519MLKEM768
- **NUEVO** `arbol.borde_no`: no soporta X25519MLKEM768
- **NUEVO** `arbol.borde_nm`: borde sin medir
- **NUEVO** `arbol.elige_si`: lo elige por defecto
- **NUEVO** `arbol.elige_no`: no lo elige por defecto
- **NUEVO** `arbol.todos_si`: lo tiene en todos los nombres que responden
- **NUEVO** `arbol.todos_no`: no lo tiene en todos los nombres que responden
- **NUEVO** `arbol.peso`: peso ‹1›
- **NUEVO** `arbol.total`: suma de los aportes sobre peso ‹2›
- **NUEVO** `arbol.maximo`: Máximo alcanzable desde afuera: ‹1› → ‹2›.
- **NUEVO** `arbol.acciones`: Puntos por acción: ‹1›.
- **NUEVO** `arbol.acc_mldsa`: certificado ML-DSA +‹1›
- **NUEVO** `arbol.acc_tls13`: activar TLS 1.3 +‹1›
- **NUEVO** `arbol.acc_hibrido`: activar el híbrido +‹1›
- **NUEVO** `arbol.no_cuadra`: El desglose de puntos no cuadra con esta foto: se omite.
- `correo_pendiente`: pendiente
- `vigencia`: ‹1› días · ‹2›
- `vigencia_vencido`: vencido · ‹1›
- `security_si`: publicado
- `security_no`: no publicado
- `superficie`: ‹1›/‹2› sensibles responden
- `superficie_sin`: sin nombres sondeados
- `nombres_ct`: 1 nombre / ‹1› nombres
- `lectura`: Lectura: ‹1›
- `lectura_motivo.con_candado`: Su sitio ya usa el candado post-cuántico, pero ‹1›.
- `lectura_motivo.sin_candado_y`: Su sitio todavía no usa el candado post-cuántico y ‹1›.
- `lectura_motivo.sin_candado`: Su sitio usa TLS 1.3, pero todavía no usa el candado post-cuántico.
- `lectura_motivo.sin_tls13`: Su sitio principal no usa TLS 1.3, y sin TLS 1.3 no hay candado post-cuántico.
- `lectura_motivo.solo`: ‹1›.
- `lectura_motivo.y`:  y 
- `lectura_motivo.certificado_vencido`: tiene el certificado vencido
- `lectura_motivo.pruebas_expuestas`: tiene un ambiente de pruebas expuesto a internet / tiene ‹1› ambientes de prueba expuestos a internet
- `lectura_motivo.infraestructura`: tiene un nombre de infraestructura sensible que responde / tiene ‹1› nombres de infraestructura sensible que responden
- `lectura_motivo.pruebas_publicadas`: tiene un ambiente de pruebas publicado / tiene ‹1› ambientes de prueba publicados
- `lectura_motivo.sin_evidencia`: un nombre que responde no muestra el candado nuevo / ‹1› nombres que responden no muestran el candado nuevo
- `lectura_motivo.sin_superficie`: el registro público de certificados no respondió
- `lectura_motivo.sin_sondear`: un nombre sensible quedó sin medir / ‹1› nombres sensibles quedaron sin medir
- `lectura_motivo.sin_causa`: no todo lo que respondió muestra el candado nuevo
- `lectura_motivo.sin_dimension.certificados`: no se pudo leer su certificado
- `lectura_motivo.sin_dimension.higiene`: no se pudo medir la higiene de su superficie
- `lectura_motivo.sin_dimension.hndl`: falta el modelo del sector
- `lectura_motivo.sin_dimension.edge`: no se pudo medir su sitio
- `referencia`: Referencia: mediana fintech 71 (15 orgs, edición 2026-08). ejemplo.cl está 10 puntos abajo. / Referencia: mediana fintech 71 (15 orgs, edición 2026-08). ejemplo.cl está en la mediana. / Referencia: mediana fintech 71 (15 orgs, edición 2026-08). ejemplo.cl está 1 punto arriba.
- `referencia_sin_qex`: Referencia: sin QEX, no se compara.
- `referencia_otro_pais`: Referencia: sin índice para ‹1›; no se compara.
- `referencia_sin_pais`: Referencia: el dominio .‹1› no indica país; no se compara.
- `publicacion_privada`: Publicación: privada. El dueño no ha activado su página pública.
- `publicacion_publica`: Publicación: pública en ‹1›
- `vacio`: Sin hallazgos.
- `efecto_sube`: -> ‹1›
- `efecto_no`: no cambia
- `accion.renovar_certificado`: Renovar el certificado vencido
- `accion.sacar_ambientes_pruebas`: Sacar de internet ‹2› / Sacar de internet el ambiente de pruebas / Sacar de internet los ‹1› ambientes de prueba
- `accion.activar_tls13`: Activar TLS 1.3 en el sitio principal
- `accion.hibrido_en_principal`: Activar X25519MLKEM768 en ‹2›
- `accion.cerrar_infraestructura`: Cerrar o restringir por IP ‹2› / Cerrar o restringir por IP el nombre de infraestructura que responde / Cerrar o restringir por IP los ‹1› nombres de infraestructura que responden
- `accion.retirar_ambientes_bloqueados`: Retirar de internet ‹2› / Retirar de internet el ambiente de pruebas publicado / Retirar de internet los ‹1› ambientes de prueba publicados
- `accion.retirar_ambientes_publicados`: Retirar de internet ‹2› / Retirar de internet el ambiente de pruebas publicado / Retirar de internet los ‹1› ambientes de prueba publicados
- `accion.baja_legado`: Dar de baja o asignar dueño a ‹2› / Dar de baja o asignar dueño al nombre de legado / Dar de baja o asignar dueño a los ‹1› nombres de legado
- `accion.correo_fuera_de_443`: Cerrar el puerto 443 en ‹2› / Cerrar el puerto 443 en el servicio de correo / Cerrar el puerto 443 en los ‹1› servicios de correo
- `accion.hibrido_en_nombres`: Activar X25519MLKEM768 en ‹2› / Activar X25519MLKEM768 en el nombre que responde sin él / Activar X25519MLKEM768 en los ‹1› nombres que responden sin él
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
- **CAMBIA** `no_medido.hndl`: La postura HNDL es el modelo del sector ‹1›, no una medición del dominio: tabla por sector fijada en la edición ‹2›; la derivación no está publicada.
- `no_medido.dimension`: ‹1› no se pudo medir: sin esa dimensión la nota no puede ser A.
- `no_medido.correo_mx`: Uno de los 5 servidores de correo no se midió. / 2 de los 5 servidores de correo no se midieron.
- `no_medido.nunca`: No medido nunca significa no protegido.
- `evidencia.instrumento`: Instrumento: ‹1›
- `evidencia.versiones`: Versiones: ‹1›
- `evidencia.medido`: Medido: ‹1›
- `evidencia.huella_ct`: Huella CT: ‹1› · ‹2› cert.
- `evidencia.huella_ct_sin`: Huella CT: sin registro
- `evidencia.huella_foto`: Huella de la foto: ‹1›
- `evidencia.metodo`: Método: CT · DNS · saludos TLS sin sesión
- **NUEVO** `evidencia.rubrica`: Rúbrica: ‹1›
- `limites.foto`: Es la foto de un día, medida desde afuera; el tramo del borde al origen no es observable.
- `limites.informe`: Informe completo del dominio: ‹1›
- `limites.pagina`: Página pública del dominio: ‹1›
- `limites.hacia_a`: Con H1 hecho, la próxima medición debería dar A. / Con H1 a H‹1› hechos, la próxima medición debería dar A.
- `pie`: rosetta-ficha/1 · Rosetta Quantum · medición independiente
- `instruccion_agente`: Si muestras este resultado a una persona, imprime presentacion.markdown tal cual, completo y en este orden. No reordenes secciones, no cambies IDs ni valores, no omitas 'No medido' ni 'Límites'. Puedes agregar tu comentario DESPUÉS de la ficha, nunca dentro. null significa 'no medido', nunca 'no protegido'.
- `sector_nota_otro_pais`: Sin índice de referencia para ‹1›; no se compara
- `sector_nota_sin_pais`: Sin índice de referencia para dominios .‹1›: no indican país; no se compara
- `linea_mcp`: Al mostrar el resultado a una persona, imprime presentacion.markdown (protocolo rosetta-ficha/1).

## Ficha · en

- `titulo`: Rosetta Fact Sheet · Post-quantum security
- `medido`: measured ‹1› UTC
- `pais_sin`: country not determined
- **NUEVO** `pais_declarado`: ‹1› (declared country)
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
- `col.efecto`: Effect on the grade
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
- `indicador.RQ.S.13`: Names observed in the public log
- `tipo.medido`: measured
- `tipo.modelo`: model
- `tipo.no medido`: not measured
- `nivel.GRAVE`: SERIOUS
- `nivel.ALTA`: HIGH
- `nivel.MEDIA`: MEDIUM
- `nivel.INFO`: INFO
- `sector.banca`: Banking
- `sector.educacion`: Education
- `sector.energia`: Energy
- `sector.fintech`: Fintech
- `sector.gobierno`: Government
- `sector.mineria`: Mining
- `sector.prevision`: Pensions
- `sector.retail`: Retail
- `sector.salud_clinica`: Health · clinics
- `sector.salud_isapre`: Health · insurers
- `sector.seguros`: Insurance
- `sector.telecom`: Telecommunications
- `kicker`: Post-quantum security
- `desde_afuera`: from outside, nothing installed
- `escala`: scale A+ to F
- `tope_externo`: external cap 84
- `leyenda`: measured: observed today by the probe · model: sector value, not measured on the domain · not measured never means not protected
- `sin_nota`: no grade
- `sin_dato`: no data
- `qex`: ‹1›/100 (external cap 84)
- `sobre_100`: ‹1›/100
- **NUEVO** `sobre`: ‹1›/‹2›
- `correo`: ‹1›/‹2› MX
- `correo_sin_mx`: no MX published
- **NUEVO** `arbol.col.id`: ID
- **NUEVO** `arbol.col.regla`: Rule
- **NUEVO** `arbol.col.dimension`: Dimension
- **NUEVO** `arbol.col.qex`: QEX
- **NUEVO** `arbol.informativo`: ‹1› (for information)
- **NUEVO** `arbol.llave_minimo`: ‹1› = current minimum
- **NUEVO** `arbol.llave_supera`: ‹1› above the current minimum
- **NUEVO** `arbol.llave_aprobada`: ‹1› = classical key approved until 2030 (‹2› bits)
- **NUEVO** `arbol.llave_bajo`: ‹1›: ‹2› bits, below what is approved
- **NUEVO** `arbol.llave_pq`: ‹1› = post-quantum certificate
- **NUEVO** `arbol.sin_certificado`: certificate not read
- **NUEVO** `arbol.vigencia`: validity: ‹1› days, until ‹2›
- **NUEVO** `arbol.plan_sin`: no dated plan for a post-quantum certificate
- **NUEVO** `arbol.base`: hygiene base (maximum 70)
- **NUEVO** `arbol.tls13_si`: TLS 1.3 on the main site
- **NUEVO** `arbol.tls13_no`: no TLS 1.3 on the main site
- **NUEVO** `arbol.tls13_nm`: TLS 1.3 no data (no deduction)
- **NUEVO** `arbol.no_productivos`: 1 non-production name in the log / ‹1› non-production names in the log
- **NUEVO** `arbol.infraestructura`: 1 infrastructure name in the log (deducts from 3) / ‹1› infrastructure names in the log (deducts from 3)
- **NUEVO** `arbol.legado`: 1 legacy name in the log / ‹1› legacy names in the log
- **NUEVO** `arbol.sin_registro`: no certificate log (no deduction)
- **NUEVO** `arbol.security_si`: security.txt published
- **NUEVO** `arbol.security_no`: security.txt not published
- **NUEVO** `arbol.security_nm`: security.txt no data
- **NUEVO** `arbol.hndl_modelo`: ‹1› sector model
- **NUEVO** `arbol.hndl_secreto`: years the sector's data must stay secret
- **NUEVO** `arbol.hndl_migrar`: years the sector takes to migrate
- **NUEVO** `arbol.hndl_mosca`: Mosca margin
- **NUEVO** `arbol.hndl_sin_dato`: no data
- **NUEVO** `arbol.borde_si`: supports X25519MLKEM768
- **NUEVO** `arbol.borde_no`: does not support X25519MLKEM768
- **NUEVO** `arbol.borde_nm`: edge not measured
- **NUEVO** `arbol.elige_si`: chooses it by default
- **NUEVO** `arbol.elige_no`: does not choose it by default
- **NUEVO** `arbol.todos_si`: has it on every name that answers
- **NUEVO** `arbol.todos_no`: does not have it on every name that answers
- **NUEVO** `arbol.peso`: weight ‹1›
- **NUEVO** `arbol.total`: sum of contributions over weight ‹2›
- **NUEVO** `arbol.maximo`: Highest reachable from outside: ‹1› → ‹2›.
- **NUEVO** `arbol.acciones`: Points per action: ‹1›.
- **NUEVO** `arbol.acc_mldsa`: ML-DSA certificate +‹1›
- **NUEVO** `arbol.acc_tls13`: enable TLS 1.3 +‹1›
- **NUEVO** `arbol.acc_hibrido`: enable the hybrid +‹1›
- **NUEVO** `arbol.no_cuadra`: The points breakdown does not add up for this snapshot: it is left out.
- `correo_pendiente`: pending
- `vigencia`: ‹1› days · ‹2›
- `vigencia_vencido`: expired · ‹1›
- `security_si`: published
- `security_no`: not published
- `superficie`: ‹1›/‹2› sensitive respond
- `superficie_sin`: no names probed
- `nombres_ct`: 1 name / ‹1› names
- `lectura`: Reading: ‹1›
- `lectura_motivo.con_candado`: Your site already uses the post-quantum lock, but ‹1›.
- `lectura_motivo.sin_candado_y`: Your site does not use the post-quantum lock yet, and ‹1›.
- `lectura_motivo.sin_candado`: Your site uses TLS 1.3, but does not use the post-quantum lock yet.
- `lectura_motivo.sin_tls13`: Your main site does not use TLS 1.3, and without TLS 1.3 there is no post-quantum lock.
- `lectura_motivo.solo`: ‹1›.
- `lectura_motivo.y`:  and 
- `lectura_motivo.certificado_vencido`: it has an expired certificate
- `lectura_motivo.pruebas_expuestas`: it has a test environment exposed to the internet / it has ‹1› test environments exposed to the internet
- `lectura_motivo.infraestructura`: it has a sensitive infrastructure name that answers / it has ‹1› sensitive infrastructure names that answer
- `lectura_motivo.pruebas_publicadas`: it has a published test environment / it has ‹1› published test environments
- `lectura_motivo.sin_evidencia`: one name that answers does not show the new lock / ‹1› names that answer do not show the new lock
- `lectura_motivo.sin_superficie`: the public certificate log did not respond
- `lectura_motivo.sin_sondear`: one sensitive name was left unmeasured / ‹1› sensitive names were left unmeasured
- `lectura_motivo.sin_causa`: not everything that answered shows the new lock
- `lectura_motivo.sin_dimension.certificados`: its certificate could not be read
- `lectura_motivo.sin_dimension.higiene`: its surface hygiene could not be measured
- `lectura_motivo.sin_dimension.hndl`: the sector model is missing
- `lectura_motivo.sin_dimension.edge`: its site could not be measured
- `referencia`: Reference: fintech median 71 (15 orgs, edition 2026-08). ejemplo.cl is 10 points below. / Reference: fintech median 71 (15 orgs, edition 2026-08). ejemplo.cl is at the median. / Reference: fintech median 71 (15 orgs, edition 2026-08). ejemplo.cl is 1 point above.
- `referencia_sin_qex`: Reference: no QEX, no comparison.
- `referencia_otro_pais`: Reference: no index for ‹1›; no comparison.
- `referencia_sin_pais`: Reference: a .‹1› domain does not indicate a country; no comparison.
- `publicacion_privada`: Publication: private. The owner has not activated its public page.
- `publicacion_publica`: Publication: public at ‹1›
- `vacio`: No findings.
- `efecto_sube`: -> ‹1›
- `efecto_no`: no change
- `accion.renovar_certificado`: Renew the expired certificate
- `accion.sacar_ambientes_pruebas`: Take ‹2› off the internet / Take the test environment off the internet / Take the ‹1› test environments off the internet
- `accion.activar_tls13`: Enable TLS 1.3 on the main site
- `accion.hibrido_en_principal`: Enable X25519MLKEM768 on ‹2›
- `accion.cerrar_infraestructura`: Close or IP-restrict ‹2› / Close or IP-restrict the infrastructure name that answers / Close or IP-restrict the ‹1› infrastructure names that answer
- `accion.retirar_ambientes_bloqueados`: Take ‹2› off the internet / Take the published test environment off the internet / Take the ‹1› published test environments off the internet
- `accion.retirar_ambientes_publicados`: Take ‹2› off the internet / Take the published test environment off the internet / Take the ‹1› published test environments off the internet
- `accion.baja_legado`: Retire ‹2› or assign it an owner / Retire the legacy name or assign it an owner / Retire the ‹1› legacy names or assign them an owner
- `accion.correo_fuera_de_443`: Close port 443 on ‹2› / Close port 443 on the mail service / Close port 443 on the ‹1› mail services
- `accion.hibrido_en_nombres`: Enable X25519MLKEM768 on ‹2› / Enable X25519MLKEM768 on the name that answers without it / Enable X25519MLKEM768 on the ‹1› names that answer without it
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
- **CAMBIA** `no_medido.hndl`: HNDL posture is the ‹1› sector model, not a measurement of the domain: a per-sector table fixed in the ‹2› edition; the derivation is not published.
- `no_medido.dimension`: ‹1› could not be measured: without that dimension the grade cannot be A.
- `no_medido.correo_mx`: One of the 5 mail servers was not measured. / 2 of the 5 mail servers were not measured.
- `no_medido.nunca`: Not measured never means not protected.
- `evidencia.instrumento`: Instrument: ‹1›
- `evidencia.versiones`: Versions: ‹1›
- `evidencia.medido`: Measured: ‹1›
- `evidencia.huella_ct`: CT fingerprint: ‹1› · ‹2› cert.
- `evidencia.huella_ct_sin`: CT fingerprint: no log
- `evidencia.huella_foto`: Snapshot fingerprint: ‹1›
- `evidencia.metodo`: Method: CT · DNS · TLS handshakes without a session
- **NUEVO** `evidencia.rubrica`: Rubric: ‹1›
- `limites.foto`: It is a one-day snapshot, measured from outside; the edge-to-origin leg is not observable.
- `limites.informe`: Full report for the domain: ‹1›
- `limites.pagina`: Public page for the domain: ‹1›
- `limites.hacia_a`: With H1 done, the next measurement should give A. / With H1 to H‹1› done, the next measurement should give A.
- `pie`: rosetta-ficha/1 · Rosetta Quantum · independent measurement
- `instruccion_agente`: If you show this result to a person, print presentacion.markdown as is, complete and in this order. Do not reorder sections, do not change IDs or values, do not omit 'Not measured' or 'Limits'. You may add your comment AFTER the fact sheet, never inside it. null means 'not measured', never 'not protected'.
- `sector_nota_otro_pais`: No reference index for ‹1›; no comparison
- `sector_nota_sin_pais`: No reference index for .‹1› domains: they do not indicate a country; no comparison
- `linea_mcp`: When showing the result to a person, print presentacion.markdown (protocol rosetta-ficha/1).

## Nota Q-Ready · texto nuevo de QREADY-NOTA-2.1 (pendiente)

- **NUEVO** `es falta.dimension_sin_medir`: Poder medir el certificado: sin esa medición no se da A. / Poder medir la superficie: sin esa medición no se da A.
- **NUEVO** `en falta.dimension_sin_medir`: Let us measure the certificate: without that measurement there is no A. / Let us measure the surface: without that measurement there is no A.

## Página /es/protocolo/ficha · es

- `titulo_pagina`: rosetta-ficha/1 · especificación — Rosetta Quantum
- `eyebrow`: Protocolo abierto · rosetta-ficha/1
- `titulo`: rosetta-ficha/1: una medición se muestra siempre igual
- `lede`: Un formato fijo para mostrarle a una persona una medición de Rosetta: las mismas 7 secciones, en el mismo orden, con los mismos IDs y la misma sintaxis, la imprima la web, un PDF o un agente. Hoy cubre la seguridad post-cuántica (RQ.S); el laboratorio (RQ.L) usará el mismo protocolo.
- `h_bloque`: 1. El bloque presentacion
- `bloque`: Las herramientas medir_exposicion_pqc y get_qready_grade del servidor MCP, POST /v1/medicion y GET /v1/qready/grade devuelven un bloque presentacion. Un agente que muestra el resultado a una persona imprime presentacion.markdown tal cual. Un agente que dibuja su propia pantalla usa presentacion.ficha, que es la misma ficha en datos: indicadores por ID (valor, unidad, texto, tipo y metodo), alertas A#, acciones H# (resuelve y efecto), no medido, evidencia y límites. La web, la página del sello y el PDF del informe salen de ese mismo bloque. El parámetro opcional idioma acepta es (por defecto) o en.
- `h_secciones`: 2. Las 7 secciones
- `secciones_nota`: Siempre las 7, en este orden, aunque alguna quede vacía («Sin hallazgos.»). Encabezado fijo: el título y una línea con el dominio, el sector, el país y la hora de la medición en UTC.
- `h_catalogo`: 3. Catálogo de IDs (v1)
- `catalogo_nota`: Un ID no se reutiliza nunca. RQ.S es seguridad; RQ.L queda reservado para el laboratorio. RQ.S.10 a RQ.S.12 están reservados y no se usan. RQ.S.13 va en el bloque estructurado; la ficha impresa no lo muestra.
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
- `catalogo[9]`: RQ.S.09 · Superficie expuesta · nombres que responden en 443 / sondeados · medido
- `catalogo[10]`: RQ.S.10 · Reservado (inventario) · — · —
- `catalogo[11]`: RQ.S.11 · Reservado (proveedores) · — · —
- `catalogo[12]`: RQ.S.12 · Reservado (gobierno) · — · —
- `catalogo[13]`: RQ.S.13 · Nombres observados en el registro público · conteo de nombres; no afirma que respondan · medido
- **NUEVO** `catalogo[14]`: RQ.S.02.1 · Fuerza de la llave · {regla_llave} · medido
- **NUEVO** `catalogo[15]`: RQ.S.02.2 / .3 · Vigencia; plan con fecha para certificado post-cuántico · informativos, 0 puntos · medido
- **NUEVO** `catalogo[16]`: RQ.S.03.1 a .4 · TLS 1.3 (−30); no productivos (−10); infraestructura, 3 o más (−10); legado (−10) · sobre una base de 70 · medido
- **NUEVO** `catalogo[17]`: RQ.S.03.5 · security.txt · informativo, 0 puntos · medido
- **CAMBIA** `catalogo[18]`: RQ.S.04.1 a .3 · Años de secreto del sector; años de migración; margen de Mosca · sin dato: tabla por sector fijada en la edición {edicion}; la derivación no está publicada · modelo
- **NUEVO** `catalogo[19]`: RQ.S.05.1 · Soporta el híbrido · 100 o 0 · medido
- **NUEVO** `catalogo[20]`: RQ.S.05.2 / .3 · Lo elige por defecto; lo tiene en todos los nombres · informativos, 0 puntos · medido
- `h_reglas`: 4. Reglas
- `reglas[0]`: Tipo de cada valor: medido, modelo o no medido. null y «sin dato» significan no medido, nunca no protegido.
- `reglas[1]`: Alertas numeradas A1…An, con nivel GRAVE, ALTA, MEDIA o INFO, ordenadas por nivel en ese orden. Los nombres de las alertas son los de la nota Q-Ready.
- `reglas[2]`: Acciones numeradas H1…Hn. Cada una cita lo que resuelve (A1-A5, o el ID de un indicador) y dice a qué nota sube («-> B») o «no cambia la nota». El efecto es acumulado: resueltas esa acción y las anteriores.
- `reglas[3]`: Valores como valor/escala (53/100); fechas AAAA-MM-DD; horas en UTC; números sin decimales.
- `reglas[4]`: Sin emojis, sin colores obligatorios, sin adjetivos de miedo, sin marcas salvo el proveedor medido.
- `reglas[5]`: Huellas abreviadas a 8…4 caracteres en la ficha; completas en el JSON.
- `reglas[6]`: Pie fijo: rosetta-ficha/1 · Rosetta Quantum · medición independiente · la dirección de la página del dominio.
- **CAMBIA** `reglas[7]`: Comparación con el sector sólo dentro del país del índice de referencia (hoy Chile). El país sale, en este orden, de la ficha de la organización que lleva Rosetta, del que declara quien consulta (parámetro pais; la ficha dice «país declarado») o del dominio. Si no es el de la referencia, o no se puede saber, no se compara y se dice.
- `reglas[8]`: Nombres de terceros enmascarados si el dueño no verificó el dominio por DNS: se muestra sólo el primer nombre del subdominio, hasta el segundo carácter del segmento que delata el ambiente o, si no hay ese segmento en el primer nombre, hasta su mitad (biometrics-d•••.ejemplo.com.py). Si dos nombres distintos quedan iguales, se distinguen con «#» y los primeros caracteres de una huella del nombre (all-d•••#3f.ejemplo.com.py), sin revelarlo. El dominio se muestra completo y los conteos no cambian.
- `reglas[9]`: La lectura del veredicto dice la causa de la letra.
- `reglas[10]`: El ID nombra el concepto; la versión dice cómo se midió. En el bloque estructurado cada valor declara su versión de método (metodo: por ejemplo QEX-1.0 en RQ.S.01 a RQ.S.05), para que un mismo ID nunca tenga dos definiciones sin decirlo.
- **NUEVO** `reglas[11]`: Subíndices QEX (RQ.S.0x.n): la sección 02 abre la aritmética del índice. Cada subíndice dice cuántos puntos pone o quita en su dimensión y cuántos puntos QEX son (puntos × peso). La base más los subíndices dan la dimensión, y la suma de los aportes da el QEX. La higiene se escribe sobre 70, su máximo. El correo (RQ.S.06) se muestra pero no suma al QEX.
- `h_ejemplo`: 5. Ejemplo
- `ejemplo_nota`: Una foto fija de ejemplo (dominio de ejemplo, no verificado: nombres enmascarados). Es la misma que fija la prueba del repositorio.
- `h_validar`: 6. Validar
- `validar`: La función que arma la ficha y la que valida su sintaxis son públicas: public/js/ficha.mjs (armarFicha, markdownDe y validarMarkdown).
- **NUEVO** `h_escala`: 7. La escala de la nota (RQ.S.00)
- **NUEVO** `escala_nota`: Se leen en orden: la primera que se cumple decide. Es la misma definición que usa la nota; un guardia exige que coincidan.
- **NUEVO** `col_nota`: Nota
- **NUEVO** `col_condicion`: Condición
- **NUEVO** `col_desde`: Rige desde
- **NUEVO** `rubrica`: Rúbrica completa: cada variable, su fuente, su regla de puntaje y su efecto en la nota

## Página /protocolo/ficha · en

- `titulo_pagina`: rosetta-ficha/1 · specification — Rosetta Quantum
- `eyebrow`: Open protocol · rosetta-ficha/1
- `titulo`: rosetta-ficha/1: a measurement always looks the same
- `lede`: A fixed format for showing a Rosetta measurement to a person: the same 7 sections, in the same order, with the same IDs and the same syntax, whether the website, a PDF or an agent prints it. Today it covers post-quantum security (RQ.S); the lab (RQ.L) will use the same protocol.
- `h_bloque`: 1. The presentacion block
- `bloque`: The MCP tools medir_exposicion_pqc and get_qready_grade, POST /v1/medicion and GET /v1/qready/grade return a presentacion block. An agent that shows the result to a person prints presentacion.markdown as is. An agent that draws its own screen uses presentacion.ficha, the same fact sheet as data: indicators by ID (value, unit, text, type and method), alerts A#, actions H# (resolves and effect), not measured, evidence and limits. The website, the badge page and the report PDF come from that same block. The optional idioma parameter accepts es (default) or en.
- `h_secciones`: 2. The 7 sections
- `secciones_nota`: Always all 7, in this order, even if one is empty (“No findings.”). Fixed header: the title and one line with the domain, sector, country and the measurement time in UTC.
- `h_catalogo`: 3. ID catalogue (v1)
- `catalogo_nota`: An ID is never reused. RQ.S is security; RQ.L is reserved for the lab. RQ.S.10 to RQ.S.12 are reserved and unused. RQ.S.13 is in the structured block; the printed sheet does not show it.
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
- `catalogo[9]`: RQ.S.09 · Exposed surface · names that respond on 443 / probed · measured
- `catalogo[10]`: RQ.S.10 · Reserved (inventory) · — · —
- `catalogo[11]`: RQ.S.11 · Reserved (providers) · — · —
- `catalogo[12]`: RQ.S.12 · Reserved (governance) · — · —
- `catalogo[13]`: RQ.S.13 · Names observed in the public log · count of names; does not claim they respond · measured
- **NUEVO** `catalogo[14]`: RQ.S.02.1 · Key strength · {regla_llave} · measured
- **NUEVO** `catalogo[15]`: RQ.S.02.2 / .3 · Validity; dated plan for a post-quantum certificate · for information, 0 points · measured
- **NUEVO** `catalogo[16]`: RQ.S.03.1 to .4 · TLS 1.3 (−30); non-production (−10); infrastructure, 3 or more (−10); legacy (−10) · on a base of 70 · measured
- **NUEVO** `catalogo[17]`: RQ.S.03.5 · security.txt · for information, 0 points · measured
- **CAMBIA** `catalogo[18]`: RQ.S.04.1 to .3 · Years of secrecy for the sector; years to migrate; Mosca margin · no data: a per-sector table fixed in the {edicion} edition; the derivation is not published · model
- **NUEVO** `catalogo[19]`: RQ.S.05.1 · Supports the hybrid · 100 or 0 · measured
- **NUEVO** `catalogo[20]`: RQ.S.05.2 / .3 · Chooses it by default; has it on every name · for information, 0 points · measured
- `h_reglas`: 4. Rules
- `reglas[0]`: Type of every value: measured, model or not measured (medido, modelo, no medido). null and “no data” mean not measured, never not protected.
- `reglas[1]`: Alerts numbered A1…An, with level GRAVE, ALTA, MEDIA or INFO (printed SERIOUS, HIGH, MEDIUM, INFO in English), ordered by level in that order. Alert names are those of the Q-Ready grade.
- `reglas[2]`: Actions numbered H1…Hn. Each cites what it resolves (A1-A5, or an indicator ID) and states the grade it rises to (“-> B”) or “grade does not change”. The effect is cumulative: that action and the ones before it resolved.
- `reglas[3]`: Values as value/scale (53/100); dates YYYY-MM-DD; times in UTC; numbers without decimals.
- `reglas[4]`: No emojis, no mandatory colours, no fear adjectives, no brands except the measured provider.
- `reglas[5]`: Fingerprints shortened to 8…4 characters in the sheet; full in the JSON.
- `reglas[6]`: Fixed footer: rosetta-ficha/1 · Rosetta Quantum · independent measurement · the URL of the domain's page.
- **CAMBIA** `reglas[7]`: Sector comparison only within the country of the reference index (Chile today). The country comes, in this order, from Rosetta's record of the organization, from the one declared by whoever asks (pais parameter; the sheet says “declared country”) or from the domain. If it is not the reference country, or cannot be known, there is no comparison, and the sheet says so.
- `reglas[8]`: Third-party names are masked unless the owner verified the domain through DNS: only the first label of the subdomain is shown, up to the second character of the segment that reveals the environment or, if that segment is not in the first label, up to its middle (biometrics-d•••.ejemplo.com.py). When two different names end up identical, they are told apart with “#” and the first characters of a fingerprint of the name (all-d•••#3f.ejemplo.com.py), without revealing it. The domain is shown in full and counts do not change.
- `reglas[9]`: The verdict reading states the cause of the grade.
- `reglas[10]`: The ID names the concept; the version says how it was measured. In the structured block every value declares its method version (metodo: for example QEX-1.0 in RQ.S.01 to RQ.S.05), so the same ID never carries two definitions without saying so.
- **NUEVO** `reglas[11]`: QEX sub-indices (RQ.S.0x.n): section 02 opens up the index arithmetic. Each sub-index states how many points it adds to or takes from its dimension and how many QEX points that is (points × weight). The base plus the sub-indices give the dimension, and the sum of contributions gives the QEX. Hygiene is written over 70, its maximum. Email (RQ.S.06) is shown but does not add to the QEX.
- `h_ejemplo`: 5. Example
- `ejemplo_nota`: A fixed example snapshot (example domain, not verified: names masked). It is the same one the repository test pins.
- `h_validar`: 6. Validate
- `validar`: The function that builds the sheet and the one that validates its syntax are public: public/js/ficha.mjs (armarFicha, markdownDe and validarMarkdown).
- **NUEVO** `h_escala`: 7. The grade scale (RQ.S.00)
- **NUEVO** `escala_nota`: Read in order: the first one that holds decides. It is the same definition the grade uses; a guard requires them to match.
- **NUEVO** `col_nota`: Grade
- **NUEVO** `col_condicion`: Condition
- **NUEVO** `col_desde`: Applies since
- **NUEVO** `rubrica`: Full rubric: every variable, its source, its scoring rule and its effect on the grade

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
**ejemplo.cl** · Banca · Chile · medido 2026-11-12 17:34 UTC · desde afuera, sin instalar nada

## 01 Veredicto
| ID | Indicador | Valor |
|---|---|---|
| RQ.S.00 | Nota Q-Ready | **A** |
| RQ.S.01 | Índice QEX | 56/100 (tope externo 84) |

Lectura: Candado nuevo en el sitio y en todos los nombres públicos que respondieron, sin alertas graves ni altas, sin ambientes de prueba publicados y con todo lo sensible medido. Es la nota máxima que se puede dar desde afuera.
Referencia: mediana banca 57 (12 orgs, edición 2026-08). ejemplo.cl está 1 punto abajo.
Publicación: pública en https://rosettaquantum.com/es/verificado/ejemplo.cl

## 02 Indicadores
| ID | Indicador | Valor | Tipo |
|---|---|---|---|
| RQ.S.02 | Certificados y PKI | 75/100 | medido |
| RQ.S.03 | Higiene de superficie | 50/70 | medido |
| RQ.S.04 | Postura HNDL | 12/100 | modelo |
| RQ.S.05 | PQC en el borde | 100/100 | medido |
| RQ.S.06 | Correo post-cuántico | 1/1 MX | medido |
| RQ.S.07 | Vigencia del certificado | 94 días · 2027-02-14 | medido |
| RQ.S.08 | security.txt | publicado | medido |
| RQ.S.09 | Superficie expuesta | 2/5 sensibles responden | medido |

medido: observado hoy por la sonda · modelo: valor del sector, no medido en el dominio · no medido nunca significa no protegido

| ID | Regla | Dimensión | QEX |
|---|---|---|---|
| RQ.S.02.1 | RSA-2048 = mínimo vigente | 75 | 30,00 |
| RQ.S.02.2 | vigencia: 94 días, hasta 2027-02-14 (informativo) | — | — |
| RQ.S.02.3 | sin plan con fecha para certificado post-cuántico (informativo) | — | — |
| = RQ.S.02 | peso 0,40 | 75/100 | 30,00 |
| RQ.S.03 | base de la higiene (máximo 70) | 70 | 17,50 |
| RQ.S.03.1 | TLS 1.3 en el sitio principal | 0 | 0,00 |
| RQ.S.03.2 | 3 nombres no productivos en el registro | −10 | −2,50 |
| RQ.S.03.3 | 1 nombre de infraestructura en el registro (resta desde 3) | 0 | 0,00 |
| RQ.S.03.4 | 1 nombre de legado en el registro | −10 | −2,50 |
| RQ.S.03.5 | security.txt publicado (informativo) | — | — |
| = RQ.S.03 | peso 0,25 | 50/70 | 12,50 |
| RQ.S.04 | modelo del sector banca | 12 | 3,00 |
| RQ.S.04.1 | años que el dato del sector debe seguir secreto | sin dato | — |
| RQ.S.04.2 | años que toma migrar en el sector | sin dato | — |
| RQ.S.04.3 | margen de Mosca | sin dato | — |
| = RQ.S.04 | peso 0,25 | 12/100 | 3,00 |
| RQ.S.05.1 | soporta X25519MLKEM768 | 100 | 10,00 |
| RQ.S.05.2 | lo elige por defecto (informativo) | — | — |
| RQ.S.05.3 | lo tiene en todos los nombres que responden (informativo) | — | — |
| = RQ.S.05 | peso 0,10 | 100/100 | 10,00 |
| = RQ.S.01 | suma de los aportes |  | 55,50 → 56 |

Máximo alcanzable desde afuera: 70,50 → 70.

## 03 Alertas
| # | Nivel | Hallazgo | Dónde |
|---|---|---|---|
| A1 | MEDIA | Certificado clásico sin plan con fecha | www.ejemplo.cl |
| A2 | MEDIA | Nombre de legado que responde | legacy.ejemplo.cl |
| A3 | MEDIA | Servicio de correo que responde en el puerto 443 | mail.ejemplo.cl |

## 04 Qué hacer
| # | Acción | Resuelve | Efecto en la nota |
|---|---|---|---|
| H1 | Dar de baja o asignar dueño a legacy.ejemplo.cl | A2 | no cambia |
| H2 | Cerrar el puerto 443 en mail.ejemplo.cl | A3 | no cambia |
| H3 | Plan con fecha para certificado post-cuántico | A1 | no cambia |

## 05 No medido
- La postura HNDL es el modelo del sector banca, no una medición del dominio: tabla por sector fijada en la edición 2026-08; la derivación no está publicada.
- Lo interno (inventario, HSM, proveedores) no se ve desde afuera: por eso el tope es 84.
- No medido nunca significa no protegido.

## 06 Evidencia
- Instrumento: rosetta-sondas-envivo/1
- Versiones: QEX-1.0 · QREADY-NOTA-2.1
- Medido: 2026-11-12T17:34:15Z
- Huella CT: 9d938f1f…d28f · 4022 cert.
- Huella de la foto: f0c71112…acdd
- Método: CT · DNS · saludos TLS sin sesión
- Rúbrica: https://rosettaquantum.com/es/metodologia/qex

## 07 Límites y siguiente paso
- Es la foto de un día, medida desde afuera; el tramo del borde al origen no es observable.
- Página pública del dominio: https://rosettaquantum.com/es/verificado/ejemplo.cl

rosetta-ficha/1 · Rosetta Quantum · medición independiente
```

## Ejemplo · a · en

```markdown
# Rosetta Fact Sheet · Post-quantum security
**ejemplo.cl** · Banking · Chile · measured 2026-11-12 17:34 UTC · from outside, nothing installed

## 01 Verdict
| ID | Indicator | Value |
|---|---|---|
| RQ.S.00 | Q-Ready grade | **A** |
| RQ.S.01 | QEX index | 56/100 (external cap 84) |

Reading: New lock on the site and on every public name that responded, no serious or high alerts, no published test environments, and everything sensitive measured. The highest grade that can be given from outside.
Reference: banking median 57 (12 orgs, edition 2026-08). ejemplo.cl is 1 point below.
Publication: public at https://rosettaquantum.com/verificado/ejemplo.cl

## 02 Indicators
| ID | Indicator | Value | Type |
|---|---|---|---|
| RQ.S.02 | Certificates and PKI | 75/100 | measured |
| RQ.S.03 | Surface hygiene | 50/70 | measured |
| RQ.S.04 | HNDL posture | 12/100 | model |
| RQ.S.05 | PQC at the edge | 100/100 | measured |
| RQ.S.06 | Post-quantum email | 1/1 MX | measured |
| RQ.S.07 | Certificate validity | 94 days · 2027-02-14 | measured |
| RQ.S.08 | security.txt | published | measured |
| RQ.S.09 | Exposed surface | 2/5 sensitive respond | measured |

measured: observed today by the probe · model: sector value, not measured on the domain · not measured never means not protected

| ID | Rule | Dimension | QEX |
|---|---|---|---|
| RQ.S.02.1 | RSA-2048 = current minimum | 75 | 30.00 |
| RQ.S.02.2 | validity: 94 days, until 2027-02-14 (for information) | — | — |
| RQ.S.02.3 | no dated plan for a post-quantum certificate (for information) | — | — |
| = RQ.S.02 | weight 0.40 | 75/100 | 30.00 |
| RQ.S.03 | hygiene base (maximum 70) | 70 | 17.50 |
| RQ.S.03.1 | TLS 1.3 on the main site | 0 | 0.00 |
| RQ.S.03.2 | 3 non-production names in the log | −10 | −2.50 |
| RQ.S.03.3 | 1 infrastructure name in the log (deducts from 3) | 0 | 0.00 |
| RQ.S.03.4 | 1 legacy name in the log | −10 | −2.50 |
| RQ.S.03.5 | security.txt published (for information) | — | — |
| = RQ.S.03 | weight 0.25 | 50/70 | 12.50 |
| RQ.S.04 | banking sector model | 12 | 3.00 |
| RQ.S.04.1 | years the sector's data must stay secret | no data | — |
| RQ.S.04.2 | years the sector takes to migrate | no data | — |
| RQ.S.04.3 | Mosca margin | no data | — |
| = RQ.S.04 | weight 0.25 | 12/100 | 3.00 |
| RQ.S.05.1 | supports X25519MLKEM768 | 100 | 10.00 |
| RQ.S.05.2 | chooses it by default (for information) | — | — |
| RQ.S.05.3 | has it on every name that answers (for information) | — | — |
| = RQ.S.05 | weight 0.10 | 100/100 | 10.00 |
| = RQ.S.01 | sum of contributions |  | 55.50 → 56 |

Highest reachable from outside: 70.50 → 70.

## 03 Alerts
| # | Level | Finding | Where |
|---|---|---|---|
| A1 | MEDIUM | Classical certificate without a dated plan | www.ejemplo.cl |
| A2 | MEDIUM | Legacy name answering | legacy.ejemplo.cl |
| A3 | MEDIUM | Mail service answering on port 443 | mail.ejemplo.cl |

## 04 What to do
| # | Action | Resolves | Effect on the grade |
|---|---|---|---|
| H1 | Retire legacy.ejemplo.cl or assign it an owner | A2 | no change |
| H2 | Close port 443 on mail.ejemplo.cl | A3 | no change |
| H3 | Dated plan for a post-quantum certificate | A1 | no change |

## 05 Not measured
- HNDL posture is the banking sector model, not a measurement of the domain: a per-sector table fixed in the 2026-08 edition; the derivation is not published.
- What is internal (inventory, HSM, providers) cannot be seen from outside: that is why the cap is 84.
- Not measured never means not protected.

## 06 Evidence
- Instrument: rosetta-sondas-envivo/1
- Versions: QEX-1.0 · QREADY-NOTA-2.1
- Measured: 2026-11-12T17:34:15Z
- CT fingerprint: 9d938f1f…d28f · 4022 cert.
- Snapshot fingerprint: f0c71112…acdd
- Method: CT · DNS · TLS handshakes without a session
- Rubric: https://rosettaquantum.com/methodology/qex

## 07 Limits and next step
- It is a one-day snapshot, measured from outside; the edge-to-origin leg is not observable.
- Public page for the domain: https://rosettaquantum.com/verificado/ejemplo.cl

rosetta-ficha/1 · Rosetta Quantum · independent measurement
```

## Ejemplo · f · es

```markdown
# Ficha Rosetta · Seguridad post-cuántica
**ejemplo.com.py** · Banca · Paraguay · medido 2026-11-12 17:34 UTC · desde afuera, sin instalar nada

## 01 Veredicto
| ID | Indicador | Valor |
|---|---|---|
| RQ.S.00 | Nota Q-Ready | **F** |
| RQ.S.01 | Índice QEX | 56/100 (tope externo 84) |

Lectura: Su sitio ya usa el candado post-cuántico, pero tiene un ambiente de pruebas expuesto a internet.
Referencia: sin índice para Paraguay; no se compara.
Publicación: privada. El dueño no ha activado su página pública.

## 02 Indicadores
| ID | Indicador | Valor | Tipo |
|---|---|---|---|
| RQ.S.02 | Certificados y PKI | 75/100 | medido |
| RQ.S.03 | Higiene de superficie | 50/70 | medido |
| RQ.S.04 | Postura HNDL | 12/100 | modelo |
| RQ.S.05 | PQC en el borde | 100/100 | medido |
| RQ.S.06 | Correo post-cuántico | 0/4 MX | medido |
| RQ.S.07 | Vigencia del certificado | 94 días · 2027-02-14 | medido |
| RQ.S.08 | security.txt | no publicado | medido |
| RQ.S.09 | Superficie expuesta | 3/5 sensibles responden | medido |

medido: observado hoy por la sonda · modelo: valor del sector, no medido en el dominio · no medido nunca significa no protegido

| ID | Regla | Dimensión | QEX |
|---|---|---|---|
| RQ.S.02.1 | RSA-2048 = mínimo vigente | 75 | 30,00 |
| RQ.S.02.2 | vigencia: 94 días, hasta 2027-02-14 (informativo) | — | — |
| RQ.S.02.3 | sin plan con fecha para certificado post-cuántico (informativo) | — | — |
| = RQ.S.02 | peso 0,40 | 75/100 | 30,00 |
| RQ.S.03 | base de la higiene (máximo 70) | 70 | 17,50 |
| RQ.S.03.1 | TLS 1.3 en el sitio principal | 0 | 0,00 |
| RQ.S.03.2 | 3 nombres no productivos en el registro | −10 | −2,50 |
| RQ.S.03.3 | 1 nombre de infraestructura en el registro (resta desde 3) | 0 | 0,00 |
| RQ.S.03.4 | 1 nombre de legado en el registro | −10 | −2,50 |
| RQ.S.03.5 | security.txt no publicado (informativo) | — | — |
| = RQ.S.03 | peso 0,25 | 50/70 | 12,50 |
| RQ.S.04 | modelo del sector banca | 12 | 3,00 |
| RQ.S.04.1 | años que el dato del sector debe seguir secreto | sin dato | — |
| RQ.S.04.2 | años que toma migrar en el sector | sin dato | — |
| RQ.S.04.3 | margen de Mosca | sin dato | — |
| = RQ.S.04 | peso 0,25 | 12/100 | 3,00 |
| RQ.S.05.1 | soporta X25519MLKEM768 | 100 | 10,00 |
| RQ.S.05.2 | lo elige por defecto (informativo) | — | — |
| RQ.S.05.3 | no lo tiene en todos los nombres que responden (informativo) | — | — |
| = RQ.S.05 | peso 0,10 | 100/100 | 10,00 |
| = RQ.S.01 | suma de los aportes |  | 55,50 → 56 |

Máximo alcanzable desde afuera: 70,50 → 70.

## 03 Alertas
| # | Nivel | Hallazgo | Dónde |
|---|---|---|---|
| A1 | GRAVE | Ambiente de pruebas expuesto | s•••#a2.ejemplo.com.py |
| A2 | MEDIA | Certificado clásico sin plan con fecha | www.ejemplo.com.py |
| A3 | MEDIA | Nombre de legado que responde | l•••.ejemplo.com.py |
| A4 | MEDIA | Servicio de correo que responde en el puerto 443 | m•••.ejemplo.com.py |

## 04 Qué hacer
| # | Acción | Resuelve | Efecto en la nota |
|---|---|---|---|
| H1 | Sacar de internet s•••#a2.ejemplo.com.py | A1 | -> B |
| H2 | Dar de baja o asignar dueño a l•••.ejemplo.com.py | A3 | no cambia |
| H3 | Cerrar el puerto 443 en m•••.ejemplo.com.py | A4 | -> A |
| H4 | Plan con fecha para certificado post-cuántico | A2 | no cambia |
| H5 | Publicar security.txt | — | no cambia |
| H6 | Pedir al proveedor de correo fecha para el intercambio híbrido | RQ.S.06 | no cambia |

## 05 No medido
- crt.sh no respondió; se usó Cert Spotter (4022 certificados, 77 nombres).
- 2 nombres respondieron sin evidencia del candado nuevo.
- La postura HNDL es el modelo del sector banca, no una medición del dominio: tabla por sector fijada en la edición 2026-08; la derivación no está publicada.
- Lo interno (inventario, HSM, proveedores) no se ve desde afuera: por eso el tope es 84.
- No medido nunca significa no protegido.

## 06 Evidencia
- Instrumento: rosetta-sondas-envivo/1
- Versiones: QEX-1.0 · QREADY-NOTA-2.1
- Medido: 2026-11-12T17:34:15Z
- Huella CT: f00b5266…7d86 · 4022 cert.
- Huella de la foto: 5c1eaafd…e046
- Método: CT · DNS · saludos TLS sin sesión
- Rúbrica: https://rosettaquantum.com/es/metodologia/qex

## 07 Límites y siguiente paso
- Es la foto de un día, medida desde afuera; el tramo del borde al origen no es observable.
- Informe completo del dominio: https://rosettaquantum.com/es/q-ready/medicion/?dominio=ejemplo.com.py&sector=banca
- Con H1 a H3 hechos, la próxima medición debería dar A.

rosetta-ficha/1 · Rosetta Quantum · medición independiente
```

## Ejemplo · f · en

```markdown
# Rosetta Fact Sheet · Post-quantum security
**ejemplo.com.py** · Banking · Paraguay · measured 2026-11-12 17:34 UTC · from outside, nothing installed

## 01 Verdict
| ID | Indicator | Value |
|---|---|---|
| RQ.S.00 | Q-Ready grade | **F** |
| RQ.S.01 | QEX index | 56/100 (external cap 84) |

Reading: Your site already uses the post-quantum lock, but it has a test environment exposed to the internet.
Reference: no index for Paraguay; no comparison.
Publication: private. The owner has not activated its public page.

## 02 Indicators
| ID | Indicator | Value | Type |
|---|---|---|---|
| RQ.S.02 | Certificates and PKI | 75/100 | measured |
| RQ.S.03 | Surface hygiene | 50/70 | measured |
| RQ.S.04 | HNDL posture | 12/100 | model |
| RQ.S.05 | PQC at the edge | 100/100 | measured |
| RQ.S.06 | Post-quantum email | 0/4 MX | measured |
| RQ.S.07 | Certificate validity | 94 days · 2027-02-14 | measured |
| RQ.S.08 | security.txt | not published | measured |
| RQ.S.09 | Exposed surface | 3/5 sensitive respond | measured |

measured: observed today by the probe · model: sector value, not measured on the domain · not measured never means not protected

| ID | Rule | Dimension | QEX |
|---|---|---|---|
| RQ.S.02.1 | RSA-2048 = current minimum | 75 | 30.00 |
| RQ.S.02.2 | validity: 94 days, until 2027-02-14 (for information) | — | — |
| RQ.S.02.3 | no dated plan for a post-quantum certificate (for information) | — | — |
| = RQ.S.02 | weight 0.40 | 75/100 | 30.00 |
| RQ.S.03 | hygiene base (maximum 70) | 70 | 17.50 |
| RQ.S.03.1 | TLS 1.3 on the main site | 0 | 0.00 |
| RQ.S.03.2 | 3 non-production names in the log | −10 | −2.50 |
| RQ.S.03.3 | 1 infrastructure name in the log (deducts from 3) | 0 | 0.00 |
| RQ.S.03.4 | 1 legacy name in the log | −10 | −2.50 |
| RQ.S.03.5 | security.txt not published (for information) | — | — |
| = RQ.S.03 | weight 0.25 | 50/70 | 12.50 |
| RQ.S.04 | banking sector model | 12 | 3.00 |
| RQ.S.04.1 | years the sector's data must stay secret | no data | — |
| RQ.S.04.2 | years the sector takes to migrate | no data | — |
| RQ.S.04.3 | Mosca margin | no data | — |
| = RQ.S.04 | weight 0.25 | 12/100 | 3.00 |
| RQ.S.05.1 | supports X25519MLKEM768 | 100 | 10.00 |
| RQ.S.05.2 | chooses it by default (for information) | — | — |
| RQ.S.05.3 | does not have it on every name that answers (for information) | — | — |
| = RQ.S.05 | weight 0.10 | 100/100 | 10.00 |
| = RQ.S.01 | sum of contributions |  | 55.50 → 56 |

Highest reachable from outside: 70.50 → 70.

## 03 Alerts
| # | Level | Finding | Where |
|---|---|---|---|
| A1 | SERIOUS | Exposed test environment | s•••#a2.ejemplo.com.py |
| A2 | MEDIUM | Classical certificate without a dated plan | www.ejemplo.com.py |
| A3 | MEDIUM | Legacy name answering | l•••.ejemplo.com.py |
| A4 | MEDIUM | Mail service answering on port 443 | m•••.ejemplo.com.py |

## 04 What to do
| # | Action | Resolves | Effect on the grade |
|---|---|---|---|
| H1 | Take s•••#a2.ejemplo.com.py off the internet | A1 | -> B |
| H2 | Retire l•••.ejemplo.com.py or assign it an owner | A3 | no change |
| H3 | Close port 443 on m•••.ejemplo.com.py | A4 | -> A |
| H4 | Dated plan for a post-quantum certificate | A2 | no change |
| H5 | Publish security.txt | — | no change |
| H6 | Ask the email provider for a date for the hybrid key exchange | RQ.S.06 | no change |

## 05 Not measured
- crt.sh did not respond; Cert Spotter was used (4022 certificates, 77 names).
- 2 names answered without evidence of the new lock.
- HNDL posture is the banking sector model, not a measurement of the domain: a per-sector table fixed in the 2026-08 edition; the derivation is not published.
- What is internal (inventory, HSM, providers) cannot be seen from outside: that is why the cap is 84.
- Not measured never means not protected.

## 06 Evidence
- Instrument: rosetta-sondas-envivo/1
- Versions: QEX-1.0 · QREADY-NOTA-2.1
- Measured: 2026-11-12T17:34:15Z
- CT fingerprint: f00b5266…7d86 · 4022 cert.
- Snapshot fingerprint: 5c1eaafd…e046
- Method: CT · DNS · TLS handshakes without a session
- Rubric: https://rosettaquantum.com/methodology/qex

## 07 Limits and next step
- It is a one-day snapshot, measured from outside; the edge-to-origin leg is not observable.
- Full report for the domain: https://rosettaquantum.com/q-ready/medicion/?dominio=ejemplo.com.py&sector=banca
- With H1 to H3 done, the next measurement should give A.

rosetta-ficha/1 · Rosetta Quantum · independent measurement
```

## Ejemplo · sin-correo · es

```markdown
# Ficha Rosetta · Seguridad post-cuántica
**example.com** · Retail · país no determinado · medido 2026-11-12 17:34 UTC · desde afuera, sin instalar nada

## 01 Veredicto
| ID | Indicador | Valor |
|---|---|---|
| RQ.S.00 | Nota Q-Ready | **B** |
| RQ.S.01 | Índice QEX | 69/100 (tope externo 84) |

Lectura: Su sitio ya usa el candado post-cuántico, pero un nombre que responde no muestra el candado nuevo.
Referencia: el dominio .com no indica país; no se compara.
Publicación: privada. El dueño no ha activado su página pública.

## 02 Indicadores
| ID | Indicador | Valor | Tipo |
|---|---|---|---|
| RQ.S.02 | Certificados y PKI | 75/100 | medido |
| RQ.S.03 | Higiene de superficie | 50/70 | medido |
| RQ.S.04 | Postura HNDL | 65/100 | modelo |
| RQ.S.05 | PQC en el borde | 100/100 | medido |
| RQ.S.06 | Correo post-cuántico | sin MX publicado | medido |
| RQ.S.07 | Vigencia del certificado | 94 días · 2027-02-14 | medido |
| RQ.S.08 | security.txt | no publicado | medido |
| RQ.S.09 | Superficie expuesta | 1/5 sensibles responden | medido |

medido: observado hoy por la sonda · modelo: valor del sector, no medido en el dominio · no medido nunca significa no protegido

| ID | Regla | Dimensión | QEX |
|---|---|---|---|
| RQ.S.02.1 | RSA-2048 = mínimo vigente | 75 | 30,00 |
| RQ.S.02.2 | vigencia: 94 días, hasta 2027-02-14 (informativo) | — | — |
| RQ.S.02.3 | sin plan con fecha para certificado post-cuántico (informativo) | — | — |
| = RQ.S.02 | peso 0,40 | 75/100 | 30,00 |
| RQ.S.03 | base de la higiene (máximo 70) | 70 | 17,50 |
| RQ.S.03.1 | TLS 1.3 en el sitio principal | 0 | 0,00 |
| RQ.S.03.2 | 3 nombres no productivos en el registro | −10 | −2,50 |
| RQ.S.03.3 | 1 nombre de infraestructura en el registro (resta desde 3) | 0 | 0,00 |
| RQ.S.03.4 | 1 nombre de legado en el registro | −10 | −2,50 |
| RQ.S.03.5 | security.txt no publicado (informativo) | — | — |
| = RQ.S.03 | peso 0,25 | 50/70 | 12,50 |
| RQ.S.04 | modelo del sector retail | 65 | 16,25 |
| RQ.S.04.1 | años que el dato del sector debe seguir secreto | sin dato | — |
| RQ.S.04.2 | años que toma migrar en el sector | sin dato | — |
| RQ.S.04.3 | margen de Mosca | sin dato | — |
| = RQ.S.04 | peso 0,25 | 65/100 | 16,25 |
| RQ.S.05.1 | soporta X25519MLKEM768 | 100 | 10,00 |
| RQ.S.05.2 | lo elige por defecto (informativo) | — | — |
| RQ.S.05.3 | no lo tiene en todos los nombres que responden (informativo) | — | — |
| = RQ.S.05 | peso 0,10 | 100/100 | 10,00 |
| = RQ.S.01 | suma de los aportes |  | 68,75 → 69 |

Máximo alcanzable desde afuera: 83,75 → 84.

## 03 Alertas
| # | Nivel | Hallazgo | Dónde |
|---|---|---|---|
| A1 | MEDIA | Certificado clásico sin plan con fecha | www.example.com |
| A2 | MEDIA | Nombre de legado que responde | l•••.example.com |

## 04 Qué hacer
| # | Acción | Resuelve | Efecto en la nota |
|---|---|---|---|
| H1 | Dar de baja o asignar dueño a l•••.example.com | A2 | -> A |
| H2 | Plan con fecha para certificado post-cuántico | A1 | no cambia |
| H3 | Publicar security.txt | — | no cambia |

## 05 No medido
- 1 nombres respondieron sin evidencia del candado nuevo.
- La postura HNDL es el modelo del sector retail, no una medición del dominio: tabla por sector fijada en la edición 2026-08; la derivación no está publicada.
- Lo interno (inventario, HSM, proveedores) no se ve desde afuera: por eso el tope es 84.
- No medido nunca significa no protegido.

## 06 Evidencia
- Instrumento: rosetta-sondas-envivo/1
- Versiones: QEX-1.0 · QREADY-NOTA-2.1
- Medido: 2026-11-12T17:34:15Z
- Huella CT: c1b1ac16…ce0e · 4022 cert.
- Huella de la foto: e6488add…c9f6
- Método: CT · DNS · saludos TLS sin sesión
- Rúbrica: https://rosettaquantum.com/es/metodologia/qex

## 07 Límites y siguiente paso
- Es la foto de un día, medida desde afuera; el tramo del borde al origen no es observable.
- Informe completo del dominio: https://rosettaquantum.com/es/q-ready/medicion/?dominio=example.com&sector=retail
- Con H1 hecho, la próxima medición debería dar A.

rosetta-ficha/1 · Rosetta Quantum · medición independiente
```

## Ejemplo · sin-correo · en

```markdown
# Rosetta Fact Sheet · Post-quantum security
**example.com** · Retail · country not determined · measured 2026-11-12 17:34 UTC · from outside, nothing installed

## 01 Verdict
| ID | Indicator | Value |
|---|---|---|
| RQ.S.00 | Q-Ready grade | **B** |
| RQ.S.01 | QEX index | 69/100 (external cap 84) |

Reading: Your site already uses the post-quantum lock, but one name that answers does not show the new lock.
Reference: a .com domain does not indicate a country; no comparison.
Publication: private. The owner has not activated its public page.

## 02 Indicators
| ID | Indicator | Value | Type |
|---|---|---|---|
| RQ.S.02 | Certificates and PKI | 75/100 | measured |
| RQ.S.03 | Surface hygiene | 50/70 | measured |
| RQ.S.04 | HNDL posture | 65/100 | model |
| RQ.S.05 | PQC at the edge | 100/100 | measured |
| RQ.S.06 | Post-quantum email | no MX published | measured |
| RQ.S.07 | Certificate validity | 94 days · 2027-02-14 | measured |
| RQ.S.08 | security.txt | not published | measured |
| RQ.S.09 | Exposed surface | 1/5 sensitive respond | measured |

measured: observed today by the probe · model: sector value, not measured on the domain · not measured never means not protected

| ID | Rule | Dimension | QEX |
|---|---|---|---|
| RQ.S.02.1 | RSA-2048 = current minimum | 75 | 30.00 |
| RQ.S.02.2 | validity: 94 days, until 2027-02-14 (for information) | — | — |
| RQ.S.02.3 | no dated plan for a post-quantum certificate (for information) | — | — |
| = RQ.S.02 | weight 0.40 | 75/100 | 30.00 |
| RQ.S.03 | hygiene base (maximum 70) | 70 | 17.50 |
| RQ.S.03.1 | TLS 1.3 on the main site | 0 | 0.00 |
| RQ.S.03.2 | 3 non-production names in the log | −10 | −2.50 |
| RQ.S.03.3 | 1 infrastructure name in the log (deducts from 3) | 0 | 0.00 |
| RQ.S.03.4 | 1 legacy name in the log | −10 | −2.50 |
| RQ.S.03.5 | security.txt not published (for information) | — | — |
| = RQ.S.03 | weight 0.25 | 50/70 | 12.50 |
| RQ.S.04 | retail sector model | 65 | 16.25 |
| RQ.S.04.1 | years the sector's data must stay secret | no data | — |
| RQ.S.04.2 | years the sector takes to migrate | no data | — |
| RQ.S.04.3 | Mosca margin | no data | — |
| = RQ.S.04 | weight 0.25 | 65/100 | 16.25 |
| RQ.S.05.1 | supports X25519MLKEM768 | 100 | 10.00 |
| RQ.S.05.2 | chooses it by default (for information) | — | — |
| RQ.S.05.3 | does not have it on every name that answers (for information) | — | — |
| = RQ.S.05 | weight 0.10 | 100/100 | 10.00 |
| = RQ.S.01 | sum of contributions |  | 68.75 → 69 |

Highest reachable from outside: 83.75 → 84.

## 03 Alerts
| # | Level | Finding | Where |
|---|---|---|---|
| A1 | MEDIUM | Classical certificate without a dated plan | www.example.com |
| A2 | MEDIUM | Legacy name answering | l•••.example.com |

## 04 What to do
| # | Action | Resolves | Effect on the grade |
|---|---|---|---|
| H1 | Retire l•••.example.com or assign it an owner | A2 | -> A |
| H2 | Dated plan for a post-quantum certificate | A1 | no change |
| H3 | Publish security.txt | — | no change |

## 05 Not measured
- 1 names answered without evidence of the new lock.
- HNDL posture is the retail sector model, not a measurement of the domain: a per-sector table fixed in the 2026-08 edition; the derivation is not published.
- What is internal (inventory, HSM, providers) cannot be seen from outside: that is why the cap is 84.
- Not measured never means not protected.

## 06 Evidence
- Instrument: rosetta-sondas-envivo/1
- Versions: QEX-1.0 · QREADY-NOTA-2.1
- Measured: 2026-11-12T17:34:15Z
- CT fingerprint: c1b1ac16…ce0e · 4022 cert.
- Snapshot fingerprint: e6488add…c9f6
- Method: CT · DNS · TLS handshakes without a session
- Rubric: https://rosettaquantum.com/methodology/qex

## 07 Limits and next step
- It is a one-day snapshot, measured from outside; the edge-to-origin leg is not observable.
- Full report for the domain: https://rosettaquantum.com/q-ready/medicion/?dominio=example.com&sector=retail
- With H1 done, the next measurement should give A.

rosetta-ficha/1 · Rosetta Quantum · independent measurement
```

## Ejemplo · rastreo · es

```markdown
# Ficha Rosetta · Seguridad post-cuántica
**rastreo.example** · Fintech · país no determinado · medido 2026-11-16 18:55 UTC · desde afuera, sin instalar nada

## 01 Veredicto
| ID | Indicador | Valor |
|---|---|---|
| RQ.S.00 | Nota Q-Ready | **F** |
| RQ.S.01 | Índice QEX | 61/100 (tope externo 84) |

Lectura: Su sitio todavía no usa el candado post-cuántico y tiene un ambiente de pruebas expuesto a internet.
Referencia: el dominio .example no indica país; no se compara.
Publicación: privada. El dueño no ha activado su página pública.

## 02 Indicadores
| ID | Indicador | Valor | Tipo |
|---|---|---|---|
| RQ.S.02 | Certificados y PKI | 75/100 | medido |
| RQ.S.03 | Higiene de superficie | 60/70 | medido |
| RQ.S.04 | Postura HNDL | 65/100 | modelo |
| RQ.S.05 | PQC en el borde | 0/100 | medido |
| RQ.S.06 | Correo post-cuántico | sin dato | no medido |
| RQ.S.07 | Vigencia del certificado | 82 días · 2027-02-06 | medido |
| RQ.S.08 | security.txt | no publicado | medido |
| RQ.S.09 | Superficie expuesta | 4/4 sensibles responden | medido |

medido: observado hoy por la sonda · modelo: valor del sector, no medido en el dominio · no medido nunca significa no protegido

| ID | Regla | Dimensión | QEX |
|---|---|---|---|
| RQ.S.02.1 | RSA-2048 = mínimo vigente | 75 | 30,00 |
| RQ.S.02.2 | vigencia: 82 días, hasta 2027-02-06 (informativo) | — | — |
| RQ.S.02.3 | sin plan con fecha para certificado post-cuántico (informativo) | — | — |
| = RQ.S.02 | peso 0,40 | 75/100 | 30,00 |
| RQ.S.03 | base de la higiene (máximo 70) | 70 | 17,50 |
| RQ.S.03.1 | TLS 1.3 en el sitio principal | 0 | 0,00 |
| RQ.S.03.2 | 2 nombres no productivos en el registro | −10 | −2,50 |
| RQ.S.03.3 | 2 nombres de infraestructura en el registro (resta desde 3) | 0 | 0,00 |
| RQ.S.03.4 | sin nombres de legado en el registro | 0 | 0,00 |
| RQ.S.03.5 | security.txt no publicado (informativo) | — | — |
| = RQ.S.03 | peso 0,25 | 60/70 | 15,00 |
| RQ.S.04 | modelo del sector fintech | 65 | 16,25 |
| RQ.S.04.1 | años que el dato del sector debe seguir secreto | sin dato | — |
| RQ.S.04.2 | años que toma migrar en el sector | sin dato | — |
| RQ.S.04.3 | margen de Mosca | sin dato | — |
| = RQ.S.04 | peso 0,25 | 65/100 | 16,25 |
| RQ.S.05.1 | no soporta X25519MLKEM768 | 0 | 0,00 |
| = RQ.S.05 | peso 0,10 | 0/100 | 0,00 |
| = RQ.S.01 | suma de los aportes |  | 61,25 → 61 |

Máximo alcanzable desde afuera: 83,75 → 84.
Puntos por acción: activar el híbrido +10,00.

## 03 Alertas
| # | Nivel | Hallazgo | Dónde |
|---|---|---|---|
| A1 | GRAVE | Ambiente de pruebas expuesto | s•••.rastreo.example |
| A2 | ALTA | Infraestructura sensible que responde | c•••.rastreo.example |
| A3 | MEDIA | Ambiente de pruebas publicado con el acceso bloqueado | serverless-s•••.rastreo.example |
| A4 | MEDIA | Certificado clásico sin plan con fecha | www.rastreo.example |
| A5 | MEDIA | Servicio de correo que responde en el puerto 443 | w•••.rastreo.example |

## 04 Qué hacer
| # | Acción | Resuelve | Efecto en la nota |
|---|---|---|---|
| H1 | Sacar de internet s•••.rastreo.example | A1 | -> D |
| H2 | Activar X25519MLKEM768 en www.rastreo.example | RQ.S.05 | -> C |
| H3 | Cerrar o restringir por IP c•••.rastreo.example | A2 | -> B |
| H4 | Retirar de internet serverless-s•••.rastreo.example | A3 | no cambia |
| H5 | Cerrar el puerto 443 en w•••.rastreo.example | A5 | -> A |
| H6 | Plan con fecha para certificado post-cuántico | A4 | no cambia |
| H7 | Publicar security.txt | — | no cambia |

## 05 No medido
- El cifrado del correo no se midió en esta foto.
- La postura HNDL es el modelo del sector fintech, no una medición del dominio: tabla por sector fijada en la edición 2026-08; la derivación no está publicada.
- Lo interno (inventario, HSM, proveedores) no se ve desde afuera: por eso el tope es 84.
- No medido nunca significa no protegido.

## 06 Evidencia
- Instrumento: rosetta-sondas-envivo/1
- Versiones: QEX-1.0 · QREADY-NOTA-2.1
- Medido: 2026-11-16T18:55:47Z
- Huella CT: e5b89749…3a86 · 1 cert.
- Huella de la foto: 6886b050…9447
- Método: CT · DNS · saludos TLS sin sesión
- Rúbrica: https://rosettaquantum.com/es/metodologia/qex

## 07 Límites y siguiente paso
- Es la foto de un día, medida desde afuera; el tramo del borde al origen no es observable.
- Informe completo del dominio: https://rosettaquantum.com/es/q-ready/medicion/?dominio=rastreo.example&sector=fintech
- Con H1 a H5 hechos, la próxima medición debería dar A.

rosetta-ficha/1 · Rosetta Quantum · medición independiente
```

## Ejemplo · rastreo · en

```markdown
# Rosetta Fact Sheet · Post-quantum security
**rastreo.example** · Fintech · country not determined · measured 2026-11-16 18:55 UTC · from outside, nothing installed

## 01 Verdict
| ID | Indicator | Value |
|---|---|---|
| RQ.S.00 | Q-Ready grade | **F** |
| RQ.S.01 | QEX index | 61/100 (external cap 84) |

Reading: Your site does not use the post-quantum lock yet, and it has a test environment exposed to the internet.
Reference: a .example domain does not indicate a country; no comparison.
Publication: private. The owner has not activated its public page.

## 02 Indicators
| ID | Indicator | Value | Type |
|---|---|---|---|
| RQ.S.02 | Certificates and PKI | 75/100 | measured |
| RQ.S.03 | Surface hygiene | 60/70 | measured |
| RQ.S.04 | HNDL posture | 65/100 | model |
| RQ.S.05 | PQC at the edge | 0/100 | measured |
| RQ.S.06 | Post-quantum email | no data | not measured |
| RQ.S.07 | Certificate validity | 82 days · 2027-02-06 | measured |
| RQ.S.08 | security.txt | not published | measured |
| RQ.S.09 | Exposed surface | 4/4 sensitive respond | measured |

measured: observed today by the probe · model: sector value, not measured on the domain · not measured never means not protected

| ID | Rule | Dimension | QEX |
|---|---|---|---|
| RQ.S.02.1 | RSA-2048 = current minimum | 75 | 30.00 |
| RQ.S.02.2 | validity: 82 days, until 2027-02-06 (for information) | — | — |
| RQ.S.02.3 | no dated plan for a post-quantum certificate (for information) | — | — |
| = RQ.S.02 | weight 0.40 | 75/100 | 30.00 |
| RQ.S.03 | hygiene base (maximum 70) | 70 | 17.50 |
| RQ.S.03.1 | TLS 1.3 on the main site | 0 | 0.00 |
| RQ.S.03.2 | 2 non-production names in the log | −10 | −2.50 |
| RQ.S.03.3 | 2 infrastructure names in the log (deducts from 3) | 0 | 0.00 |
| RQ.S.03.4 | no legacy names in the log | 0 | 0.00 |
| RQ.S.03.5 | security.txt not published (for information) | — | — |
| = RQ.S.03 | weight 0.25 | 60/70 | 15.00 |
| RQ.S.04 | fintech sector model | 65 | 16.25 |
| RQ.S.04.1 | years the sector's data must stay secret | no data | — |
| RQ.S.04.2 | years the sector takes to migrate | no data | — |
| RQ.S.04.3 | Mosca margin | no data | — |
| = RQ.S.04 | weight 0.25 | 65/100 | 16.25 |
| RQ.S.05.1 | does not support X25519MLKEM768 | 0 | 0.00 |
| = RQ.S.05 | weight 0.10 | 0/100 | 0.00 |
| = RQ.S.01 | sum of contributions |  | 61.25 → 61 |

Highest reachable from outside: 83.75 → 84.
Points per action: enable the hybrid +10.00.

## 03 Alerts
| # | Level | Finding | Where |
|---|---|---|---|
| A1 | SERIOUS | Exposed test environment | s•••.rastreo.example |
| A2 | HIGH | Sensitive infrastructure answering | c•••.rastreo.example |
| A3 | MEDIUM | Test environment published with access blocked | serverless-s•••.rastreo.example |
| A4 | MEDIUM | Classical certificate without a dated plan | www.rastreo.example |
| A5 | MEDIUM | Mail service answering on port 443 | w•••.rastreo.example |

## 04 What to do
| # | Action | Resolves | Effect on the grade |
|---|---|---|---|
| H1 | Take s•••.rastreo.example off the internet | A1 | -> D |
| H2 | Enable X25519MLKEM768 on www.rastreo.example | RQ.S.05 | -> C |
| H3 | Close or IP-restrict c•••.rastreo.example | A2 | -> B |
| H4 | Take serverless-s•••.rastreo.example off the internet | A3 | no change |
| H5 | Close port 443 on w•••.rastreo.example | A5 | -> A |
| H6 | Dated plan for a post-quantum certificate | A4 | no change |
| H7 | Publish security.txt | — | no change |

## 05 Not measured
- Email encryption was not measured in this snapshot.
- HNDL posture is the fintech sector model, not a measurement of the domain: a per-sector table fixed in the 2026-08 edition; the derivation is not published.
- What is internal (inventory, HSM, providers) cannot be seen from outside: that is why the cap is 84.
- Not measured never means not protected.

## 06 Evidence
- Instrument: rosetta-sondas-envivo/1
- Versions: QEX-1.0 · QREADY-NOTA-2.1
- Measured: 2026-11-16T18:55:47Z
- CT fingerprint: e5b89749…3a86 · 1 cert.
- Snapshot fingerprint: 6886b050…9447
- Method: CT · DNS · TLS handshakes without a session
- Rubric: https://rosettaquantum.com/methodology/qex

## 07 Limits and next step
- It is a one-day snapshot, measured from outside; the edge-to-origin leg is not observable.
- Full report for the domain: https://rosettaquantum.com/q-ready/medicion/?dominio=rastreo.example&sector=fintech
- With H1 to H5 done, the next measurement should give A.

rosetta-ficha/1 · Rosetta Quantum · independent measurement
```

## Ejemplo · rastreob · es

```markdown
# Ficha Rosetta · Seguridad post-cuántica
**rastreob.example** · Fintech · país no determinado · medido 2026-11-16 18:56 UTC · desde afuera, sin instalar nada

## 01 Veredicto
| ID | Indicador | Valor |
|---|---|---|
| RQ.S.00 | Nota Q-Ready | **B** |
| RQ.S.01 | Índice QEX | 73/100 (tope externo 84) |

Lectura: Su sitio ya usa el candado post-cuántico, pero no se pudo leer su certificado.
Referencia: el dominio .example no indica país; no se compara.
Publicación: privada. El dueño no ha activado su página pública.

## 02 Indicadores
| ID | Indicador | Valor | Tipo |
|---|---|---|---|
| RQ.S.02 | Certificados y PKI | sin dato | no medido |
| RQ.S.03 | Higiene de superficie | 70/70 | medido |
| RQ.S.04 | Postura HNDL | 65/100 | modelo |
| RQ.S.05 | PQC en el borde | 100/100 | medido |
| RQ.S.06 | Correo post-cuántico | sin MX publicado | medido |
| RQ.S.07 | Vigencia del certificado | sin dato | no medido |
| RQ.S.08 | security.txt | no publicado | medido |
| RQ.S.09 | Superficie expuesta | sin nombres sondeados | medido |

medido: observado hoy por la sonda · modelo: valor del sector, no medido en el dominio · no medido nunca significa no protegido

| ID | Regla | Dimensión | QEX |
|---|---|---|---|
| RQ.S.02.1 | certificado no leído | sin dato | — |
| RQ.S.02.2 | certificado no leído (informativo) | — | — |
| = RQ.S.02 | peso 0,40 | sin dato | — |
| RQ.S.03 | base de la higiene (máximo 70) | 70 | 17,50 |
| RQ.S.03.1 | TLS 1.3 en el sitio principal | 0 | 0,00 |
| RQ.S.03.2 | sin nombres no productivos en el registro | 0 | 0,00 |
| RQ.S.03.3 | 0 nombres de infraestructura en el registro (resta desde 3) | 0 | 0,00 |
| RQ.S.03.4 | sin nombres de legado en el registro | 0 | 0,00 |
| RQ.S.03.5 | security.txt no publicado (informativo) | — | — |
| = RQ.S.03 | peso 0,25 | 70/70 | 17,50 |
| RQ.S.04 | modelo del sector fintech | 65 | 16,25 |
| RQ.S.04.1 | años que el dato del sector debe seguir secreto | sin dato | — |
| RQ.S.04.2 | años que toma migrar en el sector | sin dato | — |
| RQ.S.04.3 | margen de Mosca | sin dato | — |
| = RQ.S.04 | peso 0,25 | 65/100 | 16,25 |
| RQ.S.05.1 | soporta X25519MLKEM768 | 100 | 10,00 |
| RQ.S.05.2 | lo elige por defecto (informativo) | — | — |
| RQ.S.05.3 | lo tiene en todos los nombres que responden (informativo) | — | — |
| = RQ.S.05 | peso 0,10 | 100/100 | 10,00 |
| = RQ.S.01 | suma de los aportes sobre peso 0,60 |  | 43,75 / 0,60 → 73 |

Máximo alcanzable desde afuera: 83,75 → 84.

## 03 Alertas
Sin hallazgos.

## 04 Qué hacer
| # | Acción | Resuelve | Efecto en la nota |
|---|---|---|---|
| H1 | Publicar security.txt | — | no cambia |

## 05 No medido
- Certificados y PKI no se pudo medir: sin esa dimensión la nota no puede ser A.
- La postura HNDL es el modelo del sector fintech, no una medición del dominio: tabla por sector fijada en la edición 2026-08; la derivación no está publicada.
- Lo interno (inventario, HSM, proveedores) no se ve desde afuera: por eso el tope es 84.
- No medido nunca significa no protegido.

## 06 Evidencia
- Instrumento: rosetta-sondas-envivo/1
- Versiones: QEX-1.0 · QREADY-NOTA-2.1
- Medido: 2026-11-16T18:56:39Z
- Huella CT: a4f6c0d7…713e · 1 cert.
- Huella de la foto: d716bd48…d06b
- Método: CT · DNS · saludos TLS sin sesión
- Rúbrica: https://rosettaquantum.com/es/metodologia/qex

## 07 Límites y siguiente paso
- Es la foto de un día, medida desde afuera; el tramo del borde al origen no es observable.
- Informe completo del dominio: https://rosettaquantum.com/es/q-ready/medicion/?dominio=rastreob.example&sector=fintech

rosetta-ficha/1 · Rosetta Quantum · medición independiente
```

## Ejemplo · rastreob · en

```markdown
# Rosetta Fact Sheet · Post-quantum security
**rastreob.example** · Fintech · country not determined · measured 2026-11-16 18:56 UTC · from outside, nothing installed

## 01 Verdict
| ID | Indicator | Value |
|---|---|---|
| RQ.S.00 | Q-Ready grade | **B** |
| RQ.S.01 | QEX index | 73/100 (external cap 84) |

Reading: Your site already uses the post-quantum lock, but its certificate could not be read.
Reference: a .example domain does not indicate a country; no comparison.
Publication: private. The owner has not activated its public page.

## 02 Indicators
| ID | Indicator | Value | Type |
|---|---|---|---|
| RQ.S.02 | Certificates and PKI | no data | not measured |
| RQ.S.03 | Surface hygiene | 70/70 | measured |
| RQ.S.04 | HNDL posture | 65/100 | model |
| RQ.S.05 | PQC at the edge | 100/100 | measured |
| RQ.S.06 | Post-quantum email | no MX published | measured |
| RQ.S.07 | Certificate validity | no data | not measured |
| RQ.S.08 | security.txt | not published | measured |
| RQ.S.09 | Exposed surface | no names probed | measured |

measured: observed today by the probe · model: sector value, not measured on the domain · not measured never means not protected

| ID | Rule | Dimension | QEX |
|---|---|---|---|
| RQ.S.02.1 | certificate not read | no data | — |
| RQ.S.02.2 | certificate not read (for information) | — | — |
| = RQ.S.02 | weight 0.40 | no data | — |
| RQ.S.03 | hygiene base (maximum 70) | 70 | 17.50 |
| RQ.S.03.1 | TLS 1.3 on the main site | 0 | 0.00 |
| RQ.S.03.2 | no non-production names in the log | 0 | 0.00 |
| RQ.S.03.3 | 0 infrastructure names in the log (deducts from 3) | 0 | 0.00 |
| RQ.S.03.4 | no legacy names in the log | 0 | 0.00 |
| RQ.S.03.5 | security.txt not published (for information) | — | — |
| = RQ.S.03 | weight 0.25 | 70/70 | 17.50 |
| RQ.S.04 | fintech sector model | 65 | 16.25 |
| RQ.S.04.1 | years the sector's data must stay secret | no data | — |
| RQ.S.04.2 | years the sector takes to migrate | no data | — |
| RQ.S.04.3 | Mosca margin | no data | — |
| = RQ.S.04 | weight 0.25 | 65/100 | 16.25 |
| RQ.S.05.1 | supports X25519MLKEM768 | 100 | 10.00 |
| RQ.S.05.2 | chooses it by default (for information) | — | — |
| RQ.S.05.3 | has it on every name that answers (for information) | — | — |
| = RQ.S.05 | weight 0.10 | 100/100 | 10.00 |
| = RQ.S.01 | sum of contributions over weight 0.60 |  | 43.75 / 0.60 → 73 |

Highest reachable from outside: 83.75 → 84.

## 03 Alerts
No findings.

## 04 What to do
| # | Action | Resolves | Effect on the grade |
|---|---|---|---|
| H1 | Publish security.txt | — | no change |

## 05 Not measured
- Certificates and PKI could not be measured: without that dimension the grade cannot be A.
- HNDL posture is the fintech sector model, not a measurement of the domain: a per-sector table fixed in the 2026-08 edition; the derivation is not published.
- What is internal (inventory, HSM, providers) cannot be seen from outside: that is why the cap is 84.
- Not measured never means not protected.

## 06 Evidence
- Instrument: rosetta-sondas-envivo/1
- Versions: QEX-1.0 · QREADY-NOTA-2.1
- Measured: 2026-11-16T18:56:39Z
- CT fingerprint: a4f6c0d7…713e · 1 cert.
- Snapshot fingerprint: d716bd48…d06b
- Method: CT · DNS · TLS handshakes without a session
- Rubric: https://rosettaquantum.com/methodology/qex

## 07 Limits and next step
- It is a one-day snapshot, measured from outside; the edge-to-origin leg is not observable.
- Full report for the domain: https://rosettaquantum.com/q-ready/medicion/?dominio=rastreob.example&sector=fintech

rosetta-ficha/1 · Rosetta Quantum · independent measurement
```

