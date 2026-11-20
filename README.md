# Gapmark

A Next.js workbench and HTTP agent for checking uptime evidence. The site accepts its three demo cases or the visitor’s own CSV. Browser import, analysis and proving keep raw observations on the device. A proof bundle reveals the selected policy, window metadata, outcome counts, and cryptographic commitment. The API accepts CSV only when a client chooses to send it explicitly. There is no database or required login.

## Start here on Windows

### 1. Open the homepage with what you already have

Open **PowerShell** and run these lines from the project folder. Node 22 and npm are already installed on this machine. If you are setting up another computer, use the [official Node.js download](https://nodejs.org/en/download).

```powershell
Set-Location 'C:\Users\saiga\OneDrive\Desktop\zkdabao'
npm.cmd run preview:offline
```

Leave PowerShell open. Visit [localhost:3000](http://127.0.0.1:3000) and select **Try the missing-data demo**. You should see **10 up, 1 down, 1 missing** and **Insufficient evidence**. Switch to **Meets policy** or **Below threshold** to try the other outcomes. To load a file, select **Use my CSV** at the top or **Choose CSV file** in the checker. Stop the preview with **Ctrl+C**.

### 2. Install the Next.js dependencies

After stopping the preview, use the same PowerShell window:

```powershell
npm.cmd install
npm.cmd run dev
```

If the install says `ENOTFOUND registry.npmjs.org`, npm cannot reach its registry. Check your connection with `npm.cmd ping`, then retry the install from regular PowerShell. You can keep using the Node-only preview while fixing that. Git, Supabase, Vercel and zkVerify credentials are unnecessary for viewing and testing the analyzer. `npm.cmd test` checks the CSV, policy, proof signal parsing and monitor signature logic without dependencies.

## Use your own monitoring data

Set the window start in UTC, interval length in whole minutes, number of expected slots, and minimum uptime percentage. Defaults are 12 five-minute slots and a 90% threshold. Windows can use **1–48 slots** with a total duration of **at most 24 hours**. Rows mark the start of each interval. The window start is inclusive and the end is exclusive. Choose a coarser interval if the number of samples exceeds the circuit limit. The app never silently resamples observations.

```csv
timestamp,status
2026-11-20T12:00:00Z,up
2026-11-20T12:05:00Z,down
2026-11-20T12:10:00Z,missing
```

Set three slots to try these rows as a complete example. Rows can be in any order. The parser accepts a UTF-8 BOM, CSV quoting, ISO timestamps with offsets and extra columns. Only `timestamp` and `status` affect the result. It rejects ambiguous duplicate slots, timestamps outside the window, timestamps off the selected grid and unknown statuses. An omitted slot becomes `missing`. Under this policy any missing slot yields **insufficient evidence**. For a complete window, comparisons use exact integer arithmetic rather than a rounded display percentage.

## Turn on Generate proof

On Vercel, `vercel.json` selects `npm run build:vercel`. The Linux build downloads the pinned official Circom release and published Powers of Tau file, checks their digests, builds the browser assets, and runs the genuine proof test. These Windows downloads are only for manually preparing proof assets on your own machine. If you redeploy without reusing `public/zk`, the demo setup can generate a different verification key. Keep a matching artifact set for reports that need to verify across deployments.

Do this after `npm.cmd install` succeeds. A proof lets another person check the report's calculation from the public summary. The homepage can calculate a verdict before you install the proving tools.

1. Download the Windows x64 Circom executable from the **Assets** section of the [official iden3 Circom release](https://github.com/iden3/circom/releases/tag/v2.2.3). Save it in Downloads as `circom-windows-amd64.exe`.
2. Download `powersOfTau28_hez_final_12.ptau` from the power **12** row in the [official snarkjs Powers of Tau table](https://github.com/iden3/snarkjs#7-prepare-phase-2). Save it in Downloads.
3. Stop the server with **Ctrl+C**. Run this in PowerShell from `zkdabao`:

   ```powershell
   $env:CIRCOM_BIN = Join-Path $env:USERPROFILE 'Downloads\circom-windows-amd64.exe'
   $ptauFile = Join-Path $env:USERPROFILE 'Downloads\powersOfTau28_hez_final_12.ptau'
   & $env:CIRCOM_BIN --version
   node -e "const [path] = process.argv.slice(1); console.log(require('node:crypto').createHash('blake2b512').update(require('node:fs').readFileSync(path)).digest('hex'))" $ptauFile
   ```

   Compare the printed hash with the published hash in the power 12 row. Continue if they match:

   ```powershell
   npm.cmd run zk:prepare -- "$ptauFile"
   npm.cmd test
   npm.cmd run dev
   ```

4. Refresh the site, load a sample, select **Generate proof**, and download the JSON. Open that file in **Verify a proof bundle** on the same page. To test rejection by the cryptographic verifier, edit a copy of the proof file to change the decimal commitment in `publicSignals[0]` while leaving the proof bytes unchanged.

The preparation script writes the matching files to `public/zk`. The default single-operator setup is for a hackathon demonstration. For independent reliance, pass an independently contributed final zkey as the second argument. The script verifies the zkey against the compiled circuit. Preserve that verification key if people need to check previously shared bundles.

The circuit commits to a version tag, the service identifier, start time, interval size, slot count, threshold, ordered statuses, and a private random salt. The verifier checks the service label against the identifier and uses the verification key supplied by this deployment. Proof verification establishes the normalized window and arithmetic. It does not establish that the uploader’s monitoring observations are authentic or that the CSV conversion was correct. A monitor can attest to a checkpoint with `npm.cmd run zk:sign -- <bundle.json> <private-key.pem> <new-signed-bundle.json>`. Reviewers need the returned Ed25519 public key through an independent trusted channel.

## Optional zkVerify submission

Set `KURIER_API_KEY` to your [Kurier testnet key](https://testnet.kurier.xyz/) on the server. Anyone can generate a proof and click **Submit to zkVerify testnet**. The server verifies it locally, registers the deployment's verification key, and forwards the proof and public inputs. The page waits for a finalized transaction reference. The route limits traffic per instance. For a public Vercel deployment, add a [Vercel Firewall rate limit](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting) for `POST /api/zkverify` to enforce a per-IP limit across instances in each region. The CLI alternative is `npm.cmd run zk:submit -- verify <bundle.json>`.

## Agent and Vercel

`GET /api/agent` returns the two available actions. POST JSON to the same route:

```json
{
  "action": "check-window",
  "service": "Example API",
  "start": "2026-11-20T12:00:00Z",
  "intervalMinutes": 5,
  "slotCount": 3,
  "threshold": "90",
  "csv": "timestamp,status\n2026-11-20T12:00:00Z,up\n2026-11-20T12:05:00Z,down"
}
```

For a public proof, POST `{"action":"verify-proof","bundle":{...}}`. Supply `trustedMonitorKey` only if you have an independently trusted Ed25519 SPKI public key in base64url. No model is required because the supported actions and verdicts are deterministic. The API has no Agent Games signed request adapter.

Before deployment, run `npm.cmd run build` with the proof artifacts in place. Vercel can deploy the folder with its [official CLI](https://vercel.com/docs/cli) or import a Git repository. A database is unnecessary for this version. Use the same deployment’s `/api/agent` route for the public API. To reproduce the setup from another checkout, keep its audited proof artifacts and generate a package lock on the first successful install.
