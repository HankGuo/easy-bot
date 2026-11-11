import React, { useState, useEffect } from 'react';
import { Settings, Check, X, RefreshCw, Zap, Server, Shield, Key, Sliders, CheckCircle2, AlertCircle, Globe } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaveConfig: (config: any) => Promise<void>;
  onTestConnection: () => Promise<any>;
}

export const ModelSettingsModal: React.FC<Props> = ({ isOpen, onClose, onSaveConfig, onTestConnection }) => {
  const [provider, setProvider] = useState<'openai-compatible' | 'ollama' | 'mock'>('openai-compatible');
  const [baseUrl, setBaseUrl] = useState('http://localhost:11434/v1');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('default-chat-model');
  const [temperature, setTemperature] = useState(0.7);

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Load current config from server
  useEffect(() => {
    if (isOpen) {
      fetch('/api/model/config')
        .then(res => res.json())
        .then(data => {
          if (data) {
            setBaseUrl(data.baseUrl || 'http://localhost:11434/v1');
            setModel(data.model || 'default-chat-model');
            setProvider(data.provider || 'openai-compatible');
            setTemperature(data.temperature ?? 0.7);
            if (data.apiKeyMasked) {
              setApiKey(''); // Keep empty so user only types if updating
            }
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Universal protocol & architecture presets (Zero Vendor Lock-in)
  const presets = [
    { name: '通用 OpenAI 兼容协议 (云端/中转)', url: 'https://api.openai.com/v1', model: 'gpt-4o', provider: 'openai-compatible' },
    { name: '本地私有化引擎 (Ollama 免Key)', url: 'http://localhost:11434/v1', model: 'llama3:latest', provider: 'ollama' },
    { name: '企业自建私有推理网关 (vLLM / SGLang)', url: 'http://localhost:8000/v1', model: 'default', provider: 'openai-compatible' },
    { name: '离线高保真沙箱闭环 (Mock模式)', url: 'http://127.0.0.1:4100/mock', model: 'mock-agent', provider: 'mock' }
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
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col text-xs">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">通用大模型接入点配置 (Universal Model Gateway)</h3>
              <p className="text-[11px] text-slate-500">支持任意遵循 OpenAI 标准协议的本地或云端服务，自带 Key (BYOK) 直连</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Architecture Presets */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-2">架构模式快捷选择 (Architecture Presets):</label>
            <div className="grid grid-cols-2 gap-2">
              {presets.map((p) => {
                const isSelected = baseUrl === p.url && model === p.model;
                return (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => handleApplyPreset(p)}
                    className={`px-3 py-2 text-left rounded-lg border transition flex items-center justify-between ${
                      isSelected
                        ? 'bg-blue-50/80 border-blue-500 text-blue-700 font-semibold shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="truncate">{p.name}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Provider selector */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setProvider('openai-compatible')}
              className={`py-2 px-3 rounded-lg border text-center transition ${
                provider === 'openai-compatible'
                  ? 'border-blue-600 bg-blue-50 text-blue-700 font-bold'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white'
              }`}
            >
              OpenAI 标准协议
            </button>
            <button
              type="button"
              onClick={() => setProvider('ollama')}
              className={`py-2 px-3 rounded-lg border text-center transition ${
                provider === 'ollama'
                  ? 'border-blue-600 bg-blue-50 text-blue-700 font-bold'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white'
              }`}
            >
              本地 Ollama 引擎
            </button>
            <button
              type="button"
              onClick={() => setProvider('mock')}
              className={`py-2 px-3 rounded-lg border text-center transition ${
                provider === 'mock'
                  ? 'border-blue-600 bg-blue-50 text-blue-700 font-bold'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white'
              }`}
            >
              离线沙箱 Mock
            </button>
          </div>

          {/* Base URL */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 text-blue-600" />
                API 端点地址 (Base URL):
              </label>
              <span className="text-[11px] text-slate-400">需支持 /chat/completions 路由</span>
            </div>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.your-provider.com/v1 或 http://localhost:11434/v1"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-xs font-mono text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition"
            />
          </div>

          {/* API Key */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                <Key className="w-3.5 h-3.5 text-blue-600" />
                API Key (密钥凭据):
              </label>
              <span className="text-[11px] text-emerald-600 font-medium">本机直接发起握手，绝不经由第三方服务器</span>
            </div>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="留空保留当前已配置密钥，或输入新 key (sk-••••••••)"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-xs font-mono text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition"
            />
          </div>

          {/* Model Name & Sampling */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">模型标识符 (Model ID):</label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="例如: llama3, gpt-4o, qwen2.5-coder..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-xs font-mono text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700">随机采样 (Temperature):</label>
                <span className="font-mono text-blue-600 font-semibold">{temperature}</span>
              </div>
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
            <div className={`p-3.5 rounded-xl border text-xs ${
              testResult.success
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}>
              <div className="flex items-center gap-2 font-bold mb-1">
                {testResult.success ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>端点握手成功！物理往返时延: {testResult.latencyMs}ms</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                    <span>端点连接探测失败: {testResult.error}</span>
                  </>
                )}
              </div>
              {testResult.sampleResponse && (
                <div className="mt-2 font-mono text-[11px] bg-white p-2.5 rounded-lg border border-emerald-200 text-slate-700 whitespace-pre-wrap">
                  回包样例: {testResult.sampleResponse}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between">
          <button
            type="button"
            onClick={handleTest}
            disabled={isTesting}
            className="px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg font-medium text-xs flex items-center gap-2 shadow-2xs transition"
          >
            {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-amber-500" />}
            <span>测试端点连通性</span>
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:text-slate-900 text-xs font-medium transition"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
            >
              {isSaving ? '正在保存...' : '保存并激活配置'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
