import type { ParsedCsvRow } from 'src/utils/vocab-import'
import { mergeImportedVocabulary } from 'src/utils/vocab-import'

export interface VocabEntry {
  id: string
  surface: string
  reading: string
  dictForm: string
  pos: string
  meanings: string[]
  jlpt: string
  jlpt_level?: string
  addedAt: number
  example: string
  exampleTrans: string
  status: 'new' | 'learning' | 'known'
  reviewCount: number
  review_count?: number
  last_reviewed?: number
  next_review?: number
  interval_days?: number
}

export const useOptionsStore = defineStore("options", () => {
  const { isDark, toggleDark } = useTheme()

  const { data: profile } = useBrowserSyncStorage<{
    name: string
    age: number
  }>("profile", {
    name: "Mario",
    age: 24,
  })

  const { data: others } = useBrowserLocalStorage<{
    awesome: boolean
    counter: number
  }>("options", {
    awesome: true,
    counter: 0,
  })

  const { data: kkSettings } = useBrowserSyncStorage<{
    explanationLang: string
    furigana: boolean
    furiganaMode: 'hover' | 'always'
    showCacheIndicator: boolean
  }>("kakuyaku-settings", {
    explanationLang: "English",
    furigana: false,
    furiganaMode: "hover",
    showCacheIndicator: true,
  })

  const { data: vocabulary } = useBrowserLocalStorage<VocabEntry[]>("kakuyaku-vocab", [])

  const { data: lookupHistory } = useBrowserLocalStorage<Record<string, number>>("kakuyaku-lookup-history", {} as Record<string, number>)

  function importVocabulary(rows: ParsedCsvRow[]) {
    const result = mergeImportedVocabulary(vocabulary.value, rows)
    vocabulary.value = result.merged
    return result
  }

  return {
    isDark,
    toggleDark,
    profile,
    others,
    kkSettings,
    vocabulary,
    lookupHistory,
    importVocabulary,
  }
})
