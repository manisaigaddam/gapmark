import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { access, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { zKey } from 'snarkjs';
import { SCHEMA } from '../public/evidence.mjs';

const [source, finalKeyArg] = process.argv.slice(2);
if (!source) throw new Error('Pass a verified phase-2 Powers of Tau file and optionally a final circuit zkey.');
const ptau = resolve(source);
await access(ptau);
const build = resolve('build', 'zk');
const target = resolve('public', 'zk');
await mkdir(build, { recursive: true });
await mkdir(target, { recursive: true });
const circom = process.env.CIRCOM_BIN || 'circom';
const cli = resolve('node_modules', 'snarkjs', 'build', 'cli.cjs');
const run = (command, args) => execFileSync(command, args, { stdio: 'inherit' });
const snark = (...args) => run(process.execPath, [cli, ...args]);

run(circom, ['circuits/uptime.circom', '--r1cs', '--wasm', '--sym', '-l', 'node_modules', '-o', build]);
const r1cs = join(build, 'uptime.r1cs');
const zkey = finalKeyArg ? resolve(finalKeyArg) : join(build, 'uptime.final.zkey');
if (!finalKeyArg) {
  console.log('Creating a demo setup. Use an independently contributed and verified final key for third-party reliance.');
  const initial = join(build, 'uptime.initial.zkey');
  snark('groth16', 'setup', r1cs, ptau, initial);
  try {
    await zKey.contribute(initial, zkey, 'Gapmark demo', randomBytes(64).toString('hex'));
  } finally {
    // snarkjs caches the BN254 worker pool in ffjavascript. Release it in this one-shot build task.
    await globalThis.curve_bn128?.terminate();
  }
}
snark('zkey', 'verify', r1cs, ptau, zkey);
snark('zkey', 'export', 'verificationkey', zkey, join(build, 'verification_key.json'));
await Promise.all([
  copyFile(join(build, 'uptime_js', 'uptime.wasm'), join(target, 'uptime.wasm')),
  copyFile(zkey, join(target, 'uptime.zkey')),
  copyFile(join(build, 'verification_key.json'), join(target, 'verification_key.json')),
  copyFile(resolve('node_modules', 'snarkjs', 'build', 'snarkjs.min.js'), join(target, 'snarkjs.min.js'))
]);
const names = ['verification_key.json', 'uptime.wasm', 'uptime.zkey', 'snarkjs.min.js'];
const sha256 = Object.fromEntries(await Promise.all(names.map(async (name) => [name, createHash('sha256').update(await readFile(join(target, name))).digest('hex')])));
await writeFile(join(target, 'manifest.json'), `${JSON.stringify({ schema: SCHEMA, setup: finalKeyArg ? 'external' : 'local-demo', sha256 })}\n`);
console.log('Browser proof artifacts are ready in public/zk. Test a proof against the generated verification key before deploying.');
