import React from 'react';
import ReactMarkdown from 'react-markdown';
import { ComparisonResponse, Language } from '../types';
import { TrendingUp, BookOpen, ExternalLink, Lightbulb, Telescope } from 'lucide-react';

interface AnalysisPanelProps {
  data: ComparisonResponse;
  language: Language;
}

const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ data, language }) => {
  const t = {
    summary: language === 'zh' ? '核心摘要' : 'Executive Summary',
    trendAnalysis: language === 'zh' ? '趋势分析' : 'Trend Analysis',
    futureOutlook: language === 'zh' ? '未来展望' : 'Future Outlook',
    sources: language === 'zh' ? '数据来源参考' : 'Data Sources'
  };

  // Shared markdown styles for consistent rendering across panels
  const MarkdownContent = ({ content }: { content: string }) => (
    <ReactMarkdown
        className="text-sm text-slate-300"
        components={{
            // Headers: Map h1/h2/h3 to styled components with good spacing
            h1: ({node, ...props}) => <h3 className="text-lg font-bold text-white mt-5 mb-3 block border-b border-slate-700 pb-1" {...props} />,
            h2: ({node, ...props}) => <h4 className="text-base font-bold text-slate-100 mt-4 mb-2 block" {...props} />,
            h3: ({node, ...props}) => <h5 className="text-sm font-bold text-indigo-300 mt-3 mb-1 block" {...props} />,
            // Lists
            ul: ({node, ...props}) => <ul className="list-disc pl-5 space-y-2 mb-3 text-slate-300 marker:text-indigo-500" {...props} />,
            ol: ({node, ...props}) => <ol className="list-decimal pl-5 space-y-2 mb-3 text-slate-300 marker:text-indigo-500" {...props} />,
            li: ({node, ...props}) => <li className="pl-1 leading-relaxed" {...props} />,
            // Emphasis/Bold (*** or **)
            strong: ({node, ...props}) => <strong className="font-bold text-indigo-400 bg-indigo-500/10 px-1 rounded mx-0.5" {...props} />,
            em: ({node, ...props}) => <em className="italic text-slate-400" {...props} />,
            // Paragraphs
            p: ({node, ...props}) => <p className="mb-3 leading-7 text-slate-300" {...props} />,
            // Blockquotes
            blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-indigo-500 pl-4 py-1 my-3 bg-slate-800/50 rounded-r italic" {...props} />
        }}
    >
        {content}
    </ReactMarkdown>
  );

  return (
    <div className="flex flex-col gap-6 mt-8" id="analysis-content">
      
       {/* Summary Card */}
       {data.summary && (
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6 hover:bg-slate-800/70 transition-colors w-full">
            <div className="flex items-center gap-3 mb-4 border-b border-slate-700 pb-4">
                <div className="p-2 bg-indigo-500/10 rounded-lg">
                    <Lightbulb className="w-6 h-6 text-indigo-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">{t.summary}</h3>
            </div>
            <MarkdownContent content={data.summary} />
        </div>
      )}

      {/* Detailed Analysis Card */}
      <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6 hover:bg-slate-800/70 transition-colors w-full">
        <div className="flex items-center gap-3 mb-4 border-b border-slate-700 pb-4">
             <div className="p-2 bg-emerald-500/10 rounded-lg">
                <TrendingUp className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">{t.trendAnalysis}</h3>
        </div>
        <MarkdownContent content={data.detailedAnalysis} />
      </div>

       {/* Future Outlook Card */}
       {data.futureOutlook && (
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6 hover:bg-slate-800/70 transition-colors w-full">
            <div className="flex items-center gap-3 mb-4 border-b border-slate-700 pb-4">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                    <Telescope className="w-6 h-6 text-purple-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">{t.futureOutlook}</h3>
            </div>
            <MarkdownContent content={data.futureOutlook} />
        </div>
      )}

      {/* Sources Card */}
      {data.sources && data.sources.length > 0 && (
         <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6 hover:bg-slate-800/70 transition-colors w-full">
          <div className="flex items-center gap-3 mb-4 border-b border-slate-700 pb-4">
              <div className="p-2 bg-slate-500/10 rounded-lg">
                  <BookOpen className="w-6 h-6 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">{t.sources}</h3>
          </div>
          <ul className="space-y-2 text-slate-400 text-sm">
            {data.sources.map((source, index) => (
              <li key={index} className="flex items-start gap-2">
                 <ExternalLink className="w-4 h-4 mt-0.5 shrink-0 text-slate-500" />
                 <a 
                    href={source.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="hover:text-indigo-400 transition-colors underline decoration-slate-600 hover:decoration-indigo-400 underline-offset-4"
                 >
                    {source.title}
                 </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default AnalysisPanel;