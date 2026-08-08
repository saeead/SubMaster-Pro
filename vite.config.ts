import path from 'path';
import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';


const readRequestBody = (req: import('http').IncomingMessage): Promise<string> => new Promise((resolve, reject) => {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => resolve(body));
  req.on('error', reject);
});

const openAICompatibleProxy = (): Plugin => {
  const handler = async (req: import('http').IncomingMessage, res: import('http').ServerResponse) => {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    try {
      const rawBody = await readRequestBody(req);
      const { baseUrl, endpointUrl, apiKey, body } = JSON.parse(rawBody || '{}') as {
        baseUrl?: string;
        endpointUrl?: string;
        apiKey?: string;
        body?: unknown;
      };
      const targetUrl = (endpointUrl || (baseUrl ? `${baseUrl.trim().replace(/\/+$/, '')}/chat/completions` : '')).trim();
      if (!targetUrl) throw new Error('Missing endpointUrl');

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey?.trim()) headers.Authorization = `Bearer ${apiKey.trim()}`;

      const upstreamResponse = await fetch(targetUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      const contentType = upstreamResponse.headers.get('content-type') || 'application/json';
      const responseText = await upstreamResponse.text();
      res.writeHead(upstreamResponse.status, {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*'
      });
      res.end(responseText);
    } catch (error: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error?.message || 'Proxy request failed' }));
    }
  };

  return {
    name: 'openai-compatible-proxy',
    configureServer(server) {
      server.middlewares.use('/api/openai-compatible/chat/completions', handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/openai-compatible/chat/completions', handler);
    }
  };
};


export default defineConfig(({ mode }) => {
    // Load env file based on `mode` in the current working directory.
    // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
    const env = loadEnv(mode, process.cwd(), '');
    
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), openAICompatibleProxy()],
      define: {
        // This is crucial for exposing the key to the client side
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          // This points '@' to the 'src' directory
          '@': path.resolve(__dirname, './src'),
        }
      }
    };
});