#!/usr/bin/env python3
"""
QEX — Indice Rosetta de Exposicion Criptografica. Implementacion de referencia.

Esta es la definicion normativa del indice: si este archivo y la prosa del informe
se contradicen, manda este archivo. Cualquier tercero puede tomar las cuatro
dimensiones publicadas por organizacion y reproducir el puntaje exacto.

Uso:
    python3 calcular_qex.py                 # verifica contra la edicion publicada
    python3 calcular_qex.py --explicar DOM  # desglosa una organizacion
"""
import json, sys, os

VERSION = "QEX-1.0"

# Pesos de las cuatro dimensiones. Suman 1,00.
PESOS = {
    "certificados": 0.40,   # que criptografia sirve hoy en su superficie publica
    "higiene":      0.25,   # que tan ordenada esta esa superficie
    "hndl":         0.25,   # exposicion a cosecha-hoy-descifra-manana (valor de SECTOR)
    "edge":         0.10,   # si el borde ya negocia intercambio de claves hibrido
}

# Techo declarado. Ninguna medicion externa puede afirmar que una organizacion
# esta preparada: lo que no se ve desde afuera (HSM, mTLS interno, respaldos,
# firmware) vale mas que lo que se ve. El indice se declara incompleto por diseno.
TOPE = 84


def irec(dim, tope=TOPE):
    """Puntaje 0-100 a partir de las cuatro dimensiones.

    Una dimension en None es una dimension NO MEDIDA: se renormaliza sobre los
    pesos efectivamente usables. Eso evita que una ausencia se lea como un cero
    (CLAUDE.md 5 quater: una clave que falta no es un cero).

    LO QUE NO HACE, y antes este comentario lo afirmaba de mas: renormalizar NO
    garantiza neutralidad. Solo es neutral si el valor tipico de la dimension
    ausente iguala el promedio ponderado del resto. Cuando no lo iguala, excluirla
    sesga.

    Medido en la edicion de agosto-2026, sobre las 19 de 170 sin borde medido:

        si su edge fuera 100  ->  +3 a +5 puntos sobre lo publicado
        si su edge fuera 0    ->  -5 a -7 puntos
        de las 151 medidas, 93 (62 %) sacan edge=100

    LO QUE SE PUEDE AFIRMAR SIN SUPONER NADA: el sesgo por organizacion esta
    **acotado entre -5 y +7 puntos**, y su valor esperado depende de la
    distribucion de borde de las no medidas -- que por definicion no observamos.
    Ponderar por la tasa de las medidas (62 %) da +0,2, pero eso ASUME que ambos
    grupos se distribuyen igual, que es justo lo que no se sabe.

    DOS ATAJOS QUE YA SE TOMARON, para que no se repitan:

    1. «El caso mas probable gana ~+4, luego el sesgo es +4» -- no. El 62 %
       ganaria +4 y el 38 % perderia -6; la perdida es mayor. Tomar la moda por
       el valor esperado da -3 a -5: diez veces el sesgo y con el signo cambiado.

    2. «Las no medidas son las mejor defendidas, luego el sesgo va contra el
       segmento preparado» -- **se probo con el corpus de agosto-2026 y se
       refuto**. Y la primera prueba tampoco servia: comparar MEDIANAS no
       discrimina cuando `certificados` tiene 2 valores (94 % iguales) y `hndl`
       es constante por sector -- las medianas coinciden por construccion.
       Mirando la distribucion completa de `higiene`, las 19 resultan BIMODALES:
       26 % en 20-30, un tramo donde NINGUNA de las 151 aparece, y a la vez
       sobrerrepresentadas en 70. Media 53,7 contra 58,5: en promedio son
       PEORES, no mejores.

       El mecanismo que lo explica: un sondeo falla por dos razones opuestas --
       un WAF que lo bloquea, o infraestructura rota o abandonada. Las dos dan
       «sin medir», y por eso el grupo mezcla los mejores con los peores.
    """
    num = den = 0.0
    for k, p in PESOS.items():
        if k not in dim:
            raise KeyError(f"falta la dimension '{k}'")
        if dim[k] is None:
            continue
        v = dim[k]
        if not 0 <= v <= 100:
            raise ValueError(f"'{k}' fuera de rango 0-100: {v}")
        num += v * p
        den += p
    if den == 0:
        return None          # ninguna dimension medida: no hay indice, no hay cero
    return min(tope, round(num / den))


def verificar(ruta):
    """Falla cerrado: cualquier fila que no reproduzca su puntaje publicado aborta."""
    filas = json.load(open(ruta, encoding="utf-8"))
    malas = [r for r in filas if irec(r) != r["score"]]
    print(f"{VERSION} · {len(filas)} organizaciones en {os.path.basename(ruta)}")
    if malas:
        for r in malas[:10]:
            print(f"  DESCUADRE {r['domain']}: calculado {irec(r)} vs publicado {r['score']}")
        raise SystemExit(f"FALLO: {len(malas)} de {len(filas)} no reproducen su puntaje.")
    tocan = sum(1 for r in filas if irec(r, tope=10**6) > TOPE)
    print(f"  OK: las {len(filas)} reproducen su puntaje exacto.")
    print(f"  Tope {TOPE}: lo tocan {tocan} organizaciones"
          + ("  <- el tope no esta moldeando esta edicion." if tocan == 0 else ""))
    sin_edge = sum(1 for r in filas if r["edge"] is None)
    print(f"  Dimension no medida: 'edge' en {sin_edge} de {len(filas)}"
          f" (renormalizadas sobre {1-PESOS['edge']:.2f}).")
    return filas


if __name__ == "__main__":
    ruta = os.path.join(os.path.dirname(os.path.abspath(__file__)), "indice-agosto-2026.json")
    if "--explicar" in sys.argv:
        dom = sys.argv[sys.argv.index("--explicar") + 1]
        r = next(x for x in json.load(open(ruta, encoding="utf-8")) if x["domain"] == dom)
        den = sum(p for k, p in PESOS.items() if r[k] is not None)
        print(f"{dom} · {r['vertical']} · QEX {r['score']}\n")
        for k, p in PESOS.items():
            if r[k] is None:
                print(f"  {k:<13} NO MEDIDA  (peso {p:.0%} redistribuido)")
            else:
                print(f"  {k:<13} {r[k]:>3}  x {p:.2f} / {den:.2f}"
                      f"  = {r[k]*p/den:5.1f} puntos del total")
        print(f"\n  suma = {r['score']}   (tope {TOPE})")
    else:
        verificar(ruta)
