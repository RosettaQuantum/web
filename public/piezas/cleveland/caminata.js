// Caminata cuántica de tiempo continuo sobre la red de contactos.
//
// TODO ESTO SE CALCULA EN EL NAVEGADOR. Lo único que viene sellado son las coordenadas
// y los parámetros de la red (corte y sigma), que se leen de /v1/structures — no se
// recuerdan. Al terminar de armarse, la caminata se contrasta contra el valor sellado:
// si el ranking no coincide, se dice, no se maquilla.

export function parametrosDeRed(estructura) {
  const corte = estructura?.red?.corte_angstrom;
  const m = /sigma\s*=\s*([0-9.]+)/i.exec(estructura?.red?.peso || '');
  if (typeof corte !== 'number' || !m) return null;      // sin parámetros no se inventa
  return { corte, sigma: parseFloat(m[1]), texto: estructura.red.peso };
}

// Lista de adyacencia con peso gaussiano, tal como la declara la receta.
export function construirRed(coords, { corte, sigma }) {
  const n = coords.length;
  const vec = Array.from({ length: n }, () => []);
  const c2 = corte * corte, dos2 = 2 * sigma * sigma;
  for (let i = 0; i < n; i++) {
    const [xi, yi, zi] = coords[i];
    for (let j = i + 1; j < n; j++) {
      const [xj, yj, zj] = coords[j];
      const d2 = (xi-xj)**2 + (yi-yj)**2 + (zi-zj)**2;
      if (d2 > c2) continue;
      const w = Math.exp(-d2 / dos2);
      vec[i].push([j, w]); vec[j].push([i, w]);
    }
  }
  const grado = vec.map(l => l.reduce((s, [, w]) => s + w, 0));
  return { n, vec, grado };
}

// y = H x, con H = A (adyacencia) o H = L (laplaciano D − A)
function porH(red, xr, xi, yr, yi, laplaciano) {
  const { n, vec, grado } = red;
  for (let i = 0; i < n; i++) {
    let sr = 0, si = 0;
    const l = vec[i];
    for (let k = 0; k < l.length; k++) { const [j, w] = l[k]; sr += w * xr[j]; si += w * xi[j]; }
    if (laplaciano) { yr[i] = grado[i]*xr[i] - sr; yi[i] = grado[i]*xi[i] - si; }
    else { yr[i] = sr; yi[i] = si; }
  }
}

export function nuevoEstado(red, fuente) {
  const { n } = red;
  const psiR = new Float64Array(n), psiI = new Float64Array(n);
  const a = 1 / Math.sqrt(fuente.length);
  fuente.forEach(i => { psiR[i] = a; });
  return { psiR, psiI, t: 0, tmp: Array.from({ length: 8 }, () => new Float64Array(n)) };
}

// Un paso de Runge-Kutta 4 sobre i·dψ/dt = Hψ  →  dψ/dt = −i·Hψ
export function paso(red, est, dt, laplaciano) {
  const { n } = red, { psiR, psiI, tmp } = est;
  const [k1r,k1i,k2r,k2i,k3r,k3i,ar,ai] = tmp;
  const deriv = (xr, xi, or_, oi) => {           // −i H x  =  (H x)_i·(−i)
    porH(red, xr, xi, or_, oi, laplaciano);
    for (let i = 0; i < n; i++) { const re = or_[i], im = oi[i]; or_[i] = im; oi[i] = -re; }
  };
  deriv(psiR, psiI, k1r, k1i);
  for (let i = 0; i < n; i++) { ar[i] = psiR[i] + dt/2*k1r[i]; ai[i] = psiI[i] + dt/2*k1i[i]; }
  deriv(ar, ai, k2r, k2i);
  for (let i = 0; i < n; i++) { ar[i] = psiR[i] + dt/2*k2r[i]; ai[i] = psiI[i] + dt/2*k2i[i]; }
  deriv(ar, ai, k3r, k3i);
  for (let i = 0; i < n; i++) { ar[i] = psiR[i] + dt*k3r[i]; ai[i] = psiI[i] + dt*k3i[i]; }
  const [k4r, k4i] = [new Float64Array(n), new Float64Array(n)];
  deriv(ar, ai, k4r, k4i);
  for (let i = 0; i < n; i++) {
    psiR[i] += dt/6*(k1r[i] + 2*k2r[i] + 2*k3r[i] + k4r[i]);
    psiI[i] += dt/6*(k1i[i] + 2*k2i[i] + 2*k3i[i] + k4i[i]);
  }
  est.t += dt;
}

export function probabilidad(est, salida) {
  const { psiR, psiI } = est;
  for (let i = 0; i < psiR.length; i++) salida[i] = psiR[i]*psiR[i] + psiI[i]*psiI[i];
  return salida;
}

// Promedio temporal sobre la ventana declarada por la receta.
export function promedioEnVentana(red, fuente, [t0, t1], laplaciano, dt = 0.01) {
  const est = nuevoEstado(red, fuente);
  const acc = new Float64Array(red.n), p = new Float64Array(red.n);
  let muestras = 0;
  while (est.t < t1) {
    paso(red, est, dt, laplaciano);
    if (est.t >= t0) { probabilidad(est, p); for (let i = 0; i < red.n; i++) acc[i] += p[i]; muestras++; }
  }
  for (let i = 0; i < red.n; i++) acc[i] /= muestras || 1;
  return acc;
}

export function spearman(a, b) {
  const rango = (v) => {
    const o = Array.from(v, (x, i) => [x, i]).sort((p, q) => p[0]-q[0]);
    const r = new Float64Array(v.length);
    o.forEach(([, i], k) => { r[i] = k; });
    return r;
  };
  const ra = rango(a), rb = rango(b), n = a.length;
  let ma = 0, mb = 0;
  for (let i = 0; i < n; i++) { ma += ra[i]; mb += rb[i]; }
  ma /= n; mb /= n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    const x = ra[i]-ma, y = rb[i]-mb;
    num += x*y; da += x*x; db += y*y;
  }
  return num / Math.sqrt(da*db);
}
