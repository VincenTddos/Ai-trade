/**
 * 回測引擎 (Backtest Engine)
 * 
 * 完整回測系統，支援：
 * - 歷史數據回測
 * - 策略績效分析
 * - 交易成本計算
 * - 滑點模擬
 * - 詳細報告生成
 */

import { MarketData } from '../types';
import { StrategyType, StrategySignal } from './botEngine';

// 回測配置
export interface BacktestConfig {
  strategy: StrategyType;
  strategyParams: Record<string, number>;
  initialBalance: number;
  leverage: number;
  positionSizePercent: number;  // 每次開倉使用資金的百分比
  stopLossPercent: number;
  takeProfitPercent: number;
  feeRate: number;              // 手續費率 (例如 0.0004 = 0.04%)
  slippagePercent: number;      // 滑點百分比
  
  // Freqtrade 功能
  trailingStop: boolean;
  trailingStopPercent: number;
  trailingStopPositivePercent?: number;  // 盈利多少後啟動移動止損
  minimalROI: Record<number, number>;     // {分鐘: 目標收益率}
  
  // DCA 配置
  dcaEnabled: boolean;
  dcaMaxOrders: number;
  dcaOrderSpacing: number;       // 加倉間隔百分比
  dcaMultiplier: number;         // 加倉倍數
}

// 回測交易記錄
export interface BacktestTrade {
  id: number;
  openTime: number;
  closeTime: number;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number;
  size: number;
  leverage: number;
  fee: number;
  slippage: number;
  pnl: number;
  pnlPercent: number;
  holdingPeriod: number;  // 持倉時間(分鐘)
  exitReason: 'TAKE_PROFIT' | 'STOP_LOSS' | 'TRAILING_STOP' | 'ROI_TARGET' | 'SIGNAL_REVERSE' | 'END_OF_DATA';
}

// 回測結果
export interface BacktestResult {
  config: BacktestConfig;
  startDate: string;
  endDate: string;
  totalBars: number;
  
  // 績效指標
  totalTrades: number;
  winTrades: number;
  lossTrades: number;
  winRate: number;
  
  // 財務指標
  initialBalance: number;
  finalBalance: number;
  totalPnL: number;
  totalPnLPercent: number;
  totalFees: number;
  totalSlippage: number;
  
  // 風險指標
  maxDrawdown: number;
  maxDrawdownPercent: number;
  sharpeRatio: number;
  sortinoRatio: number;
  profitFactor: number;
  
  // 平均值
  avgWin: number;
  avgLoss: number;
  avgHoldingPeriod: number;
  expectancy: number;
  
  // 權益曲線
  equityCurve: { time: number; equity: number }[];
  drawdownCurve: { time: number; drawdown: number }[];
  
  // 交易記錄
  trades: BacktestTrade[];
  
  // 月度統計
  monthlyReturns: { month: string; pnl: number; pnlPercent: number }[];
}

// 策略執行器 (從 botEngine 移植並增強)
class BacktestStrategyExecutor {
  static bollingerBreakout(data: MarketData[], params: Record<string, number>): StrategySignal {
    if (data.length < 20) return { action: 'HOLD', strength: 0, reason: '數據不足' };
    
    const latest = data[data.length - 1];
    const prevData = data[data.length - 2];
    
    if (!prevData) return { action: 'HOLD', strength: 0, reason: '數據不足' };
    
    const bbUpper = latest.bb_upper;
    const bbLower = latest.bb_lower;
    const close = latest.close;
    const prevClose = prevData.close;
    
    // 計算布林帶寬度作為波動性指標
    const bbWidth = (bbUpper - bbLower) / ((bbUpper + bbLower) / 2) * 100;
    
    // 突破上軌 + 成交量確認
    if (close > bbUpper && prevClose <= bbUpper) {
      const strength = Math.min(100, ((close - bbUpper) / bbUpper) * 1000 + bbWidth * 2);
      return { action: 'BUY', strength, reason: `突破布林上軌 (${bbUpper.toFixed(2)})` };
    }
    
    // 跌破下軌
    if (close < bbLower && prevClose >= bbLower) {
      const strength = Math.min(100, ((bbLower - close) / bbLower) * 1000 + bbWidth * 2);
      return { action: 'SELL', strength, reason: `跌破布林下軌 (${bbLower.toFixed(2)})` };
    }
    
    return { action: 'HOLD', strength: 0, reason: '無突破信號' };
  }

