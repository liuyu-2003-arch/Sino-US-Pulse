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
            // Index