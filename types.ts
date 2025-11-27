
export interface MarketData {
  time: string; // Display string HH:mm
  timestamp: number; // Unix timestamp (ms)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  ma7: number;
  ma25: number;
  ma99: number;
  // Bollinger Bands
  bb_upper: number;
  bb_lower: number;
  // MACD
  macd_line: number;
  macd_signal: number;
  macd_hist: number;
}

export interface DerivativeMetrics {
  fundingRate: number; // e.g., 0.01%
  openInterest: number; // in Millions
  longShortRatio: number; // e.g., 1.2
  liquidations24h: number; // in Millions
}

export interface GroundingSource {
  title: string;
  url: string;
}

export interface AIAnalysisResult {
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number; // 0-100
  reason: string;
  suggested_entry: string;
  suggested_take_profit: string; // New field for Take Profit
  suggested_stop_loss: string;
  suggested_leverage: string; // New field for Leverage Suggestion
  primary_driver: 'TECHNICAL' | 'DERIVATIVES' | 'HYBRID';
  timestamp: number;
  groundingSources?: GroundingSource[]; // Sources from Google Search
}

export interface Trade {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  price: number;
  amount: number;
  pnl?: number;
  timestamp: number;
}

export interface ContractPosition {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  size: number; // In USDT or Coin amount
  leverage: number;
  entryPrice: number;
  markPrice: number;
  liquidationPrice: number;
  unrealizedPnL: number;
  roe: number; // Return on Equity %
  marginType: 'CROSS' | 'ISOLATED';
}

export interface BotStatus {
  id: string;
  pair: string;
  status: 'RUNNING' | 'PAUSED' | 'STOPPED';
  strategy: string;
  
  // Financials
  initial_balance: number;
  balance: number; // Current Wallet Balance
  equity: number; // Balance + Unrealized PnL
  unrealized: number; // Unrealized PnL
  pnl: number; // Realized PnL
  roi: number; // Return on Investment %
  
  // Risk & Settings
  leverage: number; // e.g., 20
  marginType: 'CROSS' | 'ISOLATED';
  open_positions: number;
  
  uptime: string;
  trades: Trade[];
}

export interface RiskSettings {
  maxDrawdown: number;
  stopLoss: number;
  takeProfit: number;
  maxPositionSize: number;
}

export interface PerformanceMetrics {
  totalPnL: number;      // Total Net Profit
  realizedPnL: number;   // Banked Profit
  unrealizedPnL: number; // Floating Profit (Live)
  winRate: number;
  lossRate: number;
  avgDuration: string;
  activeTradeCount: number;
}

export interface PerformanceHistoryPoint {
  time: string;
  totalPnL: number;
  winRate: number;
  lossRate: number;
}