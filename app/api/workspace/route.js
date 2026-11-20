import { readJsonBody } from '../../../shared/agent.mjs';
import { assertProofBundle, serviceId } from '../../../public/evidence.mjs';
import { verifyLocally } from '../../../shared/verifier.mjs';
import { checkedEmail, problem, readSession, sameSiteJson, supabase, workspaceResponse } from '../../../shared/supabase.mjs';

export const runtime = 'nodejs';

const reports = '/rest/v1/gapmark_reports';
const shares = '/rest/v1/gapmark_report_shares';
const listFields = 'id,owner_id,kind,service,verdict,window_start,created_at';

function reportId(id) {
  if (typeof id !== 'string' || !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(id)) throw problem('Invalid report ID.');
  return id;
}

function query(endpoint, filters) {
  return `${endpoint}?${new URLSearchParams(filters)}`;
}

async function handle(request, action, write = false) {
  let session;
  try {
    if (write) sameSiteJson(request);
    session = await readSession(request);
    if (!session.user?.id) throw problem('Sign in to use the report workspace.', 401);
    const { data, status } = await action(session);
    return workspaceResponse(data, status, request, session.tokens);
  } catch (error) {
    const known = Number.isInteger(error.status);
    const message = error instanceof SyntaxError ? 'Send valid JSON.' :
      known ? error.message : 'The report could not be processed. Check its format and try again.';
    return workspaceResponse({ error: message }, error.status ?? 400, request, session?.tokens);
  }
}

export function GET(request) {
  return handle(request, async ({ access, user }) => {
    const id = new URL(request.url).searchParams.get('report');
    if (id !== null) {
      const matches = await supabase(query(reports, { id: `eq.${reportId(id)}`, select: `${listFields},bundle` }), { access });
      if (!matches?.length) throw problem('This report is unavailable to your account.', 404);
      const { owner_id, ...report } = matches[0];
      return { data: { report: { ...report, owned: user.id === owner_id } } };
    }
    const list = await supabase(query(reports, { select: listFields, order: 'created_at.desc,id.desc', limit: '100' }), { access });
    const owned = new Set(list.filter((item) => item.owner_id === user.id && item.kind === 'issued').map((item) => item.id));
    const grants = owned.size ? await supabase(query(shares, {
      issuer_id: `eq.${user.id}`, report_id: `in.(${[...owned].join(',')})`, select: 'report_id,recipient_email', order: 'recipient_email.asc'
    }), { access }) : [];
    return { data: { reports: list.map(({ owner_id, ...record }) => ({ ...record, owned: user.id === owner_id })), grants } };
  });
}

export function POST(request) {
  return handle(request, async ({ access, user }) => {
    const input = await readJsonBody(request.body);
    if (input?.action === 'save') {
      if (input.kind !== 'issued' && input.kind !== 'reviewed') throw problem('Choose the report history to save in.');
      let report;
      try { report = assertProofBundle(input.bundle); } catch (error) { throw problem(error.message); }
      const { service, publicSignals, schema, proof, checkpoint } = input.bundle;
      const { pi_a, pi_b, pi_c, protocol, curve } = proof;
      const bundle = { service, publicSignals, schema, proof: { pi_a, pi_b, pi_c, protocol, curve } };
      if (checkpoint?.algorithm === 'Ed25519' && typeof checkpoint.signature === 'string' && /^[a-z0-9_-]{1,120}$/i.test(checkpoint.signature)) {
        bundle.checkpoint = { algorithm: checkpoint.algorithm, signature: checkpoint.signature };
      }
      if (await serviceId(service) !== report.serviceId || !await verifyLocally(bundle)) throw problem('This proof could not be verified.', 422);
      const inserted = await supabase(query(reports, { on_conflict: 'owner_id,kind,commitment', select: 'id' }), {
        access, prefer: 'resolution=ignore-duplicates,return=representation',
        body: { owner_id: user.id, kind: input.kind, service, commitment: report.commitment, verdict: report.verdict,
          window_start: new Date(report.windowStart * 1000).toISOString(), bundle }
      });
      if (inserted?.length) return { data: { id: inserted[0].id }, status: 201 };
      const existing = await supabase(query(reports, {
        select: 'id', owner_id: `eq.${user.id}`, kind: `eq.${input.kind}`, commitment: `eq.${report.commitment}`
      }), { access });
      if (!existing?.length) throw problem('The report changed while saving. Try again.', 409);
      return { data: { id: existing[0].id } };
    }
    if (!['share', 'revoke', 'delete'].includes(input?.action)) throw problem('Choose a workspace action.');
    const id = reportId(input.id);
    if (input.action === 'delete') {
      const deleted = await supabase(query(reports, { id: `eq.${id}`, owner_id: `eq.${user.id}`, select: 'id' }), {
        access, method: 'DELETE', prefer: 'return=representation'
      });
      if (!deleted?.length) throw problem('You can remove only a report you own.', 404);
      return { data: { removed: true } };
    }
    const email = checkedEmail(input.email);
    if (input.action === 'revoke') {
      await supabase(query(shares, { report_id: `eq.${id}`, issuer_id: `eq.${user.id}`, recipient_email: `eq.${email}` }), { access, method: 'DELETE' });
      return { data: { revoked: true } };
    }
    if (email === user.email?.toLowerCase()) throw problem('You already have access to your own reports.');
    const owned = await supabase(query(reports, { id: `eq.${id}`, owner_id: `eq.${user.id}`, kind: 'eq.issued', select: 'id' }), { access });
    if (!owned?.length) throw problem('You can share only a report you created and saved.', 404);
    await supabase(query(shares, { on_conflict: 'report_id,recipient_email' }), {
      access, prefer: 'resolution=ignore-duplicates,return=minimal',
      body: { report_id: id, issuer_id: user.id, recipient_email: email }
    });
    return { data: { shared: true } };
  }, true);
}
