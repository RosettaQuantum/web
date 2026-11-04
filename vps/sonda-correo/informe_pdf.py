#!/usr/bin/env python3
"""El informe por correo (3-nov-2026): toma un pedido de la cola del sitio, arma el PDF y lo envía.

Corre en Contabo, junto a la sonda de correo y con la misma clave de firma. El PDF se arma aquí
y no en el sitio porque los informes de cliente nunca se sirven desde la web (decisión de
Nicholas, 21-ago). Lo envía Resend desde informes@rosettaquantum.com.

    python3 informe_pdf.py --pdf foto.json salida.pdf     # arma un PDF a mano (ensayo, sin enviar)
    python3 informe_pdf.py --trabajar https://rosettaquantum.com

Todo texto que lee el cliente vive en TEXTOS, arriba: es lo que aprueba Nicholas.
Regla que no se rompe: lo no medido se escribe «no medido», nunca «clásico» ni «no protegido».
"""
import base64, html, json, os, sys, time, urllib.request
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
        "Cada mes volveremos a medir su dominio y le escribiremos sólo si algo cambia. "
        "También le enviaremos el informe mensual de la gran empresa chilena.\n\n"
        "La foto sellada va adjunta: súbala en rosettaquantum.com/es/q-ready/medicion/ para compararla con su próxima medición.\n\n"
        "Rosetta Quantum\n\n"
        "Para no recibir más correos sobre este dominio: {baja}"
    ),
    "titulo": "Exposición post-cuántica de {dominio}",
    "sub": "Medido desde afuera el {fecha} · QEX {qex} de 100 (lo máximo medible desde afuera es 84)",
    "p1": "1 · Qué tiene hoy",
    "p2": "2 · Qué significa",
    "p2_debil": "Su canal más débil es {canal}. Lo que viaja por ahí hoy puede copiarse y guardarse para leerlo cuando exista un computador cuántico suficiente («cosechar ahora, descifrar después»).",
    "p2_fuerte": "Su sitio y su correo ya negocian el intercambio post-cuántico: lo que se copie hoy no se podrá leer mañana. Lo que queda está en su certificado y en lo que no se ve desde afuera.",
    "p2_nm": "Algún canal quedó sin medir. No lo leemos como protegido ni como expuesto.",
    "p3": "3 · Por qué importa ahora",
    "p3_txt": "NIST depreca ECDSA y RSA de cualquier tamaño después de 2030 y los prohíbe después de 2035 (NIST IR 8547, versión final). Si un dato debe seguir siendo secreto más allá del día en que exista la máquina, el riesgo empezó hoy. Ninguna fecha es un plazo garantizado.",
    "p4": "La prueba",
    "p4_txt": "Huella sha256 de la foto de esta medición: {sha}. Cualquier cambio de un carácter cambia la huella. La foto va adjunta a este correo.",
    "alcance": "Alcance: medimos sólo lo que cualquiera puede ver desde afuera. El tramo de su borde a su servidor de origen, sus HSM y la criptografía interna no son observables. «No medido» significa que no pudimos medir, nunca que no esté protegido.",
}

CANALES = ("Sitio web", "Correo entrante", "Endpoints sensibles", "Certificado")


def _fecha(iso):
    return datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(timezone.utc).strftime("%d-%m-%Y %H:%M UTC")


def canales(foto, correo):
    """Las mismas reglas que medicion-historia.mjs: (nombre, estado si/no/nm/info, etiqueta, texto)."""
    b = foto.get("borde") or {}
    web = "si" if b.get("soporta") is True else "no" if b.get("soporta") is False else "nm"
    srv = (correo or {}).get("resultado", {}).get("servidores", []) if (correo or {}).get("estado") == "hecho" else []
    med = [m for m in srv if m["veredicto"]["estado"] == "medido"]
    pq = [m for m in med if m["veredicto"]["soporta"] is True]
    cor = "nm" if not med else "si" if len(pq) == len(med) else "no"
    e = foto.get("endpoints") or []
    c = foto.get("certificado") or {}
    alg = f"{'ECDSA' if c.get('algoritmo') == 'EC' else c.get('algoritmo')} {c.get('curva') or (str(c.get('bits')) + ' bits' if c.get('bits') else '')}".strip() if c.get("ok") else None
    et = {"si": "post-cuántico", "no": "clásico", "nm": "no medido"}
    return [
        ("Sitio web", web, et[web], f"{foto['www']} {'negocia' if web == 'si' else 'no acepta' if web == 'no' else 'no pudo medirse para'} el intercambio híbrido X25519MLKEM768."),
        ("Correo entrante", cor, et[cor], "No pudimos medir el cifrado de su correo." if cor == "nm"
            else f"Sus {len(med)} servidores de correo medidos aceptan el intercambio híbrido." if cor == "si"
            else f"{len(pq)} de {len(med)} servidores de correo aceptan el intercambio híbrido." if pq
            else f"Ninguno de sus {len(med)} servidores de correo acepta el intercambio híbrido."),
        ("Endpoints sensibles", "info", f"{len(e)} revisados", (lambda n: f"{n} responde en el puerto 443." if n == 1 else f"{n} responden en el puerto 443.")(sum(1 for x in e if x.get("responde_443") is True))),
        ("Certificado", "no" if alg else "nm", alg or "no leído", "NIST lo depreca después de 2030, con cualquier curva o tamaño." if alg else "No pudimos leer el certificado."),
    ]


