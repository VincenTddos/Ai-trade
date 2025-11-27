import React, { useMemo } from 'react';
import { TradeRecord } from '../services/tradingEngine';

interface Props {
  trades: TradeRecord[];
  totalRealizedPnL: number;
  unrealizedPnL: number;
}

const TradeLogWidget: React.FC<Props> = ({ trades, totalRealizedPnL, unrealizedPnL }) => {
  return (
    <div className="bg-surface border border-zinc-800 rounded-xl p-4 h-full flex flex-col shadow-lg shadow-black/20">
       {/* Header with Stats */}
       <div className="flex justify-between items-center mb-3">
         <h3 className="text-xs font-bold text-zinc-100 flex items-center gap-2">
           <span className="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
           交易紀錄
         </h3>
         <div className="flex items-center gap-3">
           <div className="flex items-center gap-1.5 text-[10px]">
             <span className="text-zinc-500">已實現:</span>
             <span className={`font-mono font-bold ${totalRealizedPnL >= 0 ? 'text-primary' : 'text-danger'}`}>
               {totalRealizedPnL >= 0 ? '+' : ''}{totalRealizedPnL.toFixed(2)}
             </span>
           </div>
           <div className="flex items-center gap-1.5 text-[10px] border-l border-zinc-700 pl-3">
             <span className="text-zinc-500">未實現:</span>
             <span className={`font-mono font-bold ${unrealizedPnL >= 0 ? 'text-primary' : 'text-danger'}`}>
               {unrealizedPnL >= 0 ? '+' : ''}{unrealizedPnL.toFixed(2)}
             </span>
           </div>
         </div>
       </div>
       
       <div className="overflow-y-auto flex-1 custom-scrollbar pr-1">
          {trades.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-zinc-600 gap-2">
              <svg className="w-10 h-10 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-xs">尚無交易記錄</span>
              <span className="text-[10px] text-zinc-700">請在手動交易終端下單</span>
            </div>
          ) : (
            <table className="w-full text-left border-collapse table-fixed">
              <thead className="sticky top-0 bg-surface text-[9px] text-zinc-500 uppercase font-bold tracking-wider z-10">
                 <tr>
                   <th className="pb-2 pl-2 w-[18%]">時間</th>
                   <th className="pb-2 w-[16%]">標的</th>
                   <th className="pb-2 w-[14%]">類型</th>
                   <th className="pb-2 text-right w-[18%]">價格</th>
                   <th className="pb-2 text-right w-[16%]">數量</th>
                   <th className="pb-2 text-right pr-2 w-[18%]">損益</th>
                 </tr>
              </thead>
              <tbody className="text-[11px] font-mono">
                 {trades.map((trade, idx) => (
                   <tr key={trade.id} className={`border-b border-zinc-800/30 hover:bg-zinc-800/40 transition-colors group ${idx % 2 === 0 ? 'bg-zinc-900/20' : ''}`}>
                     <td className="py-2.5 pl-2 text-zinc-500 group-hover:text-zinc-400">
                       {new Date(trade.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' })}
                     </td>
                     <td className="py-2.5 text-zinc-300 font-medium">{trade.symbol.replace('/USDT', '').replace('USDT', '')}</td>
                     <td className="py-2.5">
                       <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                         trade.type === 'OPEN' 
                           ? (trade.side === 'BUY' ? 'bg-primary/10 text-primary' : 'bg-danger/10 text-danger')
                           : 'bg-zinc-700 text-zinc-300'
                       }`}>
                         {trade.type === 'OPEN' ? (trade.side === 'BUY' ? '開多' : '開空') : '平倉'}
                       </span>
                     </td>
                     <td className="py-2.5 text-right text-zinc-400">
                       {trade.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                     </td>
                     <td className="py-2.5 text-right text-zinc-500">
                       {trade.amount.toFixed(4)}
                     </td>
                     <td className={`py-2.5 text-right pr-2 font-bold ${
                       trade.type === 'CLOSE'
                         ? ((trade.realizedPnL || 0) >= 0 ? 'text-primary' : 'text-danger')
                         : 'text-zinc-600'
                     }`}>
                       {trade.type === 'CLOSE' 
                         ? `${(trade.realizedPnL || 0) >= 0 ? '+' : ''}${(trade.realizedPnL || 0).toFixed(2)}`
                         : '-'
                       }
                     </td>
                   </tr>
                 ))}
              </tbody>
            </table>
          )}
       </div>
    </div>
  );
};

export default TradeLogWidget;