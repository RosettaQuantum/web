/*
 * /es/q-ready/medicion — el informe QEX en vivo (30-oct-2026; rediseño del mismo día).
 * El navegador consulta el registro público de certificados (crt.sh admite CORS); el servidor
 * hace sólo los saludos TLS y las consultas sin CORS (/api/sondas). La foto se arma con
 * armarFoto() de qex-nucleo.mjs, la misma función que alimenta el PDF.
 *
 * La consola muestra eventos REALES de esta medición (lo que respondió cada consulta, con su
 * tiempo): no hay animación que simule trabajo. Si algo no se midió, la consola lo dice.
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
const ms = (x) => x == null ? "" : x >= 1000 ? `${num(x / 1000, 1)} s` : `${x} ms`;

const form = $("mv-form"); if (!form) throw new Error("sin formulario");
let previa = null, fotoHoy = null, referencia = null;

const decir = (t, mal) => { const e = $("mv-estado"); e.textContent = t; e.hidden = !t; e.classList.toggle("mv-mal", !!mal); };
const chip = (v, si = "sí", no = "no") => v === true ? `<span class="mv-chip mv-si">${si}</span>` : v === false ? `<span class="mv-chip mv-no">${no}</span>` : `<span class="mv-chip mv-neutro">sin dato</span>`;

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
      <span class="mv-b-acc"><button type="button" class="mv-link" data-bajar="${esc(f.sha256)}">descargar</button>
      <button type="button" class="mv-link" data-quitar="${esc(f.sha256)}">quitar</button></span></li>`;
  });
  $("mv-b-lista").innerHTML = html;
}
function elegirPrevia(f) {
  previa = f || null;
  const est = $("mv-previa-estado");
  $("mv-previa-quitar").hidden = !f;
  if (!f) { est.className = "mv-nota"; est.textContent = "Sin foto anterior: se mide sin comparar. Elija una en «Sus fotos» para comparar."; pintarBandeja(); return; }
  N.fotoIntegra(f).then((ok) => {
    est.className = "mv-nota " + (ok ? "mv-ok" : "mv-mal");
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
    } catch (err) { est.className = "mv-nota mv-mal"; est.textContent = `${f.name}: ${err.message}.`; }
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
// El 30-oct falló tres veces seguidas en 13 s y respondió al minuto: ahora son 6 intentos con
// esperas crecientes (~45 s), dentro del mismo plazo total.
const CT_ESPERAS = [0, 3000, 5000, 8000, 12000, 15000];
async function consultarCT(dominio, aviso) {
  const t = performance.now();
  const ctl = new AbortController(); const reloj = setTimeout(() => ctl.abort(), CT_ESPERA_MS);
  let ultimo;
  try {
    for (let i = 0; i < CT_ESPERAS.length; i++) {
      if (i) { aviso(`el registro no respondió (${esc(ultimo?.message || "error")}); reintento ${i} de ${CT_ESPERAS.length - 1} en ${CT_ESPERAS[i] / 1000} s`); await espera(CT_ESPERAS[i]); }
      try {
        const r = await fetch(`https://crt.sh/?q=%25.${encodeURIComponent(dominio)}&output=json`, { signal: ctl.signal });
        if (!r.ok) throw new Error(`el registro respondió ${r.status}`);
        const texto = await r.text();
        guardarCT(dominio, texto);
        return { filas: JSON.parse(texto), sha256: await N.sha256Hex(texto), ms: Math.round(performance.now() - t), fuente: "crt.sh", intentos: i + 1 };
      } catch (e) { ultimo = e; if (e.name === "AbortError") throw e; }
    }
    throw ultimo;
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
    caja.innerHTML = `<p>${esc(motivo)}</p>${copia ? `<button class="mv-link" type="button" data-ctcopia>Usar la respuesta del registro guardada en este navegador el ${esc(fechaUtc(copia.utc))}</button>` : ""}<label>Cargar una respuesta guardada del registro (.json): <input type="file" accept=".json,application/json" data-ctfile></label>
      <button class="mv-link" type="button" data-ctsin>Seguir sin superficie</button>`;
    caja.hidden = false;
    caja.querySelector("[data-ctfile]").addEventListener("change", async (e) => {
      const f = e.target.files[0]; if (!f) return; const texto = await f.text();
      caja.hidden = true;
      try { resolve({ filas: JSON.parse(texto), sha256: await N.sha256Hex(texto), ms: null, fuente: `archivo ${f.name}` }); }
      catch { traza("ese archivo no es una respuesta del registro", "mv-t-mal"); resolve(null); }
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
  const crudo = ($("mv-dominio").value.trim() || $("mv-dominio").placeholder).toLowerCase()
    .replace(/^https?:\/\//, "").replace(/[\/?#].*$/, "").replace(/^www\./, "");
  if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(crudo)) { decir("Escriba un dominio, por ejemplo ejemplo.cl.", true); $("mv-dominio").focus(); return; }
  if (!referencia) { decir("Falta la referencia por sector. Recargue la página.", true); return; }
  const dominio = crudo, www = "www." + dominio, vertical = $("mv-sector").value;
  const comparar = previa && previa.dominio === dominio ? previa : null;
  decir(previa && !comparar ? `La foto elegida es de ${previa.dominio}, no de ${dominio}: se mide sin comparar.` : "", !!(previa && !comparar));
  $("mv-resultado").hidden = true; $("mv-comp").hidden = true;
  $("mv-ir").disabled = true; $("mv-ir").textContent = "Midiendo…";
  const terminar = () => { pararReloj(); $("mv-ir").disabled = false; $("mv-ir").textContent = "Medir de nuevo"; };
  arrancarConsola();
  const medido = new Date().toISOString();
  traza(`medición de <code>${esc(dominio)}</code> · sector ${esc(referencia.verticales[vertical]?.nombre || vertical)}${comparar ? ` · se comparará con la foto del ${esc(fechaCorta(comparar.medido_utc))}` : ""}`);

  // 1 · superficie
  riel("ct", "activo");
  const lineaCT = traza("consultando el registro público de certificados (crt.sh)…");
  let ct = null;
  try { ct = await consultarCT(dominio, (t) => { traza(t, "mv-t-mal"); }); }
  catch (err) {
    traza(`el registro no respondió (${esc(err.name === "AbortError" ? `más de ${CT_ESPERA_MS / 1000} s` : err.message)})`, "mv-t-mal");
    ct = await pedirCTGuardado("El registro público de certificados no respondió. Puede usar una respuesta guardada o seguir sin superficie.", dominio);
    if (ct && ct.consultado_utc) traza(`se usa la copia del registro consultada el ${esc(fechaUtc(ct.consultado_utc))}: así queda escrito en la foto`, "mv-t-mal");
  }
  const mapa = ct ? N.nombresCT(ct.filas, dominio) : null;
  const hostsCT = mapa ? N.hostsCT(mapa, dominio) : [];
  if (ct) {
    const k = N.conteos([...mapa.keys()]);
    lineaCT.classList.add("mv-t-ok");
    traza(`crt.sh · ${num(ct.filas.length)} certificados → <b>${num(k.hostnames)} nombres</b> · ${num(k.profundos)} de 3 niveles o más · ${num(k.no_productivo + k.infra_expuesta + k.legado)} sensibles · ${ms(ct.ms)}${ct.intentos > 1 ? ` · ${ct.intentos} intentos` : ""}`, "mv-t-ok");
    riel("ct", "ok");
  } else { traza("sin superficie: la higiene se calcula sólo con TLS", "mv-t-mal"); riel("ct", "mal"); }

  // 2-5 · una sola llamada al servidor
  const sensibles = hostsCT.filter((h) => h.clases.some((c) => N.CLASES_SENSIBLES.includes(c))).map((h) => h.host);
  // Además de los sensibles: los nombres que la foto anterior no tenía. Lo nuevo es justo lo que
  // una comparación tiene que mirar (así apareció openfinance-desa en octubre).
  const antesCT = new Set((comparar?.ct?.hosts || []).map((h) => h.host));
  const nuevosCT = antesCT.size ? hostsCT.map((h) => h.host).filter((h) => !antesCT.has(h)) : [];
  const todos = [...new Set([...sensibles, ...(comparar ? (comparar.endpoints || []).map((x) => x.host) : []), ...nuevosCT])];
  const pedidos = todos.slice(0, 15);
  ["end", "borde", "cert", "prov"].forEach((k) => riel(k, "activo"));
  traza(`DNS y saludos TLS desde nuestro servidor: ${pedidos.length} nombres (${sensibles.length} sensibles${nuevosCT.length ? `, ${nuevosCT.length} nuevos desde la foto anterior` : ""}), su borde, su certificado y su correo…`);
  let s;
  try {
    const r = await fetch("/api/sondas", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ dominio, www, sensibles: pedidos }) });
    s = await r.json().catch(() => ({}));
    if (!r.ok || !s.ok) throw new Error(s.error || `el servicio respondió ${r.status}`);
  } catch (err) {
    traza(`no pudimos medir: ${esc(err.message)}`, "mv-t-mal");
    ["end", "borde", "cert", "prov"].forEach((k) => riel(k, "mal"));
    terminar(); return;
  }

  const { foto, detalle: d } = N.armarFoto({ dominio, www, vertical, medido, ct, sondas: s, referencia,
    origen: "Medición en vivo desde rosettaquantum.com/es/q-ready/medicion." });
  const pausa = () => espera(quieto ? 0 : 260);

  // endpoints, uno por línea
  for (const x of d.endpoints) {
    const crudoE = (s.endpoints || []).find((y) => y.host === x.host) || {};
    const cls = x.responde_443 === true && alerta(x) ? "mv-t-mal" : "mv-t-ok";
    traza(`<code>${esc(x.host)}</code> · DNS ${esc(x.dns_status || "sin respuesta")}${crudoE.cname?.length ? ` → ${esc(crudoE.cname[crudoE.cname.length - 1])}` : ""} · ${esc(N.estadoEndpoint(x))}${x.responde_443 === true && crudoE.detalle ? ` (${esc(crudoE.detalle)})` : ""}`, cls);
    await pausa();
  }
  if (!d.endpoints.length) traza(ct ? "ningún nombre sensible en su superficie" : "sin superficie, no hay endpoints que medir");
  if (todos.length > pedidos.length) traza(`se midieron ${pedidos.length} de ${todos.length} endpoints sensibles (tope por medición)`, "mv-t-mal");
  riel("end", "ok");

  const b = s.borde, v = b.veredicto;
  traza(`DNS de <code>${esc(www)}</code> → ${esc((b.dns.cadena || []).join(" → ") || "sin CNAME")} · <b>${esc(b.dns.cdn || "CDN no identificado")}</b>`, "mv-t-ok");
  for (const [k, sa] of Object.entries(b.saludos)) {
    traza(`saludo ${esc(SALUDOS[k]?.corto || k)} → ${sa.error ? `error: ${esc(sa.error)}` : sa.alerta != null ? `alerta TLS ${esc(sa.alerta)}` : `<b>${esc(sa.grupo)}</b>${sa.hrr ? " (con un viaje extra)" : ""}`} · ${ms(sa.ms)}`, sa.error ? "mv-t-mal" : "mv-t-ok");
    await pausa();
  }
  riel("borde", v.soporta == null ? "mal" : "ok");

  const c = s.certificado;
  traza(c.ok ? `certificado de <code>${esc(c.host)}</code> · <b>${esc(c.algoritmo === "EC" ? "ECDSA" : c.algoritmo)} ${esc(c.curva || c.bits + " bits")}</b> · ${esc(c.emisor)} · vence ${esc(fechaCorta(c.not_after))} · ${ms(c.ms)}`
    : `certificado no leído: ${esc(c.error)}`, c.ok ? "mv-t-ok" : "mv-t-mal");
  riel("cert", c.ok ? "ok" : "mal");
  await pausa();

  traza(`correo · ${num((s.correo.mx || []).length)} registros MX → <b>${esc(s.correo.proveedor || "sin proveedor identificado")}</b>`, "mv-t-ok");
  const sec = s.security_txt;
  traza(`canal de reporte · ${sec.publicado === true ? "<b>security.txt publicado</b>" : sec.publicado === false ? "security.txt no publicado" : "el sitio no dejó leer /.well-known/security.txt"}${(sec.intentos || []).length ? ` (${sec.intentos.map((i) => `${esc(new URL(i.url).host)}: ${esc(i.status ?? "sin respuesta")}`).join(", ")})` : ""}`, sec.publicado === true ? "mv-t-ok" : "mv-t-mal");
  riel("prov", "ok");

  // QEX y la foto sellada
  fotoHoy = await N.sellarFoto(foto);
  const q = d.q;
  traza(`<b>QEX ${num(q.score)}</b> · suma ${num(q.suma, 2)} · foto sellada ${esc(fotoHoy.sha256.slice(0, 12))}… · ${segundos().slice(1)} en total`, "mv-t-fin");
  pararReloj();

  pintarResultado({ d, s, ct, mapa, hostsCT, dominio, www, nuevosCT });
  if (comparar) mostrarComparacion(comparar, fotoHoy);
  $("mv-cuando").textContent = fechaUtc(medido);
  $("mv-huella").textContent = fotoHoy.sha256;
  $("mv-integra").innerHTML = '<span class="mv-chip mv-si">íntegra</span> recalculada en este navegador';
  $("mv-guardada").textContent = guardarEnBandeja(fotoHoy) ? "Quedó guardada en «Sus fotos», en este navegador."
    : "Este navegador no dejó guardarla en «Sus fotos»: descárguela para no perderla.";
  pintarBandeja();
  terminar();
  $("mv-resultado").hidden = false;
  $("mv-qex").scrollIntoView({ behavior: quieto ? "auto" : "smooth", block: "start" });
});

// ---------------------------------------------------------------- resultado
const SALUDOS = {
  A_como_navegador: { corto: "A · llave clásica", ofrece: "Ofrece el híbrido, pero envía sólo la llave clásica.", lee: (sa) => sa.grupo === "X25519MLKEM768" ? "Pide el híbrido aun teniendo la clásica a mano." : "Acepta la llave clásica para ahorrarse un viaje: es lo correcto en TLS, no falta de soporte. Un navegador actual envía las dos llaves." },
  B_solo_hibrido: { corto: "B · sólo el híbrido", ofrece: "Ofrece únicamente X25519MLKEM768.", lee: (sa) => sa.grupo === "X25519MLKEM768" ? "Lo acepta: su borde soporta el intercambio post-cuántico." : "No lo acepta." },
  C_eleccion_libre: { corto: "C · elección libre", ofrece: "Ofrece todos los grupos sin enviar llave: el servidor elige.", lee: (sa) => sa.grupo === "X25519MLKEM768" ? "Elige el híbrido cuando puede elegir." : `Elige ${sa.grupo || "otro grupo"}.` },
};
// Señal de lectura, NO regla del índice: nombres que en Chile suelen ser ambientes de prueba y que
// los patrones de agosto no cuentan (así pasó openfinance-desa). No cambia el puntaje; se marca.
const PRUEBA_LOCAL = /(^|[.-])(desa|desarrollo|qa|uat|stg|staging|homolog|hml|sandbox)(\d*)([.-]|$)/;
const alerta = (x) => x.clases.length > 0 || PRUEBA_LOCAL.test(x.host);
const CLASE = { critico: "Servicio crítico", infra_expuesta: "Infraestructura sensible", no_productivo: "Ambiente no productivo", legado: "Legado" };
const DIM_CLASE = { certificados: "mv-d-certificados", higiene: "mv-d-higiene", hndl: "mv-d-hndl", edge: "mv-d-edge" };

function pintarResultado({ d, s, ct, mapa, hostsCT, dominio, www, nuevosCT = [] }) {
  const nuevosVistos = new Set(nuevosCT);
  const { dim, q, tipos, ref, cuentas } = d;
  const b = s.borde, v = b.veredicto, c = s.certificado;

  // ---- QEX: la barra es la suma
  $("mv-qex-meta").textContent = `${dominio} · ${fechaUtc(new Date().toISOString())}`;
  $("mv-score").textContent = q.score == null ? "—" : num(q.score);
  $("mv-ref").textContent = `Mediana de ${ref.nombre.toLowerCase()}: ${num(ref.mediana)} (${ref.n} organizaciones). Mediana del país: ${num(referencia.mediana_pais)}. Referencia: edición de agosto de 2026.`;
  // Cada tramo mide su aporte en puntos del índice. Si faltó una dimensión, el índice se
  // renormaliza: los tramos se escalan por el mismo factor, para que la barra siga siendo la suma.
  const factor = q.peso_usado > 0 ? 1 / q.peso_usado : 1;
  const ancho = (k) => dim[k] == null ? 0 : Math.min(q.aportes[k] * factor, N.TOPE);
  $("mv-tramos").innerHTML = Object.keys(N.PESOS).map((k, i) => dim[k] == null ? ""
    : `<div class="mv-tramo ${DIM_CLASE[k]}" style="width:${ancho(k)}%;animation-delay:${i * 120}ms" title="${esc(N.ETIQUETA_DIM[k])}: ${num(q.aportes[k] * factor, 1)} puntos"></div>`).join("");
  $("mv-techo").style.width = `${100 - N.TOPE}%`;
  $("mv-eje-tope").style.left = `${N.TOPE}%`;
  const marca = (x, txt, cls = "") => `<div class="mv-marca ${cls}${x > 50 ? " mv-marca-izq" : ""}" style="left:${x}%"><span>${txt}</span></div>`;
  const medianas = ref.mediana === referencia.mediana_pais ? [marca(ref.mediana, `mediana ${num(ref.mediana)}`)]
    : [marca(referencia.mediana_pais, `país · ${num(referencia.mediana_pais)}`), marca(ref.mediana, `${ref.nombre.toLowerCase()} · ${num(ref.mediana)}`)];
  $("mv-marcas").innerHTML = medianas.join("");
  $("mv-escala-desc").textContent = `Barra de 0 a 100: su QEX ${num(q.score)} como suma de cuatro tramos; mediana del país ${num(referencia.mediana_pais)}; zona de ${N.TOPE} a 100 no observable desde afuera.`;
  const terminos = Object.keys(N.PESOS).filter((k) => dim[k] != null);
  $("mv-formula").innerHTML = `${terminos.map((k) => `${num(dim[k])} × ${num(N.PESOS[k], 2)}`).join(" + ")} = ${terminos.map((k) => num(q.aportes[k], 2)).join(" + ")} = <b>${num(q.suma, 2)}</b> → <b>${num(q.score)}</b>`
    + `<span class="mv-f-nota">${q.peso_usado < 1 ? `Faltó medir una dimensión: se renormaliza sobre ${num(q.peso_usado, 2)} del peso. ` : ""}Se redondea al entero par más cercano en caso de empate, igual que en todas las ediciones. Tope: ${N.TOPE}, porque lo que no se ve desde afuera —el tramo del borde a su origen, sus HSM, la criptografía interna— nunca puede darse por resuelto midiendo desde afuera.</span>`;
  const como = {
    certificados: c.ok ? `${c.algoritmo === "EC" ? "ECDSA" : c.algoritmo} ${c.curva || c.bits}. La versión final de NIST IR 8547 (oct-2026) depreca ECDSA y RSA después de 2030.` : "No pudimos leer el certificado.",
    higiene: cuentas ? `Base 70${cuentas.no_productivo > 0 ? " − 10 por ambiente no productivo" : ""}${cuentas.infra_expuesta >= 3 ? " − 10 por infraestructura sensible" : ""}${cuentas.legado > 0 ? " − 10 por legado" : ""}${d.tls13 === false ? " − 30 sin TLS 1.3" : ""}.` : "Sin superficie: sólo TLS.",
    hndl: `Modelo de ${ref.nombre.toLowerCase()}: igual para todo el sector, no se mide.`,
    edge: v.soporta === true ? (v.elige ? "Soporta y elige el intercambio híbrido." : "Soporta el híbrido, pero no lo elige.") : v.soporta === false ? "No acepta el intercambio híbrido." : "Sin veredicto.",
  };
  const pais = referencia.mediana_pais_dimension || {};
  $("mv-dims").innerHTML = Object.keys(N.PESOS).map((k) => `<div class="mv-dim">
      <span class="mv-dim-cab"><i class="${DIM_CLASE[k]}"></i>${esc(N.ETIQUETA_DIM[k])}</span>
      <span class="mv-dim-v">${num(dim[k])}<small>${pais[k] != null ? `país ${num(pais[k])}` : ""}</small></span>
      <span>${tipos[k].startsWith("modelo") ? '<span class="mv-chip mv-modelo">modelo</span>' : '<span class="mv-chip mv-si">medido</span>'}</span>
      <span class="mv-dim-como">${esc(como[k])}</span>
      <span class="mv-dim-pie">peso ${num(N.PESOS[k] * 100)} % · aporta ${dim[k] == null ? "—" : num(q.aportes[k], 2)}</span>
    </div>`).join("");

  // ---- superficie: un cuadro por nombre
  if (mapa) {
    const k = N.conteos([...mapa.keys()]);
    const vivos = new Set(d.endpoints.filter((x) => x.responde_443 === true).map((x) => x.host));
    const clase = (h) => ["legado", "infra_expuesta", "no_productivo", "critico"].find((c) => h.clases.includes(c)) || (h.profundo ? "profundo" : "");
    const orden = { legado: 0, infra_expuesta: 1, no_productivo: 2, critico: 3, profundo: 4, "": 5 };
    const lista = [...hostsCT].sort((a, b) => orden[clase(a)] - orden[clase(b)] || a.host.localeCompare(b.host));
    $("mv-mapa").innerHTML = lista.map((h, i) => `<i class="mv-k-${clase(h) || "otro"}${vivos.has(h.host) ? " mv-vivo" : ""}" title="${esc(h.host)}" style="animation-delay:${quieto ? 0 : Math.min(i * 3, 600)}ms"></i>`).join("");
    $("mv-sup-meta").textContent = `registro público · ${num(ct.filas.length)} certificados`;
    $("mv-sup-lede").textContent = `${num(k.hostnames)} nombres de host que su dominio ha certificado. Cada cuadro es uno; pase el cursor para ver su nombre. ${vivos.size ? `Los cuadros con borde responden hoy en el puerto 443.` : ""}`;
    const fila = (cls, txt, n) => `<li><i class="mv-k-${cls}"></i><span>${txt}</span><b>${num(n)}</b></li>`;
    $("mv-leyenda").innerHTML = fila("infra_expuesta", "Infraestructura sensible", k.infra_expuesta) + fila("no_productivo", "Ambiente no productivo", k.no_productivo)
      + fila("legado", "Legado", k.legado) + fila("critico", "Servicio crítico", k.critico) + fila("profundo", "3 niveles o más, sin otra clase", lista.filter((h) => clase(h) === "profundo").length)
      + fila("otro", "Otros nombres", lista.filter((h) => !clase(h)).length)
      + `<li><span class="mv-ley-nota">Mismas reglas de clasificación que todas nuestras ediciones. La búsqueda es por sufijo de texto, como en el índice: puede incluir dominios vecinos que terminan igual.</span></li>`;
  } else {
    $("mv-mapa").innerHTML = ""; $("mv-leyenda").innerHTML = "";
    $("mv-sup-meta").textContent = "sin registro";
    $("mv-sup-lede").textContent = "Esta medición no incluye el registro público de certificados.";
  }
  $("mv-endp").innerHTML = d.endpoints.length ? d.endpoints.map((x) => {
    const crudoE = (s.endpoints || []).find((y) => y.host === x.host) || {};
    const dns = x.dns_status === "NXDOMAIN" ? '<span class="mv-chip mv-si">no publicado</span>' : x.dns_status === "NOERROR" ? '<span class="mv-chip mv-neutro">publicado</span>' : `<span class="mv-chip mv-neutro">${esc(x.dns_status || "sin dato")}</span>`;
    const p443 = x.dns_status === "NXDOMAIN" ? '<span class="mv-neutro">—</span>' : x.responde_443 === true ? `<span class="mv-chip ${alerta(x) ? "mv-no" : "mv-neutro"}">responde</span>` : x.responde_443 === false ? '<span class="mv-chip mv-si">no responde</span>' : '<span class="mv-chip mv-neutro">sin dato</span>';
    return `<tr><td><code>${esc(x.host)}</code></td><td>${esc(x.clases.length ? x.clases.map((c) => CLASE[c] || c).join(", ") : PRUEBA_LOCAL.test(x.host) ? "Posible ambiente de prueba por su nombre (fuera de la regla del índice)" : nuevosVistos.has(x.host) ? "Nuevo desde la foto anterior" : "Sin clase")}</td><td>${dns}</td><td>${p443}</td>
      <td class="mv-neutro">${esc([crudoE.cname?.length ? `CNAME ${crudoE.cname[crudoE.cname.length - 1]}` : "", crudoE.detalle || ""].filter(Boolean).join(" · ") || "—")}</td></tr>`;
  }).join("") : `<tr><td colspan="5" class="mv-neutro">${ct ? "Ningún nombre sensible en su superficie." : "Sin superficie, no hay endpoints que medir."}</td></tr>`;

  // ---- borde: dos tramos y los tres saludos
  $("mv-borde-meta").textContent = `${www} · ${b.dns.cdn || "CDN no identificado"}`;
  const enlace1 = v.soporta === true ? ["", v.elige ? "X25519MLKEM768 · medido" : "híbrido soportado · medido"] : v.soporta === false ? ["mv-enlace-mal", "sólo clásico · medido"] : ["mv-enlace-no", "sin veredicto"];
  $("mv-dos-tramos").innerHTML = `<div class="mv-nodo"><b>Su cliente</b><span>navegador o app</span></div>
    <div class="mv-enlace ${enlace1[0]}"><span>${esc(enlace1[1])}</span></div>
    <div class="mv-nodo"><b>Su borde</b><span>${esc(b.dns.cdn || www)}</span></div>
    <div class="mv-enlace mv-enlace-no"><span>no observable desde afuera</span></div>
    <div class="mv-nodo mv-nodo-niebla"><b>Su origen</b><span>servidores propios</span></div>`;
  $("mv-saludos").innerHTML = Object.entries(b.saludos).map(([k, sa]) => {
    const S = SALUDOS[k] || { corto: k, ofrece: "", lee: () => "" };
    const res = sa.error ? `<span class="mv-chip mv-neutro">error</span><span class="mv-sub">${esc(sa.error)}</span>`
      : sa.alerta != null ? `<span class="mv-chip mv-no">alerta ${esc(sa.alerta)}</span>`
      : `<span class="mv-chip ${sa.grupo === "X25519MLKEM768" ? "mv-si" : "mv-neutro"}">${esc(sa.grupo)}</span>${sa.hrr ? '<span class="mv-sub">con un viaje extra (HelloRetryRequest)</span>' : ""}<span class="mv-sub">${esc(S.lee(sa))}</span>`;
    return `<tr><th scope="row">${esc(S.corto)}</th><td>${esc(S.ofrece)}</td><td>${res}</td><td class="num">${esc(sa.ms ?? "—")}</td></tr>`;
  }).join("");
  $("mv-borde-lectura").textContent = "El soporte se decide con el saludo B y la preferencia con el C. El tramo de su borde a su origen es otra conexión: no la vemos, y no la puede ver nadie desde fuera de su organización. Pregúntele a su proveedor si la tiene habilitada.";

  // ---- certificado y correo
  const fila = (dt, dd) => `<div><dt>${dt}</dt><dd>${dd}</dd></div>`;
  $("mv-cert").innerHTML = c.ok
    ? fila("Algoritmo", `<b>${esc(c.algoritmo === "EC" ? "ECDSA" : c.algoritmo)} ${esc(c.curva || c.bits + " bits")}</b>`) + fila("Firma", `<code>${esc(c.firma || "—")}</code>`)
      + fila("Emisor", esc(c.emisor)) + fila("Sujeto", `<code>${esc(c.sujeto || "—")}</code>`)
      + fila("Vigencia", `${esc(fechaCorta(c.not_before))} → <b>${esc(fechaCorta(c.not_after))}</b>`)
      + fila("Lectura", "La versión final de NIST IR 8547 (octubre de 2026) depreca ECDSA y RSA después de 2030 y los prohíbe después de 2035, con cualquier curva o tamaño.")
    : fila("Estado", `No pudimos leer el certificado: ${esc(c.error)}`);
  const sec = s.security_txt;
  $("mv-prov").innerHTML = fila("Correo", `<b>${esc(s.correo.proveedor || "sin proveedor identificado")}</b>`)
    + fila("MX", (s.correo.mx || []).length ? (s.correo.mx || []).map((m) => `<code>${esc(m)}</code>`).join("<br>") : "sin registros MX")
    + fila("Canal de reporte", `${chip(sec.publicado, "publicado", "no publicado")}${sec.publicado == null ? " el sitio no dejó leer la ruta estándar" : ""}`)
    + ((sec.intentos || []).length ? fila("Rutas probadas", sec.intentos.map((i) => `<code>${esc(i.url)}</code> → ${esc(i.status ?? "sin respuesta")}`).join("<br>")) : "");
}

// ---------------------------------------------------------------- comparación
const ESTADO = { cambio: ["cambió", "mv-c-cambio"], se_mantiene: ["se mantiene", "mv-c-igual"], medido_hoy: ["medido hoy", "mv-c-nuevo"], sin_dato: ["sin dato hoy", "mv-c-sin"] };
const GRUPOS = { qex: "Índice", superficie: "Superficie pública", borde: "Borde", certificado: "Certificado", proveedores: "Proveedores" };
const celda = (x) => x == null ? '<span class="mv-neutro">no medido</span>'
  : typeof x === "number" ? esc(num(x)) : /^\d{4}-\d{2}-\d{2}/.test(x) ? esc(fechaCorta(x)) : esc(x);
function mostrarComparacion(antes, ahora) {
  const c = N.comparar(antes, ahora);
  $("mv-comp-t").textContent = `${capital(edicionLarga(antes))} → hoy`;
  $("mv-comp-meta").textContent = `foto ${antes.sha256.slice(0, 12)}… → ${ahora.sha256.slice(0, 12)}…`;
  $("mv-col-antes").textContent = `Qué había · ${fechaCorta(antes.medido_utc)}`;
  $("mv-col-ahora").textContent = `Qué hay · ${fechaCorta(ahora.medido_utc)}`;
  const r = c.resumen;
  $("mv-comp-resumen").innerHTML = [[r.cambio, r.cambio === 1 ? "cambió" : "cambiaron"], [r.se_mantiene, r.se_mantiene === 1 ? "se mantiene" : "se mantienen"],
    [r.medido_hoy, "medidos hoy por primera vez"], [r.sin_dato, "sin dato hoy"]].map(([n, t]) => `<li><b>${num(n)}</b>${t}</li>`).join("");
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
$("mv-imprimir").addEventListener("click", () => window.print());
$("mv-verificar").addEventListener("click", async () => {
  if (!fotoHoy) return;
  const ok = await N.fotoIntegra(fotoHoy);
  $("mv-integra").innerHTML = ok ? `<span class="mv-chip mv-si">íntegra</span> recalculada ahora: ${esc(fotoHoy.sha256.slice(0, 16))}…`
    : '<span class="mv-chip mv-no">alterada</span> la huella no coincide con el contenido';
});
