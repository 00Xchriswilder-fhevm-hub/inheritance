import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import mkcert from 'vite-plugin-mkcert';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        https: true, // Enable HTTPS for Porto WebAuthn support
      },
      plugins: [
        react(),
        mkcert(), // Enable HTTPS with self-signed certificates for development
      ],
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
        },
        // Critical: Dedupe ensures single instance of React/ethers across all packages
        // This prevents "Cannot read properties of null" and initialization errors
        dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'ethers'],
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
              // Critical: Keep React and React-dependent libraries in main bundle
              // This prevents "Cannot read properties of null/undefined" errors
              if (id.includes('node_modules')) {
                // Keep React in main bundle - don't split it
                if (id.includes('react') || id.includes('react-dom') || id.includes('react/jsx-runtime')) {
                  return undefined; // Include in main bundle
                }
                // Keep wagmi/viem in main bundle since they depend on React
                // Splitting them causes React context errors
                if (id.includes('wagmi') || id.includes('viem') || id.includes('@tanstack/react-query')) {
                  return undefined; // Include in main bundle with React
                }
                // Keep RainbowKit in main bundle (depends on wagmi/React)
                if (id.includes('@rainbow-me/rainbowkit')) {
                  return undefined; // Include in main bundle
                }
                // Keep ethers in main bundle to avoid initialization order issues
                // The "Cannot access 'WP' before initialization" error suggests
                // circular dependency issues when splitting ethers
                if (id.includes('ethers')) {
                  return undefined; // Include in main bundle
                }
                // Split other large dependencies
                return 'vendor';
              }
            },
          },
        },
      },
    };
});
