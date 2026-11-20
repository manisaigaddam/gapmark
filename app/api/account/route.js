import { readJsonBody } from '../../../shared/agent.mjs';
import { checkedEmail, problem, readSession, sameSiteJson, signOut, supabase, supabaseReady, workspaceResponse } from '../../../shared/supabase.mjs';

export const runtime = 'nodejs';

export async function GET(request) {
  if (!supabaseReady()) return workspaceResponse({ configured: false, user: null });
  try {
    const session = await readSession(request);
    const user = session.user ? { email: session.user.email } : null;
    return workspaceResponse({ configured: true, user }, 200, request, session.tokens);
  } catch (error) {
    return workspaceResponse({ error: error.message }, error.status ?? 502);
  }
}

export async function POST(request) {
  try {
    sameSiteJson(request);
    const input = await readJsonBody(request.body);
    if (input?.action === 'signout') {
      try { await signOut(request); } catch { /* Clear the local session even if Supabase cannot be reached. */ }
      return workspaceResponse({ user: null }, 200, request, null);
    }
    if (input?.action !== 'send-code' && input?.action !== 'verify-code') throw problem('Choose a sign-in action.');
    const email = checkedEmail(input.email);
    if (input.action === 'send-code') {
      await supabase('/auth/v1/otp', { body: { email, create_user: true } });
      return workspaceResponse({ sent: true });
    }
    if (typeof input.code !== 'string' || !/^\d{6,10}$/.test(input.code)) throw problem('Enter the code from your email.');
    const tokens = await supabase('/auth/v1/verify', { body: { email, token: input.code, type: 'email' } });
    if (!tokens?.access_token || !tokens?.refresh_token || !tokens?.user?.id) throw problem('No session was returned. Request a new code.', 502);
    return workspaceResponse({ user: { email: tokens.user.email } }, 200, request, tokens);
  } catch (error) {
    return workspaceResponse({ error: error instanceof SyntaxError ? 'Send valid JSON.' : error.message }, error.status ?? 400);
  }
}
