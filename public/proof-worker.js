let verifier;

async function verify(publicSignals, proof) {
  if (!verifier) {
    const response = await fetch('/zk/verification_key.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('The circuit’s verification key is unavailable.');
    verifier = await response.json();
  }
  return snarkjs.groth16.verify(verifier, publicSignals, proof);
}

self.onmessage = async ({ data }) => {
  try {
    importScripts('/zk/snarkjs.min.js');
    if (data.action === 'prove') {
      const result = await snarkjs.groth16.fullProve(data.input, '/zk/uptime.wasm', '/zk/uptime.zkey', undefined, undefined, { singleThread: true });
      if (!await verify(result.publicSignals, result.proof)) throw new Error('The generated proof did not verify.');
      self.postMessage({ result });
    } else if (data.action === 'verify') {
      self.postMessage({ result: await verify(data.publicSignals, data.proof) });
    } else throw new Error('Unknown proof action.');
  } catch (error) {
    self.postMessage({ error: error.message || 'The circuit could not run.' });
  }
};
