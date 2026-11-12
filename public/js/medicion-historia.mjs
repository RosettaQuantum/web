// La medición contada en cuatro pasos (2-nov-2026, página única aprobada):
//   1 · qué tiene hoy — un canal por tarjeta, el más débil marcado
//   2 · qué significa — la Cápsula HNDL abierta sobre ESE canal, no un ejemplo genérico
//   3 · por qué importa — Shor corriendo en pequeño y la ventana de riesgo
//   ✓ · la foto sellada — la que ya pinta medicion-envivo.mjs
//
// No mide nada: escucha "mv:medido", que dispara medicion-envivo.mjs con el mismo dato que pinta
// el resto de la página. La captura y la corrida de Shor son archivos publicados con su huella
// (/datos/demo-pqc/), tomados en nuestro servidor de Contabo el 2-nov-2026: se leen, no se escriben aquí.
//
// Regla que no se rompe: un canal que no se pudo medir dice «no medido», nunca «clásico».

import { enPalabras, fraseVeredicto } from "./medicion-palabras.mjs";

// Idioma del documento, leído una vez (12-nov-2026): en español todo queda como estaba.
const EN = document.documentElement.lang === "en";
const IDIOMA = EN ? "en" : "es";
const t = (es, en) => (EN ? en : es);

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (x) => Number(x).toLocaleString(EN ? "en-US" : "es-CL");
const hora = (iso) => (iso ? new Date(iso).toISOString().slice(11, 16) + " UTC" : "");
const CAPSULA = "/datos/demo-pqc/capsula-hndl-2026-11-02.json";
const SHOR = "/datos/demo-pqc/shor-n21-2026-11-02.json";

const chip = (clase, txt) => `<span class="mv-chip ${clase}">${esc(txt)}</span>`;

