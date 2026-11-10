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
              <h3 className="text-base font-bold text-slate-900">EduAgent OS · 高校智能科研与实训工作台</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                基于商汤日日新大模型驱动，面向高校教学、论文研读、代码实训与课题组学术研讨，开箱即用。
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-left w-full pt-2">
              <div
                className="p-3.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 hover:border-blue-400 hover:shadow-xs transition cursor-pointer"
                onClick={() => setInput('深度解析当前学术论文的核心创新点、实验基线与结论，提炼论文摘要与未来工作')}
              >
                <div className="font-semibold text-blue-600 mb-0.5 flex items-center gap-1">
                  <FileCode className="w-3.5 h-3.5" /> 🎓 学术论文深度研读
                </div>
                <div className="text-[11px] text-slate-400">文献创新点提炼与关键实验设计梳理</div>
              </div>

              <div
                className="p-3.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 hover:border-blue-400 hover:shadow-xs transition cursor-pointer"
                onClick={() => setInput('在隔离实训沙箱中编写一段 Python 数据拟合与图表生成脚本，并直接执行')}
              >
                <div className="font-semibold text-purple-600 mb-0.5 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> 💻 安全编程实验实训
                </div>
                <div className="text-[11px] text-slate-400">微沙箱隔离运行，防越权防提权</div>
              </div>

              <div
                className="p-3.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 hover:border-blue-400 hover:shadow-xs transition cursor-pointer"
                onClick={() => onSwitchTab && onSwitchTab('vibecoding')}
              >
                <div className="font-semibold text-emerald-600 mb-0.5 flex items-center gap-1">
                  <Cpu className="w-3.5 h-3.5" /> 📊 交互式实验应用生成
                </div>
                <div className="text-[11px] text-slate-400">一句话生成可视化交互课件并在沙箱运行</div>
              </div>

              <div
                className="p-3.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 hover:border-blue-400 hover:shadow-xs transition cursor-pointer"
                onClick={() => setInput('召集学术导师与实验助教开展集体研讨，全面评估本课题的研究方案与可行性')}
              >
                <div className="font-semibold text-amber-600 mb-0.5 flex items-center gap-1">
                  <Terminal className="w-3.5 h-3.5" /> 👥 课题组开题与学术答辩
                </div>
                <div className="text-[11px] text-slate-400">导师与助教多视角协同给出评审意见</div>
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
                      result={session.messages.find(m => m.toolResult?.toolCallId === tc.id)?.toolResult}
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
