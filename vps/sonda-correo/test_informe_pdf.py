#!/usr/bin/env python3
"""Pruebas de informe_pdf.py. Corre con: python3 -I vps/sonda-correo/test_informe_pdf.py

No arma PDFs (weasyprint vive sólo en la imagen de Contabo). Desde el 16-nov-2026 el PDF es la ficha
rosetta-ficha/1 que arma el Worker (ficha.mjs → htmlDe): aquí se prueba que se usa ESA ficha y ninguna
otra (sin ficha_html no se arma nada a mano), que el correo lleva la lectura de la ficha, y el trabajador
contra un sitio falso que verifica la firma por su cuenta. La ficha de prueba la arma node con la MISMA
función del Worker (scripts/ficha-html.mjs → fichaDelTrabajo), desde una foto fija del repo.
La foto de la cola es la real del 29-oct de un banco chileno, anonimizada (dominio y nombres cambiados, huella recalculada).
"""
import hashlib, hmac, json, os, re, subprocess, sys, threading, time
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

AQUI = Path(__file__).resolve().parent
os.environ["SONDA_CORREO_CLAVE"] = "k" * 48
import tempfile  # noqa: E402
os.environ["INFORME_ENVIOS_HORA"] = str(Path(tempfile.mkdtemp()) / "envios-hora.json")
sys.path.insert(0, str(AQUI))
import sonda_correo as S  # noqa: E402
import informe_pdf as I  # noqa: E402
S.CLAVE = "k" * 48

pasa = falla = 0
def _lanza(f):
    try: f(); return "no lanzó"
    except Exception as e: return type(e).__name__
def prueba(nombre, f):
    global pasa, falla
    try: f(); pasa += 1; print(f"  ok    {nombre}")
    except Exception as e: falla += 1; print(f"  FALLA {nombre}: {e}")
def igual(a, b, q=""):
    if a != b: raise AssertionError(f"{q}: {a!r} ≠ {b!r}")

FOTO = json.loads((AQUI / "fijas" / "foto-anonima-2026-10.json").read_text())

# --- la ficha: la MISMA que arma el Worker (node, scripts/ficha-html.mjs), no una propia
RAIZ = AQUI.parent.parent
TRABAJO = json.loads(subprocess.run(["node", str(RAIZ / "scripts" / "ficha-html.mjs"), str(RAIZ / "scripts" / "fixtures" / "ficha" / "f.json")],
                                    check=True, capture_output=True, text=True).stdout)
H = TRABAJO["ficha_html"]
prueba("silencio: con ficha_html, el PDF se arma con ESE HTML, tal cual", lambda: igual(I.html_de_trabajo(TRABAJO), H))
prueba("la ficha trae las 7 secciones 01..07 en orden", lambda: igual(
    [m for m in re.findall(r'<span class="rf-num">(\d\d)</span>', H)], ["01", "02", "03", "04", "05", "06", "07"]))
prueba("la ficha trae los IDs RQ.S.00 a RQ.S.09", lambda: igual(all(f"RQ.S.0{i}" in H for i in range(10)), True))
prueba("dominio no verificado: el PDF no trae el nombre de pruebas completo", lambda: igual(("staging." in H, "s•••" in H), (False, True)))
prueba("grito: sin ficha_html no se arma un PDF a mano", lambda: igual(_lanza(lambda: I.html_de_trabajo({"foto": FOTO})), "RuntimeError"))
prueba("grito: un HTML que no es la ficha tampoco", lambda: igual(_lanza(lambda: I.html_de_trabajo({"ficha_html": "<html>otro informe</html>"})), "RuntimeError"))
prueba("ya no existe el informe propio (canales, lectura, html_informe)", lambda: igual(
    [n for n in ("canales", "lectura", "html_informe", "CANALES") if hasattr(I, n)], []))
prueba("el correo lleva la lectura de la ficha", lambda: igual(TRABAJO["lectura"] in I.TEXTOS["correo"].format(
    dominio="x", fecha="y", lectura=TRABAJO["lectura"], baja="z"), True))
prueba("ninguna palabra sin tilde de las de siempre en los textos", lambda: igual(
    [w for w in ("medicion", "cuantico", "tecnica", "numero", "publico") if w in re.sub(r"\S*\.(?:com|cl)\S*", "", json.dumps(I.TEXTOS, ensure_ascii=False).lower())], []))

# La medición mensual no existe todavía (4-nov): el correo no la promete. Cuando exista, esta
# prueba se cambia junto con el texto, no antes.
prueba("el correo no promete una medición mensual que aún no corre", lambda: igual(
    [w for w in ("cada mes", "informe mensual") if w in I.TEXTOS["correo"].lower()], []))

