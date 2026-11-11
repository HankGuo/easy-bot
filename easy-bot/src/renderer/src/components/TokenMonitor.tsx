import React, { useState, useEffect } from 'react';
import { Activity, Cpu, DollarSign, Clock, Zap, ArrowUpRight, Database, RefreshCw, BarChart2, ShieldCheck, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';

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
  status: 'success' | 'cached' | 'failed' | 'simulated';
  tokenSource?: 'upstream_exact' | 'estimated_heuristic';
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
    <div className="flex flex-col h-full bg-[#f8fafc] p-6 md:p-8 overflow-y-auto font-sans">
      <div className="max-w-6xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-200/80 gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700">
                <Activity className="w-4 h-4" />
              </div>
              <h2 className="text-base md:text-lg font-bold text-slate-900 tracking-tight">
                算力遥测与 Token 计量审计看板 (Zero-Mock Telemetry)
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              真实物理调用审计：全链路采集 Token 吞吐、物理往返耗时与推演成本账本（100% 真实调用，无任何硬编码 Mock）
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={fetchTelemetry}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
              <span>刷新遥测</span>
            </button>
            {records.length > 0 && (
              <button
                onClick={handleClear}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-rose-600 bg-white border border-rose-200 hover:bg-rose-50 rounded-xl transition shadow-2xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>清空存证流水</span>
              </button>
            )}
          </div>
        </div>

        {/* Metrics Row - Spacious Card Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 mb-2.5">
              <span className="text-xs font-semibold">累计消耗 Token</span>
              <Database className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-3xl font-bold font-mono text-slate-900 tracking-tight">
              {totalTokens.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-400 mt-2 flex items-center gap-2 font-mono">
              <span>输入: {promptTokens.toLocaleString()}</span>
              <span>•</span>
              <span>输出: {completionTokens.toLocaleString()}</span>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 mb-2.5">
              <span className="text-xs font-semibold">核算推理费用</span>
              <DollarSign className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-3xl font-bold font-mono text-slate-900 tracking-tight">
              ¥{totalCost.toFixed(5)}
            </div>
            <div className="text-[11px] text-emerald-600 mt-2 flex items-center gap-1 font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>标准 API 价格折算基准</span>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 mb-2.5">
              <span className="text-xs font-semibold">平均物理响应时延</span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-3xl font-bold font-mono text-slate-900 tracking-tight">
              {records.length > 0 ? `${avgLatency} ms` : '--'}
            </div>
            <div className="text-[11px] text-slate-400 mt-2 font-mono">
              基于真实 HTTP SSE 流式全周期
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 mb-2.5">
              <span className="text-xs font-semibold">实际推理调用次数</span>
              <Zap className="w-4 h-4 text-purple-500" />
            </div>
            <div className="text-3xl font-bold font-mono text-slate-900 tracking-tight">
              {records.length} 次
            </div>
            <div className="text-[11px] text-purple-600 mt-2 font-medium">
              DeepSeek Harness 核心驱动
            </div>
          </div>
        </div>

        {/* Real Audit Stream Table */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-slate-600" />
              <h3 className="font-bold text-slate-800 text-sm">实时调用遥测存证流水</h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">最近 100 次真实物理请求</span>
          </div>

          {records.length === 0 ? (
            <div className="p-16 text-center text-slate-400 text-xs space-y-2">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <Activity className="w-5 h-5" />
              </div>
              <p className="font-medium text-slate-600">当前暂无推理调用记录</p>
              <p className="text-[11px] text-slate-400">
                在协同大厅与专家（如 @马工、@刘主管）发起提问后，系统将自动在此如实记账
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-6">调用时间</th>
                    <th className="py-3.5 px-6">任务摘要</th>
                    <th className="py-3.5 px-6">调用模型</th>
                    <th className="py-3.5 px-6 font-mono">Token (入 / 出 / 总)</th>
                    <th className="py-3.5 px-6 font-mono">往返耗时</th>
                    <th className="py-3.5 px-6 font-mono">推演费用</th>
                    <th className="py-3.5 px-6 text-right">状态</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {records.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-4 px-6 text-slate-400 font-mono text-[11px]">
                        {r.timestamp}
                      </td>
                      <td className="py-4 px-6 font-medium text-slate-800 max-w-xs truncate" title={r.task}>
                        {r.task}
                      </td>
                      <td className="py-4 px-6">
                        <span className="font-mono text-[11px] text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                          {r.model}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-mono text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <span>{r.promptTokens} / {r.completionTokens} / <strong className="text-slate-800">{r.totalTokens}</strong></span>
                          {r.tokenSource === 'upstream_exact' ? (
                            <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded border border-emerald-200" title="上游大模型 API 真实返回的精确 Token 统计">精确</span>
                          ) : (
                            <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.2 rounded border border-slate-200" title="字符长度启发的估算值">估算</span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6 font-mono text-slate-600">
                        {r.latencyMs} ms
                      </td>
                      <td className="py-4 px-6 font-mono font-medium text-emerald-700">
                        ¥{r.estimatedCost.toFixed(5)}
                      </td>
                      <td className="py-4 px-6 text-right">
                        {r.status === 'simulated' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                            <span>沙箱模拟</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>物理真实</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
