//+------------------------------------------------------------------+
//|  AutoSync_EA.mq5                                                 |
//|  掛在任意圖表，每天定時匯出交易紀錄 JSON                          |
//|  不交易，只負責資料同步                                           |
//+------------------------------------------------------------------+
#property copyright "GlobalInvest AI"
#property version   "1.00"
#property description "每日自動匯出 trade_history.json"

input group "=== 同步設定 ==="
input int    InpSyncHour   = 23;     // 每天幾點匯出 (伺服器時間)
input int    InpSyncMinute = 30;     // 幾分匯出
input bool   InpFilterMagic = false; // 只匯出 GlobalInvest EA 的單
input long   InpMagicFilter = 20260604;

int    gLastExportDay = -1;

int OnInit()
{
   EventSetTimer(60); // 每分鐘檢查一次
   Print("✅ [AutoSync] 啟動，每天 ", InpSyncHour, ":", 
         IntegerToString(InpSyncMinute, 2, '0'), " 自動匯出");
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason) { EventKillTimer(); }

void OnTick() {} // 不需要 tick

void OnTimer()
{
   MqlDateTime dt;
   TimeToStruct(TimeCurrent(), dt);
   
   // 已匯出今天就跳過
   if(dt.day == gLastExportDay) return;
   
   // 檢查是否到了指定時間
   if(dt.hour != InpSyncHour || dt.min < InpSyncMinute) return;
   
   // 執行匯出
   if(ExportJSON())
   {
      gLastExportDay = dt.day;
      Print("✅ [AutoSync] 匯出完成 ", TimeToString(TimeCurrent(), TIME_DATE|TIME_MINUTES));
   }
}

bool ExportJSON()
{
   if(!HistorySelect(0, TimeCurrent() + 86400))
   {
      Print("❌ [AutoSync] HistorySelect 失敗");
      return false;
   }
   
   int totalDeals = HistoryDealsTotal();
   
   string json = "{\n";
   json += "  \"account\": {\n";
   json += "    \"login\": "    + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) + ",\n";
   json += "    \"name\": \""   + AccountInfoString(ACCOUNT_NAME)   + "\",\n";
   json += "    \"currency\": \"" + AccountInfoString(ACCOUNT_CURRENCY) + "\",\n";
   json += "    \"balance\": "  + DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE), 2) + ",\n";
   json += "    \"equity\": "   + DoubleToString(AccountInfoDouble(ACCOUNT_EQUITY), 2)  + ",\n";
   json += "    \"exported_at\": \"" + TimeToString(TimeCurrent(), TIME_DATE|TIME_MINUTES) + "\"\n";
   json += "  },\n";
   json += "  \"trades\": [\n";
   
   bool firstTrade = true;
   int  count = 0;
   
   for(int i = 0; i < totalDeals; i++)
   {
      ulong outTicket = HistoryDealGetTicket(i);
      if(outTicket == 0) continue;
      if(HistoryDealGetInteger(outTicket, DEAL_ENTRY) != DEAL_ENTRY_OUT) continue;
      
      long magic = HistoryDealGetInteger(outTicket, DEAL_MAGIC);
      if(InpFilterMagic && magic != InpMagicFilter) continue;
      
      string symbol    = HistoryDealGetString(outTicket, DEAL_SYMBOL);
      double volume    = HistoryDealGetDouble(outTicket, DEAL_VOLUME);
      double closePrice = HistoryDealGetDouble(outTicket, DEAL_PRICE);
      double profit    = HistoryDealGetDouble(outTicket, DEAL_PROFIT);
      double commission = HistoryDealGetDouble(outTicket, DEAL_COMMISSION);
      double swap      = HistoryDealGetDouble(outTicket, DEAL_SWAP);
      datetime closeTime = (datetime)HistoryDealGetInteger(outTicket, DEAL_TIME);
      long positionId  = HistoryDealGetInteger(outTicket, DEAL_POSITION_ID);
      string comment   = HistoryDealGetString(outTicket, DEAL_COMMENT);
      
      double   entryPrice = 0;
      datetime entryTime  = 0;
      string   direction  = "BUY";
      
      for(int j = 0; j < totalDeals; j++)
      {
         ulong inTk = HistoryDealGetTicket(j);
         if(inTk == 0) continue;
         if(HistoryDealGetInteger(inTk, DEAL_ENTRY) != DEAL_ENTRY_IN) continue;
         if(HistoryDealGetInteger(inTk, DEAL_POSITION_ID) != positionId) continue;
         entryPrice = HistoryDealGetDouble(inTk, DEAL_PRICE);
         entryTime  = (datetime)HistoryDealGetInteger(inTk, DEAL_TIME);
         direction  = (HistoryDealGetInteger(inTk, DEAL_TYPE) == DEAL_TYPE_BUY) ? "BUY" : "SELL";
         break;
      }
      
      double netProfit    = profit + commission + swap;
      int    holdMinutes  = (closeTime > entryTime) ? (int)((closeTime - entryTime) / 60) : 0;
      double priceDiff    = (direction == "BUY") ? (closePrice - entryPrice) : (entryPrice - closePrice);
      double pctGain      = (entryPrice > 0) ? (priceDiff / entryPrice * 100.0) : 0;
      
      if(!firstTrade) json += ",\n";
      firstTrade = false;
      
      json += "    {";
      json += "\"ticket\":" + IntegerToString(outTicket)   + ",";
      json += "\"position_id\":" + IntegerToString(positionId) + ",";
      json += "\"symbol\":\"" + symbol + "\",";
      json += "\"direction\":\"" + direction + "\",";
      json += "\"volume\":" + DoubleToString(volume, 2) + ",";
      json += "\"entry_price\":" + DoubleToString(entryPrice, 5) + ",";
      json += "\"close_price\":" + DoubleToString(closePrice, 5) + ",";
      json += "\"entry_time\":\"" + TimeToString(entryTime,  TIME_DATE|TIME_MINUTES) + "\",";
      json += "\"close_time\":\"" + TimeToString(closeTime,  TIME_DATE|TIME_MINUTES) + "\",";
      json += "\"profit\":" + DoubleToString(profit, 2) + ",";
      json += "\"commission\":" + DoubleToString(commission, 2) + ",";
      json += "\"swap\":" + DoubleToString(swap, 2) + ",";
      json += "\"net_profit\":" + DoubleToString(netProfit, 2) + ",";
      json += "\"hold_minutes\":" + IntegerToString(holdMinutes) + ",";
      json += "\"pct_gain\":" + DoubleToString(pctGain, 4) + ",";
      json += "\"magic\":" + IntegerToString(magic) + ",";
      json += "\"comment\":\"" + comment + "\"";
      json += "}";
      count++;
   }
   
   json += "\n  ]\n}";
   
   string filename = "trade_history.json";
   int fh = FileOpen(filename, FILE_WRITE|FILE_TXT|FILE_ANSI);
   if(fh == INVALID_HANDLE)
   {
      Print("❌ [AutoSync] 無法寫入檔案: ", GetLastError());
      return false;
   }
   FileWriteString(fh, json);
   FileClose(fh);
   
   string fullPath = TerminalInfoString(TERMINAL_DATA_PATH) + "\\MQL5\\Files\\" + filename;
   Print("📁 [AutoSync] 已儲存 ", count, " 筆 → ", fullPath);
   return true;
}
