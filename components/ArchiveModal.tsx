import React, { useEffect, useState } from 'react';
import { SavedComparison, Language } from '../types';
import { listSavedComparisons } from '../services/geminiService';
import { X, Calendar, Database, Search, Loader2 } from 'lucide-react';

interface ArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (key: string) => void;
  language: Language;
}

const ArchiveModal: React.FC<ArchiveModalProps> = ({ isOpen, onClose, onSelect, language }) => {
  const [items, setItems] = useState<SavedComparison[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState('');

  const t = {
    title: language === 'zh' ? '云端资料库' : 'Cloud Library',
    searchPlaceholder: language === 'zh' ? '搜索已保存的对比...' : 'Search saved comparisons...',
    empty: language === 'zh' ? '暂无保存的记录' : 'No saved records found',
    loading: language === 'zh' ? '正在加载列表...' : 'Loading library...',
    generatedOn: language === 'zh' ? '生成于' : 'Generated on',
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
  const getDisplayTitle = (item: SavedComparison) => {
    if (language === 'zh' && item.titleZh) return item.titleZh;
    if (language === 'en' && item.titleEn) return item.titleEn;
    return item.displayName || item.filename;
  };

  const filteredItems = items.filter(item => {
    const displayTitle = getDisplayTitle(item);
    return displayTitle.toLowerCase().includes(filter.toLowerCase());
  });

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

        {/* Search Bar */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder={t.searchPlaceholder}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full bg-slate-800 text-slate-200 pl-9 pr-4 py-2.5 rounded-lg border border-slate-700 focus:outline-none focus:border-indigo-500 text-sm"
              autoFocus
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-2">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              <p className="text-sm">{t.loading}</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-slate-500">
              <Database className="w-12 h-12 opacity-20" />
              <p>{t.empty}</p>
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
