import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import initSqlJs, { type Database } from 'sql.js';

export class Store {
  constructor(
    private db: Database,
    private file?: string,
  ) {}
  static async open(file?: string) {
    const SQL = await initSqlJs();
    const db = new SQL.Database(file && existsSync(file) ? readFileSync(file) : undefined);
    db.run('CREATE TABLE IF NOT EXISTS documents (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    return new Store(db, file);
  }
  get<T>(key: string, fallback: T): T {
    const statement = this.db.prepare('SELECT value FROM documents WHERE key = ?');
    try {
      statement.bind([key]);
      return statement.step()
        ? (JSON.parse(statement.getAsObject().value as string) as T)
        : fallback;
    } finally {
      statement.free();
    }
  }
  set(key: string, value: unknown) {
    this.db.run(
      'INSERT INTO documents (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [key, JSON.stringify(value)],
    );
  }
  transaction(work: () => void) {
    const before = this.db.export();
    this.db.run('BEGIN');
    try {
      work();
      this.db.run('COMMIT');
      this.persist();
    } catch (error) {
      // Restore memory as well as the on-disk snapshot if the atomic export fails.
      const DatabaseConstructor = this.db.constructor as new (data: Uint8Array) => Database;
      this.db.close();
      this.db = new DatabaseConstructor(before);
      throw error;
    }
  }
  clear() {
    this.db.run('DELETE FROM documents');
  }
  remove(key: string) {
    this.db.run('DELETE FROM documents WHERE key = ?', [key]);
  }
  persist() {
    if (!this.file) return;
    mkdirSync(dirname(resolve(this.file)), { recursive: true });
    writeFileSync(this.file + '.tmp', this.db.export());
    renameSync(this.file + '.tmp', this.file);
  }
  close() {
    this.db.close();
  }
}
