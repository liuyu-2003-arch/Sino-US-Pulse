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
  
  // New State for Synchronization Status
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');

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
    errorGeneric: language === 'zh' ? '生成数据失败。' : 'Failed to generate data.',
    download: language === 'zh' ? '下载网页' : 'Download Page'
  };

  const changeLanguage = (newLang: Language) => {
    if (language === newLang) return;
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
    setSyncState('idle');
    setCurrentQuery(query);
    try {
      const { data, uploadPromise } = await fetchComparisonData(query, language, forceRefresh);
      setData(data);

      // Handle background synchronization status
      if (data.source === 'api' && uploadPromise) {
          setSyncState('syncing');
          uploadPromise
            .then(() => setSyncState('success'))
            .catch((e) => {
                console.error("Sync failed", e);
                setSyncState('error');
            });
      } else {
          setSyncState('idle');
      }

    } catch (err: any) {
      // Extract Error Code
      const code = err.status || err.code || err.cause?.code || 'UNKNOWN';
      const errorMessage = err.message || '';
      setError(`${t.errorGeneric} [${code}] ${errorMessage}`);
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
    const unitLabel = language === 'zh' ? '单位' : 'Unit';
    const savedLocally = language === 'zh' ? '本地已保存' : 'Saved locally';

    // Filename: [Topic]-[AppName]-[Lang].html
    const filenameTitle = data.titleEn || data.title;
    const langSuffix = language === 'zh' ? '-zh' : '-en';
    const cleanFilename = `${filenameTitle.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}-sino-us-pulse${langSuffix}.html`;

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
        <!-- Embedded Favicon for the downloaded file -->
        <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'%3E%3Crect width='512' height='512' rx='100' fill='%230f172a'/%3E%3Cpath d='M96 256h64l48-112 64 224 64-112h80' stroke='%23818cf8' stroke-width='32' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E">
        <style>
          body { 
            font-family: 'Inter', sans-serif; 
            background-color: #0f172a; 
            color: #f8fafc; 
            margin: 0;
            padding-top: 80px; /* Space for fixed header */
            padding-bottom: 40px;
          }
          .fixed-header {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 64px;
            background-color: #0f172a; /* Solid background */
            border-bottom: 1px solid #334155;
            z-index: 50;
            display: flex;
            align-items: center;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          }
          .container-custom {
            max-width: 72rem; /* 6xl */
            margin: 0 auto;
            padding: 0 1.5rem; /* px-6 */
            width: 100%;
          }
          .card {
            background-color: rgba(30, 41, 59, 0.8);
            border: 1px solid #334155;
            border-radius: 1rem;
            padding: 1.5rem;
            margin-bottom: 1.5rem;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
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
      <body>
        <!-- Fixed Header -->
        <div class="fixed-header">
           <div class="container-custom flex items-center gap-3 h-full">
              <!-- Inline SVG Logo for the header -->
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" class="w-8 h-8 rounded-lg bg-slate-800 p-1 border border-slate-700">
                <rect width="512" height="512" rx="100" fill="#0f172a"/>
                <path d="M96 256h64l48-112 64 224 64-112h80" stroke="#818cf8" stroke-width="48" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <a href="https://uc.324893.xyz/" target="_blank" class="text-indigo-500 font-bold text-xl hover:text-indigo-400 transition-colors no-underline">Sino-US Pulse</a>
           </div>
        </div>

        <div class="container-custom">
            
            <!-- Chart Card (Replicated Interface) -->
            <div class="card h-[500px] flex flex-col relative overflow-hidden">
               <!-- Card Header -->
               <div class="mb-2 flex flex-row justify-between items-start shrink-0">
                  <div>
                      <h2 class="text-2xl font-bold text-white mb-1 flex items-center gap-2">
                          ${data.title}
                          <!-- Cloud Icon -->
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-500/50" title="${savedLocally}"><path d="M17.5 19c0-1.7-1.3-3-3-3h-11"/><path d="M3 16.5c-3.2-5.1 4-11.3 9-6.8 5.4-4.8 12.3-1.6 13.5 5.4 1.2 7-5.1 9.9-8 9.9"/></svg>
                      </h2>
                  </div>
                  <!-- No Refresh Button -->
               </div>

               <!-- Chart Area -->
               <div class="flex-1 w-full min-h-0 relative">
                 <canvas id="myChart"></canvas>
               </div>
               
               <!-- Custom Legend to match UI -->
               <div class="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs mt-8 pb-2 w-full shrink-0">
                  <div class="flex items-center gap-4">
                     <!-- USA Legend -->
                     <div class="flex items-center gap-1.5 cursor-pointer opacity-100">
                        <div class="w-2.5 h-2.5 rounded-full" style="background-color: #3b82f6;"></div>
                        <span class="text-slate-300 font-medium">${usaLabel}</span>
                     </div>
                     <!-- China Legend -->
                     <div class="flex items-center gap-1.5 cursor-pointer opacity-100">
                        <div class="w-2.5 h-2.5 rounded-full" style="background-color: #ef4444;"></div>
                        <span class="text-slate-300 font-medium">${chinaLabel}</span>
                     </div>
                     <!-- Ratio Legend -->
                     <div class="flex items-center gap-1.5 cursor-pointer opacity-100">
                        <div class="w-2.5 h-2.5 rounded-full" style="background-color: #10b981;"></div>
                        <span class="text-slate-300 font-medium">${ratioLabel}</span>
                     </div>
                  </div>
                  
                  <div class="h-4 w-px bg-slate-700 mx-2"></div>
                  
                  <div class="text-slate-500">
                     ${unitLabel}: ${data.yAxisLabel}
                  </div>
                  
                  <!-- No Download Button -->
               </div>
            </div>

            <!-- Analysis Content -->
            <div class="space-y-6">
              ${analysisHtml}
            </div>

            <div class="mt-12 pt-6 border-t border-slate-800 text-center text-slate-500 text-sm">
               <p>Powered by Gemini 2.0 Flash • <a href="https://uc.324893.xyz/" target="_blank" class="text-indigo-400 hover:text-indigo-300 transition-colors">Sino-US Pulse</a></p>
            </div>
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

          // Animation Settings
          const totalDuration = 2000;
          const dataCount = ${labels.length};

          // Easing function for the overall timeline (Inertial Deceleration)
          // Maps progress (0-1) to delay scaler.
          // Power > 1 means delays get larger gaps towards the end, causing the drawing to slow down.
          // 2.5 creates a strong "fast start, slow end" effect like inertial scrolling.
          const easeDelay = (t) => Math.pow(t, 2.5);

          // Custom Delay Function to achieve smooth drawing motion matching Recharts
          const delayFunction = (ctx) => {
             if (ctx.type !== 'data') return 0;
             // Calculate normalized index (0 to 1)
             const index = ctx.index;
             const progress = index / (dataCount - 1);
             
             // Apply easing to the time axis
             return easeDelay(progress) * totalDuration;
          };

          // Function to calculate previous Y for smooth drawing effect
          const previousY = (ctx) => {
            if (ctx.index === 0) return ctx.chart.scales.y.getPixelForValue(0);
            const meta = ctx.chart.getDatasetMeta(ctx.datasetIndex);
            const prev = meta.data[ctx.index - 1];
            return prev ? prev.getProps(['y'], true).y : ctx.chart.scales.y.getPixelForValue(0);
          };

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
              animation: {
                x: {
                    type: 'number',
                    easing: 'linear',
                    duration: 50, // Minimal duration for X to keep up with the cursor
                    from: NaN, 
                    delay(ctx) {
                        if (ctx.type !== 'data' || ctx.xStarted) {
                            return 0;
                        }
                        ctx.xStarted = true;
                        return delayFunction(ctx);
                    }
                },
                y: {
                    type: 'number',
                    easing: 'easeOutCubic', // Soft landing for each point
                    duration: 400, // Smooth transition from previous point
                    from: previousY,
                    delay(ctx) {
                        if (ctx.type !== 'data' || ctx.yStarted) {
                            return 0;
                        }
                        ctx.yStarted = true;
                        return delayFunction(ctx);
                    }
                }
              },
              plugins: {
                legend: {
                  display: false // Hide default legend as we built a custom one
                },
                tooltip: {
                  backgroundColor: '#1e293b',
                  titleColor: '#f8fafc',
                  bodyColor: '#cbd5e1',
                  borderColor: '#334155',
                  borderWidth: 1,
                  padding: 10,
                  displayColors: true,
                  callbacks: {
                     label: function(context) {
                        let label = context.dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        if (context.parsed.y !== null) {
                            label += context.parsed.y.toLocaleString();
                            if (context.dataset.yAxisID === 'y1') label += 'x';
                        }
                        return label;
                     }
                  }
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

        <div className="px-6 py-4 border-b border-slate-800 flex gap-2">
            <button 
                onClick={() => changeLanguage('zh')}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    language === 'zh' 
                    ? 'bg-indigo-600 text-white' 
                    : 'text-slate-400 bg-slate-800 hover:bg-slate-700 hover:text-slate-200'
                }`}
            >
                中文
            </button>
            <button 
                onClick={() => changeLanguage('en')}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    language === 'en' 
                    ? 'bg-indigo-600 text-white' 
                    : 'text-slate-400 bg-slate-800 hover:bg-slate-700 hover:text-slate-200'
                }`}
            >
                English
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
                <div className="text-center max-w-md">
                    <p className="text-lg font-semibold mb-2">{t.errorTitle}</p>
                    <p className="font-mono text-sm bg-red-950/50 border border-red-900/50 px-3 py-2 rounded mb-4 break-words">{error}</p>
                    <button 
                        onClick={() => loadData(PRESET_QUERIES[activePresetIndex > -1 ? activePresetIndex : 0].query)}
                        className="mt-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition-colors text-slate-200 font-medium"
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
                    syncState={syncState}
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