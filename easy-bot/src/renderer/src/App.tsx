import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, Plus, Shield, BookOpen, Cpu, Settings, Terminal, MessageSquare, 
  GitFork, Code, Users, Sparkles, ChevronRight, CheckCircle2, RefreshCw,
  Activity, Eye, Layers, ShieldCheck, Wifi, Sliders, Play, ExternalLink,
  Share2, Hash, AtSign, PanelLeftClose, PanelLeft
} from 'lucide-react';
import { AgentSession, SandboxAuditLog, MCPServer } from './types';
import { ChatCanvas } from './components/ChatCanvas';
import { SandboxMonitor } from './components/SandboxMonitor';
import { KnowledgeHub } from './components/KnowledgeHub';
import { MCPServerCatalog } from './components/MCPServerCatalog';
import { WorkflowStudio } from './components/WorkflowStudio';
import { VibeCodingStudio } from './components/VibeCodingStudio';
import { AgentGroupStudio } from './components/AgentGroupStudio';
import { SkillsMarket } from './components/SkillsMarket';
import { ModelSettingsModal } from './components/ModelSettingsModal';
import { TerminalConsole } from './components/TerminalConsole';
import { TokenMonitor } from './components/TokenMonitor';
import { IMWorkspace } from './components/IMWorkspace';
import { ConnectorStudio } from './components/ConnectorStudio';
import { ExpertStudio } from './components/ExpertStudio';

