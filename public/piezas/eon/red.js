// Tendido de la red case118.
//
// La fuente NO trae coordenadas de barras: `bus_geodata` viene vacío en pandapower.
// Así que la posición se calcula aquí con un resorte determinista — mismos datos, mismo
// tendido, siempre. La TOPOLOGÍA es real; la GEOMETRÍA es nuestra, y la pieza lo dice.

export function construirGrafo(topo) {
  const barras = new Set();
  topo.lineas.forEach(l => { barras.add(l.from_bus); barras.add(l.to_bus); });
  topo.trafos.forEach(t => { barras.add(t.hv_bus); barras.add(t.lv_bus); });
  const ids = [...barras].sort((a, b) => a - b);
  const pos = new Map(ids.map((id, i) => [id, i]));
  const aristas = [
    ...topo.lineas.map(l => ({ a: pos.get(l.from_bus), b: pos.get(l.to_bus), idx: l.idx, trafo: false })),
    ...topo.trafos.map(t => ({ a: pos.get(t.hv_bus), b: pos.get(t.lv_bus), idx: null, trafo: true })),
  ];
  return { ids, n: ids.length, aristas, indice: pos };
}

// Resorte de Fruchterman-Reingold en 3D. Arranque determinista sobre una espiral áurea,
// así que no hay azar en ninguna parte: dos visitantes ven exactamente el mismo tendido.
export function tender(grafo, { pasos = 420, area = 150 } = {}) {
  const n = grafo.n;
  const px = new Float64Array(n), py = new Float64Array(n), pz = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    // dentro de la bola, no sobre su superficie: arrancar desde un cascarón hace que el
    // resorte lo colapse en un filamento en vez de repartirse en volumen
    const y = 1 - (i/(n-1))*2, r = Math.sqrt(Math.max(0, 1 - y*y)), th = i*2.399963229728653;
    const rad = area * 0.5 * Math.cbrt((i + 0.5)/n);
    px[i] = Math.cos(th)*r*rad; py[i] = y*rad; pz[i] = Math.sin(th)*r*rad;
  }
  const k = area * Math.pow(1/n, 1/3);
  const dx = new Float64Array(n), dy = new Float64Array(n), dz = new Float64Array(n);
  for (let paso = 0; paso < pasos; paso++) {
    dx.fill(0); dy.fill(0); dz.fill(0);
    for (let i = 0; i < n; i++) for (let j = i+1; j < n; j++) {
      let ux = px[i]-px[j], uy = py[i]-py[j], uz = pz[i]-pz[j];
      let d2 = ux*ux + uy*uy + uz*uz;
      if (d2 < 1e-6) { ux = (i%7)-3; uy = (j%5)-2; uz = (i%3)-1; d2 = ux*ux+uy*uy+uz*uz + 1e-6; }
      const f = (k*k) / d2;
      dx[i] += ux*f; dy[i] += uy*f; dz[i] += uz*f;
      dx[j] -= ux*f; dy[j] -= uy*f; dz[j] -= uz*f;
    }
    for (const e of grafo.aristas) {
      const ux = px[e.a]-px[e.b], uy = py[e.a]-py[e.b], uz = pz[e.a]-pz[e.b];
      const d = Math.sqrt(ux*ux + uy*uy + uz*uz) || 1e-6;
      const f = d / k;
      dx[e.a] -= ux*f; dy[e.a] -= uy*f; dz[e.a] -= uz*f;
      dx[e.b] += ux*f; dy[e.b] += uy*f; dz[e.b] += uz*f;
    }
    const temp = area * 0.10 * (1 - paso/pasos);
    for (let i = 0; i < n; i++) {
      const d = Math.sqrt(dx[i]*dx[i] + dy[i]*dy[i] + dz[i]*dz[i]) || 1e-9;
      const s = Math.min(d, temp) / d;
      px[i] += dx[i]*s; py[i] += dy[i]*s; pz[i] += dz[i]*s;
    }
  }
  // centrar y normalizar la escala, para que el encuadre del hero no dependa del tendido
  let cx = 0, cy = 0, cz = 0;
  for (let i = 0; i < n; i++) { cx += px[i]; cy += py[i]; cz += pz[i]; }
  cx /= n; cy /= n; cz /= n;
  // Escala por el radio TÍPICO y no por el máximo: un solo nodo lejano no debe
  // aplastar a los otros ciento diecisiete.
  const radios = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    px[i] -= cx; py[i] -= cy; pz[i] -= cz;
    radios[i] = Math.hypot(px[i], py[i], pz[i]);
  }
  const orden = [...radios].sort((a, b) => a - b);
  const p90 = orden[Math.floor(0.90 * (n - 1))] || 1;
  const s = area / p90;
  for (let i = 0; i < n; i++) { px[i] *= s; py[i] *= s; pz[i] *= s; }

  // case118 es una red larga de verdad: su extensión es unas tres veces mayor en un eje
  // que en los otros. Eso no se corrige estirando —sería falsear la forma—, se acuesta:
  // el eje más largo pasa a horizontal y el más corto a vertical, que es como se mira un
  // territorio. Es una rotación del tendido calculado, no un cambio de la topología.
  const ejes = [px, py, pz].map((v) => {
    let mn = Infinity, mx = -Infinity;
    for (let i = 0; i < n; i++) { if (v[i] < mn) mn = v[i]; if (v[i] > mx) mx = v[i]; }
    return { v, ext: mx - mn };
  }).sort((a, b) => b.ext - a.ext);
  const X = ejes[0].v, Z = ejes[1].v, Y = ejes[2].v;

  const caja = { x: ejes[0].ext, y: ejes[2].ext, z: ejes[1].ext };
  return { px: X, py: Y, pz: Z, caja };
}
