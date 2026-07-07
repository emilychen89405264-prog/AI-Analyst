//+------------------------------------------------------------------+
//|  GlobalInvest AI EA v2.1                                         |
//|  策略：多時框EMA趨勢 + ATR止損 + 連虧保護 + R:R≥2               |
//|  適用：XAUUSD / GBPUSD / EURUSD / AUDUSD / USDJPY               |
//+------------------------------------------------------------------+
#property copyright "GlobalInvest AI"
#property version   "2.00"
#property strict

#include <Trade\Trade.mqh>
#include <Trade\PositionInfo.mqh>

//--- 輸入參數
input group "=== 品種設定 ==="
input string   InpSymbol        = "";        // 留空=當前圖表品種
input ENUM_TIMEFRAMES InpHTF    = PERIOD_H4; // 高時框 (趨勢過濾)
input ENUM_TIMEFRAMES InpLTF    = PERIOD_H1; // 低時框 (進場訊號)

input group "=== 趨勢指標 ==="
input int      InpEmaFast       = 20;        // 快線 EMA 週期
input int      InpEmaSlow       = 50;        // 慢線 EMA 週期
input int      InpAtrPeriod     = 14;        // ATR 週期

input group "=== 風險控制 ==="
input double   InpLotGold       = 0.01;      // XAUUSD 固定手數
input double   InpLotGBPUSD     = 0.02;      // GBPUSD 固定手數
input double   InpLotEURUSD     = 0.03;      // EURUSD 固定手數
input double   InpLotAUDUSD     = 0.03;      // AUDUSD 固定手數
input double   InpLotUSDJPY     = 0.03;      // USDJPY 固定手數
input double   InpLotDefault    = 0.01;      // 其他品種預設手數
input double   InpMinSL_Gold    = 0.50;      // XAUUSD 最小 SL% (0.5 = ATR保護)
input double   InpMinSL_Forex   = 0.12;      // 外匯最小 SL%
input double   InpRR_Ratio      = 2.0;       // 最小 R:R (TP = SL × RR)
input int      InpMaxLosses     = 3;         // 連虧幾筆後暫停
input int      InpCoolMinutes   = 60;        // 暫停幾分鐘
input double   InpMinConfidence = 75.0;      // 最低進場分數 (0-100)

input group "=== 進場過濾 ==="
input bool     InpUseDailyFilter = true;     // 啟用日線趨勢過濾
input bool     InpUseHTFFilter  = true;      // 啟用 4H 趨勢過濾
input bool     InpUseADX        = true;      // 啟用 ADX 震盪過濾
input int      InpADXPeriod     = 14;        // ADX 週期
input double   InpADXMin        = 20.0;      // 最低 ADX（低於此就是震盪，不進場）
input int      InpSwingBars     = 10;        // Swing High/Low 確認K棒數
input double   InpAtrSLMultiplier = 1.5;     // SL = ATR × 倍數

input group "=== 交易時段 ==="
input int      InpStartHour     = 7;         // 開始交易時間 (GMT+8)
input int      InpEndHour       = 22;        // 結束交易時間 (GMT+8)
input bool     InpTradeMonday   = true;
input bool     InpTradeFriday   = false;     // 週五關閉新倉（避免週末風險）

input group "=== 移動止損 ==="
input bool     InpUseTrailing   = true;      // 啟用移動止損
input double   InpTrailStart    = 0.50;      // 達到 TP 50% 時啟動移動止損
input double   InpBreakevenAt   = 0.35;      // 達到 TP 35% 時移至保本

//--- 全域變數
CTrade         trade;
CPositionInfo  posInfo;

string         gSymbol;
int            hEmaFast_HTF, hEmaSlow_HTF;   // 4H EMA handle
int            hEmaFast_LTF, hEmaSlow_LTF;   // 1H EMA handle
int            hEmaFast_D1,  hEmaSlow_D1;    // Daily EMA handle
int            hAtr_LTF;                      // 1H ATR handle
int            hAdx_HTF;                      // 4H ADX handle

