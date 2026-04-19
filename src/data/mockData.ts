import { Time } from 'lightweight-charts';

export type Timeframe = 'D1' | 'H4' | 'H1' | 'M30' | 'M15' | 'M5' | 'M1';

export interface ChartDataPoint {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface MarkerData {
  time: Time;
  position: 'aboveBar' | 'belowBar';
  color: string;
  shape: 'arrowDown' | 'arrowUp';
  text: string;
}

export interface LineDataPoint {
  time: Time;
  value: number;
}

export interface TradeSignal {
  type: 'buy' | 'sell';
  entry: number;
  tp: number;
  sl: number;
}

export interface AssetData {
  candles: ChartDataPoint[];
  smaFast: LineDataPoint[];
  smaSlow: LineDataPoint[];
  trendline: LineDataPoint[];
  markers: MarkerData[];
  latestSignal: TradeSignal | null;
}

function generateRandomWalk(targetEndPrice: number, volatility: number, periods: number, startDate: Date, timeframe: Timeframe): ChartDataPoint[] {
  const data: ChartDataPoint[] = [];
  let currentPrice = targetEndPrice; // Start from here but we will scale it later so the end matches
  const currentDate = new Date(startDate);

  let timeStepMs = 24 * 60 * 60 * 1000;
  if (timeframe === 'H4') timeStepMs = 4 * 60 * 60 * 1000;
  else if (timeframe === 'H1') timeStepMs = 60 * 60 * 1000;
  else if (timeframe === 'M30') timeStepMs = 30 * 60 * 1000;
  else if (timeframe === 'M15') timeStepMs = 15 * 60 * 1000;
  else if (timeframe === 'M5') timeStepMs = 5 * 60 * 1000;
  else if (timeframe === 'M1') timeStepMs = 60 * 1000;

  const tfVolMultiplier = timeframe === 'D1' ? 1 : timeframe === 'H4' ? 0.5 : timeframe === 'H1' ? 0.25 : 0.15;
  const adjustedVol = volatility * tfVolMultiplier;

  for (let i = 0; i < periods; i++) {
    // Skip weekends for D1, for intraday just keep generating to keep it simple but realistic enough
    if (timeframe === 'D1') {
      while (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
        currentDate.setTime(currentDate.getTime() + timeStepMs);
      }
    }

    const change = currentPrice * adjustedVol * (Math.random() - 0.5);
    const open = currentPrice;
    const close = currentPrice + change;
    const high = Math.max(open, close) + Math.abs(change) * Math.random();
    const low = Math.min(open, close) - Math.abs(change) * Math.random();

    data.push({
      time: (currentDate.getTime() / 1000) as Time,
      open,
      high,
      low,
      close,
    });

    currentPrice = close;
    currentDate.setTime(currentDate.getTime() + timeStepMs);
  }

  // Anchor the final price so the chart's current price matches the real asset's current price
  const finalClose = data[data.length - 1].close;
  const scale = targetEndPrice / finalClose;

  for (let i = 0; i < data.length; i++) {
    data[i].open *= scale;
    data[i].high *= scale;
    data[i].low *= scale;
    data[i].close *= scale;
  }

  return data;
}

function calculateSMA(data: ChartDataPoint[], period: number): LineDataPoint[] {
  const sma: LineDataPoint[] = [];
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j].close;
    }
    sma.push({
      time: data[i].time,
      value: sum / period,
    });
  }
  return sma;
}

function calculateTrendline(data: ChartDataPoint[]): LineDataPoint[] {
  if (data.length < 2) return [];
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  const n = data.length;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += data[i].close;
    sumXY += i * data[i].close;
    sumXX += i * i;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  return [
    { time: data[0].time, value: intercept },
    { time: data[n - 1].time, value: slope * (n - 1) + intercept }
  ];
}

