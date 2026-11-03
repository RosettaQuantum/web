#!/usr/bin/env python3
"""Pruebas de informe_pdf.py. Corre con: python3 -I vps/sonda-correo/test_informe_pdf.py

No arma PDFs (weasyprint vive sólo en la imagen de Contabo): prueba la lectura de canales, el
texto que sale de ella, y el trabajador contra un sitio falso que verifica la firma por su cuenta.
La foto es la real del 29-oct de un banco chileno, anonimizada (dominio y nombres cambiados, huella recalculada).
"""
import hashlib, hmac, json, os, re, sys, threading, time
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

AQUI = Path(__file__).resolve().parent
os.environ["SONDA_CORREO_CLAVE"] = "k" * 48
sys.path.insert(0, str(AQUI))
import sonda_correo as S  # noqa: E402
import informe_pdf as I  # noqa: E402
S.CLAVE = "k" * 48

pasa = falla = 0
def prueba(nombre, f):
    global pasa, falla
    try: f(); pasa += 1; print(f"  ok    {nombre}")
    except Exception as e: falla += 1; print(f"  FALLA {nombre}: {e}")
def igual(a, b, q=""):
    if a != b: raise AssertionError(f"{q}: {a!r} ≠ {b!r}")

FOTO = json.loads((AQUI / "fijas" / "foto-anonima-2026-10.json").read_text())
SANT = json.loads((AQUI / "fijas" / "bancoejemplo.cl.json").read_text())   # corrida real del correo, 2-nov
CORREO = {"estado": "hecho", "resultado": SANT}
est = lambda cs: {n: s for n, s, _, _ in cs}  # noqa: E731

# --- lectura: la misma regla que la página
prueba("banco: web post-cuántico, correo clásico (4 de 4 MX medidos, ninguno ofrece)",
       lambda: igual((est(I.canales(FOTO, CORREO))["Sitio web"], est(I.canales(FOTO, CORREO))["Correo entrante"]), ("si", "no")))
prueba("grito: el canal más débil es el correo", lambda: igual(I.lectura(I.canales(FOTO, CORREO)).startswith("Su canal más débil es el correo"), True))
prueba("silencio: sin medición de correo dice «no medido», nunca «clásico»",
       lambda: igual(est(I.canales(FOTO, None))["Correo entrante"], "nm"))
prueba("silencio: con un canal sin medir no se acusa a nadie", lambda: igual(I.lectura(I.canales(FOTO, None)), I.TEXTOS["p2_nm"]))
prueba("un MX rechazado (554) no cuenta como «no soporta»", lambda: igual(est(I.canales(FOTO, {"estado": "hecho", "resultado": {"servidores": [
    {"veredicto": {"estado": "rechazado", "soporta": None}}]}}))["Correo entrante"], "nm"))
prueba("el HTML lleva la huella entera de la foto", lambda: igual(FOTO["sha256"] in I.html_informe(FOTO, CORREO), True))
prueba("ninguna palabra sin tilde de las de siempre en los textos", lambda: igual(
    [w for w in ("medicion", "cuantico", "tecnica", "numero", "publico") if w in re.sub(r"\S*\.(?:com|cl)\S*", "", json.dumps(I.TEXTOS, ensure_ascii=False).lower())], []))

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
        if self.path.startswith("/api/sondas/correo/"):
            b = json.dumps(CORREO).encode(); self.send_response(200); self.send_header("content-length", str(len(b))); self.end_headers(); self.wfile.write(b); return
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
def falso_envio(email, foto, correo, pdf_bytes, baja): enviados.append((email, est(I.canales(foto, correo))["Correo entrante"], pdf_bytes, baja)); return "re_123"

prueba("sin pedidos: no envía nada", lambda: igual(I.una_vuelta(BASE, enviar_fn=lambda *a: 1 / 0, pdf_fn=lambda *a: b""), "nada"))
def _envio():
    visto["cola"].append({"id": ID, "email": "a@ejemplo.cl", "dominio": "bancoejemplo.cl", "foto": FOTO, "correo_id": "c" * 8 + "-0000-0000-0000-" + "0" * 12, "baja": "https://x/baja?t=1"})
    I.una_vuelta(BASE, enviar_fn=falso_envio, pdf_fn=lambda f, c: b"%PDF")
    igual((enviados[-1][0], enviados[-1][1], enviados[-1][3]), ("a@ejemplo.cl", "no", "https://x/baja?t=1"))
    igual(visto["entregas"][-1], (f"/api/medicion/envio/{ID}/resultado", {"ok": True, "detalle": "resend re_123"}))
prueba("con un pedido: lee el correo medido, arma, envía y entrega «enviado»", _envio)
def _falla():
    visto["cola"].append({"id": ID, "email": "a@ejemplo.cl", "dominio": "bancoejemplo.cl", "foto": FOTO, "correo_id": None, "baja": None})
    I.una_vuelta(BASE, enviar_fn=lambda *a: (_ for _ in ()).throw(RuntimeError("falta RESEND_API_KEY")), pdf_fn=lambda f, c: b"%PDF")
    igual((visto["entregas"][-1][1]["ok"], "RESEND" in visto["entregas"][-1][1]["detalle"]), (False, True))
prueba("si el envío revienta, se entrega «fallido» con la causa (no se calla)", _falla)
prueba("todas las firmas que mandó el trabajador fueron válidas", lambda: igual(visto["firmas_malas"], 0))
srv.shutdown()

print(f"\ncheck-informe-pdf: {pasa} pasaron, {falla} fallaron, 0 saltadas")
sys.exit(1 if falla else 0)
