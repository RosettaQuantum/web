#!/usr/bin/env python3
"""Sonda TLS de Rosetta Q-Ready (13-nov-2026). Corre en el VPS, junto a la sonda de correo.

¿Por qué? Un Worker de Cloudflare no puede abrir sockets hacia direcciones de Cloudflare: todo dominio
detrás de Cloudflare (rosettaquantum.com incluido) volvía con el borde y el certificado sin medir.
Desde el VPS sí se llega. Lo aprobó el dueño el 13-nov («opción A»): cambia el método a propósito.

Qué hace, por pedido (lib/sonda-tls-vps.mjs arma el pedido; nada más se mide):
  · borde      — los TRES saludos TLS 1.3 de lib/borde-envivo.mjs (A, B, C) al sitio, puerto 443.
  · certificado — UN saludo TLS 1.2 y devuelve la hoja en DER (base64). La lee el Worker con
                  leerHoja(): un solo lector de certificados.
  · nombres    — saludos A y B a cada nombre pedido (B dice si soporta el híbrido).
Cada saludo es UN ClientHello: se lee la primera respuesta y se cierra. No se completa la sesión, no
viajan datos ni credenciales. Los ClientHello TLS 1.3 son los de sonda_correo.py (que un test compara
byte a byte con probe_soporte.py de agosto); el TLS 1.2 es copia de clientHello12() del Worker, y
test_sonda_tls.py lo compara byte a byte.

Reglas que este archivo no rompe:
  · Sólo nombres del dominio pedido (el dominio o sus subdominios) y sólo el puerto 443.
  · Sólo direcciones públicas: si un nombre resuelve a una IP privada, de loopback o reservada, no se
    saluda (nadie usa esta sonda para tocar la red interna del VPS).
  · Un corte o un silencio es «error» con su causa, nunca «no soporta».
  · No abre puertos: pregunta al sitio y entrega firmado (HMAC, la misma clave y el mismo texto
    firmado que la sonda de correo). Sin clave no arranca.
"""
import base64, ipaddress, json, os, socket, struct, sys, time
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sonda_correo as C  # noqa: E402  (hello, leer, NOMBRE, grupos, HOST_OK, llamar, CLAVE)

INSTRUMENTO = "rosetta-sonda-tls/1 · ClientHello de probe_soporte.py (TLS 1.3) y de clientHello12 (TLS 1.2)"
ESPERA = 8
MAX_NOMBRES = 17           # el sitio + 15 nombres + margen
TOPE_POR_HORA = 120        # pedidos por hora: protege la reputación de la IP del VPS
_hora = []


# ------------------------------------------------------------ TLS 1.2: copia de clientHello12() (lib/informe-envivo.mjs)
def hello12(host, azar=os.urandom):
    hn = host.encode()
    suites = [0xc02b, 0xc02c, 0xcca9, 0xc02f, 0xc030, 0xcca8, 0xc009, 0xc013, 0x009c, 0x002f]
    body = b"\x03\x03" + azar(32) + b"\x00"
    body += struct.pack(">H", len(suites) * 2) + b"".join(struct.pack(">H", s) for s in suites) + b"\x01\x00"
    exts = C.ext(0x0000, struct.pack(">H", len(hn) + 3) + b"\x00" + struct.pack(">H", len(hn)) + hn)
    sg = b"".join(struct.pack(">H", g) for g in [0x001d, 0x0017, 0x0018])
    exts += C.ext(0x000a, struct.pack(">H", len(sg)) + sg)
    exts += C.ext(0x000b, b"\x01\x00")
    sa = b"".join(struct.pack(">H", s) for s in [0x0403, 0x0804, 0x0401, 0x0503, 0x0805, 0x0501, 0x0806, 0x0601])
    exts += C.ext(0x000d, struct.pack(">H", len(sa)) + sa)
    exts += C.ext(0x0017, b"")
    exts += C.ext(0xff01, b"\x00")
    body += struct.pack(">H", len(exts)) + exts
    hs = b"\x01" + struct.pack(">I", len(body))[1:] + body
    return b"\x16\x03\x01" + struct.pack(">H", len(hs)) + hs


