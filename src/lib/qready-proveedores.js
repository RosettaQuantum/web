/**
 * Biblioteca de proveedores post-cuanticos. Cada fila con su estado y su fuente.
 *
 * POR QUE ES UN MODULO Y NO TEXTO DENTRO DEL COMPONENTE
 * ----------------------------------------------------
 * Son ~25 filas bilingues. Metidas en el objeto `t` de QrReport.astro habria que
 * escribirlas dos veces, y una lista que vive en dos lugares ya divergio.
 * Aqui viven una vez, con `es`/`en` por campo.
 *
 * REGLA DE ENTRADA: ninguna fila entra sin fuente. Un «sin fecha» no significa que
 * el fabricante no este trabajando en ello -- significa que el cliente no puede
 * planificar contra nada, y eso es lo que se le dice.
 *
 * Procedencia: investigacion de la sesion web (fuente y fecha por fila).
 * Esta sesion verifico de forma independiente AWS KMS y Akamai edge→origen, que
 * eran los mas consecuentes y venian imprecisos.
 */

/** Que le toca hacer al cliente. El color se deriva de aqui, nunca se escribe a mano. */
export const ACCION = {
  fw:      { es: 'Firmware',            en: 'Firmware',            sev: 'ok'   },
  lic:     { es: 'Licencia aparte',     en: 'Separate licence',    sev: 'warn' },
  hw:      { es: 'Hardware nuevo',      en: 'New hardware',        sev: 'crit' },
  block:   { es: 'Sin ruta',            en: 'No path',             sev: 'crit' },
  nada:    { es: 'Sin PQC',             en: 'No PQC',              sev: 'crit' },
  parcial: { es: 'Parcial',             en: 'Partial',             sev: 'warn' },
  dep:     { es: 'Deprecado',           en: 'Deprecated',          sev: 'crit' },
  fecha:   { es: 'Con fecha',           en: 'Dated',               sev: 'warn' },
  sinDecl: { es: 'Sin declaración',     en: 'No statement',        sev: 'crit' },
  yaEsta:  { es: 'Ya está',             en: 'Already there',       sev: 'ok'   },
};

