
import { Trade, ContractPosition } from '../types';

// 模擬盤交易引擎 - 管理真實的模擬倉位和訂單
export interface SimulatedOrder {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT';
  price: number;        // 下單價格 (市價單為執行價)
  amount: number;       // 數量
  leverage: number;
  marginType: 'CROSS' | 'ISOLATED';
  status: 'PENDING' | 'FILLED' | 'CANCELLED';
  timestamp: number;
}

export interface SimulatedPosition {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;   // 開倉均價
  size: number;         // 持倉數量
  leverage: number;
  marginType: 'CROSS' | 'ISOLATED';
  margin: number;       // 保證金
  openTime: number;
  // 以下為動態計算
  markPrice: number;
  unrealizedPnL: number;
  roe: number;
  liquidationPrice: number;
}

export interface TradeRecord {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'OPEN' | 'CLOSE';
  price: number;
  amount: number;
  realizedPnL?: number;  // 只有平倉才有
  fee: number;
  timestamp: number;
}

class TradingEngine {
  private balance: number = 10000;  // 初始資金 10,000 USDT
  private positions: Map<string, SimulatedPosition> = new Map();
  private tradeHistory: TradeRecord[] = [];
  private listeners: Set<() => void> = new Set();

  constructor() {
    // 初始化
  }

