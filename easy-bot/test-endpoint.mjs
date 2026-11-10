#!/usr/bin/env node

/**
 * EasyBot CLI End-to-End Endpoint Runner & Diagnostic Tool
 * Usage:
 *   node test-endpoint.js --mock
 *   node test-endpoint.js --ollama
 *   node test-endpoint.js --base-url https://api.deepseek.com/v1 --key sk-xxxx --model deepseek-chat
 */

import { ModelClient } from './dist/main/core/model-client.js';
import { SandboxEngine } from './dist/main/core/sandbox-engine.js';
import { AgentRouter } from './dist/main/core/agent-router.js';
import { HybridRAGEngine } from './dist/main/core/hybrid-rag.js';
import { MCPHostManager } from './dist/main/core/mcp-host.js';
import * as path from 'node:path';

const args = process.argv.slice(2);
function getArg(flag, def = '') {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : def;
}

const isMock = args.includes('--mock');
const isOllama = args.includes('--ollama');
const baseUrl = getArg('--base-url', isOllama ? 'http://localhost:11434/v1' : (isMock ? 'http://127.0.0.1:4100/mock' : 'https://token.sensenova.cn/v1'));
const apiKey = getArg('--key', process.env.OPENAI_API_KEY || (isOllama || isMock ? '' : 'sk-3UHPzn5qZBVktG9EZwE7AYxoXSxxxUTS'));
const model = getArg('--model', isOllama ? 'llama3:latest' : (isMock ? 'mock-agent' : 'sensenova-6.8-flash-lite'));

console.log('\n======================================================');
console.log('🚀 EasyBot 自定义大模型端点端到端链路测试器');
console.log('======================================================');
console.log(`- Provider:   ${isMock ? 'mock' : (isOllama ? 'ollama' : 'openai-compatible')}`);
console.log(`- Base URL:   ${baseUrl}`);
console.log(`- Model:      ${model}`);
console.log(`- API Key:    ${apiKey ? (apiKey.slice(0, 4) + '...' + apiKey.slice(-4)) : '(未提供，使用免密/模拟模式)'}`);
console.log('------------------------------------------------------');

async function run() {
  const workspaceRoot = path.join(process.cwd(), 'workspace');
  const sandbox = new SandboxEngine(workspaceRoot);
  const rag = new HybridRAGEngine();
  const mcp = new MCPHostManager();
  const router = new AgentRouter(sandbox, rag, mcp);

  // 1. Configure Model Endpoint
  router.getModelClient().updateConfig({
    provider: isMock ? 'mock' : (isOllama ? 'ollama' : 'openai-compatible'),
    baseUrl,
    apiKey,
    model
  });

  // 2. Test Ping Connection
  console.log('\n[Step 1] 测试端点网络连通性 (Ping)...');
  const pingRes = await router.getModelClient().testConnection();
  if (pingRes.success) {
    console.log(`  ✓ 连通成功! 响应延迟: ${pingRes.latencyMs}ms`);
    console.log(`  ✓ 回包预览: ${pingRes.responsePreview}`);
  } else {
    console.log(`  ✗ 连通失败: ${pingRes.error}`);
    if (!isMock && !isOllama && !apiKey) {
      console.log('  [提示] 您未提供 API Key，请通过 --key sk-xxxx 传入，或者运行 node test-endpoint.js --mock 测试离线沙箱闭环！');
    }
  }

  // 3. Run Autonomous Agent Tool Calling Test inside Micro-Sandbox
  console.log('\n[Step 2] 发起真实业务链路调用 (创建文件并执行沙箱审计)...');
  const session = router.createSession('CLI-E2E-Session', 'CustomEndpoint');
  console.log(`  - 专属沙箱隔离路径: ${session.workspacePath}`);

  const userPrompt = '请帮我创建文件 app_service.js 并写入验证逻辑';
  console.log(`  - 发送测试指令: "${userPrompt}"`);

  const reply = await router.handleUserMessage(
    session.id,
    userPrompt,
    (chunk) => process.stdout.write(chunk),
    (toolCall) => {
      console.log(`\n  ⚡ [Agent 触发工具调用]: ${toolCall.toolName}`);
      console.log(`     入参: ${JSON.stringify(toolCall.args)}`);
    },
    (toolResult) => {
      console.log(`  ✓ [沙箱执行完成]: 耗时 ${toolResult.durationMs}ms`);
      if (toolResult.output) console.log(`     输出: ${toolResult.output.slice(0, 100)}`);
      if (toolResult.error) console.log(`     拦截: ${toolResult.error}`);
    }
  );

  console.log('\n\n======================================================');
  console.log('🎉 端到端全链路闭环测试完成！');
  console.log('======================================================\n');
}

run().catch(err => {
  console.error('\n❌ 测试异常终止:', err.message);
});
