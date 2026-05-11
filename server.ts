import express from 'express';
import 'dotenv/config';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import https from 'https';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3001;

// --- Telegram Bot 引擎 (免套件版) ---
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
console.log(`📡 [SYSTEM] Telegram Token 狀態: ${TG_TOKEN ? '已讀取' : '未讀取'}`);
console.log(`📡 [SYSTEM] Telegram Chat ID 狀態: ${TG_CHAT_ID ? '已讀取' : '未讀取'}`);
let lastUpdateId = 0;

function sendTelegramMessage(text: string) {
  if (!TG_TOKEN || !TG_CHAT_ID || TG_TOKEN.includes('請填入')) return;
  console.log(`📤 正在發送 Telegram 回覆...`);
  const data = JSON.stringify({ chat_id: TG_CHAT_ID, text });
  const req = https.request(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    }
  }, (res) => {
    let responseBody = '';
    res.on('data', chunk => responseBody += chunk);
    res.on('end', () => {
      const resp = JSON.parse(responseBody);
      if (resp.ok) console.log(`✅ Telegram 回覆已成功送出！`);
      else console.error(`❌ Telegram 發送失敗:`, resp);
    });
  });
  req.on('error', (e) => console.error(`❌ Telegram 網路錯誤:`, e));
  req.write(data);
  req.end();
}

async function startTelegramPolling() {
  if (!TG_TOKEN || TG_TOKEN.includes('請填入')) return;
  console.log('🤖 Telegram Bot 引擎啟動中...');
  
  setInterval(() => {
    https.get(`https://api.telegram.org/bot${TG_TOKEN}/getUpdates?offset=${lastUpdateId + 1}`, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', async () => {
        try {
          const data = JSON.parse(raw);
          if (data.ok && data.result.length > 0) {
            for (const update of data.result) {
              lastUpdateId = update.update_id;
              const msg = update.message;
              if (msg) {
                console.log(`📩 偵測到 Telegram 訊息來自 ID: ${msg.chat.id}, 內容: ${msg.text}`);
                if (String(msg.chat.id) === String(TG_CHAT_ID)) {
                  console.log(`✅ ID 匹配成功，正在處理訊息...`);
                  const reply = await handleChatLogic(msg.text);
                  sendTelegramMessage(reply);
                } else {
                  console.log(`⚠️ ID 不匹配 (預期: ${TG_CHAT_ID})，忽略此訊息。`);
                }
              }
            }
          }
        } catch (e) {}
      });
    }).on('error', () => {});
  }, 3000); // 每 3 秒檢查一次
}

async function handleChatLogic(text: string): Promise<string> {
  try {
    const key = process.env.GEMINI_API_KEY;
    if (!key || key.includes('請填入')) {
      console.error(`❌ [ERROR] 未在 .env 發現有效的 GEMINI_API_KEY`);
      return "系統未設定 API Key，請檢查 .env 檔案。";
    }
    
    console.log(`🧠 Gemini 正在思考回覆...`);
    const ai = new GoogleGenAI({ apiKey: key });
    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-04-17',
      contents: `你是一位專業的 AI 交易助理 Antigravity。使用者 Emily 傳訊說：${text}\n請用繁體中文簡短回覆。`
    });
    return result.text ?? '抱歉，我沒有生成回應。';
  } catch (e) {
    console.error(`❌ Gemini 錯誤:`, e);
    return "抱歉，我的連線出了點問題，請確認 API Key 是否正確或網路是否穩定。";
  }
}

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning']
}));
app.use(express.json());

