import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createKurierClient } from '../shared/kurier.mjs';
import { GET, POST } from '../app/api/zkverify/route.js';

const env = { KURIER_API_KEY: 'fixture-key', KURIER_BASE_URL: 'https://api-testnet.kurier.xyz/api/v1' };
const hash = `0x${'1'.repeat(64)}`;
const vk = { protocol: 'groth16', fixture: 'vk' };
const bundle = {
  proof: { protocol: 'groth16', curve: 'bn128', pi_a: ['1'], pi_b: [['2']], pi_c: ['3'], privateField: 'must not be forwarded' },
  publicSignals: ['12'], csv: 'private log', checkpoint: 'internal mark'
};

test('Kurier client uses the registered key and only forwards the proof and public inputs', async () => {
  const operations = [];
  const client = createKurierClient(env, async (url, init) => {
    operations.push({ url, method: init.method, body: init.body && JSON.parse(init.body) });
    if (url.includes('register-vk')) return Response.json({ meta: { vkHash: hash } }, { status: 409 });
    if (url.includes('submit-proof')) return Response.json({ jobId: 'fixture-job', optimisticVerify: 'success' });
    return Response.json({ status: 'Finalized', txHash: hash, privateField: 'ignored' });
  });
  assert.equal(await client.register(vk), hash);
  assert.equal(await client.register(vk), hash);
  const submission = await client.submit(bundle, hash);
  assert.deepEqual(submission, { network: 'testnet', jobId: 'fixture-job', status: 'Submitted' });
  assert.deepEqual(await client.getStatus(submission.jobId), { network: 'testnet', jobId: 'fixture-job', status: 'Finalized', txHash: hash });
  assert.equal(operations.length, 3);
  assert.equal(operations[1].body.proofData.vk, hash);
  assert.equal(operations[1].body.proofData.proof.privateField, undefined);
  assert.equal(operations[1].body.csv, undefined);
  assert.equal(operations[1].body.domainId, undefined);
});

test('Kurier failure does not produce a confirmed status or expose credentials', async () => {
  const client = createKurierClient(env, async (url) => {
    if (url.includes('submit-proof')) return Response.json({ jobId: 'fixture-job', optimisticVerify: 'failed' });
    return Response.json({ status: 'Finalized', error: env.KURIER_API_KEY });
  });
  await assert.rejects(client.submit(bundle, hash), /initial verification/);
  await assert.rejects(client.getStatus('fixture-job'), /without a transaction reference/);
});

test('public zkVerify relayer only enables testnet and limits unauthenticated submissions and job lookups', async () => {
  const key = process.env.KURIER_API_KEY;
  const base = process.env.KURIER_BASE_URL;
  process.env.KURIER_API_KEY = 'fixture-api-key';
  process.env.KURIER_BASE_URL = 'https://api.kurier.xyz/api/v1';
  try {
    assert.deepEqual(await GET().json(), { enabled: false });
    process.env.KURIER_BASE_URL = env.KURIER_BASE_URL;
    assert.deepEqual(await GET().json(), { enabled: true });
    const request = (input, headers) => new Request('https://example.com/api/zkverify', {
      method: 'POST', body: JSON.stringify(input), headers: { 'content-type': 'application/json', ...headers }
    });
    assert.equal((await POST(request({ action: 'submit' }, { 'sec-fetch-site': 'cross-site' }))).status, 403);
    assert.equal((await POST(request({ action: 'status', jobId: 'not-our-job' }))).status, 403);
    for (let attempt = 0; attempt < 4; attempt++) {
      const rejected = await POST(request({ action: 'submit' }));
      assert.equal(rejected.status, 400);
      assert.match((await rejected.json()).error, /Expected an uptime-evidence/);
    }
    const limited = await POST(request({ action: 'submit' }));
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get('retry-after'), '60');
  } finally {
    if (key === undefined) delete process.env.KURIER_API_KEY;
    else process.env.KURIER_API_KEY = key;
    if (base === undefined) delete process.env.KURIER_BASE_URL;
    else process.env.KURIER_BASE_URL = base;
  }
});
