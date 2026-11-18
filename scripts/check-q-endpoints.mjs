#!/usr/bin/env node

export const CONSUMIDOR = {
  quien: "quien despliega el Worker",
  hace: "no despliega: /api/q/event contestaria mal (o escribiria con una aridad distinta a la del INSERT, que falla recien en produccion) y /api/q/stats entregaria el embudo sin exigir la clave",
};
// Los dos endpoints ejercidos de verdad, con una base simulada que GUARDA lo que se le pasa.
// Esto prueba lo que las funciones puras no pueden: la ruta completa del handler, la aridad real
// del bind, los codigos de estado, y que un fallo de la base no se vea desde afuera.
const { manejarEvento, manejarStats, ipHash } = await import(
  "../lib/q-eventos.mjs"
);

const escrito = [];
const baseFalsa = (romper = false) => ({
  prepare(sql) {
    return {
      bind(...v) { return { run: async () => { if (romper) throw new Error("D1 caida"); escrito.push({ sql, v }); return { ok: true }; } }; },
      all: async () => ({ results: [{ ev: "view", side: null, n: 3 }] }),
    };
  },
  batch: async (stmts) => stmts.map(() => ({ results: [{ dia: "2026-11-18", n: 3, visitantes: 2 }] })),
});

const pedir = (cuerpo, headers = {}) => ({
  method: "POST",
  url: "https://rosettaquantum.com/api/q/event",
  headers: { get: (k) => headers[k.toLowerCase()] ?? null },
  json: async () => cuerpo,
});

const ctx = { waitUntil: (p) => p };
let fallos = 0;
const ok = (c, m) => { if (!c) { console.error("   FALLA:", m); fallos++; } };

// 1. un evento valido: 204 y UNA fila, con 15 valores
{
  escrito.length = 0;
  const r = await manejarEvento(pedir({ ev: "view", side: "lab", utm_source: "google" }, {
    "user-agent": "Mozilla/5.0 Chrome/131.0", "referer": "https://ads.google.com/x", "cf-connecting-ip": "1.2.3.4",
  }), { DB: baseFalsa(), Q_IP_SALT: "sal-de-prueba" }, ctx);
  ok(r.status === 204, `un evento valido deberia dar 204 y dio ${r.status}`);
  ok(escrito.length === 1, `deberia escribir una fila y escribio ${escrito.length}`);
  ok(escrito[0]?.v.length === 15, `deberia pasar 15 valores y paso ${escrito[0]?.v.length}`);
  ok(escrito[0]?.v.includes("google"), "la campana no llego a la fila");
  ok(escrito[0]?.v.includes("browser"), "la clase del agente no llego a la fila");
  ok(!escrito[0]?.v.some((x) => String(x).includes("Mozilla")), "el user-agent CRUDO llego a la fila");
  ok(!escrito[0]?.v.includes("1.2.3.4"), "la IP CRUDA llego a la fila");
  ok(escrito[0]?.v.some((x) => /^[0-9a-f]{16}$/.test(String(x))), "falta el ip_hash");
}

// 2. un evento invalido: 400 y NADA escrito
{
  escrito.length = 0;
  const r = await manejarEvento(pedir({ ev: "inventado" }), { DB: baseFalsa() }, ctx);
  ok(r.status === 400, `un ev invalido deberia dar 400 y dio ${r.status}`);
  ok(escrito.length === 0, "un evento invalido no puede escribir");
}

// 3. la base caida: 204 igual, porque un pixel roto no es noticia para el visitante
{
  const r = await manejarEvento(pedir({ ev: "view" }), { DB: baseFalsa(true) }, ctx);
  ok(r.status === 204, `con la base caida deberia dar 204 y dio ${r.status}`);
}

