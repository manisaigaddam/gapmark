import { analyze, assertProofBundle, checkCheckpoint, compareReportTerms, MAX_CSV_CHARS, MAX_SLOTS, SCHEMA, serviceId, SLOT } from './evidence.mjs';

const element = (id) => document.getElementById(id);
const labels = { PASS: 'Uptime target met', BREACH: 'Uptime target missed', INSUFFICIENT: 'Insufficient evidence' };
const start = '2026-11-20T12:00';
let selectedSample = 'missing';
let csvUploadRevision = 0;
let report, proofBundle, uploadedBundle;
let revision = 0;
let artifactsAvailable = false;
let assetError = '';
let checkingAssets = false;
let running;
let networkEnabled = false;
let reviewRevision = 0;
let uploadRevision = 0;
let networkJob;
let networkBusy = false;
const networkTerminal = new Set(['Finalized', 'Failed', 'Rejected', 'Error']);

function sampleCsv(kind) {
  const rows = ['timestamp,status'];
  for (let index = 0; index < 12; index++) {
    if (kind === 'missing' && index === 6) continue;
    const status = index === 10 || (kind === 'breach' && index === 5) ? 'down' : 'up';
    const timestamp = new Date(Date.parse(`${start}Z`) + index * 5 * 60000).toISOString();
    rows.push(`${timestamp},${status}`);
  }
  return rows.join('\n');
}

function loadSample(name) {
  selectedSample = name;
  csvUploadRevision++;
  element('calculate-report').disabled = false;
  element('csv-name').textContent = 'Built-in demo';
  for (const button of document.querySelectorAll('[data-sample]')) button.setAttribute('aria-pressed', String(button.dataset.sample === name));
  element('service').value = 'Checkout API';
  element('window-start').value = start;
  element('interval').value = '5';
  element('slot-count').value = '12';
  element('threshold').value = '90';
  element('csv').value = sampleCsv(name);
  updateWindowHelp();
  analyzeNow();
}

function updateWindowHelp() {
  const interval = element('interval').valueAsNumber;
  const count = element('slot-count').valueAsNumber;
  const limits = 'Up to 48 checks and 24 hours are supported.';
  if (!Number.isInteger(interval) || !Number.isInteger(count) || interval < 1 || count < 1 || count > MAX_SLOTS || interval * count > 1440) {
    element('window-help').textContent = limits;
    return;
  }
  const total = interval * count;
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  const duration = [hours && `${hours} hour${hours === 1 ? '' : 's'}`, minutes && `${minutes} minute${minutes === 1 ? '' : 's'}`].filter(Boolean).join(' ');
  const cadence = interval === 1 ? 'every minute' : `every ${interval} minutes`;
  element('window-help').textContent = `${count} ${count === 1 ? 'check' : 'checks'} ${cadence} cover${count === 1 ? 's' : ''} ${duration}. ${limits}`;
}

function proofState(text = '') {
  element('generate').disabled = !artifactsAvailable || !report || Boolean(running);
  element('download-proof').hidden = !proofBundle;
  element('try-verify').hidden = !proofBundle;
  element('retry-proof-assets').hidden = !assetError || checkingAssets;
  element('proof-state').textContent = text || (artifactsAvailable
    ? 'Proof generation runs on this device. The CSV stays in this browser.'
    : assetError || 'Checking the proof files.');
  updateNetworkControls();
}

function updateNetworkControls() {
  element('zkverify-controls').hidden = !proofBundle;
  element('network-description').textContent = networkEnabled
    ? 'Publish the proof and its public report values on the testnet. Your CSV stays here.'
    : 'Testnet submission is unavailable here. You can still download and verify the proof.';
  element('network-submit').disabled = !networkEnabled || networkBusy || Boolean(networkJob && (networkJob.status === 'Finalized' || !networkTerminal.has(networkJob.status)));
  element('network-refresh').hidden = !networkJob || networkTerminal.has(networkJob.status);
  element('network-refresh').disabled = networkBusy;
}

function resetNetworkProof() {
  networkJob = undefined;
  element('network-state').textContent = '';
}

