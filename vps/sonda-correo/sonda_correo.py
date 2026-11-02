#!/usr/bin/env python3
"""Sonda de correo de Rosetta Q-Ready (2-nov-2026). Corre en el VPS Contabo, no en Cloudflare.

¿Por qué aquí? Cloudflare Workers no abre el puerto 25, y desde la IP compartida de los
contenedores de Cloudflare el filtro Cisco de santander.cl corta con 554 («poor reputation»).
Desde este VPS los 4 MX de santander.cl contestan 220 y ofrecen STARTTLS (medido 2-nov).

Qué hace, por cada servidor de correo (MX) del dominio pedido:
  1. Abre el puerto 25, lee el saludo, manda EHLO, mira si ofrece STARTTLS.
  2. Pide STARTTLS y, sobre esa conexión, manda UN ClientHello TLS 1.3. Lee la primera
     respuesta y cierra. No completa el saludo, no manda correo, no se autentica.
  3. Lo repite tres veces, como el borde web (lib/borde-envivo.mjs): A «como navegador»,
     B «sólo híbrido», C «elección libre». SOPORTA se lee SÓLO de B.

El ClientHello y su lectura son copia fiel de probe_soporte.py (agosto); un test lo
compara byte a byte con el original y con el puerto JS (scripts/check-sonda-correo.py).

Reglas que este archivo no rompe:
  · No se mide cualquier host: sólo los MX que el propio servicio resuelve para el dominio.
  · Un rechazo (554), un corte o un silencio es «no medido» con su causa, nunca «no soporta».
  · Sin firma HMAC válida y fresca no hace nada. Sin clave configurada no arranca.
"""
import hashlib, hmac, json, os, socket, struct, sys, threading, time, urllib.request
from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

INSTRUMENTO = "rosetta-sonda-correo/1 · STARTTLS + ClientHello de probe_soporte.py"
EHLO = "rosettaquantum.com"
ESPERA = 12
MAX_MX = 4
VENTANA_FIRMA = 120          # segundos de tolerancia del reloj entre el Worker y el VPS
TOPE_POR_HORA = 30           # dominios distintos por hora: protege la reputación de esta IP
CACHE_SEG = 1800             # mismo dominio en 30 min → misma respuesta, sin volver a tocar sus MX

# ------------------------------------------------------------ TLS (copia fiel de probe_soporte.py)
HRR_RANDOM = bytes.fromhex("CF21AD74E59A6111BE1D8C021E65B891C2A211167ABB8C5E079E09E2C8A8339C")
NOMBRE = {0x11ec: "X25519MLKEM768", 0x11eb: "SecP256r1MLKEM768", 0x6399: "X25519Kyber768Draft00",
          0x001d: "x25519", 0x0017: "secp256r1", 0x0018: "secp384r1"}
TODOS = [0x11ec, 0x11eb, 0x6399, 0x001d, 0x0017, 0x0018]   # A
SOLO_HIB = [0x11ec]                                         # B
LIBRE = [0x11ec, 0x001d]                                    # C


def ext(t, d): return struct.pack(">HH", t, len(d)) + d


def hello(host, grupos, con_share_x25519, azar=os.urandom):
    body = b"\x03\x03" + azar(32)
    body += b"\x20" + azar(32)
    suites = [0x1301, 0x1302, 0x1303]
    body += struct.pack(">H", len(suites) * 2) + b"".join(struct.pack(">H", c) for c in suites)
    body += b"\x01\x00"
    hn = host.encode()
    exts = ext(0x0000, struct.pack(">H", len(hn) + 3) + b"\x00" + struct.pack(">H", len(hn)) + hn)
    sg = b"".join(struct.pack(">H", g) for g in grupos)
    exts += ext(0x000a, struct.pack(">H", len(sg)) + sg)
    sa = [0x0403, 0x0804, 0x0401, 0x0503, 0x0805, 0x0501, 0x0806, 0x0601]
    sab = b"".join(struct.pack(">H", s) for s in sa)
    exts += ext(0x000d, struct.pack(">H", len(sab)) + sab)
    exts += ext(0x002b, b"\x02\x03\x04")
    if con_share_x25519:
        e = struct.pack(">HH", 0x001d, 32) + azar(32)
        exts += ext(0x0033, struct.pack(">H", len(e)) + e)
    else:
        exts += ext(0x0033, struct.pack(">H", 0))
    body += struct.pack(">H", len(exts)) + exts
    hs = b"\x01" + struct.pack(">I", len(body))[1:] + body
    return b"\x16\x03\x01" + struct.pack(">H", len(hs)) + hs


