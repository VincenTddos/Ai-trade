/**
 * 歷史圖表頁面
 * 
 * 查看多年的 K 線歷史數據，支援多時間範圍切換
 * 整合即時 WebSocket 同步
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  historicalDataService, 
  TimeRange, 
  TIME_RANGE_CONFIG,
  FetchProgress,
  HistoricalDataResult,
  INTERVAL_MS
} from '../services/historicalDataService';
import { calculateSMA, calculateStandardDeviation, calculateEMAArray } from '../utils/indicators';
import TimeRangeSelector from './TimeRangeSelector';
import ChartWidget from './ChartWidget';
import { MarketData } from '../types';

interface HistoryPageProps {
  currentPrice: number;
}

const HistoryPage: React.FC<HistoryPageProps> = ({ currentPrice }) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('1M');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<FetchProgress | null>(null);
  const [historyData, setHistoryData] = useState<MarketData[]>([]);
  const [dataInfo, setDataInfo] = useState<{
    interval: string;
    totalRecords: number;
    startDate: string;
    endDate: string;
  } | null>(null);
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [availableSymbols, setAvailableSymbols] = useState<{ symbol: string; baseAsset: string; volume24h: number }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isRealtimeSync, setIsRealtimeSync] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
  // WebSocket ref
  const wsRef = useRef<WebSocket | null>(null);
  const lastProcessedTimeRef = useRef<number>(0);

  // 獲取可用交易對
  useEffect(() => {
    const fetchSymbols = async () => {
      const symbols = await historicalDataService.fetchAvailableSymbols();
      setAvailableSymbols(symbols.slice(0, 50)); // 取前 50 個
    };
    fetchSymbols();
  }, []);

  // 獲取歷史數據
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setProgress({ current: 0, total: 1, message: '初始化...' });

    try {
      const result = await historicalDataService.fetchHistoricalData(
        symbol,
        timeRange,
        (p) => setProgress(p)
      );

      setHistoryData(result.data);
      setDataInfo({
        interval: result.interval,
        totalRecords: result.totalRecords,
        startDate: new Date(result.startTime).toLocaleDateString('zh-TW'),
        endDate: new Date(result.endTime).toLocaleDateString('zh-TW'),
      });
      setLastUpdate(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : '獲取數據失敗');
      console.error('Error fetching historical data:', err);
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }, [symbol, timeRange]);

  // 時間範圍或交易對變化時重新獲取
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // WebSocket 即時同步
  useEffect(() => {
    if (!isRealtimeSync || !dataInfo?.interval || historyData.length === 0) return;

    // 關閉舊連接
    if (wsRef.current) {
      wsRef.current.close();
    }

    const interval = dataInfo.interval;
    const intervalMs = INTERVAL_MS[interval];

    wsRef.current = historicalDataService.createRealtimeSync(
      symbol,
      interval,
      (newData) => {
        const now = Date.now();
        // 節流：根據時間間隔更新
        const throttleMs = Math.min(intervalMs / 10, 1000);
        if (now - lastProcessedTimeRef.current < throttleMs) return;
        lastProcessedTimeRef.current = now;

        setHistoryData(prev => {
          if (prev.length === 0) return prev;

          const lastCandle = prev[prev.length - 1];
          const candleStartTime = Math.floor(newData.timestamp / intervalMs) * intervalMs;
          const lastCandleTime = lastCandle.timestamp;

          // 計算指標
          const updatedData = newData;
          
          if (candleStartTime === lastCandleTime) {
            // 更新當前 K 線
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...lastCandle,
              high: Math.max(lastCandle.high, newData.high),
              low: Math.min(lastCandle.low, newData.low),
              close: newData.close,
              volume: newData.volume,
            };
            return updated;
          } else if (candleStartTime > lastCandleTime) {
            // 新 K 線
            const updated = [...prev, updatedData];
            // 保持合理長度
            if (updated.length > 2000) {
              updated.shift();
            }
            return updated;
          }

          return prev;
        });

        setLastUpdate(new Date());
      }
    );

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [symbol, dataInfo?.interval, isRealtimeSync, historyData.length]);

  // 計算統計數據
  const stats = React.useMemo(() => {
    if (historyData.length < 2) return null;

    const firstPrice = historyData[0].close;
    const lastPrice = historyData[historyData.length - 1].close;
    const priceChange = lastPrice - firstPrice;
    const priceChangePercent = (priceChange / firstPrice) * 100;
    
    const highestPrice = Math.max(...historyData.map(d => d.high));
    const lowestPrice = Math.min(...historyData.map(d => d.low));
    const avgVolume = historyData.reduce((sum, d) => sum + d.volume, 0) / historyData.length;

    // 計算最大回撤
    let maxDrawdown = 0;
    let peak = historyData[0].close;
    for (const d of historyData) {
      if (d.close > peak) peak = d.close;
      const drawdown = (peak - d.close) / peak * 100;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    return {
      firstPrice,
      lastPrice,
      priceChange,
      priceChangePercent,
      highestPrice,
      lowestPrice,
      avgVolume,
      maxDrawdown,
    };
  }, [historyData]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 p-6 lg:p-8">
      <div className="max-w-[1920px] mx-auto">
        {/* 頁面標題 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-zinc-100 flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-xl">
                <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              歷史 K 線分析
            </h2>
            <p className="text-zinc-500 mt-1 text-sm">查看多年歷史數據，分析長期趨勢</p>
          </div>

          {/* 當前價格 */}
          <div className="bg-surface border border-zinc-800 rounded-xl px-5 py-3">
            <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">{symbol}</div>
            <div className="text-xl font-mono font-bold text-white">
              ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* 控制列 */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 bg-surface border border-zinc-800 rounded-xl p-4">
          {/* 交易對選擇 */}
          <div className="flex items-center gap-3">
            <label className="text-xs text-zinc-500 uppercase tracking-wider">交易對</label>
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm font-mono text-zinc-100 outline-none focus:border-accent transition-colors"
              disabled={loading}
            >
              {availableSymbols.map((s) => (
                <option key={s.symbol} value={s.symbol}>
                  {s.baseAsset}/USDT (${(s.volume24h / 1e9).toFixed(1)}B)
                </option>
              ))}
            </select>
          </div>

          {/* 時間範圍選擇 */}
          <TimeRangeSelector
            currentRange={timeRange}
            onRangeChange={setTimeRange}
            loading={loading}
            progress={progress}
            currentInterval={dataInfo?.interval}
            totalRecords={dataInfo?.totalRecords}
          />

          {/* 即時同步開關 */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsRealtimeSync(!isRealtimeSync)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                isRealtimeSync
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isRealtimeSync ? 'bg-green-500 animate-pulse' : 'bg-zinc-600'}`} />
              即時同步
            </button>
            {lastUpdate && isRealtimeSync && (
              <span className="text-xs text-zinc-500">
                更新: {lastUpdate.toLocaleTimeString('zh-TW')}
              </span>
            )}
          </div>

          {/* 刷新按鈕 */}
          <button
            onClick={() => {
              historicalDataService.clearCache();
              fetchData();
            }}
            disabled={loading}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            刷新數據
          </button>
        </div>

        {/* 錯誤訊息 */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* 統計卡片 */}
        {stats && !loading && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
            <StatCard
              label="起始價格"
              value={`$${stats.firstPrice.toLocaleString()}`}
              subtext={dataInfo?.startDate}
            />
            <StatCard
              label="結束價格"
              value={`$${stats.lastPrice.toLocaleString()}`}
              subtext={dataInfo?.endDate}
            />
            <StatCard
              label="價格變動"
              value={`${stats.priceChangePercent >= 0 ? '+' : ''}${stats.priceChangePercent.toFixed(2)}%`}
              valueColor={stats.priceChangePercent >= 0 ? 'text-primary' : 'text-danger'}
              subtext={`${stats.priceChange >= 0 ? '+' : ''}$${stats.priceChange.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            />
            <StatCard
              label="最高價"
              value={`$${stats.highestPrice.toLocaleString()}`}
              valueColor="text-primary"
            />
            <StatCard
              label="最低價"
              value={`$${stats.lowestPrice.toLocaleString()}`}
              valueColor="text-danger"
            />
            <StatCard
              label="最大回撤"
              value={`-${stats.maxDrawdown.toFixed(2)}%`}
              valueColor="text-warning"
            />
          </div>
        )}

        {/* 主圖表 */}
        <div className="bg-surface border border-zinc-800 rounded-xl p-4 shadow-lg shadow-black/20" style={{ height: '600px' }}>
          {loading ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 gap-4">
              <div className="w-12 h-12 border-4 border-zinc-700 border-t-purple-500 rounded-full animate-spin" />
              {progress && (
                <div className="text-center">
                  <div className="text-zinc-400 font-medium mb-2">{progress.message}</div>
                  {progress.total > 1 && (
                    <div className="w-64 h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500 transition-all duration-300"
                        style={{ width: `${(progress.current / progress.total) * 100}%` }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : historyData.length > 0 ? (
            <ChartWidget data={historyData} trades={[]} />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 gap-3">
              <svg className="w-16 h-16 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="text-lg">選擇時間範圍以載入數據</span>
            </div>
          )}
        </div>

        {/* 數據資訊 */}
        {dataInfo && !loading && (
          <div className="mt-4 flex items-center justify-between text-xs text-zinc-600">
            <div>
              數據範圍: {dataInfo.startDate} ~ {dataInfo.endDate}
            </div>
            <div>
              共 {dataInfo.totalRecords.toLocaleString()} 根 K 線 | 週期: {dataInfo.interval}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// 統計卡片組件
const StatCard: React.FC<{
  label: string;
  value: string;
  subtext?: string;
  valueColor?: string;
}> = ({ label, value, subtext, valueColor = 'text-zinc-100' }) => (
  <div className="bg-surface border border-zinc-800 rounded-xl p-4">
    <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">{label}</div>
    <div className={`font-mono font-bold text-lg ${valueColor}`}>{value}</div>
    {subtext && <div className="text-xs text-zinc-600 mt-1">{subtext}</div>}
  </div>
);

export default HistoryPage;
