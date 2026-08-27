#!/usr/bin/env node
/**
 * El oro significa una cosa. Si significa dos, deja de ser una senal.
 *
 * LA REGLA, fijada por Diseno el 2026-08-27 despues de mirar cada uso en la consola viva:
 *
 *     El verde es lo que esta corriendo.
 *     El oro MACIZO es lo que quedo sellado y se puede citar.
 *     El oro PUNTEADO es lo que esta deliberadamente FUERA del registro — el modo ensayo.
 *
 * La tercera no es invento: esta escrita en `tema.css` — *«Lo provisional va punteado; el oro
 * punteado es ensayo»*. Una version anterior de esta regla tenia solo dos estados y **habria
 * marcado el ensayo como infraccion**, que es una de las mejores decisiones que tiene la
 * consola: **el mismo color dice «esto vale» o «esto no cuenta» segun el trazo.**
 *
 * POR QUE ESTO ES UN GUARDIA Y NO UNA NOTA DE ESTILO. Si el oro tambien pinta los
 * encabezados, **el sello compite por atencion con cada `h2` de la pantalla** y deja de
 * distinguir evidencia de trabajo en curso. No es purismo cromatico: es que la unica senal que
 * separa lo sellado de lo que esta corriendo se diluye en cuanto alguien la usa de adorno.
 *
 * DOS COSAS QUE VIGILA, y la segunda es la mas barata de romper:
 *
 *   1. **Semantica** — oro solo en el eje probatorio. Fuera de el, bloquea.
 *   2. **Procedencia del color** — **oro que no venga de `var(--oro…)` es infraccion por
 *      definicion**, aunque este en el lugar correcto: un literal no puede seguir al token
 *      cuando se unifique el tono. Caso real que lo motiva: `tema.css` pinta el fondo del
 *      ensayo con `rgba(201,162,77,.07)` escrito a mano — que es `#c9a24d`, el oro de
 *      `tema.css`… **el que PIERDE la pelea de especificidad contra `consola.css`**. Ese fondo
 *      no coincide hoy ni va a coincidir nunca con el `#d4a94a` que se pinta al lado.
 *
 * SU PUNTO CIEGO, declarado: **lee las hojas, no la pantalla.** No sabe cual gana una pelea de
 * especificidad — y ese es justamente el defecto que este frente tiene documentado. Para lo
 * pintado hay que leer el DOM computado. Aqui se vigila lo que se escribe; que lo escrito sea
 * lo que se ve es otra pregunta y otro instrumento.
 *
 * Uso:
 *   node scripts/check-oro-semantico.mjs --self-test
 *   node scripts/check-oro-semantico.mjs public/consola
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

/** Quien actua esta senal, y que hace al recibirla. Declarado aqui, no en un documento aparte. */
export const CONSUMIDOR = {
  quien: "la sesion de Diseno",
  hace: "mueve el oro fuera del eje probatorio a teal o tenue, o declara la excepcion aqui con su razon",
};

/** El eje probatorio: lo sellado y lo citable. Aqui el oro es correcto. */
export const EJE_PROBATORIO = ["#sello", ".sello", ".sello .t", ".err", ".chk.c"];

/**
 * Excepciones **declaradas**: hoy usan oro, NO caen en el eje, y son decision de diseno
 * pendiente — no defecto. Se reportan siempre.
 *
 * Van declaradas y no silenciadas a proposito: **un guardia que calla sobre lo que no cubre se
 * lee como que lo cubrio.** La recomendacion de Diseno es que estos tres pasen a teal o tenue,
 * porque si el oro pinta los encabezados deja de ser senal — pero es cambio visible y entra
 * por el spec, no por un guardia.
 */
export const EXCEPCIONES = {
  ".nav .g": "el icono de navegacion — propuesto a teal",
  '.nav[aria-current="true"]': "el indicador de seccion activa — propuesto a teal",
  "h2": "los rotulos de seccion — el que mas diluye la senal",
};

/**
 * Sin decidir. **No entran a la lista blanca por inferencia.**
 *
 * `.chk.c` — Diseno pidio preguntarle a quien la escribio. Lo que dice el codigo: `.chk.q` es
 *   teal y `.chk.c` es oro, **son un par**, lo que sugiere brazo cuantico / brazo clasico. Si
 *   es eso, NO es eje probatorio y el oro ahi seria un tercer significado. Es una inferencia
 *   de dos letras y por eso no se resuelve aqui.
 * `.btn:focus-visible` — el unico foco en oro: `.nav`, `select`, `input` y `.chk` usan teal.
 *   Puede ser accion primaria a proposito o una inconsistencia.
 */
export const SIN_DECIDIR = {
  ".chk.c": "¿brazo clasico o item completado? .chk.q es teal — parecen un par",
  ".btn:focus-visible": "unico anillo de foco en oro; los otros cuatro son teal",
};

