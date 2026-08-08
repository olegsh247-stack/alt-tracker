'use client';
import { useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';

export default function Chart({ candles }) {
  const ref = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = createChart(ref.current, {
      width: ref.current.clientWidth,
      height: 360,
      layout: { background: { color: '#0b0e11' }, textColor: '#ccc' },
      grid: { vertLines: { color: '#1c2127' }, horzLines: { color: '#1c2127' } },
      timeScale: { timeVisible: true },
    });
    const series = chart.addCandlestickSeries({
      upColor: '#26a69a', downColor: '#ef5350', borderVisible: false,
      wickUpColor: '#26a69a', wickDownColor: '#ef5350',
    });
    chartRef.current = chart;
    seriesRef.current = series;

    const onResize = () => chart.applyOptions({ width: ref.current.clientWidth });
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); chart.remove(); };
  }, []);

  useEffect(() => {
    if (seriesRef.current && candles) {
      seriesRef.current.setData(candles);
      chartRef.current.timeScale().fitContent();
    }
  }, [candles]);

  return <div ref={ref} style={{ width: '100%' }} />;
}
