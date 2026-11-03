#!/usr/bin/env python3
"""Pruebas de sonda_correo.py. Corre con: python3 -I vps/sonda-correo/test_sonda_correo.py

Los casos salen de respuestas REALES, no inventadas:
  · fijas/*.json — corridas del 2-nov-2026 desde el VPS (santander.cl, gmail.com, outlook.com).
  · el 554 de reputación es el texto literal que Cisco le devolvió a Lab desde Cloudflare
    (handoff/producto/MEDICION-sonda-smtp-2026-11-02.json).
  · el ClientHello se compara byte a byte con probe_soporte.py, el instrumento de agosto.
"""
import hashlib, hmac, importlib.util, io, json, os, sys, threading, time, urllib.request, urllib.error
from pathlib import Path

AQUI = Path(__file__).resolve().parent
os.environ["SONDA_CORREO_CLAVE"] = "k" * 48
sys.path.insert(0, str(AQUI))
import sonda_correo as S  # noqa: E402

pasa = falla = 0
def prueba(nombre, f):
    global pasa, falla
    try: f(); pasa += 1; print(f"  ok    {nombre}")
    except Exception as e: falla += 1; print(f"  FALLA {nombre}: {e}")
def igual(a, b, q=""):
    if a != b: raise AssertionError(f"{q}: {a!r} ≠ {b!r}")

# --- 1. El ClientHello es el de agosto, byte a byte (con el azar en ceros).
#        Los bytes de referencia los produjo probe_soporte.py (fijas/clienthello-agosto.json),
#        así la prueba corre también donde el original no está (CI). Si el original está a
#        mano, se regenera y se compara con él, por si cambió.
REF = json.loads((AQUI / "fijas" / "clienthello-agosto.json").read_text())
for nombre, grupos, share in [("A", S.TODOS, True), ("B", S.SOLO_HIB, False), ("C", S.LIBRE, False)]:
    prueba(f"ClientHello {nombre} idéntico al de probe_soporte.py",
           lambda n=nombre, g=grupos, sh=share: igual(S.hello("mx.ejemplo.cl", g, sh, azar=lambda k: bytes(k)).hex(), REF[n], n))
ORIGINAL = AQUI.parents[3] / "probe_soporte.py"
if ORIGINAL.exists():
    def _regenera():
        spec = importlib.util.spec_from_file_location("probe_soporte", ORIGINAL)
        m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); m.os.urandom = lambda n: bytes(n)
        igual(m.hello("mx.ejemplo.cl", S.SOLO_HIB, False).hex(), REF["B"], "original regenerado")
    prueba("el original de agosto, regenerado aquí, sigue dando los mismos bytes", _regenera)

# Los tres juegos de grupos son los MISMOS que usa el borde web (lib/borde-envivo.mjs). Si uno
# cambia y el otro no, el correo y el sitio dejarían de medir lo mismo con el mismo nombre.
import re as _re
_js = (AQUI.parents[1] / "lib" / "borde-envivo.mjs").read_text()
def _grupos_js(nombre):
    m = _re.search(r"const " + nombre + r" = \[([^\]]*)\]", _js)
    if not m: raise AssertionError(f"no encontré {nombre} en borde-envivo.mjs")
    return [int(x, 16) for x in _re.findall(r"0x[0-9a-fA-F]+", m.group(1))]
for _n in ("TODOS", "SOLO_HIB", "LIBRE"):
    prueba(f"grupos {_n} iguales a los del borde web", lambda n=_n: igual(getattr(S, n), _grupos_js(n), n))

# --- 2. Las corridas reales se vuelven a juzgar igual, y dicen lo que deben decir.
fijas = {p.stem: json.loads(p.read_text()) for p in (AQUI / "fijas").glob("*.json") if p.stem != "clienthello-agosto" and not p.stem.startswith("foto-")}
prueba("hay tres corridas reales guardadas", lambda: igual(sorted(fijas), ["gmail.com", "outlook.com", "santander.cl"]))
for dom, j in fijas.items():
    prueba(f"{dom}: el veredicto guardado sale otra vez de sus saludos", lambda j=j: [
        igual(S.veredicto(*[s["saludos"][k] for k in ("A_como_navegador", "B_solo_hibrido", "C_eleccion_libre")]),
              s["veredicto"], s["mx"]) for s in j["servidores"]])
# Grito: Gmail soporta; Santander rechaza el híbrido con alerta 40 → soporta = False (leído, no supuesto).
prueba("gmail.com: los 4 MX soportan y eligen el híbrido",
       lambda: igual({(s["veredicto"]["soporta"], s["veredicto"]["elige"]) for s in fijas["gmail.com"]["servidores"]}, {(True, True)}))
prueba("santander.cl: los 4 MX contestan y NO soportan (alerta 40 en B)", lambda: [
    igual((s["veredicto"]["estado"], s["veredicto"]["soporta"], s["saludos"]["B_solo_hibrido"]["alerta"]),
          ("medido", False, "alert 2/40"), s["mx"]) for s in fijas["santander.cl"]["servidores"]])
