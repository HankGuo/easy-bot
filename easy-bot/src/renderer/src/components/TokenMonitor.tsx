import React, { useState, useEffect } from 'react';
import { Activity, Cpu, DollarSign, Clock, Zap, ArrowUpRight, Database, RefreshCw, BarChart2, ShieldCheck, Trash2 } from 'lucide-react';

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
  const [records, setRecords] = useState<TokenRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchTelemetry = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/telemetry/tokens');
      if (res.ok) {
        const data = await res.json();
        setRecords(data.records || []);
      }
    } catch (err) {
      console.error('Failed to fetch telemetry records:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTelemetry();
  }, []);

  const handleClear = async () => {
    if (!confirm('确定要清空当前的 Token 审计调用流水吗？')) return;
    try {
      await fetch('/api/telemetry/tokens', { method: 'DELETE' });
      setRecords([]);
    } catch (err) {
      console.error('Failed to clear telemetry records:', err);
    }
  };

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
            企业级算力与 Token 消耗审计看板 (Enterprise Compute & Token Monitor)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            高精度计量仪表盘：实时统计团队推理 Token 配额、平均响应延迟与私有化算力负载 (100% 真实调用存证，无 Mock 数据)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchTelemetry}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>刷新</span>
          </button>
          {records.length > 0 && (
            <button
              onClick={handleClear}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-600 bg-white border border-rose-200 hover:bg-rose-50 rounded-md transition shadow-2xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>清空流水</span>
            </button>
          )}
        </div>
      </div>

      {/* Metrics Row - Ant Design Enterprise Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">累计消耗 Token</span>
            <Database className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900">
            {totalTokens.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
            <span>输入: {promptTokens.toLocaleString()}</span>
            <span>•</span>
            <span>输出: {completionTokens.toLocaleString()}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">预估推理费用</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900">
            ¥{totalCost.toFixed(5)}
          </div>
          <div className="text-[11px] text-emerald-600 mt-1 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" />
            <span>公网 API 批发计费参考</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">平均端到端时延</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900">
            {records.length > 0 ? `${avgLatency} ms` : '--'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            基于真实 HTTP SSE 流式响应耗时
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">真实请求总次数</span>
            <Zap className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900">
            {records.length} 次
          </div>
          <div className="text-[11px] text-purple-600 mt-1">
            DeepSeek Harness 执行核心
          </div>
        </div>
      </div>

      {/* Real Audit Stream Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm flex-1 flex flex-col overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <span className="text-xs font-semibold text-slate-800">
            实时推理调用审计明细 (Live Audit Stream)
          </span>
          <span className="text-xs text-slate-500 font-mono">
            共 {records.length} 条调用存证
          </span>
        </div>

        {records.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs flex-1 flex flex-col items-center justify-center">
            <Activity className="w-8 h-8 text-slate-300 mb-2" />
            <div>暂无实时推理调用记录</div>
            <div className="text-[11px] text-slate-400 mt-1">
              向智能专家提问或发起工作流任务后，系统将在此实时呈现 100% 真实调用计费流水
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5">调用时间</th>
                  <th className="px-4 py-2.5">任务摘要</th>
                  <th className="px-4 py-2.5">推理模型</th>
                  <th className="px-4 py-2.5 text-right">输入 / 输出 Tokens</th>
                  <th className="px-4 py-2.5 text-right">总 Tokens</th>
                  <th className="px-4 py-2.5 text-right">时延</th>
                  <th className="px-4 py-2.5 text-right">预估费用</th>
                  <th className="px-4 py-2.5 text-center">状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {records.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-4 py-2.5 text-slate-500">{rec.timestamp}</td>
                    <td className="px-4 py-2.5 font-sans font-medium text-slate-800 max-w-xs truncate" title={rec.task}>
                      {rec.task}
                    </td>
                    <td className="px-4 py-2.5 text-blue-600">{rec.model}</td>
                    <td className="px-4 py-2.5 text-right text-slate-500">
                      {rec.promptTokens} / {rec.completionTokens}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-slate-900">
                      {rec.totalTokens}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{rec.latencyMs}ms</td>
                    <td className="px-4 py-2.5 text-right text-emerald-600">
                      ¥{rec.estimatedCost.toFixed(5)}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-sans font-medium ${
                        rec.status === 'success' 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                          : rec.status === 'cached'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {rec.status === 'success' ? '调用成功' : rec.status === 'cached' ? '沙箱缓存' : '调用异常'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