/** Cada canal: estado "si" (post-cuántico), "no" (clásico, medido), "nm" (no medido). */
function canales({ d, s, dominio, www }) {
  const out = [];
  const v = s.borde?.veredicto || {};
  out.push({ k: "web", q: t("Sitio web", "Website"), estado: v.soporta === true ? "si" : v.soporta === false ? "no" : "nm",
    chip: v.soporta === true ? t("post-cuántico", "post-quantum") : v.soporta === false ? t("clásico", "classical") : t("no medido", "not measured"),
    txt: v.soporta === true ? t(`${www} negocia el intercambio híbrido X25519MLKEM768.`, `${www} negotiates the X25519MLKEM768 hybrid key exchange.`) : v.soporta === false ? t(`${www} no acepta el intercambio híbrido.`, `${www} does not accept the hybrid key exchange.`) : t(`No pudimos completar el saludo con ${www}.`, `We could not complete the handshake with ${www}.`),
    det: `${s.borde?.dns?.cdn && s.borde.dns.cdn !== "otro" && !(EN && s.borde.dns.cdn === "sin CNAME") ? `${t("vía", "via")} ${s.borde.dns.cdn} · ` : ""}${t("medido", "measured")} ${hora(s.borde?.medido_utc)}` });

  const co = s.correo_tls, srv = co?.estado === "hecho" ? co.resultado?.servidores || [] : [];
  const med = srv.filter((m) => m.veredicto.estado === "medido");
  const conPq = med.filter((m) => m.veredicto.soporta === true);
  const est = !med.length ? "nm" : conPq.length === med.length ? "si" : "no";
  out.push(EN ? { k: "correo", q: "Inbound email", estado: est,
    chip: est === "si" ? "post-quantum" : est === "no" ? "classical" : "not measured",
    txt: est === "nm" ? `We could not measure your email encryption${co?.causa ? `: ${enPalabras(co.causa, "en")}` : ""}.`
      : est === "si" ? `All ${med.length} of your measured mail servers accept the hybrid key exchange.`
      : conPq.length ? `${conPq.length} of ${med.length} mail servers accept the hybrid key exchange.`
      : `None of your ${med.length} mail servers accepts the hybrid key exchange.`,
    det: med.length ? `${med.length} of ${srv.length} MX measured${co.resultado?.desde_ip ? ` · from ${co.resultado.desde_ip}` : ""}` : "email probe" } : { k: "correo", q: "Correo entrante", estado: est,
    chip: est === "si" ? "post-cuántico" : est === "no" ? "clásico" : "no medido",
    txt: est === "nm" ? `No pudimos medir el cifrado de su correo${co?.causa ? `: ${enPalabras(co.causa)}` : ""}.`
      : est === "si" ? `Sus ${med.length} servidores de correo medidos aceptan el intercambio híbrido.`
      : conPq.length ? `${conPq.length} de ${med.length} servidores de correo aceptan el intercambio híbrido.`
      : `Ninguno de sus ${med.length} servidores de correo acepta el intercambio híbrido.`,
    det: med.length ? `${med.length} de ${srv.length} MX medidos${co.resultado?.desde_ip ? ` · desde ${co.resultado.desde_ip}` : ""}` : "sonda de correo" });

  const e = d.endpoints || [];
  const resp = e.filter((x) => x.responde_443 === true).length;
  out.push({ k: "endp", q: t("Endpoints sensibles", "Sensitive endpoints"), estado: "info", chip: `${num(e.length)} ${t("revisados", "checked")}`,
    txt: !e.length ? t("Ningún nombre sensible en su superficie pública.", "No sensitive names in your public surface.") : t(`${num(resp)} responden en el puerto 443; el detalle de cada uno está más abajo.`, `${num(resp)} respond on port 443; the detail for each one is below.`),
    det: t("registro público + DNS + 443", "public log + DNS + 443") });

  const c = s.certificado || {};
  const alg = c.ok ? `${c.algoritmo === "EC" ? "ECDSA" : c.algoritmo} ${c.curva || (c.bits ? c.bits + " bits" : "")}`.trim() : null;
  const pqCert = c.ok && /ML-?DSA|SLH-?DSA|FALCON/i.test(`${c.algoritmo} ${c.curva || ""}`);
  out.push({ k: "cert", q: t("Certificado", "Certificate"), estado: !c.ok ? "nm" : pqCert ? "si" : "no", chip: alg || t("no leído", "not read"),
    txt: pqCert ? t("Firma post-cuántica.", "Post-quantum signature.") : c.ok ? t("NIST lo depreca después de 2030, con cualquier curva o tamaño.", "NIST deprecates it after 2030, at any curve or key size.")
      : t(`No pudimos leer el certificado${c.error ? `: ${enPalabras(c.error)}` : ""}. Vuelva a medir en unos minutos.`, `We could not read the certificate${c.error ? `: ${enPalabras(c.error, "en")}` : ""}. Please measure again in a few minutes.`),
    det: c.ok ? t("NIST IR 8547, versión final", "NIST IR 8547, final version") : "" });

  out.push({ k: "ssh", q: t("Acceso SSH", "SSH access"), estado: "nm", chip: t("no medido", "not measured"),
    txt: t("Esta página no sondea SSH.", "This page does not probe SSH."), det: t("se mide en el informe completo", "measured in the full report") });
  return out;
}

const CLASE = { si: "mv-si", no: "mv-no", nm: "mv-neutro", info: "mv-neutro" };
let actual = null;

