import React, { useState, useEffect, useMemo } from 'react';
import { fetchComparisonData, fetchSavedComparisonByKey, listSavedComparisons } from './services/geminiService';
import { ComparisonResponse, PRESET_QUERIES, ComparisonCategory, Language, SavedComparison } from './types';
import ChartSection from './components/ChartSection';
import AnalysisPanel from './components/AnalysisPanel';
import ArchiveModal from './components/ArchiveModal';
import { 
    Globe, 
    Menu, 
    X, 
    Database,
    History,
    BarChart3,
    Loader2,
    Download
} from 'lucide-react';

const App: React.FC = () => {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('sino_pulse_language');
    return (saved === 'en' || saved === 'zh') ? saved : 'zh';
  });

  const [data, setData] = useState<ComparisonResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeItemKey, setActiveItemKey] = useState<string>('');
  const [currentQuery, setCurrentQuery] = useState<string>('');
  const [libraryItems, setLibraryItems] = useState<SavedComparison[]>([]);
  const [isLibraryLoading, setIsLibraryLoading] = useState(false);
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);

  const t = {
    title: language === 'zh' ? '中美脉搏' : 'SinoUS Pulse',
    libraryTitle: language === 'zh' ? '历史对比' : 'Saved Archive',
    noItems: language === 'zh' ? '暂无记录' : 'No records yet',
    poweredBy: language === 'zh' ? '由 Gemini 3 Pro 驱动' : 'Powered by Gemini 3 Pro',
    loadingTitle: language === 'zh' ? '正在分析历史数据...' : 'Analyzing Historical Data...',
    loadingSub: language === 'zh' ? '正在收集关于中美对比的见解' : 'Gathering insights for USA vs China',
    errorTitle: language === 'zh' ? '错误' : 'Error',
    retry: language === 'zh' ? '重试' : 'Retry',
    errorGeneric: language === 'zh' ? '生成数据失败。' : 'Failed to generate data.',
    cloudLibrary: language === 'zh' ? '搜索云端 / 创建新对比' : 'Search Cloud / Create New',
    download: language === 'zh' ? '导出离线网页' : 'Export Offline Report'
  };

  const changeLanguage = (newLang: Language) => {
    if (language === newLang) return;
    setLanguage(newLang);
    localStorage.setItem('sino_pulse_language', newLang);
  };

  const loadLibraryList = async () => {
    setIsLibraryLoading(true);
    try {
      const items = await listSavedComparisons(language);
      setLibraryItems(items);
    } catch (err) {
      console.error("Failed to load library list", err);
    } finally {
      setIsLibraryLoading(false);
    }
  };

  useEffect(() => {
    loadLibraryList();
    if (currentQuery) {
        loadData(currentQuery);
    } else {
        loadInitialData();
    }
  }, [language]);

  const loadInitialData = async () => {
      setLoading(true);
      try {
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
    setLoading(true);
    setError(null);
    setSyncState('idle');
    setCurrentQuery(query);
    try {
      const { data, uploadPromise } = await fetchComparisonData(query, language, forceRefresh);
      setData(data);
      if (data.source === 'api' && uploadPromise) {
          setSyncState('syncing');
          uploadPromise.then(() => {
              setSyncState('success');
              loadLibraryList();
          }).catch(() => setSyncState('error'));
      }
    } catch (err: any) {
      setError(`${t.errorGeneric} [${err.status || 'ERR'}]`);
    } finally {
      setLoading(false);
    }
  };

  const loadSavedItem = async (key: string) => {
      setIsArchiveOpen(false);
      setIsSidebarOpen(false);
      setActiveItemKey(key);
      setLoading(true);
      setError(null);
      setSyncState('idle'); 
      try {
          const data = await fetchSavedComparisonByKey(key);
          setData(data);
          setCurrentQuery(''); 
      } catch (err: any) {
          setError("Failed to load saved item.");
      } finally {
          setLoading(false);
      }
  };

  const handleCreateFromArchive = (query: string) => {
      setIsArchiveOpen(false); 
      setIsSidebarOpen(false); 
      loadData(query);         
  };

  const handleRefresh = () => {
      if (currentQuery) loadData(currentQuery, true);
  };

  const handleDownload = () => {
    if (!data) return;
    const analysisElement = document.getElementById('analysis-content');
    const analysisHtml = analysisElement ? analysisElement.innerHTML : '';
    const labels = data.data.map(d => d.year);
    const usaData = data.data.map(d => d.usa);
    const chinaData = data.data.map(d => d.china);
    const ratioData = data.data.map(d => d.china ? (d.usa / d.china).toFixed(2) : 0);

    const html = `<!DOCTYPE html><html lang="${language}"><head><meta charset="UTF-8"><title>${data.titleEn}</title>
    <script src="https://cdn.tailwindcss.com"></script><script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>body{background:#0f172a;color:#f1f5f9;font-family:sans-serif;padding:40px} .card{background:#1e293b;border-radius:1rem;padding:2rem;margin-bottom:2rem;border:1px solid #334155}</style>
    </head><body><div class="max-w-5xl mx-auto"><div class="card"><h1 class="text-3xl font-bold mb-2">${language === 'zh' ? data.titleZh : data.titleEn}</h1><p class="text-slate-400 mb-8">${data.yAxisLabel}</p>
    <div style="height:400px"><canvas id="c"></canvas></div></div><div class="card">${analysisHtml}</div></div>
    <script>const ctx=document.getElementById('c').getContext('2d');new Chart(ctx,{type:'line',data:{labels:${JSON.stringify(labels)},
    datasets:[{label:'USA',data:${JSON.stringify(usaData)},borderColor:'#6366f1',backgroundColor:'rgba(99,102,241,0.1)',fill:true,yAxisID:'y'},
    {label:'China',data:${JSON.stringify(chinaData)},borderColor:'#ef4444',backgroundColor:'rgba(239,68,68,0.1)',fill:true,yAxisID:'y'},
    {label:'Ratio (Multiplier)',data:${JSON.stringify(ratioData)},borderColor:'#10b981',borderDash:[5,5],yAxisID:'y1'}]},
    options:{responsive:true,maintainAspectRatio:false,scales:{y:{type:'linear',position:'left'},y1:{type:'linear',position:'right',grid:{drawOnChartArea:false}}}}});</script></body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.titleEn.toLowerCase().replace(/\s+/g, '-')}.html`;
    a.click();
  };

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
      <ArchiveModal isOpen={isArchiveOpen} onClose={() => setIsArchiveOpen(false)} onSelect={loadSavedItem} onCreate={handleCreateFromArchive} language={language} />
      {isSidebarOpen && <div className="fixed inset-0 bg-black/60 z-20 lg:hidden backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />}
      <aside className={`fixed lg:static inset-y-0 left-0 z-30 w-72 bg-slate-900 border-r border-slate-800 transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} flex flex-col`}>
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600 rounded-lg"><Globe className="w-6 h-6 text-white" /></div>
                <span className="text-xl font-bold tracking-tight text-white">{t.title}</span>
            </div>
        </div>
        <div className="px-6 py-4 border-b border-slate-800 flex gap-2">
            <button onClick={() => changeLanguage('zh')} className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${language === 'zh' ? 'bg-indigo-600 text-white' : 'text-slate-400 bg-slate-800'}`}>中文</button>
            <button onClick={() => changeLanguage('en')} className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${language === 'en' ? 'bg-indigo-600 text-white' : 'text-slate-400 bg-slate-800'}`}>English</button>
        </div>
        <div className="p-4">
            <button onClick={() => setIsArchiveOpen(true)} className="w-full flex items-center gap-3 px-4 py-4 rounded-xl text-sm font-semibold transition-all text-left text-slate-200 bg-slate-800 border border-slate-700 hover:bg-slate-700 shadow-lg"><Database className="w-5 h-5 text-emerald-400" /> <span className="truncate flex-1">{t.cloudLibrary}</span></button>
        </div>
        <nav className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
          <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-4 mt-2 px-2 flex justify-between items-center">{t.libraryTitle} <History className="w-3 h-3 text-slate-600" /></h3>
          {isLibraryLoading && libraryItems.length === 0 ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-600" /></div> : libraryItems.length === 0 ? <div className="px-2 py-4 text-xs text-slate-600 italic">{t.noItems}</div> : libraryItems.map((item) => {
                const isActive = activeItemKey === item.key;
                const displayTitle = (language === 'zh' ? item.titleZh : item.titleEn) || item.filename;
                const cleanTitle = displayTitle.replace(/[\(\（\s]*\d{4}\s*-\s*\d{4}[\)\）\s]*/g, '').replace(/[\(\（]\s*[\)\）]/g, '').trim();
                return <button key={item.key} onClick={() => loadSavedItem(item.key)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left ${isActive ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-600/20' : 'text-slate-400 hover:bg-slate-800'}`}><BarChart3 className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-400' : 'text-slate-500'}`} /> <span className="truncate flex-1">{cleanTitle}</span></button>;
          })}
        </nav>
        {data && (
          <div className="p-4 border-t border-slate-800">
             <button onClick={handleDownload} className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-slate-400 hover:text-white border border-slate-700 rounded-lg transition-colors"><Download className="w-3.5 h-3.5" /> {t.download}</button>
          </div>
        )}
        <div className="p-4 border-t border-slate-800/50"><div className="text-[10px] text-slate-600 text-center uppercase tracking-widest">{t.poweredBy}</div></div>
      </aside>
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <header className="lg:hidden h-16 border-b border-slate-800 flex items-center px-4 justify-between bg-slate-900/90 backdrop-blur">
          <div className="flex items-center gap-2"><Globe className="w-6 h-6 text-indigo-500" /><span className="font-bold">{t.title}</span></div>
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-400">{isSidebarOpen ? <X /> : <Menu />}</button>
        </header>
        <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth">
          {loading && !data ? renderSkeleton() : error ? <div className="flex items-center justify-center h-full text-red-400"><div className="text-center max-w-md"><p className="text-lg font-semibold mb-2">{t.errorTitle}</p><p className="font-mono text-sm bg-red-950/50 border border-red-900/50 px-3 py-2 rounded mb-4 break-words">{error}</p><button onClick={() => loadData(PRESET_QUERIES[0].query)} className="mt-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition-colors text-slate-200 font-medium">{t.retry}</button></div></div> : data ? <div className="max-w-6xl mx-auto space-y-8"><div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-2xl h-[500px] relative overflow-hidden"><ChartSection data={data} onRefresh={handleRefresh} isLoading={loading} language={language} syncState={syncState} /></div><AnalysisPanel data={data} language={language} /></div> : null}
        </div>
      </main>
    </div>
  );
};

export default App;