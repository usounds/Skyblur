import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import metadata from './public/client-metadata.json' with { type: 'json' };
import { visualizer } from 'rollup-plugin-visualizer';
import path from "path"

const SERVER_HOST = '127.0.0.1';
const SERVER_PORT = 12520;

// OAuth関連の環境変数を注入するプラグイン
const oauthPlugin: Plugin = {
  name: 'oauth-plugin', // プラグインに名前を付ける
  config: (_conf, { command }) => {
    if (command === 'build') {
      process.env.VITE_OAUTH_CLIENT_ID = metadata.client_id;
      process.env.VITE_OAUTH_REDIRECT_URI = metadata.redirect_uris[0];
    } else {
      const redirectUri = (() => {
        const url = new URL(metadata.redirect_uris[0]);
        return `http://${SERVER_HOST}:${SERVER_PORT}${url.pathname}`;
      })();
      const clientId = `http://localhost` + 
                       `?redirect_uri=${encodeURIComponent(redirectUri)}` + 
                       `&scope=${encodeURIComponent(metadata.scope)}`;
      process.env.VITE_DEV_SERVER_PORT = '' + SERVER_PORT;
      process.env.VITE_OAUTH_CLIENT_ID = clientId;
      process.env.VITE_OAUTH_REDIRECT_URI = redirectUri;
    }
    process.env.VITE_CLIENT_URI = metadata.client_uri;
    process.env.VITE_OAUTH_SCOPE = metadata.scope;
  },
};

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom',"react-router-dom"],
          mui: ['@mui/material'],
          oauth: ['@atcute/oauth-browser-client'],
        },
      },
    },
    minify: 'esbuild',
    target: 'esnext', // 最新の ES モジュールをターゲットに
  },
  plugins: [
    react({
      babel: {
        plugins: [
          [
            'babel-plugin-import',
            {
              libraryName: '@mui/material',
              libraryDirectory: '',
              camel2DashComponentName: false,
            },
            'core',
          ],
          [
            'babel-plugin-import',
            {
              libraryName: '@mui/icons-material',
              libraryDirectory: '',
              camel2DashComponentName: false,
            },
            'icons',
          ],
        ]
      }
    }),
    oauthPlugin, // プラグインとして追加
    visualizer({ open: true }), // Visualizerプラグインを追加
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: SERVER_HOST,
    port: SERVER_PORT,
  },
});