<script setup lang="ts">
import type { VocabEntry } from '~/stores/options.store'

const optionsStore = useOptionsStore()
const { vocabulary } = storeToRefs(optionsStore)

type FilterTab = '全部' | '新词' | '学习中' | '已掌握'
const activeTab = ref<FilterTab>('全部')

const tabs: FilterTab[] = ['全部', '新词', '学习中', '已掌握']

const statusMap: Record<FilterTab, VocabEntry['status'] | null> = {
  '全部': null,
  '新词': 'new',
  '学习中': 'learning',
  '已掌握': 'known',
}

const filtered = computed(() => {
  const s = statusMap[activeTab.value]
  if (!s) return vocabulary.value
  return vocabulary.value.filter(v => v.status === s)
})

const statusLabel: Record<VocabEntry['status'], string> = {
  new: '新词',
  learning: '学习中',
  known: '已掌握',
}

const statusColor: Record<VocabEntry['status'], string> = {
  new: 'color:#f38ba8;background:rgba(243,139,168,0.15)',
  learning: 'color:#fab387;background:rgba(250,179,135,0.15)',
  known: 'color:#a6e3a1;background:rgba(166,227,161,0.15)',
}

const nextStatus: Record<VocabEntry['status'], VocabEntry['status']> = {
  new: 'learning',
  learning: 'known',
  known: 'new',
}

function cycleStatus(entry: VocabEntry) {
  entry.status = nextStatus[entry.status]
  entry.reviewCount = (entry.reviewCount || 0) + 1
}

function deleteEntry(id: string) {
  vocabulary.value = vocabulary.value.filter(v => v.id !== id)
}
</script>

<template>
  <div style="padding:12px;font-family:sans-serif;color:#cdd6f4;background:#1e1e2e;min-height:100vh">
    <h2 style="margin:0 0 12px;font-size:16px;font-weight:600">生词本</h2>

    <!-- Filter tabs -->
    <div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap">
      <button
        v-for="tab in tabs"
        :key="tab"
        :style="`background:${activeTab===tab ? '#313244' : 'transparent'};border:1px solid ${activeTab===tab ? '#89b4fa' : 'rgba(255,255,255,0.12)'};color:${activeTab===tab ? '#89b4fa' : '#a6adc8'};padding:4px 10px;border-radius:20px;cursor:pointer;font-size:12px`"
        @click="activeTab = tab"
      >
        {{ tab }}
        <span v-if="tab === '全部'" style="margin-left:4px;font-size:11px;opacity:0.7">{{ vocabulary.length }}</span>
        <span v-else style="margin-left:4px;font-size:11px;opacity:0.7">{{ vocabulary.filter(v => v.status === statusMap[tab]).length }}</span>
      </button>
    </div>

    <!-- Empty state -->
    <div v-if="filtered.length === 0" style="text-align:center;padding:40px 16px;color:#6c7086">
      <div style="font-size:32px;margin-bottom:8px">📖</div>
      <div style="font-size:14px">暂无单词</div>
      <div style="font-size:12px;margin-top:4px">点击弹窗中的「＋ 生词本」保存单词</div>
    </div>

    <!-- Word cards -->
    <div v-for="entry in filtered" :key="entry.id" style="background:#313244;border-radius:10px;padding:12px;margin-bottom:10px;border:1px solid rgba(255,255,255,0.08)">
      <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:6px">
        <span style="font-size:18px;font-weight:bold">{{ entry.surface }}</span>
        <span v-if="entry.reading && entry.reading !== entry.surface" style="color:#89b4fa;font-size:13px">{{ entry.reading }}</span>
        <span v-if="entry.jlpt" style="font-size:10px;color:#f38ba8;background:rgba(243,139,168,0.15);padding:1px 6px;border-radius:8px;margin-left:auto">{{ entry.jlpt }}</span>
      </div>

      <div v-if="entry.meanings && entry.meanings.length" style="font-size:12px;color:#a6adc8;margin-bottom:8px;line-height:1.6">
        {{ entry.meanings.slice(0, 3).join('・') }}
      </div>

      <div style="display:flex;align-items:center;gap:6px">
        <button
          :style="`font-size:11px;padding:2px 8px;border-radius:10px;border:none;cursor:pointer;${statusColor[entry.status]}`"
          :title="'点击切换状态'"
          @click="cycleStatus(entry)"
        >
          {{ statusLabel[entry.status] }}
        </button>
        <span style="font-size:11px;color:#585b70;margin-left:2px">复习 {{ entry.reviewCount }} 次</span>
        <button
          style="margin-left:auto;background:none;border:none;color:#585b70;cursor:pointer;font-size:14px;padding:2px 4px"
          title="删除"
          @click="deleteEntry(entry.id)"
        >
          ✕
        </button>
      </div>
    </div>
  </div>
</template>
