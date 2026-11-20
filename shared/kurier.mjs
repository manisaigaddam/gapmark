import { createHash } from 'node:crypto';

const testnet = 'https://api-testnet.kurier.xyz/api/v1';
const mainnet = 'https://api.kurier.xyz/api/v1';
const proofOptions = { library: 'snarkjs', curve: 'bn128' };
const hashPattern = /^0x[\da-f]{64}$/i;
const jobPattern = /^[a-z0-9_-]{1,128}$/i;
const registrations = new Map();

function error(message, status = 502) { return Object.assign(new Error(message), { status }); }

export function createKurierClient(env = process.env, request = fetch) {
  const base = env.KURIER_BASE_URL || testnet;
  if (base !== testnet && base !== mainnet) throw error('Configure an official Kurier URL.', 503);
  if (!env.KURIER_API_KEY) throw error('Kurier is not configured on this server.', 503);
  const network = base === testnet ? 'testnet' : 'mainnet';
  const keyPath = encodeURIComponent(env.KURIER_API_KEY);

  async function ask(path, body) {
    let response;
    try {
      response = await request(`${base}/${path}`, {
        method: body ? 'POST' : 'GET',
        ...(body && { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
        redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(20000)
      });
    } catch { throw error('Kurier could not be reached.'); }
    const payload = await response.json().catch(() => null);
    return { ok: response.ok, status: response.status, payload };
  }

  async function register(vk) {
    const cacheKey = createHash('sha256').update(base).update(env.KURIER_API_KEY).update(JSON.stringify(vk)).digest('hex');
    if (!registrations.has(cacheKey)) {
      const pending = (async () => {
        const { ok, status, payload } = await ask(`register-vk/${keyPath}`, { proofType: 'groth16', proofOptions, vk });
        const hash = payload?.vkHash ?? payload?.meta?.vkHash;
        if ((ok || status === 400 || status === 409) && hashPattern.test(hash ?? '')) return hash;
        throw error(`Kurier did not return a registered verification key (HTTP ${status}).`);
      })();
      registrations.set(cacheKey, pending);
      pending.catch(() => registrations.delete(cacheKey));
    }
    return registrations.get(cacheKey);
  }

  async function submit(bundle, vkHash) {
    if (!hashPattern.test(vkHash ?? '')) throw error('Register this circuit’s verification key first.', 400);
    const { pi_a, pi_b, pi_c, protocol, curve } = bundle.proof;
    const { ok, status, payload } = await ask(`submit-proof/${keyPath}`, {
      proofType: 'groth16', vkRegistered: true, proofOptions,
      proofData: { proof: { pi_a, pi_b, pi_c, protocol, curve }, publicSignals: bundle.publicSignals, vk: vkHash }
    });
    if (!ok) throw error(`Kurier did not accept the proof (HTTP ${status}).`);
    if (payload?.optimisticVerify !== 'success') throw error('Kurier’s initial verification did not succeed.');
    if (typeof payload.jobId !== 'string' || !jobPattern.test(payload.jobId)) throw error('Kurier did not return a usable job ID.');
    return { network, jobId: payload.jobId, status: 'Submitted' };
  }

  async function getStatus(jobId) {
    if (typeof jobId !== 'string' || !jobPattern.test(jobId)) throw error('Invalid Kurier job ID.', 400);
    const { ok, status, payload } = await ask(`job-status/${keyPath}/${encodeURIComponent(jobId)}`);
    if (!ok || typeof payload?.status !== 'string') throw error(`Kurier did not return a job status (HTTP ${status}).`);
    const result = { network, jobId, status: payload.status };
    for (const field of ['txHash', 'blockHash', 'statement']) if (hashPattern.test(payload[field] ?? '')) result[field] = payload[field];
    if (result.status === 'Finalized' && !result.txHash) throw error('Kurier reported finalization without a transaction reference.');
    return result;
  }

  return { network, register, submit, getStatus };
}
