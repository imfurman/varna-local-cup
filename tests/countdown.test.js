import test from 'node:test';
import assert from 'node:assert/strict';
import { meetingTimestamp, countdownParts } from '../src/lib/countdown.js';

test('meeting uses Sofia summer and winter offsets', () => {
  const event = { date: '2026-09-13', meeting: { time: '10:00' }, timezone: 'Europe/Sofia' };
  assert.equal(meetingTimestamp(event), Date.parse('2026-09-13T07:00:00Z'));
  assert.equal(meetingTimestamp({ ...event, date: '2026-12-13' }), Date.parse('2026-12-13T08:00:00Z'));
  assert.equal(meetingTimestamp({ ...event, meeting: null }), null);
});

test('countdown rolls over units, catches up after suspension and never goes negative', () => {
  const target = Date.parse('2026-09-13T07:00:00Z');
  assert.deepEqual(countdownParts(target, target - 90061000), { started: false, days: 1, hours: 1, minutes: 1, seconds: 1 });
  assert.deepEqual(countdownParts(target, target - 1), { started: false, days: 0, hours: 0, minutes: 0, seconds: 1 });
  for (const now of [target, target + 86400000]) {
    assert.deepEqual(countdownParts(target, now), { started: true, days: 0, hours: 0, minutes: 0, seconds: 0 });
  }
});
