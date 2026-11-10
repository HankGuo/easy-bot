import React, { useState, useEffect } from 'react';
import { Settings, Check, X, RefreshCw, Zap, Server, Shield, Key, Sliders, CheckCircle2, AlertCircle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaveConfig: (config: any) => Promise<void>;
  onTestConnection: () => Promise<any>;
}

export const ModelSettingsModal: React.FC<Props> = ({ isOpen, onClose, onSaveConfig, onTestConnection }) => {
  const [provider, setProvider] = useState<'openai-compatible' | 'ollama' | 'mock'>('openai-compatible');
  const [baseUrl, setBaseUrl] = useState('https://token.sensenova.cn/v1');
  const [apiKey, setApiKey] = useState('sk-3UHPzn5qZBVktG9EZwE7AYxoXSxxxUTS');
  const [model, setModel] = useState('sensenova-6.8-flash-lite');
  const [temperature, setTemperature] = useState(0.7);

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Load current config
  useEffect(() => {
    if (isOpen) {
      fetch('http://localhost:4100/api/model/config')
        .then(res => res.json())
        .then(data => {
          if (data) {
            setBaseUrl(data.baseUrl || 'https://token.sensenova.cn/v1');
            setModel(data.model || 'sensenova-6.8-flash-lite');
            setProvider(data.provider || 'openai-compatible');
            setTemperature(data.temperature ?? 0.7);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const presets = [
    { name: 'SenseNova 日日新 (默认)', url: 'https://token.sensenova.cn/v1', model: 'sensenova-6.8-flash-lite', provider: 'openai-compatible' },
    { name: 'DeepSeek (高性价比)', url: 'https://api.deepseek.com/v1', model: 'deepseek-chat', provider: 'openai-compatible' },
    { name: 'OpenAI 官方', url: 'https://api.openai.com/v1', model: 'gpt-4o', provider: 'openai-compatible' },
    { name: '阿里百炼 (Qwen 通义千问)', url: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus', provider: 'openai-compatible' },
    { name: 'Ollama 本地私有化 (免Key)', url: 'http://localhost:11434/v1', model: 'llama3:latest', provider: 'ollama' },
    { name: '离线高保真沙箱 (Mock模式)', url: 'http://127.0.0.1:4100/mock', model: 'mock-agent', provider: 'mock' }
  ];

  const handleApplyPreset = (p: typeof presets[0]) => {
    setBaseUrl(p.url);
    setModel(p.model);
    setProvider(p.provider as any);
    setTestResult(null);
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      await onSaveConfig({
        provider,
        baseUrl,
        apiKey: apiKey || undefined,
        model,
        temperature
      });
      const res = await onTestConnection();
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveConfig({
        provider,
        baseUrl,
        apiKey: apiKey || undefined,
        model,
        temperature
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 w-full max-w-xl rounded-xl shadow-antd-modal overflow-hidden flex flex-col text-xs">
        {/* Header - Ant Design Industrial Modal Style */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-blue-600" />
            <h3 className="font-bold text-slate-800 text-sm">自定义大模型端点配置 (Model Gateway Settings)</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Preset Buttons */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-2">主流服务商一键预设:</label>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => handleApplyPreset(p)}
                  className={`px-2.5 py-1 text-[11px] rounded border transition ${
                    baseUrl === p.url && model === p.model
                      ? 'bg-blue-50 text-blue-700 border-blue-400 font-medium'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* Base URL */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              API Base URL <span className="text-slate-400 font-normal">(支持任意 OpenAI 兼容端点或网关)</span>:
            </label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.deepseek.com/v1"
              className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition"
            />
          </div>

          {/* API Key */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              API Key <span className="text-slate-400 font-normal">(本地直接发起直连，绝不经由第三方中转服务器)</span>:
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-••••••••••••••••••••••••••••••••"
              className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition"
            />
          </div>

          {/* Model Name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">模型代号 (Model ID):</label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="deepseek-chat"
                className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">随机采样 (Temperature): {temperature}</label>
              <input
                type="range"
                min="0"
                max="1.5"
                step="0.05"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full mt-2 accent-blue-600"
              />
            </div>
          </div>

          {/* Test Connection Result Banner */}
          {testResult && (
            <div className={`p-3 rounded-md border text-xs ${
              testResult.success
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}>
              <div className="flex items-center gap-1.5 font-bold mb-1">
                {testResult.success ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>端点握手成功！耗时: {testResult.latencyMs}ms</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                    <span>端点连接探测失败: {testResult.error}</span>
                  </>
                )}
              </div>
              {testResult.sampleResponse && (
                <div className="mt-1 font-mono text-[11px] bg-white p-2 rounded border border-emerald-200 text-slate-700">
                  回包样例: {testResult.sampleResponse}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <button
            type="button"
            onClick={handleTest}
            disabled={isTesting}
            className="px-3.5 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-md font-medium text-xs flex items-center gap-1.5 transition"
          >
            {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-amber-500" />}
            <span>测试端点连通性</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-slate-600 hover:text-slate-900 text-xs font-medium transition"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-medium shadow-xs transition"
            >
              {isSaving ? '正在保存...' : '保存并激活'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
