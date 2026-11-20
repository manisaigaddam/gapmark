import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

let verifier;
let active = 0;

export async function readVerificationKey() {
  return JSON.parse(await readFile(join(process.cwd(), 'public', 'zk', 'verification_key.json'), 'utf8'));
}

export async function verifyLocally(bundle) {
  if (active >= 2) throw Object.assign(new Error('The proof verifier is busy. Try again shortly.'), { status: 429 });
  active++;
  try {
    if (!verifier) {
      verifier = Promise.all([readVerificationKey(), import('snarkjs')]).catch((cause) => {
        verifier = undefined;
        throw Object.assign(new Error('The proof verifier has not been configured on this deployment.'), { cause, status: 503 });
      });
    }
    const [key, { groth16 }] = await verifier;
    return await groth16.verify(key, bundle.publicSignals, bundle.proof);
  } finally {
    active--;
  }
}
