import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Terminal, FileCode, CheckCircle, Shield, CornerDownLeft, Eye, ShieldAlert, Cpu, Wrench, FileText } from 'lucide-react';
import { AgentSession, AgentMessage } from '../types';
import { ToolExecutionCard } from './ToolExecutionCard';

interface Props {
  session: AgentSession | null;
  onSendMessage: (text: string) => Promise<void>;
  streamingContent?: string;
  isProcessing: boolean;
  onSwitchTab?: (tab: any) => void;
}

export const ChatCanvas: React.FC<Props> = ({ session, onSendMessage, streamingContent, isProcessing, onSwitchTab }) => {
  const [input, setInput] = useState('');
  const [interventionMode, setInterventionMode] = useState<'autonomous' | 'standard' | 'strict'>('standard');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [session?.messages, streamingContent]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [input]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isProcessing) return;
    const text = input.trim();
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    onSendMessage(text);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f8fafc]">
      {/* Top Session Header - Clean Workspace Navigation */}
      <div className="h-14 border-b border-slate-200/90 px-6 flex items-center justify-between bg-white shrink-0 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-2xs">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span>{session?.title || '新会话'}</span>
              <span className="text-[10px] font-mono bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-medium">
                {session?.backend || 'NativeRouter'}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              工作区: {session?.workspacePath ? session.workspacePath.split('/').slice(-2).join('/') : 'default'} · 127.0.0.1 隔离
            </div>
          </div>
        </div>

        {/* Right Status & Controls */}
        <div className="flex items-center gap-3">
          {/* Risk Control Level Selector */}
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
            <span className="text-[11px] font-medium text-slate-500 pl-2 pr-1 flex items-center gap-1">
              <ShieldAlert className="w-3 h-3 text-blue-600" />
              风控:
            </span>
            {(['autonomous', 'standard', 'strict'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setInterventionMode(mode)}
                className={`px-2 py-0.5 text-[11px] font-medium rounded-md transition ${
                  interventionMode === mode
                    ? 'bg-white text-blue-700 shadow-2xs border border-slate-200/80 font-semibold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {mode === 'autonomous' ? '全自主' : mode === 'standard' ? '标准拦截' : '严格确认'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] font-medium text-emerald-700">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>工作区边界受控</span>
          </div>
        </div>
      </div>

      {/* Messages Scroll Area - Roomy Max-W-4xl Reading Canvas */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {(!session || session.messages.length === 0) && (
            <div className="flex flex-col items-center justify-center text-center max-w-xl mx-auto space-y-6 py-10">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-sm">
                <Bot className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg font-bold text-slate-900 tracking-tight">EasyBot · 极轻量工业与企业级智能体工作台</h3>
                <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
                  基于自研核心路由驱动，已接入本地应用级沙箱工作区与 Okapi BM25 检索索引。支持代码生成、脚本排障与制造专业问答。
                </p>
              </div>

              {/* 4 Clean Quick Action Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left w-full pt-2">
                <div
                  className="p-4 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 hover:border-blue-400 hover:shadow-xs transition cursor-pointer group"
                  onClick={() => setInput('3号机床面板出现 E-06 报警，主轴停机，请按数控维保规程给出排查步骤')}
                >
                  <div className="font-semibold text-blue-600 mb-1 flex items-center gap-1.5 group-hover:text-blue-700">
                    <Wrench className="w-4 h-4" /> 数控机床故障诊断 (E-06)
                  </div>
                  <div className="text-[11px] text-slate-400">检索 SOP 维保规程并生成安全抢修步骤</div>
                </div>

                <div
                  className="p-4 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 hover:border-blue-400 hover:shadow-xs transition cursor-pointer group"
                  onClick={() => setInput('请核对最新注塑工艺规程中，关于 PA66 玻纤件的成型温度与保压压力标准')}
                >
                  <div className="font-semibold text-emerald-600 mb-1 flex items-center gap-1.5 group-hover:text-emerald-700">
                    <FileText className="w-4 h-4" /> 工艺规程与公差核验
                  </div>
                  <div className="text-[11px] text-slate-400">BM25 检索知识库精确比对标准指标</div>
                </div>

                <div
                  className="p-4 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 hover:border-blue-400 hover:shadow-xs transition cursor-pointer group"
                  onClick={() => onSwitchTab && onSwitchTab('vibecoding')}
                >
                  <div className="font-semibold text-purple-600 mb-1 flex items-center gap-1.5 group-hover:text-purple-700">
                    <Cpu className="w-4 h-4" /> VibeCoding 极速应用
                  </div>
                  <div className="text-[11px] text-slate-400">自然语言直接编译生产监控看板并在沙箱预览</div>
                </div>

                <div
                  className="p-4 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 hover:border-blue-400 hover:shadow-xs transition cursor-pointer group"
                  onClick={() => setInput('在工作区编写一个数据清洗脚本，读取 CSV 文件并计算不良品率统计')}
                >
                  <div className="font-semibold text-amber-600 mb-1 flex items-center gap-1.5 group-hover:text-amber-700">
                    <Terminal className="w-4 h-4" /> 沙箱工程脚本执行
                  </div>
                  <div className="text-[11px] text-slate-400">在应用级沙箱内生成脚本并安全运行</div>
                </div>
              </div>
            </div>
          )}

          {session?.messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role !== 'user' && (
                <div className="w-8 h-8 rounded-xl bg-white border border-slate-200/90 text-blue-600 flex items-center justify-center shrink-0 shadow-2xs">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div className={`space-y-2 max-w-2xl ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`p-4 rounded-2xl text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-tr-xs shadow-sm font-medium'
                    : 'bg-white border border-slate-200/90 text-slate-800 rounded-tl-xs shadow-2xs'
                }`}>
                  <div className="whitespace-pre-wrap font-sans">{msg.content}</div>
                </div>

                {/* Render Tool Calls attached to message */}
                {msg.toolCalls && msg.toolCalls.length > 0 && (
                  <div className="w-full space-y-2 pt-1">
                    {msg.toolCalls.map((tc) => (
                      <ToolExecutionCard
                        key={tc.id}
                        toolCall={tc}
                        result={msg.toolResults?.find(r => r.callId === tc.id)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {/* Streaming Active Content */}
          {streamingContent && (
            <div className="flex gap-3.5 justify-start">
              <div className="w-8 h-8 rounded-xl bg-white border border-slate-200/90 text-blue-600 flex items-center justify-center shrink-0 shadow-2xs">
                <Bot className="w-4 h-4" />
              </div>
              <div className="p-4 rounded-2xl text-xs leading-relaxed bg-white border border-slate-200/90 text-slate-800 rounded-tl-xs shadow-2xs max-w-2xl">
                <div className="whitespace-pre-wrap font-sans">{streamingContent}</div>
                <span className="inline-block w-1.5 h-3.5 bg-blue-600 ml-1 animate-pulse align-middle"></span>
              </div>
            </div>
          )}

          {isProcessing && !streamingContent && (
            <div className="flex items-center gap-2 text-xs text-slate-400 pl-11">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping"></span>
              <span>EasyBot 正在规划任务与沙箱调度...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Floating Prompt Composer - Codex & WorkBuddy Style */}
      <div className="p-4 md:p-6 bg-transparent shrink-0">
        <div className="max-w-4xl mx-auto">
          <form
            onSubmit={handleSubmit}
            className="bg-white border border-slate-300/80 rounded-2xl shadow-sm focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all p-3 space-y-2.5"
          >
            <textarea
              ref={textareaRef}
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="向 EasyBot 描述您的工程任务、代码编写需求或设备故障代码（按 Enter 发送，Shift+Enter 换行）..."
              className="w-full bg-transparent border-0 text-xs md:text-sm text-slate-800 placeholder-slate-400 focus:outline-none resize-none leading-relaxed"
            />

            {/* Bottom Controls Row inside Composer */}
            <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setInput(prev => prev ? `${prev}，请在沙箱编写自动化单测` : '编写工程模块并提供沙箱单元测试')}
                  className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 transition flex items-center gap-1"
                >
                  <FileCode className="w-3 h-3 text-blue-600" />
                  <span>单测驱动</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInput(prev => prev ? `${prev}，请检索知识库确认最新 SOP 规程` : '检索知识库确认最新生产规程与公差要求')}
                  className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 transition flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3 text-purple-600" />
                  <span>知识库溯源</span>
                </button>
              </div>

              <div className="flex items-center gap-2.5">
                <span className="text-[11px] text-slate-400 hidden sm:inline font-mono">
                  Enter 发送 · Shift+Enter 换行
                </span>
                <button
                  type="submit"
                  disabled={!input.trim() || isProcessing}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition"
                >
                  <span>{isProcessing ? '执行中...' : '发送'}</span>
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
