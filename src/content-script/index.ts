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

// 高亮显示选中的文本
const highlightSelectedText = (selectedText: string) => {
  try {
    console.info("准备高亮文本:", selectedText)
    
    // 创建一个range用于查找文本
    const textNodes = findTextNodes(document.body)
    
    // 遍历所有文本节点，查找并高亮匹配的文本
    let highlightCount = 0
    for (const node of textNodes) {
      const nodeText = node.textContent || ""
      if (nodeText.includes(selectedText)) {
        const range = document.createRange()
        const startIndex = nodeText.indexOf(selectedText)
        
        // 设置range开始和结束位置
        range.setStart(node, startIndex)
        range.setEnd(node, startIndex + selectedText.length)
        
        // 创建一个span元素包裹选中的文本
        const highlightSpan = document.createElement("span")
        highlightSpan.className = "kaku-yaku-highlight"
        highlightSpan.title = "已解析文本"
        
        // 使用range将选中的文本替换为span元素
        range.surroundContents(highlightSpan)
        highlightCount++
      }
    }
    
    console.info(`已成功高亮 ${highlightCount} 处文本`)
  } catch (error) {
    console.error("高亮文本时出错:", error)
  }
}

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
  console.info("收到消息:", message)
  
  if (message.action === "highlight-text" && message.text) {
    highlightSelectedText(message.text)
  } else if (message.action === "ping") {
    // 回复ping以确认content script已加载
    return Promise.resolve({ action: "pong" })
  }
  
  return true
})

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