int            gConsecLosses   = 0;
datetime       gCoolUntil      = 0;
ulong          gMagicNumber    = 20260604;
datetime       gLastBarTime    = 0;

//+------------------------------------------------------------------+
//| Expert initialization                                            |
//+------------------------------------------------------------------+
int OnInit()
{
   gSymbol = (InpSymbol == "") ? Symbol() : InpSymbol;
   
   // 依品種設定獨立 Magic Number（避免多品種間干擾）
   if     (StringFind(gSymbol, "XAU") >= 0) gMagicNumber = 20260601;
   else if(StringFind(gSymbol, "GBP") >= 0) gMagicNumber = 20260602;
   else if(StringFind(gSymbol, "EUR") >= 0) gMagicNumber = 20260603;
   else if(StringFind(gSymbol, "AUD") >= 0) gMagicNumber = 20260604;
   else if(StringFind(gSymbol, "JPY") >= 0) gMagicNumber = 20260605;
   else                                      gMagicNumber = 20260600;
   
   // 設定交易參數
   trade.SetExpertMagicNumber(gMagicNumber);
   trade.SetDeviationInPoints(30);
   trade.SetTypeFilling(ORDER_FILLING_IOC);
   
   // 建立指標 handle
   hEmaFast_HTF = iMA(gSymbol, InpHTF,  InpEmaFast, 0, MODE_EMA, PRICE_CLOSE);
   hEmaSlow_HTF = iMA(gSymbol, InpHTF,  InpEmaSlow, 0, MODE_EMA, PRICE_CLOSE);
   hEmaFast_LTF = iMA(gSymbol, InpLTF,  InpEmaFast, 0, MODE_EMA, PRICE_CLOSE);
   hEmaSlow_LTF = iMA(gSymbol, InpLTF,  InpEmaSlow, 0, MODE_EMA, PRICE_CLOSE);
   hEmaFast_D1  = iMA(gSymbol, PERIOD_D1, InpEmaFast, 0, MODE_EMA, PRICE_CLOSE);
   hEmaSlow_D1  = iMA(gSymbol, PERIOD_D1, InpEmaSlow, 0, MODE_EMA, PRICE_CLOSE);
   hAtr_LTF     = iATR(gSymbol, InpLTF,  InpAtrPeriod);
   hAdx_HTF     = iADX(gSymbol, InpHTF,  InpADXPeriod);
   
   if(hEmaFast_HTF == INVALID_HANDLE || hEmaSlow_HTF == INVALID_HANDLE ||
      hEmaFast_LTF == INVALID_HANDLE || hEmaSlow_LTF == INVALID_HANDLE ||
      hAtr_LTF     == INVALID_HANDLE || hAdx_HTF     == INVALID_HANDLE)
   {
      Print("❌ [EA Init] 指標建立失敗，請確認品種正確");
      return INIT_FAILED;
   }
   
   double startLot = CalcLotSize(0);
   Print("✅ [GlobalInvest AI v2.1] 啟動成功 | 品種:", gSymbol,
         " | Magic:", gMagicNumber,
         " | FixedLot:", startLot,
         " | R:R≥", InpRR_Ratio);
   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
//| Expert deinitialization                                          |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   IndicatorRelease(hEmaFast_HTF);
   IndicatorRelease(hEmaSlow_HTF);
   IndicatorRelease(hEmaFast_LTF);
   IndicatorRelease(hEmaSlow_LTF);
   IndicatorRelease(hEmaFast_D1);
   IndicatorRelease(hEmaSlow_D1);
   IndicatorRelease(hAtr_LTF);
   IndicatorRelease(hAdx_HTF);
}

