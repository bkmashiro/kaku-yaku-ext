// This import css file is used to style the iframe that is injected into the page
import "./index.css"
import Browser from "webextension-polyfill"

// 扩展Window接口
declare global {
  interface Window {
    kakuYakuLoaded?: boolean;
    kakuYakuNotified?: boolean;
  }
}

// 定义Token接口
interface TokenData {
  surface: string;
  pos: string;
  reading?: string;
  dictionaryForm?: string;
}

// ── Settings loader ───────────────────────────────────────────────────────────
let kkSettings = {
  explanationLang: "English",
  furigana: false,
  furiganaMode: "hover" as "hover" | "always",
  showCacheIndicator: true,
}
Browser.storage.sync.get("kakuyaku-settings").then((d: any) => {
  if (d?.["kakuyaku-settings"]) Object.assign(kkSettings, d["kakuyaku-settings"])
})
Browser.storage.onChanged.addListener((changes: any, area: string) => {
  if (area === "sync" && changes["kakuyaku-settings"]) Object.assign(kkSettings, changes["kakuyaku-settings"].newValue)
})

// 设置一个标记表示content script已加载
if (!window.hasOwnProperty('kakuYakuLoaded')) {
  window.kakuYakuLoaded = true;
  console.info("Kaku-Yaku初始化，设置加载标记");
}

// 通知background script content script已准备就绪
const notifyReady = () => {
  try {
    console.info("发送content script就绪通知...")
    Browser.runtime.sendMessage({
      action: 'content-script-ready',
      url: window.location.href
    }).then(() => {
      console.info("就绪通知发送成功")
    }).catch(error => {
      console.error("发送就绪通知失败:", error)
    })
  } catch (error) {
    console.error("准备发送就绪通知时发生错误:", error)
  }
}

// 统一词性格式，确保与CSS类名匹配
const normalizePos = (pos: string): string => {
  // 默认词性
  if (!pos) return 'default';

  // 转换API返回的不同写法
  switch (pos) {
    case '接頭辞':
      return '接頭詞';
    case '接尾辞':
      return '接尾辞';
    default:
      return pos;
  }
};

// 高亮显示选中的文本
const highlightSelectedText = (selectedText: string, tokens?: TokenData[]) => {
  try {
    console.info("准备高亮文本:", selectedText);

    // 如果提供了tokens数据，使用带词性的高亮
    if (tokens && tokens.length > 0) {
      console.info(`使用词性数据高亮 ${tokens.length} 个语素`);
      return highlightTextWithTokens(selectedText, tokens);
    }

    // 否则使用普通高亮
    console.info("使用普通高亮");
    return highlightText(selectedText, 'default');
  } catch (error) {
    console.error("高亮文本时出错:", error);
    return 0;
  }
};

