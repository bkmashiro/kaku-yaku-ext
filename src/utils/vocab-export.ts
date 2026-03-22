import type { VocabEntry } from 'src/stores/options.store'
import { getEntryJlptLevel, matchesJlptFilter, type JlptFilterOption } from 'src/utils/jlpt'

export type ExportFormat = 'csv' | 'anki'
export type StatusFilter = 'All' | 'new' | 'learning' | 'known'

export const STATUS_FILTER_OPTIONS: StatusFilter[] = ['All', 'new', 'learning', 'known']

export const STATUS_LABELS: Record<StatusFilter, string> = {
  All: 'All',
  new: 'New',
  learning: 'Learning',
  known: 'Known',
}

export interface ExportOptions {
  jlptFilter: JlptFilterOption
  statusFilter: StatusFilter
  format: ExportFormat
}

function formatDate(timestamp?: number): string {
  if (!timestamp)
    return ''
  return new Date(timestamp).toISOString().slice(0, 10)
}

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n'))
    return `"${value.replace(/"/g, '""')}"`
  return value
}

export function filterEntries(entries: VocabEntry[], options: Pick<ExportOptions, 'jlptFilter' | 'statusFilter'>): VocabEntry[] {
  return entries.filter((entry) => {
    const jlptOk = matchesJlptFilter(entry, options.jlptFilter)
    const statusOk = options.statusFilter === 'All' || entry.status === options.statusFilter
    return jlptOk && statusOk
  })
}

export function exportToCsv(entries: VocabEntry[]): string {
  const header = ['Word', 'Reading', 'Meanings', 'JLPT', 'Status', 'Added Date']
  const rows = entries.map(entry => [
    entry.surface,
    entry.reading ?? '',
    (entry.meanings ?? []).join(' | '),
    getEntryJlptLevel(entry) || '',
    entry.status ?? 'new',
    formatDate(entry.addedAt),
  ].map(escapeCsvField).join(','))

  return [header.join(','), ...rows].join('\n')
}

/**
 * Export as Anki-importable TSV (tab-separated).
 * Format: Front [tab] Back [tab] Tags
 * Front: word (+ reading if different)
 * Back: meanings
 * Tags: jlpt:N5 status:known (etc.)
 */
export function exportToAnki(entries: VocabEntry[]): string {
  const lines = entries.map((entry) => {
    const front = entry.reading && entry.reading !== entry.surface
      ? `${entry.surface}[${entry.reading}]`
      : entry.surface

    const back = (entry.meanings ?? []).join('<br>')

    const tags: string[] = []
    const jlpt = getEntryJlptLevel(entry)
    if (jlpt)
      tags.push(`jlpt:${jlpt}`)
    if (entry.status)
      tags.push(`status:${entry.status}`)
    tags.push('kaku-yaku')

    return [front, back, tags.join(' ')].join('\t')
  })

  // Anki comment header to set field separator
  return `#separator:tab\n#html:true\n#notetype:Basic\n#deck:Kaku-Yaku\n${lines.join('\n')}`
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function triggerExport(entries: VocabEntry[], options: ExportOptions): void {
  const filtered = filterEntries(entries, options)
  const dateStr = new Date().toISOString().slice(0, 10)

  if (options.format === 'csv') {
    const content = exportToCsv(filtered)
    downloadFile(content, `kaku-yaku-vocab-${dateStr}.csv`, 'text/csv;charset=utf-8;')
  }
  else {
    const content = exportToAnki(filtered)
    downloadFile(content, `kaku-yaku-anki-${dateStr}.txt`, 'text/plain;charset=utf-8;')
  }
}
