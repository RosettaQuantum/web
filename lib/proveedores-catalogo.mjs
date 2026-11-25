// RQ.T · catálogo de proveedores (v0, 24-nov-2026). Módulo PURO: sin red, sin sockets, se importa en
// Node y en el Worker.
//
// POR QUÉ UN SOLO ARCHIVO. El diseño (entregables/ficha-rosetta-2026-11/RQ.T-vista-de-proveedores-v0.md,
// pregunta 3) pide «una tabla versionada, como las clases PAT». Y la regla de la casa: una lista que
// vive en dos lugares ya divergió. Por eso aquí viven también las dos clasificaciones que la medición
// pública YA usaba —el proveedor de MX de lib/informe-envivo.mjs y el CDN de la cadena CNAME de
// lib/borde-envivo.mjs—, movidas sin cambiar una sola salida (test/proveedores.test.mjs lo compara caso
// por caso). Si la ficha y RQ.T nombraran distinto al mismo proveedor, dirían cosas distintas con el
// mismo nombre.
//
// PRECISIÓN SOBRE COBERTURA. Un sufijo entra sólo si identifica a UN proveedor sin ambigüedad. Lo que no
// calza no se adivina: queda como «dominio externo sin clasificar» y NO entra al conteo de proveedores.
// Un falso proveedor en una reunión con un banco cuesta más que uno que falte.
//
// Cambiar cualquier tabla de este archivo es cambiar el método: sube CATALOGO_VERSION.
export const CATALOGO_VERSION = "RQ.T-catalogo/0.3";   // 0.3 (25-nov): SSL.com/Cloudflare como CA, Webflow, ActiveCampaign;   // 0.2 (25-nov): DMARC/TLS-RPT/BIMI/MTA-STS, más DKIM, ASN por nombre

// ---------------------------------------------------------------- lo que ya usaba la medición pública
// (antes en lib/informe-envivo.mjs; texto idéntico)
export const PROVEEDOR_MX = [[/iphmx\.com$/, "Cisco Secure Email (IronPort)"], [/pphosted\.com$/, "Proofpoint"],
  [/mimecast\.com$/, "Mimecast"], [/protection\.outlook\.com$/, "Microsoft 365"], [/(google|googlemail)\.com$/, "Google Workspace"],
  [/barracudanetworks\.com$/, "Barracuda"], [/messagelabs\.com$/, "Broadcom (Symantec)"]];
export const proveedorMx = (mx) => { for (const [rx, n] of PROVEEDOR_MX) if (rx.test(mx)) return n; return mx.split(".").slice(-2).join("."); };
// La empresa detrás de cada servicio de PROVEEDOR_MX: para contar proveedores, no productos.
export const EMPRESA_MX = { "Cisco Secure Email (IronPort)": "Cisco", "Proofpoint": "Proofpoint", "Mimecast": "Mimecast",
  "Microsoft 365": "Microsoft", "Google Workspace": "Google", "Barracuda": "Barracuda", "Broadcom (Symantec)": "Broadcom" };

// (antes en lib/borde-envivo.mjs → cadenaCname; mismas expresiones, mismo orden)
export function cdnDeCadena(cadena) {
  const todo = cadena.join(" ");
  return /edgekey\.net/.test(todo) ? "Akamai Enhanced TLS" : /edgesuite\.net/.test(todo) ? "Akamai Standard TLS"
    : /akamai/.test(todo) ? "Akamai" : /cloudfront\.net/.test(todo) ? "Amazon CloudFront" : /fastly/.test(todo) ? "Fastly"
    : /azureedge|azurefd/.test(todo) ? "Azure Front Door" : cadena.length ? "otro" : "sin CNAME";
}

