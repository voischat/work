import assert from 'node:assert/strict'
import test from 'node:test'
import { rewriteAuthors } from './authors.ts'

void test('rewriteAuthors maps retired handles and names to kvoon9', () => {
  const source = '- fix by @kvoon3\n- chore by Kevin Kwong\n- by @kvoon9'
  assert.equal(rewriteAuthors(source), '- fix by @kvoon9\n- chore by kvoon9\n- by @kvoon9')
})