app.get('/', (req, res) => {
  res.send('<h1>GlobalInvest AI 指令中心已連線</h1><p>Status: OK</p>');
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// 獲取 Python 執行路徑
const pythonCmd = 'python'; 

const THE_PIN = "8888"; // 與前端一致

const authMiddleware = (req: any, res: any, next: any) => {
  const auth = req.headers['authorization'];
  if (auth !== THE_PIN) {
    console.warn(`Unauthorized access attempt from ${req.ip}`);
    return res.status(401).json({ error: 'Unauthorized: Invalid PIN' });
  }
  next();
};

app.post('/api/execute-trade', authMiddleware, (req, res) => {
  const { symbol, mt5_symbol, signal } = req.body;
  
  if (!symbol) {
    return res.status(400).json({ error: 'Missing symbol' });
  }

  console.log(`Executing trade for ${symbol}...`);
  
  // 使用 spawn 而非 exec 以避免 Windows Shell 轉義問題 (如 | & 等符號)
  const args = ['mt5_ai_bot.py', '--action', 'TRADE', '--symbol', symbol];
  if (mt5_symbol) {
    args.push('--mt5_symbol', mt5_symbol);
  }
  if (signal) {
    args.push('--signal_json', JSON.stringify(signal));
  }

  const py = spawn(pythonCmd, args);
  
  let output = '';
  let errorOutput = '';

  py.stdout.on('data', (data) => {
    const msg = data.toString();
    output += msg;
    console.log(`[Python Stdout]: ${msg.trim()}`);
  });

  py.stderr.on('data', (data) => {
    const msg = data.toString();
    errorOutput += msg;
    console.error(`[Python Stderr]: ${msg.trim()}`);
  });

  py.on('close', (code) => {
    console.log(`Python trade process exited with code ${code}`);
    if (res.headersSent) return; // 避免重複發送 response
    
    if (code !== 0) {
      return res.status(500).json({ error: 'Trade execution failed', detail: errorOutput });
    }
    sendTelegramMessage(`🚀 [自動下單成功]\n輸出資訊：${output.substring(0, 100)}...`);
    res.json({ message: 'Trade execution completed', stdout: output });
  });
});

app.get('/api/prices', authMiddleware, (req, res) => {
  const { symbols } = req.query;
  if (!symbols) return res.status(400).json({ error: 'No symbols' });

  const py = spawn(pythonCmd, ['get_prices.py', '--get_prices', symbols as string]);
  const timeout = setTimeout(() => {
    py.kill();
    if (!res.headersSent) res.status(504).json({ error: 'Price fetch timeout' });
  }, 15000);

  let output = '';
  py.stdout.on('data', (data) => output += data.toString());
  py.on('close', (code) => {
    clearTimeout(timeout);
    if (res.headersSent) return;
    try {
      res.json(JSON.parse(output));
    } catch (e) {
      res.status(500).json({ error: 'Failed to parse prices' });
    }
  });
});

app.post('/api/sync-profits', authMiddleware, (req, res) => {
  console.log('Syncing profits with MT5...');
  
  const py = spawn(pythonCmd, ['mt5_ai_bot.py', '--action', 'SYNC']);
  
  // 15 秒強制超時
  const timeout = setTimeout(() => {
    py.kill();
    if (!res.headersSent) {
      res.status(504).json({ error: 'Sync timeout: MT5 response too slow' });
    }
  }, 15000);

  let output = '';
  let errorOutput = '';

  py.stdout.on('data', (data) => output += data.toString());
  py.stderr.on('data', (data) => errorOutput += data.toString());

  py.on('close', (code) => {
    clearTimeout(timeout);
    console.log(`Sync process exited with code ${code}`);
    if (res.headersSent) return;
    
    if (code !== 0) {
      console.error(`Sync Error: ${errorOutput}`);
      return res.status(500).json({ error: 'Sync failed', detail: errorOutput });
    }
    res.json({ message: 'Profit sync completed', stdout: output });
  });
});

app.get('/api/trade-history', (req, res) => {
  try {
    const historyPath = path.join(__dirname, 'public', 'trade_history.json');
    if (fs.existsSync(historyPath)) {
      const data = fs.readFileSync(historyPath, 'utf-8');
      res.json(JSON.parse(data));
    } else {
      res.json([]);
    }
  } catch (e) {
    res.status(500).json({ error: 'Failed to read trade history' });
  }
});

app.post('/api/chat', authMiddleware, async (req, res) => {
  const { message, history } = req.body;
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
    const chat = ai.chats.create({
      model: 'gemini-2.5-flash-preview-04-17',
      history: [
        { role: "user", parts: [{ text: "你是 Antigravity，一位強大的 AI 交易助手。你正在幫助使用者 Emily 管理她的自動交易系統。請用繁體中文回答，保持專業且親切的語氣。" }] },
        { role: "model", parts: [{ text: "沒問題，我是 Antigravity。Emily，今天有什麼我可以幫你的嗎？" }] },
        ...history
      ],
    });
    const result = await chat.sendMessage({ message });
    res.json({ text: result.text });
  } catch (error: any) {
    console.error('Chat Error:', error);
    res.status(500).json({ error: 'AI 暫時離線中...' });
  }
});

app.post('/api/close-position', authMiddleware, (req, res) => {
  const { symbol, mt5_symbol } = req.body;
  const clientInfo = req.headers['user-agent'] || 'Unknown Device';
  console.log(`🚨 [MANUAL EXIT] 收到平倉請求！來源: ${req.ip}, 設備: ${clientInfo}`);
  console.log(`[EMERGENCY] Closing all positions for ${mt5_symbol || symbol}`);
  
  const py = spawn(pythonCmd, ['mt5_ai_bot.py', '--action', 'CLOSE', '--symbol', symbol, '--mt5_symbol', mt5_symbol || '']);
  
  let output = '';
  py.stdout.on('data', (data) => output += data.toString());
  py.stderr.on('data', (data) => console.error(`[PY-ERR] ${data}`));
  
  py.on('close', (code) => {
    if (code === 0) {
      sendTelegramMessage(`⏹️ [平倉成功] 品種：${symbol}\n來源設備：${clientInfo.substring(0, 30)}...`);
      res.json({ success: true, message: `Closed ${symbol} successfully`, output });
    } else {
      res.status(500).json({ error: 'Close failed', output });
    }
  });
});

// --- 統一 AI 分析緩存中心 ---
let analysisCache: Record<string, { data: any, time: number }> = {};

app.get('/api/analyze', async (req, res) => {
  const { symbol, timeframe } = req.query;
  const cacheKey = `${symbol}-${timeframe}`;
  if (analysisCache[cacheKey] && (Date.now() - analysisCache[cacheKey].time < 300000)) {
    return res.json(analysisCache[cacheKey].data);
  }
  res.json({ needs_refresh: true });
});

app.post('/api/analyze', (req, res) => {
  const { symbol, timeframe, data } = req.body;
  const cacheKey = `${symbol}-${timeframe}`;
  analysisCache[cacheKey] = { data, time: Date.now() };
  console.log(`📡 [SYNC] Shared analysis for ${cacheKey} updated.`);
  res.json({ success: true });
});

let globalOpsCache: Record<string, { data: any, time: number }> = {};

app.get('/api/global-ops', (req, res) => {
  const { category } = req.query;
  const cacheKey = String(category);
  // 5 minutes cache
  if (globalOpsCache[cacheKey] && (Date.now() - globalOpsCache[cacheKey].time < 300000)) {
    return res.json({ data: globalOpsCache[cacheKey].data });
  }
  res.json({ needs_refresh: true });
});

app.post('/api/global-ops', (req, res) => {
  const { category, data } = req.body;
  const cacheKey = String(category);
  globalOpsCache[cacheKey] = { data, time: Date.now() };
  console.log(`📡 [SYNC] Shared global ops for ${cacheKey} updated.`);
  res.json({ success: true });
});

// --- 後端自動化：反向訊號監控與應急平倉 (每 2 分鐘掃描一次) ---
async function startAutoMonitor() {
  const MT5_SYMBOL_MAP: Record<string, string> = {
    'EUR/USD': 'EURUSD', 'EURUSD': 'EURUSD', 'XAU/USD': 'XAUUSD', 'XAUUSD': 'XAUUSD',
    'US30': 'US30M', 'NAS100': 'USTEC', 'USDJPY': 'USDJPY'
  };

  setInterval(async () => {
    console.log('🛡️ [BACKEND MONITOR] 正在執行反向偵測...');
    try {
      const historyPath = path.join(__dirname, 'public', 'trade_history.json');
      if (!fs.existsSync(historyPath)) return;
      const history = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
      const openPositions = history.filter((h: any) => h.status === 'OPEN');
      if (openPositions.length > 0) {
        console.log(`📡 [SYNC] 正在同步 ${openPositions.length} 筆持倉的利潤與風控狀態...`);
        const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
        const py = spawn(pythonCmd, ['mt5_ai_bot.py', '--action', 'SYNC']);
        
        py.on('close', (code) => {
          console.log(`✅ [SYNC] 同步完成 (Code: ${code})`);
        });
      }
    } catch (e) {
      console.error('Monitor Error:', e);
    }
  }, 120000); 
}

startAutoMonitor();

app.listen(port, () => {
  console.log(`🚀 指令中心啟動：http://localhost:${port}`);
  startTelegramPolling();
});
