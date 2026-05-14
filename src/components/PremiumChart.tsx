'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { TrendingUp, TrendingDown, Wifi } from 'lucide-react';
import styles from './PremiumChart.module.css';

export interface MultiLineConfig {
  keys: { dataKey: string; color: string; label: string; isProjected?: boolean }[];
  categorize: (row: any) => { dataKey: string; value: number }[];
}

interface DataPoint {
  time: string;
  raw_time: number;
  [key: string]: string | number; // dynamic keys for values
}

interface PremiumChartProps {
  title: string;
  subtitle?: string;
  initialData?: any[];
  height?: number;
  realtimeConfig?: {
    table: string;
    filter?: Record<string, string | number | boolean | null>;
  };
  multiLineConfig: MultiLineConfig;
  valuePrefix?: string;
  valueSuffix?: string;
  plotType?: 'cumulative' | 'individual'; // Plot running total or individual spikes
}

type Range = 'live' | '1h' | '24h' | '7d' | '30d';

const RANGE_HOURS: Record<Range, number | null> = {
  live: null,
  '1h': 1,
  '24h': 24,
  '7d': 168,
  '30d': 720,
};

function formatTime(raw: number, range: Range): string {
  const d = new Date(raw);
  if (range === 'live' || range === '1h') {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  if (range === '24h') {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function yFmt(val: number, prefix: string): string {
  if (val >= 1_000_000) return `${prefix}${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${prefix}${(val / 1_000).toFixed(1)}k`;
  return `${prefix}${val}`;
}

// ── Custom pulsing dot on the last data point ──────────────────────────────
const LiveDotRenderer = ({ cx, cy, color }: { cx?: number; cy?: number; color: string }) => {
  if (cx === undefined || cy === undefined) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={5} fill={color} />
      <circle cx={cx} cy={cy} r={10} fill="none" stroke={color} strokeOpacity={0.6} strokeWidth={1.5}>
        <animate attributeName="r" from="5" to="18" dur="1.5s" repeatCount="indefinite" />
        <animate attributeName="stroke-opacity" from="0.8" to="0" dur="1.5s" repeatCount="indefinite" />
      </circle>
    </g>
  );
};

const CustomDot = (props: any) => {
  const { cx, cy, index, dataLength, color, isProjected } = props;
  // Only pulse on the projected/main line to avoid chaos
  if (index !== dataLength - 1 || !isProjected) return null;
  return <LiveDotRenderer cx={cx} cy={cy} color={color} />;
};

const CustomTooltip = ({ active, payload, label, valuePrefix, valueSuffix, keys }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipLabel}>{label}</div>
      {payload.map((entry: any, i: number) => {
        const keyDef = keys.find((k: any) => k.dataKey === entry.dataKey);
        return (
          <div key={i} className={styles.tooltipVal} style={{ color: entry.color, fontSize: '0.9rem', marginBottom: '4px' }}>
            {keyDef?.label || entry.dataKey}: {valuePrefix}{Number(entry.value).toLocaleString()}{valueSuffix}
          </div>
        );
      })}
    </div>
  );
};

