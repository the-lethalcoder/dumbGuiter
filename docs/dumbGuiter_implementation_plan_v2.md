# Architecture & Implementation Plan v2: Chord-to-Guitar Playback Web App ("dumbGuiter")

A client-side Progressive Web App (PWA) built with Next.js, TypeScript, and Tone.js / Web Audio API that transforms arbitrary chord progressions, chord-over-lyric text, and ChordPro sheets into realistic, expressive acoustic guitar playback with real-time fretboard visualization and an interactive Chord Builder.

---

## Document Changelog (v1 $\to$ v2)

| Area / Topic | Summary of Changes in v2 |
| :--- | :--- |
| **Decisions Locked In** | • **Audio Driver**: Sampled acoustic guitar (`Tone.Sampler`) as primary driver; `KarplusStrongGuitarDriver` built as dormant fallback.<br>• **Default Duration**: Chords default to **4 beats** (one 4/4 measure) when unannotated.<br>• **Fretboard View**: Default view is **vertical chord-box style** (nut at top).<br>• **Input Scope**: Plain-text paste only. No external URL scraping or PDF upload in v1. |
| **Chord Grammar & Parser** (Sec 2) | • **4 Input Formats**: Plain chord list, per-chord annotated durations, chords-over-lyrics, and **inline-bracket ChordPro tags** (`[G]Wise men...`).<br>• **One-Shot Articulation (`*`)**: Supports glued-on (`A*`, `Cmaj7*`) and standalone single-strum indicators as a distinct AST field.<br>• **`N.C.` (No Chord / Silence)**: First-class silent rest event.<br>• **Repeat Markers**: Supports bar repeats (`%`) and loop multipliers (`x2`, `x4`).<br>• **Section Inheritance**: Reappearing standalone section tags (e.g. `[Chorus]`) reuse previously parsed chord sequences.<br>• **Strict Line Classification**: A line is a chord line iff **every** non-whitespace token satisfies the chord grammar; immune to scrambled line order.<br>• **Accidental Preservation**: Preserves exact typed `#` or `b` per chord without key-detection heuristics. |
| **Chord Builder UI** (Sec 1, 6) | • **Canonical Editable Timeline**: Structured visual representation (`Sections $\to$ Chords $\to$ Durations $\to$ Articulations`) used both to build progressions from scratch and to visually inspect/correct parser imports. |
| **Voicing Search & Performance** (Sec 3) | • **Pre-Filtered Candidate Search**: Filters frets per string ($13 \to \le 2$) before branching, slashing search space from $4.8 \times 10^6$ to $\le 64$ combinations ($< 0.1\text{ ms}$).<br>• **Memoization Cache (`VoicingCache`)**: LRU map keyed by normalized chord + capo + tuning; invalidated only on capo/tuning state mutation. |
| **Pitch-Shift Realism & Audio** (Sec 4) | • **13-Sample Grid**: Root samples at minor-3rd intervals ($E_2\text{--}E_5$) bounding max pitch-shift to $\le \pm 1.5$ semitones (imperceptible artifact threshold).<br>• **Sample Asset Source**: **Versilian Community Sample Library (VCSL) / FreePats Steel-String Acoustic Guitar** (Creative Commons CC0 / Public Domain), $\approx 1.1\text{ MB}$ total download. |
| **Scope Boundaries & v1.1** (Sec 9) | • Explicitly marked PDF upload, web scraping, custom fret diagram overrides (`x02210`), and BPM text auto-detection as v1.1 deferred features. |

---

## 1. Architecture Overview

### Major Modules & Data Flow

