export interface VocabEntry {
  id: string
  surface: string
  reading: string
  dictForm: string
  pos: string
  meanings: string[]
  jlpt: string
  addedAt: number
  example: string
  exampleTrans: string
  status: 'new' | 'learning' | 'known'
  reviewCount: number
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

  return {
    isDark,
    toggleDark,
    profile,
    others,
    kkSettings,
    vocabulary,
  }
})
