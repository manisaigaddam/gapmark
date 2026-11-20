import { Footer, Header } from '../components/chrome.js';
import Workspace from './workspace.js';

export const metadata = { title: 'Report workspace' };

export default async function Page({ searchParams }) {
  const { report } = await searchParams;
  const requestedReport = typeof report === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(report) ? report : null;
  return <>
    <Header active="workspace" />
    <main id="main" className="page-width workspace-page">
      <div className="studio-title"><h1>Report workspace</h1><p>Sign in by email to save proofs, share reports, and open reports shared with you.</p><a className="studio-guide-link" href="/guide#workspace">How to save and share reports</a></div>
      <Workspace requestedReport={requestedReport} />
    </main>
    <Footer />
  </>;
}
