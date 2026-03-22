import test from 'node:test'
import assert from 'node:assert/strict'

import { createVocabEntryFromCsvRow, mergeImportedVocabulary, parseVocabularyCsv } from './vocab-import'

test('parseVocabularyCsv parses headered CSV and skips empty lines', () => {
  const csv = 'word,reading,meaning\n食べる,たべる,to eat\n\n見る,みる,to see'
  const result = parseVocabularyCsv(csv)

  assert.equal(result.rows.length, 2)
  assert.equal(result.skippedEmptyRows, 1)
  assert.deepEqual(result.rows[0], {
    word: '食べる',
    reading: 'たべる',
    meaning: 'to eat',
  })
})

test('parseVocabularyCsv supports quoted commas', () => {
  const csv = '"言う","いう","to say, to tell"'
  const result = parseVocabularyCsv(csv)

  assert.equal(result.rows[0]?.meaning, 'to say, to tell')
})

test('parseVocabularyCsv rejects incomplete rows', () => {
  assert.throws(
    () => parseVocabularyCsv('word,reading,meaning\n食べる,,'),
    /缺少必填字段/,
  )
})

test('mergeImportedVocabulary skips duplicates using surface and dictForm', () => {
  const existing = [createVocabEntryFromCsvRow({
    word: '食べる',
    reading: 'たべる',
    meaning: 'to eat',
  })]

  const result = mergeImportedVocabulary(existing, [
    { word: '食べる', reading: 'たべる', meaning: 'to eat' },
    { word: '見る', reading: 'みる', meaning: 'to see' },
  ])

  assert.equal(result.importedCount, 1)
  assert.equal(result.duplicateCount, 1)
  assert.equal(result.merged.length, 2)
})
