
import { MarketData } from '../types';
import { tradingEngine, TradeRecord } from './tradingEngine';
import { serverLog } from './serverLog';

// 策略類型定義
export type StrategyType = 
  | 'BOLLINGER_BREAKOUT'    // 布林通道突破
  | 'MACD_TREND'            // MACD 趨勢跟蹤
  | 'RSI_REVERSAL'          // RSI 反轉
  | 'GRID_TRADING'          // 網格交易
  | 'MA_CROSSOVER';         // 均線交叉

export interface BotConfig {
  id: string;
  name: string;
  symbol: string;
  strategy: StrategyType;
  status: 'RUNNING' | 'PAUSED' | 'STOPPED';
  
  // 資金設定
  initialBalance: number;
  allocatedBalance: number;  // 分配給此機器人的資金
  maxPositionSize: number;   // 最大單筆下單金額
  
  // 風險設定
  leverage: number;
  marginType: 'CROSS' | 'ISOLATED';
  stopLossPercent: number;   // 止損百分比
  takeProfitPercent: number; // 止盈百分比
  maxDailyLoss: number;      // 單日最大虧損
  
  // Freqtrade 進階功能
  trailingStop: boolean;           // 移動止損開關
  trailingStopPercent: number;     // 移動止損百分比
  trailingStopTrigger: number;     // 移動止損觸發條件 (盈利 %)
  minimalROI: Record<number, number>;  // 分階段止盈 {分鐘: 目標收益%}
  dcaEnabled: boolean;             // DCA 加倉開關
  dcaMaxOrders: number;            // 最大加倉次數
  dcaOrderSpacing: number;         // 加倉間隔 (%)
  dcaMultiplier: number;           // 加倉倍數
  
  // 策略參數
  strategyParams: Record<string, number>;
  
  // 統計
  totalTrades: number;
  winTrades: number;
  lossTrades: number;
  totalPnL: number;
  createdAt: number;
  lastTradeAt: number | null;
}

export interface BotPosition {
  botId: string;
  positionId: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  size: number;
  leverage: number;
  stopLoss: number;
  takeProfit: number;
  unrealizedPnL: number;
  openTime: number;
  // Freqtrade 進階功能
  highestPrice: number;    // 持倉期間最高價 (用於移動止損)
  lowestPrice: number;     // 持倉期間最低價 (用於移動止損)
  dcaOrders: number;       // 已執行 DCA 次數
}

export interface StrategySignal {
  action: 'BUY' | 'SELL' | 'HOLD';
  strength: number;  // 0-100 信號強度
  reason: string;
}

// 策略執行器
class StrategyExecutor {
  
  // 布林通道突破策略 - 優化版：支持區間交易
  static bollingerBreakout(data: MarketData[], params: Record<string, number>): StrategySignal {
    if (data.length < 20) return { action: 'HOLD', strength: 0, reason: '數據不足' };
    
    const latest = data[data.length - 1];
    const prev = data[data.length - 2];
    const bbUpper = latest.bb_upper;
    const bbLower = latest.bb_lower;
    const bbMiddle = (bbUpper + bbLower) / 2;
    const close = latest.close;
    const prevClose = prev?.close || close;
    
    // 計算價格在布林通道中的位置 (0-100)
    const bbPosition = ((close - bbLower) / (bbUpper - bbLower)) * 100;
    
    // 策略1: 突破上軌 - 強烈做多信號
    if (close > bbUpper && prevClose <= bbUpper) {
      return { 
        action: 'BUY', 
        strength: Math.min(100, 70 + ((close - bbUpper) / bbUpper) * 500),
        reason: `突破布林上軌 $${bbUpper.toFixed(0)}`
      };
    }
    
    // 策略2: 跌破下軌 - 強烈做空信號
    if (close < bbLower && prevClose >= bbLower) {
      return { 
        action: 'SELL', 
        strength: Math.min(100, 70 + ((bbLower - close) / bbLower) * 500),
        reason: `跌破布林下軌 $${bbLower.toFixed(0)}`
      };
    }
    
    // 策略3: 觸及下軌反彈 - 做多 (均值回歸)
    if (bbPosition < 10 && close > prevClose) {
      return {
        action: 'BUY',
        strength: Math.min(80, 40 + (10 - bbPosition) * 4),
        reason: `觸及布林下軌反彈 (位置: ${bbPosition.toFixed(1)}%)`
      };
    }
    
    // 策略4: 觸及上軌回落 - 做空 (均值回歸)
    if (bbPosition > 90 && close < prevClose) {
      return {
        action: 'SELL',
        strength: Math.min(80, 40 + (bbPosition - 90) * 4),
        reason: `觸及布林上軌回落 (位置: ${bbPosition.toFixed(1)}%)`
      };
    }
    
    return { action: 'HOLD', strength: 0, reason: `布林位置: ${bbPosition.toFixed(1)}%` };
  }
  
