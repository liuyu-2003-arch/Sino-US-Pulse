import React, { useState, useEffect } from 'react';
import { fetchComparisonData } from './services/geminiService';
import { ComparisonResponse, PRESET_QUERIES, ComparisonCategory, Language } from './types';
import ChartSection from './components/ChartSection';
import AnalysisPanel from './components/AnalysisPanel';
import { 
    Globe, 
    Search, 
    Menu, 
    X, 
    BarChart3, 
    Zap, 
    Users, 
    DollarSign,
    Shield,
    Leaf,
    Languages
} from 'lucide-react';

const App: React.FC = () => {
  // Language State with persistence
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('sino_pulse_language');
    return (saved === 'en' || saved === 'zh') ? saved : 'zh'; // Default to Chinese as per request context
  });

  const [data, setData] = useState<ComparisonResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [customQuery, setCustomQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activePresetIndex, setActivePresetIndex] = useState<number>(0);
  const [currentQuery, setCurrentQuery] = useState<string>('');

  // Translations dictionary
  const t = {
    title: language === 'zh' ? '中美脉搏' : 'SinoUS Pulse',
    searchPlaceholder: language === 'zh' ? '输入任何对比话题...' : 'Compare anything...',
    popularDimensions: language === 'zh' ? '热门维度' : 'Popular Dimensions',
    poweredBy: language === 'zh' ? '由 Gemini 2.0 Flash 驱动' : 'Powered by Gemini 2.0 Flash',
    loadingTitle: language === 'zh' ? '正在分析历史数据...' : 'Analyzing Historical Data...',
    loadingSub: language === 'zh' ? '正在收集关于中美对比的见解' : 'Gathering insights for USA vs China',
    errorTitle: language === 'zh' ? '错误' : 'Error',
    retry: language === 'zh' ? '重试' : 'Retry',
    errorGeneric: language === 'zh' ? '生成数据失败。请稍后再试或检查 API 配额。' : 'Failed to generate data. Please try again later or check your API limit.',
    download: language === 'zh' ? '下载网页' : 'Download Page'
  };

  const toggleLanguage = () => {
    const newLang = language === 'en' ? 'zh' : 'en';
    setLanguage(newLang);
    localStorage.setItem('sino_pulse_language', newLang);
  };

  // Reload data when language changes if we have an active query
  useEffect(() => {
    if (currentQuery) {
        // We re-fetch to get the translated analysis
        loadData(currentQuery);
    } else {
        // Initial Load
        loadData(PRESET_QUERIES[0].query);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  const loadData = async (query: string, forceRefresh: boolean = false) => {
    setLoading(true);
    setError(null);
    setCurrentQuery(query);
    try {
      const result = await fetchComparisonData(query, language, forceRefresh);
      setData(result);
    } catch (err) {
      setError(t.errorGeneric);
    } finally {
      setLoading(false);
    }
  };

  const handlePresetClick = (index: number) => {
    setActivePresetIndex(index);
    setCustomQuery('');
    loadData(PRESET_QUERIES[index].query);
    setIsSidebarOpen(false);
  };

  const handleCustomSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customQuery.trim()) return;
    setActivePresetIndex(-1); // Deselect preset
    loadData(customQuery);
    setIsSidebarOpen(false);
  };

  const handleRefresh = () => {
      if (currentQuery) {
          loadData(currentQuery, true);
      }
  };

  const handleDownload = () => {
    if (!data) return;

    // Grab the Analysis content (innerHTML preserves the rendered HTML from ReactMarkdown)
    const analysisElement = document.getElementById('analysis-content');
    const analysisHtml = analysisElement ? analysisElement.innerHTML : '<div>Analysis not available</div>';
    
    // Prepare Data for Chart.js
    const labels = data.data.map(d => d.year);
    const usaData = data.data.map(d => d.usa);
    const chinaData = data.data.map(d => d.china);
    const ratioData = data.data.map(d => d.china ? (d.usa / d.china).toFixed(2) : 0);

    const usaLabel = language === 'zh' ? '美国' : 'USA';
    const chinaLabel = language === 'zh' ? '中国' : 'China';
    const ratioLabel = language === 'zh' ? '美/中 倍数' : 'USA/China Ratio';

    // Use English title for filename if available, otherwise fallback
    const filenameTitle = data.titleEn || data.title;
    const cleanFilename = `sino-us-pulse-${filenameTitle.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}.html`;

    // Construct the full HTML file with embedded Chart.js for interactivity
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="${language}">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${data.title} - Sino-US Pulse</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
        <style>
          body { 
            font-family: 'Inter', sans-serif; 
            background-color: #0f172a; 
            color: #f8fafc; 
            padding: 40px;
          }
          .card {
            background-color: rgba(30, 41, 59, 0.5);
            border: 1px solid #334155;
            border-radius: 0.75rem;
            padding: 1.5rem;
            margin-bottom: 1.5rem;
          }
          canvas { width: 100% !important; height: auto !important; }
          h3 { font-size: 1.125rem; font-weight: 600; color: white; margin-top: 1.25rem; margin-bottom: 0.75rem; border-bottom: 1px solid #334155; padding-bottom: 0.25rem; }
          h4 { font-size: 1rem; font-weight: 600; color: #f1f5f9; margin-top: 1rem; margin-bottom: 0.5rem; }
          ul, ol { padding-left: 1.25rem; margin-bottom: 0.75rem; color: #cbd5e1; }
          ul { list-style-type: disc; }
          ol { list-style-type: decimal; }
          li { margin-bottom: 0.25rem; }
          p { margin-bottom: 0.75rem; line-height: 1.625; color: #cbd5e1; }
          a { color: #818cf8; text-decoration: underline; }
          strong { color: #818cf8; font-weight: 700; }
        </style>
      </head>
      <body class="max-w-4xl mx-auto">
        <div class="mb-8 border-b border-slate-700 pb-6">
          <div class="flex items-center gap-3 mb-2">
             <span class="text-indigo-500 font-bold text-xl">Sino-US Pulse</span>
          </div>
          <h1 class="text-3xl font-bold text-white">${data.title}</h1>
          <p class="text-slate-400 mt-2 text-sm">Generated on ${new Date().toLocaleDateString()}</p>
        </div>

        <div class="card mb-8 bg-slate-800 p-6 rounded-xl border border-slate-700">
           <h2 class="text-xl font-semibold mb-4 text-white">${language === 'zh' ? '数据图表' : 'Data Chart'}</h2>
           <div class="w-full bg-slate-900/50 rounded-lg p-4 h-[400px]">
             <canvas id="myChart"></canvas>
           </div>
           <div class="mt-4 text-center text-xs text-slate-500">
             ${data.yAxisLabel}
           </div>
        </div>

        <div class="space-y-6">
          ${analysisHtml}
        </div>

        <div class="mt-12 pt-6 border-t border-slate-800 text-center text-slate-500 text-sm">
           <p>Powered by Gemini 2.0 Flash • Sino-US Pulse</p>
        </div>

        <script>
          const ctx = document.getElementById('myChart').getContext('2d');
          
          // Create Gradients to match Recharts style
          const gradientUsa = ctx.createLinearGradient(0, 0, 0, 400);
          gradientUsa.addColorStop(0, 'rgba(59, 130, 246, 0.3)'); // Blue
          gradientUsa.addColorStop(1, 'rgba(59, 130, 246, 0.0)');

          const gradientChina = ctx.createLinearGradient(0, 0, 0, 400);
          gradientChina.addColorStop(0, 'rgba(239, 68, 68, 0.3)'); // Red
          gradientChina.addColorStop(1, 'rgba(239, 68, 68, 0.0)');

          new Chart(ctx, {
            type: 'line',
            data: {
              labels: ${JSON.stringify(labels)},
              datasets: [
                {
                  label: '${usaLabel}',
                  data: ${JSON.stringify(usaData)},
                  borderColor: '#3b82f6',
                  backgroundColor: gradientUsa,
                  borderWidth: 3,
                  fill: true,
                  tension: 0.3,
                  pointRadius: 0,
                  pointHoverRadius: 4,
                  yAxisID: 'y'
                },
                {
                  label: '${chinaLabel}',
                  data: ${JSON.stringify(chinaData)},
                  borderColor: '#ef4444',
                  backgroundColor: gradientChina,
                  borderWidth: 3,
                  fill: true,
                  tension: 0.3,
                  pointRadius: 0,
                  pointHoverRadius: 4,
                  yAxisID: 'y'
                },
                {
                  label: '${ratioLabel}',
                  data: ${JSON.stringify(ratioData)},
                  borderColor: '#10b981',
                  backgroundColor: 'transparent',
                  borderWidth: 2,
                  borderDash: [5, 5],
                  tension: 0.3,
                  pointRadius: 0,
                  pointHoverRadius: 4,
                  yAxisID: 'y1'
                }
              ]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              interaction: {
                mode: 'index',
                intersect: false,
              },
              plugins: {
                legend: {
                  labels: { color: '#cbd5e1' }
                },
                tooltip: {
                  backgroundColor: '#1e293b',
                  titleColor: '#f8fafc',
                  bodyColor: '#cbd5e1',
                  borderColor: '#334155',
                  borderWidth: 1,
                  padding: 10,
                  displayColors: true
                }
              },
              scales: {
                x: {
                  grid: { color: '#334155' },
                  ticks: { color: '#94a3b8' }
                },
                y: {
                  type: 'linear',
                  display: true,
                  position: 'left',
                  grid: { color: '#334155' },
                  ticks: { 
                      color: '#94a3b8',
                      callback: function(value) {
                        if (value >= 1000000000) return (value / 1000000000).toFixed(1) + 'B';
                        if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
                        if (value >= 1000) return (value / 1000).toFixed(1) + 'k';
                        return value;
                      }
                  }
                },
                y1: {
                  type: 'linear',
                  display: true,
                  position: 'right',
                  grid: { drawOnChartArea: false },
                  ticks: { 
                    color: '#10b981',
                    callback: function(value) { return value + 'x'; }
                  }
                }
              }
            }
          });
        </script>
      </body>
      </html>
    `;

    // Trigger Download
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = cleanFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getCategoryIcon = (category: ComparisonCategory) => {
    switch(category) {
        case ComparisonCategory.ECONOMY: return <DollarSign className="w-4 h-4" />;
        case ComparisonCategory.TECHNOLOGY: return <Zap className="w-4 h-4" />;
        case ComparisonCategory.DEMOGRAPHICS: return <Users className="w-4 h-4" />;
        case ComparisonCategory.MILITARY: return <Shield className="w-4 h-4" />;
        case ComparisonCategory.ENVIRONMENT: return <Leaf className="w-4 h-4" />;
        default: return <BarChart3 className="w-4 h-4" />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-900 text-slate-100">
      
      {/* Mobile Sidebar Backdrop */}
      {isSidebarOpen && (
        <div 
            className="fixed inset-0 bg-black/60 z-20 lg:hidden backdrop-blur-sm"
            onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-30
        w-72 bg-slate-900 border-r border-slate-800
        transform transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        flex flex-col
      `}>
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600 rounded-lg">
                    <Globe className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold tracking-tight">{t.title}</span>
            </div>
        </div>

        <div className="px-6 py-4 border-b border-slate-800">
             <button 
                onClick={toggleLanguage}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            >
                <Languages className="w-4 h-4" />
                <span>{language === 'en' ? 'English' : '中文 (简体)'}</span>
            </button>
        </div>

        <div className="p-4">
          <form onSubmit={handleCustomSearch} className="relative">
            <input
              type="text"
              value={customQuery}
              onChange={(e) => setCustomQuery(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="w-full bg-slate-800 text-sm text-slate-200 rounded-lg pl-10 pr-4 py-2.5 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder-slate-500"
            />
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          </form>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-2">
            {t.popularDimensions}
          </h3>
          {PRESET_QUERIES.map((preset, index) => (
            <button
              key={index}
              onClick={() => handlePresetClick(index)}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left
                ${activePresetIndex === index 
                  ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-600/20' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }
              `}
            >
              <div className="shrink-0">{getCategoryIcon(preset.category)}</div>
              <span className="truncate">{language === 'zh' ? preset.labelZh : preset.labelEn}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
            <div className="text-xs text-slate-500 text-center">
                {t.poweredBy}
            </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Header for Mobile */}
        <header className="lg:hidden h-16 border-b border-slate-800 flex items-center px-4 justify-between bg-slate-900/90 backdrop-blur">
          <div className="flex items-center gap-2">
            <Globe className="w-6 h-6 text-indigo-500" />
            <span className="font-bold">{t.title}</span>
          </div>
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-400">
            {isSidebarOpen ? <X /> : <Menu />}
          </button>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth">
          {loading && !data ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] animate-pulse">
                <div className="w-16 h-16 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
                <h2 className="text-xl font-medium text-slate-300">{t.loadingTitle}</h2>
                <p className="text-slate-500 mt-2">{t.loadingSub}</p>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full text-red-400">
                <div className="text-center">
                    <p className="text-lg font-semibold mb-2">{t.errorTitle}</p>
                    <p>{error}</p>
                    <button 
                        onClick={() => loadData(PRESET_QUERIES[activePresetIndex > -1 ? activePresetIndex : 0].query)}
                        className="mt-4 px-4 py-2 bg-slate-800 rounded hover:bg-slate-700 transition"
                    >
                        {t.retry}
                    </button>
                </div>
            </div>
          ) : data ? (
            <div className="max-w-6xl mx-auto space-y-8">
              
              {/* Chart Card */}
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-2xl h-[500px] relative overflow-hidden">
                <ChartSection 
                    data={data} 
                    onRefresh={handleRefresh}
                    onDownload={handleDownload}
                    isLoading={loading}
                    language={language}
                />
              </div>

              {/* Analysis Section */}
              <AnalysisPanel data={data} language={language} />
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
};

export default App;