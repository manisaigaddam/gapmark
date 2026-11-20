export function Header({ active }) {
  return <header className="masthead"><div className="page-width masthead-inner">
    <a className="wordmark" href="/" aria-label="Gapmark home"><img src="/gapmark.png" alt="" width="36" height="36" /> Gapmark</a>
    <nav aria-label="Main navigation">
      <a href="/create" aria-current={active === 'create' ? 'page' : undefined}>Create</a>
      <a href="/review" aria-current={active === 'review' ? 'page' : undefined}>Review</a>
      <a className="workspace-link" href="/workspace" aria-current={active === 'workspace' ? 'page' : undefined}>Workspace</a>
    </nav>
  </div></header>;
}

export function Footer() {
  return <footer className="site-footer page-width"><span>Gapmark</span><div>
    <a href="/api/agent">Agent API</a><a href="/api/agent/openapi">OpenAPI</a><a href="https://docs.zkverify.io/handbook/quickstart">zkVerify docs</a>
  </div></footer>;
}
