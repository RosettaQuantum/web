// Los textos de la portada de seguridad (components/paginas/QReadyPuerta.astro) en los dos idiomas.
// 23-nov-2026: /q-ready en inglés pasa a ser la MISMA portada que /es/q-ready (pedido de Nicholas) y la
// página vieja (QrLanding, identidad retirada) se retira.
//
//  · `es` es el texto que ya estaba en el componente, copiado sin cambiar una letra. Se comprueba
//    comparando el texto de /es/q-ready construido antes y después: idéntico.
//  · `en` es NUEVO y está PROVISORIO hasta que Nicholas lo apruebe. La tabla es ↔ en para aprobar se
//    GENERA de este archivo (node scripts/textos-q-ready-en.mjs → docs/textos-provisorios-q-ready-en.md),
//    para que lo que se apruebe sea literalmente lo que se sirve.
//
// Los marcadores ‹…› se llenan en orden de aparición (src/lib/textos-galeria.mjs → llenar).
// Lo que sale del informe en español (el bloque de cifras y la opción «informe» del diálogo, apagados
// por INFORME_PUBLICO) NO está aquí: el informe existe sólo en español y esos bloques no se pintan en
// inglés.

export const TEXTOS_PUERTA = {
  es: {
    meta: {
      titulo: "¿Qué tan lista está su criptografía para el momento cuántico? — Rosetta Q-Ready",
      descripcion: "Medimos desde afuera, sin tocar su red, qué criptografía expone su superficie pública y quién decide su plazo real de migración. Informe individual gratis y confidencial.",
    },
    rutas: { medicion: "/es/q-ready/medicion", origen: "/es/q-ready" },
    hero: {
      eyebrow: "Q-Ready · exposición criptográfica post-cuántica",
      h1: "¿Qué tan lista está su criptografía para el momento cuántico?",
      lede: "Medimos desde afuera, sin tocar su red, qué criptografía expone hoy su superficie pública y quién decide de verdad su plazo de migración. Es el mismo método con que medimos a ‹organizaciones› organizaciones chilenas en ‹mes›.",
      individual: "Solicitar mi informe individual",
      medir: "Medir mi dominio ahora",
      nota: "El informe individual es gratis y confidencial: no se publica ni se comparte.",
    },
    ahora: {
      eyebrow: "Por qué ahora",
      h2: "El riesgo empieza hoy, no cuando llegue la máquina.",
      p: "Un adversario con paciencia puede grabar hoy tráfico cifrado y guardarlo, barato, hasta que exista un computador capaz de romper RSA y curvas elípticas. Ese día el archivo se abre hacia atrás: lo que salió cifrado en 2026 queda legible entonces.",
      nota: "No afirmamos que a nadie le hayan robado datos. Afirmamos una exposición medible contra un calendario público.",
      pasos: [["Graba", "el tráfico cifrado en tránsito"], ["Guarda", "a la espera de capacidad"], ["Rompe", "la clave cuando exista la máquina"], ["Lee", "lo de hace años, hacia atrás"]],
    },
    reloj: {
      eyebrow: "Sume los años",
      h2: "Si la cuenta da tarde, ya va tarde.",
      lede: "Si el tiempo que sus datos deben seguir secretos más el que toma migrar supera el tiempo hasta la amenaza, la organización llega tarde. Con un perfil típico de banca:",
      deslice: "Deslice para ver hasta ‹fin› →",
      titulo: "Sume los años",
      descA: "Migrar toma ‹años› años, de ‹desde› a ‹hasta›. Lo último migrado debe seguir secreto ‹años› años más, hasta ‹año›. ",
      descItem: "hacia ‹año› la probabilidad estimada es ‹p›",
      migrar: "Migrar", secreto: "Seguir secreto", amenaza: "Amenaza", prob: "prob. estimada",
      anios: "‹n› años",
      corte: "necesita protección hasta ‹año›",
      pie: "Perfil de ejemplo: secreto ‹s› años, migración ‹m›. Probabilidades: consenso de 26 expertos del Global Risk Institute; las de 15 y 20 años usan la lectura conservadora.",
      pieNegrita: "Ninguna de estas fechas es un pronóstico:",
      pieCola: "son la distancia contra la que se planifica.",
      fuente: "fuente →",
    },
    individual: {
      eyebrow: "Su informe individual",
      h2: "Lo que recibe su organización.",
      p: "Un documento que un directorio puede leer, con la evidencia detrás. Sale de la medición de su propia superficie pública y lo revisa una persona antes de entregarlo.",
      nota: "Gratis. Confidencial: dirigido sólo a su organización, fuera del informe agregado.",
      indice: [
        ["Su índice", "Su número de 0 a 100 frente a la mediana del país y de su sector."],
        ["El hallazgo principal", "Lo que más pesa en su caso, con la evidencia que lo sostiene."],
        ["Su superficie pública", "Qué encontramos en registros públicos y qué responde desde internet."],
        ["Su ruta crítica", "Los proveedores que fijan su plazo real, y cuáles no tienen fecha."],
        ["Plan 30 · 90 · 365", "Qué hacer, en qué orden, y de qué hallazgo sale cada acción."],
        ["Alcance y límites", "Qué mide el informe, qué no puede decir, y cómo reproducirlo."],
      ],
    },
    pasos: {
      eyebrow: "Cómo se mide",
      h2: "Cuatro pasos, sin tocar su red.",
      lista: [
        ["Usted lo pide", "Con su dominio y un correo de su organización. Medimos sólo lo que alguien de la organización autoriza."],
        ["Leemos registros públicos", "Certificate Transparency muestra cada nombre de host que su organización certificó alguna vez."],
        ["Un saludo por host", "Sobre los hosts críticos abrimos una conexión y enviamos un solo saludo TLS. No se completa: no hay sesión, ni datos, ni credenciales, ni prueba de intrusión."],
        ["Una persona lo revisa", "Un analista revisa el resultado antes de entregárselo y le escribe para coordinar."],
      ],
    },
    noEs: {
      eyebrow: "Con honestidad",
      h2: "Lo que Q-Ready no es.",
      lista: [
        "No es una certificación, ni reemplaza una revisión interna formal.",
        "No ve el interior: módulos de seguridad de hardware, core, VPN, firma de código o cifrado en reposo quedan fuera de una medición externa.",
        "Un número bajo no significa que su organización sea insegura, y uno alto no significa que esté preparada.",
        "No vende pánico: las fechas de 2030 y 2035 son de política pública, no un pronóstico sobre el hardware.",
      ],
    },
    cierre: { lede: "Vea dónde está su criptografía frente al reloj." },
    dialogo: {
      cerrar: "Cerrar",
      eyebrow: "Q-Ready",
      h2: "Pida el informe de su organización.",
      et: "Su informe individual · gratis",
      h3: "Su organización, medida.",
      p: "El mismo método, sobre su propia superficie. Confidencial: sólo para su organización.",
      organizacion: "Organización",
      dominio: "Dominio raíz", dominioEj: "empresa.cl",
      nombre: "Nombre y cargo",
      correo: "Correo de la organización", correoEj: "nombre@empresa.cl",
      autoriza: "Represento a esta organización y autorizo medir su superficie pública: un saludo TLS por host, sin acceso a sistemas.",
      enviar: "Solicitar mi informe",
      pie: "Puede pedir su exclusión o el detalle de lo observado cuando quiera, sin costo y sin condiciones.",
    },
    // Los mensajes del formulario individual (public/js/qready-puerta.js los lee del atributo data-textos).
    js: {
      faltan: "Faltan campos por completar.",
      dominio: "El correo tiene que ser del dominio ‹dominio›.",
      dominioSin: "El correo tiene que ser del dominio que indicó.",
      enviando: "Enviando…",
      recibido: "Recibido. Le escribiremos a ese correo para coordinar su informe.",
      noRegistro: "No pudimos registrar su pedido. Escríbanos a hello@rosettaquantum.com.",
      noConecta: "No pudimos conectar. Escríbanos a hello@rosettaquantum.com.",
    },
    carrusel: { anterior: "Publicación anterior", siguiente: "Publicación siguiente" },
  },

  en: {
    meta: {
      titulo: "How ready is your cryptography for the quantum moment? — Rosetta Q-Ready",
      descripcion: "We measure from the outside, without touching your network, what cryptography your public surface exposes and who decides your real migration deadline. Free, confidential individual report.",
    },
    rutas: { medicion: "/q-ready/medicion", origen: "/q-ready" },
    hero: {
      eyebrow: "Q-Ready · post-quantum cryptographic exposure",
      h1: "How ready is your cryptography for the quantum moment?",
      lede: "We measure from the outside, without touching your network, what cryptography your public surface exposes today and who really decides your migration deadline. It is the same method we used to measure ‹organizaciones› Chilean organizations in ‹mes›.",
      individual: "Request my individual report",
      medir: "Measure my domain now",
      nota: "The individual report is free and confidential: it is not published or shared.",
    },
    ahora: {
      eyebrow: "Why now",
      h2: "The risk starts today, not when the machine arrives.",
      p: "A patient adversary can record encrypted traffic today and store it, cheaply, until a computer capable of breaking RSA and elliptic curves exists. On that day the archive opens backwards: what was sent encrypted in 2026 becomes readable then.",
      nota: "We do not claim that anyone’s data has been stolen. We claim a measurable exposure against a public calendar.",
      pasos: [["Record", "encrypted traffic in transit"], ["Store", "waiting for the capability"], ["Break", "the key once the machine exists"], ["Read", "what was sent years ago, backwards"]],
    },
    reloj: {
      eyebrow: "Add up the years",
      h2: "If the sum comes out late, you are already late.",
      lede: "If the time your data must stay secret plus the time migration takes exceeds the time until the threat, the organization is late. With a typical banking profile:",
      deslice: "Swipe to see up to ‹fin› →",
      titulo: "Add up the years",
      descA: "Migration takes ‹años› years, from ‹desde› to ‹hasta›. The last thing migrated must stay secret ‹años› more years, until ‹año›. ",
      descItem: "by ‹año› the estimated probability is ‹p›",
      migrar: "Migrate", secreto: "Stay secret", amenaza: "Threat", prob: "est. probability",
      anios: "‹n› years",
      corte: "needs protection until ‹año›",
      pie: "Example profile: secret for ‹s› years, migration ‹m›. Probabilities: consensus of 26 experts from the Global Risk Institute; the 15- and 20-year figures use the conservative reading.",
      pieNegrita: "None of these dates is a forecast:",
      pieCola: "they are the distance you plan against.",
      fuente: "source →",
    },
    individual: {
      eyebrow: "Your individual report",
      h2: "What your organization receives.",
      p: "A document a board can read, with the evidence behind it. It comes from measuring your own public surface, and a person reviews it before it is delivered.",
      nota: "Free. Confidential: addressed only to your organization, kept out of the aggregate report.",
      indice: [
        ["Your index", "Your number from 0 to 100 against the median for the country and for your sector."],
        ["The main finding", "What weighs most in your case, with the evidence behind it."],
        ["Your public surface", "What we found in public records and what answers from the internet."],
        ["Your critical path", "The providers that set your real deadline, and which of them have no date."],
        ["Plan 30 · 90 · 365", "What to do, in what order, and which finding each action comes from."],
        ["Scope and limits", "What the report measures, what it cannot say, and how to reproduce it."],
      ],
    },
    pasos: {
      eyebrow: "How it is measured",
      h2: "Four steps, without touching your network.",
      lista: [
        ["You request it", "With your domain and an email from your organization. We only measure what someone in the organization authorizes."],
        ["We read public records", "Certificate Transparency shows every host name your organization has ever certified."],
        ["One greeting per host", "On the critical hosts we open a connection and send a single TLS greeting. It is never completed: no session, no data, no credentials, no intrusion test."],
        ["A person reviews it", "An analyst reviews the result before delivering it and writes to you to coordinate."],
      ],
    },
    noEs: {
      eyebrow: "In all honesty",
      h2: "What Q-Ready is not.",
      lista: [
        "It is not a certification, and it does not replace a formal internal review.",
        "It does not see inside: hardware security modules, core systems, VPN, code signing and encryption at rest are outside an external measurement.",
        "A low number does not mean your organization is insecure, and a high one does not mean it is prepared.",
        "It does not sell panic: the 2030 and 2035 dates are public policy, not a forecast about hardware.",
      ],
    },
    cierre: { lede: "See where your cryptography stands against the clock." },
    dialogo: {
      cerrar: "Close",
      eyebrow: "Q-Ready",
      h2: "Request your organization’s report.",
      et: "Your individual report · free",
      h3: "Your organization, measured.",
      p: "The same method, on your own surface. Confidential: only for your organization.",
      organizacion: "Organization",
      dominio: "Root domain", dominioEj: "company.com",
      nombre: "Name and title",
      correo: "Organization email", correoEj: "name@company.com",
      autoriza: "I represent this organization and authorize measuring its public surface: one TLS greeting per host, no access to systems.",
      enviar: "Request my report",
      pie: "You can ask to be excluded, or for the detail of what we observed, at any time, free and without conditions.",
    },
    js: {
      faltan: "Some fields are still empty.",
      dominio: "The email must belong to the domain ‹dominio›.",
      dominioSin: "The email must belong to the domain you entered.",
      enviando: "Sending…",
      recibido: "Received. We will write to that email to coordinate your report.",
      noRegistro: "We could not register your request. Write to us at hello@rosettaquantum.com.",
      noConecta: "We could not connect. Write to us at hello@rosettaquantum.com.",
    },
    carrusel: { anterior: "Previous publication", siguiente: "Next publication" },
  },
};

// Textos en inglés que coinciden letra por letra con la /q-ready retirada (QrLanding). Se marcan en la tabla:
// ya estuvieron publicados, pero nada en el repositorio dice que Nicholas los haya aprobado.
export const EN_DE_LA_PAGINA_RETIRADA = new Set([
  "The risk starts today, not when the machine arrives.",
  "What Q-Ready is not.",
  "See where your cryptography stands against the clock.",
]);
