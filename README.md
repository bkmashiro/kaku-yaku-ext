# KakuYaku — Japanese Reading Assistant

A Chrome extension for reading Japanese text on the web. Hover over any highlighted word to see its reading, meaning, grammar, and translation.

## Features

- **Word segmentation** — Powered by Sudachi tokenizer (via KakuYaku API), splits page text into tokens and highlights them
- **Popup dictionary** — Click any highlighted word: reading, part of speech, JLPT level, definitions, example sentences
- **Verb/adjective conjugation merging** — 食べている, 落成した etc. are treated as single units
- **AI grammar explanation** — "✨ 解释语法" uses DeepSeek to explain grammar patterns in context
- **AI translation** — "🌐 翻译" translates the current sentence into your chosen language
- **Furigana overlay** — Optional reading annotations above kanji (hover or always-on mode)
- **Vocabulary book** — Save words to a personal vocab list with study status tracking (new / learning / known)
- **LLM cache** — AI results are cached per paragraph; parsed paragraphs get a subtle left border indicator
- **Multi-language output** — AI explanations in English, 中文, 日本語, 한국어, Français, Deutsch, Español

## Setup

This extension requires the [KakuYaku API](https://github.com/bkmashiro/kaku-yaku-api) running locally or on your network.

### Development

```bash
# Install dependencies
npm install

# Build with watch (production mode + sourcemap)
WITH_SOURCEMAP=1 npx cross-env NODE_ENV=production vite build -c vite.chrome.config.ts --watch
```

Load the `dist/chrome` directory as an unpacked extension in Chrome.

### Configuration

Open the extension's **Options** page to configure:

| Setting | Description |
|---------|-------------|
| API Base URL | KakuYaku API endpoint (default: `http://localhost:3001/api`) |
| Explanation Language | Language for AI grammar/translation output |
| Furigana | Toggle reading annotations on highlighted words |
| Furigana Mode | `hover` (show on hover) or `always` |
| Cache Indicator | Blue-green left border on AI-analyzed paragraphs |

## Architecture

```
kaku-yaku-ext/          Chrome extension (Vite + Vue 3 + Manifest V3)
├── src/
│   ├── background/     Service worker — API proxy, message routing
│   ├── content-script/ Page tokenization, highlighting, popup UI
│   ├── stores/         Pinia stores (settings → sync, vocab → local)
│   └── ui/
│       ├── options-page/   Settings
│       ├── side-panel/     Vocabulary book
│       └── popup/          Extension toolbar popup

kaku-yaku-api/          NestJS backend
├── analysis/           Sudachi tokenizer, JMDict/KANJIDIC2 lookup
├── llm/                DeepSeek grammar explanation + translation
└── dictionary/         PostgreSQL + PGroonga full-text search
```

## Data Sources

- [JMdict](https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project) — Japanese-English dictionary
- [KANJIDIC2](https://www.edrdg.org/wiki/index.php/KANJIDIC_Project) — Kanji dictionary
- [Tatoeba](https://tatoeba.org/en/downloads) — Example sentences
- [Jonathan Waller JLPT lists](https://www.tanos.co.uk/jlpt/) — JLPT level data
- [Sudachi](https://github.com/WorksApplications/Sudachi) — Japanese tokenizer

## License

MIT
