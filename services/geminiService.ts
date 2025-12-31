import { GoogleGenAI, Type } from "@google/genai";
import { ComparisonResponse, Language, SavedComparison, PRESET_QUERIES } from "../types";
// Use Type-Only import to avoid runtime dependency at top-level
import type { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";

// Initialize the Gemini API client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Constants
const BUCKET_NAME = process.env.R2_BUCKET_NAME;
const PUBLIC_URL_BASE = `https://${process.env.R2_PUBLIC_URL}`;
const DATA_FOLDER = "sino-pulse/v1"; 
const LIBRARY_INDEX_KEY = "sino-pulse/v1/library_index.json";

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

// --- Library Index Management ---
// We maintain a JSON file in R2 that acts as a database/index for all saved files.
// This allows us to store the correct localized titles (Zh/En) and categories, 
// which are not available in standard S3 file listings.

interface LibraryIndexItem {
    key: string;
    titleZh: string;
    titleEn: string;
    category: string;
    lastModified: string;
}

interface LibraryIndex {
    items: LibraryIndexItem[];
}

const fetchLibraryIndex = async (): Promise<LibraryIndex> => {
    try {
        // Try fetching via public URL for speed
        const response = await fetch(`${PUBLIC_URL_BASE}/${LIBRARY_INDEX_KEY}?t=${Date.now()}`);
        if (response.ok) {
            return await response.json();
        }
        return { items: [] };
    } catch (e) {
        return { items: [] };
    }
};

const updateLibraryIndex = async (newItem: LibraryIndexItem) => {
    try {
        const { PutObjectCommand, GetObjectCommand } = await import("@aws-sdk/client-s3");
        const client = await getS3Client();

        // 1. Fetch existing index (S3 consistent read preferred over public URL for updates)
        let index: LibraryIndex = { items: [] };
        try {
            const getCmd = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: LIBRARY_INDEX_KEY });
            const res = await client.send(getCmd);
            if (res.Body) {
                const str = await res.Body.transformToString();
                index = JSON.parse(str);
            }
        } catch (e) {
            // Index doesn't exist yet, start fresh
            console.log("Creating new library index");
        }

        // 2. Update or Append
        const existingIndex = index.items.findIndex(i => i.key === newItem.key);
        if (existingIndex >= 0) {
            index.items[existingIndex] = newItem;
        } else {
            index.items.push(newItem);
        }

        // 3. Save back
        const putCmd = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: LIBRARY_INDEX_KEY,
            Body: JSON.stringify(index),
            ContentType: "application/json",
            CacheControl: "no-cache" // Important for index
        });
        await client.send(putCmd);
        console.log("[R2] Library Index Updated");

    } catch (e) {
        console.error("Failed to update library index", e);
        // We don't throw here to avoid failing the main user flow if indexing fails
    }
};

// Logic to try and repair missing Chinese titles by checking against known Presets
const getSmartTitles = (filename: string, rawTitleZh?: string, rawTitleEn?: string) => {
    const normalizeKey = (str: string) => str.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const coreKey = filename.replace('.json', '');
    const normalizedCore = normalizeKey(coreKey);

    // 1. Exact Preset Match
    let matchedPreset = PRESET_QUERIES.find(p => normalizeKey(p.query) === normalizedCore);

    // 2. Fuzzy/Keyword Match (Manual Overrides for common mismatches)
    if (!matchedPreset) {
        if (coreKey.includes('disposable_income') || coreKey.includes('income_per_capita')) {
             matchedPreset = PRESET_QUERIES.find(p => p.labelEn.includes("Disposable Income"));
        }
    }

    let titleZh = rawTitleZh;
    let titleEn = rawTitleEn;

    // Fix Zh: If missing OR if it looks like ASCII English (e.g. "Sino-US...")
    const isZhInvalid = !titleZh || /^[\x00-\x7F]+$/.test(titleZh);
    
    if (isZhInvalid && matchedPreset) {
        titleZh = matchedPreset.labelZh;
    }
    
    if (!titleEn && matchedPreset) {
        titleEn = matchedPreset.labelEn;
    }

    return { titleZh, titleEn };
};


