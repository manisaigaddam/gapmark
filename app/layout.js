import './site.css';
import { title, description } from '../shared/workbench.mjs';

export const metadata = { title: { default: title, template: '%s | Gapmark' }, description, icons: { icon: '/gapmark.png' } };

export default function Layout({ children }) {
  return <html lang="en"><body className="gapmark-site">{children}</body></html>;
}
