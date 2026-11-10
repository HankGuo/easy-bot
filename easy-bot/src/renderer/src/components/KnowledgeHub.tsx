import React, { useState, useEffect } from 'react';
import { BookOpen, Search, FileText, Layers, Database, Upload, Trash2, RefreshCw, FolderPlus, CheckCircle2, AlertCircle, FilePlus2 } from 'lucide-react';

interface Props {
  onSearch: (query: string) => Promise<any[]>;
}

interface IndexedDoc {
  id: string;
  title: string;
  chunksCount: number;
  totalTokens: number;
}

export const KnowledgeHub: React.FC<Props> = ({ onSearch }) => {
  const [activeSubTab, setActiveSubTab] = useState<'search' | 'manage'>('manage');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Manage documents state
  const [documents, setDocuments] = useState<IndexedDoc[]>([]);
  const [watcherStatus, setWatcherStatus] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Quick manual paste state
  const [manualTitle, setManualTitle] = useState('');
  const [manualContent, setManualContent] = useState('');

  const fetchDocuments = async () => {
    try {
      const res = await fetch('/api/knowledge/documents');
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
        setWatcherStatus(data.watcher || null);
      }
    } catch (err) {
      console.error('Failed to fetch knowledge documents:', err);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadMessage(null);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const textContent = event.target?.result as string;
        const res = await fetch('/api/knowledge/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            content: textContent,
            title: file.name
          })
        });

        if (res.ok) {
          setUploadMessage({ type: 'success', text: `文件《${file.name}》解析成功，已自动切片入库！` });
          await fetchDocuments();
        } else {
          const err = await res.json();
          setUploadMessage({ type: 'error', text: `上传解析失败: ${err.error || '未知错误'}` });
        }
        setIsUploading(false);
      };

      reader.onerror = () => {
        setUploadMessage({ type: 'error', text: '读取文件内容失败' });
        setIsUploading(false);
      };

      reader.readAsText(file);
    } catch (err: any) {
      setUploadMessage({ type: 'error', text: err.message });
      setIsUploading(false);
    }
  };

  const handleManualUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTitle.trim() || !manualContent.trim()) return;

    setIsUploading(true);
    setUploadMessage(null);
    try {
      const filename = `${manualTitle.trim().replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '_')}.txt`;
      const res = await fetch('/api/knowledge/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename,
          content: manualContent,
          title: manualTitle
        })
      });

      if (res.ok) {
        setUploadMessage({ type: 'success', text: `规范《${manualTitle}》已成功切片并建立索引！` });
        setManualTitle('');
        setManualContent('');
        await fetchDocuments();
      } else {
        const err = await res.json();
        setUploadMessage({ type: 'error', text: err.error || '提交失败' });
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (docId: string, title: string) => {
    if (!confirm(`确定要移除文档《${title}》的检索索引吗？`)) return;
    try {
      const res = await fetch(`/api/knowledge/documents?id=${encodeURIComponent(docId)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        await fetchDocuments();
      }
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleSyncDrop = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/knowledge/sync', { method: 'POST' });
      if (res.ok) {
        await fetchDocuments();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-white border-l border-slate-200 text-xs p-4 overflow-y-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3.5 border-b border-slate-200 mb-4 shrink-0">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-purple-600" />
          <span className="font-semibold text-slate-800">企业级混合知识库中枢 (Hybrid RAG Hub)</span>
        </div>

        {/* Sub-tab switcher */}
        <div className="flex items-center bg-slate-100 p-0.5 rounded-md border border-slate-200 text-[11px]">
          <button
            onClick={() => setActiveSubTab('manage')}
            className={`px-3 py-1 rounded transition font-medium flex items-center gap-1.5 ${
              activeSubTab === 'manage'
                ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>自服务入库与管理 ({documents.length})</span>
          </button>
          <button
            onClick={() => setActiveSubTab('search')}
            className={`px-3 py-1 rounded transition font-medium flex items-center gap-1.5 ${
              activeSubTab === 'search'
                ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>实时精准双路检索</span>
          </button>
        </div>
      </div>

      {/* Sub-tab 1: 自服务入库与管理 (Ultra-Lightweight Ingestion) */}
      {activeSubTab === 'manage' && (
        <div className="space-y-4">
          {/* Banner: Hot-Drop Folder Mechanism */}
          <div className="p-3.5 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg text-slate-700 space-y-1.5">
            <div className="flex items-center justify-between font-bold text-slate-900 text-xs">
              <span className="flex items-center gap-1.5">
                <FolderPlus className="w-4 h-4 text-purple-600" />
                零保姆级热插拔目录已激活
              </span>
              <button
                onClick={handleSyncDrop}
                disabled={loading}
                className="px-2 py-0.5 bg-white border border-purple-200 hover:bg-purple-100 text-purple-700 rounded text-[10px] font-mono flex items-center gap-1 transition"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                <span>立即同步目录</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              任何员工只需将设备说明书、工艺指导书 SOP、质检规范等文档（支持 .txt / .md / .json / .csv）拷入服务器的 
              <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-purple-200 text-purple-800 mx-1">
                {watcherStatus?.watchDir || 'knowledge_drop/'}
              </span> 
              共享文件夹，系统后台将自动感应、实时切片建立索引；移除文件将自动注销对应知识点。
            </p>
          </div>

          {/* Upload & Manual Entry Split Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Drag & Drop File Upload Box */}
            <div className="p-4 bg-slate-50 border-2 border-dashed border-slate-300 hover:border-purple-400 rounded-lg transition flex flex-col items-center justify-center text-center space-y-2">
              <Upload className="w-7 h-7 text-purple-500" />
              <div>
                <div className="font-semibold text-slate-800 text-xs">网页拖拽或点选自服务上传</div>
                <div className="text-[10px] text-slate-400 mt-0.5">支持单个或批量文本规程文档直接入库</div>
              </div>
              <label className="cursor-pointer px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-semibold shadow-2xs transition inline-flex items-center gap-1.5">
                <FilePlus2 className="w-3.5 h-3.5" />
                <span>选择本地文件上传</span>
                <input
                  type="file"
                  accept=".txt,.md,.json,.csv"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  className="hidden"
                />
              </label>
              {isUploading && <span className="text-[10px] text-purple-600 animate-pulse">正在切片分词并建立向量索引...</span>}
            </div>

            {/* Quick Text / SOP Manual Paste */}
            <form onSubmit={handleManualUpload} className="p-3.5 bg-white border border-slate-200 rounded-lg space-y-2 shadow-2xs">
              <div className="font-semibold text-slate-800 text-xs flex items-center justify-between">
                <span>粘贴工艺指导书 / 应急规程文本</span>
                <button
                  type="submit"
                  disabled={isUploading || !manualTitle || !manualContent}
                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-[11px] font-semibold transition"
                >
                  确认入库
                </button>
              </div>
              <input
                type="text"
                placeholder="规程标题（如：注塑机温度补偿控制标准）"
                value={manualTitle}
                onChange={(e) => setManualTitle(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
              />
              <textarea
                placeholder="粘贴具体条款、公差要求或排障步骤内容..."
                value={manualContent}
                onChange={(e) => setManualContent(e.target.value)}
                rows={3}
                className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 resize-none font-mono text-[11px]"
              />
            </form>
          </div>

          {/* Feedback Alert */}
          {uploadMessage && (
            <div className={`p-2.5 rounded-md flex items-center gap-2 text-xs border ${
              uploadMessage.type === 'success' 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}>
              {uploadMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" /> : <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />}
              <span>{uploadMessage.text}</span>
            </div>
          )}

          {/* Real Indexed Document List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <span>当前已就绪的厂区知识资产库 (Active Documents)</span>
              <span className="font-mono text-slate-500">共 {documents.length} 份标准文档</span>
            </div>

            {documents.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-lg border border-slate-200 text-slate-400 text-xs">
                知识库为空。请在上方上传文档，或直接将文件放入 knowledge_drop/ 文件夹。
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100 shadow-2xs">
                {documents.map((doc) => (
                  <div key={doc.id} className="p-3 flex items-center justify-between hover:bg-slate-50 transition">
                    <div className="flex items-center gap-3 truncate pr-4">
                      <div className="w-8 h-8 rounded bg-purple-50 text-purple-600 border border-purple-200 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="truncate">
                        <div className="font-semibold text-slate-800 text-xs truncate" title={doc.title}>
                          {doc.title}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-3">
                          <span>文档标识: {doc.id}</span>
                          <span>切片分块: {doc.chunksCount} chunks</span>
                          <span>Token容量: ≈ {doc.totalTokens}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(doc.id, doc.title)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                      title="注销此文档索引"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sub-tab 2: 实时精准双路检索 (Search) */}
      {activeSubTab === 'search' && (
        <div className="flex-1 flex flex-col space-y-4">
          {/* Search Input */}
          <form onSubmit={handleSearch} className="shrink-0">
            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="输入设备型号、报警代码（如 E-06）、质检公差或安全规程关键词..."
                className="w-full bg-slate-50 border border-slate-200 rounded-md pl-8 pr-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            </div>
          </form>

          {/* Architecture Highlights */}
          <div className="grid grid-cols-2 gap-2.5 shrink-0">
            <div className="bg-slate-50 p-3 rounded-md border border-slate-200">
              <div className="text-[10px] text-slate-500 flex items-center gap-1 mb-1 font-medium">
                <Layers className="w-3 h-3 text-blue-600" /> 精准术语匹配
              </div>
              <div className="font-bold text-slate-800 text-sm">Okapi BM25 词项倒排</div>
              <div className="text-[10px] text-slate-400 mt-0.5">设备型号、故障代码 100% 精确命中</div>
            </div>
            <div className="bg-slate-50 p-3 rounded-md border border-slate-200">
              <div className="text-[10px] text-slate-500 flex items-center gap-1 mb-1 font-medium">
                <Database className="w-3 h-3 text-purple-600" /> 深度语义理解
              </div>
              <div className="font-bold text-slate-800 text-sm">RRF 倒数多级重排</div>
              <div className="text-[10px] text-slate-400 mt-0.5">跨句法工艺意图高保真匹配</div>
            </div>
          </div>

          {/* Results List */}
          <div className="flex-1 overflow-y-auto space-y-2.5">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>智能检索命中切片 (RAG Hit Chunks)</span>
              <span className="text-[10px] text-slate-400 font-mono">命中 {results.length} 项</span>
            </div>
            {loading && <div className="text-center py-6 text-slate-400">正在检索厂区规程与设备资料...</div>}
            {!loading && results.length === 0 && (
              <div className="text-center py-10 text-slate-400">
                输入设备报警代码或工艺关键词，即可检索由热插拔目录或上传面板灌入的真实文档
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
                <p className="text-slate-600 text-[11px] line-clamp-3 leading-relaxed whitespace-pre-wrap">
                  {item.chunk.content}
                </p>
                <div className="flex items-center gap-3 pt-1 text-[10px] text-slate-400 font-mono">
                  <span>BM25 词项排名: #{item.bm25Rank}</span>
                  <span>语义向量排名: #{item.vectorRank}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
