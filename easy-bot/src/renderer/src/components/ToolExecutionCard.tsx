import React from 'react';
import { Terminal, FileCode, Search, ShieldCheck, AlertTriangle, CheckCircle2, Clock, XCircle, Code2 } from 'lucide-react';
import { ToolCallEvent, ToolResultEvent } from '../types';

interface Props {
  toolCall: ToolCallEvent;
  result?: ToolResultEvent;
}

export const ToolExecutionCard: React.FC<Props> = ({ toolCall, result }) => {
  const getToolIcon = (name: string) => {
    if (name.includes('file')) return <FileCode className="w-3.5 h-3.5 text-blue-600" />;
    if (name.includes('rag') || name.includes('query')) return <Search className="w-3.5 h-3.5 text-purple-600" />;
    if (name.includes('shell') || name.includes('exec')) return <Terminal className="w-3.5 h-3.5 text-amber-600" />;
    return <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />;
  };

  return (
    <div className="my-2.5 border border-slate-200 bg-slate-50/70 rounded-md p-3 text-xs font-mono shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2">
        <div className="flex items-center gap-2">
          {getToolIcon(toolCall.toolName)}
          <span className="font-semibold text-slate-800">{toolCall.toolName}</span>
          <span className="text-[10px] bg-slate-200/70 text-slate-600 px-1.5 py-0.5 rounded font-mono">
            ID: {toolCall.id.slice(0, 8)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {toolCall.status === 'COMPLETED' && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
              <CheckCircle2 className="w-3 h-3" /> 已完成
            </span>
          )}
          {toolCall.status === 'EXECUTING' && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded animate-pulse">
              <Clock className="w-3 h-3 animate-spin" /> 执行中
            </span>
          )}
          {toolCall.status === 'FAILED' && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
              <XCircle className="w-3 h-3" /> 失败/拦截
            </span>
          )}
          {result?.durationMs !== undefined && (
            <span className="text-[11px] text-slate-500 font-mono">{result.durationMs}ms</span>
          )}
        </div>
      </div>

      {/* Arguments */}
      <div className="bg-white border border-slate-200 rounded p-2 text-slate-700 overflow-x-auto mb-2 text-[11px]">
        <span className="text-slate-400 font-medium">调用入参: </span>
        <pre className="mt-1 whitespace-pre-wrap">{JSON.stringify(toolCall.args, null, 2)}</pre>
      </div>

      {/* Output / Error */}
      {result && (
        <div className={`rounded p-2 text-[11px] overflow-x-auto border ${
          result.error
            ? 'bg-rose-50 text-rose-800 border-rose-200'
            : 'bg-white text-slate-700 border-slate-200'
        }`}>
          <span className={result.error ? 'text-rose-600 font-medium' : 'text-slate-400 font-medium'}>
            {result.error ? '安全防御拦截原因: ' : '沙箱执行回包: '}
          </span>
          <pre className="mt-1 whitespace-pre-wrap font-mono">{result.error || result.output}</pre>
        </div>
      )}
    </div>
  );
};
