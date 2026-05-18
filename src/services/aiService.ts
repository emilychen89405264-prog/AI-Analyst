import { GoogleGenAI, Type } from '@google/genai';
import { TRADING_STRATEGY_SKILL } from './tradingStrategy';

// 優先從 vite.config.ts 的 define 注入中讀取，若無則嘗試 import.meta.env
const API_KEY = (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) || import.meta.env.VITE_GEMINI_API_KEY || '';

if (!API_KEY) {
  console.error('❌ [CRITICAL] GEMINI_API_KEY is missing. AI features will not work.');
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

export interface CandleData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface DrawingLine {
  price1: number;
  time1: string;
  price2: number;
  time2: string;
  color: string;
  label: string;
}

export interface Marker {
  time: string;
  type: 'buy' | 'sell';
  text: string;
}

export interface AIAnalysis {
  macro: string;
  signal: string;
  advice: string;
  entryPrice: string;
  takeProfit: string;
  stopLoss: string;
  trend: string;
  support: string;
  resistance: string;
  fibAnchors: string;
  trendlineAnchors: string;
  // New properties from Trading Strategy skill
  eval_note: number;
  confidence: number;
  eval_note_description: string;
  key_factors: string[];
  recommended_action: 'BUY' | 'SELL' | 'HOLD';
  position_size: 'FULL' | 'MEDIUM' | 'SMALL' | 'NONE';
  entry_strategy: string;
  // Chart raw data for programmatic rendering
  candles: CandleData[];
  trendlines: DrawingLine[];
  fibLevels: { price: number; label: string; color: string }[];
  signals: Marker[];
}

export interface Opportunity {
  symbol: string;
  name: string;
  action: 'BUY' | 'SELL';
  confidence: number;
  catalyst: string;
  logic: string;
  timeframe: string;
  winRate: number;
  status: string;
  entryPrice: number;
  takeProfit: number;
  stopLoss: number;
}

const analysisCache: Record<string, AIAnalysis> = {};

/**
 * 第一階段：情報員 (Researcher)
 * 使用聯網搜尋獲取最新市場資訊，避開 JSON Schema 與 Google Search 的衝突
 */
export async function getLatestMarketNews(subject: string): Promise<string> {
  try {
    console.log(`🌐 [RESEARCHER] 正在聯網搜尋最新情報: ${subject}...`);
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `請針對「${subject}」進行深度搜尋。請總結目前的即時價格、最近一小時內的重大新聞、經濟數據（如 Fed、非農、CPI）以及地緣政治風險。請提供具體的關鍵數據供分析師參考。`,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });
    return response.text || '無法取得最新情報。';
  } catch (e) {
    console.error('Researcher Error:', e);
    return '情報搜尋暫時不可用，將依據內部知識庫分析。';
  }
}