//+------------------------------------------------------------------+
//| 主循環 - 每 Tick 執行                                            |
//+------------------------------------------------------------------+
void OnTick()
{
   // 只在新K棒形成時分析（避免同一根K棒重複進場）
   datetime currentBar = iTime(gSymbol, InpLTF, 0);
   if(currentBar == gLastBarTime) 
   {
      // 即使不是新K棒，也要執行移動止損更新
      if(InpUseTrailing) ManageOpenPositions();
      return;
   }
   gLastBarTime = currentBar;
   
   // === 冷卻期檢查 ===
   if(gCoolUntil > 0 && TimeCurrent() < gCoolUntil)
   {
      int minsLeft = (int)((gCoolUntil - TimeCurrent()) / 60);
      Print("🛑 [連虧保護] 冷卻中，還需 ", minsLeft, " 分鐘");
      return;
   }
   else if(gCoolUntil > 0 && TimeCurrent() >= gCoolUntil)
   {
      gCoolUntil = 0;
      gConsecLosses = 0;
      Print("✨ [連虧保護] 冷卻結束，恢復交易");
   }
   
   // === 交易時段檢查 ===
   if(!IsValidTradingHour()) return;
   
   // === 已有持倉則不再開新倉（同品種）===
   if(HasOpenPosition()) 
   {
      ManageOpenPositions();
      return;
   }
   
   // === 讀取指標數值 ===
   double emaFast_HTF[3], emaSlow_HTF[3];
   double emaFast_LTF[3], emaSlow_LTF[3];
   double emaFast_D1[3],  emaSlow_D1[3];
   double atr[3];
   
   if(!GetIndicatorValues(emaFast_HTF, emaSlow_HTF, emaFast_LTF, emaSlow_LTF, 
                          emaFast_D1, emaSlow_D1, atr)) return;
   
   // === ADX 震盪過濾：4H ADX 低於閨値就是震盪市場，不進場 ===
   double adxVal = 0;
   if(InpUseADX)
   {
      double adxBuf[2];
      if(CopyBuffer(hAdx_HTF, 0, 0, 2, adxBuf) >= 2) adxVal = adxBuf[1];
      if(adxVal < InpADXMin)
      {
         Print("⏸️ [ADX震盪] 4H ADX=", DoubleToString(adxVal,1), " < ", InpADXMin, "，震盪市場不進場");
         return;
      }
   }
   
   // === 多時框趨勢分析 ===
   int trendD1  = GetTrend(emaFast_D1[1],  emaSlow_D1[1]);   // 1=多頭, -1=空頭, 0=不確定
   int trendHTF = GetTrend(emaFast_HTF[1], emaSlow_HTF[1]);
   int trendLTF = GetTrend(emaFast_LTF[1], emaSlow_LTF[1]);
   
   // === 信號評分 ===
   double score = 0;
   int    direction = 0; // 1=BUY, -1=SELL
   
   // 日線趨勢 (權重最高)
   if(InpUseDailyFilter)
   {
      if(trendD1 == 1)       { score += 35; direction = 1; }
      else if(trendD1 == -1) { score += 35; direction = -1; }
      else return; // 日線不明確，不交易
   }
   
   // 4H 趨勢 (必須與日線一致)
   if(InpUseHTFFilter)
   {
      if(trendHTF == direction)  score += 30;
      else if(trendHTF == 0)     score += 5;  // 4H 不明確，扣大分
      else return;  // 4H 逆日線方向，直接跳過
   }
   
   // 1H 訊號確認 (趨勢共振)
   if(trendLTF == direction) score += 20;
   else if(trendLTF != 0)   score -= 15; // 1H 逆向，扣分
   
   // === EMA 交叉確認（新鮮交叉加分）===
   bool freshCrossLTF = IsFreshCross(emaFast_LTF, emaSlow_LTF, direction);
   if(freshCrossLTF) score += 15;
   
   // === XAUUSD 特殊規則：做空需要額外嚴格條件 ===
   bool isGold = (gSymbol == "XAUUSD" || gSymbol == "XAUUSD.");
   if(isGold && direction == -1)
   {
      // 黃金做空必須：1H 也要是空頭 + 日線明確破低
      if(trendLTF != -1 || trendD1 != -1 || trendHTF != -1)
      {
         Print("🔒 [XAUUSD] 做空條件不足，跳過（需三時框同步空頭）");
         return;
      }
      // 額外扣 10 分，讓黃金做空門檻更高
      score -= 10;
   }
   
   // === 回調確認：價格需在 EMA 附近（不追高殺低）===
   double currentPrice = (direction == 1) ? 
                         SymbolInfoDouble(gSymbol, SYMBOL_ASK) : 
                         SymbolInfoDouble(gSymbol, SYMBOL_BID);
   double emaSlowCurrent = emaSlow_LTF[1];
   double pullbackScore = GetPullbackScore(currentPrice, emaSlowCurrent, atr[1], direction);
   score += pullbackScore;
   
   // 🔴 價格拉伸過遠：不追高殺低，直接跳過
   if(pullbackScore < 0)
   {
      Print("⏸️ [SKIP] 價格拉伸過遠（Pullback:", pullbackScore, "），等待回調至 EMA 附近");
      return;
   }
   
   Print("📊 [評分] ", gSymbol, " | D1:", trendD1, " 4H:", trendHTF, " 1H:", trendLTF,
         " | ADX:", DoubleToString(adxVal,1),
         " | CrossBonus:", freshCrossLTF ? 15 : 0, " | Pullback:", pullbackScore,
         " | 總分:", score);
   
   // === 門檻判斷 ===
   if(score < InpMinConfidence)
   {
      Print("⏸️ [HOLD] 評分 ", score, " 低於門檻 ", InpMinConfidence, "，跳過");
      return;
   }
   
   // === 計算 SL / TP ===
   double atrValue = atr[1];
   double slDist   = atrValue * InpAtrSLMultiplier;
   
   // 強制最小止損距離
   double minSLPct = isGold ? InpMinSL_Gold : InpMinSL_Forex;
   double minSLDist = currentPrice * (minSLPct / 100.0);
   if(slDist < minSLDist) 
   {
      slDist = minSLDist;
      Print("[GUARD] SL 擴展至最小距離 ", DoubleToString(minSLPct, 2), "% = ", DoubleToString(slDist, 5));
   }
   
   double tpDist = slDist * InpRR_Ratio;  // 強制 R:R ≥ 2
   
   double sl, tp;
   if(direction == 1)
   {
      sl = currentPrice - slDist;
      tp = currentPrice + tpDist;
   }
   else
   {
      sl = currentPrice + slDist;
      tp = currentPrice - tpDist;
   }
   
   // 正規化價格精度
   int digits = (int)SymbolInfoInteger(gSymbol, SYMBOL_DIGITS);
   sl = NormalizeDouble(sl, digits);
   tp = NormalizeDouble(tp, digits);
   
   // === 計算手數（依風險百分比）===
   double lot = CalcLotSize(slDist);
   if(lot <= 0) { Print("❌ 手數計算失敗"); return; }
   
   // === 執行下單 ===
   bool result = false;
   string comment = StringFormat("AI_v2|Score:%.0f|RR:%.1f", score, InpRR_Ratio);
   
   if(direction == 1)
      result = trade.Buy(lot, gSymbol, currentPrice, sl, tp, comment);
   else
      result = trade.Sell(lot, gSymbol, currentPrice, sl, tp, comment);
   
   if(result)
   {
      Print("✅ [下單成功] ", gSymbol, " ", (direction==1?"BUY":"SELL"),
            " | Lot:", lot, " | Entry:", currentPrice,
            " | SL:", sl, " | TP:", tp,
            " | 評分:", score);
   }
   else
   {
      Print("❌ [下單失敗] Error:", trade.ResultRetcode(), " - ", trade.ResultComment());
   }
}

