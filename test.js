import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function test() {
  const prompt = `
你是一位擁有超過30年經驗的頂級外匯及股市分析師、頂尖量化交易專家。
請搜尋並分析「EUR/USD (forex)」在「日線 (D1)」級別的最新即時價格與市場新聞。

你必須生成一份極具專業度的圖表數據包，包含精確的 K線數據、轉折點、趨勢線坐標以及黃金分割點位。

請透過 JSON Schema 回傳，必須包含以下欄位：
1. macro, signal, advice, entryPrice, takeProfit, stopLoss, trend, support, resistance (與之前要求一致)。
2. candles: 生成最近 50 根 K線的數據。time 格式為 ISO 字串。價格需符合「EUR/USD」的真實市價區間（請依據搜尋結果或你的內部知識）。
3. trendlines: 數組，每個包含 {price1, time1, price2, time2, color, label}。請找出目前最有意義的支撐/壓力趨勢線。
4. fibLevels: 數組，每個包含 {price, label, color}。依據近期波段高低點生成的黃金分割線 (0, 0.236, 0.382, 0.5, 0.618, 0.786, 1)。
5. signals: 數組，每個包含 {time, type: 'buy'|'sell', text}。標註具體的進場點。
`;

  try {
    const startTime = Date.now();
    const response = await ai.models.generateContent({
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
                required: ['time', 'open', 'high', 'low', 'close']
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
                required: ['price1', 'time1', 'price2', 'time2', 'color', 'label']
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
                required: ['price', 'label', 'color']
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
                required: ['time', 'type', 'text']
              }
            }
          },
          required: ['macro', 'signal', 'advice', 'entryPrice', 'takeProfit', 'stopLoss', 'trend', 'support', 'resistance', 'fibAnchors', 'trendlineAnchors', 'candles', 'trendlines', 'fibLevels', 'signals']
        }
      }
    });
    console.log('Success! Length:', response.text.length, 'Time:', Date.now() - startTime, 'ms');
  } catch (err) {
    console.error('Error:', err);
  }
}
test();
