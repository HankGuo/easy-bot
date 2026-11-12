import test, { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import { MCPHostManager } from '../core/mcp-host.js';

describe('Unit Test: MCPHostManager & Tool Ecosystem', () => {
  let mcp: MCPHostManager;

  beforeEach(() => {
    mcp = new MCPHostManager();
  });

  it('5.1 should initialize default built-in servers and tools', () => {
    const servers = mcp.listServers();
    assert.equal(servers.length, 3);
    const serverIds = servers.map(s => s.id);
    assert.ok(serverIds.includes('builtin-filesystem'));
    assert.ok(serverIds.includes('builtin-sandbox'));
    assert.ok(serverIds.includes('builtin-knowledge'));

    const tools = mcp.listTools();
    assert.equal(tools.length, 4);
    const toolNames = tools.map(t => t.name);
    assert.ok(toolNames.includes('workspace_file_read'));
    assert.ok(toolNames.includes('workspace_file_write'));
    assert.ok(toolNames.includes('workspace_shell_execute'));
    assert.ok(toolNames.includes('hybrid_rag_query'));
  });

  it('5.2 should report tool existence via hasTool() and getTool()', () => {
    assert.equal(mcp.hasTool('workspace_file_read'), true);
    assert.equal(mcp.hasTool('nonexistent_tool'), false);

    const tool = mcp.getTool('workspace_file_read');
    assert.ok(tool);
    assert.equal(tool?.name, 'workspace_file_read');
    assert.equal(tool?.serverId, 'builtin-filesystem');
    assert.ok(tool?.inputSchema.properties.path);
  });

  it('5.3 should register and execute in-memory tool handlers', async () => {
    let executed = false;
    mcp.registerToolHandler('workspace_file_read', async (args) => {
      executed = true;
      return `Content of ${args.path}: sample text`;
    });

    const result = await mcp.callTool('workspace_file_read', { path: 'test.txt' });
    assert.equal(executed, true);
    assert.equal(result, 'Content of test.txt: sample text');
  });

  it('5.4 should throw error when calling unregistered tool', async () => {
    await assert.rejects(
      () => mcp.callTool('unknown_phantom_tool', {}),
      /Tool "unknown_phantom_tool" not found in MCP registry/
    );
  });

  it('5.5 should allow dynamic registration of custom tools and handlers', async () => {
    mcp.registerCustomTool(
      {
        name: 'calculate_tolerance',
        description: 'Calculate manufacturing tolerance range',
        serverId: 'custom-mfg-calc',
        inputSchema: {
          type: 'object',
          properties: {
            nominal: { type: 'number' },
            grade: { type: 'string' }
          },
          required: ['nominal']
        }
      },
      async (args) => {
        const tol = args.nominal * 0.005;
        return JSON.stringify({ min: args.nominal - tol, max: args.nominal + tol });
      }
    );

    assert.equal(mcp.hasTool('calculate_tolerance'), true);
    const resultJson = await mcp.callTool('calculate_tolerance', { nominal: 100 });
    const parsed = JSON.parse(resultJson);
    assert.equal(parsed.min, 99.5);
    assert.equal(parsed.max, 100.5);
  });

  it('5.6 should propagate tool execution exceptions cleanly', async () => {
    mcp.registerToolHandler('error_tool', async () => {
      throw new Error('Sensor hardware timeout');
    });

    await assert.rejects(
      () => mcp.callTool('error_tool', {}),
      /Sensor hardware timeout/
    );
  });

  it('5.7 should reject registering unsupported MCP transport kinds', async () => {
    await mcp.registerServer({
      id: 'invalid-server',
      name: 'Invalid Transport Server',
      transport: 'invalid_proto' as any
    });

    const s = mcp.listServers().find(srv => srv.id === 'invalid-server');
    assert.ok(s);
    assert.equal(s?.status, 'ERROR');
  });

  it('5.8 should clean up registered tools when external server is disconnected', async () => {
    mcp.registerCustomTool({
      name: 'temp_remote_tool',
      description: 'Temporary remote tool',
      serverId: 'temp-server',
      inputSchema: {}
    }, async () => 'hello');

    assert.equal(mcp.hasTool('temp_remote_tool'), true);

    await mcp.disconnectServer('temp-server');
    assert.equal(mcp.hasTool('temp_remote_tool'), false);
  });
});
