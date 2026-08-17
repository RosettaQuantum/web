import { verificarSello } from "./verificar.mjs";

/**
 * La consola: TODO lo que se ve sale de nuestra propia API, en el mismo origen.
 *
 * POR QUE ESTE ARCHIVO EXISTE
 * --------------------------
 * La version anterior era un artefacto con datos pegados, y no podia ser otra cosa: un
 * artefacto no puede llamar a un host externo. Aca estamos en rosettaquantum.com, asi
 * que `/v1/...` es mismo origen y se lee de verdad. Esa es la diferencia entera.
 *
 * LAS DOS REGLAS QUE ESTE ARCHIVO IMPONE
 * --------------------------------------
 * 1. NADA INVENTADO. Si un campo viene vacio, se muestra vacio o "sin medir". Nunca un
 *    valor de relleno: esta es la pantalla con la que Nicholas vende, y un dato
 *    plausible que nadie midio es el peor defecto en el peor lugar.
 * 2. SI LA API FALLA, SE DICE. Con la ruta que fallo, a la vista. Una pantalla que
 *    parece cargada mientras el dato no llego es exactamente el fallo silencioso.
 *
 * El archivo que sirvio de base traia cifras inventadas —"4 selladas", "15 de 15 rutas
 * responden", "6 propagadores"— que nuestra propia API desmiente. De ahi se hereda la
 * linea grafica; los numeros, ninguno.
 */

const $ = (sel, raiz = document) => raiz.querySelector(sel);
const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

/** Formato local: coma decimal, punto de miles. */
const num = (v, dec = 0) =>
  v == null || Number.isNaN(v) ? "—"
    : v.toLocaleString("es-CL", { minimumFractionDigits: dec, maximumFractionDigits: dec });
/**
 * Los precios por disparo bajan a 0,000425: con 4 decimales salia "US$0,0004" y se
 * perdia el 25 del final. En una tabla de precios redondear hacia abajo no es un
 * detalle de formato — es publicar otro precio. Se muestran los decimales que el
 * numero tiene, hasta 6.
 */
const usd = v => {
  if (v == null || Number.isNaN(v)) return "—";
  if (v === 0) return "US$0";
  // Se quitan los ceros de relleno PERO nunca por debajo de dos decimales: "US$0,3"
  // no es una cifra de dinero, y mi primera version imprimia justo eso.
  const dec = v < 0.01 ? 6 : v < 1 ? 4 : 2;
  let t = num(v, dec);
  while (/\d{3,}$/.test(t.split(",")[1] || "") && t.endsWith("0")) t = t.slice(0, -1);
  return "US$" + t;
};
const esc = s => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Toda lectura pasa por aca, y su fallo es visible.
 * Devuelve `{ ok, datos, error }` — nunca lanza, para que un panel caido no se lleve
 * los otros cinco, pero SIEMPRE deja el error escrito en su panel.
 */
async function pedir(ruta) {
  try {
    // Sin query de cache-busting a proposito: las rutas exactas del Worker no responden
    // con `?cb=` y caen al sitio estatico, que es una trampa conocida de este proyecto.
    const r = await fetch(ruta, { headers: { accept: "application/json" } });
    if (!r.ok) return { ok: false, error: `${ruta} respondio ${r.status}` };
    return { ok: true, datos: await r.json() };
  } catch (e) {
    return { ok: false, error: `${ruta} no respondio (${e.message})` };
  }
}

function falla(caja, mensaje) {
  caja.innerHTML = `<div class="err" role="alert"><b>No pude leer el dato.</b> ${esc(mensaje)}
    <div class="err-n">Esta pantalla no muestra datos guardados: si la API no responde, no hay nada que mostrar.</div></div>`;
}

// ------------------------------------------------------------------ el estado

let ESTADO = null;   // /v1/state
let CORRIDAS = null; // /v1/runs?limit=…
let COSTOS = null;   // costos.json, generado desde quantum-run/costos.py

// -------------------------------------------------------------------- marco

