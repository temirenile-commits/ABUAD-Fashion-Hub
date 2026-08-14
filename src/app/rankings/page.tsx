'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Trophy, TrendingUp, MapPin, ArrowLeft, Loader2, Medal, Activity, Globe } from 'lucide-react';
import PremiumChart from '@/components/PremiumChart';

interface UniversityRanking {
  id: string;
  name: string;
  abbreviation: string;
  logo_url: string;
  monthly_revenue: number;
  gmv: number;
  order_count: number;
  sales_volume: number;
  vendor_activity: number;
  growth: number;
}

export default function RankingsPage() {
  const [rankings, setRankings] = useState<UniversityRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rangeKey, setRangeKey] = useState<'today' | '7d' | '30d' | '3m' | '6m' | '12m'>('30d');

  useEffect(() => {
    async function fetchRankings() {
      setLoading(true);
      try {
        const res = await fetch(`/api/universities?action=rankings&range=${rangeKey}`);
        const data = await res.json();
        if (data.rankings) {
          setRankings(data.rankings);
        } else {
          setError(data.error || 'Failed to load rankings');
        }
      } catch (err) {
        setError('Connection error. Please try again later.');
      } finally {
        setLoading(false);
      }
    }
    fetchRankings();
  }, [rangeKey]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#000000] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-[#000000] animate-spin" />
          <p className="text-muted font-medium">Calculating monthly rankings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#000000] text-white">
      {/* Header Section */}
      <div className="relative pt-20 pb-12 flex items-center justify-center overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-b from-[#000000]/10 to-transparent pointer-events-none" />
        
        <div className="max-w-6xl w-full px-6 relative z-10">
          <div className="flex flex-col md:flex-row gap-12 items-center">
            <div className="flex-1 text-left">
              <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted hover:text-white transition-colors mb-8 group">
                <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                Back to Marketplace
              </Link>
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-[#000000]/10 rounded-2xl border border-[#000000]/20">
                  <Trophy className="text-[#000000]" size={32} />
                </div>
                <div className="bg-primary-soft text-status text-[10px] font-black px-3 py-1 rounded-full flex items-center gap-2 uppercase tracking-widest border border-primary">
                  <span className="w-2 h-2 bg-primary rounded-full animate-pulse" /> Live Economy
                </div>
              </div>
              <h1 className="text-5xl md:text-6xl font-black mb-4 tracking-tight leading-none">University <br /><span className="text-[#000000]">Leaderboard</span></h1>
              <p className="text-muted text-lg max-w-md">
                Transparent campus rankings based on eligible marketplace GMV, order volume, vendor activity, and period-over-period growth.
              </p>
            </div>

            <div className="w-full md:w-[500px] rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <div className="flex items-center justify-between mb-5">
                <div><h2 className="font-black text-lg">Campus GMV</h2><p className="text-xs text-muted">Database-calculated marketplace volume</p></div>
                <Globe size={20} className="text-[#000000]" />
              </div>
              <div className="space-y-4">
                {rankings.slice(0, 5).map((row, index) => {
                  const maxGmv = Math.max(...rankings.map((item) => Number(item.gmv || 0)), 1);
                  return <div key={row.id}>
                    <div className="flex justify-between text-xs mb-1"><span className="font-bold">{index + 1}. {row.abbreviation || row.name}</span><span className="text-muted">₦{Number(row.gmv || 0).toLocaleString()}</span></div>
                    <div className="h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-[#000000]" style={{ width: `${Math.max(2, (Number(row.gmv || 0) / maxGmv) * 100)}%` }} /></div>
                  </div>;
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {error ? (
          <div className="p-8 bg-primary-soft border border-primary rounded-2xl text-center">
            <p className="text-status font-medium">{error}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-6 mb-6 text-sm font-bold text-muted uppercase tracking-widest">
              <span>Campus Rankings</span>
              <div className="flex items-center gap-2">
                {([['today', 'Today'], ['7d', '7 Days'], ['30d', '30 Days'], ['3m', '3 Months'], ['6m', '6 Months'], ['12m', '12 Months']] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setRangeKey(value)} className="normal-case tracking-normal px-2 py-1 rounded-lg border" style={{ borderColor: rangeKey === value ? '#000000' : 'rgba(255,255,255,0.1)', color: rangeKey === value ? '#000000' : undefined }}>{label}</button>)}
              </div>
            </div>

            {rankings.map((uni, index) => {
              const isTop3 = index < 3;
              const medalColor = index === 0 ? '#FFFFFF' : index === 1 ? '#FFFFFF' : '#000000';
              
              return (
                <div 
                  key={uni.id} 
                  className={`group relative flex items-center justify-between p-6 rounded-3xl border transition-all duration-300 hover:scale-[1.01] ${
                    isTop3 
                      ? 'bg-gradient-to-r from-white/5 to-transparent border-white/10 hover:border-white/20' 
                      : 'bg-transparent border-white/5 hover:border-white/10'
                  }`}
                >
                  <div className="flex items-center gap-6">
                    {/* Rank Indicator */}
                    <div className="relative flex items-center justify-center w-12 h-12">
                      {isTop3 ? (
                        <Medal size={40} style={{ color: medalColor }} className="absolute opacity-20" />
                      ) : (
                        <span className="text-2xl font-black text-muted">#{index + 1}</span>
                      )}
                      <span className={`text-xl font-black relative ${isTop3 ? 'text-white' : 'text-muted'}`}>
                        {index + 1}
                      </span>
                    </div>

                    {/* Uni Info */}
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-center overflow-hidden p-1">
                        {uni.logo_url ? (
                          <div style={{ position: 'relative', width: 48, height: 48 }}>
                             <img src={uni.logo_url} alt={uni.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                          </div>
                        ) : (
                          <MapPin size={24} className="text-muted" />
                        )}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold group-hover:text-[#000000] transition-colors">{uni.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs font-bold text-[#000000] bg-[#000000]/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
                            {uni.abbreviation}
                          </span>
                          <span className="text-xs text-muted flex items-center gap-1">
                             <Activity size={12} /> Active Ecosystem
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Revenue Stats */}
                  <div className="text-right">
                    <div className="text-xl md:text-2xl font-black text-white tabular-nums">
                      ₦{Number(uni.gmv || 0).toLocaleString()}
                    </div>
                    <div className="flex items-center justify-end gap-2 text-xs font-bold text-status mt-1 uppercase tracking-tighter">
                      <span>{Number(uni.order_count || 0).toLocaleString()} orders</span>
                      <span className={Number(uni.growth || 0) >= 0 ? 'text-status' : 'text-muted'}>{Number(uni.growth || 0) >= 0 ? '+' : ''}{Number(uni.growth || 0).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              );
            })}

            {rankings.length === 0 && (
              <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-3xl">
                <p className="text-muted font-medium">No universities are currently active in the rankings.</p>
              </div>
            )}
          </div>
        )}

        <footer className="mt-20 text-center">
          <p className="text-sm text-muted">
            Rankings use eligible paid and fulfilment orders within the selected period. GMV, orders, sales volume, vendor activity, and growth are calculated in the database.
          </p>
        </footer>
      </main>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
        body {
          font-family: 'Inter', sans-serif;
          background: #000000;
        }
      `}</style>
    </div>
  );
}
