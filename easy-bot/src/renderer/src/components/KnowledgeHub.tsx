import React, { useState, useEffect } from 'react';
import { BookOpen, Search, FileText, Layers, Database, Upload, Trash2, RefreshCw, FolderPlus, CheckCircle2, AlertCircle, FilePlus2, Check, ArrowRight, Sparkles } from 'lucide-react';

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
      setResults(res || []);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDropFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadMessage(null);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const content = reader.result as string;
        const res = await fetch('/api/knowledge/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            content,
            title: file.name.replace(/\.[^/.]+$/, '')
          })
        });

        if (res.ok) {
          setUploadMessage({ type: 'success', text: `文件《${file.name}》已成功切片入库并建立倒排与向量索引！` });
          await fetchDocuments();
        } else {
          const err = await res.json();
          setUploadMessage({ type: 'error', text: err.error || '上传解析失败' });
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
        setUploadMessage({ type: 'success', text: `规程规范《${manualTitle}》已成功切片入库！` });
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
    <div className="h-full flex flex-col bg-[#f8fafc] overflow-y-auto p-6 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto w-full space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-200/80 gap-4 shrink-0">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-700">
                <BookOpen className="w-4 h-4" />
              </div>
              <h2 className="font-bold text-slate-800 text-base md:text-lg tracking-tight">企业混合知识库中枢 (Hybrid RAG Hub)</h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              基于 Okapi BM25 词法倒排与密集向量 RRF 倒数排名融合，支持热插拔文件夹自动监听与自服务轻量入库
            </p>
          </div>

          {/* Sub-tab switcher */}
          <div className="flex items-center bg-slate-200/60 p-1 rounded-xl border border-slate-200 text-xs">
            <button
              onClick={() => setActiveSubTab('manage')}
              className={`px-4 py-2 rounded-lg transition font-medium flex items-center gap-2 ${
                activeSubTab === 'manage'
                  ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FolderPlus className="w-4 h-4 text-blue-600" />
              <span>知识资产与自服务管理 ({documents.length})</span>
            </button>
            <button
              onClick={() => setActiveSubTab('search')}
              className={`px-4 py-2 rounded-lg transition font-medium flex items-center gap-2 ${
                activeSubTab === 'search'
                  ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Search className="w-4 h-4 text-purple-600" />
              <span>实时双路语义检索</span>
            </button>
          </div>
        </div>

        {/* Sub-tab 1: 自服务入库与管理 (Ultra-Lightweight Ingestion) */}
        {activeSubTab === 'manage' && (
          <div className="space-y-6">
            {/* Banner: Hot-Drop Folder Mechanism */}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-50/80 to-indigo-50/60 border border-blue-200/80 shadow-2xs">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <h3 className="font-bold text-slate-800 text-sm">自服务热插拔挂载目录 (Drop-Folder Watcher) 运行中</h3>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
                    客户文员或车间班长只需把规程、BOM、设备手册（.txt / .md / .json / .csv）直接放入监控文件夹，无需数据工程师干预，系统秒级自动分块与入库：
                  </p>
                  <div className="font-mono text-xs text-blue-800 bg-white/80 px-3 py-1.5 rounded-lg border border-blue-200/60 inline-block">
                    📁 监控路径: {watcherStatus?.watchDir || 'knowledge_drop/'}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={handleSyncDrop}
                    disabled={loading}
                    className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold shadow-2xs flex items-center gap-2 transition"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
                    <span>立即扫描同步</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Notification messages */}
            {uploadMessage && (
              <div className={`p-4 rounded-xl border text-xs flex items-center justify-between shadow-2xs ${
                uploadMessage.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}>
                <div className="flex items-center gap-2">
                  {uploadMessage.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span className="font-medium">{uploadMessage.text}</span>
                </div>
                <button onClick={() => setUploadMessage(null)} className="text-slate-400 hover:text-slate-600 text-xs">
                  关闭
                </button>
              </div>
            )}

            {/* Upload Area & Quick Paste Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Option A: Drag & Drop File Upload */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-800 mb-1">
                    <Upload className="w-4 h-4 text-blue-600" />
                    <span>方式一：拖拽或选择本地文件导入</span>
                  </div>
                  <p className="text-xs text-slate-500 mb-4">
                    支持 TXT、Markdown、CSV、JSON 规程文档，前端自动流式解析入库
                  </p>

                  <label className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50/60 hover:bg-blue-50/20 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition text-center group">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center mb-3 group-hover:scale-105 transition">
                      <FilePlus2 className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-semibold text-slate-800 group-hover:text-blue-600 transition">
                      点击浏览文件 或 将文件拖放到此处
                    </span>
                    <span className="text-[11px] text-slate-400 mt-1">
                      单文件大小建议不超过 20MB，系统将自适应切片
                    </span>
                    <input
                      type="file"
                      accept=".txt,.md,.json,.csv"
                      onChange={handleDropFileUpload}
                      disabled={isUploading}
                      className="hidden"
                    />
                  </label>
                </div>

                {isUploading && (
                  <div className="mt-4 flex items-center gap-2 text-xs text-blue-600 font-medium">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>正在进行文本特征提取与倒排索引构建...</span>
                  </div>
                )}
              </div>

              {/* Option B: Manual Quick Paste Form */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-800 mb-1">
                  <FileText className="w-4 h-4 text-purple-600" />
                  <span>方式二：在线直接录入 SOP 规程</span>
                </div>
                <p className="text-xs text-slate-500 mb-4">
                  适合现场应急录入维修案例、首件标准公差或临时通知
                </p>

                <form onSubmit={handleManualUpload} className="space-y-3.5">
                  <div>
                    <input
                      type="text"
                      value={manualTitle}
                      onChange={(e) => setManualTitle(e.target.value)}
                      placeholder="规范标题，如: SOP-CNC-04_主轴换刀卡刀处置规程"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition"
                    />
                  </div>
                  <div>
                    <textarea
                      rows={5}
                      value={manualContent}
                      onChange={(e) => setManualContent(e.target.value)}
                      placeholder="在此直接粘贴规范正文内容（包含故障现象、报警代码、处理流程、判定依据等）..."
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition leading-relaxed font-sans"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isUploading || !manualTitle.trim() || !manualContent.trim()}
                      className="px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-2 transition"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>直接生成索引入库</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Currently Ingested Documents List */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-blue-600" />
                  <h3 className="font-bold text-slate-800 text-sm">已挂载知识资产库 (Active Indexed Documents)</h3>
                </div>
                <span className="text-xs text-slate-500 font-mono">
                  共计收录: <strong className="text-slate-800">{documents.length}</strong> 篇文档
                </span>
              </div>

              {documents.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  暂无已入库文档，请通过上述文件夹或上传插槽添加第一篇规程资产
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-white hover:border-blue-200 hover:shadow-2xs transition flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3 truncate">
                        <div className="w-9 h-9 rounded-lg bg-blue-100/70 border border-blue-200 text-blue-700 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="truncate">
                          <div className="font-semibold text-slate-800 text-xs truncate group-hover:text-blue-600 transition">
                            {doc.title}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                            <span>切片块数: {doc.chunksCount}</span>
                            <span>•</span>
                            <span>预估 Tokens: {doc.totalTokens}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDelete(doc.id, doc.title)}
                        className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition shrink-0"
                        title="从检索库注销该文档"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sub-tab 2: 实时精准双路检索验证 (Okapi BM25 + Vector RRF) */}
        {activeSubTab === 'search' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs space-y-4">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">双路精准召回演练 (BM25 词法 + 向量语义)</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  在此输入现场技术词汇、公差配合代号（如 h6）或报警码（如 E-06），验证 RAG 的 100% 命中能力
                </p>
              </div>

              <form onSubmit={handleSearch} className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="输入检索关键词，例如: 'E-06 报警如何解决'、'h6 轴承公差配合'、'动火作业安全票'..."
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs md:text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !query.trim()}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl text-xs md:text-sm font-semibold shadow-xs flex items-center gap-2 transition shrink-0"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  <span>{loading ? '检索中' : '执行双路检索'}</span>
                </button>
              </form>
            </div>

            {/* Results */}
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                <span>检索命中结果 ({results.length})</span>
                <span className="font-mono">RRF 倒数综合重排融合</span>
              </div>

              {results.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs bg-white rounded-2xl border border-slate-200">
                  {loading ? '正在计算 BM25 词频与语义余弦相似度...' : '输入关键词并执行搜索后，系统将展示命中的规程切片与置信度'}
                </div>
              ) : (
                <div className="space-y-3.5">
                  {results.map((res, idx) => (
                    <div
                      key={res.id || idx}
                      className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2 hover:border-purple-200 transition"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-purple-50 text-purple-700 font-mono text-xs flex items-center justify-center font-bold">
                            #{idx + 1}
                          </span>
                          <span className="font-bold text-slate-800 text-xs md:text-sm">
                            {res.metadata?.title || '知识片段'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 font-mono text-[11px]">
                          <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                            BM25 得分: {res.bm25Score?.toFixed(2) || 'N/A'}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                            RRF 综合分: {res.score?.toFixed(3) || '1.000'}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200 font-sans whitespace-pre-wrap">
                        {res.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