export const GRUPOS = [
  {
    id: 'hsm',
    t: { es: 'HSM · appliance y on-premise', en: 'HSM · appliance and on-premise' },
    filas: [
      { p: 'Entrust nShield 5s / 5c', a: 'fw',
        es: 'Firmware v13.8+ (cubre también la generación XC anterior). La función post-cuántica viene siempre activa, sin licencia aparte.',
        en: 'Firmware v13.8+ (also covers the earlier XC generation). The post-quantum feature ships always on, no separate licence.' },
      { p: 'Entrust nShield Connect XC / Solo XC', a: 'lic',
        es: 'Firmware Y licencia PostQuantum comprada por separado — a diferencia de la línea 5.',
        en: 'Firmware AND a separately purchased PostQuantum licence — unlike the 5 line.' },
      { p: 'Thales Luna 7 (firmware 7.9.0+)', a: 'fw',
        es: 'ML-KEM y ML-DSA nativos desde firmware 7.9.0 (jul-2025) más cliente 10.9.0+, sobre el hardware Luna 7 que ya tiene.',
        en: 'Native ML-KEM and ML-DSA from firmware 7.9.0 (Jul-2025) plus client 10.9.0+, on the Luna 7 hardware you already own.' },
      { p: 'Thales Luna 8', a: 'hw',
        es: 'No es actualización de firmware: es reemplazo de hardware (ago-2026). Todas sus certificaciones se rehacen. Es presupuesto, no un ticket.',
        en: 'Not a firmware upgrade: a hardware replacement (Aug-2026). All certifications restart. This is budget, not a ticket.' },
      { p: 'Utimaco Quantum Protect', a: 'lic',
        es: 'Paquete adicional sobre u.trust Se-Series y CSe-Series, actualizable en campo sin cambiar hardware. Trae ML-KEM y ML-DSA.',
        en: 'Add-on package for u.trust Se-Series and CSe-Series, field-upgradeable without changing hardware. Ships ML-KEM and ML-DSA.' },
      { p: 'Utimaco CP5 / eIDAS', a: 'block',
        es: 'Sin ruta post-cuántica publicada. Si su caso de uso es firma cualificada eIDAS, hoy no hay camino con este proveedor.',
        en: 'No published post-quantum path. If your use case is eIDAS qualified signing, there is no route with this vendor today.' },
    ],
  },
  {
    id: 'kms',
    t: { es: 'Gestión de llaves en la nube', en: 'Cloud key management' },
    filas: [
      { p: 'Azure Key Vault · Managed HSM · Cloud HSM', a: 'nada',
        es: 'Sin post-cuántico, sin vista previa y sin fecha anunciada. Verificado contra el enum real de la API.',
        en: 'No post-quantum, no preview, no announced date. Verified against the API’s actual enum.' },
      { p: 'AWS KMS', a: 'parcial',
        es: 'Ofrece ML-DSA como tipo de llave para firmar (ML_DSA_44/65/87, desde jun-2025). NO ofrece ML-KEM como servicio de encapsulación — el híbrido de AWS está en el TLS hacia la API, que es otra capa. Y ML-KEM es justo lo que mitiga cosecha-hoy-descifra-mañana.',
        en: 'Offers ML-DSA as a signing key type (ML_DSA_44/65/87, since Jun-2025). Does NOT offer ML-KEM as an encapsulation service — AWS’s hybrid lives in the TLS to the API, a different layer. And ML-KEM is precisely what mitigates harvest-now-decrypt-later.' },
      { p: 'AWS CloudHSM', a: 'parcial',
        es: 'El propio proveedor se contradice: su página de migración dice que ML-DSA está «in preview»; las release notes del SDK lo dan por disponible. Pregúntelo por escrito.',
        en: 'The vendor contradicts itself: its migration page says ML-DSA is “in preview”; the SDK release notes treat it as available. Ask in writing.' },
      { p: 'Google Cloud KMS', a: 'parcial',
        es: 'Firmas post-cuánticas en disponibilidad general (jul-2026). El nivel de protección —si es sólo software o llega al HSM— queda por confirmar.',
        en: 'Post-quantum signing generally available (Jul-2026). The protection level — software only or backed by HSM — remains to be confirmed.' },
      { p: 'IBM z17 (CEX8S)', a: 'fw',
        es: 'El camino documentado por IBM para los estándares finales (FIPS 203/204) pasa por z17 con firmware CCA 8.4.',
        en: 'IBM’s documented path to the final standards (FIPS 203/204) runs through z17 with CCA 8.4 firmware.' },
      { p: 'IBM z16 (CEX8S)', a: 'parcial',
        es: 'Lo documentado para z16 es CCA 8.0/8.2 — Dilithium y Kyber en rondas previas, pre-estándar. No satisface FIPS 203/204. Pregunta abierta a IBM.',
        en: 'What is documented for z16 is CCA 8.0/8.2 — earlier-round Dilithium and Kyber, pre-standard. Does not satisfy FIPS 203/204. Open question to IBM.' },
      { p: 'IBM Hyper Protect Crypto Services', a: 'dep',
        es: 'Su PQC es sólo Dilithium de ronda 2 sobre CEX7S — pre-estándar. Y el hardware que lo sostiene está en fin de ciclo.',
        en: 'Its PQC is round-2 Dilithium only, on CEX7S — pre-standard. And the hardware behind it is end-of-life.' },
    ],
  },
  {
    id: 'pki',
    t: { es: 'Certificados y PKI', en: 'Certificates and PKI' },
    filas: [
      { p: '¿Existe un certificado TLS post-cuántico públicamente confiable?', a: 'block',
        es: 'No, hoy no. Los Baseline Requirements del CA/B Forum (v2.2.9) sólo permiten RSA y ECDSA. Ninguna autoridad pública puede emitir uno aunque quiera.',
        en: 'Not today. The CA/B Forum Baseline Requirements (v2.2.9) allow only RSA and ECDSA. No public authority can issue one even if it wanted to.' },
      { p: 'PKI privada con ML-DSA', a: 'yaEsta',
        es: 'Sí existe: DigiCert y Sectigo (bajo solicitud) y Microsoft AD CS ya la ofrecen — válida dentro de su propia organización, no en internet público.',
        en: 'It does exist: DigiCert and Sectigo (on request) and Microsoft AD CS already offer it — valid inside your own organization, not on the public internet.' },
      { p: 'Vigencia de certificados TLS', a: 'fecha',
        es: 'Calendario paralelo que cambia su operación: 100 días desde el 15-mar-2027 y 47 días desde el 15-mar-2029 (ballot SC-081v3). Si su rotación es manual, esto le llega antes que lo post-cuántico.',
        en: 'A parallel calendar that changes your operations: 100 days from 15-Mar-2027 and 47 days from 15-Mar-2029 (ballot SC-081v3). If your rotation is manual, this hits you before post-quantum does.' },
    ],
  },
  {
    id: 'core',
    t: { es: 'Core bancario y pagos', en: 'Core banking and payments' },
    filas: [
      { p: 'Temenos · Finastra · FIS · Fiserv · Flexcube', a: 'sinDecl',
        es: 'Cero ocurrencias de «quantum» en el Security Statement de FIS y en los formularios 10-K del año fiscal 2025 de FIS, Fiserv, Visa y Mastercard.',
        en: 'Zero occurrences of “quantum” in the FIS Security Statement and in the FY2025 10-K filings of FIS, Fiserv, Visa and Mastercard.' },
      { p: 'SWIFT — Release 8.0', a: 'fecha',
        es: 'Obligatoria a fines de julio de 2027, y sin ruta de actualización desde 7.7. Si está en 7.7, el salto hay que planificarlo aparte.',
        en: 'Mandatory by end of July 2027, with no upgrade path from 7.7. If you are on 7.7, that jump needs planning of its own.' },
      { p: 'EMVCo', a: 'sinDecl',
        es: 'Declara formalmente no esperar la amenaza «hasta al menos 2040 — quizá nunca». Es una postura publicada, no un silencio: sepa que su ecosistema de tarjetas piensa así.',
        en: 'Formally states it does not expect the threat “until at least 2040 – maybe never”. That is a published position, not silence: know that your card ecosystem thinks this way.' },
    ],
  },
  {
    id: 'navegadores',
    t: { es: 'Navegadores', en: 'Browsers' },
    filas: [
      { p: 'Chrome / Edge 147', a: 'yaEsta',
        es: 'Ya no se puede apagar. Microsoft, literal: «This policy has been removed starting in Microsoft Edge version 147.» El lado del cliente dejó de ser opcional.',
        en: 'No longer switchable off. Microsoft, verbatim: “This policy has been removed starting in Microsoft Edge version 147.” The client side stopped being optional.' },
    ],
  },
  {
    id: 'cdn',
    t: { es: 'CDN y borde', en: 'CDN and edge' },
    cols: { es: ['Proveedor', 'Cliente → borde', 'Borde → origen'], en: ['Vendor', 'Client → edge', 'Edge → origin'] },
    dosTramos: [
      { p: 'Cloudflare',       c: { es: 'Por defecto', en: 'By default' }, o: { es: 'Por defecto', en: 'By default' }, sev: 'ok' },
      { p: 'Akamai Enhanced TLS', c: { es: 'Por defecto', en: 'By default' }, o: { es: 'Por defecto desde oct-2025', en: 'By default since Oct-2025' }, sev: 'ok' },
      { p: 'AWS CloudFront',   c: { es: 'Por defecto', en: 'By default' }, o: { es: 'Sin fecha confirmada (revisado ago-2026)', en: 'No confirmed date (checked Aug-2026)' }, sev: 'warn' },
      { p: 'Fastly',           c: { es: 'Por defecto', en: 'By default' }, o: { es: 'Sin declaración específica encontrada', en: 'No specific statement found' }, sev: 'warn' },
      { p: 'Azure Front Door', c: { es: 'Sin declaración pública', en: 'No public statement' }, o: { es: 'Sin declaración pública', en: 'No public statement' }, sev: 'crit' },
      { p: 'Akamai Standard TLS', c: { es: 'No disponible en ese nivel', en: 'Not available at that tier' }, o: { es: 'No disponible', en: 'Not available' }, sev: 'crit' },
    ],
  },
];

