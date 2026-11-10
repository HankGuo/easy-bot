import React, { useState, useRef, useEffect } from 'react';
import { Terminal as TerminalIcon, Play, Trash2, Shield, CheckCircle, AlertTriangle, ArrowRight, CornerDownLeft } from 'lucide-react';

interface TerminalEntry {
  id: string;
  command: string;
  output: string;
  exitCode: number;
  timestamp: string;
  isError?: boolean;
}

interface TerminalConsoleProps {
  onExecuteCommand: (command: string) => Promise<{ exitCode: number; stdout: string; stderr: string }>;
  sandboxRoot: string;
}

export function TerminalConsole({ onExecuteCommand, sandboxRoot }: TerminalConsoleProps) {
  const [entries, setEntries] = useState<TerminalEntry[]>([
    {
      id: 'init-1',
      command: 'uname -srm; pwd',
      output: `Darwin 24.3.0 arm64\n${sandboxRoot}`,
      exitCode: 0,
      timestamp: new Date().toLocaleTimeString()
    },
    {
      id: 'init-2',
      command: 'echo "[CubeSandbox] Micro-Sandbox isolated container active (Syscall whitelist enforced)"',
      output: '[CubeSandbox] Micro-Sandbox isolated container active (Syscall whitelist enforced)',
      exitCode: 0,
      timestamp: new Date().toLocaleTimeString()
    }
  ]);
  const [currentCmd, setCurrentCmd] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries]);

  const handleRun = async (cmdToRun?: string) => {
    const cmd = (cmdToRun || currentCmd).trim();
    if (!cmd || isExecuting) return;

    setIsExecuting(true);
    setCurrentCmd('');

    try {
      const res = await onExecuteCommand(cmd);
      const outputText = res.exitCode === 0 ? res.stdout : (res.stderr || res.stdout);
      setEntries(prev => [
        ...prev,
        {
          id: Math.random().toString(36).substring(7),
          command: cmd,
          output: outputText || '(No output produced)',
          exitCode: res.exitCode,
          timestamp: new Date().toLocaleTimeString(),
          isError: res.exitCode !== 0
        }
      ]);
    } catch (err: any) {
      setEntries(prev => [
        ...prev,
        {
          id: Math.random().toString(36).substring(7),
          command: cmd,
          output: `[Sandbox Error] ${err.message}`,
          exitCode: 1,
          timestamp: new Date().toLocaleTimeString(),
          isError: true
        }
      ]);
    } finally {
      setIsExecuting(false);
    }
  };

  const quickCommands = [
    'ls -la',
    'pwd',
    'cat package.json',
    'git status',
    'df -h .',
    'env | grep EASY'
  ];

  return (
    <div className="flex flex-col h-full bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
      {/* Top Bar - Ant Design Industrial Style */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-6 h-6 rounded bg-blue-50 text-blue-600 border border-blue-200">
            <TerminalIcon className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-semibold text-slate-800">高校代码实验实训安全终端</span>
          <span className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
            <Shield className="w-3 h-3" />
            受限隔离保护
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400 font-mono hidden md:inline">实验工作区: {sandboxRoot}</span>
          <button
            onClick={() => setEntries([])}
            className="flex items-center gap-1 px-2 py-1 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition"
            title="Clear Terminal"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>清屏</span>
          </button>
        </div>
      </div>

      {/* Quick Command Toolbar */}
      <div className="flex items-center gap-1.5 px-4 py-1.5 bg-white border-b border-slate-100 overflow-x-auto text-xs">
        <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider shrink-0">快捷指令:</span>
        {quickCommands.map(cmd => (
          <button
            key={cmd}
            onClick={() => handleRun(cmd)}
            disabled={isExecuting}
            className="px-2 py-0.5 text-xs font-mono bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-700 rounded border border-slate-200 transition shrink-0"
          >
            {cmd}
          </button>
        ))}
      </div>

      {/* Terminal Output Area */}
      <div className="flex-1 p-4 overflow-y-auto bg-slate-950 font-mono text-xs leading-relaxed select-text">
        <div className="text-slate-400 mb-3 pb-2 border-b border-slate-800">
          EduAgent OS · 高校教学安全实训沙箱终端 (支持 Python、C、Shell 交互实验运行)
          <br />在下方输入指令或点击快捷按钮。系统内置目录越权访问与高危指令实时防御保护。
        </div>

        {entries.map((entry) => (
          <div key={entry.id} className="mb-3.5">
            <div className="flex items-center gap-2 text-slate-300 font-semibold mb-1">
              <span className="text-emerald-400">student@edu-lab</span>
              <span className="text-slate-500">:</span>
              <span className="text-blue-400">~</span>
              <span className="text-slate-500">$</span>
              <span className="text-slate-100">{entry.command}</span>
              <span className="text-[10px] text-slate-500 ml-auto font-normal">{entry.timestamp}</span>
            </div>

            <pre className={`p-2 rounded overflow-x-auto whitespace-pre-wrap font-mono ${
              entry.isError ? 'bg-rose-950/40 text-rose-300 border border-rose-800/50' : 'bg-slate-900/80 text-slate-300'
            }`}>
              {entry.output}
            </pre>
          </div>
        ))}

        {isExecuting && (
          <div className="flex items-center gap-2 text-blue-400 py-1 font-mono">
            <span className="animate-spin inline-block w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full"></span>
            <span>Executing command inside sandbox...</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Terminal Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleRun();
        }}
        className="flex items-center gap-2 p-2.5 bg-slate-100 border-t border-slate-200"
      >
        <span className="text-xs font-mono font-semibold text-slate-500 pl-2">$</span>
        <input
          type="text"
          value={currentCmd}
          onChange={(e) => setCurrentCmd(e.target.value)}
          placeholder="输入 Shell 指令（如 ls -lh, npm list, git status）并在沙箱内执行..."
          disabled={isExecuting}
          className="flex-1 px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={isExecuting || !currentCmd.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded transition"
        >
          <Play className="w-3 h-3 fill-current" />
          <span>执行</span>
        </button>
      </form>
    </div>
  );
}