# ------------------------------------------------------------ a quién se saluda
def es_del_dominio(host, dominio):
    return bool(C.HOST_OK.match(host)) and (host == dominio or host.endswith("." + dominio))


def ip_publica(host):
    """Resuelve y devuelve la primera dirección PÚBLICA. Una privada/loopback/reservada se rechaza."""
    for fam, _, _, _, addr in socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM):
        ip = ipaddress.ip_address(addr[0])
        if not ip.is_global:
            raise OSError(f"{host} resuelve a una dirección no pública ({ip}): no se saluda")
        return fam, addr
    raise OSError(f"{host} no resuelve")


def _leer_exacto(s, n):
    b = b""
    while len(b) < n:
        x = s.recv(n - len(b))
        if not x: break
        b += x
    return b


def saludo(host, grupos, con_share):
    """UN ClientHello TLS 1.3 al 443. Mismo resultado que saludo() de lib/borde-envivo.mjs."""
    t0 = time.time()
    out = {"grupo": None, "hrr": None, "alerta": None, "error": None, "ms": None}
    s = None
    try:
        fam, addr = ip_publica(host)
        s = socket.socket(fam, socket.SOCK_STREAM); s.settimeout(ESPERA); s.connect(addr)
        s.sendall(C.hello(host, grupos, con_share))
        cab = _leer_exacto(s, 5)
        if len(cab) < 5: raise OSError("respuesta corta")
        tipo, ln = cab[0], struct.unpack(">H", cab[3:5])[0]
        cuerpo = _leer_exacto(s, ln)
        if tipo == 0x15:
            out["alerta"] = f"alert {cuerpo[0]}/{cuerpo[1]}" if len(cuerpo) >= 2 else "alert"
        else:
            hrr, g = C.leer(cuerpo)
            out["hrr"] = hrr; out["grupo"] = None if g is None else C.NOMBRE.get(g, "0x" + format(g, "x"))
    except Exception as e:
        out["error"] = f"{type(e).__name__}: {e}"[:200]
    finally:
        try: s and s.close()
        except Exception: pass
        out["ms"] = int((time.time() - t0) * 1000)
    return out


def certificado(host):
    """UN ClientHello TLS 1.2; devuelve la hoja en DER (base64). No se completa la sesión."""
    t0 = time.time()
    out = {"der_b64": None, "error": None, "ms": None}
    s = None
    try:
        fam, addr = ip_publica(host)
        s = socket.socket(fam, socket.SOCK_STREAM); s.settimeout(ESPERA); s.connect(addr)
        s.sendall(hello12(host))
        hs = b""
        while True:
            cab = _leer_exacto(s, 5)
            if len(cab) < 5: raise OSError("el servidor cerró antes del certificado")
            tipo, ln = cab[0], struct.unpack(">H", cab[3:5])[0]
            cuerpo = _leer_exacto(s, ln)
            if tipo == 0x15: raise OSError(f"alerta TLS {cuerpo[0]}/{cuerpo[1]} (el servidor no aceptó TLS 1.2)")
            if tipo != 0x16: raise OSError(f"registro inesperado {tipo}")
            hs += cuerpo
            if len(hs) > 200000: raise OSError("respuesta demasiado larga")
            i = 0
            while i + 4 <= len(hs):
                t, l = hs[i], int.from_bytes(hs[i + 1:i + 4], "big")
                if i + 4 + l > len(hs): break
                if t == 0x0b:
                    m = hs[i + 4:i + 4 + l]; l1 = int.from_bytes(m[3:6], "big")
                    out["der_b64"] = base64.b64encode(m[6:6 + l1]).decode()
                    return out
                if t == 0x0e: raise OSError("el servidor terminó el saludo sin enviar certificado")
                i += 4 + l
    except Exception as e:
        out["error"] = f"{type(e).__name__}: {e}"[:200]
    finally:
        try: s and s.close()
        except Exception: pass
        out["ms"] = int((time.time() - t0) * 1000)
    return out


