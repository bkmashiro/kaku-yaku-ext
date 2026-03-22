<script setup lang="ts">
import { parseVocabularyCsv, type ParsedCsvRow } from 'src/utils/vocab-import'

const optionsStore = useOptionsStore()
const { isDark, kkSettings, vocabulary } = storeToRefs(optionsStore)

const LANG_OPTIONS = [
  { value: 'English', label: 'English' },
  { value: '中文', label: '中文 (Chinese)' },
  { value: '日本語', label: '日本語 (Japanese)' },
  { value: '한국어', label: '한국어 (Korean)' },
  { value: 'Français', label: 'Français (French)' },
  { value: 'Deutsch', label: 'Deutsch (German)' },
  { value: 'Español', label: 'Español (Spanish)' },
]

const FURIGANA_MODE_OPTIONS = [
  { value: 'hover', label: '悬停显示 (Hover)' },
  { value: 'always', label: '始终显示 (Always)' },
]

const fileInput = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)
const selectedFileName = ref('')
const importError = ref('')
const importMessage = ref('')
const parsedRows = ref<ParsedCsvRow[]>([])
const skippedEmptyRows = ref(0)

const previewRows = computed(() => parsedRows.value.slice(0, 5))

const explanationLang = computed({
  get: () => kkSettings.value.explanationLang,
  set: v => { kkSettings.value = { ...kkSettings.value, explanationLang: v } },
})

const furigana = computed({
  get: () => kkSettings.value.furigana,
  set: v => { kkSettings.value = { ...kkSettings.value, furigana: v } },
})

const furiganaMode = computed({
  get: () => kkSettings.value.furiganaMode,
  set: v => { kkSettings.value = { ...kkSettings.value, furiganaMode: v } },
})

const showCacheIndicator = computed({
  get: () => kkSettings.value.showCacheIndicator,
  set: v => { kkSettings.value = { ...kkSettings.value, showCacheIndicator: v } },
})

async function loadCsvFile(file: File) {
  selectedFileName.value = file.name
  importError.value = ''
  importMessage.value = ''

  try {
    const text = await file.text()
    const result = parseVocabularyCsv(text)
    parsedRows.value = result.rows
    skippedEmptyRows.value = result.skippedEmptyRows

    if (!result.rows.length) {
      importError.value = 'CSV 中没有可导入的数据行。'
    }
  } catch (error) {
    parsedRows.value = []
    skippedEmptyRows.value = 0
    importError.value = error instanceof Error ? error.message : 'CSV 解析失败，请检查文件格式。'
  }
}

function resetSelectedFile() {
  selectedFileName.value = ''
  parsedRows.value = []
  skippedEmptyRows.value = 0
  importError.value = ''
  importMessage.value = ''
  if (fileInput.value)
    fileInput.value.value = ''
}

function openFilePicker() {
  fileInput.value?.click()
}

function onFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file)
    void loadCsvFile(file)
}

function onDrop(event: DragEvent) {
  isDragging.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file)
    void loadCsvFile(file)
}

function importRows() {
  if (!parsedRows.value.length)
    return

  const result = optionsStore.importVocabulary(parsedRows.value)
  importMessage.value = `已导入 ${result.importedCount} 条，跳过重复 ${result.duplicateCount} 条。`
  importError.value = ''
  selectedFileName.value = ''
  parsedRows.value = []
  skippedEmptyRows.value = 0
  if (fileInput.value)
    fileInput.value.value = ''
}
</script>