  // MACD 趨勢跟蹤策略 - 優化版：加入動量判斷
  static macdTrend(data: MarketData[], params: Record<string, number>): StrategySignal {
    if (data.length < 26) return { action: 'HOLD', strength: 0, reason: '數據不足' };
    
    const latest = data[data.length - 1];
    const prev = data[data.length - 2];
    const prev2 = data[data.length - 3];
    
    const macdLine = latest.macd_line;
    const signalLine = latest.macd_signal;
    const histogram = latest.macd_hist;
    const prevMacd = prev.macd_line;
    const prevSignal = prev.macd_signal;
    const prevHist = prev.macd_hist;
    const prev2Hist = prev2?.macd_hist || prevHist;
    
    // 策略1: 金叉 - 做多
    if (macdLine > signalLine && prevMacd <= prevSignal) {
      const strength = Math.min(100, 60 + Math.abs(macdLine - signalLine) * 5);
      return { 
        action: 'BUY', 
        strength,
        reason: `MACD 金叉`
      };
    }
    
    // 策略2: 死叉 - 做空
    if (macdLine < signalLine && prevMacd >= prevSignal) {
      const strength = Math.min(100, 60 + Math.abs(signalLine - macdLine) * 5);
      return { 
        action: 'SELL', 
        strength,
        reason: `MACD 死叉`
      };
    }
    
    // 策略3: 柱狀圖連續放大 (動量加速)
    if (histogram > 0 && histogram > prevHist && prevHist > prev2Hist) {
      return {
        action: 'BUY',
        strength: Math.min(70, 35 + histogram * 3),
        reason: `MACD 多頭動量加速`
      };
    }
    
    if (histogram < 0 && histogram < prevHist && prevHist < prev2Hist) {
      return {
        action: 'SELL',
        strength: Math.min(70, 35 + Math.abs(histogram) * 3),
        reason: `MACD 空頭動量加速`
      };
    }
    
    return { action: 'HOLD', strength: 0, reason: `MACD: ${macdLine.toFixed(2)}` };
  }
  
  // RSI 反轉策略 - 優化版：加入趨勢確認
  static rsiReversal(data: MarketData[], params: Record<string, number>): StrategySignal {
    if (data.length < 14) return { action: 'HOLD', strength: 0, reason: '數據不足' };
    
    // 計算 RSI
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
    
    // 檢查價格趨勢
    const latestClose = data[data.length - 1].close;
    const prevClose = data[data.length - 2].close;
    const priceUp = latestClose > prevClose;
    const priceDown = latestClose < prevClose;
    
    // 策略1: RSI 極度超賣 + 價格開始反彈
    if (rsi < 25) {
      return { 
        action: 'BUY', 
        strength: Math.min(100, 50 + (25 - rsi) * 3),
        reason: `RSI 極度超賣 (${rsi.toFixed(1)})`
      };
    }
    
    // 策略2: RSI 超賣區 + 價格確認反彈
    if (rsi < oversold && priceUp) {
      return { 
        action: 'BUY', 
        strength: Math.min(85, 40 + (oversold - rsi) * 2),
        reason: `RSI 超賣反彈 (${rsi.toFixed(1)})`
      };
    }
    
    // 策略3: RSI 極度超買
    if (rsi > 75) {
      return { 
        action: 'SELL', 
        strength: Math.min(100, 50 + (rsi - 75) * 3),
        reason: `RSI 極度超買 (${rsi.toFixed(1)})`
      };
    }
    
    // 策略4: RSI 超買區 + 價格確認回落
    if (rsi > overbought && priceDown) {
      return { 
        action: 'SELL', 
        strength: Math.min(85, 40 + (rsi - overbought) * 2),
        reason: `RSI 超買回落 (${rsi.toFixed(1)})`
      };
    }
    
    return { action: 'HOLD', strength: 0, reason: `RSI 中性 (${rsi.toFixed(1)})` };
  }
  
