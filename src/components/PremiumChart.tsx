'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Customized
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { TrendingUp, TrendingDown, Wifi } from 'lucide-react';
import styles from './PremiumChart.module.css';

interface DataPoint {
  time: string;
  value: number;
  raw_time: number;
  cumulative: number;
}

interface PremiumChartProps {
  title: string;
  subtitle?: string;
  /** Legacy prop — chart now self-fetches; passing this is still OK and will be merged */
  initialData?: { time?: string; created_at?: string; amount?: number; total_amount?: number; value?: number }[];
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

type Range = 'live' | '1h' | '24h' | '7d' | '30d';

const RANGE_HOURS: Record<Range, number | null> = {
  live: null,   // show all streaming points
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
  const { cx, cy, index, dataLength, color } = props;
  if (index !== dataLength - 1) return null;
  return <LiveDotRenderer cx={cx} cy={cy} color={color} />;
};

const CustomTooltip = ({ active, payload, label, valuePrefix, valueSuffix }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipLabel}>{label}</div>
      <div className={styles.tooltipVal}>
        {valuePrefix}{Number(payload[0].value).toLocaleString()}{valueSuffix}
      </div>
      {payload[1] && (
        <div className={styles.tooltipCum}>
          Cumulative: {valuePrefix}{Number(payload[1].value).toLocaleString()}{valueSuffix}
        </div>
      )}
    </div>
  );
};