def medir_pedido(p):
    """p = {dominio, www, borde: bool, certificado: bool, hosts: [..]} → saludos crudos, sin juzgar."""
    dominio = str(p.get("dominio", "")).lower(); www = str(p.get("www", "")).lower()
    if not C.HOST_OK.match(dominio): raise ValueError(f"dominio inválido: {dominio!r}")
    if not es_del_dominio(www, dominio): raise ValueError(f"el sitio {www!r} no es del dominio")
    hosts = [h for h in dict.fromkeys(str(x).lower() for x in (p.get("hosts") or [])) if es_del_dominio(h, dominio)][:MAX_NOMBRES - 2]
    inicio = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    tareas = []
    if p.get("borde"):
        tareas += [("borde", "A_como_navegador", lambda: saludo(www, C.TODOS, True)),
                   ("borde", "B_solo_hibrido", lambda: saludo(www, C.SOLO_HIB, False)),
                   ("borde", "C_eleccion_libre", lambda: saludo(www, C.LIBRE, False))]
    if p.get("certificado"):
        tareas.append(("certificado", None, lambda: certificado(www)))
    for h in hosts:
        tareas += [("host", (h, "A"), lambda h=h: saludo(h, C.TODOS, True)), ("host", (h, "B"), lambda h=h: saludo(h, C.SOLO_HIB, False))]
    with ThreadPoolExecutor(max_workers=8) as ex:
        res = list(ex.map(lambda t: t[2](), tareas))
    r = {"instrumento": INSTRUMENTO, "dominio": dominio, "www": www, "medido_utc": inicio, "desde_ip": C.IP_SALIDA or None,
         "borde": None, "certificado": None, "hosts": {}}
    for (tipo, clave, _), x in zip(tareas, res):
        if tipo == "borde": r["borde"] = r["borde"] or {}; r["borde"][clave] = x
        elif tipo == "certificado": r["certificado"] = x
        else: r["hosts"].setdefault(clave[0], {})[clave[1]] = x
    return r


# ------------------------------------------------------------ trabajador (pregunta; no escucha)
def una_vuelta(base, medir=None):
    medir = medir or medir_pedido
    st, b = C.llamar(base, "GET", "/api/sondas/tls/pendiente")
    if st == 204: return "nada"
    t = json.loads(b); p = t["pedido"]; dominio = str(p.get("dominio", ""))
    ahora = time.time()
    _hora[:] = [x for x in _hora if ahora - x < 3600]
    if len(_hora) >= TOPE_POR_HORA:
        r = {"dominio": dominio, "instrumento": INSTRUMENTO, "error": "tope por hora alcanzado: no medido"}
    else:
        _hora.append(ahora)
        try: r = medir(p)
        except Exception as e: r = {"dominio": dominio, "instrumento": INSTRUMENTO, "error": f"{type(e).__name__}: {e}"[:200]}
    cuerpo = json.dumps(r, ensure_ascii=False, separators=(",", ":"))
    st, _ = C.llamar(base, "POST", f"/api/sondas/tls/{t['id']}/resultado", cuerpo)
    return f"entregado {dominio} {st}"


def trabajar(base, una=False):
    if len(C.CLAVE) < 32: sys.exit("SONDA_CORREO_CLAVE ausente o corta: el trabajador no arranca sin ella.")
    while True:
        try:
            hecho = una_vuelta(base)
            if hecho != "nada":
                print(time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), hecho, flush=True)
                if una: return
        except Exception as e:
            print(time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "error", type(e).__name__, str(e)[:200], flush=True)
            time.sleep(10)
        time.sleep(C.POLL)


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "--medir":       # a mano: el sitio y su certificado
        d = sys.argv[2].lower()
        print(json.dumps(medir_pedido({"dominio": d, "www": "www." + d, "borde": True, "certificado": True, "hosts": []}), ensure_ascii=False, indent=1))
    elif len(sys.argv) == 3 and sys.argv[1] == "--trabajar":  # el servicio
        trabajar(sys.argv[2].rstrip("/"))
    elif len(sys.argv) == 3 and sys.argv[1] == "--una":       # pruebas: toma y entrega UN pedido y termina
        trabajar(sys.argv[2].rstrip("/"), una=True)
    else:
        sys.exit("uso: sonda_tls.py --medir <dominio> | --trabajar https://rosettaquantum.com | --una <base>")