// 4. sin NINGUNA semilla: se escribe igual, pero sin ip_hash (nunca una sal fija)
{
  escrito.length = 0;
  await manejarEvento(pedir({ ev: "view" }, { "cf-connecting-ip": "1.2.3.4" }), { DB: baseFalsa() }, ctx);
  ok(escrito[0]?.v.at(-1) === null, `sin semilla el ip_hash deberia ir vacio y fue ${escrito[0]?.v.at(-1)}`);
}

// 4b. con la semilla que YA existe (MEDICION_SAL_IP) y sin Q_IP_SALT: se mide igual. Sin esto,
// el embudo queda colgado de un secreto que alguien tiene que acordarse de poner, y mientras
// tanto dice "visitantes: 0" sin que nada avise de que es un cero falso.
{
  escrito.length = 0;
  await manejarEvento(pedir({ ev: "view" }, { "cf-connecting-ip": "1.2.3.4" }), { DB: baseFalsa(), MEDICION_SAL_IP: "la-que-ya-estaba" }, ctx);
  ok(/^[0-9a-f]{16}$/.test(String(escrito[0]?.v.at(-1))), "con MEDICION_SAL_IP sola tendria que haber ip_hash");
}

// 4c. y reusar la semilla NO reusa el hash. `mediciones_agentes` hashea con la semilla CRUDA
// (sal fija, o sea un identificador permanente por persona); aqui se hashea con la semilla MAS el
// dia. Lo que se mide es que el dia entre de verdad: si alguien quita el `:${dia}`, el hash del
// embudo cae sobre la semilla cruda y hereda ese identificador permanente, ademas de volverse
// cruzable con la otra tabla. No se importa `medicion-agentes.mjs` porque arrastra `cloudflare:`
// y no carga en Node; se compara contra la misma funcion de este modulo, que es lo que importa.
{
  const SEM = "la-que-ya-estaba";
  escrito.length = 0;
  await manejarEvento(pedir({ ev: "view" }, { "cf-connecting-ip": "1.2.3.4" }), { DB: baseFalsa(), MEDICION_SAL_IP: SEM }, ctx);
  const delEmbudo = String(escrito[0]?.v.at(-1));
  ok(delEmbudo !== String(await ipHash("1.2.3.4", SEM)), "el ip_hash se calculo con la semilla CRUDA: no rota, y es un identificador permanente");
  ok(delEmbudo === String(await ipHash("1.2.3.4", `${SEM}:${new Date().toISOString().slice(0, 10)}`)), "el ip_hash no se calculo con semilla + dia");
}

// 5. stats: 401 sin clave, 401 con la equivocada, 503 sin configurar, 200 con la correcta
{
  const get = (h) => ({ method: "GET", url: "https://x/api/q/stats", headers: { get: (k) => (k.toLowerCase() === "authorization" ? h : null) } });
  ok((await manejarStats(get(null), { DB: baseFalsa(), Q_STATS_KEY: "k" })).status === 401, "sin clave deberia dar 401");
  ok((await manejarStats(get("Bearer otra"), { DB: baseFalsa(), Q_STATS_KEY: "k" })).status === 401, "con la clave equivocada deberia dar 401");
  ok((await manejarStats(get("Bearer k"), { DB: baseFalsa() })).status === 503, "sin clave configurada deberia dar 503, no 200");
  const r = await manejarStats(get("Bearer k"), { DB: baseFalsa(), Q_STATS_KEY: "k" });
  ok(r.status === 200, `con la clave correcta deberia dar 200 y dio ${r.status}`);
  const j = await r.json();
  ok(j.ok === true && j.desde && j.limites?.length >= 3, "el resultado tiene que traer su ventana y sus limites");
  ok(r.headers.get("cache-control") === "no-store", "una lectura con clave no se cachea");
}

console.log(fallos ? `\n${fallos} fallo(s)` : "\nlos dos endpoints: 204/400/503/401/200 como se espera, 15 valores, sin UA crudo y sin IP cruda.");
process.exit(fallos ? 1 : 0);
