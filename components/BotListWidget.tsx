
import React, { useState, useMemo } from 'react';
import { BotStatus } from '../types';

interface Props {
  bots: BotStatus[];
}

const mapStatusToChinese = (status: string) => {
    switch (status) {
        case 'RUNNING': return '運行中';
        case 'PAUSED': return '已暫停';
        case 'STOPPED': return '已停止';
        default: return status;
    }
};

const BotListWidget: React.FC<Props> = ({ bots: initialBots }) => {
  const [bots, setBots] = useState<BotStatus[]>(initialBots);
  const [expandedBotId, setExpandedBotId] = useState<string | null>(null);
  const [optimizingId, setOptimizingId] = useState<string | null>(null);
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newBotConfig, setNewBotConfig] = useState({
      pair: 'BTC/USDT',
      strategy: '網格交易 (Grid)',
      initial_balance: 1000,
      leverage: 10,
      marginType: 'ISOLATED' as 'CROSS' | 'ISOLATED'
  });

  const fleetStats = useMemo(() => {
      return {
          totalEquity: bots.reduce((sum, b) => sum + (b.equity || 0), 0),
          totalPnL: bots.reduce((sum, b) => sum + (b.pnl || 0), 0),
          activeCount: bots.filter(b => b.status === 'RUNNING').length,
          totalCount: bots.length
      };
  }, [bots]);

  const toggleExpand = (id: string) => {
    setExpandedBotId(prev => prev === id ? null : id);
  };

  const handleBotAction = (id: string, action: 'START' | 'STOP' | 'DELETE') => {
    if (action === 'DELETE') {
        if (!window.confirm(`確定要刪除機器人 ${id} 嗎？`)) return;
        setBots(prev => prev.filter(b => b.id !== id));
    } else {
        setBots(prev => prev.map(bot => {
            if (bot.id === id) {
                return {
                    ...bot,
                    status: action === 'START' ? 'RUNNING' : 'STOPPED'
                };
            }
            return bot;
        }));
    }
  };

  const handleOptimize = (id: string) => {
    setOptimizingId(id);
    setTimeout(() => {
        setBots(prev => prev.map(bot => {
            if (bot.id === id) {
                const currentName = bot.strategy;
                let newName = currentName;
                const match = currentName.match(/\(v(\d+)\)$/);
                
                if (match) {
                    const version = parseInt(match[1]) + 1;
                    newName = currentName.replace(/\(v\d+\)$/, `(v${version})`);
                } else {
                    newName = `${currentName} (v2)`;
                }

                return { 
                    ...bot, 
                    roi: bot.roi + Number((Math.random() * 2).toFixed(2)),
                    strategy: newName
                };
            }
            return bot;
        }));
        setOptimizingId(null);
    }, 2000);
  };

  const handleAddBotSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const newBot: BotStatus = {
          id: `BOT-${Math.floor(Math.random() * 10000).toString().padStart(3, '0')}`,
          pair: newBotConfig.pair.toUpperCase(),
          status: 'STOPPED',
          strategy: newBotConfig.strategy,
          initial_balance: Number(newBotConfig.initial_balance),
          balance: Number(newBotConfig.initial_balance),
          equity: Number(newBotConfig.initial_balance),
          unrealized: 0,
          pnl: 0,
          roi: 0,
          leverage: Number(newBotConfig.leverage),
          marginType: newBotConfig.marginType,
          open_positions: 0,
          uptime: '0h 0m',
          trades: []
      };
      setBots(prev => [...prev, newBot]);
      setIsAddModalOpen(false);
  };

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      
      {/* --- Section 1: Fleet Overview Stats (Compact) --- */}
      <div className="grid grid-cols-3 gap-px bg-zinc-800 border-b border-zinc-800">
          <div className="bg-surface p-3 text-center">
              <span className="text-[10px] text-zinc-500 uppercase block mb-1 font-bold tracking-wider">總權益</span>
              <span className="text-sm font-mono font-bold text-zinc-100">
                  ${fleetStats.totalEquity.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
          </div>
          <div className="bg-surface p-3 text-center">
              <span className="text-[10px] text-zinc-500 uppercase block mb-1 font-bold tracking-wider">總損益</span>
              <span className={`text-sm font-mono font-bold ${fleetStats.totalPnL >= 0 ? 'text-primary' : 'text-danger'}`}>
                  {fleetStats.totalPnL >= 0 ? '+' : ''}{fleetStats.totalPnL.toFixed(0)}
              </span>
          </div>
          <div className="bg-surface p-3 text-center">
              <span className="text-[10px] text-zinc-500 uppercase block mb-1 font-bold tracking-wider">活躍/總數</span>
              <span className="text-sm font-mono font-bold text-accent">
                  {fleetStats.activeCount}<span className="text-zinc-600 text-xs">/{fleetStats.totalCount}</span>
              </span>
          </div>
      </div>

      {/* --- Section 2: Header (Compact) --- */}
      <div className="flex justify-between items-center px-4 py-3 border-b border-zinc-800 bg-surface/80">
         <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
            <svg className="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
            機器人監控列表
         </span>
         <button 
            onClick={() => setIsAddModalOpen(true)}
            className="text-[11px] bg-primary hover:bg-emerald-400 text-zinc-900 px-3 py-1.5 rounded-lg font-bold shadow-md transition-all flex items-center gap-1.5"
         >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
            新增
         </button>
      </div>

      {/* --- Section 3: Scrollable Bot List (Compact Cards) --- */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar bg-zinc-950/30">
        {bots.map((bot) => (
          <div key={bot.id} className="bg-surface border border-zinc-800 rounded-lg hover:border-zinc-700 shadow-md transition-all duration-200 group relative overflow-hidden">
            
            {/* Active Indicator Strip */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${bot.status === 'RUNNING' ? 'bg-primary' : 'bg-zinc-700'}`}></div>

            <div className="p-4 pl-5">
                {/* Identity Row - Compact */}
                <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-3 cursor-pointer flex-1 min-w-0" onClick={() => toggleExpand(bot.id)}>
                        <div className="w-9 h-9 rounded-md bg-zinc-800 flex items-center justify-center border border-zinc-700 text-xs font-bold text-zinc-400 shrink-0">
                            {bot.pair.split('/')[0].slice(0, 3)}
                        </div>
                        <div className="flex flex-col min-w-0">
                             <div className="flex items-center gap-2">
                                 <span className="font-bold text-zinc-100 font-mono text-sm">{bot.pair}</span>
                                 <span className={`text-[9px] px-1.5 py-0.5 rounded border uppercase font-bold ${
                                    bot.status === 'RUNNING' ? 'border-primary/30 text-primary bg-primary/10' : 
                                    'border-zinc-600 text-zinc-500 bg-zinc-800'
                                 }`}>
                                    {mapStatusToChinese(bot.status)}
                                 </span>
                             </div>
                             <span className="text-[10px] text-zinc-500 truncate">{bot.strategy}</span>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-1.5 shrink-0">
                        {bot.status === 'RUNNING' ? (
                            <button onClick={() => handleBotAction(bot.id, 'STOP')} title="停止" className="p-2 rounded-md bg-zinc-800 hover:bg-zinc-700 text-warning border border-zinc-700 transition-all"><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg></button>
                        ) : (
                            <button onClick={() => handleBotAction(bot.id, 'START')} title="啟動" className="p-2 rounded-md bg-zinc-800 hover:bg-zinc-700 text-primary border border-zinc-700 transition-all"><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></button>
                        )}
                        <button onClick={() => handleBotAction(bot.id, 'DELETE')} title="刪除" className="p-2 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-500 hover:text-danger border border-zinc-700 transition-all"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                    </div>
                </div>
                
                {/* Metrics Row - Inline Compact */}
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => toggleExpand(bot.id)}>
                     {/* ROI */}
                     <div className="flex items-center gap-2 bg-zinc-900/50 px-3 py-2 rounded-md border border-zinc-800 flex-1">
                         <span className="text-[9px] font-bold text-zinc-500 uppercase">ROI</span>
                         <span className={`font-mono text-sm font-bold ${bot.roi >= 0 ? 'text-primary' : 'text-danger'}`}>
                            {bot.roi > 0 ? '+' : ''}{bot.roi}%
                         </span>
                         <svg className={`w-3 h-3 ${bot.roi >= 0 ? 'text-primary' : 'text-danger'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={bot.roi >= 0 ? "M5 10l7-7m0 0l7 7m-7-7v18" : "M19 14l-7 7m0 0l-7-7m7 7V3"} />
                         </svg>
                     </div>
                     
                     {/* Live PnL */}
                     <div className="flex items-center gap-2 bg-zinc-900/50 px-3 py-2 rounded-md border border-zinc-800 flex-1">
                         <span className="text-[9px] font-bold text-zinc-500 uppercase flex items-center gap-1">
                            LIVE
                            {bot.status === 'RUNNING' && <span className="w-1 h-1 bg-primary rounded-full animate-pulse"></span>}
                         </span>
                         <span className={`font-mono text-sm font-bold ${bot.unrealized >= 0 ? 'text-zinc-200' : 'text-danger'}`}>
                            {bot.unrealized > 0 ? '+' : ''}{bot.unrealized.toFixed(1)}
                         </span>
                     </div>
                </div>

                {/* Footer: Stripes + Optimization - Compact */}
                <div className="flex items-center justify-between border-t border-zinc-800/50 pt-3 mt-3">
                    <div className="flex items-center gap-1">
                        <span className="text-[10px] text-zinc-600 mr-1">近期:</span>
                        {(bot.trades && bot.trades.length > 0) ? (
                            bot.trades.slice(0, 5).map((t, idx) => (
                                <div 
                                    key={idx} 
                                    className={`w-2 h-4 rounded-sm ${(t.pnl || 0) >= 0 ? 'bg-primary' : 'bg-danger opacity-70'}`}
                                ></div>
                            ))
                        ) : (
                            <span className="text-[10px] text-zinc-700">--</span>
                        )}
                    </div>

                    <button 
                        onClick={() => handleOptimize(bot.id)}
                        disabled={optimizingId === bot.id}
                        className="text-[10px] font-medium text-zinc-500 hover:text-purple-400 transition-all flex items-center gap-1 disabled:opacity-50"
                    >
                        {optimizingId === bot.id ? (
                            <><svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>優化中</>
                        ) : (
                            <><svg className="w-3 h-3 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>智能優化</>
                        )}
                    </button>
                </div>
            </div>

            {/* Collapsible Details (Expanded) */}
            {expandedBotId === bot.id && (
                <div className="border-t border-zinc-800 bg-black/30 p-5 animate-in slide-in-from-top-4">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5 text-xs text-zinc-500 font-mono">
                        <div className="p-2 rounded bg-zinc-900 border border-zinc-800">
                             <span className="block text-[10px] uppercase mb-0.5">ID</span>
                             <span className="text-zinc-300 font-bold">{bot.id}</span>
                        </div>
                        <div className="p-2 rounded bg-zinc-900 border border-zinc-800">
                             <span className="block text-[10px] uppercase mb-0.5">Leverage</span>
                             <span className="text-zinc-300 font-bold">{bot.leverage}x ({bot.marginType})</span>
                        </div>
                        <div className="p-2 rounded bg-zinc-900 border border-zinc-800">
                             <span className="block text-[10px] uppercase mb-0.5">Total Equity</span>
                             <span className="text-zinc-300 font-bold">${bot.equity.toLocaleString()}</span>
                        </div>
                        <div className="p-2 rounded bg-zinc-900 border border-zinc-800">
                             <span className="block text-[10px] uppercase mb-0.5">Positions</span>
                             <span className="text-zinc-300 font-bold">{bot.open_positions} Open</span>
                        </div>
                    </div>
                    
                    <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        近期交易紀錄 (Transaction History)
                    </h4>
                    
                    {bot.trades && bot.trades.length > 0 ? (
                        <div className="space-y-2">
                            {bot.trades.slice(0, 5).map((trade) => (
                                <div key={trade.id} className="grid grid-cols-4 items-center text-xs py-2 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 transition-colors border border-zinc-800 hover:border-zinc-700">
                                    <span className="text-zinc-500 font-mono">{new Date(trade.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                    <span className={`font-black uppercase tracking-wider ${trade.side === 'BUY' ? 'text-primary' : 'text-danger'}`}>{trade.side}</span>
                                    <span className="text-zinc-300 font-mono text-right">{trade.price.toLocaleString()}</span>
                                    <span className={`font-mono text-right font-bold ${(trade.pnl || 0) >= 0 ? 'text-primary' : 'text-danger'}`}>
                                        {trade.pnl ? `${trade.pnl > 0 ? '+' : ''}${trade.pnl.toFixed(1)}` : '-'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center text-xs text-zinc-600 py-6 italic border border-dashed border-zinc-800 rounded-lg">暫無交易數據</div>
                    )}
                </div>
            )}
          </div>
        ))}
      </div>

      {/* ADD BOT MODAL (Unchanged Logic, just styling check) */}
      {isAddModalOpen && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-surface border border-zinc-700 rounded-xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
                  <div className="p-5 border-b border-zinc-800 flex justify-between items-center">
                      <h3 className="text-base font-bold text-zinc-100">部署新機器人</h3>
                      <button onClick={() => setIsAddModalOpen(false)} className="text-zinc-500 hover:text-white">
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                  </div>
                  <form onSubmit={handleAddBotSubmit} className="p-6 space-y-5">
                       <div>
                          <label className="text-xs uppercase text-zinc-500 font-bold mb-2 block tracking-wider">交易對 (Symbol)</label>
                          <select value={newBotConfig.pair} onChange={(e) => setNewBotConfig({...newBotConfig, pair: e.target.value})} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-sm text-zinc-200 outline-none focus:border-primary transition-colors">
                              <option value="BTC/USDT">BTC/USDT</option>
                              <option value="ETH/USDT">ETH/USDT</option>
                              <option value="SOL/USDT">SOL/USDT</option>
                          </select>
                      </div>
                      <div>
                          <label className="text-xs uppercase text-zinc-500 font-bold mb-2 block tracking-wider">初始資金</label>
                          <input type="number" value={newBotConfig.initial_balance} onChange={(e) => setNewBotConfig({...newBotConfig, initial_balance: Number(e.target.value)})} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-sm text-zinc-200 outline-none focus:border-primary transition-colors" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                           <div>
                              <label className="text-xs uppercase text-zinc-500 font-bold mb-2 block tracking-wider">槓桿 (Leverage)</label>
                              <select value={newBotConfig.leverage} onChange={(e) => setNewBotConfig({...newBotConfig, leverage: Number(e.target.value)})} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-sm text-zinc-200 outline-none focus:border-primary transition-colors">
                                  <option value="1">1x</option>
                                  <option value="5">5x</option>
                                  <option value="10">10x</option>
                                  <option value="20">20x</option>
                              </select>
                           </div>
                           <div>
                              <label className="text-xs uppercase text-zinc-500 font-bold mb-2 block tracking-wider">保證金 (Margin)</label>
                              <select value={newBotConfig.marginType} onChange={(e) => setNewBotConfig({...newBotConfig, marginType: e.target.value as any})} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-sm text-zinc-200 outline-none focus:border-primary transition-colors">
                                  <option value="ISOLATED">逐倉</option>
                                  <option value="CROSS">全倉</option>
                              </select>
                           </div>
                      </div>
                      <button type="submit" className="w-full bg-primary hover:bg-emerald-500 text-zinc-950 font-black py-3.5 rounded-lg transition-all text-sm mt-3 shadow-lg shadow-emerald-900/20 transform active:scale-[0.98]">確認部署</button>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};

export default BotListWidget;
