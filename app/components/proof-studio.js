import Script from 'next/script';
import { operationWorkbench } from '../../shared/workbench.mjs';
import { Footer, Header } from './chrome.js';

export default function ProofStudio({ mode }) {
  const create = mode === 'create';
  return <>
    <link rel="stylesheet" href="/workbench.css" />
    <Header active={mode} />
    <main id="main" className="page-width studio">
      <div className="studio-title"><h1>{create ? 'Create an uptime report' : 'Review a proof'}</h1>
        <p>{create ? 'Start with the sample below or load your own monitoring CSV. Set the agreed window and uptime target, then generate a shareable proof in your browser.' : 'Upload a proof JSON or open a shared report. Verify the calculation and compare the report with your service agreement.'}</p>
        <a className="studio-guide-link" href={create ? '/guide#create' : '/guide#review'}>{create ? 'How to create and share a proof' : 'How to review a proof'}</a>
      </div>
      <div data-proof-studio={mode} dangerouslySetInnerHTML={{ __html: operationWorkbench(mode) }} />
    </main>
    <Footer />
    <Script src="/workbench.mjs" type="module" strategy="afterInteractive" />
  </>;
}
