export const title = 'Gapmark';
export const description = 'Find gaps in uptime reports, check what meets your policy, and share evidence while keeping your monitoring CSV private.';

function transactionDetails(prefix) {
  return `<div class="transaction-details" id="${prefix}-transaction" hidden>
    <p class="note">Transaction hash <code id="${prefix}-tx-hash"></code></p>
    <div class="actions"><a id="${prefix}-explorer" target="_blank" rel="noopener noreferrer">View transaction on zkVerify Volta</a>
      <button type="button" data-copy-transaction="${prefix}">Copy transaction link</button></div>
    <p class="note" id="${prefix}-copy-status" role="status"></p>
  </div>`;
}

export const workbench = `
  <a class="skip-link" href="#analyze" data-workflow="analyze">Skip to the checker</a>
  <header class="topbar"><div class="shell nav">
    <a class="brand" href="/" aria-label="Gapmark home"><img src="/gapmark.png" alt="" width="40" height="40"> Gapmark</a>
    <nav aria-label="Main navigation"><a href="#handoff">How it works</a><a href="#analyze" data-workflow="analyze">Create report</a><a href="#verify" data-workflow="verify">Verify report</a></nav>
  </div></header>
  <main class="shell">
    <section class="hero" aria-labelledby="page-title">
      <div class="hero-copy"><p class="eyebrow">UPTIME EVIDENCE</p>
        <h1 id="page-title">Prove how you counted <em>uptime.</em></h1>
        <p class="intro">Load a monitoring CSV, check it against your uptime target, and share a proof. Your customer can verify the calculation while your raw logs stay on your device.</p>
      </div>
      <div class="role-picker" aria-label="Choose a workflow">
        <a href="#analyze" data-workflow="analyze" class="role-link" aria-current="true"><span>VENDOR OR MONITOR OWNER</span><strong>Create a report</strong><small>I have a monitoring export.</small></a>
        <a href="#verify" data-workflow="verify" class="role-link"><span>CUSTOMER OR REVIEWER</span><strong>Verify a report</strong><small>Someone sent me a proof file.</small></a>
      </div>
    </section>
    <section id="analyze" class="workbench" aria-label="Check your uptime data" tabindex="-1">
      <article class="panel configuration">
        <div class="panel-head"><div><h2>Monitoring data</h2><p>Upload a CSV from your monitor or load a demo.</p></div></div>
        <form id="analysis-form">
          <div class="data-input"><label class="upload">Choose CSV file<input type="file" id="csv-file" accept=".csv,text/csv" aria-label="Choose monitoring CSV" aria-describedby="csv-name"></label><p id="csv-name" class="note" role="status">Built-in demo</p></div>
          <details id="your-data" class="data-guide"><summary>Paste or edit CSV</summary>
            <label for="csv">CSV content</label>
            <p id="csv-help">Use <code>timestamp,status</code> as the header. Rows must match the scheduled checks. Use a timezone such as <code>Z</code> for UTC. Allowed statuses are <code>up</code>, <code>down</code>, and <code>missing</code>.</p>
            <textarea id="csv" spellcheck="false" maxlength="64000" aria-describedby="csv-help" placeholder="timestamp,status&#10;2026-11-20T12:00:00Z,up"></textarea>
          </details>
          <h3 class="form-title policy-title">Report settings</h3>
          <div class="fields"><label>Service label<input id="service" maxlength="80" required value="Checkout API"></label>
          <label>Window start <span class="unit">UTC</span><input id="window-start" type="datetime-local" required value="2026-11-20T12:00"></label>
          <label>Check interval <span class="unit">minutes</span><input id="interval" type="number" required min="1" max="1440" value="5" aria-describedby="window-help"></label>
          <label>Expected checks<input id="slot-count" type="number" required min="1" max="48" value="12" aria-describedby="window-help"></label>
          <label>Required uptime <span class="unit">%</span><input id="threshold" type="number" required min="0" max="100" step="0.01" value="90"></label></div>
          <p class="form-help" id="window-help">12 checks every 5 minutes cover 1 hour. Up to 48 checks and 24 hours are supported.</p>
          <div class="actions"><button type="submit" class="primary" id="calculate-report">Calculate report</button></div>
          <p id="input-error" class="error" role="alert" tabindex="-1" hidden></p>
        </form>
        <details class="data-guide demo-guide" open><summary>Choose a demo scenario</summary>
          <div class="samples" aria-label="Demo scenarios">
            <button type="button" data-sample="missing" aria-pressed="true">One check missing</button><button type="button" data-sample="pass" aria-pressed="false">One check down</button><button type="button" data-sample="breach" aria-pressed="false">Two checks down</button>
          </div>
          <button type="button" class="text-button" id="download-csv">Download example CSV</button>
        </details>
      </article>
      <article class="panel result-panel">
        <div class="panel-head"><div><h2 id="report-title" tabindex="-1">Uptime report</h2><p id="window-caption" aria-live="polite">Load a sample or check your own data.</p><p id="report-origin" class="note" hidden></p></div></div>
        <div id="result" hidden>
          <div class="outcome"><strong id="verdict" aria-live="polite"></strong><p id="reason"></p></div>
          <div class="metrics"><div><span><b class="legend up"></b> Up</span><strong id="up">0</strong></div><div><span><b class="legend down"></b> Down</span><strong id="down">0</strong></div><div><span><b class="legend missing"></b> Missing</span><strong id="missing">0</strong></div></div>
          <section class="timeline-panel"><h3>Check timeline</h3><div id="timeline" class="timeline" aria-label="Monitoring intervals"></div><p id="slot-detail" class="note" aria-live="polite">Select a check to see its time and status.</p></section>
          <div class="proof-controls"><h3>Report proof</h3><div class="actions"><button type="button" class="primary" id="generate" disabled>Generate proof</button><button type="button" id="download-proof" hidden>Download proof JSON</button><button type="button" id="try-verify" hidden>Verify this proof</button></div><p id="proof-state" class="note" role="status"></p><button type="button" class="text-button" id="retry-proof-assets" hidden>Recheck proof files</button></div>
          <section id="zkverify-controls" class="network-guide" hidden aria-label="zkVerify testnet">
            <h3>Optional zkVerify receipt</h3>
            <p id="network-description" class="note"></p>
            <div class="actions"><button type="button" id="network-submit">Submit to zkVerify testnet</button><button type="button" id="network-refresh" hidden>Check transaction status</button></div>
            <p id="network-state" class="note" role="status"></p>${transactionDetails('network')}
          </section>
        </div>
      </article>
    </section>
    <section id="verify" class="workbench" aria-label="Verify a report" tabindex="-1" hidden>
      <article class="panel configuration">
        <div class="panel-head"><div><h2>Verify a report</h2><p>Upload the proof JSON the vendor sent you. You don’t need their monitoring CSV.</p></div></div>
        <form id="verify-form">
          <label class="upload verify-upload">Upload proof JSON<input type="file" id="proof-file" accept=".json,application/json" aria-label="Choose proof JSON"></label><span id="proof-filename" class="note"></span>
          <details class="data-guide monitor-guide"><summary>Compare it with your agreement</summary><p>Enter the terms you agreed with the vendor. Leave fields blank if you only want to check the math.</p>
            <div class="fields comparison-fields"><label>Service label<input id="expected-service" maxlength="80"></label><label>Window start <span class="unit">UTC</span><input id="expected-start" type="datetime-local"></label><label>Check interval <span class="unit">min</span><input id="expected-interval" type="number" min="1" max="1440"></label><label>Expected checks<input id="expected-count" type="number" min="1" max="48"></label><label>Required uptime <span class="unit">%</span><input id="expected-threshold" type="number" min="0" max="100" step="0.01"></label></div>
          </details>
          <details class="data-guide monitor-guide"><summary>Check who signed the data</summary><p>For a signed report, get the monitor's public key from a source you trust before checking the signature.</p><label for="monitor-key">Trusted monitor public key <span class="note">Ed25519 SPKI in base64url</span></label><input type="text" id="monitor-key" maxlength="120" autocomplete="off" spellcheck="false"></details>
          <div class="actions"><button type="submit" class="primary" id="verify-proof" disabled>Verify proof</button></div><p id="verify-readiness" class="note" role="status"></p>
        </form>
      </article>
      <article class="panel result-panel"><div class="panel-head"><div><h2 id="review-title" tabindex="-1">Review result</h2><p id="review-caption">Upload and verify a proof to see what it establishes.</p></div></div>
        <p id="verify-state" class="note" role="status"></p>
        <div id="review-results" class="review-results" hidden>
          <div><strong>Cryptographic check</strong><p id="review-proof"></p></div>
          <div><strong>Uptime result</strong><p id="review-verdict"></p></div>
          <div><strong>Your agreement</strong><p id="review-terms"></p></div>
          <div><strong>Data source</strong><p id="review-source"></p></div>
          <div><strong>zkVerify testnet</strong><p id="review-chain" role="status"></p>${transactionDetails('review')}</div>
        </div>
      </article>
    </section>
    <section class="handoff panel" id="handoff" aria-labelledby="handoff-title"><h2 id="handoff-title">What gets handed over?</h2>
      <ol><li><strong>Monitor records checks</strong><p>A monitor checks the service on a schedule. An absent check stays missing.</p></li>
        <li><strong>Vendor sends a proof file</strong><p>The vendor imports the monitoring CSV in Gapmark and shares the generated JSON. The raw CSV stays with the vendor.</p></li>
        <li><strong>Customer verifies the report</strong><p>The customer checks the math, compares the agreed terms, and can verify a monitor signature using a trusted public key.</p></li></ol>
    </section>
    <footer><span>Gapmark</span><div><a href="/api/agent">Agent API</a><a href="/api/agent/openapi">OpenAPI specification</a></div></footer>
  </main>`;

