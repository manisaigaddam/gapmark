import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { agentContract, readJsonBody, runAgent } from '../shared/agent.mjs';
import { agentOpenApi } from '../shared/agent-openapi.mjs';
import { title, workbench } from '../shared/workbench.mjs';
import { verifyLocally } from '../shared/verifier.mjs';

const port = Number(process.env.PORT ?? 3000);
const assets = new Map([
  ['/workbench.css', 'text/css'], ['/workbench.mjs', 'text/javascript'], ['/evidence.mjs', 'text/javascript'],
  ['/demo-data.mjs', 'text/javascript'],
  ['/gapmark.png', 'image/png'],
  ['/proof-worker.js', 'text/javascript'], ['/zk/verification_key.json', 'application/json'],
  ['/zk/manifest.json', 'application/json'], ['/zk/uptime.wasm', 'application/wasm'],
  ['/zk/uptime.zkey', 'application/octet-stream'], ['/zk/snarkjs.min.js', 'text/javascript']
]);
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><link rel="icon" type="image/png" href="/gapmark.png"><link rel="stylesheet" href="/workbench.css"></head><body>${workbench}<script src="/workbench.mjs" type="module"></script></body></html>`;

function send(response, status, body, type) {
  response.writeHead(status, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff' });
  response.end(body);
}
function json(response, status, value) { send(response, status, JSON.stringify(value), 'application/json'); }

createServer(async (request, response) => {
  const path = new URL(request.url, 'http://127.0.0.1').pathname;
  if (path === '/api/agent/openapi' && request.method === 'GET') return json(response, 200, agentOpenApi);
  if (path === '/api/agent') {
    if (request.method === 'GET') return json(response, 200, agentContract);
    if (request.method !== 'POST') return json(response, 405, { error: 'Use GET or POST.' });
    if (!request.headers['content-type']?.includes('application/json')) return json(response, 415, { error: 'Use application/json.' });
    try {
      return json(response, 200, await runAgent(await readJsonBody(request), verifyLocally));
    } catch (error) { return json(response, error.status ?? 400, { error: error.message }); }
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') return json(response, 405, { error: 'Use GET or HEAD.' });
  if (path === '/') return send(response, 200, html, 'text/html; charset=utf-8');
  const type = assets.get(path);
  if (type) {
    try { return send(response, 200, await readFile(join(process.cwd(), 'public', path.slice(1))), type); }
    catch (error) { if (error.code !== 'ENOENT') return json(response, 500, { error: 'Asset read failed.' }); }
  }
  return json(response, 404, { error: 'Not found.' });
}).listen(port, '127.0.0.1', () => console.log(`Gapmark preview: http://127.0.0.1:${port}`));
