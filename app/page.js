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
            <p className="folio">VERIFIABLE UPTIME REPORTS</p>
            <h1>Give your uptime report <em>a receipt.</em></h1>
            <p>Check an uptime report from a CSV. Prove the calculation, publish a verification on zkVerify, and hand your customer one file they can check.</p>
            <div className="landing-actions"><a className="cta lime" href="/create">Create a report</a><a className="cta outline" href="/review">Verify a proof</a></div>
          </div>
          <DemoWindow />
        </div>
      </section>
      <ProofJourney />
      <section className="handover-band">
        <div className="page-width handover-grid">
          <h2>One workspace for both sides of a service agreement.</h2>
          <article className="scroll-reveal"><h3>Issue reports</h3><p>Save proofs and their zkVerify receipts. Grant a reviewer access by email and revoke access to the online copy when needed.</p><a href="/create">Create a report</a></article>
          <article className="scroll-reveal"><h3>Review evidence</h3><p>Check a shared report or upload its proof JSON. Compare the target and reporting window, then save a copy to your own history.</p><a href="/workspace">Open workspace</a></article>
        </div>
      </section>
      <section className="page-width proof-story" aria-labelledby="proof-story-title">
        <div><h2 id="proof-story-title">What you can check.</h2></div>
        <div className="proof-explain scroll-reveal">
          <article><h3>Can I check the proof without publishing?</h3><p>Yes. JSON is the file format. Inside it are the proof and public values such as the window, counts, and target. The browser can verify those values against the Gapmark circuit key.</p></article>
          <article><h3>What does zkVerify add?</h3><p>Volta is zkVerify’s testnet. When the network finalizes the verification transaction, Gapmark keeps its hash with the proof. A reviewer can open that transaction without an account.</p></article>
          <article><h3>Do I need an account?</h3><p>You can create, verify, and submit a proof without signing in. Enter your email in Workspace to save or share reports. The first successful one-time code creates your account.</p></article>
          <p className="proof-limit">Proofs check the calculation from the supplied records. The accuracy of those records depends on the monitor.</p>
        </div>
      </section>
    </main>
    <Footer />
  </>;
}
