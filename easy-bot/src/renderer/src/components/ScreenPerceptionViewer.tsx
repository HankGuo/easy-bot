import React, { useState } from 'react';
import { Eye, Camera, RefreshCw, Layers, Monitor, MousePointer, Crosshair, CheckCircle2, Shield } from 'lucide-react';

interface ScreenPerceptionViewerProps {
  onCapture: () => Promise<any>;
}

export function ScreenPerceptionViewer({ onCapture }: ScreenPerceptionViewerProps) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [snapshot, setSnapshot] = useState<any>({
    timestamp: '11:05:22',
    display: { width: 1920, height: 1080, scale: 2 },
    activeWindow: 'EasyBot 企业级智能体工作台',
    uiElements: [
      { id: 'el-1', name: '智能专家协同交互输入框', rect: [120, 840, 800, 56], type: 'input' },
      { id: 'el-2', name: '发起自动化执行指令', rect: [930, 840, 96, 56], type: 'button' },
      { id: 'el-3', name: '受限安全代码沙箱', rect: [450, 48, 160, 36], type: 'tab' },
      { id: 'el-4', name: '企业规范与知识文档库', rect: [650, 48, 200, 36], type: 'search' },
    ],
    ocrTexts: [
      'EasyBot - 企业级桌面智能体操作系统',
      '受限安全微沙箱隔离保护生效中',
      '推理引擎: sensenova-6.8-flash-lite (OpenAI 兼容网关直连)',
      '企业规范与工程资产双路检索: 98.4% 匹配度'
    ]
  });

  const handleRunCapture = async () => {
    setIsCapturing(true);
    try {
      const res = await onCapture();
      if (res) {
        setSnapshot(res);
      }
    } catch (err: any) {
      console.error('Capture failed:', err);
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 p-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Eye className="w-5 h-5 text-blue-600" />
            桌面多模态屏幕感知与定位 (Screen Perception & Multi-Modal OCR)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            桌面多模态智能识别：实时捕获界面、复杂图表与研发窗口，提取关键文本信息与交互操作元素
          </p>
        </div>

        <button
          onClick={handleRunCapture}
          disabled={isCapturing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-md shadow-sm transition"
        >
          {isCapturing ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Camera className="w-3.5 h-3.5" />
          )}
          <span>立即捕获屏幕状态</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
        {/* Left 2 Cols: Screen Canvas Simulation & Bounding Box */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 shadow-sm p-4 flex flex-col">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 text-xs">
            <span className="font-semibold text-slate-800 flex items-center gap-1.5">
              <Monitor className="w-4 h-4 text-slate-500" />
              当前捕获视口 ({snapshot.display.width}x{snapshot.display.height} @{snapshot.display.scale}x)
            </span>
            <span className="text-slate-400 font-mono text-[11px]">捕获时间: {snapshot.timestamp}</span>
          </div>

          <div className="relative flex-1 bg-slate-900 rounded-md border border-slate-800 flex items-center justify-center overflow-hidden min-h-[320px]">
            {/* Simulated Desktop Wireframe with bounding boxes */}
            <div className="w-[90%] h-[85%] bg-slate-950 rounded border border-slate-700 relative p-3 text-slate-300 font-mono text-[11px]">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-blue-400 font-medium">Window: {snapshot.activeWindow}</span>
                <span className="text-emerald-400 text-[10px]">● Active Focus</span>
              </div>

              {/* Elements with bounding boxes */}
              <div className="mt-4 grid grid-cols-2 gap-4">
                {snapshot.uiElements.map((el: any) => (
                  <div
                    key={el.id}
                    className="p-2.5 rounded border border-blue-500/50 bg-blue-500/10 hover:bg-blue-500/20 transition flex items-center justify-between group cursor-pointer"
                  >
                    <div>
                      <div className="text-slate-200 font-semibold">{el.name}</div>
                      <div className="text-[10px] text-blue-300 font-mono">BBox: [{el.rect.join(', ')}]</div>
                    </div>
                    <span className="text-[10px] uppercase font-bold text-blue-400 px-1.5 py-0.5 rounded bg-blue-900/60 border border-blue-700">
                      {el.type}
                    </span>
                  </div>
                ))}
              </div>

              <div className="absolute bottom-3 left-3 right-3 p-2 bg-slate-900/90 rounded border border-slate-800 text-[11px] text-slate-400">
                <Crosshair className="w-3.5 h-3.5 inline mr-1 text-emerald-400" />
                虚拟光标定位就绪 · 鼠标/键盘注入遵循沙箱白名单规则
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: OCR & Metadata Inspector */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 flex flex-col">
          <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-100 text-xs font-semibold text-slate-800">
            <Layers className="w-4 h-4 text-blue-600" />
            多模态 OCR 结构化文本解析
          </div>

          <div className="space-y-2 mb-4 flex-1 overflow-y-auto">
            {snapshot.ocrTexts.map((text: string, idx: number) => (
              <div key={idx} className="p-2.5 rounded bg-slate-50 border border-slate-200 text-xs text-slate-700 font-mono">
                <span className="text-slate-400 mr-2 text-[10px]">#{idx + 1}</span>
                {text}
              </div>
            ))}
          </div>

          <div className="p-3 bg-blue-50 rounded-md border border-blue-200 text-xs text-blue-800">
            <div className="font-semibold flex items-center gap-1.5 mb-1">
              <Shield className="w-3.5 h-3.5 text-blue-600" />
              安全边界保障
            </div>
            系统屏幕捕获与控制指令均在本地运行，不会将全屏截屏静默上传至第三方服务器。
          </div>
        </div>
      </div>
    </div>
  );
}