// ---------------------------------------------------------------- sufijos (CNAME, NS, SPF, DKIM)
// [sufijo, proveedor (la empresa), servicio, clase]. Clase: borde (CDN/WAF: termina el TLS → RQ.T.01),
// dns (opera la zona → RQ.T.04), correo, nube, saas. Calza por ETIQUETA: «x.edgekey.net» calza con
// «edgekey.net»; «fooedgekey.net» no.
export const SUFIJOS = [
  // borde
  ["edgekey.net", "Akamai", "Akamai (Enhanced TLS)", "borde"], ["edgesuite.net", "Akamai", "Akamai (Standard TLS)", "borde"],
  ["akamaiedge.net", "Akamai", "Akamai", "borde"], ["akamai.net", "Akamai", "Akamai", "borde"],
  ["akamaized.net", "Akamai", "Akamai", "borde"], ["akamaihd.net", "Akamai", "Akamai", "borde"],
  ["cdn.cloudflare.net", "Cloudflare", "Cloudflare", "borde"],
  ["cloudfront.net", "Amazon", "Amazon CloudFront", "borde"],
  ["fastly.net", "Fastly", "Fastly", "borde"], ["fastlylb.net", "Fastly", "Fastly", "borde"],
  ["azureedge.net", "Microsoft", "Azure Front Door / CDN", "borde"], ["azurefd.net", "Microsoft", "Azure Front Door", "borde"],
  ["incapdns.net", "Imperva", "Imperva (WAF)", "borde"], ["impervadns.net", "Imperva", "Imperva (WAF)", "borde"],
  // dns autoritativo
  ["akam.net", "Akamai", "Akamai Edge DNS", "dns"], ["ns.cloudflare.com", "Cloudflare", "Cloudflare DNS", "dns"],
  ["azure-dns.com", "Microsoft", "Azure DNS", "dns"], ["azure-dns.net", "Microsoft", "Azure DNS", "dns"],
  ["azure-dns.org", "Microsoft", "Azure DNS", "dns"], ["azure-dns.info", "Microsoft", "Azure DNS", "dns"],
  ["googledomains.com", "Google", "Google Cloud DNS", "dns"], ["nsone.net", "IBM (NS1)", "NS1", "dns"],
  ["ultradns.com", "Vercara (UltraDNS)", "UltraDNS", "dns"], ["ultradns.net", "Vercara (UltraDNS)", "UltraDNS", "dns"],
  ["ultradns.org", "Vercara (UltraDNS)", "UltraDNS", "dns"], ["ultradns.biz", "Vercara (UltraDNS)", "UltraDNS", "dns"],
  ["dynect.net", "Oracle", "Oracle Dyn", "dns"], ["domaincontrol.com", "GoDaddy", "GoDaddy DNS", "dns"],
  ["dnsmadeeasy.com", "DigiCert (DNS Made Easy)", "DNS Made Easy", "dns"], ["cscdns.net", "CSC", "CSC DNS", "dns"],
  ["markmonitor.com", "MarkMonitor", "MarkMonitor DNS", "dns"], ["nic.cl", "NIC Chile", "NIC Chile (secundario)", "dns"],
  // correo y envío
  ["protection.outlook.com", "Microsoft", "Microsoft 365", "correo"], ["outlook.com", "Microsoft", "Microsoft 365", "correo"],
  ["onmicrosoft.com", "Microsoft", "Microsoft 365", "correo"], ["_spf.google.com", "Google", "Google Workspace", "correo"],
  ["iphmx.com", "Cisco", "Cisco Secure Email (IronPort)", "correo"], ["pphosted.com", "Proofpoint", "Proofpoint", "correo"],
  ["mimecast.com", "Mimecast", "Mimecast", "correo"], ["messagelabs.com", "Broadcom", "Broadcom (Symantec)", "correo"],
  ["barracudanetworks.com", "Barracuda", "Barracuda", "correo"],
  ["sendgrid.net", "Twilio (SendGrid)", "SendGrid", "correo"], ["mailgun.org", "Mailgun", "Mailgun", "correo"],
  ["mcsv.net", "Intuit (Mailchimp)", "Mailchimp", "correo"], ["mandrillapp.com", "Intuit (Mailchimp)", "Mailchimp Transactional", "correo"],
  ["amazonses.com", "Amazon", "Amazon SES", "correo"], ["sparkpostmail.com", "SparkPost", "SparkPost", "correo"],
  ["mktomail.com", "Adobe (Marketo)", "Marketo", "correo"], ["exacttarget.com", "Salesforce", "Salesforce Marketing Cloud", "correo"],
  ["hubspotemail.net", "HubSpot", "HubSpot", "correo"], ["_spf.salesforce.com", "Salesforce", "Salesforce", "correo"],
  ["mx.cloudflare.net", "Cloudflare", "Cloudflare Email Routing", "correo"],
  // nube
  ["amazonaws.com", "Amazon", "AWS", "nube"], ["awsglobalaccelerator.com", "Amazon", "AWS Global Accelerator", "nube"],
  ["azurewebsites.net", "Microsoft", "Azure App Service", "nube"], ["cloudapp.azure.com", "Microsoft", "Azure", "nube"],
  ["cloudapp.net", "Microsoft", "Azure", "nube"], ["trafficmanager.net", "Microsoft", "Azure Traffic Manager", "nube"],
  ["azure-api.net", "Microsoft", "Azure API Management", "nube"], ["core.windows.net", "Microsoft", "Azure Storage", "nube"],
  ["azurestaticapps.net", "Microsoft", "Azure Static Web Apps", "nube"], ["azurecontainer.io", "Microsoft", "Azure", "nube"],
  ["ghs.googlehosted.com", "Google", "Google (sitios alojados)", "nube"], ["appspot.com", "Google", "Google App Engine", "nube"],
  ["run.app", "Google", "Google Cloud Run", "nube"], ["web.app", "Google", "Firebase Hosting", "nube"],
  ["herokudns.com", "Salesforce (Heroku)", "Heroku", "nube"], ["herokuapp.com", "Salesforce (Heroku)", "Heroku", "nube"],
  ["oraclecloud.com", "Oracle", "Oracle Cloud", "nube"], ["appdomain.cloud", "IBM", "IBM Cloud", "nube"],
  ["vercel-dns.com", "Vercel", "Vercel", "nube"], ["netlify.app", "Netlify", "Netlify", "nube"],
  ["github.io", "GitHub (Microsoft)", "GitHub Pages", "nube"],
  // saas
  ["force.com", "Salesforce", "Salesforce", "saas"], ["salesforce.com", "Salesforce", "Salesforce", "saas"],
  ["salesforce-sites.com", "Salesforce", "Salesforce Sites", "saas"], ["exct.net", "Salesforce", "Salesforce Marketing Cloud", "saas"],
  ["mktoweb.com", "Adobe (Marketo)", "Marketo", "saas"], ["mktossl.com", "Adobe (Marketo)", "Marketo", "saas"],
  ["adobeaemcloud.com", "Adobe", "Adobe Experience Manager", "saas"], ["adobedc.net", "Adobe", "Adobe Experience Platform", "saas"], ["omtrdc.net", "Adobe", "Adobe Analytics", "saas"],
  ["zendesk.com", "Zendesk", "Zendesk", "saas"], ["freshdesk.com", "Freshworks", "Freshdesk", "saas"],
  ["service-now.com", "ServiceNow", "ServiceNow", "saas"], ["servicenowservices.com", "ServiceNow", "ServiceNow", "saas"],
  ["hubspot.net", "HubSpot", "HubSpot", "saas"], ["hs-sites.com", "HubSpot", "HubSpot", "saas"],
  ["okta.com", "Okta", "Okta", "saas"], ["okta-emea.com", "Okta", "Okta", "saas"], ["oktapreview.com", "Okta", "Okta", "saas"],
  ["auth0.com", "Okta (Auth0)", "Auth0", "saas"], ["myshopify.com", "Shopify", "Shopify", "saas"],
  ["wpengine.com", "WP Engine", "WP Engine", "saas"], ["wixdns.net", "Wix", "Wix", "saas"],
  ["qualtrics.com", "Qualtrics", "Qualtrics", "saas"], ["docusign.net", "DocuSign", "DocuSign", "saas"],
  ["atlassian.net", "Atlassian", "Atlassian", "saas"], ["statuspage.io", "Atlassian", "Statuspage", "saas"],
  ["webex.com", "Cisco", "Webex", "saas"], ["zoom.us", "Zoom", "Zoom", "saas"], ["intercom.help", "Intercom", "Intercom", "saas"],
  ["unbouncepages.com", "Unbounce", "Unbounce", "saas"], ["myworkday.com", "Workday", "Workday", "saas"],
  ["successfactors.com", "SAP", "SAP SuccessFactors", "saas"], ["ondemand.com", "SAP", "SAP BTP", "saas"],
  ["taleo.net", "Oracle", "Oracle Taleo", "saas"], ["mypurecloud.com", "Genesys", "Genesys Cloud", "saas"],
  ["sitecorecloud.io", "Sitecore", "Sitecore", "saas"], ["acquia-sites.com", "Acquia", "Acquia", "saas"],
  ["pantheonsite.io", "Pantheon", "Pantheon", "saas"], ["cvent.com", "Cvent", "Cvent", "saas"],
  ["webflow.com", "Webflow", "Webflow", "saas"], ["activehosted.com", "ActiveCampaign", "ActiveCampaign", "saas"],   // 0.3
  // receptores de reportes DMARC / TLS-RPT y alojamiento de MTA-STS (0.2, 25-nov). Sólo los que publican
  // documentación con ese dominio exacto como destino de rua/ruf.
  ["dmarcian.com", "dmarcian", "dmarcian (reportes DMARC)", "correo"], ["dmarcian.eu", "dmarcian", "dmarcian (reportes DMARC)", "correo"],
  ["agari.com", "Fortra (Agari)", "Agari (reportes DMARC)", "correo"], ["vali.email", "Valimail", "Valimail (reportes DMARC)", "correo"],
  ["emaildefense.proofpoint.com", "Proofpoint", "Proofpoint Email Fraud Defense", "correo"],
  ["dmarc.postmarkapp.com", "ActiveCampaign (Postmark)", "Postmark DMARC", "correo"],
  ["ondmarc.com", "Red Sift", "OnDMARC", "correo"], ["redsift.cloud", "Red Sift", "OnDMARC", "correo"],
  ["uriports.com", "URIports", "URIports", "correo"], ["easydmarc.com", "EasyDMARC", "EasyDMARC", "correo"],
  ["easydmarc.us", "EasyDMARC", "EasyDMARC", "correo"], ["easydmarc.eu", "EasyDMARC", "EasyDMARC", "correo"],
  ["dmarcanalyzer.com", "Mimecast", "DMARC Analyzer", "correo"], ["dmarc-reports.cloudflare.net", "Cloudflare", "Cloudflare DMARC Management", "correo"],
  ["250ok.net", "Validity", "Validity (250ok)", "correo"], ["returnpath.net", "Validity", "Validity (Return Path)", "correo"],
  ["mailhardener.com", "Mailhardener", "Mailhardener", "correo"], ["powerdmarc.com", "PowerDMARC", "PowerDMARC", "correo"],
  ["sendmarc.com", "Sendmarc", "Sendmarc", "correo"], ["dmarcly.com", "DMARCLY", "DMARCLY", "correo"],
  ["dmp.cisco.com", "Cisco", "Cisco Domain Protection (reportes DMARC)", "correo"],
  // autoridades (BIMI: el certificado VMC se sirve desde la CA)
  ["digicert.com", "DigiCert", "DigiCert", "ca"], ["entrust.net", "Entrust", "Entrust", "ca"],
  ["globalsign.com", "GlobalSign", "GlobalSign", "ca"], ["sectigo.com", "Sectigo", "Sectigo", "ca"],
];

