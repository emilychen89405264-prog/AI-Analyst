import React, { useState, useEffect } from 'react';
import { 
  Activity, TrendingUp, Coins, LineChart, BrainCircuit, RefreshCcw, 
  ChevronDown, Clock, Eye, Sparkles, Globe, BarChart3, Rocket, 
  ShieldCheck, Zap, Info, ArrowUpRight, ArrowDownRight, Target, Menu, X, Lock
} from 'lucide-react';
import { getAnalystInsight, AIAnalysis, getGlobalOpportunities, Opportunity } from './services/aiService';
import { cn } from './lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { AdvancedRealTimeChart } from "react-ts-tradingview-widgets";
import { TradeDashboard } from './components/TradeDashboard';
import { ChatAssistant } from './components/ChatAssistant';

// --- Types & Constants ---
export type AppView = 'macro' | 'forex' | 'detail' | 'dashboard';

const SIDEBAR_ITEMS = [
  { id: 'macro', name: '全球宏觀趨勢', icon: Globe },
  { id: 'forex', name: '外匯市場分析', icon: BarChart3 },
];

const YF_SYMBOL_MAP: Record<string, string> = {
  'EUR/USD': 'EURUSD=X', 'USD/JPY': 'USDJPY=X', 'GBP/USD': 'GBPUSD=X', 'US30': 'YM=F', 
  'NAS100': 'NQ=F', 'XAU/USD': 'GC=F', 'AAPL': 'AAPL', 'TSLA': 'TSLA', 'NVDA': 'NVDA'
};

const MT5_SYMBOL_MAP: Record<string, string> = {
  'EUR/USD': 'EURUSD', 
  'EURUSD': 'EURUSD',
  'US30': 'US30M', 
  'NAS100': 'USTEC', 
  'XAU/USD': 'XAUUSD',
  'XAUUSD': 'XAUUSD',
  'USDJPY': 'USDJPY'
};

// --- Components ---

