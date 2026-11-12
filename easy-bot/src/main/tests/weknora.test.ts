import test, { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import * as http from 'node:http';
import { WeKnoraDriver } from '../core/weknora-driver.js';

describe('Unit Test: WeKnoraDriver Upstream API Integration', () => {
  let mockServer: http.Server;
  let serverPort = 0;
  let lastRequest: { url?: string; method?: string; headers?: http.IncomingHttpHeaders; body?: any } = {};

  before(async () => {
    mockServer = http.createServer((req, res) => {
      let data = '';
      req.on('data', chunk => data += chunk);
      req.on('end', () => {
        let parsed: any = null;
        try { parsed = JSON.parse(data); } catch {}
        lastRequest = {
          url: req.url,
          method: req.method,
          headers: req.headers,
          body: parsed
        };

        if (req.url === '/api/v1/health') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok', version: '1.2.0' }));
          return;
        }

        if (req.url === '/api/v1/knowledge-search') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            data: [
              {
                id: 'chunk_global_1',
                document_id: 'doc_g1',
                document_title: 'Global Guidelines',
                content: 'Industrial standard operating procedure for milling',
                score: 0.95,
                bm25_rank: 1,
                matched_keywords: ['operating', 'procedure'],
                custom_metadata: {
                  owner_group_id: 'grp_eng'
                }
              },
              {
                id: 'chunk_global_2',
                document_id: 'doc_g2',
                document_title: 'Finance Confidential',
                content: 'Confidential bonus budget 2026',
                score: 0.90,
                bm25_rank: 2,
                custom_metadata: {
                  owner_group_id: 'grp_finance_only'
                }
              }
            ]
          }));
          return;
        }

        if (req.url?.includes('error_404')) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Space not found' }));
          return;
        }

        if (req.url?.includes('/hybrid-search')) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            results: [
              {
                chunk_id: 'chunk_space_1',
                doc_id: 'doc_s1',
                title: 'Space Confidential Doc',
                chunk_text: 'Secret formula 42',
                score: 0.88,
                bm25_rank: 1,
                space_id: 'space_secret'
              }
            ]
          }));
          return;
        }

        if (req.url?.includes('/knowledge/manual') && req.method === 'POST') {
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ id: 'doc_created_123', success: true }));
          return;
        }

        if (req.url?.includes('/knowledge/manual/') && req.method === 'PUT') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ id: 'doc_updated_123', success: true }));
          return;
        }

        if (req.url === '/api/v1/error-500') {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal WeKnora Database Error' }));
          return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      });
    });

    await new Promise<void>((resolve) => {
      mockServer.listen(0, '127.0.0.1', () => {
        const addr = mockServer.address() as any;
        serverPort = addr.port;
        resolve();
      });
    });
  });

  after(() => {
    mockServer.close();
  });

  it('3.1 should normalize trailing slashes in endpoint URL', () => {
    const driver = new WeKnoraDriver({ endpoint: 'http://127.0.0.1:8000///' });
    assert.equal(driver.getEndpoint(), 'http://127.0.0.1:8000');
  });

  it('3.2 should return true on isAvailable() when health endpoint returns 200', async () => {
    const driver = new WeKnoraDriver({ endpoint: `http://127.0.0.1:${serverPort}` });
    const isUp = await driver.isAvailable();
    assert.equal(isUp, true);
    assert.equal(lastRequest.url, '/api/v1/health');
    assert.equal(lastRequest.method, 'GET');
  });

  it('3.3 should return false on isAvailable() when backend is unreachable', async () => {
    const driver = new WeKnoraDriver({ endpoint: 'http://127.0.0.1:59998' });
    const isUp = await driver.isAvailable();
    assert.equal(isUp, false);
  });

  it('3.4 should dispatch global hybrid search to /api/v1/knowledge-search with official payload and enforce row-level filtering', async () => {
    const driver = new WeKnoraDriver({
      endpoint: `http://127.0.0.1:${serverPort}`,
      apiKey: 'test_weknora_key',
      defaultKnowledgeBaseId: 'kb_production'
    });

    // Allowed group is 'grp_eng'; 'grp_finance_only' document should be post-filtered out
    const hits = await driver.searchHybrid('operating procedure', ['grp_eng'], 5);
    assert.equal(lastRequest.url, '/api/v1/knowledge-search');
    assert.equal(lastRequest.headers?.['authorization'], 'Bearer test_weknora_key');
    assert.equal(lastRequest.headers?.['x-api-key'], 'test_weknora_key');

    // Official WeKnora parameters
    assert.equal(lastRequest.body.query, 'operating procedure');
    assert.equal(lastRequest.body.knowledge_base_id, 'kb_production');
    assert.deepEqual(lastRequest.body.knowledge_base_ids, ['kb_production']);
    assert.equal(lastRequest.body.top_k, 5);
    assert.equal(lastRequest.body.rerank?.enabled, true);
    // Unsupported metadata_filter must NOT be sent to WeKnora API
    assert.equal(lastRequest.body.metadata_filter, undefined);

    // Row-level Security: only grp_eng doc is returned; finance doc is excluded
    assert.equal(hits.length, 1);
    assert.equal(hits[0].chunk.documentId, 'doc_g1');
    assert.equal(hits[0].chunk.documentTitle, 'Global Guidelines');
    assert.equal(hits[0].chunk.ownerGroupId, 'grp_eng');
  });

  it('3.5 should dispatch space-scoped search to /api/v1/knowledge-bases/{spaceId}/hybrid-search', async () => {
    const driver = new WeKnoraDriver({
      endpoint: `http://127.0.0.1:${serverPort}`,
      apiKey: 'secret_key'
    });

    const hits = await driver.searchHybrid('formula', [], 3, 'space_secret');
    assert.ok(lastRequest.url?.includes('/api/v1/knowledge-bases/space_secret/hybrid-search'));
    assert.equal(lastRequest.body.query, 'formula');
    assert.equal(lastRequest.body.top_k, 3);
    assert.equal(hits.length, 1);
    assert.equal(hits[0].chunk.content, 'Secret formula 42');
  });

  it('3.6 should ingest markdown knowledge to /api/v1/knowledge-bases/{spaceId}/knowledge/manual with status=publish', async () => {
    const driver = new WeKnoraDriver({
      endpoint: `http://127.0.0.1:${serverPort}`,
      apiKey: 'write_key'
    });

    const ok = await driver.ingestDocument('doc_new_1', 'Safety SOP', '# CNC Milling Safety Protocol', 'space_manufacturing', 'grp_eng');
    assert.equal(ok, true);
    assert.equal(lastRequest.url, '/api/v1/knowledge-bases/space_manufacturing/knowledge/manual');
    assert.equal(lastRequest.body.title, 'Safety SOP');
    assert.equal(lastRequest.body.content, '# CNC Milling Safety Protocol');
    // Critical: status must be publish so WeKnora indexes it
    assert.equal(lastRequest.body.status, 'publish');
    assert.equal(lastRequest.body.custom_metadata?.document_id, 'doc_new_1');
    assert.equal(lastRequest.body.custom_metadata?.owner_group_id, 'grp_eng');
  });

  it('3.7 should propagate upstream cluster HTTP errors explicitly', async () => {
    const driver = new WeKnoraDriver({
      endpoint: `http://127.0.0.1:${serverPort}`
    });

    await assert.rejects(
      () => driver.searchHybrid('any', [], 5, 'error_404_space'),
      /WeKnora cluster returned HTTP 404/
    );
  });
});
