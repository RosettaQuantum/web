// Pulls the ledger from the D1 `rosettaq-ledger` at build time -> src/data/ledger.json.
// Uses `wrangler d1 execute` (authenticated in Claude Code). Falls back to the committed
// snapshot if D1 is unreachable, so the build never breaks.
// NOTE: `recipes` has NO is_demo column; a recipe's demo status derives from its verdict
// (or absence of one). Published = verdicts that are not demo.
import { execSync } from 'node:child_process';
import { writeFileSync, readFileSync } from 'node:fs';

const DB = 'rosettaq-ledger';
const q = (sql) => JSON.parse(
  execSync(`npx wrangler d1 execute ${DB} --remote --json --command "${sql}"`, { stdio: ['ignore','pipe','pipe'] }).toString()
)[0].results;

try {
  const recipes  = q('SELECT id,name,problem_class,vertical,algorithm,qubits_required,status FROM recipes ORDER BY id');
  const verdicts = q('SELECT recipe_id,outcome,crossover,summary,is_demo FROM verdicts');
  const exps     = q('SELECT recipe_id,instance,quantum_json,classical_json,seed FROM experiments');
  const published = verdicts.filter(v => !v.is_demo).length;

  const out = {
    counter: { pipeline: recipes.length, published },
    recipes: recipes.map(r => {
      const v = verdicts.find(x => x.recipe_id === r.id);
      const e = exps.filter(x => x.recipe_id === r.id).map(x => ({
        instance: x.instance,
        q: (() => { const j = JSON.parse(x.quantum_json||'{}'); return `${j.framework||'?'} · ${j.result ?? ''}`; })(),
        c: (() => { const j = JSON.parse(x.classical_json||'{}'); return `${j.framework||'?'} · ${j.result ?? ''}`; })(),
        seed: x.seed,
      }));
      return {
        id: r.id, name_en: r.name, name_es: r.name,
        class_en: r.problem_class, class_es: r.problem_class,
        vertical: r.vertical, algorithm: r.algorithm, qubits: r.qubits_required, status: r.status,
        is_demo: v ? !!v.is_demo : true,   // derived, not from recipes
        ...(v ? { verdict: { outcome: v.outcome, crossover_en: v.crossover, crossover_es: v.crossover, summary_en: v.summary, summary_es: v.summary } } : {}),
        ...(e.length ? { experiments: e } : {}),
      };
    }),
  };
  writeFileSync('src/data/ledger.json', JSON.stringify(out, null, 2));
  console.log(`[sync-ledger] pulled ${recipes.length} recipes, ${verdicts.length} verdicts (${published} published) from D1`);
} catch (err) {
  const snap = JSON.parse(readFileSync('src/data/ledger.json','utf8'));
  console.warn(`[sync-ledger] D1 unreachable — keeping snapshot (${snap.recipes.length} recipes). ${String(err).split('\n')[0]}`);
}
