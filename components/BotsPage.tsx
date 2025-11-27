
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { botEngine, BotConfig, StrategyType, BotPosition, StrategySignal } from '../services/botEngine';
import { TradeRecord } from '../services/tradingEngine';
import { BacktestEngine, BacktestConfig, BacktestResult, DEFAULT_BACKTEST_CONFIG } from '../services/backtestEngine';
import { MLOptimizer, OptimizationConfig, OptimizationResult, STRATEGY_PARAMETER_SPACES, DEFAULT_OPTIMIZATION_CONFIG } from '../services/mlOptimizer';
import { MarketData } from '../types';
import { serverLog } from '../services/serverLog';

interface BotsPageProps {
  currentPrice: number;
  marketData: MarketData[];
}

type TabType = 'bots' | 'backtest' | 'optimize';

const STRATEGY_NAMES: Record<StrategyType, string> = {
  'BOLLINGER_BREAKOUT': '布林通道突破',
  'MACD_TREND': 'MACD 趨勢跟蹤',
  'RSI_REVERSAL': 'RSI 反轉策略',
  'GRID_TRADING': '網格交易',
  'MA_CROSSOVER': '均線交叉'
};

const STRATEGY_DESCRIPTIONS: Record<StrategyType, string> = {
  'BOLLINGER_BREAKOUT': '當價格突破布林通道上軌時做多，跌破下軌時做空',
  'MACD_TREND': '利用 MACD 金叉做多，死叉做空',
  'RSI_REVERSAL': 'RSI 超賣時做多，超買時做空',
  'GRID_TRADING': '在價格區間內設置網格自動買賣',
  'MA_CROSSOVER': '短期均線上穿長期均線做多，下穿做空'
};

