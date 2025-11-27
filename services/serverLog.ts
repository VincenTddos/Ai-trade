// Server Log Service - 機器人交易日誌系統

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS' | 'TRADE' | 'SIGNAL' | 'SYSTEM';

export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  source: string;      // 來源 (BOT_ENGINE, TRADE_ENGINE, STRATEGY, SYSTEM)
  title: string;       // 標題
  message: string;     // 詳細訊息
  data?: Record<string, any>;  // 額外數據
}

export interface BotStatus {
  botId: string;
  botName: string;
  status: 'RUNNING' | 'PAUSED' | 'STOPPED';
  strategy: string;
  lastSignal?: {
    action: string;
    strength: number;
    reason: string;
    timestamp: number;
  };
  currentPosition?: {
    side: 'LONG' | 'SHORT';
    entryPrice: number;
    size: number;
    unrealizedPnL: number;
    openTime: number;
  };
  stats: {
    totalTrades: number;
    winTrades: number;
    lossTrades: number;
    totalPnL: number;
    winRate: number;
  };
  lastUpdate: number;
}

export interface SystemStatus {
  startTime: number;
  uptime: number;
  wsConnected: boolean;
  lastPriceUpdate: number;
  currentPrice: number;
  activeBots: number;
  totalPositions: number;
  totalUnrealizedPnL: number;
}

class ServerLogService {
  private logs: LogEntry[] = [];
  private botStatuses: Map<string, BotStatus> = new Map();
  private systemStatus: SystemStatus;
  private listeners: Set<() => void> = new Set();
  private maxLogs: number = 500;

  constructor() {
    this.systemStatus = {
      startTime: Date.now(),
      uptime: 0,
      wsConnected: false,
      lastPriceUpdate: 0,
      currentPrice: 0,
      activeBots: 0,
      totalPositions: 0,
      totalUnrealizedPnL: 0
    };

    // 系統啟動日誌
    this.log('SYSTEM', 'SYSTEM', '🚀 系統啟動', 'BlockAI Trade Pro 自動交易系統已啟動');

    // 定期更新運行時間
    setInterval(() => {
      this.systemStatus.uptime = Date.now() - this.systemStatus.startTime;
    }, 1000);
  }

