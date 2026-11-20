import { createHmac, timingSafeEqual } from 'node:crypto';
import { readRequestBody, runAgent } from '../../../shared/agent.mjs';
import { verifyLocally } from '../../../shared/verifier.mjs';

export const runtime = 'nodejs';
export const maxDuration = 60;

const signatureHeader = 'x-agent-games-signature';
const mac = (key, body) => createHmac('sha256', key).update(body).digest();

function signedTransport(secret, header, body) {
  const prefix = header?.startsWith('sha256=') ? 'sha256=' : '';
  const token = header?.slice(prefix.length) ?? '';
  const format = /^[\da-f]{64}$/i.test(token) ? 'hex' : /^[a-z0-9_-]{43}$/i.test(token) ? 'base64url' : /^[a-z0-9+/]{43}=$/i.test(token) ? 'base64' : null;
  if (!format) return null;
  const signature = Buffer.from(token, format);
  const keys = [secret];
  if (/^[\da-f]{64}$/i.test(secret)) keys.push(Buffer.from(secret, 'hex'));
  const key = keys.find((candidate) => timingSafeEqual(signature, mac(candidate, body)));
  if (!key) return null;
  return (data, status = 200) => {
    const raw = JSON.stringify(data);
    return new Response(raw, { status, headers: {
      'content-type': 'application/json', 'cache-control': 'no-store', [signatureHeader]: prefix + mac(key, raw).toString(format)
    } });
  };
}

export function GET() {
  return Response.json({ name: 'Gapmark', preflight: 'agent-games.preflight.v1', signedActions: '/api/agent' }, {
    headers: { 'cache-control': 'no-store' }
  });
}

export async function POST(request) {
  const secret = process.env.AGENT_GAMES_HMAC_SECRET;
  if (!secret) return Response.json({ error: 'Configure the Agent Games dashboard secret.' }, { status: 503 });
  let raw;
  try { raw = await readRequestBody(request.body); }
  catch (error) { return Response.json({ error: error.message }, { status: error.status ?? 400 }); }
  const reply = signedTransport(secret, request.headers.get(signatureHeader), raw);
  if (!reply) return Response.json({ error: 'Invalid Agent Games signature.' }, { status: 401 });
  try {
    const envelope = JSON.parse(raw.toString());
    const issued = envelope?.issued_at ?? envelope?.issuedAt;
    const issuedMs = typeof issued === 'string' ? Date.parse(issued) : NaN;
    const deadline = envelope?.deadline_at ?? envelope?.deadlineAt;
    const deadlineMs = deadline === undefined ? Infinity : Date.parse(deadline);
    const now = Date.now();
    if (!Number.isFinite(issuedMs) || issuedMs > now + 30_000 || issuedMs < now - 5 * 60_000
        || Number.isNaN(deadlineMs) || deadlineMs <= now) return reply({ error: 'Request timestamp or deadline is invalid.' }, 400);
    if (envelope.type === 'agent-games.preflight.v1') return reply({ ok: true, protocolVersion: 'v1' });
    const result = await runAgent(envelope.input ?? envelope, verifyLocally);
    if (Date.now() >= deadlineMs) return reply({ error: 'The task deadline passed.' }, 408);
    return reply(result);
  } catch (error) {
    const status = error.status ?? 400;
    return reply({ error: error instanceof SyntaxError ? 'Send valid JSON.' : error.message }, status);
  }
}
