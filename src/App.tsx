import React, { useState, useEffect } from 'react';
import { Activity, TrendingUp, Coins, LineChart, BrainCircuit, RefreshCcw, ChevronDown, Clock, Eye, Sparkles } from 'lucide-react';
import { getAnalystInsight, AIAnalysis } from './services/aiService';
import { cn } from './lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { AdvancedRealTimeChart } from "react-ts-tradingview-widgets";
import { MarketChart } from './components/MarketChart';

export type Timeframe = 'D1' | 'H4' | 'H1' | 'M30' | 'M15' | 'M5' | 'M1';

type AssetCategory = 'forex' | 'stock' | 'index' | 'commodity' | 'crypto';
type ViewMode = 'tradingview' | 'ai-expert';

interface AssetCategoryInfo {
  id: AssetCategory;
  name: string;
  icon: React.ElementType;
  symbols: string[];
}

const ASSETS: AssetCategoryInfo[] = [
  { id: 'forex', name: '外匯 (Forex)', icon: Activity, symbols: ['EUR/USD', 'USD/JPY', 'GBP/USD', 'AUD/USD', 'USD/CAD', 'USD/CHF', 'NZD/USD', 'EUR/JPY', 'GBP/JPY', 'EUR/GBP'] },
  { id: 'stock', name: '美股 (Stocks)', icon: TrendingUp, symbols: ['AAPL', 'TSLA', 'NVDA', 'MSFT'] },
  { id: 'index', name: '指數 (Indices)', icon: LineChart, symbols: ['US30', 'NAS100', 'SPX500'] },
  { id: 'commodity', name: '商品 (Commodities)', icon: Activity, symbols: ['XAU/USD', 'XAG/USD'] },
  { id: 'crypto', name: '加密貨幣 (Crypto)', icon: Coins, symbols: ['BTC/USD', 'ETH/USD', 'SOL/USD', 'BNB/USD', 'ADA/USD'] },
];

const TIMEFRAMES: { id: Timeframe; label: string }[] = [
  { id: 'D1', label: '日線 (D1)' },
  { id: 'H4', label: '4小時 (H4)' },
  { id: 'H1', label: '1小時 (H1)' },
  { id: 'M30', label: '30分 (M30)' },
  { id: 'M15', label: '15分 (M15)' },
  { id: 'M5', label: '5分 (M5)' },
  { id: 'M1', label: '1分 (M1)' },
];

const getSymbolLabel = (sym: string) => {
  if (sym === 'US30') return 'US30 (US Wall Street 30 Index)';
  if (sym === 'NAS100') return 'NAS100 (Nasdaq 100 Index)';
  if (sym === 'SPX500') return 'SPX500 (S&P 500 Index)';
  return sym;
};

const getTVSymbol = (sym: string) => {
  const map: Record<string, string> = {
    'EUR/USD': 'FX:EURUSD',
    'GBP/USD': 'FX:GBPUSD',
    'USD/JPY': 'FX:USDJPY',
    'AUD/USD': 'FX:AUDUSD',
    'USD/CAD': 'FX:USDCAD',
    'USD/CHF': 'FX:USDCHF',
    'NZD/USD': 'FX:NZDUSD',
    'EUR/JPY': 'FX:EURJPY',
    'GBP/JPY': 'FX:GBPJPY',
    'EUR/GBP': 'FX:EURGBP',
    'BTC/USD': 'BINANCE:BTCUSDT',
    'ETH/USD': 'BINANCE:ETHUSDT',
    'SOL/USD': 'BINANCE:SOLUSDT',
    'BNB/USD': 'BINANCE:BNBUSDT',
    'ADA/USD': 'BINANCE:ADAUSDT',
    'US30': 'CAPITALCOM:US30',
    'NAS100': 'CAPITALCOM:NAS100',
    'SPX500': 'OANDA:SPX500USD',
    'XAU/USD': 'OANDA:XAUUSD',
    'XAG/USD': 'OANDA:XAGUSD',
    'AAPL': 'NASDAQ:AAPL',
    'TSLA': 'NASDAQ:TSLA',
    'NVDA': 'NASDAQ:NVDA',
    'MSFT': 'NASDAQ:MSFT',
  };
  return map[sym] || sym;
};

const getTVInterval = (tf: Timeframe) => {
  const map: Record<Timeframe, "D" | "240" | "60" | "30" | "15" | "5" | "1"> = {
    'D1': 'D', 'H4': '240', 'H1': '60', 'M30': '30', 'M15': '15', 'M5': '5', 'M1': '1',
  };
  return map[tf];
}