function pintarCanales(lista) {
  // El más débil: un canal MEDIDO como clásico donde importa el tráfico (correo antes que web).
  const debil = ["correo", "web"].find((k) => lista.find((c) => c.k === k)?.estado === "no") || null;
  $("mv-canales").innerHTML = lista.map((c) => `<article class="mv-canal${c.k === debil ? " mv-canal-debil" : ""}">
    <span class="mv-canal-q">${esc(c.q)}</span>${chip(CLASE[c.estado], c.chip)}<p>${esc(c.txt)}</p><span class="mv-canal-det">${esc(c.det)}</span></article>`).join("");
  const web = lista.find((c) => c.k === "web"), cor = lista.find((c) => c.k === "correo");
  const ver = $("mv-veredicto");
  ver.textContent = fraseVeredicto(lista, IDIOMA);
  ver.hidden = false;
  const p = $("mv-puente");
  if (debil) {
    const otro = debil === "correo" ? web : cor;
    p.innerHTML = EN ? `<p><strong>Your weakest channel is ${debil === "correo" ? "email" : "the website"}.</strong> ${otro.estado === "si" ? `${debil === "correo" ? "Your website" : "Your email"} is already protected; ${debil === "correo" ? "your email" : "your website"} is not.` : ""}</p><a href="#mv-acto2">What it means for your data →</a>`
      : `<p><strong>Su canal más débil es ${debil === "correo" ? "el correo" : "el sitio web"}.</strong> ${otro.estado === "si" ? `${debil === "correo" ? "Su sitio" : "Su correo"} ya está protegido; ${debil === "correo" ? "su correo" : "su sitio"}, no.` : ""}</p><a href="#mv-acto2">Qué significa para sus datos →</a>`;
  } else if (web.estado === "si" && cor.estado === "si") {
    p.innerHTML = t(`<p><strong>Su sitio y su correo ya negocian el intercambio post-cuántico.</strong> Lo que queda está en su certificado y en lo que no se ve desde afuera.</p><a href="#mv-acto2">Qué significa →</a>`,
      `<p><strong>Your website and your email already negotiate the post-quantum key exchange.</strong> What remains is in your certificate and in what cannot be seen from outside.</p><a href="#mv-acto2">What it means →</a>`);
  } else {
    p.innerHTML = t(`<p><strong>Algún canal quedó sin medir.</strong> No lo leemos como protegido ni como expuesto.</p><a href="#mv-acto2">Qué significa →</a>`,
      `<p><strong>At least one channel was not measured.</strong> We do not read it as protected or as exposed.</p><a href="#mv-acto2">What it means →</a>`);
  }
  p.hidden = false;
  return { debil, web, cor };
}

function pintarSelector({ web, cor, debil }) {
  const opciones = [cor, web].filter((c) => c.estado === "si" || c.estado === "no");
  const sel = $("mv-canal-sel");
  sel.innerHTML = opciones.map((c) => `<button type="button" data-c="${c.k}" aria-pressed="${c.k === (debil || opciones[0]?.k)}">${esc(c.q)} · ${esc(c.chip)}</button>`).join("");
  const leer = (k) => {
    const c = opciones.find((o) => o.k === k);
    sel.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.c === k));
    const nombre = k === "correo" ? t("correo", "email") : t("sitio web", "website");
    $("mv-cap-lee").innerHTML = !c ? t("No hay un canal medido para mostrar aquí.", "There is no measured channel to show here.")
      : c.estado === "no" ? t(`En su caso, la Cápsula A es su <strong>${nombre}</strong>: lo que viaja por ahí hoy se puede copiar y guardar como la cápsula de la izquierda.`, `In your case, Capsule A is your <strong>${nombre}</strong>: what travels over it today can be copied and stored like the capsule on the left.`)
      : t(`Su <strong>${nombre}</strong> viaja como la Cápsula B: lo que se copie hoy no se podrá leer mañana.`, `Your <strong>${nombre}</strong> travels like Capsule B: what is copied today cannot be read tomorrow.`);
  };
  sel.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => leer(b.dataset.c)));
  leer(debil || opciones[0]?.k);
}

