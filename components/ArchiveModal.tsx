import React, { useEffect, useState } from 'react';
import { SavedComparison, Language } from '../types';
import { listSavedComparisons } from '../services/geminiService';
import { X, Calendar, Database, Search, Loader2, Plus } from 'lucide-react';

interface ArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (key: string) => void;
  onCreate: (query: string) => void; // New prop for creation
  language: Language;
}

const ArchiveModal: React.FC<ArchiveModalProps> = ({ isOpen, onClose, onSelect, onCreate, language }) => {
  const [items, setItems] = useState<SavedComparison[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState('');

  const t = {
    title: language === 'zh' ? '云端资料库' : 'Cloud Library',
    searchPlaceholder: language === 'zh' ? '搜索或创建新对比...' : 'Search or create new...',
    empty: language === 'zh' ? '暂无匹配记录' : 'No matching records',
    loading: language === 'zh' ? '正在加载列表...' : 'Loading library...',
    generatedOn: language === 'zh' ? '生成于' : 'Generated on',
    create: language === 'zh' ? '创建' : 'Create',
    createNew: language === 'zh' ? '生成新对比' : 'Generate New',
    createPrompt: language === 'zh' ? '未找到相关记录。是否创建新的对比？' : 'No records found. Create a new comparison?',
  };

  useEffect(() => {
    if (isOpen) {
      loadItems();
    }
  }, [isOpen, language]);

  const loadItems = async () => {
    setIsLoading(true);
    try {
      const data = await listSavedComparisons(language);
      setItems(data);
    } catch (error) {
      console.error("Failed to load archive", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to get the correct display title based on language
  // Also proactively strips year ranges like (1945-2024) if they exist in legacy data
  const getDisplayTitle = (item: SavedComparison) => {
    let title = item.displayName || item.filename;
    
    if (language === 'zh' && item.titleZh) {
        title = item.titleZh;
    } else if (language === 'en' && item.titleEn) {
        title = item.titleEn;
    }

    // Strip year ranges (e.g., "1945-2024" or "(1945-2024)")
    title = title.replace(/[\(\（\s]*\d{4}\s*-\s*\d{4}[\)\）\s]*/g, '');
    
    // Strip empty parentheses like "()" or "（）" or "( )"
    title = title.replace(/[\(\（]\s*[\)\）]/g, '');
    
    return title.trim();
  };

  const filteredItems = items.filter(item => {
    const term = filter.toLowerCase().trim();
    if (!term) return true;

    // Search Strategies:
    // 1. Check currently displayed title
    const displayTitle = getDisplayTitle(item).toLowerCase();
    if (displayTitle.includes(term)) return true;

    // 2. Check hidden language titles (e.g. search "收入" when title is "Disposable Income")
    if (item.titleZh && item.titleZh.toLowerCase().includes(term)) return true;
    if (item.titleEn && item.titleEn.toLowerCase().includes(term)) return true;
    
    // 3. Check filename as last resort
    if (item.filename.toLowerCase().includes(term)) return true;

    return false;
  });

  const handleCreate = () => {
      if (filter.trim()) {
          onCreate(filter);
      }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
          // If there is exactly one match, maybe select it? 
          // But usually Enter in a search bar acts as "Go".
          // If items are filtered, we could just let them select.
          // But if they want to create, they can click Create.
          // Standard UX: If no items, Enter -> Create.
          if (filteredItems.length === 0 && filter.trim()) {
              handleCreate();
          }
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg">
                <Database className="w-5 h-5 text-indigo-400" />
            </div>
            <h2 className="text-xl font-bold text-white">{t.title}</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar with Create Button */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder={t.searchPlaceholder}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full bg-slate-800 text-slate-200 pl-9 pr-4 py-2.5 rounded-lg border border-slate-700 focus:outline-none focus:border-indigo-500 text-sm placeholder-slate-500"
              autoFocus
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={!filter.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-lg text-sm font-medium transition-colors border border-transparent disabled:border-slate-700"
          >
            <Plus className="w-4 h-4" />
            <span>{t.create}</span>
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-2">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              <p className="text-sm">{t.loading}</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4 text-slate-500 p-6 text-center">
              {filter.trim() ? (
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
                    <Database className="w-12 h-12 opacity-20" />
                    <p>{t.empty}</p>
                </>
              )}
            </div>
          ) : (
            <div className="grid gap-2">
              {filteredItems.map((item) => (
                <button
                  key={item.key}
                  onClick={() => onSelect(item.key)}
                  className="flex items-center justify-between p-4 rounded-xl hover:bg-slate-800 border border-transparent hover:border-slate-700 transition-all group text-left"
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-slate-200 truncate group-hover:text-indigo-400 transition-colors">
                      {getDisplayTitle(item)}
                    </h3>
                    {item.lastModified && (
                        <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
                            <Calendar className="w-3 h-3" />
                            <span>{t.generatedOn} {new Date(item.lastModified).toLocaleDateString()}</span>
                        </div>
                    )}
                  </div>
                  <div className="ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                     <span className="text-xs font-medium text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded">Open</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ArchiveModal;