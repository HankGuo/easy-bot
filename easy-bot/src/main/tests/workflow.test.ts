import test, { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert/strict';
import * as path from 'node:path';
import { WorkflowEngine, WorkflowDefinition } from '../core/workflow-engine.js';
import { SandboxEngine } from '../core/sandbox-engine.js';
import { HybridRAGEngine } from '../core/hybrid-rag.js';
import { MCPHostManager } from '../core/mcp-host.js';
import { ModelClient } from '../core/model-client.js';

describe('Unit Test: WorkflowEngine DAG & State Propagation', () => {
  let sandbox: SandboxEngine;
  let rag: HybridRAGEngine;
  let mcp: MCPHostManager;
  let model: ModelClient;
  let engine: WorkflowEngine;

  beforeEach(() => {
    const ws = path.join(process.cwd(), 'workspace', 'test_wf_unit_' + Date.now());
    sandbox = new SandboxEngine(ws);
    rag = new HybridRAGEngine();
    mcp = new MCPHostManager();
    model = new ModelClient();
    engine = new WorkflowEngine(sandbox, rag, mcp, model);
  });

  it('10.1 should load built-in industrial DAG workflow templates', () => {
    const workflows = engine.listWorkflows();
    assert.ok(workflows.length >= 1);
    assert.ok(workflows.some(w => w.name.includes('AgentFlow') || w.name.includes('代码审计')));
  });

  it('10.2 should register and retrieve a custom DAG workflow definition', () => {
    const customDef: WorkflowDefinition = {
      id: 'custom_mfg_pipeline',
      name: '零件尺寸公差全自动检测管线',
      description: '读取测量值并判断合格率',
      entryNodeId: 'node_start',
      nodes: [
        { id: 'node_start', name: 'Start', type: 'START', nextNodeId: 'node_end' },
        { id: 'node_end', name: 'End', type: 'END' }
      ]
    };

    engine.registerWorkflow(customDef);
    const fetched = engine.getWorkflow('custom_mfg_pipeline');
    assert.ok(fetched);
    assert.equal(fetched?.name, '零件尺寸公差全自动检测管线');
  });

  it('10.3 should execute linear workflow and record execution logs', async () => {
    const linearDef: WorkflowDefinition = {
      id: 'wf_linear',
      name: '线性执行测试',
      entryNodeId: 'start_node',
      nodes: [
        { id: 'start_node', name: '启动节点', type: 'START', nextNodeId: 'exec_node' },
        {
          id: 'exec_node',
          name: '代码计算节点',
          type: 'CODE_EXEC',
          config: {
            codeSnippet: 'console.log(42);',
            outputKey: 'calcResult'
          },
          nextNodeId: 'end_node'
        },
        { id: 'end_node', name: '结束节点', type: 'END' }
      ]
    };

    engine.registerWorkflow(linearDef);
    const result = await engine.executeWorkflow('wf_linear', { val: 21 });

    assert.equal(result.status, 'COMPLETED');
    assert.ok(result.logs.length >= 3);
    assert.equal(result.finalOutput.calcResult, '42');
  });

  it('10.4 should branch correctly on CONDITION node evaluation', async () => {
    const branchDef: WorkflowDefinition = {
      id: 'wf_branch',
      name: '条件分支路由测试',
      entryNodeId: 'start_node',
      nodes: [
        { id: 'start_node', name: 'Start', type: 'START', nextNodeId: 'cond_node' },
        {
          id: 'cond_node',
          name: '公差超限判定',
          type: 'CONDITION',
          config: {
            conditionExpr: '{{deviation}} > 0.05',
            trueNextNodeId: 'alarm_node',
            falseNextNodeId: 'pass_node'
          }
        },
        {
          id: 'alarm_node',
          name: '触发报警',
          type: 'CODE_EXEC',
          config: { codeSnippet: 'console.log("ALARM_TRIGGERED");', outputKey: 'outcome' },
          nextNodeId: 'end_node'
        },
        {
          id: 'pass_node',
          name: '合格放行',
          type: 'CODE_EXEC',
          config: { codeSnippet: 'console.log("PASSED");', outputKey: 'outcome' },
          nextNodeId: 'end_node'
        },
        { id: 'end_node', name: 'End', type: 'END' }
      ]
    };

    engine.registerWorkflow(branchDef);

    // Test True branch (deviation 0.12 > 0.05)
    const resTrue = await engine.executeWorkflow('wf_branch', { deviation: 0.12 });
    assert.equal(resTrue.finalOutput.outcome, 'ALARM_TRIGGERED');

    // Test False branch (deviation 0.01 <= 0.05)
    const resFalse = await engine.executeWorkflow('wf_branch', { deviation: 0.01 });
    assert.equal(resFalse.finalOutput.outcome, 'PASSED');
  });

  it('10.5 should integrate KNOWLEDGE_RETRIEVAL node in workflow DAG', async () => {
    rag.addDocument('sop_wf_01', 'SOP Manual', 'Bearing lubrication interval is 500 operating hours');

    const ragDef: WorkflowDefinition = {
      id: 'wf_rag',
      name: '规程检索工作流',
      entryNodeId: 'start_node',
      nodes: [
        { id: 'start_node', name: 'Start', type: 'START', nextNodeId: 'rag_node' },
        {
          id: 'rag_node',
          name: '检索维保规程',
          type: 'KNOWLEDGE_RETRIEVAL',
          config: {
            queryTemplate: 'Bearing lubrication interval',
            outputKey: 'ragHits'
          },
          nextNodeId: 'end_node'
        },
        { id: 'end_node', name: 'End', type: 'END' }
      ]
    };

    engine.registerWorkflow(ragDef);
    const result = await engine.executeWorkflow('wf_rag', {});

    assert.equal(result.status, 'COMPLETED');
    assert.ok(result.finalOutput.ragHits);
    assert.ok(result.finalOutput.ragHits.length >= 1);
    assert.ok(result.finalOutput.ragHits[0].content.includes('500 operating hours'));
  });

  it('10.6 should fail gracefully when workflow is not found', async () => {
    await assert.rejects(
      () => engine.executeWorkflow('nonexistent_wf_id', {}),
      /Workflow nonexistent_wf_id not found/
    );
  });
});
