import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ComparisonResponse, Language, SavedComparison } from "../types";
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
        } catch (e: any) {
             // NoSuchKey is expected if index doesn't exist yet
             if (e.name !== 'NoSuchKey') {
                 console.warn("Failed to fetch index for update", e);
             }
        }

        // 2. Update Index (Remove duplicate keys or titles to ensure freshness)
        index.items = index.items.filter(i => i.key !== newItem.key && i.titleEn !== newItem.titleEn);
        index.items.push(newItem);

        // 3. Save
        const putCmd = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: LIBRARY_INDEX_KEY,
            Body: JSON.stringify(index),
            ContentType: "application/json",
            CacheControl: "no-cache"
        });

        await client.send(putCmd);
        console.log(`[R2] Index updated for ${newItem.titleEn}`);

    } catch (e) {
        console.error("[R2] Failed to update library index", e);
    }
};

// --- Main Service Functions ---

export const listSavedComparisons = async (language: Language): Promise<SavedComparison[]> => {
    const index = await fetchLibraryIndex();
    return index.items.map(item => ({
        key: item.key,
        filename: item.key.split('/').pop() || item.key,
        titleEn: item.titleEn,
        titleZh: item.titleZh,
        category: item.category,
        lastModified: new Date(item.lastModified)
    })).sort((a, b) => (b.lastModified?.getTime() || 0) - (a.lastModified?.getTime() || 0));
};

export const fetchSavedComparisonByKey = async (key: string): Promise<ComparisonResponse> => {
    // Try public URL first
    try {
        const response = await fetch(`${PUBLIC_URL_BASE}/${key}?t=${Date.now()}`);
        if (!response.ok) throw new Error("Failed to fetch from public URL");
        const data = await response.json();
        return { ...data, source: 'r2' };
    } catch (e) {
        // Fallback to S3 direct fetch (in case public access is restricted or delayed)
        try {
            const { GetObjectCommand } = await import("@aws-sdk/client-s3");
            const client = await getS3Client();
            const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key });
            const response = await client.send(command);
            if (!response.Body) throw new Error("Empty body");
            const str = await response.Body.transformToString();
            const data = JSON.parse(str);
            return { ...data, source: 'r2' };
        } catch (s3Error) {
            console.error("Failed to fetch saved comparison", s3Error);
            throw s3Error;
        }
    }
};

const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
        title: { type: Type.STRING, description: "Main title of the comparison." },
        titleEn: { type: Type.STRING, description: "English title." },
        titleZh: { type: Type.STRING, description: "Chinese title." },
        category: { type: Type.STRING, description: "Category of the comparison (Economy, Technology, etc)." },
        yAxisLabel: { type: Type.STRING, description: "Label for the Y-axis." },
        summary: { type: Type.STRING, description: "Executive summary of the comparison." },
        detailedAnalysis: { type: Type.STRING, description: "Detailed analysis of the trends." },
        futureOutlook: { type: Type.STRING, description: "Future outlook and predictions." },
        data: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    year: { type: Type.STRING },
                    usa: { type: Type.NUMBER },
                    china: { type: Type.NUMBER }
                }
            }
        },
        sources: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    url: { type: Type.STRING }
                }
            }
        }
    },
    required: ["title", "titleEn", "titleZh", "data", "summary", "detailedAnalysis", "futureOutlook"]
};

export const fetchComparisonData = async (
    query: string, 
    language: Language, 
    forceRefresh: boolean = false
): Promise<{ data: ComparisonResponse; uploadPromise?: Promise<void> }> => {
    
    // 1. Check Cache (if not forced)
    if (!forceRefresh) {
        try {
            const index = await fetchLibraryIndex();
            const match = index.items.find(item => 
                item.titleEn.toLowerCase() === query.toLowerCase() || 
                item.titleZh === query ||
                (item.titleEn.toLowerCase().includes(query.toLowerCase()) && query.length > 15) // strict-ish fuzzy match
            );
            
            if (match) {
                console.log(`[Cache] Hit for query "${query}" -> ${match.key}`);
                const cachedData = await fetchSavedComparisonByKey(match.key);
                return { data: cachedData };
            }
        } catch (e) {
            console.warn("[Cache] Lookup failed", e);
        }
    }

    // 2. Generate Content via Gemini
    const langName = language === 'zh' ? 'Chinese (Simplified)' : 'English';
    const prompt = `
        Compare the United States (USA) and China for the following topic: "${query}".
        Provide historical data (yearly), a comprehensive summary, detailed trend analysis, and future outlook.
        Data should be as accurate as possible.
        Language of response: ${langName}.
        Ensure 'titleEn' and 'titleZh' are accurately translated.
        For the data array, ensure you cover a significant historical range if applicable (e.g. 1980-2024).
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: responseSchema
        }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from Gemini");

    let data: ComparisonResponse;
    try {
        data = JSON.parse(text);
        data.source = 'api';
    } catch (e) {
        console.error("Failed to parse Gemini response", text);
        throw new Error("Invalid JSON response from AI");
    }

    // 3. Prepare Upload (Background Sync)
    // We return the data immediately, but pass a promise that resolves when R2 upload completes.
    const uploadPromise = (async () => {
        try {
            const safeTitle = (data.titleEn || data.title || 'untitled').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
            const filename = `${safeTitle}_${Date.now()}.json`; // Timestamp to avoid collisions? Or just title? Title is cleaner for URLs.
            // Let's use title but clean it.
            const cleanFilename = `${safeTitle}.json`;
            const key = `${DATA_FOLDER}/${cleanFilename}`;

            await uploadToR2(key, data);
            
            await updateLibraryIndex({
                key,
                titleEn: data.titleEn || data.title,
                titleZh: data.titleZh || data.title,
                category: data.category || 'Custom',
                lastModified: new Date().toISOString()
            });
        } catch (e) {
            console.error("Background sync failed", e);
            throw e;
        }
    })();

    return { data, uploadPromise };
};
