
export type Language = 'en' | 'zh';

export interface ComparisonDataPoint {
  year: string;
  usa: number;
  china: number;
}

export interface Source {
  title: string;
  url: string;
}

export interface ComparisonResponse {
  title: string;
  titleEn: string;
  titleZh: string; // Added for explicit Chinese archiving
  category: string;
  yAxisLabel: string;
  data: ComparisonDataPoint[];
  summary: string;
  detailedAnalysis: string;
  futureOutlook: string;
  sources: Source[];
  source?: 'r2' | 'api';
}

export const CATEGORY_MAP: Record<string, string> = {
  'Economy': '经济',
  'Technology': '科技',
  'Demographics': '人口',
  'Military': '军事',
  'Environment': '环境',
  'Education': '教育',
  'Custom': '其他',
  'Culture': '文化',
  'Health': '健康',
  'Society': '社会',
  'Politics': '政治',
  'Infrastructure': '基建',
  'Diplomacy': '外交',
  'International Relations': '国际关系',
  'Science & Society': '科学与社会',
  'Tourism': '旅游',
  'Space': '航天',
  'Sports': '体育',
  'Entertainment': '娱乐',
  'Transportation': '交通',
  'Energy': '能源',
  'Agriculture': '农业',
  'Finance': '金融',
  'Manufacturing': '制造',
  'Labor': '劳动力',
  'Research': '科研',
  'History': '历史',
  'Geography': '地理',
  'Law': '法律',
  'Trade': '贸易',
  'Innovation': '创新',
  'Governance': '治理',
  'Media': '媒体'
};

// Moved from App.tsx to here for consistency
export const CATEGORY_COLOR_MAP: Record<string, string> = {
  'Economy': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'Finance': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'Trade': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'Manufacturing': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',

  'Technology': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'Innovation': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'Science & Society': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'Research': 'bg-blue-500/10 text-blue-400 border-blue-500/20',

  'Military': 'bg-red-500/10 text-red-400 border-red-500/20',

  'Environment': 'bg-teal-500/10 text-teal-400 border-teal-500/20',
  'Energy': 'bg-teal-500/10 text-teal-400 border-teal-500/20',
  'Agriculture': 'bg-teal-500/10 text-teal-400 border-teal-500/20',

  'Education': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'Culture': 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  'Society': 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  'Demographics': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  'Labor': 'bg-orange-500/10 text-orange-400 border-orange-500/20',

  'Diplomacy': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  'International Relations': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  'Politics': 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  'Governance': 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  'Law': 'bg-violet-500/10 text-violet-400 border-violet-500/20',

  'Health': 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  'Space': 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20',
  'Transportation': 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  'Infrastructure': 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
};

export enum ComparisonCategory {
  ECONOMY = 'Economy',
  TECHNOLOGY = 'Technology',
  DEMOGRAPHICS = 'Demographics',
  MILITARY = 'Military',
  ENVIRONMENT = 'Environment',
  EDUCATION = 'Education',
  CUSTOM = 'Custom'
}

export interface SavedComparison {
  key: string;
  filename: string;
  displayName?: string; // Legacy fallback
  titleZh?: string;     // New: Chinese Title
  titleEn?: string;     // New: English Title
  summary?: string;     // New: Summary for card preview
  category?: string;
  lastModified?: Date;
  size?: number;
  favoriteCount?: number; // Added for popularity sorting
}

export const PRESET_QUERIES = [
  { 
    labelEn: "GDP Growth (USD)", 
    labelZh: "GDP 增长 (美元)", 
    category: ComparisonCategory.ECONOMY, 
    query: "GDP (Gross Domestic Product) in USD from 1945 to 2024" 
  },
  { 
    labelEn: "GDP per Capita", 
    labelZh: "人均 GDP", 
    category: ComparisonCategory.ECONOMY, 
    query: "GDP per capita in USD from 1945 to 2024" 
  },
  { 
    labelEn: "Disposable Income", 
    labelZh: "人均可支配收入", 
    category: ComparisonCategory.ECONOMY, 
    query: "Annual Disposable Income per Capita in USD from 1945 to 2024" 
  },
  { 
    labelEn: "Population Growth", 
    labelZh: "人口增长", 
    category: ComparisonCategory.DEMOGRAPHICS, 
    query: "Total Population from 1945 to 2024" 
  },
  { 
    labelEn: "CO2 Emissions", 
    labelZh: "碳排放量", 
    category: ComparisonCategory.ENVIRONMENT, 
    query: "Annual CO2 emissions in billion tonnes from 1945 to 2023" 
  },
  { 
    labelEn: "Military Spending", 
    labelZh: "军费开支", 
    category: ComparisonCategory.MILITARY, 
    query: "Annual Military Expenditure in USD from 1945 to 2024" 
  },
  { 
    labelEn: "Internet Users", 
    labelZh: "互联网用户", 
    category: ComparisonCategory.TECHNOLOGY, 
    query: "Number of Internet Users from 1945 to 2024" 
  },
  { 
    labelEn: "Renewable Energy Capacity", 
    labelZh: "可再生能源装机容量", 
    category: ComparisonCategory.ENVIRONMENT, 
    query: "Installed Renewable Energy Capacity (GW) from 1945 to 2024" 
  },
  { 
    labelEn: "Patent Applications", 
    labelZh: "年度专利申请", 
    category: ComparisonCategory.TECHNOLOGY, 
    query: "Annual Patent Applications filed from 1945 to 2023" 
  },
];