export function generateAssetData(assetType: string, symbol: string, timeframe: Timeframe = 'D1'): AssetData {
  let startPrice = 100;
  let volatility = 0.02;

  if (assetType === 'forex') {
    volatility = 0.005;
    if (symbol === 'EUR/USD') startPrice = 1.10;
    else if (symbol === 'GBP/USD') startPrice = 1.25;
    else if (symbol === 'USD/JPY') startPrice = 150.00;
    else if (symbol === 'AUD/USD') startPrice = 0.65;
    else if (symbol === 'USD/CAD') startPrice = 1.35;
    else if (symbol === 'USD/CHF') startPrice = 0.90;
    else if (symbol === 'NZD/USD') startPrice = 0.60;
    else if (symbol === 'EUR/JPY') startPrice = 160.00;
    else if (symbol === 'GBP/JPY') startPrice = 190.00;
    else if (symbol === 'EUR/GBP') startPrice = 0.85;
    else startPrice = 1.0;
  } else if (assetType === 'crypto') {
    volatility = 0.05;
    if (symbol === 'BTC/USD') startPrice = 65000;
    else if (symbol === 'ETH/USD') startPrice = 3500;
    else if (symbol === 'SOL/USD') startPrice = 150;
    else if (symbol === 'BNB/USD') startPrice = 600;
    else if (symbol === 'ADA/USD') startPrice = 0.50;
    else startPrice = 1000;
  } else if (assetType === 'index') {
    volatility = 0.015;
    if (symbol === 'US30') startPrice = 39000;
    else if (symbol === 'NAS100') startPrice = 18000;
    else if (symbol === 'SPX500') startPrice = 5200;
    else startPrice = 10000;
  } else if (assetType === 'commodity') {
    volatility = 0.012;
    if (symbol === 'XAU/USD') startPrice = 2350;
    else if (symbol === 'XAG/USD') startPrice = 28.50;
    else startPrice = 100;
  } else {
    volatility = 0.02;
    if (symbol === 'AAPL') startPrice = 180;
    else if (symbol === 'TSLA') startPrice = 200;
    else if (symbol === 'NVDA') startPrice = 800;
    else if (symbol === 'MSFT') startPrice = 400;
    else startPrice = 150;
  }

  const now = new Date();
  let timeStepMs = 24 * 60 * 60 * 1000;
  if (timeframe === 'H4') timeStepMs = 4 * 60 * 60 * 1000;
  else if (timeframe === 'H1') timeStepMs = 60 * 60 * 1000;
  else if (timeframe === 'M30') timeStepMs = 30 * 60 * 1000;
  else if (timeframe === 'M15') timeStepMs = 15 * 60 * 1000;
  else if (timeframe === 'M5') timeStepMs = 5 * 60 * 1000;

  // Calculate start date so that 250 periods end at "now"
  // For D1, we skip weekends, so 250 trading days is roughly 350 calendar days.
  const calendarDays = timeframe === 'D1' ? 350 : 250;
  const startDate = new Date(now.getTime() - (calendarDays * timeStepMs));

  const candles = generateRandomWalk(startPrice, volatility, 250, startDate, timeframe);
  const smaFast = calculateSMA(candles, 10);
  const smaSlow = calculateSMA(candles, 30);
  const trendline = calculateTrendline(candles);

  const markers: MarkerData[] = [];
  
  // Generate buy/sell markers based on SMA crossover
  for (let i = 1; i < smaFast.length; i++) {
    const fastPrev = smaFast[i - 1].value;
    const fastCurr = smaFast[i].value;
    
    // Find matching slow SMA
    const slowPrevObj = smaSlow.find(s => s.time === smaFast[i - 1].time);
    const slowCurrObj = smaSlow.find(s => s.time === smaFast[i].time);

    if (!slowPrevObj || !slowCurrObj) continue;

    const slowPrev = slowPrevObj.value;
    const slowCurr = slowCurrObj.value;

    // Golden Cross (Buy)
    if (fastPrev <= slowPrev && fastCurr > slowCurr) {
      markers.push({
        time: smaFast[i].time,
        position: 'belowBar',
        color: '#22c55e', // green-500
        shape: 'arrowUp',
        text: '買入 (Buy)',
      });
    }
    // Death Cross (Sell)
    else if (fastPrev >= slowPrev && fastCurr < slowCurr) {
      markers.push({
        time: smaFast[i].time,
        position: 'aboveBar',
        color: '#ef4444', // red-500
        shape: 'arrowDown',
        text: '賣出 (Sell)',
      });
    }
  }

  let latestSignal: TradeSignal | null = null;
  if (markers.length > 0) {
    const lastMarker = markers[markers.length - 1];
    const isBuy = lastMarker.shape === 'arrowUp';
    const signalCandle = candles.find(c => c.time === lastMarker.time);
    const entryPrice = signalCandle ? signalCandle.close : candles[candles.length - 1].close;
    
    // Calculate TP and SL based on volatility
    const tfVolMultiplier = timeframe === 'D1' ? 1 : timeframe === 'H4' ? 0.5 : timeframe === 'H1' ? 0.25 : 0.15;
    const adjustedVol = volatility * tfVolMultiplier;
    
    const tpMultiplier = isBuy ? (1 + adjustedVol * 3) : (1 - adjustedVol * 3);
    const slMultiplier = isBuy ? (1 - adjustedVol * 1.5) : (1 + adjustedVol * 1.5);

    latestSignal = {
      type: isBuy ? 'buy' : 'sell',
      entry: entryPrice,
      tp: entryPrice * tpMultiplier,
      sl: entryPrice * slMultiplier,
    };
  }

  return { candles, smaFast, smaSlow, trendline, markers, latestSignal };
}
