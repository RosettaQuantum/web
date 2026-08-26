-- Esquema recuperado DESDE D1 EN PRODUCCION, no escrito a mano.
--
-- POR QUE EXISTE ESTE ARCHIVO. Al auditar las semillas (2026-08-26) se comparo lo declarado
-- en db/*.schema.sql contra lo que vive en D1: **12 tablas declaradas, 22 vivas**. Diez
-- existian SOLO en produccion -entre ellas `recipes`, `verdicts` y `experiments`, que son las
-- que alimentan el ledger publico-. Si la base se perdia, no habia con que reconstruirlas.
--
-- No hay sistema de migraciones en este proyecto: hay archivos de esquema y nada que registre
-- que version esta aplicada. Esto no lo arregla; **cierra el hueco de reproducibilidad** para
-- las diez que faltaban.
--
-- Recuperado con:
--   npx wrangler d1 execute rosettaq-ledger --remote --json \
--     --command "SELECT name, sql FROM sqlite_master WHERE type IN ('table','index')"
--
-- OJO: describe lo que HAY, no lo que se pretendia. Si algo de aca sorprende, el sorprendido
-- es el repositorio, no la base.


CREATE TABLE "experiments" (id TEXT PRIMARY KEY, recipe_id TEXT NOT NULL, instance TEXT NOT NULL, quantum_json TEXT NOT NULL, classical_json TEXT NOT NULL, seed INTEGER, lib_versions TEXT NOT NULL, raw_data_url TEXT, created_at TEXT NOT NULL);

CREATE TABLE leads (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT NOT NULL, role TEXT, org TEXT, problem_class TEXT, note TEXT, lang TEXT, source TEXT, created_at TEXT DEFAULT (datetime('now')));

CREATE TABLE recipes (id TEXT PRIMARY KEY, name TEXT NOT NULL, problem_class TEXT NOT NULL, vertical TEXT NOT NULL, algorithm TEXT NOT NULL, qubits_required INTEGER, source TEXT, status TEXT NOT NULL, advantage_claimed TEXT, created_at TEXT NOT NULL);

CREATE TABLE rq_claims (
  id TEXT PRIMARY KEY, claimant TEXT NOT NULL, kind TEXT NOT NULL,
  title TEXT NOT NULL, claim_date TEXT NOT NULL, venue TEXT, domain TEXT NOT NULL,
  claimed TEXT, hw TEXT, qubits INTEGER,
  status TEXT NOT NULL, first_challenge TEXT, clock_days INTEGER,
  challenge_note TEXT, url TEXT, verified INTEGER NOT NULL DEFAULT 0,
  features_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE rq_cron_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT, cron TEXT NOT NULL, tarea TEXT NOT NULL,
  ok INTEGER NOT NULL, detalle TEXT, corrio_at TEXT NOT NULL
);

CREATE TABLE rq_queue (
  arxiv_id TEXT PRIMARY KEY, title TEXT, abstract TEXT, published TEXT,
  authors TEXT, pre_score REAL, features_json TEXT,
  triaged INTEGER NOT NULL DEFAULT 0, promoted_claim_id TEXT, found_at TEXT NOT NULL
);

CREATE TABLE rq_score_runs (
  run_id TEXT PRIMARY KEY, rubric_version TEXT NOT NULL, rubric_status TEXT NOT NULL,
  intercept REAL NOT NULL, weights_json TEXT NOT NULL,
  n_claims INTEGER NOT NULL, run_at TEXT NOT NULL, sha256 TEXT NOT NULL, notes TEXT
);

CREATE TABLE rq_scores (
  run_id TEXT NOT NULL, claim_id TEXT NOT NULL, s_score REAL NOT NULL,
  status_at_score TEXT NOT NULL, scored_at TEXT NOT NULL,
  PRIMARY KEY (run_id, claim_id)
);

CREATE TABLE run_archives (file_id TEXT PRIMARY KEY, file_name TEXT NOT NULL UNIQUE, type TEXT NOT NULL, recipe_id TEXT, is_demo INTEGER NOT NULL DEFAULT 1, content_hash TEXT NOT NULL, started_at TEXT, archived_at TEXT, github_url TEXT NOT NULL, codeberg_url TEXT NOT NULL, ots_proof TEXT, payload TEXT NOT NULL, seal_convention TEXT);

CREATE TABLE verdicts (id TEXT PRIMARY KEY, recipe_id TEXT NOT NULL, outcome TEXT NOT NULL, crossover TEXT, advantage_measured REAL, summary TEXT NOT NULL, notebook_url TEXT, published_at TEXT NOT NULL, is_demo INTEGER NOT NULL DEFAULT 1);

CREATE INDEX idx_rq_claims_status ON rq_claims(status);

CREATE INDEX idx_rq_claims_verified ON rq_claims(verified);

CREATE INDEX idx_rq_queue_triaged ON rq_queue(triaged, published);

CREATE INDEX idx_rq_scores_claim ON rq_scores(claim_id);

CREATE INDEX idx_run_archives_recipe ON run_archives (recipe_id);

CREATE INDEX idx_run_archives_type ON run_archives (type);
