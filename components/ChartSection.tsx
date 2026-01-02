
import React, { useMemo, useState } from 'react';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area
} from 'recharts';
import { ComparisonResponse, CATEGORY_MAP, CATEGORY_COLOR_MAP } from '../types';
import { RefreshCw, Database, Trash2, Star, Pencil, Share2, Check, CloudUpload, AlertTriangle } from 'lucide-react';

interface ChartSectionProps {
  data: ComparisonResponse;
  onRefresh: () => void;
  isLoading?: boolean;
  syncState: 'idle' | 'syncing' | 'success' | 'error';
  isAdmin: boolean;
  onDelete: () => void; // Kept in interface to minimize breaking changes in parent, though unused here
  onEdit: () => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  isLoggedIn: boolean;
  onLoginRequest: () => void;
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
                {entry.dataKey === 'ratio' ? (
                   <div className="w-3 h-0.5 border-t-2 border-dashed" style={{ borderColor: entry.color }} />
                ) : (
                   <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                )}
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

const getCategoryLabel = (cat: string) => CATEGORY_MAP[cat] || cat;
const getCategoryStyle = (cat: string) => CATEGORY_COLOR_MAP[cat] || 'bg-slate-700/50 text-slate-400 border-slate-600/50';

const ChartSection: React.FC<ChartSectionProps> = ({ 
    data, onRefresh, isLoading, syncState, 
    isAdmin, onDelete, onEdit, isFavorite, onToggleFavorite, isLoggedIn, onLoginRequest
}) => {
  const [isCopied, setIsCopied] = useState(false);

  const t = {
    unit: '单位',
    usa: '美国',
    china: '中国',
    ratio: '倍数 (美/中)',
    sourceR2: '已存档',
    sourceNew: '实时生成',
    syncing: '云端同步中...',
    syncError: '同步失败'
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

  const displayYAxisLabel = useMemo(() => {
      let label = data.yAxisLabel || '';
      label = label.replace(/\[.*?\]/g, '');
      label = label.replace(/(Note|Source):.*/i, '');
      label = label.trim();
      if (label.startsWith('GDP (') && label.endsWith(')')) {
          label = label.substring(5, label.length - 1);
      }
      return label;
  }, [data.yAxisLabel]);

  const handleShare = () => {
    // Only copy if not syncing to avoid copying temporary links
    if (syncState === 'syncing') return;

    navigator.clipboard.writeText(window.location.href).then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    });
  };

  const renderStatusBadge = () => {
    if (syncState === 'syncing') {
        return (
            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded text-[10px] font-bold border bg-indigo-500/10 text-indigo-400 border-indigo-500/20">
                <RefreshCw className="w-3 h-3 animate-spin" />
                {t.syncing}
            </div>
        );
    }
    if (syncState === 'error') {
         return (
            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded text-[10px] font-bold border bg-red-500/10 text-red-400 border-red-500/20" title="保存到云端失败">
                <AlertTriangle className="w-3 h-3" />
                {t.syncError}
            </div>
        );
    }
    if (data.source === 'r2') {
         return (
            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded text-[10px] font-bold border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                <Database className="w-3 h-3" />
                {t.sourceR2}
            </div>
        );
    }
    // Default API
    return (
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded text-[10px] font-bold border bg-indigo-500/10 text-indigo-400 border-indigo-500/20">
             <CloudUpload className="w-3 h-3" />
             {t.sourceNew}
        </div>
    );
  };

  if (!chartData.length) {
      return <div className="h-full flex items-center justify-center text-slate-500 italic text-sm">暂无有效图表数据。</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-start md:items-center mb-4 gap-4">
        <div className="flex-1 min-w-0">
          <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight leading-tight">
            {data.titleZh || data.titleEn}
          </h2>
        </div>
        <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
           
          {/* Category Label Moved Here - Right Side */}
          <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded-md tracking-wider border ${getCategoryStyle(data.category || 'Custom')}`}>
             {getCategoryLabel(data.category || 'Custom')}
          </span>

          {/* Separator */}
          <div className="h-4 w-px bg-slate-700 mx-1"></div>

          {/* Unified Status Badge */}
          {renderStatusBadge()}

          <div className="h-6 w-px bg-slate-700 mx-1 hidden md:block"></div>

          {/* Favorite Button */}
          <button
            onClick={isLoggedIn ? onToggleFavorite : onLoginRequest}
            className={`p-2 rounded-lg transition-colors ${isFavorite ? 'text-amber-400 bg-amber-500/10 hover:bg-amber-500/20' : 'text-slate-400 hover:text-amber-400 hover:bg-slate-800'}`}
            title={isFavorite ? "取消收藏" : "收藏"}
          >
             <Star className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
          </button>

          {/* Share Button */}
          <button
            onClick={handleShare}
            disabled={syncState === 'syncing'}
            className={`p-2 rounded-lg transition-colors ml-1 ${isCopied ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-400 hover:text-emerald-400 hover:bg-slate-800'} ${syncState === 'syncing' ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={syncState === 'syncing' ? "正在生成链接..." : "分享页面链接"}
          >
             {isCopied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
          </button>

          {/* Admin Only Actions: Refresh, Edit */}
          {isAdmin && (
            <>
             <button
                onClick={onRefresh}
                disabled={isLoading}
                className="p-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors disabled:opacity-50 ml-1 hidden md:block"
                title="刷新数据 (管理员)"
             >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
             </button>

             <button
                onClick={onEdit}
                className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors ml-1"
                title="编辑内容 (管理员)"
             >
                <Pencil className="w-4 h-4" />
             </button>
            </>
          )}
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
            <Area yAxisId="left" type="monotone" dataKey="usa" name={t.usa} stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorUsa)" />
            <Area yAxisId="left" type="monotone" dataKey="china" name={t.china} stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorChina)" />
            <Line yAxisId="right" type="monotone" dataKey="ratio" name={t.ratio} stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={{ r: 4 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Footer: Legend and Unit Info */}
      <div className="flex items-center justify-center gap-4 mt-4 pt-2 border-t border-slate-700/30">
        {/* Legend */}
        <div className="flex items-center gap-5 text-xs font-medium">
            <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#6366f1]"></span>
                <span className="text-slate-300">{t.usa}</span>
            </div>
            <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]"></span>
                <span className="text-slate-300">{t.china}</span>
            </div>
            <div className="flex items-center gap-2">
                <span className="w-4 h-0 border-t-2 border-dashed border-[#10b981]"></span>
                <span className="text-slate-300">{t.ratio}</span>
            </div>
        </div>

        {/* Separator */}
        <div className="w-px h-3 bg-slate-600"></div>

        {/* Unit Info */}
        <div className="text-xs text-slate-400">
            {t.unit}: <span className="text-slate-300">{displayYAxisLabel}</span>
        </div>
      </div>
    </div>
  );
};

export default ChartSection;
