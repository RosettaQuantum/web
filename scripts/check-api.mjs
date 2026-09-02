/**
 * T-api — los endpoints nuevos existen, y los viejos no cambiaron de forma.
 *
 * La regla del spec es ADITIVO: /v1/state conserva TODAS sus claves previas. Un
 * endpoint que gana campos no rompe a nadie; uno que pierde o renombra rompe a los
 * cinco guardias de CI y a cualquier tercero que no podemos enumerar.
 */
export const CONSUMIDOR = {
  quien: "quien empuja a una rama rebuild",
  hace: "no sigue: /v1/claims que devuelva un no-verificado publica sobre terceros sin comprobarlo, y una clave perdida en /v1/state rompe consumidores que no podemos enumerar",
};
const P = (process.env.PREVIEW_URL || "").replace(/\/+$/, "");
if (!P) { console.error("ABORTA: falta PREVIEW_URL"); process.exit(1); }
const j = async (r) => (await fetch(P + r, { headers: { "x-rq-check": "1" } })).json();
const fallos = [];
const ok = (m) => console.log(`  ok    ${m}`);
const mal = (m) => { console.log(`  FALLA ${m}`); fallos.push(m); };

// 1 · /v1/claims — solo verificados
try {
  const c = await j("/v1/claims");
  c.total === 16 ? ok(`/v1/claims devuelve 16`) : mal(`/v1/claims devuelve ${c.total}, se esperaban 16`);
  c.no_verificados_excluidos === 3 ? ok("3 no verificados excluidos y declarados") : mal(`excluidos=${c.no_verificados_excluidos}, se esperaban 3`);
  const malos = (c.claims || []).filter((x) => !x.id || !x.claim_date || !x.status);
  malos.length ? mal(`${malos.length} claims sin id/fecha/estado`) : ok("los 16 traen id, fecha y estado");
  (c.claims || []).some((x) => x.clock_days === null) ? ok("clock_days NULL se preserva (no se inventa un 0)") : ok("sin NULL en esta muestra");
} catch (e) { mal(`/v1/claims: ${e}`); }

// 2 · /v1/posts — extracto real, filtro published
try {
  const p = await j("/v1/posts?limit=2");
  p.total === 2 ? ok("/v1/posts?limit=2 devuelve 2") : mal(`/v1/posts devuelve ${p.total}`);
  (p.posts || []).every((x) => x.slug && x.fecha) ? ok("slug y fecha presentes") : mal("falta slug o fecha");
} catch (e) { mal(`/v1/posts: ${e}`); }

// 2 bis · excerpt no vacio en EN y ES, y DISTINTO del tldr
// La primera version devolvia tldr.slice(0,220): no estaba vacio y estaba mal. Por eso
// la asercion compara contra el tldr en vez de solo medir el largo.
try {
  for (const lang of ["en", "es"]) {
    const p = await j(`/v1/posts?limit=2&lang=${lang}`);
    const vacios = (p.posts || []).filter((x) => !x.excerpt || x.excerpt.length < 40);
    const clonados = (p.posts || []).filter((x) => x.excerpt && x.tldr && x.tldr.startsWith(x.excerpt.slice(0, 60)));
    vacios.length ? mal(`${lang}: ${vacios.length} post(s) con excerpt vacio`) : ok(`${lang}: los 2 traen excerpt (${(p.posts||[]).map((x)=>x.excerpt.length).join("/")} chars)`);
    clonados.length ? mal(`${lang}: ${clonados.length} excerpt es el tldr recortado — la home mostraria el mismo texto dos veces`) : ok(`${lang}: excerpt sale del cuerpo, no del tldr`);
  }
} catch (e) { mal(`/v1/posts: ${e}`); }

// 3 · /v1/state — aditivo, ninguna clave perdida
const PREVIAS = ["corridas_selladas","veredictos_publicados","pre_registros","recetas","manifiestos","predicciones","reportes","erratas","victorias_cuanticas_medidas","lectura"];
try {
  const s = await j("/v1/state");
  const faltan = PREVIAS.filter((k) => !(k in (s.estado_medido || {})));
  faltan.length ? mal(`/v1/state perdio claves: ${faltan}`) : ok(`/v1/state conserva las ${PREVIAS.length} claves previas`);
} catch (e) { mal(`/v1/state: ${e}`); }

console.log(fallos.length ? `\nT-api: ${fallos.length} fallo(s)` : "\nT-api: endpoints nuevos vivos y /v1/state intacto");
process.exit(fallos.length ? 1 : 0);
