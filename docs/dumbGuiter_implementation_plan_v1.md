# Architecture & Implementation Plan: Chord-to-Guitar Playback Web App ("dumbGuiter")

A client-side Progressive Web App (PWA) built with Next.js, TypeScript, and Tone.js / Web Audio API that transforms arbitrary chord progressions and chord-over-lyric text into realistic, expressive acoustic guitar playback with real-time fretboard visualization.


---

## 1. Architecture Overview

### Major Modules & Data Flow

```
                      [ User Input ]
          (Raw text: "C G Am F", Chords-over-Lyrics,
           or annotated tokens e.g. "C(4) G(2) D/F#(2)")
                             │
                             ▼
              ┌──────────────────────────────┐
              │     1. Chord Parser &        │
              │     Lyrics Extractor         │
              │  - Regex / Tokenizer         │
              │  - Music Theory Interval Set │
              │  - Enharmonic Normalizer     │
              └──────────────┬───────────────┘
                             │
                      Parsed Song AST
               (Array of ChordEvents + Lyrics)
                             │
                             ▼
              ┌──────────────────────────────┐
              │    2. Voicing Generator      │
              │  - Common Shape Table Lookup │
              │  - Algorithmic Fallback      │
              │    (Branch-and-Bound Search) │
              │  - Tuning / Capo Offsetter   │
              └──────────────┬───────────────┘
                             │
                 Voiced Timeline Sequence
           (Fret array: [x, 3, 2, 0, 1, 0], Note pitches)
                             │
                             ▼
              ┌──────────────────────────────┐
              │   3. Strum & Rhythm Engine   │
              │  - Pattern Expander (D-DU..) │
              │  - Micro-timing Humanizer    │
              │  - Velocity / Stroke Shaper  │
              └──────────────┬───────────────┘
                             │
                    Scheduled Audio Events
                             │
              ┌──────────────┴───────────────┐
              ▼                              ▼
┌───────────────────────────┐  ┌───────────────────────────┐
│   4. Tone.js Audio Engine │  │     5. UI / Visualizer    │
│  - Multi-Sample Sampler   │  │  - Tone.Draw sync loop    │
│  - Polyphonic Synthesis   │  │  - Interactive Fretboard  │
│  - Spatial/Reverb Chain   │  │  - Chord & Lyric Scroller │
│  - ServiceWorker Cache    │  │  - Transport Timeline Bar │
└───────────────────────────┘  └───────────────────────────┘
```

### Module Responsibilities

1. **Chord Parser & Lyric Extractor (`@/lib/music/parser`)**:
   - Takes arbitrary text input.
   - Detects whether lines are chord lines, lyric lines, or mixed chord-over-lyric lines.
   - Deconstructs chord symbols into `{ root, quality, intervals, bass, durationBeats, error }`.
   - Computes absolute pitch classes (0–11 relative to C) for any arbitrary jazz or extended chord.

2. **Voicing Engine (`@/lib/music/voicing`)**:
   - Maps pitch-class requirements and optional bass override to a 6-string guitar fretboard.
   - Prioritizes an ergonomic lookup table of standard open and barre shapes.
   - Falls back to an algorithmic branch-and-bound fret search when encountering complex/unregistered chords (e.g. `C7#9b13`, `F#m(maj7)`), minimizing physical hand span and muting invalid notes.

3. **Strum & Rhythm Engine (`@/lib/audio/strum`)**:
   - Transforms a static chord event into individual string pluck events over time.
   - Applies downstroke (`D`), upstroke (`U`), muted chuck (`x`), or rest (`-`) patterns.
   - Applies physical strum duration (e.g., 20–40ms sweep across 6 strings), non-linear velocity profiles, and slight humanized micro-jitter.

4. **Audio Engine (`@/lib/audio/engine`)**:
   - Orchestrates `Tone.Transport`, `Tone.Sampler` (or physical modeling fallback), dynamic low-pass filters for picking dynamics, and a subtle acoustic room reverb.
   - Uses `Tone.Draw` to bridge the Web Audio high-priority audio clock with the browser's 60/120fps UI render cycle without causing audio dropouts or visual jitter.

