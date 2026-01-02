
import React, { useEffect, useState } from 'react';
import { SavedComparison } from '../types';
import { listSavedComparisons } from '../services/geminiService';
import { X, Calendar, Database, Search, Loader2, Plus, Lock, Star, Flame } from 'lucide-react';

interface ArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (key: string) => void;
  onCreate: (query: string) => void;
  isAdmin: boolean;
  mode?: 'all' | 'favorites' | 'popular'; 
  favoriteKeys?: string[];    
  items?: SavedComparison[]; 
}

const ArchiveModal: React.FC<ArchiveModalProps> = ({ 
    isOpen, onClose, onSelect, onCreate, isAdmin, 
    mode = 'all', favoriteKeys = [], items: externalItems 
}) => {
  const [internalItems, setInternalItems] = useState<SavedComparison[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState('');

  // Use externally provided items if available, otherwise use internally fetched ones
  const effectiveItems = externalItems || internalItems;

  const t = {
    titleAll: '云端资料库',
    titleFav: '我的收藏',
    titlePopular: '热门对比 Top 10',
    searchPlaceholder: '搜索...',
    empty: '暂无匹配记录',
    loading: '正在加载列表...',
    generatedOn: '生成于',
    create: '创建',
    createNew: '生成新对比',
    createPrompt: '未找到相关记录。管理员可创建新对比。',
    createPromptGuest: '未找到相关记录。请联系管理员添加。',
  };

  useEffect(() => {
    if (isOpen && !externalItems) {
      loadItems();
    }
  }, [isOpen, externalItems]);

  const loadItems = async () => {
    setIsLoading(true);
    try {
      const data = await listSavedComparisons('zh');
      setInternalItems(data);
    } catch (error) {
      console.error("Failed to load archive", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getDisplayTitle = (item: SavedComparison) => {
    let title = item.titleZh || item.titleEn || item.displayName || item.filename;
    title = title.replace(/[\(\（\s]*\d{4}\s*-\s*\d{4}[\)\）\s]*/g, '');
    title = title.replace(/[\(\（]\s*[\)\）]/g, '');
    return title.trim();
  };

  // Base list depending on mode
  let baseItems = effectiveItems;
  if (mode === 'favorites') {
      baseItems = effectiveItems.filter(item => favoriteKeys.includes(item.key));
  } else if (mode === 'popular') {
      // Sort by popularity explicitly
      baseItems = [...effectiveItems].sort((a, b) => (b.favoriteCount || 0) - (a.favoriteCount || 0)).slice(0, 10);
  }

  const filteredItems = baseItems.filter(item => {
    const term = filter.toLowerCase().trim();
    if (!term) return true;
    const displayTitle = getDisplayTitle(item).toLowerCase();
    if (displayTitle.includes(term)) return true;
    if (item.titleZh && item.titleZh.toLowerCase().includes(term)) return true;
    if (item.titleEn && item.titleEn.toLowerCase().includes(term)) return true;
    if (item.filename.toLowerCase().includes(term)) return true;
    return false;
  });

  const handleCreate = () => {
      if (filter.trim() && isAdmin) {
          onCreate(filter);
      }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
          if (filteredItems.length === 0 && filter.trim() && isAdmin && mode === 'all') {
              handleCreate();
          }
      }
  };

  const getTitle = () => {
      if (mode === 'favorites') return t.titleFav;
      if (mode === 'popular') return t.titlePopular;
      return t.titleAll;
  };

  const getIcon = () => {
      if (mode === 'favorites') return <Star className="w-5 h-5 text-amber-400 fill-current" />;
      if (mode === 'popular') return <Flame className="w-5 h-5 text-orange-500 fill-current" />;
      return <Database className="w-5 h-5 text-indigo-400" />;
  };

  const getBgClass = () => {
      if (mode === 'favorites') return 'bg-amber-500/10';
      if (mode === 'popular') return 'bg-orange-500/10';
      return 'bg-indigo-500/10';
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl h-[80vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${getBgClass()}`}>
                {getIcon()}
            </div>
            <h2 className="text-xl font-bold text-white">{getTitle()}</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex gap-2 shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder={t.searchPlaceholder}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full bg-slate-800 text-slate-200 pl-9 pr-10 py-2.5 rounded-lg border border-slate-700 focus:outline-none focus:border-indigo-500 text-sm placeholder-slate-500"
              autoFocus
            />
            {filter && (
                <button
                  onClick={() => setFilter('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-200 bg-transparent hover:bg-slate-700/50 rounded-full transition-all"
                  title="清除搜索"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
            )}
          </div>
          {/* Only show Create button in 'All' mode */}
          {isAdmin && mode === 'all' && (
              <button
                onClick={handleCreate}
                disabled={!filter.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-lg text-sm font-medium transition-colors border border-transparent disabled:border-slate-700"
              >
                <Plus className="w-4 h-4" />
                <span>{t.create}</span>
              </button>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-2">
          {isLoading && !externalItems ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              <p className="text-sm">{t.loading}</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-500 p-6 text-center">
              {filter.trim() && mode === 'all' ? (
                <>
                    {isAdmin ? (
                        <>
                            <div className="p-4 bg-indigo-500/10 rounded-full">
                                <Search className="w-8 h-8 text-indigo-400" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-slate-300 font-medium">{t.createPrompt}</p>
                                <p className="text-xs text-slate-500">"{filter}"</p>
                            </div>
                            <button 
                                onClick={handleCreate}
                                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-all shadow-lg hover:shadow-indigo-500/20"
                            >
                                <Plus className="w-4 h-4" />
                                {t.createNew}
                            </button>
                        </>
                    ) : (
                        <>
                            <div className="p-4 bg-slate-800 rounded-full">
                                <Lock className="w-8 h-8 text-slate-500" />
                            </div>
                            <p className="text-slate-400">{t.createPromptGuest}</p>
                        </>
                    )}
                </>
              ) : (
                <>
                    {mode === 'favorites' ? (
                        <Star className="w-12 h-12 opacity-20 text-amber-500" />
                    ) : mode === 'popular' ? (
                        <Flame className="w-12 h-12 opacity-20 text-orange-500" />
                    ) : (
                        <Database className="w-12 h-12 opacity-20" />
                    )}
                    <p>{t.empty}</p>
                </>
              )}
            </div>
          ) : (
            <div className="grid gap-2">
              {filteredItems.map((item, index) => (
                <div
                  key={item.key}
                  onClick={() => onSelect(item.key)}
                  className="flex items-center justify-between p-4 rounded-xl hover:bg-slate-800 border border-transparent hover:border-slate-700 transition-all group text-left cursor-pointer"
                >
                  <div className="flex-1 min-w-0 pr-8">
                     <div className="flex items-center gap-3">
                        {mode === 'popular' && (
                            <span className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded ${index < 3 ? 'bg-orange-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
                                {index + 1}
                            </span>
                        )}
                        <h3 className="font-medium text-slate-200 truncate group-hover:text-indigo-400 transition-colors">
                            {getDisplayTitle(item)}
                        </h3>
                     </div>
                    {item.lastModified && (
                        <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500 ml-0">
                            <Calendar className="w-3 h-3" />
                            <span>{t.generatedOn} {new Date(item.lastModified).toLocaleDateString()}</span>
                        </div>
                    )}
                  </div>
                  {mode === 'all' && favoriteKeys.includes(item.key) && (
                      <Star className="w-4 h-4 text-amber-500/50 fill-current" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ArchiveModal;