'use client';

import React, { useEffect, useRef } from 'react';
import { useSongStore } from '@/lib/store/useSongStore';
import { ChordToken } from '@/types/music';
import { Mic2 } from 'lucide-react';

export const LyricDisplay: React.FC = () => {
  const { songAst, activeChordIndex, isPlaying } = useSongStore();
  const activeLineRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to active lyric line during playback
  useEffect(() => {
    if (isPlaying && activeLineRef.current) {
      activeLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeChordIndex, isPlaying]);

  let globalChordCounter = 0;

  return (
    <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-4 max-h-[500px] overflow-y-auto">
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
          <Mic2 className="w-4 h-4 text-amber-400" />
          Synchronized Lyrics & Chord Stream
        </h3>
        <span className="text-xs text-slate-400">
          Karaoke-style line tracking during playback
        </span>
      </div>

      <div className="space-y-6 font-mono text-sm leading-relaxed">
        {songAst.sections.map((section) => (
          <div key={section.id} className="space-y-3">
            <div className="text-xs uppercase font-extrabold text-amber-400 tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              {section.name}
            </div>

            {section.lyrics && section.lyrics.length > 0 ? (
              <div className="space-y-3 pl-3 border-l-2 border-white/10">
                {section.lyrics.map((line, lIdx) => {
                  let lineHasActiveChord = false;

                  const renderedSegments = line.segments.map((seg, sIdx) => {
                    const hasChord = Boolean(seg.chord);
                    let isCurrentChord = false;

                    if (hasChord) {
                      const chordIdx = globalChordCounter++;
                      isCurrentChord = isPlaying && activeChordIndex === chordIdx;
                      if (isCurrentChord) lineHasActiveChord = true;
                    }

                    return (
                      <span key={sIdx} className="inline-block mr-1">
                        {seg.chord && (
                          <span
                            className={`block text-xs font-bold transition-all ${
                              isCurrentChord
                                ? 'text-amber-400 font-extrabold scale-110 drop-shadow-[0_0_8px_#f59e0b]'
                                : 'text-cyan-300/80 font-semibold'
                            }`}
                          >
                            {seg.chord.raw}
                          </span>
                        )}
                        <span className={`${isCurrentChord ? 'text-white font-bold bg-amber-500/20 px-0.5 rounded' : 'text-slate-300'}`}>
                          {seg.text}
                        </span>
                      </span>
                    );
                  });

                  return (
                    <div
                      key={lIdx}
                      ref={lineHasActiveChord ? activeLineRef : null}
                      className={`p-2 rounded-xl transition-colors ${
                        lineHasActiveChord ? 'bg-amber-500/10 border-l-2 border-amber-400' : ''
                      }`}
                    >
                      <div className="flex flex-wrap items-end">{renderedSegments}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Fallback if no lyrics were parsed */
              <div className="flex flex-wrap gap-2 pl-3">
                {section.events.map((ev) => {
                  const chordIdx = globalChordCounter++;
                  const isCurrent = isPlaying && activeChordIndex === chordIdx;
                  return (
                    <span
                      key={ev.id}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        isCurrent
                          ? 'bg-amber-500 text-slate-950 border-amber-400 scale-105 shadow-md shadow-amber-500/30'
                          : 'bg-slate-900 text-slate-300 border-white/10'
                      }`}
                    >
                      {ev.raw}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