def leer(payload):
    if not payload or payload[0] != 0x02: return None, None
    p = payload[4:]
    es_hrr = p[2:34] == HRR_RANDOM
    i = 34; sid = p[i]; i += 1 + sid; i += 2 + 1
    elen = struct.unpack(">H", p[i:i + 2])[0]; i += 2
    fin = i + elen; grupo = None
    while i + 4 <= fin:
        t, l = struct.unpack(">HH", p[i:i + 4]); i += 4
        if t == 0x0033 and l >= 2: grupo = struct.unpack(">H", p[i:i + 2])[0]
        i += l
    return es_hrr, grupo


# ------------------------------------------------------------ SMTP
def respuesta_smtp(f):
    """Lee una respuesta SMTP completa (varias líneas «250-…», la última «250 …»)."""
    lineas = []
    while True:
        l = f.readline(2048)
        if not l: raise OSError("el servidor cerró la conexión")
        l = l.decode("latin-1").rstrip("\r\n"); lineas.append(l)
        if len(l) < 4 or l[3] != "-": break
    return int(lineas[-1][:3]), lineas


def saludo_smtp(mx, grupos, con_share):
    """Una sesión SMTP → STARTTLS → un ClientHello. Devuelve lo visto, sin juzgar."""
    t0 = time.time()
    out = {"saludo_220": None, "starttls": None, "grupo": None, "hrr": None, "alerta": None,
           "rechazo": None, "error": None, "ms": None}
    s = None
    try:
        s = socket.create_connection((mx, 25), ESPERA); s.settimeout(ESPERA)
        f = s.makefile("rb")
        code, lin = respuesta_smtp(f)
        if code != 220:
            out["rechazo"] = " ".join(lin)[:300]; return out
        out["saludo_220"] = lin[0][:200]
        s.sendall(f"EHLO {EHLO}\r\n".encode())
        code, lin = respuesta_smtp(f)
        if code != 250:
            out["rechazo"] = " ".join(lin)[:300]; return out
        out["starttls"] = any(l[4:].strip().upper().startswith("STARTTLS") for l in lin)
        if not out["starttls"]: return out
        s.sendall(b"STARTTLS\r\n")
        code, lin = respuesta_smtp(f)
        if code != 220:
            out["rechazo"] = " ".join(lin)[:300]; return out
        s.sendall(hello(mx, grupos, con_share))
        cab = f.read(5)
        if len(cab) < 5: raise OSError("respuesta TLS corta")
        tipo, ln = cab[0], struct.unpack(">H", cab[3:5])[0]
        cuerpo = f.read(ln)
        if tipo == 0x15:
            out["alerta"] = f"alert {cuerpo[0]}/{cuerpo[1]}" if len(cuerpo) >= 2 else "alert"; return out
        if tipo != 0x16: raise OSError(f"registro TLS inesperado {tipo}")
        hrr, g = leer(cuerpo)
        out["hrr"] = hrr; out["grupo"] = None if g is None else NOMBRE.get(g, hex(g))
    except Exception as e:
        out["error"] = f"{type(e).__name__}: {e}"[:200]
    finally:
        try: s and s.close()
        except Exception: pass
        out["ms"] = int((time.time() - t0) * 1000)
    return out


def veredicto(a, b, c):
    """Mismas reglas que medirBorde(): SOPORTA sólo de B; sin respuesta TLS no hay veredicto."""
    def leido(x): return x["error"] is None and x["rechazo"] is None and x["starttls"] is True
    soporta = (b["grupo"] == "X25519MLKEM768") if leido(b) else None
    pide = (a["grupo"] == "X25519MLKEM768") if leido(a) else None
    elige = (c["grupo"] == "X25519MLKEM768") if leido(c) else None
    starttls = next((x["starttls"] for x in (a, b, c) if x["starttls"] is not None), None)
    rech = next((x["rechazo"] for x in (a, b, c) if x["rechazo"]), None)
    if rech: estado = "rechazado"            # nos cortaron: no medido, nunca «no soporta»
    elif starttls is False: estado = "sin_starttls"
    elif soporta is None: estado = "no_medido"
    else: estado = "medido"
    return {"estado": estado, "starttls": starttls, "soporta": soporta, "pide_mejora": pide, "elige": elige}


def medir_mx(mx):
    a = saludo_smtp(mx, TODOS, True)
    b = saludo_smtp(mx, SOLO_HIB, False)
    c = saludo_smtp(mx, LIBRE, False)
    return {"mx": mx, "saludos": {"A_como_navegador": a, "B_solo_hibrido": b, "C_eleccion_libre": c},
            "veredicto": veredicto(a, b, c)}


