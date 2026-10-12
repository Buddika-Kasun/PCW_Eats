import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

export function getDatabasePath(): string {
  const configuredPath = process.env.DATA_FILE_PATH || './data/pcw-eats.db';
  const resolved = path.resolve(projectRoot, configuredPath);

  if (path.extname(resolved).toLowerCase() !== '.db' && path.extname(resolved).toLowerCase() !== '.sqlite') {
    return `${resolved}.db`;
  }

  return resolved;
}

export function initializeDatabaseSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      uom TEXT NOT NULL,
      price REAL NOT NULL,
      category TEXT,
      shelf_life TEXT
    );

    CREATE TABLE IF NOT EXISTS meals (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      cost REAL NOT NULL,
      eligible_from TEXT NOT NULL,
      eligible_to TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS quotas (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      items_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dept_quota_maps (
      id TEXT PRIMARY KEY,
      department TEXT NOT NULL,
      effective_from TEXT NOT NULL,
      quota_id TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS canteens (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inventory (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL,
      item TEXT NOT NULL,
      uom TEXT NOT NULL,
      stock REAL NOT NULL,
      min_level REAL NOT NULL,
      status TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily_batches (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL,
      item_name TEXT NOT NULL,
      date TEXT NOT NULL,
      delivery_time TEXT,
      received_qty REAL NOT NULL,
      issued_qty REAL NOT NULL,
      remaining_qty REAL NOT NULL,
      unit_price REAL NOT NULL,
      status TEXT NOT NULL,
      cleared_at TEXT,
      waste_qty REAL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      dept TEXT NOT NULL,
      role TEXT NOT NULL,
      fingerprint_enrolled INTEGER,
      biometric_card_no TEXT
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      time TEXT,
      dept TEXT NOT NULL,
      item TEXT NOT NULL,
      qty REAL NOT NULL,
      cost REAL NOT NULL,
      type TEXT NOT NULL,
      category TEXT,
      user_id TEXT,
      user_name TEXT,
      canteen_id TEXT
    );

    CREATE TABLE IF NOT EXISTS dept_balances (
      department TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS biometric_logs (
      id TEXT PRIMARY KEY,
      employee_no TEXT NOT NULL,
      employee_name TEXT NOT NULL,
      department TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      device_id TEXT NOT NULL,
      device_ip TEXT NOT NULL,
      verification_mode TEXT NOT NULL,
      status TEXT NOT NULL
    );
  `);
}

export const appDatabase = (() => {
  const dbPath = getDatabasePath();
  const directory = path.dirname(dbPath);
  fs.mkdirSync(directory, { recursive: true });

  const db = new DatabaseSync(dbPath);
  db.exec(`PRAGMA journal_mode = WAL;`);
  db.exec(`PRAGMA synchronous = NORMAL;`);
  initializeDatabaseSchema(db);

  return db;
})();
