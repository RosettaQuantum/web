/*
 * /es/q-ready/medicion — el informe QEX en vivo (30-oct-2026).
 * El navegador consulta el registro público de certificados (crt.sh admite CORS); el servidor
 * hace sólo los saludos TLS y las consultas sin CORS (/api/sondas). La foto se arma con
 * armarFoto() de qex-nucleo.mjs, la misma función que alimenta el PDF.
 *
 * La bandeja «Sus fotos» vive SÓLO en este navegador (localStorage): ninguna foto viaja a un
 * servidor. Es una comodidad del que mide, no un archivo: si el navegador la borra, la foto
 * descargada sigue siendo la copia que vale.
 * Todo lo que viene de afuera (nombres de CT, respuestas de servidores, fotos cargadas) se escapa.
 */
import * as N from "./qex-nucleo.mjs";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (x, d = 0) => x == null ? "—" : Number(x).toLocaleString("es-CL", { minimumFractionDigits: d, maximumFractionDigits: d });
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MESES_L = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const fechaUtc = (iso) => { const d = new Date(iso); return `${d.getUTCDate()}-${MESES[d.getUTCMonth()]}-${d.getUTCFullYear()} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC`; };
const fechaCorta = (iso) => { if (!iso) return null; const d = new Date(iso.length === 10 ? iso + "T12:00:00Z" : iso); return `${d.getUTCDate()}-${MESES[d.getUTCMonth()]}-${d.getUTCFullYear()}`; };
const edicionLarga = (f) => { const m = /^(\d{4})-(\d{2})/.exec(f.edicion || f.medido_utc || ""); return m ? `${MESES_L[Number(m[2]) - 1]} de ${m[1]}` : "la foto anterior"; };
const capital = (s) => s[0].toUpperCase() + s.slice(1);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const quieto = matchMedia("(prefers-reduced-motion: reduce)").matches;
const CT_ESPERA_MS = 120000;

const form = $("mv-form"); if (!form) throw new Error("sin formulario");
const paso = (k) => document.querySelector(`[data-paso="${k}"]`);
let previa = null, fotoHoy = null, referencia = null;

const decir = (t, mal) => { const e = $("mv-estado"); e.textContent = t; e.hidden = !t; e.classList.toggle("bv-mal", !!mal); };
const pinta = (k, clase, html, ms) => {
  const li = paso(k); li.className = clase;
  li.querySelector("[data-r]").innerHTML = html;
  li.querySelector("[data-ms]").textContent = ms != null ? (ms >= 1000 ? `${num(ms / 1000, 1)} s` : `${ms} ms`) : "";
};
const limpiar = () => {
  document.querySelectorAll(".mv-pasos > li").forEach((li) => { li.className = ""; li.querySelector("[data-r]").innerHTML = ""; li.querySelector("[data-ms]").textContent = ""; });
  ["mv-qex", "mv-comp", "mv-foto"].forEach((id) => { $(id).hidden = true; });
};
const chip = (v, si = "sí", no = "no") => v === true ? `<span class="mv-chip mv-si">${si}</span>` : v === false ? `<span class="mv-chip mv-no">${no}</span>` : `<span class="mv-chip mv-neutro">sin dato</span>`;

