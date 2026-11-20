import { generateKeyPairSync, sign } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { createContext, runInContext } from 'node:vm';
import assert from 'node:assert/strict';
import { analyze, checkCheckpoint, checkpointMessage, compareReportTerms, MAX_SLOTS, readPublicSignals, SCHEMA, serviceId, SLOT, timestampSeconds } from '../public/evidence.mjs';
import { runAgent } from '../shared/agent.mjs';
import { GET as getAgent, POST as agentEndpoint } from '../app/api/agent/route.js';
import { GET as getAgentSpec } from '../app/api/agent/openapi/route.js';
import { POST as relay } from '../app/api/zkverify/route.js';

const window = { service: 'Example API', start: '2026-11-20T12:00:00Z', intervalMinutes: 5, slotCount: 3, threshold: '66.66' };
const csv = (rows) => ['timestamp,status', ...rows].join('\n');
const up = '2026-11-20T12:00:00Z,up';
const down = '2026-11-20T12:05:00Z,down';
const last = '2026-11-20T12:10:00Z,up';

test('normalizes missing slots and preserves incomplete evidence', () => {
  const report = analyze({ ...window, csv: csv([down, up]) });
  assert.deepEqual(report.counts, { up: 1, down: 1, missing: 1 });
  assert.equal(report.verdict, 'INSUFFICIENT');
  assert.equal(report.slots[2].recorded, false);
  const explicit = analyze({ ...window, csv: csv([up, down, last.replace(',up', ',missing')]) });
  assert.deepEqual(explicit.counts, report.counts);
  assert.equal(explicit.slots[2].recorded, true);
});

test('uses exact threshold arithmetic on both sides of a rounding boundary', () => {
  const input = { ...window, csv: csv([up, down, last]) };
  assert.equal(analyze(input).verdict, 'PASS');
  assert.equal(analyze({ ...input, threshold: '66.67' }).verdict, 'BREACH');
});

test('accepts offsets, quoting, extra columns, BOM and unordered rows', () => {
  const report = analyze({ ...window, csv: '\uFEFFStatus,comment,Timestamp\r\nUP,"text, with a comma",2026-11-20T17:40:00+05:30\r\ndown,x,2026-11-20T12:05Z\r\n"UP","a ""quote""",2026-11-20T12:00:00.000Z' });
  assert.equal(report.verdict, 'PASS');
});

test('rejects duplicates even if offset encodings differ', () => {
  assert.throws(() => analyze({ ...window, csv: csv([up, '2026-11-20T17:30:00+05:30,down']) }), /slot 1/);
});

test('rejects off-grid timestamps, exclusive end, and invalid calendar dates', () => {
  for (const bad of ['2026-11-20T12:04Z,up', '2026-11-20T12:15Z,up']) {
    assert.throws(() => analyze({ ...window, csv: csv([bad]) }), /outside the window|align/);
  }
  assert.throws(() => analyze({ ...window, csv: csv(['2026-02-30T12:00Z,up']) }), /valid whole-second/);
});

test('accepts a full day with a custom interval and enforces the same size limit as the circuit', () => {
  const input = { ...window, intervalMinutes: 30, slotCount: MAX_SLOTS, csv: csv([]) };
  assert.equal(analyze(input).counts.missing, 48);
  assert.throws(() => analyze({ ...input, intervalMinutes: 31 }), /24 hours/);
  assert.throws(() => analyze({ ...input, slotCount: MAX_SLOTS + 1 }), /Number of slots/);
});

test('rejects malformed headers, invalid states and unterminated quotes', () => {
  for (const data of ['timestamp,Timestamp,status\n', csv([up.replace(',up', ',failure')]), 'timestamp,status\n"unterminated']) {
    assert.throws(() => analyze({ ...window, csv: data }));
  }
});

test('rejects inconsistent provided public counts or verdict', () => {
  const signals = ['123', '2', '1', '0', '1', '42', '1795176000', '5', '3', '6666'];
  assert.equal(readPublicSignals(signals).verdict, 'PASS');
  assert.throws(() => readPublicSignals(signals.with(4, '0')), /inconsistent/);
  assert.throws(() => readPublicSignals(signals.with(3, '1')), /inconsistent/);
});

