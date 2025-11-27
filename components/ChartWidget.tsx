
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  createChart, 
  ColorType, 
  CrosshairMode, 
  IChartApi, 
  ISeriesApi, 
  Time,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  SeriesMarker,
  LineStyle
} from 'lightweight-charts';
import { MarketData, Trade } from '../types';

interface ChartWidgetProps {
  data: MarketData[];
  trades?: Trade[];
  showVolume?: boolean;
  showMACD?: boolean;
  showBollinger?: boolean;
  showMA?: boolean;
  height?: number;
}

// 圖表指標開關
type IndicatorType = 'MA' | 'BB' | 'MACD' | 'VOL';

const ChartWidget: React.FC<ChartWidgetProps> = ({ 
  data, 
  trades = [],
  showVolume = true,
  showMACD = true,
  showBollinger = true,
  showMA = true,
  height = 500
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const macdContainerRef = useRef<HTMLDivElement>(null);
  const volumeContainerRef = useRef<HTMLDivElement>(null);

  // 指標顯示狀態
  const [indicators, setIndicators] = useState<Record<IndicatorType, boolean>>({
    MA: showMA,
    BB: showBollinger,
    MACD: showMACD,
    VOL: showVolume
  });

  // 當前價格資訊顯示
  const [priceInfo, setPriceInfo] = useState<{
    open: number;
    high: number;
    low: number;
    close: number;
    change: number;
    changePercent: number;
  } | null>(null);

  // Chart Instances
  const mainChartRef = useRef<IChartApi | null>(null);
  const macdChartRef = useRef<IChartApi | null>(null);
  const volumeChartRef = useRef<IChartApi | null>(null);

  // Series Refs
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const ma7SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ma25SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ma99SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbUpperSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbMiddleSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbLowerSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  
  // MACD Series Refs
  const macdHistSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const macdLineSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const macdSignalSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  // Track state to determine update strategy
  const isInitializedRef = useRef(false);
  const lastProcessedTimeRef = useRef<number>(0);
  const isDisposedRef = useRef(false);

  // 切換指標顯示
  const toggleIndicator = useCallback((type: IndicatorType) => {
    setIndicators(prev => ({ ...prev, [type]: !prev[type] }));
  }, []);

  // 1. Initialize Charts
  useEffect(() => {
    if (!chartContainerRef.current) return;
    
    // Reset disposed state on re-initialization
    isDisposedRef.current = false;

    // Common Options
    const chartOptions = {
      layout: {
        textColor: '#71717a',
        background: { type: ColorType.Solid, color: 'transparent' },
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(39, 39, 42, 0.5)', style: LineStyle.Dotted },
        horzLines: { color: 'rgba(39, 39, 42, 0.5)', style: LineStyle.Dotted },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: '#6366f1',
          width: 1 as const,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#6366f1',
        },
        horzLine: {
          color: '#6366f1',
          width: 1 as const,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#6366f1',
        },
      },
      timeScale: {
        borderColor: '#27272a',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 5,
        barSpacing: 8,
        minBarSpacing: 4,
      },
      rightPriceScale: {
        borderColor: '#27272a',
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
    };

    // 計算主圖表高度
    const macdHeight = indicators.MACD ? 100 : 0;
    const volumeHeight = indicators.VOL ? 80 : 0;
    const mainChartHeight = height - macdHeight - volumeHeight - 60;

    // --- Main Chart ---
    const mainChart = createChart(chartContainerRef.current, {
      ...chartOptions,
      height: mainChartHeight,
    });
    mainChartRef.current = mainChart;

    // Series: Candles with improved styling
    const candleSeries = mainChart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
      priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
    });
    candleSeriesRef.current = candleSeries;

    // Series: MAs with different styles
    const ma7Series = mainChart.addSeries(LineSeries, { 
      color: '#22c55e', 
      lineWidth: 1, 
      priceLineVisible: false, 
      crosshairMarkerVisible: false, 
      lastValueVisible: false,
      visible: indicators.MA
    });
    ma7SeriesRef.current = ma7Series;
    
    const ma25Series = mainChart.addSeries(LineSeries, { 
      color: '#eab308', 
      lineWidth: 1, 
      priceLineVisible: false, 
      crosshairMarkerVisible: false, 
      lastValueVisible: false,
      visible: indicators.MA
    });
    ma25SeriesRef.current = ma25Series;
    
    const ma99Series = mainChart.addSeries(LineSeries, { 
      color: '#a855f7', 
      lineWidth: 1, 
      priceLineVisible: false, 
      crosshairMarkerVisible: false, 
      lastValueVisible: false,
      visible: indicators.MA
    });
    ma99SeriesRef.current = ma99Series;

    // Series: Bollinger Bands with fill effect
    const bbUpper = mainChart.addSeries(LineSeries, { 
      color: 'rgba(99, 102, 241, 0.6)', 
      lineWidth: 1, 
      lineStyle: LineStyle.Solid, 
      priceLineVisible: false, 
      crosshairMarkerVisible: false, 
      lastValueVisible: false,
      visible: indicators.BB
    });
    bbUpperSeriesRef.current = bbUpper;
    
    const bbMiddle = mainChart.addSeries(LineSeries, { 
      color: 'rgba(99, 102, 241, 0.3)', 
      lineWidth: 1, 
      lineStyle: LineStyle.Dashed, 
      priceLineVisible: false, 
      crosshairMarkerVisible: false, 
      lastValueVisible: false,
      visible: indicators.BB
    });
    bbMiddleSeriesRef.current = bbMiddle;
    
    const bbLower = mainChart.addSeries(LineSeries, { 
      color: 'rgba(99, 102, 241, 0.6)', 
      lineWidth: 1, 
      lineStyle: LineStyle.Solid, 
      priceLineVisible: false, 
      crosshairMarkerVisible: false, 
      lastValueVisible: false,
      visible: indicators.BB
    });
    bbLowerSeriesRef.current = bbLower;

    // --- Volume Chart ---
    if (volumeContainerRef.current && indicators.VOL) {
      const volumeChart = createChart(volumeContainerRef.current, {
        ...chartOptions,
        height: volumeHeight,
        rightPriceScale: { 
          borderColor: '#27272a',
          scaleMargins: { top: 0.1, bottom: 0 },
        },
      });
      volumeChartRef.current = volumeChart;

      const volumeSeries = volumeChart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceLineVisible: false,
      });
      volumeSeriesRef.current = volumeSeries;
    }

    // --- MACD Chart ---
    if (macdContainerRef.current && indicators.MACD) {
      const macdChart = createChart(macdContainerRef.current, {
        ...chartOptions,
        height: macdHeight,
        rightPriceScale: {
          borderColor: '#27272a',
          scaleMargins: { top: 0.1, bottom: 0.1 },
        },
      });
      macdChartRef.current = macdChart;

      const macdHist = macdChart.addSeries(HistogramSeries, { 
        priceFormat: { type: 'price', precision: 2 }, 
        priceLineVisible: false 
      });
      macdHistSeriesRef.current = macdHist;

      const macdLine = macdChart.addSeries(LineSeries, { 
        color: '#3b82f6', 
        lineWidth: 1, 
        priceLineVisible: false, 
        lastValueVisible: false 
      });
      macdLineSeriesRef.current = macdLine;

      const macdSignal = macdChart.addSeries(LineSeries, { 
        color: '#f97316', 
        lineWidth: 1, 
        priceLineVisible: false, 
        lastValueVisible: false 
      });
      macdSignalSeriesRef.current = macdSignal;

      // Sync time scales
      mainChart.timeScale().subscribeVisibleLogicalRangeChange(range => {
        if (range) {
          macdChart.timeScale().setVisibleLogicalRange(range);
          volumeChartRef.current?.timeScale().setVisibleLogicalRange(range);
        }
      });
    }

    // Crosshair move handler for price info
    mainChart.subscribeCrosshairMove(param => {
      if (param.time && param.seriesData.size > 0) {
        const candleData = param.seriesData.get(candleSeries) as any;
        if (candleData) {
          const prevClose = data.length > 1 ? data[data.length - 2].close : candleData.open;
          const change = candleData.close - prevClose;
          const changePercent = (change / prevClose) * 100;
          setPriceInfo({
            open: candleData.open,
            high: candleData.high,
            low: candleData.low,
            close: candleData.close,
            change,
            changePercent
          });
        }
      }
    });

    // Resize Observer - with disposed check
    const resizeObserver = new ResizeObserver(entries => {
      // Skip if chart is disposed
      if (isDisposedRef.current) return;
      if (entries.length === 0 || !entries[0].target) return;
      const { width } = entries[0].contentRect;
      if (width === 0) return; // Skip zero-width updates
      
      requestAnimationFrame(() => {
        // Double-check disposal before applying
        if (isDisposedRef.current) return;
        try {
          mainChartRef.current?.applyOptions({ width });
          macdChartRef.current?.applyOptions({ width });
          volumeChartRef.current?.applyOptions({ width });
        } catch (e) {
          // Ignore errors from disposed charts
        }
      });
    });

    resizeObserver.observe(chartContainerRef.current);

    return () => {
      // Mark as disposed first to prevent any further updates
      isDisposedRef.current = true;
      resizeObserver.disconnect();
      
      // Remove charts safely
      try {
        mainChart.remove();
      } catch (e) {}
      try {
        macdChartRef.current?.remove();
      } catch (e) {}
      try {
        volumeChartRef.current?.remove();
      } catch (e) {}
      
      // Reset refs
      mainChartRef.current = null;
      macdChartRef.current = null;
      volumeChartRef.current = null;
      isInitializedRef.current = false;
    };
  }, [height, indicators.MACD, indicators.VOL]);

  // Update indicator visibility
  useEffect(() => {
    if (isDisposedRef.current) return;
    try {
      ma7SeriesRef.current?.applyOptions({ visible: indicators.MA });
      ma25SeriesRef.current?.applyOptions({ visible: indicators.MA });
      ma99SeriesRef.current?.applyOptions({ visible: indicators.MA });
      bbUpperSeriesRef.current?.applyOptions({ visible: indicators.BB });
      bbMiddleSeriesRef.current?.applyOptions({ visible: indicators.BB });
      bbLowerSeriesRef.current?.applyOptions({ visible: indicators.BB });
    } catch (e) {}
  }, [indicators.MA, indicators.BB]);

  // 2. Update Data Logic
  useEffect(() => {
    if (isDisposedRef.current || !mainChartRef.current || data.length === 0) return;

    const latestDataPoint = data[data.length - 1];
    const latestTime = latestDataPoint.timestamp;

    // Efficient Data Preparation Helper
    const createPoint = (d: MarketData) => {
        const time = Math.floor(d.timestamp / 1000) as Time;
        const sma20 = (d.bb_upper + d.bb_lower) / 2; // 中軌
        return {
            candle: { time, open: d.open, high: d.high, low: d.low, close: d.close },
            ma7: { time, value: d.ma7 },
            ma25: { time, value: d.ma25 },
            ma99: { time, value: d.ma99 },
            bbUpper: { time, value: d.bb_upper },
            bbMiddle: { time, value: sma20 },
            bbLower: { time, value: d.bb_lower },
            volume: { 
              time, 
              value: d.volume || 0, 
              color: d.close >= d.open ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)' 
            },
            macdHist: { time, value: d.macd_hist, color: d.macd_hist >= 0 ? '#22c55e' : '#ef4444' },
            macdLine: { time, value: d.macd_line },
            macdSignal: { time, value: d.macd_signal }
        };
    };

    const isDataDiscontinuous = !lastProcessedTimeRef.current || Math.abs(latestTime - lastProcessedTimeRef.current) > 15 * 60 * 1000 * 20;
    const shouldFullUpdate = !isInitializedRef.current || isDataDiscontinuous;

    if (shouldFullUpdate) {
        const seriesData = {
            candles: [] as any[],
            ma7: [] as any[],
            ma25: [] as any[],
            ma99: [] as any[],
            bbUpper: [] as any[],
            bbMiddle: [] as any[],
            bbLower: [] as any[],
            volume: [] as any[],
            macdHist: [] as any[],
            macdLine: [] as any[],
            macdSignal: [] as any[]
        };

        for (let i = 0; i < data.length; i++) {
            const p = createPoint(data[i]);
            seriesData.candles.push(p.candle);
            seriesData.ma7.push(p.ma7);
            seriesData.ma25.push(p.ma25);
            seriesData.ma99.push(p.ma99);
            seriesData.bbUpper.push(p.bbUpper);
            seriesData.bbMiddle.push(p.bbMiddle);
            seriesData.bbLower.push(p.bbLower);
            seriesData.volume.push(p.volume);
            seriesData.macdHist.push(p.macdHist);
            seriesData.macdLine.push(p.macdLine);
            seriesData.macdSignal.push(p.macdSignal);
        }

        candleSeriesRef.current?.setData(seriesData.candles);
        ma7SeriesRef.current?.setData(seriesData.ma7);
        ma25SeriesRef.current?.setData(seriesData.ma25);
        ma99SeriesRef.current?.setData(seriesData.ma99);
        bbUpperSeriesRef.current?.setData(seriesData.bbUpper);
        bbMiddleSeriesRef.current?.setData(seriesData.bbMiddle);
        bbLowerSeriesRef.current?.setData(seriesData.bbLower);
        volumeSeriesRef.current?.setData(seriesData.volume);
        
        macdHistSeriesRef.current?.setData(seriesData.macdHist);
        macdLineSeriesRef.current?.setData(seriesData.macdLine);
        macdSignalSeriesRef.current?.setData(seriesData.macdSignal);

        // 設置初始價格資訊
        const latest = data[data.length - 1];
        const prev = data.length > 1 ? data[data.length - 2].close : latest.open;
        setPriceInfo({
          open: latest.open,
          high: latest.high,
          low: latest.low,
          close: latest.close,
          change: latest.close - prev,
          changePercent: ((latest.close - prev) / prev) * 100
        });

        isInitializedRef.current = true;
    } else {
        const updates = data.filter(d => d.timestamp >= lastProcessedTimeRef.current);
        
        for (const point of updates) {
             const p = createPoint(point);
             candleSeriesRef.current?.update(p.candle);
             ma7SeriesRef.current?.update(p.ma7);
             ma25SeriesRef.current?.update(p.ma25);
             ma99SeriesRef.current?.update(p.ma99);
             bbUpperSeriesRef.current?.update(p.bbUpper);
             bbMiddleSeriesRef.current?.update(p.bbMiddle);
             bbLowerSeriesRef.current?.update(p.bbLower);
             volumeSeriesRef.current?.update(p.volume);
             macdHistSeriesRef.current?.update(p.macdHist);
             macdLineSeriesRef.current?.update(p.macdLine);
             macdSignalSeriesRef.current?.update(p.macdSignal);
        }
    }

    lastProcessedTimeRef.current = latestTime;
  }, [data]);

  // 3. Trade Markers Logic
  useEffect(() => {
    if (isDisposedRef.current || !candleSeriesRef.current || !trades || trades.length === 0) return;

    const seriesApi = candleSeriesRef.current as any;
    if (typeof seriesApi.setMarkers !== 'function') return;

    try {
      const markers: SeriesMarker<Time>[] = trades
        .filter(t => t.timestamp > 0)
        .map(t => ({
          time: Math.floor(t.timestamp / 1000) as Time,
          position: t.side === 'BUY' ? 'belowBar' : 'aboveBar',
          color: t.side === 'BUY' ? '#22c55e' : '#ef4444',
          shape: t.side === 'BUY' ? 'arrowUp' : 'arrowDown',
          text: t.side + (t.pnl ? ` ($${t.pnl.toFixed(0)})` : ''),
          size: 1.5
        }));
      
      markers.sort((a, b) => (a.time as number) - (b.time as number));
      seriesApi.setMarkers(markers);
    } catch (e) {}

  }, [trades]);

  return (
    <div className="w-full bg-zinc-900/50 rounded-xl border border-zinc-800 overflow-hidden flex flex-col" style={{ height }}>
      {/* 頂部工具列 */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900/80">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">BTC/USDT</span>
            <span className="text-xs text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">15m</span>
          </div>
          
          {priceInfo && (
            <div className="flex items-center gap-4 ml-4 text-xs font-mono">
              <span className="text-zinc-400">O <span className="text-zinc-200">{priceInfo.open.toFixed(2)}</span></span>
              <span className="text-zinc-400">H <span className="text-green-400">{priceInfo.high.toFixed(2)}</span></span>
              <span className="text-zinc-400">L <span className="text-red-400">{priceInfo.low.toFixed(2)}</span></span>
              <span className="text-zinc-400">C <span className="text-zinc-200">{priceInfo.close.toFixed(2)}</span></span>
              <span className={priceInfo.change >= 0 ? 'text-green-400' : 'text-red-400'}>
                {priceInfo.change >= 0 ? '+' : ''}{priceInfo.change.toFixed(2)} ({priceInfo.changePercent.toFixed(2)}%)
              </span>
            </div>
          )}
        </div>
        
        {/* 指標切換按鈕 */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => toggleIndicator('MA')}
            className={`px-2 py-1 text-xs rounded transition-all ${
              indicators.MA 
                ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                : 'bg-zinc-800 text-zinc-500 border border-zinc-700 hover:text-zinc-300'
            }`}
          >
            MA
          </button>
          <button
            onClick={() => toggleIndicator('BB')}
            className={`px-2 py-1 text-xs rounded transition-all ${
              indicators.BB 
                ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' 
                : 'bg-zinc-800 text-zinc-500 border border-zinc-700 hover:text-zinc-300'
            }`}
          >
            BOLL
          </button>
          <button
            onClick={() => toggleIndicator('VOL')}
            className={`px-2 py-1 text-xs rounded transition-all ${
              indicators.VOL 
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                : 'bg-zinc-800 text-zinc-500 border border-zinc-700 hover:text-zinc-300'
            }`}
          >
            VOL
          </button>
          <button
            onClick={() => toggleIndicator('MACD')}
            className={`px-2 py-1 text-xs rounded transition-all ${
              indicators.MACD 
                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' 
                : 'bg-zinc-800 text-zinc-500 border border-zinc-700 hover:text-zinc-300'
            }`}
          >
            MACD
          </button>
        </div>
      </div>

      {/* 圖例 */}
      <div className="flex items-center gap-4 px-4 py-1.5 border-b border-zinc-800/50 text-xs">
        {indicators.MA && (
          <>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-green-500 rounded"></span><span className="text-zinc-500">MA7</span></span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-yellow-500 rounded"></span><span className="text-zinc-500">MA25</span></span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-purple-500 rounded"></span><span className="text-zinc-500">MA99</span></span>
          </>
        )}
        {indicators.BB && (
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-indigo-500 rounded"></span><span className="text-zinc-500">BOLL(20,2)</span></span>
        )}
      </div>
      
      {/* Main Chart Container */}
      <div ref={chartContainerRef} className="w-full flex-1" />
      
      {/* Volume Chart Container */}
      {indicators.VOL && (
        <div ref={volumeContainerRef} className="w-full border-t border-zinc-800/50" />
      )}
      
      {/* MACD Chart Container */}
      {indicators.MACD && (
        <div ref={macdContainerRef} className="w-full border-t border-zinc-800/50" />
      )}
    </div>
  );
};

export default ChartWidget;
