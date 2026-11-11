#!/usr/bin/env node
import Database from 'better-sqlite3';
import * as path from 'node:path';
import * as fs from 'node:fs';

const DATA_DIR = path.resolve(process.env.EASYBOT_DATA_DIR || path.join(process.cwd(), '.easybot_data'));
const DB_PATH = path.join(DATA_DIR, 'easybot.db');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

const targetBackupFile = process.argv[2];

if (!targetBackupFile) {
  console.log('Usage: node scripts/restore.mjs <backup_filename_or_path>');
  console.log('\nAvailable backups in', BACKUP_DIR, ':');
  if (fs.existsSync(BACKUP_DIR)) {
    const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.db'));
    files.forEach(f => console.log('  -', f));
  } else {
    console.log('  (no backups directory found)');
  }
  process.exit(1);
}

const resolvedBackupPath = path.isAbsolute(targetBackupFile)
  ? targetBackupFile
  : path.join(BACKUP_DIR, targetBackupFile);

if (!fs.existsSync(resolvedBackupPath)) {
  console.error(`[Restore Error] Backup file not found: ${resolvedBackupPath}`);
  process.exit(1);
}

console.log(`[EasyBot Disaster Recovery] Checking backup integrity: ${resolvedBackupPath}`);

try {
  const checkDb = new Database(resolvedBackupPath, { readonly: true });
  const check = checkDb.pragma('integrity_check');
  checkDb.close();

  const isHealthy = check.length === 1 && check[0].integrity_check === 'ok';
  if (!isHealthy) {
    throw new Error(`Integrity check failed: ${JSON.stringify(check)}`);
  }
  console.log('✔ Backup integrity validated (PRAGMA integrity_check = ok)');

  // Safely archive current active database before overwriting
  if (fs.existsSync(DB_PATH)) {
    const safetyCopy = `${DB_PATH}.pre_restore_${Date.now()}.bak`;
    fs.copyFileSync(DB_PATH, safetyCopy);
    console.log(`✔ Created pre-restore safety copy: ${safetyCopy}`);
  }

  // Restore by file copy
  fs.copyFileSync(resolvedBackupPath, DB_PATH);

  // Remove stale WAL and SHM files to ensure clean state
  const walPath = `${DB_PATH}-wal`;
  const shmPath = `${DB_PATH}-shm`;
  if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
  if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);

  console.log(`✔ Database restored successfully to: ${DB_PATH}`);
  console.log(`\n🎉 Disaster recovery complete! Restart the EasyBot server.`);
} catch (err) {
  console.error(`\n❌ [Restore Failed]:`, err.message);
  process.exit(1);
}