5. **State & Reactive UI (`@/components/*`)**:
   - Next.js (App Router, Client Components) with custom reactive state stores (Zustand or lightweight React context).
   - Renders the interactive chord editor, real-time animated fretboard, playback controls, transpose wheel, and chord error highlights.

---

## 2. Chord Input & Parsing

### Supported Input Formats

1. **Inline / Compact Chord Progression**:
   ```
   C G Am F
   C(4) G(2) Am(2) F(4)
   | Cmaj7 . . . | Am9 . . . | Dm7 . G7(b9) . | C6/9 . . . |
   ```
2. **Chords Over Lyrics (Ultimate-Guitar / ChordPro style)**:
   ```
   [Verse 1]
   G                 Em
   Wise men say only fools rush in
   C   G   D     Em    C       G   D    G
   But I can't help falling in love with you
   ```
3. **ChordPro Tags**:
   ```
   [G]Wise men [Em]say only [C]fools [G]rush [D]in
   ```

### Detection & Line Classification Heuristic

When plain text is pasted, each line is scanned:
1. **Header/Metadata line**: Starts with `[` (e.g., `[Verse 1]`, `[Chorus]`, `{title: ...}`).
2. **Chord line**: A line where >70% of non-whitespace tokens match the chord token grammar, and the character density consists largely of whitespace separating short uppercase-prefixed tokens.
3. **Lyric line**: A line that does not qualify as a chord line.
4. **Interleaved Pair**: When a Chord line is immediately followed by a Lyric line, the column indices of chord tokens are matched to character indices in the lyrics below, anchoring chord transitions to exact syllables.

```typescript
interface ParsedChordToken {
  raw: string;                 // e.g. "F#m7(b5)/C(2)"
  root: NoteLetter;            // "F#"
  rootPitchClass: number;      // 0..11 (0=C, 1=C#, 6=F#)
  quality: ChordQuality;       // "min", "maj", "dim", "aug", "sus2", "sus4", "5", etc.
  extensions: number[];        // [7]
  alterations: Alteration[];   // [{ interval: 5, semitoneOffset: -1 }] -> b5
  addedNotes: number[];        // []
  intervals: number[];         // Relative semitones from root: [0, 3, 6, 10]
  pitchClasses: number[];      // Absolute pitch classes: [6, 9, 0, 4]
  bassNote?: NoteLetter;       // "C"
  bassPitchClass?: number;     // 0
  durationBeats: number;       // Default: 4 (or parsed from "(2)")
  columnOffset: number;        // Position in line for lyric alignment
  isValid: boolean;
  errorMessage?: string;
}
```

### Comprehensive Parsing Grammar

The parser uses a deterministic recursive-descent / modular regex tokenizer:

1. **Root**: `^([A-Ga-g])([#b♯♭]?)`
2. **Quality / Core**:
   - Major: `maj`, `M`, `Δ`, `major`, or empty
   - Minor: `m`, `min`, `-`, `minor`
   - Diminished: `dim`, `o`, `°`, `diminished`
   - Half-Diminished: `m7b5`, `ø`, `half-dim`
   - Augmented: `aug`, `+`
   - Suspended: `sus`, `sus4`, `sus2`
   - Power: `5`
3. **Extensions & Additions**:
   - `6`, `7`, `maj7`, `M7`, `9`, `maj9`, `11`, `13`
   - `add9`, `add2`, `add11`, `add4`, `add6`
4. **Alterations**:
   - `(b5)`, `(-5)`, `(#5)`, `(+5)`, `(b9)`, `(#9)`, `(#11)`, `(b13)`
   - Multiple alterations enclosed in parentheses or sequential: e.g. `7#9b13`, `7alt`
