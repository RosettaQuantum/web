/*
 * /es/q-ready/borde — la medición en vivo (29-oct-2026).
 * Una llamada a /api/borde y los cuatro pasos se llenan EN ORDEN, cada uno con el tiempo que
 * de verdad tardó su saludo (lo mide el servidor, no esta página). Un paso que no se pudo
 * medir dice «sin respuesta»: nunca se muestra como «no soporta».
 */
(() => {
  const $ = (id) => document.getElementById(id);
  const form = $('bv-form'); if (!form) return;
  const input = $('bv-host'), boton = $('bv-ir'), estado = $('bv-estado');
  const paso = (k) => document.querySelector(`[data-paso="${k}"]`);
  let ultimo = null;

  const decir = (t, mal) => { estado.textContent = t; estado.hidden = !t; estado.classList.toggle('bv-mal', !!mal); };
  const limpiar = () => {
    document.querySelectorAll('.bv-pasos li').forEach((li) => {
      li.className = ''; li.querySelector('[data-r]').textContent = ''; li.querySelector('[data-ms]').textContent = '';
    });
    $('bv-veredicto').hidden = true;
  };
  const pinta = (k, clase, texto, ms) => {
    const li = paso(k); li.className = clase;
    li.querySelector('[data-r]').innerHTML = texto;
    li.querySelector('[data-ms]').textContent = ms != null ? `${ms} ms` : '';
  };
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  const sinRespuesta = (s) => s.error ? `Sin respuesta del servidor (${s.error}). No hay veredicto en este paso.` : null;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const host = input.value.trim() || input.placeholder;
    limpiar(); decir(''); boton.disabled = true;
    ['dns', 'A', 'B', 'C'].forEach((k) => { paso(k).className = 'bv-espera'; });
    let j;
    try {
      const r = await fetch('/api/borde', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ host }) });
      j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) { limpiar(); decir(j.error || 'No pudimos medir ese dominio.', true); boton.disabled = false; return; }
    } catch {
      limpiar(); decir('No pudimos conectar con el servicio de medición. Revise su conexión e intente de nuevo.', true);
      boton.disabled = false; return;
    }
    ultimo = j;
    const S = j.saludos;

    // 1 · CDN
    const cad = (j.dns.cadena || []).map((c) => `<code>${c}</code>`).join(' → ');
    pinta('dns', 'bv-neutro', `<b>${j.dns.cdn || 'sin dato'}</b>${cad ? `<br>${cad}` : ''}`, null);
    await espera(450);
    // 2 · como un navegador
    const a = S.A_como_navegador;
    pinta('A', sinRespuesta(a) ? 'bv-no' : 'bv-neutro', sinRespuesta(a) ||
      (j.veredicto.pide_mejora ? 'Pidió <code>X25519MLKEM768</code>: pagó un viaje extra para pasar al híbrido.'
        : `Usó <code>${a.grupo || a.alerta}</code>. Aceptó la llave clásica para ahorrarse un viaje: esto no dice que no soporte el híbrido.`), a.ms);
    await espera(450);
    // 3 · sólo híbrido → SOPORTA
    const b = S.B_solo_hibrido;
    pinta('B', sinRespuesta(b) ? 'bv-no' : (j.veredicto.soporta ? 'bv-si' : 'bv-no'), sinRespuesta(b) ||
      (j.veredicto.soporta ? 'Lo pidió: <b>soporta el intercambio post-cuántico.</b>'
        : `Rechazó el saludo (${b.alerta || b.grupo || 'sin híbrido'}): <b>no soporta el intercambio post-cuántico.</b>`), b.ms);
    await espera(450);
    // 4 · libre elección
    const c = S.C_eleccion_libre;
    pinta('C', sinRespuesta(c) ? 'bv-no' : (j.veredicto.elige ? 'bv-si' : 'bv-neutro'), sinRespuesta(c) ||
      (j.veredicto.elige ? 'Eligió <code>X25519MLKEM768</code>, el híbrido.' : `Eligió <code>${c.grupo || c.alerta}</code>.`), c.ms);
    await espera(350);

    // Veredicto
    const v = j.veredicto;
    $('bv-v-titulo').textContent = v.soporta === true ? `${j.host} ya negocia criptografía post-cuántica.`
      : v.soporta === false ? `${j.host} todavía no negocia criptografía post-cuántica.`
      : `No pudimos obtener un veredicto para ${j.host}.`;
    const items = [];
    if (v.soporta != null) items.push(v.soporta ? 'Soporta X25519MLKEM768 (paso 3).' : 'No soporta X25519MLKEM768 (paso 3).');
    if (v.elige != null) items.push(v.elige ? 'Lo elige cuando puede elegir (paso 4).' : 'Con libertad, elige el clásico (paso 4).');
    if (v.pide_mejora != null) items.push(v.pide_mejora ? 'Lo pide incluso si el cliente llega con la llave clásica (paso 2).' : 'No lo pide si el cliente llega con la llave clásica (paso 2).');
    $('bv-v-lista').innerHTML = items.map((t) => `<li>${t}</li>`).join('');
    $('bv-cuando').textContent = j.medido_utc.replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
    $('bv-huella').textContent = j.sha256;
    $('bv-veredicto').hidden = false;
    boton.disabled = false;
  });

  $('bv-copiar').addEventListener('click', async () => {
    if (!ultimo) return;
    const texto = JSON.stringify(ultimo, null, 2);
    try { await navigator.clipboard.writeText(texto); decir('Resultado copiado.'); }
    catch { decir('No se pudo copiar automáticamente. Seleccione la huella para copiarla.', true); }
  });
})();
