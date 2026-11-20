import { demoCases, demoWindow } from '../../public/demo-data.mjs';
import { Footer, Header } from '../components/chrome.js';

export const metadata = { title: 'User guide' };

export default function Page() {
  return <>
    <Header active="guide" />
    <main id="main" className="page-width guide-page">
      <div className="studio-title">
        <h1>Test Gapmark with an example</h1>
        <p>Start with a built-in monitoring sample. Create a proof and open it as a reviewer in the same browser. You can do both without an account.</p>
        <a className="cta dark" href="/create?sample=missing">Open the missing-check demo</a>
      </div>
      <nav className="guide-nav" aria-label="Guide sections">
        <a href="#create">Create a report</a><a href="#review">Review a proof</a>
        <a href="#volta">Find a zkVerify transaction</a><a href="#workspace">Share from Workspace</a>
      </nav>
      <div className="guide-grid">
        <section className="guide-card guide-wide" id="create">
          <h2>Create a report</h2>
          <p>Each demo uses <strong>{demoWindow.service}</strong> on <strong>20 Nov 2026, 12:00 UTC</strong>, with <strong>{demoWindow.slotCount} checks</strong> every <strong>{demoWindow.intervalMinutes} minutes</strong> and a <strong>{demoWindow.threshold}% target</strong>. Select a bar in the check timeline to see its timestamp and status. An omitted CSV row is marked as missing.</p>
          <table className="demo-table">
            <thead><tr><th scope="col">Example</th><th scope="col">Check counts</th><th scope="col">Expected verdict</th></tr></thead>
            <tbody>{Object.entries(demoCases).map(([id, sample]) => <tr key={id}>
              <th scope="row"><a href={`/create?sample=${id}`}>{sample.label}</a></th>
              <td>{demoWindow.slotCount - sample.down.length - sample.missing.length} up, {sample.down.length} down, {sample.missing.length} missing</td>
              <td><span className="guide-verdict" data-tone={id}>{sample.verdict}</span></td>
            </tr>)}</tbody>
          </table>
          <ol>
            <li>Open an example above or use <strong>Choose CSV file</strong>. For your own file, set the report window and select <strong>Calculate report</strong>.</li>
            <li>Select <strong>Generate proof</strong>. The browser checks the proof before making it available to share.</li>
            <li>Select <strong>Download proof JSON</strong> to keep a copy. Select <strong>Verify this proof</strong> to take it directly to Review.</li>
          </ol>
          <details className="guide-details"><summary>CSV format and limits</summary>
            <p>Use <code>timestamp,status</code> as the header and ISO timestamps with a timezone. Valid statuses are <code>up</code>, <code>down</code>, and <code>missing</code>. Use up to 48 scheduled checks across at most 24 hours. Each row must fall on a unique scheduled check.</p>
            <pre><code>{'timestamp,status\n2026-11-20T12:00:00Z,up\n2026-11-20T12:05:00Z,down\n2026-11-20T12:10:00Z,missing'}</code></pre>
            <p>To test this CSV, set three expected checks. Try adding a second row with the same timestamp to see the input error.</p>
          </details>
        </section>
        <section className="guide-card guide-wide" id="review">
          <h2>Review a proof</h2>
          <ol>
            <li>Use <strong>Verify this proof</strong> from Create or open <a href="/review">Review</a> and select <strong>Upload proof JSON</strong>.</li>
            <li>Select <strong>Verify proof</strong>. The cryptographic check should succeed and the uptime verdict should match Create. A verified proof can still report a missed target or insufficient evidence.</li>
            <li>Expand <strong>Compare it with your agreement</strong>. Enter 90 as the required uptime, then verify again. Try 95 and verify again. The proof still verifies, and the agreement check flags the target mismatch.</li>
          </ol>
          <p className="guide-note">The proof verifies the calculation from the reported checks. To check who attested to those checks, use a signed report and a monitor public key you obtained independently.</p>
        </section>
        <section className="guide-card" id="volta">
          <h2>Find a zkVerify transaction</h2>
          <ol>
            <li>In <a href="/create">Create</a>, generate a proof and select <strong>Submit to zkVerify testnet</strong> if enabled. If the job stays pending, select <strong>Check transaction status</strong>.</li>
            <li>After finalization, find the hash under <strong>Optional zkVerify receipt</strong>. Select <strong>View transaction on zkVerify Volta</strong> to open it or <strong>Copy transaction link</strong> to share it.</li>
            <li>Download the proof and receipt together. In Review, verify the bundle to find the same link after Gapmark confirms the receipt matches.</li>
          </ol>
          <p><a href="https://zkverify-testnet.subscan.io/">Browse the zkVerify Volta explorer</a></p>
        </section>
        <section className="guide-card" id="workspace">
          <h2>Share from Workspace</h2>
          <p>On a deployment with Workspace enabled, <a href="/workspace">sign in by email</a> and save a generated proof. In <strong>Issued</strong>, grant a second email access, then copy the report link.</p>
          <p>In a separate browser profile, open the link and sign in with the second email. Verify that access works, then revoke it from the issuer's Workspace and reopen the link as the reviewer. Downloaded copies remain usable.</p>
          <p>Enter the numeric code from your email in the same Workspace tab. If your email only contains a link, ask the site operator to enable code-based emails in Supabase.</p>
        </section>
      </div>
    </main>
    <Footer />
  </>;
}
