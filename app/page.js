import DemoWindow from './components/demo-window.js';
import ProofJourney from './components/proof-journey.js';
import { Footer, Header } from './components/chrome.js';

export default function Page() {
  return <>
    <Header />
    <main id="main">
      <section className="landing-hero">
        <div className="page-width hero-layout">
          <div className="landing-copy">
            <h1>Give your uptime report <em>a receipt.</em></h1>
            <p>When monitoring checks are missing, an uptime percentage can hide gaps. Gapmark flags incomplete reports and gives service providers a proof their customers can verify without seeing the raw logs.</p>
            <div className="landing-actions"><a className="cta lime" href="/create?sample=missing">Try the missing-check demo</a><a className="cta outline" href="/review">Review a proof</a></div>
          </div>
          <DemoWindow />
        </div>
      </section>
      <ProofJourney />
      <section className="handover-band">
        <div className="page-width handover-grid">
          <h2>From service provider to reviewer.</h2>
          <article><h3>For providers</h3><p>Turn a monitoring CSV into a report you can share as a file or grant access to by email.</p><a href="/create">Create a report</a></article>
          <article><h3>For reviewers</h3><p>Check the proof and compare its time window and target with your agreement.</p><a href="/guide#review">Follow the review guide</a></article>
        </div>
      </section>
      <section className="page-width proof-story" aria-labelledby="proof-story-title">
        <div><h2 id="proof-story-title">What the evidence shows.</h2><a className="studio-guide-link" href="/guide">Read the user guide</a></div>
        <div className="proof-explain">
          <article><h3>The report calculation</h3><p>The proof binds the reported counts and verdict to the selected service, window and target. Without a trusted monitor signature, the underlying observations are self-reported.</p></article>
          <article><h3>Optional testnet verification</h3><p>When enabled, Gapmark can submit the same proof to zkVerify and attach a receipt after finalization on Volta. The reviewer can open the transaction in a block explorer.</p></article>
          <article><h3>Private monitoring logs</h3><p>The website reads the CSV in your browser. The shareable file includes the service label, window, target, counts and proof.</p></article>
        </div>
      </section>
    </main>
    <Footer />
  </>;
}
