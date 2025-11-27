
import React, { useState } from 'react';
import { analyzeMarketWithGemini } from '../services/geminiService';
import { MarketData, DerivativeMetrics, AIAnalysisResult, GroundingSource } from '../types';

interface Props {
  marketData: MarketData[];
  derivatives: DerivativeMetrics;
  symbol: string;
}

const AIAnalysisPanel: React.FC<Props> = ({ marketData, derivatives, symbol }) => {
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisMode, setAnalysisMode] = useState<'FAST' | 'DEEP'>('FAST');
  const [result, setResult] = useState<AIAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isReasonExpanded, setIsReasonExpanded] = useState(false);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setError(null);
    setIsReasonExpanded(false); // Reset expansion on new analysis
    try {
        const analysis = await analyzeMarketWithGemini(symbol, marketData, derivatives, analysisMode);
        setResult(analysis);
    } catch (e: any) {
        console.error(e);
        setError(e.message || "分析服務暫時無法使用，請檢查 API Key 或稍後再試。");
    } finally {
        setAnalyzing(false);
    }
  };

  const mapActionToChinese = (action: string) => {
    switch(action) {
        case 'BUY': return '做多買入';
        case 'SELL': return '做空賣出';
        case 'HOLD': return '觀望持有';
        default: return action;
    }
  };

  const DriverSpectrum = ({ driver }: { driver: string }) => {
    let position = 50;
    let colorClass = 'bg-purple-500';
    let activeTextClass = 'text-purple-400';
    
    if (driver === 'TECHNICAL') {
      position = 10;
      colorClass = 'bg-cyan-500';
      activeTextClass = 'text-cyan-400';
    } else if (driver === 'DERIVATIVES') {
      position = 90;
      colorClass = 'bg-orange-500';
      activeTextClass = 'text-orange-400';
    }

    return (
      <div className="flex flex-col w-full bg-zinc-900/40 rounded-lg p-3 border border-zinc-800/60 shadow-inner">
        {/* Spectrum Bar */}
        <div className="relative h-2.5 bg-zinc-800 rounded-full w-full mb-3 overflow-hidden border border-zinc-700/50">
             {/* Background Gradient */}
             <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/30 via-purple-500/20 to-orange-500/30"></div>
             
             {/* Position Indicator */}
             <div 
                className={`absolute top-0 bottom-0 w-1.5 h-full rounded-full ${colorClass} shadow-[0_0_10px_currentColor] transition-all duration-700 ease-out scale-125 z-10`}
                style={{ left: `calc(${position}% - 3px)` }}
             ></div>
        </div>

        {/* Labels & Descriptions Row */}
        <div className="flex justify-between items-start gap-2">
            
            {/* Technical Side */}
            <div className={`flex flex-col items-start ${driver === 'TECHNICAL' ? 'opacity-100' : 'opacity-50 grayscale transition-all duration-300'}`}>
                <div className="flex items-center gap-1.5 mb-0.5">
                    <div className="p-1 rounded bg-cyan-500/10 border border-cyan-500/20">
                        <svg className="w-3 h-3 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                        </svg>
                    </div>
                    <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">技術面驅動</span>
                </div>
                <span className="text-[9px] text-zinc-500 pl-1">
                    依據: K線型態 / 均線 / 量能
                </span>
            </div>

            {/* Derivatives Side */}
            <div className={`flex flex-col items-end ${driver === 'DERIVATIVES' ? 'opacity-100' : 'opacity-50 grayscale transition-all duration-300'}`}>
                <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider">籌碼面驅動</span>
                    <div className="p-1 rounded bg-orange-500/10 border border-orange-500/20">
                        <svg className="w-3 h-3 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                        </svg>
                    </div>
                </div>
                <span className="text-[9px] text-zinc-500 text-right pr-1">
                    依據: 資金費率 / 持倉 / 爆倉
                </span>
            </div>
        </div>
        
        {/* Center/Hybrid Indicator Text (Only if Hybrid) */}
        {driver === 'HYBRID' && (
            <div className="mt-2 text-center border-t border-zinc-800/50 pt-1">
                <span className="text-[9px] font-mono text-purple-400 flex items-center justify-center gap-1">
                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    雙重因子綜合分析 (Hybrid Analysis)
                </span>
            </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-surface border border-zinc-800 rounded-lg p-5 flex flex-col h-full relative overflow-hidden group">
      {/* Dynamic Background Grid Effect for Expo - Always Visible for Visual Impact */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,18,27,0)_0,rgba(18,18,27,0.5)_100%),repeating-linear-gradient(0deg,transparent,transparent_19px,rgba(255,255,255,0.02)_20px),repeating-linear-gradient(90deg,transparent,transparent_19px,rgba(255,255,255,0.02)_20px)] pointer-events-none opacity-20 animate-pulse"></div>

      {/* Header */}
      <div className="flex justify-between items-center mb-4 relative z-10">
        <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center">
                <span className={`absolute inline-flex h-full w-full rounded-full opacity-20 animate-ping ${analysisMode === 'DEEP' ? 'bg-indigo-500' : 'bg-purple-500'}`}></span>
                <span className={`relative w-2 h-2 rounded-full shadow-[0_0_8px_rgba(168,85,247,0.6)] ${analysisMode === 'DEEP' ? 'bg-indigo-500' : 'bg-purple-500'}`}></span>
            </div>
            <h3 className="text-base font-bold text-zinc-100 tracking-wide flex items-center gap-2">
                AI 智能決策層
                <span className={`ml-1 text-[10px] font-medium px-1.5 py-0.5 rounded border tracking-normal transition-colors duration-300
                    ${analysisMode === 'DEEP' 
                        ? 'text-indigo-300/80 bg-indigo-500/10 border-indigo-500/20' 
                        : 'text-purple-300/80 bg-purple-500/10 border-purple-500/20'
                    }`}>
                    {analysisMode === 'DEEP' ? 'Gemini 3 Pro' : 'Gemini 2.5 Flash'}
                </span>
            </h3>
        </div>
        
        <div className="flex items-center gap-2">
             {/* Mode Toggle */}
             {!analyzing && (
                 <button 
                    onClick={() => setAnalysisMode(prev => prev === 'FAST' ? 'DEEP' : 'FAST')}
                    className={`text-[10px] px-2 py-1 rounded border transition-all ${
                        analysisMode === 'DEEP' 
                        ? 'bg-indigo-900/40 border-indigo-500 text-indigo-300' 
                        : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-300'
                    }`}
                    title="切換深度思考模式 (更慢但更精確)"
                 >
                    {analysisMode === 'DEEP' ? '🧠 深度思考' : '⚡ 快速掃描'}
                 </button>
             )}

            {!analyzing && (
                <button 
                    onClick={handleAnalyze}
                    className={`text-xs text-white px-3 py-1.5 rounded transition-all shadow-lg font-medium tracking-wide flex items-center gap-1
                        ${analysisMode === 'DEEP' 
                            ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-900/20' 
                            : 'bg-purple-600 hover:bg-purple-700 shadow-purple-900/20'
                        }`}
                >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    執行分析
                </button>
            )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto relative z-10 custom-scrollbar">
        {error ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4">
             <div className="w-10 h-10 rounded-full bg-danger/10 flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
             </div>
             <p className="text-sm text-zinc-200 font-medium mb-1">分析中斷</p>
             <p className="text-xs text-zinc-500 mb-3">{error}</p>
             <button onClick={handleAnalyze} className="text-xs text-zinc-400 hover:text-white underline">重試</button>
          </div>
        ) : analyzing ? (
          <div className="flex flex-col items-center justify-center h-full space-y-4 opacity-70 min-h-[200px]">
            <div className="relative">
                <div className={`w-12 h-12 border-2 border-t-transparent rounded-full animate-spin ${analysisMode === 'DEEP' ? 'border-indigo-500' : 'border-purple-500'}`}></div>
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className={`w-2 h-2 rounded-full animate-pulse ${analysisMode === 'DEEP' ? 'bg-indigo-400' : 'bg-purple-400'}`}></div>
                </div>
            </div>
            <div className="text-center space-y-1">
                <p className={`text-xs font-mono animate-pulse ${analysisMode === 'DEEP' ? 'text-indigo-400' : 'text-purple-400'}`}>
                    {analysisMode === 'DEEP' ? '正在進行深度邏輯推演 (Thinking)...' : '正在檢索 Google 即時新聞...'}
                </p>
                <p className="text-[10px] text-zinc-500">
                    {analysisMode === 'DEEP' ? 'Thinking Budget: 32,768 Tokens' : 'Tool: Google Search Grounding'}
                </p>
            </div>
          </div>
        ) : result ? (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
            
            {/* Top Section: Signal & Driver Spectrum */}
            <div className="flex gap-4 items-stretch">
                <div className={`
                    flex flex-col items-center justify-center w-24 rounded-lg border px-1 text-center shrink-0
                    ${result.action === 'BUY' ? 'border-primary/30 bg-primary/5 shadow-lg shadow-primary/5' : 
                      result.action === 'SELL' ? 'border-danger/30 bg-danger/5 shadow-lg shadow-danger/5' : 
                      'border-zinc-600 bg-zinc-800'}
                `}>
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-0.5">操作建議</span>
                    <span className={`text-lg font-black tracking-tight ${result.action === 'BUY' ? 'text-primary' : result.action === 'SELL' ? 'text-danger' : 'text-zinc-300'}`}>
                        {mapActionToChinese(result.action)}
                    </span>
                    <span className="text-[10px] text-zinc-500 mt-1 font-mono">
                        {result.confidence}% 置信
                    </span>
                </div>
                
                {/* Driver Spectrum UI */}
                <DriverSpectrum driver={result.primary_driver} />
            </div>

            {/* Trade Setup Section */}
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 px-1">
                    <svg className="w-3 h-3 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">合約交易執行計劃</span>
                </div>

                <div className="grid grid-cols-4 gap-2">
                    {/* ENTRY */}
                    <div className="bg-blue-500/5 p-2 rounded border border-blue-500/10 flex flex-col items-center text-center hover:bg-blue-500/10 transition-all cursor-default">
                        <div className="text-[9px] text-blue-300/70 uppercase tracking-wider mb-1">建議進場</div>
                        <span className="font-mono text-xs text-blue-400 font-bold truncate w-full">{result.suggested_entry}</span>
                    </div>
                    
                    {/* TP */}
                    <div className="bg-emerald-500/5 p-2 rounded border border-emerald-500/10 flex flex-col items-center text-center hover:bg-emerald-500/10 transition-all cursor-default">
                        <div className="text-[9px] text-emerald-300/70 uppercase tracking-wider mb-1">目標止盈</div>
                        <span className="font-mono text-xs text-emerald-400 font-bold truncate w-full">{result.suggested_take_profit}</span>
                    </div>

                    {/* SL */}
                    <div className="bg-red-500/5 p-2 rounded border border-red-500/10 flex flex-col items-center text-center hover:bg-red-500/10 transition-all cursor-default">
                        <div className="text-[9px] text-red-300/70 uppercase tracking-wider mb-1">止損保護</div>
                        <span className="font-mono text-xs text-red-400 font-bold truncate w-full">{result.suggested_stop_loss}</span>
                    </div>

                    {/* LEVERAGE (New) */}
                    <div className="bg-amber-500/5 p-2 rounded border border-amber-500/10 flex flex-col items-center text-center hover:bg-amber-500/10 transition-all cursor-default">
                        <div className="text-[9px] text-amber-300/70 uppercase tracking-wider mb-1">建議槓桿</div>
                        <span className="font-mono text-xs text-amber-400 font-bold truncate w-full">{result.suggested_leverage || '10x'}</span>
                    </div>
                </div>
            </div>

            {/* Reasoning */}
            <div className="bg-zinc-900/50 p-3.5 rounded border border-zinc-800/50 relative">
                <h4 className="text-xs font-semibold text-zinc-400 mb-2 uppercase flex items-center gap-2">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                    AI 分析觀點
                </h4>
                
                {/* Truncated Text Logic */}
                <div className="text-sm text-zinc-300 leading-relaxed font-light text-justify transition-all duration-300">
                    {isReasonExpanded || result.reason.length <= 180 ? (
                        result.reason
                    ) : (
                        <>
                            {result.reason.slice(0, 180)}
                            <span className="text-zinc-600">... </span>
                        </>
                    )}
                </div>

                {/* Show More/Less Button */}
                {result.reason.length > 180 && (
                    <div className="mt-1 flex justify-end">
                        <button 
                            onClick={() => setIsReasonExpanded(!isReasonExpanded)}
                            className="text-[10px] text-zinc-400 hover:text-primary transition-colors flex items-center gap-1 border-b border-dashed border-zinc-700 hover:border-primary pb-0.5"
                        >
                            {isReasonExpanded ? '收起完整內容' : '顯示完整分析'}
                            <svg className={`w-3 h-3 transition-transform ${isReasonExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                    </div>
                )}

                {/* Google Search Grounding Sources */}
                {result.groundingSources && result.groundingSources.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-zinc-800/50">
                        <span className="text-[10px] text-zinc-500 flex items-center gap-1 mb-1">
                             <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/></svg>
                             Google 資訊來源 (Grounding):
                        </span>
                        <div className="flex flex-wrap gap-2">
                            {result.groundingSources.slice(0, 3).map((source, i) => (
                                <a 
                                    key={i} 
                                    href={source.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="text-[10px] text-blue-400 hover:text-blue-300 bg-blue-500/5 border border-blue-500/20 px-2 py-0.5 rounded truncate max-w-[150px]"
                                >
                                    {source.title}
                                </a>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800/50">
                <span className="text-[10px] text-zinc-600">
                    Model: {analysisMode === 'DEEP' ? 'Gemini 3.0 Pro (Thinking)' : 'Gemini 2.5 Flash'}
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">{new Date(result.timestamp).toLocaleTimeString()}</span>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-zinc-600 space-y-3 min-h-[200px]">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center border transition-colors duration-500 ${analysisMode === 'DEEP' ? 'bg-indigo-900/10 border-indigo-900/30' : 'bg-zinc-800/50 border-zinc-800'}`}>
                {analysisMode === 'DEEP' ? (
                     <svg className="h-6 w-6 text-indigo-500 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                ) : (
                     <svg className="h-6 w-6 text-zinc-500 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                )}
            </div>
            <div className="text-center">
                <p className="text-sm font-medium text-zinc-500">
                    {analysisMode === 'DEEP' ? '深度思考模式已就緒' : '快速掃描模式已就緒'}
                </p>
                <p className="text-xs text-zinc-700 mt-1">
                    {analysisMode === 'DEEP' ? '高算力推理 / 32k Thinking' : 'Google 即時資訊掛鉤'}
                </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIAnalysisPanel;
