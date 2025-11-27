import React, { useState } from 'react';

const CoreEngineWidget: React.FC = () => {
  const [engineRunning, setEngineRunning] = useState(true);
  const [engineMsg, setEngineMsg] = useState<string | null>(null);

  const toggleEngine = () => {
    const newState = !engineRunning;
    setEngineRunning(newState);
    setEngineMsg(newState ? "交易引擎已啟動" : "交易引擎已停止");
    setTimeout(() => setEngineMsg(null), 3000);
  };

  return (
    <div className="bg-surface border border-zinc-800 rounded-xl p-4 flex flex-col relative overflow-hidden shadow-lg shadow-black/20">
      {/* Toast */}
      {engineMsg && (
          <div className="absolute top-2 right-2 z-50 bg-zinc-800 border border-zinc-700 text-zinc-200 px-2.5 py-1 rounded shadow-lg text-[10px] flex items-center gap-1.5 animate-in fade-in slide-in-from-top-2">
              <span className={`w-1.5 h-1.5 rounded-full ${engineRunning ? 'bg-primary' : 'bg-danger'}`}></span>
              {engineMsg}
          </div>
      )}

      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <h3 className="text-xs font-bold text-zinc-200">核心交易引擎</h3>
        </div>
        
        <button 
            onClick={toggleEngine}
            className={`w-10 h-6 rounded-full p-0.5 transition-colors duration-300 focus:outline-none ${engineRunning ? 'bg-primary' : 'bg-zinc-700'}`}
        >
            <div className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform duration-300 ${engineRunning ? 'translate-x-4' : 'translate-x-0'}`}></div>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
         <div className={`flex items-center justify-between p-2.5 rounded-lg border transition-colors duration-300 ${engineRunning ? 'bg-primary/5 border-primary/20' : 'bg-zinc-800/50 border-zinc-700'}`}>
            <span className="text-[10px] text-zinc-500 uppercase font-bold">狀態</span>
            <span className={`text-xs font-mono font-bold flex items-center gap-1 ${engineRunning ? 'text-primary' : 'text-zinc-400'}`}>
               <span className={`w-1.5 h-1.5 rounded-full ${engineRunning ? 'bg-primary animate-pulse' : 'bg-zinc-500'}`}></span>
               {engineRunning ? 'Online' : 'Offline'}
            </span>
         </div>
         <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-800/50 border border-zinc-700">
            <span className="text-[10px] text-zinc-500 uppercase font-bold">延遲</span>
            <span className="text-xs font-mono font-bold text-zinc-300">24<span className="text-[10px] text-zinc-500">ms</span></span>
         </div>
      </div>
      
      <div className="mt-3 flex items-center justify-between text-[10px] text-zinc-600 border-t border-zinc-800 pt-2 font-mono">
         <span>Uptime: <span className="text-zinc-400">14d 02h</span></span>
         <span>API: <span className="text-emerald-500">100%</span></span>
      </div>
      
      {/* Decorative Progress Bar */}
      <div className="h-0.5 bg-zinc-800 w-full mt-3 rounded-full overflow-hidden">
        {engineRunning && <div className="h-full bg-gradient-to-r from-primary to-accent animate-pulse w-full"></div>}
      </div>
    </div>
  );
};

export default CoreEngineWidget;