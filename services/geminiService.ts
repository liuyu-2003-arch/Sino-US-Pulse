import { GoogleGenAI, Type } from "@google/genai";
import { ComparisonResponse, Language, SavedComparison } from "../types";
// Use Type-Only import to avoid runtime dependency at top-level
import type { S3Client, PutObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

// Initialize the Gemini API client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Constants
const BUCKET_NAME = process.env.R2_BUCKET_NAME;
const PUBLIC_URL_BASE = `https://${process.env.R2_PUBLIC_URL}`;
const DATA_FOLDER = "sino-pulse/v1"; 

// Helper to dynamically load AWS SDK only when needed
const getS3Client = async () => {
    const { S3Client } = await import("@aws-sdk/client-s3");
    return new S3Client({
      region: "auto",
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
      },
    });
};

const uploadToR2 = async (key: string, data: any) => {
  try {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await getS3Client();

    const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: JSON.stringify(data),
        ContentType: "application/json",
        CacheControl: "public, max-age=86400" 
    });

    await client.send(command);
    console.log(`[R2] Upload successful: ${key}`);
  } catch (error) {
    console.warn("[R2] Failed to initialize SDK or Upload.", error);
    throw error; // Rethrow to allow UI to show sync error state
  }
};

export const listSavedComparisons = async (language: Language): Promise<SavedComparison[]> => {
    try {
        const { ListObjectsV2Command } = await import("@aws-sdk/client-s3");
        const client = await getS3Client();

        const prefix = `${DATA_FOLDER}/${language}/`;
        const command = new ListObjectsV2Command({
            Bucket: BUCKET_NAME,
            Prefix: prefix
        });

        const response = await client.send(command);
        
        if (!response.Contents) return [];

        return response.Contents
            .filter(item => item.Key?.endsWith('.json'))
            .sort((a, b) => (b.LastModified?.getTime() || 0) - (a.LastModified?.getTime() || 0)) // Newest first
            .map(item => {
                const filename = item.Key!.split('/').pop() || '';
                const nameWithoutExt = filename.replace('.json', '');
                // Prettify: replace _ with space, capitalize
                const displayName = nameWithoutExt.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                
                return {
                    key: item.Key!,
                    filename: filename,
                    displayName: displayName,
                    lastModified: item.LastModified,
                    size: item.Size
                };
            });

    } catch (error) {
        console.error("Failed to list saved comparisons", error);
        return [];
    }
};

export const fetchSavedComparisonByKey = async (key: string): Promise<ComparisonResponse> => {
     const publicFileUrl = `${PUBLIC_URL_BASE}/${key}`;
     try {
        const response = await fetch(publicFileUrl);
        if (!response.ok) throw new Error("Failed to fetch saved file");
        const data = await response.json();
        return { ...data, source: 'r2' };
     } catch (e) {
        console.error("Error fetching specific key from R2", e);
        throw e;
     }
};

export const fetchComparisonData = async (
  query: string,
  language: Language,
  forceRefresh: boolean = false
): Promise<{ data: ComparisonResponse; uploadPromise?: Promise<void> }> => {
  // Generate a robust, normalized key for the file
  const normalizedQuery = query.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const fileKey = `${DATA_FOLDER}/${language}/${normalizedQuery}.json`;
  const publicFileUrl = `${PUBLIC_URL_BASE}/${fileKey}`;

  // 1. READ: Try to fetch from R2 Public URL first
  if (!forceRefresh) {
    try {
      console.log(`[R2] Checking for existing data: ${publicFileUrl}`);
      const response = await fetch(publicFileUrl, { method: 'GET' });
      
      if (response.ok) {
        const data = await response.json();
        if (data && data.data) {
           console.log(`[R2] Hit! Loaded "${query}" (${language}) from cloud.`);
           return { data: { ...data, source: 'r2' } as ComparisonResponse };
        }
      } else if (response.status !== 404) {
         console.warn(`[R2] Unexpected status fetching data: ${response.status}`);
      }
    } catch (e) {
      console.warn("[R2] Failed to fetch from public URL", e);
    }
  }

  // 2. FETCH: Call Gemini API
  const modelId = "gemini-3-flash-preview"; 

  const languageInstruction = language === 'zh' 
    ? "Provide the response content in Simplified Chinese. **CRITICAL FOR FORMATTING**: In 'detailedAnalysis', you MUST use '###' for era headers (e.g. ### 1945-1979) and bullet points. NEVER write a single long paragraph. Always use double newlines between sections." 
    : "Provide the response content in English. **CRITICAL FOR FORMATTING**: In 'detailedAnalysis', you MUST use '###' for era headers and bullet points. NEVER write a single long paragraph. Always use double newlines between sections.";

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
       - **Detailed Analysis**: A structured markdown analysis. **MUST** divide the timeline into 3-4 distinct eras. Use **'###' markdown headers** for each era (e.g., "### 1945-1978: Post-War divergence"). Use bullet points for key events within each era. Ensure double line breaks between eras. **Do NOT** include a main header like "Trend Analysis".
       - **Future Outlook**: A prediction of future trends based on current data. **Do NOT** include a header like "Future Outlook" at the start.
       - **Sources**: List 3-5 primary data sources (e.g., World Bank, IMF, Statista) used to derive this data. Provide the source name and a direct or general URL to the data.
    7. **Language**: ${languageInstruction}
    8. Return strict JSON.
  `;

  try {
    console.log(`[API] Fetching new data for "${query}" in ${language} (Force Refresh: ${forceRefresh})...`);
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
    const resultWithSource = { ...result, source: 'api' } as ComparisonResponse;

    // 3. WRITE: Upload to R2 Bucket (Return promise for UI tracking)
    const uploadPromise = uploadToR2(fileKey, result);

    return { data: resultWithSource, uploadPromise };
  } catch (error) {
    console.error("Error fetching comparison data:", error);
    throw error;
  }
};