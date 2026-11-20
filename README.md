# Gapmark

Gapmark is a browser workbench and HTTP agent for checking uptime reports. Service providers and their customers need to know whether an uptime target was met, even when scheduled checks are missing or the underlying monitoring logs are private.

Gapmark checks every scheduled slot, returns a verdict, and creates a zero-knowledge proof of the report calculation. A reviewer can verify that proof and compare the agreed terms without receiving the raw logs.

## Run locally

**Requirements:** Node.js 22 or later and npm. The repository includes matching demo proof assets. The browser demo works without accounts or credentials.

```powershell
npm.cmd ci
npm.cmd run dev
```

Open [Gapmark locally](http://127.0.0.1:3000). On macOS or Linux, use `npm` in place of `npm.cmd`.

| Page | What to do |
| --- | --- |
| `/` | Switch between example outcomes, then open the selected example. |
| `/create` | Load a sample or CSV, calculate a verdict, and generate a proof in the browser. |
| `/review` | Verify a proof file or a shared report and compare it against the agreement. |
| `/workspace` | Sign in by email to save, share, or reopen proofs. Requires Supabase. |
| `/guide` | Follow the step-by-step testing guide and check the expected results. |

## Try the report and review flow

1. Open [the missing-check demo](http://127.0.0.1:3000/create?sample=missing). Select a bar in the timeline to inspect its timestamp and status. The omitted check is at 12:30 UTC.
2. Switch scenarios in **Choose a demo scenario** and compare the outcome:

   | Sample | Up | Down | Missing | Expected report |
   | --- | ---: | ---: | ---: | --- |
   | One check missing | 10 | 1 | 1 | Insufficient evidence |
   | One check down | 11 | 1 | 0 | Uptime target met (91.67%) |
   | Two checks down | 10 | 2 | 0 | Uptime target missed (83.33%) |

3. Select **Generate proof**, download the JSON, and select **Verify this proof**. On Review, select **Verify proof**. The cryptographic check should pass and the verdict should match Create, including a missed target or insufficient evidence.
4. Open **Compare it with your agreement**. Use service **Checkout API**, start **2026-11-20 12:00 UTC**, interval **5 minutes**, **12 checks**, and **90%** required uptime. Verify, then change the expected uptime to **95%** and verify again. The proof should still verify and the agreement check should flag the difference.
5. To check rejection, make a copy of the downloaded JSON and change the last digit of the decimal string `publicSignals[0]` (the commitment). Upload the edited copy and verify. Keep the original for further testing.

If dependencies are unavailable, run `npm.cmd run preview:offline` and open [the fallback](http://127.0.0.1:3000). It serves the browser checker and proof workflow with the bundled assets. The full Next.js app adds separate pages, the testnet relay, Workspace, and the signed Games adapter.

### Use your own monitoring data

Use a `timestamp,status` CSV. Timestamps identify the start of an interval and must include a timezone. The selected window starts inclusively and ends exclusively. Use 1–48 scheduled checks over at most 24 hours. An omitted or explicitly missing observation yields **Insufficient evidence**. Duplicate checks, off-grid timestamps, out-of-window rows, and unknown statuses produce an input error. Complete windows are evaluated using exact arithmetic.

```csv
timestamp,status
2026-11-20T12:00:00Z,up
2026-11-20T12:05:00Z,down
2026-11-20T12:10:00Z,missing
```

To try this CSV, set a start of **2026-11-20 12:00 UTC**, a **5-minute** interval, and **3 expected checks**, then select **Calculate report**.

## Agent API

`GET /api/agent` returns action descriptions and an example. POST JSON to the same route. [OpenAPI](http://127.0.0.1:3000/api/agent/openapi) describes the request schema.

```powershell
$endpoint = 'http://127.0.0.1:3000/api/agent'
$example = (Invoke-RestMethod $endpoint).example | ConvertTo-Json -Depth 10
Invoke-RestMethod $endpoint -Method Post -ContentType 'application/json' -Body $example
```

- `check-window` calculates a verdict. The example returns `INSUFFICIENT` with one up, one down, and one missing. The API receives the CSV on the server. Use Create to keep the raw CSV on your device.
- `verify-proof` checks `bundle` using this deployment's verification key. Add `expectedTerms` with `service`, `start` (ISO timestamp with timezone), `intervalMinutes`, `slotCount`, and `threshold` for a policy decision. Set `requireZkVerify: true` to also require a matching finalized receipt. Supply `trustedMonitorKey` to check a signed checkpoint against an independently trusted Ed25519 SPKI public key in base64url. Read `verified` for the proof result and `policy.decision` for the agreement outcome.

## What the evidence establishes

The Groth16 circuit checks the counts and verdict for an ordered sequence of normalized monitoring states. Its salted commitment binds those states to the service identifier, window, interval, check count, and threshold. The public bundle includes the service label, terms, counts, verdict, commitment, and proof. Raw CSV rows and the private salt stay in your browser during analysis and proving.

The proof establishes the calculation from the supplied inputs. The accuracy and origin of observations depend on the monitor. To attest to the source, a monitor can use `npm.cmd run zk:sign -- <bundle.json> <private-key.pem> <signed-bundle.json>`. Reviewers need the corresponding public key through a trusted channel.

The checked-in artifacts use a single-operator demo setup. For independently relied-on reports, use a contributed final zkey checked against the compiled circuit. With Circom available, run `npm.cmd run zk:prepare -- <powers-of-tau.ptau> <final.zkey>`. Keep the matching verification key available for existing proofs. A Volta receipt adds a public testnet transaction reference. Gapmark binds that reference to the exact submitted proof using a server-side seal.

## Deployment and configuration

Run `npm.cmd run build:vercel` to check artifact digests, run tests, and build Next.js. Run `npm.cmd start -- --hostname 127.0.0.1` to serve the production build locally. For public hosting, import the Git repository into Vercel with the existing `vercel.json`. Check the production URL from a signed-out browser before sharing it. For a public Kurier relay, add a per-IP [Vercel Firewall rate limit](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting) on `POST /api/zkverify` alongside the app's per-instance limit.

Use the names in [the environment example](.env.example) in a local `.env` or in the hosting provider's server-side environment. Restart or redeploy after updates. Keep secrets out of source control and client-side variables.

| Variable | Used for | Where to get it |
| --- | --- | --- |
| `KURIER_API_KEY` | Optional Volta testnet proof submission. | Create a **testnet** key via [Kurier](https://testnet.kurier.xyz/). See [zkVerify's Kurier docs](https://docs.zkverify.io/overview/getting-started/kurier). |
| `KURIER_RECEIPT_SECRET` | Optional dedicated seal for Gapmark receipt and job tracking. Otherwise the relay uses the Kurier API key. | Generate locally with the command below. Keep it stable across deployments that review the same receipts. |
| `AGENT_GAMES_HMAC_SECRET` | Required for the signed Games adapter and official preflight. | Register the URL ending in `/api/agent-games` and copy the dashboard's one-time **Rotate Secret** value. |
| `KURIER_BASE_URL` | Optional override. The website relay accepts the testnet base or default. | `https://api-testnet.kurier.xyz/api/v1` |
| `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` | Optional email sign-in, private report history, and sharing. | Supabase project **Connect** dialog. |

Generate a dedicated receipt secret once, then store the output as the server-side `KURIER_RECEIPT_SECRET`:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Set it before issuing receipts you intend to retain. Moving from the API-key fallback to a different receipt secret, or rotating the secret used to seal receipts, changes which seals the deployment can validate.

### Test a Volta receipt

Generate a proof and select **Submit to zkVerify testnet**. Gapmark checks the proof, registers its verification key with Kurier, and submits the proof and public inputs. Use **Check transaction status** if the job is still pending. After finalization, **Optional zkVerify receipt** shows the transaction hash and **View transaction on zkVerify Volta** and **Copy transaction link**. Download the proof and receipt together to reopen the same link in Review after verifying the bundle. You can also browse the [Volta testnet explorer](https://zkverify-testnet.subscan.io/).

### Set up and test Workspace

1. Apply the [workspace migration](supabase/migrations/202611200001_report_workspace.sql) and [receipt migration](supabase/migrations/202611200002_zkverify_receipts.sql), in that order.
2. Enable email sign-in and sign-ups. In **Authentication → Email Templates**, replace the link-based content of both **Magic Link** and **Confirm signup** with `<p>Your Gapmark sign-in code is <strong>{{ .Token }}</strong>.</p>`. This sends a code for users to enter in the original Workspace tab. Configure SMTP for external recipients. [Supabase email sign-in docs](https://supabase.com/docs/guides/auth/auth-email-passwordless)
3. Set the Supabase variables, sign in, and save a generated proof. In **Issued**, grant a second email access and copy the link.
4. Open the link in another browser profile and sign in with that email. Verify the shared report. Revoke access from the issuer's Workspace and reopen the link as the reviewer. Downloaded files and reviewer-owned copies remain usable.

If an email link sends you to `http://localhost:3000`, check **Authentication → URL Configuration → Site URL**. Set it to the production Gapmark origin, including `https://`. Supabase uses this setting for email links when no redirect URL is supplied. Save the two code templates above, open `/workspace` on the deployed site, and request a fresh code. [Supabase redirect URL docs](https://supabase.com/docs/guides/auth/redirect-urls)

## Agent Games Wildcard

The [Wildcard requirements](https://agentgames.zkverify.io/events/wildcard#requirements) ask for a public project link, a public HTTPS agent endpoint, a use case, and build context. A meaningful zkVerify proof reference is optional. The [official homepage timeline](https://agentgames.zkverify.io/) lists **21 November 2026, 22:00 UTC** (**22 November, 03:30 IST**) as the final entry deadline. [Submit your build](https://agentgames.zkverify.io/dashboard/submissions?category=wildcard) redirects signed-out visitors to registration. Successful new-account sign-in and submission acceptance need to be confirmed from a participant account.

| Checklist | What to enter or confirm |
| --- | --- |
| Public project link | Link the deployed demo or [repository](https://github.com/manisaigaddam/gapmark) after checking signed-out access. Link the demo guide so reviewers can reproduce the flow. |
| Public HTTPS endpoint | Use `https://<your-deployment>/api/agent` for direct review. Use `https://<your-deployment>/api/agent-games` if the form asks for a registered signed endpoint or preflight. |
| Use case | Gapmark helps service providers and customers audit uptime reports while keeping raw monitoring logs private and exposing missing data. |
| Build context | Gapmark maps CSV rows to scheduled checks and returns a deterministic verdict. Its browser-generated Groth16 proof lets the review agent verify the calculation, compare the agreed terms, and report its findings. |
| Optional zkVerify reference | If a Volta receipt has finalized, attach its explorer URL and matching proof bundle. The claim is verification of the uptime calculation for a committed reporting window. |
| Prize eligibility | Connect GitHub and a wallet as required by the [platform rules](https://agentgames.zkverify.io/rules). Confirm the entry appears in the dashboard. |

The [Agent Games build guide](https://agentgames.zkverify.io/build) documents signed preflight. Set the issued HMAC secret on the deployed server and run preflight from the dashboard. Gapmark checks raw request signatures and freshness and signs replies. The adapter accepts Gapmark's read-only actions in the envelope or its `input` field. Local tests cover that handshake. Gapmark uses deterministic rules and has no model dependency.

If registration fails, try the other identity method listed on the [registration page](https://agentgames.zkverify.io/register) or report the exact error via the organizer Discord linked from the Wildcard page. The public demo and ordinary API can be tested independently of the Games account.

## Development checks

- `npm.cmd test` runs the evidence, Groth16, Kurier, receipt, workspace, and local signed preflight tests.
- `npm.cmd run zk:bootstrap` validates the bundled proof assets or prepares the demo assets if the complete set is absent.
- `npm.cmd run zk:submit -- verify <bundle.json>` submits a proof through a configured Kurier account as a CLI alternative.
