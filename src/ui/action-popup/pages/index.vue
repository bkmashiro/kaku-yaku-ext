<script setup lang="ts">
import type { VocabEntry } from "src/stores/options.store"
import { JLPT_FILTER_OPTIONS, getEntryJlptLevel, matchesJlptFilter, type JlptFilterOption } from "src/utils/jlpt"

const DAY_MS = 24 * 60 * 60 * 1000
const JLPT_FILTER_STORAGE_KEY = "kakuyaku-popup-jlpt-filter"

type ReviewMode = "list" | "review" | "done"

const optionsStore = useOptionsStore()
const { vocabulary } = storeToRefs(optionsStore)

const reviewMode = ref<ReviewMode>("list")
const reviewQueue = ref<VocabEntry[]>([])
const reviewIndex = ref(0)
const reviewedToday = ref(0)
const knownCount = ref(0)
const unknownCount = ref(0)
const selectedJlptFilter = ref<JlptFilterOption>("All")

const nowTimestamp = () => Date.now()

const filteredVocabulary = computed(() =>
  vocabulary.value.filter(entry => matchesJlptFilter(entry, selectedJlptFilter.value)),
)

const totalEntries = computed(() => filteredVocabulary.value.length)

function getReviewCount(entry: VocabEntry) {
  return entry.review_count ?? entry.reviewCount ?? 0
}

function getIntervalDays(entry: VocabEntry) {
  return Math.max(1, entry.interval_days ?? 1)
}

function getNextReview(entry: VocabEntry) {
  return entry.next_review ?? entry.addedAt ?? 0
}

function isDue(entry: VocabEntry) {
  return getNextReview(entry) <= nowTimestamp()
}

const dueEntries = computed(() =>
  filteredVocabulary.value
    .filter(isDue)
    .slice()
    .sort((a, b) => getNextReview(a) - getNextReview(b)),
)

const currentCard = computed<VocabEntry | null>(() =>
  reviewQueue.value[reviewIndex.value] ?? null,
)

function setJlptFilter(filter: JlptFilterOption) {
  selectedJlptFilter.value = filter
}

function formatDate(timestamp?: number) {
  if (!timestamp)
    return "待安排"
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp)
}

function syncSrsDefaults(entry: VocabEntry) {
  if (entry.interval_days == null)
    entry.interval_days = 1
  if (entry.review_count == null)
    entry.review_count = entry.reviewCount ?? 0
  if (entry.last_reviewed == null)
    entry.last_reviewed = 0
  if (entry.next_review == null)
    entry.next_review = entry.addedAt ?? nowTimestamp()
  entry.reviewCount = entry.review_count ?? 0
}

watch(
  vocabulary,
  entries => entries.forEach(syncSrsDefaults),
  { immediate: true, deep: true },
)

function startReview() {
  reviewQueue.value = dueEntries.value.map(entry => entry)
  reviewIndex.value = 0
  reviewedToday.value = 0
  knownCount.value = 0
  unknownCount.value = 0
  reviewMode.value = reviewQueue.value.length > 0 ? "review" : "done"
}

function finishReview() {
  reviewMode.value = "done"
}

function updateCard(entry: VocabEntry, remembered: boolean) {
  const storedEntry = vocabulary.value.find(v => v.id === entry.id)
  if (!storedEntry)
    return

  syncSrsDefaults(storedEntry)

  const currentReviewCount = getReviewCount(storedEntry)
  const currentInterval = getIntervalDays(storedEntry)
  const nextInterval = remembered ? currentInterval * 2 : 1
  const reviewedAt = nowTimestamp()

  storedEntry.review_count = remembered ? currentReviewCount + 1 : currentReviewCount
  storedEntry.reviewCount = storedEntry.review_count
  storedEntry.interval_days = nextInterval
  storedEntry.last_reviewed = reviewedAt
  storedEntry.next_review = reviewedAt + nextInterval * DAY_MS
  storedEntry.status = remembered
    ? (storedEntry.status === "new" ? "learning" : "known")
    : "learning"

  reviewedToday.value += 1
  if (remembered)
    knownCount.value += 1
  else
    unknownCount.value += 1

  reviewIndex.value += 1
  if (reviewIndex.value >= reviewQueue.value.length)
    finishReview()
}

function markKnown() {
  const card = currentCard.value
  if (!card)
    return
  updateCard(card, true)
}

function markUnknown() {
  const card = currentCard.value
  if (!card)
    return
  updateCard(card, false)
}

function leaveReview() {
  reviewMode.value = "list"
}