/** El sufijo más largo que calza por etiqueta, o null. Nunca adivina. */
export function clasificarNombre(nombre) {
  const n = String(nombre || "").toLowerCase().replace(/\.$/, "");
  let mejor = null;
  for (const [suf, proveedor, servicio, clase] of SUFIJOS)
    if ((n === suf || n.endsWith("." + suf)) && (!mejor || suf.length > mejor.sufijo.length))
      mejor = { sufijo: suf, proveedor, servicio, clase };
  return mejor;
}

// ---------------------------------------------------------------- ASN → proveedor (RQ.T.01)
// Sólo números que se sabe de quién son. Otro ASN no se descarta: sale con el nombre que publica
// Team Cymru y como «sin clasificar».
export const ASN = {
  Akamai: [20940, 16625, 16702, 21342, 21357, 21399, 32787, 35994, 12222, 18680, 18717, 23454, 23455, 24319, 26008, 31107, 31108, 31109, 31110, 31377, 33047, 33905, 34164, 34850, 35204, 36183, 39836, 43639, 55409, 55770, 63949],
  Cloudflare: [13335, 209242], Amazon: [16509, 14618], Microsoft: [8075, 8068, 8069, 12076], Google: [15169, 396982, 19527],
  Fastly: [54113], Imperva: [19551], Oracle: [31898], IBM: [36351],
};
export function proveedorAsn(n) {
  for (const [p, xs] of Object.entries(ASN)) if (xs.includes(Number(n))) return p;
  return null;
}
// (0.2) El nombre que el registro regional publica para el ASN (lo devuelve Team Cymru) → la empresa. Sólo
// nombres que identifican a UNA empresa; el resto sale con su nombre de registro, «sin clasificar».
export const ASN_NOMBRE = [[/\bAKAMAI\b/i, "Akamai"], [/\bAMAZON\b/i, "Amazon"], [/\bMICROSOFT\b/i, "Microsoft"], [/\bGOOGLE\b/i, "Google"],
  [/\bCLOUDFLARE/i, "Cloudflare"], [/\b(SALESFORCE|EXACT-?TARGET)/i, "Salesforce"], [/\bSENDGRID\b/i, "Twilio (SendGrid)"],
  [/\bPROOFPOINT\b/i, "Proofpoint"], [/\bMIMECAST\b/i, "Mimecast"], [/\bORACLE\b/i, "Oracle"], [/\bIRONPORT\b|\bCISCO\b/i, "Cisco"],
  [/\bZENDESK\b/i, "Zendesk"], [/\bFASTLY\b/i, "Fastly"], [/\bINCAPSULA\b|\bIMPERVA\b/i, "Imperva"], [/\bMAILGUN\b/i, "Mailgun"],
  [/\bSPARKPOST\b|\bMESSAGESYSTEMS\b/i, "SparkPost"], [/\bMAILCHIMP\b|\bROCKETSCIENCE\b/i, "Intuit (Mailchimp)"],
  [/\bENTEL\b/i, "Entel"], [/\bGTD\b/i, "GTD"], [/\bTELEFONICA\b|\bMOVISTAR\b/i, "Telefónica"], [/\bCLARO\b/i, "Claro"],
  [/\bIBM\b|\bSOFTLAYER\b/i, "IBM"], [/\bDIGITALOCEAN\b/i, "DigitalOcean"], [/\bOVH\b/i, "OVHcloud"], [/\bHETZNER\b/i, "Hetzner"]];