  // 均線交叉策略 - 優化版：加入趨勢強度
  static maCrossover(data: MarketData[], params: Record<string, number>): StrategySignal {
    if (data.length < 25) return { action: 'HOLD', strength: 0, reason: '數據不足' };
    
    const latest = data[data.length - 1];
    const prev = data[data.length - 2];
    const close = latest.close;
    
    const ma7 = latest.ma7;
    const ma25 = latest.ma25;
    const ma99 = latest.ma99;
    const prevMa7 = prev.ma7;
    const prevMa25 = prev.ma25;
    
    // 計算均線排列
    const bullishAlignment = ma7 > ma25 && ma25 > ma99;
    const bearishAlignment = ma7 < ma25 && ma25 < ma99;
    
    // 策略1: 金叉 - 做多
    if (ma7 > ma25 && prevMa7 <= prevMa25) {
      return { 
        action: 'BUY', 
        strength: Math.min(100, 55 + ((ma7 - ma25) / ma25) * 300),
        reason: `MA7/MA25 金叉`
      };
    }
    
    // 策略2: 死叉 - 做空
    if (ma7 < ma25 && prevMa7 >= prevMa25) {
      return { 
        action: 'SELL', 
        strength: Math.min(100, 55 + ((ma25 - ma7) / ma25) * 300),
        reason: `MA7/MA25 死叉`
      };
    }
    
    // 策略3: 多頭排列 + 回踩 MA7 支撐
    if (bullishAlignment && close > ma7 && prev.close <= prevMa7) {
      return {
        action: 'BUY',
        strength: 50,
        reason: `多頭排列回踩 MA7`
      };
    }
    
    // 策略4: 空頭排列 + 反彈 MA7 壓力
    if (bearishAlignment && close < ma7 && prev.close >= prevMa7) {
      return {
        action: 'SELL',
        strength: 50,
        reason: `空頭排列反彈 MA7`
      };
    }
    
    // 策略5: 價格站上所有均線 - 弱多信號
    if (close > ma7 && close > ma25 && close > ma99 && prev.close <= prevMa7) {
      return {
        action: 'BUY',
        strength: 40,
        reason: `價格突破均線系統`
      };
    }
    
    // 策略6: 價格跌破所有均線 - 弱空信號
    if (close < ma7 && close < ma25 && close < ma99 && prev.close >= prevMa7) {
      return {
        action: 'SELL',
        strength: 40,
        reason: `價格跌破均線系統`
      };
    }
    
    return { action: 'HOLD', strength: 0, reason: '等待交叉信號' };
  }
  
  // 根據策略類型執行
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
        // 網格交易需要特殊處理
        return { action: 'HOLD', strength: 0, reason: '網格策略運行中' };
      default:
        return { action: 'HOLD', strength: 0, reason: '未知策略' };
    }
  }
}

// 機器人交易引擎
class BotEngine {
  private bots: Map<string, BotConfig> = new Map();
  private positions: Map<string, BotPosition> = new Map();
  private tradeHistory: Map<string, TradeRecord[]> = new Map();
  private listeners: Set<() => void> = new Set();
  private intervalId: number | null = null;
  private lastSignals: Map<string, StrategySignal> = new Map();
  
  constructor() {
    // 從 localStorage 載入機器人配置
    this.loadFromStorage();
  }
  
  private loadFromStorage() {
    try {
      const saved = localStorage.getItem('botEngine_bots');
      if (saved) {
        const botsArray: BotConfig[] = JSON.parse(saved);
        botsArray.forEach(bot => this.bots.set(bot.id, bot));
      }
    } catch (e) {
      console.error('Failed to load bots from storage:', e);
    }
  }
  
  private saveToStorage() {
    try {
      const botsArray = Array.from(this.bots.values());
      localStorage.setItem('botEngine_bots', JSON.stringify(botsArray));
    } catch (e) {
      console.error('Failed to save bots to storage:', e);
    }
  }
  
  subscribe(callback: () => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }
  
  private notify() {
    this.listeners.forEach(cb => cb());
  }
  
