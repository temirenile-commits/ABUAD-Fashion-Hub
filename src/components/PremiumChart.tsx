'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';
import styles from './PremiumChart.module.css';

interface DataPoint {
  time: string;
  value: number;
  raw_time: number;
}

interface PremiumChartProps {
  title: string;
  subtitle?: string;
  initialData: { time?: string; created_at?: string; amount?: number; total_amount?: number; value?: number }[];
  color?: string;
  height?: number;
  realtimeConfig?: {
    table: 'orders' | 'financial_ledger' | 'transactions';
    filter?: Record<string, string | number | boolean | null>;
    valueKey: string;
  };
  valuePrefix?: string;
  valueSuffix?: string;
}

const CustomTooltip = ({ active, payload, label, valuePrefix, valueSuffix }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className={styles.tooltip}>
        <div className={styles.tooltipLabel}>{label}</div>
        <div className={styles.tooltipVal}>
          {valuePrefix}{payload[0].value.toLocaleString()}{valueSuffix}
        </div>
      </div>
    );
  }
  return null;
};

export default function PremiumChart({
  title,
  subtitle,
  initialData,
  color = '#eb0c7a',
  height = 350,
  realtimeConfig,
  valuePrefix = '₦',
  valueSuffix = ''
}: PremiumChartProps) {
  const [liveData, setLiveData] = useState<DataPoint[]>([]);
  const [range, setRange] = useState<'live' | '1h' | '24h' | '7d' | '30d'>('24h');
  const [total, setTotal] = useState(0);
  const [prevTotal, setPrevTotal] = useState(0);
  const chartRef = useRef<HTMLDivElement>(null);

  // Derived historical data
  const historicalData = useMemo(() => {
    if (!initialData || initialData.length === 0) return [];
    return initialData.map(d => {
      const ts = d.created_at || d.time || new Date().toISOString();
      return {
        time: d.time || new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        value: Number(d.value || d.amount || d.total_amount || 0),
        raw_time: new Date(ts).getTime()
      };
    }).sort((a, b) => a.raw_time - b.raw_time);
  }, [initialData]);

  // Combined data
  const data = useMemo(() => {
    const combined = [...historicalData, ...liveData];
    return combined.sort((a, b) => a.raw_time - b.raw_time).slice(-100);
  }, [historicalData, liveData]);

  // Initialize total
  useEffect(() => {
    const currentSum = historicalData.reduce((acc, curr) => acc + curr.value, 0);
    setTotal(currentSum);
    setPrevTotal(currentSum * 0.9);
  }, [historicalData]);

  // Real-time listener
  useEffect(() => {
    if (!realtimeConfig) return;

    const channel = supabase
      .channel(`realtime-${realtimeConfig.table}-${Math.random()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: realtimeConfig.table,
          filter: realtimeConfig.filter ? Object.entries(realtimeConfig.filter).map(([k, v]) => `${k}=eq.${v}`).join('&') : undefined
        },
        (payload: { new: Record<string, any> }) => {
          const newValue = Number(payload.new[realtimeConfig.valueKey] || 0);
          if (newValue === 0) return;

          const now = new Date();
          const newPoint: DataPoint = {
            time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            value: newValue,
            raw_time: now.getTime()
          };

          setLiveData(prev => {
            const last = prev[prev.length - 1];
            if (last && (newPoint.raw_time - last.raw_time < 2000)) {
               const updated = [...prev];
               updated[updated.length - 1] = { ...last, value: last.value + newPoint.value };
               return updated;
            }
            return [...prev, newPoint].slice(-50); 
          });

          setTotal(prev => prev + newValue);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [realtimeConfig]);

  const trend = useMemo(() => {
    if (prevTotal === 0) return 0;
    return ((total - prevTotal) / prevTotal) * 100;
  }, [total, prevTotal]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        
        <div className={styles.liveBadge}>
          <span className={`${styles.liveDot} ${styles.pulse}`} />
          LIVE ECONOMY
        </div>
      </div>

      <div className={styles.chartControls}>
        {(['live', '1h', '24h', '7d', '30d'] as const).map(r => (
          <button 
            key={r} 
            className={`${styles.controlBtn} ${range === r ? styles.controlActive : ''}`}
            onClick={() => setRange(r)}
          >
            {r.toUpperCase()}
          </button>
        ))}
      </div>

      <div className={styles.chartArea} style={{ height }}>
        <div className={styles.scrollContainer} ref={chartRef}>
          <div className={styles.chartInner} style={{ width: data.length > 20 ? `${data.length * 40}px` : '100%', minWidth: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={`color-${title}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={color} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis 
                  dataKey="time" 
                  stroke="#64748b" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                  minTickGap={30}
                />
                <YAxis 
                  stroke="#64748b" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(val: number) => `${valuePrefix}${val >= 1000 ? (val/1000).toFixed(1) + 'k' : val}`}
                />
                <Tooltip content={<CustomTooltip valuePrefix={valuePrefix} valueSuffix={valueSuffix} />} />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke={color} 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill={`url(#color-${title})`} 
                  animationDuration={1000}
                />
                {range === 'live' && data.length > 0 && (
                   <ReferenceLine 
                     y={data[data.length - 1].value} 
                     stroke={color} 
                     strokeDasharray="3 3" 
                     className={styles.beepingLine}
                   />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className={styles.statsFooter}>
        <div className={styles.footerStat}>
          <span>Current Total</span>
          <strong>{valuePrefix}{total.toLocaleString()}{valueSuffix}</strong>
        </div>
        <div className={styles.footerStat}>
          <span>24h Trend</span>
          <strong className={trend >= 0 ? styles.trendUp : styles.trendDown}>
            {trend >= 0 ? <TrendingUp size={14} style={{display:'inline', marginRight:4}} /> : <TrendingDown size={14} style={{display:'inline', marginRight:4}} />}
            {Math.abs(trend).toFixed(1)}%
          </strong>
        </div>
        <div className={styles.footerStat}>
          <span>Activity</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
             <Activity size={16} className={styles.liveDot} style={{ color: '#10b981' }} />
             <span style={{ fontSize: '0.85rem', color: '#fff', textTransform: 'none' }}>Active Stream</span>
          </div>
        </div>
      </div>
    </div>
  );
}