export default function App() {
  const [activeTab, setActiveTab] = useState<AssetCategory>('forex');
  const [activeSymbol, setActiveSymbol] = useState<string>(ASSETS[0].symbols[0]);
  const [activeTimeframe, setActiveTimeframe] = useState<Timeframe>('D1');
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<ViewMode>('tradingview');

  const activeCategory = ASSETS.find(a => a.id === activeTab)!;

  const handleTabChange = (tabId: AssetCategory) => {
    setActiveTab(tabId);
    const category = ASSETS.find(a => a.id === tabId)!;
    setActiveSymbol(category.symbols[0]);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      const fetchAnalysis = async () => {
        setLoadingAnalysis(true);
        try {
          const result = await getAnalystInsight(activeCategory.name, getSymbolLabel(activeSymbol), activeTimeframe);
          setAnalysis(result);
        } catch (error) {
          console.error(error);
        } finally {
          setLoadingAnalysis(false);
        }
      };
      fetchAnalysis();
    }, 500);
    return () => clearTimeout(timer);
  }, [activeTab, activeSymbol, activeTimeframe, activeCategory.name]);

  const tvSymbolStr = getTVSymbol(activeSymbol);
  const tvIntervalStr = getTVInterval(activeTimeframe);

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-gray-200 font-sans selection:bg-blue-500/30">
      <header className="bg-[#151521] border-b border-gray-800 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <LineChart className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">ProAnalyst <span className="text-blue-500">AI</span></h1>
          </div>
          <div className="bg-[#1e1e2d] px-4 py-1.5 rounded-full flex items-center gap-3 border border-gray-800">
             <div className="flex bg-[#151521] p-0.5 rounded-lg border border-gray-800">
               <button 
                 onClick={() => setViewMode('tradingview')}
                 className={cn(
                   "flex items-center gap-2 px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-all",
                   viewMode === 'tradingview' ? "bg-gray-800 text-white" : "text-gray-500 hover:text-gray-300"
                 )}
               >
                 <Eye className="w-3 h-3" />
                 TradingView
               </button>
               <button 
                 onClick={() => setViewMode('ai-expert')}
                 className={cn(
                   "flex items-center gap-2 px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-all",
                   viewMode === 'ai-expert' ? "bg-blue-600 text-white shadow-lg" : "text-gray-500 hover:text-gray-300"
                 )}
               >
                 <Sparkles className="w-3 h-3" />
                 AI Expert Drawings
               </button>
             </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
          <div className="flex space-x-2 bg-[#151521] p-1.5 rounded-xl border border-gray-800 w-fit overflow-x-auto">
            {ASSETS.map((asset) => (
              <button
                key={asset.id}
                onClick={() => handleTabChange(asset.id)}
                className={cn(
                  "flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap",
                  activeTab === asset.id ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/50"
                )}
              >
                <asset.icon className="w-4 h-4" />
                {asset.name}
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative">
              <select
                value={activeSymbol}
                onChange={(e) => setActiveSymbol(e.target.value)}
                className="appearance-none bg-[#151521] border border-gray-700 text-white text-sm rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block w-full sm:w-auto min-w-[12rem] p-3 pr-10 outline-none cursor-pointer transition-all hover:border-gray-600 shadow-lg"
              >
                {activeCategory.symbols.map(sym => (
                  <option key={sym} value={sym}>{getSymbolLabel(sym)}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                <Clock className="w-4 h-4" />
              </div>
              <select
                value={activeTimeframe}
                onChange={(e) => setActiveTimeframe(e.target.value as Timeframe)}
                className="appearance-none bg-[#151521] border border-gray-700 text-white text-sm rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block w-full sm:w-40 p-3 pl-10 pr-10 outline-none cursor-pointer transition-all hover:border-gray-600 shadow-lg"
              >
                {TIMEFRAMES.map(tf => (
                  <option key={tf.id} value={tf.id}>{tf.label}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-8 flex-1 flex flex-col">
          <div className="w-full bg-[#1e1e2d] rounded-xl border border-gray-800 overflow-hidden shadow-2xl h-[500px] relative">
            {viewMode === 'tradingview' ? (
              <AdvancedRealTimeChart 
                theme="dark"
                symbol={tvSymbolStr}
                interval={tvIntervalStr}
                timezone="Asia/Taipei"
                locale="zh_TW"
                autosize
                hide_side_toolbar={false}
                allow_symbol_change={false}
                save_image={false}
              />
            ) : (
              <div className="w-full h-full">
                {loadingAnalysis ? (
                  <div className="w-full h-full flex flex-col items-center justify-center space-y-4">
                    <RefreshCcw className="w-10 h-10 animate-spin text-blue-500" />
                    <p className="text-blue-400 font-medium animate-pulse">AI 分析師正為您在 K 線圖上劃線中...</p>
                  </div>
                ) : (
                  analysis && analysis.candles.length > 0 ? (
                    <MarketChart 
                      candles={analysis.candles}
                      trendlines={analysis.trendlines}
                      fibLevels={analysis.fibLevels}
                      signals={analysis.signals}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500">
                      暫無繪圖數據，請稍後幾秒或切換商品重新生成。
                    </div>
                  )
                )}
                <div className="absolute top-6 left-6 z-10 bg-[#151521]/90 backdrop-blur-md p-3 rounded-lg border border-gray-700 shadow-xl pointer-events-none">
                  <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider">
                    <div className="flex items-center gap-1.5 text-blue-400">
                      <div className="w-2.5 h-0.5 bg-blue-400 rounded-full" /> 趨勢連線
                    </div>
                    <div className="flex items-center gap-1.5 text-yellow-500">
                      <div className="w-2.5 h-0.5 border-t border-dashed border-yellow-500" /> FIB 關卡
                    </div>
                    <div className="flex items-center gap-1.5 text-green-500">
                      <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.3)]" /> 進場訊號
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-[#151521] rounded-xl border border-gray-800 p-6 shadow-xl flex flex-col h-full">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <BrainCircuit className="w-5 h-5 text-blue-500" />
                AI 量化交易策略中心
              </h3>
              
              {loadingAnalysis ? (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 space-y-4">
                  <RefreshCcw className="w-8 h-8 animate-spin text-blue-500" />
                  <p className="text-sm animate-pulse">正在為您運算交易策略與點位...</p>
                </div>
              ) : (
                <div className="flex-1 flex flex-col">
                  {analysis && (
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="bg-[#1e1e2d] p-4 rounded-lg border border-gray-800/50">
                        <p className="text-gray-400 text-xs mb-1">當前趨勢 (Trend)</p>
                        <p className={cn("font-bold text-lg", analysis.trend.includes('多') ? 'text-green-500' : analysis.trend.includes('空') ? 'text-red-500' : 'text-yellow-500')}>
                          {analysis.trend}
                        </p>
                      </div>
                      <div className="bg-[#1e1e2d] p-4 rounded-lg border border-gray-800/50">
                        <p className="text-gray-400 text-xs mb-1">建議進場 (Entry)</p>
                        <p className="text-white font-mono text-lg">{analysis.entryPrice}</p>
                      </div>
                      <div className="bg-red-900/10 p-4 rounded-lg border border-red-900/30">
                        <p className="text-red-400 text-xs mb-1">止損點位 (SL)</p>
                        <p className="text-red-400 font-mono text-lg">{analysis.stopLoss}</p>
                      </div>
                      <div className="bg-green-900/10 p-4 rounded-lg border border-green-900/30">
                        <p className="text-green-400 text-xs mb-1">止盈目標 (TP)</p>
                        <p className="text-green-400 font-mono text-lg">{analysis.takeProfit}</p>
                      </div>
                      <div className="bg-[#1e1e2d] p-4 rounded-lg border border-gray-800/50">
                        <p className="text-gray-400 text-xs mb-1">下檔支撐 (Support)</p>
                        <p className="text-gray-300 font-mono text-base">{analysis.support}</p>
                      </div>
                      <div className="bg-[#1e1e2d] p-4 rounded-lg border border-gray-800/50">
                        <p className="text-gray-400 text-xs mb-1">上檔壓力 (Resistance)</p>
                        <p className="text-gray-300 font-mono text-base">{analysis.resistance}</p>
                      </div>
                    </div>
                  )}
                  <div className="mt-auto bg-blue-900/10 border border-blue-800/30 p-5 rounded-lg flex-1 flex flex-col justify-center">
                    <h4 className="text-blue-400 font-bold mb-3 flex items-center gap-2 text-base">
                      <Activity className="w-5 h-5" />
                      AI 綜合操作建議
                    </h4>
                    <p className="text-gray-300 text-base leading-relaxed">
                      {analysis?.advice || '無操作建議'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-[#151521] rounded-xl border border-gray-800 flex flex-col shadow-xl overflow-hidden relative">
              <div className="px-6 py-4 border-b border-gray-800 bg-gradient-to-r from-[#151521] to-[#1a1a2e]">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <BrainCircuit className="w-5 h-5 text-purple-500" />
                  資深分析師洞察
                </h2>
                <p className="text-xs text-gray-400 mt-1">基於全球總經與技術線型綜合評估</p>
              </div>
              <div className="p-6 flex-1">
                {loadingAnalysis ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-4">
                    <RefreshCcw className="w-8 h-8 animate-spin text-blue-500" />
                    <p className="text-sm">正在生成深度分析報告...</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-white font-medium mb-2 flex items-center gap-2 text-sm uppercase tracking-wider">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                        總經環境與新聞
                      </h4>
                      <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-wrap pl-3 border-l border-gray-800">
                        {analysis?.macro}
                      </p>
                    </div>
                    <div>
                      <h4 className="text-white font-medium mb-2 flex items-center gap-2 text-sm uppercase tracking-wider">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        訊號解析
                      </h4>
                      <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-wrap pl-3 border-l border-gray-800">
                        {analysis?.signal}
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <div className="px-6 py-4 border-t border-gray-800 bg-[#11111a] mt-auto">
                <p className="text-[10px] text-gray-600 leading-tight">
                  免責聲明：本分析由 AI 模型基於歷史數據與聯網新聞生成，僅供參考，不構成任何投資建議。市場有風險，投資需謹慎。
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