/**
 * El contador de victorias, con las DOS cifras y su definicion.
 *
 * El archivo tiene 4 corridas cuyo campo `resultado` dice "quantum win" —y no son
 * demos: las 72 tienen es_demo=false— mientras `victorias_cuanticas_medidas` dice 0.
 * No se contradicen: cuentan cosas distintas. El 0 son VEREDICTOS publicados con
 * resultado `win`; las 4 son CORRIDAS individuales que ningun veredicto adjudico.
 *
 * Mostrar una sola seria elegir la que suena mejor — y aca la que suena mejor es la de
 * 4. Van las dos, cada una con lo que cuenta.
 */
function pintarMarco() {
  const caja = $("#marco-contador");
  if (!ESTADO) { caja.textContent = "leyendo /v1/state…"; return; }
  const e = ESTADO.estado_medido;
  const corridas = (CORRIDAS && CORRIDAS.items) || [];
  const marcadas = corridas.filter(c => (c.resultado || "").trim().toLowerCase() === "quantum win").length;
  caja.innerHTML =
    `<b>${num(e.victorias_cuanticas_medidas)}</b> victorias en veredictos publicados ` +
    `<span class="lab">de ${num(e.corridas_selladas)} corridas selladas</span>` +
    (corridas.length
      ? `<span class="dos">${num(marcadas)} corridas marcadas «quantum win», ninguna adjudicada por un veredicto</span>`
      : "");
}

// ------------------------------------------------------------------- archivo

function pintarArchivo() {
  const caja = $("#archivo-cifras");
  if (!ESTADO) return;
  const e = ESTADO.estado_medido;
  const cifras = [
    ["corridas selladas", e.corridas_selladas],
    ["pre-registros", e.pre_registros],
    ["veredictos publicados", e.veredictos_publicados],
    ["recetas", e.recetas],
    ["victorias cuánticas medidas", e.victorias_cuanticas_medidas],
  ];
  caja.innerHTML = cifras.map(([k, v]) => `
    <div class="cif">
      <div class="cif-v">${num(v)}</div>
      <div class="cif-k">${esc(k)}</div>
    </div>`).join("");
  // La lectura del cero va TEXTUAL, no resumida: es la frase que sostiene el producto.
  $("#archivo-lectura").textContent = e.lectura || "";
  const i = ESTADO.integridad || {};
  $("#archivo-integridad").innerHTML =
    `<b>${(i.copias || []).length} copias independientes:</b> ${esc((i.copias || []).join(" · "))}
     · ancla externa: ${esc(i.ancla_externa || "—")}
     · auditoría ${esc(i.auditoria || "—")}
     ${i.protocolo ? `· <a href="${esc(i.protocolo)}">protocolo</a>` : ""}`;
}

// ----------------------------------------------------------------- biblioteca

function pintarBiblioteca() {
  const caja = $("#biblioteca-lista");
  const r = (ESTADO && ESTADO.recetas) || [];
  $("#biblioteca-den").textContent = `${r.length} recetas publicadas`;
  caja.innerHTML = r.map(x => `
    <div class="tarj">
      <div class="tarj-id">${esc(x.id)}</div>
      <div class="tarj-t">${esc(x.nombre)}</div>
      <div class="tarj-m">
        <span>${esc(x.clase || "—")}</span>
        <span>${esc(x.vertical || "—")}</span>
        <span>${esc(x.algoritmo || "—")}</span>
      </div>
      <div class="tarj-e est ${x.estado === "measuring" ? "e-ok" : "e-gris"}">${esc(x.estado || "—")}</div>
    </div>`).join("");
}

// ------------------------------------------------------------------ corridas

/**
 * El `resultado` viene siendo un parrafo entero —hasta 400 caracteres— y puesto crudo
 * en la tabla deja cinco filas por pantalla. En una videollamada donde alguien tiene
 * que ELEGIR una de sesenta, eso no es una tabla: es un muro. Se recorta aca y va
 * completo en el sello, que es donde se lee de verdad. El texto completo queda en el
 * `title` para que no se pierda al pasar el mouse.
 */
const RECORTE = 96;
const recorta = t => {
  const s = String(t || "").trim();
  return s.length <= RECORTE ? s : s.slice(0, RECORTE).replace(/\s+\S*$/, "") + "…";
};

