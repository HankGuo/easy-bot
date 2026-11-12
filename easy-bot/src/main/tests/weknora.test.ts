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
                matched_keywords: ['operating', 'procedure']
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

        if (req.url?.includes('/documents') && req.method === 'POST') {
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ id: 'doc_created_123', success: true }));
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

  it('3.4 should dispatch global hybrid search to /api/v1/knowledge-search with official payload', async () => {
    const driver = new WeKnoraDriver({
      endpoint: `http://127.0.0.1:${serverPort}`,
      apiKey: 'test_weknora_key'
    });

    const hits = await driver.searchHybrid('operating procedure', ['grp_eng'], 5);
    assert.equal(lastRequest.url, '/api/v1/knowledge-search');
    assert.equal(lastRequest.headers?.['authorization'], 'Bearer test_weknora_key');
    assert.equal(lastRequest.headers?.['x-api-key'], 'test_weknora_key');

    assert.equal(lastRequest.body.query_text, 'operating procedure');
    assert.equal(lastRequest.body.match_count, 5);
    assert.equal(lastRequest.body.rerank?.enabled, true);
    assert.deepEqual(lastRequest.body.metadata_filter, { owner_group_id: { $in: ['grp_eng'] } });

    assert.equal(hits.length, 1);
    assert.equal(hits[0].chunk.documentId, 'doc_g1');
    assert.equal(hits[0].chunk.documentTitle, 'Global Guidelines');
    assert.equal(hits[0].score, 0.95);
  });

  it('3.5 should dispatch space-scoped search to /api/v1/knowledge-bases/{spaceId}/hybrid-search', async () => {
    const driver = new WeKnoraDriver({
      endpoint: `http://127.0.0.1:${serverPort}`,
      apiKey: 'secret_key'
    });

    const hits = await driver.searchHybrid('formula', [], 3, 'space_secret');
    assert.equal(lastRequest.url, '/api/v1/knowledge-bases/space_secret/hybrid-search');
    assert.equal(lastRequest.body.query_text, 'formula');
    assert.equal(lastRequest.body.match_count, 3);

    assert.equal(hits.length, 1);
    assert.equal(hits[0].chunk.id, 'chunk_space_1');
    assert.equal(hits[0].chunk.content, 'Secret formula 42');
  });

  it('3.6 should ingest documents to /api/v1/knowledge-bases/{spaceId}/documents', async () => {
    const driver = new WeKnoraDriver({
      endpoint: `http://127.0.0.1:${serverPort}`,
      apiKey: 'ingest_key'
    });

    const success = await driver.ingestDocument(
      'doc_new_99',
      'New Technical Manual',
      'Full technical manual text content',
      'space_mfg',
      'grp_mfg_team'
    );

    assert.equal(success, true);
    assert.equal(lastRequest.url, '/api/v1/knowledge-bases/space_mfg/documents');
    assert.equal(lastRequest.body.title, 'New Technical Manual');
    assert.equal(lastRequest.body.content, 'Full technical manual text content');
    assert.equal(lastRequest.body.metadata.document_id, 'doc_new_99');
    assert.equal(lastRequest.body.metadata.owner_group_id, 'grp_mfg_team');
  });

  it('3.7 should propagate upstream cluster HTTP errors explicitly', async () => {
    const driver = new WeKnoraDriver({
      endpoint: `http://127.0.0.1:${serverPort}`
    });

    // Request non-existent space configured to return 404
    await assert.rejects(
      () => driver.searchHybrid('fail', [], 5, 'error_404'),
      /WeKnora cluster returned HTTP 404/
    );
  });
});
