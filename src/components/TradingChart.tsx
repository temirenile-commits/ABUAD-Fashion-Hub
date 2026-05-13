'use client';

import React, { useId } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import styles from './TradingChart.module.css';

interface DataPoint {
  time: string;
  value: number;
}

interface TradingChartProps {
  data: DataPoint[];
  title?: string;
  color?: string;
  height?: number;
}

export default function TradingChart({ data, title, color = '#10b981', height = 300 }: TradingChartProps) {
  // Generate a stable unique ID for the gradient to avoid collisions
  const uid = useId();
  const gradientId = `colorValue-${uid.replace(/:/g, '')}`;

  return (
    <div className={styles.chartContainer}>
      {title && <div className={styles.chartTitle}>{title}</div>}
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer>
          <AreaChart
            data={data}
            margin={{ top: 10, right: 0, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.4} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid 
              strokeDasharray="3 3" 
              vertical={false} 
              stroke="rgba(255,255,255,0.05)" 
            />
            <XAxis 
              dataKey="time" 
              hide={true} 
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748b', fontSize: 10 }}
              domain={['auto', 'auto']}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#0f172a', 
                border: '1px solid var(--border)', 
                borderRadius: '8px',
                fontSize: '12px',
                color: '#fff'
              }}
              itemStyle={{ color: color }}
              labelStyle={{ display: 'none' }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={3}
              fillOpacity={1}
              fill={`url(#${gradientId})`}
              animationDuration={1500}
              baseFrequency={10}
            />
            {/* The "Pocket Broker" moving line effect */}
            {data.length > 0 && (
              <ReferenceLine 
                y={data[data.length - 1].value} 
                stroke={color} 
                strokeDasharray="3 3" 
                label={{ 
                  position: 'right', 
                  value: data[data.length - 1].value.toLocaleString(), 
                  fill: color, 
                  fontSize: 10,
                  fontWeight: 'bold'
                }} 
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className={styles.pulseDot} style={{ backgroundColor: color }}></div>
    </div>
  );
}
