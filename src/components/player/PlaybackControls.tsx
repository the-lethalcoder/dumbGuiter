'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  Square,
  Repeat,
  RotateCcw,
  Gauge,
  ArrowUp,
  ArrowDown,
  Volume2
} from 'lucide-react';
import { useSongStore } from '@/lib/store/useSongStore';
import { PRESET_PATTERNS } from '@/lib/audio/patterns';

export const PlaybackControls: React.FC = () => {
  const {
    isPlaying,
    togglePlay,
    stop,
    bpm,
    setBpm,
    loop,
    setLoop,
    strumPattern,
    setStrumPattern,
    transpose,
    transposeOffset
  } = useSongStore();

  // Tap tempo state
  const tapTimesRef = useRef<number[]>([]);
  const [tapActive, setTapActive] = useState(false);

  const handleTapTempo = () => {
    const now = performance.now();
    setTapActive(true);
    setTimeout(() => setTapActive(false), 150);

    const taps = tapTimesRef.current;
    // Reset taps if last tap was > 2 seconds ago
    if (taps.length > 0 && now - taps[taps.length - 1] > 2000) {
      tapTimesRef.current = [now];
      return;
    }

    taps.push(now);
    if (taps.length > 4) taps.shift();

    if (taps.length >= 2) {
      const intervals = [];
      for (let i = 1; i < taps.length; i++) {
        intervals.push(taps[i] - taps[i - 1]);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const calculatedBpm = Math.round(60000 / avgInterval);
      if (calculatedBpm >= 40 && calculatedBpm <= 240) {
        setBpm(calculatedBpm);
      }
    }
  };

  // Keyboard shortcut listener for spacebar play/pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in textarea or input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay]);

  return (
    <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-white/10 shadow-2xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Play / Pause / Stop Deck */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={togglePlay}
            className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-black text-sm transition-all shadow-lg transform active:scale-95 cursor-pointer ${
              isPlaying
                ? 'bg-amber-500 text-slate-950 shadow-amber-500/30 hover:bg-amber-400 ring-2 ring-amber-400'
                : 'bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 shadow-amber-500/20 hover:brightness-110'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-5 h-5 fill-current" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-5 h-5 fill-current ml-0.5" />
                <span>Play Chords</span>
              </>
            )}
          </button>

          <button
            onClick={stop}
            className="p-3 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/10 transition-colors"
            title="Stop and Reset"
          >
            <Square className="w-4 h-4 fill-current" />
          </button>

          <button
            onClick={() => setLoop(!loop)}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold border transition-all ${
              loop
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm shadow-cyan-500/20'
                : 'bg-slate-900/80 text-slate-500 border-white/10 hover:text-slate-300'
            }`}
          >
            <Repeat className="w-4 h-4" />
            <span className="hidden sm:inline">Loop</span>
          </button>
        </div>

        {/* Transpose Deck (- / +) */}
        <div className="flex items-center gap-2 bg-slate-900/80 px-3 py-2 rounded-xl border border-white/10">
          <span className="text-xs text-slate-400 font-bold">Key:</span>
          <button
            onClick={() => transpose(-1)}
            className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center text-xs font-bold transition-all"
            title="Transpose Down 1 Semitone"
          >
            -1
          </button>
          <span className="text-xs font-black font-mono text-amber-400 min-w-[32px] text-center">
            {transposeOffset > 0 ? `+${transposeOffset}` : transposeOffset}
          </span>
          <button
            onClick={() => transpose(1)}
            className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center text-xs font-bold transition-all"
            title="Transpose Up 1 Semitone"
          >
            +1
          </button>
        </div>

        {/* BPM & Tap Tempo */}
        <div className="flex items-center gap-3 bg-slate-900/80 px-4 py-2 rounded-xl border border-white/10">
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold text-white min-w-[55px] font-mono">
              {bpm} <span className="text-[10px] text-slate-400 font-normal">BPM</span>
            </span>
          </div>

          <input
            type="range"
            min={50}
            max={200}
            value={bpm}
            onChange={(e) => setBpm(parseInt(e.target.value, 10))}
            className="w-24 sm:w-32 accent-amber-500 cursor-pointer"
          />

          <button
            onClick={handleTapTempo}
            className={`px-2.5 py-1 rounded-lg text-xs font-extrabold uppercase transition-all ${
              tapActive
                ? 'bg-amber-400 text-slate-950 scale-105'
                : 'bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-400/20'
            }`}
          >
            Tap
          </button>
        </div>
      </div>

      {/* Strum Pattern Selector & Step Sequencer Visual */}
      <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400">Strum Pattern:</span>
          <select
            value={strumPattern.id}
            onChange={(e) => {
              const selected = PRESET_PATTERNS.find(p => p.id === e.target.value);
              if (selected) setStrumPattern(selected);
            }}
            className="bg-slate-900 text-amber-300 text-xs font-bold px-3 py-1.5 rounded-lg border border-white/10 outline-none cursor-pointer"
          >
            {PRESET_PATTERNS.map((p) => (
              <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* 8/16-Step Rhythm Visualizer */}
        <div className="flex items-center gap-1">
          {strumPattern.steps.map((step, sIdx) => {
            const isDown = step.direction === 'down';
            const isUp = step.direction === 'up';
            const isMute = step.direction === 'mute';
            const isRest = step.direction === 'rest';

            return (
              <div
                key={sIdx}
                className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-black select-none ${
                  isDown
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                    : isUp
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : isMute
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                    : 'bg-slate-900/60 text-slate-600 border border-white/5'
                }`}
                title={`Step ${sIdx + 1}: ${step.direction}`}
              >
                {isDown ? '↓' : isUp ? '↑' : isMute ? '✕' : '·'}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