  static macdTrend(data: MarketData[], params: Record<string, number>): StrategySignal {
    if (data.length < 26) return { action: 'HOLD', strength: 0, reason: '數據不足' };
    
    const latest = data[data.length - 1];
    const prev = data[data.length - 2];
    
    if (!prev) return { action: 'HOLD', strength: 0, reason: '數據不足' };
    
    const macdLine = latest.macd_line;
    const signalLine = latest.macd_signal;
    const histogram = latest.macd_hist;
    const prevMacd = prev.macd_line;
    const prevSignal = prev.macd_signal;
    
    // 金叉 + 柱狀圖擴張
    if (macdLine > signalLine && prevMacd <= prevSignal) {
      const strength = Math.min(100, Math.abs(macdLine - signalLine) * 10 + Math.abs(histogram) * 5);
      return { action: 'BUY', strength, reason: `MACD 金叉 (${macdLine.toFixed(2)} > ${signalLine.toFixed(2)})` };
    }
    
    // 死叉
    if (macdLine < signalLine && prevMacd >= prevSignal) {
      const strength = Math.min(100, Math.abs(signalLine - macdLine) * 10 + Math.abs(histogram) * 5);
      return { action: 'SELL', strength, reason: `MACD 死叉 (${macdLine.toFixed(2)} < ${signalLine.toFixed(2)})` };
    }
    
    return { action: 'HOLD', strength: 0, reason: '無交叉信號' };
  }

  static rsiReversal(data: MarketData[], params: Record<string, number>): StrategySignal {
    if (data.length < 14) return { action: 'HOLD', strength: 0, reason: '數據不足' };
    
    const period = params.period || 14;
    const closes = data.slice(-period - 1).map(d => d.close);
    
    let gains = 0, losses = 0;
    for (let i = 1; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff > 0) gains += diff;
      else losses += Math.abs(diff);
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    
    const oversold = params.oversold || 30;
    const overbought = params.overbought || 70;
    
    if (rsi < oversold) {
      return { action: 'BUY', strength: Math.min(100, (oversold - rsi) * 3), reason: `RSI 超賣 (${rsi.toFixed(1)})` };
    }
    
    if (rsi > overbought) {
      return { action: 'SELL', strength: Math.min(100, (rsi - overbought) * 3), reason: `RSI 超買 (${rsi.toFixed(1)})` };
    }
    
    return { action: 'HOLD', strength: 0, reason: `RSI 中性 (${rsi.toFixed(1)})` };
  }

  static maCrossover(data: MarketData[], params: Record<string, number>): StrategySignal {
    if (data.length < 25) return { action: 'HOLD', strength: 0, reason: '數據不足' };
    
    const latest = data[data.length - 1];
    const prev = data[data.length - 2];
    
    if (!prev) return { action: 'HOLD', strength: 0, reason: '數據不足' };
    
    const fastMA = latest.ma7;
    const slowMA = latest.ma25;
    const prevFast = prev.ma7;
    const prevSlow = prev.ma25;
    
    if (fastMA > slowMA && prevFast <= prevSlow) {
      return { 
        action: 'BUY', 
        strength: Math.min(100, ((fastMA - slowMA) / slowMA) * 500),
        reason: `MA7 上穿 MA25`
      };
    }
    
    if (fastMA < slowMA && prevFast >= prevSlow) {
      return { 
        action: 'SELL', 
        strength: Math.min(100, ((slowMA - fastMA) / slowMA) * 500),
        reason: `MA7 下穿 MA25`
      };
    }
    
    return { action: 'HOLD', strength: 0, reason: '無交叉信號' };
  }

  static execute(strategy: StrategyType, data: MarketData[], params: Record<string, number>): StrategySignal {
    switch (strategy) {
      case 'BOLLINGER_BREAKOUT':
        return this.bollingerBreakout(data, params);
      case 'MACD_TREND':
        return this.macdTrend(data, params);
      case 'RSI_REVERSAL':
        return this.rsiReversal(data, params);
      case 'MA_CROSSOVER':
        return this.maCrossover(data, params);
      case 'GRID_TRADING':
        return { action: 'HOLD', strength: 0, reason: '網格策略不支援回測' };
      default:
        return { action: 'HOLD', strength: 0, reason: '未知策略' };
    }
  }
}

// 回測引擎
export class BacktestEngine {
  private config: BacktestConfig;
  private data: MarketData[] = [];
  private position: {
    side: 'LONG' | 'SHORT';
    entryPrice: number;
    size: number;
    openTime: number;
    dcaOrders: number;
    highestPrice: number;
    lowestPrice: number;
  } | null = null;
  
