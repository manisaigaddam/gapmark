export const demoWindow = {
  service: 'Checkout API', start: '2026-11-20T12:00', intervalMinutes: 5, slotCount: 12, threshold: 90
};

export const demoCases = {
  missing: { label: 'One check missing', verdict: 'Insufficient evidence', down: [10], missing: [6], explanation: 'A scheduled check is missing, so the report cannot establish whether the target was met.' },
  pass: { label: 'One check down', verdict: 'Uptime target met', down: [10], missing: [], explanation: '11 of 12 checks were up. 91.67% clears the 90% target.' },
  breach: { label: 'Two checks down', verdict: 'Uptime target missed', down: [5, 10], missing: [], explanation: '10 of 12 checks were up. 83.33% falls below the 90% target.' }
};

export function demoStatuses(sample) {
  return Array.from({ length: demoWindow.slotCount }, (_, index) => {
    if (sample.missing.includes(index)) return 'missing';
    if (sample.down.includes(index)) return 'down';
    return 'up';
  });
}

export function sampleCsv(name) {
  const first = Date.parse(`${demoWindow.start}Z`);
  const rows = demoStatuses(demoCases[name]).flatMap((status, index) => {
    if (status === 'missing') return [];
    const timestamp = new Date(first + index * demoWindow.intervalMinutes * 60_000).toISOString();
    return [`${timestamp},${status}`];
  });
  return ['timestamp,status', ...rows].join('\n');
}