// ---------------------------------------------------------------- bandeja «Sus fotos»
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
async function pintarBandeja() {
  const fotos = leerBandeja().sort((a, b) => a.dominio.localeCompare(b.dominio) || b.medido_utc.localeCompare(a.medido_utc));
  $("mv-b-vacia").hidden = fotos.length > 0;
  const integras = await Promise.all(fotos.map((f) => N.fotoIntegra(f)));
  let dom = null, html = "";
  fotos.forEach((f, i) => {
    if (f.dominio !== dom) { dom = f.dominio; html += `<li class="mv-b-dom">${esc(dom)}</li>`; }
    const activa = !!(previa && previa.sha256 === f.sha256);
    html += `<li class="mv-b-item${activa ? " mv-b-activa" : ""}">
      <button type="button" class="mv-b-elegir" data-sha="${esc(f.sha256)}" aria-pressed="${activa}">
        <span class="mv-b-fecha">${esc(fechaCorta(f.medido_utc))}</span>
        <span class="mv-b-qex">QEX ${esc(num(f.qex?.score))}</span>
        <span class="mv-b-sub">${activa ? "comparando con esta" : integras[i] ? "comparar con esta" : "huella alterada"}</span>
      </button>
      <span class="mv-b-acc"><button type="button" class="bv-link" data-bajar="${esc(f.sha256)}">descargar</button>
      <button type="button" class="bv-link" data-quitar="${esc(f.sha256)}">quitar</button></span></li>`;
  });
  $("mv-b-lista").innerHTML = html;
}
function elegirPrevia(f) {
  previa = f || null;
  const est = $("mv-previa-estado");
  $("mv-previa-quitar").hidden = !f;
  if (!f) { est.className = "mv-nota"; est.textContent = "Sin foto anterior: se mide sin comparar. Elija una en «Sus fotos» para comparar."; pintarBandeja(); return; }
  N.fotoIntegra(f).then((ok) => {
    est.className = "mv-nota " + (ok ? "mv-ok" : "bv-mal");
    est.textContent = ok ? `Se comparará con la foto de ${edicionLarga(f)} (${fechaCorta(f.medido_utc)}) de ${f.dominio}.`
      : `La foto de ${f.dominio} del ${fechaCorta(f.medido_utc)} cambió después de sellarse. Se comparará igual, y lo dirá.`;
  });
  $("mv-dominio").value = f.dominio;
  if (f.vertical && $("mv-sector").querySelector(`option[value="${CSS.escape(f.vertical)}"]`)) $("mv-sector").value = f.vertical;
  pintarBandeja();
}
function descargar(foto) {
  const blob = new Blob([JSON.stringify(foto, null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `foto-${foto.dominio}-${foto.medido_utc.slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
$("mv-b-lista").addEventListener("click", (e) => {
  const t = e.target.closest("button"); if (!t) return;
  const busca = (sha) => leerBandeja().find((f) => f.sha256 === sha);
  if (t.dataset.sha) { const f = busca(t.dataset.sha); elegirPrevia(previa && f && previa.sha256 === f.sha256 ? null : f); }
  else if (t.dataset.bajar) { const f = busca(t.dataset.bajar); if (f) descargar(f); }
  else if (t.dataset.quitar) quitarDeBandeja(t.dataset.quitar);
});
$("mv-previa-quitar").addEventListener("click", () => elegirPrevia(null));
$("mv-b-archivo").addEventListener("change", async (e) => {
  const est = $("mv-b-estado");
  for (const f of e.target.files) {
    try {
      const j = JSON.parse(await f.text());
      if (j.esquema !== N.ESQUEMA_FOTO) throw new Error("no es una foto de medición de Rosetta");
      if (!guardarEnBandeja(j)) throw new Error("este navegador no permite guardarla");
      est.className = "mv-nota mv-ok"; est.textContent = `Agregada: ${j.dominio}, ${fechaCorta(j.medido_utc)}.`;
      elegirPrevia(j);
    } catch (err) { est.className = "mv-nota bv-mal"; est.textContent = `${f.name}: ${err.message}.`; }
  }
  e.target.value = "";
});

// ---------------------------------------------------------------- sector
(async () => {
  try { referencia = await (await fetch("/data/qex-referencia-2026-08.json")).json(); }
  catch { decir("No pudimos cargar la referencia por sector. Recargue la página.", true); return; }
  $("mv-sector").innerHTML = Object.entries(referencia.verticales)
    .map(([k, v]) => `<option value="${esc(k)}"${k === "banca" ? " selected" : ""}>${esc(v.nombre)}</option>`).join("");
  pintarBandeja();
})();

// ---------------------------------------------------------------- paso 1: CT
// crt.sh falla a ratos (un 502 sin cabecera CORS llega como «Failed to fetch»): hasta 3 intentos
// dentro del mismo plazo total. Medido el 30-oct: un primer intento fallido y el siguiente en 4 s.
async function consultarCT(dominio, aviso) {
  const t0 = performance.now();
  const ctl = new AbortController(); const reloj = setTimeout(() => ctl.abort(), CT_ESPERA_MS);
  let ultimo;
  try {
    for (let i = 0; i < 3; i++) {
      if (i) { aviso(`El registro no respondió; reintento ${i} de 2`); await espera(4000 * i); }
      try {
        const r = await fetch(`https://crt.sh/?q=%25.${encodeURIComponent(dominio)}&output=json`, { signal: ctl.signal });
        if (!r.ok) throw new Error(`el registro respondió ${r.status}`);
        const texto = await r.text();
        return { filas: JSON.parse(texto), sha256: await N.sha256Hex(texto), ms: Math.round(performance.now() - t0), fuente: "crt.sh", intentos: i + 1 };
      } catch (e) { ultimo = e; if (e.name === "AbortError") throw e; }
    }
    throw ultimo;
  } finally { clearTimeout(reloj); }
}
// Si crt.sh no responde (es un servicio público y lento), se puede cargar una respuesta guardada.
function pedirCTGuardado(motivo) {
  return new Promise((resolve) => {
    pinta("ct", "bv-no", `${esc(motivo)}<br><label class="mv-nota">Cargar una respuesta guardada del registro (.json): <input type="file" accept=".json,application/json" data-ctfile></label>
      <br><button class="bv-link" type="button" data-ctsin>Seguir sin superficie</button>`, null);
    paso("ct").querySelector("[data-ctfile]").addEventListener("change", async (e) => {
      const f = e.target.files[0]; if (!f) return; const texto = await f.text();
      try { resolve({ filas: JSON.parse(texto), sha256: await N.sha256Hex(texto), ms: null, fuente: `archivo ${f.name}` }); }
      catch { pinta("ct", "bv-no", "Ese archivo no es una respuesta del registro.", null); resolve(null); }
    });
    paso("ct").querySelector("[data-ctsin]").addEventListener("click", () => resolve(null));
  });
}

