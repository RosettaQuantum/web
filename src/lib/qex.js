/**
 * Ponderacion canonica del QEX. Unica fuente para todo lo que se renderiza.
 *
 * Debe coincidir con calcular_qex.py (PESOS) y con
 * src/data/informe-pqc/2026-08.json (/indice/dimensiones).
 * Lo vigila scripts/check-qex-formula.mjs, que falla cerrado si divergen.
 *
 * Nace de un defecto real (2026-08-19): el informe de ejemplo declaraba una tabla
 * de pesos (edge 35 %) y dibujaba un 28 escrito a mano que esa tabla no producia.
 * Habia tres numeros para la misma empresa —33, 23,3 y 28— y ninguno derivaba de
 * otro. La revision visual no lo veia: los tres son plausibles.
 */

export const PESOS = { cert: 40, higiene: 25, hndl: 25, edge: 10 };
export const ORDEN = ['cert', 'higiene', 'hndl', 'edge'];

/**
 * Techo alcanzable por medicion externa. Ninguna medicion desde afuera puede
 * afirmar que una organizacion esta preparada: el interior (HSM, mTLS, respaldos,
 * firmware) pesa mas que lo visible, y no lo vemos. El indice se declara
 * incompleto por diseno, y por eso el puntaje se recorta aqui.
 *
 * Estaba SOLO en calcular_qex.py: para {100,100,100,100} el Python devolvia 84 y
 * este modulo 100. La misma formula daba dos numeros y el guardia no lo veia
 * porque comparaba pesos y no el techo. (2026-08-20)
 */
export const TOPE = 84;

/**
 * Niveles de MADUREZ. Un solo eje: en qué estado está la organización, nunca qué
 * técnica usa. La banda de 70–84 se llamaba «Hybrid at edge» —que es una técnica,
 * no un nivel— y rompía el eje: las otras cuatro describen estado y esa describía
 * mecanismo. (Punto 11 de la auditoría, 2026-08-20.)
 *
 * `n` es el nombre canónico en español, `en` el equivalente para la versión inglesa.
 */
export const BANDAS = [
  { max:  29, n: 'Expuesto',          en: 'Exposed',             cls: 'notready', hex: '#E0705C', rango: '0–29',
    sigEs: 'sin postura observable',                       sigEn: 'no observable posture' },
  { max:  49, n: 'Consciente',        en: 'Aware',               cls: 'aware',    hex: '#D9B87A', rango: '30–49',
    sigEs: 'higiene parcial, sin transición material',     sigEn: 'partial hygiene, no material transition' },
  { max:  69, n: 'En transición',     en: 'In transition',       cls: 'piloting', hex: '#D9B87A', rango: '50–69',
    sigEs: 'avances puntuales, no sistemáticos',           sigEn: 'isolated progress, not systematic' },
  { max:  84, n: 'Perímetro migrado', en: 'Perimeter migrated',  cls: 'hybrid',   hex: '#7FC9BE', rango: '70–84',
    sigEs: 'borde público protegido; interior sin observar', sigEn: 'public edge protected; interior unobserved' },
  { max: 100, n: 'Cripto-ágil',       en: 'Crypto-agile',        cls: 'agile',    hex: '#4DC4B5', rango: '85–100',
    sigEs: 'inalcanzable por medición externa',            sigEn: 'unreachable by external measurement' },
];


/**
 * Media ponderada sobre las dimensiones efectivamente medidas. Se renormaliza
 * sobre los pesos usables, igual que calcular_qex.py: no medir una dimension no
 * es lo mismo que sacar 0 en ella.
 */
export function score(valores) {
  const usables = ORDEN.filter((k) => valores[k] !== null && valores[k] !== undefined);
  if (!usables.length) throw new Error('QEX: ninguna dimension medida, no hay score que mostrar');
  const den = usables.reduce((a, k) => a + PESOS[k], 0);
  return Math.min(TOPE, Math.round(usables.reduce((a, k) => a + PESOS[k] * valores[k], 0) / den));
}

export function banda(s) {
  const b = BANDAS.find((x) => s <= x.max);
  if (!b) throw new Error(`QEX: score ${s} fuera de 0–100`);
  return b;
}

/** Leyenda de bandas, con la del score marcada. */
export function leyenda(s, es) {
  const activa = banda(s);
  return BANDAS.map((b) => ({ txt: `${b.n} (${b.rango})`, activa: b === activa, hex: b.hex, sig: es ? b.sigEs : b.sigEn }));
}
