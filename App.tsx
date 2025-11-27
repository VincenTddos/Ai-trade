
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { fetchHistoricalData, connectBinanceStream } from './services/binanceService';
import { calculateSMA, calculateStandardDeviation, calculateEMAArray } from './utils/indicators';
import { MOCK_DERIVATIVES } from './services/mockData';
import ChartWidget from './components/ChartWidget';
import AIAnalysisPanel from './components/AIAnalysisPanel';
import DerivativesStats from './components/DerivativesStats';
import RiskConfigWidget from './components/RiskConfigWidget';
import TradeLogWidget from './components/TradeLogWidget';
import CoreEngineWidget from './components/CoreEngineWidget';
import Navigation, { PageType } from './components/Navigation';
import TradingPage from './components/TradingPage';
import BotsPage from './components/BotsPage';
import HistoryPage from './components/HistoryPage';
import ServerLogWidget from './components/ServerLogWidget';
import { tradingEngine, TradeRecord } from './services/tradingEngine';
import { botEngine } from './services/botEngine';
import { serverLog } from './services/serverLog';
import { MarketData, PerformanceMetrics, PerformanceHistoryPoint } from './types';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<PageType>('dashboard');
  const [marketData, setMarketData] = useState<MarketData[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  
  const [entryPriceBTC, setEntryPriceBTC] = useState<number>(0);

  const [performance, setPerformance] = useState<PerformanceMetrics>({
    totalPnL: 0,
    realizedPnL: 0,
    unrealizedPnL: 0,
    winRate: 68.5,
    lossRate: 31.5,
    avgDuration: '4h 12m',
    activeTradeCount: 3
  });

  const [perfHistory, setPerfHistory] = useState<PerformanceHistoryPoint[]>([]);
  const lastHistoryUpdate = useRef<number>(0);
  
  // 使用真實交易引擎的交易歷史
  const [tradeLog, setTradeLog] = useState<TradeRecord[]>([]);
  const latestCandleRef = useRef<MarketData | null>(null);

  // 訂閱交易引擎狀態變化
  const updateTradeLog = useCallback(() => {
    setTradeLog(tradingEngine.getTradeHistory());
    
    // 更新績效指標
    const positions = tradingEngine.getPositions();
    const totalUnrealized = positions.reduce((sum, p) => sum + p.unrealizedPnL, 0);
    const trades = tradingEngine.getTradeHistory();
    const totalRealized = trades.filter(t => t.type === 'CLOSE').reduce((sum, t) => sum + (t.realizedPnL || 0), 0);
    
    setPerformance(prev => ({
      ...prev,
      totalPnL: totalRealized + totalUnrealized,
      realizedPnL: totalRealized,
      unrealizedPnL: totalUnrealized,
      activeTradeCount: positions.length
    }));
  }, []);

  useEffect(() => {
    const unsubscribe = tradingEngine.subscribe(updateTradeLog);
    return unsubscribe;
  }, [updateTradeLog]);

  useEffect(() => {
    const init = async () => {
      serverLog.log('INFO', 'SYSTEM', '📡 正在連接市場數據', '獲取 Binance 歷史 K 線...');
      const history = await fetchHistoricalData();
      if (history.length > 0) {
        setMarketData(history);
        const initialPrice = history[history.length - 1].close;
        setCurrentPrice(initialPrice);
        setEntryPriceBTC(initialPrice);
        setLoading(false);
        serverLog.log('SUCCESS', 'SYSTEM', '📊 市場數據就緒', `已載入 ${history.length} 根 K 線，當前價格: $${initialPrice.toFixed(2)}`);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (loading) return;
    
    serverLog.logWsConnection(true);
    
    const ws = connectBinanceStream((rawPoint) => {
      latestCandleRef.current = rawPoint;
    });

    // 監聽 WebSocket 關閉事件
    ws.onclose = () => {
      serverLog.logWsConnection(false);
    };
    
    ws.onerror = () => {
      serverLog.logError('WEBSOCKET', 'WebSocket 錯誤', 'Binance 連線發生錯誤');
    };

    const throttleInterval = setInterval(() => {
      if (latestCandleRef.current) {
        const rawPoint = latestCandleRef.current;
        latestCandleRef.current = null;

        setMarketData(prev => {
          const last = prev[prev.length - 1];
          if (!last) return [rawPoint];
          const isNewCandle = rawPoint.time !== last.time;
          let newData = [...prev];
          
          if (isNewCandle) {
            newData = [...prev, rawPoint];
            if (newData.length > 100) newData.shift();
          } else {
            newData[newData.length - 1] = {
              ...last,
              ...rawPoint,
            };
          }

          const closes = newData.map(d => d.close);
          const ema12 = calculateEMAArray(closes, 12);
          const ema26 = calculateEMAArray(closes, 26);
          const macdLine = ema12.map((v, i) => v - ema26[i]);
          const signalLine = calculateEMAArray(macdLine, 9);

          const updatedData = newData.map((point, i) => {
               const slicedCloses = closes.slice(0, i + 1);
               const sma20 = calculateSMA(slicedCloses, 20);
               const stdDev = calculateStandardDeviation(slicedCloses, 20);

               return {
                   ...point,
                   ma7: calculateSMA(slicedCloses, 7),
                   ma25: calculateSMA(slicedCloses, 25),
                   ma99: calculateSMA(slicedCloses, 99),
                   bb_upper: sma20 + (stdDev * 2),
                   bb_lower: sma20 - (stdDev * 2),
                   macd_line: macdLine[i],
                   macd_signal: signalLine[i],
                   macd_hist: macdLine[i] - signalLine[i]
               };
          });

          setCurrentPrice(rawPoint.close);
          return updatedData;
        });
      }
    }, 250);

    return () => {
      ws.close();
      clearInterval(throttleInterval);
    };
  }, [loading]);

  // 當價格更新時，更新交易引擎的市價
  useEffect(() => {
    if (currentPrice > 0) {
      tradingEngine.updateMarkPrices({ 'BTCUSDT': currentPrice, 'BTC/USDT': currentPrice });
    }
  }, [currentPrice]);

  useEffect(() => {
    if (currentPrice === 0 || entryPriceBTC === 0) return;
    const now = Date.now();

    // 從交易引擎獲取真實數據
    const positions = tradingEngine.getPositions();
    const trades = tradingEngine.getTradeHistory();
    const realUnrealized = positions.reduce((sum, p) => sum + p.unrealizedPnL, 0);
    const realRealized = trades.filter(t => t.type === 'CLOSE').reduce((sum, t) => sum + (t.realizedPnL || 0), 0);
    const realTotalPnL = realRealized + realUnrealized;

    // 計算勝率趨勢
    const pnlTrend = realTotalPnL > 100 ? 0.02 : realTotalPnL < -100 ? -0.02 : 0;

    setPerformance(prev => {
        const newWinRate = Math.min(100, Math.max(0, prev.winRate + pnlTrend));
        return {
            ...prev,
            totalPnL: realTotalPnL,
            realizedPnL: realRealized,
            unrealizedPnL: realUnrealized,
            winRate: newWinRate,
            lossRate: 100 - newWinRate,
            activeTradeCount: positions.length
        };
    });

    if (now - lastHistoryUpdate.current > 2000) {
        setPerfHistory(prev => {
            const newPoint: PerformanceHistoryPoint = {
                time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                totalPnL: realTotalPnL,
                winRate: performance.winRate,
                lossRate: performance.lossRate
            };
            const newHistory = [...prev, newPoint];
            if (newHistory.length > 500) newHistory.shift(); 
            return newHistory;
        });
        lastHistoryUpdate.current = now;
    }


  }, [currentPrice, entryPriceBTC]);

  // 讓 botEngine 處理市場數據 (24hr 自動交易邏輯)
  useEffect(() => {
    if (marketData.length > 30 && currentPrice > 0) {
      botEngine.processMarketData(marketData, currentPrice);
    }
  }, [marketData, currentPrice]);

  // Render Trading Page
  if (currentPage === 'trading') {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-300 font-sans selection:bg-primary/20">
        <Navigation currentPage={currentPage} onNavigate={setCurrentPage} currentPrice={currentPrice} />
        <TradingPage currentPrice={currentPrice} marketData={marketData} />
      </div>
    );
  }

  // Render Bots Page
  if (currentPage === 'bots') {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-300 font-sans selection:bg-primary/20">
        <Navigation currentPage={currentPage} onNavigate={setCurrentPage} currentPrice={currentPrice} />
        <BotsPage currentPrice={currentPrice} marketData={marketData} />
      </div>
    );
  }

  // Render History Page
  if (currentPage === 'history') {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-300 font-sans selection:bg-primary/20">
        <Navigation currentPage={currentPage} onNavigate={setCurrentPage} currentPrice={currentPrice} />
        <HistoryPage currentPrice={currentPrice} />
      </div>
    );
  }

  // Render Dashboard
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 font-sans selection:bg-primary/20">
      <Navigation currentPage={currentPage} onNavigate={setCurrentPage} currentPrice={currentPrice} />

      <main className="max-w-[1920px] mx-auto p-4 lg:p-6">
        {/* Derivatives Stats Bar */}
        <section className="mb-4">
          <DerivativesStats data={MOCK_DERIVATIVES} />
        </section>

        {/* Main 3-Column Layout */}
        <div className="grid grid-cols-12 gap-4">
          
          {/* LEFT COLUMN - Chart + AI + Trade Log (spans 8 cols on xl) */}
          <div className="col-span-12 xl:col-span-8 space-y-4">
            {/* Main Chart */}
            <div className="bg-surface rounded-xl border border-zinc-800 p-1.5 shadow-lg shadow-black/20" style={{ height: '480px' }}>
              {loading ? (
                <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 gap-3">
                  <div className="w-10 h-10 border-4 border-zinc-700 border-t-primary rounded-full animate-spin"></div>
                  <span className="font-medium tracking-wide">建立市場數據連線...</span>
                </div>
              ) : (
                <ChartWidget data={marketData} trades={tradeLog} />
              )}
            </div>

            {/* Bottom Row: AI Panel + Trade Log */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="h-[340px]">
                <AIAnalysisPanel
                  symbol="BTCUSDT"
                  marketData={marketData}
                  derivatives={MOCK_DERIVATIVES}
                />
              </div>
              <div className="h-[340px]">
                <TradeLogWidget 
                  trades={tradeLog} 
                  totalRealizedPnL={performance.realizedPnL} 
                  unrealizedPnL={performance.unrealizedPnL} 
                />
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN - Server Log + Widgets (spans 4 cols on xl) */}
          <div className="col-span-12 xl:col-span-4 space-y-4">
            {/* Action Buttons Row */}
            <div className="grid grid-cols-2 gap-3">
              {/* Manual Trade Button */}
              <button
                onClick={() => setCurrentPage('trading')}
                className="bg-gradient-to-r from-accent to-blue-600 hover:from-blue-500 hover:to-accent text-white font-bold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-accent/20 hover:shadow-xl group"
              >
                <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>手動交易</span>
              </button>

              {/* Bots Page Button */}
              <button
                onClick={() => setCurrentPage('bots')}
                className="bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white font-bold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-900/30 hover:shadow-xl group"
              >
                <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span>自動機器人</span>
              </button>
            </div>

            {/* Server Log Panel - 嵌入式 */}
            <div style={{ height: '400px' }}>
              <ServerLogWidget embedded={true} height="100%" />
            </div>

            {/* Core Engine + Risk Config */}
            <div className="grid grid-cols-1 gap-4">
              <CoreEngineWidget />
              <RiskConfigWidget />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
