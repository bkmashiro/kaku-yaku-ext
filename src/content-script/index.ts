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
    
    // 遍历所有tokens，分别创建高亮元素
    tokens.forEach(token => {
      const normalizedPos = normalizePos(token.pos);
      const surface = token.surface;
      
      if (surface) {
        // 创建span元素
        const span = document.createElement('span');
        span.className = `kaku-yaku-highlight kaku-yaku-${normalizedPos}`;
        span.title = `${surface} (${normalizedPos})`;
        span.textContent = surface;
        span.dataset.surface = surface;
        span.dataset.reading = token.reading || '';
        span.dataset.dictForm = token.dictionaryForm || surface;
        span.dataset.pos = normalizedPos;
        span.style.cursor = 'pointer';
        
        // 添加到文档片段
        fragment.appendChild(span);
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

// ── Hover Popup ──────────────────────────────────────────────────────────────

function createPopup(): HTMLElement {
  const existing = document.getElementById('kaku-yaku-popup');
  if (existing) return existing;

  const popup = document.createElement('div');
  popup.id = 'kaku-yaku-popup';
  popup.innerHTML = `
    <div id="kky-surface" style="font-size:20px;font-weight:bold;margin-bottom:4px;"></div>
    <div id="kky-reading" style="color:#89b4fa;margin-bottom:4px;font-size:15px;"></div>
    <div id="kky-pos" style="font-size:11px;color:#a6e3a1;margin-bottom:10px;"></div>
    <div id="kky-meanings" style="line-height:1.7;"></div>
    <div id="kky-examples" style="margin-top:10px;font-size:12px;color:#cba6f7;border-top:1px solid rgba(255,255,255,0.1);padding-top:8px;"></div>
    <div id="kky-jlpt" style="margin-top:6px;font-size:11px;color:#f38ba8;"></div>
    <div id="kky-llm" style="margin-top:10px;border-top:1px solid rgba(255,255,255,0.1);padding-top:8px;"></div>
    <button id="kky-close" style="position:absolute;top:8px;right:10px;background:none;border:none;color:#6c7086;cursor:pointer;font-size:18px;line-height:1;">✕</button>
    <button id="kky-explain" style="margin-top:10px;background:#313244;border:none;color:#cdd6f4;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px;">✨ 解释语法</button>
    <button id="kky-translate" style="margin-top:10px;margin-left:6px;background:#313244;border:none;color:#cdd6f4;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px;">🌐 翻译句子</button>
  `;
  Object.assign(popup.style, {
    display: 'none',
    position: 'fixed',
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

  // 定位
  const x = Math.min(event.clientX, window.innerWidth - 360);
  const y = event.clientY + 20;
  popup.style.left = x + 'px';
  popup.style.top = y + 'px';
  popup.style.display = 'block';

  // 向 background 请求详情
  Browser.runtime.sendMessage({ action: 'get-token-detail', surface: dictForm || surface })
    .then((data: any) => {
      if (!data) return;
      const tokens = data.tokens as any[];
      const first = tokens?.[0];
      if (!first) return;

      // 释义
      const meaningsEl = document.getElementById('kky-meanings')!;
      const glosses: string[] = first.jmdict?.[0]?.meanings?.[0]?.glosses || [];
      if (glosses.length > 0) {
        meaningsEl.innerHTML = glosses.slice(0, 4).map(g => `• ${g}`).join('<br>');
      } else {
        meaningsEl.innerHTML = '<span style="color:#6c7086">（无词典数据）</span>';
      }

      // 例句
      const ex = data.examples?.[0];
      if (ex) {
        document.getElementById('kky-examples')!.textContent = `例: ${ex.text}`;
      }

      // JLPT
      const jlpt = first.jmdict?.[0]?.jlpt;
      if (jlpt) {
        document.getElementById('kky-jlpt')!.textContent = `JLPT ${jlpt}`;
      }
    })
    .catch(() => {
      document.getElementById('kky-meanings')!.innerHTML = '<span style="color:#f38ba8">查询失败</span>';
    });

  // 获取上下文句子：优先取高亮词所在的段落，fallback 到整个高亮区域的父容器
  const getSentenceContext = (maxLen: number): string => {
    // 找包含高亮词的最近段落级元素
    const container = span.closest('p, li, td, h1, h2, h3, h4, h5, blockquote, article, section, div');
    if (container && container.textContent && container.textContent.trim().length > surface.length) {
      return container.textContent.trim().slice(0, maxLen);
    }
    // fallback: 找周围所有同级高亮词，拼接成句子
    const parent = span.parentElement;
    if (parent) {
      const allText = Array.from(parent.childNodes)
        .map(n => n.textContent || '')
        .join('')
        .trim();
      if (allText.length > surface.length) return allText.slice(0, maxLen);
    }
    return surface;
  };

  // LLM 按钮
  document.getElementById('kky-explain')!.onclick = async () => {
    const llmEl = document.getElementById('kky-llm')!;
    llmEl.textContent = '✨ 解释中…';
    try {
      const res = await Browser.runtime.sendMessage({
        action: 'llm-explain-grammar',
        sentence: getSentenceContext(300),
        targetWord: surface,
      }) as any;
      llmEl.innerHTML = `<strong>语法解析</strong><br>${res.explanation || '无结果'}`;
    } catch (e: any) { llmEl.textContent = '请求失败: ' + (e?.message || e); }
  };

  document.getElementById('kky-translate')!.onclick = async () => {
    const llmEl = document.getElementById('kky-llm')!;
    llmEl.textContent = '🌐 翻译中…';
    try {
      const res = await Browser.runtime.sendMessage({
        action: 'llm-translate',
        sentence: getSentenceContext(400),
      }) as any;
      llmEl.innerHTML = `<strong>翻译</strong><br>${res.translation || ''}<br><span style="color:#a6adc8;font-size:12px">${res.breakdown || ''}</span>`;
    } catch (e: any) { llmEl.textContent = '请求失败: ' + (e?.message || e); }
  };
}

// 监听高亮词点击
document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  if (target.classList.contains('kaku-yaku-highlight')) {
    e.stopPropagation();
    showPopup(e as MouseEvent, target);
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
