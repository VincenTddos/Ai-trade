/**
 * Historical K-line Data Service
 * 
 * 從 Binance 獲取歷史 K 線數據，支援多年數據查詢
 * 優化版本：並行請求、更快同步
 */

import { MarketData } from '../types';
import { processBinanceData } from '../utils/indicators';

// Binance API 設定
const BINANCE_API = 'https://api.binance.com/api/v3';
const MAX_KLINES_PER_REQUEST = 1000;

// 並行請求設定 - 加速數據獲取
const MAX_CONCURRENT_REQUESTS = 5;  // 同時 5 個請求
const REQUEST_DELAY = 50;  // 每批次間隔 50ms（更快）

// 時間間隔對應的毫秒數
export const INTERVAL_MS: Record<string, number> = {
  '1m': 60 * 1000,
  '3m': 3 * 60 * 1000,
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '2h': 2 * 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '8h': 8 * 60 * 60 * 1000,
  '12h': 12 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
  '3d': 3 * 24 * 60 * 60 * 1000,
  '1w': 7 * 24 * 60 * 60 * 1000,
  '1M': 30 * 24 * 60 * 60 * 1000,
};

// 預設時間範圍
export type TimeRange = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | '2Y' | 'ALL';

export interface TimeRangeConfig {
  label: string;
  days: number;
  interval: string;
  description: string;
}

export const TIME_RANGE_CONFIG: Record<TimeRange, TimeRangeConfig> = {
  '1D': { label: '1天', days: 1, interval: '5m', description: '5分鐘線' },
  '1W': { label: '1週', days: 7, interval: '15m', description: '15分鐘線' },
  '1M': { label: '1月', days: 30, interval: '1h', description: '1小時線' },
  '3M': { label: '3月', days: 90, interval: '4h', description: '4小時線' },
  '6M': { label: '6月', days: 180, interval: '4h', description: '4小時線' },
  '1Y': { label: '1年', days: 365, interval: '1d', description: '日線' },
  '2Y': { label: '2年', days: 730, interval: '1d', description: '日線' },
  'ALL': { label: '全部', days: 2500, interval: '1d', description: '日線 (從2017年起)' },
};

export interface FetchProgress {
  current: number;
  total: number;
  message: string;
}

export interface HistoricalDataResult {
  data: MarketData[];
  symbol: string;
  interval: string;
  startTime: number;
  endTime: number;
  totalRecords: number;
}

/**
 * 歷史數據服務類別
 */
class HistoricalDataService {
  private cache: Map<string, HistoricalDataResult> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 分鐘快取

  /**
   * 生成快取鍵值
   */
  private getCacheKey(symbol: string, interval: string, startTime: number, endTime: number): string {
    return `${symbol}-${interval}-${startTime}-${endTime}`;
  }

  /**
   * 檢查快取是否有效
   */
  private isCacheValid(key: string): boolean {
    const expiry = this.cacheExpiry.get(key);
    if (!expiry) return false;
    return Date.now() < expiry;
  }

