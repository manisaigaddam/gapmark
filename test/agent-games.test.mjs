import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import { POST } from '../app/api/agent-games/route.js';
import { exampleWindowRequest } from '../shared/agent-openapi.mjs';

test('Agent Games checks the raw signature first and signs preflight and uptime results', async (t) => {
  const old = process.env.AGENT_GAMES_HMAC_SECRET;
  const secret = 'test-only-agent-games-secret';
  process.env.AGENT_GAMES_HMAC_SECRET = secret;
  t.after(() => {
    if (old === undefined) delete process.env.AGENT_GAMES_HMAC_SECRET;
    else process.env.AGENT_GAMES_HMAC_SECRET = old;
  });
  const signature = (raw) => 'sha256=' + createHmac('sha256', secret).update(raw).digest('hex');
  const send = (raw, header = signature(raw)) => POST(new Request('https://gapmark.example/api/agent-games', {
    method: 'POST', body: raw, headers: { 'content-type': 'application/json', 'x-agent-games-signature': header }
  }));
  async function check(response, status) {
    assert.equal(response.status, status);
    const raw = await response.text();
    assert.equal(response.headers.get('x-agent-games-signature'), signature(raw));
    return JSON.parse(raw);
  }

  const now = new Date().toISOString();
  const preflight = JSON.stringify({ type: 'agent-games.preflight.v1', issued_at: now, nonce: 'test' }, null, 2);
  assert.deepEqual(await check(await send(preflight), 200), { ok: true, protocolVersion: 'v1' });
  assert.equal((await send(preflight + ' ', signature(preflight))).status, 401);
  assert.equal((await send('{', 'invalid')).status, 401);
  assert.match((await check(await send('{'), 400)).error, /valid JSON/);
  const task = JSON.stringify({ issued_at: now, deadline_at: new Date(Date.now() + 5000).toISOString(), input: exampleWindowRequest });
  assert.equal((await check(await send(task), 200)).verdict, 'INSUFFICIENT');
  const stale = JSON.stringify({ issued_at: new Date(Date.now() - 600_000).toISOString(), input: exampleWindowRequest });
  assert.match((await check(await send(stale), 400)).error, /timestamp/);
});