```
                             [ User Input ]
          (Paste: Compact "C G Am F", Chords-over-Lyrics, ChordPro "[G]Text",
           One-shots "A*", N.C., Repeat markers "%", "x2", or manual UI build)
                                    │
                                    ▼
              ┌───────────────────────────────────────────┐
              │          1. Parser & Line Classifier      │
              │  - Strict Line Classifier (All tokens)    │
              │  - Tokenizer (Roots, Qualities, N.C., *)  │
              │  - ChordPro Bracket Stripper/Anchor       │
              │  - Section Resolver & Repeat Expander     │
              │  - Accidental Preservation (No Key Guess) │
              └─────────────────────┬─────────────────────┘
                                    │
                                    ▼
              ┌───────────────────────────────────────────┐
              │      Canonical Song AST (Zustand Store)   │
              │  - Structured Sections & SongEvents       │
              │  - Bidirectional Sync with Chord Builder  │
              └─────────────────────┬─────────────────────┘
                                    │
                                    ▼
              ┌───────────────────────────────────────────┐
              │           2. Voicing Generator            │
              │  - LRU Memoization Cache (VoicingCache)   │
              │  - Common Shape Table Lookup              │
              │  - Pre-filtered Branch-and-Bound Fallback │
              │  - Tuning & Capo Offset Transformer       │
              └─────────────────────┬─────────────────────┘
                                    │
                        Voiced Timeline Sequence
             (Fret array: [x, 3, 2, 0, 1, 0], MIDI Pitches)
                                    │
                                    ▼
              ┌───────────────────────────────────────────┐
              │         3. Strum & Rhythm Engine          │
              │  - Pattern Expander (D-DU.. vs One-Shot *)│
              │  - Micro-timing Strum Sweep (15-45ms)     │
              │  - Stroke-Weighted Velocity Shaper        │
              └─────────────────────┬─────────────────────┘
                                    │
                          Scheduled Audio Events
                                    │
              ┌─────────────────────┴─────────────────────┐
              ▼                                           ▼
┌───────────────────────────┐               ┌───────────────────────────┐
│  4. Tone.js Audio Engine  │               │   5. Reactive UI & Deck   │
│  - Multi-Sample Sampler   │               │  - Tone.Draw sync loop    │
│    (13 VCSL CC0 Samples)  │               │  - Vertical Chord Box     │
│  - Dynamic Filter & FX    │               │  - Chord Builder Timeline │
│  - ServiceWorker Cache    │               │  - Transport & Scroller   │
└───────────────────────────┘               └───────────────────────────┘
```

### Module Responsibilities

1. **Parser & Line Classifier (`@/lib/music/parser`)**:
   - Accepts 4 distinct input formats and transforms them into the canonical Song AST.
   - Applies strict line classification: a line is a chord line only if **every** non-whitespace token matches chord syntax.
   - Extracts one-shot `*` articulations, `N.C.` rests, `%` bar repeats, `x2`/`x4` section multipliers, and resolves standalone section tag references (e.g. repeating `[Chorus]`).

2. **Canonical State & Chord Builder (`@/lib/store/useSongStore`)**:
   - The central source of truth is a clean, structured data tree: `Song -> Section[] -> SongEvent[] -> { chord, duration, articulation }`.
   - The **Chord Builder UI** provides visual, interactive manipulation of this timeline (add, remove, reorder, adjust duration, toggle one-shot `*`, inspect voicing).

3. **Voicing Engine & Cache (`@/lib/music/voicing`)**:
   - Maps pitch-class requirements to 6-string fret positions.
   - Evaluates common chord shapes first; falls back to an algorithmic search with candidate fret pre-filtering.
   - Caches computed voicings in memory (`VoicingCache`), clearing entries only when Capo or Tuning changes.

4. **Strum & Rhythm Engine (`@/lib/audio/strum`)**:
   - Converts each voiced chord into string pluck events.
   - Evaluates articulation: standard rhythmic strum patterns (`D-DU-UDU`) vs. one-shot single strums (`*` - ring out once for full duration).
   - Simulates pick travel sweeps ($15\text{--}45\text{ms}$) and humanized velocity variations.

