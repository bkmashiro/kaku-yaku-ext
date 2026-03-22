import test from 'node:test'
import assert from 'node:assert/strict'

import { getEntryJlptLevel, matchesJlptFilter, normalizeJlptLevel } from './jlpt'

test('normalizeJlptLevel normalizes JLPT-prefixed values', () => {
  assert.equal(normalizeJlptLevel('JLPT N3'), 'N3')
  assert.equal(normalizeJlptLevel(' n5 '), 'N5')
})

test('getEntryJlptLevel supports jlpt_level fallback', () => {
  assert.equal(getEntryJlptLevel({ jlpt: '', jlpt_level: 'N2' }), 'N2')
  assert.equal(getEntryJlptLevel({ jlpt: 'JLPT N4', jlpt_level: '' }), 'N4')
})

test('matchesJlptFilter handles All and exact level matches', () => {
  assert.equal(matchesJlptFilter({ jlpt: 'N1', jlpt_level: undefined }, 'All'), true)
  assert.equal(matchesJlptFilter({ jlpt: 'N1', jlpt_level: undefined }, 'N1'), true)
  assert.equal(matchesJlptFilter({ jlpt: 'N1', jlpt_level: undefined }, 'N2'), false)
})
