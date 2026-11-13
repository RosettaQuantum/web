# Sonda de correo · VPS Contabo

Mide si los servidores de correo (MX) de un dominio ofrecen el intercambio post-cuántico
X25519MLKEM768 sobre STARTTLS. Corre en el VPS (45.88.191.121) porque Cloudflare no abre el
puerto 25 y su IP compartida es rechazada por Cisco IronPort (medido el 2-nov-2026).

**No abre puertos.** Pregunta al sitio cada 2 s si hay trabajo (`GET /api/sondas/correo/pendiente`)
y entrega firmado (`POST /api/sondas/correo/<id>/resultado`). Ver `lib/correo-envivo.mjs`.

## Instalar o actualizar (usuario nicholas, sin sudo)

1. `scp vps/sonda-correo/sonda_correo.py nicholas@45.88.191.121:rosetta-sonda-correo/`
2. `~/rosetta-sonda-correo/.env` (chmod 600) con `SONDA_CORREO_CLAVE`, `SONDA_IP_SALIDA`. La
   misma clave va como secreto del Worker: `wrangler secret put SONDA_CORREO_CLAVE`.
3. Una línea en el crontab del usuario mantiene un solo trabajador vivo (flock) y lo revive en un minuto si cae:

   `* * * * * cd ~/rosetta-sonda-correo && set -a && . ./.env && set +a && flock -n .lock python3 -I sonda_correo.py --trabajar https://rosettaquantum.com >> trabajador.log 2>&1`

## Probar

- `python3 -I vps/sonda-correo/test_sonda_correo.py` (también corre en el prebuild).
- A mano en el VPS, sin el sitio: `python3 -I sonda_correo.py --medir ejemplo.cl`.

`rosetta-sonda-correo.service` es la alternativa con systemd; necesita sudo y no está instalada.

## Sonda TLS (13-nov-2026) · `sonda_tls.py`

Saluda en el puerto 443 lo que el Worker no puede saludar (dominios detrás de Cloudflare): los tres
saludos TLS 1.3 del borde, un saludo TLS 1.2 para leer el certificado, y los saludos A y B por nombre.
Sin completar sesión. Misma cola firmada y MISMA clave (`SONDA_CORREO_CLAVE`) que la sonda de correo,
con rutas propias (`/api/sondas/tls/*`, ver `lib/sonda-tls-vps.mjs`): el trabajador de correo no la ve.
Importa `sonda_correo.py` (ClientHello y firma), así que las dos van en la misma carpeta.

1. `scp vps/sonda-correo/sonda_tls.py nicholas@45.88.191.121:rosetta-sonda-correo/`
2. Otra línea en el crontab, con su propio candado:

   `* * * * * cd ~/rosetta-sonda-correo && set -a && . ./.env && set +a && flock -n .lock-tls python3 -I sonda_tls.py --trabajar https://rosettaquantum.com >> trabajador-tls.log 2>&1`

3. Probar a mano en el VPS: `python3 -I sonda_tls.py --medir rosettaquantum.com`.
4. Revertir: borrar esa línea del crontab, `pkill -f "sonda_tls.py --trabajar"`, borrar `sonda_tls.py`.
   Sin latido, el sitio deja de esperar al VPS en un minuto (el borde vuelve a «no medido»).

Pruebas: `python3 -I vps/sonda-correo/test_sonda_tls.py` y `node scripts/check-sonda-tls.mjs` (en el prebuild).
