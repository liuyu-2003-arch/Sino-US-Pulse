import React, { useState, useEffect } from 'react';
import { X, Github, Mail, Lock, Loader2, AlertCircle } from 'lucide-react';
import { signInWithGoogle, signInWithGithub, signInWithEmail, signUpWithEmail } from '../services/supabase';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
        setEmail('');
        setPassword('');
        setIsSignUp(false);
        setError(null);
        setIsLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setIsLoading(true);

      try {
          if (isSignUp) {
              const { user, session } = await signUpWithEmail(email, password);
              if (user && !session) {
                  alert("注册成功！请检查您的邮箱以完成验证。");
                  onClose();
              } else {
                  onClose();
              }
          } else {
              await signInWithEmail(email, password);
              onClose();
          }
      } catch (err: any) {
          console.error(err);
          setError(err.message === 'Invalid login credentials' ? '邮箱或密码错误' : (err.message || "操作失败"));
      } finally {
          setIsLoading(false);
      }
  };

  const t = {
    title: isSignUp ? '注册账户' : '登录账户',
    google: 'Google',
    github: 'GitHub',
    desc: '登录后收藏和创建对比条目',
    emailPlaceholder: '邮箱地址',
    passwordPlaceholder: '密码',
    or: '或',
    submit: isSignUp ? '注册' : '登录',
    toggle: isSignUp ? '已有账号？直接登录' : '没有账号？免费注册',
    loggingIn: isSignUp ? '注册中...' : '登录中...',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold text-white">{t.title}</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-slate-400 text-sm mb-6">{t.desc}</p>
        
        {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-sm text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
            </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mb-6">
            <div className="space-y-2">
                <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input 
                        type="email" 
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={t.emailPlaceholder}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-500 sm:text-sm"
                    />
                </div>
            </div>
            <div className="space-y-2">
                <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input 
                        type="password" 
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={t.passwordPlaceholder}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-500 sm:text-sm"
                    />
                </div>
            </div>

            <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-all shadow-lg shadow-indigo-500/20"
            >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {isLoading ? t.loggingIn : t.submit}
            </button>

            <div className="text-center">
                <button 
                    type="button"
                    onClick={() => {
                        setError(null);
                        setIsSignUp(!isSignUp);
                    }}
                    className="text-xs text-slate-400 hover:text-indigo-400 transition-colors"
                >
                    {t.toggle}
                </button>
            </div>
        </form>

        <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-700"></div>
            </div>
            <div className="relative flex justify-center text-xs">
                <span className="bg-slate-900 px-2 text-slate-500">{t.or}</span>
            </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={signInWithGoogle}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-slate-900 rounded-xl font-semibold hover:bg-slate-100 transition-colors text-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            {t.google}
          </button>

          <button
            type="button"
            onClick={signInWithGithub}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#24292e] text-white rounded-xl font-semibold hover:bg-[#2f363d] transition-colors text-sm"
          >
            <Github className="w-4 h-4" />
            {t.github}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginModal;