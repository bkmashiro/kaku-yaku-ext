import type { VocabEntry } from 'src/stores/options.store'

export interface ParsedCsvRow {
  word: string
  reading: string
  meaning: string
}

export interface ParsedCsvResult {
  rows: ParsedCsvRow[]
  skippedEmptyRows: number
}

const CSV_HEADERS = ['word', 'reading', 'meaning'] as const

function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      cells.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  if (inQuotes) {
    throw new Error('CSV 格式错误：存在未闭合的引号')
  }

  cells.push(current.trim())
  return cells
}

export function parseVocabularyCsv(csvText: string): ParsedCsvResult {
  const normalized = csvText.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = normalized
    .split('\n')
    .map(line => line.trim())

  const rows: ParsedCsvRow[] = []
  let skippedEmptyRows = 0
  let startIndex = 0

  if (lines[0]) {
    const firstLine = parseCsvLine(lines[0]).map(cell => cell.toLowerCase())
    const isHeader = CSV_HEADERS.every((header, index) => firstLine[index] === header)
    if (isHeader)
      startIndex = 1
  }

  for (let index = startIndex; index < lines.length; index += 1) {
    const line = lines[index]
    if (!line) {
      skippedEmptyRows += 1
      continue
    }

    const cells = parseCsvLine(line)
    if (cells.length !== 3) {
      throw new Error(`CSV 第 ${index + 1} 行格式错误：需要 3 列 word,reading,meaning`)
    }

    const [word, reading, meaning] = cells.map(cell => cell.trim())
    if (!word && !reading && !meaning) {
      skippedEmptyRows += 1
      continue
    }

    if (!word || !meaning) {
      throw new Error(`CSV 第 ${index + 1} 行缺少必填字段：word 和 meaning`)
    }

    rows.push({ word, reading, meaning })
  }

  return { rows, skippedEmptyRows }
}

function buildDedupKey(entry: Pick<VocabEntry, 'surface' | 'dictForm'>) {
  return `${entry.surface}::${entry.dictForm}`
}

export function createVocabEntryFromCsvRow(row: ParsedCsvRow): VocabEntry {
  const now = Date.now()
  return {
    id: crypto.randomUUID(),
    surface: row.word,
    reading: row.reading,
    dictForm: row.word,
    pos: '',
    meanings: [row.meaning],
    jlpt: '',
    addedAt: now,
    example: '',
    exampleTrans: '',
    status: 'new',
    reviewCount: 0,
    review_count: 0,
    last_reviewed: undefined,
    next_review: undefined,
    interval_days: undefined,
  }
}

export function mergeImportedVocabulary(
  existing: VocabEntry[],
  importedRows: ParsedCsvRow[],
): { merged: VocabEntry[], importedCount: number, duplicateCount: number } {
  const merged = [...existing]
  const seenKeys = new Set(existing.map(entry => buildDedupKey(entry)))
  let importedCount = 0
  let duplicateCount = 0

  for (const row of importedRows) {
    const candidate = createVocabEntryFromCsvRow(row)
    const key = buildDedupKey(candidate)
    if (seenKeys.has(key)) {
      duplicateCount += 1
      continue
    }

    seenKeys.add(key)
    merged.push(candidate)
    importedCount += 1
  }

  return { merged, importedCount, duplicateCount }
}
