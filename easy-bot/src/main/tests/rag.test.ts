import test, { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { HybridRAGEngine } from '../core/hybrid-rag.js';

describe('Unit Test: HybridRAGEngine (BM25 + Dense Vectors + Row-Level Security)', () => {
  let rag: HybridRAGEngine;

  beforeEach(() => {
    rag = new HybridRAGEngine();
  });

  it('2.1 should correctly tokenize English and mixed text into terms', () => {
    const tokens = rag.tokenize('CNC Machine Error E-06 Spindle Overheat!');
    assert.ok(tokens.includes('cnc'));
    assert.ok(tokens.includes('machine'));
    assert.ok(tokens.includes('error'));
    assert.ok(tokens.includes('e-06') || tokens.includes('e06') || tokens.includes('spindle'));
    assert.ok(tokens.includes('overheat'));
  });

  it('2.2 should segment Chinese technical terminology and characters', () => {
    const tokens = rag.tokenize('数控机床主轴超温维保规程');
    assert.ok(tokens.length >= 4);
  });

  it('2.3 should chunk long documents respecting chunkSize and chunkOverlap', () => {
    const text = 'A'.repeat(500) + ' ' + 'B'.repeat(500);
    const chunks = rag.addDocument('doc-chunk-test', 'Long Document', text, 300, 50);

    assert.ok(chunks.length >= 3);
    for (let i = 0; i < chunks.length; i++) {
      assert.equal(chunks[i].chunkIndex, i);
      assert.equal(chunks[i].documentId, 'doc-chunk-test');
      assert.ok(chunks[i].content.length <= 300);
    }
  });

  it('2.4 should accurately build inverted index for fast keyword lookup', () => {
    rag.addDocument('doc1', 'Doc One', 'Precision calibration of robotic arm');
    rag.addDocument('doc2', 'Doc Two', 'Thermal compensation in CNC milling');

    const docs = rag.listDocuments();
    assert.equal(docs.length, 2);

    const stats = rag.getStats();
    assert.equal(stats.totalChunks, 2);
    assert.ok(stats.vocabularySize > 0);
  });

  it('2.5 should score exact term matches higher in BM25 ranking', () => {
    rag.addDocument('doc-high', 'Exact Match', 'Servo motor encoder pulse error E-06 hardware fault');
    rag.addDocument('doc-low', 'Partial Match', 'General motor maintenance guidelines and lubrication');
    rag.addDocument('doc-zero', 'Irrelevant', 'Plastic injection molding pressure parameters');

    const results = rag.queryWithScope('servo motor', [], 5);
    assert.ok(results.length >= 2);
    assert.equal(results[0].chunk.documentId, 'doc-high');
    assert.ok(results[0].score > results[1].score);
  });

  it('2.6 should return empty array for queries with zero matching keywords', () => {
    rag.addDocument('doc-math', 'Calculus', 'Derivatives and integrals in engineering mathematics');

    const results = rag.queryWithScope('Quantum teleportation superconductivity', [], 5);
    assert.equal(results.length, 0);
  });

  it('2.7 should enforce strict space_id isolation when targetSpaceId is specified', () => {
    rag.addDocument('doc-finance', 'Financial Policy', 'Expense reimbursement SOP', 300, 50, undefined, 'space_finance');
    rag.addDocument('doc-eng', 'Engineering Policy', 'Expense reimbursement SOP for tooling', 300, 50, undefined, 'space_eng');

    // Query restricted to space_finance
    const financeHits = rag.queryWithScope('reimbursement', [], 5, 'space_finance');
    assert.equal(financeHits.length, 1);
    assert.equal(financeHits[0].chunk.documentId, 'doc-finance');

    // Query restricted to space_eng
    const engHits = rag.queryWithScope('reimbursement', [], 5, 'space_eng');
    assert.equal(engHits.length, 1);
    assert.equal(engHits[0].chunk.documentId, 'doc-eng');
  });

  it('2.8 should enforce row-level security for ownerGroupId on confidential assets', () => {
    // Confidential doc restricted to grp_lab_secret in confidential space
    rag.addDocument('doc-secret', 'Patents', 'Confidential chip architecture RDMA', 300, 50, undefined, 'space_lab_secret', 'grp_lab_secret');
    // Public doc accessible by anyone in public space
    rag.addDocument('doc-public', 'Guidelines', 'Confidential project naming guidelines', 300, 50, undefined, 'public');

    // Student without grp_lab_secret should only see public doc
    const studentHits = rag.queryWithScope('Confidential', ['grp_student_general'], 5);
    assert.equal(studentHits.length, 1);
    assert.equal(studentHits[0].chunk.documentId, 'doc-public');

    // Researcher with grp_lab_secret should see both docs
    const researcherHits = rag.queryWithScope('Confidential', ['grp_lab_secret'], 5);
    assert.equal(researcherHits.length, 2);
    const docIds = researcherHits.map(h => h.chunk.documentId);
    assert.ok(docIds.includes('doc-secret'));
    assert.ok(docIds.includes('doc-public'));
  });

  it('2.9 should perform Reciprocal Rank Fusion (RRF) when query embedding is provided', () => {
    const chunk1Emb = [0.9, 0.1, 0.0];
    const chunk2Emb = [0.1, 0.9, 0.0];

    rag.addDocument('doc1', 'Doc One', 'Keyword match alpha', 300, 50, [chunk1Emb]);
    rag.addDocument('doc2', 'Doc Two', 'Keyword match beta', 300, 50, [chunk2Emb]);

    const queryVec = [0.85, 0.15, 0.0];
    const results = rag.queryWithScope('Keyword', [], 5, undefined, queryVec);

    assert.equal(results.length, 2);
    assert.ok(results[0].score > 0);
    assert.ok(results[0].vectorRank !== undefined);
    assert.ok(results[0].bm25Rank !== undefined);
  });

  it('2.10 should clear documents completely on clearDocuments()', () => {
    rag.addDocument('doc1', 'Doc', 'Content test');
    assert.equal(rag.getStats().totalChunks, 1);

    rag.clearDocuments();
    assert.equal(rag.getStats().totalChunks, 0);
    assert.equal(rag.listDocuments().length, 0);
  });

  it('2.11 should remove specific document and cleanup its inverted index', () => {
    rag.addDocument('doc-keep', 'Keep Me', 'Sensor measurement calibration');
    rag.addDocument('doc-remove', 'Remove Me', 'Discarded experimental data');

    assert.equal(rag.listDocuments().length, 2);
    const removed = rag.removeDocument('doc-remove');
    assert.equal(removed, true);

    const remaining = rag.listDocuments();
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].id, 'doc-keep');

    const queryRemoved = rag.queryWithScope('Discarded', [], 5);
    assert.equal(queryRemoved.length, 0);
  });

  it('2.12 should handle empty or whitespace-only documents gracefully', () => {
    const chunks = rag.addDocument('doc-empty', 'Empty', '     \n\t   ');
    assert.equal(chunks.length, 0);
    assert.equal(rag.getStats().totalChunks, 0);
  });

  it('2.13 should correctly report matched keywords in retrieval result metadata', () => {
    rag.addDocument('doc-meta', 'Assembly Manual', 'Tighten torque screws to 25Nm using pneumatic wrench');
    const hits = rag.queryWithScope('pneumatic torque screws', [], 5);

    assert.equal(hits.length, 1);
    assert.ok(hits[0].matchedKeywords.length >= 2);
    assert.ok(hits[0].matchedKeywords.includes('torque') || hits[0].matchedKeywords.includes('screws'));
  });

  it('2.14 should support queryHybridAsync fallback to embedded engine when WeKnora is offline', async () => {
    rag.addDocument('doc-fallback', 'Fallback SOP', 'Emergency protocol for network outage');
    const hits = await rag.queryHybridAsync('Emergency protocol', []);

    assert.equal(hits.length, 1);
    assert.equal(hits[0].chunk.documentId, 'doc-fallback');
  });

  it('2.15 should maintain statistical invariants in getStats()', () => {
    rag.addDocument('d1', 'Doc 1', 'first sample text');
    rag.addDocument('d2', 'Doc 2', 'second sample text with more words');

    const stats = rag.getStats();
    assert.equal(stats.totalChunks, 2);
    assert.ok(stats.avgDocLength > 0);
    assert.equal(stats.retrievalMode, 'Pure Okapi BM25 (Deterministic Lexical)');
  });
});