<template>
  <div class="mx-auto flex w-full max-w-4xl flex-col gap-8 rounded-2xl border border-base-200 bg-base-100 p-4 shadow-sm md:my-10 md:p-8">
    <RouterLinkUp />

    <section class="space-y-3">
      <h1 class="text-3xl font-semibold">KakuYaku 设置</h1>
      <p class="text-sm text-base-content/70">
        管理语法解释语言、显示选项，以及词汇表的批量导入。
      </p>
    </section>

    <section class="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div class="space-y-4 rounded-2xl border border-base-200 bg-base-200/30 p-5">
        <div>
          <h2 class="text-xl font-semibold">界面与解释</h2>
          <p class="mt-1 text-sm text-base-content/70">
            这些设置会同步到扩展各个入口页。
          </p>
        </div>

        <UForm :state="{}" class="space-y-4">
          <UFormField label="Theme">
            <USwitch v-model="isDark" />
          </UFormField>

          <UFormField label="语法解释语言" description="AI 语法解析和翻译将使用此语言输出">
            <select v-model="explanationLang" class="w-full rounded-xl border border-base-300 bg-base-100 px-3 py-2 text-sm">
              <option v-for="opt in LANG_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </UFormField>

          <UFormField label="振り仮名 (Furigana)" description="在高亮词上方显示读音">
            <USwitch v-model="furigana" />
          </UFormField>

          <UFormField v-if="furigana" label="振り仮名表示モード" description="选择何时显示振り仮名">
            <select v-model="furiganaMode" class="w-full rounded-xl border border-base-300 bg-base-100 px-3 py-2 text-sm">
              <option v-for="opt in FURIGANA_MODE_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </UFormField>

          <UFormField label="缓存指示器" description="已缓存 LLM 结果的段落显示左侧蓝色边框">
            <USwitch v-model="showCacheIndicator" />
          </UFormField>
        </UForm>
      </div>

      <div class="space-y-4 rounded-2xl border border-base-200 bg-base-200/30 p-5">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h2 class="text-xl font-semibold">批量导入</h2>
            <p class="mt-1 text-sm text-base-content/70">
              拖拽 CSV 文件，或点击选择文件。格式为 <code>word,reading,meaning</code>。
            </p>
          </div>
          <div class="rounded-full border border-base-300 px-3 py-1 text-xs text-base-content/70">
            当前词汇 {{ vocabulary.length }}
          </div>
        </div>

        <div
          class="rounded-2xl border-2 border-dashed px-5 py-8 text-center transition"
          :class="isDragging ? 'border-primary bg-primary/10' : 'border-base-300 bg-base-100'"
          @dragenter.prevent="isDragging = true"
          @dragover.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @drop.prevent="onDrop"
        >
          <div class="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-base-200 text-2xl">
            CSV
          </div>
          <p class="text-sm font-medium">拖拽文件到这里</p>
          <p class="mt-1 text-xs text-base-content/60">支持含表头或无表头的 UTF-8 CSV</p>
          <button
            type="button"
            class="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-content"
            @click="openFilePicker"
          >
            选择 CSV 文件
          </button>
          <input
            ref="fileInput"
            class="hidden"
            type="file"
            accept=".csv,text/csv"
            @change="onFileChange"
          >
        </div>

        <div v-if="selectedFileName" class="flex items-center justify-between gap-3 rounded-xl border border-base-200 bg-base-100 px-4 py-3 text-sm">
          <div class="min-w-0">
            <div class="truncate font-medium">{{ selectedFileName }}</div>
            <div class="text-xs text-base-content/60">
              {{ parsedRows.length }} 行可导入<span v-if="skippedEmptyRows">，跳过空行 {{ skippedEmptyRows }}</span>
            </div>
          </div>
          <button type="button" class="text-xs text-base-content/60 underline" @click="resetSelectedFile">
            清除
          </button>
        </div>

        <p v-if="importError" class="rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
          {{ importError }}
        </p>

        <p v-if="importMessage" class="rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          {{ importMessage }}
        </p>

        <div v-if="previewRows.length" class="space-y-3">
          <div class="flex items-end justify-between gap-4">
            <div>
              <h3 class="text-base font-semibold">预览前 5 行</h3>
              <p class="text-xs text-base-content/60">确认字段映射无误后再导入。</p>
            </div>
            <button
              type="button"
              class="rounded-xl bg-secondary px-4 py-2 text-sm font-medium text-secondary-content disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!parsedRows.length"
              @click="importRows"
            >
              确认导入
            </button>
          </div>

          <div class="overflow-hidden rounded-2xl border border-base-200">
            <table class="min-w-full divide-y divide-base-200 text-sm">
              <thead class="bg-base-200/70 text-left text-xs uppercase tracking-wide text-base-content/60">
                <tr>
                  <th class="px-4 py-3">Word</th>
                  <th class="px-4 py-3">Reading</th>
                  <th class="px-4 py-3">Meaning</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-base-200 bg-base-100">
                <tr v-for="(row, index) in previewRows" :key="`${row.word}-${index}`">
                  <td class="px-4 py-3 font-medium">{{ row.word }}</td>
                  <td class="px-4 py-3 text-base-content/70">{{ row.reading || '—' }}</td>
                  <td class="px-4 py-3 text-base-content/80">{{ row.meaning }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
