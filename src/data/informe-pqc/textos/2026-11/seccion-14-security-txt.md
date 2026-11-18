# Sección 14 · el método del «Sin security.txt publicado»

Aprobado por Nicholas el 17-nov-2026: «Sí, apruébalo».

Estos dos párrafos van a la sección 14 del informe mensual, cada uno a su apartado.
Ni una palabra distinta.

## Qué hicimos

**Canal de reporte de seguridad.** Pedimos una sola dirección por sitio, `/.well-known/security.txt` (RFC 9116), en el dominio principal y en su `www`, sobre https y declarando quiénes somos en la petición: 402 consultas en total, una por nombre, sin reintentos. De las 220 organizaciones, 212 contestaron: 6 publican un security.txt con dirección de contacto y 206 no. El 97% se calcula sobre esas 212, no sobre las 220; las 8 que no alcanzamos a preguntar se declaran aparte y no entran al porcentaje.

## Qué NO hicimos

No medimos páginas de divulgación, buzones `security@` no anunciados ni canales publicados en PDF: una organización puede tener a quién avisarle y no publicar security.txt. Por eso la cifra dice «sin security.txt publicado» y no «sin canal de reporte». No pedimos ninguna otra dirección de estos sitios, no intentamos entrar a nada protegido, y las respuestas que negaron el acceso quedaron anotadas como lo que son, sin volver a pedirlas.
