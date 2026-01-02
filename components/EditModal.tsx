
import React, { useState, useEffect } from 'react';
import { ComparisonResponse, CATEGORY_MAP } from '../types';
import { X, Save, Edit3, Loader2 } from 'lucide-react';

interface EditModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: ComparisonResponse;
  onSave: (updatedData: ComparisonResponse) => Promise<void>;
}

const EditModal: React.FC<EditModalProps> = ({ isOpen, onClose, data, onSave }) => {
  const [formData, setFormData] = useState<ComparisonResponse>(data);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData(data);
    }
  }, [isOpen, data]);

  const handleChange = (key: keyof ComparisonResponse, value: string) => {
    setFormData(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (e) {
      console.error("Save failed", e);
      alert("保存失败，请重试。");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      {/* 
         Changed layout:
         1. max-h-[90vh]: Limits height to viewport
         2. flex flex-col: vertical layout
         3. header/footer are direct children (shrink-0)
         4. middle content is flex-1 overflow-y-auto (scrolls independently)
      */}
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header - Fixed at top */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 shrink-0 bg-slate-900 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg">
                <Edit3 className="w-5 h-5 text-indigo-400" />
            </div>
            <h2 className="text-xl font-bold text-white">编辑内容</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content - Scrollable Area */}
        <div className="p-6 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-400">中文标题 (Title Zh)</label>
                    <input 
                        type="text" 
                        value={formData.titleZh || ''} 
                        onChange={(e) => handleChange('titleZh', e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-400">英文标题 (Title En)</label>
                    <input 
                        type="text" 
                        value={formData.titleEn || ''} 
                        onChange={(e) => handleChange('titleEn', e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400">分类 (Category)</label>
                <select
                    value={formData.category || 'Custom'}
                    onChange={(e) => handleChange('category', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors"
                >
                    {Object.entries(CATEGORY_MAP).sort((a, b) => a[1].localeCompare(b[1], 'zh')).map(([key, label]) => (
                        <option key={key} value={key}>
                            {label} ({key})
                        </option>
                    ))}
                </select>
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400">核心摘要 (Summary)</label>
                <textarea 
                    rows={4}
                    value={formData.summary || ''} 
                    onChange={(e) => handleChange('summary', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors font-mono text-sm leading-relaxed"
                />
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400">详细分析 (Detailed Analysis)</label>
                <textarea 
                    rows={8}
                    value={formData.detailedAnalysis || ''} 
                    onChange={(e) => handleChange('detailedAnalysis', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors font-mono text-sm leading-relaxed"
                />
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400">未来展望 (Future Outlook)</label>
                <textarea 
                    rows={4}
                    value={formData.futureOutlook || ''} 
                    onChange={(e) => handleChange('futureOutlook', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors font-mono text-sm leading-relaxed"
                />
            </div>
            
            <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400">Y轴单位标签 (Y-Axis Label)</label>
                <input 
                    type="text" 
                    value={formData.yAxisLabel || ''} 
                    onChange={(e) => handleChange('yAxisLabel', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors"
                />
            </div>
        </div>

        {/* Footer - Fixed at bottom */}
        <div className="p-6 border-t border-slate-800 flex justify-end gap-3 shrink-0 bg-slate-900 rounded-b-2xl">
            <button 
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
            >
                取消
            </button>
            <button 
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors disabled:bg-indigo-600/50"
            >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                保存更改
            </button>
        </div>
      </div>
    </div>
  );
};

export default EditModal;