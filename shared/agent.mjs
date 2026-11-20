import { analyze, assertProofBundle, checkCheckpoint, compareReportTerms, describe, serviceId } from '../public/evidence.mjs';
import { exampleWindowRequest } from './agent-openapi.mjs';
import { checkKurierFinalization } from './zkverify-receipt.mjs';

export const agentContract = {
  name: 'Gapmark',
  endpoint: '/api/agent',
  method: 'POST',
  openapi: '/api/agent/openapi',
  example: exampleWindowRequest,
  actions: {
    'check-window': { fields: ['csv', 'service', 'start', 'intervalMinutes', 'slotCount', 'threshold'], description: 'Calculate a verdict. API input reaches the server. Use the website to keep raw CSV on your device.' },
    'verify-proof': { fields: ['bundle', 'trustedMonitorKey (optional)', 'expectedTerms (optional)', 'requireZkVerify (optional)'], description: 'Verify a Groth16 bundle against this deployment’s key and optionally check an Ed25519 checkpoint.' }
  }
};

const MAX_BODY_BYTES = 72_000;

export async function readRequestBody(stream) {
  const chunks = [];
  let size = 0;
  if (!stream) throw new Error('A JSON body is required.');
  for await (const chunk of stream) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error('Request exceeds the 72 KB limit.'), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function readJsonBody(stream) {
  return JSON.parse((await readRequestBody(stream)).toString('utf8'));
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
    const chain = checkKurierFinalization(input.bundle);
    let source;
    try { source = await checkCheckpoint(input.bundle, result, input.trustedMonitorKey); }
    catch { source = 'The monitor signature or trusted key could not be checked.'; }
    let policy;
    if (input.expectedTerms !== undefined || input.requireZkVerify !== undefined) {
      const expected = input.expectedTerms ?? {};
      if (typeof expected !== 'object' || Array.isArray(expected) || (input.requireZkVerify !== undefined && typeof input.requireZkVerify !== 'boolean')) {
        throw new Error('Provide expected terms as an object and requireZkVerify as a boolean.');
      }
      const terms = compareReportTerms(result, input.bundle.service, {
        service: expected.service ?? '', start: expected.start ?? '', interval: expected.intervalMinutes ?? '',
        count: expected.slotCount ?? '', threshold: expected.threshold ?? ''
      });
      let decision = 'target-met';
      if (terms.differences.length) decision = 'agreement-mismatch';
      else if (terms.checked.length !== 5) decision = 'incomplete-agreement';
      else if (input.requireZkVerify && chain.status !== 'finalized') decision = 'needs-zkverify-receipt';
      else if (result.verdict === 'INSUFFICIENT') decision = 'insufficient-evidence';
      else if (result.verdict === 'BREACH') decision = 'target-missed';
      policy = { decision, ...terms };
    }
    return { verified: true, service: input.bundle.service, ...result, explanation: describe(result.verdict),
      evidence: 'Local Groth16 verification succeeded.', source, zkverify: chain, ...(policy && { policy }) };
  }
  throw new Error('Unknown action. Use check-window or verify-proof.');
}