// 使用tokens高亮文本 - 只处理当前选中的文本
const highlightTextWithTokens = (text: string, tokens: TokenData[]): number => {
  try {
    // 获取当前选中的范围
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      console.warn("无法获取用户选择范围");
      return 0;
    }

    // 创建一个片段用于插入高亮内容
    const range = selection.getRangeAt(0).cloneRange();
    range.deleteContents();

    // 创建包含所有高亮token的文档片段
    const fragment = document.createDocumentFragment();

    // 合并动词活用形和助动词链，让高亮更自然
    // 规则：
    //   1. 動詞 + 助動詞* → 食べた、食べている、食べられた
    //   2. 名詞 + する(動詞) + 助動詞* → 落成した、参加します
    //   3. 形容詞/形容動詞 + 助動詞* → 美しかった、静かだった
    //   4. 動詞 + て(助詞) + いる/ある/おく(動詞) + 助動詞* → 食べている
    const isVerb = (t: TokenData) => t.pos?.includes('動詞');
    const isAdj = (t: TokenData) => t.pos?.includes('形容詞') || t.pos?.includes('形容動詞');
    const isSahenNoun = (t: TokenData) =>
      t.pos?.includes('名詞') && (t as any).posDetail?.includes('サ変接続');

    const mergedTokens: TokenData[] = [];
    for (let i = 0; i < tokens.length; i++) {
      const cur = tokens[i] as any;
      let j = i + 1;

      const isHead = isVerb(cur) || isAdj(cur) ||
        (isSahenNoun(cur) && tokens[j] && isVerb(tokens[j]) && (tokens[j] as any).dictionaryForm === 'する');

      if (!isHead) {
        mergedTokens.push(cur);
        continue;
      }

      // サ変名詞の場合、まず する を取り込む
      let combined = cur.surface;
      let combinedReading = cur.reading || cur.surface;
      const dictForm = isVerb(cur)
        ? cur.dictionaryForm || cur.surface
        : isSahenNoun(cur)
          ? cur.surface + 'する'
          : cur.dictionaryForm || cur.surface;

      if (isSahenNoun(cur) && tokens[j] && isVerb(tokens[j]) && (tokens[j] as any).dictionaryForm === 'する') {
        combined += tokens[j].surface;
        combinedReading += tokens[j].reading || tokens[j].surface;
        j++;
      }

      // 以下のパターンを貪欲にマージ:
      //   助動詞、または て+いる/ある/おく のチェーン
      while (j < tokens.length) {
        const t = tokens[j] as any;
        if (t.pos?.includes('助動詞')) {
          combined += t.surface;
          combinedReading += t.reading || t.surface;
          j++;
        } else if (
          t.surface === 'て' || t.surface === 'で' // 接続助詞 て/で
        ) {
          const after = tokens[j + 1] as any;
          if (after && isVerb(after) && ['いる','ある','おく','しまう','みる','くる'].includes(after.dictionaryForm)) {
            combined += t.surface + after.surface;
            combinedReading += (t.reading || t.surface) + (after.reading || after.surface);
            j += 2;
            // さらに助動詞が続く場合
            while (j < tokens.length && (tokens[j] as any).pos?.includes('助動詞')) {
              combined += tokens[j].surface;
              combinedReading += (tokens[j] as any).reading || tokens[j].surface;
              j++;
            }
          } else {
            break;
          }
        } else {
          break;
        }
      }

      mergedTokens.push({
        surface: combined,
        reading: combinedReading,
        dictionaryForm: dictForm,
        pos: isAdj(cur) ? cur.pos : '動詞',
      });
      i = j - 1;
    }

    // 遍历合并后的tokens，分别创建高亮元素
    mergedTokens.forEach(token => {
      const normalizedPos = normalizePos(token.pos);
      const surface = token.surface;

      if (surface) {
        if (kkSettings.furigana && token.reading && token.reading !== surface) {
          // 创建 ruby 元素
          const ruby = document.createElement('ruby');
          ruby.className = `kaku-yaku-highlight kaku-yaku-${normalizedPos}`;
          ruby.title = `${surface} (${normalizedPos})`;
          ruby.dataset.surface = surface;
          ruby.dataset.reading = token.reading || '';
          ruby.dataset.dictForm = (token as any).dictionaryForm || surface;
          ruby.dataset.pos = normalizedPos;
          ruby.style.cursor = 'pointer';
          ruby.textContent = surface;

          const rt = document.createElement('rt');
          rt.textContent = token.reading;
          rt.style.fontSize = '0.65em';
          rt.style.color = '#89b4fa';
          if (kkSettings.furiganaMode === 'hover') {
            rt.style.opacity = '0';
            rt.style.transition = 'opacity 0.15s';
            ruby.addEventListener('mouseenter', () => { rt.style.opacity = '1'; });
            ruby.addEventListener('mouseleave', () => { rt.style.opacity = '0'; });
          }
          ruby.appendChild(rt);
          fragment.appendChild(ruby);
        } else {
          // 创建普通 span 元素
          const span = document.createElement('span');
          span.className = `kaku-yaku-highlight kaku-yaku-${normalizedPos}`;
          span.title = `${surface} (${normalizedPos})`;
          span.textContent = surface;
          span.dataset.surface = surface;
          span.dataset.reading = token.reading || '';
          span.dataset.dictForm = (token as any).dictionaryForm || surface;
          span.dataset.pos = normalizedPos;
          span.style.cursor = 'pointer';

          fragment.appendChild(span);
        }
        console.info(`已创建 "${surface}" (${normalizedPos}) 的高亮元素`);
      }
    });

    // 插入构建好的文档片段
    range.insertNode(fragment);
    console.info(`成功替换选中文本为高亮元素`);

    // 清除选择状态
    selection.removeAllRanges();

    return tokens.length;
  } catch (error) {
    console.error("使用tokens高亮文本时出错:", error);
    return 0;
  }
};

