'use client';

import { useEffect, useRef, useState } from 'react';

const stages = [
  {
    id: 'read-checks', label: 'Read your checks', artifact: 'Monitoring window', left: '12 scheduled checks', right: 'CSV stays on device',
    text: 'Bring a CSV and choose the reporting window and uptime target. A check with no record is marked missing. You can try this with the sample or use your own file.'
  },
  {
    id: 'make-proof', label: 'Generate a proof', artifact: 'Proof JSON', left: 'Counts and target', right: 'Calculation verified',
    text: 'Gapmark uses the monitoring records to create a Groth16 proof. The JSON includes the result, agreement settings, and cryptographic evidence a reviewer can verify.'
  },
  {
    id: 'publish-proof', label: 'Submit to zkVerify', artifact: 'Volta transaction receipt', left: 'Same proof', right: 'Public transaction',
    text: 'Send the proof and its public inputs to zkVerify through Kurier. When Volta finalizes the transaction, Gapmark attaches a receipt that matches the exact proof you submitted.'
  },
  {
    id: 'share-evidence', label: 'Give the reviewer evidence', artifact: 'Shared report', left: 'Proof + receipt', right: 'Review against agreement',
    text: 'Download the bundle or share it with a customer through Workspace. They can check the proof, compare the terms, and open the testnet transaction from the receipt.'
  }
];

export default function ProofJourney() {
  const section = useRef(null);
  const steps = useRef(null);
  const [active, setActive] = useState(0);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const top = window.innerHeight * 0.59;
      const items = Array.from(steps.current.children);
      const next = items.findLastIndex((item) => item.getBoundingClientRect().top <= top);
      setActive(Math.max(0, next));
      const first = items[0].getBoundingClientRect().top;
      const last = items.at(-1).getBoundingClientRect().top;
      const progress = Math.max(0, Math.min(1, (top - first) / Math.max(1, last - first)));
      section.current.style.setProperty('--journey-progress', progress);
    };
    const watch = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', watch, { passive: true });
    window.addEventListener('resize', watch);
    return () => {
      window.removeEventListener('scroll', watch);
      window.removeEventListener('resize', watch);
      cancelAnimationFrame(frame);
    };
  }, []);
  const stage = stages[active];
  return <section className="journey-wrap" id="how-it-works" aria-labelledby="journey-title">
    <div ref={section} className="page-width journey">
      <div className="journey-side">
        <h2 id="journey-title">Follow the proof.</h2>
        <div className="journey-visual" aria-hidden="true">
          <div className="journey-progress"><span /></div>
          <div className="journey-card" key={stage.id}>
            <strong>{stage.artifact}</strong>
            <div className="journey-tracks" data-stage={active}>
              {Array.from({ length: 12 }, (_, index) => <i className={index === 5 ? 'missing' : undefined} key={index} />)}
            </div>
            <div className="journey-status"><span>{stage.left}</span><span>{stage.right}</span></div>
          </div>
        </div>
        <nav className="journey-nav" aria-label="Proof walkthrough">
          {stages.map((item, index) => <a key={item.id} href={'#' + item.id} aria-current={active === index ? 'step' : undefined}>{item.label}</a>)}
        </nav>
      </div>
      <div className="journey-steps" ref={steps}>
        {stages.map((item) => <article id={item.id} key={item.id}>
          <h3>{item.label}</h3><p>{item.text}</p>
        </article>)}
      </div>
    </div>
  </section>;
}
