import { GoogleGenAI, Type } from '@google/genai';
import 'dotenv/config';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function getGlobalOpportunities(category: string) {
  const prompt = `
你是一位專注於「機構訂單流 (Order Flow)」與「多時區分析 (MTF)」的量化交易大師。請針對「${category}」進行深度掃描，必須包含：
1. 美股指數 (如：US30 / 道瓊工業平均指數)
2. 貴金屬 (如：XAUUSD / 黃金)
3. 主要外匯對 (如：EURUSD, GBPUSD, USDJPY)
從中篩選出前三個最高質量的機會。

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
9. tp_pct: 止盈比例 (外匯 0.15-0.35%；黃金 0.75-1.1%)
10. sl_pct: 止損比例 (外匯 0.1-0.18%；黃金 0.5-0.75%)
11. entry_price: 目前參考進場價格 (數字型態)
`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
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
  });

  console.log("AI 回傳資料：");
  console.log(response.text);
}

getGlobalOpportunities('外匯市場分析');
getGlobalOpportunities('全球宏觀趨勢');