//+------------------------------------------------------------------+
//| 管理已開倉：移動止損 + 保本                                      |
//+------------------------------------------------------------------+
void ManageOpenPositions()
{
   for(int i = PositionsTotal()-1; i >= 0; i--)
   {
      if(!posInfo.SelectByIndex(i)) continue;
      if(posInfo.Magic() != gMagicNumber) continue;
      if(posInfo.Symbol() != gSymbol) continue;
      
      double entryPrice = posInfo.PriceOpen();
      double sl         = posInfo.StopLoss();
      double tp         = posInfo.TakeProfit();
      double currentPx  = posInfo.PriceCurrent();
      double totalDist  = MathAbs(tp - entryPrice);
      if(totalDist <= 0) continue;
      
      double movedDist  = (posInfo.PositionType() == POSITION_TYPE_BUY) ?
                          (currentPx - entryPrice) : (entryPrice - currentPx);
      double progress   = movedDist / totalDist; // 0.0 ~ 1.0
      
      // ⏱️ 時間止損：持倉 4 根 K 棒仍未前進 0.3 ATR，直接平倉
      double atrBuf_t[2];
      CopyBuffer(hAtr_LTF, 0, 0, 2, atrBuf_t);
      double atrNow = atrBuf_t[1];
      datetime posOpenTime = (datetime)PositionGetInteger(POSITION_TIME);
      int barsOpen = Bars(gSymbol, InpLTF, posOpenTime, TimeCurrent()) - 1;
      if(barsOpen >= 4 && movedDist < atrNow * 0.3)
      {
         trade.PositionClose(posInfo.Ticket());
         Print("⏱️ [時間止損] ", gSymbol, " 持倉", barsOpen, "根K棒無進展（前進",
               DoubleToString(movedDist, 5), " < 0.3ATR=", DoubleToString(atrNow*0.3, 5), "），平倉");
         continue;
      }
      
      double newSL = sl;
      
      // 保本：達到 TP 的 InpBreakevenAt（預設35%）時移至保本 + 鎖住15%SL距離
      if(progress >= InpBreakevenAt && InpUseTrailing)
      {
         double slDist_orig = totalDist / InpRR_Ratio; // 還原原始SL距離
         double bePrice;
         if(posInfo.PositionType() == POSITION_TYPE_BUY)
         {
            bePrice = entryPrice + slDist_orig * 0.15; // 鎖住15%SL距離作為最小獲利
            if(bePrice > sl + Point()) newSL = bePrice;
         }
         else
         {
            bePrice = entryPrice - slDist_orig * 0.15;
            if(bePrice < sl - Point()) newSL = bePrice;
         }
      }
      
      // 移動止損：達到 TP 的 InpTrailStart（預設50%）後，SL 跟著走
      if(progress >= InpTrailStart && InpUseTrailing)
      {
         double trailSL;
         if(posInfo.PositionType() == POSITION_TYPE_BUY)
         {
            // SL 跟隨在當前價 - 0.5 × ATR 的距離
            double atrBuf[2];
            CopyBuffer(hAtr_LTF, 0, 0, 2, atrBuf);
            trailSL = currentPx - atrBuf[1] * 0.8;
            if(trailSL > newSL + Point()) newSL = trailSL;
         }
         else
         {
            double atrBuf[2];
            CopyBuffer(hAtr_LTF, 0, 0, 2, atrBuf);
            trailSL = currentPx + atrBuf[1] * 0.8;
            if(trailSL < newSL - Point()) newSL = trailSL;
         }
      }
      
      // 只在 SL 有實質變動時才送出修改請求
      if(MathAbs(newSL - sl) > Point() * 2)
      {
         newSL = NormalizeDouble(newSL, (int)SymbolInfoInteger(gSymbol, SYMBOL_DIGITS));
         if(trade.PositionModify(posInfo.Ticket(), newSL, tp))
            Print("🔄 [移動止損] Ticket#", posInfo.Ticket(), " SL:", sl, "→", newSL, " (Progress:", DoubleToString(progress*100,1), "%)");
      }
   }
}

