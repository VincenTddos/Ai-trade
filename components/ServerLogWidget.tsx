// Server Log Widget - 即時交易日誌顯示面板

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { serverLog, LogEntry, LogLevel, BotStatus, SystemStatus } from '../services/serverLog';

interface ServerLogWidgetProps {
  embedded?: boolean;  // 是否嵌入式顯示 (非浮動)
  height?: string;     // 自定義高度
}

const ServerLogWidget: React.FC<ServerLogWidgetProps> = ({ embedded = false, height = '100%' }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [botStatuses, setBotStatuses] = useState<BotStatus[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [activeTab, setActiveTab] = useState<'logs' | 'bots' | 'system'>('logs');
  const [filter, setFilter] = useState<LogLevel | 'ALL'>('ALL');
  const [autoScroll, setAutoScroll] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // 更新數據
  const updateData = useCallback(() => {
    setLogs(serverLog.getLogs({ limit: 100 }));
    setBotStatuses(serverLog.getAllBotStatuses());
    setSystemStatus(serverLog.getSystemStatus());
  }, []);

  useEffect(() => {
    updateData();
    const unsubscribe = serverLog.subscribe(updateData);
    return unsubscribe;
  }, [updateData]);

  // 自動滾動
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = 0;
    }
  }, [logs, autoScroll]);

  // 過濾日誌
  const filteredLogs = filter === 'ALL' 
    ? logs 
    : logs.filter(l => l.level === filter);

  // 格式化時間
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('zh-TW', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  // 格式化運行時間
  const formatUptime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}天 ${hours % 24}時 ${minutes % 60}分`;
    if (hours > 0) return `${hours}時 ${minutes % 60}分 ${seconds % 60}秒`;
    if (minutes > 0) return `${minutes}分 ${seconds % 60}秒`;
    return `${seconds}秒`;
  };

  // 獲取日誌顏色
  const getLevelColor = (level: LogLevel) => {
    switch (level) {
      case 'SUCCESS': return 'text-green-400 bg-green-500/10';
      case 'ERROR': return 'text-red-400 bg-red-500/10';
      case 'WARN': return 'text-yellow-400 bg-yellow-500/10';
      case 'TRADE': return 'text-blue-400 bg-blue-500/10';
      case 'SIGNAL': return 'text-purple-400 bg-purple-500/10';
      case 'SYSTEM': return 'text-cyan-400 bg-cyan-500/10';
      default: return 'text-zinc-400 bg-zinc-500/10';
    }
  };

  // 獲取狀態顏色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RUNNING': return 'text-green-400 bg-green-500/20';
      case 'PAUSED': return 'text-yellow-400 bg-yellow-500/20';
      case 'STOPPED': return 'text-red-400 bg-red-500/20';
      default: return 'text-zinc-400 bg-zinc-500/20';
    }
  };

  // 浮動模式最小化狀態
  if (!embedded && isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-4 right-4 z-50 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition-all shadow-lg flex items-center gap-2"
      >
        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
        Server Log ({logs.length})
      </button>
    );
  }

  // 嵌入式模式
  if (embedded) {
    return (
      <div className="bg-surface border border-zinc-800 rounded-xl shadow-lg shadow-black/20 flex flex-col overflow-hidden" style={{ height }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${systemStatus?.wsConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
              <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider">Server Log</span>
            </div>
            
            {/* Tabs */}
            <div className="flex bg-zinc-800 rounded-lg p-0.5">
              {(['logs', 'bots', 'system'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-all ${
                    activeTab === tab 
                      ? 'bg-zinc-700 text-white' 
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {tab === 'logs' ? '日誌' : tab === 'bots' ? '機器人' : '系統'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {activeTab === 'logs' && (
              <>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as LogLevel | 'ALL')}
                  className="bg-zinc-800 border border-zinc-700 rounded px-2 py-0.5 text-[10px] text-zinc-300 outline-none"
                >
                  <option value="ALL">全部</option>
                  <option value="TRADE">交易</option>
                  <option value="SIGNAL">信號</option>
                  <option value="SUCCESS">成功</option>
                  <option value="ERROR">錯誤</option>
                </select>

                <button
                  onClick={() => setAutoScroll(!autoScroll)}
                  className={`px-2 py-0.5 text-[10px] rounded transition-all ${
                    autoScroll ? 'bg-blue-500/20 text-blue-400' : 'bg-zinc-800 text-zinc-500'
                  }`}
                >
                  自動
                </button>

                <button
                  onClick={() => serverLog.clearLogs()}
                  className="px-2 py-0.5 text-[10px] bg-zinc-800 text-zinc-400 rounded hover:text-red-400 transition-all"
                >
                  清除
                </button>
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {/* Logs Tab */}
          {activeTab === 'logs' && (
            <div 
              ref={logContainerRef}
              className="h-full overflow-y-auto p-2 space-y-1 font-mono text-[11px] custom-scrollbar"
            >
              {filteredLogs.length === 0 ? (
                <div className="text-center text-zinc-500 py-4">暫無日誌</div>
              ) : (
                filteredLogs.map(log => (
                  <div 
                    key={log.id}
                    className={`flex items-start gap-1.5 p-1.5 rounded ${getLevelColor(log.level)} hover:bg-opacity-20 transition-all`}
                  >
                    <span className="text-zinc-500 shrink-0">{formatTime(log.timestamp)}</span>
                    <span className={`px-1 py-0.5 rounded text-[9px] font-bold uppercase shrink-0 ${getLevelColor(log.level)}`}>
                      {log.level.slice(0, 3)}
                    </span>
                    <span className="text-zinc-200 font-medium truncate">{log.title}</span>
                    <span className="text-zinc-500 truncate flex-1 hidden lg:block">{log.message}</span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Bots Tab */}
          {activeTab === 'bots' && (
            <div className="h-full overflow-y-auto p-2 space-y-2 custom-scrollbar">
              {botStatuses.length === 0 ? (
                <div className="text-center text-zinc-500 py-4 text-xs">暫無運行中的機器人</div>
              ) : (
                botStatuses.map(bot => (
                  <div key={bot.botId} className="bg-zinc-900/50 rounded-lg p-2.5 border border-zinc-800">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-zinc-100">{bot.botName}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${getStatusColor(bot.status)}`}>
                          {bot.status}
                        </span>
                      </div>
                      <span className="text-[10px] text-zinc-500">{bot.strategy}</span>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 text-[10px]">
                      <div className="bg-zinc-800/50 rounded p-1.5">
                        <div className="text-zinc-500">交易</div>
                        <div className="text-zinc-200 font-mono">{bot.stats.totalTrades}</div>
                      </div>
                      <div className="bg-zinc-800/50 rounded p-1.5">
                        <div className="text-zinc-500">勝率</div>
                        <div className="text-zinc-200 font-mono">{bot.stats.winRate.toFixed(0)}%</div>
                      </div>
                      <div className="bg-zinc-800/50 rounded p-1.5">
                        <div className="text-zinc-500">勝/負</div>
                        <div className="font-mono">
                          <span className="text-green-400">{bot.stats.winTrades}</span>
                          <span className="text-zinc-600">/</span>
                          <span className="text-red-400">{bot.stats.lossTrades}</span>
                        </div>
                      </div>
                      <div className="bg-zinc-800/50 rounded p-1.5">
                        <div className="text-zinc-500">損益</div>
                        <div className={`font-mono ${bot.stats.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {bot.stats.totalPnL >= 0 ? '+' : ''}{bot.stats.totalPnL.toFixed(1)}
                        </div>
                      </div>
                    </div>

                    {bot.currentPosition && (
                      <div className="bg-zinc-800/30 rounded p-1.5 text-[10px] mt-1.5">
                        <div className="flex items-center justify-between">
                          <span className={bot.currentPosition.side === 'LONG' ? 'text-green-400' : 'text-red-400'}>
                            {bot.currentPosition.side} @ ${bot.currentPosition.entryPrice.toFixed(0)}
                          </span>
                          <span className={bot.currentPosition.unrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}>
                            {bot.currentPosition.unrealizedPnL >= 0 ? '+' : ''}{bot.currentPosition.unrealizedPnL.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* System Tab */}
          {activeTab === 'system' && systemStatus && (
            <div className="h-full overflow-y-auto p-2 space-y-2 custom-scrollbar">
              <div className="bg-zinc-900/50 rounded-lg p-3 border border-zinc-800">
                <h4 className="text-xs font-bold text-zinc-100 mb-2">系統狀態</h4>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">運行時間</span>
                    <span className="text-zinc-200 font-mono">{formatUptime(systemStatus.uptime)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">WebSocket</span>
                    <span className={systemStatus.wsConnected ? 'text-green-400' : 'text-red-400'}>
                      {systemStatus.wsConnected ? '已連線' : '斷線'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">BTC 價格</span>
                    <span className="text-zinc-200 font-mono">${systemStatus.currentPrice.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">機器人</span>
                    <span className="text-zinc-200 font-mono">{systemStatus.activeBots}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">持倉數</span>
                    <span className="text-zinc-200 font-mono">{systemStatus.totalPositions}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">浮動盈虧</span>
                    <span className={`font-mono ${systemStatus.totalUnrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {systemStatus.totalUnrealizedPnL >= 0 ? '+' : ''}${systemStatus.totalUnrealizedPnL.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-3 py-1.5 border-t border-zinc-800 bg-zinc-900/30 text-[10px] text-zinc-500 shrink-0">
          <span>日誌: {logs.length} | 機器人: {botStatuses.length}</span>
          <span>{formatUptime(systemStatus?.uptime || 0)}</span>
        </div>
      </div>
    );
  }

  // 浮動模式

  return (
    <div className="fixed bottom-0 right-0 z-50 w-full md:w-[600px] lg:w-[700px] bg-zinc-950/95 backdrop-blur border-t border-l border-zinc-800 rounded-tl-xl shadow-2xl flex flex-col max-h-[50vh]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${systemStatus?.wsConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
            <span className="text-sm font-bold text-zinc-100">Server Log</span>
          </div>
          
          {/* Tabs */}
          <div className="flex bg-zinc-800 rounded-lg p-0.5">
            {(['logs', 'bots', 'system'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  activeTab === tab 
                    ? 'bg-zinc-700 text-white' 
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {tab === 'logs' ? '日誌' : tab === 'bots' ? '機器人' : '系統'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'logs' && (
            <>
              {/* Filter */}
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as LogLevel | 'ALL')}
                className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300 outline-none"
              >
                <option value="ALL">全部</option>
                <option value="TRADE">交易</option>
                <option value="SIGNAL">信號</option>
                <option value="SUCCESS">成功</option>
                <option value="ERROR">錯誤</option>
                <option value="WARN">警告</option>
                <option value="SYSTEM">系統</option>
              </select>

              {/* Auto Scroll */}
              <button
                onClick={() => setAutoScroll(!autoScroll)}
                className={`px-2 py-1 text-xs rounded transition-all ${
                  autoScroll 
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                    : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
                }`}
              >
                自動滾動
              </button>

              {/* Clear */}
              <button
                onClick={() => serverLog.clearLogs()}
                className="px-2 py-1 text-xs bg-zinc-800 text-zinc-400 border border-zinc-700 rounded hover:text-red-400 hover:border-red-500/30 transition-all"
              >
                清除
              </button>
            </>
          )}

          {/* Minimize */}
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1 text-zinc-400 hover:text-white transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {/* Logs Tab */}
        {activeTab === 'logs' && (
          <div 
            ref={logContainerRef}
            className="h-full overflow-y-auto p-2 space-y-1 font-mono text-xs"
            style={{ maxHeight: 'calc(50vh - 100px)' }}
          >
            {filteredLogs.length === 0 ? (
              <div className="text-center text-zinc-500 py-8">暫無日誌</div>
            ) : (
              filteredLogs.map(log => (
                <div 
                  key={log.id}
                  className={`flex items-start gap-2 p-2 rounded ${getLevelColor(log.level)} hover:bg-opacity-20 transition-all`}
                >
                  <span className="text-zinc-500 shrink-0">{formatTime(log.timestamp)}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${getLevelColor(log.level)}`}>
                    {log.level}
                  </span>
                  <span className="text-zinc-500 shrink-0">[{log.source}]</span>
                  <span className="text-zinc-200 font-medium">{log.title}</span>
                  <span className="text-zinc-400 truncate flex-1">{log.message}</span>
                </div>
              ))
            )}
          </div>
        )}

        {/* Bots Tab */}
        {activeTab === 'bots' && (
          <div className="h-full overflow-y-auto p-3 space-y-3" style={{ maxHeight: 'calc(50vh - 100px)' }}>
            {botStatuses.length === 0 ? (
              <div className="text-center text-zinc-500 py-8">暫無運行中的機器人</div>
            ) : (
              botStatuses.map(bot => (
                <div key={bot.botId} className="bg-zinc-900/50 rounded-lg p-3 border border-zinc-800">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-zinc-100">{bot.botName}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getStatusColor(bot.status)}`}>
                        {bot.status}
                      </span>
                    </div>
                    <span className="text-xs text-zinc-500">{bot.strategy}</span>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-4 gap-2 text-xs mb-2">
                    <div className="bg-zinc-800/50 rounded p-2">
                      <div className="text-zinc-500">總交易</div>
                      <div className="text-zinc-200 font-mono">{bot.stats.totalTrades}</div>
                    </div>
                    <div className="bg-zinc-800/50 rounded p-2">
                      <div className="text-zinc-500">勝率</div>
                      <div className="text-zinc-200 font-mono">{bot.stats.winRate.toFixed(1)}%</div>
                    </div>
                    <div className="bg-zinc-800/50 rounded p-2">
                      <div className="text-zinc-500">勝/負</div>
                      <div className="font-mono">
                        <span className="text-green-400">{bot.stats.winTrades}</span>
                        <span className="text-zinc-500">/</span>
                        <span className="text-red-400">{bot.stats.lossTrades}</span>
                      </div>
                    </div>
                    <div className="bg-zinc-800/50 rounded p-2">
                      <div className="text-zinc-500">總損益</div>
                      <div className={`font-mono ${bot.stats.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {bot.stats.totalPnL >= 0 ? '+' : ''}{bot.stats.totalPnL.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {/* Current Position */}
                  {bot.currentPosition && (
                    <div className="bg-zinc-800/30 rounded p-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className={bot.currentPosition.side === 'LONG' ? 'text-green-400' : 'text-red-400'}>
                          {bot.currentPosition.side} @ ${bot.currentPosition.entryPrice.toFixed(2)}
                        </span>
                        <span className={bot.currentPosition.unrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}>
                          {bot.currentPosition.unrealizedPnL >= 0 ? '+' : ''}{bot.currentPosition.unrealizedPnL.toFixed(2)} USDT
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Last Signal */}
                  {bot.lastSignal && (
                    <div className="text-xs text-zinc-500 mt-2">
                      最新信號: {bot.lastSignal.action} ({bot.lastSignal.strength.toFixed(0)}) - {bot.lastSignal.reason}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* System Tab */}
        {activeTab === 'system' && systemStatus && (
          <div className="h-full overflow-y-auto p-3 space-y-3" style={{ maxHeight: 'calc(50vh - 100px)' }}>
            {/* System Status Card */}
            <div className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-800">
              <h4 className="text-sm font-bold text-zinc-100 mb-3">系統狀態</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-500">運行時間</span>
                  <span className="text-zinc-200 font-mono">{formatUptime(systemStatus.uptime)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">WebSocket</span>
                  <span className={systemStatus.wsConnected ? 'text-green-400' : 'text-red-400'}>
                    {systemStatus.wsConnected ? '已連線' : '斷線'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">當前價格</span>
                  <span className="text-zinc-200 font-mono">${systemStatus.currentPrice.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">最後更新</span>
                  <span className="text-zinc-200 font-mono">
                    {systemStatus.lastPriceUpdate ? formatTime(systemStatus.lastPriceUpdate) : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">運行機器人</span>
                  <span className="text-zinc-200 font-mono">{systemStatus.activeBots}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">總持倉</span>
                  <span className="text-zinc-200 font-mono">{systemStatus.totalPositions}</span>
                </div>
                <div className="col-span-2 flex justify-between pt-2 border-t border-zinc-800">
                  <span className="text-zinc-500">總未實現損益</span>
                  <span className={`font-mono font-bold ${systemStatus.totalUnrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {systemStatus.totalUnrealizedPnL >= 0 ? '+' : ''}${systemStatus.totalUnrealizedPnL.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-800">
              <h4 className="text-sm font-bold text-zinc-100 mb-3">快速操作</h4>
              <div className="flex flex-wrap gap-2">
                <button 
                  onClick={() => serverLog.log('INFO', 'USER', '手動測試', '測試日誌功能')}
                  className="px-3 py-1.5 bg-zinc-800 text-zinc-300 text-xs rounded hover:bg-zinc-700 transition-all"
                >
                  測試日誌
                </button>
                <button 
                  onClick={() => serverLog.clearLogs()}
                  className="px-3 py-1.5 bg-zinc-800 text-zinc-300 text-xs rounded hover:bg-red-500/20 hover:text-red-400 transition-all"
                >
                  清除所有日誌
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Status Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-zinc-800 bg-zinc-900/30 text-xs text-zinc-500">
        <div className="flex items-center gap-3">
          <span>日誌: {logs.length}</span>
          <span>|</span>
          <span>機器人: {botStatuses.length}</span>
        </div>
        <span>運行: {formatUptime(systemStatus?.uptime || 0)}</span>
      </div>
    </div>
  );
};

export default ServerLogWidget;
