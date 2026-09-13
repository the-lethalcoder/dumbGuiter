export type NoteLetter = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
export type Accidental = '#' | 'b' | '' | '♯' | '♭';
export type NoteName = `${NoteLetter}${Accidental}`;

export type ChordArticulation = 'strum_pattern' | 'one_shot'; // 'one_shot' when marked with '*'

export type Voicing = (number | 'x')[]; // 6-element tuple: string 6 down to 1

export interface ChordToken {
  type: 'chord';
  id: string;                          // Unique ID for builder and playback tracking
  raw: string;                          // e.g. "F#m7(b5)*/C(2)"
  root: NoteName;                       // "F#"
  rootPitchClass: number;               // 0..11 (0=C, 1=C#/Db, ..., 6=F#)
  quality: string;                      // "maj", "m", "dim", "aug", "sus2", "sus4", "5", etc.
  extensions: number[];                 // [7]
  alterations: string[];                // ["b5"]
  intervals: number[];                  // Relative semitones from root: [0, 3, 6, 10]
  pitchClasses: number[];               // Absolute pitch classes: [6, 9, 0, 4]
  bassNote?: NoteName;                  // "C"
  bassPitchClass?: number;              // 0
  durationBeats: number;                // Default: 4 (or parsed from "(2)")
  articulation: ChordArticulation;      // 'one_shot' if appended with '*', else 'strum_pattern'
  columnOffset?: number;                // Line position for lyric sync
  isValid: boolean;
  errorMessage?: string;
  voicing?: Voicing;                    // Resolved fretboard shape
}

export interface RestToken {
  type: 'rest';
  id: string;
  raw: string;
  durationBeats: number;
  articulation: ChordArticulation;
  columnOffset?: number;
}

export interface RepeatToken {
  type: 'repeat';
  id: string;
  raw: string;
  repeatCount: number;
  scope: 'previous_chord' | 'line' | 'section';
}

export interface SectionHeaderToken {
  type: 'section_header';
  id: string;
  name: string;
  isReferenceOnly: boolean;
}

export type ParsedSongToken = ChordToken | RestToken | RepeatToken | SectionHeaderToken;

export interface LyricLineSegment {
  text: string;
  chord?: ChordToken | RestToken;
}

export interface LyricLine {
  segments: LyricLineSegment[];
  rawChordsLine?: string;
  rawLyricsLine?: string;
}

export interface SongSection {
  id: string;
  name: string;
  events: (ChordToken | RestToken)[];
  lyrics?: LyricLine[];
}

export interface SongAST {
  title?: string;
  artist?: string;
  sections: SongSection[];
  rawInput: string;
}

export interface GuitarTuning {
  id: string;
  name: string;
  notes: NoteName[];
  midiPitches: [number, number, number, number, number, number]; // Strings 6 to 1
}
