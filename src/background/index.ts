// Sample code if using extensionpay.com
// import { extPay } from 'src/utils/payment/extPay'
// extPay.startBackground()

import Browser from 'webextension-polyfill';

// 扩展Window接口
declare global {
  interface Window {
    kakuYakuLoaded?: boolean;
    kakuYakuNotified?: boolean;
  }
}

// 定义消息接口
interface ContentScriptMessage {
  action: string;
  url?: string;
  text?: string;
}

interface PingResponse {
  action: string;
}

// 跟踪已加载content script的标签页
const contentScriptTabs = new Set<number>();

// 当扩展安装或更新时执行
Browser.runtime.onInstalled.addListener(() => {
  // 创建右键菜单
  Browser.contextMenus.create({
    id: 'analyze-japanese-text',
    title: '解析日本語',
    contexts: ['selection'], // 只在选中文本时显示
  });
  
  console.info("右键菜单已创建");
});

// 监听content script的就绪消息
Browser.runtime.onMessage.addListener((
  message: unknown, 
  sender: Browser.Runtime.MessageSender
) => {
  const msg = message as ContentScriptMessage;
  if (msg.action === 'content-script-ready' && sender.tab?.id) {
    console.info(`标签页 ${sender.tab.id} (${sender.url}) content script已准备就绪`);
    contentScriptTabs.add(sender.tab.id);
  }
});

// 直接注入代码高亮选中文本
async function injectHighlightScript(tabId: number, text: string): Promise<boolean> {
  try {
    console.info(`尝试直接注入高亮脚本到标签页 ${tabId}...`);
    
    // 注入CSS
    await Browser.scripting.insertCSS({
      target: { tabId },
      css: `
        .kaku-yaku-highlight {
          background-color: rgba(255, 0, 0, 0.3);
          border-radius: 2px;
          padding: 1px 2px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .kaku-yaku-highlight:hover {
          background-color: rgba(255, 0, 0, 0.5);
          box-shadow: 0 0 3px rgba(255, 0, 0, 0.5);
        }
      `
    });
    
    // 注入高亮函数和执行代码
    const results = await Browser.scripting.executeScript({
      target: { tabId },
      func: (selectedText: string) => {
        // 将选中的文本添加红色背景
        function highlightText(text: string) {
          // 查找所有文本节点
          function findTextNodes(element: Node): Text[] {
            const nodes: Text[] = [];
            
            function traverse(node: Node) {
              if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim() !== "") {
                nodes.push(node as Text);
              } else {
                for (let i = 0; i < node.childNodes.length; i++) {
                  traverse(node.childNodes[i]);
                }
              }
            }
            
            traverse(element);
            return nodes;
          }
          
          // 高亮匹配的文本
          const textNodes = findTextNodes(document.body);
          let count = 0;
          
          for (const node of textNodes) {
            const content = node.textContent || "";
            if (content.includes(text)) {
              try {
                const range = document.createRange();
                const startIndex = content.indexOf(text);
                
                range.setStart(node, startIndex);
                range.setEnd(node, startIndex + text.length);
                
                const span = document.createElement("span");
                span.className = "kaku-yaku-highlight";
                span.title = "已解析文本";
                
                range.surroundContents(span);
                count++;
              } catch (e) {
                console.error("高亮文本时出错:", e);
              }
            }
          }
          
          return count;
        }
        
        // 执行高亮并返回结果
        return highlightText(selectedText);
      },
      args: [text]
    });
    
    // 检查执行结果
    const highlightCount = results && results[0] && typeof results[0].result === 'number' ? results[0].result : 0;
    console.info(`直接注入高亮了 ${highlightCount} 处文本`);
    
    return highlightCount > 0;
  } catch (error) {
    console.error(`直接注入高亮脚本失败:`, error);
    return false;
  }
}

// 检查content script是否已准备好
async function isContentScriptReady(tabId: number): Promise<boolean> {
  if (contentScriptTabs.has(tabId)) {
    console.info(`标签页 ${tabId} 已在已知列表中`);
    return true;
  }
  
  try {
    // 尝试发送ping消息来确认content script是否加载
    console.info(`向标签页 ${tabId} 发送ping测试...`);
    const response = await Browser.tabs.sendMessage(tabId, { action: 'ping' }) as PingResponse;
    if (response && response.action === 'pong') {
      // 如果成功响应，添加到已知标签页列表
      console.info(`标签页 ${tabId} ping测试成功`);
      contentScriptTabs.add(tabId);
      return true;
    }
    return false;
  } catch (error) {
    console.warn(`标签页 ${tabId} ping测试失败:`, error);
    return false;
  }
}

// 处理右键菜单点击事件
Browser.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'analyze-japanese-text' && info.selectionText && tab?.id) {
    try {
      console.info(`处理选中文本: "${info.selectionText.substring(0, 20)}..."`);
      
      // 首先发送文本到API进行分析
      await analyzeTextAPI(info.selectionText);
      
      // 然后尝试通过content script处理
      const scriptReady = await isContentScriptReady(tab.id);
      
      if (scriptReady) {
        // 使用content script高亮文本
        console.info(`使用content script高亮文本...`);
        await Browser.tabs.sendMessage(tab.id, {
          action: 'highlight-text',
          text: info.selectionText
        });
        console.info(`已成功发送高亮请求到标签页 ${tab.id}`);
        return;
      }
      
      // 如果content script未准备好，尝试直接注入
      console.info(`Content script未准备好，尝试直接注入...`);
      const injected = await injectHighlightScript(tab.id, info.selectionText);
      
      if (injected) {
        console.info(`直接注入高亮成功`);
        return;
      }
      
      // 如果所有方法都失败，显示错误消息
      console.warn(`所有高亮方法都失败，显示错误消息...`);
      await Browser.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          alert('无法高亮文本。请尝试刷新页面后重试，或检查扩展权限。');
        }
      });
    } catch (error) {
      console.error('处理右键菜单点击时出错:', error);
    }
  }
});

// 清理已关闭标签页的记录
Browser.tabs.onRemoved.addListener((tabId) => {
  contentScriptTabs.delete(tabId);
  console.info(`标签页 ${tabId} 已关闭，清理记录`);
});

// 错误处理
self.onerror = function (message, source, lineno, colno, error) {
  console.error("Background脚本错误:", message, source, lineno, colno);
};

console.info("Background脚本已加载");

// 向API发送文本分析请求
async function analyzeTextAPI(text: string): Promise<void> {
  try {
    console.info(`正在发送文本到API进行分析: "${text.substring(0, 20)}..."`);
    
    // 构建请求参数
    const requestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text })
    };
    
    // 发送请求到API
    const response = await fetch('http://localhost:3001/api/analysis/text', requestOptions);
    
    // 检查响应状态
    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }
    
    // 解析响应数据
    const data = await response.json();
    
    // 打印API响应结果
    console.info('API分析结果:', data);
  } catch (error) {
    console.error('API请求出错:', error);
  }
}

export {};