  private balance: number = 0;
  private trades: BacktestTrade[] = [];
  private equityCurve: { time: number; equity: number }[] = [];
  private peakEquity: number = 0;
  private maxDrawdown: number = 0;

  constructor(config: BacktestConfig) {
    this.config = config;
    this.balance = config.initialBalance;
    this.peakEquity = config.initialBalance;
  }

  // 執行回測
  run(data: MarketData[]): BacktestResult {
    this.data = data;
    this.trades = [];
    this.equityCurve = [];
    this.balance = this.config.initialBalance;
    this.position = null;
    this.peakEquity = this.config.initialBalance;
    this.maxDrawdown = 0;

    // 最少需要 30 根 K 線來計算指標
    const startIndex = 30;
    
    for (let i = startIndex; i < data.length; i++) {
      const currentBar = data[i];
      const historicalData = data.slice(0, i + 1);
      
      // 計算當前權益
      const currentEquity = this.calculateEquity(currentBar.close);
      this.equityCurve.push({ time: currentBar.timestamp, equity: currentEquity });
      
      // 更新最大回撤
      if (currentEquity > this.peakEquity) {
        this.peakEquity = currentEquity;
      }
      const drawdown = this.peakEquity - currentEquity;
      if (drawdown > this.maxDrawdown) {
        this.maxDrawdown = drawdown;
      }
      
      // 如果有持倉，檢查出場條件
      if (this.position) {
        const exitSignal = this.checkExitConditions(currentBar, i);
        if (exitSignal) {
          this.closePosition(currentBar, exitSignal);
        }
      }
      
      // 執行策略獲取信號
      const signal = BacktestStrategyExecutor.execute(
        this.config.strategy,
        historicalData,
        this.config.strategyParams
      );
      
      const signalThreshold = this.config.strategyParams.signalThreshold || 50;
      
      // 處理交易信號
      if (signal.action !== 'HOLD' && signal.strength >= signalThreshold) {
        if (!this.position) {
          // 開新倉
          this.openPosition(currentBar, signal.action === 'BUY' ? 'LONG' : 'SHORT');
        } else if (
          (signal.action === 'BUY' && this.position.side === 'SHORT') ||
          (signal.action === 'SELL' && this.position.side === 'LONG')
        ) {
          // 信號反轉，平倉後開新倉
          this.closePosition(currentBar, 'SIGNAL_REVERSE');
          this.openPosition(currentBar, signal.action === 'BUY' ? 'LONG' : 'SHORT');
        } else if (this.config.dcaEnabled && this.position.dcaOrders < this.config.dcaMaxOrders) {
          // DCA 加倉
          this.dcaAddPosition(currentBar);
        }
      }
    }
    
    // 強制平倉未結束的持倉
    if (this.position) {
      this.closePosition(data[data.length - 1], 'END_OF_DATA');
    }
    
    return this.generateReport();
  }

  private calculateEquity(currentPrice: number): number {
    if (!this.position) return this.balance;
    
    const priceDiff = this.position.side === 'LONG'
      ? currentPrice - this.position.entryPrice
      : this.position.entryPrice - currentPrice;
    const unrealizedPnL = priceDiff * this.position.size;
    
    return this.balance + unrealizedPnL;
  }

  private checkExitConditions(bar: MarketData, barIndex: number): BacktestTrade['exitReason'] | null {
    if (!this.position) return null;
    
    const currentPrice = bar.close;
    const priceDiff = this.position.side === 'LONG'
      ? currentPrice - this.position.entryPrice
      : this.position.entryPrice - currentPrice;
    const pnlPercent = (priceDiff / this.position.entryPrice) * 100 * this.config.leverage;
    
    // 更新最高/最低價
    if (this.position.side === 'LONG') {
      if (currentPrice > this.position.highestPrice) {
        this.position.highestPrice = currentPrice;
      }
    } else {
      if (currentPrice < this.position.lowestPrice) {
        this.position.lowestPrice = currentPrice;
      }
    }
    
    // 1. 檢查移動止損 (Trailing Stop)
    if (this.config.trailingStop) {
      const trailingTrigger = this.config.trailingStopPositivePercent || 0;
      
      if (pnlPercent >= trailingTrigger) {
        const trailPrice = this.position.side === 'LONG'
          ? this.position.highestPrice * (1 - this.config.trailingStopPercent / 100)
          : this.position.lowestPrice * (1 + this.config.trailingStopPercent / 100);
        
        if (
          (this.position.side === 'LONG' && currentPrice <= trailPrice) ||
          (this.position.side === 'SHORT' && currentPrice >= trailPrice)
        ) {
          return 'TRAILING_STOP';
        }
      }
    }
    
    // 2. 檢查 ROI 分階段止盈
    const holdingMinutes = (bar.timestamp - this.position.openTime) / 60000;
    for (const [minutes, targetRoi] of Object.entries(this.config.minimalROI).sort((a, b) => Number(a[0]) - Number(b[0]))) {
      if (holdingMinutes >= Number(minutes) && pnlPercent >= targetRoi) {
        return 'ROI_TARGET';
      }
    }
    
    // 3. 固定止盈
    if (pnlPercent >= this.config.takeProfitPercent) {
      return 'TAKE_PROFIT';
    }
    
    // 4. 固定止損
    if (pnlPercent <= -this.config.stopLossPercent) {
      return 'STOP_LOSS';
    }
    
    return null;
  }