/** El texto de AS<n>.asn.cymru.com: «20940 | NL | ripencc | 2001-07-10 | AKAMAI-ASN1 - Akamai International B.V., NL» → el nombre. */
export const nombreDeAsnTxt = (t) => String(t || "").split("|").slice(4).join("|").trim() || null;
/** ASN → { proveedor, clasificado, propio }. `propio`: el nombre de registro contiene la primera etiqueta del
 * dominio (p.ej. el ASN del propio banco): no es un tercero. */
export function empresaDeAsn(n, nombre, dominio) {
  const p = proveedorAsn(n);
  if (p) return { proveedor: p, clasificado: true };
  const et = String(dominio || "").split(".")[0];
  if (nombre && et.length >= 4 && new RegExp(`\\b${et}\\b`, "i").test(nombre)) return { proveedor: "(propio)", clasificado: false, propio: true };
  for (const [rx, emp] of ASN_NOMBRE) if (nombre && rx.test(nombre)) return { proveedor: emp, clasificado: true };
  return { proveedor: `AS${n}${nombre ? ` ${nombre}` : ""}`, clasificado: false };
}

// ---------------------------------------------------------------- autoridades de certificación (RQ.T.05)
// CAA: el valor de issue/issuewild → la CA. Un valor desconocido sale tal cual, sin clasificar.
export const CAA_CA = { "digicert.com": "DigiCert", "symantec.com": "DigiCert", "geotrust.com": "DigiCert", "thawte.com": "DigiCert",
  "rapidssl.com": "DigiCert", "letsencrypt.org": "Let's Encrypt", "sectigo.com": "Sectigo", "comodoca.com": "Sectigo",
  "globalsign.com": "GlobalSign", "pki.goog": "Google Trust Services", "amazon.com": "Amazon Trust Services",
  "amazontrust.com": "Amazon Trust Services", "amazonaws.com": "Amazon Trust Services", "visa.com": "Visa", "awstrust.com": "Amazon Trust Services", "entrust.net": "Entrust",
  "affirmtrust.com": "Entrust", "godaddy.com": "GoDaddy", "starfieldtech.com": "GoDaddy", "ssl.com": "SSL.com",
  "zerossl.com": "Sectigo (ZeroSSL)", "buypass.com": "Buypass", "harica.gr": "HARICA", "e-certchile.cl": "E-Cert Chile" };
