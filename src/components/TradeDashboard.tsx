import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Clock, DollarSign, Target, Shield, CheckCircle, RefreshCcw, Coins, BarChart3 } from 'lucide-react';
import { cn } from '../lib/utils';

interface TradeRecord {
  id: number;
  time: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  entry_price: number;
  take_profit: number;
  stop_loss: number;
  reason: string;
  profit: number | null;
  status: 'OPEN' | 'CLOSED';
  volume?: number;
}

export const TradeDashboard: React.FC<{ apiUrl?: string; authPin?: string }> = ({ apiUrl, authPin }) => {
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchTrades = () => {
    setLoading(true);
    const API_BASE = apiUrl || `http://${window.location.hostname}:3001`;
    fetch(`${API_BASE}/api/trade-history?t=` + Date.now(), {
      headers: {
        'ngrok-skip-browser-warning': 'true'
      }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setTrades([...data].reverse());
        } else {
          console.error("交易數據格式錯誤:", data);
          setTrades([]);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("無法讀取交易歷史", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchTrades();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    const API_BASE = apiUrl || `http://${window.location.hostname}:3001`;
    
    // 前端 20 秒強制超時
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
      const res = await fetch(`${API_BASE}/api/sync-profits`, { 
        method: 'POST',
        headers: { 
          'Authorization': authPin || '8888',
          'ngrok-skip-browser-warning': 'true'
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      const data = await res.json();
      if (res.ok) {
        alert('獲利同步成功！');
        fetchTrades(); // 修正為正確的函數名稱
      } else {
        alert('同步失敗: ' + (data.error || '可能是 MT5 沒開或是連線超時'));
      }
    } catch (e: any) {
      if (e.name === 'AbortError') {
        alert('同步超時：電腦端的 MT5 回應太慢，請確認 MT5 是否正常運作。');
      } else {
        alert('無法連線至指令中心，請檢查網址設定');
      }
    } finally {
      setSyncing(false);
    }
  };

  const realizedTrades = trades.filter(t => t.status === 'CLOSED');
  const totalProfit = realizedTrades.reduce((sum, trade) => sum + (trade.profit || 0), 0);
  const totalLoss = realizedTrades.filter(t => (t.profit || 0) < 0).reduce((sum, trade) => sum + Math.abs(trade.profit || 0), 0);
  const floatingProfit = trades.filter(t => t.status === 'OPEN').reduce((sum, trade) => sum + (trade.profit || 0), 0);
  const winCount = realizedTrades.filter(t => (t.profit || 0) > 0).length;
  const closedTrades = realizedTrades.length;
  const winRate = closedTrades > 0 ? ((winCount / closedTrades) * 100).toFixed(1) : 0;

  // --- 項目分析邏輯 (Asset Analysis) ---
  const assetStats = trades.reduce((acc: any, trade) => {
    if (trade.status !== 'CLOSED') return acc;
    const sym = trade.symbol.replace('/', '').toUpperCase();
    if (!acc[sym]) acc[sym] = { symbol: sym, profit: 0, count: 0, wins: 0, losses: 0 };
    acc[sym].profit += trade.profit || 0;
    acc[sym].count += 1;
    if ((trade.profit || 0) > 0) acc[sym].wins += 1;
    else acc[sym].losses += 1;
    return acc;
  }, {});

  const assetList = Object.values(assetStats).sort((a: any, b: any) => b.profit - a.profit);

  if (loading) {
    return <div className="text-white p-8 animate-pulse">載入數據中...</div>;
  }

  return (
    <div className="min-h-screen bg-[#0b0b14] text-gray-100 p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
            AI 量化交易績效看板
          </h1>
          <div className="flex items-center gap-4">
            <button
              onClick={handleSync}
              disabled={syncing}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border transition-all",
                syncing 
                  ? "bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed" 
                  : "bg-blue-600/10 border-blue-500/30 text-blue-400 hover:bg-blue-600/20 active:scale-95"
              )}
            >
              <RefreshCcw size={16} className={syncing ? 'animate-spin' : ''} />
              {syncing ? '同步中...' : '同步實盤獲利'}
            </button>
            <div className="text-sm text-gray-400 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              即時監控中
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="bg-[#151521] rounded-2xl p-5 border border-gray-800 shadow-xl">
            <div className="text-gray-400 text-xs font-medium mb-1 uppercase tracking-wider">淨盈虧 (Net P&L)</div>
            <div className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              ${totalProfit.toFixed(2)}
            </div>
          </div>

          <div className="bg-[#151521] rounded-2xl p-5 border border-red-500/10 shadow-xl">
            <div className="text-red-400 text-xs font-medium mb-1 uppercase tracking-wider">總虧損 (Total Loss)</div>
            <div className="text-2xl font-bold text-red-500">
              -${totalLoss.toFixed(2)}
            </div>
          </div>

          <div className="bg-[#151521] rounded-2xl p-5 border border-blue-500/20 shadow-xl">
            <div className="text-blue-400 text-xs font-medium mb-1 uppercase tracking-wider">浮動損益 (Floating)</div>
            <div className={`text-2xl font-bold ${floatingProfit >= 0 ? 'text-green-400' : 'text-red-400'} animate-pulse`}>
              ${floatingProfit.toFixed(2)}
            </div>
          </div>
          
          <div className="bg-[#151521] rounded-2xl p-5 border border-gray-800 shadow-xl">
            <div className="text-gray-400 text-xs font-medium mb-1 uppercase tracking-wider">勝率 (Win Rate)</div>
            <div className="text-2xl font-bold text-blue-400">
              {winRate}%
            </div>
          </div>

          <div className="bg-[#151521] rounded-2xl p-5 border border-gray-800 shadow-xl">
            <div className="text-gray-400 text-xs font-medium mb-1 uppercase tracking-wider">交易次數 (Total)</div>
            <div className="text-2xl font-bold text-gray-200">
              {closedTrades}
            </div>
          </div>
        </div>

        {/* Asset Analysis Section */}
        <div className="bg-[#151521] rounded-2xl border border-gray-800 shadow-xl overflow-hidden">
          <div className="p-6 border-b border-gray-800 flex items-center justify-between">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <BarChart3 size={20} className="text-blue-400" /> 商品績效分析 (Asset Insights)
            </h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {assetList.map((asset: any) => (
              <div key={asset.symbol} className="bg-[#0f0f18] p-4 rounded-xl border border-gray-800/50 hover:border-blue-500/30 transition-all">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-lg font-bold text-white">{asset.symbol}</span>
                  <span className={cn(
                    "text-sm font-bold px-2 py-0.5 rounded-md",
                    asset.profit >= 0 ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
                  )}>
                    ${asset.profit.toFixed(2)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <div className="text-gray-500 mb-1">勝 / 負</div>
                    <div className="text-gray-300 font-medium">
                      <span className="text-green-400">{asset.wins}W</span>
                      <span className="mx-1">/</span>
                      <span className="text-red-400">{asset.losses}L</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500 mb-1">勝率</div>
                    <div className="text-gray-300 font-medium text-blue-400">
                      {((asset.wins / asset.count) * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {assetList.length === 0 && (
              <div className="col-span-full py-4 text-center text-gray-500 text-sm">
                暫無平倉數據可供分析。
              </div>
            )}
          </div>
        </div>
        <div className="bg-[#151521] rounded-2xl border border-gray-800 shadow-xl overflow-hidden">
          <div className="p-6 border-b border-gray-800">
            <h2 className="text-xl font-semibold">交易明細紀錄</h2>
          </div>
          
          <div className="divide-y divide-gray-800/50">
            {trades.map((trade, idx) => (
              <div key={idx} className="p-6 hover:bg-[#1a1a2e] transition-colors duration-200">
                <div className="flex flex-col lg:flex-row justify-between gap-6">
                  
                  {/* Left: Basic Info */}
                  <div className="space-y-4 lg:w-1/3">
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1
                        ${trade.action === 'BUY' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {trade.action === 'BUY' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                        {trade.action}
                      </span>
                      <span className="font-bold text-lg">{trade.symbol}</span>
                      <span className="text-xs text-gray-500">ID: {trade.id}</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-gray-500 flex items-center gap-1 mb-1"><Clock size={14}/> 進場時間</div>
                        <div className="text-gray-300">{trade.time}</div>
                      </div>
                      <div>
                        <div className="text-gray-500 flex items-center gap-1 mb-1"><Target size={14}/> 進場價</div>
                        <div className="text-gray-300">{trade.entry_price}</div>
                      </div>
                      <div>
                        <div className="text-gray-500 flex items-center gap-1 mb-1"><Coins size={14}/> 單位數</div>
                        <div className="text-gray-300 font-bold text-blue-400">{trade.volume || '0.01'} 手</div>
                      </div>
                      <div>
                        <div className="text-gray-500 flex items-center gap-1 mb-1"><CheckCircle size={14} className="text-green-500"/> TP</div>
                        <div className="text-gray-300">{trade.take_profit}</div>
                      </div>
                      <div>
                        <div className="text-gray-500 flex items-center gap-1 mb-1"><Shield size={14} className="text-red-500"/> SL</div>
                        <div className="text-gray-300">{trade.stop_loss}</div>
                      </div>
                    </div>
                  </div>

                  {/* Middle: AI Reason / Post-Mortem */}
                  <div className="lg:w-1/2">
                    <div className="text-gray-500 text-sm mb-2 font-medium">
                      {trade.status === 'CLOSED' ? '📊 交易復盤分析' : '🤖 AI 決策分析'}
                    </div>
                    <div className={cn(
                      "rounded-lg p-4 text-sm leading-relaxed border",
                      trade.status === 'CLOSED' 
                        ? (trade.profit! > 0 ? "bg-green-500/5 border-green-500/20 text-green-200" : "bg-red-500/5 border-red-500/20 text-red-200")
                        : "bg-[#0f0f18] border-gray-800/50 text-gray-300"
                    )}>
                      {trade.status === 'CLOSED' ? (
                        <div className="space-y-2">
                          <div className="font-bold flex items-center gap-2">
                            {trade.profit! > 0 ? '✅ 獲利平倉' : '❌ 止損平倉'}
                            <span className="text-xs opacity-70">
                              (相對回報: {((trade.profit! / (trade.entry_price * (trade.volume || 0.01))) * 100).toFixed(2)}%)
                            </span>
                          </div>
                          <p className="text-xs opacity-80 italic">
                            進場理由回顧：{trade.reason ? trade.reason.substring(0, 100) : '暫無理由'}...
                          </p>
                          <div className="pt-2 border-t border-white/5 text-[11px] text-gray-400">
                            *分析：此交易已結束。{trade.profit! > 0 ? "策略成功捕捉了趨勢動能。" : "行情反轉觸發了保護性止損。"}
                          </div>
                        </div>
                      ) : (
                        trade.reason || '正在分析中...'
                      )}
                    </div>
                  </div>

                  {/* Right: Profit/Status */}
                   <div className="lg:w-1/6 flex flex-col justify-center items-end border-l border-gray-800 pl-6">
                    <div className="text-sm text-gray-500 mb-2">
                      {trade.status === 'OPEN' ? '浮動損益' : '實際損益'}
                    </div>
                    <div className={`text-2xl font-bold flex flex-col items-end gap-0
                      ${(trade.profit || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {trade.profit !== null ? `$${trade.profit.toFixed(2)}` : 'N/A'}
                      {trade.status === 'OPEN' && (
                        <div className="flex flex-col items-end gap-2 mt-1">
                          <span className="text-[10px] font-bold bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded uppercase animate-pulse">
                            Floating
                          </span>
                          <button 
                            onClick={async () => {
                              if (!window.confirm(`確定要手動平倉 ${trade.symbol} 嗎？`)) return;
                              const API_BASE = apiUrl || `http://${window.location.hostname}:3001`;
                              try {
                                const res = await fetch(`${API_BASE}/api/close-position`, {
                                  method: 'POST',
                                  headers: { 
                                    'Content-Type': 'application/json',
                                    'Authorization': authPin || '8888',
                                    'ngrok-skip-browser-warning': 'true'
                                  },
                                  body: JSON.stringify({ symbol: trade.symbol, mt5_symbol: trade.symbol })
                                });
                                if (res.ok) alert('✅ 平倉指令已送出');
                                else alert('❌ 平倉失敗');
                              } catch (e) {
                                alert('❌ 連線異常');
                              }
                            }}
                            className="text-[10px] bg-red-600 hover:bg-red-500 text-white px-2 py-1 rounded font-bold shadow-lg transition-all active:scale-95"
                          >
                            立即平倉 (EXIT)
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            ))}
            
            {trades.length === 0 && (
              <div className="p-12 text-center text-gray-500">
                目前還沒有任何交易紀錄，請先執行 Python 機器人進行下單！
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
