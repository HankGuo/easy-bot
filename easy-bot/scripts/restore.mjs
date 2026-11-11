#!/usr/bin/env node
import Database from 'better-sqlite3';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { execSync } from 'node:child_process';

const ROOT_DIR = process.cwd();
const DATA_DIR = path.resolve(process.env.EASYBOT_DATA_DIR || path.join(ROOT_DIR, '.easybot_data'));
const DB_PATH = path.join(DATA_DIR, 'easybot.db');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const DROP_DIR = path.resolve(process.env.EASYBOT_KNOWLEDGE_DROP || path.join(ROOT_DIR, 'knowledge_drop'));

const targetBackupFile = process.argv[2];

if (!targetBackupFile) {
  console.log('Usage: node scripts/restore.mjs <backup_filename_or_path>');
  console.log('\nAvailable backups in', BACKUP_DIR, ':');
  if (fs.existsSync(BACKUP_DIR)) {
    const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.db') || f.endsWith('.tar.gz'));
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

console.log(`[EasyBot Disaster Recovery] Checking backup artifact: ${resolvedBackupPath}`);

try {
  const isTarBundle = resolvedBackupPath.endsWith('.tar.gz') || resolvedBackupPath.endsWith('.tgz');

  if (isTarBundle) {
    console.log('▶ Detected Full System Snapshot Archive (.tar.gz). Unpacking stage...');
    const stageDir = path.join(BACKUP_DIR, `.restore_stage_${Date.now()}`);
    fs.mkdirSync(stageDir, { recursive: true });

    execSync(`tar -xzf "${resolvedBackupPath}" -C "${stageDir}"`, { stdio: 'pipe' });

    // 1. Verify unpacked database
    const stagedDb = path.join(stageDir, 'easybot.db');
    if (fs.existsSync(stagedDb)) {
      const checkDb = new Database(stagedDb, { readonly: true });
      const check = checkDb.pragma('integrity_check');
      checkDb.close();
      if (!(check.length === 1 && check[0].integrity_check === 'ok')) {
        throw new Error(`Integrity check failed for staged database: ${JSON.stringify(check)}`);
      }
      console.log('✔ Bundled SQLite database integrity validated (PRAGMA integrity_check = ok)');

      if (fs.existsSync(DB_PATH)) {
        const safetyCopy = `${DB_PATH}.pre_restore_${Date.now()}.bak`;
        fs.copyFileSync(DB_PATH, safetyCopy);
        console.log(`✔ Created pre-restore safety copy: ${safetyCopy}`);
      }
      fs.copyFileSync(stagedDb, DB_PATH);
    }

    // 2. Restore Knowledge Drop Documents
    const stagedDrop = path.join(stageDir, 'knowledge_drop');
    if (fs.existsSync(stagedDrop)) {
      if (!fs.existsSync(DROP_DIR)) fs.mkdirSync(DROP_DIR, { recursive: true });
      fs.cpSync(stagedDrop, DROP_DIR, { recursive: true });
      console.log(`✔ Restored knowledge drop documents to: ${DROP_DIR}`);
    }

    // 3. Restore Config Files
    const configFiles = ['model_config.json', 'initial_admin.credentials', 'admin_token.key'];
    for (const cf of configFiles) {
      const src = path.join(stageDir, cf);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(DATA_DIR, cf));
        console.log(`✔ Restored system configuration: ${cf}`);
      }
    }

    fs.rmSync(stageDir, { recursive: true, force: true });
  } else {
    // Single DB restore
    const checkDb = new Database(resolvedBackupPath, { readonly: true });
    const check = checkDb.pragma('integrity_check');
    checkDb.close();

    const isHealthy = check.length === 1 && check[0].integrity_check === 'ok';
    if (!isHealthy) {
      throw new Error(`Integrity check failed: ${JSON.stringify(check)}`);
    }
    console.log('✔ Backup integrity validated (PRAGMA integrity_check = ok)');

    if (fs.existsSync(DB_PATH)) {
      const safetyCopy = `${DB_PATH}.pre_restore_${Date.now()}.bak`;
      fs.copyFileSync(DB_PATH, safetyCopy);
      console.log(`✔ Created pre-restore safety copy: ${safetyCopy}`);
    }
    fs.copyFileSync(resolvedBackupPath, DB_PATH);
  }

  // Remove stale WAL and SHM files to ensure clean state
  const walPath = `${DB_PATH}-wal`;
  const shmPath = `${DB_PATH}-shm`;
  if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
  if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);

  console.log(`✔ Active database restored successfully at: ${DB_PATH}`);
  console.log(`\n🎉 Disaster recovery complete! Restart the EasyBot server.`);
} catch (err) {
  console.error(`\n❌ [Restore Failed]:`, err.message);
  process.exit(1);
}
