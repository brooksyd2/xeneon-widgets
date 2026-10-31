const { test } = require('node:test');
const assert = require('node:assert/strict');
const D = require('../../shared/dates.js');

test('iso uses local date', () => assert.equal(D.iso(new Date(2026, 9, 31, 0, 30)), '2026-10-31'));
test('daysBetween', () => assert.equal(D.daysBetween('2026-10-09', '2026-10-31'), 22));
test('parseIso rejects junk', () => assert.equal(D.parseIso('nope'), null));
test('fmtDate omits current year', () => assert.equal(D.fmtDate('2026-10-07', new Date(2026, 9, 31)), '7 Oct'));
