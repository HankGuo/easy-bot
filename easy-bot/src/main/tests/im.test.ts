import test, { describe, it, before, after, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import * as http from 'node:http';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { IMEngine, Expert, Channel } from '../core/im-engine.js';
import { SandboxEngine } from '../core/sandbox-engine.js';
import { HybridRAGEngine } from '../core/hybrid-rag.js';
import { ModelClient } from '../core/model-client.js';

describe('Unit Test: IMEngine Enterprise Collaboration & Connectors', () => {
  let server: http.Server;
  let serverPort: number;

  let testDir: string;
  let modelClient: ModelClient;
  let sandbox: SandboxEngine;
  let rag: HybridRAGEngine;
  let imEngine: IMEngine;

  before(async () => {
    server = http.createServer((req, res) => {
      if (req.method === 'POST' && req.url?.includes('/chat/completions')) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        });
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: '收到协同请求，专家已在线提供技术方案。' } }] })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      } else if (req.method === 'POST' && req.url?.includes('/webhook/test_endpoint')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ errcode: 0, errmsg: 'ok' }));
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as any;
        serverPort = addr.port;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    testDir = path.join(process.cwd(), 'workspace', 'test_im_' + Date.now() + Math.random().toString(36).slice(2, 6));
    fs.mkdirSync(testDir, { recursive: true });

    sandbox = new SandboxEngine(path.join(testDir, 'sandbox'));
    rag = new HybridRAGEngine();
    modelClient = new ModelClient();
    modelClient.updateConfig({
      baseUrl: `http://127.0.0.1:${serverPort}/v1`,
      apiKey: 'sk-im-test-key',
      model: 'chat-im'
    });

    imEngine = new IMEngine(testDir, modelClient, sandbox, rag);
  });

  it('12.1 should initialize default domain-neutral experts, channels, and connectors', () => {
    const experts = imEngine.listExperts();
    assert.ok(experts.length >= 4);
    assert.ok(experts.some(e => e.id === 'exp-arch'));
    assert.ok(experts.some(e => e.id === 'exp-code'));

    const channels = imEngine.listChannels();
    assert.ok(channels.length >= 2);
    assert.ok(channels.some(c => c.id === 'chan-all'));

    const connectors = imEngine.listConnectors();
    assert.ok(connectors.length >= 6);
    assert.ok(connectors.some(conn => conn.id === 'conn-octop'));
    assert.ok(connectors.some(conn => conn.id === 'conn-wecom'));
  });

  it('12.2 should register new custom expert and channel dynamically', () => {
    const customExpert: Expert = {
      id: 'exp-iot',
      name: '工业物联网专员',
      avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=iot',
      title: '工业物联网专家 (IoT SRE)',
      description: '负责边缘网关通信与 MQTT 遥测',
      systemPrompt: '你是工业物联网专家，分析传感器指标。',
      skills: ['mqtt-protocol', 'sensor-diagnostics'],
      model: 'chat-im',
      status: 'online',
      color: '#13c2c2',
      tags: ['MQTT', 'Modbus', '边缘计算']
    };

    const customChannel: Channel = {
      id: 'chan-iot-alerts',
      name: '边缘物联网报警流',
      description: '产线网关遥测与异常推送',
      isGroup: true,
      expertIds: ['exp-iot'],
      unreadCount: 0
    };

    imEngine.registerExpert(customExpert);
    imEngine.registerChannel(customChannel);

    assert.equal(imEngine.getExpert('exp-iot')?.name, '工业物联网专员');
    assert.ok(imEngine.listChannels().some(c => c.id === 'chan-iot-alerts'));
  });

  it('12.3 should persist and reload state across engine restarts', () => {
    const customExpert: Expert = {
      id: 'exp-safety',
      name: 'EHS安全员',
      avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=safety',
      title: '生产安全监督员',
      description: '产线合规与安规审计',
      systemPrompt: '你是安全专家。',
      skills: ['ehs-audit'],
      model: 'chat-im',
      status: 'online',
      color: '#ff4d4f',
      tags: ['EHS']
    };

    imEngine.registerExpert(customExpert);

    // Instantiate a new IMEngine pointing to the same dataDir
    const reloadedEngine = new IMEngine(testDir, modelClient, sandbox, rag);
    assert.equal(reloadedEngine.getExpert('exp-safety')?.name, 'EHS安全员');
  });

  it('12.4 should send user message and generate expert reply via model streaming', async () => {
    const res = await imEngine.sendMessage('chan-all', 'usr_001', '王工', '微服务架构如何实现灰度发布？');
    assert.ok(res.userMessage);
    assert.equal(res.userMessage.content, '微服务架构如何实现灰度发布？');
    assert.ok(res.expertMessage);
    assert.ok(res.expertMessage.content.includes('收到协同请求'));

    const msgs = imEngine.getMessages('chan-all');
    assert.ok(msgs.some(m => m.id === res.userMessage.id));
    assert.ok(msgs.some(m => m.id === res.expertMessage?.id));
  });

  it('12.5 should route reply to specifically @mentioned expert in user message', async () => {
    const res = await imEngine.sendMessage('chan-all', 'usr_002', '赵工', '@李工 代码中的空指针异常应该如何防御？');
    assert.ok(res.expertMessage);
    assert.ok(res.expertMessage.senderName.includes('李工'));
  });

  it('12.6 should route inbound webhook messages using dynamic keyword routing', async () => {
    imEngine.registerKeywordRouting({
      '架构': 'exp-arch',
      '运维': 'exp-ops'
    });

    const inboundRes = await imEngine.handleInboundMessage('wecom', {
      senderId: 'ext_usr_01',
      senderName: '孙总监',
      content: '请评估当前系统的生产运维可靠性方案'
    });

    assert.ok(inboundRes.expertName.includes('陈主管') || inboundRes.expertName.includes('运维'));
    assert.ok(inboundRes.reply.length > 0);
  });

  it('12.7 should fail testConnector gracefully when endpoint is unconfigured or mock', async () => {
    const res = await imEngine.testConnector('conn-wecom');
    assert.equal(res.success, false);
    assert.ok(res.message.includes('未配置有效 Webhook URL'));
  });

  it('12.8 should succeed testConnector when HTTP endpoint returns 200', async () => {
    const connectors = imEngine.listConnectors();
    const wecomConn = connectors.find(c => c.id === 'conn-wecom');
    assert.ok(wecomConn);

    wecomConn.config.webhookUrl = `http://127.0.0.1:${serverPort}/webhook/test_endpoint`;

    const res = await imEngine.testConnector('conn-wecom');
    assert.equal(res.success, true);
    assert.ok(res.latencyMs >= 0);
    assert.ok(res.message.includes('握手成功') || res.message.includes('HTTP 200'));
    assert.equal(wecomConn.status, 'connected');
  });
});
