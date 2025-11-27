import React from 'react';
import { DerivativeMetrics } from '../types';

const MetricCard = ({ label, value, subValue, trend }: { label: string, value: string, subValue?: string, trend?: 'up' | 'down' | 'neutral' }) => (
  <div className="bg-surface border border-zinc-800 rounded-lg p-3 flex flex-col justify-between">
    <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider">{label}</span>
    <div className="mt-1 flex items-end gap-2">
      <span className={`text-lg font-mono font-bold ${trend === 'up' ? 'text-primary' : trend === 'down' ? 'text-danger' : 'text-zinc-200'}`}>
        {value}
      </span>
      {subValue && <span className="text-xs text-zinc-500 mb-1">{subValue}</span>}
    </div>
  </div>
);

interface Props {
  data: DerivativeMetrics;
}

const DerivativesStats: React.FC<Props> = ({ data }) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      <MetricCard 
        label="資金費率 (Funding)" 
        value={`${data.fundingRate.toFixed(4)}%`} 
        trend={data.fundingRate > 0 ? 'up' : 'down'}
      />
      <MetricCard 
        label="多空比 (L/S Ratio)" 
        value={data.longShortRatio.toFixed(2)} 
        trend={data.longShortRatio > 1 ? 'up' : 'down'}
      />
      <MetricCard 
        label="未平倉合約 (OI)" 
        value={`$${data.openInterest}M`} 
      />
      <MetricCard 
        label="24H 爆倉量 (Liq)" 
        value={`$${data.liquidations24h}M`}
        trend="down"
      />
    </div>
  );
};

export default DerivativesStats;