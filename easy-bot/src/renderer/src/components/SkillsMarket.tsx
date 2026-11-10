import React from 'react';
import { Sparkles, Check, Tag, Wrench, Shield, ArrowUpRight } from 'lucide-react';

interface Props {
  skills: any[];
}

export const SkillsMarket: React.FC<Props> = ({ skills }) => {
  return (
    <div className="h-full flex flex-col bg-slate-50 text-xs p-6 overflow-y-auto">
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-5 bg-white p-4 rounded-lg shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800">教学实训技能包中心 (Educational Skills)</h2>
            <p className="text-[11px] text-slate-500">面向高校不同学科专业与科研课题的标准化技能扩展插件库，即挂即用</p>
          </div>
        </div>
        <span className="px-3 py-1 rounded-md text-xs font-mono font-medium bg-amber-50 text-amber-800 border border-amber-200">
          已挂载 {skills.length} 项教学科研技能包
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {skills.map((s) => (
          <div key={s.id} className="p-4 bg-white border border-slate-200 hover:border-amber-400 rounded-lg space-y-3 transition shadow-2xs flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 text-xs">{s.name}</span>
                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-mono border border-slate-200">
                  v{s.version}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-3">
                {s.description}
              </p>
              <div className="flex flex-wrap gap-1 pt-1">
                {s.tags?.map((t: string) => (
                  <span key={t} className="px-1.5 py-0.5 rounded text-[10px] bg-slate-50 text-slate-600 border border-slate-200 font-medium">
                    {t}
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-1 text-[11px] text-slate-500 font-mono">
                <Wrench className="w-3 h-3 text-slate-400" />
                <span>{s.toolsRequired?.length || 0} Tools</span>
              </div>
              <span className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                <Check className="w-3 h-3 text-emerald-600" /> 运行就绪
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
