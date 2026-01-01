
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
  Area
} from 'recharts';
import { ComparisonResponse, Language } from '../types';
import { RefreshCw, Database, CloudLightning } from 'lucide-react';

interface ChartSectionProps {
  data: ComparisonResponse;
  onRefresh: () => void;
  isLoading?: boolean;
  language: Language;
  syncState: 'idle' | 'syncing' | 'success' | 'error';
}

const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-800 border border-slate-700 p-4 rounded-lg shadow-xl text-sm z-50">
        <p className="font-bold text-slate-200 mb-2">{label}</p>
        <div className="space-y-1.5">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-slate-400">{entry.name}:</span>
              </div>
              <span className="font-mono text-slate-100 font-medium">
                {entry.dataKey === 'ratio' ? `${entry.value.toLocaleString()}x` : entry.value.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

const ChartSection: React.FC<ChartSectionProps> = ({ data, onRefresh, isLoading, language, syncState }) => {
  const t = {
    unit: language === 'zh' ? '单位' : 'Unit',
    usa: language === 'zh' ? '美国' : 'United States',
    china: language === 'zh' ? '中国' : 'China',
    ratio: language === 'zh' ? '倍数 (美/中)' : 'Multiplier (US/CN)',
    sourceR2: language === 'zh' ? '存档' : 'Archive',
    sourceNew: language === 'zh' ? '实时' : 'Real-time',
  };

  const chartData = useMemo(() => {
    if (!data.data) return [];
    return data.data
      .map(item => {
        const y = parseInt(item.year);
        const u = Number(item.usa);
        const c = Number(item.china);
        return {
            ...item,
            yearNum: isNaN(y) ? 0 : y,
            usa: isNaN(u) ? 0 : u,
            china: isNaN(c) ? 0 : c,
            ratio: c !== 0 ? parseFloat((u / c).toFixed(2)) : 0
        };
      })
      .filter(item => item.yearNum !== 0)
      .sort((a, b) => a.yearNum - b.yearNum);
  }, [data.data]);

  const xAxisTicks = useMemo(() => {
    if (!chartData.length) return [];
    const years = chartData.map(d => d.yearNum);
    const min = Math.min(...years);
    const max = Math.max(...years);
    const ticks = [];
    let start = Math.floor(min / 5) * 5;
    for (let y = start; y <= max; y += 5) {
      if (y >= min) ticks.push(y);
    }
    if (!ticks.includes(min)) ticks.unshift(min);
    if (!ticks.includes(max)) ticks.push(max);
    return [...new Set(ticks)].sort((a, b) => a - b);
  }, [chartData]);

  if (!chartData.length) {
      return <div className="h-full flex items-center justify-center text-slate-500 italic text-sm">No valid data points found for this chart.</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-start mb-4">
        <div className="max-w-[70%]">
          <h2 className="text-xl font-bold text-white tracking-tight line-clamp-2">
            {language === 'zh' ? data.titleZh : data.titleEn}
          </h2>
          <p className="text-slate-400 text-xs mt-1 truncate">
            {t.unit}: {data.yAxisLabel}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold border ${data.source === 'r2' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'}`}>
            <Database className="w-3 h-3" />
            {data.source === 'r2' ? t.sourceR2 : t.sourceNew}
          </div>
          <button onClick={onRefresh} disabled={isLoading} className="p-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg text-slate-300 disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
            <XAxis dataKey="yearNum" type="number" domain={['dataMin', 'dataMax']} stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} ticks={xAxisTicks} tickFormatter={v => v.toString()} dy={10} />
            <YAxis yAxisId="left" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(1)}k` : v} />
            <YAxis yAxisId="right" orientation="right" stroke="#10b981" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `${v}x`} domain={[0, 'auto']} />
            <Tooltip content={<CustomTooltip />} />
            <Legend verticalAlign="top" align="right" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
            <Area yAxisId="left" type="monotone" dataKey="usa" name={t.usa} stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorUsa)" />
            <Area yAxisId="left" type="monotone" dataKey="china" name={t.china} stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorChina)" />
            <Line yAxisId="right" type="monotone" dataKey="ratio" name={t.ratio} stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={{ r: 4 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ChartSection;
