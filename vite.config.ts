import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY || process.env.API_KEY),
      // R2 Configuration - Now correctly pulling from environment variables
      'process.env.R2_BUCKET_NAME': JSON.stringify(env.R2_BUCKET_NAME || ''),
      'process.env.R2_PUBLIC_URL': JSON.stringify(env.R2_PUBLIC_URL || ''),
      'process.env.R2_ACCESS_KEY_ID': JSON.stringify(env.R2_ACCESS_KEY_ID || ''),
      'process.env.R2_SECRET_ACCESS_KEY': JSON.stringify(env.R2_SECRET_ACCESS_KEY || ''),
      'process.env.R2_ENDPOINT': JSON.stringify(env.R2_ENDPOINT || '')
    },
    build: {
      target: 'esnext'
    }
  };
});