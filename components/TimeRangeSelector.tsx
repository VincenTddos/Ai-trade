/**
 * 時間範圍選擇器組件
 * 
 * 讓用戶選擇不同的歷史時間範圍查看 K 線數據
 */

import React, { useState } from 'react';
import { TimeRange, TIME_RANGE_CONFIG, FetchProgress } from '../services/historicalDataService';

interface TimeRangeSelectorProps {
  currentRange: TimeRange;
  onRangeChange: (range: TimeRange) => void;
  loading?: boolean;
  progress?: FetchProgress | null;
  currentInterval?: string;
  totalRecords?: number;
}

const TimeRangeSelector: React.FC<TimeRangeSelectorProps> = ({
  currentRange,
  onRangeChange,
  loading = false,
  progress = null,
  currentInterval,
  totalRecords,
}) => {
  const ranges: TimeRange[] = ['1D', '1W', '1M', '3M', '6M', '1Y', '2Y', 'ALL'];

  return (
    <div className="flex items-center gap-4">
      {/* 時間範圍按鈕 */}
      <div className="flex bg-zinc-900 rounded-lg p-1 border border-zinc-800">
        {ranges.map((range) => {
          const config = TIME_RANGE_CONFIG[range];
          const isActive = currentRange === range;
          
          return (
            <button
              key={range}
              onClick={() => !loading && onRangeChange(range)}
              disabled={loading}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                isActive
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={config.description}
            >
              {config.label}
            </button>
          );
        })}
      </div>

      {/* 當前狀態指示 */}
      <div className="flex items-center gap-3 text-xs text-zinc-500">
        {loading && progress ? (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <span className="text-zinc-400">{progress.message}</span>
            {progress.total > 0 && (
              <span className="text-zinc-600">
                ({Math.round((progress.current / progress.total) * 100)}%)
              </span>
            )}
          </div>
        ) : (
          <>
            {currentInterval && (
              <span className="px-2 py-0.5 bg-zinc-800 rounded text-zinc-400">
                {currentInterval}
              </span>
            )}
            {totalRecords !== undefined && totalRecords > 0 && (
              <span className="text-zinc-500">
                {totalRecords.toLocaleString()} K線
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TimeRangeSelector;