  // 訂閱日誌更新
  subscribe(callback: () => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notify() {
    this.listeners.forEach(cb => cb());
  }

  // 新增日誌
  log(level: LogLevel, source: string, title: string, message: string, data?: Record<string, any>) {
    const entry: LogEntry = {
      id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      timestamp: Date.now(),
      level,
      source,
      title,
      message,
      data
    };

    this.logs.unshift(entry);
    
    // 限制日誌數量
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    // 同時輸出到 console
    const icon = this.getLevelIcon(level);
    const timeStr = new Date().toLocaleTimeString('zh-TW', { hour12: false });
    console.log(`[${timeStr}] ${icon} [${source}] ${title}: ${message}`, data || '');

    this.notify();
  }

  private getLevelIcon(level: LogLevel): string {
    switch (level) {
      case 'SUCCESS': return '✅';
      case 'ERROR': return '❌';
      case 'WARN': return '⚠️';
      case 'TRADE': return '💰';
      case 'SIGNAL': return '📊';
      case 'SYSTEM': return '🔧';
      default: return 'ℹ️';
    }
  }

  // 獲取日誌
  getLogs(filter?: { level?: LogLevel; source?: string; limit?: number }): LogEntry[] {
    let result = [...this.logs];
    
    if (filter?.level) {
      result = result.filter(l => l.level === filter.level);
    }
    if (filter?.source) {
      result = result.filter(l => l.source === filter.source);
    }
    if (filter?.limit) {
      result = result.slice(0, filter.limit);
    }
    
    return result;
  }

  // 清除日誌
  clearLogs() {
    this.logs = [];
    this.log('SYSTEM', 'SYSTEM', '🗑️ 日誌已清除', '所有歷史日誌已被清除');
  }

  // 更新機器人狀態
  updateBotStatus(status: BotStatus) {
    this.botStatuses.set(status.botId, status);
    this.systemStatus.activeBots = Array.from(this.botStatuses.values())
      .filter(b => b.status === 'RUNNING').length;
    this.notify();
  }

  // 獲取機器人狀態
  getBotStatus(botId: string): BotStatus | undefined {
    return this.botStatuses.get(botId);
  }

  // 獲取所有機器人狀態
  getAllBotStatuses(): BotStatus[] {
    return Array.from(this.botStatuses.values());
  }

  // 更新系統狀態
  updateSystemStatus(updates: Partial<SystemStatus>) {
    this.systemStatus = { ...this.systemStatus, ...updates };
    this.notify();
  }

  // 獲取系統狀態
  getSystemStatus(): SystemStatus {
    return { ...this.systemStatus };
  }

  // ===== 便捷日誌方法 =====

  // 機器人啟動
  logBotStart(botName: string, strategy: string) {
    this.log('SUCCESS', 'BOT_ENGINE', `🤖 ${botName} 已啟動`, `策略: ${strategy}`, { botName, strategy });
  }

  // 機器人停止
  logBotStop(botName: string, reason: string = '手動停止') {
    this.log('WARN', 'BOT_ENGINE', `⏹️ ${botName} 已停止`, reason, { botName, reason });
  }

  // 策略信號
  logSignal(botName: string, action: string, strength: number, reason: string) {
    const level: LogLevel = action === 'HOLD' ? 'INFO' : 'SIGNAL';
    const icon = action === 'BUY' ? '🟢' : action === 'SELL' ? '🔴' : '⚪';
    this.log(level, 'STRATEGY', `${icon} ${botName} 信號`, `${action} (強度: ${strength.toFixed(1)}) - ${reason}`, {
      botName, action, strength, reason
    });
  }

  // 開倉
  logOpenPosition(botName: string, side: 'LONG' | 'SHORT', price: number, size: number, leverage: number) {
    const icon = side === 'LONG' ? '📈' : '📉';
    const margin = (size * price) / leverage;
    this.log('TRADE', 'TRADE_ENGINE', `${icon} ${botName} 開倉`, 
      `${side} @ $${price.toFixed(2)} | 數量: ${size.toFixed(6)} BTC | 保證金: $${margin.toFixed(2)} | ${leverage}x`,
      { botName, side, price, size, leverage, margin }
    );
  }

  // 平倉
  logClosePosition(botName: string, side: 'LONG' | 'SHORT', entryPrice: number, exitPrice: number, pnl: number, reason: string) {
    const level: LogLevel = pnl >= 0 ? 'SUCCESS' : 'ERROR';
    const icon = pnl >= 0 ? '💰' : '💸';
    const pnlStr = pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`;
    this.log(level, 'TRADE_ENGINE', `${icon} ${botName} 平倉`, 
      `${side} | 開: $${entryPrice.toFixed(2)} → 平: $${exitPrice.toFixed(2)} | ${pnlStr} | ${reason}`,
      { botName, side, entryPrice, exitPrice, pnl, reason }
    );
  }

  // 止損觸發
  logStopLoss(botName: string, price: number, loss: number) {
    this.log('ERROR', 'RISK_CONTROL', `🛑 ${botName} 止損觸發`, 
      `觸發價格: $${price.toFixed(2)} | 虧損: -$${Math.abs(loss).toFixed(2)}`,
      { botName, price, loss }
    );
  }

  // 止盈觸發
  logTakeProfit(botName: string, price: number, profit: number) {
    this.log('SUCCESS', 'RISK_CONTROL', `🎯 ${botName} 止盈觸發`, 
      `觸發價格: $${price.toFixed(2)} | 獲利: +$${profit.toFixed(2)}`,
      { botName, price, profit }
    );
  }

  // 價格更新
  logPriceUpdate(symbol: string, price: number) {
    this.systemStatus.currentPrice = price;
    this.systemStatus.lastPriceUpdate = Date.now();
    // 價格更新太頻繁，不記錄到日誌
  }

  // WebSocket 連線狀態
  logWsConnection(connected: boolean) {
    this.systemStatus.wsConnected = connected;
    if (connected) {
      this.log('SUCCESS', 'WEBSOCKET', '🔗 WebSocket 已連線', 'Binance 實時數據連線成功');
    } else {
      this.log('ERROR', 'WEBSOCKET', '🔌 WebSocket 斷線', '正在嘗試重新連線...');
    }
  }

  // 錯誤日誌
  logError(source: string, title: string, error: Error | string) {
    const message = error instanceof Error ? error.message : error;
    this.log('ERROR', source, `❌ ${title}`, message, { error: message });
  }

  // DCA 加倉
  logDCA(botName: string, orderNumber: number, price: number, size: number) {
    this.log('TRADE', 'DCA_ENGINE', `📥 ${botName} DCA 加倉 #${orderNumber}`, 
      `價格: $${price.toFixed(2)} | 數量: ${size.toFixed(6)} BTC`,
      { botName, orderNumber, price, size }
    );
  }

  // 移動止損更新
  logTrailingStop(botName: string, newStopPrice: number, triggerPrice: number) {
    this.log('INFO', 'RISK_CONTROL', `🔄 ${botName} 移動止損更新`, 
      `新止損價: $${newStopPrice.toFixed(2)} | 觸發價: $${triggerPrice.toFixed(2)}`,
      { botName, newStopPrice, triggerPrice }
    );
  }

  // 餘額警告
  logBalanceWarning(currentBalance: number, requiredBalance: number) {
    this.log('WARN', 'RISK_CONTROL', `⚠️ 餘額不足警告`, 
      `當前餘額: $${currentBalance.toFixed(2)} | 需要: $${requiredBalance.toFixed(2)}`,
      { currentBalance, requiredBalance }
    );
  }

  // 每日統計
  logDailySummary(stats: { trades: number; pnl: number; winRate: number }) {
    const pnlStr = stats.pnl >= 0 ? `+$${stats.pnl.toFixed(2)}` : `-$${Math.abs(stats.pnl).toFixed(2)}`;
    this.log('INFO', 'STATISTICS', `📊 每日統計`, 
      `交易次數: ${stats.trades} | 損益: ${pnlStr} | 勝率: ${stats.winRate.toFixed(1)}%`,
      stats
    );
  }
}

// 導出單例
export const serverLog = new ServerLogService();
