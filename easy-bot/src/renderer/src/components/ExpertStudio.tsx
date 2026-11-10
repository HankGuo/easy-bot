import React, { useState, useEffect } from 'react';
import { 
  Users, Bot, Sparkles, Wrench, Shield, Check, Edit3, 
  MessageSquare, Sliders, ChevronRight, CheckCircle2 
} from 'lucide-react';
import { Expert } from './IMWorkspace';

interface ExpertStudioProps {
  onSwitchTab?: (tab: string) => void;
}

export function ExpertStudio({ onSwitchTab }: ExpertStudioProps) {
  const [experts, setExperts] = useState<Expert[]>([]);
  const [selectedExpert, setSelectedExpert] = useState<Expert | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [promptText, setPromptText] = useState('');

  const fetchExperts = () => {
    const host = window.location.hostname || 'localhost';
    fetch(`http://${host}:4100/api/im/experts`)
      .then(r => r.json())
      .then(data => {
        setExperts(data);
        if (data.length > 0 && !selectedExpert) {
          setSelectedExpert(data[0]);
          setPromptText(data[0].systemPrompt);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchExperts();
  }, []);

  const handleSelectExpert = (exp: Expert) => {
    setSelectedExpert(exp);
    setPromptText(exp.systemPrompt);
    setIsEditing(false);
  };

  return (
    <div className="flex h-full w-full bg-slate-50 overflow-hidden font-sans text-xs">
      {/* Left List of Experts (260px) */}
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" />
            <span className="font-bold text-slate-800 text-xs">专家阵容与人设库 (Specialists)</span>
          </div>
          <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.2 rounded font-mono font-medium">
            {experts.length} 位专家
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {experts.map((exp) => (
            <div
              key={exp.id}
              onClick={() => handleSelectExpert(exp)}
              className={`p-3 rounded-lg border transition cursor-pointer flex items-center justify-between ${
                selectedExpert?.id === exp.id
                  ? 'bg-blue-50/80 border-blue-300 shadow-2xs'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <img src={exp.avatar} alt={exp.name} className="w-8 h-8 rounded-full border border-slate-200 shrink-0" />
                <div className="truncate">
                  <div className="font-bold text-slate-800 text-xs truncate">{exp.name}</div>
                  <div className="text-[10px] text-slate-400 truncate">{exp.title.split(' ')[0]}</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
            </div>
          ))}
        </div>
      </div>

      {/* Right Detail & Prompt Editor (Flex 1) */}
      <div className="flex-1 flex flex-col h-full bg-[#f8fafc] overflow-y-auto p-6">
        {selectedExpert ? (
          <div className="max-w-3xl space-y-5">
            {/* Top Expert Profile Card */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs flex items-start justify-between">
              <div className="flex items-start gap-4">
                <img
                  src={selectedExpert.avatar}
                  alt={selectedExpert.name}
                  className="w-14 h-14 rounded-xl border border-slate-200 shadow-xs"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900">{selectedExpert.name}</h2>
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium text-blue-700 bg-blue-50 border border-blue-200 font-mono">
                      {selectedExpert.title}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {selectedExpert.description}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {selectedExpert.tags.map(t => (
                      <span key={t} className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600 border border-slate-200 font-medium">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                在线待命
              </span>
            </div>

            {/* System Prompt & Cognitive Blueprint */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-blue-600" />
                  <span>角色认知提示词 (System Prompt & Philosophy)</span>
                </div>
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{isEditing ? '取消编辑' : '微调 Prompt'}</span>
                </button>
              </div>

              {isEditing ? (
                <div className="space-y-3">
                  <textarea
                    value={promptText}
                    onChange={(e) => setPromptText(e.target.value)}
                    rows={5}
                    className="w-full bg-slate-50 border border-slate-200 rounded-md p-3 text-xs text-slate-800 font-mono focus:outline-none focus:border-blue-500"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-3.5 py-1.5 bg-blue-600 text-white rounded text-xs font-semibold hover:bg-blue-700 shadow-xs"
                    >
                      保存微调
                    </button>
                  </div>
                </div>
              ) : (
                <pre className="p-3.5 bg-slate-50 rounded-md border border-slate-200 text-xs text-slate-700 font-mono whitespace-pre-wrap leading-relaxed">
                  {promptText}
                </pre>
              )}
            </div>

            {/* Bound Skills for this Expert */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs space-y-3">
              <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <Wrench className="w-4 h-4 text-purple-600" />
                <span>挂载工具与执行技能 (Bound Execution Skills)</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {selectedExpert.skills.map((skill) => (
                  <div key={skill} className="p-3 rounded-md bg-slate-50 border border-slate-200 text-slate-800 space-y-1">
                    <div className="font-mono font-semibold text-xs text-blue-700">{skill}</div>
                    <div className="text-[10px] text-slate-400">CubeSandbox 原生授信执行</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom IM Fast Link */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
              <div>
                <div className="font-bold text-blue-900 text-xs">与 {selectedExpert.name} 发起协同任务</div>
                <div className="text-[11px] text-blue-700 mt-0.5">可以在企业协同大厅或私聊频道中直接 @{selectedExpert.name} 进行任务委派</div>
              </div>
              <button
                onClick={() => onSwitchTab && onSwitchTab('im')}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-semibold text-xs shadow-xs transition"
              >
                前往 IM 频道
              </button>
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-400">
            请从左侧选择专家查看人设配置
          </div>
        )}
      </div>
    </div>
  );
}