// 根据词性高亮文本 - 只处理当前选中的文本
const highlightText = (text: string, wordType: string): number => {
  try {
    // 获取当前选中的范围
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      console.warn("无法获取用户选择范围");
      return 0;
    }

    // 克隆当前选择的范围
    const range = selection.getRangeAt(0).cloneRange();

    // 创建高亮元素
    const span = document.createElement('span');
    span.className = `kaku-yaku-highlight kaku-yaku-${wordType}`;
    span.title = `${text} (${wordType})`;

    // 替换选中内容
    range.deleteContents();
    span.textContent = text;
    range.insertNode(span);

    // 清除选择状态
    selection.removeAllRanges();

    console.info(`已高亮选中文本: "${text}" (${wordType})`);
    return 1;
  } catch (error) {
    console.error(`高亮"${text}"时出错:`, error);
    return 0;
  }
};

// ── LLM 缓存（按段落文本缓存，跨词共享） ─────────────────────────────────────
const llmCache = new Map<string, { grammar?: any; translation?: any }>();

// ── Hover Popup ──────────────────────────────────────────────────────────────

function createPopup(): HTMLElement {
  const existing = document.getElementById('kaku-yaku-popup');
  if (existing) return existing;

  const popup = document.createElement('div');
  popup.id = 'kaku-yaku-popup';
  popup.innerHTML = `
    <div id="kky-header" style="margin-bottom:6px;display:flex;align-items:baseline;gap:8px;flex-wrap:wrap">
      <span id="kky-surface" style="font-size:20px;font-weight:bold"></span>
      <span id="kky-reading" style="color:#89b4fa;font-size:14px"></span>
    </div>
    <div id="kky-meta" style="margin-bottom:10px;display:flex;gap:6px;align-items:center;flex-wrap:wrap">
      <span id="kky-pos" style="font-size:11px;color:#a6e3a1;background:rgba(166,227,161,0.15);padding:2px 8px;border-radius:10px"></span>
      <span id="kky-jlpt" style="font-size:11px;color:#f38ba8;background:rgba(243,139,168,0.15);padding:2px 8px;border-radius:10px"></span>
    </div>
    <div id="kky-meanings" style="line-height:1.7"></div>
    <div id="kky-examples" style="margin-top:8px;font-size:12px;color:#cba6f7"></div>
    <div id="kky-llm" style="margin-top:8px"></div>
    <div style="margin-top:10px;display:flex;gap:6px;align-items:center">
      <button id="kky-explain" style="background:#313244;border:none;color:#cdd6f4;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px">✨ 解释语法</button>
      <button id="kky-translate" style="background:#313244;border:none;color:#cdd6f4;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px">🌐 翻译</button>
      <button id="kky-save" style="background:#313244;border:none;color:#cdd6f4;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px">＋ 生词本</button>
      <button id="kky-close" style="margin-left:auto;background:none;border:none;color:#6c7086;cursor:pointer;font-size:18px;line-height:1">✕</button>
    </div>
  `;
  Object.assign(popup.style, {
    display: 'none',
    position: 'absolute',
    zIndex: '2147483647',
    background: '#1e1e2e',
    color: '#cdd6f4',
    borderRadius: '12px',
    padding: '16px',
    maxWidth: '340px',
    minWidth: '220px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
    fontFamily: 'sans-serif',
    fontSize: '14px',
    border: '1px solid rgba(255,255,255,0.12)',
    lineHeight: '1.5',
  });

  document.body.appendChild(popup);

  document.getElementById('kky-close')!.addEventListener('click', hidePopup);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hidePopup(); });
  document.addEventListener('click', (e) => {
    const pop = document.getElementById('kaku-yaku-popup');
    if (pop && !pop.contains(e.target as Node) && !(e.target as Element).classList.contains('kaku-yaku-highlight')) {
      hidePopup();
    }
  });

  return popup;
}

function hidePopup() {
  const popup = document.getElementById('kaku-yaku-popup');
  if (popup) popup.style.display = 'none';
}

