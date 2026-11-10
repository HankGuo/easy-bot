import React, { useState } from 'react';
import { Activity, Cpu, DollarSign, Clock, Zap, ArrowUpRight, Database, RefreshCw, BarChart2, ShieldCheck } from 'lucide-react';

interface TokenRecord {
  id: string;
  timestamp: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  estimatedCost: number;
  task: string;
  status: 'success' | 'cached' | 'failed';
}

export function TokenMonitor() {
  const [records] = useState<TokenRecord[]>([
    {
      id: 'req-01',
      timestamp: '11:04:12',
      model: 'sensenova-6.8-flash-lite',
      promptTokens: 1420,
      completionTokens: 382,
      totalTokens: 1802,
      latencyMs: 642,
      estimatedCost: 0.00045,
      task: '张云峰教授：开题指导与创新点规划',
      status: 'success'
    },
    {
      id: 'req-02',
      timestamp: '11:02:45',
      model: 'sensenova-6.8-flash-lite',
      promptTokens: 840,
      completionTokens: 215,
      totalTokens: 1055,
      latencyMs: 380,
      estimatedCost: 0.00026,
      task: '课程文献检索与语义匹配重排',
      status: 'success'
    },
    {
      id: 'req-03',
      timestamp: '10:58:30',
      model: 'sensenova-6.8-flash-lite',
      promptTokens: 2100,
      completionTokens: 640,
      totalTokens: 2740,
      latencyMs: 890,
      estimatedCost: 0.00068,
      task: '李维老师：K-Means 聚类实训代码生成',
      status: 'success'
    },
    {
      id: 'req-04',
      timestamp: '10:55:18',
      model: 'sensenova-6.8-flash-lite',
      promptTokens: 610,
      completionTokens: 140,
      totalTokens: 750,
      latencyMs: 295,
      estimatedCost: 0.00018,
      task: '教学沙箱工具参数校验与审计',
      status: 'cached'
    }
  ]);

  const totalTokens = records.reduce((acc, r) => acc + r.totalTokens, 0);
  const promptTokens = records.reduce((acc, r) => acc + r.promptTokens, 0);
  const completionTokens = records.reduce((acc, r) => acc + r.completionTokens, 0);
  const totalCost = records.reduce((acc, r) => acc + r.estimatedCost, 0);
  const avgLatency = Math.round(records.reduce((acc, r) => acc + r.latencyMs, 0) / (records.length || 1));

  return (
    <div className="flex flex-col h-full bg-slate-50 p-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" />
            校园算力与 Token 消耗审计看板 (Campus Compute & Token Monitor)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            高校级高精度计量仪表盘：实时统计院系师生推理 Token 配额、平均响应延迟与本地私有算力负载
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            校园算力直连 (零外部中转与数据外泄)
          </span>
        </div>
      </div>

      {/* Metrics Row - Ant Design Enterprise Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">累计 Token 总消耗</span>
            <Database className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">
            {totalTokens.toLocaleString()}
          </div>
          <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-500">
            <span>输入: {promptTokens.toLocaleString()}</span>
            <span>·</span>
            <span>输出: {completionTokens.toLocaleString()}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">平均推理延迟 (P50)</span>
            <Clock className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">
            {avgLatency} <span className="text-sm font-normal text-slate-500">ms</span>
          </div>
          <div className="flex items-center gap-1 mt-2 text-[11px] text-emerald-600 font-medium">
            <Zap className="w-3 h-3" />
            首字极速响应 (TTFT: 140ms)
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">累计预估成本 (USD)</span>
            <DollarSign className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">
            ${totalCost.toFixed(5)}
          </div>
          <div className="text-[11px] text-slate-500 mt-2">
            DeepSeek V3 官方定价比率
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">安全风控审计率</span>
            <ShieldCheck className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 font-mono">
            100.0%
          </div>
          <div className="text-[11px] text-slate-500 mt-2">
            所有 Prompt/Tool Use 零脱敏出境
          </div>
        </div>
      </div>

      {/* Audit Log Table - Ant Design / Element Pro Table Style */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col">
        <div className="px-5 py-3.5 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-800">请求明细记录 (Invocation Ledger)</span>
          <span className="text-xs text-slate-400">共 {records.length} 条记录</span>
        </div>

        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/50 text-slate-500 border-b border-slate-200 font-medium">
                <th className="py-2.5 px-4">请求ID</th>
                <th className="py-2.5 px-4">时间</th>
                <th className="py-2.5 px-4">模型</th>
                <th className="py-2.5 px-4">业务上下文</th>
                <th className="py-2.5 px-4">Prompt Tokens</th>
                <th className="py-2.5 px-4">Completion</th>
                <th className="py-2.5 px-4">延迟</th>
                <th className="py-2.5 px-4">预估费用</th>
                <th className="py-2.5 px-4">状态</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-3 px-4 font-mono font-medium text-slate-700">{r.id}</td>
                  <td className="py-3 px-4 text-slate-500 font-mono">{r.timestamp}</td>
                  <td className="py-3 px-4 font-medium text-blue-600">{r.model}</td>
                  <td className="py-3 px-4 text-slate-800">{r.task}</td>
                  <td className="py-3 px-4 font-mono text-slate-600">{r.promptTokens.toLocaleString()}</td>
                  <td className="py-3 px-4 font-mono text-slate-600">{r.completionTokens.toLocaleString()}</td>
                  <td className="py-3 px-4 font-mono text-slate-600">{r.latencyMs} ms</td>
                  <td className="py-3 px-4 font-mono text-slate-700">${r.estimatedCost.toFixed(5)}</td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                      r.status === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                      r.status === 'cached' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                      'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}>
                      {r.status === 'success' ? '正常' : r.status === 'cached' ? '命中缓存' : '失败'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
