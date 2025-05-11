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

// 定义Token接口
interface TokenData {
  surface: string;
  pos: string;
  reading?: string;
  dictionaryForm?: string;
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
      const tokens = await analyzeTextAPI(info.selectionText, tab.id);
      
      if (!tokens) {
        console.warn('API分析没有返回有效数据');
      }
      
      // 然后尝试通过content script处理
      const scriptReady = await isContentScriptReady(tab.id);
      
      if (scriptReady) {
        // 使用content script高亮文本，并传递分析结果
        console.info(`使用content script高亮文本...`);
        await Browser.tabs.sendMessage(tab.id, {
          action: 'highlight-text',
          text: info.selectionText,
          tokens: tokens
        });
        console.info(`已成功发送高亮请求到标签页 ${tab.id}`);
        return;
      }
      
      // 如果content script未准备好，尝试直接注入
      console.info(`Content script未准备好，尝试直接注入...`);
      
      // 先注入CSS
      await Browser.scripting.insertCSS({
        target: { tabId: tab.id },
        css: `
          .kaku-yaku-highlight {
            padding: 1px 2px;
            cursor: pointer;
            border-radius: 2px;
            transition: all 0.2s ease;
            position: relative;
          }
          
          .kaku-yaku-highlight:hover {
            box-shadow: 0 0 3px rgba(0, 0, 0, 0.3);
            opacity: 0.9;
          }
          
          /* 不同词性的颜色 */
          .kaku-yaku-名詞, .kaku-yaku-代名詞 { background-color: rgba(255, 99, 71, 0.3); }
          .kaku-yaku-動詞 { background-color: rgba(65, 105, 225, 0.3); }
          .kaku-yaku-形容詞 { background-color: rgba(60, 179, 113, 0.3); }
          .kaku-yaku-副詞 { background-color: rgba(255, 165, 0, 0.3); }
          .kaku-yaku-助詞 { background-color: rgba(186, 85, 211, 0.3); }
          .kaku-yaku-接続詞 { background-color: rgba(70, 130, 180, 0.3); }
          .kaku-yaku-感動詞 { background-color: rgba(255, 105, 180, 0.3); }
          .kaku-yaku-助動詞 { background-color: rgba(240, 230, 140, 0.3); }
          .kaku-yaku-連体詞 { background-color: rgba(173, 216, 230, 0.3); }
          .kaku-yaku-接頭詞, .kaku-yaku-接尾辞 { background-color: rgba(144, 238, 144, 0.3); }
          .kaku-yaku-接頭辞, .kaku-yaku-接尾辞 { background-color: rgba(144, 238, 144, 0.3); }
          .kaku-yaku-補助記号 { background-color: rgba(169, 169, 169, 0.3); }
          .kaku-yaku-形状詞 { background-color: rgba(138, 43, 226, 0.3); }
          .kaku-yaku-default { background-color: rgba(169, 169, 169, 0.3); }
        `
      });
      
      // 然后直接注入带有分析结果的高亮脚本
      const results = await Browser.scripting.executeScript({
        target: { tabId: tab.id },
        func: (selectedText: string, tokensData: TokenData[] | null) => {
          // 将选中的文本添加不同颜色的背景
          function highlightTextWithTokens(text: string, tokens: TokenData[] | null) {
            // 获取当前选中的范围
            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0) {
              console.warn("无法获取用户选择范围");
              return 0;
            }
            
            try {
              // 创建一个片段用于插入高亮内容
              const range = selection.getRangeAt(0).cloneRange();
              range.deleteContents();
              
              // 如果没有分析结果，使用默认高亮
              if (!tokens || tokens.length === 0) {
                // 创建高亮元素
                const span = document.createElement('span');
                span.className = `kaku-yaku-highlight kaku-yaku-default`;
                span.title = text;
                span.textContent = text;
                
                // 插入元素
                range.insertNode(span);
                
                // 清除选择状态
                selection.removeAllRanges();
                
                return 1;
              }
              
              // 创建包含所有高亮token的文档片段
              const fragment = document.createDocumentFragment();
              
              // 遍历所有tokens，分别创建高亮元素
              tokens.forEach(token => {
                const pos = token.pos || 'default';
                const surface = token.surface;
                
                if (surface) {
                  // 创建span元素
                  const span = document.createElement('span');
                  span.className = `kaku-yaku-highlight kaku-yaku-${pos}`;
                  span.title = `${surface} (${pos})`;
                  span.textContent = surface;
                  
                  // 添加到文档片段
                  fragment.appendChild(span);
                }
              });
              
              // 插入构建好的文档片段
              range.insertNode(fragment);
              
              // 清除选择状态
              selection.removeAllRanges();
              
              return tokens.length;
            } catch (error) {
              console.error("高亮文本时出错:", error);
              return 0;
            }
          }
          
          // 执行高亮并返回结果
          return highlightTextWithTokens(selectedText, tokensData);
        },
        args: [info.selectionText, tokens]
      });
      
      // 检查执行结果
      const highlightCount = results && results[0] && typeof results[0].result === 'number' ? results[0].result : 0;
      console.info(`直接注入高亮了 ${highlightCount} 处文本`);
      
      if (highlightCount > 0) {
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
async function analyzeTextAPI(text: string, tabId: number): Promise<TokenData[] | null> {
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
    
    // 提取所有tokens形成一个扁平结构的分析结果
    const allTokens: TokenData[] = [];
    
    if (data.sentences) {
      data.sentences.forEach((sentence: any) => {
        if (sentence.tokens) {
          sentence.tokens.forEach((token: any) => {
            // 统一API返回的词性值格式
            let pos = token.pos || 'default';
            
            // 确保词性值与CSS类匹配
            // 如果API返回"接頭辞"但CSS使用"接頭詞"，进行转换
            if (pos === '接頭辞') pos = '接頭詞';
            if (pos === '接尾辞') pos = '接尾辞';
            
            allTokens.push({
              surface: token.surface,
              pos: pos,
              reading: token.reading,
              dictionaryForm: token.dictionaryForm
            });
          });
        }
      });
    }
    
    console.info(`共解析了 ${allTokens.length} 个语素`);
    return allTokens;
  } catch (error) {
    console.error('API请求出错:', error);
    return null;
  }
}

export {};
