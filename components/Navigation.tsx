
import React from 'react';

export type PageType = 'dashboard' | 'trading' | 'bots' | 'history';

interface NavigationProps {
  currentPage: PageType;
  onNavigate: (page: PageType) => void;
  currentPrice: number;
}

const Navigation: React.FC<NavigationProps> = ({ currentPage, onNavigate, currentPrice }) => {
  return (
    <header className="border-b border-zinc-800 bg-surface/80 backdrop-blur-xl sticky top-0 z-50 shadow-md">
      <div className="max-w-[1920px] mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo & Title */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => onNavigate('dashboard')}>
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-emerald-800 rounded-lg flex items-center justify-center font-black text-xl text-white shadow-lg shadow-emerald-500/20">
              B
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-zinc-100 leading-none">
                BlockAI <span className="text-primary font-medium">Trade Pro</span>
              </h1>
              <span className="text-[10px] text-zinc-500 tracking-widest uppercase mt-0.5 block">Autonomous Trading Terminal</span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 ml-8 bg-zinc-900/50 p-1 rounded-lg border border-zinc-800/50">
            <button
              onClick={() => onNavigate('dashboard')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                currentPage === 'dashboard'
                  ? 'bg-zinc-700 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              儀表板
            </button>
            <button
              onClick={() => onNavigate('trading')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                currentPage === 'trading'
                  ? 'bg-accent text-white shadow-sm shadow-accent/30'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              手動交易
            </button>
            <button
              onClick={() => onNavigate('bots')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                currentPage === 'bots'
                  ? 'bg-purple-500 text-white shadow-sm shadow-purple-500/30'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              自動機器人
            </button>
            <button
              onClick={() => onNavigate('history')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                currentPage === 'history'
                  ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/30'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              歷史數據
            </button>
          </nav>
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 text-xs font-mono text-zinc-300 bg-zinc-900/50 px-4 py-2 rounded-full border border-zinc-800/50">
            <span className={`w-2 h-2 rounded-full ${currentPrice > 0 ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)] animate-pulse' : 'bg-yellow-500'}`}></span>
            Binance Feed:
            <span className={`font-bold text-sm ${currentPrice > 0 ? 'text-white' : 'text-zinc-500'}`}>
              {currentPrice > 0 ? `$${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : 'Connecting...'}
            </span>
          </div>
          <div className="h-9 w-9 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center cursor-pointer hover:bg-zinc-700 transition-colors ring-2 ring-transparent hover:ring-zinc-700">
            <span className="text-xs font-bold text-zinc-400">JD</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navigation;
