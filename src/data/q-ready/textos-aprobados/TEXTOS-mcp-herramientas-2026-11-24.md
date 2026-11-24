# Descripciones de herramientas del MCP · APROBADAS (24-nov-2026)

Nicholas, 24-nov-2026: «Sí, tal cual» (descubrir_proveedores) y «Sí, apruebo y sube» (iniciar_verificacion y verificar_dominio).
Generado desde api.js tal como se sirve en tools/list (español; el MCP no sirve estas descripciones en inglés).

## iniciar_verificacion

Q-Ready Verified, paso 1: inicia la verificación de un dominio y entrega el registro TXT que su dueño tiene que publicar en el DNS (`_qready.<dominio>` y su valor). Iniciar no prueba nada: el dominio queda verificado sólo cuando ese TXT aparece en su DNS (paso 2: verificar_dominio con el token). Topes: 3 pedidos por hora por dominio y 10 por hora por origen; el token caduca a las 72 horas si no se verifica. Con `publico`: true, la nota se publica con página y sello cuando el dominio quede verificado.

## verificar_dominio

Q-Ready Verified, paso 2 y consulta. Con `token` (el que entregó iniciar_verificacion o la página): comprueba ahora el TXT en el DNS, igual que el botón «Comprobar»; si está, el dominio queda verificado y Rosetta lo mide cada día. Sin `token`: dice si el dominio tiene nota pública, con su página y su sello. No revela si un dominio está verificado en privado. La nota pública se lee con get_qready_grade.

## descubrir_proveedores

RQ.T: descubre los proveedores de un dominio desde su superficie PÚBLICA, sin tocar al cliente: operador del borde (CNAME y ASN), correo (MX), envío autorizado (SPF y DKIM), DNS autoritativo (NS), emisores de certificados (CT y CAA), subdominios delegados a un SaaS (CT → CNAME) y TXT de verificación de SaaS. Sólo DNS y registro público de certificados: ningún GET, ningún saludo TLS. Cada fila dice de qué señal salió (RQ.T.01–07). «sin dato» nunca es cero. Con `declarados`, cuenta los descubiertos que no estaban en esa lista.

