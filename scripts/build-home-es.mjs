/**
 * Genera src/content_html/home.es.html a partir de home.en.html.
 *
 * POR QUE UN GENERADOR Y NO UN ARCHIVO ESCRITO A MANO
 * --------------------------------------------------
 * La maqueta v20 son 33 KB de HTML con canvas, ids y marcadores que el JS busca por
 * nombre. Reescribirla en español a mano es como se pierde una maqueta aprobada (§6 de
 * la casa: los documentos se mueven por archivo, nunca copiados a mano). Aqui el HTML
 * NUNCA se reescribe: se sustituyen CADENAS DE TEXTO exactas, una por una, y cada
 * sustitucion declara cuantas veces debe ocurrir. Si una no calza, el script ABORTA.
 * Asi un cambio futuro en la maqueta EN no produce en silencio una ES a medio traducir.
 *
 * DE DONDE SALE CADA CADENA
 * -------------------------
 * De `handoff/web/rosetta-home-es-textos-v20.md`, aprobado por Cowork el 2-sep. Regla
 * que viaja con ese archivo: "Main NO traduce; monta estos textos tal cual. Lo que no
 * este aqui, se pregunta." Por eso hay cadenas que quedan EN INGLES a proposito: no
 * estan aprobadas, y una traduccion inventada por mi se ve bien y no se puede auditar.
 * Un fragmento en ingles se ve; una frase inventada en español, no. La lista completa
 * de lo que falta esta en `handoff/web/ES-FALTANTES-home-v20.md`.
 *
 * LA CAPA MEDIDA NO SE TRADUCE: ids, hashes, cifras, nombres de claims y las lineas
 * mono de veredicto quedan identicas al EN. Es la regla tipografica del spec §1.5
 * (si esta en mono, es medido) y ademas evita que una traduccion cambie un dato.
 */
import { readFileSync, writeFileSync } from "node:fs";