const SignalCard: React.FC<{ 
  opportunity: Opportunity; 
  onExecute: (op: Opportunity) => void;
  executing: boolean;
  verified?: boolean;
}> = ({ opportunity, onExecute, executing, verified }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#151521]/80 backdrop-blur-md rounded-2xl border border-gray-800/50 overflow-hidden hover:border-blue-500/50 transition-all group"
    >
      <div className="p-5 space-y-4">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">
              {opportunity.name} ({opportunity.symbol})
            </h3>
            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
              <Clock size={12} /> {new Date().toLocaleTimeString()} 更新
              <span className="bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/20">
                1H 結清
              </span>
            </div>
          </div>
          <div className={cn(
            "px-3 py-1.5 rounded-xl font-bold flex items-center gap-1 text-sm shadow-lg",
            opportunity.action === 'BUY' ? "bg-green-500 text-white" : "bg-red-500 text-white"
          )}>
            {opportunity.action === 'BUY' ? <ArrowUpRight size={16}/> : <ArrowDownRight size={16}/>}
            {opportunity.action === 'BUY' ? '做多 (LONG)' : '做空 (SHORT)'}
          </div>
        </div>

        {/* Confidence & Win Rate */}
        <div className="flex items-center gap-4">
          <div className="bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-lg flex items-center gap-2">
            <ShieldCheck size={14} className="text-green-500" />
            <span className="text-xs font-bold text-green-400">預估勝率 {opportunity.winRate}%</span>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 rounded-lg flex items-center gap-2">
            <Zap size={14} className="text-blue-500" />
            <span className="text-xs font-bold text-blue-400">信心指數 {opportunity.confidence}%</span>
          </div>
        </div>

        {/* Details */}
        <div className="space-y-3">
          <div className="bg-[#0f0f18] rounded-xl p-3 border border-gray-800/50">
            <div className="flex items-center gap-1.5 text-blue-400 text-xs font-bold mb-1">
              <Rocket size={12} /> 獲利關鍵催化劑
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">{opportunity.catalyst}</p>
          </div>
          <div className="bg-[#0f0f18] rounded-xl p-3 border border-gray-800/50">
            <div className="flex items-center gap-1.5 text-purple-400 text-xs font-bold mb-1">
              <BarChart3 size={12} /> 技術與量化邏輯
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">{opportunity.logic}</p>
          </div>
        </div>

        {/* Order Details */}
        <div className="grid grid-cols-3 gap-2 py-2 border-t border-gray-800/50">
          <div>
            <div className="text-[10px] text-gray-500 uppercase font-bold text-center">Entry</div>
            <div className="text-sm font-mono text-white text-center flex flex-col items-center gap-1">
              {(opportunity.entryPrice || 0).toFixed(opportunity.symbol.includes('/') ? 5 : 2)}
              {verified && (
                <span className="text-[8px] text-green-500 font-bold bg-green-500/10 px-1 rounded flex items-center gap-0.5">
                  <ShieldCheck size={8} /> MT5
                </span>
              )}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase font-bold text-center">TP (目標)</div>
            <div className="text-sm font-mono text-green-400 text-center">
              {opportunity.entryPrice 
                ? (opportunity.action === 'BUY' 
                    ? (opportunity.entryPrice * (1 + opportunity.tp_pct/100))
                    : (opportunity.entryPrice * (1 - opportunity.tp_pct/100))
                  ).toFixed(opportunity.symbol.includes('/') ? 5 : 2)
                : '---'
              }
            </div>
            <div className="text-[10px] text-green-500/50 text-center">+{opportunity.tp_pct}%</div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase font-bold text-center">SL (保護)</div>
            <div className="text-sm font-mono text-red-400 text-center">
              {opportunity.entryPrice 
                ? (opportunity.action === 'BUY' 
                    ? (opportunity.entryPrice * (1 - opportunity.sl_pct/100))
                    : (opportunity.entryPrice * (1 + opportunity.sl_pct/100))
                  ).toFixed(opportunity.symbol.includes('/') ? 5 : 2)
                : '---'
              }
            </div>
            <div className="text-[10px] text-red-500/50 text-center">-{opportunity.sl_pct}%</div>
          </div>
        </div>

        {/* Action */}
        <button
          onClick={() => onExecute(opportunity)}
          disabled={executing}
          className={cn(
            "w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg",
            executing 
              ? "bg-gray-700 cursor-not-allowed" 
              : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white active:scale-[0.98]"
          )}
        >
          {executing ? <RefreshCcw size={18} className="animate-spin" /> : <Sparkles size={18} />}
          立即在 MT5 執行下單
        </button>
      </div>
    </motion.div>
  );
};

