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

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (x) => Number(x).toLocaleString("es-CL");
const hora = (iso) => (iso ? new Date(iso).toISOString().slice(11, 16) + " UTC" : "");
const CAPSULA = "/datos/demo-pqc/capsula-hndl-2026-11-02.json";
const SHOR = "/datos/demo-pqc/shor-n21-2026-11-02.json";

const chip = (clase, txt) => `<span class="mv-chip ${clase}">${esc(txt)}</span>`;

/** Cada canal: estado "si" (post-cuántico), "no" (clásico, medido), "nm" (no medido). */
function canales({ d, s, dominio, www }) {
  const out = [];
  const v = s.borde?.veredicto || {};
  out.push({ k: "web", q: "Sitio web", estado: v.soporta === true ? "si" : v.soporta === false ? "no" : "nm",
    chip: v.soporta === true ? "post-cuántico" : v.soporta === false ? "clásico" : "no medido",
    txt: v.soporta === true ? `${www} negocia el intercambio híbrido X25519MLKEM768.` : v.soporta === false ? `${www} no acepta el intercambio híbrido.` : `No pudimos completar el saludo con ${www}.`,
    det: `${s.borde?.dns?.cdn && s.borde.dns.cdn !== "otro" ? `vía ${s.borde.dns.cdn} · ` : ""}medido ${hora(s.borde?.medido_utc)}` });

  const co = s.correo_tls, srv = co?.estado === "hecho" ? co.resultado?.servidores || [] : [];
  const med = srv.filter((m) => m.veredicto.estado === "medido");
  const conPq = med.filter((m) => m.veredicto.soporta === true);
  const est = !med.length ? "nm" : conPq.length === med.length ? "si" : "no";
  out.push({ k: "correo", q: "Correo entrante", estado: est,
    chip: est === "si" ? "post-cuántico" : est === "no" ? "clásico" : "no medido",
    txt: est === "nm" ? `No pudimos medir el cifrado de su correo${co?.causa ? `: ${co.causa}` : ""}.`
      : est === "si" ? `Sus ${med.length} servidores de correo medidos aceptan el intercambio híbrido.`
      : conPq.length ? `${conPq.length} de ${med.length} servidores de correo aceptan el intercambio híbrido.`
      : `Ninguno de sus ${med.length} servidores de correo acepta el intercambio híbrido.`,
    det: med.length ? `${med.length} de ${srv.length} MX medidos${co.resultado?.desde_ip ? ` · desde ${co.resultado.desde_ip}` : ""}` : "sonda de correo" });

  const e = d.endpoints || [];
  const resp = e.filter((x) => x.responde_443 === true).length;
  out.push({ k: "endp", q: "Endpoints sensibles", estado: "info", chip: `${num(e.length)} revisados`,
    txt: !e.length ? "Ningún nombre sensible en su superficie pública." : `${num(resp)} responden en el puerto 443; el detalle de cada uno está más abajo.`,
    det: "registro público + DNS + 443" });

  const c = s.certificado || {};
  const alg = c.ok ? `${c.algoritmo === "EC" ? "ECDSA" : c.algoritmo} ${c.curva || (c.bits ? c.bits + " bits" : "")}`.trim() : null;
  const pqCert = c.ok && /ML-?DSA|SLH-?DSA|FALCON/i.test(`${c.algoritmo} ${c.curva || ""}`);
  out.push({ k: "cert", q: "Certificado", estado: !c.ok ? "nm" : pqCert ? "si" : "no", chip: alg || "no leído",
    txt: pqCert ? "Firma post-cuántica." : c.ok ? "NIST lo depreca después de 2030, con cualquier curva o tamaño." : `No pudimos leer el certificado${c.error ? `: ${c.error}` : ""}.`,
    det: c.ok ? "NIST IR 8547, versión final" : "" });

  out.push({ k: "ssh", q: "Acceso SSH", estado: "nm", chip: "no medido",
    txt: "Esta página no sondea SSH.", det: "se mide en el informe completo" });
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
  const p = $("mv-puente");
  if (debil) {
    const otro = debil === "correo" ? web : cor;
    p.innerHTML = `<p><strong>Su canal más débil es ${debil === "correo" ? "el correo" : "el sitio web"}.</strong> ${otro.estado === "si" ? `${debil === "correo" ? "Su sitio" : "Su correo"} ya está protegido; ${debil === "correo" ? "su correo" : "su sitio"}, no.` : ""}</p><a href="#mv-acto2">Qué significa para sus datos →</a>`;
  } else if (web.estado === "si" && cor.estado === "si") {
    p.innerHTML = `<p><strong>Su sitio y su correo ya negocian el intercambio post-cuántico.</strong> Lo que queda está en su certificado y en lo que no se ve desde afuera.</p><a href="#mv-acto2">Qué significa →</a>`;
  } else {
    p.innerHTML = `<p><strong>Algún canal quedó sin medir.</strong> No lo leemos como protegido ni como expuesto.</p><a href="#mv-acto2">Qué significa →</a>`;
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
    const nombre = k === "correo" ? "correo" : "sitio web";
    $("mv-cap-lee").innerHTML = !c ? "No hay un canal medido para mostrar aquí."
      : c.estado === "no" ? `En su caso, la Cápsula A es su <strong>${nombre}</strong>: lo que viaja por ahí hoy se puede copiar y guardar como la cápsula de la izquierda.`
      : `Su <strong>${nombre}</strong> viaja como la Cápsula B: lo que se copie hoy no se podrá leer mañana.`;
  };
  sel.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => leer(b.dataset.c)));
  leer(debil || opciones[0]?.k);
}

