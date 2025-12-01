import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
          '@fhevm-sdk': path.resolve(__dirname, '../fhevm-sdk/src'),
          // Stub out Vue to prevent import errors in React app
          'vue': path.resolve(__dirname, 'vue-empty.js'),
        }
      },
      optimizeDeps: {
        exclude: ['vue'],
        include: ['react', 'react-dom', 'react/jsx-runtime'],
      },
      build: {
        commonjsOptions: {
          include: [/node_modules/],
          transformMixedEsModules: true,
        },
        rollupOptions: {
          output: {
            manualChunks(id) {
              // Don't split React - keep it in the main bundle to ensure it's available
              // This prevents "Cannot read properties of null (reading 'useState')" errors
              if (id.includes('node_modules')) {
                // Keep React in main bundle - don't split it
                if (id.includes('react') || id.includes('react-dom') || id.includes('react/jsx-runtime')) {
                  return undefined; // Include in main bundle, not a separate chunk
                }
                // Split other large dependencies
                if (id.includes('wagmi') || id.includes('viem')) {
                  return 'web3-vendor';
                }
                if (id.includes('ethers')) {
                  return 'ethers-vendor';
                }
                return 'vendor';
              }
            },
          },
        },
      },
    };
});