// CT: la organización (O=) del DN del emisor, o el nombre que da Cert Spotter → la CA. Las marcas que
// compró otra CA quedan con su nombre histórico entre paréntesis: el certificado lo emitió esa marca.
// Un emisor que no calza sale con su nombre tal cual (viene del registro público: es una CA de verdad).
export const EMISOR_RX = [[/^digicert/i, "DigiCert"], [/^symantec/i, "DigiCert (Symantec)"], [/^geotrust/i, "DigiCert (GeoTrust)"],
  [/^verisign/i, "DigiCert (VeriSign)"], [/^thawte/i, "DigiCert (thawte)"], [/^rapidssl/i, "DigiCert (RapidSSL)"],
  [/^let.?s encrypt/i, "Let's Encrypt"], [/^globalsign/i, "GlobalSign"], [/^sectigo/i, "Sectigo"], [/^comodo/i, "Sectigo (Comodo)"],
  [/^zerossl/i, "Sectigo (ZeroSSL)"], [/^entrust/i, "Entrust"], [/^amazon/i, "Amazon Trust Services"],
  [/^google trust/i, "Google Trust Services"], [/^microsoft/i, "Microsoft"], [/^(godaddy|starfield)/i, "GoDaddy"],
  // (0.3) el mismo emisor con dos nombres: crt.sh da la O= del certificado («SSL Corporation», «CloudFlare, Inc.»),
  // Cert Spotter su nombre comercial («SSL.com», «Cloudflare»). Medido el 25-nov sobre un dominio real.
  [/^ssl\.com\b|^ssl corporation\b/i, "SSL.com"], [/^cloudflare\b/i, "Cloudflare"]];