# ------------------------------------------------------------ DNS (igual que el Worker: DoH de Cloudflare)
def registros_mx(dominio):
    req = urllib.request.Request(f"https://cloudflare-dns.com/dns-query?name={dominio}&type=MX",
                                 headers={"accept": "application/dns-json"})
    j = json.loads(urllib.request.urlopen(req, timeout=8).read())
    mx = []
    for a in j.get("Answer", []):
        if a.get("type") == 15:
            pref, host = str(a["data"]).split()
            mx.append((int(pref), host.rstrip(".").lower()))
    return [h for _, h in sorted(set(mx))]


HOST_OK = __import__("re").compile(r"^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$")


def medir_dominio(dominio):
    inicio = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    todos = registros_mx(dominio)
    mxs = [h for h in todos if HOST_OK.match(h)][:MAX_MX]
    with ThreadPoolExecutor(max_workers=MAX_MX) as ex:
        res = list(ex.map(medir_mx, mxs))
    return {"instrumento": INSTRUMENTO, "dominio": dominio, "medido_utc": inicio, "desde_ip": IP_SALIDA,
            "mx_publicados": todos, "mx_medidos": len(res), "mx_omitidos": len(todos) - len(res), "servidores": res,
            "alcance": "Mide el tramo remitente → servidor de correo del dominio (STARTTLS). No ve lo que pasa dentro de la organización."}


# ------------------------------------------------------------ servicio
CLAVE = os.environ.get("SONDA_CORREO_CLAVE", "").encode()
IP_SALIDA = os.environ.get("SONDA_IP_SALIDA", "")
_cache, _hora, _cerrojo = {}, [], threading.Lock()


def firma(datos: bytes) -> str:
    return hmac.new(CLAVE, datos, hashlib.sha256).hexdigest()


class Manejador(BaseHTTPRequestHandler):
    server_version = "rosetta-sonda-correo/1"

    def responder(self, codigo, obj):
        cuerpo = json.dumps(obj, ensure_ascii=False, separators=(",", ":")).encode()
        self.send_response(codigo)
        self.send_header("content-type", "application/json; charset=utf-8")
        self.send_header("content-length", str(len(cuerpo)))
        self.send_header("x-firma", firma(cuerpo))
        self.send_header("connection", "close")
        self.end_headers(); self.wfile.write(cuerpo)

    def log_message(self, fmt, *args):
        sys.stderr.write("%s %s\n" % (time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), fmt % args))

    def do_POST(self):
        if self.path != "/correo": return self.responder(404, {"ok": False, "error": "ruta"})
        n = int(self.headers.get("content-length") or 0)
        if n <= 0 or n > 2048: return self.responder(400, {"ok": False, "error": "cuerpo"})
        cuerpo = self.rfile.read(n)
        dada = self.headers.get("x-firma", "")
        if not hmac.compare_digest(dada, firma(cuerpo)):
            return self.responder(401, {"ok": False, "error": "firma"})
        try: pedido = json.loads(cuerpo)
        except Exception: return self.responder(400, {"ok": False, "error": "json"})
        if abs(time.time() - float(pedido.get("ts", 0))) > VENTANA_FIRMA:
            return self.responder(401, {"ok": False, "error": "firma vencida"})
        dominio = str(pedido.get("dominio", "")).strip().lower().rstrip(".")
        if not HOST_OK.match(dominio): return self.responder(400, {"ok": False, "error": "dominio"})
        ahora = time.time()
        with _cerrojo:
            c = _cache.get(dominio)
            if c and ahora - c[0] < CACHE_SEG:
                return self.responder(200, {"ok": True, "en_cache": True, **c[1]})
            _hora[:] = [t for t in _hora if ahora - t < 3600]
            if len(_hora) >= TOPE_POR_HORA:
                return self.responder(429, {"ok": False, "error": "tope por hora alcanzado"})
            _hora.append(ahora)
        try: r = medir_dominio(dominio)
        except Exception as e: return self.responder(502, {"ok": False, "error": f"DNS: {e}"[:200]})
        with _cerrojo: _cache[dominio] = (ahora, r)
        return self.responder(200, {"ok": True, "en_cache": False, **r})


def main():
    if len(CLAVE) < 32: sys.exit("SONDA_CORREO_CLAVE ausente o corta: el servicio no arranca sin ella.")
    puerto = int(os.environ.get("SONDA_PUERTO", "8625"))
    ThreadingHTTPServer(("0.0.0.0", puerto), Manejador).serve_forever()


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "--medir":       # uso a mano, sin servicio
        print(json.dumps(medir_dominio(sys.argv[2]), ensure_ascii=False, indent=1))
    else:
        main()
