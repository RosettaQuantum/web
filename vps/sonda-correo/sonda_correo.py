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
  · No abre puertos: pregunta al sitio y entrega firmado (HMAC). Sin clave no arranca.
"""
import hashlib, hmac, json, os, socket, struct, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor

INSTRUMENTO = "rosetta-sonda-correo/1 · STARTTLS + ClientHello de probe_soporte.py"
EHLO = "rosettaquantum.com"
ESPERA = 12
MAX_MX = 4

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


# ------------------------------------------------------------ trabajador (pregunta; no escucha)
# No abre ningún puerto: pregunta al sitio cada POLL segundos si hay mediciones pendientes y
# entrega el resultado firmado. Así el servidor, compartido con Sigo, no expone nada nuevo.
CLAVE = os.environ.get("SONDA_CORREO_CLAVE", "")
IP_SALIDA = os.environ.get("SONDA_IP_SALIDA", "")
POLL = 2
TOPE_POR_HORA = 30           # dominios distintos por hora: protege la reputación de esta IP
_hora = []


def texto_firmado(metodo, ruta, ts, cuerpo=""):
    """Debe ser idéntico a textoFirmado() de lib/correo-envivo.mjs."""
    return f"{metodo}\n{ruta}\n{ts}\n{cuerpo}"


def cabeceras(metodo, ruta, cuerpo=""):
    ts = str(int(time.time()))
    f = hmac.new(CLAVE.encode(), texto_firmado(metodo, ruta, ts, cuerpo).encode(), hashlib.sha256).hexdigest()
    return {"x-ts": ts, "x-firma": f, "content-type": "application/json", "user-agent": "rosetta-sonda-correo/1"}


def llamar(base, metodo, ruta, cuerpo=""):
    r = urllib.request.Request(base + ruta, data=cuerpo.encode() if metodo == "POST" else None,
                               method=metodo, headers=cabeceras(metodo, ruta, cuerpo))
    with urllib.request.urlopen(r, timeout=20) as resp:
        return resp.status, resp.read()


def una_vuelta(base, medir=None):
    """Toma a lo más un trabajo y lo entrega. Devuelve lo que hizo (para el registro y las pruebas)."""
    medir = medir or medir_dominio
    st, b = llamar(base, "GET", "/api/sondas/correo/pendiente")
    if st == 204: return "nada"
    t = json.loads(b); dominio = t["dominio"]
    if not HOST_OK.match(dominio): return f"descartado {dominio!r}"
    ahora = time.time()
    _hora[:] = [x for x in _hora if ahora - x < 3600]
    if len(_hora) >= TOPE_POR_HORA:
        r = {"dominio": dominio, "instrumento": INSTRUMENTO, "desde_ip": IP_SALIDA, "error": "tope por hora alcanzado: no medido"}
    else:
        _hora.append(ahora)
        try: r = medir(dominio)
        except Exception as e: r = {"dominio": dominio, "instrumento": INSTRUMENTO, "desde_ip": IP_SALIDA, "error": f"{type(e).__name__}: {e}"[:200]}
    cuerpo = json.dumps(r, ensure_ascii=False, separators=(",", ":"))
    st, _ = llamar(base, "POST", f"/api/sondas/correo/{t['id']}/resultado", cuerpo)
    return f"entregado {dominio} {st}"


def trabajar(base):
    if len(CLAVE) < 32: sys.exit("SONDA_CORREO_CLAVE ausente o corta: el trabajador no arranca sin ella.")
    while True:
        try:
            hecho = una_vuelta(base)
            if hecho != "nada": print(time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), hecho, flush=True)
        except Exception as e:
            print(time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "error", type(e).__name__, str(e)[:200], flush=True)
            time.sleep(10)
        time.sleep(POLL)


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "--medir":       # uso a mano
        print(json.dumps(medir_dominio(sys.argv[2]), ensure_ascii=False, indent=1))
    elif len(sys.argv) == 3 and sys.argv[1] == "--trabajar":  # el servicio
        trabajar(sys.argv[2].rstrip("/"))
    else:
        sys.exit("uso: sonda_correo.py --medir <dominio> | --trabajar https://rosettaquantum.com")
