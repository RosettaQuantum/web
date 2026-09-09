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
  // La linea sellada del cierre. Van PRIMERO a proposito: son frases largas, y el
  // generador sustituye en orden — si una entrada anterior toca un fragmento, la larga
  // deja de calzar y el generador aborta. Primero, nadie las ha mordido todavia.
  ["</span> sealed runs · <span data-rq=\"rq-wins\">0</span> quantum wins measured.</b>",
   "</span> corridas selladas · <span data-rq=\"rq-wins\">0</span> victorias cuánticas medidas.</b>", 1],
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

  // ── Servicios ──────────────────────────────────────────────────────────────

  // ── Ledger ─────────────────────────────────────────────────────────────────
  ["Every experiment, report and correction we produce is hash-anchored to Bitcoin via OpenTimestamps and mirrored on GitHub, Codeberg and D1 — including the ones we lose.",
   "Cada experimento, informe y corrección que producimos queda anclado por hash a Bitcoin vía OpenTimestamps y espejado en GitHub, Codeberg y D1 — incluidos los que perdemos.", 1],  // solo la etiqueta de la cifra; "20 sealed runs" es capa medida
  ["Open the full ledger →", "Abre el ledger completo →", 1],

  // ── Two-Layer ──────────────────────────────────────────────────────────────

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

  // ── Cierre ES del 3-sep (handoff/web/rosetta-es-cierre-completo.md) ────────
  // REGLA NUEVA que zanja la mayoria de las 45 pendientes: lo dibujado DENTRO del canvas
  // (ejes, leyendas de grafico, rotulos de datos) queda en INGLES en los dos idiomas —
  // es capa medida, la misma en todo el mundo, como los ids y los hashes. Se traducen:
  // titulos de panel, pestañas y toggles (son UI), bajadas y prosa.

  // Cabeceras de los cinco paneles. Los IDS SE CONSERVAN: el texto aprobado de Finanzas
  // y Energia los omitia, y una cabecera sin su id cita menos que su version en ingles
  // en la pagina cuyo lema es "cada numero enlaza a su fuente".
  ["KRAS G12C · PDB 4OBE · 169 residues · 927 contacts (Cα–Cα ≤ 8.5 Å) · sealed challenge cleveland-2026-07",
   "KRAS G12C · PDB 4OBE · 169 residuos · 927 contactos (Cα–Cα ≤ 8,5 Å) · desafío sellado cleveland-2026-07", 1],
  // OJO: el texto aprobado escribia el id en mayusculas (CLEVELAND-2026-07). Se deja como
  // esta en el dato sellado: cambiarle la caja a un identificador en una pagina que se
  // vende por verificable es cambiar el dato.
  ["V-0012 · Constrained portfolio compression · pick k of n assets · QAOA p=2 vs OR-Tools CP-SAT · 20 sealed runs",
   "V-0012 · Compresión de portafolio con restricciones · elige k de n activos · QAOA p=2 vs OR-Tools CP-SAT · 20 corridas selladas", 1],
  // El texto aprobado decia "QAOA vs fuerza bruta". El campeon clasico de esta corrida es
  // CP-SAT; la fuerza bruta se uso APARTE para confirmar los optimos. Publicarlo asi
  // describiria otro experimento que el que esta sellado.
  ["RQ-0033 · Grid expansion · IEEE case118 · 118 buses · 173 lines · choose 5 of 14 candidate lines · seed 42",
   "RQ-0033 · Expansión de red · IEEE case118 · 118 barras · 173 líneas · elige 5 de 14 candidatas · semilla 42", 1],
  ["RQ-EXP-HSBC-Q-001 · Fraud detection · 56,962 real card transactions, 75 frauds · quantum fidelity kernel vs classical",
   "RQ-EXP-HSBC-Q-001 · Detección de fraude · 56.962 transacciones reales de tarjetas, 75 fraudes · kernel de fidelidad cuántico vs XGBoost sellado", 1],
  ["Airbus challenge · 2-D incompressible flow · Taylor–Green vortex · classical sweep Re 10 → 102,400 vs quantum Carleman arm",
   "Desafío Airbus · flujo incompresible 2-D · vórtice de Taylor–Green · barrido clásico Re 10 → 102.400 vs brazo cuántico de Carleman", 1],

  ["iψ̇ = Hψ integrated by RK4 in your browser · t =", "iψ̇ = Hψ integrado por RK4 en tu navegador · t =", 1],
  ["· not a video", "· no es un video", 1],

  // Pestañas y toggles de vista. La lista aprobada no calzaba con los botones reales en
  // Finanzas (traia un "Tiempo de resolucion · el muro" que no existe) ni en Energia
  // (daba dos y hay tres): esos van traducidos del boton que si esta en la pagina.
  [">Live quantum walk · physics running<", ">Caminata cuántica en vivo · física corriendo<", 1],
  [">Sealed result · CTQW<", ">Resultado sellado · CTQW<", 1],
  [">Sealed result · classical diffusion<", ">Resultado sellado · difusión clásica<", 1],
  [">Correlation network · one run<", ">Red de correlaciones · una corrida<", 1],
  [">All 20 runs · choices<", ">Las 20 corridas · elecciones<", 1],
  [">CP-SAT · exact optimum · 0.20 s<", ">CP-SAT · óptimo exacto · 0,20 s<", 1],
  [">QAOA p=2 simulated · +1.02% · 51.8 s<", ">QAOA p=2 simulado · +1,02% · 51,8 s<", 1],
  [">Same QAOA on real hardware · 8,192 shots<", ">El mismo QAOA en hardware real · 8.192 disparos<", 1],
  [">Score cloud · who ranks the fraud higher?<", ">La nube de puntajes · ¿quién rankea más alto el fraude?<", 1],
  [">Precision–recall curves<", ">Precisión-recall · 0,80 vs 0,26<", 1],
  [">The sweep · error vs Reynolds<", ">El barrido · error vs Reynolds<", 1],
  [">The vanishing term · 18 variants<", ">El término que se anula · 18 variantes<", 1],

  // Leyendas de los dibujos (fuera del canvas: son HTML, se traducen)
  ["◉ 25 source residues ·", "● 25 residuos fuente ·", 1],
  ["20 true allosteric residues (ground truth, hidden from the method)",
   "20 residuos alostéricos verdaderos (verdad oculta al método)", 1],
  ["┈ 14 candidate lines · ━ the 5 built", "┈ 14 líneas candidatas · ━ las 5 construidas", 1],
  ["the 75 frauds ·", "los 75 fraudes ·", 1],
  ["3,000 of 56,887 legitimate", "3.000 de 56.887 legítimas", 1],
  ["(intervals do not overlap)", "(los intervalos no se solapan)", 1],
  [">not yet — classical wins<", ">todavía no — gana el clásico<", 1],

  // Notas de metodo al pie de los paneles
  ["The live walk runs the same code as our 3D piece (H = gaussian-weighted Cα contacts, cutoff 8.5 Å, σ 6.0, dt 0.01). Checked against the sealed result: Spearman ρ = 0.746 on the ranking; normalization differs (declared, not adjusted). The sealed run is the record; the live walk is the method, shown.",
   "La caminata en vivo corre el mismo código que nuestra pieza 3D (H = contactos Cα con peso gaussiano, corte 8,5 Å, σ 6,0, dt 0,01). Comprobada contra el resultado sellado: Spearman ρ = 0,746 en el ranking; la normalización difiere (declarada, no ajustada). La corrida sellada es el registro; la caminata en vivo es el método, mostrado.", 1],
  ["Measured side note: CP-SAT's time to", "Nota medida al margen: el tiempo que le toma a CP-SAT", 1],
  [">prove<", ">probar<", 1],
  ["optimality grew ~25× per +4 assets (0.05 s → 1.3 s → 29 s). That curve — not today's gap — is why the question stays open.",
   "la optimalidad creció ~25× por cada +4 activos (0,05 s → 1,3 s → 29 s). Esa curva — no la brecha de hoy — es la razón de que la pregunta siga abierta.", 1],
  ["Both score files are the sealed ones: quantum kernel sha256 091914f1… · classical XGBoost baseline sha256 62c29285… (RQ-EXP-HSBC-BASE-001). AUPRC recomputed from the files: 0.257453 and 0.800822 — identical to the seals. Temporal 80/20 split, no exact duplicates across halves.",
   "Los dos archivos de puntajes son los sellados: kernel cuántico sha256 091914f1… · baseline clásico XGBoost sha256 62c29285… (RQ-EXP-HSBC-BASE-001). AUPRC recomputado desde los archivos: 0,257453 y 0,800822 — idénticos a los sellos. Partición temporal 80/20, sin duplicados exactos entre mitades.", 1],

  // Library: la linea de planes. El precio del plan Firm cambio en INGLES tambien: la
  // maqueta publicaba "$10,000/yr" y la decision de Nicholas del 2-sep manda todo lo que
  // no sea Pilot/Screening/Diligence/Analyst a "a pedido".

  // Pilot Referee: la linea de cuatro verbos

  // Tarjetas de precio
      
  // Monitor. Los TRES hallazgos son la traduccion de los que estan en la pagina en
  // ingles, que son los que sobreviven a /v1/claims. Los del archivo aprobado NO se
  // montan: ver el reporte — decian 12 claims desde 2019 con uno en pie (son 16 desde
  // 2009 con 3 en pie) y una mediana de 14 dias (la mediana medida es 270).
  [">Still standing.<", ">Siguen en pie.<", 1],
  ["Of 16 tracked advantage claims since 2009, three survive unchallenged; six have eroded under later work.",
   "De 16 claims de ventaja rastreados desde 2009, tres sobreviven sin desafío; seis se erosionaron con trabajo posterior.", 1],
  [">Fastest challenge.<", ">El desafío más rápido.<", 1],
  ["Google's 2019 supremacy claim drew its first serious challenge within 2 days; IBM's 2023 utility claim, within 5.",
   "El claim de supremacía de Google de 2019 recibió su primer desafío serio a los 2 días; el de utilidad de IBM de 2023, a los 5.", 1],
  ["The only claim open with zero challenges is our own",
   "El único claim abierto sin ningún desafío es el nuestro", 1],
  ["— N=90 allosteric significance. We are waiting to be checked like everyone else.",
   "— N=90, significancia alostérica. Esperamos que nos revisen como a todos.", 1],
  ["In plain terms: most public quantum-advantage claims are challenged within weeks; the few that stand for years are about error correction and hardware — the foundations the useful applications will be built on.",
   "En simple: la mayoría de los claims públicos de ventaja cuántica recibe su desafío en semanas; los pocos que aguantan años son de corrección de errores y hardware — los cimientos sobre los que se van a construir las aplicaciones útiles.", 1],

  // Cadenas CORTAS que dos auditorias dejaron pasar. La primera filtraba por largo
  // (>18 caracteres) y la segunda por largo tambien: "days" tiene 4 y "per pilot" 9. En
  // la pagina se leian "desafiado a los 2 days" y "US$15.000-35.000 per pilot", a la
  // vista de cualquiera. Un filtro de largo es un punto ciego con forma de criterio.
  ["</b> days</span>", "</b> días</span>", 2],
  [">2 days<", ">2 días<", 1],
    [">verdict<", ">veredicto<", 1],
  [">simulated run<", ">corrida simulada<", 1],
  [">QPU run<", ">corrida QPU<", 1],
  [">scores<", ">puntajes<", 1],
  ["· advantage measured: none · sealed 2026-07-24 ·", "· ventaja medida: ninguna · sellado 2026-07-24 ·", 1],

  // Formato de cifra en español para los precios de las tarjetas. El resto de la capa
  // medida NO se reformatea —ids, hashes y resultados quedan idénticos al EN—; un precio
  // sí es texto que lee un comprador, y mezclar "US$4.500" con "$28,000" en la misma
  // pantalla se lee como descuido.
    
  // ── commit 9-ter: Agents y pricing v20.1 ──────────────────────────────────


  // Cuarto hallazgo del Monitor. Texto ES aprobado por Cowork el 3-sep.
  ["<b>EL3 — independently reproduced — is empty.</b> Across the whole field, no third party has ever confirmed another's headline result from its published artifacts. That gap is the product.",
   "<b>EL3 —reproducido independientemente— está vacío.</b> En todo el campo, nadie ha confirmado jamás el resultado de otro desde sus artefactos publicados. Ese vacío es el producto.", 1],

  // Las dos lineas con "everything else"/"on request" se mapean COMPLETAS, no por
  // trozos: la version por trozos se pisaba a si misma —"everything else" ya traducido
  // hacia que la linea larga dejara de calzar— y el generador lo freno.
  ["<b>Free</b> to browse · Analyst <b>US$149 per seat / month</b> · everything else <b>on request</b> — evidence levels identical in every tier",
   "<b>Gratis</b> para consultar · Analyst <b>US$149 por asiento / mes</b> · todo lo demás <b>a pedido</b> — los niveles de evidencia son idénticos en todos los planes", 1],

  // ── Accesibilidad ──────────────────────────────────────────────────────────
  ["aria-label=\"Search the Evidence Library\"", "aria-label=\"Busca en la Evidence Library\"", 1],
  ["aria-label=\"Email for Monitor 001\"", "aria-label=\"Correo para el Monitor 001\"", 1],
];

