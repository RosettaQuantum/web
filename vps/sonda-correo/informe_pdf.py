#!/usr/bin/env python3
"""El informe por correo (3-nov-2026): toma un pedido de la cola del sitio, arma el PDF y lo envía.

Corre en Contabo, junto a la sonda de correo y con la misma clave de firma. El PDF se arma aquí
y no en el sitio porque los informes de cliente nunca se sirven desde la web (decisión de
Nicholas, 21-ago). Lo envía Resend desde informes@rosettaquantum.com.

    python3 informe_pdf.py --pdf trabajo.json salida.pdf  # arma el PDF de un trabajo (ensayo, sin enviar)
    python3 informe_pdf.py --trabajar https://rosettaquantum.com

EL PDF ES LA FICHA rosetta-ficha/1 (16-nov-2026). Antes este archivo armaba su propio informe: otra
estructura, otros textos y otras reglas que la página. Ahora el Worker arma la ficha con la MISMA función
que la web y los agentes (public/js/ficha.mjs → htmlDe, documento A4) y la manda en el trabajo
(`ficha_html`); aquí sólo se convierte a PDF. Sin `ficha_html` NO se arma nada a mano: el trabajo se
entrega fallido con la causa (orden de despliegue: primero el Worker, después esta imagen).

El texto del correo vive en TEXTOS, abajo: es lo que aprueba Nicholas. La lectura que va en el correo
es la de la ficha (`lectura` del trabajo), la misma frase que la página.
"""
import base64, json, os, sys, time, urllib.request
from pathlib import Path
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sonda_correo as S  # noqa: E402  (firma HMAC y llamadas firmadas: las mismas de la sonda)

RESEND = os.environ.get("RESEND_API_KEY", "")
REMITENTE = "Rosetta Quantum <informes@rosettaquantum.com>"
RESPONDER_A = "hello@rosettaquantum.com"
TOPE_POR_HORA = 20

TEXTOS = {
    "asunto": "Exposición post-cuántica de {dominio} · {fecha}",
    "correo": (
        "Adjuntamos el informe de {dominio}, medido el {fecha}.\n\n"
        "{lectura}\n\n"
        # Retirado el 4-nov por decisión de Nicholas: prometía una medición mensual que aún no
        # existe. Vuelve cuando la medición mensual corra: «Cada mes volveremos a medir su dominio
        # y le escribiremos sólo si algo cambia. También le enviaremos el informe mensual…»
        "La foto sellada va adjunta: súbala en rosettaquantum.com/es/q-ready/medicion/ para compararla con su próxima medición.\n\n"
        "Rosetta Quantum\n\n"
        "Para no recibir más correos sobre este dominio: {baja}"
    ),
}
PROTOCOLO = 'data-protocolo="rosetta-ficha/1"'


def _fecha(iso):
    return datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(timezone.utc).strftime("%d-%m-%Y %H:%M UTC")


def html_de_trabajo(t):
    """El HTML de la ficha que mandó el Worker. Falla cerrado: sin ficha no hay PDF."""
    h = t.get("ficha_html")
    if not isinstance(h, str) or PROTOCOLO not in h:
        raise RuntimeError("el trabajo no trae la ficha rosetta-ficha/1 (ficha_html): no se arma un PDF a mano")
    return h


def pdf(t):
    h = html_de_trabajo(t)       # primero la ficha: sin ella no se llega a armar nada
    from weasyprint import HTML  # sólo en la imagen rosetta-informe-pdf
    return HTML(string=h).write_pdf()


def enviar(destino, t, pdf_bytes, baja):
    if not RESEND: raise RuntimeError("falta RESEND_API_KEY")
    foto = t["foto"]
    fecha = _fecha(foto["medido_utc"])
    cuerpo = {
        "from": REMITENTE, "to": [destino], "reply_to": RESPONDER_A,
        "subject": TEXTOS["asunto"].format(dominio=foto["dominio"], fecha=fecha),
        "text": TEXTOS["correo"].format(dominio=foto["dominio"], fecha=fecha, lectura=t.get("lectura") or "", baja=baja or RESPONDER_A),
        "attachments": [
            {"filename": f"rosetta-qex-{foto['dominio']}-{foto['medido_utc'][:10]}.pdf", "content": base64.b64encode(pdf_bytes).decode()},
            {"filename": f"foto-{foto['dominio']}-{foto['medido_utc'][:10]}.json", "content": base64.b64encode(json.dumps(foto, ensure_ascii=False, indent=1).encode()).decode()},
        ],
        "headers": {"List-Unsubscribe": f"<{baja}>"} if baja else {},
    }
    r = urllib.request.Request("https://api.resend.com/emails", data=json.dumps(cuerpo).encode(), method="POST",
                               headers={"authorization": f"Bearer {RESEND}", "content-type": "application/json", "user-agent": "rosetta-informe-pdf/1"})
    with urllib.request.urlopen(r, timeout=30) as resp:
        return json.loads(resp.read()).get("id")


# El tope vive en un archivo, no en memoria: el cron relanza el proceso cada minuto, y una
# lista en memoria se vaciaba en cada vuelta (el tope era de 20 por minuto, no por hora).
# Se anota ANTES de enviar: un envío que revienta a mitad cuenta igual (registro, no recibo).
ENVIOS_HORA = os.environ.get("INFORME_ENVIOS_HORA", str(Path(__file__).resolve().parent / "envios-hora.json"))
def _envios_hora(ahora):
    try: xs = json.loads(Path(ENVIOS_HORA).read_text())
    except FileNotFoundError: xs = []
    return [x for x in xs if ahora - x < 3600]

def una_vuelta(base, enviar_fn=None, pdf_fn=None):
    """Toma a lo más un pedido y lo entrega. Devuelve lo que hizo (para el registro y las pruebas)."""
    enviar_fn, pdf_fn = enviar_fn or enviar, pdf_fn or pdf
    st, b = S.llamar(base, "GET", "/api/medicion/envio/pendiente")
    if st == 204: return "nada"
    t = json.loads(b)
    ahora = time.time()
    try:
        hora = _envios_hora(ahora)
        if len(hora) >= TOPE_POR_HORA: raise RuntimeError("tope por hora alcanzado: no enviado")
        Path(ENVIOS_HORA).write_text(json.dumps(hora + [ahora]))
        # la ficha (con el correo medido) la arma el Worker al entregar el trabajo: aquí sólo el PDF
        rid = enviar_fn(t["email"], t, pdf_fn(t), t.get("baja"))
        r = {"ok": True, "detalle": f"resend {rid}"}
    except Exception as e:
        r = {"ok": False, "detalle": f"{type(e).__name__}: {e}"[:300]}
    cuerpo = json.dumps(r, ensure_ascii=False, separators=(",", ":"))
    st, _ = S.llamar(base, "POST", f"/api/medicion/envio/{t['id']}/resultado", cuerpo)
    return f"{'enviado' if r['ok'] else 'fallido'} {t['dominio']} {st}"


if __name__ == "__main__":
    if len(sys.argv) == 4 and sys.argv[1] == "--pdf":
        t = json.load(open(sys.argv[2], encoding="utf-8"))
        open(sys.argv[3], "wb").write(pdf(t)); print("ok", sys.argv[3])
    elif len(sys.argv) == 3 and sys.argv[1] == "--trabajar":
        fin = time.time() + 55          # el cron lo lanza cada minuto; flock evita dos a la vez
        while time.time() < fin:
            print(datetime.now(timezone.utc).isoformat(timespec="seconds"), una_vuelta(sys.argv[2]), flush=True)
            time.sleep(S.POLL)
    else:
        print(__doc__); sys.exit(2)