  /**
   * 單次 API 請求獲取 K 線
   */
  private async fetchKlines(
    symbol: string,
    interval: string,
    startTime?: number,
    endTime?: number,
    limit: number = MAX_KLINES_PER_REQUEST
  ): Promise<any[]> {
    const params = new URLSearchParams({
      symbol: symbol,
      interval: interval,
      limit: limit.toString(),
    });

    if (startTime) params.append('startTime', startTime.toString());
    if (endTime) params.append('endTime', endTime.toString());

    const response = await fetch(`${BINANCE_API}/klines?${params}`);
    
    if (!response.ok) {
      throw new Error(`Binance API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * 並行獲取多個時間區段的 K 線
   */
  private async fetchKlinesBatch(
    symbol: string,
    interval: string,
    timeRanges: { start: number; end: number }[]
  ): Promise<any[][]> {
    const results = await Promise.all(
      timeRanges.map(({ start, end }) =>
        this.fetchKlines(symbol, interval, start, end, MAX_KLINES_PER_REQUEST)
          .catch(err => {
            console.warn(`Batch fetch error for ${start}:`, err);
            return [];
          })
      )
    );
    return results;
  }

  /**
   * 獲取時間範圍內的所有 K 線數據
   * 使用並行請求加速獲取
   */
  async fetchHistoricalData(
    symbol: string = 'BTCUSDT',
    timeRange: TimeRange = '1M',
    onProgress?: (progress: FetchProgress) => void
  ): Promise<HistoricalDataResult> {
    const config = TIME_RANGE_CONFIG[timeRange];
    const interval = config.interval;
    const intervalMs = INTERVAL_MS[interval];
    
    const endTime = Date.now();
    const startTime = endTime - (config.days * 24 * 60 * 60 * 1000);

    // 檢查快取
    const cacheKey = this.getCacheKey(symbol, interval, startTime, endTime);
    if (this.isCacheValid(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        onProgress?.({ current: 100, total: 100, message: '從快取載入' });
        return cached;
      }
    }

    // 計算需要的時間區段
    const batchSize = MAX_KLINES_PER_REQUEST * intervalMs;
    const timeRanges: { start: number; end: number }[] = [];
    let currentStart = startTime;
    
    while (currentStart < endTime) {
      const batchEnd = Math.min(currentStart + batchSize, endTime);
      timeRanges.push({ start: currentStart, end: batchEnd });
      currentStart = batchEnd;
    }

    const totalBatches = Math.ceil(timeRanges.length / MAX_CONCURRENT_REQUESTS);
    onProgress?.({ current: 0, total: totalBatches, message: `並行獲取 ${config.label} 數據...` });

    let allKlines: any[] = [];
    
    // 分批並行請求
    for (let i = 0; i < timeRanges.length; i += MAX_CONCURRENT_REQUESTS) {
      const batch = timeRanges.slice(i, i + MAX_CONCURRENT_REQUESTS);
      const batchResults = await this.fetchKlinesBatch(symbol, interval, batch);
      
      // 合併結果
      for (const result of batchResults) {
        allKlines = allKlines.concat(result);
      }

      const batchNum = Math.floor(i / MAX_CONCURRENT_REQUESTS) + 1;
      onProgress?.({
        current: batchNum,
        total: totalBatches,
        message: `已獲取 ${allKlines.length.toLocaleString()} 根 K 線...`
      });

      // 批次間短暫延遲，避免觸發 API 限制
      if (i + MAX_CONCURRENT_REQUESTS < timeRanges.length) {
        await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY));
      }
    }

    // 去重並排序 (根據開盤時間)
    const uniqueKlines = Array.from(
      new Map(allKlines.map(k => [k[0], k])).values()
    ).sort((a, b) => a[0] - b[0]);

    // 轉換為 MarketData 格式
    const marketData = processBinanceData(uniqueKlines);

    const result: HistoricalDataResult = {
      data: marketData,
      symbol,
      interval,
      startTime,
      endTime,
      totalRecords: marketData.length,
    };

    // 存入快取
    this.cache.set(cacheKey, result);
    this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_DURATION);

    onProgress?.({
      current: totalBatches,
      total: totalBatches,
      message: `完成！共 ${marketData.length.toLocaleString()} 根 K 線`
    });

    return result;
  }

  /**
   * 獲取自訂時間範圍的數據
   */
  async fetchCustomRange(
    symbol: string,
    interval: string,
    startDate: Date,
    endDate: Date,
    onProgress?: (progress: FetchProgress) => void
  ): Promise<HistoricalDataResult> {
    const startTime = startDate.getTime();
    const endTime = endDate.getTime();
    const intervalMs = INTERVAL_MS[interval];

    if (!intervalMs) {
      throw new Error(`Invalid interval: ${interval}`);
    }

    const cacheKey = this.getCacheKey(symbol, interval, startTime, endTime);
    if (this.isCacheValid(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;
    }

    const totalKlines = Math.ceil((endTime - startTime) / intervalMs);
    const totalRequests = Math.ceil(totalKlines / MAX_KLINES_PER_REQUEST);

    let allKlines: any[] = [];
    let currentStart = startTime;
    let requestCount = 0;

    while (currentStart < endTime) {
      try {
        const klines = await this.fetchKlines(symbol, interval, currentStart, endTime);

        if (klines.length === 0) break;

        allKlines = allKlines.concat(klines);
        requestCount++;

        onProgress?.({
          current: requestCount,
          total: totalRequests,
          message: `獲取中... ${allKlines.length.toLocaleString()} 根 K 線`
        });

        const lastKline = klines[klines.length - 1];
        currentStart = lastKline[0] + intervalMs;

        if (klines.length < MAX_KLINES_PER_REQUEST) break;

        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error('Fetch error:', error);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const uniqueKlines = Array.from(
      new Map(allKlines.map(k => [k[0], k])).values()
    ).sort((a, b) => a[0] - b[0]);

    const marketData = processBinanceData(uniqueKlines);

    const result: HistoricalDataResult = {
      data: marketData,
      symbol,
      interval,
      startTime,
      endTime,
      totalRecords: marketData.length,
    };

    this.cache.set(cacheKey, result);
    this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_DURATION);

    return result;
  }

  /**
   * 獲取可用的交易對列表
   */
  async fetchAvailableSymbols(): Promise<{ symbol: string; baseAsset: string; volume24h: number }[]> {
    try {
      // 獲取交易所資訊
      const infoResponse = await fetch(`${BINANCE_API}/exchangeInfo`);
      const exchangeInfo = await infoResponse.json();

      // 獲取 24 小時成交量
      const tickerResponse = await fetch(`${BINANCE_API}/ticker/24hr`);
      const tickers = await tickerResponse.json();
      const tickerMap = new Map(tickers.map((t: any) => [t.symbol, t]));

      const symbols = exchangeInfo.symbols
        .filter((s: any) => s.quoteAsset === 'USDT' && s.status === 'TRADING')
        .map((s: any) => {
          const ticker = tickerMap.get(s.symbol) as any;
          return {
            symbol: s.symbol,
            baseAsset: s.baseAsset,
            volume24h: ticker ? parseFloat(ticker.quoteVolume) : 0,
          };
        })
        .filter((s: any) => s.volume24h > 1000000) // 過濾 24h 成交量 > 100萬 USDT
        .sort((a: any, b: any) => b.volume24h - a.volume24h);

      return symbols;
    } catch (error) {
      console.error('Error fetching symbols:', error);
      return [];
    }
  }

  /**
   * 清除快取
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheExpiry.clear();
  }

  /**
   * 獲取快取統計
   */
  getCacheStats(): { entries: number; size: string } {
    const entries = this.cache.size;
    let totalSize = 0;
    this.cache.forEach((result) => {
      totalSize += result.data.length;
    });
    return {
      entries,
      size: `${(totalSize / 1000).toFixed(1)}K records`,
    };
  }

  /**
   * 建立 WebSocket 連接以同步即時數據
   * 返回 WebSocket 實例和更新回調
   */
  createRealtimeSync(
    symbol: string,
    interval: string,
    onUpdate: (data: MarketData) => void
  ): WebSocket {
    const wsSymbol = symbol.toLowerCase();
    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${wsSymbol}@kline_${interval}`);

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        const k = message.k;
        
        if (k) {
          const updatePoint: MarketData = {
            time: new Date(k.t).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
            timestamp: k.t,
            open: parseFloat(k.o),
            high: parseFloat(k.h),
            low: parseFloat(k.l),
            close: parseFloat(k.c),
            volume: parseFloat(k.v),
            ma7: 0,
            ma25: 0,
            ma99: 0,
            bb_upper: 0,
            bb_lower: 0,
            macd_line: 0,
            macd_signal: 0,
            macd_hist: 0
          };
          onUpdate(updatePoint);
        }
      } catch (err) {
        console.error('WebSocket parse error:', err);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return ws;
  }

  /**
   * 快速獲取最新 K 線（用於快速同步）
   */
  async fetchLatestKlines(
    symbol: string = 'BTCUSDT',
    interval: string = '1h',
    limit: number = 100
  ): Promise<MarketData[]> {
    try {
      const klines = await this.fetchKlines(symbol, interval, undefined, undefined, limit);
      return processBinanceData(klines);
    } catch (error) {
      console.error('Error fetching latest klines:', error);
      return [];
    }
  }

  /**
   * 預載入常用數據（在背景執行）
   */
  async preloadCommonData(symbol: string = 'BTCUSDT'): Promise<void> {
    const ranges: TimeRange[] = ['1D', '1W', '1M'];
    
    // 並行預載入
    await Promise.all(
      ranges.map(range => 
        this.fetchHistoricalData(symbol, range).catch(err => {
          console.warn(`Preload failed for ${range}:`, err);
        })
      )
    );
  }
}

// 單例導出
export const historicalDataService = new HistoricalDataService();
