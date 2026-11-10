import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, Users, Hash, Send, Bot, User, Sparkles, Shield, 
  Terminal, Code2, CheckCircle2, ChevronRight, Share2, AtSign, 
  Paperclip, Plus, ArrowUpRight, Check, Activity, Globe, RefreshCw
} from 'lucide-react';

export interface IMMessage {
  id: string;
  channelId: string;
  senderId: string;
  senderName: string;
  senderRole: 'user' | 'expert' | 'system';
  avatar: string;
  content: string;
  timestamp: string;
  toolCalls?: any[];
}

export interface Expert {
  id: string;
  name: string;
  avatar: string;
  title: string;
  description: string;
  systemPrompt: string;
  skills: string[];
  model: string;
  status: 'online' | 'busy' | 'offline';
  color: string;
  tags: string[];
}

export interface Channel {
  id: string;
  name: string;
  description: string;
  isGroup: boolean;
  expertIds: string[];
  unreadCount: number;
  lastMessage?: string;
  lastMessageTime?: string;
}

export interface Connector {
  id: string;
  name: string;
  type: string;
  description: string;
  status: string;
  config: Record<string, any>;
  lastSync?: string;
  stats: { totalDispatched: number; successRate: number };
}

interface IMWorkspaceProps {
  onSendMessage: (channelId: string, text: string) => Promise<any>;
  onTestConnector: (connectorId: string) => Promise<any>;
  onSwitchTab?: (tab: string) => void;
}