  // 創建新機器人
  createBot(config: Omit<BotConfig, 'id' | 'totalTrades' | 'winTrades' | 'lossTrades' | 'totalPnL' | 'createdAt' | 'lastTradeAt'>): BotConfig {
    const bot: BotConfig = {
      ...config,
      id: `BOT-${Date.now().toString(36).toUpperCase()}`,
      totalTrades: 0,
      winTrades: 0,
      lossTrades: 0,
      totalPnL: 0,
      createdAt: Date.now(),
      lastTradeAt: null
    };
    
    this.bots.set(bot.id, bot);
    this.tradeHistory.set(bot.id, []);
    this.saveToStorage();
    this.notify();
    
    return bot;
  }
  
  // 獲取所有機器人
  getBots(): BotConfig[] {
    return Array.from(this.bots.values());
  }
  
  // 獲取單個機器人
  getBot(id: string): BotConfig | undefined {
    return this.bots.get(id);
  }
  
  // 啟動機器人
  startBot(id: string): boolean {
    const bot = this.bots.get(id);
    if (!bot) return false;
    
    bot.status = 'RUNNING';
    this.saveToStorage();
    this.notify();
    
    // 記錄日誌
    serverLog.logBotStart(bot.name, bot.strategy);
    this.updateBotStatusLog(bot);
    
    return true;
  }
  
  // 暫停機器人
  pauseBot(id: string): boolean {
    const bot = this.bots.get(id);
    if (!bot) return false;
    
    bot.status = 'PAUSED';
    this.saveToStorage();
    this.notify();
    
    serverLog.logBotStop(bot.name, '手動暫停');
    this.updateBotStatusLog(bot);
    
    return true;
  }
  
  // 停止機器人
  stopBot(id: string): boolean {
    const bot = this.bots.get(id);
    if (!bot) return false;
    
    bot.status = 'STOPPED';
    this.saveToStorage();
    this.notify();
    
    serverLog.logBotStop(bot.name, '手動停止');
    this.updateBotStatusLog(bot);
    
    return true;
  }
  
  // 更新機器人狀態到 ServerLog
  private updateBotStatusLog(bot: BotConfig) {
    const positions = this.getBotPositions(bot.id);
    const currentPos = positions[0];
    const signal = this.lastSignals.get(bot.id);
    
    serverLog.updateBotStatus({
      botId: bot.id,
      botName: bot.name,
      status: bot.status,
      strategy: bot.strategy,
      lastSignal: signal ? {
        action: signal.action,
        strength: signal.strength,
        reason: signal.reason,
        timestamp: Date.now()
      } : undefined,
      currentPosition: currentPos ? {
        side: currentPos.side,
        entryPrice: currentPos.entryPrice,
        size: currentPos.size,
        unrealizedPnL: currentPos.unrealizedPnL,
        openTime: currentPos.openTime
      } : undefined,
      stats: {
        totalTrades: bot.totalTrades,
        winTrades: bot.winTrades,
        lossTrades: bot.lossTrades,
        totalPnL: bot.totalPnL,
        winRate: bot.totalTrades > 0 ? (bot.winTrades / bot.totalTrades) * 100 : 0
      },
      lastUpdate: Date.now()
    });
  }
  
  // 刪除機器人
  deleteBot(id: string): boolean {
    const deleted = this.bots.delete(id);
    this.positions.delete(id);
    this.tradeHistory.delete(id);
    this.saveToStorage();
    this.notify();
    return deleted;
  }
  
  // 獲取機器人的持倉
  getBotPositions(botId: string): BotPosition[] {
    return Array.from(this.positions.values()).filter(p => p.botId === botId);
  }
  
  // 獲取機器人的交易歷史
  getBotTradeHistory(botId: string): TradeRecord[] {
    return this.tradeHistory.get(botId) || [];
  }
  
  // 獲取最新信號
  getLastSignal(botId: string): StrategySignal | undefined {
    return this.lastSignals.get(botId);
  }
  
