import OpenAI from "openai";
import { ComparisonResponse, Language, SavedComparison } from "../types";
import type { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const client = new OpenAI({
    apiKey: process.env.VITE_MIMO_API_KEY,
    baseURL: "https://api.xiaomimimo.com/v1",
});

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
        const s3Client = await getS3Client();
        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            Body: JSON.stringify(data),
            ContentType: "application/json",
            CacheControl: "public, max-age=86400"
        });
        await s3Client.send(command);
    } catch (error) {
        console.warn("[R2] Upload Failed.", error);
        throw error;
    }
};

interface LibraryIndexItem {
    key: string;
    titleZh: string;
    titleEn: string;
    summary?: string;
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
        const s3Client = await getS3Client();
        let index: LibraryIndex = { items: [] };
        try {
            const getCmd = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: LIBRARY_INDEX_KEY });
            const res = await s3Client.send(getCmd);
            if (res.Body) {
                const str = await res.Body.transformToString();
                index = JSON.parse(str);
            }
        } catch (e: any) {
            if (e.name !== 'NoSuchKey') console.warn("Index fetch failed", e);
        }

        index.items = index.items.filter(i => i.key !== newItem.key);
        index.items.push(newItem);

        const putCmd = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: LIBRARY_INDEX_KEY,
            Body: JSON.stringify(index),
            ContentType: "application/json",
            CacheControl: "no-cache"
        });
        await s3Client.send(putCmd);
    } catch (e) {
        console.error("[R2] Index update failed", e);
    }
};

export const deleteComparison = async (key: string) => {
    try {
        const { DeleteObjectCommand, PutObjectCommand, GetObjectCommand } = await import("@aws-sdk/client-s3");
        const s3Client = await getS3Client();

        try {
            const delCmd = new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key });
            await s3Client.send(delCmd);
        } catch (e) {
            console.warn("Physical deletion failed (likely CORS), proceeding to update index.", e);
        }

        let index: LibraryIndex = { items: [] };
        try {
            const getCmd = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: LIBRARY_INDEX_KEY });
            const res = await s3Client.send(getCmd);
            if (res.Body) {
                const str = await res.Body.transformToString();
                index = JSON.parse(str);
            }
        } catch (e: any) {
            return;
        }

        const newItems = index.items.filter(i => i.key !== key);
        if (newItems.length !== index.items.length) {
            index.items = newItems;
            const putCmd = new PutObjectCommand({
                Bucket: BUCKET_NAME,
                Key: LIBRARY_INDEX_KEY,
                Body: JSON.stringify(index),
                ContentType: "application/json",
                CacheControl: "no-cache"
            });
            await s3Client.send(putCmd);
        }
    } catch (e) {
        console.error("Delete failed", e);
        throw e;
    }
};

export const listSavedComparisons = async (language: Language): Promise<SavedComparison[]> => {
    const index = await fetchLibraryIndex();
    return index.items.map(item => ({
        key: item.key,
        filename: item.key.split('/').pop() || item.key,
        titleEn: item.titleEn,
        titleZh: item.titleZh,
        summary: item.summary,
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
            const s3Client = await getS3Client();
            const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key });
            const response = await s3Client.send(command);
            if (!response.Body) throw new Error("Empty body");
            const str = await response.Body.transformToString();
            const data = JSON.parse(str);
            return { ...data, source: 'r2' };
        } catch (s3Error) {
            throw s3Error;
        }
    }
};

export const saveEditedComparison = async (key: string, data: ComparisonResponse) => {
    try {
        const payload = { ...data, source: 'r2' };

        await uploadToR2(key, payload);

        await updateLibraryIndex({
            key,
            titleEn: data.titleEn || data.title,
            titleZh: data.titleZh || data.title,
            summary: data.summary,
            category: data.category || 'Custom',
            lastModified: new Date().toISOString()
        });
    } catch (e) {
        console.error("Save edit failed", e);
        throw e;
    }
};

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

async function withRetry<T>(fn: () => Promise<T>, context: string): Promise<T> {
    let lastError: any;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            return await fn();
        } catch (error: any) {
            lastError = error;
            const isRateLimit = error?.status === 429 || error?.code === 429 ||
                error?.message?.includes('429') || error?.message?.includes('rate limit');

            if (isRateLimit && attempt < MAX_RETRIES - 1) {
                const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
                console.warn(`[${context}] Rate limited (429), retrying in ${delay}ms... (attempt ${attempt + 1}/${MAX_RETRIES})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            throw error;
        }
    }
    throw lastError;
}

const systemPrompt = `You are a data analysis assistant. Generate a JSON response with the following schema:
{
    "title": "Short title of the comparison",
    "titleEn": "Clean English title, no meta-commentary",
    "titleZh": "Clean Chinese title, no meta-commentary",
    "category": "Category name",
    "yAxisLabel": "Concise unit label (e.g. 'Billions USD')",
    "summary": "A concise 1-2 sentence summary (max 100 words)",
    "detailedAnalysis": "Detailed analysis text",
    "futureOutlook": "Future outlook text",
    "data": [{"year": "YYYY", "usa": number, "china": number}],
    "sources": [{"title": "Source title", "url": "Source URL"}]
}
STRICT RULES:
1. Titles MUST be concise and factual (e.g. "USA vs China GDP per Capita")
2. DO NOT include any instructions, meta-commentary, or technical notes
3. Data values MUST be numbers, not strings
4. yAxisLabel MUST be very short and clean (e.g. "Billions USD", "Percentage", "Tons"). DO NOT include notes or text in brackets []
5. Summary MUST be a concise overview (max 100 words)
6. Output ONLY the JSON, no markdown code blocks or any other text`;

export const fetchComparisonData = async (
    query: string,
    language: Language,
    forceRefresh: boolean = false,
    canCreate: boolean = false
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
        } catch (e) { }
    }

    if (!canCreate) {
        throw { code: 'PERMISSION_DENIED', message: 'Only administrators can generate new comparisons.' };
    }

    const langName = language === 'zh' ? 'Chinese (Simplified)' : 'English';
    const userPrompt = `Compare the United States (USA) and China for: "${query}".
Provide historical yearly data (starting from 1945 where possible up to 2024), analysis, and outlook.
Response language: ${langName}.`;

    const completion = await withRetry(async () => {
        return await client.chat.completions.create({
            model: "mimo-v2-pro",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            response_format: { type: "json_object" },
            temperature: 0.3,
        });
    }, 'fetchComparisonData');

    const text = completion.choices[0]?.message?.content;
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
                summary: data.summary,
                category: data.category || 'Custom',
                lastModified: new Date().toISOString()
            });
        } catch (e) {
            console.error("Sync failed", e);
        }
    })();

    return { data, uploadPromise };
};
