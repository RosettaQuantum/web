// Las dos capas de medición (27-nov-2026, decisión de Nicholas; REGLA-dos-capas-de-medicion v2,
// con el anexo legal de EE. UU., la UE y Chile).
//
//   Capa 1 · sin autorización: todo lo que un servidor le entrega a cualquier cliente anónimo antes
//            de pedir una clave, a ritmo bajo, deteniéndose en la primera puerta.
//   Capa 2 · dominio verificado por DNS **y** autorización aceptada (casillero de la verificación):
//            más nombres, SSH en todos los nombres, y lo que la autorización enumera.
//
// Esta es la ÚNICA definición de qué capa le toca a un dominio y de qué deja medir cada una. Los
// consumidores (la página pública, la medición para agentes, el cron, la máquina mensual) la leen de
// aquí: dos definiciones de «qué se puede tocar» divergen en silencio, y el síntoma sería un sondeo
// que la regla prohíbe.
//
// Falla cerrada en las dos direcciones que importan:
//   · la capa 2 exige una fila que lo pruebe; cualquier error de base deja la capa 1;
//   · la exclusión: si la tabla no existe todavía (antes de aplicar el esquema) no hay exclusiones
//     que respetar; cualquier OTRO error de base cuenta como excluido, porque medir a quien pidió
//     no ser medido es el error que no tiene vuelta.

// El tope de la capa 1 es el de la rúbrica publicada: UNA definición (qex-nucleo.mjs).
import { MAX_SONDEADOS } from "../public/js/qex-nucleo.mjs";

export const VERSION_AUTORIZACION = "RQ-AUTORIZACION-1";
export const PAGINA_QUIEN_MIDE = "https://rosettaquantum.com/es/q-ready/quien-mide/";
// Cada conexión HTTP se identifica con la página que explica quién mide y cómo pedir la exclusión.
export const USER_AGENT = `RosettaQ-Ready/1.0 (+${PAGINA_QUIEN_MIDE})`;

export const CAPAS = Object.freeze({
  1: Object.freeze({ max_nombres: MAX_SONDEADOS, ssh: "dominio_y_www", get_raiz: true }),
  2: Object.freeze({ max_nombres: 50, ssh: "todos", get_raiz: true }),
});

const normal = (d) => String(d || "").trim().toLowerCase().replace(/\.$/, "");
// Un dominio excluido cubre sus subdominios: quien pidió no medir ejemplo.cl tampoco quiere app.ejemplo.cl.
export function candidatos(dominio) {
  const p = normal(dominio).split(".").filter(Boolean);
  const out = [];
  for (let i = 0; i <= p.length - 2; i++) out.push(p.slice(i).join("."));
  return out;
}

export async function excluido(db, dominio) {
  const c = candidatos(dominio);
  if (!db || !c.length) return false;
  try {
    const f = await db.prepare(
      `SELECT dominio FROM qready_exclusiones WHERE confirmado_utc IS NOT NULL AND revocado_utc IS NULL AND dominio IN (${c.map((_, i) => `?${i + 1}`).join(",")}) LIMIT 1`)
      .bind(...c).first();
    return !!f;
  } catch (e) {
    const m = String((e && e.message) || e);
    if (/no such table/i.test(m)) return false;
    console.error("excluido:", m);
    return true;
  }
}

export async function capaDe(db, dominio) {
  const d = normal(dominio);
  if (!db || !d) return 1;
  try {
    const f = await db.prepare(
      "SELECT 1 AS ok FROM qready_dominios WHERE dominio = ?1 AND entorno = 'produccion' AND verificado_en IS NOT NULL AND autorizacion_version IS NOT NULL AND autorizacion_retirada_utc IS NULL LIMIT 1")
      .bind(d).first();
    return f && f.ok === 1 ? 2 : 1;
  } catch (e) {
    console.error("capaDe:", e && e.message);
    return 1;
  }
}

// Qué hosts reciben el saludo SSH en cada capa.
export function hostsSsh(capa, dominio, www, nombres) {
  return CAPAS[capa].ssh === "todos" ? [...new Set([dominio, www, ...nombres])] : [...new Set([dominio, www])];
}