//+------------------------------------------------------------------+
//| 交易結果回報 (MT5 內建事件)                                      |
//+------------------------------------------------------------------+
void OnTradeTransaction(const MqlTradeTransaction& trans,
                        const MqlTradeRequest& request,
                        const MqlTradeResult& result)
{
   // 偵測平倉事件，更新連虧計數器
   if(trans.type == TRADE_TRANSACTION_DEAL_ADD)
   {
      ulong dealTicket = trans.deal;
      if(dealTicket <= 0) return;
      
      if(HistoryDealSelect(dealTicket))
      {
         long dealType = HistoryDealGetInteger(dealTicket, DEAL_TYPE);
         long entryType = HistoryDealGetInteger(dealTicket, DEAL_ENTRY);
         long magic = HistoryDealGetInteger(dealTicket, DEAL_MAGIC);
         
         // 只處理本EA的平倉交易
         if(magic != (long)gMagicNumber) return;
         if(entryType != DEAL_ENTRY_OUT) return;
         
         double profit = HistoryDealGetDouble(dealTicket, DEAL_PROFIT);
         
         if(profit < 0)
         {
            gConsecLosses++;
            Print("⚠️ [連虧計數] 目前連虧 ", gConsecLosses, " 筆 | 虧損: ", profit);
            if(gConsecLosses >= InpMaxLosses)
            {
               gCoolUntil = TimeCurrent() + InpCoolMinutes * 60;
               Print("🛑 [保護啟動] 連虧 ", gConsecLosses, " 筆！封鎖交易 ", InpCoolMinutes,
                     " 分鐘至 ", TimeToString(gCoolUntil));
            }
         }
         else
         {
            if(gConsecLosses > 0)
               Print("✅ [連虧重置] 盈利 ", profit, "，連虧計數清零");
            gConsecLosses = 0;
         }
      }
   }
}

