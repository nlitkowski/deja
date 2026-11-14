import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

/**
 * Enough of the D1 API for the Worker's queries, on Node's built-in SQLite.
 * Lets Worker tests run in the project's own Vitest (the Workers pool supports only Vitest 4).
 */
export function testDb(): D1Database {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  const dir = join(import.meta.dirname, '../migrations');
  for (const file of readdirSync(dir).sort()) db.exec(readFileSync(join(dir, file), 'utf8'));

  const statement = (sql: string, params: SQLInputValue[] = []) => {
    const run = () => {
      const r = db.prepare(sql).run(...params);
      return { success: true, results: [], meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
    };
    return {
      bind: (...values: unknown[]) => statement(sql, values as SQLInputValue[]),
      async first(column?: string) {
        const row = db.prepare(sql).get(...params) as Record<string, unknown> | undefined;
        if (!row) return null;
        return column ? row[column] : row;
      },
      async all() {
        return { success: true, results: db.prepare(sql).all(...params), meta: {} };
      },
      async run() {
        return run();
      },
      runSync: run,
    };
  };

  return {
    prepare: (sql: string) => statement(sql),
    async batch(statements: { runSync: () => unknown }[]) {
      db.exec('BEGIN');
      try {
        const results = statements.map((s) => s.runSync());
        db.exec('COMMIT');
        return results;
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    },
    async exec(sql: string) {
      db.exec(sql);
      return { count: 1, duration: 0 };
    },
  } as unknown as D1Database;
}
