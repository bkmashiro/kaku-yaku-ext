<script setup lang="ts">
import type { VocabEntry } from '~/stores/options.store'

const optionsStore = useOptionsStore()
const { vocabulary, lookupHistory } = storeToRefs(optionsStore)

type FilterTab = '全部' | '新词' | '学习中' | '已掌握'
const activeTab = ref<FilterTab>('全部')

const tabs: FilterTab[] = ['全部', '新词', '学习中', '已掌握']

const statusMap: Record<FilterTab, VocabEntry['status'] | null> = {
  '全部': null,
  '新词': 'new',
  '学习中': 'learning',
  '已掌握': 'known',
}

type SortOption = 'addedAt' | 'lookupCount' | 'status'
const sortBy = ref<SortOption>('addedAt')

const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'addedAt', label: '按添加时间' },
  { value: 'lookupCount', label: '按查词频率' },
  { value: 'status', label: '按学习状态' },
]

const statusOrder: Record<VocabEntry['status'], number> = {
  new: 0,
  learning: 1,
  known: 2,
}

const filtered = computed(() => {
  const s = statusMap[activeTab.value]
  let list = s ? vocabulary.value.filter(v => v.status === s) : [...vocabulary.value]
  const history = lookupHistory.value || {}
  if (sortBy.value === 'lookupCount') {
    list = list.slice().sort((a, b) => (history[b.surface] || 0) - (history[a.surface] || 0))
  } else if (sortBy.value === 'status') {
    list = list.slice().sort((a, b) => statusOrder[a.status] - statusOrder[b.status])
  } else {
    list = list.slice().sort((a, b) => b.addedAt - a.addedAt)
  }
  return list
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

function exportTSV() {
  const headers = ['surface', 'reading', 'meanings', 'example', 'exampleTrans', 'jlpt', 'status', 'addedAt']
  const rows = vocabulary.value.map(e => [
    e.surface,
    e.reading,
    (e.meanings || []).join('|'),
    e.example || '',
    e.exampleTrans || '',
    e.jlpt || '',
    e.status,
    new Date(e.addedAt).toISOString(),
  ].map(v => String(v).replace(/\t/g, ' ')).join('\t'))
  const tsv = [headers.join('\t'), ...rows].join('\n')
  const blob = new Blob([tsv], { type: 'text/tab-separated-values;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const date = new Date()
  const yyyymmdd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
  const a = document.createElement('a')
  a.href = url
  a.download = `kaku-yaku-vocab-${yyyymmdd}.tsv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Flashcard review mode ────────────────────────────────────────────
const reviewMode = ref(false)
const reviewQueue = ref<VocabEntry[]>([])
const reviewIndex = ref(0)
const cardFlipped = ref(false)

const reviewCard = computed<VocabEntry | null>(() =>
  reviewQueue.value[reviewIndex.value] ?? null,
)
const reviewDone = computed(() => reviewIndex.value >= reviewQueue.value.length)

function startReview() {
  const pool = vocabulary.value.filter(v => v.status === 'new' || v.status === 'learning')
  // Shuffle
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  reviewQueue.value = shuffled
  reviewIndex.value = 0
  cardFlipped.value = false
  reviewMode.value = true
}

function exitReview() {
  reviewMode.value = false
}

function flipCard() {
  cardFlipped.value = true
}

function markKnown() {
  const card = reviewCard.value
  if (!card) return
  const entry = vocabulary.value.find(v => v.id === card.id)
  if (entry) {
    entry.status = entry.status === 'new' ? 'learning' : 'known'
    entry.reviewCount = (entry.reviewCount || 0) + 1
  }
  nextCard()
}

function markUnknown() {
  // Status unchanged, no reviewCount increment
  nextCard()
}

function nextCard() {
  reviewIndex.value += 1
  cardFlipped.value = false
}
</script>

<template>
  <div style="padding:12px;font-family:sans-serif;color:#cdd6f4;background:#1e1e2e;min-height:100vh">

    <!-- ── Review Mode View ── -->
    <div v-if="reviewMode">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <h2 style="margin:0;font-size:16px;font-weight:600">📚 复习模式</h2>
        <button
          style="background:none;border:none;color:#6c7086;cursor:pointer;font-size:18px;padding:2px 4px"
          title="退出复习"
          @click="exitReview"
        >
          ✕
        </button>
      </div>

      <!-- Progress bar -->
      <div style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;font-size:11px;color:#6c7086;margin-bottom:4px">
          <span>{{ Math.min(reviewIndex, reviewQueue.length) }} / {{ reviewQueue.length }}</span>
          <span>{{ reviewQueue.filter(v => v.status === 'new').length }} 新词 · {{ reviewQueue.filter(v => v.status === 'learning').length }} 学习中</span>
        </div>
        <div style="height:3px;background:rgba(255,255,255,0.1);border-radius:2px">
          <div
            :style="`height:100%;border-radius:2px;background:#89b4fa;width:${reviewQueue.length ? (Math.min(reviewIndex, reviewQueue.length) / reviewQueue.length) * 100 : 0}%;transition:width 0.3s`"
          />
        </div>
      </div>

      <!-- Done state -->
      <div v-if="reviewDone" style="text-align:center;padding:60px 16px">
        <div style="font-size:48px;margin-bottom:16px">🎉</div>
        <div style="font-size:18px;font-weight:600;margin-bottom:8px">今日复习完成！</div>
        <div style="font-size:13px;color:#6c7086;margin-bottom:24px">已复习 {{ reviewQueue.length }} 张卡片</div>
        <button
          style="background:rgba(137,180,250,0.15);border:1px solid #89b4fa;color:#89b4fa;padding:8px 24px;border-radius:20px;cursor:pointer;font-size:13px"
          @click="startReview"
        >
          🔄 再来一轮
        </button>
      </div>

      <!-- Card -->
      <div v-else-if="reviewCard">
        <div style="background:#313244;border-radius:14px;padding:28px 20px;border:1px solid rgba(255,255,255,0.08);text-align:center;min-height:240px;display:flex;flex-direction:column;align-items:center;justify-content:center">
          <!-- Front: always visible -->
          <div style="font-size:48px;font-weight:bold;margin-bottom:12px;letter-spacing:2px">
            {{ reviewCard.surface }}
          </div>
          <div v-if="reviewCard.jlpt" style="font-size:11px;color:#f38ba8;background:rgba(243,139,168,0.15);padding:2px 10px;border-radius:10px;margin-bottom:16px">
            {{ reviewCard.jlpt }}
          </div>

          <!-- Back: after flip -->
          <template v-if="cardFlipped">
            <div style="width:100%;border-top:1px solid rgba(255,255,255,0.08);margin:8px 0 16px" />
            <div v-if="reviewCard.reading && reviewCard.reading !== reviewCard.surface" style="font-size:20px;color:#89b4fa;margin-bottom:12px">
              {{ reviewCard.reading }}
            </div>
            <div v-if="reviewCard.meanings && reviewCard.meanings.length" style="font-size:13px;color:#a6adc8;margin-bottom:12px;line-height:1.7;max-width:260px">
              {{ reviewCard.meanings.join(' · ') }}
            </div>
            <div v-if="reviewCard.example" style="font-size:12px;color:#6c7086;font-style:italic;margin-bottom:4px;max-width:260px">
              {{ reviewCard.example }}
            </div>
            <div v-if="reviewCard.exampleTrans" style="font-size:11px;color:#585b70;max-width:260px">
              {{ reviewCard.exampleTrans }}
            </div>
          </template>

          <!-- Flip button -->
          <button
            v-if="!cardFlipped"
            style="margin-top:16px;background:rgba(137,180,250,0.15);border:1px solid #89b4fa;color:#89b4fa;padding:8px 28px;border-radius:20px;cursor:pointer;font-size:13px"
            @click="flipCard"
          >
            翻转 👀
          </button>
        </div>

        <!-- Know / Don't know buttons -->
        <div v-if="cardFlipped" style="display:flex;gap:12px;margin-top:14px">
          <button
            style="flex:1;background:rgba(166,227,161,0.12);border:1px solid #a6e3a1;color:#a6e3a1;padding:10px;border-radius:12px;cursor:pointer;font-size:14px"
            @click="markKnown"
          >
            ✅ 认识
          </button>
          <button
            style="flex:1;background:rgba(243,139,168,0.12);border:1px solid #f38ba8;color:#f38ba8;padding:10px;border-radius:12px;cursor:pointer;font-size:14px"
            @click="markUnknown"
          >
            ❌ 不认识
          </button>
        </div>
      </div>
    </div>

    <!-- ── List View ── -->
    <template v-else>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <h2 style="margin:0;font-size:16px;font-weight:600">生词本</h2>
        <button
          :disabled="vocabulary.filter(v => v.status === 'new' || v.status === 'learning').length === 0"
          :style="`background:${vocabulary.filter(v => v.status === 'new' || v.status === 'learning').length === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(166,227,161,0.12)'};border:1px solid ${vocabulary.filter(v => v.status === 'new' || v.status === 'learning').length === 0 ? 'rgba(255,255,255,0.1)' : '#a6e3a1'};color:${vocabulary.filter(v => v.status === 'new' || v.status === 'learning').length === 0 ? '#585b70' : '#a6e3a1'};padding:4px 12px;border-radius:16px;cursor:${vocabulary.filter(v => v.status === 'new' || v.status === 'learning').length === 0 ? 'not-allowed' : 'pointer'};font-size:12px`"
          @click="startReview"
        >
          📚 复习模式
        </button>
      </div>

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

      <!-- Sort options -->
      <div style="margin-bottom:12px;display:flex;align-items:center;gap:8px">
        <span style="font-size:11px;color:#6c7086;white-space:nowrap">排序：</span>
        <select
          v-model="sortBy"
          style="background:#313244;border:1px solid rgba(255,255,255,0.12);color:#cdd6f4;padding:4px 8px;border-radius:8px;font-size:12px;cursor:pointer;flex:1"
        >
          <option v-for="opt in sortOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
      </div>

      <!-- Export button -->
      <div style="margin-bottom:12px;text-align:right">
        <button
          :disabled="vocabulary.length === 0"
          :style="`background:${vocabulary.length === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(137,180,250,0.15)'};border:1px solid ${vocabulary.length === 0 ? 'rgba(255,255,255,0.1)' : '#89b4fa'};color:${vocabulary.length === 0 ? '#585b70' : '#89b4fa'};padding:4px 12px;border-radius:16px;cursor:${vocabulary.length === 0 ? 'not-allowed' : 'pointer'};font-size:12px`"
          @click="exportTSV"
        >
          📥 导出全部 TSV<span style="margin-left:4px;opacity:0.7">({{ vocabulary.length }})</span>
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
          <span v-if="lookupHistory[entry.surface] && lookupHistory[entry.surface] > 0" style="font-size:11px;color:#45475a;margin-left:4px">查词 {{ lookupHistory[entry.surface] }} 次</span>
          <button
            style="margin-left:auto;background:none;border:none;color:#585b70;cursor:pointer;font-size:14px;padding:2px 4px"
            title="删除"
            @click="deleteEntry(entry.id)"
          >
            ✕
          </button>
        </div>
      </div>
    </template>
  </div>
</template>