async function pintarCapsula(web) {
  try {
    const c = await (await fetch(CAPSULA)).json();
    const hex = c.app_c2s_hex.join("");
    $("mv-cap-hex").textContent = hex.replace(/(.{8})/g, "$1 ").slice(0, 330) + t(`… (${num(hex.length / 2)} bytes de datos de aplicación)`, `… (${num(hex.length / 2)} bytes of application data)`);
    $("mv-cap-pie").innerHTML = t(`Intercambio ${esc(c.key_exchange)} · captura real ${esc(c.capturado_utc.replace("T", " ").replace("+00:00", ""))} UTC en nuestro servidor · sha256 ${esc(c.sha256_captura.slice(0, 8))}…${esc(c.sha256_captura.slice(-4))} · <a href="${CAPSULA}">archivo</a>`,
      `Key exchange ${esc(String(c.key_exchange).replace("(clásico)", "(classical)").replace("(híbrido)", "(hybrid)"))} · real capture ${esc(c.capturado_utc.replace("T", " ").replace("+00:00", ""))} UTC on our server · sha256 ${esc(c.sha256_captura.slice(0, 8))}…${esc(c.sha256_captura.slice(-4))} · <a href="${CAPSULA}">file</a>`);
  } catch { $("mv-cap-hex").textContent = t("No se pudo cargar la captura.", "The capture could not be loaded."); }
  $("mv-cap-pie-b").textContent = web?.estado === "si" ? t(`Así viaja hoy su sitio web · medido ${web.det.split("medido ")[1] || ""}`, `This is how your website travels today · measured ${web.det.split("measured ")[1] || ""}`) : t("Así viaja un canal con intercambio híbrido.", "This is how a channel with a hybrid key exchange travels.");
}

async function pintarShor() {
  try {
    const r = await (await fetch(SHOR)).json();
    const max = Math.max(...r.picos.map((p) => p[1]));
    $("mv-picos").innerHTML = r.picos.map(([m, n]) => `<div style="height:${Math.round((n / max) * 100)}%" title="${num(n)} ${t("de", "of")} ${num(r.shots)}"><span>${m}</span></div>`).join("");
    $("mv-shor-res").textContent = `${t("período", "period")} ${r.orden_r} → ${r.N} = ${r.factores.join(" × ")}`;
    $("mv-shor-nota").innerHTML = t(`Simulación exacta de ${r.t_qubits} qubits sobre N = ${r.N}, corrida en nuestro servidor (${num(r.shots)} mediciones). Muestra el mecanismo; no rompe ninguna llave real. Una llave de 256 bits exige una máquina que hoy no existe. <a href="${SHOR}">archivo</a>`,
      `Exact simulation of ${r.t_qubits} qubits on N = ${r.N}, run on our server (${num(r.shots)} shots). It shows the mechanism; it breaks no real key. A 256-bit key requires a machine that does not exist today. <a href="${SHOR}">file</a>`);
  } catch { $("mv-shor-res").textContent = t("No se pudo cargar la corrida.", "The run could not be loaded."); }
}

// El riel marca en qué paso está el lector.
function riel() {
  // El índice se pega bajo la barra del sitio, que no tiene alto fijo (la franja de frescura llega
  // después): se mide de verdad y se vuelve a medir, igual que en el informe PQC.
  const sitio = document.querySelector("body > nav, nav:not([class])");
  const medir = () => { const a = Math.round(sitio?.getBoundingClientRect().height || 0); if (a > 0) document.documentElement.style.setProperty("--alto-nav", a + "px"); };
  medir();
  if (sitio && window.ResizeObserver) new ResizeObserver(medir).observe(sitio);
  const links = [...document.querySelectorAll(".mv-actos a")];
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) links.forEach((a) => a.classList.toggle("mv-acto-on", a.getAttribute("href") === "#" + e.target.id));
  }), { rootMargin: "-40% 0px -55% 0px" });
  document.querySelectorAll(".mv-acto").forEach((s) => io.observe(s));
}

// «Descargar mi informe» (aquí o por correo) vive en /js/medicion-descarga.mjs desde el 12-nov-2026.

window.addEventListener("mv:medido", (ev) => {
  actual = canales(ev.detail);
  const r = pintarCanales(actual);
  pintarSelector(r);
  pintarCapsula(r.web);
});
pintarShor();
riel();