  private openPosition(bar: MarketData, side: 'LONG' | 'SHORT') {
    const price = bar.close;
    const slippage = price * (this.config.slippagePercent / 100);
    const executionPrice = side === 'LONG' ? price + slippage : price - slippage;
    
    const positionValue = this.balance * (this.config.positionSizePercent / 100);
    const size = (positionValue * this.config.leverage) / executionPrice;
    
    this.position = {
      side,
      entryPrice: executionPrice,
      size,
      openTime: bar.timestamp,
      dcaOrders: 0,
      highestPrice: price,
      lowestPrice: price
    };
  }

  private dcaAddPosition(bar: MarketData) {
    if (!this.position) return;
    
    const price = bar.close;
    const priceDiff = this.position.side === 'LONG'
      ? price - this.position.entryPrice
      : this.position.entryPrice - price;
    const pnlPercent = (priceDiff / this.position.entryPrice) * 100;
    
    // 只在虧損達到間隔時加倉
    if (pnlPercent <= -this.config.dcaOrderSpacing * (this.position.dcaOrders + 1)) {
      const additionalValue = (this.balance * (this.config.positionSizePercent / 100)) * 
        Math.pow(this.config.dcaMultiplier, this.position.dcaOrders + 1);
      const additionalSize = (additionalValue * this.config.leverage) / price;
      
      // 重新計算平均入場價
      const totalValue = (this.position.entryPrice * this.position.size) + (price * additionalSize);
      const totalSize = this.position.size + additionalSize;
      
      this.position.entryPrice = totalValue / totalSize;
      this.position.size = totalSize;
      this.position.dcaOrders++;
    }
  }

  private closePosition(bar: MarketData, reason: BacktestTrade['exitReason']) {
    if (!this.position) return;
    
    const price = bar.close;
    const slippage = price * (this.config.slippagePercent / 100);
    const executionPrice = this.position.side === 'LONG' ? price - slippage : price + slippage;
    
    const priceDiff = this.position.side === 'LONG'
      ? executionPrice - this.position.entryPrice
      : this.position.entryPrice - executionPrice;
    
    const grossPnL = priceDiff * this.position.size;
    const fee = (this.position.entryPrice * this.position.size + executionPrice * this.position.size) * this.config.feeRate;
    const totalSlippage = (price * (this.config.slippagePercent / 100)) * this.position.size * 2;
    const netPnL = grossPnL - fee;
    
    const trade: BacktestTrade = {
      id: this.trades.length + 1,
      openTime: this.position.openTime,
      closeTime: bar.timestamp,
      side: this.position.side,
      entryPrice: this.position.entryPrice,
      exitPrice: executionPrice,
      size: this.position.size,
      leverage: this.config.leverage,
      fee,
      slippage: totalSlippage,
      pnl: netPnL,
      pnlPercent: (netPnL / (this.position.entryPrice * this.position.size / this.config.leverage)) * 100,
      holdingPeriod: (bar.timestamp - this.position.openTime) / 60000,
      exitReason: reason
    };
    
    this.trades.push(trade);
    this.balance += netPnL;
    this.position = null;
  }

