#!/usr/bin/env node
import Database from 'better-sqlite3';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as crypto from 'node:crypto';

const DATA_DIR = path.resolve(process.env.EASYBOT_DATA_DIR || path.join(process.cwd(), '.easybot_data'));
const DB_PATH = path.join(DATA_DIR, 'easybot.db');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

if (!fs.existsSync(DB_PATH)) {
  console.error(`[Backup Error] Database not found at ${DB_PATH}`);
  process.exit(1);
}

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupFilename = `easybot_backup_${timestamp}.db`;
const backupPath = path.join(BACKUP_DIR, backupFilename);

console.log(`[EasyBot Backup] Initiating online atomic backup from: ${DB_PATH}`);
console.log(`[EasyBot Backup] Destination: ${backupPath}`);

const startTime = Date.now();
const db = new Database(DB_PATH);

try {
  await db.backup(backupPath);
  db.close();

  // Validate integrity of the newly created backup
  const backupDb = new Database(backupPath, { readonly: true });
  const check = backupDb.pragma('integrity_check');
  backupDb.close();

  const isHealthy = check.length === 1 && check[0].integrity_check === 'ok';
  if (!isHealthy) {
    throw new Error(`Integrity check failed: ${JSON.stringify(check)}`);
  }

  const stat = fs.statSync(backupPath);
  const hash = crypto.createHash('sha256').update(fs.readFileSync(backupPath)).digest('hex');
  const elapsed = Date.now() - startTime;

  console.log(`\n✔ [Backup Succeeded]`);
  console.log(`  - File: ${backupFilename}`);
  console.log(`  - Size: ${(stat.size / 1024).toFixed(2)} KB`);
  console.log(`  - SHA-256: ${hash}`);
  console.log(`  - Duration: ${elapsed} ms`);
  console.log(`  - Integrity: 100% OK`);
} catch (err) {
  console.error(`\n❌ [Backup Failed]:`, err.message);
  process.exit(1);
}
