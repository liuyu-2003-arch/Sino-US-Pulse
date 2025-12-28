import { GoogleGenAI, Type } from "@google/genai";
import { ComparisonResponse, Language } from "../types";

// Initialize the API client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Bump cache version to invalidate old data structure
const CACHE_PREFIX = 'sino_pulse_cache_v4_';

export const fetchComparisonData = async (
  query: string,
  language: Language,
  forceRefresh: boolean = false
): Promise<ComparisonResponse> => {
  // Include language in cache key so we don't show English cached data when Chinese is selected
  const cacheKey = `${CACHE_PREFIX}${language}_${query.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

  // 1. Try to load from cache if not forcing refresh
  if (!forceRefresh) {
    try {
      const cachedData = localStorage.getItem(cacheKey);
      if (cachedData) {
        console.log(`[Cache] Hit for "${query}" (${language})`);
        return JSON.parse(cachedData) as ComparisonResponse;
      }
    } catch (e) {
      console.warn("[Cache] Failed to load from local storage", e);
      localStorage.removeItem(cacheKey);
    }
  }

  const modelId = "gemini-3-flash-preview"; 

  const languageInstruction = language === 'zh' 
    ? "Provide the response content in Simplified Chinese. Ensure the 'detailedAnalysis' is formatted with Markdown using bullet points for key insights to avoid walls of text." 
    : "Provide the response content in English. Ensure the 'detailedAnalysis' is formatted with Markdown using bullet points for key insights to avoid walls of text.";

  const prompt = `
    Generate a comparative analysis and historical data dataset between China and the United States for the following topic: "${query}".
    
    Requirements:
    1. **Data Granularity**: Provide data points for **every single year** (1-year granularity). Do not skip years.
    2. **Time Range**: Start from **1945** (or the earliest year data is available/relevant after 1945) and go up to **2024**.
    3. **Missing Data**: If specific yearly data is missing, interpolate reasonably or use 0 if the metric did not exist at that time.
    4. Both 'usa' and 'china' values must be numbers.
    5. **Title Formatting**: 
       - 'title': The display title in the requested language (${language}). Format MUST be "Sino-US [Topic] Annual Comparison" (or "中美[Topic]年度对比" in Chinese). **Do NOT** include specific year ranges (e.g., 1945-2024) or words like "Analysis" (分析) in the title.
       - 'titleEn': Always provide the title in English, regardless of the requested language. Format: "Sino-US [Topic] Annual Comparison".
    6. **Content Structure**:
       - **Summary**: A concise executive summary of the comparison. **Do NOT** include a header like "Summary" or "Introduction" at the start.
       - **Detailed Analysis**: A structured markdown analysis explaining the trends, eras, and key turning points (use headers/bullet points). **Do NOT** include a main header like "Trend Analysis" at the start.
       - **Future Outlook**: A prediction of future trends based on current data. **Do NOT** include a header like "Future Outlook" at the start.
       - **Sources**: List 3-5 primary data sources (e.g., World Bank, IMF, Statista) used to derive this data. Provide the source name and a direct or general URL to the data.
    7. **Language**: ${languageInstruction}
    8. Return strict JSON.
  `;

  try {
    console.log(`[API] Fetching new data for "${query}" in ${language}...`);
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            titleEn: { type: Type.STRING, description: "Title in English for filename usage" },
            category: { type: Type.STRING },
            yAxisLabel: { type: Type.STRING },
            data: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  year: { type: Type.STRING },
                  usa: { type: Type.NUMBER, description: "Value for USA" },
                  china: { type: Type.NUMBER, description: "Value for China" },
                },
                required: ["year", "usa", "china"],
              },
            },
            summary: { type: Type.STRING },
            detailedAnalysis: { type: Type.STRING },
            futureOutlook: { type: Type.STRING },
            sources: { 
              type: Type.ARRAY, 
              items: { 
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  url: { type: Type.STRING }
                },
                required: ["title", "url"]
              },
              description: "List of data sources with URLs"
            }
          },
          required: ["title", "titleEn", "data", "yAxisLabel", "summary", "detailedAnalysis", "futureOutlook", "sources"],
        },
      },
    });

    const jsonText = response.text;
    if (!jsonText) {
      throw new Error("Empty response from Gemini");
    }

    const result = JSON.parse(jsonText) as ComparisonResponse;

    // 2. Save to cache
    try {
      localStorage.setItem(cacheKey, JSON.stringify(result));
      console.log(`[Cache] Saved "${query}" (${language})`);
    } catch (e) {
      console.warn("[Cache] Failed to save to local storage (likely quota exceeded)", e);
    }

    return result;
  } catch (error) {
    console.error("Error fetching comparison data:", error);
    throw error;
  }
};