onMounted(() => {
  const storedFilter = localStorage.getItem(JLPT_FILTER_STORAGE_KEY)
  if (storedFilter && JLPT_FILTER_OPTIONS.includes(storedFilter as JlptFilterOption))
    selectedJlptFilter.value = storedFilter as JlptFilterOption
})

watch(selectedJlptFilter, (value) => {
  localStorage.setItem(JLPT_FILTER_STORAGE_KEY, value)
})
</script>

<template>
  <section class="popup-shell">
    <div class="popup-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Kaku-Yaku</p>
          <h1>SRS 复习</h1>
        </div>
        <button
          v-if="reviewMode !== 'list'"
          class="ghost-button"
          type="button"
          @click="leaveReview"
        >
          返回
        </button>
      </div>

      <template v-if="reviewMode === 'list'">
        <div class="summary-grid">
          <div class="summary-card">
            <span>生词总数</span>
            <strong>{{ totalEntries }}</strong>
          </div>
          <div class="summary-card">
            <span>今日到期</span>
            <strong>{{ dueEntries.length }}</strong>
          </div>
        </div>

        <div class="filter-section">
          <div class="filter-header">
            <span class="filter-label">JLPT</span>
            <span class="filter-value">{{ selectedJlptFilter }}</span>
          </div>
          <div
            class="filter-chips"
            role="radiogroup"
            aria-label="JLPT level filter"
          >
            <button
              v-for="option in JLPT_FILTER_OPTIONS"
              :key="option"
              class="filter-chip"
              :class="{ active: selectedJlptFilter === option }"
              type="button"
              :aria-pressed="selectedJlptFilter === option"
              @click="setJlptFilter(option)"
            >
              {{ option }}
            </button>
          </div>
        </div>

        <button
          class="primary-button"
          type="button"
          :disabled="dueEntries.length === 0"
          @click="startReview"
        >
          开始复习
        </button>

        <p
          v-if="dueEntries.length === 0"
          class="hint"
        >
          当前没有到期词条。新保存的词会默认进入 1 天复习间隔。
        </p>

        <ul
          v-else
          class="due-list"
        >
          <li
            v-for="entry in dueEntries.slice(0, 6)"
            :key="entry.id"
          >
            <div>
              <div class="due-headline">
                <strong>{{ entry.surface }}</strong>
                <span
                  v-if="getEntryJlptLevel(entry)"
                  class="jlpt-badge"
                >
                  {{ getEntryJlptLevel(entry) }}
                </span>
              </div>
              <span v-if="entry.reading && entry.reading !== entry.surface">{{ entry.reading }}</span>
            </div>
            <small>复习 {{ getReviewCount(entry) }} 次</small>
          </li>
        </ul>
      </template>

      <template v-else-if="reviewMode === 'review' && currentCard">
        <div class="review-progress">
          <span>{{ reviewIndex + 1 }} / {{ reviewQueue.length }}</span>
          <span>已完成 {{ reviewedToday }}</span>
        </div>

        <div class="review-card">
          <p class="dict-form">{{ currentCard.surface }}</p>
          <p
            v-if="currentCard.reading"
            class="reading"
          >
            {{ currentCard.reading }}
          </p>
          <p
            v-if="currentCard.meanings?.length"
            class="meaning"
          >
            {{ currentCard.meanings.slice(0, 3).join(" · ") }}
          </p>
          <p class="meta">
            当前间隔 {{ getIntervalDays(currentCard) }} 天
            <span>下次 {{ formatDate(getNextReview(currentCard)) }}</span>
          </p>
        </div>

        <div class="action-row">
          <button
            class="danger-button"
            type="button"
            @click="markUnknown"
          >
            不认识
          </button>
          <button
            class="success-button"
            type="button"
            @click="markKnown"
          >
            认识
          </button>
        </div>
      </template>

      <template v-else>
        <div class="done-card">
          <p class="eyebrow">Review Complete</p>
          <h2>今日复习了 {{ reviewedToday }} 个词</h2>
          <p>认识 {{ knownCount }} 个，不认识 {{ unknownCount }} 个。</p>
          <button
            class="primary-button"
            type="button"
            @click="leaveReview"
          >
            返回词本
          </button>
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
.popup-shell {
  min-width: 360px;
  min-height: 480px;
  padding: 8px;
  background:
    radial-gradient(circle at top, rgba(252, 211, 77, 0.18), transparent 30%),
    linear-gradient(180deg, #fff8ef 0%, #f4eee3 100%);
}

.popup-panel {
  min-height: 464px;
  padding: 18px;
  border: 1px solid rgba(120, 53, 15, 0.12);
  border-radius: 24px;
  background: rgba(255, 252, 247, 0.92);
  box-shadow: 0 18px 40px rgba(120, 53, 15, 0.12);
  color: #3f2f1f;
}

.panel-header,
.review-progress,
.action-row,
.summary-grid,
.filter-header,
.due-list li {
  display: flex;
  align-items: center;
}

.panel-header,
.review-progress,
.filter-header,
.due-list li {
  justify-content: space-between;
}

.panel-header {
  margin-bottom: 18px;
}

.eyebrow {
  margin: 0 0 4px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #b45309;
}

h1,
h2,
.dict-form {
  margin: 0;
  font-family: "Iowan Old Style", "Hiragino Mincho ProN", serif;
}

h1 {
  font-size: 28px;
  line-height: 1;
}

.summary-grid {
  gap: 12px;
  margin-bottom: 16px;
}

.summary-card,
.review-card,
.done-card,
.due-list li {
  border-radius: 18px;
  background: #fffdf8;
  border: 1px solid rgba(120, 53, 15, 0.1);
}

.summary-card {
  flex: 1;
  padding: 14px;
}

.filter-section {
  margin-bottom: 16px;
  padding: 14px;
  border-radius: 18px;
  border: 1px solid rgba(120, 53, 15, 0.1);
  background: rgba(255, 253, 248, 0.72);
}

.filter-header {
  margin-bottom: 10px;
}

.filter-label,
.filter-value {
  font-size: 12px;
  font-weight: 700;
  color: #9a3412;
}

.filter-chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.filter-chip {
  border: 1px solid rgba(180, 83, 9, 0.18);
  border-radius: 999px;
  padding: 8px 12px;
  background: rgba(255, 248, 235, 0.9);
  color: #92400e;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: background-color 120ms ease, color 120ms ease, border-color 120ms ease;
}

.filter-chip.active {
  background: #b45309;
  border-color: #b45309;
  color: #fffaf2;
}

.summary-card span,
.hint,
.meaning,
.meta,
.review-progress,
.due-list small,
.due-list span,
.done-card p {
  color: #7c5c3d;
}

.summary-card span,
.due-list small,
.review-progress,
.meta {
  font-size: 12px;
}

.summary-card strong {
  display: block;
  margin-top: 6px;
  font-size: 24px;
}

.primary-button,
.success-button,
.danger-button,
.ghost-button {
  border: 0;
  border-radius: 999px;
  padding: 12px 16px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 120ms ease, opacity 120ms ease;
}

.primary-button,
.success-button,
.danger-button {
  width: 100%;
}

.primary-button {
  background: #b45309;
  color: #fffaf2;
}

.success-button {
  background: #166534;
  color: #f0fdf4;
}

.danger-button {
  background: #b91c1c;
  color: #fff1f2;
}

.ghost-button {
  padding-inline: 14px;
  background: rgba(180, 83, 9, 0.1);
  color: #9a3412;
}

.primary-button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.primary-button:not(:disabled):active,
.success-button:active,
.danger-button:active,
.ghost-button:active {
  transform: translateY(1px);
}

.hint {
  margin: 12px 2px 0;
  font-size: 13px;
  line-height: 1.5;
}

.due-list {
  margin: 18px 0 0;
  padding: 0;
  list-style: none;
}

.due-list li {
  gap: 12px;
  margin-bottom: 10px;
  padding: 12px 14px;
}

.due-headline {
  display: flex;
  align-items: center;
  gap: 8px;
}

.due-list strong {
  display: block;
  font-size: 17px;
}

.due-list span {
  display: block;
  margin-top: 2px;
  font-size: 13px;
}

.jlpt-badge {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 2px 8px;
  background: rgba(236, 72, 153, 0.12);
  color: #be185d;
  font-size: 11px;
  font-weight: 700;
}

.review-progress {
  margin-bottom: 14px;
}

.review-card {
  padding: 28px 18px;
  text-align: center;
}

.dict-form {
  font-size: 42px;
  line-height: 1.1;
}

.reading {
  margin: 12px 0 0;
  font-size: 20px;
  color: #92400e;
}

.meaning {
  margin: 18px 0 0;
  font-size: 14px;
  line-height: 1.6;
}

.meta {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin: 18px 0 0;
  flex-wrap: wrap;
}

.action-row {
  gap: 12px;
  margin-top: 16px;
}

.done-card {
  padding: 28px 18px;
  text-align: center;
}

.done-card h2 {
  margin: 6px 0 10px;
  font-size: 28px;
}

@media (max-width: 420px) {
  .popup-shell {
    min-width: auto;
  }

  .popup-panel {
    padding: 16px;
  }

  .summary-grid,
  .action-row {
    flex-direction: column;
  }

  .dict-form {
    font-size: 36px;
  }

  .filter-chips {
    gap: 6px;
  }
}
</style>