async function pintarCapsula(web) {
  try {
    const c = await (await fetch(CAPSULA)).json();
    const hex = c.app_c2s_hex.join("");
    $("mv-cap-hex").textContent = hex.replace(/(.{8})/g, "$1 ").slice(0, 330) + `… (${num(hex.length / 2)} bytes de datos de aplicación)`;
    $("mv-cap-pie").innerHTML = `Intercambio ${esc(c.key_exchange)} · captura real ${esc(c.capturado_utc.replace("T", " ").replace("+00:00", ""))} UTC en nuestro servidor · sha256 ${esc(c.sha256_captura.slice(0, 8))}…${esc(c.sha256_captura.slice(-4))} · <a href="${CAPSULA}">archivo</a>`;
  } catch { $("mv-cap-hex").textContent = "No se pudo cargar la captura."; }
  $("mv-cap-pie-b").textContent = web?.estado === "si" ? `Así viaja hoy su sitio web · medido ${web.det.split("medido ")[1] || ""}` : "Así viaja un canal con intercambio híbrido.";
}

async function pintarShor() {
  try {
    const r = await (await fetch(SHOR)).json();
    const max = Math.max(...r.picos.map((p) => p[1]));
    $("mv-picos").innerHTML = r.picos.map(([m, n]) => `<div style="height:${Math.round((n / max) * 100)}%" title="${num(n)} de ${num(r.shots)}"><span>${m}</span></div>`).join("");
    $("mv-shor-res").textContent = `período ${r.orden_r} → ${r.N} = ${r.factores.join(" × ")}`;
    $("mv-shor-nota").innerHTML = `Simulación exacta de ${r.t_qubits} qubits sobre N = ${r.N}, corrida en nuestro servidor (${num(r.shots)} mediciones). Muestra el mecanismo; no rompe ninguna llave real. Una llave de 256 bits exige una máquina que hoy no existe. <a href="${SHOR}">archivo</a>`;
  } catch { $("mv-shor-res").textContent = "No se pudo cargar la corrida."; }
}

// El riel marca en qué paso está el lector.
function riel() {
  const links = [...document.querySelectorAll(".mv-actos a")];
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) links.forEach((a) => a.classList.toggle("mv-acto-on", a.getAttribute("href") === "#" + e.target.id));
  }), { rootMargin: "-40% 0px -55% 0px" });
  document.querySelectorAll(".mv-acto").forEach((s) => io.observe(s));
}

window.addEventListener("mv:medido", (ev) => {
  actual = canales(ev.detail);
  const r = pintarCanales(actual);
  pintarSelector(r);
  pintarCapsula(r.web);
});
pintarShor();
riel();
