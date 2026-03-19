<script setup lang="ts">
const optionsStore = useOptionsStore()
const { isDark, profile, others, kakuYaku } = storeToRefs(optionsStore)

const LANG_OPTIONS = [
  { value: 'English', label: 'English' },
  { value: '中文', label: '中文 (Chinese)' },
  { value: '日本語', label: '日本語 (Japanese)' },
  { value: '한국어', label: '한국어 (Korean)' },
  { value: 'Français', label: 'Français (French)' },
  { value: 'Deutsch', label: 'Deutsch (German)' },
  { value: 'Español', label: 'Español (Spanish)' },
]
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
        <USelect
          v-model="kakuYaku.explanationLang"
          :options="LANG_OPTIONS"
          value-attribute="value"
          option-attribute="label"
        />
      </UFormField>
    </UForm>
  </div>
</template>