// ---------------------------------------------------------------- medición
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const crudo = ($("mv-dominio").value.trim() || $("mv-dominio").placeholder).toLowerCase()
    .replace(/^https?:\/\//, "").replace(/[\/?#].*$/, "").replace(/^www\./, "");
  if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(crudo)) { decir("Escriba un dominio, por ejemplo ejemplo.cl.", true); $("mv-dominio").focus(); return; }
  if (!referencia) { decir("Falta la referencia por sector. Recargue la página.", true); return; }
  const dominio = crudo, www = "www." + dominio, vertical = $("mv-sector").value;
  const comparar = previa && previa.dominio === dominio ? previa : null;
  decir(previa && !comparar ? `La foto elegida es de ${previa.dominio}, no de ${dominio}: se mide sin comparar.` : "", !!(previa && !comparar));
  limpiar(); $("mv-ir").disabled = true; $("mv-ir").textContent = "Midiendo…";
  document.querySelectorAll(".mv-pasos > li").forEach((li) => { li.className = "bv-espera"; });
  const medido = new Date().toISOString();
  const t0 = performance.now();
  let avisoCT = "Consultando el registro público";
  const reloj = setInterval(() => { paso("ct").querySelector("[data-r]").textContent = `${avisoCT}… ${Math.round((performance.now() - t0) / 1000)} s`; }, 500);
  const terminar = () => { $("mv-ir").disabled = false; $("mv-ir").textContent = "Medir de nuevo"; };

  // 1 · superficie
  let ct = null;
  try { ct = await consultarCT(dominio, (t) => { avisoCT = t; }); }
  catch (err) { clearInterval(reloj); ct = await pedirCTGuardado(`El registro público no respondió (${err.name === "AbortError" ? `más de ${CT_ESPERA_MS / 1000} s` : err.message}).`); }
  clearInterval(reloj);
  const mapa = ct ? N.nombresCT(ct.filas, dominio) : null;
  const hostsCT = mapa ? N.hostsCT(mapa, dominio) : [];
  if (ct) {
    const k = N.conteos([...mapa.keys()]);
    pinta("ct", "bv-neutro", `<div class="mv-cifras">
      <span><b>${num(k.hostnames)}</b> nombres</span><span><b>${num(k.profundos)}</b> de 3 niveles o más</span>
      <span><b>${num(k.no_productivo)}</b> no productivos</span><span><b>${num(k.legado)}</b> de legado</span>
      <span><b>${num(k.infra_expuesta)}</b> de infraestructura</span><span><b>${num(k.critico)}</b> servicios críticos</span></div>`, ct.ms);
  } else pinta("ct", "bv-no", "Sin superficie: esta medición no incluye el registro de certificados, y la higiene se calcula sólo con TLS.", null);

  // 2-5 · una sola llamada al servidor
  const sensibles = hostsCT.filter((h) => h.clases.some((c) => N.CLASES_SENSIBLES.includes(c))).map((h) => h.host);
  const todos = [...new Set([...sensibles, ...(comparar ? (comparar.endpoints || []).map((x) => x.host) : [])])];
  const pedidos = todos.slice(0, 15);
  let s;
  try {
    const r = await fetch("/api/sondas", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ dominio, www, sensibles: pedidos }) });
    s = await r.json().catch(() => ({}));
    if (!r.ok || !s.ok) throw new Error(s.error || `el servicio respondió ${r.status}`);
  } catch (err) {
    ["end", "borde", "cert", "prov"].forEach((k) => pinta(k, "bv-no", `No pudimos medir: ${esc(err.message)}`, null));
    terminar(); return;
  }

  const { foto, detalle: d } = N.armarFoto({ dominio, www, vertical, medido, ct, sondas: s, referencia,
    origen: "Medición en vivo desde rosettaquantum.com/es/q-ready/medicion." });

  pinta("end", "bv-neutro", d.endpoints.length
    ? `<table class="mv-mini"><tbody>${d.endpoints.map((x) => {
        const cls = x.dns_status === "NXDOMAIN" ? "mv-si" : x.responde_443 === true ? "mv-no" : "mv-neutro";
        return `<tr><td>${esc(x.host)}</td><td><span class="mv-chip ${cls}">${esc(N.estadoEndpoint(x))}</span></td></tr>`;
      }).join("")}</tbody></table>${todos.length > pedidos.length ? `<p class="mv-nota">Se midieron ${pedidos.length} de ${todos.length} endpoints sensibles.</p>` : ""}`
    : (ct ? "Ningún nombre sensible en su superficie." : "Sin superficie, no hay endpoints que medir."), null);
  await espera(400);

  const b = s.borde, v = b.veredicto;
  pinta("borde", v.soporta === true ? "bv-si" : v.soporta === false ? "bv-no" : "bv-neutro",
    `<b>${esc(b.dns.cdn || "sin dato")}</b> · soporta X25519MLKEM768 ${chip(v.soporta)} · lo elige ${chip(v.elige)} · TLS 1.3 ${chip(d.tls13)}`,
    Math.max(...Object.values(b.saludos).map((x) => x.ms || 0)));
  await espera(400);

  const c = s.certificado;
  pinta("cert", c.ok ? "bv-neutro" : "bv-no", c.ok
    ? `<b>${esc(c.algoritmo === "EC" ? "ECDSA" : c.algoritmo)} ${esc(c.curva || c.bits + " bits")}</b> · emitido por ${esc(c.emisor)} · vence el ${esc(fechaCorta(c.not_after))}`
    : `No pudimos leer el certificado: ${esc(c.error)}`, c.ms);
  await espera(400);

  const sec = s.security_txt.publicado;
  pinta("prov", "bv-neutro", `Correo: <b>${esc(s.correo.proveedor || "sin registros MX")}</b> · canal de reporte (security.txt) ${chip(sec, "publicado", "no publicado")}${sec == null ? ' <span class="mv-nota">(el sitio no dejó leer la ruta estándar)</span>' : ""}`, null);
  await espera(300);

  // QEX con la suma a la vista
  const { dim, q, tipos, ref, cuentas } = d;
  const como = {
    certificados: c.ok ? `${c.algoritmo === "EC" ? "ECDSA" : c.algoritmo} ${c.curva || c.bits}: ${dim.certificados === 100 ? "sobre" : "en"} el mínimo vigente` : "certificado no leído",
    higiene: cuentas ? `base 70${cuentas.no_productivo > 0 ? " − 10 no productivo" : ""}${cuentas.infra_expuesta >= 3 ? " − 10 infraestructura" : ""}${cuentas.legado > 0 ? " − 10 legado" : ""}${d.tls13 === false ? " − 30 sin TLS 1.3" : ""}` : "sólo TLS",
    hndl: `modelo de ${ref.nombre.toLowerCase()}, igual para todo el sector`,
    edge: v.soporta === true ? "soporta el intercambio híbrido" : v.soporta === false ? "no lo soporta" : "sin veredicto",
  };
  $("mv-score").textContent = q.score == null ? "—" : num(q.score);
  $("mv-ref").textContent = `Mediana de ${ref.nombre.toLowerCase()}: ${num(ref.mediana)} (${ref.n} organizaciones). Mediana del país: ${num(referencia.mediana_pais)}. Referencia: edición de agosto de 2026.`;
  $("mv-suma").innerHTML = Object.keys(N.PESOS).map((k) => `<tr><th scope="row">${esc(N.ETIQUETA_DIM[k])}<br><span class="mv-tipo">${esc(tipos[k])}</span></th>
    <td class="num">${num(dim[k])}</td><td class="num">× ${num(N.PESOS[k], 2)}</td><td class="num">${dim[k] == null ? "—" : num(q.aportes[k], 2)}</td><td>${esc(como[k])}</td></tr>`).join("");
  $("mv-suma-total").className = "num";
  $("mv-suma-total").textContent = num(q.suma, 2);
  $("mv-suma-nota").textContent = q.peso_usado < 1 ? `Se renormaliza sobre ${num(q.peso_usado, 2)} de peso medido → ${num(q.score)}` : `Redondeado: ${num(q.score)}`;
  $("mv-tope").textContent = `Tope del índice: ${N.TOPE}. Lo que no se ve desde afuera —el tramo del borde a su origen, sus HSM, la criptografía interna— pesa más que lo que se ve, así que ninguna medición externa puede afirmar que una organización está preparada.`;
  $("mv-qex").hidden = false;

  fotoHoy = await N.sellarFoto(foto);
  if (comparar) mostrarComparacion(comparar, fotoHoy);
  $("mv-cuando").textContent = fechaUtc(medido);
  $("mv-huella").textContent = fotoHoy.sha256;
  $("mv-guardada").textContent = guardarEnBandeja(fotoHoy) ? "Quedó guardada en «Sus fotos», en este navegador."
    : "Este navegador no dejó guardarla en «Sus fotos»: descárguela para no perderla.";
  $("mv-foto").hidden = false;
  pintarBandeja();
  terminar();
  $("mv-qex").scrollIntoView({ behavior: quieto ? "auto" : "smooth", block: "start" });
});