export default function PremiumChart({
  title,
  subtitle,
  initialData = [],
  color = '#eb0c7a',
  height = 380,
  realtimeConfig,
  valuePrefix = '₦',
  valueSuffix = '',
}: PremiumChartProps) {
  const [data, setData] = useState<DataPoint[]>([]);
  const [range, setRange] = useState<Range>('24h');
  const [isLoading, setIsLoading] = useState(true);
  const [lastValue, setLastValue] = useState(0);
  const [flashNew, setFlashNew] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const gradId = `grad-${title.replace(/\s+/g, '')}`;

  // ── Build a DataPoint from a raw DB row ─────────────────────────────────
  const makePoint = useCallback((row: Record<string, any>, cumSoFar: number): DataPoint => {
    const ts = row.created_at || row.time || new Date().toISOString();
    const raw_time = new Date(ts).getTime();
    const value = Number(row[realtimeConfig?.valueKey ?? 'total_amount'] ?? row.amount ?? row.value ?? 0);
    return { time: formatTime(raw_time, range), value, raw_time, cumulative: cumSoFar + value };
  }, [range, realtimeConfig]);

  // ── Fetch historical data from Supabase ──────────────────────────────────
  const fetchHistory = useCallback(async () => {
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
          let cum = 0;
          const pts = rows.map((r: any) => {
            const p = makePoint(r, cum);
            cum = p.cumulative;
            return p;
          });
          setData(pts);
          setLastValue(pts[pts.length - 1]?.value ?? 0);
          setIsLoading(false);
          return;
        }
      }

      // Fallback: use passed-in initialData
      if (initialData.length > 0) {
        let cum = 0;
        const pts = initialData.map(d => {
          const ts = d.created_at || d.time || new Date().toISOString();
          const raw_time = new Date(ts).getTime();
          const value = Number(d.value ?? d.amount ?? d.total_amount ?? 0);
          cum += value;
          return {
            time: formatTime(raw_time, range),
            value,
            raw_time,
            cumulative: cum,
          };
        }).sort((a, b) => a.raw_time - b.raw_time);
        setData(pts);
        setLastValue(pts[pts.length - 1]?.value ?? 0);
      } else {
        setData([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [range, realtimeConfig, initialData, makePoint]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // ── Live subscription ────────────────────────────────────────────────────
  useEffect(() => {
    if (!realtimeConfig) return;

    const channelId = `chart-${realtimeConfig.table}-${title.replace(/\s+/g,'')}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: realtimeConfig.table,
        },
        (payload: { new: Record<string, any> }) => {
          const row = payload.new;

          // Check filter match client-side
          if (realtimeConfig.filter) {
            const match = Object.entries(realtimeConfig.filter).every(
              ([k, v]) => v === null || String(row[k]) === String(v)
            );
            if (!match) return;
          }

          const value = Number(row[realtimeConfig.valueKey] ?? 0);
          if (value <= 0) return;

          const now = Date.now();
          setData(prev => {
            const cum = (prev[prev.length - 1]?.cumulative ?? 0) + value;
            const newPt: DataPoint = {
              time: formatTime(now, 'live'),
              value,
              raw_time: now,
              cumulative: cum,
            };
            // Merge if within 3 seconds
            const last = prev[prev.length - 1];
            if (last && (now - last.raw_time < 3000)) {
              const updated = [...prev];
              updated[updated.length - 1] = {
                ...last,
                value: last.value + value,
                cumulative: last.cumulative + value,
              };
              return updated.slice(-200);
            }
            return [...prev, newPt].slice(-200);
          });

          setLastValue(value);
          setFlashNew(true);
          setTimeout(() => setFlashNew(false), 600);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realtimeConfig?.table, realtimeConfig?.valueKey, title]);

  // Auto-scroll to end on new live data
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [data.length]);

  const total = data.reduce((s, d) => s + d.value, 0);
  const first = data[0]?.value ?? 0;
  const last  = data[data.length - 1]?.value ?? 0;
  const pct   = first > 0 ? ((last - first) / first) * 100 : 0;
  const isUp  = pct >= 0;
  const chartColor = isUp ? color : '#ef4444';

  const minVal = data.length > 0 ? Math.min(...data.map(d => d.value)) * 0.95 : 0;
  const maxVal = data.length > 0 ? Math.max(...data.map(d => d.value)) * 1.05 : 100;

  // Tick count: ~6 evenly spaced Y labels
  const tickCount = 6;

  return (
    <div className={`${styles.container} ${flashNew ? styles.flashBorder : ''}`}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Last-price ticker */}
          <div className={`${styles.priceTicker} ${flashNew ? styles.tickerFlash : ''}`}>
            {valuePrefix}{lastValue.toLocaleString()}{valueSuffix}
          </div>
          <div className={styles.liveBadge}>
            <span className={styles.liveDot} />
            LIVE
          </div>
        </div>
      </div>

      {/* ── Range controls ── */}
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

      {/* ── Chart ── */}
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
                    <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={chartColor} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={chartColor} stopOpacity={0.01} />
                    </linearGradient>
                  </defs>

                  {/* ── Full grid — both vertical & horizontal ── */}
                  <CartesianGrid
                    strokeDasharray="4 4"
                    stroke="rgba(255,255,255,0.07)"
                    horizontal={true}
                    vertical={true}
                  />

                  <XAxis
                    dataKey="time"
                    stroke="#475569"
                    tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }}
                    tickLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                    axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                    minTickGap={50}
                    interval="preserveStartEnd"
                  />

                  <YAxis
                    domain={[minVal, maxVal]}
                    tickCount={tickCount}
                    stroke="#475569"
                    tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }}
                    tickLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                    axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                    tickFormatter={(v: number) => yFmt(v, valuePrefix)}
                    width={72}
                  />

                  <Tooltip
                    content={<CustomTooltip valuePrefix={valuePrefix} valueSuffix={valueSuffix} />}
                    cursor={{ stroke: 'rgba(255,255,255,0.15)', strokeWidth: 1, strokeDasharray: '4 4' }}
                  />

                  {/* Filled area */}
                  <Area
                    type="monotoneX"
                    dataKey="value"
                    stroke={chartColor}
                    strokeWidth={2}
                    fill={`url(#${gradId})`}
                    fillOpacity={1}
                    isAnimationActive={false}
                    dot={<CustomDot dataLength={data.length} color={chartColor} />}
                    activeDot={{ r: 5, fill: chartColor, strokeWidth: 0 }}
                  />

                  {/* Current-price horizontal reference line */}
                  {data.length > 0 && (
                    <ReferenceLine
                      y={last}
                      stroke={chartColor}
                      strokeDasharray="5 3"
                      strokeOpacity={0.7}
                      label={{
                        value: `${valuePrefix}${last.toLocaleString()}`,
                        position: 'right',
                        fill: chartColor,
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

      {/* ── Footer stats ── */}
      <div className={styles.statsFooter}>
        <div className={styles.footerStat}>
          <span>Period Volume</span>
          <strong>{valuePrefix}{total.toLocaleString()}{valueSuffix}</strong>
        </div>
        <div className={styles.footerStat}>
          <span>Latest Tx</span>
          <strong className={isUp ? styles.statUp : styles.statDown}>
            {valuePrefix}{last.toLocaleString()}{valueSuffix}
          </strong>
        </div>
        <div className={styles.footerStat}>
          <span>Trend</span>
          <strong className={isUp ? styles.statUp : styles.statDown}>
            {isUp ? '▲' : '▼'} {Math.abs(pct).toFixed(2)}%
          </strong>
        </div>
        <div className={styles.footerStat}>
          <span>Data Points</span>
          <strong>{data.length}</strong>
        </div>
      </div>
    </div>
  );
}
