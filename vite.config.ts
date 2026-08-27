import path from 'path';
import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';


const readRequestBody = (req: import('http').IncomingMessage): Promise<string> => new Promise((resolve, reject) => {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => resolve(body));
  req.on('error', reject);
});

const normalizeOpenAICompatibleEndpoint = (baseUrl?: string, endpointUrl?: string): string => {
  const rawUrl = (endpointUrl || baseUrl || '').trim().replace(/\/+$/, '');
  if (!rawUrl) throw new Error('Missing endpointUrl');

  const targetUrl = rawUrl.endsWith('/chat/completions')
    ? rawUrl
    : `${rawUrl.endsWith('/v1') ? rawUrl : `${rawUrl}/v1`}/chat/completions`;
  const parsedUrl = new URL(targetUrl);
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('Only http and https endpoints are supported');
  return parsedUrl.toString();
};

const freeTranslationProxy = (): Plugin => {
  const handler = async (req: import('http').IncomingMessage, res: import('http').ServerResponse) => {
    if (req.method !== 'POST') { res.writeHead(405, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Method not allowed' })); return; }
    try {
      const { provider, text, target } = JSON.parse(await readRequestBody(req) || '{}') as { provider?: string; text?: string; target?: string };
      if (!['edge', 'deeplx'].includes(provider || '') || !text || !target) throw new Error('Invalid free translation request');
      let translated = '';
      if (provider === 'edge') {
        const auth = await fetch('https://edge.microsoft.com/translate/auth');
        if (!auth.ok) throw new Error(`Edge auth ${auth.status}: ${await auth.text()}`);
        const endpoint = new URL('https://api-edge.cognitive.microsofttranslator.com/translate');
        endpoint.search = new URLSearchParams({ 'api-version': '3.0', to: target }).toString();
        const upstream = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${(await auth.text()).trim()}`, 'X-ClientTraceId': crypto.randomUUID() }, body: JSON.stringify([{ Text: text }]) });
        if (!upstream.ok) throw new Error(`Edge ${upstream.status}: ${await upstream.text()}`);
        translated = ((await upstream.json()) as Array<{ translations?: Array<{ text?: string }> }>)[0]?.translations?.[0]?.text || '';
      } else {
        const upstream = await fetch('https://api.deeplx.org/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, source_lang: 'auto', target_lang: target.toUpperCase() }) });
        if (!upstream.ok) throw new Error(`DeepLX ${upstream.status}: ${await upstream.text()}`);
        const data = await upstream.json() as { data?: string; translations?: Array<{ text?: string }> };
        translated = data.data || data.translations?.[0]?.text || '';
      }
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }); res.end(JSON.stringify({ text: translated }));
    } catch (error: any) { res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }); res.end(JSON.stringify({ error: error?.message || 'Free provider request failed' })); }
  };
  return { name: 'free-translation-proxy', configureServer: server => server.middlewares.use('/api/free-translate', handler), configurePreviewServer: server => server.middlewares.use('/api/free-translate', handler) };
};

const openAICompatibleProxy = (): Plugin => {
  const handler = async (req: import('http').IncomingMessage, res: import('http').ServerResponse) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      });
      res.end();
      return;
    }

    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    try {
      const rawBody = await readRequestBody(req);
      const { baseUrl, endpointUrl, apiKey, headers: incomingHeaders, body } = JSON.parse(rawBody || '{}') as {
        baseUrl?: string;
        endpointUrl?: string;
        apiKey?: string;
        headers?: Record<string, string>;
        body?: unknown;
      };
      const targetUrl = normalizeOpenAICompatibleEndpoint(baseUrl, endpointUrl);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(incomingHeaders || {})
      };
      if (apiKey?.trim() && !headers.Authorization) headers.Authorization = `Bearer ${apiKey.trim()}`;

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
      res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
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
      plugins: [react(), openAICompatibleProxy(), freeTranslationProxy()],
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