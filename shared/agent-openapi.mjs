import { MAX_CSV_CHARS, MAX_SLOTS, SCHEMA } from '../public/evidence.mjs';

const decimal = { type: 'string', pattern: '^(0|[1-9][0-9]{0,76})$' };
const array = (items, count) => ({ type: 'array', items, minItems: count, maxItems: count });
const service = { type: 'string', minLength: 1, maxLength: 80 };
const error = {
  type: 'object', required: ['error'], properties: { error: { type: 'string' } }
};
const response = (description) => ({ description, content: { 'application/json': { schema: error } } });

export const exampleWindowRequest = {
  action: 'check-window', service: 'Checkout API', start: '2026-11-20T12:00:00Z',
  intervalMinutes: 5, slotCount: 3, threshold: '90',
  csv: 'timestamp,status\n2026-11-20T12:00:00Z,up\n2026-11-20T12:05:00Z,down'
};

export const agentOpenApi = {
  openapi: '3.1.0',
  info: { title: 'Gapmark Agent API', version: '1.0.0', description: 'Calculate an uptime report or verify a downloaded Gapmark proof.' },
  servers: [{ url: '/' }],
  paths: {
    '/api/agent': {
      post: {
        operationId: 'runGapmarkAction',
        summary: 'Calculate an uptime report or verify a proof',
        description: 'Send CSV to the server only when the user wants server-side calculation. For browser-only calculation, use the Gapmark website.',
        requestBody: { required: true, content: { 'application/json': {
          schema: { oneOf: [{ $ref: '#/components/schemas/CheckWindow' }, { $ref: '#/components/schemas/VerifyProof' }] },
          examples: { missingCheck: { value: exampleWindowRequest } }
        } } },
        responses: {
          200: { description: 'Calculated counts and verdict, or the proof verification result. Check the verified field for the verification action.' },
          400: response('Invalid request, CSV, or proof bundle'),
          413: response('Request exceeds 72 KB'),
          415: response('Expected application/json'),
          429: response('Proof verifier busy'),
          503: response('Proof verifier unavailable')
        }
      }
    }
  },
  components: { schemas: {
    CheckWindow: {
      type: 'object',
      required: ['action', 'csv', 'service', 'start', 'intervalMinutes', 'slotCount', 'threshold'],
      properties: {
        action: { const: 'check-window' },
        csv: { type: 'string', maxLength: MAX_CSV_CHARS, description: 'CSV with timestamp and status columns.' },
        service,
        start: { type: 'string', format: 'date-time', description: 'Start of the scheduled window, with timezone.' },
        intervalMinutes: { type: 'integer', minimum: 1, maximum: 1440 },
        slotCount: { type: 'integer', minimum: 1, maximum: MAX_SLOTS, description: 'Number of scheduled checks. Total window must be at most 24 hours.' },
        threshold: { oneOf: [
          { type: 'string', pattern: '^[0-9]{1,3}(\\.[0-9]{1,2})?$' },
          { type: 'number', minimum: 0, maximum: 100, multipleOf: 0.01 }
        ], description: 'Minimum uptime percentage, 0 to 100 with up to two decimal places.' }
      }
    },
    VerifyProof: {
      type: 'object',
      required: ['action', 'bundle'],
      properties: {
        action: { const: 'verify-proof' },
        bundle: { $ref: '#/components/schemas/ProofBundle' },
        trustedMonitorKey: { type: 'string', maxLength: 120, description: 'An independently trusted Ed25519 SPKI public key in base64url.' }
      }
    },
    ProofBundle: {
      type: 'object',
      required: ['schema', 'service', 'proof', 'publicSignals'],
      properties: {
        schema: { const: SCHEMA },
        service,
        proof: {
          type: 'object', required: ['protocol', 'curve', 'pi_a', 'pi_b', 'pi_c'],
          properties: {
            protocol: { const: 'groth16' }, curve: { const: 'bn128' },
            pi_a: array(decimal, 3), pi_b: array(array(decimal, 2), 3), pi_c: array(decimal, 3)
          }
        },
        publicSignals: array(decimal, 10),
        checkpoint: {
          type: 'object', required: ['algorithm', 'signature'],
          properties: { algorithm: { const: 'Ed25519' }, signature: { type: 'string', maxLength: 120 } }
        }
      }
    }
  } }
};