function filaCorrida(c) {
  const r = c.resultado || "";
  return `<tr data-id="${esc(c.id)}">
    <td class="c-id">${esc(c.id)}</td>
    <td class="c-fecha">${esc(c.fecha || "—")}</td>
    <td>${esc(c.clase_de_problema || "—")}</td>
    <td class="c-res" title="${esc(r)}">${esc(recorta(r)) || "—"}</td>
    <td class="c-ver"><button class="btn btn-ver" data-id="${esc(c.id)}">ver el sello</button></td>
  </tr>`;
}

function pintarCorridas() {
  const cuerpo = $("#corridas-cuerpo");
  const items = (CORRIDAS && CORRIDAS.items) || [];
  const filtro = ($("#corridas-filtro").value || "").trim().toLowerCase();
  const vistas = filtro
    ? items.filter(c => JSON.stringify(c).toLowerCase().includes(filtro))
    : items;
  cuerpo.innerHTML = vistas.map(filaCorrida).join("");
  // El denominador SIEMPRE a la vista, y de dos fuentes distintas: lo que entrego
  // /v1/runs y lo que declara /v1/state. Si no calzan, se dice.
  const selladas = ESTADO && ESTADO.estado_medido ? ESTADO.estado_medido.corridas_selladas : null;
  const descuadre = selladas != null && items.length !== selladas
    ? ` · <b class="ojo">/v1/runs entregó ${items.length} y /v1/state declara ${selladas}</b>`
    : "";
  $("#corridas-den").innerHTML =
    `${vistas.length} de ${items.length} mostradas${selladas != null ? ` · ${selladas} selladas según /v1/state` : ""}${descuadre}`;
}

/** El momento de la videollamada: se abre el sello, con su hash y sus dos copias. */
async function abrirSello(id) {
  const panel = $("#sello");
  panel.hidden = false;
  panel.innerHTML = `<div class="sello-cargando">Leyendo <code>/v1/archive/${esc(id)}</code>…</div>`;
  panel.scrollIntoView({ behavior: "smooth", block: "center" });
  const r = await pedir(`/v1/archive/${encodeURIComponent(id)}`);
  if (!r.ok) return falla(panel, r.error);
  const a = r.datos;
  panel.innerHTML = `
    <div class="sello-cab">
      <div><span class="sello-id">${esc(a.id)}</span> <span class="est e-gris">${esc(a.tipo || "")}</span></div>
      <button class="btn btn-x" id="sello-cerrar" aria-label="Cerrar">✕</button>
    </div>
    <div class="sello-hash">
      <div class="lab">content_hash</div>
      <code id="sello-h">${esc(a.content_hash || "—")}</code>
      <button class="btn" id="sello-copiar">copiar</button>
    </div>
    <div class="sello-copias">
      ${a.github_raw ? `<a class="btn btn-solid" href="${esc(a.github_raw)}" target="_blank" rel="noopener">abrir en GitHub</a>` : ""}
      ${a.codeberg_raw ? `<a class="btn btn-solid" href="${esc(a.codeberg_raw)}" target="_blank" rel="noopener">abrir en Codeberg</a>` : ""}
    </div>
    <div class="ver-hash">
      <div class="lab">no nos creas: recomputa el hash aquí</div>
      <button class="btn btn-solid" id="ver-hash-btn">recomputar en tu navegador</button>
      <div class="ver-res" id="ver-hash-res"></div>
    </div>
    ${a.como_verificar ? `<div class="sello-comov"><div class="lab">cómo verificarlo</div><p>${esc(a.como_verificar)}</p></div>` : ""}
    <div class="sello-campos">
      ${["fecha", "clase_de_problema", "instancia", "resultado", "metrica", "recipe_id"]
        .filter(k => a[k] != null && a[k] !== "")
        .map(k => `<div><span class="lab">${esc(k)}</span> ${esc(a[k])}</div>`).join("")}
    </div>`;
  // Traerlo a la vista: con sesenta filas, el panel abria fuera de pantalla y el
  // momento de la videollamada se perdia en un scroll.
  panel.scrollIntoView({ behavior: "smooth", block: "center" });
  const btn = $("#ver-hash-btn"), res = $("#ver-hash-res");
  if (btn) btn.onclick = async () => {
    btn.disabled = true;
    // Se baja del espejo de GitHub: Codeberg responde 200 pero NO manda CORS, asi que
    // el navegador no puede leerlo desde aca. Abrirlo en pestana si funciona, y por eso
    // el boton de Codeberg sigue estando: son dos caminos distintos, no uno roto.
    res.innerHTML = `bajando la copia de <code>${esc(new URL(a.github_raw).host)}</code>…`;
    try {
      const r = await fetch(a.github_raw);
      if (!r.ok) throw new Error(`el espejo respondio ${r.status}`);
      const crudo = await r.text();
      const v = await verificarSello(crudo);
      res.innerHTML = v.ok
        ? `<span class="ver-ok">✓ calza</span> · convención <b>${esc(v.convencion)}</b><br>` +
          `<code>${esc(v.calculado)}</code><br>` +
          `<span class="lab">lo recomputó tu navegador, con los bytes que bajaste del espejo</span>`
        : `<span class="ver-mal">✗ no reprodujo el hash declarado</span><br>` +
          `<span class="lab">probé las ${v.probadas.length} convenciones:</span><br>` +
          v.probadas.map(p => `${esc(p.nombre)}: <code>${esc(p.calculado || p.error)}</code>`).join("<br>");
    } catch (e) {
      res.innerHTML = `<span class="ver-mal">no pude bajar la copia:</span> ${esc(e.message)}`;
    }
    btn.disabled = false;
  };
  $("#sello-cerrar").onclick = () => { panel.hidden = true; };
  $("#sello-copiar").onclick = async () => {
    await navigator.clipboard.writeText(a.content_hash || "");
    $("#sello-copiar").textContent = "copiado ✓";
    setTimeout(() => { $("#sello-copiar").textContent = "copiar"; }, 1600);
  };
}