5. **Audio Engine (`@/lib/audio/engine`)**:
   - Employs a primary `SampledGuitarDriver` utilizing a bounded 13-sample acoustic guitar soundbank loaded into `Tone.Sampler`.
   - Maintains `KarplusStrongGuitarDriver` behind a unified `GuitarAudioDriver` interface as a dormant zero-asset fallback.
   - Uses `Tone.Draw` to keep visual UI components 100% in phase with audio playback without UI thread jitter.

---

## 2. Chord Input & Parsing

### 4 Supported Input Formats

1. **Format 1: Plain / Compact Chord Progression**:
   ```
   C G Am F
   Em Bm C G
   ```
2. **Format 2: Per-Chord Duration & Articulation Annotated**:
   ```
   C(4) G(2) Am(2) F*(4)
   | Cmaj7(4) | Am9(2) G7(2) | F*(4) |
   ```
3. **Format 3: Chords Over Lyrics (Standard Song Sheet)**:
   ```
   [Verse 1]
   G                 Em
   Wise men say only fools rush in
   C   G   D     Em    C       G   D    G*
   But I can't help falling in love with you
   ```
4. **Format 4: Inline-Bracket (ChordPro-Style)**:
   ```
   [Verse 1]
   [G]Wise men say [Em]only fools rush [C]in
   But [C]I [G]can't [D]help [Em]falling in [C]love [G]with [D]you[G*]
   ```

### Strict Line Classification Rule

To ensure chord sequences never get corrupted when chord/lyric lines get interleaved or scrambled by mobile clipboard pasting:
- **Header Line**: Matches `^\[([^\]]+)\]$` or `^\{([^}]+)\}$`.
- **Chord Line**: Every non-whitespace token on the line must validate against the chord / control grammar (Root + Quality + Ext, `N.C.`, `%`, or `xN`). If even one token is plain text (e.g. "and", "the", "verse"), the entire line is treated as a **Lyric Line**.
- **ChordPro Line**: Contains one or more bracketed tokens `[Chord]` embedded within text. The parser extracts the chord tokens while retaining character offset anchors to the lyrics.

### AST Data Model

```typescript
export type NoteLetter = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
export type Accidental = '#' | 'b' | '' | '♯' | '♭';
export type ChordArticulation = 'strum_pattern' | 'one_shot'; // 'one_shot' triggered by '*'

export interface ChordToken {
  type: 'chord';
  raw: string;                          // e.g. "F#m7(b5)*/C(2)"
  root: `${NoteLetter}${Accidental}`;  // "F#" (preserves typed accidental)
  rootPitchClass: number;               // 0..11 (0=C, 1=C#, 6=F#)
  quality: string;                      // "maj", "m", "dim", "aug", "sus2", "sus4", "5", etc.
  extensions: number[];                 // [7]
  alterations: string[];                // ["b5"]
  intervals: number[];                  // Relative semitones from root: [0, 3, 6, 10]
  pitchClasses: number[];               // Absolute pitch classes: [6, 9, 0, 4]
  bassNote?: `${NoteLetter}${Accidental}`; // "C"
  bassPitchClass?: number;              // 0
  durationBeats: number;                // Default: 4 (or parsed from "(2)")
  articulation: ChordArticulation;      // 'one_shot' if appended with '*', else 'strum_pattern'
  columnOffset: number;                 // Position in line for lyric sync
  isValid: boolean;
  errorMessage?: string;
}

export interface RestToken {
  type: 'rest';                         // Produced by "N.C." / "N.C" / "NC"
  raw: string;
  durationBeats: number;                // Default: 4
  columnOffset: number;
}

export interface RepeatToken {
  type: 'repeat';                       // Produced by "%" or "x2" / "x4"
  raw: string;
  repeatCount: number;                  // "%" -> 1 bar repeat; "x2" -> repeat 2 times
  scope: 'previous_chord' | 'line' | 'section';
}

export interface SectionHeaderToken {
  type: 'section_header';               // e.g. "[Chorus]", "[Verse 1]"
  name: string;                         // "Chorus"
  isReferenceOnly: boolean;             // true if standalone tag inheriting previous chords
}

export type ParsedSongToken = ChordToken | RestToken | RepeatToken | SectionHeaderToken;
```

