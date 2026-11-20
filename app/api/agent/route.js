import { agentContract, readJsonBody, runAgent } from '../../../shared/agent.mjs';
import { verifyLocally } from '../../../shared/verifier.mjs';

export const runtime = 'nodejs';

export function GET() { return Response.json(agentContract); }

export async function POST(request) {
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return Response.json({ error: 'Use application/json.' }, { status: 415 });
  }
  try {
    return Response.json(await runAgent(await readJsonBody(request.body), verifyLocally));
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status ?? 400 });
  }
}