export default function PremiumChart({
  title,
  subtitle,
  initialData = [],
  height = 380,
  realtimeConfig,
  multiLineConfig,
  valuePrefix = '₦',
  valueSuffix = '',
  plotType = 'cumulative'
}: PremiumChartProps) {
  const [data, setData] = useState<DataPoint[]>([]);
  const [range, setRange] = useState<Range>('30d');
  const [isLoading, setIsLoading] = useState(true);
  const [flashNew, setFlashNew] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const propsRef = useRef({ multiLineConfig, realtimeConfig, initialData, plotType, title });
  useEffect(() => {
    propsRef.current = { multiLineConfig, realtimeConfig, initialData, plotType, title };
  }, [multiLineConfig, realtimeConfig, initialData, plotType, title]);

  // Initialize running totals object based on keys
  const getInitTally = useCallback(() => {
    const init: Record<string, number> = {};
    propsRef.current.multiLineConfig.keys.forEach(k => init[k.dataKey] = 0);
    return init;
  }, []);

  // ── Build DataPoints from raw DB rows ─────────────────────────────────
  const processRows = useCallback((rows: any[]) => {
    const { multiLineConfig, plotType } = propsRef.current;
    let tally = getInitTally();
    const sorted = [...rows].sort((a, b) => {
      const ta = new Date(a.created_at || a.time || 0).getTime();
      const tb = new Date(b.created_at || b.time || 0).getTime();
      return ta - tb;
    });

    const pts: DataPoint[] = [];
    
    sorted.forEach(r => {
      const ts = r.created_at || r.time || new Date().toISOString();
      const raw_time = new Date(ts).getTime();
      
      const changes = multiLineConfig.categorize(r);
      if (changes.length === 0) return;

      const point: DataPoint = { time: formatTime(raw_time, range), raw_time };
      
      // Update tallies
      changes.forEach(c => {
        tally[c.dataKey] = (tally[c.dataKey] || 0) + c.value;
      });

      // Write values to point based on plotType
      multiLineConfig.keys.forEach(k => {
        if (plotType === 'cumulative') {
          point[k.dataKey] = tally[k.dataKey];
        } else {
          // Find if this specific row changed this key
          const chg = changes.find(c => c.dataKey === k.dataKey);
          point[k.dataKey] = chg ? chg.value : 0;
        }
      });

      pts.push(point);
    });

    return pts;
  }, [range, getInitTally]);

  // ── Fetch historical data ──────────────────────────────────
  const realtimeConfigStr = JSON.stringify(realtimeConfig);
  const initialDataLen = initialData.length;

  const fetchHistory = useCallback(async () => {
    const { realtimeConfig, initialData } = propsRef.current;
    setIsLoading(true);
    try {
      if (realtimeConfig) {
        const hours = RANGE_HOURS[range];
        let q = supabase
          .from(realtimeConfig.table)
          .select('*')
          .order('created_at', { ascending: true });

        if (hours !== null) {
          const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();
          q = q.gte('created_at', since);
        }

        if (realtimeConfig.filter) {
          for (const [k, v] of Object.entries(realtimeConfig.filter)) {
            if (v !== null && v !== undefined) {
              q = (q as any).eq(k, v);
            }
          }
        }

        const { data: rows } = await q.limit(500);
        if (rows && rows.length > 0) {
          setData(processRows(rows));
          setIsLoading(false);
          return;
        }
      }

      if (initialData.length > 0) {
        setData(processRows(initialData));
      } else {
        setData([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [range, realtimeConfigStr, initialDataLen, processRows]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // ── Live subscription ────────────────────────────────────────────────────
  useEffect(() => {
    const { realtimeConfig, title } = propsRef.current;
    if (!realtimeConfig) return;

    const channelId = `chart-${realtimeConfig.table}-${title.replace(/\s+/g,'')}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: realtimeConfig.table },
        (payload: { new: Record<string, any> }) => {
          const row = payload.new;
          const { realtimeConfig: currentRealtime, multiLineConfig, plotType } = propsRef.current;

          if (currentRealtime?.filter) {
            const match = Object.entries(currentRealtime.filter).every(
              ([k, v]) => v === null || String(row[k]) === String(v)
            );
            if (!match) return;
          }

          const changes = multiLineConfig.categorize(row);
          if (changes.length === 0) return;

          const now = Date.now();
          setData(prev => {
            const pts = [...prev];
            const lastTally = getInitTally();
            
            // Get current running totals from the last point
            if (pts.length > 0 && plotType === 'cumulative') {
              const lastPt = pts[pts.length - 1];
              multiLineConfig.keys.forEach(k => {
                lastTally[k.dataKey] = Number(lastPt[k.dataKey] || 0);
              });
            }

            // Apply new changes
            changes.forEach(c => lastTally[c.dataKey] += c.value);

            const newPt: DataPoint = { time: formatTime(now, 'live'), raw_time: now };
            
            multiLineConfig.keys.forEach(k => {
              if (plotType === 'cumulative') {
                newPt[k.dataKey] = lastTally[k.dataKey];
              } else {
                const chg = changes.find(c => c.dataKey === k.dataKey);
                newPt[k.dataKey] = chg ? chg.value : 0;
              }
            });

            // Merge if within 3 seconds
            const last = pts[pts.length - 1];
            if (last && (now - last.raw_time < 3000)) {
               if (plotType === 'cumulative') {
                 // Replace last point with updated tallies
                 pts[pts.length - 1] = { ...last, ...newPt };
               } else {
                 // Add values together
                 const merged = { ...last };
                 multiLineConfig.keys.forEach(k => {
                   merged[k.dataKey] = Number(last[k.dataKey] || 0) + Number(newPt[k.dataKey] || 0);
                 });
                 pts[pts.length - 1] = merged;
               }
               return pts.slice(-200);
            }
            return [...pts, newPt].slice(-200);
          });

          setFlashNew(true);
          setTimeout(() => setFlashNew(false), 600);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realtimeConfig?.table, title, getInitTally]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
  }, [data.length]);

  const lastPoint = data[data.length - 1] || {};
  
  // Find min/max across all keys for YAxis domain
  let minVal = 0;
  let maxVal = 100;
  if (data.length > 0) {
    const allVals = data.flatMap(d => multiLineConfig.keys.map(k => Number(d[k.dataKey] || 0)));
    minVal = Math.min(...allVals) * 0.95;
    maxVal = Math.max(...allVals) * 1.05;
  }

  // Get the main metric for the ticker (use the 'isProjected' key, or the first key)
  const mainKey = multiLineConfig.keys.find(k => k.isProjected) || multiLineConfig.keys[0];
  const lastMainValue = Number(lastPoint[mainKey.dataKey] || 0);
  
  const firstPoint = data[0] || {};
  const firstMainValue = Number(firstPoint[mainKey.dataKey] || 0);
  const pct = firstMainValue > 0 ? ((lastMainValue - firstMainValue) / firstMainValue) * 100 : 0;
  const isUp = pct >= 0;

  return (
    <div className={`${styles.container} ${flashNew ? styles.flashBorder : ''}`}>
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className={`${styles.priceTicker} ${flashNew ? styles.tickerFlash : ''}`}>
            {valuePrefix}{lastMainValue.toLocaleString()}{valueSuffix}
          </div>
          <div className={styles.liveBadge}>
            <span className={styles.liveDot} />
            LIVE
          </div>
        </div>
      </div>

      <div className={styles.rangeRow}>
        <div className={styles.chartControls}>
          {(['live', '1h', '24h', '7d', '30d'] as Range[]).map(r => (
            <button
              key={r}
              className={`${styles.controlBtn} ${range === r ? styles.controlActive : ''}`}
              onClick={() => setRange(r)}
            >
              {r.toUpperCase()}
            </button>
          ))}
        </div>
        <div className={`${styles.trendPill} ${isUp ? styles.trendUp : styles.trendDown}`}>
          {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {Math.abs(pct).toFixed(2)}%
        </div>
      </div>

      <div className={styles.chartArea} style={{ height }}>
        {isLoading ? (
          <div className={styles.loadingState}>
            <Wifi size={28} style={{ opacity: 0.3 }} />
            <span>Loading market data…</span>
          </div>
        ) : data.length === 0 ? (
          <div className={styles.loadingState}>
            <span>No transactions yet — chart will update live.</span>
          </div>
        ) : (
          <div className={styles.scrollContainer} ref={scrollRef}>
            <div
              className={styles.chartInner}
              style={{ width: data.length > 30 ? `${data.length * 28}px` : '100%', minWidth: '100%' }}
            >
              <ResponsiveContainer width="100%" height={height}>
                <ComposedChart data={data} margin={{ top: 16, right: 24, left: 8, bottom: 0 }}>
                  <defs>
                    {multiLineConfig.keys.map(k => (
                      <linearGradient key={`grad-${k.dataKey}`} id={`grad-${k.dataKey}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={k.color} stopOpacity={k.isProjected ? 0.35 : 0.15} />
                        <stop offset="100%" stopColor={k.color} stopOpacity={0.01} />
                      </linearGradient>
                    ))}
                  </defs>

                  <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.07)" />

                  <XAxis
                    dataKey="time"
                    stroke="#475569"
                    tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }}
                    tickLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                    axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                    minTickGap={50}
                  />

                  <YAxis
                    domain={[minVal, maxVal]}
                    tickCount={6}
                    stroke="#475569"
                    tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }}
                    tickLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                    axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                    tickFormatter={(v: number) => yFmt(v, valuePrefix)}
                    width={72}
                  />

                  <Tooltip
                    content={<CustomTooltip valuePrefix={valuePrefix} valueSuffix={valueSuffix} keys={multiLineConfig.keys} />}
                    cursor={{ stroke: 'rgba(255,255,255,0.15)', strokeWidth: 1, strokeDasharray: '4 4' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace', paddingTop: '10px' }} />

                  {multiLineConfig.keys.map(k => (
                    k.isProjected ? (
                      <Area
                        key={k.dataKey}
                        type="monotoneX"
                        dataKey={k.dataKey}
                        name={k.label}
                        stroke={k.color}
                        strokeWidth={2}
                        fill={`url(#grad-${k.dataKey})`}
                        isAnimationActive={false}
                        dot={<CustomDot dataLength={data.length} color={k.color} isProjected={true} />}
                        activeDot={{ r: 5, fill: k.color, strokeWidth: 0 }}
                      />
                    ) : (
                      <Line
                        key={k.dataKey}
                        type="monotoneX"
                        dataKey={k.dataKey}
                        name={k.label}
                        stroke={k.color}
                        strokeWidth={1.5}
                        dot={false}
                        isAnimationActive={false}
                      />
                    )
                  ))}

                  {/* Reference line for the main metric */}
                  {data.length > 0 && (
                    <ReferenceLine
                      y={lastMainValue}
                      stroke={mainKey.color}
                      strokeDasharray="5 3"
                      strokeOpacity={0.7}
                      label={{
                        value: `${valuePrefix}${lastMainValue.toLocaleString()}`,
                        position: 'right',
                        fill: mainKey.color,
                        fontSize: 10,
                        fontFamily: 'monospace',
                        fontWeight: 700,
                      }}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      <div className={styles.statsFooter}>
        {multiLineConfig.keys.slice(0, 4).map(k => (
          <div key={k.dataKey} className={styles.footerStat}>
            <span>{k.label}</span>
            <strong style={{ color: k.color }}>
              {valuePrefix}{Number(lastPoint[k.dataKey] || 0).toLocaleString()}{valueSuffix}
            </strong>
          </div>
        ))}
      </div>
    </div>
  );
}
