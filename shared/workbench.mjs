export const title = 'Gapmark';
export const description = 'Find gaps in uptime reports, check what meets your policy, and share evidence while keeping your monitoring CSV private.';

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
    <section class="proof-readiness" aria-label="Proof setup">
      <strong id="proof-readiness-label">Checking proof setup…</strong><p id="proof-readiness-detail" aria-live="polite"></p>
    </section>
    <section id="analyze" class="workbench" aria-label="Check your uptime data" tabindex="-1">
      <article class="panel configuration">
        <div class="panel-head"><div><h2>Create an uptime report</h2><p>Try a demo or upload checks from your own monitor.</p></div></div>
        <div class="samples" aria-label="Demo scenarios">
          <button type="button" data-sample="missing" aria-pressed="true">A check is missing</button><button type="button" data-sample="pass" aria-pressed="false">Target met</button><button type="button" data-sample="breach" aria-pressed="false">Target missed</button>
        </div>
        <p id="sample-description" class="sample-description" aria-live="polite"></p>
        <details id="your-data" class="data-guide"><summary>View or edit the CSV and report settings</summary>
          <p>Export scheduled check results from your monitoring tool, then use two columns named <code>timestamp</code> and <code>status</code>. Each row is one check at the start of its interval.</p>
          <pre>timestamp,status
2026-11-20T12:00:00Z,up
2026-11-20T12:05:00Z,down</pre>
          <p>For these rows, start at 12:00 UTC, use 5-minute intervals and expect 3 checks. The checker marks 12:10 as missing. A <code>Z</code> at the end of the timestamp means UTC.</p>
        <form id="analysis-form">
          <h3 class="form-title">Monitoring data</h3>
          <div class="csv-head"><label for="csv">Monitoring CSV</label><label class="upload">Upload CSV<input type="file" id="csv-file" accept=".csv,text/csv" aria-label="Import monitoring CSV"></label></div>
          <textarea id="csv" spellcheck="false" required maxlength="64000" aria-describedby="csv-help"></textarea>
          <p id="csv-help" class="note">An expected check with no row counts as missing. Files stay in this browser.</p>
          <h3 class="form-title policy-title">Agreed reporting window</h3>
          <div class="fields"><label>Service label<input id="service" maxlength="80" required value="Checkout API"></label>
          <label>Window start <span class="unit">UTC</span><input id="window-start" type="datetime-local" required value="2026-11-20T12:00"></label>
          <label>Check interval <span class="unit">minutes</span><input id="interval" type="number" required min="1" max="1440" value="5" aria-describedby="window-help"></label>
          <label>Expected checks<input id="slot-count" type="number" required min="1" max="48" value="12" aria-describedby="window-help"></label>
          <label>Required uptime <span class="unit">%</span><input id="threshold" type="number" required min="0" max="100" step="0.01" value="90"></label></div>
          <p class="form-help" id="window-help">12 checks every 5 minutes cover 1 hour. Up to 48 checks and 24 hours are supported.</p>
          <div class="actions"><button type="submit" class="primary">Calculate report</button><button type="button" class="text-button" id="download-csv">Download example CSV</button></div>
          <p id="input-error" class="error" role="alert" hidden></p>
        </form>
        </details>
      </article>
      <article class="panel result-panel">
        <div class="panel-head"><div><h2>Uptime report</h2><p id="window-caption">Load a sample or check your own data.</p><p id="report-origin" class="note" hidden></p></div></div>
        <div id="result" hidden>
          <div class="outcome"><strong id="verdict" aria-live="polite"></strong><p id="reason"></p></div>
          <div class="metrics"><div><span><b class="legend up"></b> Up</span><strong id="up">0</strong></div><div><span><b class="legend down"></b> Down</span><strong id="down">0</strong></div><div><span><b class="legend missing"></b> Missing</span><strong id="missing">0</strong></div></div>
          <section class="timeline-panel"><h3>Check timeline</h3><div id="timeline" class="timeline" aria-label="Monitoring intervals"></div><p id="slot-detail" class="note" aria-live="polite">Select a check to see its time and status.</p></section>
          <div class="proof-controls"><h3>Share or publish proof</h3><div class="actions"><button type="button" class="primary" id="generate" disabled>Generate proof</button><button type="button" id="download-proof" hidden>Download proof JSON</button><button type="button" id="try-verify" hidden>Verify this proof</button></div><p id="proof-state" class="note" role="status"></p><button type="button" class="text-button" id="retry-proof-assets" hidden>Recheck proof files</button></div>
          <section id="zkverify-controls" class="network-guide" hidden aria-label="zkVerify testnet">
            <p id="network-description" class="note"></p>
            <div class="actions"><button type="button" id="network-submit">Submit to zkVerify testnet</button><button type="button" id="network-refresh" hidden>Check transaction status</button></div>
            <p id="network-state" class="note" role="status"></p>
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
          <details class="data-guide monitor-guide"><summary>Check who signed the data</summary><p>Use a monitor key you obtained separately. A key sent with the report on its own doesn’t establish trust.</p><label for="monitor-key">Trusted monitor public key <span class="note">Ed25519 SPKI in base64url</span></label><input type="text" id="monitor-key" maxlength="120" autocomplete="off" spellcheck="false"></details>
          <div class="actions"><button type="submit" class="primary" id="verify-proof" disabled>Verify report</button></div><p id="verify-state" class="note" role="status"></p>
        </form>
      </article>
      <article class="panel result-panel"><div class="panel-head"><div><h2>Review result</h2><p id="review-caption">Upload and verify a proof to see what it establishes.</p></div></div>
        <div id="review-results" class="review-results" hidden>
          <div><strong>Proof</strong><p id="review-proof"></p></div>
          <div><strong>Your agreement</strong><p id="review-terms"></p></div>
          <div><strong>Data source</strong><p id="review-source"></p></div>
        </div>
      </article>
    </section>
    <section class="handoff panel" id="handoff" aria-labelledby="handoff-title"><h2 id="handoff-title">What gets handed over?</h2>
      <ol><li><strong>Monitor records checks</strong><p>A monitor checks the service on a schedule. An absent check stays missing.</p></li>
        <li><strong>Vendor sends a proof file</strong><p>The vendor imports the monitoring CSV in Gapmark and shares the generated JSON. The raw CSV stays with the vendor.</p></li>
        <li><strong>Customer verifies the report</strong><p>The customer checks the math, compares the agreed terms, and can verify a monitor signature using a trusted public key.</p></li></ol>
    </section>
    <footer><span>Gapmark</span><a href="/api/agent">Agent API</a></footer>
  </main>`;