5. **Slash Bass**:
   - `\/([A-Ga-g][#b♯♭]?)`
6. **Explicit Duration Annotation**:
   - `\((\d+(\.\d+)?)\)` or `\/(\d+)` indicating beat count, e.g., `Am7(2)` = 2 beats.

### Malformed Token Behavior (Never Fails Silently)

- If a token resembles a chord but violates grammar (e.g. `Hmaj7`, `C#m9(xyz)`, `G??`):
  - Token is flagged with `isValid: false` and `errorMessage: "Unrecognized root 'H' / invalid extension 'xyz'"`.
  - In the UI, the token is rendered with a distinct **amber/red wavy underline** and an interactive tooltip explaining the parse error.
  - In playback, the audio engine plays a soft, muted percussive strum ("ghost chord") rather than crashing the scheduler or falling silent, preserving the song's rhythmic continuity while drawing the user's attention.

---

## 3. Chord-to-Voicing Mapping

### Guitar Fretboard Model

- Standard 6-string tuning: `[E2 (40), A2 (45), D3 (50), G3 (55), B3 (59), E4 (64)]` (MIDI note numbers).
- Fret range: 0 (open) to 15.
- A voicing is represented as `type Voicing = (number | 'x')[]`, a 6-element tuple where `'x'` denotes a muted/unplayed string.

### Primary Path: Curated Common-Shape Library

For the vast majority of pop, rock, and standard chords (Open C, A, G, E, D, Barre forms, Drop-D/C forms, common 7ths), a fast lookup table provides hand-curated voicings designed for maximum acoustic resonance (open strings) and natural voice leading.

```typescript
const COMMON_VOICINGS: Record<string, Voicing[]> = {
  "C:maj": [
    ['x', 3, 2, 0, 1, 0], // Standard open C
    ['x', 3, 5, 5, 5, 3], // A-shape barre on 3rd fret
    [8, 10, 10, 9, 8, 8], // E-shape barre on 8th fret
  ],
  "G:maj": [
    [3, 2, 0, 0, 0, 3],
    [3, 2, 0, 0, 3, 3],
    [3, 5, 5, 4, 3, 3],
  ],
  // ... comprehensive library for open/barre 6ths, 7ths, 9ths, sus, dims
};
```

### Fallback Path: Algorithmic Branch-and-Bound Fret Search

When an arbitrary or rare chord is provided (e.g. `Eb13b9`, `Dmaj7#11/F#`), the engine executes an algorithmic search over the fretboard:

```
                      [ Pitch Classes Needed: {2, 6, 8, 11}, Bass: 6 ]
                                             │
                       For each string (6 down to 1):
                       Find valid frets (0..12) matching any required PC
                                             │
                        ┌────────────────────┴───────────────────┐
                        ▼                                        ▼
                  Open Strings (fret 0)                   Fretted (fret 1..12)
                                             │
                             Branch across 6 string combinations
                             Prune branch if:
                             - Frets span > 4 frets (impossible finger stretch)
                             - Missing required bass note on lowest sounding string
                             - Requires > 4 distinct non-barre fingers
                                             │
                                     Calculate Cost Score
                                             │
                                  Select Lowest Cost Voicing
```

#### Cost Scoring Heuristic Function:

$$\text{Score} = w_1 \cdot \text{Span} + w_2 \cdot \text{MutedCount} + w_3 \cdot \text{FretHeight} + w_4 \cdot \text{MissingTones} + w_5 \cdot \text{BarreDifficulty}$$

1. **Fret Span Penalty**: $(\max(\text{fretted}) - \min(\text{fretted})) \times 15$. Disqualify if span $> 4$ (excluding open strings).
2. **Bass Note Match**: Lowest sounding string MUST match requested bass note. If bass note is incorrect: penalty $+500$.
3. **Core Pitch Completeness**:
   - Root & 3rd are essential (penalty $+300$ if omitted).
   - 7th / Extension essential for extended chords (penalty $+200$ if omitted).
   - 5th is optional (permitted omission for 9th/11th/13th jazz chords, penalty $+10$).
