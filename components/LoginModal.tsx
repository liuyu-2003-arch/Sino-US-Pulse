import React from 'react';
import { X, Github } from 'lucide-react';
import { signInWithGoogle, signInWithGithub } from '../services/supabase';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: 'en' | 'zh';
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, language }) => {
  if (!isOpen) return null;

  const t = {
    title: language === 'zh' ? '登录 / 注册' : 'Login / Sign Up',
    google: language === 'zh' ? '使用 Google 登录' : 'Continue with Google',
    github: language === 'zh' ? '使用 GitHub 登录' : 'Continue with GitHub',
    desc: language === 'zh' ? '管理员可管理数据，访客仅可浏览。' : 'Admins can manage data, guests can only view.',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">{t.title}</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-slate-400 text-sm mb-6">{t.desc}</p>

        <div className="space-y-3">
          <button
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white text-slate-900 rounded-xl font-semibold hover:bg-slate-100 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            {t.google}
          </button>

          <button
            onClick={signInWithGithub}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-[#24292e] text-white rounded-xl font-semibold hover:bg-[#2f363d] transition-colors"
          >
            <Github className="w-5 h-5" />
            {t.github}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginModal;