export function caDeEmisor(nombre) {
  const n = String(nombre || "").trim();
  for (const [rx, ca] of EMISOR_RX) if (rx.test(n)) return ca;
  return n || "(emisor sin nombre)";
}
// La empresa detrás de una CA, para contar proveedores y no marcas.
export function empresaDeCa(ca) {
  if (ca === "Amazon Trust Services") return "Amazon";
  if (ca === "Google Trust Services") return "Google";
  return String(ca).replace(/\s*\(.*\)$/, "");
}

// ---------------------------------------------------------------- TXT de verificación (RQ.T.07)
// Sólo prefijos que un SaaS publica para verificar el dominio. Un TXT que no calza NO inventa proveedor:
// se cuenta en el denominador como «TXT sin patrón conocido».
export const TXT_VERIFICACION = [
  [/^google-site-verification=/i, "Google", "Google (Search Console / Workspace)"],
  [/^MS=ms\d+/i, "Microsoft", "Microsoft 365"],
  [/^atlassian-domain-verification=/i, "Atlassian", "Atlassian"],
  [/^docusign=/i, "DocuSign", "DocuSign"],
  [/^facebook-domain-verification=/i, "Meta", "Meta (Facebook)"],
  [/^workplace-domain-verification=/i, "Meta", "Meta Workplace"],
  [/^apple-domain-verification=/i, "Apple", "Apple"],
  [/^adobe-idp-site-verification=/i, "Adobe", "Adobe"],
  [/^adobe-sign-verification=/i, "Adobe", "Adobe Sign"],
  [/^globalsign-domain-verification=/i, "GlobalSign", "GlobalSign"],
  [/^_?globalsign-smime-dv=/i, "GlobalSign", "GlobalSign (S/MIME)"],
  [/^stripe-verification=/i, "Stripe", "Stripe"],
  [/^(zoom-domain-verification|ZOOM_verify_)/i, "Zoom", "Zoom"],
  [/^slack-domain-verification=/i, "Salesforce (Slack)", "Slack"],
  [/^dropbox-domain-verification=/i, "Dropbox", "Dropbox"],
  [/^citrix-verification-code=/i, "Citrix", "Citrix"],
  [/^(cisco-ci-domain-verification=|webexdomainverification\.)/i, "Cisco", "Webex"],
  [/^onetrust-domain-verification=/i, "OneTrust", "OneTrust"],
  [/^knowbe4-site-verification=/i, "KnowBe4", "KnowBe4"],
  [/^mongodb-site-verification=/i, "MongoDB", "MongoDB Atlas"],
  [/^openai-domain-verification=/i, "OpenAI", "OpenAI"],
  [/^miro-verification=/i, "Miro", "Miro"],
  [/^smartsheet-site-validation=/i, "Smartsheet", "Smartsheet"],
  [/^teamviewer-sso-verification=/i, "TeamViewer", "TeamViewer"],
  [/^wiz-domain-verification=/i, "Wiz", "Wiz"],
  [/^yandex-verification:/i, "Yandex", "Yandex"],
  [/^amazonses:/i, "Amazon", "Amazon SES"],
  [/^hubspot-developer-verification=/i, "HubSpot", "HubSpot"],
  [/^cursor-domain-verification/i, "Anysphere (Cursor)", "Cursor"],
  [/^anthropic-domain-verification/i, "Anthropic", "Anthropic"],
  [/^twilio-domain-verification=/i, "Twilio", "Twilio"],
  [/^jamf-site-verification=/i, "Jamf", "Jamf"],
  [/^logmein-verification-code=/i, "GoTo (LogMeIn)", "LogMeIn"],
  [/^dynatrace-site-verification=/i, "Dynatrace", "Dynatrace"],
  [/^figma-domain-verification=/i, "Figma", "Figma"],
  [/^yahoo-verification-key=/i, "Yahoo", "Yahoo"],
  // «VISA=» + 32 hex, partido en dos cadenas: verificación de dominio de Visa (Visa también figura en el CAA).
  [/^VISA=[0-9A-F]{32}$/, "Visa", "Visa"],
];
export function verificacionTxt(txt) {
  for (const [rx, proveedor, servicio] of TXT_VERIFICACION) if (rx.test(String(txt).trim())) return { proveedor, servicio };
  return null;
}

