// Q-Ready Verified: el pegamento con el Worker (13-nov-2026). Sólo worker.js importa este archivo:
// trae lo que en node no se puede cargar —global.css como texto para los colores del sello, y el
// motor de medición, que abre sockets— y se lo pasa a lib/qready-verificado.mjs, que sí es puro.
//
// El cron diario (scheduled en worker.js) entra por cronDiario(): re-chequea el TXT de cada dominio
// verificado y lo vuelve a medir con tomarFoto(), el MISMO camino que /v1/medicion y la página.
import globalCss from "../src/styles/global.css";
import { tokensDeCss } from "./og.mjs";
import { tomarFoto, sectoresValidos } from "./medicion-agentes.mjs";
import { manejarVerificado, cronVerificados, resolverPara } from "./qready-verificado.mjs";
import { manejarWellKnown, extrasWellKnown } from "./qready-wellknown.mjs";

// Los colores del sello salen de global.css, igual que la tarjeta social: no se copian hex aquí.
let TOKENS = null;
export function tokensSello() {
  if (TOKENS) return TOKENS;
  const t = tokensDeCss(globalCss);
  const alert = /--alert\s*:\s*(#[0-9A-Fa-f]{3,8})/.exec(globalCss);
  if (!alert) throw new Error("qready: global.css no define --alert. El sello no se inventa un color.");
  TOKENS = { ...t, alert: alert[1] };
  return TOKENS;
}

const deps = () => ({ tokens: tokensSello(), tomarFoto, sectoresValidos: sectoresValidos(), extrasDe: extrasWellKnown });

export async function manejarQready(request, env, url, ctx) {
  const wk = await manejarWellKnown(request, env, url);
  if (wk) return wk;
  return manejarVerificado(request, env, url, ctx, deps());
}

export async function cronDiario(env) {
  const resumen = await cronVerificados(env, { tomarFoto, resolver: resolverPara(false), entorno: "produccion", extrasDe: extrasWellKnown });
  console.log("qready cron:", JSON.stringify(resumen));
  return resumen;
}