// ---------------------------------------------------------------- comparación
const ESTADO = { cambio: ["cambió", "mv-c-cambio"], se_mantiene: ["se mantiene", "mv-c-igual"], medido_hoy: ["medido hoy", "mv-c-nuevo"], sin_dato: ["sin dato hoy", "mv-c-sin"] };
const GRUPOS = { qex: "Índice", superficie: "Superficie pública", borde: "Borde", certificado: "Certificado", proveedores: "Proveedores" };
const celda = (x) => x == null ? '<span class="mv-neutro">no medido</span>'
  : typeof x === "number" ? esc(num(x)) : /^\d{4}-\d{2}-\d{2}/.test(x) ? esc(fechaCorta(x)) : esc(x);
function mostrarComparacion(antes, ahora) {
  const c = N.comparar(antes, ahora);
  $("mv-comp-t").textContent = `${capital(edicionLarga(antes))} → hoy`;
  $("mv-col-antes").textContent = `Qué había · ${fechaCorta(antes.medido_utc)}`;
  $("mv-col-ahora").textContent = `Qué hay · ${fechaCorta(ahora.medido_utc)}`;
  $("mv-comp-resumen").innerHTML = [[c.resumen.cambio, "ítem cambió", "ítems cambiaron"], [c.resumen.se_mantiene, "se mantiene", "se mantienen"],
    [c.resumen.medido_hoy, "se midió hoy por primera vez", "se midieron hoy por primera vez"], [c.resumen.sin_dato, "no se pudo medir hoy", "no se pudieron medir hoy"]]
    .filter(([n], i) => n || i < 2).map(([n, uno, varios]) => `<b>${n}</b> ${n === 1 ? uno : varios}`).join(", ").replace(/, ([^,]*)$/, " y $1") + ".";
  let html = "", grupo = null;
  for (const it of c.items) {
    if (it.grupo !== grupo) { grupo = it.grupo; html += `<tr class="mv-grupo"><th colspan="4" scope="rowgroup">${esc(GRUPOS[grupo])}</th></tr>`; }
    html += `<tr><th scope="row">${esc(it.etiqueta)}</th><td>${celda(it.antes)}</td><td>${celda(it.ahora)}</td><td><span class="mv-chip ${ESTADO[it.estado][1]}">${ESTADO[it.estado][0]}</span></td></tr>`;
  }
  if (c.endpoints.length) {
    html += `<tr class="mv-grupo"><th colspan="4" scope="rowgroup">Endpoints sensibles</th></tr>`;
    for (const e of c.endpoints) html += `<tr><th scope="row"><code>${esc(e.host)}</code></th><td>${celda(e.antes)}</td><td>${celda(e.ahora)}</td><td><span class="mv-chip ${ESTADO[e.estado][1]}">${ESTADO[e.estado][0]}</span></td></tr>`;
  }
  $("mv-delta").innerHTML = html;
  const h = c.hosts;
  const lista = (xs) => `<ul>${xs.map((x) => `<li><code>${esc(x)}</code></li>`).join("")}</ul>`;
  $("mv-hosts").innerHTML = h.nuevos == null ? '<p class="mv-nota">Una de las dos fotos no trae la lista de nombres: no se comparan uno por uno.</p>'
    : `<p><b>${num(h.siguen)}</b> nombres siguen en el registro, <b>${num(h.nuevos.length)}</b> son nuevos y <b>${num(h.retirados.length)}</b> ya no aparecen.</p>`
      + (h.nuevos.length ? `<details open><summary>Nombres nuevos (${h.nuevos.length})</summary>${lista(h.nuevos)}</details>` : "")
      + (h.retirados.length ? `<details><summary>Nombres que ya no aparecen (${h.retirados.length})</summary>${lista(h.retirados)}</details>` : "");
  $("mv-comp").hidden = false;
}

$("mv-guardar").addEventListener("click", () => { if (fotoHoy) descargar(fotoHoy); });
