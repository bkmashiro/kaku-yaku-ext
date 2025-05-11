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
