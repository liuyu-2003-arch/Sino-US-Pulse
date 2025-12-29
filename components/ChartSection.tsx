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
import { RefreshCw, Cloud, Download, FileJson, FileSpreadsheet } from 'lucide-react';

interface ChartSectionProps {
  data: ComparisonResponse;
  onRefresh: () => void;
  onDownload: () => void;
  isLoading?: boolean;
  language: Language;
}

const CustomTooltip: React.FC<TooltipProps<number, string>> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-800 border border-slate-700 p-4 rounded-lg shadow-xl text-sm z-50">
        <p className="font-bold text-slate-200 mb-2">{label}</p>
        {payload.map((entry, index) => (
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

const ChartSection: React.FC<ChartSectionProps> = ({ data, onRefresh, onDownload, isLoading, language }) => {
  // Static translations
  const t = {
    unit: language === 'zh' ? '单位' : 'Unit',
    updateData: language === 'zh' ? '更新数据' : 'Update Data',
    updating: language === 'zh' ? '更新中...' : 'Updating...',
    usa: language === 'zh' ? '美国' : 'United States',
    china: language === 'zh' ? '中国' : 'China',
    ratio: language === 'zh' ? '美/中 倍数' : 'USA/China Ratio',
    savedLocally: language === 'zh' ? '本地已保存' : 'Saved locally',
    download: language === 'zh' ? '下载网页' : 'Download Page',
    exportData: language === 'zh' ? '导出数据' : 'Export Data',
  };

  // Process data to add Ratio
  const chartData = useMemo(() => {
    return data.data.map(item => ({
        ...item,
        // Calculate USA / China ratio. Handle division by zero.
        ratio: item.china && item.china !== 0 ? parseFloat((item.usa / item.china).toFixed(2)) : 0
    }));
  }, [data.data]);

  // Calculate specific ticks for the X Axis (every 5 years)
  const xAxisTicks = useMemo(() => {
    if (!chartData || chartData.length === 0) return [];
    
    // Sort just in case, though API usually returns sorted
    const sortedData = [...chartData].sort((a, b) => parseInt(a.year) - parseInt(b.year));
    const firstYear = parseInt(sortedData[0].year);
    const lastYear = parseInt(sortedData[sortedData.length - 1].year);
    
    return sortedData
      .map(d => d.year)
      .filter(yearStr => {
        const year = parseInt(yearStr);
        // Always show first and last year
        if (year === firstYear || year === lastYear) return true;
        // Show every 5 years ending in 0 or 5 (e.g., 1950, 1955)
        return year % 5 === 0;
      });
  }, [chartData]);

  const handleDownloadCsv = () => {
    if (!data || !data.data) return;
    const headers = ['Year', 'USA', 'China', 'Ratio (USA/China)'];
    const rows = data.data.map(item => {
      const ratio = item.china ? (item.usa / item.china).toFixed(2) : '0';
      return [item.year, item.usa, item.china, ratio].join(',');
    });
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${(data.titleEn || data.title).replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadJson = () => {
    if (!data) return;
    const jsonContent = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${(data.titleEn || data.title).replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Custom Legend Component to group Legend Items and Unit Label
  const renderLegend = (props: any) => {
    const { payload } = props;
    
    return (
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs mt-8 pb-2 w-full">
        {/* Actual Chart Legend Items */}
        <div className="flex items-center gap-4">
          {payload.map((entry: any, index: number) => (
            <div key={`item-${index}`} className="flex items-center gap-1.5 cursor-pointer hover:opacity-80">
              <div 
                className="w-2.5 h-2.5 rounded-full" 
                style={{ backgroundColor: entry.color }} 
              />
              <span className="text-slate-300 font-medium">{entry.value}</span>
            </div>
          ))}
        </div>
        
        {/* Separator */}
        <div className="h-4 w-px bg-slate-700 mx-2"></div>

        {/* Unit Label */}
        <div className="text-slate-500">
            {t.unit}: {data.yAxisLabel}
        </div>

        {/* Separator */}
        <div className="h-4 w-px bg-slate-700 mx-2"></div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
             <button 
                onClick={handleDownloadCsv}
                className="flex items-center gap-1 text-slate-400 hover:text-indigo-400 transition-colors"
                title={t.exportData + " (CSV)"}
             >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>CSV</span>
             </button>
             <button 
                onClick={handleDownloadJson}
                className="flex items-center gap-1 text-slate-400 hover:text-indigo-400 transition-colors"
                title={t.exportData + " (JSON)"}
             >
                <FileJson className="w-3.5 h-3.5" />
                <span>JSON</span>
             </button>
             <div className="h-3 w-px bg-slate-700"></div>
             <button 
                onClick={onDownload}
                className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 hover:underline transition-colors font-medium"
                title={t.download}
             >
                <Download className="w-3.5 h-3.5" />
                <span>HTML</span>
             </button>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-full flex flex-col">
        <div className="mb-2 flex flex-row justify-between items-start shrink-0">
            <div>
                <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
                    {data.title}
                    <div title={t.savedLocally}>
                        <Cloud className="w-4 h-4 text-emerald-500/50" />
                    </div>
                </h2>
            </div>
            <button 
                onClick={onRefresh}
                disabled={isLoading}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-400 bg-slate-800/80 hover:bg-slate-700 hover:text-white rounded-lg border border-slate-700 transition-all disabled:opacity-50 shrink-0"
                title={t.updateData}
            >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                {isLoading ? t.updating : t.updateData}
            </button>
        </div>

      <div className="flex-1 w-full min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            key={data.title} /* Key prop ensures component remounts and animation replays on new data */
            data={chartData}
            margin={{
              top: 10,
              right: 0,
              left: 0,
              bottom: 20,
            }}
          >
            <defs>
              <linearGradient id="colorUsa" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
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
                tick={{fill: '#94a3b8', fontSize: 12}}
                tickMargin={10}
                ticks={xAxisTicks}
                interval={0}
            />
            {/* Primary Axis (Data) */}
            <YAxis 
                yAxisId="left"
                stroke="#94a3b8"
                width={60} // Fixed width to prevent labels from being cut off
                tick={{fill: '#94a3b8', fontSize: 12}}
                tickFormatter={(value) => {
                    if (value >= 1000000000) return `${(value / 1000000000).toFixed(1)}B`;
                    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                    if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
                    return value;
                }}
            />
            {/* Secondary Axis (Ratio) */}
            <YAxis 
                yAxisId="right"
                orientation="right"
                stroke="#10b981"
                width={60} // Fixed width to ensure alignment with legend
                tick={{fill: '#10b981', fontSize: 11}}
                tickFormatter={(value) => `${value}x`}
                axisLine={false}
                tickLine={false}
                domain={[0, 'auto']}
                allowDataOverflow={false}
            />
            
            <Tooltip content={<CustomTooltip />} />
            <Legend content={renderLegend} verticalAlign="bottom" />
            
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="usa"
              name={t.usa}
              stroke="#3b82f6"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#colorUsa)"
              animationDuration={2000}
              animationEasing="ease-out"
              isAnimationActive={true}
            />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="china"
              name={t.china}
              stroke="#ef4444"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#colorChina)"
              animationDuration={2000}
              animationEasing="ease-out"
              isAnimationActive={true}
            />
             <Line
              yAxisId="right"
              type="monotone"
              dataKey="ratio"
              name={t.ratio}
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
              strokeDasharray="4 4"
              animationDuration={2000}
              animationEasing="ease-out"
              isAnimationActive={true}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ChartSection;