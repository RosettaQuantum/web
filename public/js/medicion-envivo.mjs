/*
 * /es/q-ready/medicion — el informe QEX en vivo (30-oct-2026; rediseño del mismo día).
 * El navegador consulta el registro público de certificados (crt.sh admite CORS); el servidor
 * hace sólo los saludos TLS y las consultas sin CORS (/api/sondas). La foto se arma con
 * armarFoto() de qex-nucleo.mjs, la misma función que alimenta el PDF.
 *
 * La consola muestra eventos REALES de esta medición (lo que respondió cada consulta, con su
 * tiempo): no hay animación que simule trabajo. Si algo no se midió, la consola lo dice.
 *
 * La bandeja «Su historial» vive SÓLO en este navegador (localStorage): ninguna foto viaja a un
 * servidor. Es una comodidad del que mide, no un archivo: si el navegador la borra, la foto
 * descargada sigue siendo la copia que vale.
 * Todo lo que viene de afuera (nombres de CT, respuestas de servidores, fotos cargadas) se escapa.
 */
import * as N from "./qex-nucleo.mjs";
import { enPalabras, paraTraza, detalleEndpointEn, fuenteCT } from "./medicion-palabras.mjs";
import { textos } from "./qready-textos.mjs";

// Una sola página en dos idiomas (12-nov-2026): se lee el idioma del documento una vez. En español
// todo queda como estaba; cada texto visible lleva su inglés al lado, con t(es, en).
const EN = document.documentElement.lang === "en";
const IDIOMA = EN ? "en" : "es";
const t = (es, en) => (EN ? en : es);
const traz = (x) => paraTraza(x, IDIOMA);
const SECTOR_EN = { banca: "Banking", educacion: "Education", energia: "Energy", fintech: "Fintech", gobierno: "Government", mineria: "Mining",
  prevision: "Pensions", retail: "Retail", salud_clinica: "Health · clinics", salud_isapre: "Health · private insurers (Isapres)", seguros: "Insurance", telecom: "Telecommunications" };
const sectorNombre = (k, es) => (EN ? SECTOR_EN[k] || es : es);
const valorEn = (x) => (EN && typeof x === "string" ? N.VALOR_EN[x] ?? x : x);
const etiquetaDim = (k) => (EN ? N.ETIQUETA_DIM_EN : N.ETIQUETA_DIM)[k];
const fuenteTxt = (f) => fuenteCT(f, IDIOMA);

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (x, d = 0) => x == null ? "—" : Number(x).toLocaleString(EN ? "en-US" : "es-CL", { minimumFractionDigits: d, maximumFractionDigits: d });
const MESES = EN ? ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] : ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MESES_L = EN ? ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] : ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const fechaUtc = (iso) => { const d = new Date(iso); return `${d.getUTCDate()}-${MESES[d.getUTCMonth()]}-${d.getUTCFullYear()} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC`; };
const fechaCorta = (iso) => { if (!iso) return null; const d = new Date(iso.length === 10 ? iso + "T12:00:00Z" : iso); return `${d.getUTCDate()}-${MESES[d.getUTCMonth()]}-${d.getUTCFullYear()}`; };
const horaLocal = (iso) => (iso && iso.length > 10 ? new Date(iso).toLocaleTimeString(EN ? "en-GB" : "es-CL", { hour: "2-digit", minute: "2-digit", hour12: false }) : null);
const edicionLarga = (f) => { const m = /^(\d{4})-(\d{2})/.exec(f.edicion || f.medido_utc || ""); return m ? t(`${MESES_L[Number(m[2]) - 1]} de ${m[1]}`, `${MESES_L[Number(m[2]) - 1]} ${m[1]}`) : t("la foto anterior", "the previous snapshot"); };
const capital = (s) => s[0].toUpperCase() + s.slice(1);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const quieto = matchMedia("(prefers-reduced-motion: reduce)").matches;
const CT_ESPERA_MS = 60000;   // el servidor tarda como máximo ~45 s (25 crt.sh + 20 Cert Spotter)
const ms = (x) => x == null ? "" : x >= 1000 ? `${num(x / 1000, 1)} s` : `${x} ms`;

const form = $("mv-form"); if (!form) throw new Error("sin formulario");
let previa = null, fotoHoy = null, referencia = null;

const decir = (t, mal) => { const e = $("mv-estado"); e.textContent = t; e.hidden = !t; e.classList.toggle("mv-mal", !!mal); };
const chip = (v, si = t("sí", "yes"), no = "no") => v === true ? `<span class="mv-chip mv-si">${si}</span>` : v === false ? `<span class="mv-chip mv-no">${no}</span>` : `<span class="mv-chip mv-neutro">${t("sin dato", "no data")}</span>`;