/** Trampas de palabras: el mismo hallazgo dicho de forma que suena a lo contrario. */
export const TRAMPAS = [
  { p: 'Entrust · «Post-Quantum Option Pack»',
    es: 'No entrega los estándares finales, sólo los candidatos previos sobre CodeSafe, con licencia SEE aparte. Y en su propia documentación: «the underlying Security World protection mechanisms still use classical (non post-quantum) crypto» — el Option Pack protege sus llaves post-cuánticas con criptografía clásica. Es el camino de laboratorio, no el de producción.',
    en: 'It does not deliver the final standards, only the earlier candidates on CodeSafe, with a separate SEE licence. And in its own documentation: “the underlying Security World protection mechanisms still use classical (non post-quantum) crypto” — the Option Pack protects your post-quantum keys with classical cryptography. It is the lab path, not the production one.' },
  { p: 'Thales CipherTrust Manager · «soporta PQC»',
    es: 'Es sólo ML-KEM como acuerdo de llaves en TLS. No crea ni gestiona llaves post-cuánticas: protege el transporte hacia el gestor, no lo que el gestor guarda.',
    en: 'It is only ML-KEM as TLS key agreement. It neither creates nor manages post-quantum keys: it protects the transport to the manager, not what the manager holds.' },
  { p: 'Azure · «quantum-resistant»',
    es: 'Aparece en material de marketing sin corresponder a ninguna función disponible en Key Vault, Managed HSM ni Cloud HSM. No hay preview ni fecha.',
    en: 'It appears in marketing material without matching any function available in Key Vault, Managed HSM or Cloud HSM. There is no preview and no date.' },
];

/** Marco regulatorio. Modulo POR JURISDICCION: agregar un pais es configuracion. */
export const JURISDICCIONES = {
  cl: {
    nombre: { es: 'Chile', en: 'Chile' },
    afirmacion: {
      es: 'Ningún regulador chileno exige criptografía post-cuántica. Ni la CMF, ni la ANCI, ni la Agencia de Protección de Datos.',
      en: 'No Chilean regulator requires post-quantum cryptography. Not the CMF, not the ANCI, not the data protection agency.' },
    normas: [
      { n: 'CMF · RAN Capítulo 20-10', pqc: false, verificado: false,
        es: 'Gestión de seguridad de la información y ciberseguridad para bancos.',
        en: 'Information security and cybersecurity management for banks.' },
      { n: 'Ley 21.663 · ANCI / OIV', pqc: false, verificado: true,
        es: 'Marco de ciberseguridad; régimen de Operadores de Importancia Vital.',
        en: 'Cybersecurity framework; Vital Importance Operator regime.' },
      { n: 'Ley 21.719 · Datos personales', pqc: false, verificado: false,
        es: 'Nueva agencia, notificación de brechas en 72 horas; vigencia plena dic-2026.',
        en: 'New agency, 72-hour breach notification; fully in force Dec-2026.' },
    ],
  },
};