// ------------------------------------------------------------------ maquinas

function pintarMaquinas() {
  const caja = $("#maquinas-cuerpo");
  if (!COSTOS) return;
  const filas = Object.entries(COSTOS.braket).map(([k, d]) => ({ k, ...d }));
  if (COSTOS.ibm) filas.push({ k: "ibm", ...COSTOS.ibm });
  caja.innerHTML = filas.map(d => {
    const val = COSTOS.validez_medida[d.dispositivo];
    return `<tr>
      <td class="c-id">${esc(d.dispositivo)}</td>
      <td>${esc(d.proveedor)}</td>
      <td>${esc(d.region)}</td>
      <td class="n">${num(d.qubits)}</td>
      <td class="n">${d.por_disparo ? usd(d.por_disparo) : "0"}</td>
      <td class="n ${val ? "" : "sinmedir"}">${val ? num(val * 100, 1) + " %" : "sin medir"}</td>
    </tr>`;
  }).join("");
  $("#maquinas-nota").innerHTML =
    `Precios leídos de <a href="${esc(COSTOS.fuente)}">la tabla publicada</a> el ${esc(COSTOS.fecha_precios)}. ` +
    `La validez medida existe para <b>un</b> dispositivo: el resto dice «sin medir», y por eso su costo por medición útil ` +
    `<b>no es calculable</b> — no se estima.`;
}

// --------------------------------------------------------------- laboratorio

function calcularPresupuesto() {
  if (!COSTOS) return;
  const clave = $("#lab-maquina").value;
  const d = clave === "ibm" ? COSTOS.ibm : COSTOS.braket[clave];
  const tareas = Math.max(1, Number($("#lab-tareas").value) || 1);
  const disparos = Math.max(1, Number($("#lab-disparos").value) || 1);
  const total = tareas * d.por_tarea + tareas * disparos * d.por_disparo;
  $("#lab-total").textContent = usd(total);
  $("#lab-desglose").innerHTML =
    `${num(tareas)} tarea(s) × ${usd(d.por_tarea)} + ${num(tareas * disparos)} disparo(s) × ${usd(d.por_disparo)}`;
  // El costo por medicion UTIL solo existe si hay validez medida para ese dispositivo.
  const val = COSTOS.validez_medida[d.dispositivo];
  const utiles = val ? tareas * disparos * val : null;
  $("#lab-util").innerHTML = val
    ? `<b>${usd(total / utiles)}</b> por medición válida <span class="lab">(validez medida ${num(val * 100, 1)} %)</span>`
    : `<b class="sinmedir">no calculable</b> <span class="lab">— no hay validez medida para ${esc(d.dispositivo)}, y no se estima</span>`;
  if (d.recurso_escaso) {
    $("#lab-aviso").textContent = `Costo monetario cero, pero recurso escaso: ${d.recurso_escaso}.`;
    $("#lab-aviso").hidden = false;
  } else $("#lab-aviso").hidden = true;
}

