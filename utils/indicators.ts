
import { MarketData } from '../types';

export const calculateSMA = (data: number[], period: number): number => {
  if (data.length < period) return data[data.length - 1] || 0;
  const slice = data.slice(data.length - period);
  const sum = slice.reduce((a, b) => a + b, 0);
  return sum / period;
};

export const calculateStandardDeviation = (data: number[], period: number): number => {
  if (data.length < period) return 0;
  const slice = data.slice(data.length - period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
  return Math.sqrt(variance);
};

export const calculateEMAArray = (data: number[], period: number): number[] => {
  const k = 2 / (period + 1);
  const result: number[] = [];
  if (data.length === 0) return [];
  
  let ema = data[0];
  result.push(ema);
  
  for (let i = 1; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
    result.push(ema);
  }
  return result;
};

export const processBinanceData = (klineData: any[]): MarketData[] => {
  // Binance Kline: [time, open, high, low, close, volume, ...]
  const closePrices = klineData.map(k => parseFloat(k[4]));

  // Pre-calculate MACD Components
  const ema12 = calculateEMAArray(closePrices, 12);
  const ema26 = calculateEMAArray(closePrices, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const signalLine = calculateEMAArray(macdLine, 9);

  const processed: MarketData[] = [];

  klineData.forEach((k, i) => {
    const timestamp = k[0];
    const close = parseFloat(k[4]);
    const slicedCloses = closePrices.slice(0, i + 1);
    
    // BB (20, 2)
    const sma20 = calculateSMA(slicedCloses, 20);
    const stdDev = calculateStandardDeviation(slicedCloses, 20);

    const point: MarketData = {
      time: new Date(timestamp).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
      timestamp: timestamp,
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: close,
      volume: parseFloat(k[5]),
      ma7: calculateSMA(slicedCloses, 7),
      ma25: calculateSMA(slicedCloses, 25),
      ma99: calculateSMA(slicedCloses, 99),
      // Bollinger Bands
      bb_upper: sma20 + (stdDev * 2),
      bb_lower: sma20 - (stdDev * 2),
      // MACD
      macd_line: macdLine[i],
      macd_signal: signalLine[i],
      macd_hist: macdLine[i] - signalLine[i]
    };
    processed.push(point);
  });

  return processed;
};