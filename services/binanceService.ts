
import { MarketData } from '../types';
import { processBinanceData, calculateSMA } from '../utils/indicators';

const SYMBOL = 'BTCUSDT';
const INTERVAL = '15m';

// Fetch initial history
export const fetchHistoricalData = async (): Promise<MarketData[]> => {
  try {
    const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${SYMBOL}&interval=${INTERVAL}&limit=100`);
    const data = await response.json();
    return processBinanceData(data);
  } catch (error) {
    console.error("Failed to fetch Binance data", error);
    return [];
  }
};

// WebSocket Connection
export const connectBinanceStream = (
  onUpdate: (data: MarketData) => void
) => {
  const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${SYMBOL.toLowerCase()}@kline_${INTERVAL}`);

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    const k = message.k;

    // Construct real-time candle
    const currentPrice = parseFloat(k.c);
    const timestamp = k.t; // Start time of the candle in ms
    
    const updatePoint: MarketData = {
      time: new Date(timestamp).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
      timestamp: timestamp,
      open: parseFloat(k.o),
      high: parseFloat(k.h),
      low: parseFloat(k.l),
      close: currentPrice,
      volume: parseFloat(k.v),
      // Placeholders, will be recalculated in App state
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
  };

  return ws;
};