//+------------------------------------------------------------------+
//| 輔助函數：讀取所有指標值                                          |
//+------------------------------------------------------------------+
bool GetIndicatorValues(double &emaFH[], double &emaSH[],
                        double &emaFL[], double &emaSL[],
                        double &emaFD[], double &emaSD[],
                        double &atr[])
{
   if(CopyBuffer(hEmaFast_HTF, 0, 0, 3, emaFH) < 3) return false;
   if(CopyBuffer(hEmaSlow_HTF, 0, 0, 3, emaSH) < 3) return false;
   if(CopyBuffer(hEmaFast_LTF, 0, 0, 3, emaFL) < 3) return false;
   if(CopyBuffer(hEmaSlow_LTF, 0, 0, 3, emaSL) < 3) return false;
   if(CopyBuffer(hEmaFast_D1,  0, 0, 3, emaFD) < 3) return false;
   if(CopyBuffer(hEmaSlow_D1,  0, 0, 3, emaSD) < 3) return false;
   if(CopyBuffer(hAtr_LTF,     0, 0, 3, atr)   < 3) return false;
   
   ArraySetAsSeries(emaFH, true); ArraySetAsSeries(emaSH, true);
   ArraySetAsSeries(emaFL, true); ArraySetAsSeries(emaSL, true);
   ArraySetAsSeries(emaFD, true); ArraySetAsSeries(emaSD, true);
   ArraySetAsSeries(atr,   true);
   return true;
}

//+------------------------------------------------------------------+
//| 趨勢方向：1=多頭, -1=空頭, 0=不明確                              |
//+------------------------------------------------------------------+
int GetTrend(double emaFast, double emaSlow)
{
   double gap = MathAbs(emaFast - emaSlow);
   // 如果 EMA 差距太小（擁擠），視為不明確
   if(gap < SymbolInfoDouble(gSymbol, SYMBOL_POINT) * 5) return 0;
   
   if(emaFast > emaSlow) return 1;
   if(emaFast < emaSlow) return -1;
   return 0;
}

//+------------------------------------------------------------------+
//| 新鮮 EMA 交叉（前一根是反向，這根是正向）                         |
//+------------------------------------------------------------------+
bool IsFreshCross(double &emaF[], double &emaS[], int direction)
{
   // [1] 是剛關閉的K棒，[2] 是上上根
   if(direction == 1)
      return (emaF[2] <= emaS[2] && emaF[1] > emaS[1]); // 多頭交叉
   else
      return (emaF[2] >= emaS[2] && emaF[1] < emaS[1]); // 空頭交叉
}