function showPopup(event: MouseEvent, span: HTMLElement) {
  const popup = createPopup();

  const surface = span.dataset.surface || span.textContent || '';
  const reading = span.dataset.reading || '';
  const dictForm = span.dataset.dictForm || surface;
  const pos = span.dataset.pos || '';

  // 清空旧内容
  document.getElementById('kky-surface')!.textContent = surface;
  document.getElementById('kky-reading')!.textContent = reading !== surface ? reading : '';
  document.getElementById('kky-pos')!.textContent = pos;
  document.getElementById('kky-meanings')!.innerHTML = '<span style="color:#6c7086">查询中…</span>';
  document.getElementById('kky-examples')!.textContent = '';
  document.getElementById('kky-jlpt')!.textContent = '';
  document.getElementById('kky-llm')!.textContent = '';

  // 定位 — absolute 跟随文档，吸附在点击词色块正下方
  const POPUP_W = 340;
  const rect = span.getBoundingClientRect();
  // 文档坐标 = viewport坐标 + 滚动偏移
  const docX = rect.left + window.scrollX;
  const docY = rect.bottom + window.scrollY + 6;
  // 防止超出右边界（用 viewport 宽做参考）
  const clampedX = Math.min(docX, window.scrollX + window.innerWidth - POPUP_W - 8);
  popup.style.left = Math.max(clampedX, window.scrollX + 8) + 'px';
  popup.style.top  = docY + 'px';
  popup.style.display = 'block';

  // Reset save button state
  const saveBtn = document.getElementById('kky-save')!;
  saveBtn.textContent = '＋ 生词本';
  (saveBtn as HTMLButtonElement).style.color = '#cdd6f4';

  // Check if already saved
  Browser.storage.local.get('kakuyaku-vocab').then((d: any) => {
    const vocab: any[] = d?.['kakuyaku-vocab'] || [];
    const alreadySaved = vocab.some((v: any) => v.surface === surface && v.dictForm === (dictForm || surface));
    if (alreadySaved) {
      saveBtn.textContent = '✅ 已保存';
      (saveBtn as HTMLButtonElement).style.color = '#a6e3a1';
    }
  });

  let jlptValue = '';
  let exampleText = '';

  // 向 background 请求详情
  Browser.runtime.sendMessage({ action: 'get-token-detail', surface: dictForm || surface })
    .then((data: any) => {
      if (!data) return;
      const tokens = data.tokens as any[];
      const first = tokens?.[0];
      if (!first) return;

      // 释义
      const meaningsEl = document.getElementById('kky-meanings')!;
      // API returns gloss as string[] directly on jmdict entry
      const glosses: string[] = first.jmdict?.[0]?.gloss || first.jmdict?.[0]?.meanings?.[0]?.glosses || [];
      if (glosses.length > 0) {
        meaningsEl.innerHTML = glosses.slice(0, 4).map((g: string) => `• ${g}`).join('<br>');
      } else {
        meaningsEl.innerHTML = '<span style="color:#6c7086">（无词典数据）</span>';
      }

      // 例句
      const ex = data.examples?.[0];
      if (ex) {
        exampleText = ex.text;
        document.getElementById('kky-examples')!.textContent = `例: ${ex.text}`;
      }

      // JLPT badge — show as "N3" not "JLPT N3"
      const jlpt = first.jmdict?.[0]?.jlpt;
      if (jlpt) {
        jlptValue = String(jlpt).replace(/^JLPT\s*/i, '');
        document.getElementById('kky-jlpt')!.textContent = jlptValue;
      }

      // Wire save button after data loaded
      saveBtn.onclick = async () => {
        const d2 = await Browser.storage.local.get('kakuyaku-vocab');
        const vocab: any[] = (d2 as any)?.['kakuyaku-vocab'] || [];
        const alreadySaved = vocab.some((v: any) => v.surface === surface && v.dictForm === (dictForm || surface));
        if (alreadySaved) {
          saveBtn.textContent = '✅ 已保存';
          (saveBtn as HTMLButtonElement).style.color = '#a6e3a1';
          return;
        }
        // Parse meanings from popup
        const meaningsText = document.getElementById('kky-meanings')!.innerText;
        const parsedMeanings = meaningsText.split('\n').map(s => s.replace(/^•\s*/, '').trim()).filter(Boolean);
        const entry = {
          id: surface + '_' + Date.now(),
          surface,
          reading,
          dictForm: dictForm || surface,
          pos,
          meanings: parsedMeanings.length ? parsedMeanings : glosses,
          jlpt: jlptValue,
          addedAt: Date.now(),
          example: exampleText,
          exampleTrans: '',
          status: 'new',
          reviewCount: 0,
        };
        vocab.push(entry);
        await Browser.storage.local.set({ 'kakuyaku-vocab': vocab });
        saveBtn.textContent = '✅ 已保存';
        (saveBtn as HTMLButtonElement).style.color = '#a6e3a1';
      };
    })
    .catch(() => {
      document.getElementById('kky-meanings')!.innerHTML = '<span style="color:#f38ba8">查询失败</span>';
    });

  // 获取段落文本（用作缓存key）
  const getSentenceContext = (maxLen: number): string => {
    const container = span.closest('p, li, td, h1, h2, h3, h4, h5, blockquote, article, section, div');
    if (container && container.textContent && container.textContent.trim().length > surface.length) {
      return container.textContent.trim().slice(0, maxLen);
    }
    const parent = span.parentElement;
    if (parent) {
      const allText = Array.from(parent.childNodes).map(n => n.textContent || '').join('').trim();
      if (allText.length > surface.length) return allText.slice(0, maxLen);
    }
    return surface;
  };

  // 获取当前词所在的句子（翻译用，更精确）
  const getLocalSentence = (): string => {
    const ctx = getSentenceContext(500);
    const parts = ctx.split(/(?<=[。！？])|(?=\n)/);
    const containing = parts.find(s => s.includes(surface) || s.includes(dictForm));
    return (containing || ctx).trim().slice(0, 200);
  };

  const cacheKey = getSentenceContext(300);

  // 渲染 grammar 结果
  const renderGrammar = (res: any) => {
    const llmEl = document.getElementById('kky-llm')!;
    llmEl.innerHTML = `
      <div style="border-top:1px solid rgba(255,255,255,0.1);padding-top:8px">
        <div style="color:#89dceb;font-size:11px;font-weight:600;margin-bottom:6px">✨ 语法解析 · <em>${surface}</em></div>
        ${res.role ? `<div style="margin-bottom:4px"><span style="color:#a6e3a1;font-size:11px">词性</span>  ${res.role}</div>` : ''}
        ${res.function ? `<div style="margin-bottom:4px"><span style="color:#a6e3a1;font-size:11px">作用</span>  ${res.function}</div>` : ''}
        ${res.rule ? `<div style="margin-bottom:4px;color:#cba6f7;font-size:12px">💡 ${res.rule}</div>` : ''}
        ${res.example ? `<div style="margin-top:6px;padding:6px 8px;background:rgba(255,255,255,0.06);border-radius:6px;font-size:12px">${res.example}<br><span style="color:#a6adc8">${res.exampleTrans || ''}</span></div>` : ''}
      </div>`.trim();
  };

  // 渲染 translation 结果
  const renderTranslation = (res: any) => {
    const llmEl = document.getElementById('kky-llm')!;
    const chunksHtml = (res.chunks || [])
      .map((c: any) => `<span style="display:inline-block;margin:2px 4px 2px 0;padding:2px 6px;background:rgba(255,255,255,0.08);border-radius:4px;font-size:11px"><span style="color:#89b4fa">${c.jp}</span> <span style="color:#a6adc8">${c.en}</span></span>`)
      .join('');
    llmEl.innerHTML = `
      <div style="border-top:1px solid rgba(255,255,255,0.1);padding-top:8px">
        <div style="color:#89dceb;font-size:11px;font-weight:600;margin-bottom:6px">🌐 翻译</div>
        <div style="margin-bottom:8px;font-size:13px">${res.translation || ''}</div>
        ${chunksHtml ? `<div>${chunksHtml}</div>` : ''}
      </div>`.trim();
  };

  let grammarShown = false;
  let translateShown = false;
  const explainBtn = document.getElementById('kky-explain')!;
  const translateBtn = document.getElementById('kky-translate')!;
  const llmEl = document.getElementById('kky-llm')!;

  const resetLlm = () => { llmEl.innerHTML = ''; grammarShown = false; translateShown = false; };

  explainBtn.onclick = async () => {
    if (grammarShown) { resetLlm(); explainBtn.textContent = '✨ 解释语法'; return; }
    translateShown = false; translateBtn.textContent = '🌐 翻译';
    // 检查缓存
    const cached = llmCache.get(cacheKey)?.grammar;
    if (cached) { renderGrammar(cached); grammarShown = true; explainBtn.textContent = '✅ 语法解析'; return; }
    explainBtn.textContent = '⏳ 解释中…';
    try {
      const lang = await Browser.storage.sync.get('kakuyaku-settings').then((d: any) => d?.['kakuyaku-settings']?.explanationLang || 'English');
      const res = await Browser.runtime.sendMessage({
        action: 'llm-explain-grammar',
        sentence: getSentenceContext(300),
        targetWord: surface,
        lang,
      }) as any;
      if (!llmCache.has(cacheKey)) llmCache.set(cacheKey, {});
      llmCache.get(cacheKey)!.grammar = res;

      // Cache indicator
      if (kkSettings.showCacheIndicator) {
        const c = span.closest('p,li,td,blockquote,article,section');
        if (c) {
          (c as HTMLElement).style.borderLeft = '2px solid rgba(137,220,235,0.35)';
          (c as HTMLElement).style.paddingLeft = '6px';
        }
      }

      renderGrammar(res);
      grammarShown = true;
      explainBtn.textContent = '✅ 语法解析';
    } catch (e: any) { llmEl.textContent = '请求失败: ' + (e?.message || e); explainBtn.textContent = '✨ 解释语法'; }
  };

  translateBtn.onclick = async () => {
    if (translateShown) { resetLlm(); translateBtn.textContent = '🌐 翻译'; return; }
    grammarShown = false; explainBtn.textContent = '✨ 解释语法';
    // 检查缓存
    const cached = llmCache.get(cacheKey)?.translation;
    if (cached) { renderTranslation(cached); translateShown = true; translateBtn.textContent = '✅ 翻译'; return; }
    translateBtn.textContent = '⏳ 翻译中…';
    try {
      const res = await Browser.runtime.sendMessage({
        action: 'llm-translate',
        sentence: getLocalSentence(),
      }) as any;
      if (!llmCache.has(cacheKey)) llmCache.set(cacheKey, {});
      llmCache.get(cacheKey)!.translation = res;

      // Cache indicator
      if (kkSettings.showCacheIndicator) {
        const c = span.closest('p,li,td,blockquote,article,section');
        if (c) {
          (c as HTMLElement).style.borderLeft = '2px solid rgba(137,220,235,0.35)';
          (c as HTMLElement).style.paddingLeft = '6px';
        }
      }

      renderTranslation(res);
      translateShown = true;
      translateBtn.textContent = '✅ 翻译';
    } catch (e: any) { llmEl.textContent = '请求失败: ' + (e?.message || e); translateBtn.textContent = '🌐 翻译'; }
  };
}

