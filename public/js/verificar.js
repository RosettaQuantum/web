/**
 * /verify — recomputa el sello de un artefacto EN EL NAVEGADOR del lector.
 *
 * LA PRIMERA VERSION DE ESTA PAGINA NO VERIFICABA NADA
 * ---------------------------------------------------
 * Prometia "baja el archivo y recomputamos su sha256". Lo probe contra un artefacto real
 * —RQ-EXP-HSBC-Q-002— y no calzaba: el archivo da 829db084… y el ledger declara
 * 2c52b228…. Habria salido una pagina que le dice al lector "no coinciden" sobre nuestros
 * propios sellos, con la herramienta que nosotros le dimos. Es el fallo que esta casa ya
 * pago dos veces (la API mandando a un /api-docs que daba 404; cuatro sellos citando
 * archivos de procedencia no publicados) y el que la §1 bis existe para evitar.
 *
 * LO QUE ES DE VERDAD content_hash
 * --------------------------------
 * NO es el sha256 del archivo. Es el sha256 de su forma canonica: el documento SIN
 * meta.content_hash, SIN meta.schema y SIN storage, serializado con JCS (RFC 8785).
 * Comprobado aqui, contra el artefacto de arriba:
 *     JCS(podado)  ->  sha256:2c52b228bb8b03e5e434d671e7de4439e84adc1daf8d810e66feb54c3a67906f
 *     = exactamente lo que declara el ledger.
 * Las otras tres formas naturales (bytes crudos, JCS del documento entero, stringify
 * indentado) dan hashes distintos. Adivinar la receta era garantizar el MISMATCH.
 *
 * jcs.mjs es EL MISMO ARCHIVO que usa el laboratorio (copiado byte a byte de
 * scripts/lib/jcs.mjs, sha256 26f77b81…), no una reimplementacion: una segunda version
 * escrita a ojo se desviaria en el primer flotante raro y nadie lo notaria.
 *
 * PUNTO CIEGO DECLARADO: el archivo tiene CUATRO convenciones de sellado historicas.
 * Esta pagina implementa la v3/JCS, que es la vigente. Para las tres anteriores, la
 * herramienta oficial (verificar.py, en el repo de evidencia) las prueba todas y dice
 * con cual calzo. La pagina lo dice cuando no calza, en vez de afirmar que el sello esta
 * mal.
 */
import { jcs } from "/js/lib/jcs.mjs";

const ES = document.documentElement.lang === "es";
const $ = (id) => document.getElementById(id);
const out = $("vOut");
if (out) {
  const T = ES
    ? { calc:"sha256 recomputado aquí:", decl:"declarado en el ledger:",
        ok:"Coinciden. El artefacto es exactamente el que se selló.",
        mal:"NO coinciden bajo la convención v3/JCS. Puede ser un artefacto sellado con una convención anterior: verificar.py las prueba las cuatro.",
        falta:"Elige un artefacto de la lista, o pega un id del ledger.",
        leyendo:"leyendo el artefacto…", nohay:"No se pudo leer ese artefacto." }
    : { calc:"sha256 recomputed here:", decl:"declared in the ledger:",
        ok:"They match. This artifact is exactly the one that was sealed.",
        mal:"They do NOT match under the v3/JCS convention. It may be sealed under an earlier one: verificar.py tries all four.",
        falta:"Pick an artifact from the list, or paste a ledger id.",
        leyendo:"reading the artifact…", nohay:"That artifact could not be read." };

  const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  const sha256 = async (texto) => "sha256:" + hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto)));

  // La poda es la convencion, no una preferencia: estos tres campos se escriben DESPUES
  // de calcular el hash, asi que incluirlos seria pedirle al hash que se contenga a si mismo.
  function podar(doc) {
    const d = JSON.parse(JSON.stringify(doc));
    if (d.meta) { delete d.meta.content_hash; delete d.meta.schema; }
    delete d.storage;
    return d;
  }

  // La lista sale del propio ledger: un id escrito a mano deja de existir y la pagina
  // pasaria a verificar un 404.
  const sel = $("vId");
  fetch("/v1/runs?limit=25", { headers: { accept: "application/json" } })
    .then((r) => r.json())
    .then((d) => {
      (d.items || []).forEach((x) => {
        const o = document.createElement("option");
        o.value = x.id; o.textContent = `${x.id} · ${x.tipo || ""} · ${x.fecha || ""}`;
        o.dataset.hash = x.content_hash || "";
        sel.appendChild(o);
      });
    })
    .catch(() => {});

  $("vGo").addEventListener("click", async () => {
    const id = (($("vIdLibre").value || "").trim()) || sel.value;
    if (!id) { out.innerHTML = `<span class="ver-mal">${T.falta}</span>`; return; }
    out.textContent = T.leyendo;
    try {
      const raw = await (await fetch(`/v1/archive/${encodeURIComponent(id)}/raw`)).json();
      const meta = await (await fetch(`/v1/archive/${encodeURIComponent(id)}`)).json().catch(() => null);
      const declarado = (meta && (meta.content_hash || (meta.item && meta.item.content_hash))) ||
        (sel.selectedOptions[0] && sel.selectedOptions[0].dataset.hash) || "";
      const calculado = await sha256(jcs(podar(raw)));
      const igual = declarado && calculado === declarado;
      out.innerHTML =
        `${T.calc} <b>${calculado}</b><br>${T.decl} <b>${declarado || "—"}</b><br>` +
        `<b class="${igual ? "ver-ok" : "ver-mal"}">${igual ? T.ok : T.mal}</b>`;
    } catch (e) {
      out.innerHTML = `<span class="ver-mal">${T.nohay}</span>`;
    }
  });
}
