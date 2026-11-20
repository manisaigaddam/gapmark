'use client';

import { useEffect, useState } from 'react';

const verdicts = { PASS: 'Target met', BREACH: 'Target missed', INSUFFICIENT: 'Incomplete window' };

async function request(path, body) {
  const response = await fetch(path, body ? {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
  } : { cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'The request failed.');
  return data;
}

export default function Workspace({ requestedReport }) {
  const [account, setAccount] = useState(null);
  const [records, setRecords] = useState({ reports: [], grants: [] });
  const [filter, setFilter] = useState('issued');
  const [pendingEmail, setPendingEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingReports, setLoadingReports] = useState(false);

  async function reloadReports() {
    setLoadingReports(true);
    try { setRecords(await request('/api/workspace')); }
    finally { setLoadingReports(false); }
  }

  useEffect(() => {
    let disposed = false;
    async function connect() {
      try {
        const result = await request('/api/account');
        if (disposed) return;
        setAccount(result);
        if (result.user) await reloadReports();
      } catch (error) {
        if (!disposed) setMessage(error.message);
      } finally {
        if (!disposed) setLoading(false);
      }
    }
    connect();
    return () => { disposed = true; };
  }, []);

  async function startEmail(event) {
    event.preventDefault();
    const { email } = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true); setMessage('');
    try {
      await request('/api/account', { action: 'send-code', email });
      setPendingEmail(email);
      setMessage('Check your email for a one-time code.');
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }

  async function confirmEmail(event) {
    event.preventDefault();
    const { code } = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true); setMessage('');
    try {
      const result = await request('/api/account', { action: 'verify-code', email: pendingEmail, code });
      setAccount({ configured: true, user: result.user });
      setPendingEmail('');
      if (requestedReport) location.assign('/review?report=' + encodeURIComponent(requestedReport));
      else await reloadReports();
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }

  async function signOut() {
    setBusy(true); setMessage('');
    try {
      await request('/api/account', { action: 'signout' });
      setAccount({ configured: true, user: null });
      setRecords({ reports: [], grants: [] });
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }

  async function update(action, id, email) {
    setBusy(true); setMessage('');
    try {
      await request('/api/workspace', { action, id, email });
      await reloadReports();
      setMessage({ share: 'Access granted. Copy and send the report link.', revoke: 'Online access revoked.', delete: 'Report removed.' }[action]);
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }

  async function copyLink(id) {
    const link = new URL('/review?report=' + encodeURIComponent(id), location.origin);
    try { await navigator.clipboard.writeText(link.href); setMessage('Report link copied.'); }
    catch { setMessage(link.href); }
  }

  if (loading) return <p className="workspace-message" role="status">Loading workspace.</p>;
  if (!account?.configured) return <section className="account-panel">
    <h2>Workspace unavailable</h2><p>{message || 'Connect this deployment to Supabase to enable accounts and saved reports.'}</p>
    <a href="/create">Create a proof in your browser</a>
  </section>;
  if (!account.user) return <section className="account-panel">
    <h2>Sign in with email</h2><p>{requestedReport ? 'Sign in with the email this report was shared with.' : 'We’ll send a one-time code to open your report workspace.'}</p>
    {!pendingEmail ? <form onSubmit={startEmail}>
      <label>Email address<input name="email" type="email" autoComplete="email" maxLength={254} required /></label>
      <button className="cta dark" disabled={busy}>Send sign-in code</button>
    </form> : <form onSubmit={confirmEmail}>
      <label>Code sent to {pendingEmail}<input name="code" type="text" inputMode="numeric" pattern="[0-9]{6,10}" autoComplete="one-time-code" maxLength={10} required /></label>
      <div className="account-actions"><button className="cta dark" disabled={busy}>Continue</button>
        <button type="button" onClick={() => { setPendingEmail(''); setMessage(''); }} disabled={busy}>Use another email</button></div>
    </form>}
    <p className="workspace-message" role="status">{message}</p>
  </section>;

  const folders = [
    ['issued', 'Issued', records.reports.filter((entry) => entry.owned && entry.kind === 'issued')],
    ['inbox', 'Shared with me', records.reports.filter((entry) => !entry.owned)],
    ['reviewed', 'Reviewed', records.reports.filter((entry) => entry.owned && entry.kind === 'reviewed')]
  ];
  const [, label, group] = folders.find(([id]) => id === filter);
  return <>
    <section className="workspace-toolbar"><div><strong>{account.user.email}</strong>{requestedReport && <a href={'/review?report=' + encodeURIComponent(requestedReport)}>Open shared report</a>}</div>
      <button type="button" onClick={signOut} disabled={busy}>Sign out</button>
    </section>
    <div className="workspace-filters" role="group" aria-label="Report history">
      {folders.map(([id, name]) => <button key={id} type="button" aria-pressed={id === filter} onClick={() => setFilter(id)}>{name}</button>)}
    </div>
    <p className="workspace-message" role="status">{loadingReports ? 'Loading reports.' : message}</p>
    <section className="workspace-list" aria-label={label}>
      {!loadingReports && group.length === 0 && <article className="account-panel"><h2>{label}</h2><p>{filter === 'inbox' ? 'Reports shared to your email will appear here.' : 'Saved proofs will appear here.'}</p>
        {filter !== 'inbox' && <a href={filter === 'issued' ? '/create' : '/review'}>{filter === 'issued' ? 'Create a report' : 'Verify a proof'}</a>}
      </article>}
      {group.map((entry) => {
        const grants = records.grants.filter((grant) => grant.report_id === entry.id);
        const shareable = entry.owned && entry.kind === 'issued';
        return <article className="report-record" key={entry.id}>
          <div className="record-heading"><div><h2>{entry.service}</h2><p>{new Date(entry.window_start).toISOString().slice(0, 16).replace('T', ' ')} UTC</p></div>
            <span className="record-verdict" data-verdict={entry.verdict}>{verdicts[entry.verdict]}</span></div>
          <div className="account-actions">
            <a className="cta dark" href={'/review?report=' + encodeURIComponent(entry.id)}>Open proof</a>
            {shareable && <button type="button" onClick={() => copyLink(entry.id)} disabled={busy}>Copy report link</button>}
            {entry.owned && <button className="remove-report" type="button" disabled={busy} onClick={() => {
              if (window.confirm('Remove this saved report and its online access grants?')) update('delete', entry.id);
            }}>Remove report</button>}
          </div>
          {shareable && <details className="sharing-panel"><summary>Manage reviewer access</summary>
            <form onSubmit={(event) => {
              event.preventDefault();
              update('share', entry.id, new FormData(event.currentTarget).get('email'));
            }}>
              <label>Reviewer email<input name="email" type="email" maxLength={254} placeholder="reviewer@example.com" required /></label>
              <button type="submit" disabled={busy}>Grant access</button>
            </form>
            <p>Send the link after granting access. The reviewer signs in with that email.</p>
            {grants.length > 0 && <ul>{grants.map((grant) => <li key={grant.recipient_email}><span>{grant.recipient_email}</span>
              <button type="button" disabled={busy} onClick={() => update('revoke', entry.id, grant.recipient_email)}>Revoke</button></li>)}</ul>}
          </details>}
        </article>;
      })}
    </section>
  </>;
}
