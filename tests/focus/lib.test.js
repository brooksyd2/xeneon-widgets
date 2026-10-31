const test = require('node:test');
const assert = require('node:assert/strict');
const { noteLabel, parseTask, flattenDataview, tasksFromDataview, findTaskLine, completeLine } = require('../../widgets/focus/lib.js');

const today = new Date(2026, 9, 31);
test('noteLabel formats long-form daily notes', () => {
  assert.equal(noteLabel('Daily Notes/2026/10/07 October 2026.md', today), 'Daily Notes · 7 Oct');
  assert.equal(noteLabel('Daily Notes/2026/10/2026-10-07.md', today), '10 · 7 Oct');
  assert.equal(noteLabel('Projects/AI Gateway.md', today), 'AI Gateway');
});
test('parseTask resolves people in nested people folders', () => {
  const t = parseTask('- [ ] Cost model [[Matt Kaley-Burton]]/[[Dave Sansum]] ⏫ 📅 2026-10-20', 'a.md', 3,
    { 'matt kaley-burton': true, 'dave sansum': true }, today, 'Entities/People');
  assert.deepEqual(t.people, ['Matt K-B', 'Dave S']);
  assert.equal(t.priority, 'high'); assert.equal(t.overdue, true); assert.equal(t.overdueDays, 11);
});
test('flattenDataview lifts nested children', () => {
  const v = [{ text: 'parent ⏫', line: 1, path: 'a.md', children: [{ text: 'child 🔼', line: 2, path: 'a.md', children: [] }] }];
  assert.deepEqual(flattenDataview(v).map(x => x.line), [1, 2]);
});
test('tasksFromDataview keeps high, medium and overdue only, sorted', () => {
  const v = [
    { text: 'normal no date', line: 1, path: 'a.md' },
    { text: 'medium 🔼', line: 2, path: 'a.md' },
    { text: 'overdue plain 📅 2026-10-01', line: 3, path: 'a.md' },
    { text: 'high ⏫ 📅 2026-11-05', line: 4, path: 'a.md' },
  ];
  assert.deepEqual(tasksFromDataview(v, {}, today, 'Entities/People').map(t => t.line), [3, 4, 2]);
});
test('findTaskLine', () => {
  const lines = ['# T', '- [ ] alpha ⏫', '  * [ ] beta 🔼  ', '- [ ] dup', '- [ ] dup'];
  assert.equal(findTaskLine(lines, 1, 'alpha ⏫'), 1);
  assert.equal(findTaskLine(lines, 2, 'beta 🔼'), 2);
  assert.equal(findTaskLine(['new', ...lines], 1, 'alpha ⏫'), 2);
  assert.equal(findTaskLine(lines, 3, 'dup'), 3);
  assert.equal(findTaskLine(['x', ...lines], 3, 'dup'), -1);
  assert.equal(findTaskLine(lines, 1, 'gone'), -1);
  assert.equal(findTaskLine(['- [x] alpha ⏫'], 0, 'alpha ⏫'), -1);
});
test('completeLine', () => {
  assert.equal(completeLine('- [ ] a ⏫ 📅 2026-10-20', '2026-10-31'), '- [x] a ⏫ 📅 2026-10-20 ✅ 2026-10-31');
  assert.equal(completeLine('    + [ ] b  ', '2026-10-31'), '    + [x] b ✅ 2026-10-31');
  assert.equal(completeLine('- [ ] c 🔼 ^abc-1', '2026-10-31'), '- [x] c 🔼 ✅ 2026-10-31 ^abc-1');
});
