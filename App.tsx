import React, { useState, useEffect, useMemo } from 'react';
import { fetchComparisonData, fetchSavedComparisonByKey } from './services/geminiService';
import { ComparisonResponse, PRESET_QUERIES, ComparisonCategory, Language } from './types';
import ChartSection from './components/ChartSection';
import AnalysisPanel from './components/AnalysisPanel';
import ArchiveModal from './components/ArchiveModal';
import { 
    Globe, 
    Menu, 
    X, 
    BarChart3, 
    Zap, 
    Users, 
    DollarSign, 
    Shield, 
    Leaf,
    Database,
    TrendingUp
} from 'lucide-react';

const App: React.FC = () => {
  // Language State with persistence
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('sino_pulse_language');
    return (saved === 'en' || saved === 'zh') ? saved : 'zh'; // Default to Chinese as per request context
  });

  // Popularity State (Store clicks per query string)
  const [presetPopularity, setPresetPopularity] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('sino_pulse_popularity');
    return saved ? JSON.parse(saved) : {};
  });

  const [data, setData] = useState<ComparisonResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [customQuery, setCustomQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activePresetQuery, setActivePresetQuery] = useState<string>(PRESET_QUERIES[0].query);
  const [currentQuery, setCurrentQuery] = useState<string>('');
  
  // New State for Synchronization Status
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');

  // Archive Modal State
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);

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
    cloudLibrary: language === 'zh' ? '云端资料库' : 'Cloud Library',
    browseSaved: language === 'zh' ? '浏览已保存的历史对比' : 'Browse saved comparisons'
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

  // Sort presets by popularity (descending)
  const sortedPresets = useMemo(() => {
    return [...PRESET_QUERIES].sort((a, b) => {
        const countA = presetPopularity[a.query] || 0;
        const countB = presetPopularity[b.query] || 0;
        return countB - countA; // Descending order
    });
  }, [presetPopularity]);

  const incrementPopularity = (query: string) => {
      const newPopularity = {
          ...presetPopularity,
          [query]: (presetPopularity[query] || 0) + 1
      };
      setPresetPopularity(newPopularity);
      localStorage.setItem('sino_pulse_popularity', JSON.stringify(newPopularity));
  };

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

  // New function to load directly from Saved Item Key
  const loadSavedItem = async (key: string) => {
      setIsArchiveOpen(false);
      setIsSidebarOpen(false);
      setLoading(true);
      setError(null);
      setSyncState('idle'); // Data is already saved
      
      try {
          const data = await fetchSavedComparisonByKey(key);
          setData(data);
          setCurrentQuery(''); 
          setActivePresetQuery(''); // Deselect preset
      } catch (err: any) {
          setError("Failed to load saved item.");
      } finally {
          setLoading(false);
      }
  };

  // New function to handle creation from the Archive Modal
  const handleCreateFromArchive = (query: string) => {
      setIsArchiveOpen(false); // Close modal
      setIsSidebarOpen(false); // Close sidebar if open
      setCustomQuery(query);   // Update the sidebar input for visual consistency
      setActivePresetQuery(''); // Deselect presets
      loadData(query);         // Start generation
  };

  const handlePresetClick = (query: string) => {
    setActivePresetQuery(query);
    setCustomQuery('');
    incrementPopularity(query); // Track click
    loadData(query);
    setIsSidebarOpen(false);
  };

  // Removed handleCustom