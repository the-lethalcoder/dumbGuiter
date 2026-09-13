'use client';

import React, { useState } from 'react';
import { Plus, Trash2, Volume2, Star, Sparkles, MoveRight, Music } from 'lucide-react';
import { useSongStore } from '@/lib/store/useSongStore';
import { ChordToken, RestToken } from '@/types/music';

const QUICK_CHORDS = ['C', 'G', 'Am', 'F', 'Em', 'Dm', 'D', 'A', 'E', 'Bm', 'C7', 'G7', 'F#m', 'Bb', 'N.C.'];

export const ChordBuilder: React.FC = () => {
  const {
    songAst,
    allEvents,
    activeChordIndex,
    setActiveChordIndex,
    updateChordToken,
    addChordToSection,
    removeChordFromSection,
    addSection,
    removeSection,
    isPlaying
  } = useSongStore();

  const [editingChordId, setEditingChordId] = useState<string | null>(null);
  const [customInput, setCustomInput] = useState('');
  const [activeSectionForAdd, setActiveSectionForAdd] = useState<string | null>(null);

  // Map global index for each event
  let globalIndexCounter = 0;

  return (
    <div className="space-y-6">
      {/* Builder Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-2xl border border-white/10">
        <div>
          <h2 className="text-base font-extrabold text-white flex items-center gap-2">
            <Music className="w-4 h-4 text-amber-400" />
            Canonical Chord Timeline
          </h2>
          <p className="text-xs text-slate-400">
            Click any chord to preview fretboard, toggle duration, or mark as one-shot (<span className="text-amber-400 font-bold">*</span>)
          </p>
        </div>

        <button
          onClick={() => addSection(`Section ${songAst.sections.length + 1}`)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition-all cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Section
        </button>
      </div>

      {/* Sections List */}
      <div className="space-y-5">
        {songAst.sections.map((section) => (
          <div
            key={section.id}
            className="glass-panel p-4 sm:p-5 rounded-2xl border border-white/10 space-y-4"
          >
            {/* Section Bar */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span className="font-extrabold text-sm text-white tracking-wide uppercase">
                  {section.name}
                </span>
                <span className="text-xs text-slate-500 font-semibold">
                  ({section.events.length} {section.events.length === 1 ? 'chord' : 'chords'})
                </span>
              </div>

              {songAst.sections.length > 1 && (
                <button
                  onClick={() => removeSection(section.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                  title="Delete section"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Chord Chips Row */}
            <div className="flex flex-wrap gap-2.5 items-center">
              {section.events.map((event) => {
                const currentGlobalIdx = globalIndexCounter++;
                const isCurrentPlaying = isPlaying && activeChordIndex === currentGlobalIdx;
                const isSelected = activeChordIndex === currentGlobalIdx;
                const isRest = event.type === 'rest';
                const chord = isRest ? null : (event as ChordToken);

                return (
                  <div
                    key={event.id}
                    onClick={() => setActiveChordIndex(currentGlobalIdx)}
                    className={`group relative flex flex-col items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer min-w-[85px] sm:min-w-[95px] select-none ${
                      isCurrentPlaying
                        ? 'bg-amber-500/20 border-amber-400 shadow-lg shadow-amber-500/30 scale-105'
                        : isSelected
                        ? 'bg-slate-800/90 border-amber-400/80 shadow-md'
                        : 'bg-slate-900/80 border-white/10 hover:border-white/30 hover:bg-slate-800/60'
                    }`}
                  >
                    {/* Delete Chord Icon (on hover) */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeChordFromSection(section.id, event.id);
                      }}
                      className="absolute -top-1.5 -right-1.5 opacity-0 group-hover:opacity-100 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center text-xs shadow-md transition-opacity hover:scale-110"
                    >
                      ×
                    </button>

                    {/* Chord Symbol / Name */}
                    <div className="flex items-center gap-1 mb-1.5">
                      <span className={`text-base font-black tracking-tight ${
                        isRest ? 'text-slate-400 italic' : isCurrentPlaying ? 'text-amber-300' : 'text-white'
                      }`}>
                        {isRest ? 'N.C.' : chord?.raw}
                      </span>

                      {/* One-Shot Indicator Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (chord) {
                            const newArt = chord.articulation === 'one_shot' ? 'strum_pattern' : 'one_shot';
                            updateChordToken(section.id, chord.id, { articulation: newArt });
                          }
                        }}
                        className={`p-0.5 rounded transition-all ${
                          event.articulation === 'one_shot'
                            ? 'text-amber-400 bg-amber-400/20'
                            : 'text-slate-600 hover:text-amber-400'
                        }`}
                        title="Toggle One-Shot Ringing Strum (*)"
                      >
                        <Star className="w-3 h-3 fill-current" />
                      </button>
                    </div>

                    {/* Duration / Beats Selector */}
                    <div className="flex items-center justify-between w-full pt-1.5 border-t border-white/10 text-[10px]">
                      <select
                        value={event.durationBeats}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          const beats = parseFloat(e.target.value);
                          if (chord) {
                            updateChordToken(section.id, chord.id, { durationBeats: beats });
                          }
                        }}
                        className="bg-slate-950/80 text-amber-400 font-bold px-1.5 py-0.5 rounded border border-white/10 outline-none cursor-pointer"
                      >
                        <option value={1}>1 bt</option>
                        <option value={2}>2 bts</option>
                        <option value={3}>3 bts</option>
                        <option value={4}>4 bts (1 bar)</option>
                        <option value={6}>6 bts</option>
                        <option value={8}>8 bts (2 bars)</option>
                      </select>

                      <span className="text-[9px] text-slate-400 font-medium">
                        {event.articulation === 'one_shot' ? '1-Shot' : 'Rhythm'}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Add Chord Trigger Button */}
              <button
                onClick={() => setActiveSectionForAdd(activeSectionForAdd === section.id ? null : section.id)}
                className="flex items-center gap-1 px-3 py-3 rounded-xl border border-dashed border-white/20 hover:border-amber-400/60 bg-slate-900/40 hover:bg-amber-500/10 text-slate-400 hover:text-amber-300 font-bold text-xs transition-all"
              >
                <Plus className="w-4 h-4" />
                Add Chord
              </button>
            </div>

            {/* Quick Chord Palette Popover */}
            {activeSectionForAdd === section.id && (
              <div className="mt-3 p-3 bg-slate-950/90 rounded-xl border border-amber-500/30 shadow-xl animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    Pick a Quick Chord or Type Any Symbol
                  </span>
                  <button
                    onClick={() => setActiveSectionForAdd(null)}
                    className="text-xs text-slate-500 hover:text-white"
                  >
                    Done ✕
                  </button>
                </div>

                {/* Quick Chords Grid */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {QUICK_CHORDS.map((qChord) => (
                    <button
                      key={qChord}
                      onClick={() => {
                        addChordToSection(section.id, `${qChord}(4)`);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-amber-500 hover:text-slate-950 text-slate-200 font-bold text-xs border border-white/10 transition-all cursor-pointer"
                    >
                      {qChord}
                    </button>
                  ))}
                </div>

                {/* Custom Chord Input */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && customInput.trim()) {
                        addChordToSection(section.id, customInput.trim());
                        setCustomInput('');
                      }
                    }}
                    placeholder="e.g. F#m7(b5)*, Cmaj9(2), D/F#(4)"
                    className="flex-1 bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-mono border border-white/10 focus:border-amber-400 outline-none"
                  />
                  <button
                    onClick={() => {
                      if (customInput.trim()) {
                        addChordToSection(section.id, customInput.trim());
                        setCustomInput('');
                      }
                    }}
                    className="px-3 py-1.5 bg-amber-500 text-slate-950 font-bold text-xs rounded-lg hover:bg-amber-400 transition-all"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
