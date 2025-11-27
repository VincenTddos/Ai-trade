
import React, { useState, useEffect, useCallback } from 'react';
import { MarketData } from '../types';
import { tradingEngine, SimulatedPosition } from '../services/tradingEngine';

interface TradingPageProps {
  currentPrice: number;
  marketData: MarketData[];
}

const TradingPage: React.FC<TradingPageProps> = ({ currentPrice, marketData }) => {
  const [leverage, setLeverage] = useState<number>(20);
  const [marginType, setMarginType] = useState<'CROSS' | 'ISOLATED'>('ISOLATED');
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [amount, setAmount] = useState<string>('1000');
  const [limitPrice, setLimitPrice] = useState<string>('');
  const [stopLoss, setStopLoss] = useState<string>('');
  const [takeProfit, setTakeProfit] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // 從交易引擎獲取真實數據
  const [positions, setPositions] = useState<SimulatedPosition[]>([]);
  const [balance, setBalance] = useState<number>(tradingEngine.getBalance());
  const [equity, setEquity] = useState<number>(tradingEngine.getEquity());

  // 訂閱交易引擎狀態變化
  const updateState = useCallback(() => {
    setPositions(tradingEngine.getPositions());
    setBalance(tradingEngine.getBalance());
    setEquity(tradingEngine.getEquity());
  }, []);

  useEffect(() => {
    updateState();
    const unsubscribe = tradingEngine.subscribe(updateState);
    return unsubscribe;
  }, [updateState]);

  // 當價格更新時，更新持倉的市價
  useEffect(() => {
    if (currentPrice > 0) {
      tradingEngine.updateMarkPrices({ 'BTCUSDT': currentPrice, 'BTC/USDT': currentPrice });
    }
  }, [currentPrice]);

  const handleOrder = (side: 'LONG' | 'SHORT') => {
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('請輸入有效的下單金額');
      return;
    }

    if (currentPrice <= 0) {
      alert('無法獲取當前價格，請稍後再試');
      return;
    }

    setIsLoading(true);
    
    // 使用真實交易引擎開倉
    const result = tradingEngine.openPosition(
      'BTC/USDT',
      side,
      amountNum,
      leverage,
      currentPrice,
      marginType
    );

    setIsLoading(false);

    if (result.success) {
      // 成功開倉提示
      alert(`✅ ${result.message}\n\n持倉數量: ${result.position?.size.toFixed(6)} BTC\n保證金: ${amountNum.toFixed(2)} USDT\n合約價值: ${(amountNum * leverage).toFixed(2)} USDT`);
    } else {
      alert(`❌ ${result.message}`);
    }
  };

  const handleClosePosition = (position: SimulatedPosition) => {
    if (currentPrice <= 0) {
      alert('無法獲取當前價格，請稍後再試');
      return;
    }

    const confirmMsg = `確定要平倉 ${position.side} ${position.symbol}?\n\n數量: ${position.size.toFixed(6)} BTC\n開倉均價: $${position.entryPrice.toFixed(2)}\n當前價格: $${currentPrice.toFixed(2)}\n預估損益: ${position.unrealizedPnL >= 0 ? '+' : ''}$${position.unrealizedPnL.toFixed(2)}`;
    
    if (!confirm(confirmMsg)) return;

    const result = tradingEngine.closePosition(position.symbol, position.side, currentPrice, 100);
    
    if (result.success) {
      alert(`✅ ${result.message}`);
    } else {
      alert(`❌ ${result.message}`);
    }
  };

  // Calculate estimated values
  // amountNum 是「保證金」，用戶實際投入的金額
  const amountNum = parseFloat(amount) || 0;
  const positionValue = amountNum * leverage;  // 合約價值 = 保證金 × 槓桿
  const estimatedQty = currentPrice > 0 ? (positionValue / currentPrice).toFixed(6) : '0';

  // Get recent price stats
  const priceChange24h = marketData.length > 1 
    ? ((currentPrice - marketData[0].close) / marketData[0].close * 100).toFixed(2)
    : '0.00';
  const high24h = marketData.length > 0 
    ? Math.max(...marketData.map(d => d.high)).toFixed(2)
    : '0.00';
  const low24h = marketData.length > 0 
    ? Math.min(...marketData.map(d => d.low)).toFixed(2)
    : '0.00';

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 p-6 lg:p-8">
      <div className="max-w-[1920px] mx-auto">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-zinc-100 flex items-center gap-3">
              <div className="p-2 bg-accent/10 rounded-xl">
                <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              合約交易終端
            </h2>
            <p className="text-zinc-500 mt-1 text-sm">手動開倉、平倉管理與風險控制</p>
          </div>

          {/* Quick Stats */}
          <div className="flex items-center gap-4">
            <div className="bg-surface border border-zinc-800 rounded-xl px-5 py-3">
              <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">BTC/USDT</div>
              <div className="flex items-center gap-3">
                <span className="text-xl font-mono font-bold text-white">
                  ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
                <span className={`text-sm font-medium ${parseFloat(priceChange24h) >= 0 ? 'text-primary' : 'text-danger'}`}>
                  {parseFloat(priceChange24h) >= 0 ? '+' : ''}{priceChange24h}%
                </span>
              </div>
            </div>
            <div className="bg-surface border border-zinc-800 rounded-xl px-5 py-3">
              <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">24H 高/低</div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono text-primary">${high24h}</span>
                <span className="text-zinc-600">/</span>
                <span className="text-sm font-mono text-danger">${low24h}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Trading Form - Left Side */}
          <div className="xl:col-span-1">
            <div className="bg-surface border border-zinc-800 rounded-xl p-6 flex flex-col gap-6 shadow-xl shadow-black/30 sticky top-24">
              <h3 className="text-lg font-bold text-zinc-100 pb-4 border-b border-zinc-800">
                開倉設定
              </h3>

              {/* Margin & Leverage Row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-xs uppercase text-zinc-500 font-bold tracking-widest">保證金模式</label>
                  <div className="flex bg-zinc-900 rounded-lg border border-zinc-700 p-1 h-10">
                    <button
                      onClick={() => setMarginType('CROSS')}
                      className={`flex-1 text-xs font-bold rounded-md transition-all ${marginType === 'CROSS' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      全倉
                    </button>
                    <button
                      onClick={() => setMarginType('ISOLATED')}
                      className={`flex-1 text-xs font-bold rounded-md transition-all ${marginType === 'ISOLATED' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      逐倉
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs uppercase text-zinc-500 font-bold tracking-widest">槓桿倍數</label>
                  <div className="relative h-10">
                    <select
                      value={leverage}
                      onChange={(e) => setLeverage(Number(e.target.value))}
                      className="w-full h-full bg-zinc-900 text-sm font-mono font-bold text-accent border border-zinc-700 rounded-lg px-3 outline-none focus:border-accent appearance-none transition-colors cursor-pointer"
                    >
                      {[1, 2, 3, 5, 10, 20, 25, 50, 75, 100, 125].map(v => (
                        <option key={v} value={v}>{v}x</option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                      <svg className="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Order Type */}
              <div className="flex flex-col gap-2">
                <label className="text-xs uppercase text-zinc-500 font-bold tracking-widest">訂單類型</label>
                <div className="flex bg-zinc-900 rounded-lg border border-zinc-700 p-1 h-10">
                  <button
                    onClick={() => setOrderType('MARKET')}
                    className={`flex-1 text-xs font-bold rounded-md transition-all ${orderType === 'MARKET' ? 'bg-accent text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    市價單
                  </button>
                  <button
                    onClick={() => setOrderType('LIMIT')}
                    className={`flex-1 text-xs font-bold rounded-md transition-all ${orderType === 'LIMIT' ? 'bg-accent text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    限價單
                  </button>
                </div>
              </div>

              {/* Limit Price (conditional) */}
              {orderType === 'LIMIT' && (
                <div className="flex flex-col gap-2">
                  <label className="text-xs uppercase text-zinc-500 font-bold tracking-widest">限價價格 (USDT)</label>
                  <input
                    type="number"
                    value={limitPrice}
                    onChange={(e) => setLimitPrice(e.target.value)}
                    placeholder={currentPrice.toFixed(2)}
                    className="w-full h-12 bg-zinc-900 border border-zinc-700 rounded-lg px-4 font-mono text-zinc-100 outline-none focus:border-accent transition-all placeholder-zinc-600"
                  />
                </div>
              )}

              {/* Amount Input */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs uppercase text-zinc-500 font-bold tracking-widest">保證金 (USDT)</label>
                  <span className="text-xs text-zinc-600">可用: {balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full h-14 bg-zinc-900 border border-zinc-700 rounded-lg px-4 text-right font-mono text-zinc-100 text-2xl outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all placeholder-zinc-700"
                  placeholder="0.00"
                />
                {/* Quick Amount Buttons */}
                <div className="flex gap-2 mt-1">
                  {[25, 50, 75, 100].map(pct => (
                    <button
                      key={pct}
                      onClick={() => setAmount((balance * pct / 100).toFixed(2))}
                      className="flex-1 text-xs py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-md transition-all font-medium"
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Position Size Info */}
              <div className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-800/50">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-zinc-500">保證金</span>
                  <span className="font-mono text-sm text-zinc-200">{amountNum.toLocaleString(undefined, { minimumFractionDigits: 2 })} USDT</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-zinc-500">合約價值 ({leverage}x)</span>
                  <span className="font-mono text-sm text-zinc-200">{positionValue.toLocaleString()} USDT</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-zinc-500">預估數量</span>
                  <span className="font-mono text-sm text-zinc-200">{estimatedQty} BTC</span>
                </div>
              </div>

              {/* TP/SL Section */}
              <div className="border-t border-zinc-800 pt-4">
                <div className="text-xs uppercase text-zinc-500 font-bold tracking-widest mb-3">止盈止損 (選填)</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-primary font-medium">止盈價格</label>
                    <input
                      type="number"
                      value={takeProfit}
                      onChange={(e) => setTakeProfit(e.target.value)}
                      placeholder="TP"
                      className="w-full h-10 bg-zinc-900 border border-zinc-700 rounded-lg px-3 font-mono text-sm text-zinc-100 outline-none focus:border-primary transition-all placeholder-zinc-600"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-danger font-medium">止損價格</label>
                    <input
                      type="number"
                      value={stopLoss}
                      onChange={(e) => setStopLoss(e.target.value)}
                      placeholder="SL"
                      className="w-full h-10 bg-zinc-900 border border-zinc-700 rounded-lg px-3 font-mono text-sm text-zinc-100 outline-none focus:border-danger transition-all placeholder-zinc-600"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <button
                  onClick={() => handleOrder('LONG')}
                  className="h-14 bg-primary hover:bg-emerald-500 text-zinc-950 font-black rounded-lg transition-all text-base flex items-center justify-center gap-2 shadow-xl shadow-emerald-900/30 active:translate-y-0.5"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                  開多 / Long
                </button>
                <button
                  onClick={() => handleOrder('SHORT')}
                  className="h-14 bg-danger hover:bg-red-500 text-white font-black rounded-lg transition-all text-base flex items-center justify-center gap-2 shadow-xl shadow-red-900/30 active:translate-y-0.5"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                  開空 / Short
                </button>
              </div>
            </div>
          </div>

          {/* Positions & Orders - Right Side */}
          <div className="xl:col-span-2 flex flex-col gap-8">
            {/* Active Positions */}
            <div className="bg-surface border border-zinc-800 rounded-xl p-6 shadow-lg shadow-black/20">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-3">
                  <span className="w-2.5 h-2.5 bg-accent rounded-full shadow-[0_0_8px_rgba(59,130,246,0.6)] animate-pulse"></span>
                  當前持倉 ({positions.length})
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500">總未實現盈虧:</span>
                  <span className={`font-mono font-bold ${positions.reduce((acc, p) => acc + p.unrealizedPnL, 0) >= 0 ? 'text-primary' : 'text-danger'}`}>
                    {positions.reduce((acc, p) => acc + p.unrealizedPnL, 0) >= 0 ? '+' : ''}
                    ${positions.reduce((acc, p) => acc + p.unrealizedPnL, 0).toFixed(2)}
                  </span>
                </div>
              </div>

              {positions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-xs text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
                        <th className="text-left py-3 px-2">交易對</th>
                        <th className="text-left py-3 px-2">方向</th>
                        <th className="text-right py-3 px-2">數量</th>
                        <th className="text-right py-3 px-2">開倉均價</th>
                        <th className="text-right py-3 px-2">標記價格</th>
                        <th className="text-right py-3 px-2">強平價格</th>
                        <th className="text-right py-3 px-2">未實現盈虧</th>
                        <th className="text-right py-3 px-2">ROE</th>
                        <th className="text-center py-3 px-2">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {positions.map(pos => (
                        <tr key={pos.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                          <td className="py-4 px-2">
                            <div className="flex flex-col">
                              <span className="font-mono font-bold text-zinc-100">{pos.symbol}</span>
                              <span className="text-xs text-zinc-500">{pos.marginType} • {pos.leverage}x</span>
                            </div>
                          </td>
                          <td className="py-4 px-2">
                            <span className={`font-bold text-xs px-2 py-1 rounded ${pos.side === 'LONG' ? 'text-primary bg-primary/10' : 'text-danger bg-danger/10'}`}>
                              {pos.side}
                            </span>
                          </td>
                          <td className="py-4 px-2 text-right font-mono text-sm">{pos.size.toFixed(6)} BTC</td>
                          <td className="py-4 px-2 text-right font-mono text-sm">${pos.entryPrice.toFixed(2)}</td>
                          <td className="py-4 px-2 text-right font-mono text-sm text-zinc-100">${pos.markPrice.toFixed(2)}</td>
                          <td className="py-4 px-2 text-right font-mono text-sm text-warning">${pos.liquidationPrice.toFixed(2)}</td>
                          <td className={`py-4 px-2 text-right font-mono font-bold ${pos.unrealizedPnL >= 0 ? 'text-primary' : 'text-danger'}`}>
                            {pos.unrealizedPnL >= 0 ? '+' : ''}${pos.unrealizedPnL.toFixed(2)}
                          </td>
                          <td className={`py-4 px-2 text-right font-mono text-sm ${pos.roe >= 0 ? 'text-primary' : 'text-danger'}`}>
                            {pos.roe >= 0 ? '+' : ''}{pos.roe.toFixed(2)}%
                          </td>
                          <td className="py-4 px-2 text-center">
                            <button
                              onClick={() => handleClosePosition(pos)}
                              className="px-3 py-1.5 bg-zinc-700 hover:bg-danger text-zinc-300 hover:text-white text-xs rounded-lg transition-all font-medium"
                            >
                              平倉
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-zinc-600 gap-3 border-2 border-dashed border-zinc-800/50 rounded-xl bg-zinc-900/20">
                  <svg className="w-12 h-12 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-sm font-medium">無活躍持倉</span>
                </div>
              )}
            </div>

            {/* Order Book / Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Risk Calculator */}
              <div className="bg-surface border border-zinc-800 rounded-xl p-6 shadow-lg shadow-black/20">
                <h3 className="text-base font-bold text-zinc-100 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  風險計算器
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-zinc-800/50">
                    <span className="text-sm text-zinc-400">最大虧損 (當前設定)</span>
                    <span className="font-mono font-bold text-danger">-${amountNum.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-zinc-800/50">
                    <span className="text-sm text-zinc-400">預估強平價格 (Long)</span>
                    <span className="font-mono text-warning">
                      ${(currentPrice * (1 - 0.9 / leverage)).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-zinc-400">預估強平價格 (Short)</span>
                    <span className="font-mono text-warning">
                      ${(currentPrice * (1 + 0.9 / leverage)).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Trade Info */}
              <div className="bg-surface border border-zinc-800 rounded-xl p-6 shadow-lg shadow-black/20">
                <h3 className="text-base font-bold text-zinc-100 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  交易提示
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-2 text-zinc-400">
                    <span className="text-primary mt-0.5">•</span>
                    <span>建議使用逐倉模式控制風險，避免全倉爆倉</span>
                  </div>
                  <div className="flex items-start gap-2 text-zinc-400">
                    <span className="text-warning mt-0.5">•</span>
                    <span>高槓桿交易風險極高，建議設置止損</span>
                  </div>
                  <div className="flex items-start gap-2 text-zinc-400">
                    <span className="text-accent mt-0.5">•</span>
                    <span>當前資金費率每 8 小時結算一次</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TradingPage;
