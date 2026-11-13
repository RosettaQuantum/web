#!/usr/bin/env python3
"""Pruebas de sonda_tls.py (13-nov-2026). Corre con: python3 -I vps/sonda-correo/test_sonda_tls.py

Sin red: los sockets y el DNS se sustituyen. Lo que se prueba es lo que esta sonda no puede romper:
  · sólo saluda nombres del dominio pedido, sólo al 443 y sólo a direcciones públicas;
  · un corte es «error» con su causa, nunca un veredicto;
  · el pedido trae lo que pidió el Worker, ni más ni menos;
  · el trabajador toma un pedido y lo entrega firmado, con la clave y el texto de la sonda de correo.
Que los ClientHello sean byte a byte los del Worker lo comprueba scripts/check-sonda-tls.mjs (corre
los dos lenguajes).
"""
import hashlib, hmac, json, os, socket, sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
os.environ["SONDA_CORREO_CLAVE"] = "k" * 48
sys.path.insert(0, str(AQUI))
import sonda_correo as C  # noqa: E402
import sonda_tls as T     # noqa: E402

pasa = falla = 0
def prueba(nombre, f):
    global pasa, falla
    try: f(); pasa += 1; print(f"  ok    {nombre}")
    except Exception as e: falla += 1; print(f"  FALLA {nombre}: {e}")
def igual(a, b, q=""):
    if a != b: raise AssertionError(f"{q}: {a!r} ≠ {b!r}")

# --- 1. a quién se saluda
prueba("un subdominio es del dominio", lambda: igual(T.es_del_dominio("api.ejemplo.cl", "ejemplo.cl"), True))
prueba("un dominio que sólo TERMINA igual no es del dominio", lambda: igual(T.es_del_dominio("malejemplo.cl", "ejemplo.cl"), False))
prueba("un nombre ajeno no es del dominio", lambda: igual(T.es_del_dominio("otro.cl", "ejemplo.cl"), False))
prueba("una IP no es un nombre", lambda: igual(T.es_del_dominio("10.0.0.1", "ejemplo.cl"), False))

real_gai = socket.getaddrinfo
def resuelve_a(ip):
    fam = socket.AF_INET6 if ":" in ip else socket.AF_INET
    socket.getaddrinfo = lambda *a, **k: [(fam, socket.SOCK_STREAM, 6, "", (ip, 443))]
for ip in ["127.0.0.1", "10.1.2.3", "192.168.0.10", "169.254.169.254", "100.64.0.1", "::1", "fd00::1"]:
    def _no(ip=ip):
        resuelve_a(ip)
        r = T.saludo("www.ejemplo.cl", C.SOLO_HIB, False)
        igual((r["grupo"], "no pública" in (r["error"] or "")), (None, True), ip)
    prueba(f"un nombre que resuelve a {ip} no se saluda", _no)
socket.getaddrinfo = real_gai

# --- 2. un corte es error, nunca veredicto
class SockCorta:
    def __init__(self, *a): pass
    def settimeout(self, t): pass
    def connect(self, a): raise ConnectionResetError("Connection reset by peer")
    def close(self): pass
real_sock = socket.socket
socket.getaddrinfo = lambda *a, **k: [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 443))]
socket.socket = SockCorta
def _corte():
    r = T.saludo("www.ejemplo.cl", C.SOLO_HIB, False)
    igual((r["grupo"], r["alerta"], r["error"].startswith("ConnectionResetError")), (None, None, True))
prueba("un corte vuelve como error con su causa, sin grupo ni alerta", _corte)
prueba("el certificado cortado vuelve sin DER y con su causa", lambda: igual((T.certificado("www.ejemplo.cl")["der_b64"], bool(T.certificado("www.ejemplo.cl")["error"])), (None, True)))

# una respuesta real: alerta TLS 2/40 (handshake_failure) al saludo B
class SockAlerta(SockCorta):
    def connect(self, a): pass
    def sendall(self, b): self.enviado = b
    def recv(self, n):
        if not hasattr(self, "_q"): self._q = bytearray(b"\x15\x03\x03\x00\x02\x02\x28")
        x = bytes(self._q[:n]); del self._q[:n]; return x
