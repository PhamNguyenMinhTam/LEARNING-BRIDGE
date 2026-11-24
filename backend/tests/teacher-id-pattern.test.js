const assert = require('node:assert/strict');
const { test } = require('node:test');
const { compileTeacherIdPattern } = require('../src/validators/teacher-id-pattern');

test('Teacher ID matching checks only the entire code format, including exact casing and length', () => {
  for (const [pattern, code] of [
    ['^GV[0-9]{5}$', 'GV01001'], ['^[0-9]{8}$', '26560053'],
    ['^[A-Z]{2}[0-9]{4}$', 'AB0090'], ['^T_[A-Za-z0-9]{2}-[a-z]$', 'T_A2-f']
  ]) {
    const matches = compileTeacherIdPattern(pattern);
    assert.equal(matches(code), true);
    for (const item of [code + '\n', '\n' + code, code + '0', code.slice(1), null]) {
      assert.equal(matches(item), false);
    }
  }
  const matches = compileTeacherIdPattern('^GV[0-9]{5}$');
  assert.equal(matches('gv01001'), false);
  assert.equal(matches('GV０1001'), false);
});

test('rejects unsupported syntax, invalid expressions and excessive pattern size', () => {
  for (const pattern of [
    'T[0-9]{6}', '^$', '^T[0-9$', '^(a+)+$', '^(A|AA){5}$', '^.{3}$',
    '^A?A$', '^A*$', '^A+$', '^[0-9]{1,9}$', '^[^A]$', '^A\\d$',
    '^A{0}$', '^A{100}0$', '^A{101}$', '^A[0-9]{099}$', '^' + 'A'.repeat(254) + '$', null
  ]) {
    assert.throws(() => compileTeacherIdPattern(pattern), { code: 'INVALID_TEACHER_ID_PATTERN' });
  }
});
