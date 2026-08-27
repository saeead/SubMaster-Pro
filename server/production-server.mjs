/**
 * Production host for SubMaster Pro.
 *
 * Edge Translator token exchange and the public DeepLX endpoint cannot be
 * called reliably from a browser because both are subject to CORS. Keeping the
 * gateway on the same origin makes the web application deployable without
 * exposing a user API key. Deploy this process (or the identical route in your
 * platform's serverless runtime) instead of serving dist/ as static-only.
 */
import { createReadStream, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('..', import.meta.url)), 'dist');
const port = Number(process.env.PORT || 3000);
const contentTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json; charset=utf-8' };

const readJsonBody = request => new Promise((resolve, reject) => {
  let body = '';
  request.on('data', chunk => { body += chunk; });
  request.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('Invalid JSON request body')); } });
  request.on('error', reject);
});

const translateEdge = async (text, target) => {
  const auth = await fetch('https://edge.microsoft.com/translate/auth');
  if (!auth.ok) throw new Error(`Edge auth ${auth.status}: ${await auth.text()}`);
  const endpoint = new URL('https://api-edge.cognitive.microsofttranslator.com/translate');
  endpoint.search = new URLSearchParams({ 'api-version': '3.0', to: target }).toString();
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${(await auth.text()).trim()}`, 'X-ClientTraceId': crypto.randomUUID() },
    body: JSON.stringify([{ Text: text }])
  });
  if (!response.ok) throw new Error(`Edge ${response.status}: ${await response.text()}`);
  return (await response.json())[0]?.translations?.[0]?.text || '';
};

const translateDeepLx = async (text, target) => {
  const response = await fetch('https://api.deeplx.org/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, source_lang: 'auto', target_lang: target.toUpperCase() }) });
  if (!response.ok) throw new Error(`DeepLX ${response.status}: ${await response.text()}`);
  const data = await response.json();
  return data.data || data.translations?.[0]?.text || '';
};

createServer(async (request, response) => {
  try {
    if (request.url === '/api/free-translate') {
      if (request.method !== 'POST') { response.writeHead(405, { Allow: 'POST' }); response.end(); return; }
      const { provider, text, target } = await readJsonBody(request);
      if (!['edge', 'deeplx'].includes(provider) || typeof text !== 'string' || !text || typeof target !== 'string' || !target) throw new Error('Invalid free translation request');
      const translated = provider === 'edge' ? await translateEdge(text, target) : await translateDeepLx(text, target);
      response.writeHead(200, { 'Content-Type': 'application/json' }); response.end(JSON.stringify({ text: translated })); return;
    }

    const pathname = new URL(request.url || '/', `http://${request.headers.host}`).pathname;
    const requested = normalize(join(root, pathname === '/' ? 'index.html' : pathname));
    const file = requested.startsWith(root) && existsSync(requested) ? requested : join(root, 'index.html');
    response.writeHead(200, { 'Content-Type': contentTypes[extname(file)] || 'application/octet-stream' });
    createReadStream(file).pipe(response);
  } catch (error) {
    response.writeHead(502, { 'Content-Type': 'application/json' }); response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Gateway request failed' }));
  }
}).listen(port, () => console.log(`SubMaster Pro is running on http://localhost:${port}`));