  // 核心: 處理市場數據並執行策略 (整合 Freqtrade 核心邏輯)
  processMarketData(data: MarketData[], currentPrice: number) {
    if (data.length < 30) return; // 需要足夠數據
    
    const runningBots = Array.from(this.bots.values()).filter(b => b.status === 'RUNNING');
    
    // 更新系統狀態
    serverLog.updateSystemStatus({
      currentPrice,
      lastPriceUpdate: Date.now(),
      activeBots: runningBots.length,
      totalPositions: this.positions.size,
      totalUnrealizedPnL: Array.from(this.positions.values()).reduce((sum, p) => sum + p.unrealizedPnL, 0)
    });
    
    runningBots.forEach(bot => {
      // 執行策略獲取信號
      const signal = StrategyExecutor.execute(bot.strategy, data, bot.strategyParams);
      this.lastSignals.set(bot.id, signal);
      
      // 輸出信號 (只在有動作且強度足夠時記錄到 ServerLog)
      if (signal.action !== 'HOLD' && signal.strength >= 30) {
        serverLog.logSignal(bot.name, signal.action, signal.strength, signal.reason);
      }
      
      // 更新機器人狀態
      this.updateBotStatusLog(bot);
      
      // 檢查是否有持倉
      const positions = this.getBotPositions(bot.id);
      
      // 如果有持倉，檢查止盈止損 (含 Freqtrade 進階邏輯)
      positions.forEach(pos => {
        const priceDiff = pos.side === 'LONG' 
          ? currentPrice - pos.entryPrice 
          : pos.entryPrice - currentPrice;
        
        // 未實現損益 = 價差 × 持倉數量 (size 已包含槓桿效果)
        pos.unrealizedPnL = priceDiff * pos.size;
        
        // 計算保證金收益率 (用於止盈止損判斷)
        // 保證金 = (size × entryPrice) / leverage
        const margin = (pos.size * pos.entryPrice) / pos.leverage;
        const pnlPercent = (pos.unrealizedPnL / margin) * 100;
        
        // 更新最高/最低價 (用於移動止損)
        if (pos.side === 'LONG') {
          pos.highestPrice = Math.max(pos.highestPrice || pos.entryPrice, currentPrice);
        } else {
          pos.lowestPrice = Math.min(pos.lowestPrice || pos.entryPrice, currentPrice);
        }
        
        let shouldClose = false;
        let closeReason = '';
        
        // 1. 移動止損檢查 (Trailing Stop)
        if (bot.trailingStop && pnlPercent >= (bot.trailingStopTrigger || 0)) {
          const trailPrice = pos.side === 'LONG'
            ? pos.highestPrice * (1 - (bot.trailingStopPercent || 2) / 100)
            : (pos.lowestPrice || currentPrice) * (1 + (bot.trailingStopPercent || 2) / 100);
          
          if ((pos.side === 'LONG' && currentPrice <= trailPrice) ||
              (pos.side === 'SHORT' && currentPrice >= trailPrice)) {
            shouldClose = true;
            closeReason = 'TRAILING_STOP';
          }
        }
        
        // 2. 分階段止盈 (Minimal ROI)
        if (!shouldClose && bot.minimalROI && Object.keys(bot.minimalROI).length > 0) {
          const holdingMinutes = (Date.now() - pos.openTime) / 60000;
          const roiTargets = Object.entries(bot.minimalROI)
            .map(([min, roi]) => ({ minutes: Number(min), roi: Number(roi) }))
            .sort((a, b) => a.minutes - b.minutes);
          
          for (const target of roiTargets) {
            if (holdingMinutes >= target.minutes && pnlPercent >= target.roi) {
              shouldClose = true;
              closeReason = 'ROI_TARGET';
              break;
            }
          }
        }
        
        // 3. 固定止盈
        if (!shouldClose && pnlPercent >= bot.takeProfitPercent) {
          shouldClose = true;
          closeReason = 'TAKE_PROFIT';
        }
        
        // 4. 固定止損
        if (!shouldClose && pnlPercent <= -bot.stopLossPercent) {
          shouldClose = true;
          closeReason = 'STOP_LOSS';
        }
        
        // 5. DCA 加倉邏輯
        if (!shouldClose && bot.dcaEnabled && (pos.dcaOrders || 0) < (bot.dcaMaxOrders || 3)) {
          const dcaThreshold = -(bot.dcaOrderSpacing || 2) * ((pos.dcaOrders || 0) + 1);
          if (pnlPercent <= dcaThreshold) {
            this.addDCAPosition(bot, pos, currentPrice);
          }
        }
        
        if (shouldClose) {
          this.closePosition(bot.id, pos.positionId, currentPrice, closeReason);
        }
      });
      
      // 信號強度超過閾值才交易 (降低預設閾值，讓機器人更積極)
      const signalThreshold = bot.strategyParams.signalThreshold || 35;
      
      if (signal.action !== 'HOLD' && signal.strength >= signalThreshold) {
        // 檢查是否已有相同方向持倉
        const existingPos = positions.find(p => 
          (signal.action === 'BUY' && p.side === 'LONG') ||
          (signal.action === 'SELL' && p.side === 'SHORT')
        );
        
        if (!existingPos) {
          // 檢查是否有反向持倉需要平倉
          const oppositePos = positions.find(p =>
            (signal.action === 'BUY' && p.side === 'SHORT') ||
            (signal.action === 'SELL' && p.side === 'LONG')
          );
          
          if (oppositePos) {
            this.closePosition(bot.id, oppositePos.positionId, currentPrice, 'SIGNAL_REVERSE');
          }
          
          // 開新倉
          this.openPosition(bot, signal.action === 'BUY' ? 'LONG' : 'SHORT', currentPrice, signal.reason);
        }
      }
    });
    
    this.notify();
  }
  
