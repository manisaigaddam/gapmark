import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NextRequest } from 'next/server.js';
import { GET as account, POST as accountAction } from '../app/api/account/route.js';
import { GET as workspace, POST as workspaceAction } from '../app/api/workspace/route.js';

const user = { id: '11111111-1111-4111-8111-111111111111', email: 'issuer@example.com' };
const report = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const local = 'https://gapmark.example';
const access = '__Host-gapmark-access=fixture-access';
const refresh = '__Host-gapmark-refresh=fixture-refresh';
const tokens = { access_token: 'fixture-access', refresh_token: 'fixture-refresh', expires_in: 3600, user };

function request(path, body, headers) {
  return new NextRequest(local + path, body ? {
    method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', ...headers }
  } : { headers });
}

function setup(t) {
  const env = { SUPABASE_URL: 'https://workspace.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture' };
  for (const [name, value] of Object.entries(env)) {
    const previous = process.env[name];
    process.env[name] = value;
    t.after(() => {
      if (previous === undefined) delete process.env[name];
      else process.env[name] = previous;
    });
  }
}

test('account OTP checks the browser origin, returns user details and keeps session tokens in protected cookies', async (t) => {
  setup(t);
  const fetch = t.mock.method(globalThis, 'fetch', async (url, init) => {
    if (url.pathname === '/auth/v1/otp') {
      assert.deepEqual(JSON.parse(init.body), { email: user.email, create_user: true });
      return Response.json({});
    }
    if (url.pathname === '/auth/v1/verify') {
      assert.deepEqual(JSON.parse(init.body), { email: user.email, token: '123456', type: 'email' });
      return Response.json(tokens);
    }
    if (url.pathname === '/auth/v1/token') {
      assert.equal(url.searchParams.get('grant_type'), 'refresh_token');
      assert.deepEqual(JSON.parse(init.body), { refresh_token: 'fixture-refresh' });
      return Response.json(tokens);
    }
    assert.equal(init.headers.authorization, 'Bearer fixture-access');
    return url.pathname === '/auth/v1/logout' ? new Response(null, { status: 204 }) : Response.json(user);
  });
  const action = { action: 'send-code', email: 'Issuer@Example.com' };
  assert.equal((await accountAction(request('/api/account', action, { origin: 'https://other.example' }))).status, 403);
  assert.equal(fetch.mock.callCount(), 0);
  assert.equal((await accountAction(request('/api/account', action))).status, 200);
  const verified = await accountAction(request('/api/account', { action: 'verify-code', email: user.email, code: '123456' }));
  assert.deepEqual(await verified.json(), { user: { email: user.email } });
  const cookies = verified.headers.getSetCookie();
  assert.equal(cookies.length, 2);
  assert.ok(cookies.every((cookie) => cookie.startsWith('__Host-') && cookie.includes('HttpOnly') && cookie.includes('Secure')));
  const rotated = await account(request('/api/account', null, { cookie: refresh }));
  assert.equal(rotated.headers.getSetCookie().length, 2);
  const signedOut = await accountAction(request('/api/account', { action: 'signout' }, { cookie: access }));
  assert.ok(signedOut.headers.getSetCookie().every((cookie) => cookie.includes('Max-Age=0')));
});

test('workspace keeps issued report grants scoped to the authenticated issuer and denies unknown reports', async (t) => {
  setup(t);
  const fetch = t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(init.headers.authorization, 'Bearer fixture-access');
    if (url.pathname === '/auth/v1/user') return Response.json(user);
    if (url.pathname === '/rest/v1/gapmark_report_shares') {
      assert.deepEqual(JSON.parse(init.body), { report_id: report, issuer_id: user.id, recipient_email: 'reviewer@example.com' });
      return new Response(null, { status: 201 });
    }
    if (url.searchParams.get('select') === '*') return Response.json([]);
    assert.equal(url.searchParams.get('owner_id'), 'eq.' + user.id);
    assert.equal(url.searchParams.get('kind'), 'eq.issued');
    return Response.json([{ id: report }]);
  });
  const action = { action: 'share', id: report, email: 'Reviewer@example.com', issuer_id: 'forged' };
  assert.equal((await workspaceAction(request('/api/workspace', action))).status, 401);
  assert.equal((await workspaceAction(request('/api/workspace', action, { cookie: access, 'sec-fetch-site': 'cross-site' }))).status, 403);
  assert.equal(fetch.mock.callCount(), 0);
  assert.equal((await workspaceAction(request('/api/workspace', action, { cookie: access }))).status, 200);
  assert.equal((await workspace(request('/api/workspace?report=' + report, null, { cookie: access }))).status, 404);
});