function runInWorker(message) {
  if (running) return Promise.reject(new Error('A proof operation is already running.'));
  return new Promise((resolve, reject) => {
    const worker = new Worker('/proof-worker.js');
    running = worker;
    const stop = () => { worker.terminate(); running = undefined; clearTimeout(timeout); };
    const timeout = setTimeout(() => { stop(); reject(new Error('The proof operation took too long.')); }, 120000);
    worker.onmessage = ({ data }) => { stop(); if (data.error) reject(new Error(data.error)); else resolve(data.result); };
    worker.onerror = () => { stop(); reject(new Error('The browser could not load the proof worker.')); };
    worker.postMessage(message);
  });
}

function formatTime(epoch) { return new Date(epoch * 1000).toISOString().replace('.000Z', 'Z'); }

function render(result) {
  element('result').hidden = false;
  element('report-origin').hidden = false;
  element('report-origin').textContent = `Data source: ${element('csv-name').textContent}.`;
  element('window-caption').textContent = `${result.service} · ${formatTime(result.windowStart)} · ${result.slotCount} checks every ${result.intervalMinutes} min · ${result.thresholdBps / 100}% target`;
  element('verdict').parentElement.dataset.verdict = result.verdict;
  element('verdict').textContent = labels[result.verdict];
  const { up, missing } = result.counts;
  element('reason').textContent = missing
    ? `${missing} of ${result.slotCount} expected checks ${missing === 1 ? 'is' : 'are'} missing. A complete set is required to judge the uptime target.`
    : `${up} of ${result.slotCount} checks were up (${new Intl.NumberFormat('en', { maximumFractionDigits: 4 }).format(up * 100 / result.slotCount)}%). The target is ${result.thresholdBps / 100}%.`;
  for (const [status, value] of Object.entries(result.counts)) element(status).textContent = String(value);
  const timeline = element('timeline');
  timeline.replaceChildren();
  timeline.style.setProperty('--columns', String(Math.min(result.slots.length, 16)));
  timeline.style.setProperty('--mobile-columns', String(Math.min(result.slots.length, 8)));
  element('slot-detail').textContent = 'Select a check to see its time and status.';
  for (const slot of result.slots) {
    const detail = `${formatTime(slot.at)} · ${slot.status}${slot.recorded ? '' : ' (no CSV row)'}`;
    const button = document.createElement('button');
    button.type = 'button'; button.className = `slot ${slot.status}`;
    button.title = detail; button.setAttribute('aria-label', detail);
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => {
      timeline.querySelector('[aria-pressed="true"]')?.setAttribute('aria-pressed', 'false');
      button.setAttribute('aria-pressed', 'true');
      element('slot-detail').textContent = detail;
    });
    timeline.append(button);
  }
}

function analyzeNow() {
  revision++;
  proofBundle = undefined;
  resetNetworkProof();
  try {
    report = analyze({ csv: element('csv').value, service: element('service').value, start: `${element('window-start').value}Z`, intervalMinutes: element('interval').valueAsNumber, slotCount: element('slot-count').valueAsNumber, threshold: element('threshold').value });
    element('input-error').hidden = true;
    render(report);
  } catch (error) {
    report = undefined;
    element('input-error').textContent = error.message;
    element('input-error').hidden = false;
    element('result').hidden = true;
    element('report-origin').hidden = true;
    element('window-caption').textContent = 'Fix the input to calculate this report.';
  }
  proofState();
  return Boolean(report);
}

function download(text, type, name) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function invalidateReport() {
  revision++;
  report = undefined;
  proofBundle = undefined;
  resetNetworkProof();
  element('result').hidden = true;
  element('report-origin').hidden = true;
  element('input-error').hidden = true;
  element('window-caption').textContent = 'Select Calculate report to use these inputs.';
  for (const button of document.querySelectorAll('[data-sample]')) button.setAttribute('aria-pressed', 'false');
  proofState();
}