export function App() {
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    'im' | 'chat' | 'experts' | 'connectors' | 'workflow' | 'vibecoding' | 'group' | 'terminal' | 'token_monitor' | 'sandbox' | 'rag' | 'skills' | 'mcp'
  >('im'); // Default directly to IM Collaboration Workspace!

  const [auditLogs, setAuditLogs] = useState<SandboxAuditLog[]>([]);
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [tools, setTools] = useState<any[]>([]);
  const [skills, setSkills] = useState<any[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [activeModel, setActiveModel] = useState<string>('OpenAI-Compatible');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Dynamic host discovery for seamless localhost / 127.0.0.1 bridge
    const host = window.location.hostname || 'localhost';
    const wsUrl = `ws://${host}:4100`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      ws.send(JSON.stringify({ type: 'list_sessions' }));
      ws.send(JSON.stringify({ type: 'get_audit_logs' }));
      ws.send(JSON.stringify({ type: 'list_skills' }));
      ws.send(JSON.stringify({ type: 'get_model_config' }));
    };

    ws.onclose = () => setIsConnected(false);
    ws.onerror = (err) => console.error('WS Error:', err);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'connected':
            console.log('EasyBot Industrial Core Connected:', msg.payload);
            break;

          case 'sessions_list':
            setSessions(msg.payload);
            if (msg.payload.length > 0 && !activeSessionId) {
              setActiveSessionId(msg.payload[0].id);
            }
            break;

          case 'model_config':
            if (msg.payload?.model) {
              setActiveModel(msg.payload.model);
            }
            break;

          case 'session_created':
            setSessions(prev => {
              const exists = prev.some(s => s.id === msg.payload.id);
              if (exists) {
                return prev.map(s => s.id === msg.payload.id ? { ...msg.payload, messages: s.messages } : s);
              }
              return [msg.payload, ...prev];
            });
            setActiveSessionId(msg.payload.id);
            break;

          case 'stream_chunk':
          case 'agent_chunk': {
            const delta = msg.payload?.chunk || msg.payload?.delta || '';
            setStreamingContent(prev => prev + delta);
            break;
          }

          case 'prompt_finished':
          case 'agent_finished':
            setIsProcessing(false);
            setStreamingContent('');
            if (activeSessionId) {
              ws.send(JSON.stringify({ type: 'list_sessions' }));
            }
            ws.send(JSON.stringify({ type: 'get_audit_logs' }));
            break;

          case 'tool_call':
          case 'tool_result':
            if (activeSessionId) {
              ws.send(JSON.stringify({ type: 'list_sessions' }));
            }
            break;

          case 'audit_logs':
            setAuditLogs(msg.payload);
            break;

          case 'skills_list':
            setSkills(msg.payload);
            break;

          case 'error':
            setIsProcessing(false);
            setStreamingContent('');
            console.error('Core Error:', msg.error);
            break;
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    // Load MCP and initial data via REST
    const apiBase = `http://${host}:4100`;
    fetch(`${apiBase}/api/mcp/servers`).then(r => r.json()).then(setServers).catch(() => {});
    fetch(`${apiBase}/api/mcp/tools`).then(r => r.json()).then(setTools).catch(() => {});
    fetch(`${apiBase}/api/model/config`).then(r => r.json()).then(d => {
      if (d?.model) setActiveModel(d.model);
    }).catch(() => {});

    return () => {
      ws.close();
    };
  }, []);

  const handleCreateSession = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'create_session',
        payload: { title: `任务工单 #${sessions.length + 1}`, backend: 'UniversalRouter' }
      }));
    }
  };

  const handleSendMessage = async (text: string) => {
    let sessId = activeSessionId;
    if (!sessId && sessions.length > 0) {
      sessId = sessions[0].id;
      setActiveSessionId(sessId);
    }

    const userMsgObj: Message = {
      id: 'msg_' + Date.now(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString()
    };

    if (!sessId) {
      const newSessId = 'sess_' + Date.now();
      sessId = newSessId;
      setActiveSessionId(newSessId);
      const newSess: Session = {
        id: newSessId,
        title: text.slice(0, 20),
        messages: [userMsgObj],
        backend: 'UniversalRouter',
        workspacePath: 'default',
        createdAt: new Date().toISOString()
      };
      setSessions(prev => [newSess, ...prev]);
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'create_session',
          payload: { id: newSessId, title: text.slice(0, 20), backend: 'UniversalRouter' }
        }));
      }
    } else {
      // Optimistically add user message to existing session
      setSessions(prev => prev.map(s => {
        if (s.id === sessId) {
          return {
            ...s,
            messages: [...s.messages, userMsgObj]
          };
        }
        return s;
      }));
    }

    setIsProcessing(true);
    setStreamingContent('');
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'send_prompt',
        payload: { sessionId: sessId, prompt: text }
      }));
    }
  };

  const handleSendIMMessage = async (channelId: string, text: string) => {
    const host = window.location.hostname || 'localhost';
    const res = await fetch(`http://${host}:4100/api/im/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelId,
        senderId: 'user-cto',
        senderName: 'CTO (您)',
        text
      })
    });
    return await res.json();
  };

  const handleTestConnector = async (connectorId: string) => {
    const host = window.location.hostname || 'localhost';
    const res = await fetch(`http://${host}:4100/api/im/connectors/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connectorId })
    });
    return await res.json();
  };

  const handleSearchRAG = async (query: string) => {
    return new Promise<any[]>((resolve) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return resolve([]);
      const reqId = Math.random().toString(36).substring(7);
      const listener = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'rag_results' && msg.id === reqId) {
            wsRef.current?.removeEventListener('message', listener);
            resolve(msg.payload);
          }
        } catch (_) {}
      };
      wsRef.current.addEventListener('message', listener);
      wsRef.current.send(JSON.stringify({ type: 'query_rag', id: reqId, payload: { query } }));
    });
  };

  const handleRunWorkflow = async (workflowId: string, inputs: any) => {
    return new Promise<any>((resolve) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return resolve(null);
      const reqId = Math.random().toString(36).substring(7);
      const listener = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'workflow_finished' && msg.id === reqId) {
            wsRef.current?.removeEventListener('message', listener);
            resolve(msg.payload);
          }
        } catch (_) {}
      };
      wsRef.current.addEventListener('message', listener);
      wsRef.current.send(JSON.stringify({ type: 'run_workflow', id: reqId, payload: { workflowId, inputs } }));
    });
  };

  const handleGenerateVibeCoding = async (sessionId: string, appName: string, prompt: string) => {
    return new Promise<any>((resolve) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return resolve(null);
      const reqId = Math.random().toString(36).substring(7);
      const listener = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'vibecoding_app_generated' && msg.id === reqId) {
            wsRef.current?.removeEventListener('message', listener);
            resolve(msg.payload);
          }
        } catch (_) {}
      };
      wsRef.current.addEventListener('message', listener);
      wsRef.current.send(JSON.stringify({ type: 'generate_vibecoding_app', id: reqId, payload: { sessionId, appName, prompt } }));
    });
  };

  const handleRunAgentGroup = async (sessionId: string, task: string) => {
    return new Promise<any>((resolve) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return resolve(null);
      const reqId = Math.random().toString(36).substring(7);
      const listener = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'agent_group_finished' && msg.id === reqId) {
            wsRef.current?.removeEventListener('message', listener);
            resolve(msg.payload);
          }
        } catch (_) {}
      };
      wsRef.current.addEventListener('message', listener);
      wsRef.current.send(JSON.stringify({ type: 'run_agent_group', id: reqId, payload: { sessionId, task } }));
    });
  };

  const handleExecuteSandboxCommand = async (command: string) => {
    return new Promise<{ exitCode: number; stdout: string; stderr: string }>((resolve) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        return resolve({ exitCode: 1, stdout: '', stderr: 'WebSocket not connected' });
      }
      const reqId = Math.random().toString(36).substring(7);
      const listener = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'sandbox_command_executed' && msg.id === reqId) {
            wsRef.current?.removeEventListener('message', listener);
            resolve(msg.payload);
          }
        } catch (_) {}
      };
      wsRef.current.addEventListener('message', listener);
      wsRef.current.send(JSON.stringify({
        type: 'execute_sandbox_command',
        id: reqId,
        payload: { command, sessionId: activeSessionId || 'default' }
      }));
    });
  };

  const handleCaptureScreen = async () => {
    return new Promise<any>((resolve) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return resolve(null);
      const reqId = Math.random().toString(36).substring(7);
      const listener = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'screen_captured' && msg.id === reqId) {
            wsRef.current?.removeEventListener('message', listener);
            resolve(msg.payload);
          }
        } catch (_) {}
      };
      wsRef.current.addEventListener('message', listener);
      wsRef.current.send(JSON.stringify({
        type: 'capture_screen',
        id: reqId,
        payload: { sessionId: activeSessionId || 'default' }
      }));
    });
  };

  const handleSaveModelConfig = async (config: any) => {
    const host = window.location.hostname || 'localhost';
    await fetch(`http://${host}:4100/api/model/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    if (config.model) setActiveModel(config.model);
  };

  const handleTestModelConnection = async () => {
    const host = window.location.hostname || 'localhost';
    const res = await fetch(`http://${host}:4100/api/model/test`, { method: 'POST' });
    return await res.json();
  };

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0] || null;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f8fafc] text-slate-800 antialiased font-sans select-none">
      {/* Left Sidebar / Industrial Dock - Sleek Codex & WorkBuddy Style */}
      <div className={`${isSidebarCollapsed ? 'w-16' : 'w-64'} bg-white border-r border-slate-200 flex flex-col shrink-0 shadow-2xs transition-all duration-200 ease-in-out`}>
        {/* Brand App Header */}
        <div className="h-14 px-3.5 flex items-center justify-between border-b border-slate-200 bg-white">
          <div className="flex items-center gap-2.5 truncate">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            {!isSidebarCollapsed && (
              <div className="truncate">
                <div className="font-bold text-sm text-slate-900 tracking-tight">EasyBot</div>
                <div className="text-[10px] text-slate-400 font-mono">Enterprise Agent OS</div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              title={isSidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'}
            >
              {isSidebarCollapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Scrollable Navigation Groups */}
        <div className="flex-1 overflow-y-auto p-2.5 space-y-5 text-xs">
          {/* Group 1: 核心工作区 */}
          <div>
            {!isSidebarCollapsed && (
              <div className="px-2.5 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                核心工作区 (Workspaces)
              </div>
            )}
            <div className="space-y-1 mt-1">
              <button
                onClick={() => setActiveTab('im')}
                title="专家协同研讨大厅"
                className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center py-2.5' : 'justify-between px-3 py-2'} rounded-xl font-medium transition ${
                  activeTab === 'im'
                    ? 'bg-blue-50/90 text-blue-700 font-semibold shadow-2xs border border-blue-200/60'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <MessageSquare className="w-4 h-4 text-blue-600 shrink-0" />
                  {!isSidebarCollapsed && <span>专家协同研讨大厅</span>}
                </div>
                {!isSidebarCollapsed && <span className="text-[10px] text-slate-400 font-mono">协同</span>}
              </button>

              <button
                onClick={() => setActiveTab('chat')}
                title="智能助理对话"
                className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center py-2.5' : 'justify-between px-3 py-2'} rounded-xl font-medium transition ${
                  activeTab === 'chat'
                    ? 'bg-blue-50/90 text-blue-700 font-semibold shadow-2xs border border-blue-200/60'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Bot className="w-4 h-4 text-blue-600 shrink-0" />
                  {!isSidebarCollapsed && <span>智能助理对话</span>}
                </div>
                {!isSidebarCollapsed && activeSession && (
                  <span className="text-[10px] text-slate-400 font-mono">#{activeSession.messages.length}</span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('vibecoding')}
                title="应用即时生成 (Vibe)"
                className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center py-2.5' : 'justify-between px-3 py-2'} rounded-xl font-medium transition ${
                  activeTab === 'vibecoding'
                    ? 'bg-blue-50/90 text-blue-700 font-semibold shadow-2xs border border-blue-200/60'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Code className="w-4 h-4 text-emerald-600 shrink-0" />
                  {!isSidebarCollapsed && <span>应用即时生成 (Vibe)</span>}
                </div>
                {!isSidebarCollapsed && (
                  <span className="text-[10px] text-emerald-600 font-mono font-medium">即写即跑</span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('workflow')}
                title="自动化任务流水线"
                className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center py-2.5' : 'justify-between px-3 py-2'} rounded-xl font-medium transition ${
                  activeTab === 'workflow'
                    ? 'bg-blue-50/90 text-blue-700 font-semibold shadow-2xs border border-blue-200/60'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <GitFork className="w-4 h-4 text-purple-600 shrink-0" />
                  {!isSidebarCollapsed && <span>自动化任务流水线</span>}
                </div>
                {!isSidebarCollapsed && <span className="text-[10px] text-slate-400 font-mono">DAG</span>}
              </button>

              <button
                onClick={() => setActiveTab('terminal')}
                title="受限安全代码沙箱"
                className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center py-2.5' : 'justify-between px-3 py-2'} rounded-xl font-medium transition ${
                  activeTab === 'terminal'
                    ? 'bg-blue-50/90 text-blue-700 font-semibold shadow-2xs border border-blue-200/60'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Terminal className="w-4 h-4 text-amber-600 shrink-0" />
                  {!isSidebarCollapsed && <span>受限安全代码沙箱</span>}
                </div>
                {!isSidebarCollapsed && <span className="text-[10px] text-slate-400 font-mono">Shell</span>}
              </button>
            </div>
          </div>

          {/* Group 2: 资产与系统治理 */}
          <div>
            {!isSidebarCollapsed && (
              <div className="px-2.5 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                资产与治理 (Governance & RAG)
              </div>
            )}
            <div className="space-y-1 mt-1">
              <button
                onClick={() => setActiveTab('rag')}
                title="企业规程混合知识库"
                className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center py-2.5' : 'justify-between px-3 py-2'} rounded-xl font-medium transition ${
                  activeTab === 'rag'
                    ? 'bg-blue-50/90 text-blue-700 font-semibold shadow-2xs border border-blue-200/60'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <BookOpen className="w-4 h-4 text-purple-600 shrink-0" />
                  {!isSidebarCollapsed && <span>企业规程知识库</span>}
                </div>
                {!isSidebarCollapsed && <span className="text-[10px] text-slate-400 font-mono">BM25</span>}
              </button>

              <button
                onClick={() => setActiveTab('mcp')}
                title="MCP 工具扩展中心"
                className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center py-2.5' : 'justify-between px-3 py-2'} rounded-xl font-medium transition ${
                  activeTab === 'mcp'
                    ? 'bg-blue-50/90 text-blue-700 font-semibold shadow-2xs border border-blue-200/60'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Cpu className="w-4 h-4 text-blue-600 shrink-0" />
                  {!isSidebarCollapsed && <span>MCP 协议工具中心</span>}
                </div>
                {!isSidebarCollapsed && <span className="text-[10px] text-slate-400 font-mono">{tools.length}</span>}
              </button>

              <button
                onClick={() => setActiveTab('token_monitor')}
                title="算力与 Token 监控"
                className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center py-2.5' : 'justify-between px-3 py-2'} rounded-xl font-medium transition ${
                  activeTab === 'token_monitor'
                    ? 'bg-blue-50/90 text-blue-700 font-semibold shadow-2xs border border-blue-200/60'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Activity className="w-4 h-4 text-blue-600 shrink-0" />
                  {!isSidebarCollapsed && <span>算力与费用审计</span>}
                </div>
                {!isSidebarCollapsed && <span className="text-[10px] text-emerald-600 font-mono font-medium">真实遥测</span>}
              </button>

              <button
                onClick={() => setActiveTab('sandbox')}
                title="沙箱安全与审计屏障"
                className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center py-2.5' : 'justify-between px-3 py-2'} rounded-xl font-medium transition ${
                  activeTab === 'sandbox'
                    ? 'bg-blue-50/90 text-blue-700 font-semibold shadow-2xs border border-blue-200/60'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  {!isSidebarCollapsed && <span>安全屏障与审计</span>}
                </div>
                {!isSidebarCollapsed && <span className="text-[10px] text-slate-400 font-mono">#{auditLogs.length}</span>}
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar Footer with Model Pill & Settings */}
        <div className="p-3 border-t border-slate-200 bg-slate-50/60 space-y-2">
          {!isSidebarCollapsed ? (
            <>
              {/* Active Engine & Model Indicator */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-lg text-[10px] text-emerald-800">
                  <span className="font-semibold flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                    EasyBot Native Core
                  </span>
                  <span className="font-mono text-[9px] bg-emerald-100 text-emerald-700 px-1 rounded">127.0.0.1</span>
                </div>
                <div className="flex items-center justify-between px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px]">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span className="font-semibold text-slate-700 truncate">{activeModel}</span>
                  </div>
                  <span className="text-[9px] text-blue-600 bg-blue-50 border border-blue-200 px-1 rounded font-mono shrink-0">BYOK / OpenAI</span>
                </div>
              </div>

              {/* Model Settings Button */}
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-white border border-transparent hover:border-slate-200 rounded-md transition"
              >
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-slate-500" />
                  <span>端点配置 (Settings)</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 py-1">
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-white border border-transparent hover:border-slate-200 transition"
                title="自定义大模型端点配置"
              >
                <Settings className="w-4 h-4" />
              </button>
              <span className="w-2 h-2 rounded-full bg-emerald-500" title={`当前模型: ${activeModel}`} />
            </div>
          )}
        </div>
      </div>

      {/* Right Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50">
        <div className="flex-1 h-full overflow-hidden">
          {/* 1. Flagship Enterprise IM Workspace */}
          {activeTab === 'im' && (
            <IMWorkspace
              onSendMessage={handleSendIMMessage}
              onTestConnector={handleTestConnector}
              onSwitchTab={setActiveTab}
            />
          )}

          {/* 2. Specialists & Persona Roster */}
          {activeTab === 'experts' && (
            <ExpertStudio onSwitchTab={setActiveTab} />
          )}

          {/* 3. Connectors Hub */}
          {activeTab === 'connectors' && (
            <ConnectorStudio onTestConnector={handleTestConnector} />
          )}

          {/* 4. Chat Canvas */}
          {activeTab === 'chat' && (
            <ChatCanvas
              session={activeSession}
              onSendMessage={handleSendMessage}
              streamingContent={streamingContent}
              isProcessing={isProcessing}
              onSwitchTab={setActiveTab}
            />
          )}

          {/* 5. VibeCoding Studio */}
          {activeTab === 'vibecoding' && (
            <VibeCodingStudio
              sessionId={activeSessionId || 'default'}
              onGenerate={handleGenerateVibeCoding}
            />
          )}

          {/* 6. Workflow Studio */}
          {activeTab === 'workflow' && (
            <WorkflowStudio onRunWorkflow={handleRunWorkflow} />
          )}

          {/* 7. AgentGroup Studio */}
          {activeTab === 'group' && (
            <AgentGroupStudio
              sessionId={activeSessionId || 'default'}
              onRunGroup={handleRunAgentGroup}
            />
          )}

          {/* 8. Interactive Terminal Console */}
          {activeTab === 'terminal' && (
            <div className="h-full p-4">
              <TerminalConsole
                onExecuteCommand={handleExecuteSandboxCommand}
                sandboxRoot={activeSession?.workspacePath || 'workspace/sandbox'}
              />
            </div>
          )}

          {/* 9. Token Monitor */}
          {activeTab === 'token_monitor' && (
            <TokenMonitor />
          )}

          {/* 11. CubeSandbox Monitor */}
          {activeTab === 'sandbox' && (
            <SandboxMonitor logs={auditLogs} workspacePath={activeSession?.workspacePath} />
          )}

          {/* 12. WeKnora Hybrid RAG Hub */}
          {activeTab === 'rag' && (
            <KnowledgeHub onSearch={handleSearchRAG} />
          )}

          {/* 13. MCP Server Catalog */}
          {activeTab === 'mcp' && (
            <MCPServerCatalog servers={servers} tools={tools} />
          )}

          {/* 14. Skills Market */}
          {activeTab === 'skills' && (
            <SkillsMarket skills={skills} />
          )}
        </div>
      </div>

      {/* Model Settings Modal */}
      <ModelSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaveConfig={handleSaveModelConfig}
        onTestConnection={handleTestModelConnection}
      />
    </div>
  );
}
