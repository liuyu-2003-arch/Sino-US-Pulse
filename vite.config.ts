import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY || process.env.API_KEY),
      // R2 Configuration
      'process.env.R2_BUCKET_NAME': JSON.stringify('324893xyz'),
      'process.env.R2_PUBLIC_URL': JSON.stringify('cloud.324893.xyz'),
      'process.env.R2_ACCESS_KEY_ID': JSON.stringify('f12c066d978c60a536fa00d60b914b9a'),
      'process.env.R2_SECRET_ACCESS_KEY': JSON.stringify('XnLbnhlpfmgpsEQr0JuBGMpscrtgbsqaBQGwIMPx'),
      'process.env.R2_ENDPOINT': JSON.stringify('https://dd0afffd8fff1c8846db83bc10e2aa1f.r2.cloudflarestorage.com/')
    },
    build: {
      target: 'esnext'
    }
  };
});