//+------------------------------------------------------------------+
//| 回調評分：價格在 EMA 附近才給分，追高殺低扣分                     |
//+------------------------------------------------------------------+
double GetPullbackScore(double price, double emaSlow, double atr, int direction)
{
   double distFromEMA = price - emaSlow;
   if(direction == -1) distFromEMA = -distFromEMA; // 空頭反向計算
   
   // distFromEMA > 0 = 價格在 emaSlow 同方向外
   if(distFromEMA < 0)
      return 0; // 價格在 EMA 另一側，不給分（可能逆勢）
   else if(distFromEMA <= atr * 0.5)
      return 15; // 最佳：在 EMA 附近（回調進場）
   else if(distFromEMA <= atr * 1.0)
      return 8;  // 尚可：稍微拉開
   else if(distFromEMA <= atr * 2.0)
      return 0;  // 偏離，不加分也不扣分
   else
      return -10; // 嚴重拉伸，扣分（追高/殺低）
}

//+------------------------------------------------------------------+
//| 計算手數（固定手數模式：依品種返回設定值）                          |
//+------------------------------------------------------------------+
double CalcLotSize(double slDistance)
{
   double lot;
   
   // 依品種選擇固定手數
   if     (gSymbol == "XAUUSD"  || gSymbol == "XAUUSD.")  lot = InpLotGold;
   else if(gSymbol == "GBPUSD"  || gSymbol == "GBPUSD.")  lot = InpLotGBPUSD;
   else if(gSymbol == "EURUSD"  || gSymbol == "EURUSD.")  lot = InpLotEURUSD;
   else if(gSymbol == "AUDUSD"  || gSymbol == "AUDUSD.")  lot = InpLotAUDUSD;
   else if(gSymbol == "USDJPY"  || gSymbol == "USDJPY.")  lot = InpLotUSDJPY;
   else                                                    lot = InpLotDefault;
   
   // 確保不超出品種允許範圍
   double minLot  = SymbolInfoDouble(gSymbol, SYMBOL_VOLUME_MIN);
   double maxLot  = SymbolInfoDouble(gSymbol, SYMBOL_VOLUME_MAX);
   double lotStep = SymbolInfoDouble(gSymbol, SYMBOL_VOLUME_STEP);
   
   lot = MathFloor(lot / lotStep) * lotStep;
   lot = MathMax(minLot, MathMin(maxLot, lot));
   return NormalizeDouble(lot, 2);
}

//+------------------------------------------------------------------+
//| 是否有當前品種的持倉（本EA開的）                                   |
//+------------------------------------------------------------------+
bool HasOpenPosition()
{
   for(int i = PositionsTotal()-1; i >= 0; i--)
   {
      if(posInfo.SelectByIndex(i))
         if(posInfo.Symbol() == gSymbol && posInfo.Magic() == gMagicNumber)
            return true;
   }
   return false;
}

//+------------------------------------------------------------------+
//| 交易時段驗證                                                      |
//+------------------------------------------------------------------+
bool IsValidTradingHour()
{
   MqlDateTime dt;
   TimeToStruct(TimeCurrent(), dt);
   
   // 週五不開新倉
   if(!InpTradeFriday && dt.day_of_week == 5) return false;
   // 週一過濾
   if(!InpTradeMonday && dt.day_of_week == 1) return false;
   // 週末絕對不交易
   if(dt.day_of_week == 0 || dt.day_of_week == 6) return false;
   
   // 時段 (UTC+8 轉換，MT5伺服器通常是 UTC+2 或 UTC+3)
   // 這裡用伺服器時間的 hour 做簡單過濾
   // 台北 7:00-22:00 = 伺服器約 1:00-16:00 (UTC+2偏移-6)
   // 直接用本地24小時判斷即可（已考慮 GM 偏移）
   int serverHour = dt.hour;
   if(serverHour < InpStartHour - 6 || serverHour > InpEndHour - 6) return false;
   
   return true;
}
//+------------------------------------------------------------------+
