import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const hash = /^0x[\da-f]{64}$/;
const job = /^[a-z0-9_-]{1,128}$/i;
const sealPattern = /^[\da-f]{64}$/;
const key = () => (process.env.KURIER_RECEIPT_SECRET?.length >= 32 ? process.env.KURIER_RECEIPT_SECRET : process.env.KURIER_API_KEY);

function sign(context, value, secret = key()) {
  if (!secret) return '';
  return createHmac('sha256', secret).update(context).update(':').update(value).digest('hex');
}

function matches(actual, expected) {
  return typeof actual === 'string' && sealPattern.test(actual) && expected.length === 64
    && timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
}

export function proofDigest(bundle) {
  const { protocol, curve, pi_a, pi_b, pi_c } = bundle.proof;
  return '0x' + createHash('sha256').update(JSON.stringify([
    bundle.schema, protocol, curve, pi_a, pi_b, pi_c, bundle.publicSignals
  ])).digest('hex');
}

export function trackKurierJob(jobId, bundle, vkHash, expires = Date.now() + 60 * 60_000) {
  const payload = Buffer.from(JSON.stringify([jobId, proofDigest(bundle), vkHash.toLowerCase(), expires])).toString('base64url');
  return `${payload}.${sign('gapmark:zkverify:job:v2', payload)}`;
}

export function readKurierTracking(jobId, receipt) {
  if (typeof jobId !== 'string' || !job.test(jobId) || typeof receipt !== 'string' || receipt.length > 650) return null;
  const [payload, seal, extra] = receipt.split('.');
  if (extra !== undefined) return null;
  if (/^\d{13}$/.test(payload)) {
    const legacyKey = process.env.KURIER_API_KEY;
    if (!legacyKey || Number(payload) <= Date.now()) return null;
    const legacySeal = createHmac('sha256', legacyKey).update(`gapmark:zkverify:testnet:receipt:v1:${jobId}:${payload}`).digest('hex');
    return matches(seal, legacySeal) ? { jobId } : null;
  }
  if (!/^[a-z0-9_-]+$/i.test(payload) || !matches(seal, sign('gapmark:zkverify:job:v2', payload))) return null;
  try {
    const [id, digest, vkHash, expires] = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (id !== jobId || !hash.test(digest) || !hash.test(vkHash) || !Number.isSafeInteger(expires) || expires <= Date.now()) return null;
    return { jobId, proofDigest: digest, vkHash };
  } catch { return null; }
}

function fields(receipt) {
  const { network, jobId, proofDigest, vkHash, txHash, blockHash, statement } = receipt;
  return [network, jobId, proofDigest, vkHash, txHash, blockHash ?? '', statement ?? ''];
}

export function sealKurierFinalization(status, tracking) {
  if (status.status !== 'Finalized' || status.network !== 'testnet' || status.jobId !== tracking.jobId || !tracking.proofDigest) return undefined;
  if (!/^0x[\da-f]{64}$/i.test(status.txHash ?? '')) return undefined;
  const data = { network: 'testnet', ...tracking, txHash: status.txHash.toLowerCase() };
  for (const name of ['blockHash', 'statement']) {
    if (/^0x[\da-f]{64}$/i.test(status[name] ?? '')) data[name] = status[name].toLowerCase();
  }
  return { ...data, seal: sign('gapmark:zkverify:finalization:v1', JSON.stringify(fields(data))) };
}

export function checkKurierFinalization(bundle) {
  const receipt = bundle.zkverifyReceipt;
  if (!receipt) return { status: 'none' };
  if (!key()) return { status: 'unavailable' };
  if (receipt.network !== 'testnet' || !job.test(receipt.jobId ?? '') || !hash.test(receipt.vkHash ?? '')
      || !hash.test(receipt.txHash ?? '') || receipt.proofDigest !== proofDigest(bundle)
      || ['blockHash', 'statement'].some((name) => receipt[name] !== undefined && !hash.test(receipt[name]))
      || !matches(receipt.seal, sign('gapmark:zkverify:finalization:v1', JSON.stringify(fields(receipt))))) {
    return { status: 'invalid' };
  }
  const { network, jobId, proofDigest: digest, vkHash, txHash, blockHash, statement, seal } = receipt;
  return { status: 'finalized', receipt: { network, jobId, proofDigest: digest, vkHash, txHash, blockHash, statement, seal } };
}