// ---------------------------------------------------------------- correo (sonda en el VPS, por cola)
// El Worker no abre el puerto 25: la sonda vive en un servidor aparte que toma el pedido de
// una cola (lib/correo-envivo.mjs). Aquí sólo se pide y se espera. Sin respuesta en 95 s,
// el correo queda «no medido» con su causa; la medición del resto no lo espera para fallar.
async function pedirCorreo(dominio) {
  const r = await fetch("/api/sondas/correo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ dominio }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) return { estado: "error", causa: j.error || `el servicio respondió ${r.status}` };
  const hasta = Date.now() + 95000;
  while (Date.now() < hasta) {
    const g = await fetch(`/api/sondas/correo/${j.id}`).then((x) => x.json()).catch(() => null);
    if (g && (g.estado === "hecho" || g.estado === "sin_respuesta")) return { ...g, id: j.id, reusada: j.reusada };
    await espera(2000);
  }
  return { estado: "sin_respuesta", causa: "no llegó respuesta en 95 s" };
}
const SOPORTA_CORREO = (v) => v.estado === "medido" ? chip(v.soporta, t("ofrece el híbrido", "offers the hybrid"), t("no lo ofrece", "does not offer it"))
  : v.estado === "rechazado" ? t('<span class="mv-chip mv-neutro">nos rechazó: no medido</span>', '<span class="mv-chip mv-neutro">rejected us: not measured</span>')
  : v.estado === "sin_starttls" ? t('<span class="mv-chip mv-no">sin cifrado (no ofrece STARTTLS)</span>', '<span class="mv-chip mv-no">unencrypted (no STARTTLS offered)</span>')
  : t('<span class="mv-chip mv-neutro">no medido</span>', '<span class="mv-chip mv-neutro">not measured</span>');

// ---------------------------------------------------------------- consola
let t0 = 0, relojId = null;
const segundos = () => `+${num((performance.now() - t0) / 1000, 1)} s`;
function traza(html, clase = "") {
  const ol = $("mv-traza");
  const li = document.createElement("li");
  li.className = clase;
  li.innerHTML = `<span class="mv-t-t">${segundos()}</span><span>${html}</span>`;
  ol.appendChild(li);
  ol.scrollTop = ol.scrollHeight;
  return li;
}
const riel = (k, estado) => { const li = document.querySelector(`.mv-riel [data-paso="${k}"]`); if (li) li.dataset.estado = estado; };
function arrancarConsola() {
  $("mv-traza").innerHTML = "";
  document.querySelectorAll(".mv-riel li").forEach((li) => { li.dataset.estado = "espera"; });
  $("mv-ct-falla").hidden = true;
  t0 = performance.now();
  clearInterval(relojId);
  relojId = setInterval(() => { $("mv-reloj").textContent = `${num((performance.now() - t0) / 1000, 1)} s`; }, 100);
}
const pararReloj = () => { clearInterval(relojId); $("mv-reloj").textContent = `${num((performance.now() - t0) / 1000, 1)} s`; };

// ---------------------------------------------------------------- bandeja «Su historial»
const CLAVE = "rq-qex-fotos/1";
const leerBandeja = () => { try { const v = JSON.parse(localStorage.getItem(CLAVE) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } };
function guardarEnBandeja(foto) {
  const todas = leerBandeja().filter((f) => f.sha256 !== foto.sha256);
  todas.push(foto);
  try { localStorage.setItem(CLAVE, JSON.stringify(todas)); return true; } catch { return false; }
}
function quitarDeBandeja(sha) {
  try { localStorage.setItem(CLAVE, JSON.stringify(leerBandeja().filter((f) => f.sha256 !== sha))); } catch {}
  if (previa && previa.sha256 === sha) elegirPrevia(null);
  pintarBandeja();
}
// La serie del QEX de un dominio, de la más antigua a la más reciente, en la escala 0–100 del índice.
// Con una sola medición no hay línea que dibujar.
function linea(serie) {
  const v = serie.map((f) => f.qex?.score).filter(Number.isFinite).reverse();
  if (v.length < 2) return "";
  const x = (i) => (i / (v.length - 1)) * 100, y = (s) => 22 - (s / 100) * 20;
  const pts = v.map((s, i) => `${x(i).toFixed(1)},${y(s).toFixed(1)}`).join(" ");
  return `<svg class="mv-b-serie" viewBox="-2 0 104 24" preserveAspectRatio="none" role="img" aria-label="${t("QEX en el tiempo", "QEX over time")}: ${v.map((s) => num(s)).join(", ")}"><polyline points="${pts}"/></svg>`;
}
async function pintarBandeja() {
  const fotos = leerBandeja().sort((a, b) => a.dominio.localeCompare(b.dominio) || b.medido_utc.localeCompare(a.medido_utc));
  $("mv-b-vacia").hidden = fotos.length > 0;
  const integras = await Promise.all(fotos.map((f) => N.fotoIntegra(f)));
  let dom = null, html = "";
  fotos.forEach((f, i) => {
    if (f.dominio !== dom) {
      dom = f.dominio;
      const serie = fotos.filter((x) => x.dominio === dom);
      html += `<li class="mv-b-dom"><span class="mv-b-dom-n">${esc(dom)}</span><span>${serie.length} ${serie.length === 1 ? t("medición", "measurement") : t("mediciones", "measurements")}</span>${linea(serie)}</li>`;
    }
    // la anterior del mismo dominio es la siguiente en la lista (orden: más reciente primero)
    const ant = fotos[i + 1] && fotos[i + 1].dominio === f.dominio ? fotos[i + 1] : null;
    const d = ant && Number.isFinite(f.qex?.score) && Number.isFinite(ant.qex?.score) ? f.qex.score - ant.qex.score : null;
    const delta = d === null ? "" : `<span class="mv-b-delta${d > 0 ? " mv-b-mas" : d < 0 ? " mv-b-menos" : ""}" title="${t("frente a la medición anterior", "compared with the previous measurement")}">${d === 0 ? "=" : (d > 0 ? "+" : "−") + num(Math.abs(d))}</span>`;
    const hora = horaLocal(f.medido_utc);
    const activa = !!(previa && previa.sha256 === f.sha256);
    html += `<li class="mv-b-item${activa ? " mv-b-activa" : ""}">
      <button type="button" class="mv-b-elegir" data-sha="${esc(f.sha256)}" aria-pressed="${activa}">
        <span class="mv-b-fecha">${esc(fechaCorta(f.medido_utc))}${hora ? ` · <time datetime="${esc(f.medido_utc)}">${esc(hora)}</time>` : ""}</span>
        <span class="mv-b-qex"><small>QEX</small> <b>${esc(num(f.qex?.score))}</b></span>
        <span class="mv-b-sub">${activa ? t("comparando con esta", "comparing with this one") : integras[i] ? t("comparar con esta", "compare with this one") : t("huella alterada", "fingerprint altered")}</span>${delta}
      </button>
      <span class="mv-b-acc"><button type="button" class="mv-link" data-bajar="${esc(f.sha256)}">${t("descargar", "download")}</button>
      <button type="button" class="mv-link" data-quitar="${esc(f.sha256)}">${t("quitar", "remove")}</button></span></li>`;
  });
  $("mv-b-lista").innerHTML = html;
}
function elegirPrevia(f) {
  previa = f || null;
  const est = $("mv-previa-estado");
  $("mv-previa-quitar").hidden = !f;
  if (!f) { est.className = "mv-nota"; est.textContent = t("Sin foto anterior: se mide sin comparar. Elija una en «Su historial» para comparar.", "No previous snapshot: measuring without comparison. Pick one in “Your history” to compare."); pintarBandeja(); return; }
  N.fotoIntegra(f).then((ok) => {
    est.className = "mv-nota " + (ok ? "mv-ok" : "mv-mal");
    est.textContent = ok ? t(`Se comparará con la foto de ${edicionLarga(f)} (${fechaCorta(f.medido_utc)}) de ${f.dominio}.`, `Will compare with the ${edicionLarga(f)} snapshot (${fechaCorta(f.medido_utc)}) of ${f.dominio}.`)
      : t(`La foto de ${f.dominio} del ${fechaCorta(f.medido_utc)} cambió después de sellarse. Se comparará igual, y lo dirá.`, `The ${f.dominio} snapshot from ${fechaCorta(f.medido_utc)} changed after it was sealed. It will still be compared, and the comparison will say so.`);
  });
  $("mv-dominio").value = f.dominio;
  if (f.vertical && $("mv-sector").querySelector(`option[value="${CSS.escape(f.vertical)}"]`)) $("mv-sector").value = f.vertical;
  pintarBandeja();
}
function descargar(foto) {
  const blob = new Blob([JSON.stringify(foto, null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `foto-${foto.dominio}-${foto.medido_utc.slice(0, 16).replace(/[:T]/g, (c) => (c === "T" ? "_" : ""))}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
$("mv-b-lista").addEventListener("click", (e) => {
  const boton = e.target.closest("button"); if (!boton) return;
  const busca = (sha) => leerBandeja().find((f) => f.sha256 === sha);
  if (boton.dataset.sha) { const f = busca(boton.dataset.sha); elegirPrevia(previa && f && previa.sha256 === f.sha256 ? null : f); }
  else if (boton.dataset.bajar) { const f = busca(boton.dataset.bajar); if (f) descargar(f); }
  else if (boton.dataset.quitar) quitarDeBandeja(boton.dataset.quitar);
});
$("mv-previa-quitar").addEventListener("click", () => elegirPrevia(null));
$("mv-b-archivo").addEventListener("change", async (e) => {
  const est = $("mv-b-estado");
  for (const f of e.target.files) {
    try {
      const j = JSON.parse(await f.text());
      if (j.esquema !== N.ESQUEMA_FOTO) throw new Error(t("no es una foto de medición de Rosetta", "not a Rosetta measurement snapshot"));
      if (!guardarEnBandeja(j)) throw new Error(t("este navegador no permite guardarla", "this browser does not allow saving it"));
      est.className = "mv-nota mv-ok"; est.textContent = t(`Agregada: ${j.dominio}, ${fechaCorta(j.medido_utc)}.`, `Added: ${j.dominio}, ${fechaCorta(j.medido_utc)}.`);
      elegirPrevia(j);
    } catch (err) { est.className = "mv-nota mv-mal"; est.textContent = `${f.name}: ${EN && err instanceof SyntaxError ? "not a valid JSON file" : err.message}.`; }
  }
  e.target.value = "";
});

// ---------------------------------------------------------------- sector
(async () => {
  try { referencia = await (await fetch("/data/qex-referencia-2026-08.json")).json(); }
  catch { decir(t("No pudimos cargar la referencia por sector. Recargue la página.", "We could not load the sector reference. Please reload the page."), true); return; }
  $("mv-sector").innerHTML = Object.entries(referencia.verticales)
    .map(([k, v]) => `<option value="${esc(k)}"${k === "banca" ? " selected" : ""}>${esc(sectorNombre(k, v.nombre))}</option>`).join("");
  pintarBandeja();
  medirDesdeEnlace();
})();

// ?dominio=<d>&sector=<s> (12-nov-2026): el enlace `siguiente_paso.informe_dominio` que la API para
// agentes le da al humano. Prellena y mide sola. El dominio pasa por la MISMA normalización que lo
// escrito a mano y sólo entra como valor del campo (nunca como HTML); el sector sólo si es una de
// las opciones. Un parámetro inválido no mide nada. El límite por IP del servidor protege igual.
function medirDesdeEnlace() {
  const q = new URLSearchParams(location.search);
  const d = N.dominioDeEntrada(q.get("dominio"));
  if (!d) return;
  const sec = q.get("sector");
  if (sec && referencia.verticales[sec]) $("mv-sector").value = sec;
  $("mv-dominio").value = d;
  form.requestSubmit();
}

// ---------------------------------------------------------------- paso 1: CT
// El registro se pide a NUESTRO servidor (/api/ct, lib/ct-registro.mjs), que guarda una copia de
// 24 h por dominio, le da 25 s a crt.sh y, si no responde, pregunta a Cert Spotter. Antes el
// navegador esperaba a crt.sh hasta 120 s antes de medir nada más (medido el 11-nov: >60 s, 41 s,
// 13 s y 17 s para un mismo dominio): la página parecía rota. La respuesta declara su fuente.
async function consultarCT(dominio, aviso) {
  const tCT = performance.now();
  const ctl = new AbortController(); const reloj = setTimeout(() => ctl.abort(), CT_ESPERA_MS);
  try {
    const r = await fetch(`/api/ct?d=${encodeURIComponent(dominio)}`, { signal: ctl.signal });
    const j = await r.json().catch(() => ({}));
    for (const x of j.intentos || []) aviso(t(`${esc(x.fuente)} no respondió (${esc(x.error)}) · ${ms(x.ms)}`, `${esc(fuenteTxt(x.fuente))} did not respond (${esc(traz(x.error))}) · ${ms(x.ms)}`));
    if (!r.ok || !j.ok) throw new Error(j.error || `el servicio respondió ${r.status}`);
    guardarCT(dominio, j.texto);
    return await N.ctDesdeServidor(j, Math.round(performance.now() - tCT));
  } finally { clearTimeout(reloj); }
}
// Copia local de la última respuesta buena del registro, por dominio: sólo en este navegador, con
// su fecha y su huella. Si crt.sh no responde, se ofrece declarada como copia, nunca en silencio.
const CLAVE_CT = "rq-ct-copia/1";
function guardarCT(dominio, texto) {
  try { const m = JSON.parse(localStorage.getItem(CLAVE_CT) || "{}"); m[dominio] = { utc: new Date().toISOString(), texto }; localStorage.setItem(CLAVE_CT, JSON.stringify(m)); }
  catch { try { localStorage.setItem(CLAVE_CT, JSON.stringify({ [dominio]: { utc: new Date().toISOString(), texto } })); } catch {} }
}
const copiaCT = (dominio) => { try { return JSON.parse(localStorage.getItem(CLAVE_CT) || "{}")[dominio] || null; } catch { return null; } };

// Si crt.sh no responde (es un servicio público y lento), se puede usar la copia local o cargar una respuesta guardada.
function pedirCTGuardado(motivo, dominio) {
  return new Promise((resolve) => {
    const caja = $("mv-ct-falla");
    const copia = copiaCT(dominio);
    caja.innerHTML = `<p>${esc(motivo)}</p>${copia ? `<button class="mv-link" type="button" data-ctcopia>${t("Usar la respuesta del registro guardada en este navegador el", "Use the log response saved in this browser on")} ${esc(fechaUtc(copia.utc))}</button>` : ""}<label>${t("Cargar una respuesta guardada del registro (.json):", "Load a saved log response (.json):")} <input type="file" accept=".json,application/json" data-ctfile></label>
      <button class="mv-link" type="button" data-ctsin>${t("Seguir sin superficie", "Continue without the surface")}</button>`;
    caja.hidden = false;
    caja.querySelector("[data-ctfile]").addEventListener("change", async (e) => {
      const f = e.target.files[0]; if (!f) return; const texto = await f.text();
      caja.hidden = true;
      try { resolve({ filas: JSON.parse(texto), sha256: await N.sha256Hex(texto), ms: null, fuente: `archivo ${f.name}` }); }
      catch { traza(t("ese archivo no es una respuesta del registro", "that file is not a log response"), "mv-t-mal"); resolve(null); }
    });
    caja.querySelector("[data-ctsin]").addEventListener("click", () => { caja.hidden = true; resolve(null); });
    if (copia) caja.querySelector("[data-ctcopia]").addEventListener("click", async () => {
      caja.hidden = true;
      resolve({ filas: JSON.parse(copia.texto), sha256: await N.sha256Hex(copia.texto), ms: null, fuente: `crt.sh, copia guardada en este navegador`, consultado_utc: copia.utc });
    });
  });
}

// ---------------------------------------------------------------- medición
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const crudo = N.dominioDeEntrada($("mv-dominio").value.trim() || $("mv-dominio").placeholder);
  if (!crudo) { decir(t("Escriba un dominio, por ejemplo ejemplo.cl.", "Enter a domain, for example example.com."), true); $("mv-dominio").focus(); return; }
  if (!referencia) { decir(t("Falta la referencia por sector. Recargue la página.", "The sector reference is missing. Please reload the page."), true); return; }
  const dominio = crudo, www = "www." + dominio, vertical = $("mv-sector").value;
  const comparar = previa && previa.dominio === dominio ? previa : null;
  decir(previa && !comparar ? t(`La foto elegida es de ${previa.dominio}, no de ${dominio}: se mide sin comparar.`, `The selected snapshot is for ${previa.dominio}, not ${dominio}: measuring without comparison.`) : "", !!(previa && !comparar));
  $("mv-resultado").hidden = true; $("mv-comp").hidden = true;
  $("mv-ir").disabled = true; $("mv-ir").textContent = t("Midiendo…", "Measuring…");
  const terminar = () => { pararReloj(); $("mv-ir").disabled = false; $("mv-ir").innerHTML = t("Medir de nuevo", "Measure again") + ' <span class="mv-ir-flecha" aria-hidden="true">→</span>'; };
  arrancarConsola();
  const medido = new Date().toISOString();
  traza(t(`medición de <code>${esc(dominio)}</code> · sector ${esc(referencia.verticales[vertical]?.nombre || vertical)}${comparar ? ` · se comparará con la foto del ${esc(fechaCorta(comparar.medido_utc))}` : ""}`,
    `measuring <code>${esc(dominio)}</code> · sector ${esc(sectorNombre(vertical, referencia.verticales[vertical]?.nombre || vertical))}${comparar ? ` · will compare with the snapshot from ${esc(fechaCorta(comparar.medido_utc))}` : ""}`));

  // 1 · superficie
  riel("ct", "activo");
  const lineaCT = traza(t("consultando el registro público de certificados…", "querying the public certificate log…"));
  let ct = null;
  try { ct = await consultarCT(dominio, (t) => { traza(t, "mv-t-mal"); }); }
  catch (err) {
    traza(t(`el registro no respondió (${esc(err.name === "AbortError" ? `más de ${CT_ESPERA_MS / 1000} s` : err.message)})`,
      `the log did not respond (${esc(err.name === "AbortError" ? `more than ${CT_ESPERA_MS / 1000} s` : traz(err.message))})`), "mv-t-mal");
    ct = await pedirCTGuardado(t("El registro público de certificados no respondió. Puede usar una respuesta guardada o seguir sin superficie.", "The public certificate log did not respond. You can use a saved response or continue without the surface."), dominio);
    if (ct && ct.consultado_utc) traza(t(`se usa la copia del registro consultada el ${esc(fechaUtc(ct.consultado_utc))}: así queda escrito en la foto`, `using the copy of the log queried on ${esc(fechaUtc(ct.consultado_utc))}: the snapshot records it that way`), "mv-t-mal");
  }
  const mapa = ct ? N.nombresCT(ct.filas, dominio) : null;
  const hostsCT = mapa ? N.hostsCT(mapa, dominio) : [];
  if (ct) {
    const k = N.conteos([...mapa.keys()]);
    lineaCT.classList.add("mv-t-ok");
    traza(t(`${esc(ct.fuente)} · ${num(ct.filas.length)} certificados → <b>${num(k.hostnames)} nombres</b> · ${num(k.profundos)} de 3 niveles o más · ${num(k.no_productivo + k.infra_expuesta + k.legado)} sensibles · ${ms(ct.ms)}${ct.intentos > 1 ? ` · ${ct.intentos} intentos` : ""}`,
      `${esc(fuenteTxt(ct.fuente))} · ${num(ct.filas.length)} certificates → <b>${num(k.hostnames)} names</b> · ${num(k.profundos)} three or more levels deep · ${num(k.no_productivo + k.infra_expuesta + k.legado)} sensitive · ${ms(ct.ms)}${ct.intentos > 1 ? ` · ${ct.intentos} attempts` : ""}`), "mv-t-ok");
    riel("ct", "ok");
  } else { traza(t("sin superficie: la higiene se calcula sólo con TLS", "no surface: hygiene is computed from TLS only"), "mv-t-mal"); riel("ct", "mal"); }

  // 2-5 · una sola llamada al servidor
  // Además de los sensibles: los nombres que la foto anterior no tenía (así apareció
  // openfinance-desa en octubre). La regla vive en qex-nucleo.mjs: el servidor la usa igual.
  const { sensibles, nuevosCT, todos, pedidos } = N.nombresASondear(hostsCT, comparar);
  ["end", "borde", "cert", "prov"].forEach((k) => riel(k, "activo"));
  const correoP = pedirCorreo(dominio).catch((e) => ({ estado: "error", causa: String(e.message || e) }));
  traza(t(`DNS y saludos TLS desde nuestro servidor: ${pedidos.length} nombres (${sensibles.length} sensibles${nuevosCT.length ? `, ${nuevosCT.length} nuevos desde la foto anterior` : ""}), su borde, su certificado y su correo…`,
    `DNS and TLS handshakes from our server: ${pedidos.length} names (${sensibles.length} sensitive${nuevosCT.length ? `, ${nuevosCT.length} new since the previous snapshot` : ""}), your edge, your certificate and your email…`));
  let s;
  try {
    const r = await fetch("/api/sondas", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ dominio, www, sensibles: pedidos }) });
    s = await r.json().catch(() => ({}));
    if (!r.ok || !s.ok) throw new Error(s.error || `el servicio respondió ${r.status}`);
  } catch (err) {
    traza(t(`no pudimos medir: ${esc(err.message)}`, `we could not measure: ${esc(traz(err.message))}`), "mv-t-mal");
    ["end", "borde", "cert", "prov"].forEach((k) => riel(k, "mal"));
    terminar(); return;
  }

  const { foto, detalle: d } = N.armarFoto({ dominio, www, vertical, medido, ct, sondas: s, referencia,
    origen: t("Medición en vivo desde rosettaquantum.com/es/q-ready/medicion.", "Live measurement from rosettaquantum.com/q-ready/medicion.") });
  const pausa = () => espera(quieto ? 0 : 260);

  // endpoints, uno por línea
  for (const x of d.endpoints) {
    const crudoE = (s.endpoints || []).find((y) => y.host === x.host) || {};
    const cls = x.responde_443 === true && alerta(x) ? "mv-t-mal" : "mv-t-ok";
    traza(`<code>${esc(x.host)}</code> · DNS ${esc(x.dns_status || t("sin respuesta", "no response"))}${crudoE.cname?.length ? ` → ${esc(crudoE.cname[crudoE.cname.length - 1])}` : ""} · ${esc(EN ? N.estadoEndpointEn(x) : N.estadoEndpoint(x))}${x.responde_443 === true && crudoE.detalle ? ` (${esc(EN ? detalleEndpointEn(crudoE.detalle) : crudoE.detalle)})` : ""}`, cls);
    await pausa();
  }
  if (!d.endpoints.length) traza(ct ? t("ningún nombre sensible en su superficie", "no sensitive names in your surface") : t("sin superficie, no hay endpoints que medir", "no surface, so no endpoints to measure"));
  if (todos.length > pedidos.length) traza(t(`se midieron ${pedidos.length} de ${todos.length} endpoints sensibles (tope por medición)`, `measured ${pedidos.length} of ${todos.length} sensitive endpoints (per-measurement limit)`), "mv-t-mal");
  riel("end", "ok");

  const b = s.borde, v = b.veredicto;
  traza(`${t("DNS de", "DNS for")} <code>${esc(www)}</code> → ${esc((b.dns.cadena || []).join(" → ") || t("sin CNAME", "no CNAME"))} · <b>${esc(valorEn(b.dns.cdn) || t("CDN no identificado", "CDN not identified"))}</b>`, "mv-t-ok");
  for (const [k, sa] of Object.entries(b.saludos)) {
    traza(`${t("saludo", "handshake")} ${esc(SALUDOS[k]?.corto || k)} → ${sa.error ? `error: ${esc(traz(sa.error))}` : sa.alerta != null ? `${t("alerta TLS", "TLS alert")} ${esc(sa.alerta)}` : `<b>${esc(sa.grupo)}</b>${sa.hrr ? t(" (con un viaje extra)", " (with an extra round trip)") : ""}`} · ${ms(sa.ms)}`, sa.error ? "mv-t-mal" : "mv-t-ok");
    await pausa();
  }
  riel("borde", v.soporta == null ? "mal" : "ok");

  const c = s.certificado;
  traza(c.ok ? `${t("certificado de", "certificate for")} <code>${esc(c.host)}</code> · <b>${esc(c.algoritmo === "EC" ? "ECDSA" : c.algoritmo)} ${esc(c.curva || c.bits + " bits")}</b> · ${esc(c.emisor)} · ${t("vence", "expires")} ${esc(fechaCorta(c.not_after))} · ${ms(c.ms)}`
    : `${t("certificado no leído", "certificate not read")}: ${esc(traz(c.error))}`, c.ok ? "mv-t-ok" : "mv-t-mal");
  riel("cert", c.ok ? "ok" : "mal");
  await pausa();

  traza(t(`correo · ${num((s.correo.mx || []).length)} registros MX → <b>${esc(s.correo.proveedor || "sin proveedor identificado")}</b>`,
    `email · ${num((s.correo.mx || []).length)} MX records → <b>${esc(s.correo.proveedor || "no provider identified")}</b>`), "mv-t-ok");
  const sec = s.security_txt;
  traza(`${t("canal de reporte", "reporting channel")} · ${sec.publicado === true ? t("<b>security.txt publicado</b>", "<b>security.txt published</b>") : sec.publicado === false ? t("security.txt no publicado", "security.txt not published") : t("el sitio no dejó leer /.well-known/security.txt", "the site did not let us read /.well-known/security.txt")}${(sec.intentos || []).length ? ` (${sec.intentos.map((i) => `${esc(new URL(i.url).host)}: ${esc(i.status ?? t("sin respuesta", "no response"))}`).join(", ")})` : ""}`, sec.publicado === true ? "mv-t-ok" : "mv-t-mal");
  traza(t("cifrado del correo · esperando a la sonda de correo (corre en un servidor aparte)…", "email encryption · waiting for the email probe (it runs on a separate server)…"));
  const co = await correoP;
  s.correo_tls = co;
  if (co.estado === "hecho" && co.resultado?.servidores) {
    for (const m of co.resultado.servidores) {
      const v = m.veredicto, B = m.saludos.B_solo_hibrido;
      traza(`${t("correo", "email")} <code>${esc(m.mx)}</code> · ${v.estado === "medido" ? (v.soporta ? t("<b>ofrece X25519MLKEM768</b>", "<b>offers X25519MLKEM768</b>") : `${t("no ofrece el híbrido", "does not offer the hybrid")} (${esc(B.alerta || B.grupo || t("sin respuesta", "no response"))})`)
        : v.estado === "rechazado" ? t("nos rechazó en el saludo: no medido", "rejected our handshake: not measured") : v.estado === "sin_starttls" ? t("no ofrece STARTTLS", "does not offer STARTTLS") : t("no medido", "not measured")} · ${ms(B.ms)}`,
        v.estado === "medido" ? "mv-t-ok" : "mv-t-mal");
    }
    if (co.resultado.mx_omitidos) traza(t(`se midieron ${co.resultado.mx_medidos} de ${co.resultado.mx_publicados.length} servidores de correo (tope por medición)`, `measured ${co.resultado.mx_medidos} of ${co.resultado.mx_publicados.length} mail servers (per-measurement limit)`), "mv-t-mal");
    if (co.resultado.error) traza(`${t("correo", "email")}: ${esc(traz(co.resultado.error))}`, "mv-t-mal");
  } else traza(`${t("cifrado del correo no medido", "email encryption not measured")}: ${esc(traz(co.causa || co.error || co.estado))}`, "mv-t-mal");
  riel("prov", "ok");

  // QEX y la foto sellada
  fotoHoy = await N.sellarFoto(foto);
  const q = d.q;
  traza(t(`<b>QEX ${num(q.score)}</b> · suma ${num(q.suma, 2)} · foto sellada ${esc(fotoHoy.sha256.slice(0, 12))}… · ${segundos().slice(1)} en total`,
    `<b>QEX ${num(q.score)}</b> · sum ${num(q.suma, 2)} · snapshot sealed ${esc(fotoHoy.sha256.slice(0, 12))}… · ${segundos().slice(1)} in total`), "mv-t-fin");
  pararReloj();

  pintarResultado({ d, s, ct, mapa, hostsCT, dominio, www, nuevosCT });
  // La nota Q-Ready: la MISMA función que usan el servidor, el cron y el sello (qex-nucleo.mjs).
  const nota = N.explicarNota(fotoHoy);
  pintarNota(nota);
  // La lectura en cuatro pasos (canales, cápsula, Shor) la pinta /js/medicion-historia.mjs con el mismo dato.
  window.dispatchEvent(new CustomEvent("mv:medido", { detail: { d, s, dominio, www, foto: fotoHoy, nota } }));
  if (comparar) mostrarComparacion(comparar, fotoHoy);
  $("mv-cuando").textContent = fechaUtc(medido);
  $("mv-huella").textContent = fotoHoy.sha256;
  $("mv-integra").innerHTML = t('<span class="mv-chip mv-si">íntegra</span> recalculada en este navegador', '<span class="mv-chip mv-si">intact</span> recomputed in this browser');
  $("mv-guardada").textContent = guardarEnBandeja(fotoHoy) ? t("Quedó guardada en «Su historial», en este navegador.", "Saved to “Your history”, in this browser.")
    : t("Este navegador no dejó guardarla en «Su historial»: descárguela para no perderla.", "This browser did not let us save it to “Your history”: download it so you do not lose it.");
  pintarBandeja();
  terminar();
  $("mv-resultado").hidden = false;
  $("mv-acto1").scrollIntoView({ behavior: quieto ? "auto" : "smooth", block: "start" });
});

// ---------------------------------------------------------------- la nota Q-Ready (13-nov-2026)
// La letra sale de N.explicarNota(foto); el texto, de qready-textos.mjs (provisorio, ES/EN).
// Aquí no hay regla: sólo se pinta. scripts/check-qready-nota.mjs grita si la página calcula su propia letra.
function pintarNota(x) {
  const T = textos(IDIOMA);
  const caja = $("mv-letra-caja"), lee = $("mv-letra-lee");
  if (!caja || !lee) return;
  caja.dataset.nota = x.nota || "";
  $("mv-letra").textContent = x.nota || "—";
  $("mv-letra-t").textContent = x.nota ? T.nota_titulo : T.nota_sin;
  const partes = [`<p>${esc(x.nota ? T.nota_lectura[x.nota] : (T.nota_sin_motivo[x.motivo] || T.nota_sin))}</p>`];
  const alertas = [...x.graves, ...x.altas, ...x.medias].map((a) => `${esc(T.alerta[a.codigo] || a.codigo)}${a.host ? ` · <code>${esc(a.host)}</code>` : ""}`);
  if (alertas.length) partes.push(`<ul>${alertas.map((a) => `<li>${a}</li>`).join("")}</ul>`);
  if (x.falta_para_A.length) partes.push(`<p><b>${esc(T.falta_titulo)}</b></p><ul>${x.falta_para_A.map((f) => `<li>${esc(T.falta[f.codigo] ? T.falta[f.codigo](f) : f.codigo)}</li>`).join("")}</ul>`);
  partes.push(`<p class="mv-meta">${esc(T.nota_escala)} · ${esc(x.version)}</p>`);
  lee.innerHTML = partes.join("");
  lee.hidden = false;
}

// ---------------------------------------------------------------- resultado
const SALUDOS_ES = {
  A_como_navegador: { corto: "A · llave clásica", ofrece: "Ofrece el híbrido, pero envía sólo la llave clásica.", lee: (sa) => sa.grupo === "X25519MLKEM768" ? "Pide el híbrido aun teniendo la clásica a mano." : "Acepta la llave clásica para ahorrarse un viaje: es lo correcto en TLS, no falta de soporte. Un navegador actual envía las dos llaves." },
  B_solo_hibrido: { corto: "B · sólo el híbrido", ofrece: "Ofrece únicamente X25519MLKEM768.", lee: (sa) => sa.grupo === "X25519MLKEM768" ? "Lo acepta: su borde soporta el intercambio post-cuántico." : "No lo acepta." },
  C_eleccion_libre: { corto: "C · elección libre", ofrece: "Ofrece todos los grupos sin enviar llave: el servidor elige.", lee: (sa) => sa.grupo === "X25519MLKEM768" ? "Elige el híbrido cuando puede elegir." : `Elige ${sa.grupo || "otro grupo"}.` },
};
const SALUDOS = EN ? {
  A_como_navegador: { corto: "A · classical key", ofrece: "Offers the hybrid, but sends only the classical key share.", lee: (sa) => sa.grupo === "X25519MLKEM768" ? "Asks for the hybrid even with the classical key at hand." : "Accepts the classical key to save a round trip: correct TLS behavior, not a lack of support. A current browser sends both key shares." },
  B_solo_hibrido: { corto: "B · hybrid only", ofrece: "Offers only X25519MLKEM768.", lee: (sa) => sa.grupo === "X25519MLKEM768" ? "Accepts it: your edge supports the post-quantum key exchange." : "Does not accept it." },
  C_eleccion_libre: { corto: "C · free choice", ofrece: "Offers every group without sending a key share: the server chooses.", lee: (sa) => sa.grupo === "X25519MLKEM768" ? "Chooses the hybrid when free to choose." : `Chooses ${sa.grupo || "another group"}.` },
} : SALUDOS_ES;
// Señal de lectura, NO regla del índice: nombres que en Chile suelen ser ambientes de prueba y que
// los patrones de agosto no cuentan (así pasó openfinance-desa). No cambia el puntaje; se marca.
const PRUEBA_LOCAL = /(^|[.-])(desa|desarrollo|qa|uat|stg|staging|homolog|hml|sandbox)(\d*)([.-]|$)/;
const alerta = (x) => x.clases.length > 0 || PRUEBA_LOCAL.test(x.host);
const CLASE = EN ? { critico: "Critical service", infra_expuesta: "Sensitive infrastructure", no_productivo: "Non-production environment", legado: "Legacy" }
  : { critico: "Servicio crítico", infra_expuesta: "Infraestructura sensible", no_productivo: "Ambiente no productivo", legado: "Legado" };
const DIM_CLASE = { certificados: "mv-d-certificados", higiene: "mv-d-higiene", hndl: "mv-d-hndl", edge: "mv-d-edge" };

function pintarResultado({ d, s, ct, mapa, hostsCT, dominio, www, nuevosCT = [] }) {
  const nuevosVistos = new Set(nuevosCT);
  const { dim, q, tipos, ref, cuentas } = d;
  const b = s.borde, v = b.veredicto, c = s.certificado;

  // ---- QEX: la barra es la suma
  $("mv-qex-meta").textContent = `${dominio} · ${fechaUtc(new Date().toISOString())}`;
  $("mv-score").textContent = q.score == null ? "—" : num(q.score);
  const refNombre = sectorNombre($("mv-sector").value, ref.nombre);
  $("mv-ref").textContent = t(`Mediana de ${ref.nombre.toLowerCase()}: ${num(ref.mediana)} (${ref.n} organizaciones). Mediana del país: ${num(referencia.mediana_pais)}. Referencia: edición de agosto de 2026.`,
    `${refNombre} median: ${num(ref.mediana)} (${ref.n} organizations). Chile median: ${num(referencia.mediana_pais)}. Reference: August 2026 edition.`);
  // Cada tramo mide su aporte en puntos del índice. Si faltó una dimensión, el índice se
  // renormaliza: los tramos se escalan por el mismo factor, para que la barra siga siendo la suma.
  const factor = q.peso_usado > 0 ? 1 / q.peso_usado : 1;
  const ancho = (k) => dim[k] == null ? 0 : Math.min(q.aportes[k] * factor, N.TOPE);
  $("mv-tramos").innerHTML = Object.keys(N.PESOS).map((k, i) => dim[k] == null ? ""
    : `<div class="mv-tramo ${DIM_CLASE[k]}" style="width:${ancho(k)}%;animation-delay:${i * 120}ms" title="${esc(etiquetaDim(k))}: ${num(q.aportes[k] * factor, 1)} ${t("puntos", "points")}"></div>`).join("");
  $("mv-techo").style.width = `${100 - N.TOPE}%`;
  $("mv-eje-tope").style.left = `${N.TOPE}%`;
  const marca = (x, txt, cls = "") => `<div class="mv-marca ${cls}${x > 50 ? " mv-marca-izq" : ""}" style="left:${x}%"><span>${txt}</span></div>`;
  const medianas = ref.mediana === referencia.mediana_pais ? [marca(ref.mediana, `${t("mediana", "median")} ${num(ref.mediana)}`)]
    : [marca(referencia.mediana_pais, `${t("país", "Chile")} · ${num(referencia.mediana_pais)}`), marca(ref.mediana, `${t(ref.nombre.toLowerCase(), refNombre.toLowerCase())} · ${num(ref.mediana)}`)];
  $("mv-marcas").innerHTML = medianas.join("");
  $("mv-escala-desc").textContent = t(`Barra de 0 a 100: su QEX ${num(q.score)} como suma de cuatro tramos; mediana del país ${num(referencia.mediana_pais)}; zona de ${N.TOPE} a 100 no observable desde afuera.`,
    `Bar from 0 to 100: your QEX ${num(q.score)} as the sum of four segments; Chile median ${num(referencia.mediana_pais)}; the zone from ${N.TOPE} to 100 is not observable from outside.`);
  const terminos = Object.keys(N.PESOS).filter((k) => dim[k] != null);
  $("mv-formula").innerHTML = `${terminos.map((k) => `${num(dim[k])} × ${num(N.PESOS[k], 2)}`).join(" + ")} = ${terminos.map((k) => num(q.aportes[k], 2)).join(" + ")} = <b>${num(q.suma, 2)}</b> → <b>${num(q.score)}</b>`
    + t(`<span class="mv-f-nota">${q.peso_usado < 1 ? `Faltó medir una dimensión: se renormaliza sobre ${num(q.peso_usado, 2)} del peso. ` : ""}Se redondea al entero par más cercano en caso de empate, igual que en todas las ediciones. Tope: ${N.TOPE}, porque lo que no se ve desde afuera —el tramo del borde a su origen, sus HSM, la criptografía interna— nunca puede darse por resuelto midiendo desde afuera.</span>`,
      `<span class="mv-f-nota">${q.peso_usado < 1 ? `One dimension could not be measured: the index is renormalized over ${num(q.peso_usado, 2)} of the weight. ` : ""}Ties round to the nearest even integer, as in every edition. Cap: ${N.TOPE}, because what cannot be seen from outside (the leg from your edge to your origin, your HSMs, internal cryptography) can never be declared solved by measuring from outside.</span>`);
  const como = EN ? {
    certificados: c.ok ? `${c.algoritmo === "EC" ? "ECDSA" : c.algoritmo} ${c.curva || c.bits}. The final version of NIST IR 8547 (Oct 2026) deprecates ECDSA and RSA after 2030.` : "We could not read the certificate.",
    higiene: cuentas ? `Base 70${cuentas.no_productivo > 0 ? " − 10 for non-production environments" : ""}${cuentas.infra_expuesta >= 3 ? " − 10 for sensitive infrastructure" : ""}${cuentas.legado > 0 ? " − 10 for legacy" : ""}${d.tls13 === false ? " − 30 without TLS 1.3" : ""}.` : "No surface: TLS only.",
    hndl: `${refNombre} model: the same for the whole sector, not measured.`,
    edge: v.soporta === true ? (v.elige ? "Supports and chooses the hybrid key exchange." : "Supports the hybrid, but does not choose it.") : v.soporta === false ? "Does not accept the hybrid key exchange." : "No verdict.",
  } : {
    certificados: c.ok ? `${c.algoritmo === "EC" ? "ECDSA" : c.algoritmo} ${c.curva || c.bits}. La versión final de NIST IR 8547 (oct-2026) depreca ECDSA y RSA después de 2030.` : "No pudimos leer el certificado.",
    higiene: cuentas ? `Base 70${cuentas.no_productivo > 0 ? " − 10 por ambiente no productivo" : ""}${cuentas.infra_expuesta >= 3 ? " − 10 por infraestructura sensible" : ""}${cuentas.legado > 0 ? " − 10 por legado" : ""}${d.tls13 === false ? " − 30 sin TLS 1.3" : ""}.` : "Sin superficie: sólo TLS.",
    hndl: `Modelo de ${ref.nombre.toLowerCase()}: igual para todo el sector, no se mide.`,
    edge: v.soporta === true ? (v.elige ? "Soporta y elige el intercambio híbrido." : "Soporta el híbrido, pero no lo elige.") : v.soporta === false ? "No acepta el intercambio híbrido." : "Sin veredicto.",
  };
  const pais = referencia.mediana_pais_dimension || {};
  $("mv-dims").innerHTML = Object.keys(N.PESOS).map((k) => `<div class="mv-dim">
      <span class="mv-dim-cab"><i class="${DIM_CLASE[k]}"></i>${esc(etiquetaDim(k))}</span>
      <span class="mv-dim-v">${num(dim[k])}<small>${pais[k] != null ? `${t("país", "Chile")} ${num(pais[k])}` : ""}</small></span>
      <span>${tipos[k].startsWith("modelo") ? `<span class="mv-chip mv-modelo">${t("modelo", "model")}</span>` : `<span class="mv-chip mv-si">${t("medido", "measured")}</span>`}</span>
      <span class="mv-dim-como">${esc(como[k])}</span>
      <span class="mv-dim-pie">${t("peso", "weight")} ${num(N.PESOS[k] * 100)} % · ${t("aporta", "contributes")} ${dim[k] == null ? "—" : num(q.aportes[k], 2)}</span>
    </div>`).join("");

  // ---- superficie: un cuadro por nombre
  if (mapa) {
    const k = N.conteos([...mapa.keys()]);
    const vivos = new Set(d.endpoints.filter((x) => x.responde_443 === true).map((x) => x.host));
    const clase = (h) => ["legado", "infra_expuesta", "no_productivo", "critico"].find((c) => h.clases.includes(c)) || (h.profundo ? "profundo" : "");
    const orden = { legado: 0, infra_expuesta: 1, no_productivo: 2, critico: 3, profundo: 4, "": 5 };
    const lista = [...hostsCT].sort((a, b) => orden[clase(a)] - orden[clase(b)] || a.host.localeCompare(b.host));
    $("mv-mapa").innerHTML = lista.map((h, i) => `<i class="mv-k-${clase(h) || "otro"}${vivos.has(h.host) ? " mv-vivo" : ""}" title="${esc(h.host)}" style="animation-delay:${quieto ? 0 : Math.min(i * 3, 600)}ms"></i>`).join("");
    $("mv-sup-meta").textContent = t(`registro público · ${num(ct.filas.length)} certificados`, `public log · ${num(ct.filas.length)} certificates`);
    $("mv-sup-lede").textContent = t(`${num(k.hostnames)} nombres de host que su dominio ha certificado. Cada cuadro es uno; pase el cursor para ver su nombre. ${vivos.size ? `Los cuadros con borde responden hoy en el puerto 443.` : ""}`,
      `${num(k.hostnames)} hostnames your domain has certified. Each square is one; hover to see its name. ${vivos.size ? `Squares with a border respond on port 443 today.` : ""}`);
    const fila = (cls, txt, n) => `<li><i class="mv-k-${cls}"></i><span>${txt}</span><b>${num(n)}</b></li>`;
    $("mv-leyenda").innerHTML = fila("infra_expuesta", CLASE.infra_expuesta, k.infra_expuesta) + fila("no_productivo", CLASE.no_productivo, k.no_productivo)
      + fila("legado", CLASE.legado, k.legado) + fila("critico", CLASE.critico, k.critico) + fila("profundo", t("3 niveles o más, sin otra clase", "Three or more levels, no other class"), lista.filter((h) => clase(h) === "profundo").length)
      + fila("otro", t("Otros nombres", "Other names"), lista.filter((h) => !clase(h)).length)
      + t(`<li><span class="mv-ley-nota">Mismas reglas de clasificación que todas nuestras ediciones. La búsqueda es por sufijo de texto, como en el índice: puede incluir dominios vecinos que terminan igual.</span></li>`,
        `<li><span class="mv-ley-nota">The same classification rules as every edition of the index. The search matches a text suffix, as in the index: it may include neighboring domains that end the same way.</span></li>`);
  } else {
    $("mv-mapa").innerHTML = ""; $("mv-leyenda").innerHTML = "";
    $("mv-sup-meta").textContent = t("sin registro", "no log");
    $("mv-sup-lede").textContent = t("Esta medición no incluye el registro público de certificados.", "This measurement does not include the public certificate log.");
  }
  $("mv-endp").innerHTML = d.endpoints.length ? d.endpoints.map((x) => {
    const crudoE = (s.endpoints || []).find((y) => y.host === x.host) || {};
    const dns = x.dns_status === "NXDOMAIN" ? `<span class="mv-chip mv-si">${t("no publicado", "not published")}</span>` : x.dns_status === "NOERROR" ? `<span class="mv-chip mv-neutro">${t("publicado", "published")}</span>` : `<span class="mv-chip mv-neutro">${esc(x.dns_status || t("sin dato", "no data"))}</span>`;
    const p443 = x.dns_status === "NXDOMAIN" ? '<span class="mv-neutro">—</span>' : x.responde_443 === true ? `<span class="mv-chip ${alerta(x) ? "mv-no" : "mv-neutro"}">${t("responde", "responds")}</span>` : x.responde_443 === false ? `<span class="mv-chip mv-si">${N.esNombreDeCorreo(x.host) ? t("sin servicio web", "no web service") : t("no responde", "no response")}</span>` : `<span class="mv-chip mv-neutro">${t("sin dato", "no data")}</span>`;
    const detalleE = x.responde_443 === false && N.esNombreDeCorreo(x.host) ? N.detalleCorreoSinWeb(crudoE.detalle) : crudoE.detalle || "";
    return `<tr><td><code>${esc(x.host)}</code></td><td>${esc(x.clases.length ? x.clases.map((c) => CLASE[c] || c).join(", ") : PRUEBA_LOCAL.test(x.host) ? t("Posible ambiente de prueba por su nombre (fuera de la regla del índice)", "Possible test environment, judging by its name (outside the index rule)") : nuevosVistos.has(x.host) ? t("Nuevo desde la foto anterior", "New since the previous snapshot") : t("Sin clase", "No class"))}</td><td>${dns}</td><td>${p443}</td>
      <td class="mv-neutro">${esc([crudoE.cname?.length ? `CNAME ${crudoE.cname[crudoE.cname.length - 1]}` : "", EN ? detalleEndpointEn(detalleE) : detalleE].filter(Boolean).join(" · ") || "—")}</td></tr>`;
  }).join("") : `<tr><td colspan="5" class="mv-neutro">${ct ? t("Ningún nombre sensible en su superficie.", "No sensitive names in your surface.") : t("Sin superficie, no hay endpoints que medir.", "No surface, so no endpoints to measure.")}</td></tr>`;

  // ---- borde: dos tramos y los tres saludos
  $("mv-borde-meta").textContent = `${www} · ${valorEn(b.dns.cdn) || t("CDN no identificado", "CDN not identified")}`;
  const enlace1 = v.soporta === true ? ["", v.elige ? t("X25519MLKEM768 · medido", "X25519MLKEM768 · measured") : t("híbrido soportado · medido", "hybrid supported · measured")] : v.soporta === false ? ["mv-enlace-mal", t("sólo clásico · medido", "classical only · measured")] : ["mv-enlace-no", t("sin veredicto", "no verdict")];
  $("mv-dos-tramos").innerHTML = `<div class="mv-nodo"><b>${t("Su cliente", "Your client")}</b><span>${t("navegador o app", "browser or app")}</span></div>
    <div class="mv-enlace ${enlace1[0]}"><span>${esc(enlace1[1])}</span></div>
    <div class="mv-nodo"><b>${t("Su borde", "Your edge")}</b><span>${esc(valorEn(b.dns.cdn) || www)}</span></div>
    <div class="mv-enlace mv-enlace-no"><span>${t("no observable desde afuera", "not observable from outside")}</span></div>
    <div class="mv-nodo mv-nodo-niebla"><b>${t("Su origen", "Your origin")}</b><span>${t("servidores propios", "your own servers")}</span></div>`;
  $("mv-saludos").innerHTML = Object.entries(b.saludos).map(([k, sa]) => {
    const S = SALUDOS[k] || { corto: k, ofrece: "", lee: () => "" };
    const res = sa.error ? `<span class="mv-chip mv-neutro">${t("sin respuesta", "no response")}</span><span class="mv-sub">${esc(enPalabras(sa.error, IDIOMA))}</span>`
      : sa.alerta != null ? `<span class="mv-chip mv-no">${t("alerta", "alert")} ${esc(sa.alerta)}</span>`
      : `<span class="mv-chip ${sa.grupo === "X25519MLKEM768" ? "mv-si" : "mv-neutro"}">${esc(sa.grupo)}</span>${sa.hrr ? `<span class="mv-sub">${t("con un viaje extra (HelloRetryRequest)", "with an extra round trip (HelloRetryRequest)")}</span>` : ""}<span class="mv-sub">${esc(S.lee(sa))}</span>`;
    return `<tr><th scope="row">${esc(S.corto)}</th><td>${esc(S.ofrece)}</td><td>${res}</td><td class="num">${esc(sa.ms ?? "—")}</td></tr>`;
  }).join("");
  $("mv-borde-lectura").textContent = t("El soporte se decide con el saludo B y la preferencia con el C. El tramo de su borde a su origen es otra conexión: no la vemos, y no la puede ver nadie desde fuera de su organización. Pregúntele a su proveedor si la tiene habilitada.",
    "Support is decided by handshake B and preference by handshake C. The leg from your edge to your origin is a separate connection: we do not see it, and no one outside your organization can. Ask your provider whether it is enabled there.");

  // ---- certificado y correo
  const fila = (dt, dd) => `<div><dt>${dt}</dt><dd>${dd}</dd></div>`;
  $("mv-cert").innerHTML = c.ok
    ? fila(t("Algoritmo", "Algorithm"), `<b>${esc(c.algoritmo === "EC" ? "ECDSA" : c.algoritmo)} ${esc(c.curva || c.bits + " bits")}</b>`) + fila(t("Firma", "Signature"), `<code>${esc(c.firma || "—")}</code>`)
      + fila(t("Emisor", "Issuer"), esc(c.emisor)) + fila(t("Sujeto", "Subject"), `<code>${esc(c.sujeto || "—")}</code>`)
      + fila(t("Vigencia", "Validity"), `${esc(fechaCorta(c.not_before))} → <b>${esc(fechaCorta(c.not_after))}</b>`)
      + fila(t("Lectura", "Reading"), t("La versión final de NIST IR 8547 (octubre de 2026) depreca ECDSA y RSA después de 2030 y los prohíbe después de 2035, con cualquier curva o tamaño.", "The final version of NIST IR 8547 (October 2026) deprecates ECDSA and RSA after 2030 and disallows them after 2035, at any curve or key size."))
    : fila(t("Estado", "Status"), t(`No pudimos leer el certificado: ${esc(enPalabras(c.error))}. Vuelva a medir en unos minutos.`, `We could not read the certificate: ${esc(enPalabras(c.error, "en"))}. Please measure again in a few minutes.`));
  const sec = s.security_txt;
  $("mv-prov").innerHTML = fila(t("Correo", "Email"), `<b>${esc(s.correo.proveedor || t("sin proveedor identificado", "no provider identified"))}</b>`)
    + fila("MX", (s.correo.mx || []).length ? (s.correo.mx || []).map((m) => `<code>${esc(m)}</code>`).join("<br>") : t("sin registros MX", "no MX records"))
    + (s.correo_tls?.estado === "hecho" && s.correo_tls.resultado?.servidores?.length
      ? fila(t("Cifrado post-cuántico", "Post-quantum encryption"), s.correo_tls.resultado.servidores.map((m) => `<code>${esc(m.mx)}</code> ${SOPORTA_CORREO(m.veredicto)}`).join("<br>")
        + t(`<br><span class="mv-nota">Medido desde ${esc(s.correo_tls.resultado.desde_ip || "nuestro servidor de medición")}, ${esc(fechaUtc(s.correo_tls.resultado.medido_utc))}. Informativo: no entra al índice ni a la foto.</span>`,
          `<br><span class="mv-nota">Measured from ${esc(s.correo_tls.resultado.desde_ip || "our measurement server")}, ${esc(fechaUtc(s.correo_tls.resultado.medido_utc))}. For information only: it does not enter the index or the snapshot.</span>`))
      : fila(t("Cifrado post-cuántico", "Post-quantum encryption"), `<span class="mv-chip mv-neutro">${t("no medido", "not measured")}</span> ${esc(enPalabras(s.correo_tls?.causa, IDIOMA))}`))
    + fila(t("Canal de reporte", "Reporting channel"), `${chip(sec.publicado, t("publicado", "published"), t("no publicado", "not published"))}${sec.publicado == null ? t(" el sitio no dejó leer la ruta estándar", " the site did not let us read the standard path") : ""}`)
    + ((sec.intentos || []).length ? fila(t("Rutas probadas", "Paths tried"), sec.intentos.map((i) => `<code>${esc(i.url)}</code> → ${esc(i.status ?? t("sin respuesta", "no response"))}`).join("<br>")) : "");
}

// ---------------------------------------------------------------- comparación
const ESTADO = EN ? { cambio: ["changed", "mv-c-cambio"], se_mantiene: ["unchanged", "mv-c-igual"], medido_hoy: ["measured today", "mv-c-nuevo"], sin_dato: ["no data today", "mv-c-sin"] }
  : { cambio: ["cambió", "mv-c-cambio"], se_mantiene: ["se mantiene", "mv-c-igual"], medido_hoy: ["medido hoy", "mv-c-nuevo"], sin_dato: ["sin dato hoy", "mv-c-sin"] };
const GRUPOS = EN ? { qex: "Index", superficie: "Public surface", borde: "Edge", certificado: "Certificate", proveedores: "Providers" }
  : { qex: "Índice", superficie: "Superficie pública", borde: "Borde", certificado: "Certificado", proveedores: "Proveedores" };
const celda = (x) => x == null ? `<span class="mv-neutro">${t("no medido", "not measured")}</span>`
  : typeof x === "number" ? esc(num(x)) : /^\d{4}-\d{2}-\d{2}/.test(x) ? esc(fechaCorta(x)) : esc(valorEn(x));
function mostrarComparacion(antes, ahora) {
  const c = N.comparar(antes, ahora);
  $("mv-comp-t").textContent = `${capital(edicionLarga(antes))} → ${t("hoy", "today")}`;
  $("mv-comp-meta").textContent = `${t("foto", "snapshot")} ${antes.sha256.slice(0, 12)}… → ${ahora.sha256.slice(0, 12)}…`;
  $("mv-col-antes").textContent = `${t("Qué había", "What there was")} · ${fechaCorta(antes.medido_utc)}`;
  $("mv-col-ahora").textContent = `${t("Qué hay", "What there is")} · ${fechaCorta(ahora.medido_utc)}`;
  const r = c.resumen;
  $("mv-comp-resumen").innerHTML = (EN ? [[r.cambio, "changed"], [r.se_mantiene, "unchanged"], [r.medido_hoy, "measured today for the first time"], [r.sin_dato, "no data today"]]
    : [[r.cambio, r.cambio === 1 ? "cambió" : "cambiaron"], [r.se_mantiene, r.se_mantiene === 1 ? "se mantiene" : "se mantienen"],
    [r.medido_hoy, "medidos hoy por primera vez"], [r.sin_dato, "sin dato hoy"]]).map(([n, t]) => `<li><b>${num(n)}</b>${t}</li>`).join("");
  let html = "", grupo = null;
  for (const it of c.items) {
    if (it.grupo !== grupo) { grupo = it.grupo; html += `<tr class="mv-grupo"><th colspan="4" scope="rowgroup">${esc(GRUPOS[grupo])}</th></tr>`; }
    html += `<tr><th scope="row">${esc(EN ? N.ETIQUETA_ITEM_EN[it.k] || it.etiqueta : it.etiqueta)}</th><td>${celda(it.antes)}</td><td>${celda(it.ahora)}</td><td><span class="mv-chip ${ESTADO[it.estado][1]}">${ESTADO[it.estado][0]}</span></td></tr>`;
  }
  if (c.endpoints.length) {
    html += `<tr class="mv-grupo"><th colspan="4" scope="rowgroup">${t("Endpoints sensibles", "Sensitive endpoints")}</th></tr>`;
    for (const e of c.endpoints) html += `<tr><th scope="row"><code>${esc(e.host)}</code></th><td>${celda(e.antes)}</td><td>${celda(e.ahora)}</td><td><span class="mv-chip ${ESTADO[e.estado][1]}">${ESTADO[e.estado][0]}</span></td></tr>`;
  }
  $("mv-delta").innerHTML = html;
  const h = c.hosts;
  const lista = (xs) => `<ul>${xs.map((x) => `<li><code>${esc(x)}</code></li>`).join("")}</ul>`;
  $("mv-hosts").innerHTML = h.nuevos == null ? t('<p class="mv-nota">Una de las dos fotos no trae la lista de nombres: no se comparan uno por uno.</p>', '<p class="mv-nota">One of the two snapshots does not include the list of names: they are not compared one by one.</p>')
    : t(`<p><b>${num(h.siguen)}</b> nombres siguen en el registro, <b>${num(h.nuevos.length)}</b> son nuevos y <b>${num(h.retirados.length)}</b> ya no aparecen.</p>`,
      `<p><b>${num(h.siguen)}</b> names remain in the log, <b>${num(h.nuevos.length)}</b> are new and <b>${num(h.retirados.length)}</b> no longer appear.</p>`)
      + (h.nuevos.length ? `<details open><summary>${t("Nombres nuevos", "New names")} (${h.nuevos.length})</summary>${lista(h.nuevos)}</details>` : "")
      + (h.retirados.length ? `<details><summary>${t("Nombres que ya no aparecen", "Names that no longer appear")} (${h.retirados.length})</summary>${lista(h.retirados)}</details>` : "");
  $("mv-comp").hidden = false;
}

$("mv-guardar").addEventListener("click", () => { if (fotoHoy) descargar(fotoHoy); });
$("mv-imprimir").addEventListener("click", () => window.print());
$("mv-verificar").addEventListener("click", async () => {
  if (!fotoHoy) return;
  const ok = await N.fotoIntegra(fotoHoy);
  $("mv-integra").innerHTML = ok ? t(`<span class="mv-chip mv-si">íntegra</span> recalculada ahora: ${esc(fotoHoy.sha256.slice(0, 16))}…`, `<span class="mv-chip mv-si">intact</span> recomputed now: ${esc(fotoHoy.sha256.slice(0, 16))}…`)
    : t('<span class="mv-chip mv-no">alterada</span> la huella no coincide con el contenido', '<span class="mv-chip mv-no">altered</span> the fingerprint does not match the content');
});
