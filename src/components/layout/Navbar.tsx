'use client';

import React from 'react';
import { Guitar, Music2, Sparkles, BookOpen, SlidersHorizontal } from 'lucide-react';
import { useSongStore, SAMPLE_SONGS } from '@/lib/store/useSongStore';
import { GUITAR_TUNINGS } from '@/lib/music/tunings';

export const Navbar: React.FC = () => {
  const { capo, setCapo, tuning, setTuning, loadSampleSong, activeTab, setActiveTab } = useSongStore();

  return (
    <header className="sticky top-0 z-50 w-full glass-panel border-b border-white/10 px-4 py-3 sm:px-6">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center shadow-lg shadow-amber-500/20 text-slate-950 font-black">
            <Guitar className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xl tracking-tight text-white flex items-center gap-1">
                dumb<span className="text-amber-400">Guiter</span>
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-400 border border-amber-400/20">
                PWA v2.0
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">Type any chord progression, hear realistic guitar strumming</p>
          </div>
        </div>

        {/* View Tabs */}
        <div className="flex items-center bg-slate-900/80 p-1 rounded-xl border border-white/10">
          <button
            onClick={() => setActiveTab('builder')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'builder'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Chord Builder
          </button>
          <button
            onClick={() => setActiveTab('text')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'text'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Text / Song Sheet
          </button>
        </div>

        {/* Global Controls: Tuning, Capo, Sample Songs */}
        <div className="flex items-center gap-3">
          {/* Sample Songs Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-900/80 px-2.5 py-1.5 rounded-lg border border-white/10 text-xs">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <select
              className="bg-transparent text-slate-200 outline-none cursor-pointer text-xs font-medium"
              onChange={(e) => {
                if (e.target.value) {
                  loadSampleSong(e.target.value);
                  e.target.value = '';
                }
              }}
              defaultValue=""
            >
              <option value="" disabled className="bg-slate-900 text-slate-400">⚡ Sample Songs</option>
              {Object.entries(SAMPLE_SONGS).map(([key, song]) => (
                <option key={key} value={key} className="bg-slate-900 text-white">
                  {song.title}
                </option>
              ))}
            </select>
          </div>

          {/* Capo Selector */}
          <div className="flex items-center gap-1.5 bg-slate-900/80 px-2.5 py-1.5 rounded-lg border border-white/10 text-xs">
            <span className="text-slate-400 font-medium">Capo:</span>
            <select
              value={capo}
              onChange={(e) => setCapo(parseInt(e.target.value, 10))}
              className="bg-transparent text-amber-400 font-bold outline-none cursor-pointer"
            >
              {[0, 1, 2, 3, 4, 5, 6, 7].map(c => (
                <option key={c} value={c} className="bg-slate-900 text-white">
                  {c === 0 ? 'None (0)' : `Fret ${c}`}
                </option>
              ))}
            </select>
          </div>

          {/* Tuning Selector */}
          <div className="flex items-center gap-1.5 bg-slate-900/80 px-2.5 py-1.5 rounded-lg border border-white/10 text-xs hidden md:flex">
            <Music2 className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={tuning.id}
              onChange={(e) => setTuning(e.target.value)}
              className="bg-transparent text-slate-200 font-medium outline-none cursor-pointer max-w-[130px] truncate"
            >
              {Object.values(GUITAR_TUNINGS).map(t => (
                <option key={t.id} value={t.id} className="bg-slate-900 text-white">
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </header>
  );
};
