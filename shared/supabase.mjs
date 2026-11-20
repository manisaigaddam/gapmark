import { NextResponse } from 'next/server.js';

const accessCookie = 'gapmark-access';
const refreshCookie = 'gapmark-refresh';
const cookieLife = 60 * 60 * 24 * 7;
const cookieName = (name, request) => new URL(request.url).protocol === 'https:' ? `__Host-${name}` : name;

export function problem(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

export function supabaseReady() {
  return /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(process.env.SUPABASE_URL ?? '')
    && /^sb_publishable_[a-z0-9_-]+$/i.test(process.env.SUPABASE_PUBLISHABLE_KEY ?? '');
}

export async function supabase(path, { access, body, method = body ? 'POST' : 'GET', prefer } = {}) {
  if (!supabaseReady()) throw problem('Set up Supabase to use the report workspace.', 503);
  let response;
  try {
    response = await fetch(new URL(path, process.env.SUPABASE_URL), {
      method, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(12000),
      headers: {
        apikey: process.env.SUPABASE_PUBLISHABLE_KEY,
        ...(access && { authorization: `Bearer ${access}` }),
        ...(body !== undefined && { 'content-type': 'application/json' }),
        ...(prefer && { prefer })
      },
      ...(body !== undefined && { body: JSON.stringify(body) })
    });
  } catch {
    throw problem('Supabase is unavailable. Try again shortly.', 502);
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (path.startsWith('/auth/')) {
      const status = response.status;
      if (status === 429) throw problem('Too many attempts. Wait before trying again.', 429);
      if (status < 500) throw problem('The code or session could not be accepted. Request a new sign-in code.', status === 403 ? 401 : status);
    }
    if (response.status === 401 || response.status === 403) throw problem('You do not have access to this report.', response.status);
    if (response.status === 409) throw problem('This report or access grant conflicts with an existing entry.', 409);
    throw problem('The workspace request failed. Check the Supabase project and migration.', 502);
  }
  return data;
}

export function checkedEmail(value) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw problem('Enter a valid email address.');
  return email;
}

export function sameSiteJson(request) {
  const source = request.headers.get('sec-fetch-site');
  const origin = request.headers.get('origin');
  if ((source && source !== 'same-origin' && source !== 'none') || (origin && origin !== new URL(request.url).origin)) {
    throw problem('Use this Gapmark site to make the request.', 403);
  }
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw problem('Use application/json.', 415);
  }
}

export function workspaceResponse(body, status = 200, request, tokens) {
  const response = NextResponse.json(body, { status, headers: { 'cache-control': 'private, no-store' } });
  if (tokens !== undefined) {
    const options = { httpOnly: true, sameSite: 'lax', secure: new URL(request.url).protocol === 'https:', path: '/' };
    response.cookies.set(cookieName(accessCookie, request), tokens?.access_token ?? '', { ...options, maxAge: tokens ? (tokens.expires_in || 3600) : 0 });
    response.cookies.set(cookieName(refreshCookie, request), tokens?.refresh_token ?? '', { ...options, maxAge: tokens ? cookieLife : 0 });
  }
  return response;
}

export async function readSession(request) {
  const access = request.cookies.get(cookieName(accessCookie, request))?.value;
  const refresh = request.cookies.get(cookieName(refreshCookie, request))?.value;
  if (access) {
    try {
      return { access, user: await supabase('/auth/v1/user', { access }) };
    } catch (error) {
      if (error.status !== 401) throw error;
    }
  }
  if (refresh) {
    try {
      const tokens = await supabase('/auth/v1/token?grant_type=refresh_token', { body: { refresh_token: refresh } });
      if (!tokens?.access_token || !tokens?.refresh_token || !tokens?.user?.id) throw problem('The workspace session could not be refreshed.', 502);
      return { access: tokens.access_token, user: tokens.user, tokens };
    } catch (error) {
      if (error.status !== 400 && error.status !== 401) throw error;
    }
  }
  return { access, tokens: access || refresh ? null : undefined };
}

export async function signOut(request) {
  const session = await readSession(request);
  if (session.user && session.access) await supabase('/auth/v1/logout?scope=local', { access: session.access, method: 'POST' });
}
