
import React from 'react';
import { PerformanceMetrics } from '../types';

interface Props {
  metrics: PerformanceMetrics;
}

const PerformanceWidget: React.FC<Props> = ({ metrics }) => {
  return (
    <div className="bg-surface border border-zinc-800 rounded-xl p-4 shadow-lg shadow-black/20">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-xs font-bold text-zinc-200 flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse"></span>
          實盤績效監控
        </h3>
      </div>

      <div className="space-y-3">
        
        {/* Floating PnL (Unrealized) - Compact */}
        <div className="bg-gradient-to-r from-zinc-900 to-zinc-900/50 border border-zinc-800 rounded-lg p-3 relative overflow-hidden">
            <div className="flex justify-between items-center">
                <span className="text-[10px] text-zinc-500 uppercase flex items-center gap-1.5">
                    即時浮盈
                    <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse"></span>
                </span>
                <div className={`text-xl font-mono font-bold ${metrics.unrealizedPnL >= 0 ? 'text-primary' : 'text-danger'}`}>
                    {metrics.unrealizedPnL >= 0 ? '+' : ''}{metrics.unrealizedPnL.toFixed(2)}
                    <span className="text-xs font-normal text-zinc-500 ml-1">USDT</span>
                </div>
            </div>
        </div>

        {/* Realized & Total - Inline */}
        <div className="grid grid-cols-2 gap-2">
             <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-2.5 flex justify-between items-center">
                <span className="text-[10px] text-zinc-500 uppercase">已實現</span>
                <span className={`font-mono font-bold text-sm ${metrics.realizedPnL >= 0 ? 'text-zinc-200' : 'text-danger'}`}>
                    {metrics.realizedPnL >= 0 ? '+' : ''}{metrics.realizedPnL.toFixed(0)}
                </span>
             </div>
             <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-2.5 flex justify-between items-center">
                <span className="text-[10px] text-zinc-500 uppercase">總淨利</span>
                <span className={`font-mono font-bold text-sm ${metrics.totalPnL >= 0 ? 'text-emerald-400' : 'text-danger'}`}>
                    {metrics.totalPnL >= 0 ? '+' : ''}{metrics.totalPnL.toFixed(0)}
                </span>
             </div>
        </div>

        {/* Win Rate - Compact Bar */}
        <div className="flex items-center gap-3">
            <span className="text-[10px] text-zinc-500 uppercase w-12">勝率</span>
            <div className="flex-1 bg-zinc-800 rounded-full h-2 overflow-hidden">
                <div className="bg-gradient-to-r from-primary to-emerald-400 h-full rounded-full transition-all duration-500" style={{ width: `${metrics.winRate}%` }}></div>
            </div>
            <span className="text-xs font-bold text-primary font-mono w-12 text-right">{metrics.winRate.toFixed(1)}%</span>
        </div>

        {/* Footer Stats - Compact */}
        <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-2 border-t border-zinc-800">
           <span>活躍: <span className="text-zinc-300 font-mono">{metrics.activeTradeCount}</span></span>
           <span>均持: <span className="text-zinc-300 font-mono">{metrics.avgDuration}</span></span>
        </div>
      </div>
    </div>
  );
};

export default PerformanceWidget;
