import { analyze, assertProofBundle, checkCheckpoint, describe, serviceId } from '../public/evidence.mjs';
import { exampleWindowRequest } from './agent-openapi.mjs';

export const agentContract = {
  name: 'Gapmark',
  endpoint: '/api/agent',
  method: 'POST',
  openapi: '/api/agent/openapi',
  example: exampleWindowRequest,
  actions: {
    'check-window': { fields: ['csv', 'service', 'start', 'intervalMinutes', 'slotCount', 'threshold'], description: 'Calculate a verdict. API input reaches the server. Use the website to keep raw CSV on your device.' },
    'verify-proof': { fields: ['bundle', 'trustedMonitorKey (optional)'], description: 'Verify a Groth16 bundle against this deployment’s key and optionally check an Ed25519 checkpoint.' }
  }
};

const MAX_BODY_BYTES = 72_000;

export async function readJsonBody(stream) {
  const chunks = [];
  let size = 0;
  if (!stream) throw new Error('A JSON body is required.');
  for await (const chunk of stream) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error('Request exceeds the 72 KB limit.'), { status: 413 });
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export async function runAgent(input, verifyProof) {
  if (input?.action === 'check-window') {
    const result = analyze(input);
    return { service: result.service, counts: result.counts, windowStart: result.windowStart, slotCount: result.slotCount,
      intervalMinutes: result.intervalMinutes, thresholdBps: result.thresholdBps, verdict: result.verdict, explanation: describe(result.verdict),
      evidence: 'Calculated from submitted data. No proof was checked.' };
  }
  if (input?.action === 'verify-proof') {
    const result = assertProofBundle(input.bundle);
    if (await serviceId(input.bundle.service) !== result.serviceId) throw new Error('The service label does not match the public proof.');
    const verified = await verifyProof(input.bundle);
    if (!verified) return { verified: false, evidence: 'Local Groth16 verification failed.' };
    return { verified: true, service: input.bundle.service, ...result, explanation: describe(result.verdict),
      evidence: 'Local Groth16 verification succeeded.', source: await checkCheckpoint(input.bundle, result, input.trustedMonitorKey) };
  }
  throw new Error('Unknown action. Use check-window or verify-proof.');
}