element('analysis-form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (!element('calculate-report').disabled) element(analyzeNow() ? 'report-title' : 'input-error').focus();
});
element('analysis-form').addEventListener('input', (event) => {
  if (event.target.type === 'file') return;
  if (event.target.id === 'csv') {
    csvUploadRevision++;
    element('calculate-report').disabled = false;
    element('csv-name').textContent = 'CSV entered by hand';
  }
  if (event.target.id === 'interval' || event.target.id === 'slot-count') updateWindowHelp();
  invalidateReport();
});
for (const button of document.querySelectorAll('[data-sample]')) button.addEventListener('click', () => loadSample(button.dataset.sample));
function showWorkflow(name) {
  element('analyze').hidden = name === 'verify';
  element('verify').hidden = name !== 'verify';
  for (const link of document.querySelectorAll('[data-workflow]')) {
    if (link.dataset.workflow === name) link.setAttribute('aria-current', 'true');
    else link.removeAttribute('aria-current');
  }
}
for (const link of document.querySelectorAll('[data-workflow]')) {
  link.addEventListener('click', () => showWorkflow(link.dataset.workflow));
}
function syncWorkflow() {
  if (location.hash === '#verify') showWorkflow('verify');
  if (location.hash === '#analyze' || location.hash === '#your-data') showWorkflow('analyze');
}
window.addEventListener('hashchange', syncWorkflow);
syncWorkflow();
element('csv-file').addEventListener('change', async ({ target }) => {
  const [file] = target.files;
  if (!file) return;
  const attempt = ++csvUploadRevision;
  target.value = '';
  element('csv').value = '';
  element('csv-name').textContent = 'Reading CSV file.';
  element('calculate-report').disabled = true;
  invalidateReport();
  try {
    if (file.size > MAX_CSV_CHARS * 4) throw new Error('CSV file is too large.');
    const content = await file.text();
    if (attempt !== csvUploadRevision) return;
    if (content.length > MAX_CSV_CHARS) throw new Error('CSV exceeds the 64,000-character limit.');
    element('csv').value = content;
    element('csv-name').textContent = file.name;
  } catch (error) {
    if (attempt !== csvUploadRevision) return;
    element('csv-name').textContent = 'Choose a CSV file';
    element('input-error').textContent = error.message;
    element('input-error').hidden = false;
    element('input-error').focus();
  } finally {
    if (attempt === csvUploadRevision) element('calculate-report').disabled = false;
  }
});
element('download-csv').addEventListener('click', () => download(`${sampleCsv(selectedSample)}\n`, 'text/csv', `uptime-${selectedSample}.csv`));
element('generate').addEventListener('click', async () => {
  if (!report || !artifactsAvailable || running) return;
  const current = report;
  const attempt = revision;
  element('generate').disabled = true;
  element('proof-state').textContent = 'Generating proof in the browser…';
  try {
    const saltBytes = new Uint8Array(31);
    do { crypto.getRandomValues(saltBytes); } while (saltBytes.every((v) => v === 0));
    const salt = BigInt('0x' + Array.from(saltBytes, (byte) => byte.toString(16).padStart(2, '0')).join('')).toString();
    const states = Array.from({ length: MAX_SLOTS }, (_, index) => SLOT[current.slots[index]?.status ?? 'missing']);
    const input = { serviceId: await serviceId(current.service), windowStart: current.windowStart, intervalMinutes: current.intervalMinutes, slotCount: current.slotCount, thresholdBps: current.thresholdBps, salt, states };
    const result = await runInWorker({ action: 'prove', input });
    if (attempt !== revision) return;
    const bundle = { schema: SCHEMA, service: current.service, ...result };
    const publicReport = assertProofBundle(bundle);
    if (Object.keys(current.counts).some((key) => current.counts[key] !== publicReport.counts[key]) || publicReport.verdict !== current.verdict ||
        publicReport.serviceId !== input.serviceId || publicReport.windowStart !== current.windowStart || publicReport.slotCount !== current.slotCount ||
        publicReport.intervalMinutes !== current.intervalMinutes || publicReport.thresholdBps !== current.thresholdBps) throw new Error('Public proof signals do not match the current report.');
    proofBundle = bundle;
    resetNetworkProof();
    proofState('Verified locally. Download the bundle to share the public summary and proof.');
  } catch (error) { if (attempt === revision) proofState(error.message); }
  finally { if (attempt !== revision) proofState(); updateVerify(); }
});
element('download-proof').addEventListener('click', () => {
  if (proofBundle) download(`${JSON.stringify(proofBundle, null, 2)}\n`, 'application/json', 'gapmark-proof.json');
});

