import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, Users, Hash, Send, Bot, User, Sparkles, Shield, 
  Terminal, Code2, CheckCircle2, ChevronRight, Share2, AtSign, 
  Paperclip, Plus, ArrowUpRight, Check, Activity, Globe, RefreshCw,
  PanelLeftClose, PanelLeft, Sliders, Info, Zap
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
  const [showChannelPane, setShowChannelPane] = useState(true);
  const [showRightDrawer, setShowRightDrawer] = useState(false); // Collapsed by default to avoid cramping!

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load Initial IM Data via REST
  useEffect(() => {
    const host = window.location.hostname || 'localhost';
    const apiBase = `http://${host}:4100`;

    // 1. Fetch Channels
    fetch(`${apiBase}/api/im/channels`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setChannels(data);
          setActiveChannelId(data[0].id);
        }
      })
      .catch(err => console.error('Failed to load channels:', err));

    // 2. Fetch Experts
    fetch(`${apiBase}/api/im/experts`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setExperts(data);
      })
      .catch(err => console.error('Failed to load experts:', err));

    // 3. Fetch Connectors
    fetch(`${apiBase}/api/im/connectors`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setConnectors(data);
      })
      .catch(err => console.error('Failed to load connectors:', err));
  }, []);

  // Fetch Channel Messages on Channel Change
  useEffect(() => {
    if (!activeChannelId) return;
    const host = window.location.hostname || 'localhost';
    fetch(`http://${host}:4100/api/im/channels/${activeChannelId}/messages`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setMessages(data);
        }
      })
      .catch(err => console.error('Failed to load messages for channel:', activeChannelId, err));
  }, [activeChannelId]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isSending) return;

    const currentText = input.trim();
    setInput('');
    setIsSending(true);

    // Optimistic UI push
    const userMsg: IMMessage = {
      id: 'local_' + Date.now(),
      channelId: activeChannelId,
      senderId: 'usr-admin',
      senderName: '当前操作员',
      senderRole: 'user',
      avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=admin',
      content: currentText,
      timestamp: new Date().toLocaleTimeString()
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      const response = await onSendMessage(activeChannelId, currentText);
      if (response && response.response) {
        // Find matching expert or fallback
        const repliedExpert = experts.find(e => response.expert?.includes(e.name)) || {
          name: response.expert || '专家协作组',
          avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=expert',
          role: 'expert'
        };

        const replyMsg: IMMessage = {
          id: 'resp_' + Date.now(),
          channelId: activeChannelId,
          senderId: 'exp_reply',
          senderName: response.expert || repliedExpert.name,
          senderRole: 'expert',
          avatar: (repliedExpert as any).avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=expert',
          content: response.response,
          timestamp: new Date().toLocaleTimeString()
        };
        setMessages(prev => [...prev, replyMsg]);
      }
    } catch (err: any) {
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
    <div className="flex h-full w-full bg-slate-50 overflow-hidden font-sans select-none">
      {/* Pane 1: IM Channels & Direct Message Roster (Left 220px, Collapsible) */}
      {showChannelPane && (
        <div className="w-56 bg-white border-r border-slate-200 flex flex-col shrink-0">
          {/* Header */}
          <div className="px-4 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-600" />
              <span className="font-bold text-slate-800 text-xs tracking-tight">协同研讨频道</span>
            </div>
            <button
              onClick={() => setShowChannelPane(false)}
              className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition"
              title="折叠频道栏"
            >
              <PanelLeftClose className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Channels List */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-4 text-xs">
            <div>
              <div className="px-2 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>业务频道</span>
                <span className="text-[10px] text-slate-400 font-mono">{channels.length}</span>
              </div>
              <div className="space-y-0.5 mt-1">
                {channels.map((chan) => {
                  const isCurrent = activeChannelId === chan.id;
                  return (
                    <button
                      key={chan.id}
                      onClick={() => setActiveChannelId(chan.id)}
                      className={`w-full text-left px-2.5 py-2 rounded-lg transition flex items-center justify-between group ${
                        isCurrent
                          ? 'bg-blue-50 text-blue-700 font-semibold shadow-2xs'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Hash className={`w-3.5 h-3.5 shrink-0 ${isCurrent ? 'text-blue-600' : 'text-slate-400'}`} />
                        <span className="truncate text-xs">{chan.name.split(' ')[0]}</span>
                      </div>
                      {chan.expertIds?.length > 0 && (
                        <span className="text-[10px] font-mono text-slate-400 group-hover:text-slate-600 shrink-0">
                          {chan.expertIds.length}专
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Specialist Quick @ Roster */}
            <div>
              <div className="px-2 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>驻守专家团队</span>
                <span className="text-[10px] text-slate-400 font-mono">{experts.length}位</span>
              </div>
              <div className="space-y-1 mt-1">
                {experts.map((exp) => (
                  <div
                    key={exp.id}
                    onClick={() => {
                      setInput(prev => `${prev}@${exp.name} `);
                      inputRef.current?.focus();
                    }}
                    className="px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition flex items-center justify-between cursor-pointer group"
                    title={`点击在输入框 @${exp.name}`}
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
                    <span className="text-[10px] text-blue-600 opacity-0 group-hover:opacity-100 transition font-medium shrink-0">
                      @提问
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Connectors bar */}
          <div className="p-3 border-t border-slate-200 bg-slate-50/50">
            <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5">
              <span className="font-semibold text-slate-700">办公协同通道:</span>
              <span className="text-slate-500 font-mono text-[10px]">
                {connectors.filter(c => c.status === 'connected').length} / {connectors.length} 激活
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {connectors.slice(0, 4).map((conn) => (
                <span
                  key={conn.id}
                  title={`${conn.name} (${conn.status === 'connected' ? '已连通' : '待配置'})`}
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white border border-slate-200 text-slate-700 flex items-center gap-1"
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${conn.status === 'connected' ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                  {conn.type.toUpperCase()}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Pane 2: IM Message Stream & Interaction Area (Spacious Center Area) */}
      <div className="flex-1 flex flex-col h-full bg-[#f8fafc] overflow-hidden">
        {/* Channel Top Header Bar */}
        <div className="h-14 border-b border-slate-200 px-6 flex items-center justify-between bg-white shrink-0 shadow-2xs">
          <div className="flex items-center gap-3">
            {!showChannelPane && (
              <button
                onClick={() => setShowChannelPane(true)}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 transition mr-1"
                title="展开频道列表"
              >
                <PanelLeft className="w-4 h-4" />
              </button>
            )}
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
              <Hash className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <span>{activeChannel?.name || '生产协同频道'}</span>
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-mono">
                  LIVE CHAT
                </span>
              </div>
              <div className="text-xs text-slate-400 truncate max-w-xl">
                {activeChannel?.description}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onSwitchTab && (
              <div className="hidden lg:flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs mr-2">
                <button
                  onClick={() => onSwitchTab('im')}
                  className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-white text-blue-700 shadow-2xs border border-slate-200/60"
                >
                  频道研讨
                </button>
                <button
                  onClick={() => onSwitchTab('experts')}
                  className="px-2.5 py-1 rounded-md text-[11px] font-medium text-slate-600 hover:text-slate-900 transition"
                >
                  专家智囊 ({experts.length})
                </button>
                <button
                  onClick={() => onSwitchTab('connectors')}
                  className="px-2.5 py-1 rounded-md text-[11px] font-medium text-slate-600 hover:text-slate-900 transition"
                >
                  企业通道 ({connectors.length})
                </button>
              </div>
            )}

            <div className="flex items-center -space-x-1.5 mr-1" title="频道驻留专家">
              {channelExperts.slice(0, 5).map((exp) => (
                <img
                  key={exp.id}
                  src={exp.avatar}
                  title={`${exp.name} (${exp.title})`}
                  alt={exp.name}
                  className="w-7 h-7 rounded-full border-2 border-white shadow-2xs"
                />
              ))}
            </div>
            <button
              onClick={() => setShowRightDrawer(!showRightDrawer)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition ${
                showRightDrawer 
                  ? 'bg-blue-50 text-blue-600 border-blue-300 shadow-2xs' 
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
              title="切换专家与频道详情"
            >
              <Users className="w-3.5 h-3.5" />
              <span>频道专家 ({channelExperts.length})</span>
            </button>
          </div>
        </div>

        {/* Message Stream (Spacious, Roomy Reading Layout) */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {messages.map((msg) => {
              const isUser = msg.senderRole === 'user';
              const isSystem = msg.senderRole === 'system';

              if (isSystem) {
                return (
                  <div key={msg.id} className="flex justify-center my-3">
                    <span className="px-3.5 py-1 bg-slate-200/70 text-slate-600 rounded-full text-xs font-mono border border-slate-300/60 shadow-2xs">
                      {msg.content}
                    </span>
                  </div>
                );
              }

              return (
                <div key={msg.id} className={`flex gap-3.5 ${isUser ? 'ml-auto flex-row-reverse' : ''}`}>
                  <img
                    src={msg.avatar || 'https://api.dicebear.com/7.x/identicon/svg?seed=user'}
                    alt={msg.senderName}
                    className="w-9 h-9 rounded-xl border border-slate-200 shadow-2xs shrink-0 mt-0.5"
                  />

                  <div className={`space-y-1.5 ${isUser ? 'items-end' : 'items-start'} max-w-[85%]`}>
                    <div className={`flex items-center gap-2 text-xs ${isUser ? 'justify-end' : ''}`}>
                      <span className="font-semibold text-slate-800">{msg.senderName}</span>
                      <span className="text-slate-400 font-mono text-[11px]">{msg.timestamp}</span>
                    </div>

                    <div className={`p-4 md:p-5 rounded-2xl text-[13.5px] leading-relaxed shadow-2xs ${
                      isUser
                        ? 'bg-blue-600 text-white rounded-tr-none font-medium'
                        : 'bg-white border border-slate-200/90 text-slate-800 rounded-tl-none'
                    }`}>
                      <div className="whitespace-pre-wrap font-sans">{msg.content}</div>
                    </div>
                  </div>
                </div>
              );
            })}

            {isSending && (
              <div className="flex gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
                  <Bot className="w-5 h-5 animate-spin" />
                </div>
                <div className="p-4 bg-white border border-slate-200 rounded-2xl text-xs text-slate-600 shadow-2xs flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse"></span>
                  <span>专家团队正在分析需求并进行协同推理与规程检索...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Message Input & Action Bar (Roomy, Clean Input Area) */}
        <div className="p-5 md:px-8 bg-white border-t border-slate-200 shadow-xs">
          <div className="max-w-4xl mx-auto space-y-3">
            {/* Quick Actions & Mentions Toolbar */}
            <div className="flex items-center gap-2 overflow-x-auto text-xs pb-0.5">
              <span className="text-slate-400 font-medium shrink-0 flex items-center gap-1">
                <AtSign className="w-3.5 h-3.5 text-blue-600" />
                快速委派专家:
              </span>
              {experts.map(e => (
                <button
                  key={e.id}
                  onClick={() => {
                    setInput(prev => `${prev}@${e.name} `);
                    inputRef.current?.focus();
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 border border-slate-200 transition font-medium shrink-0 flex items-center gap-1"
                >
                  <span>@{e.name}</span>
                </button>
              ))}

              <span className="text-slate-300 mx-1">|</span>

              <button
                onClick={() => onSwitchTab && onSwitchTab('rag')}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-purple-50 hover:text-purple-700 text-slate-600 border border-slate-200 transition font-medium shrink-0 flex items-center gap-1"
              >
                知识库
              </button>

              <button
                onClick={() => onSwitchTab && onSwitchTab('terminal')}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-amber-50 hover:text-amber-700 text-slate-600 border border-slate-200 transition font-medium shrink-0 flex items-center gap-1"
              >
                <Terminal className="w-3 h-3 text-amber-600" />
                代码沙箱
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSend} className="flex gap-3">
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
                placeholder="输入设备故障报警（如 E-06）、工艺参数公差核对或任务需求，支持 @专家 快速委派（按 Enter 即可发送）..."
                className="flex-1 px-4.5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition"
              />
              <button
                type="submit"
                disabled={!input.trim() && !isSending}
                className="px-6 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-xs transition shrink-0"
              >
                {isSending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span>{isSending ? '响应中' : '发送'}</span>
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Pane 3: Channel Profile & Active Specialists Drawer (Slide-Over, Right 280px) */}
      {showRightDrawer && (
        <div className="w-72 bg-white border-l border-slate-200 flex flex-col shrink-0 overflow-y-auto p-5 space-y-6 text-xs">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <span className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              频道智囊详情
            </span>
            <button
              onClick={() => setShowRightDrawer(false)}
              className="text-slate-400 hover:text-slate-600 text-xs"
            >
              关闭
            </button>
          </div>

          {/* Channel Overview */}
          <div>
            <div className="text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-blue-600" />
              <span>当前频道职能</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200">
              {activeChannel?.description}
            </p>
          </div>

          {/* Active Specialists in this Channel */}
          <div>
            <div className="text-xs font-bold text-slate-700 mb-2.5 flex items-center justify-between">
              <span>频道驻留专家 ({channelExperts.length})</span>
            </div>
            <div className="space-y-2.5">
              {channelExperts.map((exp) => (
                <div key={exp.id} className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-2">
                  <div className="flex items-center gap-2.5">
                    <img src={exp.avatar} alt={exp.name} className="w-7 h-7 rounded-full border border-slate-200" />
                    <div>
                      <div className="font-semibold text-slate-800 text-xs">{exp.name}</div>
                      <div className="text-[11px] text-slate-400">{exp.title.split(' ')[0]}</div>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-3">{exp.description}</p>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {exp.tags.slice(0, 3).map(t => (
                      <span key={t} className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600 border border-slate-200">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