export const listSavedComparisons = async (language: Language): Promise<SavedComparison[]> => {
    try {
        const index = await fetchLibraryIndex();
        
        if (index.items.length > 0) {
            return index.items
                .sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime())
                .map(item => {
                    const filename = item.key.split('/').pop() || '';
                    const { titleZh, titleEn } = getSmartTitles(filename, item.titleZh, item.titleEn);
                    
                    return {
                        key: item.key,
                        filename: filename,
                        titleZh: titleZh,
                        titleEn: titleEn,
                        displayName: language === 'zh' ? (titleZh || titleEn) : (titleEn || titleZh),
                        category: item.category,
                        lastModified: new Date(item.lastModified)
                    };
                });
        }

        // Fallback: Use ListObjectsV2
        console.warn("Index not found or empty, falling back to raw S3 listing");
        const { ListObjectsV2Command } = await import("@aws-sdk/client-s3");
        const client = await getS3Client();

        const command = new ListObjectsV2Command({
            Bucket: BUCKET_NAME,
            Prefix: `${DATA_FOLDER}/${language}/`
        });

        const response = await client.send(command);
        if (!response.Contents) return [];

        return response.Contents
            .filter(item => item.Key?.endsWith('.json'))
            .sort((a, b) => (b.LastModified?.getTime() || 0) - (a.LastModified?.getTime() || 0))
            .map(item => {
                const filename = item.Key!.split('/').pop() || '';
                const nameWithoutExt = filename.replace('.json', '');
                
                // Try to make it look nice
                let defaultName = nameWithoutExt.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                
                // Apply smart repair to get Chinese title if it matches a preset
                const { titleZh, titleEn } = getSmartTitles(filename, undefined, defaultName);
                
                const finalDisplayName = language === 'zh' 
                    ? (titleZh || titleEn || defaultName) 
                    : (titleEn || defaultName);

                return {
                    key: item.Key!,
                    filename: filename,
                    displayName: finalDisplayName,
                    titleZh: titleZh || defaultName,
                    titleEn: titleEn || defaultName,
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
  // CHANGED: Allow Chinese characters in filename to avoid "____.json" for pure Chinese queries
  const normalizedQuery = query.trim().toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_\u4e00-\u9fa5]+/g, '');
    
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
    ? "Provide the 'detailedAnalysis', 'summary', 'futureOutlook' and 'yAxisLabel' content in Simplified Chinese. **CRITICAL FOR FORMATTING**: In 'detailedAnalysis', you MUST use '###' for era headers (e.g. ### 1945-1979) and bullet points. NEVER write a single long paragraph. Always use double newlines between sections." 
    : "Provide the 'detailedAnalysis', 'summary', 'futureOutlook' and 'yAxisLabel' content in English. **CRITICAL FOR FORMATTING**: In 'detailedAnalysis', you MUST use '###' for era headers and bullet points. NEVER write a single long paragraph. Always use double newlines between sections.";

  const prompt = `
    Generate a comparative analysis and historical data dataset between China and the United States for the following topic: "${query}".
    
    Requirements:
    1. **Data Granularity**: Provide data points for **every single year** (1-year granularity). Do not skip years.
    2. **Time Range**: Start from **1945** (or the earliest year data is available/relevant after 1945) and go up to **2024**.
    3. **Missing Data**: If specific yearly data is missing, interpolate reasonably or use 0 if the metric did not exist at that time.
    4. Both 'usa' and 'china' values must be numbers.
    5. **Title Formatting**: 
       - 'title': The display title in the requested language (${language}). Format: "Sino-US [Topic] Comparison" (or "中美[Topic]对比"). **Do NOT** include specific year ranges (e.g., 1945-2024).
       - 'titleEn': ALWAYS provide the English title. Format: "Sino-US [Topic] Comparison". **Do NOT** include years.
       - 'titleZh': ALWAYS provide the Chinese title in **Simplified Chinese Characters**. Format: "中美[Topic]对比". **Do NOT** include years.
    6. **Content Structure**:
       - **Summary**: A concise executive summary of the comparison.
       - **Detailed Analysis**: A structured markdown analysis. **MUST** divide the timeline into 3-4 distinct eras. Use **'###' markdown headers** for each era.
       - **Future Outlook**: A prediction of future trends.
       - **Sources**: List 3-5 primary data sources.
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
            title: { type: Type.STRING, description: "Display title in requested language" },
            titleEn: { type: Type.STRING, description: "English Title (No years)" },
            titleZh: { type: Type.STRING, description: "Chinese Title (Simplified Chinese Characters)" },
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
          required: ["title", "titleEn", "titleZh", "data", "yAxisLabel", "summary", "detailedAnalysis", "futureOutlook", "sources"],
        },
      },
    });

    const jsonText = response.text;
    if (!jsonText) {
      throw new Error("Empty response from Gemini");
    }

    const result = JSON.parse(jsonText) as ComparisonResponse;
    
    // Ensure titles are populated if the model was lazy (fallback logic)
    // Only fallback titleZh to title if we are SURE title is Chinese or if we have no choice.
    if (!result.titleZh) {
        if (language === 'zh') {
            result.titleZh = result.title;
        } else {
            // Try to match preset if missing
             const { titleZh } = getSmartTitles(normalizedQuery, undefined, undefined);
             if (titleZh) result.titleZh = titleZh;
        }
    }
    if (!result.titleEn) result.titleEn = language === 'en' ? result.title : result.title;

    const resultWithSource = { ...result, source: 'api' } as ComparisonResponse;

    // 3. WRITE: Upload to R2 Bucket AND Update Index
    const uploadPromise = Promise.all([
        uploadToR2(fileKey, result),
        updateLibraryIndex({
            key: fileKey,
            titleZh: result.titleZh,
            titleEn: result.titleEn,
            category: result.category,
            lastModified: new Date().toISOString()
        })
    ]).then(() => void 0); // Normalize to void promise

    return { data: resultWithSource, uploadPromise };
  } catch (error) {
    console.error("Error fetching comparison data:", error);
    throw error;
  }
};
