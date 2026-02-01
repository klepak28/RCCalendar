#!/usr/bin/env node
/**
 * Manual verification script for Google Calendar-style recurring task edit.
 *
 * Prerequisites: API running, DB seeded, auth token.
 *
 * Steps:
 * 1. Create weekly recurring task starting 2026-01-01 15:00Z (BYDAY=TH)
 * 2. Edit only occurrence 2026-01-29: change description
 * 3. Verify: 2026-01-29 has new description; 2026-02-05 has original
 * 4. Edit this and following at 2026-02-12: change price
 * 5. Verify: 2026-02-05 unchanged; 2026-02-12+ have new price
 *
 * Run: node apps/api/scripts/verify-edit-recurring.mjs
 */

const BASE = process.env.API_ORIGIN ?? 'http://127.0.0.1:55556';

async function api(method, path, body, token) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    ...(body && { body: JSON.stringify(body) }),
  };
  const r = await fetch(`${BASE}${path}`, opts);
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

async function main() {
  console.log('Verify recurring task edit behavior\n');
  console.log('Manual steps:');
  console.log('1. Login via UI, get token from localStorage');
  console.log('2. Create weekly task: start 2026-01-01T15:00:00.000Z, RRULE FREQ=WEEKLY;BYDAY=TH');
  console.log('3. In calendar, click occurrence 2026-01-29, Edit');
  console.log('4. Change description to "Edited single", select "Only this task", Apply');
  console.log('5. Verify: 2026-01-29 shows "Edited single"; 2026-02-05 shows original');
  console.log('6. Click 2026-02-12, Edit, change price, select "This and following", Apply');
  console.log('7. Verify: 2026-02-05 unchanged; 2026-02-12+ have new price');
  console.log('\nAPI endpoints used:');
  console.log('  PATCH /api/tasks/:id?scope=single&occurrenceStart=<ISO>');
  console.log('  PATCH /api/tasks/:id?scope=following&occurrenceStart=<ISO>');
  console.log('  PATCH /api/tasks/:id?scope=all');
}

main().catch(console.error);
