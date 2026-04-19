import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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
  // Chart raw data for programmatic rendering
  candles: CandleData[];
  trendlines: DrawingLine[];
  fibLevels: { price: number; label: string; color: string }[];
  signals: Marker[];
}

const analysisCache: Record<string, AIAnalysis> = {};

export async function getAnalystInsight(assetType: string, assetName: string, timeframe: string): Promise<AIAnalysis> {
  const cacheKey = `${assetType}-${assetName}-${timeframe}`;
  
  if (analysisCache[cacheKey]) {
    return analysisCache[cacheKey];
  }

  const prompt = `
你是一位擁有超過30年經驗的頂級外匯及股市分析師、頂尖量化交易專家。
請搜尋並分析「${assetName} (${assetType})」在「${timeframe}」級別的最新即時價格與市場新聞。

你必須生成一份極具專業度的圖表數據包，包含精確的 K線數據、轉折點、趨勢線坐標以及黃金分割點位。

請透過 JSON Schema 回傳，必須包含以下欄位：
1. macro, signal, advice, entryPrice, takeProfit, stopLoss, trend, support, resistance (與之前要求一致)。
2. candles: 生成最近 120 根 K線的數據。time 格式為 ISO 字串。價格需符合「${assetName}」的真實市價區間（請依據搜尋結果）。
3. trendlines: 數組，每個包含 {price1, time1, price2, time2, color, label}。請找出目前最有意義的支撐/壓力趨勢線。
4. fibLevels: 數組，每個包含 {price, label, color}。依據近期波段高低點生成的黃金分割線 (0, 0.236, 0.382, 0.5, 0.618, 0.786, 1)。
5. signals: 數組，每個包含 {time, type: 'buy'|'sell', text}。標註具體的進場點。

注意：
- 必須確保時間序列 (time) 是連續且單調遞增的。
- 繪圖點位 (trendlines, fibLevels) 必須與 candles 的價格範圍精確對應。
- 趨勢線連線必須符合專業技術分析邏輯（例如：連接高點形成的下降趨勢線）。
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
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
          required: ["macro", "signal", "advice", "entryPrice", "takeProfit", "stopLoss", "trend", "support", "resistance", "fibAnchors", "trendlineAnchors", "candles", "trendlines", "fibLevels", "signals"]
        }
      }
    });
    
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
      candles: parsed.candles || [],
      trendlines: parsed.trendlines || [],
      fibLevels: parsed.fibLevels || [],
      signals: parsed.signals || []
    };

    analysisCache[cacheKey] = result;
    return result;
  } catch (error: any) {
    console.error('Gemini API Error:', error);
    return {
      macro: '分析失敗，請重試。',
      signal: '錯誤。',
      advice: '錯誤。',
      entryPrice: '-', takeProfit: '-', stopLoss: '-', trend: '-', support: '-', resistance: '-', fibAnchors: '-', trendlineAnchors: '-',
      candles: [], trendlines: [], fibLevels: [], signals: []
    };
  }
}
