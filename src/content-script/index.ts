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

const src = chrome.runtime.getURL("src/ui/content-script-iframe/index.html")

const iframe = new DOMParser().parseFromString(
  `<iframe class="crx-iframe ${name}" src="${src}" title="${name}"></iframe>`,
  "text/html",
).body.firstElementChild

if (iframe) {
  document.body?.append(iframe)
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

// 使用tokens高亮文本
const highlightTextWithTokens = (text: string, tokens: TokenData[]): number => {
  try {
    let highlightCount = 0;
    
    // 遍历所有tokens，分别高亮
    tokens.forEach(token => {
      const normalizedPos = normalizePos(token.pos);
      const surface = token.surface;
      
      if (surface) {
        console.info(`高亮 "${surface}" (${normalizedPos})`);
        const count = highlightText(surface, normalizedPos);
        highlightCount += count;
      }
    });
    
    console.info(`成功高亮 ${highlightCount} 处语素`);
    return highlightCount;
  } catch (error) {
    console.error("使用tokens高亮文本时出错:", error);
    return 0;
  }
};

// 根据词性高亮特定文本
const highlightText = (text: string, wordType: string): number => {
  // 查找所有文本节点
  const textNodes = findTextNodes(document.body);
  let count = 0;
  
  // 遍历所有文本节点，查找并高亮匹配的文本
  for (const node of textNodes) {
    const nodeText = node.textContent || "";
    if (nodeText.includes(text)) {
      try {
        const range = document.createRange();
        const startIndex = nodeText.indexOf(text);
        
        // 设置range开始和结束位置
        range.setStart(node, startIndex);
        range.setEnd(node, startIndex + text.length);
        
        // 创建一个span元素包裹选中的文本
        const highlightSpan = document.createElement("span");
        highlightSpan.className = `kaku-yaku-highlight kaku-yaku-${wordType}`;
        highlightSpan.title = `${text} (${wordType})`;
        
        // 使用range将选中的文本替换为span元素
        range.surroundContents(highlightSpan);
        count++;
      } catch (e) {
        console.error(`高亮"${text}"时出错:`, e);
      }
    }
  }
  
  return count;
};

// 查找页面中的所有文本节点
function findTextNodes(element: Node): Text[] {
  const textNodes: Text[] = []
  
  // 递归遍历DOM树
  function traverse(node: Node) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim() !== "") {
      textNodes.push(node as Text)
    } else {
      for (let i = 0; i < node.childNodes.length; i++) {
        traverse(node.childNodes[i])
      }
    }
  }
  
  traverse(element)
  return textNodes
}

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
