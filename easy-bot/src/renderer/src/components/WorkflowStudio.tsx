import React, { useState } from 'react';
import { GitFork, Play, CheckCircle2, Clock, XCircle, ArrowRight, Layers, FileText, Code2, Cpu } from 'lucide-react';

interface Props {
  onRunWorkflow: (workflowId: string, inputs: any) => Promise<any>;
}

export const WorkflowStudio: React.FC<Props> = ({ onRunWorkflow }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [queryInput, setQueryInput] = useState('大模型驱动的高校计算机实训全流程');
  const [runResult, setRunResult] = useState<any | null>(null);

  const sampleNodes = [
    { id: '1', title: '实验任务解析与规范化', type: 'START', desc: '解析学生实验指令与文献参数', icon: Play },
    { id: '2', title: '课程文献与教材语义检索', type: 'RAG', desc: '课程知识库与实验手册双路匹配', icon: FileText },
    { id: '3', title: '学术导师推理与方案生成', type: 'LLM', desc: '开题构思与算法实验代码指导', icon: Cpu },
    { id: '4', title: '受限沙箱运行与结果采集', type: 'SANDBOX', desc: '安全隔离运行并输出控制台/图表数据', icon: Code2 },
    { id: '5', title: '实验报告归档与导师复核', type: 'END', desc: '生成标准化实验报告与学术评分', icon: CheckCircle2 }
  ];

  const handleRun = async () => {
    setIsRunning(true);
    try {
      const res = await onRunWorkflow('wf-auto-dev-qa', { query: queryInput });
      setRunResult(res);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 text-xs p-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-6 bg-white p-4 rounded-lg shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
            <GitFork className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800">高校科研与实验流程流水线 (EduFlow Engine)</h2>
            <p className="text-[11px] text-slate-500">基于有向无环图 (DAG) 的自动化多助教协同与实验实训流转系统</p>
          </div>
        </div>
        <button
          onClick={handleRun}
          disabled={isRunning}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-md text-xs font-semibold flex items-center gap-2 shadow-xs transition"
        >
          {isRunning ? <Clock className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          <span>{isRunning ? '正在按序流转...' : '一键执行工作流'}</span>
        </button>
      </div>

      {/* Input box */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 mb-6 shadow-2xs">
        <label className="text-xs font-semibold text-slate-700 block mb-1.5">流程入参设定 (Workflow Parameters):</label>
        <input
          type="text"
          value={queryInput}
          onChange={(e) => setQueryInput(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition"
          placeholder="输入要处理的工作流目标..."
        />
      </div>

      {/* Visual Pipeline Canvas */}
      <div className="mb-6">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
          流水线拓扑编排视图 (DAG Pipeline Nodes)
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {sampleNodes.map((n, idx) => {
            const Icon = n.icon;
            return (
              <div key={n.id} className="relative group">
                <div className="p-4 bg-white border border-slate-200 hover:border-blue-400 rounded-lg space-y-2 transition shadow-2xs h-full flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-6 h-6 rounded bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-semibold text-slate-700 text-xs">Node {idx + 1}</span>
                    </div>
                    <div className="text-xs font-semibold text-slate-800">{n.title}</div>
                    <div className="text-[11px] text-slate-500 mt-1">{n.desc}</div>
                  </div>
                  <div className="text-[10px] font-mono font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded w-fit mt-3">
                    READY
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Execution Results & Trace Logs */}
      {runResult && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              运行时追踪与耗时归档 (Trace Logs · 共 {runResult.totalDurationMs}ms)
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
              <CheckCircle2 className="w-3.5 h-3.5" /> 流水线 100% 成功达成
            </span>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-2xs divide-y divide-slate-100">
            {runResult.steps.map((st: any, idx: number) => (
              <div key={idx} className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center text-xs font-bold font-mono">
                    {idx + 1}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-800">{st.nodeId}</span>
                    <span className="text-[11px] text-slate-400 ml-2 font-mono">{st.status}</span>
                  </div>
                </div>
                <div className="text-[11px] font-mono text-slate-500 bg-slate-50 px-2 py-1 rounded border border-slate-200">
                  {st.durationMs}ms
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
