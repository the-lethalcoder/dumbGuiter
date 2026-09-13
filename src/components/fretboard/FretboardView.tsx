'use client';

import React from 'react';
import { useSongStore } from '@/lib/store/useSongStore';
import { ChordToken } from '@/types/music';
import { midiToNoteName, INTERVAL_NAMES } from '@/lib/music/theory';

export const FretboardView: React.FC = () => {
  const { allEvents, activeChordIndex, fretboardLabelMode, setFretboardLabelMode, tuning, capo, isPlaying } = useSongStore();

  const currentEvent = allEvents[activeChordIndex] || allEvents[0];
  const isChord = currentEvent && currentEvent.type === 'chord';
  const chord = isChord ? (currentEvent as ChordToken) : null;
  const voicing = chord?.voicing || ['x', 3, 2, 0, 1, 0];

  // Determine fret offset (if high fret chord)
  const numericFrets = voicing.filter((f): f is number => typeof f === 'number' && f > 0);
  const minFret = numericFrets.length > 0 ? Math.min(...numericFrets) : 1;
  const maxFret = numericFrets.length > 0 ? Math.max(...numericFrets) : 3;

  const startFret = maxFret > 4 ? Math.max(1, minFret) : 1;
  const displayFretsCount = 5;
  const displayFrets = Array.from({ length: displayFretsCount }, (_, i) => startFret + i);

  const stringNames = tuning.notes; // ['E', 'A', 'D', 'G', 'B', 'E']

  return (
    <div className="glass-panel p-5 rounded-2xl flex flex-col items-center justify-between shadow-xl border border-white/10 w-full max-w-sm mx-auto">
      {/* Header Info */}
      <div className="w-full flex items-center justify-between mb-4 border-b border-white/10 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-black tracking-tight text-white glow-amber">
              {currentEvent ? (currentEvent.type === 'rest' ? 'No Chord (N.C.)' : (currentEvent as ChordToken).raw) : 'C'}
            </span>
            {currentEvent?.articulation === 'one_shot' && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                ONE-SHOT ★
              </span>
            )}
          </div>
          <span className="text-xs text-slate-400">
            {isChord ? `${chord?.root} ${chord?.quality || 'Major'} Voicing` : 'Rest / Silence'}
          </span>
        </div>

        {/* Marker Label Toggle (Note Name / Interval / Finger) */}
        <div className="flex bg-slate-900/90 rounded-lg p-0.5 border border-white/10 text-[10px]">
          <button
            onClick={() => setFretboardLabelMode('name')}
            className={`px-2 py-1 rounded font-bold transition-all ${
              fretboardLabelMode === 'name' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Notes
          </button>
          <button
            onClick={() => setFretboardLabelMode('interval')}
            className={`px-2 py-1 rounded font-bold transition-all ${
              fretboardLabelMode === 'interval' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Intervals
          </button>
        </div>
      </div>

      {/* Vertical Chord Box Diagram */}
      <div className="relative py-2 px-6 flex flex-col items-center select-none">
        {/* String Status Header (Open ○ or Muted ✕) */}
        <div className="grid grid-cols-6 gap-6 sm:gap-7 mb-2 text-center text-xs font-black">
          {voicing.map((fret, sIdx) => {
            const isMuted = fret === 'x';
            const isOpen = fret === 0;
            return (
              <div
                key={sIdx}
                className={`w-5 h-5 flex items-center justify-center rounded-full text-xs font-black transition-all ${
                  isMuted
                    ? 'text-rose-400 bg-rose-500/10 border border-rose-500/20'
                    : isOpen
                    ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 glow-cyan'
                    : 'text-transparent'
                }`}
              >
                {isMuted ? '✕' : isOpen ? '○' : ''}
              </div>
            );
          })}
        </div>

        {/* Guitar Nut / Base Offset Header */}
        <div className="w-[180px] sm:w-[210px] relative">
          {startFret === 1 ? (
            <div className="h-2.5 bg-gradient-to-r from-amber-200 via-amber-100 to-amber-200 rounded-t-sm shadow-md border-b-2 border-slate-950 mb-0.5" />
          ) : (
            <div className="flex justify-between items-center text-[11px] font-bold text-amber-400 mb-1 px-1">
              <span>Fret {startFret}</span>
              <span className="text-slate-500 text-[10px]">Position</span>
            </div>
          )}

          {/* Fretboard Grid */}
          <div className="relative border-x border-slate-500/40 bg-slate-900/60 rounded-b-md shadow-inner">
            {displayFrets.map((fretNum) => (
              <div
                key={fretNum}
                className="h-10 border-b border-slate-600/50 relative flex items-center justify-between"
              >
                {/* 6 Vertical Strings */}
                <div className="absolute inset-0 grid grid-cols-6 pointer-events-none">
                  {[0, 1, 2, 3, 4, 5].map((sIdx) => {
                    const isActive = isPlaying && typeof voicing[sIdx] === 'number';
                    const stringThickness = 1 + (5 - sIdx) * 0.4; // Low E is thicker
                    return (
                      <div key={sIdx} className="flex justify-center h-full">
                        <div
                          style={{ width: `${stringThickness}px` }}
                          className={`h-full transition-all duration-75 ${
                            isActive
                              ? 'bg-amber-400 shadow-[0_0_8px_#f59e0b]'
                              : 'bg-slate-400/60'
                          }`}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Finger Dots on this Fret */}
                <div className="absolute inset-0 grid grid-cols-6 z-10">
                  {voicing.map((fretVal, sIdx) => {
                    if (fretVal !== fretNum) return <div key={sIdx} />;

                    // Calculate Note Label
                    const midi = tuning.midiPitches[sIdx] + capo + fretNum;
                    const noteName = midiToNoteName(midi).replace(/\d+/, '');
                    const pc = midi % 12;
                    const intervalFromRoot = chord ? (pc - chord.rootPitchClass + 12) % 12 : 0;
                    const intervalLabel = INTERVAL_NAMES[intervalFromRoot] || `${intervalFromRoot}`;

                    const label = fretboardLabelMode === 'name' ? noteName : intervalLabel;
                    const isRoot = chord && pc === chord.rootPitchClass;

                    return (
                      <div key={sIdx} className="flex items-center justify-center">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shadow-lg transform transition-transform hover:scale-125 cursor-default ${
                            isRoot
                              ? 'bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 ring-2 ring-amber-400/80 shadow-amber-500/40'
                              : 'bg-gradient-to-tr from-sky-500 to-cyan-300 text-slate-950 ring-2 ring-cyan-300/80 shadow-cyan-500/30'
                          }`}
                        >
                          {label}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Fret marker dot on frets 3, 5, 7, 9 */}
                {[3, 5, 7, 9].includes(fretNum) && (
                  <div className="absolute -right-5 text-[9px] font-semibold text-slate-500">
                    {fretNum}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* String Tuning Footer */}
        <div className="grid grid-cols-6 gap-6 sm:gap-7 mt-2 text-center text-[11px] font-bold text-slate-400">
          {stringNames.map((name, idx) => (
            <span key={idx}>{name}</span>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="w-full pt-3 mt-2 border-t border-white/10 flex items-center justify-around text-[10px] text-slate-400">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block shadow-sm shadow-amber-400" />
          <span>Root Note</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block shadow-sm shadow-cyan-400" />
          <span>Chord Tone</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-emerald-400 font-bold">○</span>
          <span>Open String</span>
        </div>
      </div>
    </div>
  );
};
