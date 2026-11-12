/*
 * «Descargar mi informe» tras medir (12-nov-2026), en /es/q-ready/medicion y /q-ready/medicion.
 *
 * Se pide el correo y el visitante elige:
 *  - Descargarlo aquí: la versión imprimible de esta misma página (@media print), que el navegador
 *    guarda como PDF. NO es el PDF del servidor: ése sólo lo arma el VPS y sólo viaja por correo
 *    (los informes de cliente nunca se sirven desde la web: decisión del 21-ago).
 *  - Recibirlo en su correo: el PDF del VPS, por la misma cola de siempre (lib/envio-informe.mjs).
 *    Sólo en español y sólo si el servidor tiene el envío encendido (/api/medicion/envio/estado).
 *
 * En los dos casos el pedido (dominio, correo, elección, consentimiento, fecha) se guarda en D1
 * ANTES de hacer nada (POST /api/medicion/descarga, lib/captacion.mjs), con Turnstile. Si el
 * servidor no confirma la fila, no se imprime ni se promete nada.
 */
import { delServidor } from "./medicion-palabras.mjs";

const EN = document.documentElement.lang === "en";
const t = (es, en) => (EN ? en : es);
const $ = (id) => document.getElementById(id);
const form = $("mv-envio");
if (form) {
  let medicion = null, ts = null, correoActivo = false;
  const est = $("mv-envio-estado"), ir = $("mv-envio-ir");
  const decir = (txt, mal) => { est.textContent = txt; est.classList.toggle("mv-mal", !!mal); };
  const opCorreo = form.querySelector('input[name="mv-eleccion"][value="correo"]');

  // El correo: en inglés no, porque el PDF y el correo del servidor están en español
  // (vps/sonda-correo/informe_pdf.py); en español, sólo si el servidor puede enviarlo.
  const ponerCorreo = (activo, nota) => {
    correoActivo = activo; opCorreo.disabled = !activo;
    $("mv-op-correo").classList.toggle("mv-op-apagada", !activo);
    if (nota) $("mv-op-correo-nota").textContent = nota;
    if (!activo && opCorreo.checked) form.querySelector('input[value="descargar"]').checked = true;
  };
  if (EN) ponerCorreo(false, "The emailed PDF is only available in Spanish for now.");
  else {
    ponerCorreo(false, "El envío por correo no está disponible en este momento.");
    fetch("/api/medicion/envio/estado").then((r) => r.json()).then((j) => { if (j?.activo) ponerCorreo(true, "El PDF que arma nuestro servidor, en unos minutos."); }).catch(() => {});
  }

  const abrir = () => {
    if (!medicion) return;
    $("mv-envio-pasos").hidden = false;
    $("mv-descargar").hidden = true;
    if (!ts && window.rqTurnstile) ts = window.rqTurnstile.montar($("mv-ts"));
    $("mv-envio-email").focus({ preventScroll: true });
  };
  $("mv-descargar").addEventListener("click", abrir);
  $("mv-listo-ir")?.addEventListener("click", (e) => {
    e.preventDefault();
    form.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    abrir();
  });

  async function esperarEnvio(id, email) {
    for (let i = 0; i < 45; i++) {
      await new Promise((ok) => setTimeout(ok, 2000));
      const g = await fetch(`/api/medicion/envio/${id}`).then((x) => x.json()).catch(() => null);
      if (g?.estado === "enviado") return decir(t(`Listo: el informe va camino a ${email}.`, `Done: the report is on its way to ${email}.`));
      if (g?.estado === "fallido") { decir(t("No pudimos enviarlo. Escríbanos a hello@rosettaquantum.com y se lo mandamos.", "We could not send it. Write to hello@rosettaquantum.com and we will send it to you."), true); ir.disabled = false; return; }
    }
    decir(t("Su pedido quedó registrado; el informe le llegará en los próximos minutos.", "Your request was recorded; the report will reach you in the next few minutes."));
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("mv-envio-email").value.trim();
    const eleccion = form.querySelector('input[name="mv-eleccion"]:checked')?.value || "descargar";
    if (!medicion?.foto) return decir(t("Primero mida un dominio.", "Measure a domain first."), true);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { $("mv-envio-email").focus(); return decir(t("Escriba un correo válido.", "Enter a valid email address."), true); }
    if (!$("mv-envio-acepto").checked) return decir(t("Para continuar necesitamos que acepte guardar su correo.", "To continue we need you to accept that we store your email."), true);
    if (eleccion === "correo" && !correoActivo) return decir(t("El envío por correo no está disponible: elija descargarlo aquí.", "Email delivery is not available: choose to download it here."), true);
    ir.disabled = true; decir(t("Verificando…", "Verifying…"));
    const token = ts ? await ts.esperarToken() : null;
    if (!token) { decir(t("No pudimos verificar que es una persona. Recargue la página e intente de nuevo.", "We could not verify that you are a person. Reload the page and try again."), true); ir.disabled = false; return; }
    try {
      const cuerpo = { email, dominio: medicion.dominio, eleccion, acepta: true, turnstile: token, lang: EN ? "en" : "es" };
      if (eleccion === "correo") Object.assign(cuerpo, { foto: medicion.foto, correo_id: medicion.s?.correo_tls?.id || null });
      const r = await fetch("/api/medicion/descarga", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(cuerpo) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) {
        decir(j.error ? t(j.error, delServidor(j.error, "en") + ".") : t(`No pudimos registrar su pedido (el servicio respondió ${r.status}).`, `We could not record your request (the service returned ${r.status}).`), true);
        if (ts) ts.reiniciar(); ir.disabled = false; return;
      }
      if (eleccion === "descargar") {
        decir(t("Listo. En la ventana de impresión, elija «Guardar como PDF».", "Done. In the print dialog, choose “Save as PDF”."));
        ir.disabled = false; if (ts) ts.reiniciar();
        window.print();
        return;
      }
      decir(t("Pedido registrado. Enviando…", "Request recorded. Sending…"));
      await esperarEnvio(j.envio_id, email);
    } catch {
      decir(t("No pudimos conectar. Revise su conexión e intente de nuevo.", "We could not connect. Check your connection and try again."), true);
      if (ts) ts.reiniciar(); ir.disabled = false;
    }
  });

  window.addEventListener("mv:medido", (ev) => {
    medicion = ev.detail;
    $("mv-envio-dom").textContent = ev.detail.dominio;
    $("mv-listo-dom").textContent = ev.detail.dominio;
    ir.disabled = false; est.textContent = "";
  });
}