export function operationWorkbench(mode) {
  const sections = workbench.slice(workbench.indexOf('    <section id="analyze"'), workbench.indexOf('    <section class="handoff'));
  const shared = sections
    .replace('<button type="button" id="try-verify" hidden>Verify this proof</button>', '<button type="button" id="try-verify" hidden>Verify this proof</button><button type="button" id="save-issued" hidden>Save to workspace</button>')
    .replace('id="proof-state" class="note" role="status"></p>', 'id="proof-state" class="note" role="status"></p><p id="issued-save-state" class="note" role="status"></p><a id="issued-workspace-link" class="workspace-inline" href="/workspace" target="_blank" rel="noopener" hidden>Open workspace</a>')
    .replace('id="review-source"></p></div>', 'id="review-source"></p></div><div class="review-save"><button id="save-reviewed" type="button">Save to workspace</button><p id="reviewed-save-state" class="note" role="status"></p><a id="reviewed-workspace-link" class="workspace-inline" href="/workspace" target="_blank" rel="noopener" hidden>Open workspace</a></div>');
  return mode === 'review'
    ? shared.replace(/(<section id="analyze"[^>]*)(>)/, '$1 hidden$2').replace(/(<section id="verify"[^>]*) hidden>/, '$1>')
    : shared;
}