# Silencio: Outlook corta sin alerta en B. Un corte NO es «no soporta».
prueba("outlook.com: corte sin alerta → no medido, soporta None (nunca False)",
       lambda: igual((fijas["outlook.com"]["servidores"][0]["veredicto"]["estado"],
                      fijas["outlook.com"]["servidores"][0]["veredicto"]["soporta"]), ("no_medido", None)))

# --- 3. Rechazos y ausencias: nunca se leen como «no soporta».
VACIO = {"saludo_220": None, "starttls": None, "grupo": None, "hrr": None, "alerta": None, "rechazo": None, "error": None, "ms": 1}
R554 = "554-esa.hc5532-55.iphmx.com 554 Your access to this mail system has been rejected due to the sending MTA's poor reputation."
def con(**k): d = dict(VACIO); d.update(k); return d
def _r554():
    v = S.veredicto(con(rechazo=R554), con(rechazo=R554), con(rechazo=R554))
    igual((v["estado"], v["soporta"]), ("rechazado", None))
prueba("554 por reputación → «rechazado», soporta None", _r554)
prueba("sin STARTTLS → «sin_starttls», soporta None", lambda: igual(
    S.veredicto(con(starttls=False), con(starttls=False), con(starttls=False))["estado"], "sin_starttls"))
prueba("silencio en B aunque A responda → soporta None", lambda: igual(
    S.veredicto(con(starttls=True, grupo="x25519"), con(starttls=True, error="timeout"), con(starttls=True, grupo="x25519"))["soporta"], None))
prueba("respuesta SMTP de varias líneas: el 554 real de Cisco se lee entero",
       lambda: igual(S.respuesta_smtp(io.BytesIO(b"554-esa.hc5532-55.iphmx.com\r\n554 Your access to this mail system has been rejected due to the sending MTA's poor reputation.\r\n")),
                     (554, ["554-esa.hc5532-55.iphmx.com", "554 Your access to this mail system has been rejected due to the sending MTA's poor reputation."])))

# --- 4. El trabajador: firma lo que manda, no mide sin trabajo, y entrega lo medido.
#        Contra un sitio falso que verifica la firma por su cuenta (no con las funciones de S).
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
CLAVE_T = "k" * 48
S.CLAVE = CLAVE_T
visto = {"cola": [], "entregas": [], "firmas_malas": 0}
class Falso(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def _firma_ok(self, cuerpo):
        ts = self.headers.get("x-ts", "")
        esperada = hmac.new(CLAVE_T.encode(), f"{self.command}\n{self.path}\n{ts}\n{cuerpo}".encode(), hashlib.sha256).hexdigest()
        ok = hmac.compare_digest(self.headers.get("x-firma", ""), esperada) and abs(time.time() - int(ts)) < 120
        if not ok: visto["firmas_malas"] += 1
        return ok
    def do_GET(self):
        if not self._firma_ok(""): self.send_response(401); self.end_headers(); return
        if not visto["cola"]: self.send_response(204); self.end_headers(); return
        b = json.dumps(visto["cola"].pop(0)).encode()
        self.send_response(200); self.send_header("content-length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_POST(self):
        c = self.rfile.read(int(self.headers["content-length"])).decode()
        if not self._firma_ok(c): self.send_response(401); self.end_headers(); return
        visto["entregas"].append((self.path, json.loads(c)))
        self.send_response(200); self.send_header("content-length", "2"); self.end_headers(); self.wfile.write(b"{}")
srv = ThreadingHTTPServer(("127.0.0.1", 0), Falso)
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f"http://127.0.0.1:{srv.server_address[1]}"
def no_medir(d): raise AssertionError("NO debía medir")
prueba("sin trabajos pendientes: no mide nada", lambda: igual(S.una_vuelta(BASE, medir=no_medir), "nada"))
ID = "0b6c1d2e-3f40-4a5b-8c6d-7e8f90a1b2c3"
def _entrega():
    visto["cola"].append({"id": ID, "dominio": "santander.cl"})
    S.una_vuelta(BASE, medir=lambda d: fijas["santander.cl"])
    ruta, cuerpo = visto["entregas"][-1]
    igual((ruta, cuerpo["dominio"], len(cuerpo["servidores"])), (f"/api/sondas/correo/{ID}/resultado", "santander.cl", 4))
prueba("con un trabajo: mide ese dominio y entrega a su id", _entrega)
def _ajeno():
    visto["cola"].append({"id": ID, "dominio": "127.0.0.1"})
    igual(S.una_vuelta(BASE, medir=no_medir).startswith("descartado"), True)
prueba("un «dominio» que no es nombre público se descarta sin medir", _ajeno)
def _falla():
    visto["cola"].append({"id": ID, "dominio": "ejemplo.cl"})
    S.una_vuelta(BASE, medir=lambda d: (_ for _ in ()).throw(OSError("DNS caído")))
    igual("DNS caído" in visto["entregas"][-1][1]["error"], True)
prueba("si la medición revienta, se entrega el error (no se calla)", _falla)
prueba("todas las firmas que mandó el trabajador fueron válidas", lambda: igual(visto["firmas_malas"], 0))
srv.shutdown()

print(f"\ncheck-sonda-correo: {pasa} pasaron, {falla} fallaron, 0 saltadas")
sys.exit(1 if falla else 0)
