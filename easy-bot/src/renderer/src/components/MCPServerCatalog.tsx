import React from 'react';
import { Cpu, Server, CheckCircle2, Globe, Shield, Terminal, Wrench } from 'lucide-react';
import { MCPServer } from '../types';

interface Props {
  servers: MCPServer[];
  tools: any[];
}

export const MCPServerCatalog: React.FC<Props> = ({ servers, tools }) => {
  return (
    <div className="h-full flex flex-col bg-white border-l border-slate-200 text-xs p-4">
      <div className="flex items-center gap-2 pb-3.5 border-b border-slate-200 mb-4">
        <Cpu className="w-4 h-4 text-blue-600" />
        <span className="font-semibold text-slate-800">企业级标准扩展工具中心 (MCP Hub)</span>
      </div>

      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center justify-between">
        <span>已挂载的 MCP 服务</span>
        <span className="text-[10px] text-slate-400 font-mono">{servers.length} 个实例</span>
      </div>

      <div className="space-y-2 mb-6">
        {servers.map((srv) => (
          <div key={srv.id} className="p-3 bg-white border border-slate-200 rounded-md flex items-center justify-between shadow-2xs hover:border-blue-300 transition">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Server className="w-3.5 h-3.5 text-blue-600" />
                <span className="font-semibold text-slate-800">{srv.name}</span>
                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-mono border border-slate-200">
                  {srv.transport.toUpperCase()}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">{srv.description}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] bg-slate-50 text-slate-600 px-2 py-0.5 rounded border border-slate-200 font-mono">
                {srv.toolsCount} 工具
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                <CheckCircle2 className="w-3 h-3" /> 在线
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center justify-between">
        <span>已注册的工具 Schema 清单</span>
        <span className="text-[10px] text-slate-400 font-mono">{tools.length} 个 Tool</span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2.5">
        {tools.map((t) => (
          <div key={t.name} className="p-3 bg-slate-50/70 border border-slate-200 rounded-md text-[11px] shadow-2xs">
            <div className="flex items-center gap-1.5 font-mono font-semibold text-slate-800 mb-1">
              <Wrench className="w-3.5 h-3.5 text-blue-600" />
              {t.name}
            </div>
            <div className="text-[11px] text-slate-600 mb-2">{t.description}</div>
            <div className="text-[10px] font-mono text-slate-600 bg-white p-2 rounded border border-slate-200 overflow-x-auto">
              <span className="text-slate-400 font-medium">properties: </span>
              {JSON.stringify(t.inputSchema.properties || {})}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
