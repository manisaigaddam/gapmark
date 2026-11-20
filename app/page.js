import DemoWindow from './components/demo-window.js';
import { Footer, Header } from './components/chrome.js';

export default function Page() {
  return <>
    <Header />
    <main id="main">
      <section className="landing-hero">
        <div className="page-width hero-layout">
          <div className="landing-copy">
            <p className="folio">UPTIME EVIDENCE FOR SHARED SERVICES</p>
            <h1>Put your uptime<br /> <em>on the record.</em></h1>
            <p>Turn a monitoring export into a report your customer can verify. Show outages, missing checks, and exactly which target you measured against.</p>
            <div className="landing-actions"><a className="cta lime" href="/create">Create a report</a><a className="cta outline" href="/review">Verify a proof</a></div>
          </div>
          <DemoWindow />
        </div>
      </section>
      <section className="page-width evidence-story" aria-labelledby="journey">
        <div className="story-title"><p className="folio">HOW IT WORKS</p><h2 id="journey">From scheduled checks to a verifiable report.</h2></div>
        <div className="story-steps">
          <article className="scroll-reveal"><span className="story-mark mark-log" aria-hidden="true"><i /><i /><i /><i /></span><div><h3>Read the monitoring window</h3><p>Bring a CSV and set the service, cadence, and target from your agreement. Every expected check becomes an up, down, or missing slot.</p></div></article>
          <article className="scroll-reveal"><span className="story-mark mark-proof" aria-hidden="true"><i /><i /><i /></span><div><h3>Generate and share the proof</h3><p>The browser calculates the result and generates a Groth16 proof. Download the JSON or add it to your workspace and share it with a reviewer.</p></div></article>
          <article className="scroll-reveal"><span className="story-mark mark-match" aria-hidden="true"><i /><i /></span><div><h3>Check the proof and the terms</h3><p>Review the calculation against the circuit key, compare the report terms with your agreement, and check the monitor signature when a trusted key is available.</p></div></article>
        </div>
      </section>
      <section className="handover-band">
        <div className="page-width handover-grid">
          <h2>One workspace for both sides of a service agreement.</h2>
          <article className="scroll-reveal"><h3>Issue reports</h3><p>Keep your proof history, grant access by email, and revoke access to the online copy when needed.</p><a href="/create">Create a report</a></article>
          <article className="scroll-reveal"><h3>Review evidence</h3><p>Open a shared report or bring a proof file. Save a verified copy to your own history.</p><a href="/workspace">Open workspace</a></article>
        </div>
      </section>
      <section className="page-width proof-story" aria-labelledby="proof-story-title">
        <div><p className="folio">THE PROOF FILE</p><h2 id="proof-story-title">What zkVerify adds.</h2></div>
        <div className="proof-explain scroll-reveal">
          <article><h3>Verify in the browser</h3><p>The JSON carries a proof and public inputs such as the window, counts, target, and a commitment. Gapmark verifies it against the circuit key when you generate a proof or select Verify proof.</p></article>
          <article><h3>Publish a verification transaction</h3><p>Submit to zkVerify testnet through Kurier to get a public transaction hash after finalization. Reviewers can also check a downloaded proof whenever they have the matching key.</p></article>
          <p className="proof-limit">The proof checks the calculation. The accuracy of the source observations depends on the monitor and how its data was collected.</p>
        </div>
      </section>
    </main>
    <Footer />
  </>;
}
