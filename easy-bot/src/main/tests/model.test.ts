import test, { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { ModelClient } from '../core/model-client.js';

describe('Unit Test: ModelClient & Zero-Mock Telemetry Metering', () => {
  let client: ModelClient;

  beforeEach(() => {
    client = new ModelClient();
  });

  it('6.1 should mask sensitive API keys in getMaskedConfig()', () => {
    client.updateConfig({
      apiKey: 'sk-1234567890abcdef1234567890abcdef'
    });

    const masked = client.getMaskedConfig();
    assert.equal(masked.apiKeyMasked.startsWith('sk-1'), true);
    assert.equal(masked.apiKeyMasked.endsWith('cdef'), true);
    assert.ok(masked.apiKeyMasked.includes('...'));
    assert.equal(masked.hasKey, true);
  });

  it('6.2 should return hasKey false when key is empty', () => {
    client.updateConfig({ apiKey: '' });
    const masked = client.getMaskedConfig();
    assert.equal(masked.hasKey, false);
    assert.equal(masked.apiKeyMasked, '');
  });

  it('6.3 should enforce Zero-Mock guard when calling cloud endpoint without key', async () => {
    client.updateConfig({
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      provider: 'openai-compatible'
    });

    await assert.rejects(
      () => client.streamChat([{ role: 'user', content: 'test prompt' }]),
      /未配置大模型 API Key.*Zero-Mock 准则生效/
    );
  });

  it('6.4 should allow connection testing on local addresses without API key', async () => {
    client.updateConfig({
      baseUrl: 'http://127.0.0.1:59996/v1',
      apiKey: '',
      model: 'local-test-model'
    });

    // It should attempt network request rather than throwing "未配置 API Key"
    const ping = await client.testConnection();
    assert.equal(ping.success, false);
    assert.ok(!ping.error?.includes('未配置 API Key'));
  });

  it('6.5 should reject cloud connection testing without API key', async () => {
    client.updateConfig({
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: ''
    });

    const ping = await client.testConnection();
    assert.equal(ping.success, false);
    assert.ok(ping.error?.includes('未配置 API Key'));
  });

  it('6.6 should update temperature and maxTokens within valid ranges', () => {
    client.updateConfig({
      temperature: 0.2,
      maxTokens: 2048
    });

    const cfg = client.getConfig();
    assert.equal(cfg.temperature, 0.2);
    assert.equal(cfg.maxTokens, 2048);
  });
});
