<script setup lang="ts">
const optionsStore = useOptionsStore()
const { isDark, profile, others, kkSettings } = storeToRefs(optionsStore)

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

// 用 computed writable 确保嵌套属性响应式写入
const explanationLang = computed({
  get: () => kkSettings.value.explanationLang,
  set: (v) => { kkSettings.value = { ...kkSettings.value, explanationLang: v } },
})
const furigana = computed({
  get: () => kkSettings.value.furigana,
  set: (v) => { kkSettings.value = { ...kkSettings.value, furigana: v } },
})
const furiganaMode = computed({
  get: () => kkSettings.value.furiganaMode,
  set: (v) => { kkSettings.value = { ...kkSettings.value, furiganaMode: v } },
})
const showCacheIndicator = computed({
  get: () => kkSettings.value.showCacheIndicator,
  set: (v) => { kkSettings.value = { ...kkSettings.value, showCacheIndicator: v } },
})
</script>

<template>
  <div
    class="max-w-xl w-full mx-auto rounded-xl md:my-12 p-4 md:p-8 md:border border-base-200 md:shadow-lg bg-base-100"
  >
    <RouterLinkUp />

    <h1>Options</h1>
    <p>
      You can configure various options related to this extension here. These
      options/ settings are peristent, available in all contexts, implemented
      using Pinia and useBrowserStorage composable.
    </p>

    <h3>User Interface</h3>
    <p>Change application interface settings.</p>

    <UForm class="space-y-4">
      <UFormField label="Theme">
        <USwitch v-model="isDark" />
      </UFormField>

      <h3>Profile</h3>
      <p>Change your name and age.</p>

      <UFormField label="Name">
        <UInput v-model="profile.name"></UInput>
      </UFormField>

      <UFormField label="Age">
        <UInput v-model="profile.age"></UInput>
      </UFormField>

      <h3>Others</h3>
      <p>Some other settings related to extension usage.</p>

      <UFormField label="Awesome Feature">
        <USwitch v-model="others.awesome" />
      </UFormField>

      <UFormField label="Counter">
        <UInput
          v-model="others.counter"
          type="number"
        ></UInput>
      </UFormField>

      <h3>KakuYaku 设置</h3>
      <p>日语解析插件相关设置。</p>

      <UFormField label="语法解释语言" description="AI 语法解析和翻译将使用此语言输出">
        <select v-model="explanationLang" class="w-full rounded-md border border-base-300 bg-base-100 px-3 py-2 text-sm">
          <option v-for="opt in LANG_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
      </UFormField>

      <UFormField label="振り仮名 (Furigana)" description="在高亮词上方显示读音">
        <USwitch v-model="furigana" />
      </UFormField>

      <UFormField v-if="furigana" label="振り仮名表示モード" description="选择何时显示振り仮名">
        <select v-model="furiganaMode" class="w-full rounded-md border border-base-300 bg-base-100 px-3 py-2 text-sm">
          <option v-for="opt in FURIGANA_MODE_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
      </UFormField>

      <UFormField label="缓存指示器" description="已缓存 LLM 结果的段落显示左侧蓝色边框">
        <USwitch v-model="showCacheIndicator" />
      </UFormField>
    </UForm>
  </div>
</template>