  // 訂閱狀態變化
  subscribe(callback: () => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notify() {
    this.listeners.forEach(cb => cb());
  }

  // 獲取餘額
  getBalance(): number {
    return this.balance;
  }

  // 獲取所有持倉
  getPositions(): SimulatedPosition[] {
    return Array.from(this.positions.values());
  }

  // 獲取交易歷史
  getTradeHistory(): TradeRecord[] {
    return [...this.tradeHistory];
  }

  // 獲取總權益 (餘額 + 未實現損益)
  getEquity(): number {
    const unrealizedPnL = this.getPositions().reduce((sum, p) => sum + p.unrealizedPnL, 0);
    return this.balance + unrealizedPnL;
  }

  // 更新所有持倉的市價和損益
  updateMarkPrices(prices: Record<string, number>) {
    if (this.positions.size === 0) return;
    
    this.positions.forEach((position) => {
      const symbol = position.symbol.replace('/', '');
      const markPrice = prices[symbol] || prices[position.symbol];
      if (markPrice && markPrice > 0) {
        position.markPrice = markPrice;
        
        // 計算未實現損益
        const priceDiff = position.side === 'LONG' 
          ? markPrice - position.entryPrice 
          : position.entryPrice - markPrice;
        position.unrealizedPnL = priceDiff * position.size;
        
        // 計算 ROE (回報率)
        position.roe = (position.unrealizedPnL / position.margin) * 100;
        
        // 計算強平價格 (簡化計算，實際更複雜)
        const liquidationBuffer = position.margin * 0.9; // 90% 保證金虧損時強平
        if (position.side === 'LONG') {
          position.liquidationPrice = position.entryPrice - (liquidationBuffer / position.size);
        } else {
          position.liquidationPrice = position.entryPrice + (liquidationBuffer / position.size);
        }
      }
    });
    
    // 只要有持倉就通知更新
    this.notify();
  }

  // 開倉 / 下單
  // marginAmount: 用戶投入的保證金 (USDT)
  openPosition(
    symbol: string,
    side: 'LONG' | 'SHORT',
    marginAmount: number,
    leverage: number,
    currentPrice: number,
    marginType: 'CROSS' | 'ISOLATED' = 'ISOLATED'
  ): { success: boolean; message: string; position?: SimulatedPosition; trade?: TradeRecord } {
    
    // 保證金就是用戶輸入的金額
    const margin = marginAmount;
    // 合約價值 = 保證金 × 槓桿
    const positionValue = margin * leverage;
    const fee = positionValue * 0.0004; // 0.04% 手續費 (基於合約價值)
    const totalCost = margin + fee;

    // 檢查餘額
    if (totalCost > this.balance) {
      return { success: false, message: `餘額不足。需要 ${totalCost.toFixed(2)} USDT，當前餘額 ${this.balance.toFixed(2)} USDT` };
    }

    // 計算持倉數量 = 合約價值 / 當前價格
    const size = positionValue / currentPrice;

    // 檢查是否已有同方向持倉 (加倉)
    const positionKey = `${symbol}-${side}`;
    const existingPosition = this.positions.get(positionKey);

    if (existingPosition) {
      // 加倉邏輯: 計算新均價
      const totalSize = existingPosition.size + size;
      const totalValue = (existingPosition.entryPrice * existingPosition.size) + (currentPrice * size);
      const newAvgPrice = totalValue / totalSize;
      
      existingPosition.entryPrice = newAvgPrice;
      existingPosition.size = totalSize;
      existingPosition.margin += margin;
      
      this.balance -= totalCost;
    } else {
      // 新開倉
      // 計算強平價格：當虧損達到 90% 保證金時強平
      // 強平價 = 入場價 ± (保證金 × 0.9) / 持倉數量
      const liquidationBuffer = margin * 0.9;
      const liquidationPrice = side === 'LONG'
        ? currentPrice - (liquidationBuffer / size)
        : currentPrice + (liquidationBuffer / size);
      
      const position: SimulatedPosition = {
        id: `POS-${Date.now()}`,
        symbol,
        side,
        entryPrice: currentPrice,
        size,
        leverage,
        marginType,
        margin,
        openTime: Date.now(),
        markPrice: currentPrice,
        unrealizedPnL: 0,
        roe: 0,
        liquidationPrice
      };

      this.positions.set(positionKey, position);
      this.balance -= totalCost;
    }

    // 記錄交易
    const trade: TradeRecord = {
      id: `TRD-${Date.now()}`,
      symbol,
      side: side === 'LONG' ? 'BUY' : 'SELL',
      type: 'OPEN',
      price: currentPrice,
      amount: size,
      fee,
      timestamp: Date.now()
    };
    this.tradeHistory.unshift(trade);
    if (this.tradeHistory.length > 100) this.tradeHistory.pop();

    this.notify();

    return { 
      success: true, 
      message: `開倉成功: ${side} ${symbol} @ ${currentPrice.toFixed(2)}`,
      position: this.positions.get(positionKey),
      trade
    };
  }

  // 平倉
  closePosition(
    symbol: string,
    side: 'LONG' | 'SHORT',
    currentPrice: number,
    closePercent: number = 100  // 平倉比例，預設全平
  ): { success: boolean; message: string; realizedPnL?: number; trade?: TradeRecord } {
    
    const positionKey = `${symbol}-${side}`;
    const position = this.positions.get(positionKey);

    if (!position) {
      return { success: false, message: `找不到 ${symbol} ${side} 持倉` };
    }

    const closeRatio = closePercent / 100;
    const closeSize = position.size * closeRatio;
    const closeMargin = position.margin * closeRatio;

    // 計算已實現損益
    const priceDiff = side === 'LONG'
      ? currentPrice - position.entryPrice
      : position.entryPrice - currentPrice;
    const realizedPnL = priceDiff * closeSize;
    const fee = closeSize * currentPrice * 0.0004;

    // 更新餘額
    this.balance += closeMargin + realizedPnL - fee;

    // 記錄交易
    const trade: TradeRecord = {
      id: `TRD-${Date.now()}`,
      symbol,
      side: side === 'LONG' ? 'SELL' : 'BUY',
      type: 'CLOSE',
      price: currentPrice,
      amount: closeSize,
      realizedPnL,
      fee,
      timestamp: Date.now()
    };
    this.tradeHistory.unshift(trade);

    // 更新或刪除持倉
    if (closePercent >= 100) {
      this.positions.delete(positionKey);
    } else {
      position.size -= closeSize;
      position.margin -= closeMargin;
    }

    this.notify();

    return {
      success: true,
      message: `平倉成功: ${side} ${symbol} @ ${currentPrice.toFixed(2)}, 損益: ${realizedPnL >= 0 ? '+' : ''}${realizedPnL.toFixed(2)} USDT`,
      realizedPnL,
      trade
    };
  }

  // 重置帳戶 (重新開始模擬)
  reset(initialBalance: number = 10000) {
    this.balance = initialBalance;
    this.positions.clear();
    this.tradeHistory = [];
    this.notify();
  }
}

// 單例模式
export const tradingEngine = new TradingEngine();
export default tradingEngine;