### Comprehensive Parsing Grammar

| Token Type | Regex / Pattern | Example Matches | Parsed Meaning |
| :--- | :--- | :--- | :--- |
| **Chord Token** | `^([A-Ga-g][#b♯♭]?)(quality?)(ext?)(alts?)(\/[A-Ga-g][#b♯♭]?)?(\*)?(\((\d+(\.\d+)?)\))?$` | `C`, `Am7`, `F#m(maj7)`, `D/F#`, `A*`, `G7(2)`, `Bbm9*(2)` | Full musical chord. Appended `*` flags `articulation: 'one_shot'`. |
| **No Chord (Silence)** | `^(N\.?C\.?\|NC\|SILENCE\|REST)(\*)?(\((\d+(\.\d+)?)\))?$` (case-insensitive) | `N.C.`, `N.C`, `NC`, `N.C.(2)` | Produces `RestToken` (silent transport advance, default 4 beats). |
| **Bar / Chord Repeat** | `^(%\|repeat)(\((\d+)\))?$` | `%`, `%(2)` | Copies previous chord event for $N$ beats. |
| **Multiplier** | `^[xX](\d+)$` | `x2`, `x4` | Repeats previous chord/line/section $N$ times. |
| **Section Tag** | `^\[([^\]]+)\]$` or `^\{([^}]+)\}$` | `[Verse 1]`, `[Chorus]` | Section boundary. Empty tag reappearing later inherits previously registered chords. |
| **Inline ChordPro** | `\[([^\]]+)\]` embedded in lyrics | `[G]Wise [Em]men` | Extracted into anchored chord token above the lyric syllable. |

### Section-Repeat Resolution Logic

```typescript
function resolveSectionRepeats(tokens: ParsedSongToken[]): ParsedSongToken[] {
  const sectionRegistry = new Map<string, ParsedSongToken[]>();
  const resolvedOutput: ParsedSongToken[] = [];
  let currentSectionName: string | null = null;
  let currentSectionTokens: ParsedSongToken[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token.type === 'section_header') {
      if (currentSectionName && currentSectionTokens.length > 0) {
        sectionRegistry.set(currentSectionName.toLowerCase(), [...currentSectionTokens]);
      }
      currentSectionName = token.name;
      currentSectionTokens = [];

      const nextToken = tokens[i + 1];
      const isStandaloneTag = !nextToken || nextToken.type === 'section_header';
      const existingSection = sectionRegistry.get(token.name.toLowerCase());

      if (isStandaloneTag && existingSection) {
        resolvedOutput.push(...existingSection);
        continue;
      }
    } else {
      if (currentSectionName) {
        currentSectionTokens.push(token);
      }
      resolvedOutput.push(token);
    }
  }

  if (currentSectionName && currentSectionTokens.length > 0) {
    sectionRegistry.set(currentSectionName.toLowerCase(), [...currentSectionTokens]);
  }

  return resolvedOutput;
}
```

---

## 3. Chord-to-Voicing Mapping & Search Optimization

### 6-String Fretboard Model
- Tuning array: `[E2 (40), A2 (45), D3 (50), G3 (55), B3 (59), E4 (64)]` (MIDI note numbers).
- Voicing representation: `type Voicing = (number | 'x')[]` (where `'x'` = muted string).

### Common-Shape Library (Primary Path)
Instant dictionary lookup handles standard open and barre forms (`maj`, `min`, `7`, `maj7`, `m7`, `sus2`, `sus4`, `dim`, `aug`, `add9`, `5`).

### Pre-Filtered Algorithmic Search (Fallback Path)

When an uncataloged chord is encountered, the search space is pre-filtered before branching:

```
                      Pitch Classes Needed: e.g. {6, 9, 0, 4}, Bass: 6
                                             │
      ┌──────────────────────────────────────┴──────────────────────────────────────┐
      │ Step 1: Pre-filter candidate frets per string                              │
      │ For each string (6..1), find ONLY frets (0..12) where:                      │
      │   (stringBasePitch + fret) % 12 ∈ PitchClassesNeeded  OR  fret === 'x'       │
      │ Result: At most 1–2 frets + 'x' per string (e.g., [2, 8, 'x'])              │
      └──────────────────────────────────────┬──────────────────────────────────────┘
                                             │
      ┌──────────────────────────────────────┴──────────────────────────────────────┐
      │ Step 2: Bounded Branch-and-Bound (Total combinations: ≤ 3^6 = 729 max,      │
      │         typically ≤ 64 valid branches)                                      │
      │ Prune branch IMMEDIATELY if:                                                │
      │   - (maxFret - minFret) > 4 (excluding fret 0)                             │
      │   - Lowest sounding string != required bass note                            │
      │   - Non-barre finger count > 4                                              │
      └──────────────────────────────────────┬──────────────────────────────────────┘
                                             │
      ┌──────────────────────────────────────┴──────────────────────────────────────┐
      │ Step 3: Cost Scoring & Selection                                            │
      │ Score = (Span × 15) + (MutedStrings × 20) + (MissingIntervalPenalties)      │
      │ Select minimal score voicing (< 0.1ms computation)                          │
      └─────────────────────────────────────────────────────────────────────────────┘
```

### Memoization Cache (`VoicingCache`)

```typescript
export class VoicingCache {
  private static cache = new Map<string, Voicing>();

  public static getCacheKey(
    pitchClasses: number[],
    bassPitchClass: number | undefined,
    capo: number,
    tuning: number[]
  ): string {
    const pcKey = [...pitchClasses].sort((a, b) => a - b).join(',');
    const bassKey = bassPitchClass !== undefined ? bassPitchClass : 'none';
    const tuningKey = tuning.join(',');
    return `${pcKey}_b${bassKey}_c${capo}_t${tuningKey}`;
  }

  public static get(key: string): Voicing | undefined {
    return this.cache.get(key);
  }

  public static set(key: string, voicing: Voicing): void {
    if (this.cache.size > 2000) this.cache.clear();
    this.cache.set(key, voicing);
  }

  public static invalidate(): void {
    this.cache.clear();
  }
}
```

*Cache Lifecycle*: Lives in `src/lib/music/voicings.ts`. Persists across edits and is cleared via `VoicingCache.invalidate()` only upon **Capo** or **Guitar Tuning** changes.

---

## 4. Audio Rendering Approach & Sample Sourcing

### Sample Distribution & Pitch-Shift Bounding

To avoid unnatural timbral distortion (formant shift and transient degradation) while keeping payload minimal, we use a **13-sample grid spaced at minor 3rds (3 semitones)**:

$$\text{Sample Grid: } [E_2, G_2, A\#_2, C\#_3, E_3, G_3, A\#_3, C\#_4, E_4, G_4, A\#_4, C\#_5, E_5]$$

- **MIDI Note Numbers**: `[40, 43, 46, 49, 52, 55, 58, 61, 64, 67, 70, 73, 76]`
- **Maximum Pitch Shift**: $\le \pm 1.5$ semitones for any note on the fretboard (acoustically imperceptible).

### Asset Sourcing & Licensing

- **Library**: **Versilian Community Sample Library (VCSL) / FreePats Steel-String Acoustic Guitar**.
- **Licensing**: **Creative Commons Zero (CC0 1.0 Universal / Public Domain)**.
- **Asset Size**: 13 clean mono $44.1\text{ kHz}$ VBR MP3s ($\approx 80\text{ KB}$ per note) $\to$ **$\approx 1.05\text{ MB}$ total download**, cached offline via Service Worker.

### Audio Graph Architecture

```
Tone.Sampler (13 VCSL CC0 Samples)
       │
       ▼
Tone.Filter (Dynamic 24dB/oct Low-Pass: 2.5kHz on soft upstrokes, 12kHz on accented downstrokes)
       │
       ▼
Tone.Volume (Velocity scaling: 0.0 to 1.0)
       │
       ▼
Tone.Reverb (Subtle 1.2s acoustic room impulse response, 12% wet)
       │
       ▼
Tone.Destination (Master Output)
```

---

## 5. Strumming & Timing Engine

### Articulations: Strum Pattern vs. One-Shot (`*`)

1. **Standard Pattern Mode (`strum_pattern`)**:
   - Executes selected 16-step subdivision rhythm (e.g. `D - D U - U D U`).
   - Applies micro-timing sweep across strings ($15\text{--}45\text{ms}$):
     $$\Delta t_{\text{strum}} = \text{clamp}\left(35\text{ms} \times \frac{120}{\text{BPM}}, 15\text{ms}, 45\text{ms}\right)$$
   - Downstroke: low-to-high strings, bass-weighted velocity. Upstroke: high-to-low strings, treble-weighted velocity.
2. **One-Shot Mode (`one_shot` / `*`)**:
   - Triggered when chord is marked with `*` (e.g. `A*`, `G*`, `Cmaj7*`).
   - Plays exactly **one resonant, accented downstroke** at beat 0 and lets all strings ring out naturally for the entire duration of the chord without additional strumming.
3. **No Chord (`N.C.`)**:
   - Advances playback transport timer silently with zero audio plucks.

### Sample-Accurate Transport & UI Sync (`Tone.Draw`)

```typescript
export function scheduleSongPlayback(
  events: ScheduledStrumEvent[],
  onChordVisualChange: (index: number) => void
) {
  Tone.Transport.cancel();

  events.forEach((event) => {
    Tone.Transport.schedule((time) => {
      // 1. Audio Thread (High Priority Sample Triggering)
      if (event.type === 'strum') {
        event.notes.forEach(({ pitch, offset, velocity }) => {
          samplerDriver.triggerAttackRelease(pitch, '2n', time + offset, velocity);
        });
      }

      // 2. UI Thread (Synchronized at 60fps via requestAnimationFrame)
      Tone.Draw.schedule(() => {
        onChordVisualChange(event.chordIndex);
      }, time);
    }, event.transportTime);
  });
}
```

---

## 6. UI/UX & Chord Builder Architecture

### Dual-View Interface: Text Import + Canonical Chord Builder

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🎸 dumbGuiter                     [ Capo: 0 ▼ ] [ Tuning: Standard ▼ ] [ ⚙ ]│
├─────────────────────────────────────────────────────────────────────────────┤
│ ┌───────────────────────────────┐ ┌───────────────────────────────────────┐ │
│ │  CANONICAL CHORD BUILDER      │ │  VERTICAL CHORD BOX VISUALIZER        │ │
│ │  [ + Section ] [ + Chord ]    │ │              D Major                  │ │
│ │                               │ │            ✕ ✕ 0 2 3 2                │ │
│ │  ▼ Verse 1                    │ │            E A D G B e                │ │
│ │  ┌─────────┐ ┌─────────┐      │ │         ╔══╤══╤══╤══╤══╤══╗ (Nut)     │ │
│ │  │ C       │ │ G       │      │ │  Fret 1 ╟──┼──┼──┼──┼──┼──╢           │ │
│ │  │ 4 bts   │ │ 2 bts   │      │ │  Fret 2 ╟──┼──┼──┼──●──┼──●╢           │ │
│ │  │ Pattern │ │ One-shot│      │ │  Fret 3 ╟──┼──┼──┼──┼──●──┼╢           │ │
│ │  └─────────┘ └─────────┘      │ │         ╚══╧══╧══╧══╧══╧══╝           │ │
│ │  [ 📝 Switch to Raw Text/Tab ]│ │                                       │ │
│ └───────────────────────────────┘ └───────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────────┤
│  TRANSPORT & PLAYBACK DECK                                                  │
│  [ ▶ Play ] [ ⏸ Pause ] [ 🔁 Loop ]  Tempo: [ 120 BPM ━●━━━ ] [ Tap Tempo ] │
│  Transpose: [ -1 ] [ C ] [ +1 ]   Pattern: [ Pop 4/4 (D-DU-UDU) ▼ ] [ Edit ]│
│                                                                             │
│  [=============================●==========================================] │
│   Measure 1: Cmaj               Measure 2: Gmaj               Measure 3...  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key UI Features

1. **Chord Builder Timeline**:
   - Interactive sequence of editable chord cards grouped by section.
   - Click to edit root, quality, duration beats, or toggle one-shot `*` articulation.
   - Reorder cards via drag-and-drop or step buttons.
   - Instant import parser: pasting raw text automatically populates the Chord Builder.
2. **Vertical Chord Box (Nut at Top)**:
   - High-contrast vertical diagram with open string circles (`○`), muted crosses (`✕`), and finger position badges.
   - Badge text toggles: Note Names (`C`, `E`, `G`), Intervals (`R`, `3`, `5`), or Finger Numbers (`1`, `2`, `3`).
3. **Transport Deck**:
   - Big Play/Pause button, Tap Tempo, dynamic BPM slider, Transpose $-/+$ semitones, and 16-step rhythm pattern editor.

---

## 7. Edge Cases & Resilience Strategy

| Edge Case | Failure Mode / Challenge | Mitigation Strategy |
| :--- | :--- | :--- |
| **`N.C.` (No Chord)** | Parser failure on non-letter token. | `RestToken` creates silent transport gap of specified beat duration. |
| **One-Shot `*` (`A*`, `G*`)** | Strumming pattern executes when single ring is expected. | Tokenizer parses trailing `*` into `articulation: 'one_shot'`; scheduler fires single downstroke and sustains. |
| **Repeat Tokens (`%`, `x2`, `x4`)** | Unparsed symbols in chord progression. | Repeats preceding chord AST or loops section sequence $N$ times. |
| **Section Tag Re-use (`[Chorus]`)** | Empty recurring section tags. | Section resolver looks up previously registered section tokens and duplicates them into playback AST. |
| **Scrambled Line Order** | Interleaved lyrics and chords pasted in wrong order. | Strict line classification: line is chord line only if **every** token is valid chord/control syntax. |
| **Unrecognized Token** (e.g. `Hmaj7`, `C#???`) | Potential crash. | Flagged with red underline in Builder; plays soft muted ghost strum in audio. |
| **Rapid Chord Changes** (< 1 beat) | Strum sweeps overlap or stutter audio buffer. | Sub-beat scheduler compresses strum sweep duration to $\le 50\%$ of the beat window. |
| **Unfingerable Voicing** (Complex jazz chord) | Impossible hand stretch. | Pre-filtered search drops 5th and prioritizes Root, 3rd, 7th within 4 frets. |
| **Long Song / Setlist** (500+ lines) | DOM lag & memory exhaustion. | Virtualized timeline rendering; chunked Tone.js scheduling in rolling 8-measure windows. |

---

## 8. Project File & Folder Structure (Next.js App Router)

```
dumbGuiter/
├── docs/                          # Project documentation
│   ├── dumbGuiter_implementation_plan_v1.md
│   └── dumbGuiter_implementation_plan_v2.md
├── public/
│   ├── audio/
│   │   └── acoustic-guitar/       # 13 VCSL CC0 MP3 samples (E2..E5)
│   ├── icons/                     # PWA icons (192x192, 512x512)
│   ├── manifest.json              # PWA manifest
│   └── sw.js                      # Service Worker for offline audio caching
├── src/
│   ├── app/
│   │   ├── layout.tsx             # Root layout, fonts, meta tags
│   │   ├── page.tsx               # Main application container
│   │   └── globals.css            # Dark mode tokens, animations, custom utilities
│   ├── components/
│   │   ├── builder/
│   │   │   ├── ChordBuilder.tsx   # Canonical interactive timeline editor
│   │   │   ├── ChordCard.tsx      # Draggable/editable chord chip
│   │   │   └── SectionBlock.tsx   # Collapsible section container
│   │   ├── editor/
│   │   │   ├── ChordInput.tsx     # Text area for 4-format import
│   │   │   └── LyricDisplay.tsx   # Synced scrolling lyrics view
│   │   ├── fretboard/
│   │   │   ├── FretboardView.tsx  # SVG vertical chord box component
│   │   │   └── FretMarker.tsx     # Note badge with interval/finger labels
│   │   ├── player/
│   │   │   ├── PlaybackControls.tsx # Play/pause, tempo, loop
│   │   │   ├── StrumPatternEditor.tsx # 16-step rhythm grid editor
│   │   │   └── TransposeControl.tsx # Key transposer (-/+ semitones)
│   │   └── ui/                    # Reusable modern UI elements (Buttons, Sliders, Modals)
│   ├── lib/
│   │   ├── audio/
│   │   │   ├── AudioEngine.ts     # Master Tone.js orchestrator & audio graph
│   │   │   ├── SamplerDriver.ts   # Primary multi-sample soundfont driver
│   │   │   ├── SynthDriver.ts     # Karplus-Strong physical modeling fallback
│   │   │   ├── StrumScheduler.ts  # Micro-timing stroke generator (Pattern vs One-Shot)
│   │   │   └── patterns.ts        # Built-in strumming patterns library
│   │   ├── music/
│   │   │   ├── parser.ts          # 4-format parser, ChordPro extractor, N.C., *
│   │   │   ├── theory.ts          # Intervals, pitch classes, transpositions
│   │   │   ├── voicings.ts        # Common chord shape dictionary & VoicingCache
│   │   │   ├── searchVoicing.ts   # Pre-filtered algorithmic search engine
│   │   │   └── tunings.ts         # Standard, Drop-D, DADGAD, Open-G definitions
│   │   └── store/
│   │       └── useSongStore.ts    # Central Zustand state (progression, playback, tempo)
│   ├── hooks/
│   │   ├── useAudioPlayer.ts      # React hook binding Tone.js to UI state
│   │   └── usePWA.ts              # Service worker registration & install hook
│   └── types/
│       ├── audio.ts               # Types for audio scheduling & drivers
│       └── music.ts               # Types for chords, voicings, tokens, AST
├── next.config.mjs
├── tsconfig.json
├── package.json
└── README.md
```

---

## 9. Scope Boundaries & Explicit Non-Goals for v1

### Strict Non-Goals for v1
1. **No External URL Scraping**: Input is paste-only text or direct Chord Builder entry. No scraping from ultimate-guitar.com or other external websites.
2. **No PDF File Upload / OCR**: Raw text paste only; PDF parsing is deferred.
3. **No User Accounts or Backend Database**: 100% client-side with URL-based state sharing (LZ-compressed) and `localStorage`.
4. **No Native App Store Binaries**: Distributed purely as an installable PWA.
5. **No Audio-to-Chord Transcription**: Audio file transcription is out of scope.

### Deferred to v1.1 (Post-MVP)
- **Chord Diagram Voicing Override**: Parsing explicit fret diagrams in headers (e.g. `D: xx0232`) to override algorithmic search.
- **Auto-Detected Tempo Hint**: Extracting stated BPM in song text (e.g. `BPM: 120` or `{tempo: 120}`).

---

## Readiness & Next Steps

All requirements, new v2 features, performance bounds, and locked-in decisions are fully integrated into this specification. **No implementation code has been written.**

Upon your explicit approval of `dumbGuiter_implementation_plan_v2.md`, I will proceed directly with initializing the Next.js project and executing the implementation.