async function networkRequest(input) {
  const response = await fetch('/api/zkverify', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input), signal: AbortSignal.timeout(65000)
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) throw new Error(payload?.error || 'The zkVerify endpoint did not respond.');
  return payload;
}

function showNetworkJob() {
  const { status, network, jobId, txHash } = networkJob;
  const heading = status === 'Finalized' ? `Confirmed on zkVerify ${network}.` : `Kurier status: ${status}`;
  element('network-state').textContent = [heading, `Job: ${jobId}`, txHash && `Transaction: ${txHash}`].filter(Boolean).join('\n');
}

async function runNetwork(action) {
  if (!proofBundle || !networkEnabled || networkBusy) return;
  const origin = proofBundle;
  networkBusy = true;
  updateNetworkControls();
  try {
    if (action === 'submit') {
      element('network-state').textContent = 'Checking the local proof and submitting it to Kurier.';
      const job = await networkRequest({ action: 'submit', bundle: {
        schema: origin.schema, service: origin.service, proof: origin.proof, publicSignals: origin.publicSignals
      } });
      if (origin !== proofBundle) return;
      networkJob = job;
      showNetworkJob();
    }
    for (let attempt = 0; attempt < 12 && networkJob && !networkTerminal.has(networkJob.status); attempt++) {
      if (attempt || action === 'submit') await new Promise((resolve) => setTimeout(resolve, 5000));
      if (origin !== proofBundle) return;
      const job = await networkRequest({ action: 'status', jobId: networkJob.jobId, receipt: networkJob.receipt });
      if (origin !== proofBundle) return;
      networkJob = { ...networkJob, ...job };
      showNetworkJob();
    }
    if (networkJob && !networkTerminal.has(networkJob.status)) element('network-state').textContent += '\nUse Check status to continue later.';
  } catch (error) {
    if (origin === proofBundle) {
      const details = networkJob ? `\nJob: ${networkJob.jobId}. You can check the same job again.` : '';
      element('network-state').textContent = `${error.message}${details}`;
    }
  } finally { networkBusy = false; updateNetworkControls(); }
}

element('network-submit').addEventListener('click', () => runNetwork('submit'));
element('network-refresh').addEventListener('click', () => runNetwork('status'));

function updateVerify() { element('verify-proof').disabled = !artifactsAvailable || !uploadedBundle || Boolean(running); }
function clearReview() {
  element('review-results').hidden = true;
  element('review-caption').textContent = 'Upload and verify a proof to see what it establishes.';
}
element('verify-form').addEventListener('input', ({ target }) => {
  if (target.type === 'file') return;
  reviewRevision++;
  clearReview();
  element('verify-state').textContent = uploadedBundle ? 'Select Verify proof to check the updated terms or key.' : '';
});
element('try-verify').addEventListener('click', () => {
  if (!proofBundle) return;
  uploadRevision++;
  reviewRevision++;
  uploadedBundle = proofBundle;
  element('proof-filename').textContent = 'Proof from this session';
  clearReview();
  showWorkflow('verify');
  location.hash = 'verify';
  updateVerify();
  element('verify-form').requestSubmit();
});
element('proof-file').addEventListener('change', async ({ target }) => {
  const [file] = target.files;
  const fileRevision = ++uploadRevision;
  reviewRevision++;
  uploadedBundle = undefined;
  element('proof-filename').textContent = file?.name ?? '';
  element('verify-state').textContent = '';
  clearReview();
  try {
    if (file) {
      if (file.size > 32000) throw new Error('Proof bundle is too large.');
      const bundle = JSON.parse(await file.text());
      assertProofBundle(bundle);
      if (fileRevision !== uploadRevision) return;
      uploadedBundle = bundle;
      element('verify-state').textContent = 'File is ready. Select Verify proof.';
    }
  } catch (error) {
    if (fileRevision === uploadRevision) {
      element('verify-state').textContent = error.message;
      element('review-title').focus();
    }
  }
  finally { if (fileRevision === uploadRevision) { target.value = ''; updateVerify(); } }
});

