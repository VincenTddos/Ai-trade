
import { MarketData, DerivativeMetrics, BotStatus, Trade } from '../types';

export const generateMockMarketData = (count: number): MarketData[] => {
  const data: MarketData[] = [];
  let price = 64000;
  let date = new Date();
  date.setHours(date.getHours() - count);

  for (let i = 0; i < count; i++) {
    const timestamp = date.getTime();
    const volatility = (Math.random() - 0.5) * 200;
    const open = price;
    const close = price + volatility;
    const high = Math.max(open, close) + Math.random() * 50;
    const low = Math.min(open, close) - Math.random() * 50;
    
    // Simulate MAs roughly
    const ma7 = close + (Math.random() - 0.5) * 100;
    const ma25 = close + (Math.random() - 0.5) * 300;
    const ma99 = close + (Math.random() - 0.5) * 800;

    data.push({
      time: date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
      timestamp: timestamp,
      open,
      high,
      low,
      close,
      volume: Math.floor(Math.random() * 1000) + 500,
      ma7,
      ma25,
      ma99,
      // Mock BB
      bb_upper: close + 200,
      bb_lower: close - 200,
      // Mock MACD
      macd_line: 0,
      macd_signal: 0,
      macd_hist: 0
    });

    price = close;
    date.setMinutes(date.getMinutes() + 15); // 15m intervals
  }
  return data;
};

export const MOCK_DERIVATIVES: DerivativeMetrics = {
  fundingRate: 0.0105,
  openInterest: 452.5,
  longShortRatio: 1.12,
  liquidations24h: 12.5
};

const generateTrades = (symbol: string, count: number): Trade[] => {
  const trades: Trade[] = [];
  const now = Date.now();
  for(let i=0; i<count; i++) {
     const isWin = Math.random() > 0.4;
     const side = Math.random() > 0.5 ? 'BUY' : 'SELL';
     const price = symbol.includes('BTC') ? 60000 + Math.random()*5000 : symbol.includes('ETH') ? 3000 + Math.random()*500 : 150 + Math.random()*20;
     trades.push({
        id: `TRD-${Math.floor(Math.random()*10000)}`,
        symbol,
        side,
        price,
        amount: Math.random() * 2,
        pnl: isWin ? Math.random() * 150 : -Math.random() * 50,
        timestamp: now - (i * 3600 * 1000 * 4) // spaced out by 4 hours
     });
  }
  return trades;
}

export const MOCK_BOTS: BotStatus[] = [
  { 
    id: 'BOT-001', 
    pair: 'BTC/USDT', 
    status: 'RUNNING', 
    strategy: '布林通道突破', 
    initial_balance: 10000,
    balance: 11250.45,
    equity: 11250.45,
    unrealized: 0,
    pnl: 1250.45,
    roi: 12.5,
    leverage: 20,
    marginType: 'CROSS',
    open_positions: 1,
    uptime: '4天 12小時',
    trades: generateTrades('BTC/USDT', 5)
  },
  { 
    id: 'BOT-002', 
    pair: 'ETH/USDT', 
    status: 'RUNNING', 
    strategy: 'MACD 趨勢跟蹤', 
    initial_balance: 5000,
    balance: 5430.20,
    equity: 5480.20,
    unrealized: 50.00,
    pnl: 430.20, 
    roi: 8.4,
    leverage: 10,
    marginType: 'ISOLATED',
    open_positions: 1,
    uptime: '1天 04小時',
    trades: generateTrades('ETH/USDT', 3)
  },
  { 
    id: 'BOT-003', 
    pair: 'SOL/USDT', 
    status: 'PAUSED', 
    strategy: 'RSI 反轉策略', 
    initial_balance: 3000,
    balance: 2955.00,
    equity: 2955.00,
    unrealized: 0,
    pnl: -45.00, 
    roi: -1.2,
    leverage: 5,
    marginType: 'ISOLATED',
    open_positions: 0,
    uptime: '0天 15小時',
    trades: generateTrades('SOL/USDT', 2)
  },
];