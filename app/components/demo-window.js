'use client';

import { useState } from 'react';

const cases = [
  { label: 'One check down', title: 'Target met', tone: 'pass', down: [9], gap: -1, counts: [11, 1, 0], detail: '11 out of 12 checks up. 91.67% clears the 90% target.' },
  { label: 'One check missing', title: 'Insufficient evidence', tone: 'missing', down: [9], gap: 5, counts: [10, 1, 1], detail: 'One scheduled check is missing. The window is incomplete.' },
  { label: 'Two checks down', title: 'Target missed', tone: 'breach', down: [3, 9], gap: -1, counts: [10, 2, 0], detail: '10 out of 12 checks up. 83.33% falls below the 90% target.' }
];

export default function DemoWindow() {
  const [index, setIndex] = useState(1);
  const sample = cases[index];
  return <div className="demo-window">
    <div className="demo-top"><span>Checkout API</span><span>Example report</span></div>
    <div className="demo-meta"><span>12:00–13:00 UTC</span><span>5-minute checks</span><span>90% target</span></div>
    <div className="demo-graph" role="img" aria-label={`${sample.counts[0]} up, ${sample.counts[1]} down, ${sample.counts[2]} missing`}>
      {Array.from({ length: 12 }, (_, i) => <i key={i} style={{ '--slot': i }} className={i === sample.gap ? 'gap' : sample.down.includes(i) ? 'outage' : ''} />)}
    </div>
    <div className="demo-result" aria-live="polite" data-tone={sample.tone}><strong>{sample.title}</strong><span>{sample.detail}</span></div>
    <div className="demo-switch" role="group" aria-label="Example scenarios">
      {cases.map((item, i) => <button type="button" key={item.label} aria-pressed={index === i} onClick={() => setIndex(i)}>{item.label}</button>)}
    </div>
  </div>;
}
