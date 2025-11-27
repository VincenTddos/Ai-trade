
import React, { useState } from 'react';

const RiskConfigWidget: React.FC = () => {
  const [locked, setLocked] = useState(true);

  return (
    <div className="bg-surface border border-zinc-800 rounded-xl p-4 shadow-lg shadow-black/20">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-xs font-bold text-zinc-200 flex items-center gap-2">
           <svg className="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
           風險管理控制
        </h3>
        <button 
          onClick={() => setLocked(!locked)}
          className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${locked ? 'border-zinc-700 text-zinc-500 hover:text-zinc-300' : 'border-danger text-danger bg-danger/10'}`}
        >
          {locked ? '🔒 鎖定' : '🔓 編輯'}
        </button>
      </div>

      <div className="space-y-2">
        {/* Compact Input Row */}
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-[9px] text-zinc-500 font-bold uppercase block mb-1">最大虧損</label>
            <div className="relative">
              <input 
                type="number" 
                value="2.0" 
                disabled={locked}
                className="w-full bg-zinc-900 border border-zinc-700 rounded py-1.5 pl-2 pr-6 text-xs text-zinc-200 focus:border-primary outline-none disabled:opacity-50 font-mono"
              />
              <span className="absolute right-2 top-1.5 text-[10px] text-zinc-500">%</span>
            </div>
          </div>
          <div className="flex-1">
             <label className="text-[9px] text-zinc-500 font-bold uppercase block mb-1">止損線</label>
             <div className="relative">
              <input 
                type="number" 
                value="3.0" 
                disabled={locked}
                className="w-full bg-zinc-900 border border-zinc-700 rounded py-1.5 pl-2 pr-6 text-xs text-zinc-200 focus:border-primary outline-none disabled:opacity-50 font-mono"
              />
              <span className="absolute right-2 top-1.5 text-[10px] text-zinc-500">%</span>
            </div>
          </div>
        </div>

        {/* Circuit Breaker - More Compact */}
        <div className="flex items-center gap-2 bg-zinc-900/50 p-2 rounded-lg border border-zinc-800/50">
             <div className={`w-2 h-2 rounded-full shrink-0 ${locked ? 'bg-primary' : 'bg-zinc-600'}`}></div>
             <span className="text-[10px] text-zinc-400">熔斷保護: 日虧 &gt;5% 自動停機</span>
        </div>
      </div>
    </div>
  );
};

export default RiskConfigWidget;
