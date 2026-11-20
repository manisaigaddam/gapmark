import Script from 'next/script';
import { title, description } from '../shared/workbench.mjs';

export const metadata = { title, description, icons: { icon: '/gapmark.png' } };

export default function Layout({ children }) {
  return <html lang="en"><head><link rel="stylesheet" href="/workbench.css" /></head><body>
    {children}<Script src="/workbench.mjs" type="module" strategy="afterInteractive" />
  </body></html>;
}
