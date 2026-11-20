import { createHash } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Readable } from 'node:stream';
import { SCHEMA } from '../public/evidence.mjs';

const [deployment] = process.argv.slice(2);
if (!deployment) throw new Error('Pass the exact HTTPS URL of your own Gapmark deployment.');
const base = new URL(deployment);
if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || base.pathname !== '/') {
  throw new Error('Use the deployment origin without a path, query, or credentials.');
}
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const target = resolve('public', 'zk');
const names = ['verification_key.json', 'uptime.wasm', 'uptime.zkey', 'snarkjs.min.js'];

async function readAsset(name, limit) {
  const response = await fetch(new URL(`/zk/${name}`, base), { redirect: 'error', signal: AbortSignal.timeout(30000) });
  if (!response.ok || !response.body) throw new Error(`Could not download ${name} (HTTP ${response.status}). Use a reachable deployment with proof files.`);
  const parts = [];
  let size = 0;
  for await (const part of Readable.fromWeb(response.body)) {
    size += part.length;
    if (size > limit) throw new Error(`${name} exceeds its allowed size.`);
    parts.push(part);
  }
  return Buffer.concat(parts);
}

const manifest = JSON.parse(await readAsset('manifest.json', 8000));
if (manifest.schema !== SCHEMA || names.some((name) => !/^[a-f0-9]{64}$/.test(manifest.sha256?.[name] ?? ''))) {
  throw new Error('This deployment does not publish a compatible integrity manifest. Use the updated Vercel build.');
}

const existingManifest = resolve(target, 'manifest.json');
const existingAssets = await Promise.all([...names, 'manifest.json'].map((name) => access(resolve(target, name)).then(() => true, () => false)));
if (existingAssets.some(Boolean)) {
  if (existingAssets.every(Boolean)) {
    const local = JSON.parse(await readFile(existingManifest, 'utf8'));
    if (local.schema === SCHEMA && names.every((name) => local.sha256?.[name] === manifest.sha256[name]) &&
        (await Promise.all(names.map(async (name) => hash(await readFile(resolve(target, name))) === manifest.sha256[name]))).every(Boolean)) {
      console.log('This project already has the matching files and verification key.');
      process.exit(0);
    }
  }
  throw new Error('Local proof files already exist. Back up public/zk before switching to a different key.');
}

const verified = await Promise.all(names.map(async (name) => {
  const bytes = name === 'snarkjs.min.js' ? await readFile('node_modules/snarkjs/build/snarkjs.min.js') : await readAsset(name, 24 * 1024 * 1024);
  if (hash(bytes) !== manifest.sha256[name]) throw new Error(`${name} does not match the published checksum. Check the deployment and npm dependencies.`);
  return [name, bytes];
}));
await mkdir(target, { recursive: true });
await Promise.all(verified.map(([name, bytes]) => writeFile(resolve(target, name), bytes, { flag: 'wx' })));
await writeFile(existingManifest, `${JSON.stringify(manifest)}\n`, { flag: 'wx' });
console.log('Proof files are ready. Local proofs can use the same key as this deployment.');