/**
 * LOS ENLACES, QUE ES LO QUE FALTABA.
 *
 * Este generador traducia 190 cadenas de TEXTO y ni un solo `href`. La home española
 * servia 29 enlaces a rutas en ingles: "Abre la Biblioteca →" iba a /library, "Pide un
 * referee →" a /pilots, "Verifica un sello" a /verify. El lector apretaba un boton en
 * español y aterrizaba en ingles. Lo encontro Nicholas navegando, no ningun guardia:
 * T-es buscaba PALABRAS en ingles en el texto y los destinos no son texto.
 *
 * Se mapea la ruta, no el enlace: asi una maqueta nueva que reuse /pilots queda cubierta
 * sin agregar nada. Y al final se EXIGE que no quede ningun href en ingles sin mapear —
 * un mapa que se queda corto en silencio es como llegamos aqui.
 */
const RUTAS = [
  ["/library/registry", "/es/biblioteca/registro"],
  ["/library", "/es/biblioteca"],
  ["/ledger", "/es/ledger"],
  ["/pilots", "/es/pilotos"],
  ["/services", "/es/servicios"],
  ["/methodology", "/es/metodologia"],
  ["/monitor", "/es/monitor"],
  ["/verify", "/es/verificar"],
  ["/errata", "/es/erratas"],
  ["/contact", "/es/contacto"],
  ["/policies", "/es/politicas"],
  ["/about", "/es/nosotros"],
  ["/blog", "/es/blog"],
];
// La decision page de muestra NO tiene cara española: los entregables a jurados se
// editan en ingles y no se portan (decision del 26-ago). Queda declarada, no olvidada.
const EN_INGLES_A_PROPOSITO = ["/services/sample-report"];
// Y los dos posts que la home lista: la version -es existe y es la que corresponde aqui.
const POSTS = [
  ["/blog/neutral-atoms-is-the-third-architecture-for-real-en/", "/blog/neutral-atoms-is-the-third-architecture-for-real-es/"],
  ["/blog/what-is-qram-and-why-is-it-the-silent-bottleneck-en/", "/blog/what-is-qram-and-why-is-it-the-silent-bottleneck-es/"],
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
// ── los enlaces ────────────────────────────────────────────────────────────────
// El orden importa: /library/registry antes que /library, o el prefijo se come al largo.
//
// Y LA EXCEPCION SE PROTEGE ANTES, no despues: la primera version comprobaba al final
// que /services/sample-report siguiera en ingles, pero para entonces el mapa ya lo habia
// convertido en /es/servicios/sample-report — una ruta que no existe. Una excepcion que
// se verifica despues del cambio no es una excepcion, es un informe de daños.
let enlaces = 0;
const ESCUDO = "\u0000EXC";
EN_INGLES_A_PROPOSITO.forEach((h, k) => { html = html.split(`href="${h}"`).join(`href="${ESCUDO}${k}"`); });
for (const [en, es] of POSTS) { const n = html.split(en).length - 1; html = html.split(en).join(es); enlaces += n; }
for (const [en, es] of RUTAS) {
  for (const [de, a] of [[`href="${en}"`, `href="${es}"`], [`href="${en}#`, `href="${es}#`], [`href="${en}/`, `href="${es}/`]]) {
    const n = html.split(de).length - 1;
    if (n) { html = html.split(de).join(a); enlaces += n; }
  }
}
// LA COMPROBACION QUE HACE QUE ESTO NO SE REPITA: ningun href en ingles puede quedar.
const quedan = [...html.matchAll(/href="(\/[^"#]*)/g)].map((m) => m[1])
  .filter((h) => !h.startsWith("/es/") && h !== "/" && !/^\/(v1|mcp|api|_astro|js|piezas|consola|cleveland|favicon|rosetta|sitemap|llms)/.test(h) && !/\.[a-z]{2,4}$/.test(h))
  .filter((h) => !EN_INGLES_A_PROPOSITO.includes(h) && !h.startsWith("/blog/"));
EN_INGLES_A_PROPOSITO.forEach((h, k) => { html = html.split(`href="${ESCUDO}${k}"`).join(`href="${h}"`); });
if (quedan.length) {
  console.error("ABORTA: quedan enlaces a rutas en ingles en la home española:");
  [...new Set(quedan)].forEach((h) => console.error("  " + h));
  console.error("Agregalos a RUTAS, o a EN_INGLES_A_PROPOSITO con su motivo.");
  process.exit(1);
}

writeFileSync("src/content_html/home.es.html", html);
console.log(`home.es.html generado · ${T.length} cadenas · ${enlaces} enlaces reapuntados · ${html.length} bytes`);
