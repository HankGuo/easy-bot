import React, { useState } from 'react';
import { BookOpen, Search, FileText, Layers, Check, Database, Sparkles, Filter } from 'lucide-react';

interface Props {
  onSearch: (query: string) => Promise<any[]>;
}

export const KnowledgeHub: React.FC<Props> = ({ onSearch }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await onSearch(query);
      setResults(res);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-white border-l border-slate-200 text-xs p-4">
      {/* Header */}
      <div className="flex items-center gap-2 pb-3.5 border-b border-slate-200 mb-4">
        <BookOpen className="w-4 h-4 text-purple-600" />
        <span className="font-semibold text-slate-800">课程讲义与学术文献库 (双路精准检索)</span>
      </div>

      {/* Search Input */}
      <form onSubmit={handleSearch} className="mb-4">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="输入课程知识点、实验要求或论文课题..."
            className="w-full bg-slate-50 border border-slate-200 rounded-md pl-8 pr-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
        </div>
      </form>

      {/* Architecture Highlights */}
      <div className="grid grid-cols-2 gap-2.5 mb-4">
        <div className="bg-slate-50 p-3 rounded-md border border-slate-200">
          <div className="text-[10px] text-slate-500 flex items-center gap-1 mb-1 font-medium">
            <Layers className="w-3 h-3 text-blue-600" /> 精准术语匹配
          </div>
          <div className="font-bold text-slate-800 text-sm">关键词倒排匹配</div>
          <div className="text-[10px] text-slate-400 mt-0.5">教材概念与专有名词精准命中</div>
        </div>
        <div className="bg-slate-50 p-3 rounded-md border border-slate-200">
          <div className="text-[10px] text-slate-500 flex items-center gap-1 mb-1 font-medium">
            <Database className="w-3 h-3 text-purple-600" /> 深度语义理解
          </div>
          <div className="font-bold text-slate-800 text-sm">语义多级重排</div>
          <div className="text-[10px] text-slate-400 mt-0.5">跨句法课题意图高保真匹配</div>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto space-y-2.5">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
          <span>智能检索命中结果</span>
          <span className="text-[10px] text-slate-400 font-mono">命中 {results.length} 项</span>
        </div>
        {loading && <div className="text-center py-6 text-slate-400">正在检索全校文献与实验教材...</div>}
        {!loading && results.length === 0 && (
          <div className="text-center py-10 text-slate-400">
            输入学术问题或课题，即可检索课程讲义、实验手册与参考论文
          </div>
        )}
        {results.map((item, idx) => (
          <div key={idx} className="p-3 bg-white border border-slate-200 rounded-md text-xs space-y-1.5 shadow-2xs hover:border-blue-300 transition">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800 truncate flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                {item.chunk.documentTitle}
              </span>
              <span className="text-[10px] font-medium bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200 font-mono">
                相关度: {(item.score * 100).toFixed(1)}%
              </span>
            </div>
            <p className="text-slate-600 text-[11px] line-clamp-3 leading-relaxed">
              {item.chunk.content}
            </p>
            <div className="flex items-center gap-3 pt-1 text-[10px] text-slate-400 font-mono">
              <span>词项匹配位: #{item.bm25Rank}</span>
              <span>语义匹配位: #{item.vectorRank}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
