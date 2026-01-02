import React, { useState, useEffect } from 'react';
import { fetchComparisonData, fetchSavedComparisonByKey, listSavedComparisons, deleteComparison, saveEditedComparison } from './services/geminiService';
import { supabase, isUserAdmin, signOut, getFavorites, addFavorite, removeFavorite } from './services/supabase';
import { ComparisonResponse, PRESET_QUERIES, SavedComparison } from './types';
import ChartSection from './components/ChartSection';
import AnalysisPanel from './components/AnalysisPanel';
import ArchiveModal from './components/ArchiveModal';
import LoginModal from './components/LoginModal';
import EditModal from './components/EditModal';
import { Globe, Menu, X, Database, Star, BarChart3, Loader2, LogIn, LogOut, User, FolderHeart, Clock, ArrowRight } from 'lucide-react';

const App: React.FC = () => {
  // Hardcoded to Chinese for this version as requested
  const language = 'zh';

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
  
  // Modal States
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [archiveMode, setArchiveMode] = useState<'all' | 'favorites'>('all');
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  
  // Auth State
  const [user, setUser] = useState<any>(null);
  const isAdmin = isUserAdmin(user);


  const t = {
    title: '中美脉搏',
    favoritesTitle: '我的收藏',
    latestTitle: '最新对比',
    noItems: '暂无收藏',
    noItemsGuest: '登录以收藏对比',
    poweredBy: '由 Gemini 3 Pro 驱动',
    loadingTitle: '正在分析历史数据...',
    loadingSub: '正在收集关于中美对比的见解',
    errorTitle: '错误',
    retry: '重试',
    errorGeneric: '生成数据失败。',
    cloudLibrary: '搜索云端 / 创建新对比',
    login: '登录账户',
    logout: '退出登录',
    guest: '访客',
    admin: '管理员',
    permissionDenied: '权限拒绝：仅管理员可创建新对比。',
    deleteSuccess: '删除成功',
    deleteFail: '删除失败',
    showMore: '查看全部',
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
      const items = await listSavedComparisons(language);
      setAllLibraryItems(items);

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

  // Init Data based on URL or Default
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const keyParam = params.get('key');
    const qParam = params.get('q');

    if (keyParam) {
        loadSavedItem(keyParam);
    } else if (qParam) {
        loadData(qParam);
    } else {
        loadInitialData();
    }
  }, []);

  const loadInitialData = async () => {
      setLoading(true);
      try {
          // If there are library items, load the first one (most recent usually)
          // We need to fetch items first if not loaded, but since effect runs parallel, we do a quick fetch
          const items = await listSavedComparisons(language);
          if (items.length > 0) {
              await loadSavedItem(items[0].key);
          } else {
              await loadData(PRESET_QUERIES[0].query);
          }
      } catch (e) {
          await loadData(PRESET_QUERIES[0].query);
      } finally {
          setLoading(false);
      }
  };

  const loadData = async (query: string, forceRefresh: boolean = false) => {
    // If we are switching to a new query (creating new comparison), clear the data 
    // to show the full-page skeleton loader instead of the refresh spinner.
    if (query !== currentQuery) {
        setData(null);
    }

    // Update URL
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
    setActiveItemKey(''); // Reset key until we know it or save it

    try {
      const { data, uploadPromise } = await fetchComparisonData(query, language, forceRefresh, isAdmin);
      setData(data);
      
      // We set active item key if we can find it in the library logic, 
      // but if it's new it won't have a key immediately until we refetch library.
      const safeTitle = (data.titleEn || data.title || 'untitled').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      const derivedKey = `sino-pulse/v1/${safeTitle}.json`;
      setActiveItemKey(derivedKey);

      if (data.source === 'api' && uploadPromise) {
          setSyncState('syncing');
          uploadPromise.then(() => {
              setSyncState('success');
              loadLibraryAndFavorites(); // Refresh library
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
      if (key === activeItemKey && data) return;

      setIsArchiveOpen(false);
      setIsSidebarOpen(false);
      setActiveItemKey(key);
      
      // Update URL
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
      
      // Explicitly clear data to force the skeleton loader for context switches
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
      if (!window.confirm("确定要删除当前对比吗？此操作不可恢复。")) return;

      try {
          await deleteComparison(activeItemKey);
          await loadLibraryAndFavorites();
          // Reset to default or clear
          await loadInitialData();
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

  const openArchive = (mode: 'all' | 'favorites') => {
      setArchiveMode(mode);
      setIsArchiveOpen(true);
  };

  // Derive display list for sidebar
  const favoriteItems = allLibraryItems.filter(item => favoriteKeys.includes(item.key));
  // Display only 3 items initially
  const displayedFavorites = favoriteItems.slice(0, 3);

  // Latest items (limit to 20 total for data, display 3 for sidebar)
  const latestItems = allLibraryItems.slice(0, 20);
  const displayedLatest = latestItems.slice(0, 3);

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
          />
      )}

      {isSidebarOpen && <div className="fixed inset-0 bg-black/60 z-20 lg:hidden backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />}
      
      <aside className={`fixed lg:static inset-y-0 left-0 z-30 w-72 bg-slate-900 border-r border-slate-800 transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} flex flex-col`}>
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600 rounded-lg"><Globe className="w-6 h-6 text-white" /></div>
                <span className="text-xl font-bold tracking-tight text-white">{t.title}</span>
            </div>
        </div>
        
        <div className="p-4">
            <button onClick={() => openArchive('all')} className="w-full flex items-center gap-3 px-4 py-4 rounded-xl text-sm font-semibold transition-all text-left text-slate-200 bg-slate-800 border border-slate-700 hover:bg-slate-700 shadow-lg"><Database className="w-5 h-5 text-emerald-400" /> <span className="truncate flex-1">{t.cloudLibrary}</span></button>
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

          {/* Latest Section */}
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
                        const isFav = favoriteKeys.includes(item.key);
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
                                {isFav && <Star className="w-3 h-3 text-amber-500/40 fill-current shrink-0" />}
                            </button>
                        );
                    })}
                    {latestItems.length > 3 && (
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
        
        {/* User / Login Section */}
        <div className="p-4 border-t border-slate-800 z-10 bg-slate-900">
            {user ? (
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/50 border border-slate-700">
                    <div className="flex items-center gap-2 overflow-hidden">
                        <div className="p-1.5 bg-indigo-500 rounded-full">
                            <User className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="text-xs font-medium text-slate-200 truncate max-w-[120px]">{user.email}</span>
                            <span className="text-[10px] text-indigo-400 font-bold uppercase">{isAdmin ? t.admin : t.guest}</span>
                        </div>
                    </div>
                    <button onClick={signOut} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors" title={t.logout}>
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>
            ) : (
                <button 
                    onClick={() => setIsLoginOpen(true)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold text-slate-200 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors shadow-lg"
                >
                    <LogIn className="w-4 h-4" />
                    {t.login}
                </button>
            )}
            <div className="mt-4 text-[10px] text-slate-600 text-center uppercase tracking-widest">{t.poweredBy}</div>
        </div>
      </aside>
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <header className="lg:hidden h-16 border-b border-slate-800 flex items-center px-4 justify-between bg-slate-900/90 backdrop-blur">
          <div className="flex items-center gap-2"><Globe className="w-6 h-6 text-indigo-500" /><span className="font-bold">{t.title}</span></div>
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-400">{isSidebarOpen ? <X /> : <Menu />}</button>
        </header>
        <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth">
          {loading && !data ? renderSkeleton() : error ? <div className="flex items-center justify-center h-full text-red-400"><div className="text-center max-w-md"><p className="text-lg font-semibold mb-2">{t.errorTitle}</p><p className="font-mono text-sm bg-red-950/50 border border-red-900/50 px-3 py-2 rounded mb-4 break-words">{error}</p>
          {error !== t.permissionDenied && <button onClick={() => loadData(PRESET_QUERIES[0].query)} className="mt-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition-colors text-slate-200 font-medium">{t.retry}</button>}
          {error === t.permissionDenied && !user && <button onClick={() => setIsLoginOpen(true)} className="mt-2 px-4 py-2 bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors text-white font-medium">{t.login}</button>}
          </div></div> : data ? <div className="max-w-6xl mx-auto space-y-8"><div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-2xl h-[500px] relative overflow-hidden">
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
            />
            </div><AnalysisPanel data={data} /></div> : null}
        </div>
      </main>
    </div>
  );
};

export default App;