import Script from 'next/script';
import { operationWorkbench } from '../../shared/workbench.mjs';
import { Footer, Header } from './chrome.js';

export default function ProofStudio({ mode }) {
  const create = mode === 'create';
  return <>
    <link rel="stylesheet" href="/workbench.css" />
    <Header active={mode} />
    <main className="page-width studio">
      <div className="studio-title"><h1>{create ? 'Create an uptime report' : 'Review a proof'}</h1>
        <p>{create ? 'Load monitoring data, set the agreed window, and generate a proof you can share.' : 'Open a shared report or upload a proof JSON. Compare it with the terms of your service agreement.'}</p>
      </div>
      <div data-proof-studio={mode} dangerouslySetInnerHTML={{ __html: operationWorkbench(mode) }} />
    </main>
    <Footer />
    <Script src="/workbench.mjs" type="module" strategy="afterInteractive" />
  </>;
}
