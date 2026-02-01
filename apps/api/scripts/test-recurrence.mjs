#!/usr/bin/env node
/**
 * Unit tests for recurrence RRULE generation and expansion.
 * Run: node apps/api/scripts/test-recurrence.mjs
 * Uses rrule package (must be installed in api workspace).
 */
import rrulePkg from 'rrule';
const { rrulestr } = rrulePkg;

const from = new Date(Date.UTC(2026, 0, 1, 0, 0, 0));
const to = new Date(Date.UTC(2026, 5, 30, 23, 59, 59));

function dtstart(month, day, hour = 15, minute = 0) {
  return new Date(Date.UTC(2026, month, day, hour, minute, 0));
}

function expand(rruleStr, dtstartDate) {
  const dtstartStr = dtstartDate
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
    .replace('Z', '') + 'Z';
  const full = `DTSTART:${dtstartStr}\nRRULE:${rruleStr}`;
  const rule = rrulestr(full);
  return rule.between(from, to, true);
}

function iso(d) {
  return d.toISOString().slice(0, 10);
}

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  } else {
    console.log('OK:', msg);
  }
}

// Monthly on day 15
const r15 = expand('FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=15', dtstart(0, 15));
assert(r15.length >= 6, 'Monthly day 15: at least 6 occurrences in Jan–Jun 2026');
assert(r15[0].getUTCDate() === 15 && r15[0].getUTCMonth() === 0, 'Monthly day 15: first is Jan 15');
assert(r15.some(d => d.getUTCMonth() === 1 && d.getUTCDate() === 15), 'Monthly day 15: Feb 15 exists');
console.log('  Occurrences:', r15.map(iso).join(', '));

// Monthly last day
const rLast = expand('FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=-1', dtstart(0, 31));
assert(rLast.length >= 6, 'Monthly last day: at least 6 occurrences');
assert(rLast[0].getUTCDate() === 31 && rLast[0].getUTCMonth() === 0, 'Monthly last: Jan 31');
assert(rLast[1].getUTCDate() === 28 && rLast[1].getUTCMonth() === 1, 'Monthly last: Feb 28');
console.log('  Occurrences:', rLast.map(iso).join(', '));

// Monthly 2nd Saturday
const r2ndSa = expand('FREQ=MONTHLY;INTERVAL=1;BYDAY=SA;BYSETPOS=2', dtstart(0, 10));
assert(r2ndSa.length >= 6, 'Monthly 2nd Saturday: at least 6 occurrences');
r2ndSa.forEach(d => {
  assert(d.getUTCDay() === 6, `2nd Saturday: ${iso(d)} is Saturday`);
});
console.log('  Occurrences:', r2ndSa.map(iso).join(', '));

// Monthly last Saturday
const rLastSa = expand('FREQ=MONTHLY;INTERVAL=1;BYDAY=SA;BYSETPOS=-1', dtstart(0, 31));
assert(rLastSa.length >= 6, 'Monthly last Saturday: at least 6 occurrences');
rLastSa.forEach(d => assert(d.getUTCDay() === 6, `Last Saturday: ${iso(d)} is Saturday`));
console.log('  Occurrences:', rLastSa.map(iso).join(', '));

// Yearly Jan 15
const rY = expand('FREQ=YEARLY;INTERVAL=1;BYMONTH=1;BYMONTHDAY=15', dtstart(0, 15));
assert(rY.length >= 1, 'Yearly Jan 15: at least one in range');
assert(rY[0].getUTCMonth() === 0 && rY[0].getUTCDate() === 15, 'Yearly Jan 15: is Jan 15');
console.log('  Occurrences:', rY.map(iso).join(', '));

// Yearly 2nd Monday of January
const rY2Mo = expand('FREQ=YEARLY;INTERVAL=1;BYMONTH=1;BYDAY=MO;BYSETPOS=2', dtstart(0, 12));
assert(rY2Mo.length >= 1, 'Yearly 2nd Monday Jan: at least one');
assert(rY2Mo[0].getUTCDay() === 1 && rY2Mo[0].getUTCMonth() === 0, 'Yearly 2nd Monday Jan: is Monday in January');
console.log('  Occurrences:', rY2Mo.map(iso).join(', '));

// Every 2 months on day 15
const r2m = expand('FREQ=MONTHLY;INTERVAL=2;BYMONTHDAY=15', dtstart(0, 15));
assert(r2m.length >= 3, 'Every 2 months on 15th: Jan, Mar, May in range');
console.log('  Occurrences:', r2m.map(iso).join(', '));

if (failed > 0) {
  console.error('\n' + failed + ' assertion(s) failed');
  process.exit(1);
}
console.log('\nAll recurrence tests passed.');
