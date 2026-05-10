import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, IChartApi } from 'lightweight-charts';
import { CandleData, DrawingLine, Marker } from '../services/aiService';

interface MarketChartProps {
  candles: CandleData[];
  trendlines: DrawingLine[];
  fibLevels: { price: number; label: string; color: string }[];
  signals: Marker[];
}

export const MarketChart: React.FC<MarketChartProps> = ({ candles, trendlines, fibLevels, signals }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current || !candles || candles.length === 0) return;
    
    let chart: IChartApi | null = null;
    
    try {
      chart = createChart(chartContainerRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: '#151521' },
          textColor: '#d1d4dc',
        },
        grid: {
          vertLines: { color: '#2b2b3b' },
          horzLines: { color: '#2b2b3b' },
        },
        width: chartContainerRef.current.clientWidth,
        height: 500,
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
        },
      });

      const candlestickSeries = (chart as any).addCandlestickSeries({
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderVisible: false,
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
      });

      // 1. Sort candles by time to prevent lightweight-charts errors
      const sortedCandles = [...candles].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

      // Formatting data for lightweight-charts
      const formattedCandles = sortedCandles.map(c => ({
        time: Math.floor(new Date(c.time).getTime() / 1000) as any,
        open: Number(c.open) || 0,
        high: Number(c.high) || 0,
        low: Number(c.low) || 0,
        close: Number(c.close) || 0,
      }));

      candlestickSeries.setData(formattedCandles);

      const getClosestTime = (targetTime: string) => {
        const t = new Date(targetTime).getTime();
        if (!t || isNaN(t)) return formattedCandles[0].time;
        
        let closest = sortedCandles[0];
        let minDiff = Math.abs(new Date(closest.time).getTime() - t);
        
        for (const c of sortedCandles) {
          const diff = Math.abs(new Date(c.time).getTime() - t);
          if (diff < minDiff) {
            minDiff = diff;
            closest = c;
          }
        }
        return Math.floor(new Date(closest.time).getTime() / 1000) as any;
      };

      // 2. Trendlines
      if (trendlines && trendlines.length > 0) {
        trendlines.forEach((tl) => {
          try {
            const val1 = Number(tl.price1);
            const val2 = Number(tl.price2);
            if (isNaN(val1) || isNaN(val2)) return;

            const lineSeries = (chart as any).addLineSeries({
              color: tl.color || '#3b82f6',
              lineWidth: 2,
              title: tl.label,
              lastValueVisible: false,
              priceLineVisible: false,
            });

            const t1 = getClosestTime(tl.time1);
            const t2 = getClosestTime(tl.time2);

            let lineData = [
              { time: t1, value: val1 },
              { time: t2, value: val2 },
            ];
            
            lineData.sort((a, b) => (a.time as number) - (b.time as number));

            if (lineData[0].time !== lineData[1].time) {
              lineSeries.setData(lineData);
            }
          } catch (e) {
            console.warn('Failed to draw trendline:', e);
          }
        });
      }

      // 3. Fibonacci & S/R Levels
      if (fibLevels && fibLevels.length > 0) {
        fibLevels.forEach(fib => {
          try {
            const p = Number(fib.price);
            if (isNaN(p)) return;
            candlestickSeries.createPriceLine({
              price: p,
              color: fib.color || '#e0e3eb',
              lineWidth: 1,
              lineStyle: 2, // Dashed
              axisLabelVisible: true,
              title: fib.label,
            });
          } catch (e) {
            console.warn('Failed to draw fib level:', e);
          }
        });
      }

      // 4. Signals (Markers)
      if (signals && signals.length > 0) {
        try {
          const markers = signals.map(s => ({
            time: getClosestTime(s.time),
            position: s.type === 'buy' ? 'belowBar' as const : 'aboveBar' as const,
            color: s.type === 'buy' ? '#26a69a' : '#ef5350',
            shape: s.type === 'buy' ? 'arrowUp' as const : 'arrowDown' as const,
            text: s.text,
          }));

          markers.sort((a, b) => (a.time as number) - (b.time as number));

          const uniqueMarkers = markers.filter((m, index, self) => 
            index === 0 || m.time !== self[index - 1].time
          );

          (candlestickSeries as any).setMarkers(uniqueMarkers);
        } catch (e) {
          console.warn('Failed to set markers:', e);
        }
      }

      chartRef.current = chart;
      chart.timeScale().fitContent();

      const handleResize = () => {
        if (chartContainerRef.current && chart) {
          chart.applyOptions({ width: chartContainerRef.current.clientWidth });
        }
      };

      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        if (chart) chart.remove();
      };
    } catch (err) {
      console.error('Fatal error in MarketChart useEffect:', err);
      // Clean up if it crashed half-way
      if (chart) {
        try { chart.remove(); } catch (e) {}
      }
    }
  }, [candles, trendlines, fibLevels, signals]);

  return <div ref={chartContainerRef} className="w-full h-full" />;
};