socket.socket = SockAlerta
prueba("una alerta TLS es medición (alert 2/40), no error", lambda: igual(T.saludo("www.ejemplo.cl", C.SOLO_HIB, False)["alerta"], "alert 2/40"))
socket.socket = real_sock; socket.getaddrinfo = real_gai

# --- 3. el pedido: lo que pidió el Worker, sólo del dominio
vistos = []
T.saludo = lambda h, g, s: (vistos.append((h, tuple(g), s)), {"grupo": "x25519", "hrr": False, "alerta": None, "error": None, "ms": 1})[1]
T.certificado = lambda h: (vistos.append((h, "cert")), {"der_b64": "AA==", "error": None, "ms": 1})[1]
def _pedido():
    vistos.clear()
    r = T.medir_pedido({"dominio": "ejemplo.cl", "www": "www.ejemplo.cl", "borde": True, "certificado": True,
                        "hosts": ["api.ejemplo.cl", "intruso.otro.cl", "api.ejemplo.cl"]})
    igual(sorted(r["borde"].keys()), ["A_como_navegador", "B_solo_hibrido", "C_eleccion_libre"], "borde")
    igual(sorted(r["hosts"].keys()), ["api.ejemplo.cl"], "sólo nombres del dominio, sin repetir")
    igual(sorted(r["hosts"]["api.ejemplo.cl"].keys()), ["A", "B"], "A y B por nombre")
    igual(any(h == "intruso.otro.cl" for h, *_ in vistos), False, "el nombre ajeno no se saludó")
    igual(len(vistos), 3 + 1 + 2, "3 saludos al borde + certificado + 2 por nombre")
prueba("medir_pedido: borde (A, B, C), certificado y A+B por nombre, nada ajeno", _pedido)
def _sin_borde():
    vistos.clear()
    r = T.medir_pedido({"dominio": "ejemplo.cl", "www": "www.ejemplo.cl", "borde": False, "certificado": False, "hosts": ["a.ejemplo.cl"]})
    igual((r["borde"], r["certificado"], len(vistos)), (None, None, 2))
prueba("sin borde ni certificado pedidos: sólo los nombres", _sin_borde)
def _sitio_ajeno():
    try: T.medir_pedido({"dominio": "ejemplo.cl", "www": "www.otro.cl", "borde": True}); raise AssertionError("no rechazó")
    except ValueError: pass
prueba("un sitio que no es del dominio se rechaza", _sitio_ajeno)

# --- 4. el trabajador: toma, mide y entrega firmado (mismo texto firmado que la sonda de correo)
llamadas = []
def llamar_falso(base, metodo, ruta, cuerpo=""):
    h = C.cabeceras(metodo, ruta, cuerpo)
    esperado = hmac.new(("k" * 48).encode(), C.texto_firmado(metodo, ruta, h["x-ts"], cuerpo).encode(), hashlib.sha256).hexdigest()
    llamadas.append((metodo, ruta, h["x-firma"] == esperado, cuerpo))
    if ruta == "/api/sondas/tls/pendiente":
        return 200, json.dumps({"ok": True, "id": "0" * 8 + "-0000-0000-0000-" + "0" * 12, "pedido": {"dominio": "ejemplo.cl", "www": "www.ejemplo.cl", "borde": True, "certificado": False, "hosts": []}}).encode()
    return 200, b'{"ok":true}'
C.llamar = llamar_falso
def _vuelta():
    llamadas.clear()
    r = T.una_vuelta("https://x.example", medir=lambda p: {"dominio": p["dominio"], "borde": {}, "hosts": {}})
    igual(r.startswith("entregado ejemplo.cl"), True, r)
    igual([(m, ru, f) for m, ru, f, _ in llamadas], [("GET", "/api/sondas/tls/pendiente", True), ("POST", "/api/sondas/tls/00000000-0000-0000-0000-000000000000/resultado", True)])
prueba("una vuelta: pregunta firmado, mide y entrega firmado", _vuelta)
def _error_entrega():
    llamadas.clear()
    T.una_vuelta("https://x.example", medir=lambda p: (_ for _ in ()).throw(OSError("sin red")))
    igual(json.loads(llamadas[-1][3])["error"].startswith("OSError"), True)
prueba("si la medición lanza, entrega el error (el Worker lo lee como «no medido»)", _error_entrega)

print(f"\ncheck-sonda-tls (python): {pasa} pasaron, {falla} fallaron")
sys.exit(1 if falla else 0)
