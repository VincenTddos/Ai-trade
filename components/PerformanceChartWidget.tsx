import React, { useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { PerformanceHistoryPoint } from '../types';

interface Props {
  data: PerformanceHistoryPoint[];
}

const PerformanceChartWidget: React.FC<Props> = ({ data }) => {
  // Aggregate data by minute to prevent chart clutter and improve performance
  // If multiple points exist for the same minute (e.g. 07:15:10, 07:15:30), 
  // we consolidate them into a single point (07:15) using the latest values.
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const aggregated: PerformanceHistoryPoint[] = [];
    let lastTimeKey = '';

    for (const point of data) {
      // Robustly extract HH:mm part regardless of locale prefixes (e.g. "07:15:30" or "上午 07:15:30")
      // We simply take the parts before the seconds.
      const parts = point.time.split(':');
      const timeKey = parts.length >= 2 ? parts.slice(0, 2).join(':') : point.time;
      
      if (timeKey === lastTimeKey) {
        // Update the last entry with the latest data for this minute bucket
        aggregated[aggregated.length - 1] = {
          ...point,
          time: timeKey
        };
      } else {
        // Start a new minute bucket
        aggregated.push({
          ...point,
          time: timeKey
        });
        lastTimeKey = timeKey;
      }
    }
    
    return aggregated;
  }, [data]);

  return (
    <div className="bg-surface border border-zinc-800 rounded-lg p-5 mb-6 h-[250px] flex flex-col">
      <h3 className="text-sm font-semibold text-zinc-100 mb-4 flex items-center gap-2 shrink-0">
        <span className="w-1.5 h-1.5 bg-accent rounded-full"></span>
        績效走勢圖 (Trend)
      </h3>
      <div className="flex-1 w-full min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
            <XAxis 
              dataKey="time" 
              stroke="#52525b" 
              fontSize={10} 
              tickLine={false} 
              axisLine={false} 
              minTickGap={30}
            />
            <YAxis 
              yAxisId="left" 
              stroke="#52525b" 
              fontSize={10} 
              tickLine={false} 
              axisLine={false} 
              tickFormatter={(val) => `$${val.toLocaleString()}`} 
              domain={['auto', 'auto']}
            />
            <YAxis 
              yAxisId="right" 
              orientation="right" 
              stroke="#52525b" 
              fontSize={10} 
              tickLine={false} 
              axisLine={false} 
              tickFormatter={(val) => `${val}%`} 
              domain={[0, 100]}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', fontSize: '12px', color: '#e4e4e7' }}
              itemStyle={{ fontSize: 12 }}
              labelStyle={{ color: '#a1a1aa', marginBottom: 4 }}
            />
            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '0px' }} />
            <Line 
              yAxisId="left" 
              type="monotone" 
              dataKey="totalPnL" 
              stroke="#10b981" 
              dot={false} 
              name="總盈虧 (PnL)" 
              strokeWidth={2}
              activeDot={{ r: 4, fill: '#10b981' }}
            />
            <Line 
              yAxisId="right" 
              type="monotone" 
              dataKey="winRate" 
              stroke="#3b82f6" 
              dot={false} 
              name="勝率" 
              strokeWidth={1.5} 
            />
            <Line 
              yAxisId="right" 
              type="monotone" 
              dataKey="lossRate" 
              stroke="#ef4444" 
              dot={false} 
              name="敗率" 
              strokeWidth={1.5} 
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default PerformanceChartWidget;