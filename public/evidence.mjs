export const MAX_SLOTS = 48;
export const SCHEMA = 'uptime-evidence/v1';
export const SLOT = Object.freeze({ missing: 0, up: 1, down: 2 });
export const MAX_CSV_CHARS = 64000;

function integer(value, min, max, label) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${label} must be a whole number from ${min} to ${max}.`);
  }
  return value;
}

export function timestampSeconds(input) {
  const match = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)(?::(\d\d)(?:\.(\d{1,3}))?)?(Z|[+-]\d\d:\d\d)$/i.exec(input);
  if (!match) throw new Error('Use an ISO 8601 timestamp with a time zone, such as 2026-11-20T12:00:00Z.');
  const [, y, mo, d, h, mi, sec = '00', fraction = '0'] = match;
  const local = Date.parse(`${y}-${mo}-${d}T${h}:${mi}:${sec}Z`);
  const epoch = Date.parse(input);
  if (!Number.isFinite(epoch) || !Number.isFinite(local) || epoch < 0 || Number(fraction) !== 0 ||
      new Date(local).toISOString().slice(0, 19) !== `${y}-${mo}-${d}T${h}:${mi}:${sec}` ||
      Math.floor(epoch / 1000) > 4294967295) {
    throw new Error('Use a valid whole-second timestamp between 1970 and 2106.');
  }
  return epoch / 1000;
}

export function thresholdBps(input) {
  const value = String(input).trim();
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(value)) throw new Error('Enter a threshold from 0 to 100 with up to two decimal places.');
  const [whole, decimal = ''] = value.split('.');
  return integer(Number(whole) * 100 + Number(decimal.padEnd(2, '0')), 0, 10000, 'Threshold in basis points');
}

function parseCsv(text) {
  if (typeof text !== 'string' || text.length > MAX_CSV_CHARS) throw new Error('CSV exceeds the 64,000-character limit.');
  const rows = [];
  let row = [], value = '', state = 'field', line = 1, firstLine = 1;
  const field = () => { row.push(value.trim()); value = ''; state = 'field'; };
  const end = () => {
    field();
    if (row.some(Boolean) || row.length > 1) rows.push({ line: firstLine, cells: row });
    row = [];
  };
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  for (let index = 0; index < normalized.length; index++) {
    const ch = normalized[index];
    if (state === 'quoted') {
      if (ch === '"' && normalized[index + 1] === '"') { value += '"'; index++; }
      else if (ch === '"') state = 'closed';
      else { value += ch; if (ch === '\n') line++; }
    } else if (ch === ',') field();
    else if (ch === '\n') { end(); line++; firstLine = line; }
    else if (state === 'closed') {
      if (ch !== ' ' && ch !== '\t') throw new Error(`Row ${line}: unexpected character after a closing quote.`);
    } else if (ch === '"') {
      if (value.trim()) throw new Error(`Row ${line}: a quoted field must start with a quote.`);
      value = ''; state = 'quoted';
    } else value += ch;
  }
  if (state === 'quoted') throw new Error(`Row ${firstLine}: an opening quote has no closing quote.`);
  end();
  return rows;
}

export function verdict(up, missing, count, bps) {
  return missing > 0 ? 'INSUFFICIENT' : up * 10000 >= count * bps ? 'PASS' : 'BREACH';
}

export function analyze({ csv, service, start, intervalMinutes, slotCount, threshold }) {
  if (typeof service !== 'string' || !service.trim() || service.trim().length > 80) throw new Error('Enter a service label of 1–80 characters.');
  const windowStart = timestampSeconds(start);
  const minutes = integer(intervalMinutes, 1, 1440, 'Interval length');
  const count = integer(slotCount, 1, MAX_SLOTS, 'Number of slots');
  if (minutes * count > 1440) throw new Error('Use a monitoring window of 24 hours or less.');
  const bps = thresholdBps(threshold);
  const stepSeconds = minutes * 60;
  const rows = parseCsv(csv);
  const header = rows.shift()?.cells.map((value) => value.toLowerCase());
  if (!header || new Set(header).size !== header.length || !header.includes('timestamp') || !header.includes('status')) {
    throw new Error('CSV needs a header with unique column names including timestamp and status.');
  }
  const timeColumn = header.indexOf('timestamp');
  const statusColumn = header.indexOf('status');
  const observed = new Array(count).fill(null);
  for (const { line, cells } of rows) {
    if (cells.length !== header.length) throw new Error(`Row ${line}: expected ${header.length} columns, found ${cells.length}.`);
    let at;
    try { at = timestampSeconds(cells[timeColumn]); } catch (error) { throw new Error(`Row ${line}: ${error.message}`); }
    const delta = at - windowStart;
    if (delta < 0 || delta >= count * stepSeconds || delta % stepSeconds !== 0) {
      throw new Error(`Row ${line}: timestamp is outside the window or does not align with a slot.`);
    }
    const index = delta / stepSeconds;
    if (observed[index] !== null) throw new Error(`Row ${line}: more than one observation for slot ${index + 1}.`);
    const status = cells[statusColumn].toLowerCase();
    if (!Object.hasOwn(SLOT, status)) throw new Error(`Row ${line}: status must be up, down, or missing.`);
    observed[index] = status;
  }
  const slots = observed.map((status, index) => ({ at: windowStart + index * stepSeconds, status: status ?? 'missing', recorded: status !== null }));
  const counts = { up: 0, down: 0, missing: 0 };
  for (const { status } of slots) counts[status]++;
  return { service: service.trim(), windowStart, intervalMinutes: minutes, slotCount: count, thresholdBps: bps, counts, verdict: verdict(counts.up, counts.missing, count, bps), slots };
}

export function describe(code) {
  return {
    PASS: 'Every interval has data and the observed uptime meets the selected threshold.',
    BREACH: 'Every interval has data and the observed uptime falls below the selected threshold.',
    INSUFFICIENT: 'At least one interval has no observation. This policy treats incomplete windows as insufficient evidence.'
  }[code];
}

export async function serviceId(label) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(label)));
  const hex = Array.from(bytes.slice(0, 31), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return BigInt(`0x${hex}`).toString();
}

export const VERDICT_CODE = Object.freeze({ BREACH: 0, PASS: 1, INSUFFICIENT: 2 });

export function compareReportTerms(report, service, expected) {
  const terms = [
    ['service label', expected.service.trim(), service, (value) => value],
    ['window start', expected.start, report.windowStart, (value) => timestampSeconds(/(?:Z|[+-]\d\d:\d\d)$/i.test(value) ? value : `${value}Z`)],
    ['check interval', expected.interval, report.intervalMinutes, (value) => integer(Number(value), 1, 1440, 'Check interval')],
    ['expected checks', expected.count, report.slotCount, (value) => integer(Number(value), 1, MAX_SLOTS, 'Expected checks')],
    ['required uptime', expected.threshold, report.thresholdBps, thresholdBps]
  ];
  const checked = [];
  const differences = [];
  for (const [label, value, actual, normalize] of terms) {
    if (value === '') continue;
    checked.push(label);
    if (normalize(value) !== actual) differences.push(label);
  }
  return { checked, differences };
}

export function readPublicSignals(signals) {
  if (!Array.isArray(signals) || signals.length !== 10 || signals.some((v) => typeof v !== 'string' || !/^(0|[1-9]\d{0,76})$/.test(v))) {
    throw new Error('The proof must have ten canonical public signals.');
  }
  const [commitment, upRaw, downRaw, missingRaw, codeRaw, id, at, mins, count, bps] = signals;
  const number = (value, min, max, label) => integer(Number(value), min, max, label);
  const slotCount = number(count, 1, MAX_SLOTS, 'Number of slots');
  const intervalMinutes = number(mins, 1, 1440, 'Interval length');
  const up = number(upRaw, 0, slotCount, 'Up intervals');
  const down = number(downRaw, 0, slotCount, 'Down intervals');
  const missing = number(missingRaw, 0, slotCount, 'Missing intervals');
  const threshold = number(bps, 0, 10000, 'Threshold');
  const code = verdict(up, missing, slotCount, threshold);
  if (intervalMinutes * slotCount > 1440 || up + down + missing !== slotCount || String(VERDICT_CODE[code]) !== codeRaw) {
    throw new Error('Public counts, interval duration, or verdict are inconsistent.');
  }
  return { commitment, serviceId: id, windowStart: number(at, 0, 4294967295, 'Window start'), intervalMinutes, slotCount, thresholdBps: threshold, counts: { up, down, missing }, verdict: code };
}

export function assertProofBundle(bundle) {
  if (!bundle || bundle.schema !== SCHEMA || typeof bundle.service !== 'string' || !bundle.service.trim() || bundle.service.length > 80 ||
      !bundle.proof || bundle.proof.protocol !== 'groth16' || bundle.proof.curve !== 'bn128') {
    throw new Error(`Expected an ${SCHEMA} Groth16 proof bundle.`);
  }
  const point = (value) => Array.isArray(value) && value.length === 3 && value.every((x) => typeof x === 'string' && /^\d{1,77}$/.test(x));
  const { pi_a, pi_b, pi_c } = bundle.proof;
  if (!point(pi_a) || !point(pi_c) || !Array.isArray(pi_b) || pi_b.length !== 3 ||
      pi_b.some((v) => !Array.isArray(v) || v.length !== 2 || v.some((x) => typeof x !== 'string' || !/^\d{1,77}$/.test(x)))) {
    throw new Error('The Groth16 proof points are malformed.');
  }
  return readPublicSignals(bundle.publicSignals);
}

export function checkpointMessage(report) {
  return new TextEncoder().encode(JSON.stringify([
    SCHEMA, report.commitment, report.serviceId, report.windowStart, report.intervalMinutes, report.slotCount, report.thresholdBps
  ]));
}

export async function checkCheckpoint(bundle, report, trustedKey) {
  if (!bundle.checkpoint) return 'Self-supplied data. No monitor signature.';
  if (!trustedKey) return 'A monitor signature is supplied. Add an independently trusted public key to check the source.';
  const bytes = (value) => {
    if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,120}$/.test(value)) throw new Error('Invalid base64url encoding.');
    return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), (ch) => ch.charCodeAt(0));
  };
  if (bundle.checkpoint.algorithm !== 'Ed25519') throw new Error('Unsupported checkpoint signature algorithm.');
  const key = await crypto.subtle.importKey('spki', bytes(trustedKey), 'Ed25519', false, ['verify']);
  const valid = await crypto.subtle.verify('Ed25519', key, bytes(bundle.checkpoint.signature), checkpointMessage(report));
  return valid ? 'Checkpoint signature matches the supplied trusted key.' : 'Checkpoint signature does not match the supplied trusted key.';
}
