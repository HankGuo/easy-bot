import React, { useState } from 'react';
import { Code, Play, RefreshCw, ExternalLink, Globe, CheckCircle2, FileCode, Layers, Monitor } from 'lucide-react';

interface Props {
  sessionId: string;
  onGenerate: (sessionId: string, appName: string, prompt: string) => Promise<any>;
}

export const VibeCodingStudio: React.FC<Props> = ({ sessionId, onGenerate }) => {
  const [appName, setAppName] = useState('课程实验数据交互大屏');
  const [prompt, setPrompt] = useState('构建一个算法与实验数据交互可视化看板，包含算法收敛曲线、参数动态调节滑块与实验结果图表');
  const [isGenerating, setIsGenerating] = useState(false);
  const [project, setProject] = useState<any | null>(null);
  const [activeFile, setActiveFile] = useState<string>('index.html');

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appName.trim() || isGenerating) return;
    setIsGenerating(true);
    try {
      const res = await onGenerate(sessionId, appName, prompt);
      setProject(res);
      if (res.files && res.files.length > 0) {
        setActiveFile(res.files[0].relativePath);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const selectedFileContent = project?.files?.find((f: any) => f.relativePath === activeFile)?.content || '';

  return (
    <div className="h-full flex flex-col bg-slate-50 text-xs p-6 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4 bg-white p-4 rounded-lg shadow-2xs shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
            <Code className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800">交互应用与大屏即时生成工作台 (Interactive Studio)</h2>
            <p className="text-[11px] text-slate-500">用自然语言快速生成业务原型、数据大屏与交互式验证应用，即写即跑</p>
          </div>
        </div>
      </div>

      {/* Input Form */}
      <form onSubmit={handleGenerate} className="bg-white p-4 rounded-lg border border-slate-200 mb-4 shrink-0 space-y-3 shadow-2xs">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-1">
            <label className="text-xs font-semibold text-slate-700 block mb-1">应用标识 (App Name):</label>
            <input
              type="text"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition"
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-semibold text-slate-700 block mb-1">自然语言需求 Prompt:</label>
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isGenerating}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-md text-xs font-semibold flex items-center gap-2 shadow-xs transition"
          >
            {isGenerating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isGenerating ? '正在沙箱中编译 WebApp...' : '一键 VibeCoding 并启动沙箱预览'}</span>
          </button>
        </div>
      </form>

      {/* Main Split View: Code on Left, Live Preview on Right */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-hidden">
        {/* Left: Code Structure & Files */}
        <div className="bg-white border border-slate-200 rounded-lg flex flex-col overflow-hidden shadow-2xs">
          <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
            <div className="flex items-center gap-2">
              <FileCode className="w-4 h-4 text-blue-600" />
              <span className="font-semibold text-slate-800">沙箱代码工程文件</span>
            </div>
            {project && (
              <span className="text-[11px] text-slate-400 font-mono">
                {project.files.length} 个静态文件已挂载
              </span>
            )}
          </div>

          {/* File tabs */}
          {project && (
            <div className="flex border-b border-slate-200 bg-slate-50 px-2 pt-2 gap-1 overflow-x-auto">
              {project.files.map((f: any) => (
                <button
                  key={f.relativePath}
                  onClick={() => setActiveFile(f.relativePath)}
                  className={`px-3 py-1 text-xs font-mono rounded-t-md transition border-t border-x ${
                    activeFile === f.relativePath
                      ? 'bg-white text-blue-600 font-semibold border-slate-200 -mb-px'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {f.relativePath}
                </button>
              ))}
            </div>
          )}

          {/* Code Viewer */}
          <div className="flex-1 p-4 bg-slate-950 font-mono text-xs overflow-auto text-slate-200">
            {project ? (
              <pre className="whitespace-pre">{selectedFileContent}</pre>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                点击上方按钮一键生成完整 WebApp 代码工程
              </div>
            )}
          </div>
        </div>

        {/* Right: Live Sandboxed Preview */}
        <div className="bg-white border border-slate-200 rounded-lg flex flex-col overflow-hidden shadow-2xs">
          {/* Browser Address Bar Mockup */}
          <div className="p-2.5 border-b border-slate-200 flex items-center gap-2 bg-slate-50/80">
            <div className="flex items-center gap-1.5 px-2">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300"></span>
            </div>
            <div className="flex-1 flex items-center gap-2 bg-white border border-slate-200 rounded px-2.5 py-1 text-[11px] font-mono text-slate-600">
              <Globe className="w-3.5 h-3.5 text-slate-400" />
              <span className="truncate">{project?.previewUrl || 'http://127.0.0.1:4100/preview/pending'}</span>
            </div>
            {project && (
              <a
                href={project.previewUrl}
                target="_blank"
                rel="noreferrer"
                className="p-1 text-slate-500 hover:text-blue-600 rounded transition"
                title="在外部独立浏览器标签页打开"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>

          {/* Iframe View */}
          <div className="flex-1 bg-white relative">
            {project?.previewUrl ? (
              <iframe
                src={project.previewUrl}
                className="w-full h-full border-none"
                title="VibeCoding Sandbox Preview"
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs space-y-2">
                <Monitor className="w-8 h-8 text-slate-300" />
                <span>沙箱容器内嵌预览已就绪</span>
                <span className="text-[10px] text-slate-400">生成的 HTML/JS 将在此处直接安全沙箱运行</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
