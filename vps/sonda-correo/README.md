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
- A mano en el VPS, sin el sitio: `python3 -I sonda_correo.py --medir santander.cl`.

`rosetta-sonda-correo.service` es la alternativa con systemd; necesita sudo y no está instalada.
