#!/usr/bin/env node
/**
 * El contador de visitas cuenta lo que dice contar, y nada mas.
 *
 * Prueba lib/hits.mjs con casos de grito (lo que debe contarse y clasificarse) y de
 * silencio (lo que NO debe contarse: preview, POST, 404, rutas fuera del alcance). Y
 * comprueba que worker.js lo llama en el camino de salida: una funcion probada que nadie
 * invoca es el instrumento enchufado sin ejercer.
 *
 *   node scripts/check-hits.mjs --self-test
 */
import { readFileSync } from "node:fs";
import { claseUA, debeContar, filaVisita, hostReferrer } from "../lib/hits.mjs";

export const CONSUMIDOR = {
  quien: "sesion web de Rosetta",
  hace: "corrige lib/hits.mjs o su llamada en worker.js antes de desplegar",
};

const fallas = [];
const igual = (a, b, que) => { if (a !== b) fallas.push(`${que}: esperaba ${JSON.stringify(b)}, dio ${JSON.stringify(a)}`); };
const req = (u, m = "GET", h = {}) => new Request(u, { method: m, headers: h });
const ok = new Response("x", { status: 200 });

// clasificacion
igual(claseUA("Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.1; +https://openai.com/gptbot)"), "ai:GPTBot", "GPTBot");
igual(claseUA("Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)"), "ai:ClaudeBot", "ClaudeBot gana a anthropic por orden");
igual(claseUA("Mozilla/5.0 (compatible; PerplexityBot/1.0)"), "ai:PerplexityBot", "Perplexity");
igual(claseUA("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"), "search:Googlebot", "Googlebot");
igual(claseUA("Mozilla/5.0 (compatible; bingbot/2.0)"), "search:Bingbot", "bingbot en minuscula");
igual(claseUA("SomeRandomCrawler/3"), "bot:other", "crawler generico");
igual(claseUA("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131 Safari/537.36"), "browser", "navegador");
igual(claseUA(null), "browser", "sin user-agent");

// alcance: grito
for (const p of ["/", "/blog", "/blog/", "/blog/algo-en/", "/es/blog/", "/llms.txt", "/rss.xml"])
  igual(debeContar(req("https://rosettaquantum.com" + p), ok), true, `cuenta ${p}`);
// alcance: silencio
igual(debeContar(req("https://rosetta-quantum-preview.x.workers.dev/blog/"), ok), false, "no cuenta el preview");
igual(debeContar(req("https://rosettaquantum.com/blog/", "POST"), ok), false, "no cuenta POST");
igual(debeContar(req("https://rosettaquantum.com/blog/x/"), new Response("", { status: 404 })), false, "no cuenta 404");
for (const p of ["/services", "/blogger", "/es/", "/v1/state", "/og/x.png", "/informe-pqc/"])
  igual(debeContar(req("https://rosettaquantum.com" + p), ok), false, `no cuenta ${p}`);

// privacidad: ni query string ni referrer completo
const f = filaVisita(req("https://rosettaquantum.com/blog/x-en/?utm_source=li&email=a@b.c",
  "GET", { "user-agent": "ChatGPT-User/1.0", referer: "https://www.linkedin.com/feed/?trk=1" }), new Date("2026-11-09T03:00:00Z"));
igual(f.path, "/blog/x-en/", "la ruta pierde el query string");
igual(f.referrer_host, "www.linkedin.com", "del referrer queda solo el host");
igual(f.day, "2026-11-09", "dia en UTC");
igual(f.ua_class, "ai:ChatGPT-User", "clase del agente");
igual(hostReferrer("no es url"), "", "referrer invalido queda vacio");

// cableado: worker.js lo llama sobre la respuesta final
const w = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
if (!/import\s*\{[^}]*registrarVisita[^}]*\}\s*from\s*["']\.\/lib\/hits\.mjs["']/.test(w)) fallas.push("worker.js no importa registrarVisita");
if (!/registrarVisita\(\s*request\s*,\s*res\s*,\s*env\s*,\s*ctx\s*\)/.test(w)) fallas.push("worker.js no llama registrarVisita(request, res, env, ctx)");
const wr = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
const listas = [...wr.matchAll(/"run_worker_first"\s*:\s*\[([^\]]*)\]/g)].map(m => m[1]);
if (listas.length < 2 || !listas.every(l => /"\/"/.test(l))) fallas.push('run_worker_first no incluye "/" en produccion y en preview: la portada no pasaria por el Worker');

if (fallas.length) { console.error("check-hits: FALLA\n  " + fallas.join("\n  ")); process.exit(1); }
console.log("check-hits: ok (clasificacion, alcance, privacidad y cableado)");
