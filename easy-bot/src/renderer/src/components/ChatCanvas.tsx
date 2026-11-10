import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Terminal, FileCode, CheckCircle, Shield, CornerDownLeft, Eye, ShieldAlert, Cpu } from 'lucide-react';
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
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [session?.messages, streamingContent]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;
    const text = input;
    setInput('');
    onSendMessage(text);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f8fafc]">
      {/* Top Session Header - Ant Design Industrial Style */}
      <div className="h-14 border-b border-slate-200 px-6 flex items-center justify-between bg-white shadow-2xs">
        <div className="flex items-center gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <span>{session?.title || '新会话'}</span>
              <span className="text-[11px] font-mono bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded font-medium">
                {session?.backend || 'UniversalRouter'}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              沙箱路径: {session?.workspacePath ? session.workspacePath.split('/').slice(-2).join('/') : 'default'}
            </div>
          </div>
        </div>

        {/* Right Status & Controls */}
        <div className="flex items-center gap-3">
          {/* Human-in-the-Loop Intervention Selector */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-md border border-slate-200 text-xs">
            <span className="text-[11px] font-medium text-slate-500 pl-1.5 flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5 text-blue-600" />
              风控级别:
            </span>
            {(['autonomous', 'standard', 'strict'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setInterventionMode(mode)}
                className={`px-2 py-0.5 text-[11px] font-medium rounded transition ${
                  interventionMode === mode
                    ? 'bg-white text-blue-600 shadow-xs border border-slate-200 font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {mode === 'autonomous' ? '全自主' : mode === 'standard' ? '标准拦截' : '严格确认'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-[11px] font-medium text-emerald-700">
            <Shield className="w-3.5 h-3.5" />
            <span>CubeSandbox 边界生效</span>
          </div>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {(!session || session.messages.length === 0) && (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto space-y-4 my-auto py-12">
            <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-sm">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">EasyBot · 企业级桌面智能体操作系统</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                基于通用大模型与 DeepSeek Harness 运行时驱动，具备受限微沙箱隔离、多工具调度、双路知识检索与桌面操作能力。
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-left w-full pt-2">
              <div
                className="p-3.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 hover:border-blue-400 hover:shadow-xs transition cursor-pointer"
                onClick={() => setInput('为当前工作区编写一个具备异常防御与单元测试的数据清洗与管道处理模块')}
              >
                <div className="font-semibold text-blue-600 mb-0.5 flex items-center gap-1">
                  <FileCode className="w-3.5 h-3.5" /> 💻 全栈代码生成与重构
                </div>
                <div className="text-[11px] text-slate-400">自动化编写代码并在安全沙箱内执行单测</div>
              </div>

              <div
                className="p-3.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 hover:border-blue-400 hover:shadow-xs transition cursor-pointer"
                onClick={() => onSwitchTab && onSwitchTab('vibecoding')}
              >
                <div className="font-semibold text-emerald-600 mb-0.5 flex items-center gap-1">
                  <Cpu className="w-3.5 h-3.5" /> 📊 交互式应用即时生成
                </div>
                <div className="text-[11px] text-slate-400">一句话生成多维数据看板与交互前端组件</div>
              </div>

              <div
                className="p-3.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 hover:border-blue-400 hover:shadow-xs transition cursor-pointer"
                onClick={() => onSwitchTab && onSwitchTab('rag')}
              >
                <div className="font-semibold text-purple-600 mb-0.5 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> 🔍 企业级混合知识库检索
                </div>
                <div className="text-[11px] text-slate-400">BM25 词项匹配与向量重排高保真命中</div>
              </div>

              <div
                className="p-3.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 hover:border-blue-400 hover:shadow-xs transition cursor-pointer"
                onClick={() => setInput('检查当前工作区的安全审计策略，执行一次受限沙箱状态健康体检')}
              >
                <div className="font-semibold text-amber-600 mb-0.5 flex items-center gap-1">
                  <Terminal className="w-3.5 h-3.5" /> 🛡️ 沙箱安全审计与隔离
                </div>
                <div className="text-[11px] text-slate-400">路径白名单强校验与系统调用审计流水</div>
              </div>
            </div>
          </div>
        )}

        {session?.messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 max-w-3xl ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-xs ${
              msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-blue-600'
            }`}>
              {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>

            <div className={`space-y-2 ${msg.role === 'user' ? 'items-end' : 'items-start'} max-w-[85%]`}>
              <div className={`p-4 rounded-lg text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-tr-none shadow-xs font-medium'
                  : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none shadow-xs'
              }`}>
                <div className="whitespace-pre-wrap font-sans">{msg.content}</div>
              </div>

              {/* Render Tool Calls attached to message */}
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="w-full space-y-2">
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
          </div>
        ))}

        {/* Streaming Active Content */}
        {streamingContent && (
          <div className="flex gap-3 max-w-3xl">
            <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-blue-600 flex items-center justify-center shrink-0 shadow-xs">
              <Bot className="w-4 h-4" />
            </div>
            <div className="p-4 rounded-lg text-xs leading-relaxed bg-white border border-slate-200 text-slate-800 rounded-tl-none shadow-xs max-w-[85%]">
              <div className="whitespace-pre-wrap font-sans">{streamingContent}</div>
              <span className="inline-block w-1.5 h-3.5 bg-blue-600 ml-1 animate-pulse align-middle"></span>
            </div>
          </div>
        )}

        {isProcessing && !streamingContent && (
          <div className="flex items-center gap-2 text-xs text-slate-400 pl-11">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping"></span>
            <span>EasyBot 智能体正在解析执行计划与沙箱调度...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar - Ant Design Industrial Form */}
      <div className="p-4 bg-white border-t border-slate-200 shadow-2xs">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="输入需求、代码生成任务、或者执行指令（按 Enter 即可快速发送）..."
            className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition"
          />
          <button
            type="submit"
            disabled={!input.trim() && !isProcessing}
            className="px-4 py-2.5 bg-blue-600 text-white rounded-md text-xs font-medium hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 flex items-center gap-1.5 shadow-xs transition"
          >
            <span>{isProcessing ? '处理中' : '发送'}</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