/** Un color es oro si su tono cae en la banda calida con saturacion real. */
export function esColorOro(txt) {
  const hex = /#([0-9a-f]{6})\b/i.exec(txt);
  const rgb = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(txt);
  let r, g, b;
  if (hex) [r, g, b] = [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16));
  else if (rgb) [r, g, b] = [1, 2, 3].map((i) => Number(rgb[i]));
  else return false;
  const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255, l = (mx + mn) / 2;
  if (mx === mn) return false;
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h = mx === r / 255 ? (g - b) / 255 / d + (g < b ? 6 : 0) : mx === g / 255 ? (b - r) / 255 / d + 2 : (r - g) / 255 / d + 4;
  h *= 60;
  return h >= 35 && h <= 58 && s > 0.25 && l >= 0.35 && l <= 0.78;
}

/** Quita comentarios: un guardia que los lee aprueba prosa (CLAUDE.md §4 bis). */
export function soloCss(css) {
  return String(css ?? "").replace(/\/\*[\s\S]*?\*\//g, " ");
}

/**
 * Cada regla CSS que usa oro, con su selector, si viene de token y si es punteada.
 *
 * @returns {{selector:string, porToken:boolean, punteado:boolean, decl:string}[]}
 */
export function usosDeOro(css) {
  const limpio = soloCss(css);
  const out = [];
  for (const m of limpio.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const cuerpo = m[2];
    const porToken = /var\(\s*--oro[\w-]*\s*\)/.test(cuerpo);
    // Un literal solo cuenta si esta en una propiedad de color, no en cualquier numero.
    const literal = [...cuerpo.matchAll(/(?:color|background|border|outline|box-shadow|fill|stroke)[^;]*/gi)]
      .some((d) => esColorOro(d[0]) && !/var\(\s*--oro/.test(d[0]));
    if (!porToken && !literal) continue;
    // El selector se normaliza quitando el prefijo de tema y el `body.consola`, que solo
    // existen para ganar especificidad y no cambian QUE elemento se pinta.
    for (const sel of m[1].split(",")) {
      const s = sel.replace(/:root\s*/g, "").replace(/body\.consola\s*/g, "").trim();
      if (!s) continue;
      // `porToken` y `literal` son INDEPENDIENTES, no opuestos. La regla real de `.err` usa
      // las dos: `border:...var(--oro)` mas `background:rgba(201,162,77,.07)`. Modelarlo como
      // «token O literal» dejaba el literal invisible — el defecto que este guardia existe
      // para cazar pasaba por venir acompanado de un uso correcto.
      out.push({ selector: s, porToken, literal, punteado: /\bdashed\b/.test(cuerpo), decl: cuerpo.trim().slice(0, 90) });
    }
  }
  return out;
}

/**
 * @param {{usos:object[], eje?:string[], excepciones?:object, sinDecidir?:object}} ctx
 */
export function evaluar({ usos, eje = EJE_PROBATORIO, excepciones = EXCEPCIONES, sinDecidir = SIN_DECIDIR }) {
  const literales = usos.filter((u) => u.literal);
  const fueraDelEje = usos.filter((u) =>
    u.porToken && !eje.includes(u.selector) && !(u.selector in excepciones) && !(u.selector in sinDecidir));
  const declaradas = usos.filter((u) => u.selector in excepciones);
  const pendientes = usos.filter((u) => u.selector in sinDecidir);

  return {
    vistos: usos.length,
    enEje: usos.filter((u) => eje.includes(u.selector)).length,
    literales, fueraDelEje, declaradas, pendientes,
    bloquea: literales.length > 0 || fueraDelEje.length > 0,
  };
}

// ── self-test ────────────────────────────────────────────────────────────────────────────
const _esPrincipal = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (_esPrincipal && process.argv.includes("--self-test")) {
  // EL DEFECTO REAL, copiado de tema.css tal cual (§2: contra el defecto real, no un ejemplo).
  const REAL_LITERAL = ":root body.consola .err{border:1px dashed var(--oro);background:rgba(201,162,77,.07);color:var(--oro-txt)}";
  const REAL_SELLO = ":root body.consola #sello{border-color:var(--oro)}";

  const casos = [
    // ── grita ──
    ["grita: el literal real de tema.css, que ademas es el oro que PIERDE", () => {
      const r = evaluar({ usos: usosDeOro(REAL_LITERAL) });
      return r.literales.length === 1 && r.bloquea === true;
    }],

    ["grita: oro nuevo fuera del eje probatorio", () =>
      evaluar({ usos: usosDeOro(".tarjeta{color:var(--oro)}") }).fueraDelEje.length === 1],

    ["grita: dice QUE selector, no solo que hay oro suelto", () =>
      evaluar({ usos: usosDeOro(".tarjeta{color:var(--oro)}") }).fueraDelEje[0].selector === ".tarjeta"],

    // ── calla ──
    ["CALLA: el sello real, oro por token y en el eje", () =>
      evaluar({ usos: usosDeOro(REAL_SELLO) }).bloquea === false],

    // EL ESTADO QUE UNA REGLA DE DOS ESTADOS HABRIA MARCADO MAL: el ensayo va punteado y vale.
    ["CALLA: oro PUNTEADO es ensayo, no infraccion", () => {
      const u = usosDeOro(":root body.consola .err{border:1px dashed var(--oro)}");
      const r = evaluar({ usos: u });
      return u[0].punteado === true && r.bloquea === false;
    }],

    ["CALLA: las tres excepciones declaradas se reportan y no bloquean", () => {
      const r = evaluar({ usos: usosDeOro('h2{color:var(--oro-hondo)} .nav .g{color:var(--oro)}') });
      return r.declaradas.length === 2 && r.bloquea === false;
    }],

    ["CALLA: lo sin decidir no se aprueba ni se bloquea — se muestra", () => {
      const r = evaluar({ usos: usosDeOro(".chk.c{border-left:2px solid var(--oro)}") });
      return r.pendientes.length === 1 && r.bloquea === false;
    }],

    ["CALLA: teal en cualquier parte no es asunto de este guardia", () =>
      usosDeOro(".loquesea{color:var(--teal)}").length === 0],

    // EL PARADOJICO: el oro DESCRITO en un comentario y ausente del CSS.
    ["CALLA: 'var(--oro)' solo mencionado en un comentario", () =>
      usosDeOro("/* ojo: no poner var(--oro) en .tarjeta */\n.tarjeta{color:var(--teal)}").length === 0],

    // ── el detector de color ──
    ["reconoce el oro que se pinta y el que pierde", () =>
      esColorOro("#d4a94a") && esColorOro("#c9a24d") && esColorOro("rgba(201,162,77,.07)")],

    ["NO confunde el verde ni el fondo con oro", () =>
      !esColorOro("#52e884") && !esColorOro("#131110") && !esColorOro("#ffffff")],

    // Sin este filtro, un `border-radius:3px` o un `margin` cualquiera se leeria como color.
    ["no toma un numero cualquiera por color", () =>
      usosDeOro(".x{border-radius:3px;margin:26px 0 10px}").length === 0],

    // ── mutacion ──
    ["MUTACION: sin exigir procedencia del token, el literal real pasaria", () => {
      const conToken = evaluar({ usos: usosDeOro(REAL_LITERAL) }).bloquea;
      const soloSemantica = evaluar({ usos: usosDeOro(REAL_LITERAL).map((u) => ({ ...u, literal: false })) }).bloquea;
      return conToken === true && soloSemantica === false;
    }],
  ];

  let fallos = 0;
  for (const [nombre, fn] of casos) {
    let paso; try { paso = fn(); } catch { paso = false; }
    console.log(`${paso ? "ok   " : "FALLA"}  ${nombre}`);
    if (!paso) fallos++;
  }
  console.log(`\n[oro-semantico] self-test: ${casos.length - fallos} de ${casos.length} pasaron.`);
  process.exit(fallos ? 1 : 0);
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────
if (_esPrincipal && !process.argv.includes("--self-test")) {
  const dir = process.argv[2] ?? "public/consola";
  if (!existsSync(dir)) {
    console.error(`[oro-semantico] NO SE PUDO COMPROBAR: no existe ${dir}`);
    process.exit(2);
  }
  const usos = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".css"))) {
    for (const u of usosDeOro(readFileSync(join(dir, f), "utf8"))) usos.push({ ...u, archivo: f });
  }
  const r = evaluar({ usos });

  console.log(`[oro-semantico] ${dir} · ${r.vistos} uso(s) de oro · ${r.enEje} en el eje probatorio`);
  for (const u of r.declaradas) console.log(`   ~ excepcion declarada  ${u.selector}  —  ${EXCEPCIONES[u.selector]}`);
  for (const u of r.pendientes) console.log(`   ? sin decidir          ${u.selector}  —  ${SIN_DECIDIR[u.selector]}`);

  if (r.literales.length) {
    console.error(`\n[oro-semantico] BLOQUEADO: ${r.literales.length} oro(s) escritos a mano en vez de var(--oro…)`);
    for (const u of r.literales) console.error(`    ${u.archivo}  ${u.selector}\n       ${u.decl}`);
    console.error("[oro-semantico] Un literal no puede seguir al token cuando se unifique el tono.");
  }
  if (r.fueraDelEje.length) {
    console.error(`\n[oro-semantico] BLOQUEADO: ${r.fueraDelEje.length} uso(s) de oro fuera del eje probatorio`);
    for (const u of r.fueraDelEje) console.error(`    ${u.archivo}  ${u.selector}`);
    console.error("[oro-semantico] El oro es lo sellado y citable. Si tambien es adorno, deja de ser senal.");
    console.error("[oro-semantico] Muevelo a teal o tenue, o declara la excepcion con su razon.");
  }
  if (r.bloquea) process.exit(1);
  console.log("\n[oro-semantico] el oro significa una sola cosa.");
}
