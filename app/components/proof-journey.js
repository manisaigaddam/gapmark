const stages = [
  { title: 'Check the window', text: 'Load a CSV and set the agreed schedule. Gapmark flags every missing check before judging the uptime target.' },
  { title: 'Generate the proof', text: 'Create a proof of the report calculation in your browser. When available, you can also attach a zkVerify testnet receipt.' },
  { title: 'Review the evidence', text: 'Share the proof file or a workspace link. A reviewer verifies the calculation and compares the report with the agreement.' }
];

export default function ProofJourney() {
  return <section className="journey-wrap" id="how-it-works" aria-labelledby="journey-title">
    <div className="page-width journey">
      <h2 id="journey-title">How it works</h2>
      <ol className="journey-steps">
        {stages.map((item) => <li key={item.title}>
          <h3>{item.title}</h3><p>{item.text}</p>
        </li>)}
      </ol>
    </div>
  </section>;
}