4. **Physical Ergonomics**:
   - Prefer lower frets ($1 \le \text{fret} \le 5$) for acoustic warmth: $+2$ per fret index.
   - Reward open strings ($+0$ cost vs fretted).
   - Barre detection: If multiple strings share the same index fret, allow 1 index finger barre.

### Extensibility: Capo & Alternate Tunings

- The fretboard is abstracted as an array of base MIDI pitches: `tuning: [number, number, number, number, number, number]`.
- **Capo**: Simply shifts base tuning by $+N$ semitones. Voicing calculation runs against transposed fret offsets or virtual nut.
- **Alternate Tunings (Drop D, DADGAD, Open G)**: Simply modifies the base string array. The algorithmic search operates natively on any string tuning without code changes.

---

## 4. Audio Rendering Approach

### Comparative Analysis

| Feature | Option A: Physical Modeling (Karplus-Strong) | Option B: Multi-Sample Sampler (Tone.Sampler) |
| :--- | :--- | :--- |
| **Timbre Realism** | Synthetic, slightly metallic/hollow; lacks acoustic body resonance. | **Authentic acoustic warmth, true wooden body resonance, real pick attack.** |
| **Asset Overhead** | **0 KB** (Pure synthesis code). | **~2.5 MB** (High-quality compact MP3/OGG soundbank). |
| **Voicing Flexibility** | Infinite pitch range. | Full 88-key / full guitar range via bounded multi-sampling. |
| **Dynamic Articulations**| Easy algorithmic damping. | Dynamic filters (Tone.Filter) + velocity layers. |
| **Offline Support** | Instantaneous. | Pre-cached via Service Worker in CacheStorage. |

### Recommendation for v1: Option B (Multi-Sample Tone.Sampler with Filter Dynamics)

**Why Option B is the best choice:**
1. **The "Wow" Factor**: Acoustic guitar playback lives or dies on timbre. Karplus-Strong sounds like a 90s synth or harpsichord; users will immediately find it artificial. A curated 16-sample acoustic guitar pack (sampled at key intervals across the register, e.g. E2, G2, C3, E3, G3, C4, E4, A4) gives an authentic steel-string sound while weighing only **under 2.5 MB**.
2. **Offline & Performance**: With modern PWA caching (Service Worker `CacheStorage`), the audio samples download once in under 500ms and remain accessible indefinitely offline.
3. **Expressiveness**: We pair `Tone.Sampler` with dynamic low-pass envelope filtering (`Tone.Filter`) to naturally dull gentle upstrokes and brighten crisp accented downstrokes.

#### Upgrading / Fallback Strategy:
- Build a unified `GuitarAudioDriver` interface.
- Implement `SampledGuitarDriver` as the primary engine.
- Implement `KarplusStrongGuitarDriver` as a lightweight zero-network fallback or selectable "Synth Mode" in settings.

---

## 5. Strumming & Timing Engine

### Micro-Timing & Strum Simulation

A human guitar strum is not a single simultaneous chord hit; the pick glides across 6 strings over **15 to 45 milliseconds**.

```
Downstroke (D): String 6 (E2) ──► 5 (A2) ──► 4 (D3) ──► 3 (G3) ──► 2 (B3) ──► 1 (E4)
                t=0ms          t=6ms       t=12ms      t=18ms      t=24ms      t=30ms

Upstroke (U):   String 1 (E4) ──► 2 (B3) ──► 3 (G3) ──► 4 (D3) ──► 5 (A2) (often stops at 4/5)
                t=0ms          t=5ms       t=10ms      t=15ms      t=20ms
```

### Strum Modeling Parameters

1. **Strum Duration**: Dynamically scaled by tempo:
   $$\Delta t_{\text{strum}} = \text{clamp}\left(40\text{ms} \times \frac{120}{\text{BPM}}, 15\text{ms}, 50\text{ms}\right)$$