function llenarMaquinasSelect() {
  const sel = $("#lab-maquina");
  const ops = Object.entries(COSTOS.braket).map(([k, d]) => `<option value="${esc(k)}">${esc(d.dispositivo)} · ${esc(d.proveedor)}</option>`);
  if (COSTOS.ibm) ops.push(`<option value="ibm">${esc(COSTOS.ibm.dispositivo)} · ${esc(COSTOS.ibm.proveedor)}</option>`);
  sel.innerHTML = ops.join("");
}

// ------------------------------------------------------------------ arranque

function navegar(id) {
  $$(".vista").forEach(v => { v.hidden = v.id !== "v-" + id; });
  $$(".rail button").forEach(b => b.setAttribute("aria-current", String(b.dataset.v === id)));
  location.hash = id;
}

async function arrancar() {
  // Estado de carga explicito: una tabla vacia mientras la API responde se lee como
  // "no hay corridas", que es falso.
  $("#corridas-den").textContent = "leyendo /v1/runs…";
  $("#archivo-cifras").innerHTML = '<div class="nota">leyendo /v1/state…</div>';
  $$(".rail button").forEach(b => { b.onclick = () => navegar(b.dataset.v); });
  navegar((location.hash || "#archivo").slice(1));

  const [est, cor, cos] = await Promise.all([
    pedir("/v1/state"),
    pedir("/v1/runs?limit=1000"),
    pedir("/consola/costos.json"),
  ]);

  if (est.ok) { ESTADO = est.datos; pintarArchivo(); pintarBiblioteca(); pintarMarco(); }
  else { falla($("#archivo-cifras"), est.error); falla($("#biblioteca-lista"), est.error); }

  if (cor.ok) { CORRIDAS = cor.datos; pintarCorridas(); pintarMarco(); }
  else falla($("#corridas-caja"), cor.error);

  if (cos.ok) { COSTOS = cos.datos; llenarMaquinasSelect(); pintarMaquinas(); calcularPresupuesto(); }
  else { falla($("#maquinas-caja"), cos.error); falla($("#lab-caja"), cos.error); }

  // La barra copiloto filtra las corridas de verdad. NO traduce lenguaje natural a un
  // experimento: no existe ese backend, y un campo que parece hacerlo y no lo hace es
  // peor que uno que dice lo que hace.
  $("#copiloto").addEventListener("submit", ev => {
    ev.preventDefault();
    $("#corridas-filtro").value = $("#copiloto-q").value;
    navegar("corridas");
    pintarCorridas();
  });
  $("#corridas-filtro").addEventListener("input", pintarCorridas);
  $("#corridas-cuerpo").addEventListener("click", e => {
    const b = e.target.closest(".btn-ver");
    if (b) abrirSello(b.dataset.id);
  });
  ["lab-maquina", "lab-tareas", "lab-disparos"].forEach(id =>
    $("#" + id).addEventListener("input", calcularPresupuesto));
}

/**
 * Arranque a prueba de carrera.
 *
 * La primera version solo escuchaba DOMContentLoaded. Si el script se evalua DESPUES de
 * que ese evento ya paso —pasa con el archivo en cache tras una recarga forzada— el
 * oyente no se dispara nunca y la pantalla queda VACIA: sin filas, sin denominador y
 * SIN error, que es la peor de las tres. Lo vi en vivo recargando la consola.
 *
 * Una pantalla vacia sin explicacion es indistinguible de "no hay datos", y esta es la
 * pantalla con la que Nicholas vende.
 */
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", arrancar);
} else {
  arrancar();
}
