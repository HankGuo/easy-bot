#!/usr/bin/env node
import Database from 'better-sqlite3';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as crypto from 'node:crypto';
import { execSync } from 'node:child_process';

const ROOT_DIR = process.cwd();
const DATA_DIR = path.resolve(process.env.EASYBOT_DATA_DIR || path.join(ROOT_DIR, '.easybot_data'));
const DB_PATH = path.join(DATA_DIR, 'easybot.db');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const DROP_DIR = path.resolve(process.env.EASYBOT_KNOWLEDGE_DROP || path.join(ROOT_DIR, 'knowledge_drop'));

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
const bundleFilename = `easybot_system_bundle_${timestamp}.tar.gz`;
const bundlePath = path.join(BACKUP_DIR, bundleFilename);

console.log(`[EasyBot Backup] Initiating online atomic database backup from: ${DB_PATH}`);
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

  console.log(`\n✔ [Database Backup Succeeded]`);
  console.log(`  - File: ${backupFilename}`);
  console.log(`  - Size: ${(stat.size / 1024).toFixed(2)} KB`);
  console.log(`  - SHA-256: ${hash}`);
  console.log(`  - Integrity: 100% OK`);

  // 2. Full System Snapshot Bundle (Database + Uploaded Documents + Configs)
  console.log(`\n[EasyBot Backup] Generating full system snapshot bundle (knowledge files + configs)...`);
  const stageDir = path.join(BACKUP_DIR, `.stage_${timestamp}`);
  fs.mkdirSync(stageDir, { recursive: true });

  // Copy atomic db snapshot to stage
  fs.copyFileSync(backupPath, path.join(stageDir, 'easybot.db'));

  // Copy knowledge drop files
  if (fs.existsSync(DROP_DIR)) {
    const stageDrop = path.join(stageDir, 'knowledge_drop');
    fs.cpSync(DROP_DIR, stageDrop, { recursive: true });
  }

  // Copy configuration files if present
  const configFiles = ['model_config.json', 'initial_admin.credentials', 'admin_token.key'];
  for (const cf of configFiles) {
    const src = path.join(DATA_DIR, cf);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(stageDir, cf));
    }
  }

  // Compress stage into .tar.gz bundle
  execSync(`tar -czf "${bundlePath}" -C "${stageDir}" .`, { stdio: 'pipe' });
  fs.rmSync(stageDir, { recursive: true, force: true });

  const bundleStat = fs.statSync(bundlePath);
  const bundleHash = crypto.createHash('sha256').update(fs.readFileSync(bundlePath)).digest('hex');
  const elapsed = Date.now() - startTime;

  console.log(`✔ [Full System Bundle Succeeded]`);
  console.log(`  - Archive: ${bundleFilename}`);
  console.log(`  - Bundle Size: ${(bundleStat.size / 1024).toFixed(2)} KB`);
  console.log(`  - SHA-256: ${bundleHash}`);
  console.log(`  - Total Elapsed: ${elapsed} ms\n`);
} catch (err) {
  console.error(`\n❌ [Backup Failed]:`, err.message);
  process.exit(1);
}
