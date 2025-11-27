
import React, { useState, useMemo } from 'react';
import { ContractPosition } from '../types';

interface ContractTradingWidgetProps {
  currentPrice: number;
}

const ContractTradingWidget: React.FC<ContractTradingWidgetProps> = ({ currentPrice }) => {
  const [leverage, setLeverage] = useState<number>(20);
  const [marginType, setMarginType] = useState<'CROSS' | 'ISOLATED'>('ISOLATED');
  const [amount, setAmount] = useState<string>('1000');
  
  // Active Positions State
  const [positions, setPositions] = useState<ContractPosition[]>([
      {
          id: 'POS-001',
          symbol: 'BTC/USDT',
          side: 'LONG',
          size: 0.5,
          leverage: 20,
          entryPrice: 95000.00,
          markPrice: 95000,
          liquidationPrice: 90250.00,
          unrealizedPnL: 0,
          roe: 0,
          marginType: 'ISOLATED'
      }
  ]);

  // 根據當前價格動態計算未實現盈虧
  const updatedPositions = useMemo(() => {
    return positions.map(pos => {
      const markPrice = currentPrice || pos.markPrice;
      const priceDiff = pos.side === 'LONG' 
        ? markPrice - pos.entryPrice 
        : pos.entryPrice - markPrice;
      const unrealizedPnL = priceDiff * pos.size;
      const roe = (priceDiff / pos.entryPrice) * 100 * pos.leverage;
      
      return {
        ...pos,
        markPrice,
        unrealizedPnL,
        roe
      };
    });
  }, [positions, currentPrice]);

  const handleOrder = (side: 'LONG' | 'SHORT') => {
      alert(`${side} Order Placed: ${amount} USDT x${leverage}`);
  };

  const closePosition = (id: string) => {
      setPositions(prev => prev.filter(p => p.id !== id));
  };

  return (
    <div className="bg-surface border border-zinc-800 rounded-xl p-6 flex flex-col gap-6 shadow-xl shadow-black/30">
      <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-3 pb-4 border-b border-zinc-800">
        <div className="p-1.5 bg-accent/10 rounded-lg">
             <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
        </div>
        合約交易終端 (Manual Trade)
      </h3>

      {/* --- Settings Section --- */}
      <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-5">
              {/* Margin Mode */}
              <div className="flex flex-col gap-2">
                  <label className="text-xs uppercase text-zinc-500 font-bold tracking-widest">保證金模式</label>
                  <div className="flex bg-zinc-900 rounded-lg border border-zinc-700 p-1.5 h-12">
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
              
              {/* Leverage Selector */}
              <div className="flex flex-col gap-2">
                  <label className="text-xs uppercase text-zinc-500 font-bold tracking-widest">槓桿倍數</label>
                  <div className="relative h-12">
                      <select 
                        value={leverage} 
                        onChange={(e) => setLeverage(Number(e.target.value))}
                        className="w-full h-full bg-zinc-900 text-base font-mono font-bold text-accent border border-zinc-700 rounded-lg px-4 outline-none focus:border-accent appearance-none transition-colors"
                      >
                          <option value="1">1x</option>
                          <option value="5">5x</option>
                          <option value="10">10x</option>
                          <option value="20">20x</option>
                          <option value="50">50x</option>
                          <option value="100">100x</option>
                      </select>
                      <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                        <svg className="w-5 h-5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </div>
                  </div>
              </div>
          </div>
      </div>

      {/* --- Execution Section --- */}
      <div className="bg-zinc-900/40 p-5 rounded-xl border border-zinc-800/60 flex flex-col gap-5">
          <div className="relative">
              <label className="text-xs text-zinc-500 font-bold uppercase mb-2 block tracking-widest">下單金額 (USDT)</label>
              <input 
                type="number" 
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full h-14 bg-zinc-950 border border-zinc-700 rounded-lg px-4 text-right font-mono text-zinc-100 text-2xl outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all placeholder-zinc-700"
                placeholder="0.00"
              />
          </div>

          <div className="grid grid-cols-2 gap-5">
              <button 
                onClick={() => handleOrder('LONG')}
                className="h-14 bg-primary hover:bg-emerald-500 text-zinc-950 font-black rounded-lg transition-all text-base flex items-center justify-center gap-2 shadow-xl shadow-emerald-900/20 active:translate-y-0.5"
              >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                  開多 (LONG)
              </button>
              <button 
                onClick={() => handleOrder('SHORT')}
                className="h-14 bg-danger hover:bg-red-500 text-white font-black rounded-lg transition-all text-base flex items-center justify-center gap-2 shadow-xl shadow-red-900/20 active:translate-y-0.5"
              >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                  開空 (SHORT)
              </button>
          </div>
      </div>

      {/* --- Positions Section --- */}
      <div className="flex-1 flex flex-col min-h-0 pt-4 border-t border-zinc-800 mt-2">
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm font-bold text-zinc-400 uppercase flex items-center gap-3 tracking-widest">
                <span className="w-2.5 h-2.5 bg-accent rounded-full shadow-[0_0_8px_rgba(59,130,246,0.6)] animate-pulse"></span>
                當前持倉 ({updatedPositions.length})
            </span>
          </div>

          <div className="space-y-4 overflow-y-auto custom-scrollbar pr-1 max-h-[300px]">
              {updatedPositions.length > 0 ? updatedPositions.map(pos => (
                  <div key={pos.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:border-zinc-600 transition-all relative group shadow-md">
                      <div className="flex justify-between items-start mb-3">
                          <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                  <span className={`font-black text-xs px-2 py-1 rounded-md ${pos.side === 'LONG' ? 'text-primary bg-primary/10' : 'text-danger bg-danger/10'}`}>
                                      {pos.side}
                                  </span>
                                  <span className="font-mono text-zinc-200 font-bold text-base">{pos.symbol}</span>
                              </div>
                              <span className="text-zinc-500 font-mono text-xs ml-0.5 font-medium">{pos.marginType} • {pos.leverage}x</span>
                          </div>
                          <div className="text-right">
                              <div className={`font-mono font-black text-lg ${pos.unrealizedPnL >= 0 ? 'text-primary' : 'text-danger'}`}>
                                  {pos.unrealizedPnL > 0 ? '+' : ''}{pos.unrealizedPnL.toFixed(2)}
                              </div>
                              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">uPNL (USDT)</span>
                          </div>
                      </div>
                      
                      <div className="flex justify-between items-center bg-black/20 rounded-md p-3 mt-2">
                          <div className="flex flex-col">
                              <span className="text-[10px] text-zinc-600 uppercase font-bold">開倉均價</span>
                              <span className="font-mono text-sm text-zinc-300 font-bold">{pos.entryPrice.toLocaleString()}</span>
                          </div>
                          <div className="flex flex-col text-right">
                              <span className="text-[10px] text-zinc-600 uppercase font-bold">強平價格</span>
                              <span className="font-mono text-sm text-warning font-bold">{pos.liquidationPrice.toLocaleString()}</span>
                          </div>
                      </div>

                      <button 
                            onClick={() => closePosition(pos.id)}
                            className="w-full mt-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs py-2.5 rounded-lg transition-colors font-bold border border-zinc-700 hover:border-zinc-500 tracking-wide"
                       >
                           市價平倉 (Close)
                       </button>
                  </div>
              )) : (
                  <div className="flex flex-col items-center justify-center py-10 text-zinc-600 gap-3 border-2 border-dashed border-zinc-800/50 rounded-xl bg-zinc-900/20">
                      <svg className="w-10 h-10 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      <span className="text-sm font-medium">無活躍持倉</span>
                  </div>
              )}
          </div>
      </div>
    </div>
  );
};

export default ContractTradingWidget;
