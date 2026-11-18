import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
export const id = () => randomUUID();
export const now = () => Date.now();
export function openDB(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations(version TEXT PRIMARY KEY)');
  const dir = new URL('./migrations/', import.meta.url);
  for (const version of readdirSync(dir)
    .filter((x) => x.endsWith('.sql'))
    .sort()) {
    if (!db.prepare('SELECT 1 FROM schema_migrations WHERE version=?').get(version))
      transaction(db, () => {
        db.exec(readFileSync(new URL(version, dir), 'utf8'));
        db.prepare('INSERT INTO schema_migrations VALUES(?)').run(version);
      });
  }
  return db;
}
export function transaction(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
export function audit(db, user, project, action, detail) {
  db.prepare('INSERT INTO activity_logs VALUES(?,?,?,?,?,?)').run(
    id(),
    user,
    project,
    action,
    detail,
    now(),
  );
}
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export const fail = (status, message) => {
  throw new HttpError(status, message);
};
