
import React, { useState, useEffect, useMemo } from 'react';
import { fetchComparisonData, fetchSavedComparisonByKey, listSavedComparisons, deleteComparison, saveEditedComparison } from './services/geminiService';
import { supabase, isUserAdmin, signOut, getFavorites, addFavorite, removeFavorite, getGlobalFavoriteCounts } from './services/supabase';
import { ComparisonResponse, SavedComparison, CATEGORY_MAP, CATEGORY_COLOR_MAP } from './types';
import ChartSection from './components/ChartSection';
import AnalysisPanel from './components/AnalysisPanel';
import ArchiveModal from './components/ArchiveModal';
import LoginModal from './components/LoginModal';
import EditModal from './components/EditModal';
import { Globe, Menu, X, Database, Star, BarChart3, Loader2, LogIn, LogOut, User, FolderHeart, Clock, ArrowRight, Home, List, LayoutGrid, Calendar, Plus, Filter, Flame, ChevronLeft, ChevronRight } from 'lucide-react';

const getCategoryLabel = (cat: string) => CATEGORY_MAP[cat] || cat;
const getCategoryStyle = (cat: string) => CATEGORY_COLOR_MAP[cat] || 'bg-slate-700/50 text-slate-400 border-slate-600/50';

const ITEMS_PER_PAGE = 12;