export async function getAnalystInsight(assetType: string, assetName: string, timeframe: string): Promise<AIAnalysis> {
  const cacheKey = `${assetType}-${assetName}-${timeframe}`;
  
  // --- 優先嘗試從後端獲取同步數據 ---
  try {
    const API_BASE = localStorage.getItem('customApiUrl') || `http://${window.location.hostname}:3001`;
    const res = await fetch(`${API_BASE}/api/analyze?symbol=${assetName}&timeframe=${timeframe}`, {
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    const serverData = await res.json();
    if (serverData && !serverData.needs_refresh) {
      console.log('✅ [SYNC] Using synchronized analysis from server.');
      return serverData;
    }
  } catch (e) {
    console.warn('Server sync failed, falling back to local analysis.');
  }

  if (analysisCache[cacheKey]) {
    return analysisCache[cacheKey];
  }

  // 1. 先啟動情報員搜尋最新消息
  const marketNews = await getLatestMarketNews(assetName);

  const prompt = `
你是一位擁有超過30年經驗的頂級外匯及股市分析師、頂尖量化交易專家。
請分析「${assetName} (${assetType})」在「${timeframe}」級別的走勢。

【最新實時情報 (已聯網搜尋)】：
${marketNews}

${TRADING_STRATEGY_SKILL}

你必須生成一份極具專業度的圖表數據包，包含精確的 K線數據、轉折點、趨勢線坐標以及黃金分割點位，同時遵循上述的 Trading Strategy Instructions 來進行決策。

請透過 JSON Schema 回傳，必須包含以下欄位：
1. macro, signal, advice, entryPrice, takeProfit, stopLoss, trend, support, resistance (與之前要求一致)。
2. eval_note, confidence, eval_note_description, key_factors, recommended_action, position_size, entry_strategy (根據 Trading Strategy Instructions 產出)。
3. candles: 生成最近 30 根 K線的數據。time 格式為 ISO 字串。價格需符合「${assetName}」的真實市價區間（請依據搜尋結果或你的內部知識）。
4. trendlines: 數組，每個包含 {price1, time1, price2, time2, color, label}。請找出目前最有意義的支撐/壓力趨勢線。
5. fibLevels: 數組，每個包含 {price, label, color}。依據近期波段高低點生成的黃金分割線 (0, 0.236, 0.382, 0.5, 0.618, 0.786, 1)。
6. signals: 數組，每個包含 {time, type: 'buy'|'sell', text}。標註具體的進場點。

注意：
- 必須確保時間序列 (time) 是連續且單調遞增的。
- 繪圖點位 (trendlines, fibLevels) 必須與 candles 的價格範圍精確對應。
- 趨勢線連線必須符合專業技術分析邏輯（例如：連接高點形成的下降趨勢線）。
`;

  try {
    console.log('Sending request to Gemini API...');
    
    // Add a timeout to prevent infinite loading
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Gemini API Timeout (120s)')), 120000);
    });

    const response = await Promise.race([
      ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
              properties: {
              macro: { type: Type.STRING },
              signal: { type: Type.STRING },
              advice: { type: Type.STRING },
              entryPrice: { type: Type.STRING },
              takeProfit: { type: Type.STRING },
              stopLoss: { type: Type.STRING },
              trend: { type: Type.STRING },
              support: { type: Type.STRING },
              resistance: { type: Type.STRING },
              fibAnchors: { type: Type.STRING },
              trendlineAnchors: { type: Type.STRING },
              eval_note: { type: Type.NUMBER },
              confidence: { type: Type.NUMBER },
              eval_note_description: { type: Type.STRING },
              key_factors: { type: Type.ARRAY, items: { type: Type.STRING } },
              recommended_action: { type: Type.STRING },
              position_size: { type: Type.STRING },
              entry_strategy: { type: Type.STRING },
              candles: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    time: { type: Type.STRING },
                    open: { type: Type.NUMBER },
                    high: { type: Type.NUMBER },
                    low: { type: Type.NUMBER },
                    close: { type: Type.NUMBER }
                  },
                  required: ["time", "open", "high", "low", "close"]
                }
              },
              trendlines: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    price1: { type: Type.NUMBER },
                    time1: { type: Type.STRING },
                    price2: { type: Type.NUMBER },
                    time2: { type: Type.STRING },
                    color: { type: Type.STRING },
                    label: { type: Type.STRING }
                  },
                  required: ["price1", "time1", "price2", "time2", "color", "label"]
                }
              },
              fibLevels: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    price: { type: Type.NUMBER },
                    label: { type: Type.STRING },
                    color: { type: Type.STRING }
                  },
                  required: ["price", "label", "color"]
                }
              },
              signals: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    time: { type: Type.STRING },
                    type: { type: Type.STRING },
                    text: { type: Type.STRING }
                  },
                  required: ["time", "type", "text"]
                }
              }
            },
            required: ["macro", "signal", "advice", "entryPrice", "takeProfit", "stopLoss", "trend", "support", "resistance", "fibAnchors", "trendlineAnchors", "eval_note", "confidence", "eval_note_description", "key_factors", "recommended_action", "position_size", "entry_strategy", "candles", "trendlines", "fibLevels", "signals"]
          }
        }
      }),
      timeoutPromise
    ]) as any;
    
    console.log('Received response from Gemini:', response);
    const parsed = JSON.parse(response.text || '{}');
    const result: AIAnalysis = {
      macro: parsed.macro || '暫無總經資料。',
      signal: parsed.signal || '暫無訊號解析。',
      advice: parsed.advice || '暫無操作建議。',
      entryPrice: parsed.entryPrice || '-',
      takeProfit: parsed.takeProfit || '-',
      stopLoss: parsed.stopLoss || '-',
      trend: parsed.trend || '-',
      support: parsed.support || '-',
      resistance: parsed.resistance || '-',
      fibAnchors: parsed.fibAnchors || '-',
      trendlineAnchors: parsed.trendlineAnchors || '-',
      eval_note: parsed.eval_note || 0,
      confidence: parsed.confidence || 0,
      eval_note_description: parsed.eval_note_description || '-',
      key_factors: parsed.key_factors || [],
      recommended_action: parsed.recommended_action || 'HOLD',
      position_size: parsed.position_size || 'NONE',
      entry_strategy: parsed.entry_strategy || '-',
      candles: parsed.candles || [],
      trendlines: parsed.trendlines || [],
      fibLevels: parsed.fibLevels || [],
      signals: parsed.signals || []
    };

    analysisCache[cacheKey] = result;

    // --- 將結論推送到伺服器分享給其他裝置 ---
    try {
      const API_BASE = localStorage.getItem('customApiUrl') || `http://${window.location.hostname}:3001`;
      fetch(`${API_BASE}/api/analyze`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ symbol: assetName, timeframe, data: result })
      });
    } catch (e) {}

    return result;
  } catch (error: any) {
    console.error('Gemini API Error:', error);
    return {
      macro: '分析失敗，請重試。',
      signal: '錯誤。',
      advice: '錯誤。',
      entryPrice: '-', takeProfit: '-', stopLoss: '-', trend: '-', support: '-', resistance: '-', fibAnchors: '-', trendlineAnchors: '-',
      eval_note: 0, confidence: 0, eval_note_description: '-', key_factors: [], recommended_action: 'HOLD', position_size: 'NONE', entry_strategy: '-',
      candles: [], trendlines: [], fibLevels: [], signals: []
    };
  }
}
export async function getGlobalOpportunities(category: string): Promise<Opportunity[]> {
  // 1. 先啟動情報員進行全市場情報掃描
  const globalNews = await getLatestMarketNews(`${category} 相關之黃金 XAUUSD、美股指數、主要外匯對之即時行情與重大經濟事件`);

  const prompt = `
你是一位專注於「機構訂單流 (Order Flow)」與「多時區分析 (MTF)」的量化交易大師。請針對「${category}」進行深度掃描，必須包含：
1. 美股指數 (如：US30 / 道瓊工業平均指數)
2. 貴金屬 (如：XAUUSD / 黃金)
3. 主要外匯對 (如：EURUSD, GBPUSD, USDJPY)
從中篩選出前三個最高質量的機會。

【最新全市場情報 (已聯網搜尋)】：
${globalNews}

你的分析必須嚴格執行以下「三重過濾」邏輯：
1. 趨勢共振 (Trend Resonance)：必須先判斷 4H 或 Daily 大周期趨勢，1H 訊號必須與大趨勢一致。禁止逆大勢操作！
2. 結構與價格行為 (SMC/Price Action)：識別「供應/需求區」或「斐波那契回撤」區間，並有關鍵燭台確認（如：長影線 Pin Bar、強勢吞噬、假突破 Fakeout）。
3. 外部相關性 (Correlation)：外匯必須參考美元指數 (DXY)。美元強勢時，對非美貨幣 (EUR, GBP, AUD) 保持絕對謹慎。

請務必回傳 JSON 格式陣列，每個物件包含：
1. symbol, name
2. action: 'BUY' | 'SELL'
3. confidence: 0-100 (低於 88% 的機會直接忽略)
4. catalyst: 獲利關鍵催化劑（簡短中文，包含 4H 與 1H 的趨勢共振理由）
5. logic: 技術與量化邏輯（簡短中文，包含價格行為與 DXY 影響描述）
6. timeframe: '1H (4H Confirmed)'
7. winRate: 預估勝率
8. status: '結清' 或 '持倉'
9. tp_pct: 止盈比例 (外匯 0.15-0.35%；黃金 1.5-3.0%)
10. sl_pct: 止損比例 (外匯 0.1-0.18%；黃金 1.0-1.5%)
11. entry_price: 目前參考進場價格 (數字型態)
`;

  try {
    const API_BASE = localStorage.getItem('customApiUrl') || `http://${window.location.hostname}:3001`;
    try {
      const res = await fetch(`${API_BASE}/api/global-ops?category=${encodeURIComponent(category)}`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      const serverData = await res.json();
      if (serverData && !serverData.needs_refresh && Array.isArray(serverData.data)) {
        console.log('✅ [SYNC] Using synchronized global ops from server.');
        return serverData.data;
      }
    } catch (e) {
      console.warn("Failed to fetch shared global ops cache:", e);
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              symbol: { type: Type.STRING },
              name: { type: Type.STRING },
              action: { type: Type.STRING },
              confidence: { type: Type.NUMBER },
              catalyst: { type: Type.STRING },
              logic: { type: Type.STRING },
              timeframe: { type: Type.STRING },
              winRate: { type: Type.NUMBER },
              status: { type: Type.STRING },
              tp_pct: { type: Type.NUMBER },
              sl_pct: { type: Type.NUMBER },
              entry_price: { type: Type.NUMBER }
            },
            required: ["symbol", "name", "action", "confidence", "catalyst", "logic", "timeframe", "winRate", "status", "tp_pct", "sl_pct", "entry_price"]
          }
        }
      }
    }) as any;
    
    const data = JSON.parse(response.text || '[]');
    const finalData = data.map((item: any) => ({
      ...item,
      entryPrice: item.entry_price // 統一欄位名稱
    }));

    try {
      const API_BASE = localStorage.getItem('customApiUrl') || `http://${window.location.hostname}:3001`;
      fetch(`${API_BASE}/api/global-ops`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ category, data: finalData })
      });
    } catch (e) {}

    return finalData;
  } catch (error) {
    console.error('Error fetching opportunities:', error);
    return [];
  }
}
