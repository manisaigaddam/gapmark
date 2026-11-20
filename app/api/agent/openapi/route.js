import { agentOpenApi } from '../../../../shared/agent-openapi.mjs';

export function GET(request) {
  return Response.json({ ...agentOpenApi, servers: [{ url: new URL(request.url).origin }] });
}
