import type { VocabEntry } from 'src/stores/options.store'

export const JLPT_FILTER_OPTIONS = ['All', 'N5', 'N4', 'N3', 'N2', 'N1'] as const

export type JlptFilterOption = typeof JLPT_FILTER_OPTIONS[number]

export function normalizeJlptLevel(value?: string | null): JlptFilterOption | '' {
  if (!value)
    return ''

  const normalized = value.trim().toUpperCase().replace(/^JLPT\s*/i, '')
  return JLPT_FILTER_OPTIONS.includes(normalized as JlptFilterOption)
    ? normalized as JlptFilterOption
    : ''
}

export function getEntryJlptLevel(entry: Pick<VocabEntry, 'jlpt' | 'jlpt_level'>): JlptFilterOption | '' {
  return normalizeJlptLevel(entry.jlpt_level || entry.jlpt)
}

export function matchesJlptFilter(
  entry: Pick<VocabEntry, 'jlpt' | 'jlpt_level'>,
  filter: JlptFilterOption,
): boolean {
  if (filter === 'All')
    return true

  return getEntryJlptLevel(entry) === filter
}