# --- el trabajador, contra un sitio falso que verifica la firma por su cuenta
CLAVE_T = "k" * 48
visto = {"cola": [], "entregas": [], "firmas_malas": 0}
class Falso(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def _ok(self, cuerpo):
        ts = self.headers.get("x-ts", "")
        esp = hmac.new(CLAVE_T.encode(), f"{self.command}\n{self.path}\n{ts}\n{cuerpo}".encode(), hashlib.sha256).hexdigest()
        ok = hmac.compare_digest(self.headers.get("x-firma", ""), esp) and abs(time.time() - int(ts)) < 120
        if not ok: visto["firmas_malas"] += 1
        return ok
    def do_GET(self):
        if not self._ok(""): self.send_response(401); self.end_headers(); return
        if not visto["cola"]: self.send_response(204); self.end_headers(); return
        b = json.dumps(visto["cola"].pop(0)).encode()
        self.send_response(200); self.send_header("content-length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_POST(self):
        c = self.rfile.read(int(self.headers["content-length"])).decode()
        if not self._ok(c): self.send_response(401); self.end_headers(); return
        visto["entregas"].append((self.path, json.loads(c)))
        self.send_response(200); self.send_header("content-length", "2"); self.end_headers(); self.wfile.write(b"{}")
srv = ThreadingHTTPServer(("127.0.0.1", 0), Falso)
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f"http://127.0.0.1:{srv.server_address[1]}"
ID = "0b6c1d2e-3f40-4a5b-8c6d-7e8f90a1b2c3"
enviados = []
def falso_envio(email, t, pdf_bytes, baja): enviados.append((email, t.get("lectura"), pdf_bytes, baja)); return "re_123"
def trabajo(**k): return {"id": ID, "email": "a@ejemplo.cl", "dominio": "bancoejemplo.cl", "foto": FOTO, "correo_id": None, "baja": None,
                          "ficha_html": H, "lectura": TRABAJO["lectura"], **k}

prueba("sin pedidos: no envía nada", lambda: igual(I.una_vuelta(BASE, enviar_fn=lambda *a: 1 / 0, pdf_fn=lambda *a: b""), "nada"))
def _envio():
    visto["cola"].append(trabajo(baja="https://x/baja?t=1"))
    pdfs = []
    I.una_vuelta(BASE, enviar_fn=falso_envio, pdf_fn=lambda t: (pdfs.append(I.html_de_trabajo(t)), b"%PDF")[1])
    igual((enviados[-1][0], enviados[-1][1], enviados[-1][3], pdfs[-1] == H), ("a@ejemplo.cl", TRABAJO["lectura"], "https://x/baja?t=1", True))
    igual(visto["entregas"][-1], (f"/api/medicion/envio/{ID}/resultado", {"ok": True, "detalle": "resend re_123"}))
prueba("con un pedido: arma el PDF con la ficha del trabajo, envía con su lectura y entrega «enviado»", _envio)
def _sin_ficha():
    t = trabajo(); del t["ficha_html"]; visto["cola"].append(t)
    n0 = len(enviados)
    I.una_vuelta(BASE, enviar_fn=falso_envio, pdf_fn=I.pdf)
    igual((len(enviados) - n0, visto["entregas"][-1][1]["ok"], "ficha" in visto["entregas"][-1][1]["detalle"]), (0, False, True))
prueba("grito: un trabajo sin ficha (Worker viejo) no se envía y se entrega «fallido» con la causa", _sin_ficha)
def _falla():
    visto["cola"].append(trabajo())
    I.una_vuelta(BASE, enviar_fn=lambda *a: (_ for _ in ()).throw(RuntimeError("falta RESEND_API_KEY")), pdf_fn=lambda t: b"%PDF")
    igual((visto["entregas"][-1][1]["ok"], "RESEND" in visto["entregas"][-1][1]["detalle"]), (False, True))
prueba("si el envío revienta, se entrega «fallido» con la causa (no se calla)", _falla)
def _tope():
    # El defecto real: el cron relanza el proceso cada minuto. El tope tiene que sobrevivir a eso,
    # así que se simula un proceso nuevo por pedido recargando el módulo.
    import importlib
    Path(os.environ["INFORME_ENVIOS_HORA"]).write_text(json.dumps([time.time()] * (I.TOPE_POR_HORA - 1)))
    n0 = len(enviados)
    for _ in range(2):
        importlib.reload(I)
        visto["cola"].append(trabajo())
        I.una_vuelta(BASE, enviar_fn=falso_envio, pdf_fn=lambda t: b"%PDF")
    igual(len(enviados) - n0, 1, "envíos con un solo cupo libre")
    igual("tope" in visto["entregas"][-1][1]["detalle"], True, "el segundo se entrega fallido por tope")
prueba("el tope por hora sobrevive a que el cron relance el proceso", _tope)
prueba("silencio: con la hora vacía el tope no frena", lambda: (Path(os.environ["INFORME_ENVIOS_HORA"]).write_text("[]"),
    visto["cola"].append(trabajo()),
    igual(I.una_vuelta(BASE, enviar_fn=falso_envio, pdf_fn=lambda t: b"%PDF").startswith("enviado"), True)))
prueba("todas las firmas que mandó el trabajador fueron válidas", lambda: igual(visto["firmas_malas"], 0))
srv.shutdown()

print(f"\ncheck-informe-pdf: {pasa} pasaron, {falla} fallaron, 0 saltadas")
sys.exit(1 if falla else 0)
