import { createPrivateKey, createPublicKey, sign } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { assertProofBundle, checkpointMessage, serviceId } from '../public/evidence.mjs';
import { verifyLocally } from '../shared/verifier.mjs';

const [bundlePath, privateKeyPath, outputPath] = process.argv.slice(2);
if (!bundlePath || !privateKeyPath || !outputPath) throw new Error('Pass the bundle, monitor private key (PEM), and new output file.');
const bundle = JSON.parse(await readFile(bundlePath, 'utf8'));
const report = assertProofBundle(bundle);
if (await serviceId(bundle.service) !== report.serviceId || !await verifyLocally(bundle)) throw new Error('Local proof verification failed.');
const key = createPrivateKey(await readFile(privateKeyPath));
if (key.asymmetricKeyType !== 'ed25519') throw new Error('Use an Ed25519 monitor key.');
bundle.checkpoint = { algorithm: 'Ed25519', signature: sign(null, checkpointMessage(report), key).toString('base64url') };
await writeFile(outputPath, `${JSON.stringify(bundle, null, 2)}\n`, { flag: 'wx' });
console.log(createPublicKey(key).export({ type: 'spki', format: 'der' }).toString('base64url'));
