import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Readable } from 'node:stream';
import { SCHEMA } from '../public/evidence.mjs';

const artifacts = ['manifest.json', 'verification_key.json', 'uptime.wasm', 'uptime.zkey', 'snarkjs.min.js'];
const ready = await Promise.all(artifacts.map((file) => access(resolve('public/zk', file)).then(() => true, () => false)));
if (ready.every(Boolean)) {
  const manifest = JSON.parse(await readFile('public/zk/manifest.json', 'utf8'));
  if (manifest.schema !== SCHEMA) throw new Error('The proof manifest does not match this version of Gapmark.');
  for (const name of artifacts.slice(1)) {
    const digest = createHash('sha256').update(await readFile(resolve('public/zk', name))).digest('hex');
    if (manifest.sha256?.[name] !== digest) throw new Error(`The checksum for ${name} does not match the proof manifest.`);
  }
  console.log('Using the proof artifacts already included in public/zk.');
  process.exit(0);
}
if (ready.some(Boolean)) throw new Error('public/zk contains an incomplete proof setup. Use all five files from the same build.');
if (!['linux', 'win32'].includes(process.platform) || process.arch !== 'x64') {
  throw new Error('The automatic build supports Windows x64 and Linux x64. You can also pull proof assets from your Vercel deployment.');
}

const release = 'v2.2.3';
const binary = process.platform === 'win32' ? 'circom-windows-amd64.exe' : 'circom-linux-amd64';
const releaseUrl = `https://api.github.com/repos/iden3/circom/releases/tags/${release}`;
const officialBinary = `https://github.com/iden3/circom/releases/download/${release}/${binary}`;
const ptauSource = 'https://circom.info/powersOfTau28_hez_final_12.ptau';
const ptauDigest = 'ded2694169b7b08e898f736d5de95af87c3f1a64594013351b1a796dbee393bd825f88f9468c84505ddd11eb0b1465ac9b43b9064aa8ec97f2b73e04758b8a4a';

async function download(url, destination, algorithm, expectedHash) {
  const response = await fetch(url, { signal: AbortSignal.timeout(90000) });
  if (!response.ok || !response.body) throw new Error(`Required build asset returned HTTP ${response.status}.`);
  const hash = createHash(algorithm);
  const chunks = [];
  let total = 0;
  for await (const chunk of Readable.fromWeb(response.body)) {
    total += chunk.length;
    if (total > 64 * 1024 * 1024) throw new Error('Required build asset exceeds its download limit.');
    hash.update(chunk);
    chunks.push(chunk);
  }
  if (hash.digest('hex') !== expectedHash) throw new Error('Build asset failed its published checksum.');
  await writeFile(destination, Buffer.concat(chunks));
}

console.log('Preparing Gapmark proof assets from the official Circom release.');
const metadata = await fetch(releaseUrl, { headers: { accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(15000) })
  .catch(() => { throw new Error('GitHub could not be reached. Run this from regular PowerShell or let Vercel build the proof files.'); });
if (!metadata.ok) throw new Error(`Official Circom release lookup returned HTTP ${metadata.status}.`);
const info = await metadata.json();
const asset = info.assets?.find((entry) => entry.name === binary && entry.browser_download_url === officialBinary);
if (!/^sha256:[a-f0-9]{64}$/.test(asset?.digest ?? '')) throw new Error('Official Circom release asset has no SHA-256 digest.');

const dir = resolve('build', 'upstream');
await mkdir(dir, { recursive: true });
const compilerPath = resolve(dir, process.platform === 'win32' ? 'circom.exe' : 'circom');
const ptauPath = resolve(dir, 'powersOfTau28_hez_final_12.ptau');
await Promise.all([
  download(officialBinary, compilerPath, 'sha256', asset.digest.slice(7)),
  download(ptauSource, ptauPath, 'blake2b512', ptauDigest)
]);
if (process.platform === 'linux') await chmod(compilerPath, 0o700);
execFileSync(process.execPath, ['scripts/prepare-zk.mjs', ptauPath], {
  stdio: 'inherit', env: { ...process.env, CIRCOM_BIN: compilerPath }
});
