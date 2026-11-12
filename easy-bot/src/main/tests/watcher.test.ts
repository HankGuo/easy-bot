import test, { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'node:assert/strict';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { KnowledgeDropWatcher } from '../core/knowledge-watcher.js';
import { HybridRAGEngine } from '../core/hybrid-rag.js';

describe('Unit Test: KnowledgeDropWatcher Hot-Indexing & Sync Lifecycle', () => {
  let watchDir: string;
  let rag: HybridRAGEngine;
  let watcher: KnowledgeDropWatcher;

  beforeEach(() => {
    watchDir = path.join(process.cwd(), 'workspace', 'test_watcher_' + Date.now() + Math.random().toString(36).slice(2, 6));
    fs.mkdirSync(watchDir, { recursive: true });
    rag = new HybridRAGEngine();
    watcher = new KnowledgeDropWatcher(watchDir, rag);
  });

  afterEach(() => {
    watcher.stop();
  });

  it('15.1 should initialize watch directory and report empty initial status', () => {
    const status = watcher.getStatus();
    assert.equal(status.watchDir, path.resolve(watchDir));
    assert.equal(status.totalIndexedFiles, 0);
    assert.equal(status.files.length, 0);
  });

  it('15.2 should automatically index dropped text and markdown files into HybridRAG on sync', () => {
    const filePath = path.join(watchDir, 'safety_protocol.md');
    fs.writeFileSync(filePath, '# 安全生产规程\n严禁在主轴未停稳前开启安全防护罩。', 'utf-8');

    watcher.sync();

    const status = watcher.getStatus();
    assert.equal(status.totalIndexedFiles, 1);
    assert.equal(status.files[0].filename, 'safety_protocol.md');

    // Query RAG to verify Okapi BM25 index hit
    const hits = rag.queryWithScope('安全防护罩 主轴', []);
    assert.ok(hits.length >= 1);
    assert.ok(hits[0].chunk.content.includes('安全防护罩'));
  });

  it('15.3 should re-index document when file content is modified (sha256 change detection)', () => {
    const filePath = path.join(watchDir, 'tolerance_standard.txt');
    fs.writeFileSync(filePath, '第一版标准：轴径公差范围 0.05mm', 'utf-8');
    watcher.sync();

    let hits = rag.queryWithScope('轴径公差', []);
    assert.ok(hits[0].chunk.content.includes('0.05mm'));

    // Update file with new version
    fs.writeFileSync(filePath, '第二版修正标准：轴径公差范围 0.02mm', 'utf-8');
    watcher.sync();

    hits = rag.queryWithScope('轴径公差', []);
    assert.ok(hits[0].chunk.content.includes('0.02mm'));
  });

  it('15.4 should remove document from HybridRAG index when file is deleted from watch folder', () => {
    const filePath = path.join(watchDir, 'obsolete_manual.txt');
    fs.writeFileSync(filePath, '过时设备操作规程：报废型号 X-999 不再适用', 'utf-8');
    watcher.sync();

    let hits = rag.queryWithScope('报废型号 X-999', []);
    assert.ok(hits.length >= 1);

    // Remove file
    fs.unlinkSync(filePath);
    watcher.sync();

    const status = watcher.getStatus();
    assert.equal(status.totalIndexedFiles, 0);

    hits = rag.queryWithScope('报废型号 X-999', []);
    assert.equal(hits.length, 0);
  });

  it('15.5 should persist sidecar metadata with spaceId and ownerGroupId isolation', () => {
    const sidecarFile = path.join(watchDir, '.knowledge_metadata.json');
    const sidecarData = {
      'custom_doc_id_1': {
        docId: 'custom_doc_id_1',
        filename: 'secret_formula.txt',
        spaceId: 'confidential_rnd',
        ownerGroupId: 'group_rnd_engineers',
        uploadedBy: 'usr_lead'
      }
    };
    fs.writeFileSync(sidecarFile, JSON.stringify(sidecarData, null, 2), 'utf-8');

    const filePath = path.join(watchDir, 'secret_formula.txt');
    fs.writeFileSync(filePath, '钛合金耐磨配方核心比例 15:85', 'utf-8');

    watcher.sync();

    // Query RAG with unauthorized group: should be blocked by row-level security
    const unauthorizedHits = rag.queryWithScope('钛合金耐磨配方', ['group_hr']);
    assert.equal(unauthorizedHits.length, 0);

    // Query RAG with authorized group: should be accessible
    const authorizedHits = rag.queryWithScope('钛合金耐磨配方', ['group_rnd_engineers']);
    assert.ok(authorizedHits.length >= 1);
    assert.ok(authorizedHits[0].chunk.content.includes('钛合金耐磨配方'));
  });

  it('15.6 should gracefully ignore non-indexed file extensions like binary images or DS_Store', () => {
    fs.writeFileSync(path.join(watchDir, 'firmware.bin'), Buffer.from([0x00, 0x01, 0x02, 0x03]));
    fs.writeFileSync(path.join(watchDir, '.DS_Store'), 'macos metadata');

    watcher.sync();

    const status = watcher.getStatus();
    assert.equal(status.totalIndexedFiles, 0);
  });
});