element('verify-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!uploadedBundle || !artifactsAvailable || running) return;
  const bundle = uploadedBundle;
  const attempt = reviewRevision;
  const trustedKey = element('monitor-key').value.trim();
  const expected = { service: element('expected-service').value, start: element('expected-start').value,
    interval: element('expected-interval').value, count: element('expected-count').value, threshold: element('expected-threshold').value };
  element('verify-proof').disabled = true;
  clearReview();
  element('review-title').focus();
  element('verify-state').textContent = 'Checking the Groth16 proof…';
  try {
    const publicReport = assertProofBundle(bundle);
    if (await serviceId(bundle.service) !== publicReport.serviceId) throw new Error('The service label does not match the public proof.');
    const valid = await runInWorker({ action: 'verify', publicSignals: bundle.publicSignals, proof: bundle.proof });
    if (!valid) throw new Error('Proof rejected. Its public signals or verification key do not match.');
    let origin;
    try { origin = await checkCheckpoint(bundle, publicReport, trustedKey); } catch (error) { origin = `Checkpoint could not be verified. ${error.message}`; }
    let termsMessage;
    try {
      const terms = compareReportTerms(publicReport, bundle.service, expected);
      termsMessage = terms.differences.length ? `Agreement fields differ: ${terms.differences.join(', ')}.` :
        terms.checked.length ? `Matches the ${terms.checked.length} ${terms.checked.length === 1 ? 'term' : 'terms'} you entered.` : 'Enter your agreement terms to compare them with the verified report.';
    } catch (error) { termsMessage = `Check the agreement fields and try again. ${error.message}`; }
    const { up, down, missing } = publicReport.counts;
    if (bundle === uploadedBundle && attempt === reviewRevision) {
      element('verify-state').textContent = '';
      element('review-caption').textContent = `${bundle.service} · ${formatTime(publicReport.windowStart)} · ${publicReport.slotCount} checks × ${publicReport.intervalMinutes} min · ${publicReport.thresholdBps / 100}% target`;
      element('review-proof').textContent = 'Proof verified using the Gapmark circuit key.';
      element('review-verdict').textContent = `${labels[publicReport.verdict]}. ${up} up, ${down} down, ${missing} missing.`;
      element('review-terms').textContent = termsMessage;
      element('review-source').textContent = origin;
      element('review-results').hidden = false;
    }
  } catch (error) { if (bundle === uploadedBundle && attempt === reviewRevision) element('verify-state').textContent = error.message; }
  finally { updateVerify(); proofState(proofBundle ? 'Verified locally. Download the bundle to share the public summary and proof.' : ''); }
});

const proofAssets = ['/zk/uptime.wasm', '/zk/uptime.zkey', '/zk/verification_key.json', '/zk/snarkjs.min.js', '/proof-worker.js'];
const fetchFresh = (url, init) => fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(10000), ...init });

async function checkProofAssets() {
  if (checkingAssets) return;
  checkingAssets = true;
  assetError = '';
  element('verify-readiness').textContent = 'Checking proof setup.';
  proofState();
  try {
    if (!globalThis.isSecureContext || typeof Worker !== 'function') throw new Error('Open the site on HTTPS or localhost to run browser proofs.');
    const response = await fetchFresh('/zk/manifest.json');
    if (!response.ok) throw new Error(`Proof manifest unavailable (HTTP ${response.status}).`);
    if ((await response.json()).schema !== SCHEMA) throw new Error('The hosted circuit does not match this version of the site.');
    const files = await Promise.all(proofAssets.map((url) => fetchFresh(url, { method: 'HEAD' })));
    const missing = files.findIndex((file) => !file.ok || file.headers.get('content-type')?.includes('text/html'));
    if (missing !== -1) throw new Error(`Could not load ${proofAssets[missing].split('/').at(-1)} (HTTP ${files[missing].status}).`);
    artifactsAvailable = true;
  } catch (error) {
    artifactsAvailable = false;
    assetError = error.name === 'TimeoutError' ? 'The proof file check timed out.' : error.message;
  } finally {
    checkingAssets = false;
    element('verify-readiness').textContent = assetError;
    proofState();
    updateVerify();
  }
}

element('retry-proof-assets').addEventListener('click', checkProofAssets);
loadSample('missing');
void checkProofAssets();
void fetchFresh('/api/zkverify').then(async (response) => {
  networkEnabled = response.ok && (await response.json()).enabled === true;
}).catch(() => {}).finally(updateNetworkControls);
