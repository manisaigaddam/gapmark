import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { assertProofBundle, serviceId } from '../public/evidence.mjs';
import { createKurierClient } from '../shared/kurier.mjs';
import { readVerificationKey, verifyLocally } from '../shared/verifier.mjs';

const [mode, bundlePath] = process.argv.slice(2);
if (mode !== 'register' && (mode !== 'verify' || !bundlePath)) throw new Error('Use register, or verify followed by a proof bundle path.');
const kurier = createKurierClient();

if (mode === 'register') {
  console.log(JSON.stringify({ vkHash: await kurier.register(await readVerificationKey()) }));
} else {
  const bundle = JSON.parse(await readFile(bundlePath, 'utf8'));
  const report = assertProofBundle(bundle);
  try {
    if (await serviceId(bundle.service) !== report.serviceId || !await verifyLocally(bundle)) throw new Error('Local proof verification failed.');
  } finally {
    await globalThis.curve_bn128?.terminate();
  }
  const vkHash = process.env.KURIER_VK_HASH || await kurier.register(await readVerificationKey());
  const submitted = await kurier.submit(bundle, vkHash);
  console.log(JSON.stringify({ ...submitted, commitment: report.commitment }));
  for (let attempt = 0; attempt < 24; attempt++) {
    const job = await kurier.getStatus(submitted.jobId);
    if (job.status === 'Finalized') { console.log(JSON.stringify(job)); break; }
    if (['Failed', 'Rejected', 'Error'].includes(job.status)) throw new Error(`Kurier reported ${job.status}.`);
    if (attempt === 23) throw new Error(`Verification has not finalized. Check job ${job.jobId} in Kurier.`);
    await delay(5000);
  }
}
