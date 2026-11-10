import React from 'react';
import { ShieldCheck, ShieldAlert, Lock, CheckCircle, AlertOctagon, Terminal, FileCode, CheckCircle2 } from 'lucide-react';
import { SandboxAuditLog } from '../types';

interface Props {
  logs: SandboxAuditLog[];
  workspacePath?: string;
}

export const SandboxMonitor: React.FC<Props> = ({ logs, workspacePath }) => {
  return (
    <div className="h-full flex flex-col bg-white border-l border-slate-200 text-xs">
      {/* Header - Ant Design Industrial Style */}
      <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span className="font-semibold text-slate-800">教学实训沙箱安全审计屏障</span>
        </div>
        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          安全受限沙箱
        </span>
      </div>

      {/* Info card */}
      <div className="p-3.5 bg-slate-50/30 border-b border-slate-200 text-[11px] space-y-2">
        <div className="flex items-center justify-between text-slate-500">
          <span>实训安全规范:</span>
          <span className="text-slate-700 font-medium">高校计算机实验室代码隔离规范</span>
        </div>
        <div className="flex items-center justify-between text-slate-500">
          <span>教学主机防护:</span>
          <span className="text-emerald-700 font-medium flex items-center gap-1">
            <Lock className="w-3 h-3 text-emerald-600" /> 路径越权与高危系统调用实时拦截
          </span>
        </div>
        <div className="text-slate-500 truncate" title={workspacePath}>
          学生实训工作区: <span className="font-mono text-slate-800 font-medium">{workspacePath || '高校实训隔离目录'}</span>
        </div>
      </div>

      {/* Audit Log Stream */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
          <span>实训指令安全审计流水 (Security Audit Log)</span>
          <span className="text-[10px] text-slate-400 font-mono">共 {logs.length} 条</span>
        </div>
        {logs.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs">
            暂无沙箱拦截或系统调用记录
          </div>
        ) : (
          logs.map((log) => {
            const isBlocked = log.action === 'BLOCKED_ATTEMPT' || log.status === 'REJECTED';
            return (
              <div
                key={log.id}
                className={`p-2.5 rounded-md border font-mono text-[11px] shadow-2xs transition ${
                  isBlocked
                    ? 'bg-rose-50/80 border-rose-200 text-rose-900'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`font-bold px-1.5 py-0.2 rounded text-[10px] ${
                    isBlocked ? 'bg-rose-100 text-rose-700 border border-rose-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}>
                    {log.action}
                  </span>
                  <span className="text-slate-400 text-[10px]">{new Date(log.timestamp).toLocaleTimeString()}</span>
                </div>
                {log.command && <div className="truncate text-slate-800 font-medium">Cmd: {log.command}</div>}
                {log.targetPath && <div className="truncate text-slate-500">Path: {log.targetPath}</div>}
                {log.details && (
                  <div className={`mt-1 text-[10px] ${isBlocked ? 'text-rose-600 font-semibold' : 'text-slate-500'}`}>
                    {log.details}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
