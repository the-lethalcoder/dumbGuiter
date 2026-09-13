'use client';

import React, { useEffect } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { FretboardView } from '@/components/fretboard/FretboardView';
import { ChordBuilder } from '@/components/builder/ChordBuilder';
import { ChordInput } from '@/components/editor/ChordInput';
import { PlaybackControls } from '@/components/player/PlaybackControls';
import { useSongStore } from '@/lib/store/useSongStore';
import { Volume2 } from 'lucide-react';

export default function Home() {
  const { activeTab, isPlaying, allEvents, activeChordIndex, setRawInput, initAudioClient } = useSongStore();
  const currentEvent = allEvents[activeChordIndex];

  // Initialize audio bindings and URL query param ?song= on initial mount
  useEffect(() => {
    initAudioClient();

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const sharedSong = params.get('song');
      if (sharedSong) {
        try {
          const decoded = decodeURIComponent(sharedSong);
          setRawInput(decoded);
        } catch {
          // Ignore malformed URL encoding
        }
      }
    }
  }, [initAudioClient, setRawInput]);

  return (
    <div className="min-h-screen flex flex-col justify-between">
      {/* Top Navbar */}
      <Navbar />

      {/* Main App Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Top Playing Banner (Active Chord Status) */}
        {isPlaying && (
          <div className="bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent border-l-4 border-amber-400 p-3 rounded-xl flex items-center justify-between animate-pulse">
            <div className="flex items-center gap-2.5">
              <Volume2 className="w-5 h-5 text-amber-400" />
              <span className="text-xs sm:text-sm font-extrabold text-white">
                Now Playing: <span className="text-amber-400 font-mono text-base ml-1">{currentEvent?.type === 'rest' ? 'No Chord (N.C.)' : currentEvent?.raw}</span>
              </span>
            </div>
            <span className="text-xs font-mono text-slate-400">
              Chord {activeChordIndex + 1} of {allEvents.length}
            </span>
          </div>
        )}

        {/* 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (8 cols): Interactive Chord Builder / Text Editor */}
          <div className="lg:col-span-8 space-y-6">
            {activeTab === 'builder' ? <ChordBuilder /> : <ChordInput />}
          </div>

          {/* Right Column (4 cols): Vertical Fretboard Chord Box Visualizer */}
          <div className="lg:col-span-4 sticky top-20">
            <FretboardView />
          </div>
        </div>
      </main>

      {/* Bottom Sticky Playback Controls Deck */}
      <footer className="sticky bottom-0 z-40 p-4 sm:p-6 bg-slate-950/90 backdrop-blur-xl border-t border-white/10">
        <div className="max-w-7xl mx-auto">
          <PlaybackControls />
        </div>
      </footer>
    </div>
  );
}