  private generateReport(): BacktestResult {
    const winTrades = this.trades.filter(t => t.pnl > 0);
    const lossTrades = this.trades.filter(t => t.pnl <= 0);
    
    const totalPnL = this.trades.reduce((sum, t) => sum + t.pnl, 0);
    const totalFees = this.trades.reduce((sum, t) => sum + t.fee, 0);
    const totalSlippage = this.trades.reduce((sum, t) => sum + t.slippage, 0);
    
    const avgWin = winTrades.length > 0 
      ? winTrades.reduce((sum, t) => sum + t.pnl, 0) / winTrades.length 
      : 0;
    const avgLoss = lossTrades.length > 0 
      ? Math.abs(lossTrades.reduce((sum, t) => sum + t.pnl, 0) / lossTrades.length)
      : 0;
    
    // 計算 Sharpe Ratio
    const returns = this.trades.map(t => t.pnlPercent);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length || 0;
    const stdDev = Math.sqrt(
      returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
    ) || 1;
    const sharpeRatio = avgReturn / stdDev * Math.sqrt(252);  // 年化
    
    // 計算 Sortino Ratio (只考慮負回報)
    const negativeReturns = returns.filter(r => r < 0);
    const downstdDev = Math.sqrt(
      negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / negativeReturns.length
    ) || 1;
    const sortinoRatio = avgReturn / downstdDev * Math.sqrt(252);
    
    // 計算 Profit Factor
    const grossProfit = winTrades.reduce((sum, t) => sum + t.pnl, 0);
    const grossLoss = Math.abs(lossTrades.reduce((sum, t) => sum + t.pnl, 0)) || 1;
    const profitFactor = grossProfit / grossLoss;
    
    // 計算月度回報
    const monthlyReturns = this.calculateMonthlyReturns();
    
    // 計算回撤曲線
    const drawdownCurve = this.equityCurve.map((point, i) => {
      const peak = Math.max(...this.equityCurve.slice(0, i + 1).map(p => p.equity));
      return {
        time: point.time,
        drawdown: ((peak - point.equity) / peak) * 100
      };
    });
    
    return {
      config: this.config,
      startDate: new Date(this.data[0]?.timestamp || 0).toISOString().split('T')[0],
      endDate: new Date(this.data[this.data.length - 1]?.timestamp || 0).toISOString().split('T')[0],
      totalBars: this.data.length,
      
      totalTrades: this.trades.length,
      winTrades: winTrades.length,
      lossTrades: lossTrades.length,
      winRate: this.trades.length > 0 ? (winTrades.length / this.trades.length) * 100 : 0,
      
      initialBalance: this.config.initialBalance,
      finalBalance: this.balance,
      totalPnL,
      totalPnLPercent: (totalPnL / this.config.initialBalance) * 100,
      totalFees,
      totalSlippage,
      
      maxDrawdown: this.maxDrawdown,
      maxDrawdownPercent: (this.maxDrawdown / this.peakEquity) * 100,
      sharpeRatio: isNaN(sharpeRatio) ? 0 : sharpeRatio,
      sortinoRatio: isNaN(sortinoRatio) ? 0 : sortinoRatio,
      profitFactor: isNaN(profitFactor) ? 0 : profitFactor,
      
      avgWin,
      avgLoss,
      avgHoldingPeriod: this.trades.reduce((sum, t) => sum + t.holdingPeriod, 0) / this.trades.length || 0,
      expectancy: this.trades.length > 0
        ? (winTrades.length / this.trades.length) * avgWin - (lossTrades.length / this.trades.length) * avgLoss
        : 0,
      
      equityCurve: this.equityCurve,
      drawdownCurve,
      trades: this.trades,
      monthlyReturns
    };
  }

  private calculateMonthlyReturns(): BacktestResult['monthlyReturns'] {
    const monthlyMap = new Map<string, { pnl: number; startBalance: number }>();
    
    let runningBalance = this.config.initialBalance;
    
    this.trades.forEach(trade => {
      const date = new Date(trade.closeTime);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, { pnl: 0, startBalance: runningBalance });
      }
      
      const monthly = monthlyMap.get(monthKey)!;
      monthly.pnl += trade.pnl;
      runningBalance += trade.pnl;
    });
    
    return Array.from(monthlyMap.entries()).map(([month, data]) => ({
      month,
      pnl: data.pnl,
      pnlPercent: (data.pnl / data.startBalance) * 100
    }));
  }
}

// 預設配置
export const DEFAULT_BACKTEST_CONFIG: BacktestConfig = {
  strategy: 'MACD_TREND',
  strategyParams: { signalThreshold: 50 },
  initialBalance: 10000,
  leverage: 10,
  positionSizePercent: 50,
  stopLossPercent: 5,
  takeProfitPercent: 10,
  feeRate: 0.0004,
  slippagePercent: 0.05,
  trailingStop: false,
  trailingStopPercent: 2,
  trailingStopPositivePercent: 3,
  minimalROI: { 60: 5, 30: 3, 0: 10 },
  dcaEnabled: false,
  dcaMaxOrders: 3,
  dcaOrderSpacing: 2,
  dcaMultiplier: 1.5
};

export default BacktestEngine;