def lectura(cs):
    est = {n: s for n, s, _, _ in cs}
    debil = next((n for n in ("Correo entrante", "Sitio web") if est[n] == "no"), None)
    if debil: return TEXTOS["p2_debil"].format(canal="el correo" if debil == "Correo entrante" else "el sitio web")
    if est["Sitio web"] == "si" and est["Correo entrante"] == "si": return TEXTOS["p2_fuerte"]
    return TEXTOS["p2_nm"]


def html_informe(foto, correo):
    e = lambda s: html.escape(str(s))  # noqa: E731
    cs = canales(foto, correo)
    q = foto.get("qex") or {}
    color = {"si": "#0C7268", "no": "#B4432F", "nm": "#6B6E72", "info": "#6B6E72"}
    filas = "".join(f'<tr><td class="q">{e(n)}</td><td><span class="chip" style="color:{color[s]};border-color:{color[s]}">{e(t)}</span></td><td>{e(x)}</td></tr>' for n, s, t, x in cs)
    T = TEXTOS
    return f"""<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
@page {{ size: A4; margin: 20mm 18mm; @bottom-right {{ content: counter(page) " / " counter(pages); font: 8pt sans-serif; color: #6B6E72 }} }}
body {{ font: 10pt/1.5 "DejaVu Sans", sans-serif; color: #16181B }}
.marca {{ font: 8pt monospace; letter-spacing: .08em; text-transform: uppercase; color: #0C7268 }}
h1 {{ font: 500 22pt/1.1 "DejaVu Serif", serif; margin: 6pt 0 4pt }}
h2 {{ font: 600 12pt "DejaVu Serif", serif; margin: 18pt 0 6pt; border-top: 1px solid #D9DBD6; padding-top: 10pt }}
.sub {{ color: #4A4D52 }} table {{ width: 100%; border-collapse: collapse }} td {{ padding: 6pt 4pt; border-bottom: 1px solid #D9DBD6; vertical-align: top }}
.q {{ font: 8pt monospace; text-transform: uppercase; color: #4A4D52; width: 28% }} .chip {{ font: 8pt monospace; border: 1px solid; padding: 1pt 4pt; white-space: nowrap }}
.sha {{ font: 8pt monospace; word-break: break-all }} .alc {{ font-size: 8pt; color: #4A4D52; margin-top: 18pt }}
</style></head><body>
<p class="marca">Rosetta Quantum · Q-Ready · medición en vivo</p>
<h1>{e(T['titulo'].format(dominio=foto['dominio']))}</h1>
<p class="sub">{e(T['sub'].format(fecha=_fecha(foto['medido_utc']), qex=q.get('score', '—')))}</p>
<h2>{e(T['p1'])}</h2><table>{filas}</table>
<h2>{e(T['p2'])}</h2><p>{e(lectura(cs))}</p>
<h2>{e(T['p3'])}</h2><p>{e(T['p3_txt'])}</p>
<h2>{e(T['p4'])}</h2><p>{e(T['p4_txt'].split('{sha}')[0])}<span class="sha">{e(foto['sha256'])}</span>{e(T['p4_txt'].split('{sha}')[1])}</p>
<p class="alc">{e(T['alcance'])}</p>
</body></html>"""


def pdf(foto, correo):
    from weasyprint import HTML  # sólo en la imagen rosetta-informe-pdf
    return HTML(string=html_informe(foto, correo)).write_pdf()


def correo_de(url):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"user-agent": "rosetta-informe-pdf/1"}), timeout=15) as r:
            return json.loads(r.read())
    except Exception:
        return None


def enviar(destino, foto, correo, pdf_bytes, baja):
    if not RESEND: raise RuntimeError("falta RESEND_API_KEY")
    fecha = _fecha(foto["medido_utc"])
    cuerpo = {
        "from": REMITENTE, "to": [destino], "reply_to": RESPONDER_A,
        "subject": TEXTOS["asunto"].format(dominio=foto["dominio"], fecha=fecha),
        "text": TEXTOS["correo"].format(dominio=foto["dominio"], fecha=fecha, lectura=lectura(canales(foto, correo)), baja=baja or RESPONDER_A),
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
        correo = correo_de(f"{base}/api/sondas/correo/{t['correo_id']}") if t.get("correo_id") else None
        rid = enviar_fn(t["email"], t["foto"], correo, pdf_fn(t["foto"], correo), t.get("baja"))
        r = {"ok": True, "detalle": f"resend {rid}"}
    except Exception as e:
        r = {"ok": False, "detalle": f"{type(e).__name__}: {e}"[:300]}
    cuerpo = json.dumps(r, ensure_ascii=False, separators=(",", ":"))
    st, _ = S.llamar(base, "POST", f"/api/medicion/envio/{t['id']}/resultado", cuerpo)
    return f"{'enviado' if r['ok'] else 'fallido'} {t['dominio']} {st}"


if __name__ == "__main__":
    if len(sys.argv) == 4 and sys.argv[1] == "--pdf":
        foto = json.load(open(sys.argv[2], encoding="utf-8"))
        open(sys.argv[3], "wb").write(pdf(foto, None)); print("ok", sys.argv[3])
    elif len(sys.argv) == 3 and sys.argv[1] == "--trabajar":
        fin = time.time() + 55          # el cron lo lanza cada minuto; flock evita dos a la vez
        while time.time() < fin:
            print(datetime.now(timezone.utc).isoformat(timespec="seconds"), una_vuelta(sys.argv[2]), flush=True)
            time.sleep(S.POLL)
    else:
        print(__doc__); sys.exit(2)
