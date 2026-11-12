import test, { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import * as http from 'node:http';
import { OctopGatewayDriver } from '../core/octop-driver.js';

describe('Unit Test: OctopGatewayDriver Upstream Platform Integration', () => {
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

        if (req.url === '/api/health') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok', active_workers: 4 }));
          return;
        }

        if (req.url?.match(/\/api\/agents\/[^/]+\/channels$/) && req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            channels: [
              { id: 'chan_wecom_01', kind: 'wecom', name: '企微研发频道', status: 'active' },
              { id: 'chan_feishu_02', kind: 'feishu', name: '飞书制造预警', status: 'active' }
            ]
          }));
          return;
        }

        if (req.url?.match(/\/api\/agents\/[^/]+\/channels$/) && req.method === 'POST') {
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ id: 'chan_created_99', ok: true }));
          return;
        }

        if (req.url?.includes('/test') && req.method === 'POST') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, latency: 45 }));
          return;
        }

        if (req.url?.includes('/probe') && req.method === 'POST') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, reason: 'Valid webhook configuration' }));
          return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Resource not found' } }));
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

  it('4.1 should return true on isAvailable() when Octop /api/health responds with 200', async () => {
    const octop = new OctopGatewayDriver({ endpoint: `http://127.0.0.1:${serverPort}` });
    const isUp = await octop.isAvailable();
    assert.equal(isUp, true);
    assert.equal(lastRequest.url, '/api/health');
  });

  it('4.2 should return false on isAvailable() when Octop host is unreachable', async () => {
    const octop = new OctopGatewayDriver({ endpoint: 'http://127.0.0.1:59997' });
    const isUp = await octop.isAvailable();
    assert.equal(isUp, false);
  });

  it('4.3 should list channels for an agent via GET /api/agents/{aid}/channels', async () => {
    const octop = new OctopGatewayDriver({
      endpoint: `http://127.0.0.1:${serverPort}`,
      apiKey: 'test_octop_jwt'
    });

    const channels = await octop.listChannels('agent_senior_advisor');
    assert.equal(lastRequest.url, '/api/agents/agent_senior_advisor/channels');
    assert.equal(lastRequest.headers?.['authorization'], 'Bearer test_octop_jwt');

    assert.equal(channels.length, 2);
    assert.equal(channels[0].id, 'chan_wecom_01');
    assert.equal(channels[0].kind, 'wecom');
  });

  it('4.4 should register a new channel via POST /api/agents/{aid}/channels', async () => {
    const octop = new OctopGatewayDriver({
      endpoint: `http://127.0.0.1:${serverPort}`,
      apiKey: 'test_octop_jwt'
    });

    const result = await octop.createChannel('agent_senior_advisor', {
      kind: 'wecom',
      name: '生产报警专线',
      config: { webhook_url: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=abc' }
    });

    assert.equal(result.ok, true);
    assert.equal(result.channelId, 'chan_created_99');
    assert.equal(lastRequest.url, '/api/agents/agent_senior_advisor/channels');
    assert.equal(lastRequest.body.kind, 'wecom');
    assert.equal(lastRequest.body.name, '生产报警专线');
  });

  it('4.5 should test channel connectivity via POST /api/agents/{aid}/channels/{cid}/test', async () => {
    const octop = new OctopGatewayDriver({ endpoint: `http://127.0.0.1:${serverPort}` });
    const res = await octop.testChannel('agent_senior_advisor', 'chan_wecom_01');

    assert.equal(res.ok, true);
    assert.ok(res.latencyMs >= 0);
    assert.equal(lastRequest.url, '/api/agents/agent_senior_advisor/channels/chan_wecom_01/test');
  });

  it('4.6 should preflight candidate config via POST /api/agents/{aid}/channels/probe', async () => {
    const octop = new OctopGatewayDriver({ endpoint: `http://127.0.0.1:${serverPort}` });
    const res = await octop.probeChannel('agent_senior_advisor', {
      kind: 'feishu',
      config: { app_id: 'cli_123', app_secret: 'sec_456' }
    });

    assert.equal(res.ok, true);
    assert.equal(res.reason, 'Valid webhook configuration');
    assert.equal(lastRequest.url, '/api/agents/agent_senior_advisor/channels/probe');
  });

  it('4.7 should resolve correct official Octop Agent MCP Gateway URL', () => {
    const octop = new OctopGatewayDriver({ endpoint: 'http://octop.internal:8090' });
    assert.equal(octop.getMcpGatewayUrl(), 'http://octop.internal:8090/api/mcp/agents');
  });
});