const BotsPage: React.FC<BotsPageProps> = ({ currentPrice, marketData }) => {
  const [activeTab, setActiveTab] = useState<TabType>('bots');
  const [bots, setBots] = useState<BotConfig[]>([]);
  const [positions, setPositions] = useState<BotPosition[]>([]);
  const [selectedBot, setSelectedBot] = useState<BotConfig | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [stats, setStats] = useState(botEngine.getStats());
  const [signals, setSignals] = useState<Map<string, StrategySignal>>(new Map());

  // 回測狀態
  const [backtestConfig, setBacktestConfig] = useState<BacktestConfig>(DEFAULT_BACKTEST_CONFIG);
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [isBacktesting, setIsBacktesting] = useState(false);

  // 優化狀態
  const [optimizeStrategy, setOptimizeStrategy] = useState<StrategyType>('MACD_TREND');
  const [optimizeAlgorithm, setOptimizeAlgorithm] = useState<'genetic' | 'grid' | 'bayesian' | 'random'>('genetic');
  const [optimizeIterations, setOptimizeIterations] = useState(50);
  const [optimizeResult, setOptimizeResult] = useState<OptimizationResult | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizeProgress, setOptimizeProgress] = useState(0);

  // 新增機器人表單
  const [newBot, setNewBot] = useState({
    name: '',
    symbol: 'BTC/USDT',
    strategy: 'MACD_TREND' as StrategyType,
    allocatedBalance: 1000,
    maxPositionSize: 500,
    leverage: 10,
    marginType: 'ISOLATED' as 'CROSS' | 'ISOLATED',
    stopLossPercent: 5,
    takeProfitPercent: 10
  });

  // 即時更新持倉浮動盈虧
  const lastPriceRef = useRef(currentPrice);
  useEffect(() => {
    lastPriceRef.current = currentPrice;
  }, [currentPrice]);

  // 訂閱引擎更新
  const updateState = useCallback(() => {
    setBots(botEngine.getBots());
    const allPositions = botEngine.getAllPositions();
    // 即時更新未實現損益
    allPositions.forEach(pos => {
      const priceDiff = pos.side === 'LONG' 
        ? lastPriceRef.current - pos.entryPrice 
        : pos.entryPrice - lastPriceRef.current;
      pos.unrealizedPnL = priceDiff * pos.size;
    });
    setPositions([...allPositions]);
    setStats(botEngine.getStats());
    
    // 更新信號
    const newSignals = new Map<string, StrategySignal>();
    botEngine.getBots().forEach(bot => {
      const signal = botEngine.getLastSignal(bot.id);
      if (signal) newSignals.set(bot.id, signal);
    });
    setSignals(newSignals);
  }, []);

  // 每 500ms 強制更新持倉浮動盈虧
  useEffect(() => {
    const interval = setInterval(() => {
      const allPositions = botEngine.getAllPositions();
      allPositions.forEach(pos => {
        const priceDiff = pos.side === 'LONG' 
          ? currentPrice - pos.entryPrice 
          : pos.entryPrice - currentPrice;
        pos.unrealizedPnL = priceDiff * pos.size;
      });
      setPositions([...allPositions]);
    }, 500);
    return () => clearInterval(interval);
  }, [currentPrice]);

  useEffect(() => {
    updateState();
    const unsubscribe = botEngine.subscribe(updateState);
    return unsubscribe;
  }, [updateState]);

  const handleCreateBot = (e: React.FormEvent) => {
    e.preventDefault();
    
    const strategyParams: Record<string, number> = {
      signalThreshold: 50
    };
    
    if (newBot.strategy === 'RSI_REVERSAL') {
      strategyParams.oversold = 30;
      strategyParams.overbought = 70;
      strategyParams.period = 14;
    }
    
    botEngine.createBot({
      name: newBot.name || `${STRATEGY_NAMES[newBot.strategy]} Bot`,
      symbol: newBot.symbol,
      strategy: newBot.strategy,
      status: 'STOPPED',
      initialBalance: newBot.allocatedBalance,
      allocatedBalance: newBot.allocatedBalance,
      maxPositionSize: newBot.maxPositionSize,
      leverage: newBot.leverage,
      marginType: newBot.marginType,
      stopLossPercent: newBot.stopLossPercent,
      takeProfitPercent: newBot.takeProfitPercent,
      maxDailyLoss: newBot.allocatedBalance * 0.1,
      // Freqtrade 進階功能 (預設關閉)
      trailingStop: false,
      trailingStopPercent: 2,
      trailingStopTrigger: 3,
      minimalROI: { 60: 5, 30: 3, 0: 10 },
      dcaEnabled: false,
      dcaMaxOrders: 3,
      dcaOrderSpacing: 2,
      dcaMultiplier: 1.5,
      strategyParams
    });
    
    setIsCreateModalOpen(false);
    setNewBot({
      name: '',
      symbol: 'BTC/USDT',
      strategy: 'MACD_TREND',
      allocatedBalance: 1000,
      maxPositionSize: 500,
      leverage: 10,
      marginType: 'ISOLATED',
      stopLossPercent: 5,
      takeProfitPercent: 10
    });
  };

  const handleToggleBot = (bot: BotConfig) => {
    if (bot.status === 'RUNNING') {
      botEngine.stopBot(bot.id);
    } else {
      botEngine.startBot(bot.id);
    }
  };

  const handleDeleteBot = (bot: BotConfig) => {
    if (confirm(`確定要刪除機器人 "${bot.name}" 嗎？此操作無法撤銷。`)) {
      botEngine.deleteBot(bot.id);
      if (selectedBot?.id === bot.id) setSelectedBot(null);
    }
  };

  // 手動平倉單個持倉
  const handleClosePosition = (botId: string, positionId: string) => {
    if (confirm('確定要平倉此持倉嗎？')) {
      botEngine.manualClosePosition(botId, positionId, currentPrice);
      serverLog.log('SUCCESS', 'TRADE', '✅ 手動平倉', `持倉 ${positionId} 已平倉`);
    }
  };

  // 手動平倉機器人所有持倉
  const handleCloseAllPositions = (botId: string) => {
    const botPositions = positions.filter(p => p.botId === botId);
    if (botPositions.length === 0) {
      alert('此機器人沒有持倉');
      return;
    }
    if (confirm(`確定要平倉此機器人的所有 ${botPositions.length} 個持倉嗎？`)) {
      botPositions.forEach(pos => {
        botEngine.manualClosePosition(botId, pos.positionId, currentPrice);
      });
      serverLog.log('SUCCESS', 'TRADE', '✅ 批量平倉', `機器人 ${botId} 的 ${botPositions.length} 個持倉已全部平倉`);
    }
  };

  // 平倉所有機器人的所有持倉
  const handleCloseAllBotsPositions = () => {
    if (positions.length === 0) {
      alert('沒有任何持倉');
      return;
    }
    if (confirm(`確定要平倉所有機器人的 ${positions.length} 個持倉嗎？`)) {
      positions.forEach(pos => {
        botEngine.manualClosePosition(pos.botId, pos.positionId, currentPrice);
      });
      serverLog.log('SUCCESS', 'TRADE', '✅ 全部平倉', `所有 ${positions.length} 個持倉已全部平倉`);
    }
  };

  // 執行回測
  const handleRunBacktest = async () => {
    if (marketData.length < 50) {
      alert('市場數據不足，需要至少 50 根 K 線');
      return;
    }

    setIsBacktesting(true);
    setBacktestResult(null);

    try {
      const engine = new BacktestEngine(backtestConfig);
      const result = engine.run(marketData);
      setBacktestResult(result);
    } catch (error) {
      console.error('Backtest error:', error);
      alert('回測執行失敗');
    } finally {
      setIsBacktesting(false);
    }
  };

  // 執行優化
  const handleRunOptimize = async () => {
    if (marketData.length < 100) {
      alert('市場數據不足，需要至少 100 根 K 線');
      return;
    }

    setIsOptimizing(true);
    setOptimizeResult(null);
    setOptimizeProgress(0);

    try {
      const config: OptimizationConfig = {
        strategy: optimizeStrategy,
        parameterSpaces: STRATEGY_PARAMETER_SPACES[optimizeStrategy],
        baseConfig: { ...DEFAULT_BACKTEST_CONFIG },
        objective: 'sharpe',
        algorithm: optimizeAlgorithm,
        maxIterations: optimizeIterations,
        populationSize: 30,
        eliteRatio: 0.1,
        mutationRate: 0.15,
        crossoverRate: 0.7,
        walkForward: true,
        trainRatio: 0.7,
        windowSize: Math.floor(marketData.length / 3),
        minTrades: 5,
        maxDrawdownLimit: 30
      };

      const optimizer = new MLOptimizer(config);
      
      // 模擬進度
      const progressInterval = setInterval(() => {
        setOptimizeProgress(prev => Math.min(prev + 2, 95));
      }, 100);

      const result = await optimizer.optimize(marketData);
      
      clearInterval(progressInterval);
      setOptimizeProgress(100);
      setOptimizeResult(result);
    } catch (error) {
      console.error('Optimization error:', error);
      alert('優化執行失敗');
    } finally {
      setIsOptimizing(false);
    }
  };

  // 將優化結果應用到新機器人
  const handleApplyOptimizedParams = () => {
    if (!optimizeResult) return;
    
    setNewBot({
      ...newBot,
      strategy: optimizeStrategy
    });
    setActiveTab('bots');
    setIsCreateModalOpen(true);
  };

  const getWinRate = (bot: BotConfig) => {
    if (bot.totalTrades === 0) return 0;
    return (bot.winTrades / bot.totalTrades) * 100;
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 p-6 lg:p-8">
      <div className="max-w-[1920px] mx-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-zinc-100 flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-xl">
                <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              自動交易系統
            </h2>
            <p className="text-zinc-500 mt-1 text-sm">24小時策略執行 • 回測驗證 • ML優化</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('bots')}
            className={`px-5 py-2.5 rounded-lg font-medium transition-all ${
              activeTab === 'bots'
                ? 'bg-purple-500 text-white shadow-lg shadow-purple-900/30'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            機器人管理
          </button>
          <button
            onClick={() => setActiveTab('backtest')}
            className={`px-5 py-2.5 rounded-lg font-medium transition-all ${
              activeTab === 'backtest'
                ? 'bg-blue-500 text-white shadow-lg shadow-blue-900/30'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            策略回測
          </button>
          <button
            onClick={() => setActiveTab('optimize')}
            className={`px-5 py-2.5 rounded-lg font-medium transition-all ${
              activeTab === 'optimize'
                ? 'bg-green-500 text-white shadow-lg shadow-green-900/30'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            ML 優化
          </button>
        </div>

        {/* ========== BOTS TAB ========== */}
        {activeTab === 'bots' && (
          <>
            {/* 部署按鈕 + 全部平倉 */}
            <div className="flex justify-between items-center mb-4">
              <div className="flex gap-2">
                {positions.length > 0 && (
                  <button
                    onClick={handleCloseAllBotsPositions}
                    className="bg-danger hover:bg-red-500 text-white font-bold py-3 px-6 rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-red-900/30"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    全部平倉 ({positions.length})
                  </button>
                )}
              </div>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="bg-purple-500 hover:bg-purple-400 text-white font-bold py-3 px-6 rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-purple-900/30"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                部署新機器人
              </button>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
              <div className="bg-surface border border-zinc-800 rounded-xl p-4">
                <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">運行中</div>
                <div className="text-2xl font-bold text-purple-400">{stats.runningBots}</div>
              </div>
              <div className="bg-surface border border-zinc-800 rounded-xl p-4">
                <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">總機器人</div>
                <div className="text-2xl font-bold text-zinc-100">{stats.totalBots}</div>
              </div>
              <div className="bg-surface border border-zinc-800 rounded-xl p-4">
                <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">活躍持倉</div>
                <div className="text-2xl font-bold text-accent">{stats.activePositions}</div>
              </div>
              <div className="bg-surface border border-zinc-800 rounded-xl p-4">
                <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">總交易</div>
                <div className="text-2xl font-bold text-zinc-100">{stats.totalTrades}</div>
              </div>
              <div className="bg-surface border border-zinc-800 rounded-xl p-4">
                <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">總損益</div>
                <div className={`text-2xl font-bold ${stats.totalPnL >= 0 ? 'text-primary' : 'text-danger'}`}>
                  {stats.totalPnL >= 0 ? '+' : ''}{stats.totalPnL.toFixed(2)}
                </div>
              </div>
              <div className="bg-surface border border-zinc-800 rounded-xl p-4">
                <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">勝率</div>
                <div className="text-2xl font-bold text-zinc-100">{stats.winRate.toFixed(1)}%</div>
              </div>
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              
              {/* Bot List */}
              <div className="xl:col-span-2">
                <div className="bg-surface border border-zinc-800 rounded-xl overflow-hidden">
                  <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                    <h3 className="font-bold text-zinc-100">機器人列表</h3>
                    <span className="text-xs text-zinc-500">{bots.length} 個機器人</span>
                  </div>
                  
                  <div className="divide-y divide-zinc-800">
                    {bots.length === 0 ? (
                      <div className="p-12 text-center text-zinc-600">
                        <svg className="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <p className="text-sm mb-2">尚未部署任何機器人</p>
                        <p className="text-xs text-zinc-700">點擊上方「部署新機器人」開始自動交易</p>
                      </div>
                    ) : (
                      bots.map(bot => {
                        const signal = signals.get(bot.id);
                        const botPositions = positions.filter(p => p.botId === bot.id);
                        const winRate = getWinRate(bot);
                        
                        return (
                          <div 
                            key={bot.id} 
                            className={`p-4 hover:bg-zinc-800/30 transition-colors cursor-pointer ${selectedBot?.id === bot.id ? 'bg-zinc-800/50' : ''}`}
                            onClick={() => setSelectedBot(bot)}
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div className={`w-3 h-3 rounded-full ${bot.status === 'RUNNING' ? 'bg-primary animate-pulse' : 'bg-zinc-600'}`}></div>
                                <div>
                                  <div className="font-bold text-zinc-100">{bot.name}</div>
                                  <div className="text-xs text-zinc-500">{bot.symbol} • {STRATEGY_NAMES[bot.strategy]}</div>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleToggleBot(bot); }}
                                  className={`p-2 rounded-lg transition-all ${
                                    bot.status === 'RUNNING'
                                      ? 'bg-danger/20 text-danger hover:bg-danger/30'
                                  : 'bg-primary/20 text-primary hover:bg-primary/30'
                              }`}
                            >
                              {bot.status === 'RUNNING' ? (
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                              ) : (
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                              )}
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteBot(bot); }}
                              className="p-2 rounded-lg bg-zinc-800 text-zinc-500 hover:text-danger hover:bg-zinc-700 transition-all"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-5 gap-3 text-xs">
                          <div className="bg-zinc-900/50 rounded-lg p-2">
                            <div className="text-zinc-500 mb-1">已實現</div>
                            <div className={`font-mono font-bold ${bot.totalPnL >= 0 ? 'text-primary' : 'text-danger'}`}>
                              {bot.totalPnL >= 0 ? '+' : ''}{bot.totalPnL.toFixed(2)}
                            </div>
                          </div>
                          <div className="bg-zinc-900/50 rounded-lg p-2">
                            <div className="text-zinc-500 mb-1 flex items-center gap-1">
                              浮動
                              {botPositions.length > 0 && <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse"></span>}
                            </div>
                            <div className={`font-mono font-bold ${
                              botPositions.reduce((sum, p) => sum + p.unrealizedPnL, 0) >= 0 ? 'text-primary' : 'text-danger'
                            }`}>
                              {botPositions.reduce((sum, p) => sum + p.unrealizedPnL, 0) >= 0 ? '+' : ''}
                              {botPositions.reduce((sum, p) => sum + p.unrealizedPnL, 0).toFixed(2)}
                            </div>
                          </div>
                          <div className="bg-zinc-900/50 rounded-lg p-2">
                            <div className="text-zinc-500 mb-1">勝率</div>
                            <div className="font-mono font-bold text-zinc-200">{winRate.toFixed(1)}%</div>
                          </div>
                          <div className="bg-zinc-900/50 rounded-lg p-2">
                            <div className="text-zinc-500 mb-1">交易</div>
                            <div className="font-mono font-bold text-zinc-200">{bot.totalTrades}</div>
                          </div>
                          <div className="bg-zinc-900/50 rounded-lg p-2">
                            <div className="text-zinc-500 mb-1">持倉</div>
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold text-accent">{botPositions.length}</span>
                              {botPositions.length > 0 && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleCloseAllPositions(bot.id); }}
                                  className="text-[10px] px-1.5 py-0.5 bg-danger/20 text-danger rounded hover:bg-danger/30 transition-all"
                                  title="平倉全部"
                                >
                                  平倉
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Signal Display + Position Status */}
                        {bot.status === 'RUNNING' && (
                          <div className="mt-3 flex flex-col gap-2">
                            {/* 當前持倉狀態 */}
                            {botPositions.length > 0 && (
                              <div className="p-2 rounded-lg text-xs flex items-center gap-2 bg-accent/10 text-accent border border-accent/30">
                                <span className="font-bold">🔒 持倉中</span>
                                <span className="text-zinc-400">•</span>
                                <span>{botPositions[0].side} @ ${botPositions[0].entryPrice.toFixed(2)}</span>
                                <span className="text-zinc-400">•</span>
                                <span className={botPositions[0].unrealizedPnL >= 0 ? 'text-primary' : 'text-danger'}>
                                  浮盈: {botPositions[0].unrealizedPnL >= 0 ? '+' : ''}{botPositions[0].unrealizedPnL.toFixed(2)}
                                </span>
                              </div>
                            )}
                            {/* 策略信號 */}
                            {signal && (
                              <div className={`p-2 rounded-lg text-xs flex items-center gap-2 ${
                                signal.action === 'BUY' ? 'bg-primary/10 text-primary' :
                                signal.action === 'SELL' ? 'bg-danger/10 text-danger' :
                                'bg-zinc-800 text-zinc-500'
                              }`}>
                                <span className="font-bold">
                                  {signal.action === 'HOLD' ? '📊 觀望' : signal.action === 'BUY' ? '🟢 做多' : '🔴 做空'}
                                </span>
                                <span className="text-zinc-400">•</span>
                                <span>{signal.reason}</span>
                                {signal.action !== 'HOLD' && (
                                  <>
                                    <span className="text-zinc-400">•</span>
                                    <span>強度: {signal.strength.toFixed(0)}%</span>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Bot Details Panel */}
          <div className="xl:col-span-1">
            <div className="bg-surface border border-zinc-800 rounded-xl overflow-hidden sticky top-6">
              {selectedBot ? (
                <>
                  <div className="p-4 border-b border-zinc-800 bg-zinc-800/30">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-zinc-100">{selectedBot.name}</h3>
                      <span className={`text-xs px-2 py-1 rounded ${
                        selectedBot.status === 'RUNNING' ? 'bg-primary/20 text-primary' : 'bg-zinc-700 text-zinc-400'
                      }`}>
                        {selectedBot.status === 'RUNNING' ? '運行中' : '已停止'}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">{selectedBot.symbol}</p>
                  </div>
                  
                  <div className="p-4 space-y-4">
                    {/* Strategy Info */}
                    <div>
                      <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">策略</div>
                      <div className="bg-zinc-900 rounded-lg p-3">
                        <div className="font-bold text-purple-400 mb-1">{STRATEGY_NAMES[selectedBot.strategy]}</div>
                        <p className="text-xs text-zinc-500">{STRATEGY_DESCRIPTIONS[selectedBot.strategy]}</p>
                      </div>
                    </div>
                    
                    {/* Risk Settings */}
                    <div>
                      <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">風險設定</div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-zinc-900 rounded-lg p-2">
                          <div className="text-zinc-500">槓桿</div>
                          <div className="font-mono font-bold text-zinc-200">{selectedBot.leverage}x</div>
                        </div>
                        <div className="bg-zinc-900 rounded-lg p-2">
                          <div className="text-zinc-500">保證金</div>
                          <div className="font-mono font-bold text-zinc-200">{selectedBot.marginType}</div>
                        </div>
                        <div className="bg-zinc-900 rounded-lg p-2">
                          <div className="text-zinc-500">止損</div>
                          <div className="font-mono font-bold text-danger">-{selectedBot.stopLossPercent}%</div>
                        </div>
                        <div className="bg-zinc-900 rounded-lg p-2">
                          <div className="text-zinc-500">止盈</div>
                          <div className="font-mono font-bold text-primary">+{selectedBot.takeProfitPercent}%</div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Allocated Funds */}
                    <div>
                      <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">資金配置</div>
                      <div className="bg-zinc-900 rounded-lg p-3">
                        <div className="flex justify-between mb-2">
                          <span className="text-zinc-400">配置資金</span>
                          <span className="font-mono">${selectedBot.allocatedBalance.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-400">最大單筆</span>
                          <span className="font-mono">${selectedBot.maxPositionSize.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Current Positions */}
                    <div>
                      <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2 flex items-center justify-between">
                        <span>當前持倉</span>
                        {positions.filter(p => p.botId === selectedBot.id).length > 0 && (
                          <button
                            onClick={() => handleCloseAllPositions(selectedBot.id)}
                            className="text-[10px] px-2 py-1 bg-danger/20 text-danger rounded hover:bg-danger/30 transition-all"
                          >
                            全部平倉
                          </button>
                        )}
                      </div>
                      {positions.filter(p => p.botId === selectedBot.id).length === 0 ? (
                        <div className="text-center py-4 text-zinc-600 text-xs border border-dashed border-zinc-800 rounded-lg">
                          無持倉
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {positions.filter(p => p.botId === selectedBot.id).map(pos => (
                            <div key={pos.positionId} className="bg-zinc-900 rounded-lg p-3">
                              <div className="flex justify-between items-center mb-2">
                                <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                                  pos.side === 'LONG' ? 'bg-primary/20 text-primary' : 'bg-danger/20 text-danger'
                                }`}>
                                  {pos.side}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className={`font-mono text-sm font-bold ${
                                    pos.unrealizedPnL >= 0 ? 'text-primary' : 'text-danger'
                                  }`}>
                                    {pos.unrealizedPnL >= 0 ? '+' : ''}{pos.unrealizedPnL.toFixed(2)}
                                  </span>
                                  <button
                                    onClick={() => handleClosePosition(selectedBot.id, pos.positionId)}
                                    className="text-[10px] px-2 py-1 bg-danger/20 text-danger rounded hover:bg-danger/30 transition-all"
                                    title="平倉此持倉"
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs text-zinc-500">
                                <div>入場: ${pos.entryPrice.toFixed(2)}</div>
                                <div>現價: ${currentPrice.toFixed(2)}</div>
                                <div className="text-primary">TP: ${pos.takeProfit.toFixed(2)}</div>
                                <div className="text-danger">SL: ${pos.stopLoss.toFixed(2)}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {/* Trade History */}
                    <div>
                      <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">近期交易</div>
                      {botEngine.getBotTradeHistory(selectedBot.id).length === 0 ? (
                        <div className="text-center py-4 text-zinc-600 text-xs border border-dashed border-zinc-800 rounded-lg">
                          尚無交易記錄
                        </div>
                      ) : (
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {botEngine.getBotTradeHistory(selectedBot.id).slice(0, 10).map(trade => {
                            // 計算浮動盈虧 (僅對 OPEN 類型的交易)
                            const isOpen = trade.type === 'OPEN';
                            const activePos = isOpen ? positions.find(p => 
                              p.botId === selectedBot.id && 
                              Math.abs(p.entryPrice - trade.price) < 1 &&
                              ((trade.side === 'BUY' && p.side === 'LONG') || (trade.side === 'SELL' && p.side === 'SHORT'))
                            ) : null;
                            
                            return (
                              <div key={trade.id} className="flex items-center justify-between text-xs py-2 px-2 bg-zinc-900/50 rounded">
                                <div className="flex items-center gap-2">
                                  <span className={trade.side === 'BUY' ? 'text-primary' : 'text-danger'}>{trade.side}</span>
                                  <span className={`text-zinc-500 ${isOpen && activePos ? 'flex items-center gap-1' : ''}`}>
                                    {trade.type}
                                    {isOpen && activePos && <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse"></span>}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono">${trade.price.toFixed(2)}</span>
                                  {trade.type === 'CLOSE' && trade.realizedPnL !== undefined ? (
                                    <span className={`font-mono ${trade.realizedPnL >= 0 ? 'text-primary' : 'text-danger'}`}>
                                      {trade.realizedPnL >= 0 ? '+' : ''}{trade.realizedPnL.toFixed(2)}
                                    </span>
                                  ) : activePos ? (
                                    <span className={`font-mono ${activePos.unrealizedPnL >= 0 ? 'text-accent' : 'text-warning'}`}>
                                      {activePos.unrealizedPnL >= 0 ? '+' : ''}{activePos.unrealizedPnL.toFixed(2)}
                                      <span className="text-[10px] ml-0.5 opacity-60">浮</span>
                                    </span>
                                  ) : (
                                    <span className="font-mono text-zinc-600">-</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-8 text-center text-zinc-600">
                  <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm">選擇一個機器人查看詳情</p>
                </div>
              )}
            </div>
          </div>
            </div>
          </>
        )}

        {/* ========== BACKTEST TAB ========== */}
        {activeTab === 'backtest' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 配置面板 */}
            <div className="bg-surface border border-zinc-800 rounded-xl p-6">
              <h3 className="font-bold text-zinc-100 mb-4 flex items-center gap-2">⚙️ 回測配置</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-zinc-500 block mb-2">策略</label>
                  <select
                    value={backtestConfig.strategy}
                    onChange={(e) => setBacktestConfig({ ...backtestConfig, strategy: e.target.value as StrategyType })}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-sm"
                  >
                    {Object.entries(STRATEGY_NAMES).filter(([key]) => key !== 'GRID_TRADING').map(([key, name]) => (
                      <option key={key} value={key}>{name}</option>
                    ))}
                  </select>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-zinc-500 block mb-2">初始資金</label>
                    <input
                      type="number"
                      value={backtestConfig.initialBalance}
                      onChange={(e) => setBacktestConfig({ ...backtestConfig, initialBalance: Number(e.target.value) })}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 block mb-2">槓桿</label>
                    <select
                      value={backtestConfig.leverage}
                      onChange={(e) => setBacktestConfig({ ...backtestConfig, leverage: Number(e.target.value) })}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-sm"
                    >
                      {[1, 2, 5, 10, 20, 50].map(v => <option key={v} value={v}>{v}x</option>)}
                    </select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-zinc-500 block mb-2">止損 %</label>
                    <input
                      type="number"
                      value={backtestConfig.stopLossPercent}
                      onChange={(e) => setBacktestConfig({ ...backtestConfig, stopLossPercent: Number(e.target.value) })}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 block mb-2">止盈 %</label>
                    <input
                      type="number"
                      value={backtestConfig.takeProfitPercent}
                      onChange={(e) => setBacktestConfig({ ...backtestConfig, takeProfitPercent: Number(e.target.value) })}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-sm"
                    />
                  </div>
                </div>
                
                <div className="border-t border-zinc-800 pt-4 mt-4">
                  <h4 className="text-sm font-bold text-zinc-300 mb-3">📈 進階功能</h4>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={backtestConfig.trailingStop}
                        onChange={(e) => setBacktestConfig({ ...backtestConfig, trailingStop: e.target.checked })}
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-sm">移動止損 (Trailing Stop)</span>
                    </label>
                    
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={backtestConfig.dcaEnabled}
                        onChange={(e) => setBacktestConfig({ ...backtestConfig, dcaEnabled: e.target.checked })}
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-sm">DCA 加倉</span>
                    </label>
                  </div>
                </div>
                
                <button
                  onClick={handleRunBacktest}
                  disabled={isBacktesting || marketData.length < 50}
                  className={`w-full py-3 rounded-lg font-bold transition-all ${
                    isBacktesting 
                      ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                      : 'bg-blue-500 hover:bg-blue-400 text-white shadow-lg shadow-blue-900/30'
                  }`}
                >
                  {isBacktesting ? '⏳ 執行中...' : '🚀 開始回測'}
                </button>
                <p className="text-xs text-zinc-600 text-center">使用 {marketData.length} 根 K 線</p>
              </div>
            </div>

            {/* 結果面板 */}
            <div className="lg:col-span-2 space-y-6">
              {backtestResult ? (
                <>
                  <div className="bg-surface border border-zinc-800 rounded-xl p-6">
                    <h3 className="font-bold text-zinc-100 mb-4">📊 績效摘要</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-zinc-900 rounded-lg p-4 text-center">
                        <div className="text-xs text-zinc-500 mb-1">總收益</div>
                        <div className={`text-2xl font-bold ${backtestResult.totalPnL >= 0 ? 'text-primary' : 'text-danger'}`}>
                          {backtestResult.totalPnLPercent.toFixed(2)}%
                        </div>
                      </div>
                      <div className="bg-zinc-900 rounded-lg p-4 text-center">
                        <div className="text-xs text-zinc-500 mb-1">勝率</div>
                        <div className="text-2xl font-bold text-zinc-100">{backtestResult.winRate.toFixed(1)}%</div>
                      </div>
                      <div className="bg-zinc-900 rounded-lg p-4 text-center">
                        <div className="text-xs text-zinc-500 mb-1">最大回撤</div>
                        <div className="text-2xl font-bold text-danger">-{backtestResult.maxDrawdownPercent.toFixed(2)}%</div>
                      </div>
                      <div className="bg-zinc-900 rounded-lg p-4 text-center">
                        <div className="text-xs text-zinc-500 mb-1">Sharpe</div>
                        <div className="text-2xl font-bold text-accent">{backtestResult.sharpeRatio.toFixed(2)}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-3 mt-4 text-sm">
                      <div className="bg-zinc-900/50 rounded-lg p-2 text-center">
                        <div className="text-xs text-zinc-500">利潤因子</div>
                        <div className="font-bold">{backtestResult.profitFactor.toFixed(2)}</div>
                      </div>
                      <div className="bg-zinc-900/50 rounded-lg p-2 text-center">
                        <div className="text-xs text-zinc-500">交易次數</div>
                        <div className="font-bold">{backtestResult.totalTrades}</div>
                      </div>
                      <div className="bg-zinc-900/50 rounded-lg p-2 text-center">
                        <div className="text-xs text-zinc-500">平均盈利</div>
                        <div className="font-bold text-primary">${backtestResult.avgWin.toFixed(2)}</div>
                      </div>
                      <div className="bg-zinc-900/50 rounded-lg p-2 text-center">
                        <div className="text-xs text-zinc-500">平均虧損</div>
                        <div className="font-bold text-danger">-${backtestResult.avgLoss.toFixed(2)}</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-surface border border-zinc-800 rounded-xl p-6">
                    <h3 className="font-bold text-zinc-100 mb-4">📈 權益曲線</h3>
                    <div className="h-40 flex items-end gap-0.5">
                      {backtestResult.equityCurve.slice(-100).map((point, i, arr) => {
                        const min = Math.min(...arr.map(p => p.equity));
                        const max = Math.max(...arr.map(p => p.equity));
                        const height = ((point.equity - min) / (max - min || 1)) * 100;
                        const isProfit = point.equity >= backtestResult.initialBalance;
                        return (
                          <div key={i} className={`flex-1 ${isProfit ? 'bg-primary/60' : 'bg-danger/60'} rounded-t`} style={{ height: `${Math.max(5, height)}%` }} />
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-surface border border-zinc-800 rounded-xl p-12 text-center">
                  <div className="text-6xl mb-4">📊</div>
                  <h3 className="text-xl font-bold text-zinc-300 mb-2">策略回測</h3>
                  <p className="text-zinc-500 text-sm">使用歷史數據驗證您的交易策略</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========== ML OPTIMIZE TAB ========== */}
        {activeTab === 'optimize' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-surface border border-zinc-800 rounded-xl p-6">
              <h3 className="font-bold text-zinc-100 mb-4 flex items-center gap-2">🧠 機器學習優化</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-zinc-500 block mb-2">策略</label>
                  <select
                    value={optimizeStrategy}
                    onChange={(e) => setOptimizeStrategy(e.target.value as StrategyType)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-sm"
                  >
                    {Object.entries(STRATEGY_NAMES).filter(([key]) => key !== 'GRID_TRADING').map(([key, name]) => (
                      <option key={key} value={key}>{name}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="text-xs text-zinc-500 block mb-2">優化演算法</label>
                  <select
                    value={optimizeAlgorithm}
                    onChange={(e) => setOptimizeAlgorithm(e.target.value as typeof optimizeAlgorithm)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-sm"
                  >
                    <option value="genetic">🧬 遺傳演算法</option>
                    <option value="bayesian">🎯 貝葉斯優化</option>
                    <option value="grid">📐 網格搜索</option>
                    <option value="random">🎲 隨機搜索</option>
                  </select>
                </div>
                
                <div>
                  <label className="text-xs text-zinc-500 block mb-2">迭代次數: {optimizeIterations}</label>
                  <input
                    type="range"
                    min="20"
                    max="200"
                    step="10"
                    value={optimizeIterations}
                    onChange={(e) => setOptimizeIterations(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
                
                <div className="bg-zinc-900/50 rounded-lg p-3">
                  <div className="text-xs text-zinc-500 mb-2">優化參數空間</div>
                  <div className="space-y-1">
                    {STRATEGY_PARAMETER_SPACES[optimizeStrategy].map(space => (
                      <div key={space.name} className="text-xs flex justify-between">
                        <span className="text-zinc-400">{space.name}</span>
                        <span className="text-zinc-500">{space.min} - {space.max}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <button
                  onClick={handleRunOptimize}
                  disabled={isOptimizing || marketData.length < 100}
                  className={`w-full py-3 rounded-lg font-bold transition-all ${
                    isOptimizing 
                      ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                      : 'bg-green-500 hover:bg-green-400 text-white shadow-lg shadow-green-900/30'
                  }`}
                >
                  {isOptimizing ? `⏳ 優化中... ${optimizeProgress}%` : '🚀 開始優化'}
                </button>
                
                {isOptimizing && (
                  <div className="w-full bg-zinc-800 rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${optimizeProgress}%` }} />
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-2 space-y-6">
              {optimizeResult ? (
                <>
                  <div className="bg-surface border border-zinc-800 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-zinc-100">🏆 最佳參數組合</h3>
                      <button
                        onClick={handleApplyOptimizedParams}
                        className="bg-purple-500 hover:bg-purple-400 text-white text-sm font-bold py-2 px-4 rounded-lg"
                      >
                        套用到新機器人
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      {Object.entries(optimizeResult.bestParams).map(([key, value]) => (
                        <div key={key} className="bg-zinc-900 rounded-lg p-3 text-center">
                          <div className="text-xs text-zinc-500 mb-1">{key}</div>
                          <div className="text-xl font-bold text-green-400">
                            {typeof value === 'number' ? value.toFixed(value % 1 === 0 ? 0 : 2) : value}
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-zinc-900/50 rounded-lg p-3 text-center">
                        <div className="text-xs text-zinc-500">最佳分數</div>
                        <div className="font-bold text-lg text-accent">{optimizeResult.bestScore.toFixed(2)}</div>
                      </div>
                      <div className="bg-zinc-900/50 rounded-lg p-3 text-center">
                        <div className="text-xs text-zinc-500">穩健性</div>
                        <div className={`font-bold text-lg ${optimizeResult.robustnessScore >= 50 ? 'text-primary' : 'text-danger'}`}>
                          {optimizeResult.robustnessScore.toFixed(0)}%
                        </div>
                      </div>
                      <div className="bg-zinc-900/50 rounded-lg p-3 text-center">
                        <div className="text-xs text-zinc-500">執行時間</div>
                        <div className="font-bold text-lg">{(optimizeResult.executionTime / 1000).toFixed(1)}s</div>
                      </div>
                    </div>
                    
                    {optimizeResult.overfittingWarning && (
                      <div className="mt-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-yellow-400 text-sm">
                        ⚠️ 警告：偵測到可能的過擬合
                      </div>
                    )}
                  </div>
                  
                  <div className="bg-surface border border-zinc-800 rounded-xl p-6">
                    <h3 className="font-bold text-zinc-100 mb-4">📊 優化後回測結果</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-zinc-900 rounded-lg p-4 text-center">
                        <div className="text-xs text-zinc-500 mb-1">總收益</div>
                        <div className={`text-2xl font-bold ${optimizeResult.bestResult.totalPnL >= 0 ? 'text-primary' : 'text-danger'}`}>
                          {optimizeResult.bestResult.totalPnLPercent.toFixed(2)}%
                        </div>
                      </div>
                      <div className="bg-zinc-900 rounded-lg p-4 text-center">
                        <div className="text-xs text-zinc-500 mb-1">勝率</div>
                        <div className="text-2xl font-bold text-zinc-100">{optimizeResult.bestResult.winRate.toFixed(1)}%</div>
                      </div>
                      <div className="bg-zinc-900 rounded-lg p-4 text-center">
                        <div className="text-xs text-zinc-500 mb-1">最大回撤</div>
                        <div className="text-2xl font-bold text-danger">-{optimizeResult.bestResult.maxDrawdownPercent.toFixed(2)}%</div>
                      </div>
                      <div className="bg-zinc-900 rounded-lg p-4 text-center">
                        <div className="text-xs text-zinc-500 mb-1">Sharpe</div>
                        <div className="text-2xl font-bold text-accent">{optimizeResult.bestResult.sharpeRatio.toFixed(2)}</div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-surface border border-zinc-800 rounded-xl p-12 text-center">
                  <div className="text-6xl mb-4">🧠</div>
                  <h3 className="text-xl font-bold text-zinc-300 mb-2">機器學習策略優化</h3>
                  <p className="text-zinc-500 text-sm">使用遺傳演算法自動找出最佳策略參數</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create Bot Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-zinc-700 rounded-xl w-full max-w-lg shadow-2xl">
            <div className="p-5 border-b border-zinc-800 flex justify-between items-center">
              <h3 className="text-lg font-bold text-zinc-100">部署新機器人</h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-zinc-500 hover:text-white">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleCreateBot} className="p-6 space-y-5">
              <div>
                <label className="text-xs uppercase text-zinc-500 font-bold mb-2 block">機器人名稱 (選填)</label>
                <input
                  type="text"
                  value={newBot.name}
                  onChange={(e) => setNewBot({ ...newBot, name: e.target.value })}
                  placeholder="自動生成"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-sm text-zinc-200 outline-none focus:border-purple-500"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs uppercase text-zinc-500 font-bold mb-2 block">交易對</label>
                  <select
                    value={newBot.symbol}
                    onChange={(e) => setNewBot({ ...newBot, symbol: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-sm text-zinc-200 outline-none focus:border-purple-500"
                  >
                    <option value="BTC/USDT">BTC/USDT</option>
                    <option value="ETH/USDT">ETH/USDT</option>
                    <option value="SOL/USDT">SOL/USDT</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs uppercase text-zinc-500 font-bold mb-2 block">策略</label>
                  <select
                    value={newBot.strategy}
                    onChange={(e) => setNewBot({ ...newBot, strategy: e.target.value as StrategyType })}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-sm text-zinc-200 outline-none focus:border-purple-500"
                  >
                    {Object.entries(STRATEGY_NAMES).map(([key, name]) => (
                      <option key={key} value={key}>{name}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="p-3 bg-zinc-900/50 rounded-lg text-xs text-zinc-400">
                {STRATEGY_DESCRIPTIONS[newBot.strategy]}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs uppercase text-zinc-500 font-bold mb-2 block">配置資金 (USDT)</label>
                  <input
                    type="number"
                    value={newBot.allocatedBalance}
                    onChange={(e) => setNewBot({ ...newBot, allocatedBalance: Number(e.target.value) })}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-sm text-zinc-200 outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase text-zinc-500 font-bold mb-2 block">最大單筆 (USDT)</label>
                  <input
                    type="number"
                    value={newBot.maxPositionSize}
                    onChange={(e) => setNewBot({ ...newBot, maxPositionSize: Number(e.target.value) })}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-sm text-zinc-200 outline-none focus:border-purple-500"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs uppercase text-zinc-500 font-bold mb-2 block">槓桿</label>
                  <select
                    value={newBot.leverage}
                    onChange={(e) => setNewBot({ ...newBot, leverage: Number(e.target.value) })}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-sm text-zinc-200 outline-none focus:border-purple-500"
                  >
                    {[1, 2, 3, 5, 10, 20, 25, 50].map(v => (
                      <option key={v} value={v}>{v}x</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs uppercase text-zinc-500 font-bold mb-2 block">保證金模式</label>
                  <select
                    value={newBot.marginType}
                    onChange={(e) => setNewBot({ ...newBot, marginType: e.target.value as 'CROSS' | 'ISOLATED' })}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-sm text-zinc-200 outline-none focus:border-purple-500"
                  >
                    <option value="ISOLATED">逐倉</option>
                    <option value="CROSS">全倉</option>
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs uppercase text-zinc-500 font-bold mb-2 block">止損 (%)</label>
                  <input
                    type="number"
                    value={newBot.stopLossPercent}
                    onChange={(e) => setNewBot({ ...newBot, stopLossPercent: Number(e.target.value) })}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-sm text-zinc-200 outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase text-zinc-500 font-bold mb-2 block">止盈 (%)</label>
                  <input
                    type="number"
                    value={newBot.takeProfitPercent}
                    onChange={(e) => setNewBot({ ...newBot, takeProfitPercent: Number(e.target.value) })}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-sm text-zinc-200 outline-none focus:border-purple-500"
                  />
                </div>
              </div>
              
              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full bg-purple-500 hover:bg-purple-400 text-white font-bold py-3.5 rounded-lg transition-all shadow-lg shadow-purple-900/30"
                >
                  確認部署
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BotsPage;