  // 開倉
  private openPosition(bot: BotConfig, side: 'LONG' | 'SHORT', price: number, reason: string) {
    const positionSize = Math.min(bot.maxPositionSize, bot.allocatedBalance * 0.5);
    const size = (positionSize * bot.leverage) / price;
    
    // 計算止盈止損價格
    const slPercent = bot.stopLossPercent / 100 / bot.leverage;
    const tpPercent = bot.takeProfitPercent / 100 / bot.leverage;
    
    const stopLoss = side === 'LONG' 
      ? price * (1 - slPercent) 
      : price * (1 + slPercent);
    const takeProfit = side === 'LONG' 
      ? price * (1 + tpPercent) 
      : price * (1 - tpPercent);
    
    const position: BotPosition = {
      botId: bot.id,
      positionId: `POS-${Date.now()}`,
      symbol: bot.symbol,
      side,
      entryPrice: price,
      size,
      leverage: bot.leverage,
      stopLoss,
      takeProfit,
      unrealizedPnL: 0,
      openTime: Date.now(),
      highestPrice: price,
      lowestPrice: price,
      dcaOrders: 0
    };
    
    this.positions.set(position.positionId, position);
    
    // 記錄交易
    const trade: TradeRecord = {
      id: `TRD-${Date.now()}`,
      symbol: bot.symbol,
      side: side === 'LONG' ? 'BUY' : 'SELL',
      type: 'OPEN',
      price,
      amount: size,
      fee: positionSize * 0.0004,
      timestamp: Date.now()
    };
    
    const history = this.tradeHistory.get(bot.id) || [];
    history.unshift(trade);
    this.tradeHistory.set(bot.id, history.slice(0, 100));
    
    bot.totalTrades++;
    bot.lastTradeAt = Date.now();
    this.saveToStorage();
    
    // 記錄開倉日誌
    serverLog.logOpenPosition(bot.name, side, price, size, bot.leverage);
    this.updateBotStatusLog(bot);
    
    console.log(`[BOT ${bot.id}] 開倉 ${side} @ ${price.toFixed(2)} - ${reason}`);
  }
  
  // 平倉
  private closePosition(botId: string, positionId: string, price: number, reason: string) {
    const position = this.positions.get(positionId);
    const bot = this.bots.get(botId);
    
    if (!position || !bot) return;
    
    const priceDiff = position.side === 'LONG'
      ? price - position.entryPrice
      : position.entryPrice - price;
    const realizedPnL = priceDiff * position.size;
    
    // 記錄交易
    const trade: TradeRecord = {
      id: `TRD-${Date.now()}`,
      symbol: position.symbol,
      side: position.side === 'LONG' ? 'SELL' : 'BUY',
      type: 'CLOSE',
      price,
      amount: position.size,
      realizedPnL,
      fee: position.size * price * 0.0004,
      timestamp: Date.now()
    };
    
    const history = this.tradeHistory.get(botId) || [];
    history.unshift(trade);
    this.tradeHistory.set(botId, history.slice(0, 100));
    
    // 更新機器人統計
    bot.totalPnL += realizedPnL;
    if (realizedPnL >= 0) {
      bot.winTrades++;
    } else {
      bot.lossTrades++;
    }
    bot.lastTradeAt = Date.now();
    
    this.positions.delete(positionId);
    this.saveToStorage();
    
    // 記錄平倉日誌
    serverLog.logClosePosition(bot.name, position.side, position.entryPrice, price, realizedPnL, reason);
    
    // 特殊原因日誌
    if (reason === 'STOP_LOSS') {
      serverLog.logStopLoss(bot.name, price, Math.abs(realizedPnL));
    } else if (reason === 'TAKE_PROFIT') {
      serverLog.logTakeProfit(bot.name, price, realizedPnL);
    }
    
    this.updateBotStatusLog(bot);
    
    console.log(`[BOT ${bot.id}] 平倉 ${position.side} @ ${price.toFixed(2)} - ${reason} - PnL: ${realizedPnL >= 0 ? '+' : ''}${realizedPnL.toFixed(2)}`);
  }
  