export function IMWorkspace({ onSendMessage, onTestConnector, onSwitchTab }: IMWorkspaceProps) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [experts, setExperts] = useState<Expert[]>([]);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string>('chan-all');
  const [messages, setMessages] = useState<IMMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [streamingToken, setStreamingToken] = useState('');
  const [selectedExpertForAt, setSelectedExpertForAt] = useState<string | null>(null);
  const [showRightDrawer, setShowRightDrawer] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load Initial IM Data via REST
  useEffect(() => {
    const host = window.location.hostname || 'localhost';
    const apiBase = `http://${host}:4100`;

    fetch(`${apiBase}/api/im/channels`).then(r => r.json()).then(setChannels).catch(() => {});
    fetch(`${apiBase}/api/im/experts`).then(r => r.json()).then(setExperts).catch(() => {});
    fetch(`${apiBase}/api/im/connectors`).then(r => r.json()).then(setConnectors).catch(() => {});
  }, []);

  // Load Messages when activeChannelId changes
  useEffect(() => {
    const host = window.location.hostname || 'localhost';
    const apiBase = `http://${host}:4100`;

    fetch(`${apiBase}/api/im/messages?channelId=${activeChannelId}`)
      .then(r => r.json())
      .then(msgs => {
        setMessages(msgs);
        scrollToBottom();
      })
      .catch(() => {});
  }, [activeChannelId]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = input.trim();
    if (!text || isSending) return;

    setInput('');
    setIsSending(true);

    // 1. Optimistic Update: Immediately add User's message to UI list!
    const optimisticUserMsg: IMMessage = {
      id: 'msg_opt_' + Date.now(),
      channelId: activeChannelId,
      senderId: 'user-cto',
      senderName: 'CTO (您)',
      senderRole: 'user',
      avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=CTO',
      content: text,
      timestamp: new Date().toLocaleTimeString()
    };

    setMessages(prev => [...prev, optimisticUserMsg]);
    scrollToBottom();

    try {
      const res = await onSendMessage(activeChannelId, text);
      if (res?.expertMessage) {
        setMessages(prev => [...prev, res.expertMessage]);
      }
      scrollToBottom();
    } catch (err: any) {
      console.error('Failed to send IM message:', err);
      setMessages(prev => [
        ...prev,
        {
          id: 'err_' + Date.now(),
          channelId: activeChannelId,
          senderId: 'sys-error',
          senderName: '系统总线',
          senderRole: 'system',
          avatar: '',
          content: `[发送异常]: ${err.message || '网络连接或模型超时'}`,
          timestamp: new Date().toLocaleTimeString()
        }
      ]);
    } finally {
      setIsSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const activeChannel = channels.find(c => c.id === activeChannelId) || channels[0];
  const channelExperts = experts.filter(e => activeChannel?.expertIds?.includes(e.id));

  return (
    <div className="flex h-full w-full bg-slate-50 overflow-hidden font-sans select-none text-xs">
      {/* Pane 1: IM Channels & Direct Message Roster (Left 250px) */}
      <div className="w-60 bg-white border-r border-slate-200 flex flex-col shrink-0">
        {/* IM Header */}
        <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-blue-600" />
            <span className="font-bold text-slate-800 text-xs">课题组学术研讨厅 (Campus IM)</span>
          </div>
          <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.2 rounded font-medium">
            局域网内网直连
          </span>
        </div>

        {/* Channels List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-4">
          <div>
            <div className="px-2.5 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>课题与研讨频道 (Channels)</span>
              <span className="text-[10px] text-slate-400 font-mono">{channels.length}</span>
            </div>
            <div className="space-y-0.5 mt-1">
              {channels.map((chan) => (
                <button
                  key={chan.id}
                  onClick={() => setActiveChannelId(chan.id)}
                  className={`w-full text-left px-2.5 py-2 rounded-md transition flex items-center justify-between group ${
                    activeChannelId === chan.id
                      ? 'bg-blue-50 text-blue-700 font-semibold shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Hash className={`w-3.5 h-3.5 shrink-0 ${activeChannelId === chan.id ? 'text-blue-600' : 'text-slate-400'}`} />
                    <span className="truncate text-xs">{chan.name.split(' ')[0]}</span>
                  </div>
                  {chan.expertIds?.length > 0 && (
                    <span className="text-[10px] font-mono text-slate-400 group-hover:text-slate-600">
                      {chan.expertIds.length}位专家
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Specialist Direct Message List */}
          <div>
            <div className="px-2.5 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>智能专家团队 (Expert Team)</span>
              <span className="text-[10px] text-slate-400 font-mono">{experts.length}位</span>
            </div>
            <div className="space-y-0.5 mt-1">
              {experts.map((exp) => (
                <div
                  key={exp.id}
                  onClick={() => {
                    setInput(`@${exp.name} `);
                  }}
                  className="px-2.5 py-1.5 rounded-md hover:bg-slate-100 transition flex items-center justify-between cursor-pointer group"
                >
                  <div className="flex items-center gap-2 truncate">
                    <div className="relative shrink-0">
                      <img src={exp.avatar} alt={exp.name} className="w-5 h-5 rounded-full border border-slate-200" />
                      <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 ring-1 ring-white"></span>
                    </div>
                    <div className="truncate">
                      <div className="font-medium text-slate-800 text-[11px] group-hover:text-blue-600 transition truncate">
                        {exp.name}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">{exp.title.split(' ')[0]}</div>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition text-blue-600 font-medium">
                    @提问
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Connector Fast Status Bar */}
        <div className="p-3 border-t border-slate-200 bg-slate-50/50">
          <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5">
            <span className="font-semibold text-slate-700">企业协同通道:</span>
            <span className="text-emerald-700 font-medium font-mono">在线就绪</span>
          </div>
          <div className="flex items-center gap-1.5">
            {connectors.slice(0, 4).map((conn) => (
              <span
                key={conn.id}
                title={`${conn.name} (已连通)`}
                className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white border border-slate-200 text-slate-700 flex items-center gap-1"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                {conn.type.toUpperCase()}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Pane 2: IM Message Stream & Interaction Area (Center Flex 1) */}
      <div className="flex-1 flex flex-col h-full bg-[#f8fafc] overflow-hidden">
        {/* Channel Top Header Bar */}
        <div className="h-14 border-b border-slate-200 px-5 flex items-center justify-between bg-white shrink-0 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <Hash className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <span>{activeChannel?.name || '企业协同频道'}</span>
                <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded font-mono">
                  LIVE CHAT
                </span>
              </div>
              <div className="text-[11px] text-slate-400 truncate max-w-md">
                {activeChannel?.description}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center -space-x-1 mr-2">
              {channelExperts.slice(0, 4).map((exp) => (
                <img
                  key={exp.id}
                  src={exp.avatar}
                  title={`${exp.name} (${exp.title})`}
                  alt={exp.name}
                  className="w-6 h-6 rounded-full border-2 border-white shadow-2xs"
                />
              ))}
            </div>
            <button
              onClick={() => setShowRightDrawer(!showRightDrawer)}
              className={`p-1.5 rounded-md border transition ${
                showRightDrawer ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
              }`}
              title="切换专家详情抽屉"
            >
              <Users className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.map((msg) => {
            const isUser = msg.senderRole === 'user';
            const isSystem = msg.senderRole === 'system';

            if (isSystem) {
              return (
                <div key={msg.id} className="flex justify-center my-2">
                  <span className="px-3 py-1 bg-slate-200/60 text-slate-600 rounded-full text-[11px] font-mono border border-slate-300/50">
                    {msg.content}
                  </span>
                </div>
              );
            }

            return (
              <div key={msg.id} className={`flex gap-3 max-w-3xl ${isUser ? 'ml-auto flex-row-reverse' : ''}`}>
                <img
                  src={msg.avatar || 'https://api.dicebear.com/7.x/identicon/svg?seed=user'}
                  alt={msg.senderName}
                  className="w-8 h-8 rounded-md border border-slate-200 shadow-2xs shrink-0"
                />

                <div className={`space-y-1 ${isUser ? 'items-end' : 'items-start'} max-w-[85%]`}>
                  <div className={`flex items-center gap-2 text-[11px] ${isUser ? 'justify-end' : ''}`}>
                    <span className="font-semibold text-slate-800">{msg.senderName}</span>
                    <span className="text-slate-400 font-mono text-[10px]">{msg.timestamp}</span>
                  </div>

                  <div className={`p-3.5 rounded-lg text-xs leading-relaxed shadow-2xs ${
                    isUser
                      ? 'bg-blue-600 text-white rounded-tr-none font-medium'
                      : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
                  }`}>
                    <div className="whitespace-pre-wrap font-sans">{msg.content}</div>
                  </div>
                </div>
              </div>
            );
          })}

          {isSending && (
            <div className="flex gap-3 max-w-2xl">
              <div className="w-8 h-8 rounded-md bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
                <Bot className="w-4 h-4 animate-spin" />
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-500 shadow-2xs flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                <span>专家团队正在分析您的需求并协同处理...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Message Input & Quick Dispatch Bar */}
        <div className="p-4 bg-white border-t border-slate-200 shadow-2xs">
          {/* Quick Actions & Mentions Toolbar */}
          <div className="flex items-center gap-1.5 mb-2 overflow-x-auto text-[11px]">
            <span className="text-slate-400 font-medium shrink-0 flex items-center gap-1">
              <AtSign className="w-3 h-3 text-blue-600" />
              委派专家:
            </span>
            {experts.map(e => (
              <button
                key={e.id}
                onClick={() => setInput(prev => `${prev}@${e.name} `)}
                className="px-2 py-0.5 rounded bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 border border-slate-200 transition font-medium shrink-0"
              >
                @{e.name}
              </button>
            ))}

            <span className="text-slate-300 mx-1">|</span>

            <button
              onClick={() => onSwitchTab && onSwitchTab('terminal')}
              className="px-2 py-0.5 rounded bg-slate-100 hover:bg-amber-50 hover:text-amber-700 text-slate-600 border border-slate-200 transition font-medium shrink-0 flex items-center gap-1"
            >
              <Terminal className="w-3 h-3 text-amber-600" />
              代码沙箱
            </button>

            <button
              onClick={() => onSwitchTab && onSwitchTab('vibecoding')}
              className="px-2 py-0.5 rounded bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 border border-slate-200 transition font-medium shrink-0 flex items-center gap-1"
            >
              <Code2 className="w-3 h-3 text-emerald-600" />
              应用生成
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSend} className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="输入任务需求、架构方案或代码调试指令，使用 @专家 委派（按 Enter 即可快速发送）..."
              className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition"
            />
            <button
              type="submit"
              disabled={!input.trim() && !isSending}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 shadow-xs transition"
            >
              {isSending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>{isSending ? '响应中' : '发送'}</span>
            </button>
          </form>
        </div>
      </div>

      {/* Pane 3: Channel Profile & Active Specialists Drawer (Right 260px) */}
      {showRightDrawer && (
        <div className="w-64 bg-white border-l border-slate-200 flex flex-col shrink-0 overflow-y-auto p-4 space-y-5">
          {/* Channel Overview */}
          <div>
            <div className="text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
              <Hash className="w-4 h-4 text-blue-600" />
              <span>频道概况</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 p-2.5 rounded-md border border-slate-200">
              {activeChannel?.description}
            </p>
          </div>

          {/* Active Specialists in this Channel */}
          <div>
            <div className="text-xs font-bold text-slate-800 mb-2 flex items-center justify-between">
              <span>频道驻留专家 ({channelExperts.length})</span>
            </div>
            <div className="space-y-2">
              {channelExperts.map((exp) => (
                <div key={exp.id} className="p-2.5 rounded-md bg-white border border-slate-200 shadow-2xs space-y-1.5">
                  <div className="flex items-center gap-2">
                    <img src={exp.avatar} alt={exp.name} className="w-6 h-6 rounded-full border border-slate-200" />
                    <div>
                      <div className="font-semibold text-slate-800 text-[11px]">{exp.name}</div>
                      <div className="text-[10px] text-slate-400">{exp.title.split(' ')[0]}</div>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 line-clamp-2">{exp.description}</p>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {exp.tags.slice(0, 3).map(t => (
                      <span key={t} className="px-1.5 py-0.2 rounded text-[9px] bg-slate-100 text-slate-600 border border-slate-200">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Channel Bound Connectors */}
          <div>
            <div className="text-xs font-bold text-slate-800 mb-2 flex items-center justify-between">
              <span>已挂载外部连接器</span>
              <span className="text-[10px] text-emerald-600 font-medium">就绪</span>
            </div>
            <div className="space-y-1.5">
              {connectors.slice(0, 3).map((conn) => (
                <div key={conn.id} className="p-2 bg-slate-50 border border-slate-200 rounded-md text-[11px] flex items-center justify-between">
                  <span className="font-medium text-slate-700 truncate">{conn.name.split(' ')[0]}</span>
                  <button
                    onClick={() => onTestConnector(conn.id)}
                    className="text-[10px] text-blue-600 hover:underline font-mono"
                  >
                    Ping
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