export default function App() {
  const [currentView, setCurrentView] = useState<AppView>('macro');
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loadingOps, setLoadingOps] = useState(false);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [nextRefresh, setNextRefresh] = useState(60); // 1分鐘倒數(秒)
  const [autoTradedSymbols, setAutoTradedSymbols] = useState<Set<string>>(new Set());
  // --- 智能解析網址參數 (初始化階段) ---
  const params = new URLSearchParams(window.location.search);
  const urlBackend = params.get('backend');
  const urlPin = params.get('pin');
  const THE_PIN = "8888"; 

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    // 增加安全檢查，確保在瀏覽器環境執行
    if (typeof window === 'undefined') return false;
    
    if (urlPin === THE_PIN) {
      localStorage.setItem('isAuth', 'true');
      return true;
    }
    return localStorage.getItem('isAuth') === 'true';
  });

  const [pin, setPin] = useState(urlPin || '');
  const [customApiUrl, setCustomApiUrl] = useState(() => {
    if (urlBackend) {
      localStorage.setItem('customApiUrl', urlBackend);
      return urlBackend;
    }
    return localStorage.getItem('customApiUrl') || '';
  });

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showApiSettings, setShowApiSettings] = useState(false);
  const [verifiedPrices, setVerifiedPrices] = useState<Record<string, boolean>>({});
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [detailedError, setDetailedError] = useState<string | null>(null);

  // 清除網址上的參數，保護隱私
  useEffect(() => {
    if (urlBackend || urlPin) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const fetchOps = async () => {
    // 1. 【核心掃描】提升頻率至 1 分鐘，並精確比對品種執行應急平倉
    try {
      const API_BASE = customApiUrl || `http://${window.location.hostname}:3001`;
      const historyRes = await fetch(`${API_BASE}/api/trade-history?t=` + Date.now(), {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      const history = await historyRes.json();
      const openPositions = Array.isArray(history) ? history.filter((h: any) => h.status === 'OPEN') : [];

      const categories = ['外匯市場分析', '全球宏觀趨勢'];
      for (const cat of categories) {
        const marketData = await getGlobalOpportunities(cat);
        for (const op of marketData) {
          const mt5Symbol = MT5_SYMBOL_MAP[op.symbol] || op.symbol.replace('/', '');
          
          // --- A. 精確比對反向訊號 ---
          const currentPos = openPositions.find((p: any) => {
            const pSym = p.symbol.toUpperCase().replace('/', '');
            const opSym = op.symbol.toUpperCase().replace('/', '');
            return pSym === opSym || p.symbol === op.symbol;
          });

          if (currentPos && op.confidence > 90 && currentPos.action !== op.action) {
            console.log(`🚨 [EMERGENCY REVERSAL] 偵測到反向訊號 (${op.confidence}%): ${op.symbol}. 執行平倉!`);
            const API_BASE = customApiUrl || `http://${window.location.hostname}:3001`;
            fetch(`${API_BASE}/api/close-position`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json', 
                'Authorization': THE_PIN,
                'ngrok-skip-browser-warning': 'true'
              },
              body: JSON.stringify({ symbol: op.symbol, mt5_symbol: mt5Symbol })
            });
          }

          // --- B. 嚴格自動下單白名單 (僅限 XAUUSD, GBPUSD, GBPJPY) ---
          const allowedSymbols = ['XAUUSD', 'GBPUSD', 'GBPJPY'];
          const normalizedSym = op.symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
          const isAllowed = allowedSymbols.some(s => normalizedSym.includes(s));
          
          if (op.confidence > 85 && !autoTradedSymbols.has(op.symbol) && isAllowed && !currentPos) {
            console.log(`[AUTO-PILOT] 背景捕獲高信心訊號 (${op.confidence}%): ${op.symbol}`);
            setAutoTradedSymbols(prev => new Set(prev).add(op.symbol));
            handleExecuteTrade(op, true);
          } else if (isBlocked && op.confidence > 85) {
            console.log(`[OBSERVE-ONLY] ${op.symbol} 僅供觀測，已跳過自動下單`);
          }
        }
      }
    } catch (e) {
      console.warn('背景市場掃描或平倉邏輯失敗', e);
    }

    if (['macro', 'forex', 'stock', 'crypto'].includes(currentView)) {
      setLoadingOps(true);
      const category = SIDEBAR_ITEMS.find(i => i.id === currentView)?.name || '全球宏觀趨勢';
      const data = await getGlobalOpportunities(category);
      
      // --- 加強：從 MT5 抓取真實價格進行覆蓋 ---
      try {
        const mt5Symbols = data.map(op => MT5_SYMBOL_MAP[op.symbol] || op.symbol.replace('/', ''));
        const API_BASE = customApiUrl || `http://${window.location.hostname}:3001`;
        const priceRes = await fetch(`${API_BASE}/api/prices?symbols=${encodeURIComponent(mt5Symbols.join(','))}&_t=${Date.now()}`, {
          headers: { 
            'Authorization': THE_PIN,
            'ngrok-skip-browser-warning': 'true'
          }
        });
        
        const allPrices = await priceRes.json();
        
        if (!priceRes.ok) {
          throw new Error(allPrices.error || `Server returned ${priceRes.status}`);
        }

        const newVerified: Record<string, boolean> = {};

        data.forEach(op => {
          const sym = op.symbol.toUpperCase().replace('/', '');
          // 搜尋最匹配的 key
          let bestMatch = null;
          if (allPrices[sym]) bestMatch = allPrices[sym];
          else if (allPrices[op.symbol.toUpperCase()]) bestMatch = allPrices[op.symbol.toUpperCase()];
          else {
            // 模糊搜尋 (處理 XAUUSD.pro 等情況)
            const key = Object.keys(allPrices).find(k => k.includes(sym) || sym.includes(k));
            if (key) bestMatch = allPrices[key];
          }

          if (bestMatch && bestMatch.last > 0) {
            op.entryPrice = bestMatch.last;
            newVerified[op.symbol] = true;
          }
        });
        setVerifiedPrices(newVerified);
        setIsBackendConnected(true);
        setDetailedError(null);
      } catch (err: any) {
        console.error('Price Sync Error (Continuing with AI prices):', err);
        // 價格同步失敗沒關係，我們繼續顯示 AI 數據並執行邏輯
      }

      setOpportunities(data);
      setLoadingOps(false);
      setNextRefresh(60); 
    }
  };

  // 1. 切換分頁時立即掃描
  useEffect(() => {
    fetchOps();
  }, [currentView]);

  // 2. 15 分鐘定時刷新邏輯
  useEffect(() => {
    const timer = setInterval(() => {
      setNextRefresh(prev => {
        if (prev <= 1) {
          fetchOps(); // 時間到，執行掃描
          return 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [currentView]);

  const handleExecuteTrade = async (op: Opportunity, isAuto = false) => {
    if (op.symbol.toUpperCase().includes('US30')) {
      alert('【觀測模式】US30 目前僅供數據觀測，自動/手動下單功能已暫時禁用。');
      return;
    }
    if (!isAuto && !window.confirm(`確定要針對 ${op.symbol} 執行 AI 自動下單 (MT5) 嗎？`)) return;
    
    const API_BASE = customApiUrl || `http://${window.location.hostname}:3001`;
    setExecutingId(op.symbol);
    try {
      console.log(`🚀 [EXECUTE] Sending trade to: ${API_BASE}`);
      const yfSymbol = YF_SYMBOL_MAP[op.symbol] || op.symbol;
      const mt5Symbol = MT5_SYMBOL_MAP[op.symbol] || op.symbol.replace('/', '');
      
      const res = await fetch(`${API_BASE}/api/execute-trade`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': THE_PIN,
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ symbol: yfSymbol, mt5_symbol: mt5Symbol, signal: op }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Server Error ${res.status}`);
      }

      if (!isAuto) alert('✅ 指令送出成功！請查看 MT5。');
    } catch (error: any) {
      console.error('Trade execution error:', error);
      if (!isAuto) {
        alert(`❌ 下單失敗！\n原因：${error.message}\n\n💡 小提醒：如果您是遠端訪問，請確認「進階連線設定」中的「後端網址」是否已填入正確的 Cloudflare 網址。`);
      }
    } finally {
      setExecutingId(null);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0b0b14] flex items-center justify-center p-4">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-[#0f0f1a] p-8 rounded-3xl border border-gray-800 shadow-2xl max-w-sm w-full text-center space-y-6"
        >
          <div className="bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-blue-900/40">
            <Lock className="text-white" size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Access Denied</h2>
            <p className="text-gray-500 text-sm mt-2">請輸入 4 位數交易授權碼</p>
          </div>
          <input 
            type="password" 
            value={pin}
            onChange={(e) => {
              setPin(e.target.value);
              if (e.target.value === THE_PIN) {
                localStorage.setItem('isAuth', 'true');
                setIsAuthenticated(true);
              }
            }}
            placeholder="PIN CODE"
            className="w-full bg-black/40 border border-gray-800 rounded-xl py-4 text-center text-2xl tracking-[1em] font-mono text-blue-400 focus:border-blue-500 outline-none transition-all"
          />
          <p className="text-[10px] text-gray-600">本系統僅限授權設備訪問，請確保連線安全。</p>
          
          <div className="pt-4 border-t border-gray-800">
            <button 
              onClick={() => setShowApiSettings(!showApiSettings)}
              className="text-xs text-gray-500 hover:text-blue-400 transition-colors"
            >
              {showApiSettings ? '收起連線設定' : '進階連線設定 (Ngrok)'}
            </button>
            
            {showApiSettings && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mt-4 space-y-3">
                <div className="text-[10px] text-left text-gray-500">指令中心網址 (Server URL):</div>
                <input 
                  type="text" 
                  value={customApiUrl}
                  onChange={(e) => {
                    let val = e.target.value.trim();
                    // 自動修正網址
                    if (val && !val.startsWith('http')) val = 'https://' + val;
                    if (val.endsWith('/')) val = val.slice(0, -1);
                    
                    setCustomApiUrl(val);
                    localStorage.setItem('customApiUrl', val);
                  }}
                  placeholder="https://xxxx.trycloudflare.com"
                  className="w-full bg-black border border-gray-800 rounded-lg p-2 text-xs text-gray-300 font-mono"
                />
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0b14] text-gray-200 font-sans selection:bg-blue-500/30 overflow-x-hidden flex flex-col">
      
      {/* Top Navigation Bar */}
      <nav className="sticky top-0 z-40 bg-[#0f0f1a]/80 backdrop-blur-xl border-b border-gray-800 px-4 lg:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-1.5 rounded-lg shadow-lg shadow-blue-900/40">
            <Globe className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-lg font-black text-white tracking-tighter uppercase hidden sm:block">
            GlobalInvest <span className="text-blue-500">AI</span>
          </h1>
        </div>

        <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-gray-800">
          {SIDEBAR_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id as AppView)}
              className={cn(
                "px-3 lg:px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                currentView === item.id 
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-900/30" 
                  : "text-gray-400 hover:text-gray-200"
              )}
            >
              <item.icon size={14} />
              <span className={cn(currentView === item.id ? "block" : "hidden md:block")}>{item.name}</span>
            </button>
          ))}
          <div className="w-px h-4 bg-gray-800 mx-1" />
          <button
            onClick={() => setCurrentView('dashboard')}
            className={cn(
              "px-3 lg:px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
              currentView === 'dashboard' 
                ? "bg-purple-600 text-white shadow-lg shadow-purple-900/30" 
                : "text-gray-400 hover:text-gray-200"
            )}
          >
            <Activity size={14} />
            <span className={cn(currentView === 'dashboard' ? "block" : "hidden md:block")}>績效看板</span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-[10px] text-gray-500 font-medium">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="hidden lg:inline uppercase">Gemini AI Active</span>
        </div>
      </nav>

      {/* --- Main Content --- */}
      <main className="flex-1 overflow-y-auto bg-gradient-to-b from-[#0b0b14] to-[#0f0f1a]">
        {currentView === 'dashboard' ? (
          <TradeDashboard 
            apiUrl={customApiUrl || `http://${window.location.hostname}:3001`} 
            authPin={THE_PIN}
          />
        ) : (
          <div className="max-w-6xl mx-auto p-8 space-y-8">
            
            {/* Header Banner */}
            <header className="relative bg-gradient-to-br from-blue-600 to-indigo-900 rounded-2xl lg:rounded-3xl p-6 lg:p-8 overflow-hidden shadow-2xl border border-white/10">
              <div className="relative z-10 space-y-4">
                <div className="flex items-center gap-2 bg-white/10 w-fit px-3 py-1 rounded-full text-[10px] lg:text-xs font-bold text-blue-100 border border-white/10 backdrop-blur-md">
                  <BarChart3 size={12} /> 全球宏觀趨勢深度掃描完成
                </div>
                <h2 className="text-xl lg:text-3xl font-black text-white leading-tight">
                  基於「三重過濾」量化策略，<br className="hidden lg:block" />
                  系統精選 4H 趨勢共振與機構訂單流機會。
                </h2>
                <p className="text-blue-100/70 text-sm max-w-2xl leading-relaxed">
                  所有標的皆已通過多時區 (MTF) 趨勢驗證，並結合 Smart Money Concepts (SMC) 與美元指數相關性，執行 24/7 自動利潤鎖定與防禦性止損。
                </p>
              </div>
              <div className="absolute right-0 top-0 w-1/3 h-full bg-gradient-to-l from-white/10 to-transparent pointer-events-none" />
              <div className="absolute -right-20 -top-20 w-80 h-80 bg-blue-400/20 rounded-full blur-3xl" />
            </header>

            {/* Signal Grid Section */}
            <section className="space-y-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <h3 className="text-lg lg:text-xl font-black text-white flex items-center gap-2">
                  <Zap className="text-yellow-400" /> 高勝率訊號 (MTF + SMC + DXY)
                </h3>
                <div className="flex items-center justify-between lg:justify-end gap-4">
                  {/* Connection Status Badge */}
                  <div className={cn(
                    "flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-bold border",
                    isBackendConnected 
                      ? "bg-green-500/10 text-green-400 border-green-500/20" 
                      : "bg-red-500/10 text-red-400 border-red-500/20 animate-pulse"
                  )}>
                    <div className={cn("w-1.5 h-1.5 rounded-full", isBackendConnected ? "bg-green-500" : "bg-red-500")} />
                    {isBackendConnected ? "MT5 BRIDGE CONNECTED" : "MT5 DISCONNECTED (Using AI Estimates)"}
                  </div>
                  
                  <button 
                    onClick={() => {
                      localStorage.clear();
                      window.location.reload();
                    }}
                    className="text-[9px] text-gray-500 hover:text-red-400 transition-colors"
                  >
                    重設所有設定
                  </button>

                  <div className="text-[9px] lg:text-[10px] bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full border border-blue-500/20 font-bold">
                    下次自動巡邏: {Math.floor(nextRefresh / 60)}:{String(nextRefresh % 60).padStart(2, '0')}
                  </div>
                  <button 
                    onClick={() => fetchOps()}
                    className="p-2 hover:bg-white/5 rounded-full transition-colors text-gray-500 hover:text-white"
                  >
                    <RefreshCcw size={20} className={loadingOps ? 'animate-spin' : ''} />
                  </button>
                  </div>
                </div>
                
                {detailedError && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2 text-[10px] text-red-400 font-mono">
                    ERROR: {detailedError}
                    <br />
                    <span className="text-gray-500 text-[8px]">TIP: 請確認網址包含 https:// 且沒有多餘斜線</span>
                  </div>
                )}

                {/* Debug Info: 顯示目前連線的後端網址 */}
              <div className="bg-black/20 border border-gray-800/30 rounded-lg p-2 flex items-center justify-between">
                <div className="text-[9px] text-gray-500 uppercase font-bold">目前指令中心連線 (Backend URL):</div>
                <div className="text-[10px] text-blue-400 font-mono">
                  {customApiUrl || `http://${window.location.hostname}:3001`}
                </div>
              </div>

              {loadingOps ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-96 bg-white/5 rounded-2xl animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {opportunities.map((op, idx) => (
                    <SignalCard 
                      key={idx} 
                      opportunity={op} 
                      onExecute={handleExecuteTrade} 
                      executing={executingId === op.symbol}
                      verified={verifiedPrices[op.symbol]}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Disclaimer */}
            <footer className="pt-12 pb-6 border-t border-gray-800/50">
              <div className="flex items-start gap-3 bg-red-500/5 border border-red-500/10 p-4 rounded-2xl">
                <Info size={16} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  免責聲明：GlobalInvest AI 提供的所有數據與建議皆基於量化模型分析，僅供學習與研究參考。金融交易涉及高風險，過往表現不代表未來收益。使用者應自行評估財務狀況並承擔所有交易風險。
                </p>
              </div>
            </footer>

          </div>
        )}
      </main>
      {/* AI 聊天助手 */}
      <ChatAssistant 
        apiUrl={customApiUrl || `http://${window.location.hostname}:3001`} 
        authPin={THE_PIN} 
      />
    </div>
  );
}
