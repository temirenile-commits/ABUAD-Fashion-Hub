'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Trophy, TrendingUp, MapPin, ArrowLeft, Loader2, Medal, Activity } from 'lucide-react';

interface UniversityRanking {
  id: string;
  name: string;
  abbreviation: string;
  logo_url: string;
  monthly_revenue: number;
}

export default function RankingsPage() {
  const [rankings, setRankings] = useState<UniversityRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRankings() {
      try {
        const res = await fetch('/api/universities?action=rankings');
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
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-[#eb0c7a] animate-spin" />
          <p className="text-gray-400 font-medium">Calculating monthly rankings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      {/* Header Section */}
      <div className="relative h-[300px] flex items-center justify-center overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-b from-[#eb0c7a]/20 to-transparent pointer-events-none" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none" />
        
        <div className="max-w-4xl w-full px-6 relative z-10 text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-8 group">
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            Back to Marketplace
          </Link>
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-[#eb0c7a]/10 rounded-2xl border border-[#eb0c7a]/20">
              <Trophy className="text-[#eb0c7a]" size={32} />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tight">University <span className="text-[#eb0c7a]">Leaderboard</span></h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Live rankings based on monthly transaction volume and sales velocity across all campuses.
          </p>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {error ? (
          <div className="p-8 bg-red-500/10 border border-red-500/20 rounded-2xl text-center">
            <p className="text-red-400 font-medium">{error}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-6 mb-6 text-sm font-bold text-gray-500 uppercase tracking-widest">
              <span>Campus Rankings</span>
              <span>Monthly Volume</span>
            </div>

            {rankings.map((uni, index) => {
              const isTop3 = index < 3;
              const medalColor = index === 0 ? '#f59e0b' : index === 1 ? '#94a3b8' : '#b45309';
              
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
                        <span className="text-2xl font-black text-gray-700">#{index + 1}</span>
                      )}
                      <span className={`text-xl font-black relative ${isTop3 ? 'text-white' : 'text-gray-400'}`}>
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
                          <MapPin size={24} className="text-gray-500" />
                        )}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold group-hover:text-[#eb0c7a] transition-colors">{uni.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs font-bold text-[#eb0c7a] bg-[#eb0c7a]/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
                            {uni.abbreviation}
                          </span>
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                             <Activity size={12} /> Active Ecosystem
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Revenue Stats */}
                  <div className="text-right">
                    <div className="text-xl md:text-2xl font-black text-white tabular-nums">
                      ₦{uni.monthly_revenue.toLocaleString()}
                    </div>
                    <div className="flex items-center justify-end gap-1 text-xs font-bold text-green-500 mt-1 uppercase tracking-tighter">
                      <TrendingUp size={12} /> Live Growth
                    </div>
                  </div>
                </div>
              );
            })}

            {rankings.length === 0 && (
              <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-3xl">
                <p className="text-gray-500 font-medium">No universities are currently active in the rankings.</p>
              </div>
            )}
          </div>
        )}

        <footer className="mt-20 text-center">
          <p className="text-sm text-gray-600">
            Ratings are updated in real-time. Calculated based on delivered orders since the 1st of the current month.
          </p>
        </footer>
      </main>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
        body {
          font-family: 'Inter', sans-serif;
          background: #050505;
        }
      `}</style>
    </div>
  );
}
