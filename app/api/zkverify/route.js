import { createHmac, timingSafeEqual } from 'node:crypto';
import { assertProofBundle, serviceId } from '../../../public/evidence.mjs';
import { readJsonBody } from '../../../shared/agent.mjs';
import { createKurierClient } from '../../../shared/kurier.mjs';
import { readVerificationKey, verifyLocally } from '../../../shared/verifier.mjs';

export const runtime = 'nodejs';
export const maxDuration = 60;

const testnet = 'https://api-testnet.kurier.xyz/api/v1';
const enabled = () => Boolean(process.env.KURIER_API_KEY && (!process.env.KURIER_BASE_URL || process.env.KURIER_BASE_URL === testnet));
const json = (body, status = 200, headers) => Response.json(body, { status, headers: { 'cache-control': 'no-store', ...headers } });
const usage = new Map();
let resetsAt = 0;
let submissions = 0;
let statusChecks = 0;
const jobIdPattern = /^[a-z0-9_-]{1,128}$/i;

function allowRequest(request, action) {
  const now = Date.now();
  if (now >= resetsAt) {
    resetsAt = now + 60_000;
    submissions = 0;
    statusChecks = 0;
    usage.clear();
  }
  const client = (process.env.VERCEL === '1' && request.headers.get('x-real-ip')) || 'local';
  const counts = usage.get(client) ?? { submit: 0, status: 0 };
  if (action === 'submit') {
    if (counts.submit >= 4 || submissions >= 20) return false;
    submissions++;
  } else {
    if (counts.status >= 24 || statusChecks >= 120) return false;
    statusChecks++;
  }
  counts[action]++;
  usage.set(client, counts);
  return true;
}

function signReceipt(jobId, expires) {
  const signature = createHmac('sha256', process.env.KURIER_API_KEY)
    .update(`gapmark:zkverify:testnet:receipt:v1:${jobId}:${expires}`).digest('hex');
  return `${expires}.${signature}`;
}

function validReceipt(jobId, receipt) {
  if (typeof jobId !== 'string' || !jobIdPattern.test(jobId) || typeof receipt !== 'string' || !/^\d{13}\.[\da-f]{64}$/.test(receipt)) return false;
  const expires = Number(receipt.split('.')[0]);
  return expires > Date.now() && timingSafeEqual(Buffer.from(receipt), Buffer.from(signReceipt(jobId, expires)));
}

export function GET() { return json({ enabled: enabled() }); }

export async function POST(request) {
  if (!enabled()) return json({ error: 'This deployment needs a Kurier testnet API key to submit proofs.' }, 503);
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') return json({ error: 'Submit from the Gapmark website.' }, 403);
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return json({ error: 'Use application/json.' }, 415);
  try {
    const input = await readJsonBody(request.body);
    const action = input?.action;
    if (action !== 'submit' && action !== 'status') return json({ error: 'Choose submit or status.' }, 400);
    if (action === 'status' && !validReceipt(input.jobId, input.receipt)) return json({ error: 'A valid submission receipt is required to check this job.' }, 403);
    if (!allowRequest(request, action)) return json({ error: 'The demo is busy. Wait a minute and try again.' }, 429, { 'retry-after': '60' });
    const kurier = createKurierClient();
    if (action === 'status') return json(await kurier.getStatus(input.jobId));
    const report = assertProofBundle(input.bundle);
    if (await serviceId(input.bundle.service) !== report.serviceId) return json({ error: 'The service label does not match the proof.' }, 422);
    if (!await verifyLocally(input.bundle)) return json({ error: 'Local proof verification failed. Nothing was sent to Kurier.' }, 422);
    const vkHash = await kurier.register(await readVerificationKey());
    const job = await kurier.submit(input.bundle, vkHash);
    return json({ ...job, receipt: signReceipt(job.jobId, Date.now() + 60 * 60_000) }, 202);
  } catch (error) {
    const status = error.status ?? 400;
    return json({ error: status < 500 || error.status ? error.message : 'The operation could not be completed.' }, status);
  }
}