// ---------------------------------------------------------------- DKIM (RQ.T.03)
// Selectores que se consultan. Un selector sólo nombra proveedor por sí mismo si es exclusivo de uno
// (google, zendesk1/2, mandrill); el resto se clasifica por el destino de su CNAME, o no se clasifica.
export const DKIM_SELECTORES = ["google", "selector1", "selector2", "k1", "k2", "s1", "s2", "mandrill", "zendesk1", "zendesk2",
  // (0.2) más selectores que publican los proveedores; sólo nombran proveedor por el destino de su CNAME
  "k3", "hs1", "hs2", "fd", "fd2", "zoho", "zmail", "protonmail", "protonmail2", "protonmail3", "ctct1", "ctct2", "krs", "mailo",
  "pic", "m1", "sf1", "sf2", "sfdc", "smtp", "mail", "dkim1", "key1", "key2", "selector3", "mte1", "mte2", "sparkpost", "turbo-smtp",
  "amazonses", "pm", "intercom", "qualtrics", "freshdesk", "sendinblue", "mailerlite", "acoustic", "ex", "spop1024",
  "smtpapi", "mailjet", "dkim", "default", "mxvault", "sig1", "cm", "everlytickey1"];
export const DKIM_SELECTOR_UNICO = { google: ["Google", "Google Workspace"], zendesk1: ["Zendesk", "Zendesk"],
  zendesk2: ["Zendesk", "Zendesk"], mandrill: ["Intuit (Mailchimp)", "Mailchimp Transactional"] };

// ---------------------------------------------------------------- dominio registrable
const SEGUNDO_NIVEL = new Set(["co.uk", "com.br", "com.ar", "com.mx", "com.au", "co.jp", "com.co", "com.pe", "net.br", "gob.cl", "com.es"]);
export function registrable(nombre) {
  const p = String(nombre || "").toLowerCase().replace(/\.$/, "").split(".");
  if (p.length < 2) return p.join(".");
  return SEGUNDO_NIVEL.has(p.slice(-2).join(".")) && p.length >= 3 ? p.slice(-3).join(".") : p.slice(-2).join(".");
}
export const esPropio = (nombre, dominio) => { const n = String(nombre).toLowerCase().replace(/\.$/, ""); return n === dominio || n.endsWith("." + dominio); };