2. **Velocity Profiles**:
   - **Downstroke (`D`)**: Louder low strings ($v \approx 0.85$), tapering slightly towards high strings ($v \approx 0.75$).
   - **Upstroke (`U`)**: Louder treble strings ($v \approx 0.75$), softer bass strings ($v \approx 0.55$).
   - **Accent (`>`)**: Boost velocity by $+25\%$.
   - **Chuck / Muted (`x`)**: Play transient with high damping / 10ms envelope decay.
3. **Humanization**: Add pseudo-random Gaussian jitter ($\pm 2.5\text{ms}$ time jitter, $\pm 5\%$ velocity jitter) so playback never sounds robotic.

### Tone.js Transport Integration & Thread Safety

- **Sample-Accurate Audio**: All notes are scheduled into `Tone.Transport` using musical time coordinates (e.g. `"0:1:2"` for measure:beat:sixteenth) with `Tone.Transport.scheduleRepeat` or pre-buffered `Tone.Part`.
- **UI Synchronization without Stutters**:
  - The Web Audio thread runs isolated from the UI thread.
  - We use `Tone.Draw.schedule(() => setActiveChordIndex(i), time)` so DOM state updates execute synchronously on `requestAnimationFrame` at the exact instant the audio note reaches the speakers.

### Strum Patterns & Time Signatures

- Patterns represented as 16th-note subdivision strings:
  - 4/4 Pop Standard: `D - - - D - D U - U D - - U D U` (or simplified `D - D U - U D U`)
  - 4/4 Folk/Ballad: `D - D - D - D U`
  - 3/4 Waltz: `D - - D U - D U -`
  - 6/8 Slow Rock: `D - - D - - D - - D - -`
  - Straight Quarter: `D - - - D - - - D - - - D - - -`
- **User Customization**: Interactive 8/16-step grid editor where users click to toggle Down (`↓`), Up (`↑`), Mute (`✕`), or Rest (`·`) with dynamic velocity sliders.

---

## 6. UI/UX Design

### Layout & Key Views

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🎸 dumbGuiter                     [ Capo: 0 ▼ ] [ Tuning: Standard ▼ ] [ ⚙ ]│
├─────────────────────────────────────────────────────────────────────────────┤
│ ┌───────────────────────────────┐ ┌───────────────────────────────────────┐ │
│ │  INPUT & EDITOR               │ │  INTERACTIVE FRETBOARD VISUALIZER     │ │
│ │                               │ │  Nut   Fret 1   Fret 2   Fret 3       │ │
│ │  [ C(4) G(4) Am(4) F(4)     ] │ │  E ||───○───|───────|───────| (Open)  │ │
│ │  [ Paste lyrics & chords... ] │ │  B ||───●───|───────|───────| (Fret 1)│ │
│ │                               │ │  G ||───○───|───────|───────| (Open)  │ │
│ │  Parsed Timeline:             │ │  D ||───────|───●───|───────| (Fret 2)│ │
│ │  [  C   ][  G   ][ Am  ][ F ] │ │  A ||───────|───────|───●───| (Fret 3)│ │
│ │   4 bts   4 bts   4 bts  4 bts│ │  E ||───✕───|───────|───────| (Muted) │ │
│ └───────────────────────────────┘ └───────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────────┤
│  PLAYBACK CONTROLS                                                          │
│  [ ▶ Play ] [ ⏸ Pause ] [ 🔁 Loop ]  Tempo: [ 120 BPM ━●━━━ ] [ Tap Tempo ] │
│  Transpose: [ -1 ] [ C ] [ +1 ]   Pattern: [ Pop 4/4 (D-DU-UDU) ▼ ] [ Edit ]│
│                                                                             │
│  [=============================●==========================================] │
│   Measure 1: Cmaj               Measure 2: Gmaj               Measure 3...  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Breakdown