// 监听高亮词点击
document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  const highlight = target.classList.contains('kaku-yaku-highlight')
    ? target
    : target.closest('.kaku-yaku-highlight') as HTMLElement;
  if (highlight) {
    e.stopPropagation();
    showPopup(e as MouseEvent, highlight);
  }
});

// ── 消息监听 ─────────────────────────────────────────────────────────────────

// 监听来自background脚本的消息
Browser.runtime.onMessage.addListener((message: any) => {
  console.info("收到消息:", message);

  if (message.action === "highlight-text") {
    if (message.text) {
      if (message.tokens) {
        // 带有分析结果的高亮
        console.info(`收到高亮请求，带有 ${message.tokens.length} 个语素数据`);
        highlightSelectedText(message.text, message.tokens);
      } else {
        // 普通高亮
        console.info("收到高亮请求，无语素数据");
        highlightSelectedText(message.text);
      }
    }
  } else if (message.action === "ping") {
    // 回复ping以确认content script已加载
    return Promise.resolve({ action: "pong" });
  }

  return true;
});

// 在页面加载完成后通知background
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', notifyReady)
} else {
  notifyReady()
}

// 错误处理
self.onerror = function (message, source, lineno, colno, error) {
  console.error("Content script错误:", message, source, lineno, colno)
}

console.info("Content script已加载")