test('reviewer catches an easier threshold or different window in a valid report', () => {
  const reported = { windowStart: timestampSeconds('2026-11-20T12:00:00Z'), intervalMinutes: 5, slotCount: 12, thresholdBps: 9000 };
  const expected = { service: 'Checkout API', start: '2026-11-20T12:05', interval: '5', count: '12', threshold: '99.9' };
  const comparison = compareReportTerms(reported, 'Checkout API', expected);
  assert.equal(comparison.checked.length, 5);
  assert.deepEqual(comparison.differences, ['window start', 'required uptime']);
  assert.deepEqual(compareReportTerms(reported, 'Checkout API', { service: '', start: '', interval: '', count: '', threshold: '' }), { checked: [], differences: [] });
});

test('checks a monitor signature against a trusted key and rejects a changed commitment', async () => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const report = { commitment: '123', serviceId: '22', windowStart: 470000, intervalMinutes: 5, slotCount: 3, thresholdBps: 9000 };
  const bundle = { checkpoint: { algorithm: 'Ed25519', signature: sign(null, checkpointMessage(report), privateKey).toString('base64url') } };
  const key = publicKey.export({ type: 'spki', format: 'der' }).toString('base64url');
  assert.match(await checkCheckpoint(bundle, report, key), /matches/);
  assert.match(await checkCheckpoint(bundle, { ...report, commitment: '124' }, key), /does not match/);
  assert.match(await checkCheckpoint(bundle, report), /independently trusted/);
});

test('agent returns the counts and explicitly marks an unproved verdict', async () => {
  const result = await runAgent({ action: 'check-window', ...window, csv: csv([up, down]) });
  assert.deepEqual(result.counts, { up: 1, down: 1, missing: 1 });
  assert.equal(result.verdict, 'INSUFFICIENT');
  assert.match(result.evidence, /No proof/);
  assert.equal(Object.hasOwn(result, 'slots'), false);
  const discovery = await getAgent().json();
  const spec = await getAgentSpec(new Request('https://gapmark.example/api/agent/openapi')).json();
  assert.equal(discovery.openapi, '/api/agent/openapi');
  assert.equal(spec.servers[0].url, 'https://gapmark.example');
  const operation = spec.paths['/api/agent'].post;
  assert.deepEqual(operation.requestBody.content['application/json'].examples.missingCheck.value, discovery.example);
  const response = await agentEndpoint(new Request('https://gapmark.example/api/agent', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(discovery.example)
  }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).verdict, 'INSUFFICIENT');
});