1. **Header**: Clean, modern dark mode glassmorphism navbar, Capo selector (0–7), Tuning selector, PWA install prompt button.
2. **Chord & Lyric Editor**:
   - Split view / tabbed input: "Smart Text Paste" vs "Interactive Timeline Blocks".
   - Syntax-highlighted chord tags over lyrics.
   - Real-time inline error badges for invalid chord symbols.
3. **Interactive Fretboard Visualizer**:
   - SVG-rendered 6-string fretboard with animated string vibrations on strum.
   - Distinct color-coded finger markers showing Note Names (`C`, `E`, `G`), Interval Numbers (`R`, `3`, `5`), or Fingerings (`1`, `2`, `3`).
   - Open string indicators (`○`), muted string indicators (`✕`), and barre indicators.
4. **Transport & Control Deck**:
   - Big, tactile Play/Pause button (Spacebar hotkey).
   - High-precision BPM slider with Tap Tempo button.
   - Semitone Transpose buttons (`-` / `+`) that instantaneously re-parse and transpose all chords without altering lyric alignment.
   - Preset strum pattern dropdown with quick-edit step sequencer popover.

---

## 7. Edge Cases & Resilience Strategy

| Edge Case | Failure Mode / Challenge | Mitigation Strategy |
| :--- | :--- | :--- |
| **Unrecognized Chord Symbol** (e.g. `Hmaj7`, `C#blabla`) | App could crash or fail silently. | Parser catches syntax error, marks chord token `isValid: false`, renders amber badge in editor, and plays a percussive muted chord stroke in audio to preserve beat timing. |
| **Enharmonic Spelling** (e.g. `C#` vs `Db`, `D#m` vs `Ebm`) | Pitch class collisions or lookup misses. | Normalized internally to integer pitch classes ($0 \le k \le 11$). Display names preserve the user's preferred key accidental (flat vs sharp) based on detected key signature. |
| **Rapid Chord Changes** (< 1 beat, e.g., two chords in 1 beat) | Strum sweeps overlap or stutter audio buffer. | Sub-beat scheduler compresses strum sweep duration to $\le 50\%$ of available duration so consecutive strokes never collide. |
| **Unfingerable Voicing** (Complex jazz chord with 6 distinct non-barre notes) | Hand cannot physically play notes. | Voicing algorithm automatically drops the 5th (standard jazz guitar practice) and prioritizes Root, 3rd, 7th, and highest Extension; warns user via subtle icon if root had to be omitted. |
| **Empty or Whitespace Input** | Runtime crashes on empty array. | Fallback to friendly starter template ("Let It Be" or "Standard 12-Bar Blues in E") with prompt button "Try an example". |
| **Extremely Long Song** (500+ lines / 30-minute setlist) | Memory leak / DOM lag on UI sync. | Virtualized timeline rendering (React Window / Virtualizer); dynamic Tone.js event scheduling in rolling 8-measure chunks rather than pushing 10,000 events upfront. |
| **Audio Context Autoplay Restriction** | Browser blocks audio before user gesture. | Standard Web Audio unlock overlay ("Click anywhere to enable sound") triggered on first play. |

---

## 8. Project File & Folder Structure (Next.js App Router)

