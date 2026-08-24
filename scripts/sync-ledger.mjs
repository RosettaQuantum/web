// Pulls the ledger from the D1 `rosettaq-ledger` at build time -> src/data/ledger.json.
// Uses `wrangler d1 execute` (authenticated in Claude Code). Falls back to the committed
// snapshot if D1 is unreachable, so the build never breaks.
// NOTE: `recipes` has NO is_demo column; a recipe's demo status derives from its
// verdict AND its experiments. Published = verdicts that are not demo.
// Set LEDGER_DUMP=<file.json> to feed the same transform from a saved D1 dump
// ({recipes:[],verdicts:[],experiments:[]}) instead of hitting the network. That keeps
// one single transformation path: whoever regenerates the snapshot by hand produces
// byte-identical output to the build.
import { execSync } from 'node:child_process';
import { writeFileSync, readFileSync } from 'node:fs';

const DB = 'rosettaq-ledger';
// --stdout: emite el JSON por stdout sin tocar el archivo commiteado. Lo usa
// check-ledger-deriva.mjs para comparar el snapshot contra D1 por ESTA misma ruta de
// transformacion, en vez de tener su propia copia de las consultas (§5 bis 3).
const STDOUT = process.argv.includes('--stdout');
const DUMP = process.env.LEDGER_DUMP
  ? JSON.parse(readFileSync(process.env.LEDGER_DUMP, 'utf8'))
  : null;
const q = (sql) => {
  if (DUMP) {
    const table = /FROM\s+(\w+)/i.exec(sql)[1];
    if (!DUMP[table]) throw new Error(`LEDGER_DUMP has no table "${table}"`);
    return DUMP[table];
  }
  return JSON.parse(
    execSync(`npx wrangler d1 execute ${DB} --remote --json --command "${sql}"`, { stdio: ['ignore','pipe','pipe'] }).toString()
  )[0].results;
};

try {
  const recipes  = q('SELECT id,name,problem_class,vertical,algorithm,qubits_required,status FROM recipes ORDER BY id');
  const verdicts = q('SELECT recipe_id,outcome,crossover,summary,is_demo FROM verdicts');
  const exps     = q('SELECT recipe_id,instance,quantum_json,classical_json,seed,raw_data_url FROM experiments');
  const published = verdicts.filter(v => !v.is_demo).length;

  const out = {
    // PROCEDENCIA — de donde salio este archivo y cuando. Lo pidio la sesion Comercial
    // (2026-08-24) con el argumento exacto: "el snapshot del repo dice 48 y produccion
    // dice 48, asi que no se si el ultimo build leyo D1 o se quedo con el snapshot".
    // Sin esto la pregunta solo se contesta leyendo el log del build, que caduca; con
    // esto la contesta el propio artefacto. `snapshot` significa que D1 no respondio y
    // esto es una copia vieja republicada: en CI el deploy se detiene antes de llegar
    // ahi, y en local queda declarado en vez de invisible.
    _procedencia: { fuente: 'd1', fecha: new Date().toISOString() },
    // `sealed` is derived from the experiments table, never hardcoded: the counter
    // must not be able to lead the evidence.
    counter: { pipeline: recipes.length, published, sealed: exps.length },
    recipes: recipes.map(r => {
      const v = verdicts.find(x => x.recipe_id === r.id);
      const e = exps.filter(x => x.recipe_id === r.id).map(x => ({
        instance: x.instance,
        q: (() => { const j = JSON.parse(x.quantum_json||'{}'); return `${j.framework||'?'} · ${j.result ?? ''}`; })(),
        c: (() => { const j = JSON.parse(x.classical_json||'{}'); return `${j.framework||'?'} · ${j.result ?? ''}`; })(),
        // seed stays null for deterministic runs (the molecular grid has no RNG);
        // the page renders that as "deterministic" rather than inventing a number.
        seed: x.seed,
        url: x.raw_data_url || null,
      }));
      return {
        id: r.id, name_en: r.name, name_es: r.name,
        class_en: r.problem_class, class_es: r.problem_class,
        vertical: r.vertical, algorithm: r.algorithm, qubits: r.qubits_required, status: r.status,
        // Demo = there is nothing measured behind it. A recipe with sealed experiments
        // is never a demo, even if it has no verdict yet: the data is real, the verdict
        // is simply not called. Only recipes with zero experiments and no real verdict
        // stay flagged as illustrative.
        is_demo: e.length ? false : (v ? !!v.is_demo : true),   // derived, not from recipes
        ...(v ? { verdict: { outcome: v.outcome, crossover_en: v.crossover, crossover_es: v.crossover, summary_en: v.summary, summary_es: v.summary } } : {}),
        ...(e.length ? { experiments: e } : {}),
      };
    }),
  };
  if (STDOUT) {
    // Modo comparacion (check-ledger-deriva.mjs): el JSON va a stdout y el archivo
    // commiteado NO se toca. El log va a stderr para que stdout quede JSON puro.
    process.stdout.write(JSON.stringify(out, null, 2));
    console.error(`[sync-ledger] --stdout: ${recipes.length} recipes, ${verdicts.length} verdicts (${published} published) desde D1`);
  } else {
    writeFileSync('src/data/ledger.json', JSON.stringify(out, null, 2));
    console.log(`[sync-ledger] pulled ${recipes.length} recipes, ${verdicts.length} verdicts (${published} published) from D1`);
  }
} catch (err) {
  // TRAMPA, y por eso este `if` va primero: en modo --stdout el fallback NO puede
  // activarse. Si devolviera el snapshot, quien compara estaria comparando el snapshot
  // CONSIGO MISMO y obtendria "al dia" siempre — un verde que no mira nada. Sin D1 la
  // respuesta correcta es "no se pudo comprobar", no un resultado.
  if (STDOUT) {
    console.error(`[sync-ledger] --stdout: D1 no responde, no hay con que comparar. ${String(err).split('\n')[0]}`);
    process.exit(2);
  }
  const snap = JSON.parse(readFileSync('src/data/ledger.json','utf8'));
  // Se REESCRIBE la procedencia: lo que queda publicado es una copia vieja, y tiene que
  // decirlo el propio archivo. Sin esto, un snapshot republicado se ve exactamente igual
  // que uno recien traido de D1 — que es como la ausencia de dato se disfraza de dato.
  snap._procedencia = { fuente: 'snapshot', fecha: new Date().toISOString() };
  writeFileSync('src/data/ledger.json', JSON.stringify(snap, null, 2));
  console.warn(`[sync-ledger] D1 unreachable — keeping snapshot (${snap.recipes.length} recipes). ${String(err).split('\n')[0]}`);
}
