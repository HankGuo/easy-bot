import React, { useState, useEffect } from 'react';
import { 
  Share2, CheckCircle2, AlertTriangle, RefreshCw, Zap, Server, 
  ExternalLink, Key, Shield, Database, Globe, MessageSquare, Terminal, Check
} from 'lucide-react';
import { Connector } from './IMWorkspace';

interface ConnectorStudioProps {
  onTestConnector: (connectorId: string) => Promise<any>;
}

export function ConnectorStudio({ onTestConnector }: ConnectorStudioProps) {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, any>>({});
  const [activeModalConn, setActiveModalConn] = useState<Connector | null>(null);

  const fetchConnectors = () => {
    const host = window.location.hostname || 'localhost';
    fetch(`http://${host}:4100/api/im/connectors`)
      .then(r => r.json())
      .then(setConnectors)
      .catch(() => {});
  };

  useEffect(() => {
    fetchConnectors();
  }, []);

  const handleTest = async (connId: string) => {
    setTestingId(connId);
    try {
      const res = await onTestConnector(connId);
      setTestResults(prev => ({ ...prev, [connId]: res }));
      fetchConnectors();
    } catch (err: any) {
      setTestResults(prev => ({ ...prev, [connId]: { success: false, message: err.message } }));
    } finally {
      setTestingId(null);
    }
  };

  const getConnectorIcon = (type: string) => {
    switch (type) {
      case 'wecom':
      case 'dingtalk':
      case 'feishu':
        return <MessageSquare className="w-5 h-5 text-blue-600" />;
      case 'github':
        return <Server className="w-5 h-5 text-purple-600" />;
      case 'database':
        return <Database className="w-5 h-5 text-emerald-600" />;
      default:
        return <Globe className="w-5 h-5 text-amber-600" />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 p-6 overflow-y-auto font-sans text-xs">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-6 bg-white p-4 rounded-lg shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800">外部生态连接器中心 (Connectors Hub)</h2>
            <p className="text-[11px] text-slate-500">
              打通企业微信、钉钉、飞书、GitHub 与内网数据库，实现 Agent 双向事件触发与推送
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md font-mono">
            {connectors.filter(c => c.status === 'connected').length} / {connectors.length} 连接器就绪
          </span>
        </div>
      </div>

      {/* Connectors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {connectors.map((conn) => {
          const result = testResults[conn.id];
          const isTesting = testingId === conn.id;

          return (
            <div
              key={conn.id}
              className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs hover:border-blue-300 transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-md bg-slate-50 border border-slate-200 flex items-center justify-center">
                      {getConnectorIcon(conn.type)}
                    </div>
                    <div>
                      <div className="font-bold text-slate-800 text-xs">{conn.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono uppercase">{conn.type}</div>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded font-mono">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> 连通
                  </span>
                </div>

                <p className="text-[11px] text-slate-600 leading-relaxed mb-3 line-clamp-2">
                  {conn.description}
                </p>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-2 p-2 bg-slate-50 rounded border border-slate-100 mb-3 text-[10px] font-mono">
                  <div>
                    <span className="text-slate-400 block">累计事件派发:</span>
                    <span className="font-bold text-slate-700">{conn.stats.totalDispatched} 次</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">投递成功率:</span>
                    <span className="font-bold text-emerald-600">{conn.stats.successRate}%</span>
                  </div>
                </div>

                {/* Test Result Message Banner */}
                {result && (
                  <div className={`p-2 rounded border mb-3 text-[10px] ${
                    result.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}>
                    {result.message}
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-mono">同步: {conn.lastSync || '实时'}</span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveModalConn(conn)}
                    className="px-2.5 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded text-xs transition"
                  >
                    配置
                  </button>
                  <button
                    onClick={() => handleTest(conn.id)}
                    disabled={isTesting}
                    className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded text-xs font-semibold flex items-center gap-1 transition"
                  >
                    {isTesting ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <Zap className="w-3 h-3 text-blue-600" />
                    )}
                    <span>探测</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Config Modal */}
      {activeModalConn && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-xl shadow-antd-modal p-5 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div className="font-bold text-slate-800 text-sm">
                配置 {activeModalConn.name}
              </div>
              <button
                onClick={() => setActiveModalConn(null)}
                className="text-slate-400 hover:text-slate-700 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 mb-5">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Webhook URL / API 端点:</label>
                <input
                  type="text"
                  defaultValue={activeModalConn.config.webhookUrl || activeModalConn.config.endpoint || ''}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-1.5 font-mono text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Secret Token / 鉴权凭据:</label>
                <input
                  type="password"
                  defaultValue={activeModalConn.config.secret || activeModalConn.config.token || 'demo-token'}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-1.5 font-mono text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="p-3 bg-blue-50 rounded border border-blue-200 text-blue-800 text-[11px]">
                <Shield className="w-3.5 h-3.5 inline mr-1 text-blue-600" />
                所有发往外部 IM 或第三方的事件载荷均经过 Micro-Sandbox 脱敏过滤，防止企业敏感数据出境。
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setActiveModalConn(null)}
                className="px-3 py-1.5 rounded text-slate-600 hover:bg-slate-100"
              >
                关闭
              </button>
              <button
                onClick={() => {
                  setActiveModalConn(null);
                  handleTest(activeModalConn.id);
                }}
                className="px-4 py-1.5 bg-blue-600 text-white rounded font-medium shadow-xs hover:bg-blue-700"
              >
                保存并验证
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