// [ingles, español, veces que debe aparecer]
const T = [
  // ── Hero ───────────────────────────────────────────────────────────────────
  ["Independent evaluation · Quantum computing", "Evaluación independiente · Computación cuántica", 1],
  ["Quantum, independently measured.", "Cuántica, medida de forma independiente.", 1],
  ["Pre-registered, sealed, published win or lose — so you can build or invest on evidence.",
   "Pre-registrado, sellado, publicado se gane o se pierda — para que puedas construir o invertir sobre evidencia.", 1],
  ["Request a pilot referee →", "Solicita un pilot referee →", 1],
  ["Explore the Evidence Library", "Explora la Evidence Library", 1],

  // ── Survival clock ─────────────────────────────────────────────────────────
  ["what happens to quantum claims after the press release · bar = share of each claim's life survived unchallenged",
   "qué les pasa a los claims cuánticos después del comunicado de prensa · barra = fracción de su vida sobrevivida sin desafío", 1],
  ["· eroded", "· erosionado", 2],
  ["· contested", "· en disputa", 1],
  ["· surviving", "· en pie", 1],
  ["challenged in", "desafiado a los", 2],
  ["challenged at", "desafiado al día", 1],
  ["of 313 days", "de 313 días", 1],
  ["days · unchallenged", "días · sin desafío", 1],
  ["days · we called it", "días · lo dijimos nosotros", 1],
  ["· negative, self-published", "· negativo, autopublicado", 1],
  ["■ surviving · ■ contested · ■ eroded or self-negative", "■ en pie · ■ en disputa · ■ erosionado o negativo propio", 1],
  ["all 16 tracked claims →", "los 16 claims rastreados →", 1],

  // ── Evidence Library ───────────────────────────────────────────────────────
  ["A product of its own", "Un producto en sí mismo", 1],
  ["The Evidence Library.", "La Evidence Library.", 1],
  ["Is there real evidence for this quantum claim?", "¿Existe evidencia real para este claim cuántico?", 1],
  ["A search engine for quantum computing evidence — every claim dated, sourced, statused, and linked to its seal. Of 16 tracked advantage claims: 3 surviving, 5 contested, 6 eroded, 1 open, 1 self-published negative.",
   "Un buscador de evidencia en computación cuántica — cada claim con fecha, fuente, estado y enlace a su sello. De 16 claims de ventaja rastreados: 3 en pie, 5 en disputa, 6 erosionados, 1 abierto, 1 negativo autopublicado.", 1],
  ["e.g. certified randomness, QAOA portfolio, Willow…", "ej. certified randomness, QAOA portfolio, Willow…", 1],
  [">SEARCH<", ">BUSCAR<", 1],
  ["algorithms catalogued", "algoritmos catalogados", 1],
  ["references indexed", "referencias", 1],
  ["advantage claims tracked", "claims rastreados", 1],
  ["still surviving · 19%", "en pie · 19%", 1],
  ["Open the Library →", "Abre la Biblioteca →", 1],

  // ── Casos ──────────────────────────────────────────────────────────────────
  ["What a measurement looks like", "Cómo se ve una medición", 1],
  ["The fight, shown. Not described.", "La pelea, mostrada. No descrita.", 1],
  ["Five industries, five sealed experiments, one rule: the classical champion runs on the same field. Pick one.",
   "Cinco industrias, cinco experimentos sellados, una regla: el campeón clásico corre en la misma cancha. Elige uno.", 1],
  ["Pharma · KRAS protein", "Pharma · proteína KRAS", 1],
  ["Finance · portfolio QAOA", "Finanzas · portafolio QAOA", 1],
  ["Energy · grid case118", "Energía · red case118", 1],
  ["Banking · fraud kernel", "Banca · kernel de fraude", 1],
  ["Aerospace · fluid dynamics", "Aeroespacial · dinámica de fluidos", 1],
  ["<b>In plain terms</b>", "<b>En simple</b>", 5],  // la 6ª ("In plain terms: most public…") queda EN: su cuerpo no esta aprobado

  ["We tested whether a \"quantum walk\" finds the spots where a drug can grab a cancer protein better than classical methods. It didn't just lose to all five classical methods — it lost to picking at random. We published it anyway, because it's our own experiment.",
   "Probamos si una «caminata cuántica» encuentra los puntos donde un fármaco puede agarrar una proteína de cáncer mejor que los métodos clásicos. No solo perdió contra los cinco métodos clásicos — perdió contra elegir al azar. Lo publicamos igual, porque es nuestro propio experimento.", 1],
  ["We put a quantum algorithm and a classical one on the same investment problem, same time, same machine. The classical one found the perfect answer in all twenty tests; the quantum one always fell short — between 10% and 87% depending on the seed — and the gap does not shrink consistently as the problem grows. The 20 instances were regenerated from the sealed seeds and re-solved by brute force: all 20 optima match the seal exactly.",
   "Tomamos 20 corridas selladas de optimización de portafolio. El método cuántico (QAOA) encontró el óptimo verdadero en carteras chicas y lo perdió al crecer — y el costo clásico de verificarlo crece 25× por cada 4 activos. Esa curva — no la brecha de hoy — es la razón de que la pregunta siga abierta.", 1],
  ["Choose which 5 new lines to build in a 118-bus power grid to carry more load at the lowest cost. The classical solver finds the exact optimum in 0.2 seconds; the simulated quantum one lands 1% above it after 52 seconds; and the run on a real IBM quantum chip didn't return enough valid answers to compare at all.",
   "Corrimos la expansión de una red eléctrica real de 118 nodos en un computador cuántico real (8.192 disparos en ibm_marrakesh) contra el solver clásico que usa la industria. El clásico encontró el óptimo; el cuántico no se le acercó. Eso también es un dato — y está sellado.", 1],
  ["A quantum kernel tried to spot fraudulent transactions better than an already-trained classical model. It lost: 25.7% precision-recall against 80.1%. We checked whether having fewer examples to learn from was the excuse — it wasn't: a simple classical model with the same handicap still tied the full classical baseline.",
   "Comparamos un kernel cuántico contra el clasificador clásico estándar sobre 56.962 transacciones reales de tarjetas. El clásico detecta el fraude tres veces mejor (0,80 vs 0,26). En simple: perdió.", 1],
  ["The challenge asks solvers to handle the hard, nonlinear part of fluid flow. We measured two things. Across the full sweep, the classical solver’s error falls four orders of magnitude while the quantum approach never enters the field: at every point it needs more qubits than its own declared budget — 21 to 45 against a cap of 12. And in the exact vortex the statement specifies, the nonlinear term cancels to machine zero — so the benchmark cannot tell a correct solver from one that skips the physics entirely.",
   "El desafío pide resolver la parte difícil (no lineal) del flujo de un fluido. Medimos dos cosas. En todo el barrido, el error del solver clásico cae cuatro órdenes de magnitud mientras el enfoque cuántico nunca entra a la cancha: en cada punto necesita más qubits que su propio presupuesto — 21 a 45 contra un tope de 12. Y en el vórtice exacto que el enunciado especifica, el término no lineal se anula a cero de máquina — el benchmark no puede distinguir un solver correcto de uno que se salta la física.", 1],

  // rotulo comun de los cinco paneles
  ["every asset, edge and choice below is regenerated from the sealed instance — not an illustration",
   "dibujado desde los datos sellados (verificados por hash) — no es una ilustración", 1],
  ["the real network from the sealed topology (positions are a layout, not geography) — not an illustration",
   "dibujado desde los datos sellados (verificados por hash) — no es una ilustración", 1],
  ["every dot is a sealed score — not an illustration",
   "dibujado desde los datos sellados (verificados por hash) — no es una ilustración", 1],
  ["drawn from the sealed raw data (hash-verified) — not an illustration",
   "dibujado desde los datos sellados (verificados por hash) — no es una ilustración", 1],

  // linea de veredicto: solo las ETIQUETAS aprobadas; ids, hashes y cifras quedan igual
  ["outcome:", "resultado:", 5],
  ["quantum worse than random", "cuántico peor que el azar", 1],
  [">no advantage<", ">sin ventaja<", 1],
  ["quantum arm did not qualify", "el brazo cuántico no calificó", 1],
  ["verdict: pending", "veredicto: pendiente", 1],
  ["· declared advantage crossings: 0 ·", "· cruces de ventaja declarados: 0 ·", 1],
  [">sealed run<", ">corrida sellada<", 2],
  [">challenge data<", ">datos del desafío<", 1],
  [">raw counts<", ">conteos crudos<", 1],
  [">sweep run<", ">corrida del barrido<", 1],
  [">nonlinearity run<", ">corrida de no-linealidad<", 1],
  [">raw data<", ">datos crudos<", 1],
  ["▸ every panel is drawn live from the sealed data — drag, switch and replay ·",
   "▸ cada panel se dibuja en vivo desde los datos sellados — arrastra, cambia y repite ·", 1],
  ["the full fight & the industry cases →", "la pelea completa y los casos por industria →", 1],

  // ── Pilot Referee ──────────────────────────────────────────────────────────
  ["Running a quantum pilot?", "¿Corriendo un piloto cuántico?", 1],
  ["We make your pilot produce a defensible number.", "Hacemos que tu piloto produzca un número defendible.", 1],
  ["A pilot that ends with a number everyone can defend: a success criterion written before the run, the strongest classical baseline on the same field, and a result nobody can rewrite.",
   "Tu piloto va a terminar en un deck del vendor evaluándose a sí mismo. Nosotros escribimos el criterio de éxito antes de que corra, corremos al campeón clásico en la misma cancha, y sellamos el resultado — un número que nadie puede reescribir, ni nosotros.", 1],
  ["How a referee works →", "Cómo trabaja un referee →", 1],
  ["See a sample decision page →", "Mira una decision page de muestra →", 1],

  // ── Servicios ──────────────────────────────────────────────────────────────
  ["What you can buy today", "Juicio, con precio a la vista", 1],
  ["Judgment, priced up front.", "Juicio, con precio por delante.", 1],
  ["For funds with a quantum deck on the table", "Para fondos con un deck cuántico sobre la mesa", 1],
  [">For corporates running a quantum pilot</div>", ">Para corporativos con un piloto cuántico</div>", 1],
  ["For biology &amp; chemistry research teams", "Para equipos de investigación en biología y química", 1],
  ["Full pricing and conditions:", "Precios y condiciones completos:", 1],
  [">Services →<", ">Servicios →<", 1],
  ["See a sample decision page — built on our real verdict V-0012 →",
   "Mira una decision page de muestra — construida sobre nuestro veredicto real V-0012 →", 1],

  // ── Ledger ─────────────────────────────────────────────────────────────────
  ["The Ledger", "El Ledger", 1],
  ["A public record that cannot be rewritten.", "Un registro público que no se puede reescribir.", 1],
  ["Every experiment, report and correction we produce is hash-anchored to Bitcoin via OpenTimestamps and mirrored on GitHub, Codeberg and D1 — including the ones we lose.",
   "Cada experimento, informe y corrección que producimos queda anclado por hash a Bitcoin vía OpenTimestamps y espejado en GitHub, Codeberg y D1 — incluidos los que perdemos.", 1],
  [">sealed runs</div>", ">corridas selladas</div>", 1],  // solo la etiqueta de la cifra; "20 sealed runs" es capa medida
  ["pre-registrations", "pre-registros", 1],
  ["verdict published", "veredicto publicado", 1],
  ["errata published", "erratas publicadas", 1],
  ["quantum wins measured", "victorias cuánticas medidas", 1],
  ["136 sealed artifacts in total (132 real + 4 demo recipes) · counted in D1 on 2026-08-31 · every number links to its source · latest entries:",
   "136 artefactos sellados en total (132 reales + 4 recetas demo) · contados en D1 el 2026-08-31 · cada número enlaza a su fuente · últimas entradas:", 1],
  ["We retract three of our own claims; the report&rsquo;s central finding stands",
   "Nos retractamos de tres afirmaciones propias; el hallazgo central del informe se mantiene", 1],
  ["Quantum fidelity kernel vs classical on 56,962 card transactions — no advantage",
   "Kernel de fidelidad cuántico vs clásico sobre 56.962 transacciones — sin ventaja", 1],
  ["QAOA p=2 on real hardware, IEEE case118 — ibm_marrakesh, 8,192 shots",
   "QAOA p=2 en hardware real, IEEE case118 — ibm_marrakesh, 8.192 disparos", 1],
  ["Open the full ledger →", "Abre el ledger completo →", 1],
  ["Verify a seal", "Verifica un sello", 1],

  // ── Two-Layer ──────────────────────────────────────────────────────────────
  ["Who pays, and who never does", "Quién paga, y quién nunca", 1],
  ["The Two-Layer Rule", "La Two-Layer Rule", 1],
  ["Who signs.", "Quién firma.", 1],
  ["Every verdict carries a named author; the legal entity, the founder's name and the conflict-of-interest policy live on the About page — because a referee you can't name isn't a referee.",
   "Cada veredicto lleva un autor con nombre; la entidad legal, el nombre del fundador y la política de conflictos viven en la página Nosotros — porque un árbitro que no puedes nombrar no es un árbitro.", 1],
  ["About the firm →", "Sobre la firma →", 1],
  ["Judgment is paid for by those who rely on it — corporates, funds and research teams —",
   "El juicio lo pagan quienes dependen de él — empresas, fondos y equipos de investigación —", 1],
  ["never by the vendors being evaluated", "nunca los vendors evaluados", 1],
  [". Anyone may use the sealing infrastructure, which notarizes integrity, not truth. Our own experiments publish under exactly the same rules.",
   ". Cualquiera puede usar la infraestructura de sellado, que notariza integridad, no verdad. Nuestros propios experimentos publican bajo exactamente las mismas reglas.", 1],
  ["The full rule →", "La regla completa →", 1],

  // ── Monitor ────────────────────────────────────────────────────────────────
  ["RQ Advantage Monitor · Edition 001 ·", "RQ Advantage Monitor · Edición 001 ·", 1],
  ["in preparation", "en preparación", 1],
  ["What the ledger can already say.", "Lo que el ledger ya puede decir.", 1],
  ["you@firm.com", "tu@firma.com", 1],
  ["Get Edition 001 when it seals", "Recibe la Edición 001 cuando selle", 1],
  ["one email when the edition seals · no list, no drip", "un solo correo cuando la edición selle · sin lista, sin goteo", 1],

  // ── Notes ──────────────────────────────────────────────────────────────────
  ["Notes · published by our evidence engine", "Notes · publicadas por nuestro motor de evidencia", 1],
  ["Latest from the desk.", "Lo último del escritorio.", 1],
  ["All notes →", "Todas las notas →", 1],

  // El pie ya no vive en el cuerpo: es el componente PieV2, que trae su propio texto
  // aprobado por idioma. Salio de aqui porque venia con los once enlaces en href="#".

  // ── Accesibilidad ──────────────────────────────────────────────────────────
  ["aria-label=\"Search the Evidence Library\"", "aria-label=\"Busca en la Evidence Library\"", 1],
  ["aria-label=\"Email for Monitor 001\"", "aria-label=\"Correo para el Monitor 001\"", 1],
];

let html = readFileSync("src/content_html/home.en.html", "utf8");
const malas = [];
for (const [en, es, n] of T) {
  const veces = html.split(en).length - 1;
  if (veces !== n) { malas.push(`"${en.slice(0, 60)}…" aparece ${veces} veces, se esperaban ${n}`); continue; }
  html = html.split(en).join(es);
}
if (malas.length) {
  console.error("ABORTA: la maqueta EN cambio y el mapa quedo viejo.");
  malas.forEach((m) => console.error("  " + m));
  process.exit(1);
}
writeFileSync("src/content_html/home.es.html", html);
console.log(`home.es.html generado · ${T.length} cadenas sustituidas · ${html.length} bytes`);