```
dumbGuiter/
├── docs/                          # Architecture & design documentation
│   └── implementation_plan.md
├── public/
│   ├── audio/
│   │   └── acoustic-guitar/       # Compact multi-sample soundbank (E2..E4 .mp3)
│   ├── icons/                     # PWA icons (192x192, 512x512)
│   ├── manifest.json              # PWA manifest
│   └── sw.js                      # Service Worker for offline audio caching
├── src/
│   ├── app/
│   │   ├── layout.tsx             # Root layout, fonts, meta tags
│   │   ├── page.tsx               # Main application container
│   │   └── globals.css            # Dark mode tokens, animations, custom utilities
│   ├── components/
│   │   ├── editor/
│   │   │   ├── ChordInput.tsx     # Text area & chord-over-lyric parser input
│   │   │   ├── ChordTimeline.tsx  # Interactive chord block sequencer
│   │   │   └── LyricDisplay.tsx   # Synced scrolling lyrics view
│   │   ├── fretboard/
│   │   │   ├── FretboardView.tsx  # SVG 6-string fretboard
│   │   │   ├── FretMarker.tsx     # Note badge with interval/finger labels
│   │   │   └── StringVibration.tsx# CSS string pluck animation
│   │   ├── player/
│   │   │   ├── PlaybackControls.tsx # Play/pause, tempo, loop
│   │   │   ├── StrumPatternEditor.tsx # 16-step rhythm grid editor
│   │   │   └── TransposeControl.tsx # Key transposer (-/+ semitones)
│   │   └── ui/                    # Reusable modern UI elements (Buttons, Sliders, Modals)
│   ├── lib/
│   │   ├── audio/
│   │   │   ├── AudioEngine.ts     # Master Tone.js orchestrator & audio graph
│   │   │   ├── SamplerDriver.ts   # Multi-sample soundfont loader & player
│   │   │   ├── SynthDriver.ts     # Karplus-Strong physical modeling fallback
│   │   │   ├── StrumScheduler.ts  # Micro-timing stroke generator
│   │   │   └── patterns.ts        # Built-in strumming patterns library
│   │   ├── music/
│   │   │   ├── parser.ts          # Chord & lyric text parser / tokenizer
│   │   │   ├── theory.ts          # Intervals, pitch classes, transpositions
│   │   │   ├── voicings.ts        # Common chord shape dictionary
│   │   │   ├── searchVoicing.ts   # Algorithmic fretboard search engine
│   │   │   └── tunings.ts         # Standard, Drop-D, DADGAD, Open-G definitions
│   │   └── store/
│   │       └── useSongStore.ts    # Central Zustand state (progression, playback, tempo)
│   ├── hooks/
│   │   ├── useAudioPlayer.ts      # React hook binding Tone.js to UI state
│   │   └── usePWA.ts              # Service worker registration & install hook
│   └── types/
│       ├── audio.ts               # Types for audio scheduling & drivers
│       └── music.ts               # Types for chords, voicings, notes, patterns
├── next.config.mjs
├── tsconfig.json
├── package.json
└── README.md
```

---

## 9. Explicit Non-Goals for v1

1. **No Audio Recording to Chord Detection**: We will not perform real-time pitch detection or audio file transcription (e.g. MP3 to chord extraction). Input is text/symbol-based.
2. **No User Accounts, Authentication, or Backend Database**: Everything is 100% client-side. Progressions are shareable via URL query parameters (Base64/LZ-compressed) and saved locally via `localStorage`.
3. **No Native App Store Binaries**: Distributed purely as an installable Progressive Web App (PWA) with offline support, avoiding App Store / Google Play packaging overhead in v1.
4. **No MIDI Hardware Output**: Web MIDI output to external synthesizers is deferred to a future update.

---

## Open Questions / Decisions I Need From You

Before writing any implementation code, please review the following architectural decisions:

1. **Default Audio Sample Bank**:
   - *Option 1 (Recommended)*: Load a ~2.5 MB curated acoustic guitar sample set (pre-cached via Service Worker) for warm, authentic realism.
   - *Option 2*: Use 100% synthesized Karplus-Strong physical modeling (0 network assets, but more synthetic/harpsichord-like timbre).
   - *Option 3*: Support both, defaulting to sampled guitar with a toggle in settings.

2. **Chord Duration Defaulting**:
   - In songs where beat durations aren't explicitly typed (e.g. simple `C G Am F`), should each chord default to **4 beats (1 full measure)** or **2 beats (half measure)** in standard 4/4 time?

3. **Fretboard Diagram Display**:
   - Would you prefer the fretboard oriented **horizontally** (headstock on left, classic tablature view) or **vertically** (chord-chart box view, nut at top), or a toggleable setting?
