'use client';

import React, { useState } from 'react';
import { useSongStore } from '@/lib/store/useSongStore';
import { AlertCircle, HelpCircle, FileText, CheckCircle2, Mic2, Edit3, Share2, Check } from 'lucide-react';
import { ChordToken } from '@/types/music';
import { LyricDisplay } from './LyricDisplay';

export const ChordInput: React.FC = () => {
  const { rawInput, setRawInput, allEvents, isPlaying } = useSongStore();
  const [viewMode, setViewMode] = useState<'edit' | 'stream'>('edit');
  const [copied, setCopied] = useState(false);

  const invalidTokens = allEvents.filter(e => e.type === 'chord' && !(e as ChordToken).isValid) as ChordToken[];

  const handleShare = () => {
    try {
      const encoded = encodeURIComponent(rawInput);
      const url = `${window.location.origin}/?song=${encoded}`;
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="space-y-4">
      {/* Sub-Header / Mode Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-2xl border border-white/10">
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-white/10">
          <button
            onClick={() => setViewMode('edit')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'edit'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            Edit Song Text
          </button>
          <button
            onClick={() => setViewMode('stream')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'stream'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Mic2 className="w-3.5 h-3.5" />
            Live Lyrics Stream
          </button>
        </div>

        {/* Share Link Button */}
        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs border border-amber-400/20 transition-all cursor-pointer"
          title="Copy shareable link with current song"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
          <span>{copied ? 'Link Copied!' : 'Share Song'}</span>
        </button>
      </div>

      {viewMode === 'stream' ? (
        <LyricDisplay />
      ) : (
        <>
          {/* Text Editor Box */}
          <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-extrabold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-400" />
                Raw Song Sheet Editor
              </label>
              <span className="text-xs text-slate-400">
                Auto-parses chords, lyrics, durations `(2)`, one-shots `*`, and `N.C.`
              </span>
            </div>

            <textarea
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              rows={13}
              placeholder="Type or paste chords, chords-over-lyrics, or ChordPro text here...
Example:
[Verse 1]
C                 G
When I find myself in times of trouble
Am            F*
Mother Mary comes to me"
              className="w-full bg-slate-950/80 text-amber-300 font-mono text-xs sm:text-sm p-4 rounded-xl border border-white/10 focus:border-amber-400/80 focus:ring-2 focus:ring-amber-500/20 outline-none resize-y leading-relaxed"
            />

            {/* Status / Errors Banner */}
            {invalidTokens.length > 0 ? (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-2.5 text-xs text-amber-300">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                <div>
                  <span className="font-bold">Unrecognized chord symbols detected:</span>
                  <ul className="mt-1 list-disc list-inside space-y-0.5 text-slate-300">
                    {invalidTokens.map((t, idx) => (
                      <li key={idx}>
                        <span className="font-mono text-amber-400 font-bold">{t.raw}</span> — {t.errorMessage || 'Invalid chord notation'}
                      </li>
                    ))}
                  </ul>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    (Playback will play a muted ghost strum for unrecognized chords to preserve timing).
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                All {allEvents.length} chord events successfully parsed & voiced
              </div>
            )}
          </div>

          {/* Syntax Guide Card */}
          <div className="glass-panel p-4 rounded-xl border border-white/10 text-xs text-slate-300 space-y-2">
            <h4 className="font-bold text-white flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
              Supported Formats & Syntax
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
              <div className="bg-slate-900/60 p-2.5 rounded-lg border border-white/5 space-y-1">
                <span className="font-bold text-amber-400">1. Chords & Durations</span>
                <p className="text-slate-400 font-mono">C(4) G(2) Am7(2) F*(4)</p>
                <p className="text-slate-400">Appended <code className="text-amber-300 font-bold">*</code> means one-shot single strum.</p>
              </div>
              <div className="bg-slate-900/60 p-2.5 rounded-lg border border-white/5 space-y-1">
                <span className="font-bold text-amber-400">2. Rests & Repeats</span>
                <p className="text-slate-400 font-mono">N.C.(2) % x2 [Chorus]</p>
                <p className="text-slate-400"><code className="text-amber-300 font-bold">N.C.</code> = silence, <code className="text-amber-300 font-bold">%</code> = repeat previous bar.</p>
              </div>
              <div className="bg-slate-900/60 p-2.5 rounded-lg border border-white/5 space-y-1">
                <span className="font-bold text-amber-400">3. Chords Over Lyrics</span>
                <p className="text-slate-400 font-mono">G&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Em<br/>Wise men say only fools</p>
              </div>
              <div className="bg-slate-900/60 p-2.5 rounded-lg border border-white/5 space-y-1">
                <span className="font-bold text-amber-400">4. Inline ChordPro</span>
                <p className="text-slate-400 font-mono">[G]Wise men [Em]say only fools</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