const App: React.FC = () => {
  // Hardcoded to Chinese for this version as requested
  const language = 'zh';

  const [viewMode, setViewMode] = useState<'chart' | 'list'>('list');
  const [data, setData] = useState<ComparisonResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeItemKey, setActiveItemKey] = useState<string>('');
  const [currentQuery, setCurrentQuery] = useState<string>('');
  
  // Data for Sidebar (Favorites now) and Archive
  const [allLibraryItems, setAllLibraryItems] = useState<SavedComparison[]>([]);
  const [favoriteKeys, setFavoriteKeys] = useState<string[]>([]);
  const [isLibraryLoading, setIsLibraryLoading] = useState(false);
  
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  
  // Filtering & Pagination State
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [currentPage, setCurrentPage] = useState<number>(1);
  
  // Modal States
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [archiveMode, setArchiveMode] = useState<'all' | 'favorites' | 'popular'>('all');
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  
  // Auth State
  const [user, setUser] = useState<any>(null);
  const isAdmin = isUserAdmin(user);


  const t = {
    title: '中美脉搏',
    favoritesTitle: '我的收藏',
    latestTitle: '最近更新', // Changed to Recent Updates
    noItems: '暂无收藏',
    noItemsGuest: '登录以收藏对比',
    poweredBy: '由 Gemini 3 Pro 驱动',
    loadingTitle: '正在分析历史数据...',
    loadingSub: '正在收集关于中美对比的见解',
    errorTitle: '错误',
    retry: '重试',
    errorGeneric: '生成数据失败。',
    cloudLibraryAdmin: '搜索云端 / 创建新对比',
    cloudLibraryGuest: '搜索云端资料库',
    login: '登录账户',
    logout: '退出登录',
    guest: '访客',
    admin: '管理员',
    standardUser: '普通用户',
    permissionDenied: '权限拒绝：仅管理员可创建新对比。',
    deleteSuccess: '删除成功',
    deleteFail: '删除失败',
    showMore: '查看全部',
    backHome: '返回主页',
    homeTitle: '所有对比档案',
    category: '分类',
    lastUpdated: '更新于',
    createNewCard: '创建新对比',
    all: '全部',
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch all items from R2 (metadata) and User's favorites
  const loadLibraryAndFavorites = async () => {
    setIsLibraryLoading(true);
    try {
      // Parallel fetch items and global favorites
      const [items, globalCounts] = await Promise.all([
          listSavedComparisons(language),
          getGlobalFavoriteCounts()
      ]);

      // Merge counts
      const itemsWithCounts = items.map(item => ({
          ...item,
          favoriteCount: globalCounts[item.key] || 0
      }));

      // Sort: Recent Date First (Newest at top)
      itemsWithCounts.sort((a, b) => {
          return (b.lastModified?.getTime() || 0) - (a.lastModified?.getTime() || 0);
      });

      setAllLibraryItems(itemsWithCounts);

      if (user) {
          const favs = await getFavorites(user.id);
          setFavoriteKeys(favs);
      } else {
          setFavoriteKeys([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLibraryLoading(false);
    }
  };

  useEffect(() => {
      loadLibraryAndFavorites();
  }, [user]); // Reload when user changes

  // Handle Initial Route
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const keyParam = params.get('key');
    const qParam = params.get('q');

    if (keyParam) {
        setViewMode('chart');
        loadSavedItem(keyParam);
    } else if (qParam) {
        setViewMode('chart');
        loadData(qParam);
    } else {
        setViewMode('list');
    }
    
    // Simple popstate handler for back button
    const handlePopState = () => {
        const p = new URLSearchParams(window.location.search);
        if (!p.get('key') && !p.get('q')) {
            setViewMode('list');
            setData(null);
        }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const goHome = (e?: React.MouseEvent) => {
      e?.preventDefault();
      setViewMode('list');
      setIsSidebarOpen(false);
      setData(null);
      setActiveItemKey('');
      if (typeof window !== 'undefined') {
          window.history.pushState({}, '', '/');
      }
  };

  const loadData = async (query: string, forceRefresh: boolean = false) => {
    setViewMode('chart');
    // If we are switching to a new query (creating new comparison), clear the data 
    if (query !== currentQuery) {
        setData(null);
    }

    if (typeof window !== 'undefined') {
        try {
            const url = new URL(window.location.href);
            url.searchParams.delete('key');
            url.searchParams.set('q', query);
            window.history.pushState({}, '', url.toString());
        } catch (e) {
            console.warn("Could not update URL history:", e);
        }
    }

    setLoading(true);
    setError(null);
    setSyncState('idle');
    setCurrentQuery(query);
    setActiveItemKey(''); 

    try {
      const { data, uploadPromise } = await fetchComparisonData(query, language, forceRefresh, isAdmin);
      setData(data);
      
      const safeTitle = (data.titleEn || data.title || 'untitled').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      const finalSafeTitle = safeTitle.length > 0 ? safeTitle : `comparison_${Date.now()}`;
      const derivedKey = `sino-pulse/v1/${finalSafeTitle}.json`;
      setActiveItemKey(derivedKey);

      const updateUrlToKey = () => {
         if (typeof window !== 'undefined') {
            try {
                const url = new URL(window.location.href);
                if (url.searchParams.has('q')) {
                    url.searchParams.delete('q');
                    url.searchParams.set('key', derivedKey);
                    window.history.replaceState({}, '', url.toString());
                }
            } catch (e) { console.warn("URL key update failed", e); }
         }
      };

      if (data.source === 'r2') {
          updateUrlToKey();
      } else if (data.source === 'api' && uploadPromise) {
          setSyncState('syncing');
          uploadPromise.then(() => {
              setSyncState('success');
              // Update local data source to r2 so UI shows "Archived"
              setData(prev => {
                  if (prev && prev.titleEn === data.titleEn) {
                      return { ...prev, source: 'r2' };
                  }
                  return prev;
              });
              loadLibraryAndFavorites(); 
              updateUrlToKey();
          }).catch(() => setSyncState('error'));
      }
    } catch (err: any) {
      if (err.code === 'PERMISSION_DENIED') {
          setError(t.permissionDenied);
      } else {
          setError(`${t.errorGeneric} [${err.status || err.code || 'ERR'}]`);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadSavedItem = async (key: string) => {
      // If clicking the currently active item, do nothing
      if (key === activeItemKey && data && viewMode === 'chart') return;

      setViewMode('chart');
      setIsArchiveOpen(false);
      setIsSidebarOpen(false);
      setActiveItemKey(key);
      
      if (typeof window !== 'undefined') {
        try {
            const url = new URL(window.location.href);
            url.searchParams.delete('q');
            url.searchParams.set('key', key);
            window.history.pushState({}, '', url.toString());
        } catch (e) {
            console.warn("Could not update URL history:", e);
        }
      }
      
      setData(null);
      setLoading(true);
      setError(null);
      setSyncState('idle'); 
      try {
          const data = await fetchSavedComparisonByKey(key);
          setData(data);
          setCurrentQuery(data.titleEn || data.title); 
      } catch (err: any) {
          setError("Failed to load saved item.");
      } finally {
          setLoading(false);
      }
  };

  const handleCreateFromArchive = (query: string) => {
      setIsArchiveOpen(false); 
      setIsSidebarOpen(false); 
      loadData(query, true);         
  };

  const handleRefresh = () => {
      if (currentQuery) {
          loadData(currentQuery, true);
      } else if (data) {
          loadData(data.titleEn || data.title, true);
      }
  };

  const handleDelete = async () => {
      if (!data || !activeItemKey) return;
      // Removed confirmation per request
      
      try {
          // Close modal first if open (though logic handles this by unmounting)
          setIsEditOpen(false);
          await deleteComparison(activeItemKey);
          await loadLibraryAndFavorites();
          goHome();
      } catch (e) {
          alert(t.deleteFail);
      }
  };

  const handleToggleFavorite = async () => {
      if (!user || !activeItemKey) return;
      
      const isFav = favoriteKeys.includes(activeItemKey);
      try {
          if (isFav) {
              await removeFavorite(user.id, activeItemKey);
              setFavoriteKeys(prev => prev.filter(k => k !== activeItemKey));
          } else {
              await addFavorite(user.id, activeItemKey);
              setFavoriteKeys(prev => [...prev, activeItemKey]);
          }
          // Refresh list to update popularity immediately
          loadLibraryAndFavorites();
      } catch (e) {
          console.error("Favorite toggle failed", e);
      }
  };

  const handleEditSave = async (updatedData: ComparisonResponse) => {
      if (!activeItemKey) return;
      try {
          await saveEditedComparison(activeItemKey, updatedData);
          setData(updatedData); // Update local view
          await loadLibraryAndFavorites(); // Refresh titles in sidebar
      } catch (e) {
          throw e; // Modal handles error display
      }
  };

  const openArchive = (mode: 'all' | 'favorites' | 'popular') => {
      setArchiveMode(mode);
      setIsArchiveOpen(true);
  };

  // Derive categories
  const categories = useMemo(() => {
    const cats = new Set(allLibraryItems.map(item => item.category || 'Custom'));
    return ['All', ...Array.from(cats).sort()];
  }, [allLibraryItems]);

  // Handle pagination reset when category changes
  useEffect(() => {
      setCurrentPage(1);
  }, [selectedCategory]);

  // Derive filtered items for grid
  const filteredLibraryItems = useMemo(() => {
    if (selectedCategory === 'All') return allLibraryItems;
    return allLibraryItems.filter(item => (item.category || 'Custom') === selectedCategory);
  }, [allLibraryItems, selectedCategory]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredLibraryItems.length / ITEMS_PER_PAGE);
  const paginatedItems = useMemo(() => {
      const start = (currentPage - 1) * ITEMS_PER_PAGE;
      return filteredLibraryItems.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredLibraryItems, currentPage]);

  const handlePageChange = (newPage: number) => {
      if (newPage >= 1 && newPage <= totalPages) {
          setCurrentPage(newPage);
          // Scroll to top of grid
          const gridTop = document.getElementById('grid-container');
          if (gridTop) gridTop.scrollIntoView({ behavior: 'smooth' });
      }
  };

  // Logic to determine Previous and Next items relative to the current active item
  const { prevItem, nextItem } = useMemo(() => {
    if (!activeItemKey || allLibraryItems.length === 0) return { prevItem: null, nextItem: null };
    
    // Find index of current item in the *full* sorted list
    // Note: allLibraryItems is sorted Newest -> Oldest (Index 0 is newest)
    const index = allLibraryItems.findIndex(item => item.key === activeItemKey);
    
    if (index === -1) return { prevItem: null, nextItem: null };

    // "Previous" in the list (array index - 1) is physically "above" or "newer"
    const prev = index > 0 ? allLibraryItems[index - 1] : null;
    
    // "Next" in the list (array index + 1) is physically "below" or "older"
    const next = index < allLibraryItems.length - 1 ? allLibraryItems[index + 1] : null;

    return { prevItem: prev, nextItem: next };
  }, [activeItemKey, allLibraryItems]);


  // Derive display list for sidebar
  const favoriteItems = allLibraryItems.filter(item => favoriteKeys.includes(item.key));
  // Display only 3 items initially
  const displayedFavorites = favoriteItems.slice(0, 3);
  // Display only 3 items initially for sidebar list (Popular)
  const displayedLatest = allLibraryItems.slice(0, 3);

  const renderSkeleton = () => (
    <div className="max-w-6xl mx-auto space-y-8 animate-pulse">
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-2xl h-[500px] relative overflow-hidden flex flex-col">
            <div className="absolute inset-0 flex items-center justify-center z-10">
                <div className="bg-slate-900/80 backdrop-blur px-6 py-3 rounded-xl border border-indigo-500/30 shadow-2xl flex items-center gap-3">
                   <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                   <div className="flex flex-col">
                      <span className="text-indigo-200 font-medium tracking-wide text-sm">{t.loadingTitle}</span>
                      <span className="text-slate-400 text-xs">{t.loadingSub}</span>
                   </div>
                </div>
            </div>
        </div>
    </div>
  );

  const renderUserSection = (isMobile: boolean) => {
    if (user) {
        return (
            <div className={`flex items-center ${isMobile ? 'justify-between w-full p-2 bg-slate-800/50 border border-slate-700 rounded-lg' : 'gap-4'}`}>
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className={`flex items-center justify-center rounded-full bg-indigo-500 text-white ${isMobile ? 'w-8 h-8 p-1.5' : 'w-8 h-8'}`}>
                        <User className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col min-w-0 text-left">
                        <span className="text-xs font-medium text-slate-200 truncate max-w-[120px]">{user.email}</span>
                        <span className="text-[10px] text-indigo-400 font-bold uppercase">{isAdmin ? t.admin : t.standardUser}</span>
                    </div>
                </div>
                <button onClick={signOut} className={`text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors ${isMobile ? 'p-1.5' : 'p-2'}`} title={t.logout}>
                    <LogOut className="w-4 h-4" />
                </button>
            </div>
        );
    } else {
        return (
            <button 
                onClick={() => setIsLoginOpen(true)}
                className={`flex items-center justify-center gap-2 font-semibold text-slate-200 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors shadow-lg ${isMobile ? 'w-full px-3 py-2 text-sm' : 'px-4 py-2 text-sm'}`}
            >
                <LogIn className="w-4 h-4" />
                {t.login}
            </button>
        );
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-900 text-slate-100">
      <ArchiveModal 
        isOpen={isArchiveOpen} 
        onClose={() => setIsArchiveOpen(false)} 
        onSelect={loadSavedItem} 
        onCreate={handleCreateFromArchive} 
        isAdmin={isAdmin}
        mode={archiveMode}
        favoriteKeys={favoriteKeys}
        items={allLibraryItems}
      />
      
      <LoginModal 
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
      />

      {data && (
          <EditModal 
            isOpen={isEditOpen}
            onClose={() => setIsEditOpen(false)}
            data={data}
            onSave={handleEditSave}
            onDelete={handleDelete}
          />
      )}

      {isSidebarOpen && <div className="fixed inset-0 bg-black/60 z-20 lg:hidden backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />}
      
      <aside className={`fixed lg:static inset-y-0 left-0 z-30 w-72 bg-slate-900 border-r border-slate-800 transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} flex flex-col`}>
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
            <a href="/" onClick={goHome} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                <div className="p-2 bg-indigo-600 rounded-lg"><Globe className="w-6 h-6 text-white" /></div>
                <span className="text-xl font-bold tracking-tight text-white">{t.title}</span>
            </a>
        </div>
        
        <div className="p-4 space-y-2">
            <button onClick={() => openArchive('all')} className="w-full flex items-center gap-3 px-4 py-4 rounded-xl text-sm font-semibold transition-all text-left text-slate-200 bg-slate-800 border border-slate-700 hover:bg-slate-700 shadow-lg">
                <Database className="w-5 h-5 text-emerald-400" /> 
                <span className="truncate flex-1">{isAdmin ? t.cloudLibraryAdmin : t.cloudLibraryGuest}</span>
            </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          
          {/* Favorites Section */}
          <div className="mb-6">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-4 mt-2 px-2 flex justify-between items-center">{t.favoritesTitle} <FolderHeart className="w-3 h-3 text-slate-600" /></h3>
            
            {!user && (
                <div className="px-2 py-4 text-center bg-slate-800/30 rounded-lg border border-slate-800/50 mx-2">
                    <p className="text-xs text-slate-500 italic mb-2">{t.noItemsGuest}</p>
                    <button onClick={() => setIsLoginOpen(true)} className="text-xs text-indigo-400 hover:text-indigo-300 font-medium">立即登录</button>
                </div>
            )}

            {user && isLibraryLoading && favoriteItems.length === 0 ? (
               <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-slate-600" /></div>
            ) : user && favoriteItems.length === 0 ? (
               <div className="px-2 py-4 text-xs text-slate-600 italic text-center">{t.noItems}</div>
            ) : (
              <div className="space-y-1">
                {displayedFavorites.map((item) => {
                    const isActive = activeItemKey === item.key;
                    const displayTitle = item.titleZh || item.titleEn || item.filename;
                    const cleanTitle = displayTitle.replace(/[\(\（\s]*\d{4}\s*-\s*\d{4}[\)\）\s]*/g, '').replace(/[\(\（]\s*[\)\）]/g, '').trim();
                    return <button key={item.key} onClick={() => loadSavedItem(item.key)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left ${isActive ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-600/20' : 'text-slate-400 hover:bg-slate-800'}`}><BarChart3 className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-400' : 'text-slate-500'}`} /> <span className="truncate flex-1">{cleanTitle}</span></button>;
                })}
                {favoriteItems.length > 3 && (
                    <button 
                        onClick={() => openArchive('favorites')}
                        className="w-full flex items-center gap-2 mt-1 px-3 py-2 text-xs text-indigo-400 hover:text-indigo-300 transition-colors group"
                    >
                        <span>{t.showMore}</span>
                        <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                )}
              </div>
            )}
          </div>

          {/* Recent Updates (formerly Latest) Items Section */}
          <div className="pt-4 border-t border-slate-800/50">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-4 mt-4 px-2 flex justify-between items-center">{t.latestTitle} <Clock className="w-3 h-3 text-slate-600" /></h3>
            
            {isLibraryLoading && allLibraryItems.length === 0 ? (
                 <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-slate-600" /></div>
            ) : allLibraryItems.length === 0 ? (
                 <div className="px-2 py-4 text-xs text-slate-600 italic text-center">暂无历史记录</div>
            ) : (
                <div className="space-y-1">
                    {displayedLatest.map((item) => {
                        const isActive = activeItemKey === item.key;
                        const displayTitle = item.titleZh || item.titleEn || item.filename;
                        const cleanTitle = displayTitle.replace(/[\(\（\s]*\d{4}\s*-\s*\d{4}[\)\）\s]*/g, '').replace(/[\(\（]\s*[\)\）]/g, '').trim();
                        
                        return (
                            <button 
                                key={`latest-${item.key}`} 
                                onClick={() => loadSavedItem(item.key)} 
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left group ${
                                    isActive ? 'bg-slate-800 text-indigo-400 border border-slate-700 shadow-sm' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent'
                                }`}
                            >
                                <div className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors ${isActive ? 'bg-indigo-500' : 'bg-slate-700 group-hover:bg-slate-500'}`}></div>
                                <span className="truncate flex-1">{cleanTitle}</span>
                            </button>
                        );
                    })}
                    {allLibraryItems.length > 3 && (
                        <button 
                            onClick={() => openArchive('all')}
                            className="w-full flex items-center gap-2 mt-1 px-3 py-2 text-xs text-indigo-400 hover:text-indigo-300 transition-colors group"
                        >
                            <span>{t.showMore}</span>
                            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                        </button>
                    )}
                </div>
            )}
          </div>

        </nav>
        
        {/* User / Login Section - Mobile Only in Sidebar */}
        <div className="p-4 border-t border-slate-800 z-10 bg-slate-900">
            <div className="lg:hidden mb-4">
                {renderUserSection(true)}
            </div>
            <div className="text-center">
                <a href="https://324893.xyz" target="_blank" rel="noopener noreferrer" className="text-[10px] text-slate-600 hover:text-indigo-400 uppercase tracking-widest transition-colors">
                    324893.xyz
                </a>
            </div>
        </div>
      </aside>
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Mobile Header */}
        <header className="lg:hidden h-16 border-b border-slate-800 flex items-center px-4 justify-between bg-slate-900/90 backdrop-blur">
          <a href="/" onClick={goHome} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <Globe className="w-6 h-6 text-indigo-500" /><span className="font-bold">{t.title}</span>
          </a>
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-400">{isSidebarOpen ? <X /> : <Menu />}</button>
        </header>

        {viewMode === 'list' ? (
             <div className="flex flex-col h-full overflow-hidden">
                {/* Fixed Header Section for List View */}
                <div id="grid-container" className="shrink-0 px-4 pt-4 md:px-8 md:pt-8 bg-slate-900 z-10 border-b border-slate-800/30 pb-2">
                    <div className="max-w-7xl mx-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                                <LayoutGrid className="w-6 h-6 text-indigo-400" />
                                {t.homeTitle}
                            </h1>
                            
                            {/* User Section (Desktop Only) */}
                            <div className="hidden lg:block">
                                {renderUserSection(false)}
                            </div>
                        </div>

                        {/* Category Filters */}
                        <div className="mb-2 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                            <div className="flex items-center gap-2 px-1">
                                <Filter className="w-4 h-4 text-slate-500 mr-2" />
                                {categories.map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => setSelectedCategory(cat)}
                                        className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border ${
                                            selectedCategory === cat 
                                            ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-500/20' 
                                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-200'
                                        }`}
                                    >
                                        {cat === 'All' ? t.all : getCategoryLabel(cat)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Scrollable Content Section for List View */}
                <div className="flex-1 overflow-y-auto px-4 md:px-8 pb-8 scroll-smooth pt-4">
                    <div className="max-w-7xl mx-auto flex flex-col min-h-full">
                        {isLibraryLoading && allLibraryItems.length === 0 ? (
                            <div className="flex items-center justify-center h-64">
                                <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
                            </div>
                        ) : filteredLibraryItems.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-64 text-slate-500 border border-dashed border-slate-700 rounded-2xl bg-slate-800/30">
                                <Filter className="w-10 h-10 mb-3 opacity-30" />
                                <p>该分类下暂无对比档案</p>
                                <button 
                                    onClick={() => setSelectedCategory('All')} 
                                    className="mt-3 text-indigo-400 hover:text-indigo-300 text-sm font-medium"
                                >
                                    查看全部
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="flex flex-col gap-4 mb-8">
                                    {paginatedItems.map(item => {
                                        const displayTitle = item.titleZh || item.titleEn || item.filename;
                                        const cleanTitle = displayTitle.replace(/[\(\（\s]*\d{4}\s*-\s*\d{4}[\)\）\s]*/g, '').replace(/[\(\（]\s*[\)\）]/g, '').trim();
                                        const isFav = favoriteKeys.includes(item.key);
                                        
                                        return (
                                            <div 
                                                key={item.key}
                                                onClick={() => loadSavedItem(item.key)}
                                                className="group bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-indigo-500/50 rounded-xl p-5 md:p-6 cursor-pointer transition-all hover:shadow-xl hover:shadow-indigo-900/10 flex flex-col md:flex-row items-start md:items-center gap-4 relative overflow-hidden"
                                            >
                                                {/* Left Content: Title and Meta */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2.5 mb-2">
                                                        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-md tracking-wider border ${getCategoryStyle(item.category || 'Custom')}`}>
                                                            {getCategoryLabel(item.category || 'Custom')}
                                                        </span>
                                                        <span className="flex items-center gap-1 text-[10px] text-slate-500">
                                                            <Calendar className="w-3 h-3" />
                                                            {item.lastModified?.toLocaleDateString()}
                                                        </span>
                                                    </div>

                                                    <h3 className="text-lg md:text-xl font-bold text-slate-200 group-hover:text-white leading-snug mb-3">
                                                        {cleanTitle}
                                                    </h3>

                                                    {/* Summary - Prominent display */}
                                                    {item.summary && (
                                                        <p className="text-sm text-slate-400 leading-relaxed max-w-4xl line-clamp-2 md:line-clamp-2">
                                                            {item.summary}
                                                        </p>
                                                    )}
                                                </div>

                                                {/* Right Action/Status */}
                                                <div className="flex items-center gap-4 md:pl-6 md:border-l border-slate-700/50 shrink-0 self-end md:self-center">
                                                     {isFav && <Star className="w-5 h-5 text-amber-500 fill-current" />}
                                                     <div className="p-2 rounded-full bg-slate-700/30 group-hover:bg-indigo-600 group-hover:text-white transition-colors text-slate-500">
                                                        <ArrowRight className="w-5 h-5" />
                                                     </div>
                                                </div>
                                                
                                                {/* Subtle hover effect background */}
                                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Pagination Controls */}
                                {totalPages > 1 && (
                                    <div className="mt-auto flex justify-center pb-8">
                                        <div className="flex items-center gap-2 bg-slate-800 p-1.5 rounded-xl border border-slate-700 shadow-lg">
                                            <button
                                                onClick={() => handlePageChange(currentPage - 1)}
                                                disabled={currentPage === 1}
                                                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
                                            >
                                                <ChevronLeft className="w-5 h-5" />
                                            </button>
                                            
                                            <span className="text-sm font-medium text-slate-300 px-3 min-w-[80px] text-center">
                                                Page {currentPage} / {totalPages}
                                            </span>

                                            <button
                                                onClick={() => handlePageChange(currentPage + 1)}
                                                disabled={currentPage === totalPages}
                                                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
                                            >
                                                <ChevronRight className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
             </div>
          ) : (
              /* Chart Mode Layout */
              <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth">
                 <div className="max-w-7xl mx-auto">
                    {loading && !data ? renderSkeleton() : error ? <div className="flex items-center justify-center h-full text-red-400"><div className="text-center max-w-md"><p className="text-lg font-semibold mb-2">{t.errorTitle}</p><p className="font-mono text-sm bg-red-950/50 border border-red-900/50 px-3 py-2 rounded mb-4 break-words">{error}</p>
                    {error !== t.permissionDenied && <button onClick={() => loadData('GDP (Gross Domestic Product) in USD from 1945 to 2024')} className="mt-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition-colors text-slate-200 font-medium">{t.retry}</button>}
                    {error === t.permissionDenied && !user && <button onClick={() => setIsLoginOpen(true)} className="mt-2 px-4 py-2 bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors text-white font-medium">{t.login}</button>}
                    </div></div> : data ? <div className="space-y-8"><div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-2xl h-auto md:h-[550px] relative overflow-hidden flex flex-col">
                        <ChartSection 
                            data={data} 
                            onRefresh={handleRefresh} 
                            isLoading={loading} 
                            syncState={syncState} 
                            isAdmin={isAdmin}
                            onDelete={handleDelete} 
                            onEdit={() => setIsEditOpen(true)}
                            isFavorite={user && activeItemKey ? favoriteKeys.includes(activeItemKey) : false}
                            onToggleFavorite={handleToggleFavorite}
                            isLoggedIn={!!user}
                            onLoginRequest={() => setIsLoginOpen(true)}
                            prevItem={prevItem || undefined}
                            nextItem={nextItem || undefined}
                            onNavigate={loadSavedItem}
                        />
                        </div><AnalysisPanel data={data} /></div> : null}
                 </div>
              </div>
          )}
      </main>
    </div>
  );
};

export default App;