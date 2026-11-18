-- Reports describe actual compiler work, not simulated progress or test runs.
CREATE TABLE project_builds (
  project_id TEXT PRIMARY KEY REFERENCES projects ON DELETE CASCADE,
  report TEXT NOT NULL,
  created INTEGER NOT NULL
);
