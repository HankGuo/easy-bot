import React, { useState } from 'react';
import { Users, Play, CheckCircle2, ShieldCheck, Clock, MessageSquare, Terminal } from 'lucide-react';

interface Props {
  sessionId: string;
  onRunGroup: (sessionId: string, task: string) => Promise<any>;
}

export const AgentGroupStudio: React.FC<Props> = ({ sessionId, onRunGroup }) => {
  const [task, setTask] = useState('课题组同行评审：针对毕业课题方案进行学术规范、可行性与实验设计综合评估');
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<any | null>(null);

  const team = [
    { role: 'SUPERVISOR', name: '学术指导导师', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
    { role: 'ARCHITECT', name: '数学与算法顾问', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
    { role: 'CODER', name: '实验实训助教', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
    { role: 'REVIEWER', name: '学术规范与查重专家', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' }
  ];

  const handleRun = async () => {
    setIsRunning(true);
    try {
      const res = await onRunGroup(sessionId, task);
      setResult(res);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 text-xs p-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-5 bg-white p-4 rounded-lg shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800">导师集体同行评审与学术研讨 (Peer Review & Consensus)</h2>
            <p className="text-[11px] text-slate-500">多导师与助教角色动态组队、科研方案多视角交叉审查与开题答辩集体评审</p>
          </div>
        </div>
        <button
          onClick={handleRun}
          disabled={isRunning}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-md text-xs font-semibold flex items-center gap-2 shadow-xs transition"
        >
          {isRunning ? <Clock className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          <span>{isRunning ? '专家集群研讨中...' : '发起集体同行评审'}</span>
        </button>
      </div>

      {/* Task input */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 mb-5 shadow-2xs">
        <label className="text-xs font-semibold text-slate-700 block mb-1.5">集群目标任务设定 (Consensus Goal):</label>
        <input
          type="text"
          value={task}
          onChange={(e) => setTask(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition"
        />
      </div>

      {/* Team Roster */}
      <div className="mb-6">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
          集群专家矩阵 (Active Specialist Roster)
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {team.map((m) => (
            <div key={m.role} className={`p-3.5 rounded-lg border ${m.bg} shadow-2xs`}>
              <div className={`font-bold text-xs ${m.color} mb-0.5`}>{m.name}</div>
              <div className="text-[10px] text-slate-500 font-mono">ROLE: {m.role}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Collaboration Dialogue Stream */}
      {result && (
        <div className="space-y-4">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            集群交互与协同共识记录 (Consensus Trace)
          </div>

          <div className="space-y-3">
            {result.conversation.map((msg: any) => (
              <div key={msg.id} className="p-4 bg-white border border-slate-200 rounded-lg space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800">{msg.senderName}</span>
                    <span className="text-[10px] bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.2 rounded font-mono">
                      {msg.senderRole}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                </div>
                <div className="text-slate-700 text-xs whitespace-pre-wrap leading-relaxed font-sans">
                  {msg.content}
                </div>
              </div>
            ))}
          </div>

          {/* Final Consensus Summary */}
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg space-y-2 text-emerald-900 shadow-2xs">
            <div className="flex items-center gap-2 font-bold text-xs text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>集群协同执行成果交付 (Cluster Consensus Output)</span>
            </div>
            <div className="text-xs leading-relaxed text-slate-700 bg-white p-3 rounded border border-emerald-100 font-mono">
              {result.consensusPlan}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
