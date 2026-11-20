'use client';

import { useState } from 'react';
import { demoCases, demoStatuses, demoWindow } from '../../public/demo-data.mjs';

export default function DemoWindow() {
  const [name, setName] = useState('missing');
  const sample = demoCases[name];
  return <section className="demo-window" aria-label="Interactive example report">
    <div className="demo-top"><h2>{demoWindow.service}</h2><span>Example report</span></div>
    <div className="demo-meta"><span>12:00–13:00 UTC</span><span>{demoWindow.intervalMinutes}-minute checks</span><span>{demoWindow.threshold}% target</span></div>
    <div className="demo-graph" aria-hidden="true">
      {demoStatuses(sample).map((status, index) => <i key={index} style={{ '--slot': index }} data-status={status} />)}
    </div>
    <div className="demo-counts" aria-live="polite">
      <span data-status="up">{demoWindow.slotCount - sample.down.length - sample.missing.length} up</span>
      <span data-status="down">{sample.down.length} down</span>
      <span data-status="missing">{sample.missing.length} missing</span>
    </div>
    <div className="demo-result" aria-live="polite" data-tone={name}><strong>{sample.verdict}</strong><span>{sample.explanation}</span></div>
    <div className="demo-switch" role="group" aria-label="Example scenarios">
      {Object.entries(demoCases).map(([id, item]) => <button type="button" key={id} aria-pressed={name === id} onClick={() => setName(id)}>{item.label}</button>)}
    </div>
    <a className="demo-link" href={`/create?sample=${name}`}>Open this example</a>
  </section>;
}
