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
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
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

    // Formatting data for lightweight-charts
    const formattedCandles = candles.map(c => ({
      time: Math.floor(new Date(c.time).getTime() / 1000) as any,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    candlestickSeries.setData(formattedCandles);

    // Trendlines
    trendlines.forEach((tl) => {
      const lineSeries = (chart as any).addLineSeries({
        color: tl.color || '#ffffff',
        lineWidth: 2,
        title: tl.label,
      });

      const lineData = [
        { time: Math.floor(new Date(tl.time1).getTime() / 1000) as any, value: tl.price1 },
        { time: Math.floor(new Date(tl.time2).getTime() / 1000) as any, value: tl.price2 },
      ];
      lineSeries.setData(lineData);
    });

    // Fibonacci & S/R Levels (Horizontal lines)
    fibLevels.forEach(fib => {
      candlestickSeries.createPriceLine({
        price: fib.price,
        color: fib.color,
        lineWidth: 1,
        lineStyle: 2, // Dashed
        axisLabelVisible: true,
        title: fib.label,
      });
    });

    // Signals (Markers)
    const markers = signals.map(s => ({
      time: Math.floor(new Date(s.time).getTime() / 1000) as any,
      position: s.type === 'buy' ? 'belowBar' as const : 'aboveBar' as const,
      color: s.type === 'buy' ? '#26a69a' : '#ef5350',
      shape: s.type === 'buy' ? 'arrowUp' as const : 'arrowDown' as const,
      text: s.text,
    }));

    (candlestickSeries as any).setMarkers(markers);

    chartRef.current = chart;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [candles, trendlines, fibLevels, signals]);

  return <div ref={chartContainerRef} className="w-full h-full" />;
};
