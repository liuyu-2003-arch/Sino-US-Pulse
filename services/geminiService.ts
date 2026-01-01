
import { GoogleGenAI, Type } from "@google/genai";
import { ComparisonResponse, Language, SavedComparison } from "../types";
// Use Type-Only import to avoid runtime dependency at top-level
import type { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const BUCKET_NAME = process.env.R2_BUCKET_NAME;
const PUBLIC_URL_BASE = `https://${process.env.R2_PUBLIC_URL}`;
const DATA_FOLDER = "sino-pulse/v1"; 
const LIBRARY_INDEX_KEY = "sino-pulse/v1/library_index.json";

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
  } catch (error) {
    console.warn("[R2] Upload Failed.", error);
    throw error;
  }
};

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
        const response = await fetch(`${PUBLIC_URL_BASE}/${LIBRARY_INDEX_KEY}?t=${Date.now()}`);
        if (response.ok) return await response.json();
        return { items: [] };
    } catch (e) {
        return { items: [] };
    }
};

const updateLibraryIndex = async (newItem: LibraryIndexItem) => {
    try {
        const { PutObjectCommand, GetObjectCommand } = await import("@aws-sdk/client-s3");
        const client = await getS3Client();
        let index: LibraryIndex = { items: [] };
        try {
            const getCmd = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: LIBRARY_INDEX_KEY });
            const res = await client.send(getCmd);
            if (res.Body) {
                const str = await res.Body.transformToString();
                index = JSON.parse(str);
            }
        } catch (e: any) {
             if (e.name !== 'NoSuchKey') console.warn("Index fetch failed", e);
        }
        index.items = index.items.filter(i => i.key !== newItem.key && i.titleEn !== newItem.titleEn);
        index.items.push(newItem);
        const putCmd = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: LIBRARY_INDEX_KEY,
            Body: JSON.stringify(index),
            ContentType: "application/json",
            CacheControl: "no-cache"
        });
        await client.send(putCmd);
    } catch (e) {
        console.error("[R2] Index update failed", e);
    }
};

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
    try {
        const response = await fetch(`${PUBLIC_URL_BASE}/${key}?t=${Date.now()}`);
        if (!response.ok) throw new Error("Public fetch failed");
        const data = await response.json();
        return { ...data, source: 'r2' };
    } catch (e) {
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
            throw s3Error;
        }
    }
};

const responseSchema = {
    type: Type.OBJECT,
    properties: {
        title: { type: Type.STRING, description: "Short title of the comparison." },
        titleEn: { type: Type.STRING, description: "Clean English title, no meta-commentary." },
        titleZh: { type: Type.STRING, description: "Clean Chinese title, no meta-commentary." },
        category: { type: Type.STRING },
        yAxisLabel: { type: Type.STRING },
        summary: { type: Type.STRING },
        detailedAnalysis: { type: Type.STRING },
        futureOutlook: { type: Type.STRING },
        data: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    year: { type: Type.STRING },
                    usa: { type: Type.NUMBER },
                    china: { type: Type.NUMBER }
                },
                required: ["year", "usa", "china"]
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
    if (!forceRefresh) {
        try {
            const index = await fetchLibraryIndex();
            const match = index.items.find(item => 
                item.titleEn.toLowerCase() === query.toLowerCase() || 
                item.titleZh === query
            );
            if (match) {
                const cachedData = await fetchSavedComparisonByKey(match.key);
                return { data: cachedData };
            }
        } catch (e) {}
    }

    const langName = language === 'zh' ? 'Chinese (Simplified)' : 'English';
    const prompt = `
        Compare the United States (USA) and China for: "${query}".
        Provide historical yearly data (e.g. 1980 to 2023), analysis, and outlook.
        STRICT RULES:
        1. Titles MUST be concise and factual (e.g. "USA vs China GDP per Capita"). 
        2. DO NOT include any instructions, meta-commentary, or technical notes in the title fields.
        3. Response language: ${langName}.
        4. Data values MUST be numbers, not strings.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: responseSchema
        }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response");

    const data: ComparisonResponse = JSON.parse(text);
    data.source = 'api';

    const uploadPromise = (async () => {
        try {
            const safeTitle = (data.titleEn || data.title || 'untitled').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
            const key = `${DATA_FOLDER}/${safeTitle}.json`;
            await uploadToR2(key, data);
            await updateLibraryIndex({
                key,
                titleEn: data.titleEn || data.title,
                titleZh: data.titleZh || data.title,
                category: data.category || 'Custom',
                lastModified: new Date().toISOString()
            });
        } catch (e) {
            console.error("Sync failed", e);
        }
    })();

    return { data, uploadPromise };
};
