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
  titleEn: string; // Added for English filename generation
  category: string;
  yAxisLabel: string;
  data: ComparisonDataPoint[];
  summary: string;
  detailedAnalysis: string;
  futureOutlook: string;
  sources: Source[];
  source?: 'r2' | 'api';
}

export enum ComparisonCategory {
  ECONOMY = 'Economy',
  TECHNOLOGY = 'Technology',
  DEMOGRAPHICS = 'Demographics',
  MILITARY = 'Military',
  ENVIRONMENT = 'Environment',
  EDUCATION = 'Education',
  CUSTOM = 'Custom'
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
    query: "GDP per capita in USD from 1960 to 2024" 
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
    query: "Number of Internet Users from 1990 to 2024" 
  },
  { 
    labelEn: "Renewable Energy Capacity", 
    labelZh: "可再生能源装机容量", 
    category: ComparisonCategory.ENVIRONMENT, 
    query: "Installed Renewable Energy Capacity (GW) from 1990 to 2024" 
  },
  { 
    labelEn: "Patent Applications", 
    labelZh: "年度专利申请", 
    category: ComparisonCategory.TECHNOLOGY, 
    query: "Annual Patent Applications filed from 1980 to 2023" 
  },
];