test('browser worker proves the window and the public relayer accepts only the valid proof', { skip: !existsSync('public/zk/manifest.json') && 'compile the proof assets to enable this check' }, async (t) => {
  const report = analyze({ ...window, csv: csv([up, down]) });
  const id = await serviceId(report.service);
  const inputs = { serviceId: id, windowStart: report.windowStart, intervalMinutes: report.intervalMinutes, slotCount: report.slotCount,
    thresholdBps: report.thresholdBps, salt: '9246', states: Array.from({ length: MAX_SLOTS }, (_, index) => SLOT[report.slots[index]?.status ?? 'missing']) };
  const library = await readFile('public/zk/snarkjs.min.js', 'utf8');
  const worker = createContext({ TextEncoder, TextDecoder, atob, btoa, crypto, performance, setTimeout, clearTimeout,
    fetch: async (url) => new Response(await readFile(`public${url}`)),
    importScripts: () => runInContext(library, worker) });
  worker.self = worker;
  runInContext(await readFile('public/proof-worker.js', 'utf8'), worker);
  async function send(data) {
    let reply;
    worker.postMessage = (message) => { reply = message; };
    await worker.onmessage({ data });
    assert.ok(reply, 'Worker must reply');
    assert.equal(reply.error, undefined, reply.error);
    return structuredClone(reply.result);
  }
  const { proof, publicSignals } = await send({ action: 'prove', input: inputs });
  const recorded = readPublicSignals(publicSignals);
  assert.deepEqual(recorded.counts, report.counts);
  assert.equal(recorded.verdict, report.verdict);
  assert.equal(recorded.serviceId, id);
  assert.equal(recorded.windowStart, report.windowStart);
  assert.equal(recorded.slotCount, report.slotCount);
  assert.equal(recorded.intervalMinutes, report.intervalMinutes);
  assert.equal(recorded.thresholdBps, report.thresholdBps);
  assert.equal(await send({ action: 'verify', publicSignals, proof }), true);
  const changed = publicSignals.with(0, publicSignals[0] === '0' ? '1' : '0');
  assert.equal(await send({ action: 'verify', publicSignals: changed, proof }), false);

  const key = process.env.KURIER_API_KEY;
  const base = process.env.KURIER_BASE_URL;
  process.env.KURIER_API_KEY = 'relay-test-key';
  process.env.KURIER_BASE_URL = 'https://api-testnet.kurier.xyz/api/v1';
  const chainHash = `0x${'1'.repeat(64)}`;
  const upstream = t.mock.method(globalThis, 'fetch', async (url) => {
    if (url.includes('/register-vk/')) return Response.json({ vkHash: chainHash });
    if (url.includes('/submit-proof/')) return Response.json({ jobId: 'test-job', optimisticVerify: 'success' });
    return Response.json({ status: 'Finalized', txHash: chainHash });
  });
  const post = (input) => relay(new Request('https://example.com/api/zkverify', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input)
  }));
  const bundle = { schema: SCHEMA, service: report.service, proof, publicSignals };
  try {
    assert.equal((await post({ action: 'submit', bundle: { ...bundle, publicSignals: changed } })).status, 422);
    assert.equal(upstream.mock.callCount(), 0);
    const submitted = await post({ action: 'submit', bundle });
    assert.equal(submitted.status, 202);
    const { jobId, receipt } = await submitted.json();
    assert.equal((await post({ action: 'status', jobId: 'different-job', receipt })).status, 403);
    const status = await post({ action: 'status', jobId, receipt });
    const { finalization, ...jobResult } = await status.json();
    assert.deepEqual(jobResult, { network: 'testnet', jobId, status: 'Finalized', txHash: chainHash });
    assert.equal(finalization.vkHash, chainHash);
    const attached = { ...bundle, zkverifyReceipt: finalization };
    const check = (candidate) => post({ action: 'check-receipt', bundle: candidate }).then((response) => response.json());
    assert.deepEqual(await check(attached), { status: 'finalized', receipt: finalization });
    assert.deepEqual(await check({ ...attached, publicSignals: changed }), { status: 'invalid' });
    assert.deepEqual(await check({ ...attached, zkverifyReceipt: { ...finalization, txHash: '0x' + '2'.repeat(64) } }), { status: 'invalid' });
    const expectedTerms = { service: report.service, start: '2026-11-20T17:30:00+05:30',
      intervalMinutes: 5, slotCount: 3, threshold: '66.66' };
    const input = { action: 'verify-proof', bundle: attached, expectedTerms, requireZkVerify: true };
    const audit = await runAgent(input, async () => true);
    assert.equal(audit.verified, true);
    assert.equal(audit.zkverify.status, 'finalized');
    assert.equal(audit.policy.decision, 'insufficient-evidence');
    assert.equal((await runAgent({ ...input, bundle }, async () => true)).policy.decision, 'needs-zkverify-receipt');
    const mismatch = await runAgent({ ...input, expectedTerms: { ...expectedTerms, threshold: '99' } }, async () => true);
    assert.equal(mismatch.verified, true);
    assert.equal(mismatch.policy.decision, 'agreement-mismatch');
    assert.equal(upstream.mock.callCount(), 3);
  } finally {
    if (key === undefined) delete process.env.KURIER_API_KEY;
    else process.env.KURIER_API_KEY = key;
    if (base === undefined) delete process.env.KURIER_BASE_URL;
    else process.env.KURIER_BASE_URL = base;
    await globalThis.curve_bn128?.terminate();
  }
});
