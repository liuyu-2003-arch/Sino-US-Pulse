
import React, { useMemo } from 'react';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  TooltipProps
} from 'recharts';
import { ComparisonResponse, Language } from '../types';
import { RefreshCw, Database, CloudLightning, FileJson, FileSpreadsheet, AlertCircle } from 'lucide-react';

interface ChartSectionProps {
  data: ComparisonResponse;
  onRefresh: () => void;
  onDownload?: () => void;
  isLoading?: boolean;
  language: Language;
  syncState: 'idle' | 'syncing' | 'success' | 'error';
}

const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-800 border border-slate-700 p-4 rounded-lg shadow-xl text-sm z-50">
        <p className="font-bold text-slate-200 mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 mb-1">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-slate-400 capitalize">{entry.name}:</span>
            <span className="font-mono text-slate-100 font-medium">
              {entry.value?.toLocaleString()}
              {entry.dataKey === 'ratio' ? 'x' : ''}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// Fix: Complete truncated component and add default export
const ChartSection: React.FC<ChartSectionProps> = ({ data, onRefresh, isLoading, language, syncState }) => {
  // Static translations
  const t = {
    unit: language === 'zh' ? '单位' : 'Unit',
    updateData: language === 'zh' ? '更新数据' : 'Update Data',
    updating: language === 'zh' ? '更新中...' : 'Updating...',
    usa: language === 'zh' ? '美国' : 'United States',
    china: language === 'zh' ? '中国' : 'China',
    ratio: language === 'zh' ? '美/中 倍数' : 'USA/China Ratio',
    savedLocally: language === 'zh' ? '本地已保存' : 'Saved locally',
    exportData: language === 'zh' ? '导出数据' : 'Export Data',
    sourceR2: language === 'zh' ? '数据源：Cloudflare R2 (云端)' : 'Source: Cloudflare R2 (Cloud)',
    sourceNew: language === 'zh' ? '数据源：实时生成' : 'Source: Generated',
    syncing: language === 'zh' ? '正在同步云端...' : 'Syncing to Cloud...',
    synced: language === 'zh' ? '已同步至云端' : 'Cloud Synced',
    syncFailed: language === 'zh' ? '同步失败 (仅本地)' : 'Sync Failed (Local)',
  };

  // Process data to add Ratio
  const chartData = useMemo(() => {
    return data.data.map(item => ({
        ...item,
        // Calculate USA / China ratio. Handle division by zero.
        ratio: item.china && item.china !== 0 ? parseFloat((item.usa / item.china).toFixed(2)) : 0
    }));
  }, [data.data]);

  // Calculate specific ticks for the X Axis (every 5 years) to ensure uniform spacing
  const xAxisTicks = useMemo(() => {
    if (!chartData || chartData.length === 0) return [];
    
    // Sort just in case, though API usually returns sorted
    const sortedData = [...chartData].sort((a, b) => parseInt(a.year) - parseInt(b.year));
    
    // Show strictly every 5 years (1950, 1955, etc) to keep visual spacing uniform.
    const ticks = sortedData
      .map(d => d.year)
      .filter(yearStr => {
        const year = parseInt(yearStr);
        return !isNaN(year) && year % 5 === 0;
      });
    
    // Always include the first and last year if not already there
    if (sortedData.length > 0) {
        if (!ticks.includes(sortedData[0].year)) ticks.unshift(sortedData[0].year);
        if (!ticks.includes(sortedData[sortedData.length - 1].year)) ticks.push(sortedData[sortedData.length - 1].year);
    }
    
    return [...new Set(ticks)].sort((a, b) => parseInt(a) - parseInt(b));
  }, [chartData]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            {language === 'zh' ? data.titleZh : data.titleEn}
          </h2>
          <p className="text-slate-400 text-xs mt-1">
            {t.unit}: {data.yAxisLabel}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {data.source === 'r2' ? (
             <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded text-[10px] font-medium border border-emerald-500/20">
                <Database className="w-3 h-3" />
                {t.sourceR2}
             </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-indigo-500/10 text-indigo-400 rounded text-[10px] font-medium border border-indigo-500/20">
                <CloudLightning className="w-3 h-3" />
                {t.sourceNew}
            </div>
          )}

          {syncState === 'syncing' && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 text-amber-400 rounded text-[10px] font-medium animate-pulse border border-amber-500/20">
              <RefreshCw className="w-3 h-3 animate-spin" />
              {t.syncing}
            </div>
          )}

          {syncState === 'success' && (
             <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded text-[10px] font-medium border border-emerald-500/20">
                <CloudLightning className="w-3 h-3" />
                {t.synced}
             </div>
          )}

          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 transition-colors disabled:opacity-50"
            title={t.updateData}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorUsa" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorChina" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis 
              dataKey="year" 
              stroke="#94a3b8" 
              fontSize={12} 
              tickLine={false} 
              axisLine={false}
              ticks={xAxisTicks}
            />
            <YAxis 
              stroke="#94a3b8" 
              fontSize={12} 
              tickLine={false} 
              axisLine={false}
              tickFormatter={(value) => value >= 1000 ? `${(value/1000).toFixed(1)}k` : value}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend verticalAlign="top" height={36}/>
            <Area
              type="monotone"
              dataKey="usa"
              name={t.usa}
              stroke="#6366f1"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#colorUsa)"
            />
            <Area
              type="monotone"
              dataKey="china"
              name={t.china}
              stroke="#ef4444"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#colorChina)"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ChartSection;
