/**
 * Espera a que un deploy este propagado, para que lo use CUALQUIER chequeo.
 *
 * POR QUE ES UN MODULO Y NO UNA FUNCION DENTRO DE UN CHEQUEO
 * ----------------------------------------------------------
 * El CI cayo cinco veces con produccion correcta, y cada arreglo fue real pero
 * incompleto:
 *   1-3. la lista de la espera y la de los chequeos eran DOS listas.
 *   4.   era una sola, pero habia que acordarse de agregarle cada endpoint nuevo.
 *        Se paso a derivarla del catalogo.
 *   5.   solo UN chequeo esperaba. El segundo corria despues y pegaba en otro colo,
 *        que todavia servia el Worker viejo — el edge no propaga a todos a la vez.
 *
 * De ahi esto: la espera vive en un lugar y la usan todos los que hablan con
 * produccion. Un chequeo que no espera es un chequeo que va a fallar por suerte.
 *
 * Nunca tapa: si se agota, lo dice y devuelve las rutas que faltan para que el
 * chequeo siga y falle con la salida real.
 *
 * Y ESPERAR UN 200 NO ALCANZA CUANDO CAMBIA EL CONTENIDO. Una pagina responde 200
 * con el HTML viejo igual que con el nuevo. Paso dos veces: la primera la resolvi
 * con una condicion de contenido escrita a mano ("el home ya no dice 450+"), y al
 * extraer esta funcion a un modulo la perdi — una regresion mia. La forma que no
 * depende de acordarse es `esperarVersion`: cada pagina publica el sha del build
 * en <meta name="rq-build">, y se espera a que el edge sirva ESE.
 */

export async function esperarVersion(base, sha, segundos, log = console.log) {
  if (!segundos || !sha) return true;
  const limite = Date.now() + segundos * 1000;
  let visto = null, vueltas = 0;
  while (Date.now() < limite) {
    vueltas++;
    try {
      const html = await (await fetch(base + "/", { redirect: "manual", headers: { "x-rq-check": "1" } })).text();
      visto = (html.match(/name="rq-build" content="([^"]+)"/) || [])[1] || null;
      if (visto && sha.startsWith(visto)) {
        log(`  (el edge ya sirve el build ${visto}, tras ${vueltas} vuelta(s))`);
        return true;
      }
    } catch (e) {}
    await new Promise(res => setTimeout(res, 5000));
  }
  log(`  AVISO: el edge sirve el build ${visto || "(sin marca)"} y se esperaba ${sha.slice(0, 12)} — se chequea igual.`);
  return false;
}
export async function esperarRutas(base, rutas, segundos, log = console.log) {
  if (!segundos) return [];
  const limite = Date.now() + segundos * 1000;
  let faltan = [...rutas], vueltas = 0;
  while (faltan.length && Date.now() < limite) {
    vueltas++;
    const pendientes = [];
    for (const ruta of faltan) {
      try {
        const r = await fetch(base + ruta, {
          redirect: "manual",
          headers: { "User-Agent": "rosetta deploy wait", "x-rq-check": "1" },
        });
        if (r.status !== 200) pendientes.push(ruta);
      } catch (e) { pendientes.push(ruta); }
    }
    faltan = pendientes;
    if (faltan.length) await new Promise(res => setTimeout(res, 5000));
  }
  log(faltan.length
    ? `  AVISO: tras ${vueltas} vuelta(s) siguen sin responder: ${faltan.join(", ")} — se chequea igual y fallara.\n`
    : `  (las ${rutas.length} rutas criticas responden, tras ${vueltas} vuelta(s))\n`);
  return faltan;
}
