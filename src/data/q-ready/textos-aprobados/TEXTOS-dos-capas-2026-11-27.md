# Textos de las dos capas · APROBADOS por Nicholas el 27-nov-2026

27-nov-2026. Todo lo que un lector va a ver con la regla nueva. Nada de esto está publicado: vive en una rama local y la batería de chequeos no deja subirlo hasta registrar tu aprobación.

---

## 1 · La rúbrica pública (`/es/metodologia/qex`): tres entradas cambian

**RQ.S.09.1 · Ambiente de pruebas expuesto.** Cambia «Método».
- Antes: «Se sondea primero. Con el dueño verificado se pide la raíz: 2xx, 3xx, 401, cualquier otro código o ninguno = abierto. Límite: hasta el tope de nombres sondeados.»
- Ahora: «Se sondea primero y se pide la raíz sin seguir redirecciones: 2xx, 3xx, 401 (pide clave), 5xx o ningún código = abierto. Límite: hasta el tope de nombres sondeados.»

**RQ.S.09.2 · Ambiente de pruebas con el acceso bloqueado.** Cambian «Qué se observa» y «Método».
- Qué se observa, antes: «Un ambiente de pruebas que responde en 443 y devuelve 403 en la raíz.»
- Qué se observa, ahora: «Un ambiente de pruebas que responde en 443 y devuelve un código 4xx en la raíz que no sea 401 (400, 403, 404…): no entrega contenido.»
- Método, antes: «Sólo con el dueño verificado se pide la raíz.»
- Método, ahora: «Se pide la raíz sin seguir redirecciones y se guarda sólo el código.»

**RQ.S.09.3 · Ambiente de pruebas publicado, sin consultar la raíz.** Queda sólo para fotos viejas.
- Qué se observa, ahora: «Un ambiente de pruebas que completa el saludo TLS, en una foto anterior al 27-nov-2026, cuando la raíz sólo se pedía con dueño verificado.»
- Método, ahora: «La foto no registró el código: no se sabe si está abierto o bloqueado.»

Las tres van también en inglés, con la misma redacción.

**El 401.** Decidido el 27-nov: sigue como expuesto (F), como se resolvió el 16-nov. Una pantalla de clave a la vista es una puerta para intentar entrar.

## 2 · La versión de la nota pasa a QREADY-NOTA-2.2

Aparece en el texto de la herramienta MCP y en la línea «Cómo sale la letra» de la ficha. Sólo cambia el número, de 2.1 a 2.2. Cambia porque la regla cambió resultados: un ambiente de pruebas que responde 400 o 404 ya no da F.

## 3 · Página nueva: «Quién mide y cómo» (`/es/q-ready/quien-mide/`)

> **Quién mide y cómo**
>
> Rosetta Quantum mide la preparación post-cuántica de sitios y servicios públicos. Si vio una conexión nuestra en sus registros, aquí está qué hicimos y cómo pedir que no lo volvamos a hacer.
>
> **Qué miramos, sin pedir autorización.** Sólo lo que su servidor le entrega a cualquier visitante antes de pedir una clave:
> - sus nombres en el registro público de certificados y en el DNS;
> - el saludo TLS de su sitio y de esos nombres: qué cifrado ofrecen y qué certificado entregan;
> - el código de respuesta de su página principal, sin seguir redirecciones y sin guardar el contenido;
> - el cifrado de su correo entrante, sin enviar ningún mensaje;
> - el saludo de SSH y de sus servicios públicos con TLS.
>
> **Qué nunca hacemos.** No usamos claves ni intentamos entrar. No buscamos ni explotamos fallas. No seguimos una pantalla de inicio de sesión. No guardamos contenido. No generamos más carga que unas pocas visitas.
>
> **Cómo reconocernos.** Nuestras conexiones web dicen `RosettaQ-Ready/1.0 (+https://rosettaquantum.com/es/q-ready/quien-mide/)`. Nuestro servidor de medición es 45.88.191.121.
>
> **Cada cuánto.** El estudio mensual mide cada organización una vez al mes. La página pública mide a pedido de quien la usa, con un límite por visitante.
>
> **Qué publicamos.** Las cifras por país y por sector, siempre anónimas. El informe completo de una organización sólo se entrega a esa organización. Su nota sólo se publica si ella decide publicarla.
>
> **Pedir que no lo midamos.** Escriba su dominio y un correo de ese dominio. Le enviamos un enlace; al confirmarlo, dejamos de medirlo a usted y a sus subdominios, a más tardar en 24 horas. Puede deshacerlo cuando quiera.
>
> [ Dominio ] [ Correo del dominio ] [ Pedir la exclusión ]
>
> **Medición más profunda.** Si quiere que midamos más —todos sus nombres, más puertos y una medición diaria—, verifique su dominio y autorícelo.
>
> **Contacto:** hello@rosettaquantum.com

Va en inglés en `/q-ready/quien-mide/`, con la misma redacción.

## 4 · El casillero de la capa 2, en la página de verificación

Ya aprobado en la regla v2. Lo único nuevo es el texto en inglés:

> ☐ I authorize Rosetta Quantum to measure this domain in depth, under the terms of the authorization.

Los términos van en `/es/q-ready/autorizacion/`, tal como están en la sección 5 de la regla v2, y en inglés en `/q-ready/autorizacion/`.

## 5 · El pedido del informe completo con correo de la empresa (etapa 2)

Lo redacto cuando la etapa 1 esté arriba. Te lo muestro aparte.