  // DCA 加倉
  private addDCAPosition(bot: BotConfig, pos: BotPosition, price: number) {
    const dcaMultiplier = bot.dcaMultiplier || 1.5;
    const additionalValue = (bot.maxPositionSize * 0.5) * Math.pow(dcaMultiplier, (pos.dcaOrders || 0) + 1);
    const additionalSize = (additionalValue * bot.leverage) / price;
    
    // 重新計算平均入場價
    const totalValue = (pos.entryPrice * pos.size) + (price * additionalSize);
    const totalSize = pos.size + additionalSize;
    
    pos.entryPrice = totalValue / totalSize;
    pos.size = totalSize;
    pos.dcaOrders = (pos.dcaOrders || 0) + 1;
    
    // 更新止盈止損
    const slPercent = bot.stopLossPercent / 100 / bot.leverage;
    const tpPercent = bot.takeProfitPercent / 100 / bot.leverage;
    pos.stopLoss = pos.side === 'LONG' 
      ? pos.entryPrice * (1 - slPercent) 
      : pos.entryPrice * (1 + slPercent);
    pos.takeProfit = pos.side === 'LONG' 
      ? pos.entryPrice * (1 + tpPercent) 
      : pos.entryPrice * (1 - tpPercent);
    
    // 記錄交易
    const trade: TradeRecord = {
      id: `TRD-${Date.now()}`,
      symbol: bot.symbol,
      side: pos.side === 'LONG' ? 'BUY' : 'SELL',
      type: 'OPEN',
      price,
      amount: additionalSize,
      fee: additionalValue * 0.0004,
      timestamp: Date.now()
    };
    
    const history = this.tradeHistory.get(bot.id) || [];
    history.unshift(trade);
    this.tradeHistory.set(bot.id, history.slice(0, 100));
    
    bot.totalTrades++;
    bot.lastTradeAt = Date.now();
    this.saveToStorage();
    
    console.log(`[BOT ${bot.id}] DCA 加倉 #${pos.dcaOrders} @ ${price.toFixed(2)} - 新均價: ${pos.entryPrice.toFixed(2)}`);
  }
  
  // 獲取所有活躍持倉
  getAllPositions(): BotPosition[] {
    return Array.from(this.positions.values());
  }
  
  // 手動平倉 (公開方法)
  manualClosePosition(botId: string, positionId: string, currentPrice: number): boolean {
    const position = this.positions.get(positionId);
    if (!position || position.botId !== botId) return false;
    
    this.closePosition(botId, positionId, currentPrice, 'MANUAL_CLOSE');
    return true;
  }
  
  // 獲取統計
  getStats() {
    const bots = this.getBots();
    const runningBots = bots.filter(b => b.status === 'RUNNING');
    const totalPnL = bots.reduce((sum, b) => sum + b.totalPnL, 0);
    const totalTrades = bots.reduce((sum, b) => sum + b.totalTrades, 0);
    const winTrades = bots.reduce((sum, b) => sum + b.winTrades, 0);
    
    return {
      totalBots: bots.length,
      runningBots: runningBots.length,
      totalPnL,
      totalTrades,
      winRate: totalTrades > 0 ? (winTrades / totalTrades) * 100 : 0,
      activePositions: this.positions.size
    };
  }
}

// 單例
export const botEngine = new BotEngine();
export { StrategyExecutor };
export default botEngine;
