import React, { useState } from 'react';
import { Shield, Key, GraduationCap, Building2, AlertCircle, Loader2 } from 'lucide-react';

export interface CampusUser {
  id: string;
  username: string;
  displayName: string;
  role: string;
  department?: string;
  groups: string[];
}

interface CampusAuthModalProps {
  isOpen: boolean;
  onSuccess: (user: CampusUser, token: string) => void;
}

export function CampusAuthModal({ isOpen, onSuccess }: CampusAuthModalProps) {
  const [activeTab, setActiveTab] = useState<'ldap' | 'faculty' | 'admin'>('ldap');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMessage('请输入完整的账号与密码');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const host = window.location.hostname || 'localhost';
      const res = await fetch(`http://${host}:4100/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || '认证失败，请核对学工号及口令');
      }

      localStorage.setItem('easybot_auth_token', data.token);
      localStorage.setItem('easybot_user', JSON.stringify(data.user));
      onSuccess(data.user, data.token);
    } catch (err: any) {
      setErrorMessage(err.message || '登录连接异常');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 p-6 text-white text-center relative">
          <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center mx-auto mb-3 backdrop-blur-md border border-white/20">
            <Building2 className="w-7 h-7 text-blue-300" />
          </div>
          <h2 className="text-xl font-bold tracking-tight">EasyBot 企业级 Agent 工作站</h2>
          <p className="text-xs text-blue-200/80 mt-1">企业统一身份认证与组织隔离接入网关</p>
        </div>

        {/* Auth Mode Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50/70 p-1">
          <button
            type="button"
            onClick={() => { setActiveTab('ldap'); setErrorMessage(null); }}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition flex items-center justify-center gap-1.5 ${
              activeTab === 'ldap'
                ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            企业目录 (LDAP)
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('faculty'); setErrorMessage(null); }}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition flex items-center justify-center gap-1.5 ${
              activeTab === 'faculty'
                ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            本地业务账号
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('admin'); setErrorMessage(null); }}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition flex items-center justify-center gap-1.5 ${
              activeTab === 'admin'
                ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            超级管理员
          </button>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {activeTab === 'ldap' ? '企业统一认证工号 / 邮箱' : activeTab === 'faculty' ? '业务员工号 / 账号' : '超级管理员账号'}
            </label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder={activeTab === 'ldap' ? 'user_li 或 lead_zhang' : activeTab === 'faculty' ? 'employee_01' : 'admin'}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm not-italic focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition"
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">认证密码 / 口令</label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm not-italic focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition"
              />
            </div>
          </div>

          {activeTab === 'admin' && (
            <div className="p-2.5 bg-amber-50 border border-amber-200/80 rounded-xl text-[11px] text-amber-800 leading-relaxed">
              💡 首次部署默认生成的随机管理员凭据位于服务器目录：
              <code className="block mt-1 font-mono bg-white/70 px-1.5 py-0.5 rounded text-slate-800">.easybot_data/initial_admin.credentials</code>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>正在校验企业目录与权限...</span>
              </>
            ) : (
              <>
                <Key className="w-4 h-4" />
                <span>验证身份并进入工作站</span>
              </>
            )}
          </button>

          <div className="text-center pt-2">
            <span className="text-[11px] text-slate-400">
              采用企业级 RBAC 行级授权与数字证书签名，严禁越权访问受控核心资产
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}
