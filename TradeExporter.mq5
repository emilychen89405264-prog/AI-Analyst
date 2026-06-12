//+------------------------------------------------------------------+
//|  TradeExporter.mq5                                               |
//|  執行後產生 trade_history.json，拖入分析網頁即可                  |
//|  使用方式：Script → 執行 → 選日期範圍                             |
//+------------------------------------------------------------------+
#property script_show_inputs
#property description "匯出交易紀錄到 JSON，供分析網頁使用"

input group "=== 匯出設定 ==="
input datetime InpDateFrom    = 0;           // 開始日期 (0=全部)
input datetime InpDateTo      = 0;           // 結束日期 (0=今天)
input bool     InpFilterMagic = false;       // 只匯出指定 Magic 的單
input long     InpMagicFilter = 20260604;    // Magic Number 過濾

void OnStart()
{
   datetime from = (InpDateFrom == 0) ? 0 : InpDateFrom;
   datetime to   = (InpDateTo   == 0) ? TimeCurrent() + 86400 : InpDateTo;
   
   if(!HistorySelect(from, to))
   {
      Print("❌ HistorySelect 失敗");
      return;
   }
   
   int totalDeals = HistoryDealsTotal();
   Print("📊 找到 ", totalDeals, " 筆 Deals，開始整理...");
   
   // 收集所有 OUT deals（平倉）
   string json = "{\n";
   
   // 帳戶資訊
   json += "  \"account\": {\n";
   json += "    \"login\": " + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) + ",\n";
   json += "    \"name\": \"" + AccountInfoString(ACCOUNT_NAME) + "\",\n";
   json += "    \"currency\": \"" + AccountInfoString(ACCOUNT_CURRENCY) + "\",\n";
   json += "    \"balance\": " + DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE), 2) + ",\n";
   json += "    \"equity\": " + DoubleToString(AccountInfoDouble(ACCOUNT_EQUITY), 2) + ",\n";
   json += "    \"exported_at\": \"" + TimeToString(TimeCurrent(), TIME_DATE|TIME_MINUTES) + "\"\n";
   json += "  },\n";
   json += "  \"trades\": [\n";
   
   bool firstTrade = true;
   int exportCount = 0;
   
   for(int i = 0; i < totalDeals; i++)
   {
      ulong outTicket = HistoryDealGetTicket(i);
      if(outTicket == 0) continue;
      
      // 只處理平倉 deals
      long entryType = HistoryDealGetInteger(outTicket, DEAL_ENTRY);
      if(entryType != DEAL_ENTRY_OUT) continue;
      
      // Magic 過濾
      long magic = HistoryDealGetInteger(outTicket, DEAL_MAGIC);
      if(InpFilterMagic && magic != InpMagicFilter) continue;
      
      // 取得平倉資訊
      string symbol     = HistoryDealGetString(outTicket, DEAL_SYMBOL);
      long   dealType   = HistoryDealGetInteger(outTicket, DEAL_TYPE); // BUY=0, SELL=1 (closing direction)
      double volume     = HistoryDealGetDouble(outTicket, DEAL_VOLUME);
      double closePrice = HistoryDealGetDouble(outTicket, DEAL_PRICE);
      double profit     = HistoryDealGetDouble(outTicket, DEAL_PROFIT);
      double commission = HistoryDealGetDouble(outTicket, DEAL_COMMISSION);
      double swap       = HistoryDealGetDouble(outTicket, DEAL_SWAP);
      datetime closeTime = (datetime)HistoryDealGetInteger(outTicket, DEAL_TIME);
      long   positionId = HistoryDealGetInteger(outTicket, DEAL_POSITION_ID);
      string comment    = HistoryDealGetString(outTicket, DEAL_COMMENT);
      
      // 找配對的開倉 deal (IN) 取得進場價格與方向
      double   entryPrice = 0;
      datetime entryTime  = 0;
      string   direction  = "BUY"; // 開倉方向
      
      for(int j = 0; j < totalDeals; j++)
      {
         ulong inTicket = HistoryDealGetTicket(j);
         if(inTicket == 0) continue;
         if(HistoryDealGetInteger(inTicket, DEAL_ENTRY) != DEAL_ENTRY_IN) continue;
         if(HistoryDealGetInteger(inTicket, DEAL_POSITION_ID) != positionId) continue;
         
         entryPrice = HistoryDealGetDouble(inTicket, DEAL_PRICE);
         entryTime  = (datetime)HistoryDealGetInteger(inTicket, DEAL_TIME);
         direction  = (HistoryDealGetInteger(inTicket, DEAL_TYPE) == DEAL_TYPE_BUY) ? "BUY" : "SELL";
         break;
      }
      
      double netProfit = profit + commission + swap;
      
      // 計算持倉分鐘數
      int holdMinutes = (closeTime > entryTime) ? (int)((closeTime - entryTime) / 60) : 0;
      
      // 計算 R (pips/points 概念用 %)
      double priceDiff = (direction == "BUY") ? (closePrice - entryPrice) : (entryPrice - closePrice);
      double pctGain   = (entryPrice > 0) ? (priceDiff / entryPrice * 100.0) : 0;
      
      if(!firstTrade) json += ",\n";
      firstTrade = false;
      
      json += "    {\n";
      json += "      \"ticket\": "       + IntegerToString(outTicket)  + ",\n";
      json += "      \"position_id\": "  + IntegerToString(positionId) + ",\n";
      json += "      \"symbol\": \""     + symbol                      + "\",\n";
      json += "      \"direction\": \""  + direction                   + "\",\n";
      json += "      \"volume\": "       + DoubleToString(volume, 2)   + ",\n";
      json += "      \"entry_price\": "  + DoubleToString(entryPrice, 5) + ",\n";
      json += "      \"close_price\": "  + DoubleToString(closePrice, 5) + ",\n";
      json += "      \"entry_time\": \"" + TimeToString(entryTime,  TIME_DATE|TIME_MINUTES) + "\",\n";
      json += "      \"close_time\": \"" + TimeToString(closeTime,  TIME_DATE|TIME_MINUTES) + "\",\n";
      json += "      \"profit\": "       + DoubleToString(profit, 2)     + ",\n";
      json += "      \"commission\": "   + DoubleToString(commission, 2) + ",\n";
      json += "      \"swap\": "         + DoubleToString(swap, 2)       + ",\n";
      json += "      \"net_profit\": "   + DoubleToString(netProfit, 2)  + ",\n";
      json += "      \"hold_minutes\": " + IntegerToString(holdMinutes)  + ",\n";
      json += "      \"pct_gain\": "     + DoubleToString(pctGain, 4)    + ",\n";
      json += "      \"magic\": "        + IntegerToString(magic)        + ",\n";
      json += "      \"comment\": \""    + comment                       + "\"\n";
      json += "    }";
      
      exportCount++;
   }
   
   json += "\n  ]\n}";
   
   // 寫入檔案
   string filename = "trade_history.json";
   int fh = FileOpen(filename, FILE_WRITE|FILE_TXT|FILE_ANSI);
   if(fh == INVALID_HANDLE)
   {
      Print("❌ 無法建立檔案: ", GetLastError());
      return;
   }
   FileWriteString(fh, json);
   FileClose(fh);
   
   string fullPath = TerminalInfoString(TERMINAL_DATA_PATH) + "\\MQL5\\Files\\" + filename;
   Print("✅ 匯出完成！共 ", exportCount, " 筆交易");
   Print("📁 檔案位置: ", fullPath);
   Print("👉 把這個 JSON 檔拖入分析網頁即可");
}
