import { GoogleGenAI, Type } from "@google/genai";
import { ComparisonResponse, Language } from "../types";

// Initialize the API client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const CACHE_PREFIX = 'sino_pulse_cache_v1_';

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
    ? "Provide the response content (title, yAxisLabel, summary, detailedAnalysis, futureOutlook, sources) in Simplified Chinese. Ensure the 'summary', 'detailedAnalysis', and 'futureOutlook' are formatted with Markdown using bullet points for key insights to avoid walls of text." 
    : "Provide the response content in English. Ensure the 'summary', 'detailedAnalysis', and 'futureOutlook' are formatted with Markdown using bullet points for key insights to avoid walls of text.";

  const prompt = `
    Generate a comparative analysis and historical data dataset between China and the United States for the following topic: "${query}".
    
    Requirements:
    1. **Data Granularity**: Provide data points for **every single year** (1-year granularity). Do not skip years.
    2. **Time Range**: Start from **1945** (or the earliest year data is available/relevant after 1945) and go up to **2024**.
    3. **Missing Data**: If specific yearly data is missing, interpolate reasonably or use 0 if the metric did not exist at that time.
    4. Both 'usa' and 'china' values must be numbers.
    5. Provide a title, axis labels.
    6. **Content Structure**:
       - **Summary**: Key takeaways in bullet points.
       - **Detailed Analysis**: A structured markdown analysis explaining the trends, eras, and key turning points (use headers/bullet points).
       - **Future Outlook**: Predictions in bullet points.
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
          required: ["title", "data", "yAxisLabel", "summary", "detailedAnalysis", "sources"],
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